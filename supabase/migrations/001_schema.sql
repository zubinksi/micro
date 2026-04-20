-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Profiles ────────────────────────────────────────────────────────────────

CREATE TABLE profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      text UNIQUE NOT NULL,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ─── Groups ───────────────────────────────────────────────────────────────────

CREATE TABLE groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text,
  invite_code  text UNIQUE DEFAULT upper(encode(gen_random_bytes(4), 'hex')),
  admin_id     uuid NOT NULL REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Members join table
CREATE TABLE group_members (
  group_id   uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at  timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Visibility: only members can see a group and its members
CREATE POLICY "groups_select" ON groups FOR SELECT
  USING (
    id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "groups_insert" ON groups FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "groups_update" ON groups FOR UPDATE
  USING (auth.uid() = admin_id);

CREATE POLICY "group_members_select" ON group_members FOR SELECT
  USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "group_members_insert" ON group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "group_members_delete" ON group_members FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Markets ──────────────────────────────────────────────────────────────────

CREATE TYPE market_status AS ENUM ('open', 'locked', 'resolving', 'settled', 'voided');
CREATE TYPE resolver_type  AS ENUM ('autocrat', 'consensus', 'oracle');

CREATE TABLE markets (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id             uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  creator_id           uuid NOT NULL REFERENCES profiles(id),
  question             text NOT NULL,
  resolution_criteria  text NOT NULL,
  closes_at            timestamptz NOT NULL,
  resolves_at          timestamptz,
  resolver_type        resolver_type DEFAULT 'consensus',
  resolver_id          uuid REFERENCES profiles(id),  -- only for autocrat
  status               market_status DEFAULT 'open',
  yes_pool             numeric(12,2) DEFAULT 0 CHECK (yes_pool >= 0),
  no_pool              numeric(12,2) DEFAULT 0 CHECK (no_pool >= 0),
  created_at           timestamptz DEFAULT now(),
  -- closes_at must be in the future at creation; resolves_at after closes_at
  CONSTRAINT closes_in_future CHECK (closes_at > created_at),
  CONSTRAINT resolves_after_close CHECK (resolves_at IS NULL OR resolves_at >= closes_at)
);

ALTER TABLE markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "markets_select" ON markets FOR SELECT
  USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "markets_insert" ON markets FOR INSERT
  WITH CHECK (
    auth.uid() = creator_id
    AND group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

-- Only system/edge functions update markets (via service role), so no RLS update policy for users.
-- Creator can void their own open market.
CREATE POLICY "markets_update_creator" ON markets FOR UPDATE
  USING (auth.uid() = creator_id AND status = 'open');

-- ─── Positions ────────────────────────────────────────────────────────────────

CREATE TYPE outcome AS ENUM ('YES', 'NO');

CREATE TABLE positions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id   uuid NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id),
  outcome     outcome NOT NULL,
  stake       numeric(10,2) NOT NULL CHECK (stake > 0),
  filled_at   timestamptz DEFAULT now(),
  UNIQUE (market_id, user_id)  -- one position per user per market
);

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "positions_select" ON positions FOR SELECT
  USING (
    market_id IN (
      SELECT m.id FROM markets m
      JOIN group_members gm ON gm.group_id = m.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

-- Insert handled by edge function (service role) to ensure atomic pool update.
CREATE POLICY "positions_insert" ON positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── Resolutions ─────────────────────────────────────────────────────────────

CREATE TABLE resolutions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id     uuid NOT NULL UNIQUE REFERENCES markets(id) ON DELETE CASCADE,
  outcome       outcome NOT NULL,
  evidence_url  text,
  resolved_by   uuid NOT NULL REFERENCES profiles(id),
  disputed      boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resolutions_select" ON resolutions FOR SELECT
  USING (
    market_id IN (
      SELECT m.id FROM markets m
      JOIN group_members gm ON gm.group_id = m.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "resolutions_insert" ON resolutions FOR INSERT
  WITH CHECK (auth.uid() = resolved_by);

-- ─── Dispute Votes ────────────────────────────────────────────────────────────

CREATE TABLE dispute_votes (
  resolution_id  uuid NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES profiles(id),
  vote           outcome NOT NULL,  -- their preferred outcome
  created_at     timestamptz DEFAULT now(),
  PRIMARY KEY (resolution_id, user_id)
);

ALTER TABLE dispute_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispute_votes_select" ON dispute_votes FOR SELECT USING (true);

CREATE POLICY "dispute_votes_insert" ON dispute_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── Settlements (IOU Ledger) ─────────────────────────────────────────────────

CREATE TABLE settlements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id     uuid NOT NULL REFERENCES markets(id),
  from_user_id  uuid NOT NULL REFERENCES profiles(id),
  to_user_id    uuid NOT NULL REFERENCES profiles(id),
  amount        numeric(10,2) NOT NULL CHECK (amount > 0),
  settled       boolean DEFAULT false,
  settled_at    timestamptz,
  created_at    timestamptz DEFAULT now(),
  CHECK (from_user_id != to_user_id)
);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settlements_select" ON settlements FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "settlements_update" ON settlements FOR UPDATE
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- ─── Comments ─────────────────────────────────────────────────────────────────

CREATE TABLE comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id   uuid NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id),
  content     text NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON comments FOR SELECT
  USING (
    market_id IN (
      SELECT m.id FROM markets m
      JOIN group_members gm ON gm.group_id = m.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "comments_insert" ON comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND market_id IN (
      SELECT m.id FROM markets m
      JOIN group_members gm ON gm.group_id = m.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "comments_delete" ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- ─── User Stats / Leaderboard ─────────────────────────────────────────────────

CREATE TABLE user_group_stats (
  user_id             uuid NOT NULL REFERENCES profiles(id),
  group_id            uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  markets_entered     int DEFAULT 0,
  markets_won         int DEFAULT 0,
  total_staked        numeric(12,2) DEFAULT 0,
  total_profit        numeric(12,2) DEFAULT 0,
  -- Brier-score based calibration (lower = better; starts at 0, updated on settlement)
  calibration_score   numeric(6,4) DEFAULT 0,
  updated_at          timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);

ALTER TABLE user_group_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stats_select" ON user_group_stats FOR SELECT
  USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

-- ─── Realtime publications ───────────────────────────────────────────────────

-- Enable realtime on the tables clients subscribe to
ALTER PUBLICATION supabase_realtime ADD TABLE markets;
ALTER PUBLICATION supabase_realtime ADD TABLE positions;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE resolutions;
ALTER PUBLICATION supabase_realtime ADD TABLE dispute_votes;

-- ─── Triggers ────────────────────────────────────────────────────────────────

-- Auto-create profile row on new auth user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-lock market when closes_at passes (called by edge function scheduler)
CREATE OR REPLACE FUNCTION lock_expired_markets()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE markets
  SET status = 'locked'
  WHERE status = 'open' AND closes_at <= now();
END;
$$;

-- Update pool totals when a position is inserted
CREATE OR REPLACE FUNCTION update_market_pool()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.outcome = 'YES' THEN
    UPDATE markets SET yes_pool = yes_pool + NEW.stake WHERE id = NEW.market_id;
  ELSE
    UPDATE markets SET no_pool = no_pool + NEW.stake WHERE id = NEW.market_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_position_inserted
  AFTER INSERT ON positions
  FOR EACH ROW EXECUTE FUNCTION update_market_pool();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_markets_group_id     ON markets(group_id);
CREATE INDEX idx_markets_status       ON markets(status);
CREATE INDEX idx_markets_closes_at    ON markets(closes_at);
CREATE INDEX idx_positions_market_id  ON positions(market_id);
CREATE INDEX idx_positions_user_id    ON positions(user_id);
CREATE INDEX idx_comments_market_id   ON comments(market_id);
CREATE INDEX idx_settlements_from     ON settlements(from_user_id, settled);
CREATE INDEX idx_settlements_to       ON settlements(to_user_id, settled);
CREATE INDEX idx_group_members_user   ON group_members(user_id);
