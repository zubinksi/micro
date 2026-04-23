import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id    = req.query.id as string | undefined;
  const proto = (req.headers['x-forwarded-proto'] as string) ?? 'https';
  const host  = req.headers.host as string;
  const base  = `${proto}://${host}`;

  let title       = 'Hunch — Prediction Markets';
  let description = 'Private prediction markets for your group chat.';
  const marketUrl = id ? `${base}/markets/${id}` : base;
  const imageUrl  = id ? `${base}/api/og-image?id=${id}` : `${base}/api/og-image`;

  if (id) {
    try {
      const r = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/markets?id=eq.${id}&select=question,resolution_criteria`,
        {
          headers: {
            apikey:        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
        },
      );
      const rows = await r.json();
      if (Array.isArray(rows) && rows[0]) {
        title       = rows[0].question;
        description = rows[0].resolution_criteria;
      }
    } catch {
      // use defaults
    }
  }

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(marketUrl)}">
  <meta property="og:image" content="${esc(imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/png">
  <meta property="og:site_name" content="Hunch">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(imageUrl)}">
  <meta http-equiv="refresh" content="0;url=${esc(marketUrl)}">
</head>
<body>
  <script>window.location.replace(${JSON.stringify(marketUrl)});</script>
  <p>Loading <a href="${esc(marketUrl)}">${esc(title)}</a>…</p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.status(200).send(html);
}
