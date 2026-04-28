import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '@/lib/constants';
import { getPoolOdds } from '@/utils/pool';
import type { Market, Profile } from '@/lib/types';

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

const AVATAR_COLORS = ['#C8D8C0', '#C0CCD8', '#D8CCC0', '#D0C0D8', '#C0D4D0', '#D8C8C0'];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(profile: Profile): string {
  return (profile.username ?? '??').slice(0, 2).toUpperCase();
}

function AvatarGroup({ bettors }: { bettors: Profile[] }) {
  const shown = bettors.slice(0, 4);
  return (
    <View style={av.row}>
      {shown.map((p, i) => (
        <View
          key={p.id}
          style={[av.circle, { backgroundColor: avatarColor(p.id), marginLeft: i === 0 ? 0 : -6 }]}
        >
          <Text style={av.initials}>{initials(p)}</Text>
        </View>
      ))}
    </View>
  );
}

export function MarketCard({ market, onPress }: Props) {
  const odds     = getPoolOdds(market);
  const myPos    = market.my_position;
  const yesPct   = odds.totalPool === 0 ? 50 : Math.round(odds.yesProb * 100);
  const noPct    = 100 - yesPct;
  const timeLeft = getTimeLeft(market.closes_at);
  const bettors  = market.position_count ?? 0;
  const comments = market.comment_count ?? 0;
  const topBettors = market.top_bettors ?? [];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>

      {/* Status + time */}
      <View style={styles.topRow}>
        <View style={[styles.statusPill, { borderColor: STATUS_COLOR[market.status] ?? COLORS.textDim }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[market.status] ?? COLORS.textDim }]}>
            {STATUS_LABEL[market.status] ?? market.status}
          </Text>
        </View>
        <Text style={styles.timeRight}>{timeLeft}</Text>
      </View>

      {/* Question */}
      <Text style={styles.question} numberOfLines={3}>{market.question}</Text>

      {/* Probability bar */}
      <View style={styles.oddsRow}>
        <Text style={styles.yesLabel}>YES {yesPct}%</Text>
        <Text style={styles.noLabel}>{noPct}% NO</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barYes, { flex: yesPct }]} />
        <View style={[styles.barNo,  { flex: noPct }]} />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statsLeft}>
          {topBettors.length > 0 && <AvatarGroup bettors={topBettors} />}
          <Text style={styles.statBettors}>
            {bettors} {bettors === 1 ? 'betting' : 'betting'}
          </Text>
        </View>
        <View style={styles.statsRight}>
          <Text style={styles.statNum}>💬 {comments}</Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.statNum}>${odds.totalPool.toFixed(0)} pot</Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.statNum}>⏱ {timeLeft}</Text>
        </View>
      </View>

      {/* Your bet row */}
      {myPos && (
        <View style={[styles.myBetRow, myPos.outcome === 'YES' ? styles.myBetRowYes : styles.myBetRowNo]}>
          <Text style={[styles.myBetText, myPos.outcome === 'YES' ? styles.myBetTextYes : styles.myBetTextNo]}>
            Your bet: {myPos.outcome} · ${myPos.stake}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function getTimeLeft(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const days  = Math.floor(diff / 86400_000);
  const hours = Math.floor((diff % 86400_000) / 3600_000);
  const mins  = Math.floor((diff % 3600_000) / 60_000);
  if (days > 30) return `${Math.floor(days / 30)}mo`;
  if (days > 1)  return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

const av = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center' },
  circle:   { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.surface },
  initials: { fontSize: 9, fontFamily: FONTS.sansBold, color: COLORS.text },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusPill:   { borderWidth: 1, borderRadius: 2, paddingHorizontal: 6, paddingVertical: 2 },
  statusText:   { fontSize: 10, fontFamily: FONTS.sansMedium, letterSpacing: 0.8, textTransform: 'uppercase' },
  timeRight:    { marginLeft: 'auto', fontSize: 11, fontFamily: FONTS.sans, color: COLORS.textDim },

  question:     { fontSize: 17, fontFamily: FONTS.serif, color: COLORS.text, marginBottom: 12, lineHeight: 24 },

  oddsRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  yesLabel:     { fontSize: 13, fontFamily: FONTS.sansBold, color: COLORS.yes },
  noLabel:      { fontSize: 13, fontFamily: FONTS.sansBold, color: COLORS.no },
  barTrack:     { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: COLORS.border, marginBottom: 12 },
  barYes:       { backgroundColor: COLORS.yes },
  barNo:        { backgroundColor: COLORS.no },

  statsRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statsLeft:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statBettors:  { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textMuted },
  statsRight:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statNum:      { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textMuted },
  statDot:      { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textDim },

  myBetRow:     { marginTop: 12, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  myBetRowYes:  { backgroundColor: COLORS.yesLight },
  myBetRowNo:   { backgroundColor: COLORS.noLight },
  myBetText:    { fontFamily: FONTS.sansBold, fontSize: 13 },
  myBetTextYes: { color: COLORS.yes },
  myBetTextNo:  { color: COLORS.no },
});
