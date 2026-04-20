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

    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return error(401, 'Missing authorization header');

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return error(401, 'Unauthorized');

    const { market_id, outcome, stake } = await req.json();

    if (!market_id || !outcome || !stake) return error(400, 'market_id, outcome, stake required');
    if (!['YES', 'NO'].includes(outcome)) return error(400, 'outcome must be YES or NO');
    if (typeof stake !== 'number' || stake < 1 || stake > 500) return error(400, 'stake must be 1–500');

    // Fetch market — verify it's open and user is a member of the group
    const { data: market, error: mErr } = await supabase
      .from('markets')
      .select('id, group_id, status, closes_at')
      .eq('id', market_id)
      .single();

    if (mErr || !market) return error(404, 'Market not found');
    if (market.status !== 'open') return error(409, 'Market is not open for staking');
    if (new Date(market.closes_at) <= new Date()) return error(409, 'Market has closed');

    // Verify user is in the group
    const { data: membership } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', market.group_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) return error(403, 'You are not a member of this group');

    // Check for existing position (one per user per market)
    const { data: existing } = await supabase
      .from('positions')
      .select('id')
      .eq('market_id', market_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) return error(409, 'You already have a position on this market');

    // Insert position — the DB trigger updates pool totals atomically
    const { data: position, error: pErr } = await supabase
      .from('positions')
      .insert({ market_id, user_id: user.id, outcome, stake })
      .select()
      .single();

    if (pErr) return error(500, pErr.message);

    return new Response(JSON.stringify({ position }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
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
