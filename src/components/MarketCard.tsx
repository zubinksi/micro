import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const yesPct  = odds.totalPool === 0 ? 50 : Math.round(odds.yesProb * 100);
  const noPct   = 100 - yesPct;
  const timeLeft = getTimeLeft(market.closes_at);
  const bettors  = market.position_count ?? 0;
  const comments = market.comment_count ?? 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>

      {/* Status + time */}
      <View style={styles.topRow}>
        <View style={[styles.statusPill, { borderColor: STATUS_COLOR[market.status] ?? COLORS.textDim }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[market.status] ?? COLORS.textDim }]}>
            {STATUS_LABEL[market.status] ?? market.status}
          </Text>
        </View>
        {myPos && (
          <View style={[styles.myPosBadge, myPos.outcome === 'YES' ? styles.myPosBadgeYes : styles.myPosBadgeNo]}>
            <Text style={[styles.myPosBadgeText, myPos.outcome === 'YES' ? styles.myPosBadgeTextYes : styles.myPosBadgeTextNo]}>
              {myPos.outcome} ${myPos.stake}
            </Text>
          </View>
        )}
        <Text style={styles.timeRight}>{timeLeft}</Text>
      </View>

      {/* Question — serif */}
      <Text style={styles.question} numberOfLines={3}>{market.question}</Text>

      {/* Probability bar */}
      <View style={styles.oddsRow}>
        <Text style={styles.yesLabel}>{yesPct}% YES</Text>
        <Text style={styles.noLabel}>{noPct}% NO</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barYes, { flex: yesPct }]} />
        <View style={[styles.barNo,  { flex: noPct }]} />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Text style={styles.statBettors}>
          {bettors} {bettors === 1 ? 'betting' : 'betting'}
        </Text>
        <View style={styles.statsRight}>
          <Ionicons name="chatbubble-outline" size={13} color={COLORS.textDim} />
          <Text style={styles.statNum}>{comments}</Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.statNum}>${odds.totalPool.toFixed(0)} pot</Text>
          <Text style={styles.statDot}>·</Text>
          <Ionicons name="time-outline" size={13} color={COLORS.textDim} />
          <Text style={styles.statNum}>{timeLeft}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getTimeLeft(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const days  = Math.floor(diff / 86400_000);
  const hours = Math.floor((diff % 86400_000) / 3600_000);
  if (days > 1) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return '<1h';
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
  topRow:           { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusPill:       { borderWidth: 1, borderRadius: 2, paddingHorizontal: 6, paddingVertical: 2 },
  statusText:       { fontSize: 10, fontFamily: FONTS.sansMedium, letterSpacing: 0.8, textTransform: 'uppercase' },
  myPosBadge:       { borderRadius: 2, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  myPosBadgeYes:    { backgroundColor: COLORS.yesLight, borderColor: COLORS.yes },
  myPosBadgeNo:     { backgroundColor: COLORS.noLight,  borderColor: COLORS.no },
  myPosBadgeText:   { fontSize: 10, fontFamily: FONTS.sansBold },
  myPosBadgeTextYes:{ color: COLORS.yes },
  myPosBadgeTextNo: { color: COLORS.no },
  timeRight:        { marginLeft: 'auto', fontSize: 11, fontFamily: FONTS.sans, color: COLORS.textDim },
  question:         { fontSize: 17, fontFamily: FONTS.serif, color: COLORS.text, marginBottom: 12, lineHeight: 24 },
  oddsRow:          { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  yesLabel:         { fontSize: 13, fontFamily: FONTS.sansBold, color: COLORS.yes },
  noLabel:          { fontSize: 13, fontFamily: FONTS.sansBold, color: COLORS.no },
  barTrack:         { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: COLORS.border, marginBottom: 12 },
  barYes:           { backgroundColor: COLORS.yes },
  barNo:            { backgroundColor: COLORS.no },
  statsRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statBettors:      { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textMuted },
  statsRight:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statNum:          { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textMuted },
  statDot:          { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textDim },
});
