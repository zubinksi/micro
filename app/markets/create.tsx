import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { COLORS, STAKE_MAX, STAKE_MIN } from '@/lib/constants';
import type { ResolverType } from '@/lib/types';

const RESOLVER_OPTIONS: { value: ResolverType; label: string; desc: string }[] = [
  { value: 'consensus', label: 'Consensus', desc: 'Majority vote among participants' },
  { value: 'autocrat',  label: 'Creator decides', desc: 'You resolve it unilaterally' },
  { value: 'oracle',    label: 'Oracle / link', desc: 'Point to an external data source' },
];

export default function CreateMarketScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();

  const [question, setQuestion]     = useState('');
  const [criteria, setCriteria]     = useState('');
  const [closesAt, setClosesAt]     = useState('');
  const [resolverType, setResolver] = useState<ResolverType>('consensus');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const isValid = question.trim().length >= 10 && criteria.trim().length >= 10 && closesAt.trim().length > 0;

  const handleCreate = async () => {
    if (!user || !groupId) return;

    const closeDate = new Date(closesAt);
    if (isNaN(closeDate.getTime()) || closeDate <= new Date()) {
      setError('Closing date must be in the future.');
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: err } = await supabase
      .from('markets')
      .insert({
        group_id:            groupId,
        creator_id:          user.id,
        question:            question.trim(),
        resolution_criteria: criteria.trim(),
        closes_at:           closeDate.toISOString(),
        resolver_type:       resolverType,
        resolver_id:         resolverType === 'autocrat' ? user.id : null,
      })
      .select('id')
      .single();

    setLoading(false);

    if (err) { setError(err.message); return; }
    if (data) router.replace(`/markets/${data.id}`);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.label}>Question *</Text>
        <TextInput
          style={styles.input}
          value={question}
          onChangeText={setQuestion}
          placeholder="Will the Celtics win the championship?"
          placeholderTextColor={COLORS.textDim}
          multiline
          maxLength={200}
          autoFocus
        />
        <Text style={styles.charCount}>{question.length}/200</Text>

        <Text style={styles.label}>Resolution criteria *</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={criteria}
          onChangeText={setCriteria}
          placeholder="Resolves YES if the Celtics win the 2026 NBA Finals per ESPN."
          placeholderTextColor={COLORS.textDim}
          multiline
          maxLength={400}
        />
        <Text style={styles.hint}>Be specific. Ambiguity causes disputes.</Text>

        <Text style={styles.label}>Closes at (YYYY-MM-DD HH:MM) *</Text>
        <TextInput
          style={styles.input}
          value={closesAt}
          onChangeText={setClosesAt}
          placeholder="2026-06-15 23:59"
          placeholderTextColor={COLORS.textDim}
        />

        <Text style={styles.label}>Resolution method *</Text>
        {RESOLVER_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.resolverOption, resolverType === opt.value && styles.resolverSelected]}
            onPress={() => setResolver(opt.value)}
          >
            <View style={styles.resolverLeft}>
              <Text style={[styles.resolverLabel, resolverType === opt.value && styles.resolverLabelActive]}>
                {opt.label}
              </Text>
              <Text style={styles.resolverDesc}>{opt.desc}</Text>
            </View>
            {resolverType === opt.value && <View style={styles.dot} />}
          </TouchableOpacity>
        ))}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Stakes range ${STAKE_MIN}–${STAKE_MAX} per participant. Pool odds update live as friends join.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (!isValid || loading) && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={!isValid || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Create market</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: COLORS.bg },
  inner:               { padding: 20, paddingBottom: 48 },
  label:               { color: COLORS.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 20 },
  input:               { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text },
  multiline:           { minHeight: 90, textAlignVertical: 'top' },
  charCount:           { color: COLORS.textDim, fontSize: 11, textAlign: 'right', marginTop: 4 },
  hint:                { color: COLORS.textDim, fontSize: 12, marginTop: 6, marginBottom: 4 },
  resolverOption:      { backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center' },
  resolverSelected:    { borderColor: COLORS.primary },
  resolverLeft:        { flex: 1 },
  resolverLabel:       { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  resolverLabelActive: { color: COLORS.primary },
  resolverDesc:        { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  dot:                 { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  infoBox:             { backgroundColor: COLORS.surfaceAlt, borderRadius: 10, padding: 12, marginTop: 20 },
  infoText:            { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },
  error:               { color: COLORS.no, marginTop: 12, fontSize: 13 },
  btn:                 { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnDisabled:         { opacity: 0.5 },
  btnText:             { color: '#fff', fontWeight: '700', fontSize: 16 },
});
