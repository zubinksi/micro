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
import { COLORS, STAKE_MAX, STAKE_MIN } from '@/lib/constants';
import type { ResolverType } from '@/lib/types';

// ─── Duration presets ────────────────────────────────────────────────────────

type DurationPreset = '24h' | '48h' | '72h' | '1w' | 'custom';

const DURATION_OPTIONS: { value: DurationPreset; label: string }[] = [
  { value: '24h', label: '24 hrs' },
  { value: '48h', label: '48 hrs' },
  { value: '72h', label: '72 hrs' },
  { value: '1w',  label: '1 week' },
  { value: 'custom', label: 'Custom' },
];

function getPresetDate(preset: Exclude<DurationPreset, 'custom'>): Date {
  const now = new Date();
  const offsets: Record<string, number> = { '24h': 24, '48h': 48, '72h': 72, '1w': 168 };
  return new Date(now.getTime() + offsets[preset] * 3_600_000);
}

// ─── Resolver options ─────────────────────────────────────────────────────────

const RESOLVER_OPTIONS: { value: ResolverType; label: string; desc: string }[] = [
  { value: 'consensus', label: 'Consensus',       desc: 'Majority vote among participants' },
  { value: 'autocrat',  label: 'Creator decides', desc: 'You resolve it unilaterally' },
  { value: 'oracle',    label: 'Oracle / link',   desc: 'Point to an external data source' },
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
          {/* Header */}
          <View style={cal.header}>
            <TouchableOpacity onPress={prevMonth} style={cal.navBtn}>
              <Ionicons name="chevron-back" size={20} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={cal.monthYear}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={cal.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Day name row */}
          <View style={cal.dayNames}>
            {DAY_NAMES.map(d => (
              <Text key={d} style={cal.dayName}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
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
  const [resolverType, setResolver]  = useState<ResolverType>('consensus');
  const [loading,      setLoading]   = useState(false);
  const [error,        setError]     = useState('');

  const closesAt = duration === 'custom' ? customDate : getPresetDate(duration as Exclude<DurationPreset, 'custom'>);
  const isValid  = question.trim().length >= 10 && criteria.trim().length >= 10;

  const handleCreate = async () => {
    if (!user || !isValid) return;

    setLoading(true);
    setError('');

    const { data, error: err } = await supabase
      .from('markets')
      .insert({
        creator_id:          user.id,
        question:            question.trim(),
        resolution_criteria: criteria.trim(),
        closes_at:           closesAt.toISOString(),
        resolver_type:       resolverType,
        resolver_id:         resolverType === 'autocrat' ? user.id : null,
      })
      .select('id')
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
          placeholder="That this will happen..."
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

        {/* Resolution method */}
        <Text style={styles.label}>Resolution method</Text>
        {RESOLVER_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.resolverOption, resolverType === opt.value && styles.resolverSelected]}
            onPress={() => setResolver(opt.value)}
            activeOpacity={0.7}
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
  container:           { flex: 1, backgroundColor: COLORS.bg },
  inner:               { padding: 20, paddingBottom: 48 },
  label:               { color: COLORS.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 20 },
  input:               { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text },
  multiline:           { minHeight: 80, textAlignVertical: 'top' },
  durationRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationBtn:         { borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  durationBtnActive:   { backgroundColor: COLORS.text, borderColor: COLORS.text },
  durationBtnText:     { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  durationBtnTextActive: { color: '#fff' },
  resolverOption:      { backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center' },
  resolverSelected:    { borderColor: COLORS.primary },
  resolverLeft:        { flex: 1 },
  resolverLabel:       { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  resolverLabelActive: { color: COLORS.primary },
  resolverDesc:        { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  dot:                 { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  error:               { color: COLORS.no, marginTop: 12, fontSize: 13 },
  btn:                 { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  btnDisabled:         { opacity: 0.4 },
  btnText:             { color: '#fff', fontWeight: '700', fontSize: 16 },
});

// ─── Calendar styles ──────────────────────────────────────────────────────────

const cal = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  card:         { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, width: 320, maxWidth: '90%' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn:       { padding: 6 },
  monthYear:    { fontSize: 16, fontWeight: '700', color: COLORS.text },
  dayNames:     { flexDirection: 'row', marginBottom: 4 },
  dayName:      { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  row:          { flexDirection: 'row' },
  cell:         { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', margin: 1, borderRadius: 99 },
  selectedCell: { backgroundColor: COLORS.primary },
  pastCell:     { opacity: 0.3 },
  dayNum:       { fontSize: 14, color: COLORS.text },
  selectedNum:  { color: '#fff', fontWeight: '700' },
  pastNum:      { color: COLORS.textDim },
  closeBtn:     { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  closeBtnText: { color: COLORS.textMuted, fontSize: 14 },
});
