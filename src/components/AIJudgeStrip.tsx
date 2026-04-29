import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/lib/constants';

export function AIJudgeStrip() {
  return (
    <View style={styles.strip}>
      <View style={styles.iconWrap}>
        <Ionicons name="sparkles" size={16} color={COLORS.primary} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Resolved by AI Judge</Text>
        <Text style={styles.body}>
          Claude will review evidence and automatically rule on this market when it closes.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  textWrap: { flex: 1 },
  title: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    color: COLORS.primary,
    marginBottom: 3,
  },
  body: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: COLORS.primary + 'CC',
    lineHeight: 17,
  },
});
