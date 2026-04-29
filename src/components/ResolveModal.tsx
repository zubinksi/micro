import { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { COLORS, FONTS, DISPUTE_WINDOW_HOURS } from '@/lib/constants';
import type { Market, Outcome } from '@/lib/types';

interface Props {
  market: Market;
  onConfirm: (outcome: Outcome, evidenceUrl?: string) => Promise<void>;
  onClose: () => void;
}

export function ResolveModal({ market, onConfirm, onClose }: Props) {
  const [outcome,     setOutcome]     = useState<Outcome>('YES');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      await onConfirm(outcome, evidenceUrl.trim() || undefined);
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
        <Text style={styles.title}>Resolve market</Text>
        <Text style={styles.question} numberOfLines={2}>{market.question}</Text>

        <Text style={styles.criteria}>{market.resolution_criteria}</Text>

        <Text style={styles.label}>Outcome</Text>
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

        <Text style={styles.label}>Evidence URL (optional)</Text>
        <TextInput
          style={styles.input}
          value={evidenceUrl}
          onChangeText={setEvidenceUrl}
          placeholder="https://..."
          placeholderTextColor={COLORS.textDim}
          keyboardType="url"
          autoCapitalize="none"
        />

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Participants have {DISPUTE_WINDOW_HOURS} hours to dispute this resolution.
            If &gt;50% dispute, stakes are returned.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.confirmBtn, loading && styles.btnDisabled]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.confirmBtnText}>Resolve as {outcome}</Text>
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
  sheet:             { backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  handle:            { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 20 },
  title:             { fontFamily: FONTS.serif, fontSize: 22, color: COLORS.text, marginBottom: 6 },
  question:          { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.text, fontWeight: '600', marginBottom: 8, lineHeight: 20 },
  criteria:          { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.textMuted, marginBottom: 20, lineHeight: 18, fontStyle: 'italic' },
  label:             { fontFamily: FONTS.sansMedium, color: COLORS.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  outcomePicker:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  outcomeBtn:        { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  outcomeBtnYes:     { borderColor: COLORS.yes, backgroundColor: COLORS.yesLight },
  outcomeBtnNo:      { borderColor: COLORS.no,  backgroundColor: COLORS.noLight },
  outcomeBtnText:    { fontFamily: FONTS.sansBold, fontSize: 15, color: COLORS.textMuted },
  outcomeBtnTextYes: { color: COLORS.yes },
  outcomeBtnTextNo:  { color: COLORS.no },
  input:             { backgroundColor: COLORS.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 12, fontFamily: FONTS.sans, color: COLORS.text, fontSize: 14, marginBottom: 16 },
  warningBox:        { backgroundColor: COLORS.warning + '18', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.warning + '44' },
  warningText:       { fontFamily: FONTS.sans, color: COLORS.warning, fontSize: 12, lineHeight: 18 },
  error:             { fontFamily: FONTS.sans, color: COLORS.no, fontSize: 13, marginBottom: 10 },
  confirmBtn:        { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  btnDisabled:       { opacity: 0.5 },
  confirmBtnText:    { fontFamily: FONTS.sansBold, color: '#fff', fontSize: 16 },
  cancelBtn:         { paddingVertical: 10, alignItems: 'center' },
  cancelBtnText:     { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 14 },
});
