import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useGroups } from '@/hooks/useGroups';
import { supabase } from '@/lib/supabase';
import { COLORS } from '@/lib/constants';
import type { Market } from '@/lib/types';
import { MarketCard } from '@/components/MarketCard';

export default function FeedScreen() {
  const { user, profile } = useAuth();
  const { groups } = useGroups(user?.id);
  const [markets, setMarkets]     = useState<Market[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(async () => {
    if (!user || groups.length === 0) { setLoading(false); return; }

    const groupIds = groups.map(g => g.id);
    const { data } = await supabase
      .from('markets')
      .select(`
        *,
        creator:profiles!markets_creator_id_fkey ( id, username, display_name, avatar_url )
      `)
      .in('group_id', groupIds)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!data) { setLoading(false); return; }

    // Attach my positions
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
  }, [user, groups]);

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

  if (groups.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>👥</Text>
        <Text style={styles.emptyTitle}>No groups yet</Text>
        <Text style={styles.emptySub}>Create or join a group to see markets here.</Text>
        <TouchableOpacity style={styles.cta} onPress={() => router.push('/groups/create')}>
          <Text style={styles.ctaText}>Create a group</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctaSecondary} onPress={() => router.push('/groups/join')}>
          <Text style={styles.ctaSecondaryText}>Join with code</Text>
        </TouchableOpacity>
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
            showGroup
            groupName={groups.find(g => g.id === item.group_id)?.name}
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
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>No markets yet</Text>
            <Text style={styles.emptySub}>Kick things off — create the first market in your group.</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.wordmark}>micro</Text>
            <Text style={styles.greeting}>
              Hey {profile?.display_name ?? profile?.username ?? ''}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.bg },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  list:             { paddingBottom: 32 },
  header:           { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  wordmark:         { fontSize: 28, fontWeight: '800', color: COLORS.primary, letterSpacing: -1 },
  greeting:         { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  emptyIcon:        { fontSize: 40, marginBottom: 12 },
  emptyTitle:       { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptySub:         { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginBottom: 24 },
  cta:              { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 10 },
  ctaText:          { color: '#fff', fontWeight: '700', fontSize: 15 },
  ctaSecondary:     { paddingVertical: 10 },
  ctaSecondaryText: { color: COLORS.textMuted, fontSize: 14 },
});
