import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchPageText(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Maybe-AI-Resolver/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return '';
    const html = await r.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
  } catch {
    return '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')!;
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY secret is not set in Supabase — run: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  };

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { market_id } = await req.json();
  if (!market_id) {
    return new Response(JSON.stringify({ error: 'market_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: market, error: mErr } = await admin
    .from('markets')
    .select('id, question, resolution_criteria, reference_urls, creator_id, resolver_type, status')
    .eq('id', market_id)
    .single();

  if (mErr || !market) {
    return new Response(JSON.stringify({ error: 'Market not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (market.resolver_type !== 'ai') {
    return new Response(JSON.stringify({ error: 'Not an AI-resolved market' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!['locked', 'resolving'].includes(market.status)) {
    return new Response(JSON.stringify({ error: 'Market is not ready for resolution' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (market.creator_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Only the creator can trigger AI resolution' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch reference URL contents
  const urls: string[] = market.reference_urls ?? [];
  const refParts: string[] = [];
  for (const url of urls.slice(0, 4)) {
    const text = await fetchPageText(url);
    if (text) refParts.push(`[${url}]\n${text}`);
  }

  const refBlock = refParts.length > 0
    ? `Reference material:\n---\n${refParts.join('\n\n---\n')}\n---`
    : 'No reference material provided.';

  const prompt = `You are resolving a binary prediction market. Respond with valid JSON only — no extra text.

Question: ${market.question}
Resolution criteria: ${market.resolution_criteria}
Today's date: ${new Date().toISOString().split('T')[0]}

${refBlock}

Based on the resolution criteria and reference material, respond with this exact JSON format:
{
  "outcome": "YES" | "NO" | "UNCERTAIN",
  "summary": "One or two sentences explaining how you ruled on this market."
}

Use UNCERTAIN only if the reference material is clearly insufficient to decide. The summary should be written in plain language for participants, explaining the key evidence that led to the ruling.`;

  const anthropicRes = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.text();
    console.error('Anthropic error:', errBody);
    return new Response(JSON.stringify({ error: 'Anthropic API error' }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const anthropicData = await anthropicRes.json();
  const rawText = (anthropicData.content?.[0]?.text ?? '').trim();

  let outcome: string = 'UNCERTAIN';
  let summary: string | null = null;

  try {
    const parsed = JSON.parse(rawText);
    outcome = (parsed.outcome ?? '').toUpperCase().replace(/[^A-Z]/g, '');
    summary = parsed.summary ?? null;
  } catch {
    // Fallback: scan raw text for YES/NO
    const upper = rawText.toUpperCase();
    if (upper.includes('YES')) outcome = 'YES';
    else if (upper.includes('NO')) outcome = 'NO';
  }

  if (outcome !== 'YES' && outcome !== 'NO') {
    return new Response(JSON.stringify({
      outcome: 'UNCERTAIN',
      message: 'Claude could not determine the outcome from the reference material. Please resolve manually.',
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { error: rErr } = await admin.from('resolutions').upsert({
    market_id:    market.id,
    outcome,
    summary,
    evidence_url: urls.length > 0 ? urls.join(', ') : null,
    resolved_by:  market.creator_id,
  }, { onConflict: 'market_id' });

  if (rErr) {
    return new Response(JSON.stringify({ error: rErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await admin.from('markets').update({ status: 'resolving' }).eq('id', market.id);

  return new Response(JSON.stringify({ outcome, summary }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
