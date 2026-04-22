import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useMarket, useComments } from '@/hooks/useMarkets';
import { useStake, useResolve } from '@/hooks/usePositions';
import { COLORS, STAKE_MIN, STAKE_MAX, DISPUTE_WINDOW_HOURS } from '@/lib/constants';
import { getPoolOdds, getPayoutPreview } from '@/utils/pool';
import { shareOutcomeCard, shareMarketInvite } from '@/utils/share';
import { ProbabilityBar } from '@/components/ProbabilityBar';
import { StakeModal } from '@/components/StakeModal';
import { ResolveModal } from '@/components/ResolveModal';
import type { Outcome } from '@/lib/types';

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();
  const { market, loading, fetchMarket } = useMarket(id, user?.id);
  const { comments, postComment, deleteComment } = useComments(id);
  const { stake }   = useStake();
  const { resolve, dispute } = useResolve();

  const [stakeModal,   setStakeModal]   = useState(false);
  const [resolveModal, setResolveModal] = useState(false);
  const [comment,      setComment]      = useState('');
  const [posting,      setPosting]      = useState(false);
  const [disputeError, setDisputeError] = useState('');

  const handleStake = useCallback(async (outcome: Outcome, amount: number) => {
    if (!user || !id) return;
    const { error } = await stake({ marketId: id, userId: user.id, outcome, amount });
    if (error) throw new Error(error.message ?? 'Failed to stake');
    setStakeModal(false);
    await fetchMarket();
  }, [user, id, stake, fetchMarket]);

  const handleResolve = useCallback(async (outcome: Outcome, evidenceUrl?: string) => {
    if (!id || !user) return;
    const { error } = await resolve({ marketId: id, userId: user.id, outcome, evidenceUrl });
    if (error) throw new Error(error.message ?? 'Failed to resolve');
    setResolveModal(false);
    await fetchMarket();
  }, [id, user, resolve, fetchMarket]);

  const handleDispute = useCallback(async (vote: Outcome) => {
    if (!market?.resolution || !user) return;
    setDisputeError('');
    const { error } = await dispute(market.resolution.id, user.id, vote);
    if (error) setDisputeError('Could not cast dispute vote.');
    else await fetchMarket();
  }, [market, user, dispute, fetchMarket]);

  const handlePostComment = async () => {
    if (!comment.trim() || !user) return;
    setPosting(true);
    await postComment(user.id, comment.trim());
    setComment('');
    setPosting(false);
  };

  if (loading || !market) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>;
  }

  const odds        = getPoolOdds(market);
  const myPosition  = market.my_position;
  const resolution  = market.resolution;
  const isOpen      = market.status === 'open';
  const isLocked    = market.status === 'locked';
  const isResolving = market.status === 'resolving';
  const isSettled   = market.status === 'settled';
  const canResolve  = (market.resolver_type === 'autocrat' && market.resolver_id === user?.id)
    || (market.resolver_type === 'consensus' && !!myPosition)
    || (market.creator_id === user?.id);
  const canStake = isOpen && !myPosition;

  const disputeDeadline = resolution
    ? new Date(new Date(resolution.created_at).getTime() + DISPUTE_WINDOW_HOURS * 3600_000)
    : null;
  const disputeOpen   = disputeDeadline && disputeDeadline > new Date() && !resolution?.disputed;
  const myDisputeVote = resolution?.dispute_votes?.find(v => v.user_id === user?.id);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{
        title: '',
        headerRight: () => (
          <View style={styles.headerActions}>
            {/* Share invite code */}
            {market.invite_code && (
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => shareMarketInvite(market.question, market.invite_code)}
              >
                <Ionicons name="person-add-outline" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
            {/* Share outcome (settled markets) */}
            {isSettled && myPosition && (
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => shareOutcomeCard(market, myPosition, resolution?.outcome === myPosition.outcome)}
              >
                <Ionicons name="share-outline" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        ),
      }} />

      <ScrollView contentContainerStyle={styles.inner}>

        {/* Status badge */}
        <View style={[styles.badge, styles[`badge_${market.status}` as keyof typeof styles]]}>
          <Text style={[styles.badgeText, { color: STATUS_TEXT[market.status] ?? COLORS.textMuted }]}>
            {market.status.toUpperCase()}
          </Text>
        </View>

        {/* Question */}
        <Text style={styles.question}>{market.question}</Text>
        <Text style={styles.criteria}>{market.resolution_criteria}</Text>

        {/* Probability bar */}
        <ProbabilityBar odds={odds} />
        <View style={styles.poolRow}>
          <Text style={styles.poolYes}>YES ${odds.yesPool.toFixed(0)}</Text>
          <Text style={styles.poolTotal}>${odds.totalPool.toFixed(0)} total</Text>
          <Text style={styles.poolNo}>NO ${odds.noPool.toFixed(0)}</Text>
        </View>

        {/* My position */}
        {myPosition && (
          <View style={[styles.myPosition, myPosition.outcome === 'YES' ? styles.posYes : styles.posNo]}>
            <Text style={styles.myPosLabel}>Your position</Text>
            <Text style={styles.myPosValue}>{myPosition.outcome} · ${myPosition.stake}</Text>
            {isSettled && (
              <Text style={styles.myPosResult}>
                {resolution?.outcome === myPosition.outcome ? '🎯 Won' : '📉 Lost'}
              </Text>
            )}
          </View>
        )}

        {/* CTAs */}
        {canStake && (
          <TouchableOpacity style={styles.stakeBtn} onPress={() => setStakeModal(true)}>
            <Text style={styles.stakeBtnText}>Take a position</Text>
          </TouchableOpacity>
        )}

        {(isLocked || isResolving) && canResolve && !resolution && (
          <TouchableOpacity style={styles.resolveBtn} onPress={() => setResolveModal(true)}>
            <Text style={styles.resolveBtnText}>Resolve market</Text>
          </TouchableOpacity>
        )}

        {/* Invite code strip */}
        {(isOpen || isLocked) && market.invite_code && (
          <TouchableOpacity
            style={styles.inviteStrip}
            onPress={() => shareMarketInvite(market.question, market.invite_code)}
            activeOpacity={0.7}
          >
            <Text style={styles.inviteLabel}>Invite code</Text>
            <Text style={styles.inviteCode}>{market.invite_code}</Text>
            <Ionicons name="share-outline" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* Resolution card */}
        {resolution && (
          <View style={styles.resolutionCard}>
            <Text style={styles.resTitle}>
              Resolution: <Text style={resolution.outcome === 'YES' ? styles.yes : styles.no}>{resolution.outcome}</Text>
            </Text>
            {resolution.evidence_url && (
              <Text style={styles.resEvidence}>Evidence: {resolution.evidence_url}</Text>
            )}
            <Text style={styles.resBy}>Resolved by @{resolution.resolver?.username}</Text>

            {disputeOpen && !myDisputeVote && (
              <View style={styles.disputeWrap}>
                <Text style={styles.disputeLabel}>Dispute this resolution? Vote your preferred outcome:</Text>
                <View style={styles.disputeBtns}>
                  <TouchableOpacity style={styles.disputeYes} onPress={() => handleDispute('YES')}>
                    <Text style={styles.disputeBtnText}>YES</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.disputeNo} onPress={() => handleDispute('NO')}>
                    <Text style={styles.disputeBtnText}>NO</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {disputeError ? <Text style={styles.error}>{disputeError}</Text> : null}
            {myDisputeVote && (
              <Text style={styles.disputeVoted}>You voted {myDisputeVote.vote} in the dispute.</Text>
            )}
          </View>
        )}

        {/* Meta */}
        <View style={styles.meta}>
          <Text style={styles.metaItem}>Closes {new Date(market.closes_at).toLocaleDateString()}</Text>
          <Text style={styles.metaItem}>by @{market.creator?.username}</Text>
          <Text style={styles.metaItem}>{market.resolver_type} resolution</Text>
        </View>

        {/* Comments */}
        <Text style={styles.commentsTitle}>Comments ({comments.length})</Text>
        {comments.map(c => (
          <View key={c.id} style={styles.commentRow}>
            <View style={styles.commentMeta}>
              <Text style={styles.commentUser}>@{c.profile?.username}</Text>
              <Text style={styles.commentTime}>
                {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              {c.user_id === user?.id && (
                <TouchableOpacity onPress={() => deleteComment(c.id)}>
                  <Ionicons name="trash-outline" size={13} color={COLORS.textDim} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.commentContent}>{c.content}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Comment input */}
      <View style={styles.commentInput}>
        <TextInput
          style={styles.commentField}
          value={comment}
          onChangeText={setComment}
          placeholder="Add a comment…"
          placeholderTextColor={COLORS.textDim}
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handlePostComment}
        />
        <TouchableOpacity onPress={handlePostComment} disabled={posting || !comment.trim()}>
          <Ionicons name="send" size={20} color={comment.trim() ? COLORS.primary : COLORS.textDim} />
        </TouchableOpacity>
      </View>

      {stakeModal && (
        <StakeModal
          market={market}
          onConfirm={handleStake}
          onClose={() => setStakeModal(false)}
        />
      )}

      {resolveModal && (
        <ResolveModal
          market={market}
          onConfirm={handleResolve}
          onClose={() => setResolveModal(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const STATUS_TEXT: Record<string, string> = {
  open:      COLORS.yes,
  locked:    COLORS.warning,
  resolving: COLORS.primary,
  settled:   COLORS.textMuted,
  voided:    COLORS.no,
};

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.bg },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inner:           { padding: 20, paddingBottom: 40 },
  headerActions:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn:       { padding: 6 },
  badge:           { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  badge_open:      { backgroundColor: '#dcfce7' },
  badge_locked:    { backgroundColor: '#fef3c7' },
  badge_resolving: { backgroundColor: '#ede9fe' },
  badge_settled:   { backgroundColor: '#f0fdf4' },
  badge_voided:    { backgroundColor: '#fee2e2' },
  badgeText:       { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  error:           { color: COLORS.no, fontSize: 13, marginTop: 8 },
  question:        { fontSize: 22, fontWeight: '700', color: COLORS.text, lineHeight: 30, marginBottom: 10 },
  criteria:        { fontSize: 13, color: COLORS.textMuted, lineHeight: 19, marginBottom: 20 },
  poolRow:         { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 20 },
  poolYes:         { color: COLORS.yes, fontWeight: '600', fontSize: 13 },
  poolNo:          { color: COLORS.no, fontWeight: '600', fontSize: 13 },
  poolTotal:       { color: COLORS.textMuted, fontSize: 13 },
  myPosition:      { borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1 },
  posYes:          { backgroundColor: '#f0fdf4', borderColor: COLORS.yes },
  posNo:           { backgroundColor: '#fef2f2', borderColor: COLORS.no },
  myPosLabel:      { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  myPosValue:      { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  myPosResult:     { fontSize: 14, marginTop: 4, fontWeight: '600', color: COLORS.text },
  stakeBtn:        { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  stakeBtnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  resolveBtn:      { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  resolveBtnText:  { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
  inviteStrip:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  inviteLabel:     { color: COLORS.textMuted, fontSize: 12 },
  inviteCode:      { flex: 1, color: COLORS.text, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2, fontSize: 14 },
  resolutionCard:  { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  resTitle:        { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  resEvidence:     { color: COLORS.textMuted, fontSize: 13, marginBottom: 4 },
  resBy:           { color: COLORS.textDim, fontSize: 12 },
  yes:             { color: COLORS.yes },
  no:              { color: COLORS.no },
  disputeWrap:     { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  disputeLabel:    { color: COLORS.textMuted, fontSize: 13, marginBottom: 10 },
  disputeBtns:     { flexDirection: 'row', gap: 10 },
  disputeYes:      { flex: 1, backgroundColor: '#dcfce7', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  disputeNo:       { flex: 1, backgroundColor: '#fee2e2', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  disputeBtnText:  { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  disputeVoted:    { color: COLORS.textMuted, fontSize: 13, marginTop: 10 },
  meta:            { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  metaItem:        { color: COLORS.textDim, fontSize: 12 },
  commentsTitle:   { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  commentRow:      { marginBottom: 14, padding: 12, backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  commentMeta:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  commentUser:     { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  commentTime:     { color: COLORS.textDim, fontSize: 11, flex: 1 },
  commentContent:  { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  commentInput:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  commentField:    { flex: 1, color: COLORS.text, fontSize: 14 },
});
