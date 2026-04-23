import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { COLORS, FONTS } from '@/lib/constants';

export default function ProfileScreen() {
  const { profile, updateProfile, signOut } = useAuth();
  const [username,    setUsername]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [saved,       setSaved]       = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? '');
      setDisplayName(profile.display_name ?? '');
    }
  }, [profile]);

  const handleSave = async () => {
    const trimmed = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (trimmed.length < 3) {
      setError('Username must be at least 3 characters (letters, numbers, underscores).');
      return;
    }
    setSaving(true);
    setError('');
    const result = await updateProfile({
      username:     trimmed,
      display_name: displayName.trim() || null,
    });
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

      <View style={styles.inner}>
        {/* Avatar initial */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(profile.display_name ?? profile.username ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>

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

        <Text style={styles.sectionLabel}>Display name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={v => { setDisplayName(v); setSaved(false); }}
          placeholder="Your Name (optional)"
          placeholderTextColor={COLORS.textDim}
          maxLength={50}
        />

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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  inner:        { padding: 24 },
  avatar:       { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primary + '44', alignItems: 'center', justifyContent: 'center', marginBottom: 28, alignSelf: 'center' },
  avatarText:   { fontFamily: FONTS.serif, fontSize: 32, color: COLORS.primary },
  sectionLabel: { fontFamily: FONTS.sansMedium, fontSize: 12, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 20 },
  input:        { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 14, fontFamily: FONTS.sans, fontSize: 15, color: COLORS.text },
  hint:         { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.textDim, marginTop: 4 },
  error:        { fontFamily: FONTS.sans, color: COLORS.no, fontSize: 13, marginTop: 12 },
  saveBtn:      { backgroundColor: COLORS.primary, borderRadius: 4, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
  btnDisabled:  { opacity: 0.5 },
  saveBtnText:  { fontFamily: FONTS.sansBold, color: '#fff', fontSize: 16 },
  divider:      { height: 1, backgroundColor: COLORS.border, marginVertical: 28 },
  signOutBtn:   { paddingVertical: 12, alignItems: 'center' },
  signOutText:  { fontFamily: FONTS.sansMedium, color: COLORS.no, fontSize: 15 },
});
