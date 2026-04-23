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
  const [debts, setDebts]       = useState<Settlement[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const data = await fetchSettlements();
    setDebts(data);
  };

  useEffect(() => { load(); }, [user?.id]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const iOwe   = debts.filter(d => d.from_user_id === user?.id);
  const owedMe = debts.filter(d => d.to_user_id === user?.id);

  const handleSettle = async (debt: Settlement) => {
    await markSettled(debt.id);
    await load();
  };

  const renderDebt = (debt: Settlement, direction: 'owe' | 'owed') => {
    const counterparty = direction === 'owe' ? debt.to_profile : debt.from_profile;
    const note = settlementNote(debt.market?.question ?? 'Micro bet');

    return (
      <View key={debt.id} style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.counterparty}>
            {direction === 'owe' ? 'You owe ' : ''}
            <Text style={styles.name}>{counterparty?.display_name ?? counterparty?.username}</Text>
            {direction === 'owed' ? ' owes you' : ''}
          </Text>
          <Text style={[styles.amount, direction === 'owe' ? styles.amountOwe : styles.amountOwed]}>
            {formatAmount(debt.amount)}
          </Text>
        </View>
        <Text style={styles.marketQ} numberOfLines={1}>{debt.market?.question}</Text>

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
  container:      { flex: 1, backgroundColor: COLORS.bg },
  section:        { marginBottom: 24, paddingHorizontal: 16 },
  sectionTitle:   { fontFamily: FONTS.sansBold, fontSize: 11, color: COLORS.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10, marginTop: 20 },
  card:           { backgroundColor: COLORS.surface, borderRadius: 4, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  cardTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  counterparty:   { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 13 },
  name:           { fontFamily: FONTS.sansBold, color: COLORS.text },
  amount:         { fontFamily: FONTS.sansBold, fontSize: 20 },
  amountOwe:      { color: COLORS.no },
  amountOwed:     { color: COLORS.yes },
  marketQ:        { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 12, marginBottom: 14 },
  cardActions:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  payBtn:         { backgroundColor: COLORS.primary, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 14 },
  payBtnText:     { fontFamily: FONTS.sansMedium, color: '#fff', fontSize: 13 },
  settledBtn:     { borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 8, paddingHorizontal: 14 },
  settledBtnText: { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 13 },
  empty:          { alignItems: 'center', paddingTop: 80 },
  emptyTitle:     { fontFamily: FONTS.serif, fontSize: 22, color: COLORS.text, marginBottom: 8 },
  emptySub:       { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 14 },
});
