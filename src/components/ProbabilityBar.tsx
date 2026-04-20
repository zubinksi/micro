import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/lib/constants';
import type { PoolOdds } from '@/lib/types';

interface Props {
  odds: PoolOdds;
  height?: number;
}

export function ProbabilityBar({ odds, height = 10 }: Props) {
  const yesPct = odds.totalPool === 0 ? 50 : Math.round(odds.yesProb * 100);
  const noPct  = 100 - yesPct;

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.yes}>{yesPct}% YES</Text>
        <Text style={styles.no}>{noPct}% NO</Text>
      </View>
      <View style={[styles.track, { height }]}>
        <View style={[styles.yesBar, { flex: yesPct }]} />
        <View style={[styles.noBar, { flex: noPct }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  yes:      { color: COLORS.yes, fontWeight: '700', fontSize: 14 },
  no:       { color: COLORS.no, fontWeight: '700', fontSize: 14 },
  track:    { flexDirection: 'row', borderRadius: 99, overflow: 'hidden', backgroundColor: COLORS.border },
  yesBar:   { backgroundColor: COLORS.yes },
  noBar:    { backgroundColor: COLORS.no },
});
