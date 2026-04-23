import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id    = req.query.id as string | undefined;
  const proto = (req.headers['x-forwarded-proto'] as string) ?? 'https';
  const host  = req.headers.host as string;
  const base  = `${proto}://${host}`;

  let question = 'A prediction on Hunch';
  let yesPct   = 50;
  let pool     = 0;
  let status   = 'open';

  if (id) {
    try {
      const r = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/markets?id=eq.${id}&select=question,yes_pool,no_pool,status`,
        {
          headers: {
            apikey:        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
        },
      );
      const rows = await r.json();
      if (Array.isArray(rows) && rows[0]) {
        const m   = rows[0];
        question  = m.question ?? question;
        status    = m.status ?? 'open';
        const yes = Number(m.yes_pool ?? 0);
        const no  = Number(m.no_pool ?? 0);
        pool   = yes + no;
        yesPct = pool > 0 ? Math.round((yes / pool) * 100) : 50;
      }
    } catch {
      // use defaults
    }
  }

  const noPct       = 100 - yesPct;
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const statusColor = status === 'open' ? '#2D6A4F' : status === 'settled' ? '#6B6259' : '#C17F3E';

  // Word-wrap question across up to two lines
  const words  = question.split(' ');
  const midway = Math.ceil(words.length / 2);
  const line1  = words.slice(0, midway).join(' ');
  const line2  = words.slice(midway).join(' ');
  const hasTwoLines = line2.length > 0;

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const yesBarWidth = Math.round((yesPct / 100) * 1080);
  const noBarWidth  = 1080 - yesBarWidth;
  const fontSize    = question.length > 70 ? 38 : question.length > 50 ? 44 : 52;
  const qY1         = hasTwoLines ? 210 : 280;
  const qY2         = qY1 + fontSize + 10;
  const poolLabel   = pool > 0 ? `$${pool.toFixed(0)} pool · hunch.app` : 'hunch.app';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#F5F1EB"/>
  <rect width="1200" height="8" fill="#2D6A4F"/>
  <text x="60" y="88" font-family="Georgia, serif" font-size="40" font-weight="700" fill="#2D6A4F" letter-spacing="-0.5">Hunch</text>
  <rect x="${1200 - statusLabel.length * 11 - 84}" y="56" width="${statusLabel.length * 11 + 24}" height="30" rx="2" fill="none" stroke="${esc(statusColor)}" stroke-width="1.5"/>
  <text x="${1200 - statusLabel.length * 11 / 2 - 72}" y="76" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="${esc(statusColor)}" text-anchor="middle" letter-spacing="1">${esc(statusLabel.toUpperCase())}</text>
  <text x="60" y="${qY1}" font-family="Georgia, serif" font-size="${fontSize}" font-weight="700" fill="#1A1A1A">${esc(line1)}</text>
  ${hasTwoLines ? `<text x="60" y="${qY2}" font-family="Georgia, serif" font-size="${fontSize}" font-weight="700" fill="#1A1A1A">${esc(line2)}</text>` : ''}
  <text x="60" y="450" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#2D6A4F">${yesPct}% YES</text>
  <text x="1140" y="450" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#A85252" text-anchor="end">${noPct}% NO</text>
  <rect x="60" y="464" width="1080" height="10" rx="2" fill="#D6CFC4"/>
  ${yesBarWidth > 0 ? `<rect x="60" y="464" width="${yesBarWidth}" height="10" rx="2" fill="#2D6A4F"/>` : ''}
  ${noBarWidth > 0 ? `<rect x="${60 + yesBarWidth}" y="464" width="${noBarWidth}" height="10" rx="2" fill="#A85252"/>` : ''}
  <text x="60" y="516" font-family="Arial, sans-serif" font-size="18" fill="#6B6259">${esc(poolLabel)}</text>
  <rect y="620" width="1200" height="10" fill="#2D6A4F" opacity="0.15"/>
</svg>`;

  try {
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).send(png);
  } catch {
    // Fallback to SVG if sharp fails
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).send(svg);
  }
}
