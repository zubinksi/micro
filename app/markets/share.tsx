import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Share as NativeShare, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS } from '@/lib/constants';

function getAppBaseUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return 'https://maybe.vercel.app';
}

const AVATAR_COLORS = ['#C8D8C0', '#C0CCD8', '#D8CCC0', '#D0C0D8', '#C0D4D0', '#D8C8C0'];
function avatarColor(id: string) {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getTimeLeft(closesAt: string) {
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400_000);
  const hours = Math.floor((diff % 86400_000) / 3600_000);
  if (days > 1) return `${days} days`;
  if (days === 1) return '1 day';
  if (hours > 0) return `${hours} hours`;
  return '<1 hour';
}

interface Friend {
  id: string;
  username: string;
  display_name: string | null;
  hasJoined: boolean;
}

export default function ShareScreen() {
  const { id, outcome, stake } = useLocalSearchParams<{ id: string; outcome?: string; stake?: string }>();
  const { user } = useAuth();

  const [question,   setQuestion]   = useState('');
  const [closesAt,   setClosesAt]   = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [friends,    setFriends]    = useState<Friend[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  const shareUrl = `${getAppBaseUrl()}/api/og?id=${id}`;

  useEffect(() => {
    if (!id) return;
    async function load() {
      const { data: market } = await supabase
        .from('markets')
        .select('question, closes_at, invite_code, group_id')
        .eq('id', id)
        .single();
      if (!market) { setLoading(false); return; }

      setQuestion(market.question);
      setClosesAt(market.closes_at);
      setInviteCode(market.invite_code ?? '');

      if (market.group_id) {
        const [{ data: positions }, { data: members }] = await Promise.all([
          supabase.from('positions').select('user_id').eq('market_id', id),
          supabase
            .from('group_members')
            .select('user_id, profile:profiles(id, username, display_name)')
            .eq('group_id', market.group_id)
            .neq('user_id', user?.id ?? ''),
        ]);

        const joinedIds = new Set((positions ?? []).map((p: any) => p.user_id));
        setFriends(
          (members ?? []).map((m: any) => ({
            id:           m.profile.id,
            username:     m.profile.username,
            display_name: m.profile.display_name,
            hasJoined:    joinedIds.has(m.profile.id),
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, [id, user?.id]);

  const handleShareLink = async () => {
    await NativeShare.share({
      message: `${question}\n${shareUrl}`,
      url: shareUrl,
    });
  };

  const handleInvite = async (friend: Friend) => {
    await NativeShare.share({
      message: `Join my bet on Maybe!\n"${question}"\n${inviteCode ? `Invite code: ${inviteCode}\n` : ''}${shareUrl}`,
      url: shareUrl,
    });
    setInvitedIds(prev => new Set([...prev, friend.id]));
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>;
  }

  const timeLeft  = closesAt ? getTimeLeft(closesAt) : null;
  const hasBet    = !!outcome;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.inner}
      data={friends}
      keyExtractor={item => item.id}
      ListHeaderComponent={
        <View>
          {/* Party icon */}
          <View style={styles.partyWrap}>
            <View style={styles.partyCircle}>
              <Text style={styles.partyEmoji}>🎉</Text>
            </View>
          </View>
          <Text style={styles.title}>Your bet is live!</Text>
          <Text style={styles.subtitle}>Now get your friends to join</Text>

          {/* Market summary card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryQuestion}>{question}</Text>
            {hasBet && (
              <Text style={styles.summaryBet}>
                You bet{' '}
                <Text style={outcome === 'YES' ? styles.yesText : styles.noText}>{outcome}</Text>
                {stake ? <Text> · <Text style={styles.stakeText}>${stake}</Text></Text> : null}
              </Text>
            )}
            {timeLeft && <Text style={styles.summaryClose}>Closes in {timeLeft}</Text>}
          </View>

          {/* Share link */}
          <Text style={styles.sectionLabel}>SHARE LINK</Text>
          <View style={styles.linkRow}>
            <Text style={styles.linkText} numberOfLines={1}>{shareUrl}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleShareLink}>
              <Text style={styles.copyBtnText}>Share</Text>
            </TouchableOpacity>
          </View>

          {friends.length > 0 && (
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>INVITE FRIENDS</Text>
          )}
        </View>
      }
      renderItem={({ item }) => {
        const isInvited = item.hasJoined || invitedIds.has(item.id);
        const initials  = (item.display_name ?? item.username ?? '??').slice(0, 2).toUpperCase();
        return (
          <View style={[styles.friendRow, isInvited && styles.friendRowInvited]}>
            <View style={[styles.avatar, { backgroundColor: avatarColor(item.id) }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.friendName}>{item.display_name ?? item.username}</Text>
            {isInvited ? (
              <View style={styles.joinedPill}>
                <Text style={styles.joinedText}>✓ Joined</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.inviteBtn} onPress={() => handleInvite(item)}>
                <Text style={styles.inviteBtnText}>Invite</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }}
      ListFooterComponent={<View style={{ height: 40 }} />}
    />
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: COLORS.bg },
  center:             { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  inner:              { padding: 20, paddingTop: 24 },

  partyWrap:          { alignItems: 'center', marginBottom: 16 },
  partyCircle:        { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.yesLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.yes + '50' },
  partyEmoji:         { fontSize: 36 },

  title:              { fontFamily: FONTS.serif, fontSize: 28, color: COLORS.text, textAlign: 'center', marginBottom: 6 },
  subtitle:           { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginBottom: 24 },

  summaryCard:        { backgroundColor: COLORS.surface, borderRadius: 22, padding: 18, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
  summaryQuestion:    { fontFamily: FONTS.serif, fontSize: 16, color: COLORS.text, lineHeight: 23, marginBottom: 10 },
  summaryBet:         { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textMuted, marginBottom: 4 },
  yesText:            { fontFamily: FONTS.sansBold, color: COLORS.yes },
  noText:             { fontFamily: FONTS.sansBold, color: COLORS.no },
  stakeText:          { fontFamily: FONTS.sansBold, color: COLORS.text },
  summaryClose:       { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.textDim },

  sectionLabel:       { fontFamily: FONTS.sansBold, fontSize: 11, color: COLORS.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  sectionLabelSpaced: { marginTop: 24 },

  linkRow:            { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, gap: 10, marginBottom: 4 },
  linkText:           { flex: 1, fontFamily: FONTS.sans, fontSize: 13, color: COLORS.textMuted },
  copyBtn:            { backgroundColor: COLORS.primary, borderRadius: 99, paddingVertical: 6, paddingHorizontal: 14 },
  copyBtnText:        { fontFamily: FONTS.sansBold, color: '#fff', fontSize: 13 },

  friendRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: COLORS.border },
  friendRowInvited:   { borderColor: COLORS.primary + '50' },
  avatar:             { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText:         { fontFamily: FONTS.sansBold, fontSize: 14, color: COLORS.text },
  friendName:         { flex: 1, fontFamily: FONTS.sansBold, fontSize: 15, color: COLORS.text },
  joinedPill:         { backgroundColor: COLORS.yesLight, borderRadius: 99, paddingVertical: 6, paddingHorizontal: 14 },
  joinedText:         { fontFamily: FONTS.sansBold, fontSize: 13, color: COLORS.yes },
  inviteBtn:          { backgroundColor: COLORS.primary, borderRadius: 99, paddingVertical: 6, paddingHorizontal: 14 },
  inviteBtnText:      { fontFamily: FONTS.sansBold, color: '#fff', fontSize: 13 },
});
