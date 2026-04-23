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
        creator:profiles!markets_creator_id_fkey ( id, username, display_name, avatar_url )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) { setLoading(false); return; }

    const ids = data.map(m => m.id);
    const { data: myPos } = await supabase
      .from('positions')
      .select('*')
      .in('market_id', ids)
      .eq('user_id', user.id);

    const posMap: Record<string, any> = {};
    (myPos ?? []).forEach(p => { posMap[p.market_id] = p; });

    setMarkets(data.map(m => ({ ...m, my_position: posMap[m.id] ?? null })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={markets}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <MarketCard
            market={item}
            onPress={() => router.push(`/markets/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<FeedHeader />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
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

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.joinBtn}
          onPress={() => router.push('/markets/join')}
          activeOpacity={0.8}
        >
          <Ionicons name="enter-outline" size={18} color={COLORS.primary} />
          <Text style={styles.joinBtnText}>Join</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.newMarketBtn}
          onPress={() => router.push('/markets/create')}
          activeOpacity={0.85}
        >
          <Text style={styles.newMarketText}>+ New Market</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FeedHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text style={styles.logo}>Hunch</Text>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')}>
          <Ionicons name="person-circle-outline" size={28} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={styles.tagline}>Group prediction markets</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.bg },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  header:        { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },
  headerRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo:          { fontFamily: FONTS.serif, fontSize: 32, color: COLORS.text, letterSpacing: -0.5 },
  profileBtn:    { padding: 4 },
  tagline:       { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  list:          { paddingBottom: 16 },
  empty:         { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle:    { fontFamily: FONTS.serif, fontSize: 22, color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  emptySub:      { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  joinLink:      { paddingVertical: 8 },
  joinLinkText:  { fontFamily: FONTS.sansMedium, color: COLORS.primary, fontSize: 14 },
  bottomBar:     { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 20, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  joinBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 4, paddingVertical: 14, paddingHorizontal: 18 },
  joinBtnText:   { fontFamily: FONTS.sansBold, color: COLORS.primary, fontSize: 15 },
  newMarketBtn:  { flex: 1, backgroundColor: COLORS.primary, borderRadius: 4, paddingVertical: 14, alignItems: 'center' },
  newMarketText: { fontFamily: FONTS.sansBold, color: '#fff', fontSize: 15 },
});
