import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { COLORS, FONTS } from '@/lib/constants';

type Step = 'email' | 'sent';

export default function LoginScreen() {
  const { sendMagicLink } = useAuth();
  const [step,    setStep]    = useState<Step>('email');
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
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
        <Text style={styles.wordmark}>Maybe</Text>
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
  wordmark:   { fontFamily: FONTS.serif, fontSize: 48, color: COLORS.primary, marginBottom: 8 },
  tagline:    { fontFamily: FONTS.sans, fontSize: 16, color: COLORS.textMuted, marginBottom: 48, lineHeight: 22 },
  label:      { fontFamily: FONTS.sansMedium, fontSize: 12, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input:      { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 14, padding: 16, fontFamily: FONTS.sans, fontSize: 16, color: COLORS.text, marginBottom: 16 },
  btn:        { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { fontFamily: FONTS.sansBold, color: '#fff', fontSize: 16 },
  error:      { fontFamily: FONTS.sans, color: COLORS.no, marginTop: 4, textAlign: 'center', fontSize: 14 },
  sentWrap:   { alignItems: 'center' },
  sentTitle:  { fontFamily: FONTS.serif, fontSize: 28, color: COLORS.text, marginBottom: 12 },
  sentSub:    { fontFamily: FONTS.sans, fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  sentEmail:  { fontFamily: FONTS.sansBold, color: COLORS.text },
  back:       { paddingVertical: 8 },
  backText:   { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 14 },
});
