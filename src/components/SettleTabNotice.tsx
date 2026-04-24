import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '@/lib/constants';

export function SettleTabNotice() {
  return (
    <View style={styles.notice}>
      <Text style={styles.emoji}>💸</Text>
      <Text style={styles.text}>
        Winnings show up in the <Text style={styles.bold}>Settle</Text> tab once the market resolves.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
  },
  emoji: { fontSize: 18 },
  text: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  bold: { fontFamily: FONTS.sansBold, color: COLORS.text },
});
