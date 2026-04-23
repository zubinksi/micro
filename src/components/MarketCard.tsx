import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '@/lib/constants';
import { getPoolOdds } from '@/utils/pool';
import type { Market } from '@/lib/types';

interface Props {
  market: Market;
  onPress: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  open:      'Open',
  locked:    'Locked',
  resolving: 'Resolving',
  settled:   'Settled',
  voided:    'Voided',
};

const STATUS_COLOR: Record<string, string> = {
  open:      COLORS.yes,
  locked:    COLORS.warning,
  resolving: COLORS.primary,
  settled:   COLORS.textMuted,
  voided:    COLORS.no,
};

export function MarketCard({ market, onPress }: Props) {
  const odds    = getPoolOdds(market);
  const myPos   = market.my_position;
  const timeLeft = getTimeLeft(market.closes_at);
  const yesPct   = odds.totalPool === 0 ? 50 : Math.round(odds.yesProb * 100);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>

      {/* Status + time row */}
      <View style={styles.topRow}>
        <View style={[styles.statusPill, { borderColor: STATUS_COLOR[market.status] ?? COLORS.textDim }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[market.status] ?? COLORS.textDim }]}>
            {STATUS_LABEL[market.status] ?? market.status}
          </Text>
        </View>
        <Text style={styles.time}>{timeLeft}</Text>
      </View>

      {/* Question — serif */}
      <Text style={styles.question} numberOfLines={3}>{market.question}</Text>

      {/* Probability bar */}
      <View style={styles.barTrack}>
        <View style={[styles.barYes, { flex: yesPct }]} />
        <View style={[styles.barNo,  { flex: 100 - yesPct }]} />
      </View>

      {/* Odds + pool row */}
      <View style={styles.bottomRow}>
        <Text style={styles.yesLabel}>{yesPct}% YES</Text>
        <Text style={styles.pool}>${odds.totalPool.toFixed(0)} pool</Text>
        {myPos ? (
          <View style={[styles.myPos, myPos.outcome === 'YES' ? styles.myPosYes : styles.myPosNo]}>
            <Text style={styles.myPosText}>{myPos.outcome} ${myPos.stake}</Text>
          </View>
        ) : (
          <Text style={styles.noLabel}>{100 - yesPct}% NO</Text>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusPill: { borderWidth: 1, borderRadius: 2, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 10, fontFamily: FONTS.sansMedium, letterSpacing: 0.8, textTransform: 'uppercase' },
  time:       { marginLeft: 'auto', fontSize: 11, fontFamily: FONTS.sans, color: COLORS.textDim },
  question:   { fontSize: 17, fontFamily: FONTS.serif, color: COLORS.text, marginBottom: 14, lineHeight: 24 },
  barTrack:   { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: COLORS.border, marginBottom: 10 },
  barYes:     { backgroundColor: COLORS.yes },
  barNo:      { backgroundColor: COLORS.no },
  bottomRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  yesLabel:   { fontSize: 12, fontFamily: FONTS.sansMedium, color: COLORS.yes },
  noLabel:    { marginLeft: 'auto', fontSize: 12, fontFamily: FONTS.sansMedium, color: COLORS.no },
  pool:       { flex: 1, textAlign: 'center', fontSize: 12, fontFamily: FONTS.sans, color: COLORS.textMuted },
  myPos:      { marginLeft: 'auto', borderRadius: 2, paddingHorizontal: 8, paddingVertical: 3 },
  myPosYes:   { backgroundColor: COLORS.yesLight },
  myPosNo:    { backgroundColor: COLORS.noLight },
  myPosText:  { fontSize: 11, fontFamily: FONTS.sansBold, color: COLORS.text },
});
