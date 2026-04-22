export type MarketStatus = 'open' | 'locked' | 'resolving' | 'settled' | 'voided';
export type ResolverType = 'autocrat' | 'consensus' | 'oracle';
export type Outcome = 'YES' | 'NO';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  admin_id: string;
  created_at: string;
  // joined via query
  member_count?: number;
  admin?: Profile;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
}

export interface Market {
  id: string;
  group_id: string | null;
  creator_id: string;
  question: string;
  resolution_criteria: string;
  closes_at: string;
  resolves_at: string | null;
  resolver_type: ResolverType;
  resolver_id: string | null;
  status: MarketStatus;
  yes_pool: number;
  no_pool: number;
  invite_code: string;
  created_at: string;
  // joined via query
  creator?: Profile;
  my_position?: Position | null;
  comment_count?: number;
  resolution?: Resolution | null;
}

export interface Position {
  id: string;
  market_id: string;
  user_id: string;
  outcome: Outcome;
  stake: number;
  filled_at: string;
  profile?: Profile;
}

export interface Resolution {
  id: string;
  market_id: string;
  outcome: Outcome;
  evidence_url: string | null;
  resolved_by: string;
  disputed: boolean;
  created_at: string;
  resolver?: Profile;
  dispute_votes?: DisputeVote[];
}

export interface DisputeVote {
  resolution_id: string;
  user_id: string;
  vote: Outcome;
  created_at: string;
  profile?: Profile;
}

export interface Settlement {
  id: string;
  market_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  settled: boolean;
  settled_at: string | null;
  created_at: string;
  from_profile?: Profile;
  to_profile?: Profile;
  market?: Pick<Market, 'id' | 'question'>;
}

export interface Comment {
  id: string;
  market_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}

export interface UserGroupStats {
  user_id: string;
  group_id: string;
  markets_entered: number;
  markets_won: number;
  total_staked: number;
  total_profit: number;
  calibration_score: number;
  updated_at: string;
  profile?: Profile;
}

// ─── Derived / computed types ─────────────────────────────────────────────────

export interface PoolOdds {
  yesProb: number;  // 0–1
  noProb: number;
  totalPool: number;
  yesPool: number;
  noPool: number;
}

export interface PayoutPreview {
  potentialPayout: number;  // if you win
  impliedOdds: number;      // probability at time of stake
  roi: number;              // (payout - stake) / stake
}
