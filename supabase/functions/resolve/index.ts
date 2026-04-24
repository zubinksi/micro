import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return error(401, 'Missing authorization header');

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return error(401, 'Unauthorized');

    const { market_id, outcome, evidence_url } = await req.json();

    if (!market_id || !outcome) return error(400, 'market_id, outcome required');
    if (!['YES', 'NO'].includes(outcome)) return error(400, 'outcome must be YES or NO');

    const { data: market } = await supabase
      .from('markets')
      .select('id, group_id, creator_id, resolver_type, resolver_id, status')
      .eq('id', market_id)
      .single();

    if (!market) return error(404, 'Market not found');
    if (!['locked', 'resolving'].includes(market.status)) return error(409, 'Market is not ready for resolution');

    // Authorization check: who can resolve?
    const isCreator  = market.creator_id === user.id;
    const isResolver = market.resolver_id === user.id;
    const isAutocrat = market.resolver_type === 'autocrat' && (isCreator || isResolver);

    const { data: membership } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', market.group_id)
      .eq('user_id', user.id)
      .maybeSingle();

    const isMember = !!membership;
    const isConsensus = market.resolver_type === 'consensus' && isMember;

    if (!isAutocrat && !isConsensus && !isCreator) {
      return error(403, 'You are not authorized to resolve this market');
    }

    // Write resolution and move market to 'resolving' (dispute window).
    // Upsert so re-submitting a resolution (e.g. changing the outcome) doesn't
    // blow up on the unique constraint on market_id.
    const { error: rErr } = await supabase
      .from('resolutions')
      .upsert({ market_id, outcome, evidence_url, resolved_by: user.id }, { onConflict: 'market_id' });

    if (rErr) return error(500, rErr.message);

    await supabase
      .from('markets')
      .update({ status: 'resolving' })
      .eq('id', market_id);

    // Schedule settlement after dispute window — here we just call settle immediately if autocrat
    if (isAutocrat) {
      await triggerSettle(supabase, market_id, outcome);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return error(500, String(e));
  }
});

async function triggerSettle(supabase: any, marketId: string, outcome: string) {
  // Fetch all positions
  const { data: positions } = await supabase
    .from('positions')
    .select('user_id, outcome, stake')
    .eq('market_id', marketId);

  if (!positions || positions.length === 0) {
    await supabase.from('markets').update({ status: 'voided' }).eq('id', marketId);
    return;
  }

  const yesPool = positions.filter((p: any) => p.outcome === 'YES').reduce((s: number, p: any) => s + p.stake, 0);
  const noPool  = positions.filter((p: any) => p.outcome === 'NO').reduce((s: number, p: any) => s + p.stake, 0);

  // Need both sides to settle (else void)
  if (yesPool === 0 || noPool === 0) {
    await supabase.from('markets').update({ status: 'voided' }).eq('id', marketId);
    return;
  }

  const totalPool  = yesPool + noPool;
  const winningPool = outcome === 'YES' ? yesPool : noPool;

  const settlements: any[] = [];
  const losers  = positions.filter((p: any) => p.outcome !== outcome);
  const winners = positions.filter((p: any) => p.outcome === outcome);

  // Compute payouts and build IOU ledger
  const winnerPayouts = winners.map((w: any) => ({
    userId: w.user_id,
    payout: (w.stake / winningPool) * totalPool,
    net: (w.stake / winningPool) * totalPool - w.stake,
  }));

  let wi = 0;
  for (const loser of losers) {
    let remaining = loser.stake;
    while (remaining > 0.01 && wi < winnerPayouts.length) {
      const winner = winnerPayouts[wi];
      if (winner.net <= 0) { wi++; continue; }
      const amount = Math.min(remaining, winner.net);
      settlements.push({
        market_id:    marketId,
        from_user_id: loser.user_id,
        to_user_id:   winner.userId,
        amount:       +amount.toFixed(2),
      });
      remaining    -= amount;
      winner.net   -= amount;
      if (winner.net < 0.01) wi++;
    }
  }

  if (settlements.length > 0) {
    await supabase.from('settlements').insert(settlements);
  }

  // Update leaderboard stats
  for (const pos of positions) {
    const won = pos.outcome === outcome;
    const payout = won ? (pos.stake / winningPool) * totalPool : 0;
    const net = payout - pos.stake;

    await supabase.rpc('upsert_user_stats', {
      p_user_id:   pos.user_id,
      p_group_id:  (await supabase.from('markets').select('group_id').eq('id', marketId).single()).data?.group_id,
      p_won:       won,
      p_net:       net,
      p_stake:     pos.stake,
      p_yes_prob:  yesPool / totalPool,
      p_outcome:   pos.outcome,
      p_winning:   outcome,
    });
  }

  await supabase.from('markets').update({ status: 'settled' }).eq('id', marketId);
}

function error(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
