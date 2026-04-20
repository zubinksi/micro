import { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { COLORS, STAKE_MIN, STAKE_MAX } from '@/lib/constants';
import { getPoolOdds, getPayoutPreview } from '@/utils/pool';
import { ProbabilityBar } from './ProbabilityBar';
import type { Market, Outcome } from '@/lib/types';

interface Props {
  market: Market;
  onConfirm: (outcome: Outcome, amount: number) => Promise<void>;
  onClose: () => void;
}

export function StakeModal({ market, onConfirm, onClose }: Props) {
  const [outcome, setOutcome] = useState<Outcome>('YES');
  const [amount,  setAmount]  = useState('10');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const parsed  = parseFloat(amount);
  const isValid = !isNaN(parsed) && parsed >= STAKE_MIN && parsed <= STAKE_MAX;
  const odds    = getPoolOdds(market);
  const preview = isValid ? getPayoutPreview(market, outcome, parsed) : null;

  const handleConfirm = async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      await onConfirm(outcome, parsed);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>

        <View style={styles.handle} />
        <Text style={styles.title}>Take a position</Text>
        <Text style={styles.question} numberOfLines={2}>{market.question}</Text>

        {/* Current odds */}
        <ProbabilityBar odds={odds} />
        <View style={{ height: 20 }} />

        {/* Outcome picker */}
        <View style={styles.outcomePicker}>
          <TouchableOpacity
            style={[styles.outcomeBtn, outcome === 'YES' && styles.outcomeBtnYes]}
            onPress={() => setOutcome('YES')}
          >
            <Text style={[styles.outcomeBtnText, outcome === 'YES' && styles.outcomeBtnTextYes]}>YES</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.outcomeBtn, outcome === 'NO' && styles.outcomeBtnNo]}
            onPress={() => setOutcome('NO')}
          >
            <Text style={[styles.outcomeBtnText, outcome === 'NO' && styles.outcomeBtnTextNo]}>NO</Text>
          </TouchableOpacity>
        </View>

        {/* Amount input */}
        <Text style={styles.label}>Stake amount (${STAKE_MIN}–${STAKE_MAX})</Text>
        <View style={styles.amountRow}>
          {[5, 10, 25, 50].map(v => (
            <TouchableOpacity key={v} style={styles.quickAmt} onPress={() => setAmount(String(v))}>
              <Text style={styles.quickAmtText}>${v}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="Custom amount"
          placeholderTextColor={COLORS.textDim}
        />

        {/* Payout preview */}
        {preview && (
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>If {outcome} wins:</Text>
            <Text style={styles.previewPayout}>
              ${preview.potentialPayout.toFixed(2)} ({preview.roi >= 0 ? '+' : ''}{(preview.roi * 100).toFixed(0)}% ROI)
            </Text>
            <Text style={styles.previewOdds}>Implied probability: {Math.round(preview.impliedOdds * 100)}%</Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.confirmBtn, (!isValid || loading) && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!isValid || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.confirmBtnText}>
                Stake ${isValid ? parsed.toFixed(2) : '—'} on {outcome}
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:          { flex: 1, backgroundColor: '#000000aa' },
  sheet:             { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  handle:            { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 20 },
  title:             { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  question:          { fontSize: 14, color: COLORS.textMuted, marginBottom: 20, lineHeight: 20 },
  outcomePicker:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  outcomeBtn:        { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 2, borderColor: COLORS.border },
  outcomeBtnYes:     { borderColor: COLORS.yes, backgroundColor: COLORS.yes + '22' },
  outcomeBtnNo:      { borderColor: COLORS.no, backgroundColor: COLORS.no + '22' },
  outcomeBtnText:    { fontSize: 16, fontWeight: '800', color: COLORS.textMuted },
  outcomeBtnTextYes: { color: COLORS.yes },
  outcomeBtnTextNo:  { color: COLORS.no },
  label:             { color: COLORS.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  amountRow:         { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quickAmt:          { flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  quickAmtText:      { color: COLORS.text, fontWeight: '600', fontSize: 13 },
  amountInput:       { backgroundColor: COLORS.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 12, color: COLORS.text, fontSize: 16, marginBottom: 14 },
  preview:           { backgroundColor: COLORS.bg, borderRadius: 10, padding: 14, marginBottom: 16 },
  previewLabel:      { fontSize: 12, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewPayout:     { fontSize: 20, fontWeight: '800', color: COLORS.yes, marginTop: 4 },
  previewOdds:       { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  error:             { color: COLORS.no, fontSize: 13, marginBottom: 10 },
  confirmBtn:        { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  confirmBtnDisabled:{ opacity: 0.5 },
  confirmBtnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn:         { paddingVertical: 10, alignItems: 'center' },
  cancelBtnText:     { color: COLORS.textMuted, fontSize: 14 },
});
