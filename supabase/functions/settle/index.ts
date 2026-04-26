/**
 * Called by a cron job (or manually) to finalize markets after the dispute window.
 * Checks all 'resolving' markets; if dispute threshold not met, settles them.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DISPUTE_THRESHOLD = 0.5;   // >50% dispute votes → void
const DISPUTE_WINDOW_MS = 2 * 3600_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')!,
  );

  // Find all 'resolving' markets past the dispute window
  const cutoff = new Date(Date.now() - DISPUTE_WINDOW_MS).toISOString();

  const { data: resolutions } = await supabase
    .from('resolutions')
    .select('id, market_id, outcome, disputed, created_at')
    .lt('created_at', cutoff)
    .eq('disputed', false);

  if (!resolutions || resolutions.length === 0) {
    return new Response(JSON.stringify({ settled: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let settled = 0;
  let voided  = 0;

  for (const res of resolutions) {
    // Check dispute votes
    const { data: market } = await supabase
      .from('markets')
      .select('id, group_id, status')
      .eq('id', res.market_id)
      .single();

    if (!market || market.status !== 'resolving') continue;

    const { data: positions } = await supabase
      .from('positions')
      .select('user_id, outcome, stake')
      .eq('market_id', res.market_id);

    const totalParticipants = positions?.length ?? 0;

    const { data: votes } = await supabase
      .from('dispute_votes')
      .select('vote')
      .eq('resolution_id', res.id);

    const disputeCount = votes?.length ?? 0;
    const disputeRatio = totalParticipants > 0 ? disputeCount / totalParticipants : 0;

    if (disputeRatio > DISPUTE_THRESHOLD) {
      // Void the market — return stakes (no settlement rows)
      await supabase.from('markets').update({ status: 'voided' }).eq('id', res.market_id);
      await supabase.from('resolutions').update({ disputed: true }).eq('id', res.id);
      voided++;
      continue;
    }

    // Settle the market
    await settleMarket(supabase, res.market_id, res.outcome, positions ?? [], market.group_id);
    settled++;
  }

  return new Response(JSON.stringify({ settled, voided }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

async function settleMarket(supabase: any, marketId: string, outcome: string, positions: any[], groupId: string) {
  const yesPool = positions.filter((p: any) => p.outcome === 'YES').reduce((s: number, p: any) => s + p.stake, 0);
  const noPool  = positions.filter((p: any) => p.outcome === 'NO').reduce((s: number, p: any) => s + p.stake, 0);

  if (yesPool === 0 || noPool === 0) {
    await supabase.from('markets').update({ status: 'voided' }).eq('id', marketId);
    return;
  }

  const totalPool   = yesPool + noPool;
  const winningPool = outcome === 'YES' ? yesPool : noPool;
  const losers      = positions.filter((p: any) => p.outcome !== outcome);
  const winners     = positions.filter((p: any) => p.outcome === outcome);

  const winnerPayouts = winners.map((w: any) => ({
    userId: w.user_id,
    payout: (w.stake / winningPool) * totalPool,
    net: (w.stake / winningPool) * totalPool - w.stake,
    netRemaining: (w.stake / winningPool) * totalPool - w.stake,
  }));

  const settlements: any[] = [];
  let wi = 0;

  for (const loser of losers) {
    let remaining = loser.stake;
    while (remaining > 0.01 && wi < winnerPayouts.length) {
      const winner = winnerPayouts[wi];
      if (winner.netRemaining <= 0.01) { wi++; continue; }
      const amount = +Math.min(remaining, winner.netRemaining).toFixed(2);
      if (amount > 0) {
        settlements.push({ market_id: marketId, from_user_id: loser.user_id, to_user_id: winner.userId, amount });
      }
      remaining              -= amount;
      winner.netRemaining    -= amount;
    }
  }

  if (settlements.length > 0) {
    await supabase.from('settlements').insert(settlements);
  }

  // Update stats for each participant
  for (const pos of positions) {
    const won    = pos.outcome === outcome;
    const payout = won ? (pos.stake / winningPool) * totalPool : 0;
    const net    = payout - pos.stake;
    // Brier score contribution: (outcome_indicator - probability)^2
    const yesProb = yesPool / totalPool;
    const prob    = pos.outcome === 'YES' ? yesProb : 1 - yesProb;
    const actual  = pos.outcome === outcome ? 1 : 0;
    const brier   = Math.pow(actual - prob, 2);

    const { data: existing } = await supabase
      .from('user_group_stats')
      .select('*')
      .eq('user_id', pos.user_id)
      .eq('group_id', groupId)
      .maybeSingle();

    if (existing) {
      await supabase.from('user_group_stats').update({
        markets_entered:   existing.markets_entered + 1,
        markets_won:       existing.markets_won + (won ? 1 : 0),
        total_staked:      existing.total_staked + pos.stake,
        total_profit:      existing.total_profit + net,
        calibration_score: (existing.calibration_score * existing.markets_entered + brier) / (existing.markets_entered + 1),
        updated_at:        new Date().toISOString(),
      })
        .eq('user_id', pos.user_id)
        .eq('group_id', groupId);
    } else {
      await supabase.from('user_group_stats').insert({
        user_id: pos.user_id,
        group_id: groupId,
        markets_entered: 1,
        markets_won: won ? 1 : 0,
        total_staked: pos.stake,
        total_profit: net,
        calibration_score: brier,
      });
    }
  }

  await supabase.from('markets').update({ status: 'settled' }).eq('id', marketId);
}
