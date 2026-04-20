import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Group, GroupMember } from '@/lib/types';

export function useGroups(userId: string | undefined) {
  const [groups, setGroups]   = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        group_id,
        groups (
          id, name, description, invite_code, admin_id, created_at,
          admin:profiles!groups_admin_id_fkey ( id, username, display_name )
        )
      `)
      .eq('user_id', userId);

    if (error) { setError(error.message); setLoading(false); return; }

    const parsed: Group[] = (data ?? [])
      .map((row: any) => row.groups)
      .filter(Boolean);

    // Attach member counts
    const ids = parsed.map(g => g.id);
    if (ids.length) {
      const { data: counts } = await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', ids);

      const countMap: Record<string, number> = {};
      (counts ?? []).forEach((r: any) => {
        countMap[r.group_id] = (countMap[r.group_id] ?? 0) + 1;
      });

      parsed.forEach(g => { g.member_count = countMap[g.id] ?? 0; });
    }

    setGroups(parsed);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const createGroup = useCallback(async (name: string, description?: string) => {
    if (!userId) return { error: 'Not authenticated' };

    const { data: group, error: gErr } = await supabase
      .from('groups')
      .insert({ name, description, admin_id: userId })
      .select()
      .single();

    if (gErr || !group) return { error: gErr?.message ?? 'Failed to create group' };

    // Creator auto-joins
    await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: userId });

    await fetchGroups();
    return { data: group as Group };
  }, [userId, fetchGroups]);

  const joinByCode = useCallback(async (inviteCode: string) => {
    if (!userId) return { error: 'Not authenticated' };

    const { data: group, error: gErr } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .single();

    if (gErr || !group) return { error: 'Invalid invite code' };

    const { error: mErr } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: userId });

    if (mErr) return { error: 'Already a member or failed to join' };

    await fetchGroups();
    return { data: group as Group };
  }, [userId, fetchGroups]);

  const leaveGroup = useCallback(async (groupId: string) => {
    if (!userId) return;
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);
    await fetchGroups();
  }, [userId, fetchGroups]);

  return { groups, loading, error, fetchGroups, createGroup, joinByCode, leaveGroup };
}

export function useGroupMembers(groupId: string | undefined) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    supabase
      .from('group_members')
      .select('*, profile:profiles(*)')
      .eq('group_id', groupId)
      .then(({ data }) => {
        setMembers((data as any) ?? []);
        setLoading(false);
      });
  }, [groupId]);

  return { members, loading };
}
