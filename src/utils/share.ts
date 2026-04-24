import { Share, Platform } from 'react-native';
import type { Market, Position } from '@/lib/types';
import { getPoolOdds } from './pool';

function getAppBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://hunch.vercel.app';
}

export async function shareMarketLink(market: Market) {
  const base  = getAppBaseUrl();
  const ogUrl = `${base}/api/og?id=${market.id}&q=${encodeURIComponent(market.question)}`;
  await Share.share({
    message: ogUrl,
    url:     ogUrl,
    title:   market.question,
  });
}

export async function shareOutcomeCard(market: Market, position: Position, won: boolean) {
  const odds = getPoolOdds(market);
  const impliedPct = Math.round((position.outcome === 'YES' ? odds.yesProb : odds.noProb) * 100);
  const base  = getAppBaseUrl();
  const ogUrl = `${base}/api/og?id=${market.id}`;

  const verb = won ? '🎯 Called it' : '📉 Missed this one';
  await Share.share({
    message: [
      `${verb} on Hunch`,
      `"${market.question}"`,
      `I bet ${position.outcome} at ${impliedPct}% — and I was ${won ? 'right' : 'wrong'}.`,
      ogUrl,
    ].join('\n'),
    url:   ogUrl,
    title: market.question,
  });
}
