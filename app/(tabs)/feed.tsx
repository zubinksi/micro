import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/lib/constants';
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>No markets yet</Text>
            <Text style={styles.emptySub}>Create a market or join one with an invite code.</Text>
            <TouchableOpacity style={styles.joinLink} onPress={() => router.push('/markets/join')}>
              <Text style={styles.joinLinkText}>Join with invite code</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
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

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.bg },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:          { paddingTop: 12, paddingBottom: 16 },
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon:     { fontSize: 40, marginBottom: 12 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptySub:      { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginBottom: 20 },
  joinLink:      { paddingVertical: 8 },
  joinLinkText:  { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  bottomBar:     { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 20, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  newMarketBtn:  { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  newMarketText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
