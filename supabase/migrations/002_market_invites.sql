-- Migration 002: Replace group-level invites with market-level invites

-- 1. Make group_id nullable so markets can exist without a group
ALTER TABLE markets ALTER COLUMN group_id DROP NOT NULL;

-- 2. Add invite_code to markets
ALTER TABLE markets ADD COLUMN IF NOT EXISTS invite_code text UNIQUE
  DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));

-- Backfill codes for any existing markets
UPDATE markets
SET invite_code = upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8))
WHERE invite_code IS NULL;

ALTER TABLE markets ALTER COLUMN invite_code SET NOT NULL;

-- 3. Create market_members table
CREATE TABLE IF NOT EXISTS market_members (
  market_id  uuid NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at  timestamptz DEFAULT now(),
  PRIMARY KEY (market_id, user_id)
);

ALTER TABLE market_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_members_select" ON market_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR market_id IN (SELECT id FROM markets WHERE creator_id = auth.uid())
  );

CREATE POLICY "market_members_insert" ON market_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "market_members_delete" ON market_members FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Update markets RLS: allow access by creator OR market member OR legacy group member
DROP POLICY IF EXISTS "markets_select" ON markets;
DROP POLICY IF EXISTS "markets_insert" ON markets;

CREATE POLICY "markets_select" ON markets FOR SELECT
  USING (
    creator_id = auth.uid()
    OR id IN (SELECT market_id FROM market_members WHERE user_id = auth.uid())
    OR (group_id IS NOT NULL AND group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    ))
  );

-- No longer require group membership to create a market
CREATE POLICY "markets_insert" ON markets FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- 5. Update positions RLS
DROP POLICY IF EXISTS "positions_select" ON positions;

CREATE POLICY "positions_select" ON positions FOR SELECT
  USING (
    market_id IN (SELECT id FROM markets WHERE creator_id = auth.uid())
    OR market_id IN (SELECT market_id FROM market_members WHERE user_id = auth.uid())
    OR market_id IN (
      SELECT m.id FROM markets m
      JOIN group_members gm ON gm.group_id = m.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

-- 6. Update comments RLS
DROP POLICY IF EXISTS "comments_select" ON comments;
DROP POLICY IF EXISTS "comments_insert" ON comments;

CREATE POLICY "comments_select" ON comments FOR SELECT
  USING (
    market_id IN (SELECT id FROM markets WHERE creator_id = auth.uid())
    OR market_id IN (SELECT market_id FROM market_members WHERE user_id = auth.uid())
    OR market_id IN (
      SELECT m.id FROM markets m
      JOIN group_members gm ON gm.group_id = m.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "comments_insert" ON comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      market_id IN (SELECT id FROM markets WHERE creator_id = auth.uid())
      OR market_id IN (SELECT market_id FROM market_members WHERE user_id = auth.uid())
      OR market_id IN (
        SELECT m.id FROM markets m
        JOIN group_members gm ON gm.group_id = m.group_id
        WHERE gm.user_id = auth.uid()
      )
    )
  );

-- 7. Update resolutions RLS
DROP POLICY IF EXISTS "resolutions_select" ON resolutions;

CREATE POLICY "resolutions_select" ON resolutions FOR SELECT
  USING (
    market_id IN (SELECT id FROM markets WHERE creator_id = auth.uid())
    OR market_id IN (SELECT market_id FROM market_members WHERE user_id = auth.uid())
    OR market_id IN (
      SELECT m.id FROM markets m
      JOIN group_members gm ON gm.group_id = m.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

-- 8. Trigger: auto-add market creator to market_members
CREATE OR REPLACE FUNCTION add_creator_to_market_members()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO market_members (market_id, user_id)
  VALUES (NEW.id, NEW.creator_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_market_created
  AFTER INSERT ON markets
  FOR EACH ROW EXECUTE FUNCTION add_creator_to_market_members();

-- 9. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE market_members;

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_market_members_user   ON market_members(user_id);
CREATE INDEX IF NOT EXISTS idx_market_members_market ON market_members(market_id);
CREATE INDEX IF NOT EXISTS idx_markets_invite_code   ON markets(invite_code);
