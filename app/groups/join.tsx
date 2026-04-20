import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useGroups } from '@/hooks/useGroups';
import { COLORS } from '@/lib/constants';

export default function JoinGroupScreen() {
  const { user } = useAuth();
  const { joinByCode } = useGroups(user?.id);
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleJoin = async () => {
    if (code.trim().length < 8) return;
    setLoading(true);
    setError('');
    const result = await joinByCode(code.trim());
    setLoading(false);
    if ('error' in result && result.error) { setError(result.error); return; }
    if ('data' in result && result.data) {
      router.replace(`/groups/${result.data.id}`);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.hint}>Enter the 8-character invite code shared by your friend.</Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={t => setCode(t.toUpperCase())}
          placeholder="XXXXXXXX"
          placeholderTextColor={COLORS.textDim}
          autoCapitalize="characters"
          maxLength={8}
          autoFocus
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (loading || code.trim().length < 8) && styles.btnDisabled]}
          onPress={handleJoin}
          disabled={loading || code.trim().length < 8}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Join group</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner:     { flex: 1, padding: 24, justifyContent: 'center' },
  hint:      { color: COLORS.textMuted, fontSize: 14, marginBottom: 28, lineHeight: 20 },
  input:     {
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 12, padding: 18, fontSize: 28, color: COLORS.text,
    letterSpacing: 6, textAlign: 'center', marginBottom: 20, fontWeight: '700',
  },
  error:     { color: COLORS.no, marginBottom: 12, textAlign: 'center', fontSize: 13 },
  btn:       { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
});
