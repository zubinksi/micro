import { Share } from 'react-native';
import type { Market, Position } from '@/lib/types';
import { getPoolOdds } from './pool';

/**
 * Share a "I called it" outcome card after market settles.
 */
export async function shareOutcomeCard(market: Market, position: Position, won: boolean) {
  const odds = getPoolOdds(market);
  const impliedPct = Math.round((position.outcome === 'YES' ? odds.yesProb : odds.noProb) * 100);

  const verb = won ? '🎯 Called it' : '📉 Missed this one';
  const message = [
    `${verb} on Micro`,
    `"${market.question}"`,
    `I bet ${position.outcome} when it was at ${impliedPct}% — and I was ${won ? 'right' : 'wrong'}.`,
    `Join my group: micro://join`,
  ].join('\n');

  await Share.share({ message });
}

/**
 * Share a group invite link.
 */
export async function shareGroupInvite(groupName: string, inviteCode: string) {
  await Share.share({
    message: `Join "${groupName}" on Micro — group prediction markets with friends.\nUse code: ${inviteCode}\nmicro://join/${inviteCode}`,
  });
}
