import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS } from '@/lib/constants';
import type { ResolverType } from '@/lib/types';

// ─── Duration presets ────────────────────────────────────────────────────────

type DurationPreset = '12h' | '24h' | '48h' | 'custom';

const DURATION_OPTIONS: { value: DurationPreset; label: string }[] = [
  { value: '12h', label: '12 hrs' },
  { value: '24h', label: '24 hrs' },
  { value: '48h', label: '48 hrs' },
  { value: 'custom', label: 'Custom' },
];

function getPresetDate(preset: Exclude<DurationPreset, 'custom'>): Date {
  const now = new Date();
  const offsets: Record<string, number> = { '12h': 12, '24h': 24, '48h': 48 };
  return new Date(now.getTime() + offsets[preset] * 3_600_000);
}

// ─── Resolver options ─────────────────────────────────────────────────────────

const RESOLVER_OPTIONS: { value: ResolverType; label: string; desc: string; emoji: string }[] = [
  { value: 'autocrat', label: 'Me',       emoji: '👤', desc: 'You call it when done' },
  { value: 'ai',       label: 'AI Judge', emoji: '🤖', desc: 'Claude reads the outcome' },
];

// ─── Simple calendar picker ───────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];

interface CalendarProps {
  value: Date;
  onChange: (d: Date) => void;
  onClose: () => void;
}

