import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, Alert, Share,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useGroups, useGroupMembers } from '@/hooks/useGroups';
import { useGroupMarkets } from '@/hooks/useMarkets';
import { useLeaderboard } from '@/hooks/usePositions';
import { COLORS } from '@/lib/constants';
import { MarketCard } from '@/components/MarketCard';
import { LeaderboardEntry } from '@/components/LeaderboardEntry';
// shareGroupInvite removed — groups are no longer the sharing unit
import type { UserGroupStats } from '@/lib/types';

type Tab = 'markets' | 'leaderboard' | 'members';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { groups, leaveGroup } = useGroups(user?.id);
  const { markets, loading: marketsLoading, fetchMarkets } = useGroupMarkets(id, user?.id);
  const { members } = useGroupMembers(id);
  const { fetchLeaderboard } = useLeaderboard(id);
  const [tab, setTab] = useState<Tab>('markets');
  const [leaderboard, setLeaderboard] = useState<UserGroupStats[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const group = groups.find(g => g.id === id);
  const isAdmin = group?.admin_id === user?.id;

  const loadLeaderboard = useCallback(async () => {
    const data = await fetchLeaderboard();
    setLeaderboard(data);
  }, [fetchLeaderboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMarkets();
    if (tab === 'leaderboard') await loadLeaderboard();
    setRefreshing(false);
  };

  const handleTabChange = (next: Tab) => {
    setTab(next);
    if (next === 'leaderboard') loadLeaderboard();
  };

  const handleLeave = () => {
    Alert.alert('Leave group', `Leave "${group?.name}"? You won't be able to see markets unless you rejoin.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        await leaveGroup(id!);
        router.back();
      }},
    ]);
  };

  if (!group) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: group.name,
          headerRight: () => (
            <View style={styles.headerRight}>
              <TouchableOpacity>
                <Ionicons name="share-outline" size={22} color={COLORS.text} />
              </TouchableOpacity>
              {!isAdmin && (
                <TouchableOpacity onPress={handleLeave} style={{ marginLeft: 14 }}>
                  <Ionicons name="exit-outline" size={22} color={COLORS.no} />
                </TouchableOpacity>
              )}
            </View>
          ),
        }}
      />

      {/* Invite code banner */}
      <View style={styles.codeBanner}>
        <Text style={styles.codeLabel}>Invite code</Text>
        <Text style={styles.code}>{group.invite_code}</Text>
        <TouchableOpacity>
          <Ionicons name="copy-outline" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabs}>
        {(['markets', 'leaderboard', 'members'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => handleTabChange(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'markets' && (
        <FlatList
          data={markets}
          keyExtractor={m => m.id}
          renderItem={({ item }) => (
            <MarketCard market={item} onPress={() => router.push(`/markets/${item.id}`)} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            !marketsLoading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No markets yet.</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            <TouchableOpacity style={styles.createBtn} onPress={() => router.push({ pathname: '/markets/create', params: { groupId: id } })}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createBtnText}>New market</Text>
            </TouchableOpacity>
          }
        />
      )}

      {tab === 'leaderboard' && (
        <FlatList
          data={leaderboard}
          keyExtractor={s => s.user_id}
          renderItem={({ item, index }) => <LeaderboardEntry stats={item} rank={index + 1} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={<View style={styles.emptyWrap}><Text style={styles.emptyText}>No stats yet.</Text></View>}
        />
      )}

      {tab === 'members' && (
        <FlatList
          data={members}
          keyExtractor={m => m.user_id}
          renderItem={({ item }) => (
            <View style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {(item.profile?.display_name ?? item.profile?.username ?? '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.memberName}>{item.profile?.display_name ?? item.profile?.username}</Text>
                <Text style={styles.memberHandle}>@{item.profile?.username}</Text>
              </View>
              {group.admin_id === item.user_id && (
                <View style={styles.adminBadge}><Text style={styles.adminText}>admin</Text></View>
              )}
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.bg },
  headerRight:      { flexDirection: 'row', alignItems: 'center' },
  codeBanner:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  codeLabel:        { color: COLORS.textMuted, fontSize: 12 },
  code:             { flex: 1, color: COLORS.text, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2, fontSize: 15 },
  tabs:             { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab:              { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive:        { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText:          { color: COLORS.textMuted, fontSize: 14, fontWeight: '500' },
  tabTextActive:    { color: COLORS.primary, fontWeight: '700' },
  list:             { paddingBottom: 32 },
  emptyWrap:        { alignItems: 'center', paddingTop: 48 },
  emptyText:        { color: COLORS.textMuted, fontSize: 14 },
  createBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14 },
  createBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  memberRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  memberAvatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  memberName:       { color: COLORS.text, fontWeight: '600', fontSize: 15 },
  memberHandle:     { color: COLORS.textMuted, fontSize: 12 },
  adminBadge:       { marginLeft: 'auto', backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  adminText:        { color: '#fff', fontSize: 11, fontWeight: '700' },
});
