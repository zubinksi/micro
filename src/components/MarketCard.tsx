import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '@/lib/constants';
import { getPoolOdds } from '@/utils/pool';
import { ProbabilityBar } from './ProbabilityBar';
import type { Market } from '@/lib/types';

interface Props {
  market: Market;
  onPress: () => void;
  showGroup?: boolean;
  groupName?: string;
}

const STATUS_COLOR: Record<string, string> = {
  open:      COLORS.yes,
  locked:    COLORS.warning,
  resolving: COLORS.primary,
  settled:   COLORS.textMuted,
  voided:    COLORS.no,
};

export function MarketCard({ market, onPress, showGroup, groupName }: Props) {
  const odds = getPoolOdds(market);
  const myPos = market.my_position;
  const timeLeft = getTimeLeft(market.closes_at);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>

      {/* Top row */}
      <View style={styles.topRow}>
        {showGroup && groupName && (
          <Text style={styles.groupTag}>{groupName}</Text>
        )}
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[market.status] ?? COLORS.textDim }]} />
        <Text style={styles.status}>{market.status}</Text>
        <Text style={styles.time}>{timeLeft}</Text>
      </View>

      {/* Question */}
      <Text style={styles.question} numberOfLines={2}>{market.question}</Text>

      {/* Probability bar */}
      <ProbabilityBar odds={odds} height={8} />

      {/* Bottom row */}
      <View style={styles.bottomRow}>
        <Text style={styles.pool}>${odds.totalPool.toFixed(0)} pool · {getParticipantCount(market)} participants</Text>
        {myPos && (
          <View style={[styles.myPos, myPos.outcome === 'YES' ? styles.myPosYes : styles.myPosNo]}>
            <Text style={styles.myPosText}>{myPos.outcome} ${myPos.stake}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function getTimeLeft(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const days  = Math.floor(diff / 86400_000);
  const hours = Math.floor((diff % 86400_000) / 3600_000);
  if (days > 1) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  return 'Closing soon';
}

function getParticipantCount(market: Market): number {
  // Approximated from pool (no position list in card query)
  return market.yes_pool > 0 || market.no_pool > 0 ? 1 : 0;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  groupTag:  { fontSize: 11, color: COLORS.primary, fontWeight: '700', marginRight: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  status:    { fontSize: 11, color: COLORS.textMuted, textTransform: 'capitalize', flex: 1 },
  time:      { fontSize: 11, color: COLORS.textDim },
  question:  { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 14, lineHeight: 22 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  pool:      { flex: 1, fontSize: 12, color: COLORS.textMuted },
  myPos:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  myPosYes:  { backgroundColor: COLORS.yes + '22', borderColor: COLORS.yes },
  myPosNo:   { backgroundColor: COLORS.no + '22', borderColor: COLORS.no },
  myPosText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
});
