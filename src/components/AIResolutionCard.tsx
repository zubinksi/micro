import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/lib/constants';

interface Props {
  outcome: 'YES' | 'NO';
  summary: string;
}

export function AIResolutionCard({ outcome, summary }: Props) {
  const isYes = outcome === 'YES';
  const outcomeColor = isYes ? COLORS.yes : COLORS.no;
  const outcomeBg    = isYes ? COLORS.yesLight : COLORS.noLight;
  const borderColor  = isYes ? COLORS.yes + '40' : COLORS.no + '40';

  return (
    <View style={[styles.card, { borderColor }]}>
      <View style={[styles.header, { backgroundColor: outcomeBg }]}>
        <View style={[styles.iconSquare, { backgroundColor: outcomeColor }]}>
          <Ionicons name="sparkles" size={13} color="#fff" />
        </View>
        <Text style={[styles.verdict, { color: outcomeColor }]}>{outcome}</Text>
        <View style={[styles.settledPill, { borderColor: outcomeColor + '50' }]}>
          <Text style={[styles.settledText, { color: outcomeColor }]}>SETTLED</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>AI Judge ruling</Text>
        <Text style={styles.reasoning}>{summary}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconSquare: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdict: {
    flex: 1,
    fontFamily: FONTS.serif,
    fontSize: 22,
    lineHeight: 26,
  },
  settledPill: {
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  settledText: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    letterSpacing: 1,
  },
  body: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: {
    fontFamily: FONTS.sansMedium,
    fontSize: 10,
    color: COLORS.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  reasoning: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 21,
  },
});
