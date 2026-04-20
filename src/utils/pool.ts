import type { Market, Outcome, PoolOdds, PayoutPreview } from '@/lib/types';

export function getPoolOdds(market: Pick<Market, 'yes_pool' | 'no_pool'>): PoolOdds {
  const yesPool = market.yes_pool;
  const noPool = market.no_pool;
  const totalPool = yesPool + noPool;

  if (totalPool === 0) {
    return { yesProb: 0.5, noProb: 0.5, totalPool: 0, yesPool, noPool };
  }

  return {
    yesProb: yesPool / totalPool,
    noProb: noPool / totalPool,
    totalPool,
    yesPool,
    noPool,
  };
}

/**
 * Parimutuel payout: winner's share of the entire pool proportional to stake.
 * Calculated AFTER including the new stake (so odds shift first).
 */
export function getPayoutPreview(
  market: Pick<Market, 'yes_pool' | 'no_pool'>,
  outcome: Outcome,
  stake: number,
): PayoutPreview {
  const newYesPool = outcome === 'YES' ? market.yes_pool + stake : market.yes_pool;
  const newNoPool  = outcome === 'NO'  ? market.no_pool  + stake : market.no_pool;
  const totalPool  = newYesPool + newNoPool;

  const winningPool = outcome === 'YES' ? newYesPool : newNoPool;
  const potentialPayout = totalPool === 0 ? stake : (stake / winningPool) * totalPool;

  const impliedOdds = winningPool / totalPool;
  const roi = (potentialPayout - stake) / stake;

  return { potentialPayout, impliedOdds, roi };
}

/**
 * Calculate net IOU settlements for a market after it resolves.
 * Returns a list of { from, to, amount } tuples (losers → winners).
 *
 * Each winner gets back their stake * (totalPool / winningPool).
 * Each loser owes proportionally. We simplify to direct pairwise debts.
 */
export interface SettlementDebt {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export interface UserPnL {
  userId: string;
  outcome: Outcome;
  stake: number;
  payout: number;   // 0 if lost
  net: number;      // payout - stake (negative = loss)
}

export function computeSettlements(
  positions: Array<{ user_id: string; outcome: Outcome; stake: number }>,
  winningOutcome: Outcome,
): { pnl: UserPnL[]; debts: SettlementDebt[] } {
  const yesPool = positions.filter(p => p.outcome === 'YES').reduce((s, p) => s + p.stake, 0);
  const noPool  = positions.filter(p => p.outcome === 'NO').reduce((s, p) => s + p.stake, 0);
  const totalPool = yesPool + noPool;
  const winningPool = winningOutcome === 'YES' ? yesPool : noPool;

  const pnl: UserPnL[] = positions.map(p => {
    const won = p.outcome === winningOutcome;
    const payout = won && winningPool > 0 ? (p.stake / winningPool) * totalPool : 0;
    return { userId: p.user_id, outcome: p.outcome, stake: p.stake, payout, net: payout - p.stake };
  });

  // Losers owe winners. Build minimal debt graph.
  const losers  = pnl.filter(p => p.net < 0).map(p => ({ ...p, remaining: Math.abs(p.net) }));
  const winners = pnl.filter(p => p.net > 0).map(p => ({ ...p, remaining: p.net }));
  const debts: SettlementDebt[] = [];

  let wi = 0;
  for (const loser of losers) {
    while (loser.remaining > 0.01 && wi < winners.length) {
      const winner = winners[wi];
      const amount = Math.min(loser.remaining, winner.remaining);
      debts.push({ fromUserId: loser.userId, toUserId: winner.userId, amount: +amount.toFixed(2) });
      loser.remaining  -= amount;
      winner.remaining -= amount;
      if (winner.remaining < 0.01) wi++;
    }
  }

  return { pnl, debts };
}
