import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host  = req.headers.get('host') ?? 'hunch.vercel.app';
  const base  = `${proto}://${host}`;

  let question   = 'A prediction on Hunch';
  let criteria   = '';
  let yesPct     = 50;
  let pool       = 0;
  let status     = 'open';

  if (id) {
    try {
      const r = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/markets?id=eq.${id}&select=question,resolution_criteria,yes_pool,no_pool,status`,
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
        question  = m.question;
        criteria  = m.resolution_criteria ?? '';
        status    = m.status ?? 'open';
        const yes = Number(m.yes_pool ?? 0);
        const no  = Number(m.no_pool ?? 0);
        pool      = yes + no;
        yesPct    = pool > 0 ? Math.round((yes / pool) * 100) : 50;
      }
    } catch {
      // use defaults
    }
  }

  const noPct       = 100 - yesPct;
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const statusColor = status === 'open' ? '#2D6A4F' : status === 'settled' ? '#6B6259' : '#C17F3E';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#F5F1EB',
          padding: '48px 52px',
          fontFamily: 'serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#2D6A4F', letterSpacing: '-0.5px' }}>
            Hunch
          </div>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: statusColor,
            border: `1px solid ${statusColor}`,
            padding: '4px 10px',
            borderRadius: '2px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            {statusLabel}
          </div>
        </div>

        {/* Question */}
        <div style={{
          fontSize: question.length > 80 ? '32px' : '40px',
          fontWeight: 700,
          color: '#1A1A1A',
          lineHeight: 1.25,
          flex: 1,
          marginBottom: '32px',
        }}>
          {question}
        </div>

        {/* Probability bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#2D6A4F' }}>{yesPct}% YES</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#A85252' }}>{noPct}% NO</span>
          </div>
          <div style={{ display: 'flex', height: '8px', borderRadius: '2px', overflow: 'hidden', backgroundColor: '#D6CFC4' }}>
            <div style={{ flex: yesPct, backgroundColor: '#2D6A4F' }} />
            <div style={{ flex: noPct,  backgroundColor: '#A85252' }} />
          </div>
          <div style={{ fontSize: '13px', color: '#6B6259', marginTop: '4px' }}>
            {pool > 0 ? `$${pool.toFixed(0)} pool · hunch.app` : 'hunch.app'}
          </div>
        </div>
      </div>
    ),
    {
      width:  1200,
      height: 630,
    },
  );
}
