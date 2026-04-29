import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useMarket, useComments } from '@/hooks/useMarkets';
import { useStake, useResolve } from '@/hooks/usePositions';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, DISPUTE_WINDOW_HOURS } from '@/lib/constants';
import { getPoolOdds } from '@/utils/pool';
import { StakeModal } from '@/components/StakeModal';
import { ResolveModal } from '@/components/ResolveModal';
import { AIJudgeStrip } from '@/components/AIJudgeStrip';
import { AIResolutionCard } from '@/components/AIResolutionCard';
import { SettleTabNotice } from '@/components/SettleTabNotice';
import type { Outcome } from '@/lib/types';

const AVATAR_COLORS = ['#C8D8C0', '#C0CCD8', '#D8CCC0', '#D0C0D8', '#C0D4D0', '#D8C8C0'];
function avatarColor(id: string) {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function getTimeLeft(closesAt: string) {
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const days  = Math.floor(diff / 86400_000);
  const hours = Math.floor((diff % 86400_000) / 3600_000);
  const mins  = Math.floor((diff % 3600_000) / 60_000);
  if (days > 1) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

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
  const [aiResult,     setAiResult]     = useState<{ outcome: 'YES' | 'NO'; summary: string } | null>(null);

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
      let msg = error.message || 'AI resolution failed — try again or resolve manually.';
      try {
        const body = await (error as any).context?.json?.();
        if (body?.error) msg = body.error;
      } catch {}
      console.error('[resolve-ai]', msg, error);
      setAiError(msg);
    } else if (data?.outcome === 'UNCERTAIN') {
      setAiError(data.message ?? 'Claude couldn\'t determine the outcome — add a reference URL to the market or resolve manually.');
    } else if (data?.outcome === 'YES' || data?.outcome === 'NO') {
      setAiResult({ outcome: data.outcome, summary: data.summary ?? '' });
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
  const yesPct      = odds.totalPool === 0 ? 50 : Math.round(odds.yesProb * 100);
  const noPct       = 100 - yesPct;
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
        title: 'Market',
        headerShadowVisible: true,
        headerLeft: () => (
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => router.push(`/markets/share?id=${id}&outcome=${myPosition?.outcome ?? ''}&stake=${myPosition?.stake ?? ''}`)}
          >
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        ),
      }} />

      <ScrollView contentContainerStyle={styles.inner}>

        {/* Market summary card */}
        <View style={styles.marketCard}>
          <View style={[styles.statusPill, { borderColor: statusColor }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>
              {market.status.toUpperCase()}
            </Text>
          </View>

          <Text style={styles.question}>{market.question}</Text>

          <View style={styles.creatorRow}>
            <View style={[styles.creatorAvatar, { backgroundColor: avatarColor(market.creator_id) }]}>
              <Text style={styles.creatorInitials}>
                {(market.creator?.username ?? '??').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.creatorText}>
              by <Text style={styles.creatorBold}>{market.creator?.username}</Text>
              {' · '}{getTimeLeft(market.closes_at)} left
            </Text>
          </View>

          <View style={styles.oddsRow}>
            <Text style={styles.yesLabel}>YES {yesPct}%</Text>
            <Text style={styles.noLabel}>NO {noPct}%</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barYes, { flex: yesPct }]} />
            <View style={[styles.barNo,  { flex: noPct }]} />
          </View>

          <View style={styles.poolRow}>
            <Text style={styles.poolSide}>${odds.yesPool.toFixed(0)} on YES</Text>
            <Text style={styles.poolCenter}>${odds.totalPool.toFixed(0)} total pot</Text>
            <Text style={styles.poolSide}>${odds.noPool.toFixed(0)} on NO</Text>
          </View>
        </View>

        <Text style={styles.criteria}>{market.resolution_criteria}</Text>

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

        {/* Resolve CTAs — only for locked markets; once resolving the button disappears */}
        {isLocked && canResolve && !resolution && (
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
              {aiError ? (
                <View style={styles.aiErrorBox}>
                  <Text style={styles.aiErrorText}>{aiError}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <TouchableOpacity style={styles.resolveBtn} onPress={() => setResolveModal(true)}>
              <Text style={styles.resolveBtnText}>Resolve market</Text>
            </TouchableOpacity>
          )
        )}

        {/* Post-resolve countdown */}
        {isResolving && (
          <View style={styles.resolveCountdown}>
            <Ionicons name="time-outline" size={15} color={COLORS.primary} />
            <Text style={styles.resolveCountdownText}>
              {resolution
                ? `Settles ${getResolveTime(resolution.created_at)}`
                : 'Resolution submitted — settling soon'}
            </Text>
          </View>
        )}


        {/* AI Resolution card — from live function response (before RLS lets us read it back),
            or from DB once settled */}
        {market.resolver_type === 'ai' && (aiResult || (resolution && resolution.summary)) && (
          <AIResolutionCard
            outcome={(aiResult?.outcome ?? resolution?.outcome) as 'YES' | 'NO'}
            summary={aiResult?.summary ?? resolution?.summary ?? ''}
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

        {/* Activity feed — bets + comments interleaved */}
        {(() => {
          const bets = (market.positions ?? []).map(p => ({ type: 'bet' as const, id: p.id, ts: p.filled_at, data: p }));
          const msgs = comments.map(c => ({ type: 'comment' as const, id: c.id, ts: c.created_at, data: c }));
          const feed = [...bets, ...msgs].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
          return (
            <>
              <Text style={styles.commentsTitle}>Activity ({feed.length})</Text>
              {feed.map(item => {
                const username = item.data.profile?.username ?? '';

                if (item.type === 'bet') {
                  const isYes = item.data.outcome === 'YES';
                  return (
                    <View key={`bet-${item.id}`} style={[styles.activityCard, styles.betCard]}>
                      <View style={[styles.betAccent, isYes ? styles.accentYes : styles.accentNo]} />
                      <View style={styles.activityInner}>
                        <View style={styles.activityMeta}>
                          <Text style={styles.activityName}>{username}</Text>
                          <Text style={styles.activityTime}>{fmtTime(item.ts)}</Text>
                        </View>
                        <View style={styles.betDetails}>
                          <Text style={styles.betLabel}>bet</Text>
                          <View style={[styles.outcomePill, isYes ? styles.pillYes : styles.pillNo]}>
                            <Text style={[styles.outcomePillText, isYes ? styles.pillTextYes : styles.pillTextNo]}>
                              {item.data.outcome}
                            </Text>
                          </View>
                          <Text style={styles.betAmount}>· ${item.data.stake}</Text>
                        </View>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={`comment-${item.id}`} style={styles.activityCard}>
                    <View style={styles.activityInner}>
                      <View style={styles.activityMeta}>
                        <Text style={styles.activityName}>@{username}</Text>
                        <Text style={styles.activityTime}>{fmtTime(item.ts)}</Text>
                        {item.data.user_id === user?.id && (
                          <TouchableOpacity onPress={() => deleteComment(item.data.id)}>
                            <Ionicons name="trash-outline" size={13} color={COLORS.textDim} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.commentContent}>{item.data.content}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          );
        })()}
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

function fmtTime(ts: string): string {
  const diff  = Date.now() - new Date(ts).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3600_000);
  const days  = Math.floor(diff / 86400_000);
  if (mins < 1)  return 'just now';
  if (hours < 1) return `${mins}m ago`;
  if (days < 1)  return `${hours}h ago`;
  return `${days}d ago`;
}

function getResolveTime(resolutionCreatedAt: string): string {
  const deadline = new Date(resolutionCreatedAt).getTime() + DISPUTE_WINDOW_HOURS * 3600_000;
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
  inner:          { padding: 16, paddingBottom: 40 },

  backBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  shareBtn:       { paddingHorizontal: 18, paddingVertical: 8, backgroundColor: COLORS.warning, borderRadius: 99, marginRight: 16 },
  shareBtnText:   { fontFamily: FONTS.sansBold, color: '#1A1A1A', fontSize: 14 },

  marketCard:     { backgroundColor: COLORS.surface, borderRadius: 22, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
  statusPill:     { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 12 },
  statusPillText: { fontSize: 10, fontFamily: FONTS.sansBold, letterSpacing: 1.2, textTransform: 'uppercase' },
  question:       { fontFamily: FONTS.serif, fontSize: 22, color: COLORS.text, lineHeight: 30, marginBottom: 12 },
  creatorRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  creatorAvatar:  { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  creatorInitials:{ fontSize: 9, fontFamily: FONTS.sansBold, color: COLORS.text },
  creatorText:    { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.textMuted },
  creatorBold:    { fontFamily: FONTS.sansBold, color: COLORS.text },
  oddsRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  yesLabel:       { fontSize: 13, fontFamily: FONTS.sansBold, color: COLORS.yes },
  noLabel:        { fontSize: 13, fontFamily: FONTS.sansBold, color: COLORS.no },
  barTrack:       { flexDirection: 'row', height: 10, borderRadius: 99, overflow: 'hidden', backgroundColor: COLORS.noLight, marginBottom: 12 },
  barYes:         { backgroundColor: COLORS.yes },
  barNo:          { backgroundColor: COLORS.no },
  poolRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  poolSide:       { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textMuted },
  poolCenter:     { fontFamily: FONTS.sansBold, fontSize: 13, color: COLORS.text },

  criteria:       { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.textMuted, lineHeight: 19, marginBottom: 16 },

  positionCard:   { borderRadius: 16, padding: 14, marginBottom: 16 },
  posYes:         { backgroundColor: COLORS.yesLight },
  posNo:          { backgroundColor: COLORS.noLight },
  posLabel:       { fontFamily: FONTS.sansMedium, fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  posValue:       { fontFamily: FONTS.sansBold, fontSize: 18, color: COLORS.text, marginTop: 4 },
  posResult:      { fontFamily: FONTS.sansMedium, fontSize: 14, marginTop: 4, color: COLORS.text },

  stakeBtn:       { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  stakeBtnText:   { fontFamily: FONTS.sansBold, color: '#fff', fontSize: 16 },

  resolveWrap:         { marginBottom: 8 },
  resolveBtn:          { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  btnDisabled:         { opacity: 0.5 },
  resolveBtnInner:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resolveBtnText:      { fontFamily: FONTS.sansBold, color: COLORS.primary, fontSize: 15 },
  manualBtn:           { paddingVertical: 8, alignItems: 'center' },
  manualBtnText:       { fontFamily: FONTS.sans, color: COLORS.textDim, fontSize: 13 },

  resolveCountdown:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, marginBottom: 8 },
  resolveCountdownText: { fontFamily: FONTS.sansMedium, fontSize: 14, color: COLORS.primary },


  resolutionCard: { backgroundColor: COLORS.surface, borderRadius: 22, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
  resTitle:       { fontFamily: FONTS.sansBold, fontSize: 16, color: COLORS.text, marginBottom: 4 },
  resEvidence:    { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 13, marginBottom: 4 },
  resBy:          { fontFamily: FONTS.sans, color: COLORS.textDim, fontSize: 12, marginBottom: 4 },
  summaryBox:     { marginTop: 10, padding: 10, backgroundColor: COLORS.primaryLight, borderRadius: 12 },
  summaryText:    { fontFamily: FONTS.sans, color: COLORS.primary, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  yesText:        { color: COLORS.yes },
  noText:         { color: COLORS.no },

  disputeWrap:    { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  disputeLabel:   { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 13, marginBottom: 10 },
  disputeBtns:    { flexDirection: 'row', gap: 10 },
  disputeYes:     { flex: 1, backgroundColor: COLORS.yesLight, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  disputeNo:      { flex: 1, backgroundColor: COLORS.noLight,  borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  disputeBtnText: { fontFamily: FONTS.sansBold, color: COLORS.text, fontSize: 14 },
  disputeVoted:   { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 13, marginTop: 10 },

  error:          { fontFamily: FONTS.sans, color: COLORS.no, fontSize: 13, marginTop: 8 },
  aiErrorBox:     { backgroundColor: COLORS.noLight, borderWidth: 1, borderColor: COLORS.no + '50', borderRadius: 8, padding: 12, marginTop: 8 },
  aiErrorText:    { fontFamily: FONTS.sans, color: COLORS.no, fontSize: 13, lineHeight: 19 },

  meta:           { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 24, alignItems: 'center' },
  metaItem:       { fontFamily: FONTS.sans, color: COLORS.textDim, fontSize: 12 },
  metaDot:        { color: COLORS.textDim, fontSize: 12 },

  commentsTitle:      { fontFamily: FONTS.sansBold, fontSize: 11, color: COLORS.textMuted, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 10 },

  activityCard:       { backgroundColor: COLORS.surface, borderRadius: 14, marginBottom: 8, overflow: 'hidden' },
  betCard:            { flexDirection: 'row' },
  betAccent:          { width: 3 },
  accentYes:          { backgroundColor: COLORS.yes },
  accentNo:           { backgroundColor: COLORS.no },
  activityInner:      { flex: 1, padding: 12 },
  activityMeta:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  activityName:       { fontFamily: FONTS.sansBold, fontSize: 13, color: COLORS.text },
  activityTime:       { flex: 1, fontFamily: FONTS.sans, fontSize: 11, color: COLORS.textDim },

  betDetails:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  betLabel:           { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.textMuted },
  outcomePill:        { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  pillYes:            { backgroundColor: COLORS.yesLight },
  pillNo:             { backgroundColor: COLORS.noLight },
  outcomePillText:    { fontFamily: FONTS.sansBold, fontSize: 12 },
  pillTextYes:        { color: COLORS.yes },
  pillTextNo:         { color: COLORS.no },
  betAmount:          { fontFamily: FONTS.sansBold, fontSize: 13, color: COLORS.text },

  commentContent:     { fontFamily: FONTS.sans, color: COLORS.text, fontSize: 14, lineHeight: 20 },

  commentInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  commentField:     { flex: 1, fontFamily: FONTS.sans, color: COLORS.text, fontSize: 14 },
});
