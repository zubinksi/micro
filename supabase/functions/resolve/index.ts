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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')!,
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
      .select('id, group_id, creator_id, resolver_type, resolver_id, status, closes_at')
      .eq('id', market_id)
      .single();

    if (!market) return error(404, 'Market not found');

    const isPastClose = market.closes_at && new Date(market.closes_at) < new Date();
    if (!['locked', 'resolving'].includes(market.status) && !(market.status === 'open' && isPastClose)) {
      return error(409, 'Market is not ready for resolution');
    }
    if (market.status === 'open') {
      await supabase.from('markets').update({ status: 'locked' }).eq('id', market_id);
    }

    const isCreator  = market.creator_id === user.id;
    const isResolver = market.resolver_id === user.id;
    const isAutocrat = market.resolver_type === 'autocrat' && (isCreator || isResolver);

    const { data: membership } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', market.group_id)
      .eq('user_id', user.id)
      .maybeSingle();

    const isMember    = !!membership;
    const isConsensus = market.resolver_type === 'consensus' && isMember;

    if (!isAutocrat && !isConsensus && !isCreator) {
      return error(403, 'You are not authorized to resolve this market');
    }

    const { error: rErr } = await supabase
      .from('resolutions')
      .upsert({ market_id, outcome, evidence_url, resolved_by: user.id }, { onConflict: 'market_id' });

    if (rErr) return error(500, rErr.message);

    await supabase
      .from('markets')
      .update({ status: 'resolving' })
      .eq('id', market_id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return error(500, String(e));
  }
});

function error(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
