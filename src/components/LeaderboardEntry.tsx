import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/lib/constants';
import type { UserGroupStats } from '@/lib/types';

interface Props {
  stats: UserGroupStats;
  rank: number;
}

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export function LeaderboardEntry({ stats, rank }: Props) {
  const rankColor = RANK_COLORS[rank - 1] ?? COLORS.textMuted;
  const winRate = stats.markets_entered > 0
    ? Math.round((stats.markets_won / stats.markets_entered) * 100)
    : 0;

  return (
    <View style={styles.row}>
      <Text style={[styles.rank, { color: rankColor }]}>#{rank}</Text>

      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(stats.profile?.display_name ?? stats.profile?.username ?? '?').charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{stats.profile?.display_name ?? stats.profile?.username}</Text>
        <Text style={styles.sub}>{winRate}% win rate · {stats.markets_entered} markets</Text>
      </View>

      <View style={styles.right}>
        <Text style={[styles.profit, stats.total_profit >= 0 ? styles.profitPos : styles.profitNeg]}>
          {stats.total_profit >= 0 ? '+' : ''}{stats.total_profit.toFixed(0)}
        </Text>
        <Text style={styles.calibration}>cal {stats.calibration_score.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rank:        { fontSize: 16, fontWeight: '800', width: 28, textAlign: 'center' },
  avatar:      { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  info:        { flex: 1 },
  name:        { color: COLORS.text, fontWeight: '600', fontSize: 15 },
  sub:         { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  right:       { alignItems: 'flex-end' },
  profit:      { fontSize: 18, fontWeight: '800' },
  profitPos:   { color: COLORS.yes },
  profitNeg:   { color: COLORS.no },
  calibration: { fontSize: 11, color: COLORS.textDim, marginTop: 2 },
});
