import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS } from '@/lib/constants';

interface BetStats {
  activeBets:   number;
  totalStaked:  number;
}

export default function ProfileScreen() {
  const { profile, user, updateProfile, signOut } = useAuth();
  const [username, setUsername] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [saved,    setSaved]    = useState(false);
  const [stats,    setStats]    = useState<BetStats | null>(null);

  useEffect(() => {
    if (profile) setUsername(profile.username ?? '');
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('positions')
      .select('stake, market:markets(status)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const rows   = (data ?? []) as any[];
        const active = rows.filter(r =>
          ['open', 'locked', 'resolving'].includes(r.market?.status)
        );
        setStats({
          activeBets:  active.length,
          totalStaked: active.reduce((sum, r) => sum + (r.stake ?? 0), 0),
        });
      });
  }, [user]);

  const handleSave = async () => {
    const trimmed = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (trimmed.length < 3) {
      setError('Must be at least 3 characters (letters, numbers, underscores).');
      return;
    }
    setSaving(true);
    setError('');
    const result = await updateProfile({ username: trimmed });
    setSaving(false);
    if (result?.error) {
      setError(result.error.message.includes('unique') ? 'That username is already taken.' : result.error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Profile', headerTitleAlign: 'center' }} />
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">

        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile.username ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Stats cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {stats ? stats.activeBets : '—'}
            </Text>
            <Text style={styles.statLabel}>Active bets</Text>
          </View>
          <View style={[styles.statCard, styles.statCardMiddle]}>
            <Text style={styles.statValue}>
              {stats ? `$${stats.totalStaked.toFixed(0)}` : '—'}
            </Text>
            <Text style={styles.statLabel}>At stake</Text>
          </View>
        </View>

        {/* Username */}
        <Text style={styles.sectionLabel}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={v => { setUsername(v); setSaved(false); }}
          placeholder="your_username"
          placeholderTextColor={COLORS.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={30}
        />
        <Text style={styles.hint}>Letters, numbers and underscores only.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>{saved ? 'Saved ✓' : 'Save changes'}</Text>
          }
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.bg },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  inner:           { padding: 24 },
  avatar:          { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary + '44', alignItems: 'center', justifyContent: 'center', marginBottom: 24, alignSelf: 'center' },
  avatarText:      { fontFamily: FONTS.serif, fontSize: 32, color: COLORS.primary },
  statsRow:        { flexDirection: 'row', gap: 10, marginBottom: 8 },
  statCard:        { flex: 1, backgroundColor: COLORS.surface, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, padding: 16, alignItems: 'center' },
  statCardMiddle:  { borderColor: COLORS.border },
  statValue:       { fontFamily: FONTS.sansBold, fontSize: 28, color: COLORS.text, marginBottom: 4 },
  statLabel:       { fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textMuted },
  sectionLabel:    { fontFamily: FONTS.sansMedium, fontSize: 12, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 24 },
  input:           { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 14, fontFamily: FONTS.sans, fontSize: 15, color: COLORS.text },
  hint:            { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.textDim, marginTop: 4 },
  error:           { fontFamily: FONTS.sans, color: COLORS.no, fontSize: 13, marginTop: 12 },
  saveBtn:         { backgroundColor: COLORS.primary, borderRadius: 4, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnDisabled:     { opacity: 0.5 },
  saveBtnText:     { fontFamily: FONTS.sansBold, color: '#fff', fontSize: 16 },
  divider:         { height: 1, backgroundColor: COLORS.border, marginVertical: 28 },
  signOutBtn:      { paddingVertical: 12, alignItems: 'center' },
  signOutText:     { fontFamily: FONTS.sansMedium, color: COLORS.no, fontSize: 15 },
});
