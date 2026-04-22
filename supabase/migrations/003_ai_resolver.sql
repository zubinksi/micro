-- Migration 003: Add AI (Claude) resolver type

-- 1. Add reference_urls column for AI resolver
ALTER TABLE markets ADD COLUMN IF NOT EXISTS reference_urls text[] DEFAULT NULL;

-- 2. Add 'ai' to the resolver_type enum
ALTER TYPE resolver_type ADD VALUE IF NOT EXISTS 'ai';

-- 3. Migrate existing oracle/consensus markets to autocrat
UPDATE markets SET resolver_type = 'autocrat' WHERE resolver_type IN ('oracle', 'consensus');

-- 4. Fix the markets_update_resolving policy (removes group_members dependency)
DROP POLICY IF EXISTS "markets_update_resolving" ON markets;

CREATE POLICY "markets_update_resolving" ON markets FOR UPDATE
  USING (
    status IN ('locked', 'resolving')
    AND (
      creator_id = auth.uid()
      OR resolver_id = auth.uid()
      OR id IN (SELECT market_id FROM market_members WHERE user_id = auth.uid())
    )
  );

-- 5. Auto-add staker to market_members when they take a position
CREATE OR REPLACE FUNCTION add_staker_to_market_members()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO market_members (market_id, user_id)
  VALUES (NEW.market_id, NEW.user_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_position_inserted_membership ON positions;
CREATE TRIGGER on_position_inserted_membership
  AFTER INSERT ON positions
  FOR EACH ROW EXECUTE FUNCTION add_staker_to_market_members();
