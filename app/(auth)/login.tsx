import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';

type Step = 'email' | 'sent';

export default function LoginScreen() {
  const { sendMagicLink } = useAuth();
  const [step, setStep]     = useState<Step>('email');
  const [email, setEmail]   = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    setError('');
    const { error } = await sendMagicLink(email.trim().toLowerCase());
    setLoading(false);
    if (error) { setError(error.message); return; }
    setStep('sent');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.wordmark}>micro</Text>
        <Text style={styles.tagline}>Prediction markets for your group chat.</Text>

        {step === 'email' ? (
          <>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textDim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.btn, (loading || !email.includes('@')) && styles.btnDisabled]}
              onPress={handleSend}
              disabled={loading || !email.includes('@')}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Send magic link</Text>
              }
            </TouchableOpacity>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        ) : (
          <View style={styles.sentWrap}>
            <Text style={styles.sentIcon}>📬</Text>
            <Text style={styles.sentTitle}>Check your email</Text>
            <Text style={styles.sentSub}>
              We sent a sign-in link to{'\n'}<Text style={styles.sentEmail}>{email}</Text>
            </Text>
            <TouchableOpacity style={styles.back} onPress={() => { setStep('email'); setError(''); }}>
              <Text style={styles.backText}>← Use a different email</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.bg },
  inner:      { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  wordmark:   { fontSize: 42, fontWeight: '800', color: COLORS.primary, marginBottom: 6, letterSpacing: -1 },
  tagline:    { fontSize: 16, color: COLORS.textMuted, marginBottom: 48 },
  label:      { fontSize: 14, color: COLORS.textMuted, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 16,
  },
  btn:         { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  error:       { color: COLORS.no, marginTop: 4, textAlign: 'center', fontSize: 14 },
  sentWrap:    { alignItems: 'center' },
  sentIcon:    { fontSize: 48, marginBottom: 16 },
  sentTitle:   { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  sentSub:     { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  sentEmail:   { color: COLORS.text, fontWeight: '600' },
  back:        { paddingVertical: 8 },
  backText:    { color: COLORS.textMuted, fontSize: 14 },
});
