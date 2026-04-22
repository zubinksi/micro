import { Share } from 'react-native';
import type { Market, Position } from '@/lib/types';
import { getPoolOdds } from './pool';

export async function shareOutcomeCard(market: Market, position: Position, won: boolean) {
  const odds = getPoolOdds(market);
  const impliedPct = Math.round((position.outcome === 'YES' ? odds.yesProb : odds.noProb) * 100);

  const verb = won ? '🎯 Called it' : '📉 Missed this one';
  const message = [
    `${verb} on Micro`,
    `"${market.question}"`,
    `I bet ${position.outcome} when it was at ${impliedPct}% — and I was ${won ? 'right' : 'wrong'}.`,
    market.invite_code ? `Join this market: micro://markets/join/${market.invite_code}` : '',
  ].filter(Boolean).join('\n');

  await Share.share({ message });
}

export async function shareMarketInvite(question: string, inviteCode: string) {
  await Share.share({
    message: `Join this prediction market on Micro:\n"${question}"\n\nUse invite code: ${inviteCode}\nmicro://markets/join/${inviteCode}`,
  });
}
