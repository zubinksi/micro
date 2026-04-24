import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Clipboard,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useMarket, useComments } from '@/hooks/useMarkets';
import { useStake, useResolve } from '@/hooks/usePositions';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, STAKE_MIN, STAKE_MAX, DISPUTE_WINDOW_HOURS } from '@/lib/constants';
import { getPoolOdds } from '@/utils/pool';
import { shareOutcomeCard, shareMarketLink } from '@/utils/share';
import { ProbabilityBar } from '@/components/ProbabilityBar';
import { StakeModal } from '@/components/StakeModal';
import { ResolveModal } from '@/components/ResolveModal';
import { AIJudgeStrip } from '@/components/AIJudgeStrip';
import { AIResolutionCard } from '@/components/AIResolutionCard';
import { SettleTabNotice } from '@/components/SettleTabNotice';
import type { Outcome } from '@/lib/types';

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { market, loading, fetchMarket } = useMarket(id, user?.id);
  const { comments, postComment, deleteComment } = useComments(id);
  const { stake }   = useStake();
  const { resolve, dispute } = useResolve();

  const [stakeModal,   setStakeModal]   = useState(false);
  const [resolveModal, setResolveModal] = useState(false);
  const [comment,      setComment]      = useState('');
  const [posting,      setPosting]      = useState(false);
  const [disputeError, setDisputeError] = useState('');
  const [aiResolving,  setAiResolving]  = useState(false);
  const [aiError,      setAiError]      = useState('');

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

  const handleAiResolve = useCallback(async () => {
    if (!id || !user) return;
    setAiResolving(true);
    setAiError('');
    const { data, error } = await supabase.functions.invoke('resolve-ai', {
      body: { market_id: id },
    });
    setAiResolving(false);
    if (error) {
      // Try to surface the specific error from the function body
      let msg = 'AI resolution failed — try again or resolve manually.';
      try { const body = await (error as any).context?.json?.(); if (body?.error) msg = body.error; } catch {}
      setAiError(msg);
    } else if (data?.outcome === 'UNCERTAIN') {
      setAiError('Claude couldn\'t determine the outcome from available information — resolve manually.');
    } else {
      await fetchMarket();
    }
  }, [id, user, fetchMarket]);

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
  const canResolve  = market.creator_id === user?.id;
  const canStake    = isOpen && !myPosition;

  const disputeDeadline = resolution
    ? new Date(new Date(resolution.created_at).getTime() + DISPUTE_WINDOW_HOURS * 3600_000)
    : null;
  const disputeOpen   = disputeDeadline && disputeDeadline > new Date() && !resolution?.disputed;
  const myDisputeVote = resolution?.dispute_votes?.find(v => v.user_id === user?.id);

  const statusColor = STATUS_COLOR[market.status] ?? COLORS.textMuted;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{
        title: '',
        headerRight: () => (
          <View style={styles.headerActions}>
            {market.invite_code && (
              <TouchableOpacity style={styles.shareBtn} onPress={() => shareMarketLink(market)}>
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            )}
            {isSettled && myPosition && (
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={() => shareOutcomeCard(market, myPosition, resolution?.outcome === myPosition.outcome)}
              >
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            )}
          </View>
        ),
      }} />

      <ScrollView contentContainerStyle={styles.inner}>

        {/* Status tag */}
        <View style={[styles.statusTag, { borderColor: statusColor }]}>
          <Text style={[styles.statusTagText, { color: statusColor }]}>
            {market.status.toUpperCase()}
          </Text>
        </View>

        {/* Question — serif */}
        <Text style={styles.question}>{market.question}</Text>
        <Text style={styles.criteria}>{market.resolution_criteria}</Text>

        {/* Probability */}
        <ProbabilityBar odds={odds} />
        <View style={styles.poolRow}>
          <Text style={styles.poolYes}>YES ${odds.yesPool.toFixed(0)}</Text>
          <Text style={styles.poolTotal}>${odds.totalPool.toFixed(0)} total</Text>
          <Text style={styles.poolNo}>NO ${odds.noPool.toFixed(0)}</Text>
        </View>

        {/* AI Judge strip — open/locked AI markets before resolution */}
        {market.resolver_type === 'ai' && (isOpen || isLocked) && !resolution && (
          <AIJudgeStrip />
        )}

        {/* My position */}
        {myPosition && (
          <View style={[styles.positionCard, myPosition.outcome === 'YES' ? styles.posYes : styles.posNo]}>
            <Text style={styles.posLabel}>Your position</Text>
            <Text style={styles.posValue}>{myPosition.outcome} · ${myPosition.stake}</Text>
            {isSettled && (
              <Text style={styles.posResult}>
                {resolution?.outcome === myPosition.outcome ? '🎯 Won' : '📉 Lost'}
              </Text>
            )}
          </View>
        )}

        {/* Stake CTA */}
        {canStake && (
          <TouchableOpacity style={styles.stakeBtn} onPress={() => setStakeModal(true)}>
            <Text style={styles.stakeBtnText}>Take a position</Text>
          </TouchableOpacity>
        )}

        {/* Settle tab notice — below stake button for open markets */}
        {(isOpen || isLocked) && (
          <SettleTabNotice />
        )}

        {/* Resolve CTAs */}
        {(isLocked || isResolving) && canResolve && !resolution && (
          market.resolver_type === 'ai' ? (
            <View style={styles.resolveWrap}>
              <TouchableOpacity
                style={[styles.resolveBtn, aiResolving && styles.btnDisabled]}
                onPress={handleAiResolve}
                disabled={aiResolving}
              >
                {aiResolving ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <View style={styles.resolveBtnInner}>
                    <Ionicons name="sparkles" size={16} color={COLORS.primary} />
                    <Text style={styles.resolveBtnText}>Resolve with Claude</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.manualBtn} onPress={() => setResolveModal(true)}>
                <Text style={styles.manualBtnText}>Override manually instead</Text>
              </TouchableOpacity>
              {aiError ? <Text style={styles.error}>{aiError}</Text> : null}
            </View>
          ) : (
            <TouchableOpacity style={styles.resolveBtn} onPress={() => setResolveModal(true)}>
              <Text style={styles.resolveBtnText}>Resolve market</Text>
            </TouchableOpacity>
          )
        )}

        {/* Invite strip */}
        {(isOpen || isLocked) && market.invite_code && (
          <View style={styles.inviteStrip}>
            <Text style={styles.inviteLabel}>Invite code</Text>
            <Text style={styles.inviteCode}>{market.invite_code}</Text>
            <TouchableOpacity onPress={() => Clipboard.setString(market.invite_code!)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="copy-outline" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* AI Resolution card — settled AI markets with summary */}
        {resolution && market.resolver_type === 'ai' && isSettled && resolution.summary && (
          <AIResolutionCard
            outcome={resolution.outcome as 'YES' | 'NO'}
            summary={resolution.summary}
          />
        )}

        {/* Standard resolution card — human-resolved or AI without summary */}
        {resolution && !(market.resolver_type === 'ai' && isSettled && resolution.summary) && (
          <View style={styles.resolutionCard}>
            <Text style={styles.resTitle}>
              Resolved{' '}
              <Text style={resolution.outcome === 'YES' ? styles.yesText : styles.noText}>
                {resolution.outcome}
              </Text>
            </Text>
            {resolution.evidence_url && (
              <Text style={styles.resEvidence}>Evidence: {resolution.evidence_url}</Text>
            )}
            <Text style={styles.resBy}>
              by {market.resolver_type === 'ai' ? '🤖 Claude' : `👤 @${resolution.resolver?.username}`}
            </Text>
            {resolution.summary && (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>{resolution.summary}</Text>
              </View>
            )}

            {disputeOpen && !myDisputeVote && (
              <View style={styles.disputeWrap}>
                <Text style={styles.disputeLabel}>Dispute this resolution:</Text>
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
          {isResolving
            ? <Text style={styles.metaItem}>Resolves {resolution ? getResolveTime(resolution.created_at) : 'soon'}</Text>
            : <Text style={styles.metaItem}>Closes {new Date(market.closes_at).toLocaleDateString()}</Text>
          }
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaItem}>by @{market.creator?.username}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaItem}>
            {market.resolver_type === 'ai' ? '🤖 AI Judge' : '👤 Creator decides'}
          </Text>
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
      <View style={styles.commentInputWrap}>
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

function getResolveTime(resolutionCreatedAt: string): string {
  const deadline = new Date(resolutionCreatedAt).getTime() + 48 * 3600_000;
  const diff     = deadline - Date.now();
  if (diff <= 0) return 'shortly';
  const hours = Math.floor(diff / 3600_000);
  const mins  = Math.floor((diff % 3600_000) / 60_000);
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

const STATUS_COLOR: Record<string, string> = {
  open:      COLORS.yes,
  locked:    COLORS.warning,
  resolving: COLORS.primary,
  settled:   COLORS.textMuted,
  voided:    COLORS.no,
};

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.bg },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  inner:          { padding: 20, paddingBottom: 40 },
  headerActions:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shareBtn:       { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: COLORS.primary, borderRadius: 4, marginRight: 4 },
  shareBtnText:   { fontFamily: FONTS.sansBold, color: '#fff', fontSize: 14 },

  statusTag:      { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 2, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 14 },
  statusTagText:  { fontSize: 10, fontFamily: FONTS.sansBold, letterSpacing: 1.2, textTransform: 'uppercase' },

  question:       { fontFamily: FONTS.serif, fontSize: 24, color: COLORS.text, lineHeight: 32, marginBottom: 10 },
  criteria:       { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.textMuted, lineHeight: 19, marginBottom: 20 },

  poolRow:        { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 20 },
  poolYes:        { fontFamily: FONTS.sansMedium, color: COLORS.yes, fontSize: 13 },
  poolNo:         { fontFamily: FONTS.sansMedium, color: COLORS.no, fontSize: 13 },
  poolTotal:      { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 13 },

  positionCard:   { borderRadius: 4, padding: 14, marginBottom: 16, borderWidth: 1 },
  posYes:         { backgroundColor: COLORS.yesLight, borderColor: COLORS.yes },
  posNo:          { backgroundColor: COLORS.noLight,  borderColor: COLORS.no },
  posLabel:       { fontFamily: FONTS.sansMedium, fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  posValue:       { fontFamily: FONTS.sansBold, fontSize: 18, color: COLORS.text, marginTop: 4 },
  posResult:      { fontFamily: FONTS.sansMedium, fontSize: 14, marginTop: 4, color: COLORS.text },

  stakeBtn:       { backgroundColor: COLORS.primary, borderRadius: 4, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  stakeBtnText:   { fontFamily: FONTS.sansBold, color: '#fff', fontSize: 16 },

  resolveWrap:         { marginBottom: 8 },
  resolveBtn:          { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 4, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  btnDisabled:         { opacity: 0.5 },
  resolveBtnInner:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resolveBtnText:      { fontFamily: FONTS.sansBold, color: COLORS.primary, fontSize: 15 },
  manualBtn:           { paddingVertical: 8, alignItems: 'center' },
  manualBtnText:       { fontFamily: FONTS.sans, color: COLORS.textDim, fontSize: 13 },

  inviteStrip:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.surface, borderRadius: 4, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  inviteLabel:    { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 12 },
  inviteCode:     { flex: 1, fontFamily: 'monospace', color: COLORS.text, fontWeight: '700', letterSpacing: 2, fontSize: 14 },

  resolutionCard: { backgroundColor: COLORS.surface, borderRadius: 4, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  resTitle:       { fontFamily: FONTS.sansBold, fontSize: 16, color: COLORS.text, marginBottom: 4 },
  resEvidence:    { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 13, marginBottom: 4 },
  resBy:          { fontFamily: FONTS.sans, color: COLORS.textDim, fontSize: 12, marginBottom: 4 },
  summaryBox:     { marginTop: 10, padding: 10, backgroundColor: COLORS.primaryLight, borderRadius: 4, borderWidth: 1, borderColor: COLORS.primary + '30' },
  summaryText:    { fontFamily: FONTS.sans, color: COLORS.primary, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  yesText:        { color: COLORS.yes },
  noText:         { color: COLORS.no },

  disputeWrap:    { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  disputeLabel:   { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 13, marginBottom: 10 },
  disputeBtns:    { flexDirection: 'row', gap: 10 },
  disputeYes:     { flex: 1, backgroundColor: COLORS.yesLight, borderRadius: 4, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.yes },
  disputeNo:      { flex: 1, backgroundColor: COLORS.noLight,  borderRadius: 4, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.no },
  disputeBtnText: { fontFamily: FONTS.sansBold, color: COLORS.text, fontSize: 14 },
  disputeVoted:   { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 13, marginTop: 10 },

  error:          { fontFamily: FONTS.sans, color: COLORS.no, fontSize: 13, marginTop: 8 },

  meta:           { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 24, alignItems: 'center' },
  metaItem:       { fontFamily: FONTS.sans, color: COLORS.textDim, fontSize: 12 },
  metaDot:        { color: COLORS.textDim, fontSize: 12 },

  commentsTitle:  { fontFamily: FONTS.sansBold, fontSize: 15, color: COLORS.text, marginBottom: 12 },
  commentRow:     { marginBottom: 12, padding: 12, backgroundColor: COLORS.surface, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  commentMeta:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  commentUser:    { fontFamily: FONTS.sansMedium, color: COLORS.primary, fontSize: 13 },
  commentTime:    { fontFamily: FONTS.sans, color: COLORS.textDim, fontSize: 11, flex: 1 },
  commentContent: { fontFamily: FONTS.sans, color: COLORS.text, fontSize: 14, lineHeight: 20 },

  commentInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  commentField:     { flex: 1, fontFamily: FONTS.sans, color: COLORS.text, fontSize: 14 },
});
