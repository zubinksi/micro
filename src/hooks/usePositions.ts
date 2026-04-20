import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Outcome } from '@/lib/types';

export function useStake() {
  const stake = useCallback(async (params: {
    marketId: string;
    userId: string;
    outcome: Outcome;
    amount: number;
  }) => {
    // Insert position directly — the DB trigger handles pool total updates atomically.
    // Unique constraint (market_id, user_id) prevents double-staking.
    const { data, error } = await supabase
      .from('positions')
      .insert({
        market_id: params.marketId,
        user_id:   params.userId,
        outcome:   params.outcome,
        stake:     params.amount,
      })
      .select()
      .single();

    return { data, error };
  }, []);

  return { stake };
}

export function useResolve() {
  const resolve = useCallback(async (params: {
    marketId: string;
    userId: string;
    outcome: Outcome;
    evidenceUrl?: string;
  }) => {
    // 1. Insert resolution record
    const { error: rErr } = await supabase
      .from('resolutions')
      .insert({
        market_id:    params.marketId,
        outcome:      params.outcome,
        evidence_url: params.evidenceUrl ?? null,
        resolved_by:  params.userId,
      });
    if (rErr) return { error: rErr };

    // 2. Move market to 'resolving' (48hr dispute window begins)
    const { error: mErr } = await supabase
      .from('markets')
      .update({ status: 'resolving' })
      .eq('id', params.marketId);

    return { error: mErr };
  }, []);

  const dispute = useCallback(async (resolutionId: string, userId: string, vote: Outcome) => {
    return supabase.from('dispute_votes').insert({
      resolution_id: resolutionId,
      user_id: userId,
      vote,
    });
  }, []);

  return { resolve, dispute };
}

export function useSettlements(userId: string | undefined) {
  const fetchSettlements = useCallback(async () => {
    if (!userId) return [];
    const { data } = await supabase
      .from('settlements')
      .select(`
        *,
        from_profile:profiles!settlements_from_user_id_fkey ( id, username, display_name ),
        to_profile:profiles!settlements_to_user_id_fkey ( id, username, display_name ),
        market:markets ( id, question )
      `)
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .eq('settled', false)
      .order('created_at', { ascending: false });
    return (data as any[]) ?? [];
  }, [userId]);

  const markSettled = useCallback(async (settlementId: string) => {
    return supabase
      .from('settlements')
      .update({ settled: true, settled_at: new Date().toISOString() })
      .eq('id', settlementId);
  }, []);

  return { fetchSettlements, markSettled };
}

export function useLeaderboard(groupId: string | undefined) {
  const fetchLeaderboard = useCallback(async () => {
    if (!groupId) return [];
    const { data } = await supabase
      .from('user_group_stats')
      .select('*, profile:profiles(*)')
      .eq('group_id', groupId)
      .order('total_profit', { ascending: false });
    return (data as any[]) ?? [];
  }, [groupId]);

  return { fetchLeaderboard };
}
