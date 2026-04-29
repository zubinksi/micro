import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS } from '@/lib/constants';
import type { Market } from '@/lib/types';
import { MarketCard } from '@/components/MarketCard';

export default function FeedScreen() {
  const { user } = useAuth();
  const [markets, setMarkets]       = useState<Market[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('markets')
      .select(`
        *,
        creator:profiles!markets_creator_id_fkey ( id, username, display_name, avatar_url ),
        positions(count),
        comments(count)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) { setLoading(false); return; }

    const ids = data.map((m: any) => m.id);

    const [{ data: myPos }, { data: allPos }] = await Promise.all([
      supabase.from('positions').select('*').in('market_id', ids).eq('user_id', user.id),
      supabase.from('positions').select('market_id, user_id, profile:profiles(id, username)').in('market_id', ids),
    ]);

    const posMap: Record<string, any> = {};
    const allPosMap: Record<string, any[]> = {};
    (myPos ?? []).forEach((p: any) => { posMap[p.market_id] = p; });
    (allPos ?? []).forEach((p: any) => {
      if (!allPosMap[p.market_id]) allPosMap[p.market_id] = [];
      allPosMap[p.market_id].push(p);
    });

    setMarkets(data.map((m: any) => ({
      ...m,
      my_position:    posMap[m.id] ?? null,
      position_count: m.positions?.[0]?.count ?? 0,
      comment_count:  m.comments?.[0]?.count ?? 0,
      top_bettors:    (allPosMap[m.id] ?? []).slice(0, 4).map((p: any) => p.profile).filter(Boolean),
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>;
  }

  const activeBets = markets.filter(m => m.my_position && m.status === 'open').length;

  return (
    <View style={styles.container}>
      <FlatList
        data={markets}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <MarketCard market={item} onPress={() => router.push(`/markets/${item.id}`)} />
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<FeedHeader activeBets={activeBets} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No markets yet</Text>
            <Text style={styles.emptySub}>Create a market or join one with an invite code.</Text>
            <TouchableOpacity style={styles.joinLink} onPress={() => router.push('/markets/join')}>
              <Text style={styles.joinLinkText}>Join with invite code →</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/markets/create')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function FeedHeader({ activeBets }: { activeBets: number }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text style={styles.logo}>Maybe</Text>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')}>
          <Ionicons name="person-circle-outline" size={28} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={styles.tagline}>Put five on it</Text>

      <View style={styles.balanceCard}>
        <View>
          <Text style={styles.balanceLabel}>YOUR BETS</Text>
          <Text style={styles.balanceValue}>{activeBets} active</Text>
        </View>
        <TouchableOpacity style={styles.joinChip} onPress={() => router.push('/markets/join')}>
          <Ionicons name="enter-outline" size={14} color={COLORS.primary} />
          <Text style={styles.joinChipText}>Join</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>YOUR BETS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },

  header:       { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  logo:         { fontFamily: FONTS.serif, fontSize: 32, color: COLORS.text },
  profileBtn:   { padding: 4 },
  tagline:      { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.textMuted, marginBottom: 16 },

  balanceCard:  {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  balanceLabel: { fontFamily: FONTS.sansBold, fontSize: 10, color: COLORS.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  balanceValue: { fontFamily: FONTS.sansBold, fontSize: 28, color: COLORS.text },
  joinChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 99, paddingVertical: 8, paddingHorizontal: 16 },
  joinChipText: { fontFamily: FONTS.sansBold, color: COLORS.primary, fontSize: 14 },

  sectionLabel: { fontFamily: FONTS.sansBold, fontSize: 11, color: COLORS.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },

  list:         { paddingBottom: 100 },
  empty:        { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle:   { fontFamily: FONTS.serif, fontSize: 22, color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  emptySub:     { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  joinLink:     { paddingVertical: 8 },
  joinLinkText: { fontFamily: FONTS.sansMedium, color: COLORS.primary, fontSize: 14 },

  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 28, fontFamily: FONTS.sansBold, lineHeight: 32 },
});
