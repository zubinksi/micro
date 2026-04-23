import type { VercelRequest, VercelResponse } from '@vercel/node';
import satori from 'satori';
import sharp from 'sharp';
import { createElement as h } from 'react';

// Cache fonts at the module level so warm Lambda invocations skip the fetch
let fontRegular: ArrayBuffer | null = null;
let fontBold: ArrayBuffer | null = null;

async function loadFonts() {
  if (!fontRegular || !fontBold) {
    const [r, b] = await Promise.all([
      fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-400-normal.woff2'),
      fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-700-normal.woff2'),
    ]);
    fontRegular = await r.arrayBuffer();
    fontBold    = await b.arrayBuffer();
  }
  return { regular: fontRegular!, bold: fontBold! };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id    = req.query.id as string | undefined;
  const proto = (req.headers['x-forwarded-proto'] as string) ?? 'https';
  const host  = req.headers.host as string;

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
  const poolLabel   = pool > 0 ? `$${pool.toFixed(0)} pool` : 'No stakes yet';
  const fontSize    = question.length > 80 ? 36 : question.length > 50 ? 42 : 50;

  const { regular, bold } = await loadFonts();

  const element = h('div', {
    style: {
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      backgroundColor: '#F5F1EB',
      padding: '0',
      position: 'relative',
    },
  },
    // Top green bar
    h('div', { style: { width: '100%', height: 8, backgroundColor: '#2D6A4F' } }),

    // Content area
    h('div', {
      style: {
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: '44px 56px 44px 56px',
      },
    },
      // Header row: Hunch + status
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 } },
        h('span', { style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 36, color: '#2D6A4F', letterSpacing: '-0.5px' } }, 'Hunch'),
        h('div', { style: { border: `1.5px solid ${statusColor}`, borderRadius: 2, padding: '4px 12px' } },
          h('span', { style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: statusColor, letterSpacing: '1px' } },
            statusLabel.toUpperCase()
          )
        ),
      ),

      // Question
      h('div', { style: { flex: 1, display: 'flex', alignItems: 'center' } },
        h('span', {
          style: {
            fontFamily: 'Inter', fontWeight: 700, fontSize,
            color: '#1A1A1A', lineHeight: 1.25,
          },
        }, question),
      ),

      // Probability row
      h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 10 } },
        h('span', { style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: '#2D6A4F' } }, `${yesPct}% YES`),
        h('span', { style: { fontFamily: 'Inter', fontWeight: 400, fontSize: 16, color: '#6B6259' } }, poolLabel),
        h('span', { style: { fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: '#A85252' } }, `${noPct}% NO`),
      ),

      // Probability bar
      h('div', { style: { display: 'flex', height: 10, borderRadius: 2, overflow: 'hidden', backgroundColor: '#D6CFC4' } },
        h('div', { style: { width: `${yesPct}%`, backgroundColor: '#2D6A4F' } }),
        h('div', { style: { width: `${noPct}%`, backgroundColor: '#A85252' } }),
      ),
    ),

    // Bottom accent
    h('div', { style: { width: '100%', height: 8, backgroundColor: '#2D6A4F', opacity: 0.15 } }),
  );

  const svg = await satori(element, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Inter', data: regular, weight: 400, style: 'normal' },
      { name: 'Inter', data: bold,    weight: 700, style: 'normal' },
    ],
  });

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(png);
}
