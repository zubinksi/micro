import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useGroups } from '@/hooks/useGroups';
import { COLORS } from '@/lib/constants';
import type { Group } from '@/lib/types';

export default function GroupsScreen() {
  const { user } = useAuth();
  const { groups, loading } = useGroups(user?.id);

  const renderGroup = ({ item }: { item: Group }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/groups/${item.id}`)}>
      <View style={styles.cardAvatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{item.name}</Text>
        {item.description && <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>}
        <Text style={styles.cardMeta}>{item.member_count ?? '—'} members · code {item.invite_code}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textDim} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={g => g.id}
        renderItem={renderGroup}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/groups/create')}>
              <Ionicons name="add-circle" size={20} color={COLORS.primary} />
              <Text style={styles.actionText}>New group</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/groups/join')}>
              <Ionicons name="link" size={20} color={COLORS.primary} />
              <Text style={styles.actionText}>Join with code</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No groups yet.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  list:      { paddingBottom: 32 },
  actions:   { flexDirection: 'row', gap: 12, padding: 16 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  actionText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.surface, marginHorizontal: 16,
    marginBottom: 10, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primaryDim, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  cardBody:   { flex: 1 },
  cardName:   { color: COLORS.text, fontWeight: '700', fontSize: 16 },
  cardDesc:   { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  cardMeta:   { color: COLORS.textDim, fontSize: 12, marginTop: 4 },
  empty:      { alignItems: 'center', paddingTop: 48 },
  emptyText:  { color: COLORS.textMuted, fontSize: 15 },
});
