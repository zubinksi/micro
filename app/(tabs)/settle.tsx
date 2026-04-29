import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Linking, RefreshControl,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useSettlements } from '@/hooks/usePositions';
import { COLORS, FONTS } from '@/lib/constants';
import { venmoDeeplink, cashAppDeeplink, settlementNote, formatAmount } from '@/utils/settlement';
import type { Settlement } from '@/lib/types';

export default function SettleScreen() {
  const { user } = useAuth();
  const { fetchSettlements, markSettled } = useSettlements(user?.id);
  const [debts, setDebts]           = useState<Settlement[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const data = await fetchSettlements();
    setDebts(data);
  };

  useEffect(() => { load(); }, [user?.id]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const iOwe   = debts.filter(d => d.from_user_id === user?.id);
  const owedMe = debts.filter(d => d.to_user_id === user?.id);

  const netAmount = owedMe.reduce((s, d) => s + d.amount, 0) - iOwe.reduce((s, d) => s + d.amount, 0);

  const handleSettle = async (debt: Settlement) => {
    await markSettled(debt.id);
    await load();
  };

  const renderDebt = (debt: Settlement, direction: 'owe' | 'owed') => {
    const counterparty = direction === 'owe' ? debt.to_profile : debt.from_profile;
    const note = settlementNote(debt.market?.question ?? 'Maybe bet');

    return (
      <View key={debt.id} style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <Text style={styles.counterparty}>
              {direction === 'owe' ? 'You owe ' : ''}
              <Text style={styles.name}>{counterparty?.display_name ?? counterparty?.username}</Text>
              {direction === 'owed' ? ' owes you' : ''}
            </Text>
            <Text style={styles.marketQ} numberOfLines={1}>{debt.market?.question}</Text>
          </View>
          <Text style={[styles.amount, direction === 'owe' ? styles.amountOwe : styles.amountOwed]}>
            {formatAmount(debt.amount)}
          </Text>
        </View>

        <View style={styles.cardActions}>
          {direction === 'owe' && counterparty?.username && (
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => Linking.openURL(venmoDeeplink(counterparty.username!, debt.amount, note))}
            >
              <Text style={styles.payBtnText}>Pay via Venmo</Text>
            </TouchableOpacity>
          )}
          {direction === 'owe' && counterparty?.username && (
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => Linking.openURL(cashAppDeeplink(counterparty.username!, debt.amount, note))}
            >
              <Text style={styles.payBtnText}>Cash App</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.settledBtn} onPress={() => handleSettle(debt)}>
            <Text style={styles.settledBtnText}>Mark settled</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={[]}
        renderItem={null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListHeaderComponent={
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.screenTitle}>Settle</Text>
              {debts.length > 0 && (
                <View style={[styles.netPill, netAmount >= 0 ? styles.netPillPos : styles.netPillNeg]}>
                  <Text style={[styles.netPillText, netAmount >= 0 ? styles.netPillTextPos : styles.netPillTextNeg]}>
                    {netAmount >= 0 ? '+' : ''}{formatAmount(netAmount)} net
                  </Text>
                </View>
              )}
            </View>

            {iOwe.length === 0 && owedMe.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>All settled up</Text>
                <Text style={styles.emptySub}>No outstanding debts.</Text>
              </View>
            )}

            {iOwe.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>You owe</Text>
                {iOwe.map(d => renderDebt(d, 'owe'))}
              </View>
            )}

            {owedMe.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Owed to you</Text>
                {owedMe.map(d => renderDebt(d, 'owed'))}
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.bg },

  titleRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  screenTitle:     { fontFamily: FONTS.serif, fontSize: 32, color: COLORS.text },
  netPill:         { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
  netPillPos:      { backgroundColor: COLORS.yesLight },
  netPillNeg:      { backgroundColor: COLORS.noLight },
  netPillText:     { fontFamily: FONTS.sansBold, fontSize: 13 },
  netPillTextPos:  { color: COLORS.yes },
  netPillTextNeg:  { color: COLORS.no },

  section:         { marginBottom: 8, paddingHorizontal: 16 },
  sectionTitle:    { fontFamily: FONTS.sansBold, fontSize: 11, color: COLORS.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10, marginTop: 20 },

  card:            {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardTopLeft:     { flex: 1, marginRight: 12 },
  counterparty:    { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 13, marginBottom: 2 },
  name:            { fontFamily: FONTS.sansBold, color: COLORS.text },
  amount:          { fontFamily: 'Inter_800ExtraBold', fontSize: 22 },
  amountOwe:       { color: COLORS.no },
  amountOwed:      { color: COLORS.yes },
  marketQ:         { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 12 },
  cardActions:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  payBtn:          { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  payBtnText:      { fontFamily: FONTS.sansMedium, color: '#fff', fontSize: 13 },
  settledBtn:      { borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 8, paddingHorizontal: 14 },
  settledBtnText:  { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 13 },

  empty:           { alignItems: 'center', paddingTop: 80 },
  emptyTitle:      { fontFamily: FONTS.serif, fontSize: 22, color: COLORS.text, marginBottom: 8 },
  emptySub:        { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 14 },
});