function CalendarPicker({ value, onChange, onClose }: CalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year,  setYear]  = useState(value.getFullYear());
  const [month, setMonth] = useState(value.getMonth());

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const totalCells   = firstWeekday + daysInMonth;
  const rows: (number | null)[][] = [];
  let row: (number | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    row.push(i < firstWeekday ? null : i - firstWeekday + 1);
    if (row.length === 7 || i === totalCells - 1) {
      while (row.length < 7) row.push(null);
      rows.push([...row]);
      row = [];
    }
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={cal.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={cal.card}>
          <View style={cal.header}>
            <TouchableOpacity onPress={prevMonth} style={cal.navBtn}>
              <Ionicons name="chevron-back" size={20} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={cal.monthYear}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={cal.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={cal.dayNames}>
            {DAY_NAMES.map(d => (
              <Text key={d} style={cal.dayName}>{d}</Text>
            ))}
          </View>

          {rows.map((r, ri) => (
            <View key={ri} style={cal.row}>
              {r.map((day, di) => {
                if (day === null) return <View key={di} style={cal.cell} />;
                const date = new Date(year, month, day);
                date.setHours(23, 59, 0, 0);
                const isPast = date < today;
                const isSelected =
                  value.getDate() === day &&
                  value.getMonth() === month &&
                  value.getFullYear() === year;
                return (
                  <TouchableOpacity
                    key={di}
                    style={[cal.cell, isSelected && cal.selectedCell, isPast && cal.pastCell]}
                    onPress={() => { if (!isPast) { onChange(date); onClose(); } }}
                    disabled={isPast}
                    activeOpacity={0.7}
                  >
                    <Text style={[cal.dayNum, isSelected && cal.selectedNum, isPast && cal.pastNum]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <TouchableOpacity style={cal.closeBtn} onPress={onClose}>
            <Text style={cal.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CreateMarketScreen() {
  const { user } = useAuth();

  const [question,     setQuestion]  = useState('');
  const [criteria,     setCriteria]  = useState('');
  const [duration,     setDuration]  = useState<DurationPreset>('24h');
  const [customDate,   setCustomDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(23, 59, 0, 0);
    return d;
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [resolverType, setResolver]  = useState<ResolverType>('autocrat');
  const [refUrls,      setRefUrls]   = useState<string[]>(['']);
  const [loading,      setLoading]   = useState(false);
  const [error,        setError]     = useState('');

  const closesAt = duration === 'custom' ? customDate : getPresetDate(duration as Exclude<DurationPreset, 'custom'>);
  const isValid  = question.trim().length >= 10 && criteria.trim().length >= 10;

  const addRefUrl    = () => setRefUrls(prev => [...prev, '']);
  const updateRefUrl = (i: number, val: string) =>
    setRefUrls(prev => prev.map((u, idx) => idx === i ? val : u));
  const removeRefUrl = (i: number) =>
    setRefUrls(prev => prev.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    if (!user || !isValid) return;

    setLoading(true);
    setError('');

    const cleanUrls = refUrls.map(u => u.trim()).filter(Boolean);

    const { data, error: err } = await supabase
      .from('markets')
      .insert({
        creator_id:          user.id,
        question:            question.trim(),
        resolution_criteria: criteria.trim(),
        closes_at:           closesAt.toISOString(),
        resolver_type:       resolverType,
        resolver_id:         resolverType === 'autocrat' ? user.id : null,
        reference_urls:      cleanUrls.length > 0 ? cleanUrls : null,
      })
      .select('id, invite_code')
      .single();

    setLoading(false);

    if (err) { setError(err.message); return; }
    if (data) router.replace(`/markets/${data.id}`);
  };

  const formatCustomDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Question</Text>
        <TextInput
          style={styles.input}
          value={question}
          onChangeText={setQuestion}
          placeholder="Will this happen?"
          placeholderTextColor={COLORS.textDim}
          multiline
          maxLength={200}
          autoFocus
        />

        <Text style={styles.label}>Resolution criteria</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={criteria}
          onChangeText={setCriteria}
          placeholder="Resolves YES if...."
          placeholderTextColor={COLORS.textDim}
          multiline
          maxLength={400}
        />

        {/* Duration presets */}
        <Text style={styles.label}>Market duration</Text>
        <View style={styles.durationRow}>
          {DURATION_OPTIONS.map(opt => {
            const active = duration === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.durationBtn, active && styles.durationBtnActive]}
                onPress={() => {
                  setDuration(opt.value);
                  if (opt.value === 'custom') setShowCalendar(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.durationBtnText, active && styles.durationBtnTextActive]}>
                  {opt.value === 'custom' && duration === 'custom'
                    ? formatCustomDate(customDate)
                    : opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Resolution method — WHO DECIDES? */}
        <Text style={styles.label}>Who decides?</Text>
        <View style={styles.resolverRow}>
          {RESOLVER_OPTIONS.map(opt => {
            const active = resolverType === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.resolverCard, active && styles.resolverCardActive]}
                onPress={() => setResolver(opt.value)}
                activeOpacity={0.75}
              >
                <Text style={styles.resolverEmoji}>{opt.emoji}</Text>
                <Text style={[styles.resolverLabel, active && styles.resolverLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={styles.resolverDesc}>{opt.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {resolverType === 'ai' && (
          <View style={styles.refSection}>
            <Text style={styles.refLabel}>Reference links</Text>
            <Text style={styles.refHint}>
              Claude will read these pages to determine the outcome — use direct links to results or news articles.
            </Text>
            {refUrls.map((url, i) => (
              <View key={i} style={styles.refRow}>
                <TextInput
                  style={styles.refInput}
                  value={url}
                  onChangeText={v => updateRefUrl(i, v)}
                  placeholder="https://espn.com/..."
                  placeholderTextColor={COLORS.textDim}
                  keyboardType="url"
                  autoCapitalize="none"
                />
                {refUrls.length > 1 && (
                  <TouchableOpacity onPress={() => removeRefUrl(i)}>
                    <Ionicons name="close-circle" size={20} color={COLORS.textDim} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={styles.addRefBtn} onPress={addRefUrl}>
              <Ionicons name="add" size={16} color={COLORS.primary} />
              <Text style={styles.addRefText}>Add another link</Text>
            </TouchableOpacity>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (!isValid || loading) && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={!isValid || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Create Market</Text>
          }
        </TouchableOpacity>

      </ScrollView>

      {showCalendar && (
        <CalendarPicker
          value={customDate}
          onChange={(d) => { setCustomDate(d); setDuration('custom'); }}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:             { flex: 1, backgroundColor: COLORS.bg },
  inner:                 { padding: 20, paddingBottom: 48 },
  label:                 { fontFamily: FONTS.sansBold, color: COLORS.textMuted, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 20 },
  input:                 { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 2, borderRadius: 16, padding: 14, fontSize: 16, fontFamily: FONTS.sans, color: COLORS.text },
  multiline:             { minHeight: 80, textAlignVertical: 'top' },
  durationRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationBtn:           { borderRadius: 99, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  durationBtnActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  durationBtnText:       { fontFamily: FONTS.sansMedium, fontSize: 13, color: COLORS.textMuted },
  durationBtnTextActive: { color: '#fff' },
  resolverRow:           { flexDirection: 'row', gap: 10 },
  resolverCard:          { flex: 1, backgroundColor: COLORS.surface, borderRadius: 18, padding: 16, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', gap: 6 },
  resolverCardActive:    { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  resolverEmoji:         { fontSize: 28 },
  resolverLabel:         { fontFamily: FONTS.sansBold, color: COLORS.text, fontSize: 15 },
  resolverLabelActive:   { color: COLORS.primary },
  resolverDesc:          { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },
  refSection:            { marginTop: 16, backgroundColor: COLORS.surfaceAlt, borderRadius: 16, padding: 14 },
  refLabel:              { fontFamily: FONTS.sansMedium, color: COLORS.text, fontSize: 14, marginBottom: 4 },
  refHint:               { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  refRow:                { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  refInput:              { flex: 1, backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 10, padding: 10, fontFamily: FONTS.sans, fontSize: 16, color: COLORS.text },
  addRefBtn:             { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  addRefText:            { fontFamily: FONTS.sansMedium, color: COLORS.primary, fontSize: 13 },
  error:                 { fontFamily: FONTS.sans, color: COLORS.no, marginTop: 12, fontSize: 13 },
  btn:                   { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 28 },
  btnDisabled:           { opacity: 0.4 },
  btnText:               { fontFamily: FONTS.sansBold, color: '#fff', fontSize: 16 },
});

// ─── Calendar styles ──────────────────────────────────────────────────────────

const cal = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  card:         { backgroundColor: COLORS.surface, borderRadius: 4, padding: 20, width: 320, maxWidth: '90%' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn:       { padding: 6 },
  monthYear:    { fontFamily: FONTS.sansBold, fontSize: 16, color: COLORS.text },
  dayNames:     { flexDirection: 'row', marginBottom: 4 },
  dayName:      { flex: 1, textAlign: 'center', fontFamily: FONTS.sansMedium, fontSize: 11, color: COLORS.textMuted },
  row:          { flexDirection: 'row' },
  cell:         { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', margin: 1, borderRadius: 2 },
  selectedCell: { backgroundColor: COLORS.primary },
  pastCell:     { opacity: 0.3 },
  dayNum:       { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.text },
  selectedNum:  { color: '#fff', fontFamily: FONTS.sansBold },
  pastNum:      { color: COLORS.textDim },
  closeBtn:     { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  closeBtnText: { fontFamily: FONTS.sansMedium, color: COLORS.textMuted, fontSize: 14 },
});
