import { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { COLORS, FONTS, STAKE_MIN, STAKE_MAX } from '@/lib/constants';
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
            <Text style={styles.previewLabel}>If {outcome} wins</Text>
            <Text style={styles.previewPayout}>
              ${preview.potentialPayout.toFixed(2)}
              <Text style={styles.previewRoi}> ({preview.roi >= 0 ? '+' : ''}{(preview.roi * 100).toFixed(0)}% ROI)</Text>
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
  backdrop:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:             { backgroundColor: COLORS.surface, borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 24, paddingBottom: 40 },
  handle:            { width: 36, height: 3, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 20 },
  title:             { fontFamily: FONTS.serif, fontSize: 22, color: COLORS.text, marginBottom: 6 },
  question:          { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textMuted, marginBottom: 20, lineHeight: 20 },
  outcomePicker:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  outcomeBtn:        { flex: 1, borderRadius: 4, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  outcomeBtnYes:     { borderColor: COLORS.yes, backgroundColor: COLORS.yesLight },
  outcomeBtnNo:      { borderColor: COLORS.no,  backgroundColor: COLORS.noLight },
  outcomeBtnText:    { fontFamily: FONTS.sansBold, fontSize: 15, color: COLORS.textMuted },
  outcomeBtnTextYes: { color: COLORS.yes },
  outcomeBtnTextNo:  { color: COLORS.no },
  label:             { fontFamily: FONTS.sansMedium, color: COLORS.textMuted, fontSize: 12, marginBottom: 10 },
  amountRow:         { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quickAmt:          { flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: 4, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  quickAmtText:      { fontFamily: FONTS.sansMedium, color: COLORS.text, fontSize: 13 },
  amountInput:       { backgroundColor: COLORS.surfaceAlt, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, padding: 12, fontFamily: FONTS.sans, color: COLORS.text, fontSize: 16, marginBottom: 14 },
  preview:           { backgroundColor: COLORS.primaryLight, borderRadius: 4, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.primary + '33' },
  previewLabel:      { fontFamily: FONTS.sansMedium, fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  previewPayout:     { fontFamily: FONTS.sansBold, fontSize: 22, color: COLORS.primary, marginTop: 4 },
  previewRoi:        { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textMuted },
  previewOdds:       { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  error:             { fontFamily: FONTS.sans, color: COLORS.no, fontSize: 13, marginBottom: 10 },
  confirmBtn:        { backgroundColor: COLORS.primary, borderRadius: 4, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  confirmBtnDisabled:{ opacity: 0.5 },
  confirmBtnText:    { fontFamily: FONTS.sansBold, color: '#fff', fontSize: 16 },
  cancelBtn:         { paddingVertical: 10, alignItems: 'center' },
  cancelBtnText:     { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 14 },
});
