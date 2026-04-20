import { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { COLORS } from '@/lib/constants';
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

        <Text style={styles.label}>Outcome *</Text>
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
          placeholder="https://espn.com/..."
          placeholderTextColor={COLORS.textDim}
          keyboardType="url"
          autoCapitalize="none"
        />

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Participants have {market.resolver_type === 'consensus' ? '48 hours' : 'no window'} to dispute this resolution.
            If &gt;50% dispute, stakes are returned.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
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
  backdrop:          { flex: 1, backgroundColor: '#000000aa' },
  sheet:             { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  handle:            { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 20 },
  title:             { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  question:          { fontSize: 14, color: COLORS.text, fontWeight: '600', marginBottom: 8, lineHeight: 20 },
  criteria:          { fontSize: 13, color: COLORS.textMuted, marginBottom: 20, lineHeight: 18, fontStyle: 'italic' },
  label:             { color: COLORS.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  outcomePicker:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  outcomeBtn:        { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 2, borderColor: COLORS.border },
  outcomeBtnYes:     { borderColor: COLORS.yes, backgroundColor: COLORS.yes + '22' },
  outcomeBtnNo:      { borderColor: COLORS.no, backgroundColor: COLORS.no + '22' },
  outcomeBtnText:    { fontSize: 16, fontWeight: '800', color: COLORS.textMuted },
  outcomeBtnTextYes: { color: COLORS.yes },
  outcomeBtnTextNo:  { color: COLORS.no },
  input:             { backgroundColor: COLORS.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 12, color: COLORS.text, fontSize: 14, marginBottom: 16 },
  warningBox:        { backgroundColor: COLORS.warning + '22', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.warning + '44' },
  warningText:       { color: COLORS.warning, fontSize: 12, lineHeight: 18 },
  error:             { color: COLORS.no, fontSize: 13, marginBottom: 10 },
  confirmBtn:        { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  confirmBtnDisabled:{ opacity: 0.5 },
  confirmBtnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn:         { paddingVertical: 10, alignItems: 'center' },
  cancelBtnText:     { color: COLORS.textMuted, fontSize: 14 },
});
