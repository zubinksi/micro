import { useEffect, useState, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Market, Comment } from '@/lib/types';

const MARKET_SELECT = `
  *,
  creator:profiles!markets_creator_id_fkey ( id, username, display_name, avatar_url )
`;

export function useGroupMarkets(groupId: string | undefined, userId: string | undefined) {
  const [markets, setMarkets]     = useState<Market[]>([]);
  const [loading, setLoading]     = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchMarkets = useCallback(async () => {
    if (!groupId || !userId) return;

    const { data: rawMarkets } = await supabase
      .from('markets')
      .select(MARKET_SELECT)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (!rawMarkets) { setLoading(false); return; }

    const ids = rawMarkets.map(m => m.id);

    // Fetch user's own positions
    const { data: myPositions } = await supabase
      .from('positions')
      .select('*')
      .in('market_id', ids)
      .eq('user_id', userId);

    const posMap: Record<string, any> = {};
    (myPositions ?? []).forEach(p => { posMap[p.market_id] = p; });

    // Fetch resolutions
    const { data: resolutions } = await supabase
      .from('resolutions')
      .select('*')
      .in('market_id', ids);

    const resMap: Record<string, any> = {};
    (resolutions ?? []).forEach(r => { resMap[r.market_id] = r; });

    const enriched: Market[] = rawMarkets.map(m => ({
      ...m,
      my_position: posMap[m.id] ?? null,
      resolution: resMap[m.id] ?? null,
    }));

    setMarkets(enriched);
    setLoading(false);
  }, [groupId, userId]);

  useEffect(() => {
    fetchMarkets();

    if (!groupId) return;

    // Subscribe to real-time pool updates
    channelRef.current = supabase
      .channel(`markets:${groupId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'markets',
        filter: `group_id=eq.${groupId}`,
      }, payload => {
        setMarkets(prev => prev.map(m =>
          m.id === payload.new.id ? { ...m, ...payload.new } : m
        ));
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'markets',
        filter: `group_id=eq.${groupId}`,
      }, () => { fetchMarkets(); })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, [groupId, fetchMarkets]);

  const createMarket = useCallback(async (params: {
    question: string;
    resolution_criteria: string;
    closes_at: string;
    resolves_at?: string;
    resolver_type: 'autocrat' | 'consensus' | 'oracle';
    resolver_id?: string;
  }) => {
    if (!groupId || !userId) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('markets')
      .insert({ ...params, group_id: groupId, creator_id: userId })
      .select(MARKET_SELECT)
      .single();

    if (!error && data) {
      await fetchMarkets();
    }
    return { data: data as Market | null, error };
  }, [groupId, userId, fetchMarkets]);

  return { markets, loading, fetchMarkets, createMarket };
}

export function useMarket(marketId: string | undefined, userId: string | undefined) {
  const [market, setMarket]   = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchMarket = useCallback(async () => {
    if (!marketId) return;

    const [{ data: m }, { data: pos }, { data: res }] = await Promise.all([
      supabase.from('markets').select(MARKET_SELECT).eq('id', marketId).single(),
      userId
        ? supabase.from('positions').select('*').eq('market_id', marketId).eq('user_id', userId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('resolutions').select('*, resolver:profiles(*), dispute_votes(*, profile:profiles(*))').eq('market_id', marketId).maybeSingle(),
    ]);

    if (m) {
      setMarket({ ...m, my_position: pos ?? null, resolution: res ?? null });
    }
    setLoading(false);
  }, [marketId, userId]);

  useEffect(() => {
    fetchMarket();

    if (!marketId) return;

    channelRef.current = supabase
      .channel(`market:${marketId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markets', filter: `id=eq.${marketId}` },
        payload => { setMarket(prev => prev ? { ...prev, ...payload.new } : null); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'positions', filter: `market_id=eq.${marketId}` },
        () => { fetchMarket(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resolutions', filter: `market_id=eq.${marketId}` },
        () => { fetchMarket(); })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, [marketId, fetchMarket]);

  return { market, loading, fetchMarket };
}

export function useComments(marketId: string | undefined) {
  const [comments, setComments] = useState<Comment[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!marketId) return;

    supabase
      .from('comments')
      .select('*, profile:profiles(*)')
      .eq('market_id', marketId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setComments((data as any) ?? []));

    channelRef.current = supabase
      .channel(`comments:${marketId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `market_id=eq.${marketId}` },
        async payload => {
          const { data } = await supabase
            .from('comments')
            .select('*, profile:profiles(*)')
            .eq('id', payload.new.id)
            .single();
          if (data) setComments(prev => [...prev, data as any]);
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments', filter: `market_id=eq.${marketId}` },
        payload => { setComments(prev => prev.filter(c => c.id !== payload.old.id)); })
      .subscribe();

    return () => { channelRef.current?.unsubscribe(); };
  }, [marketId]);

  const postComment = useCallback(async (userId: string, content: string) => {
    return supabase.from('comments').insert({ market_id: marketId, user_id: userId, content });
  }, [marketId]);

  const deleteComment = useCallback(async (commentId: string) => {
    return supabase.from('comments').delete().eq('id', commentId);
  }, []);

  return { comments, postComment, deleteComment };
}
