import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';

type Step = 'phone' | 'otp';

export default function LoginScreen() {
  const { signInWithOtp, verifyOtp } = useAuth();
  const [step, setStep]     = useState<Step>('phone');
  const [phone, setPhone]   = useState('');
  const [otp, setOtp]       = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const formatted = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;
    setLoading(true);
    setError('');
    const { error } = await signInWithOtp(formatted);
    setLoading(false);
    if (error) { setError(error.message); return; }
    setStep('otp');
  };

  const handleVerify = async () => {
    const formatted = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;
    setLoading(true);
    setError('');
    const { error } = await verifyOtp(formatted, otp.trim());
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.replace('/(tabs)/feed');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.wordmark}>micro</Text>
        <Text style={styles.tagline}>Prediction markets for your group chat.</Text>

        {step === 'phone' ? (
          <>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 555 000 0000"
              placeholderTextColor={COLORS.textDim}
              keyboardType="phone-pad"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSendOtp}
              disabled={loading || phone.length < 10}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Send code</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Enter the 6-digit code sent to {phone}</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              value={otp}
              onChangeText={setOtp}
              placeholder="000000"
              placeholderTextColor={COLORS.textDim}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleVerify}
              disabled={loading || otp.length !== 6}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Verify</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.back} onPress={() => { setStep('phone'); setOtp(''); setError(''); }}>
              <Text style={styles.backText}>← Change number</Text>
            </TouchableOpacity>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  wordmark: { fontSize: 42, fontWeight: '800', color: COLORS.primary, marginBottom: 6, letterSpacing: -1 },
  tagline:  { fontSize: 16, color: COLORS.textMuted, marginBottom: 48 },
  label:    { fontSize: 14, color: COLORS.textMuted, marginBottom: 8 },
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
  otpInput: { fontSize: 28, letterSpacing: 8, textAlign: 'center' },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.5 },
  btnText:  { color: '#fff', fontWeight: '700', fontSize: 16 },
  back:     { alignItems: 'center', paddingVertical: 8 },
  backText: { color: COLORS.textMuted, fontSize: 14 },
  error:    { color: COLORS.no, marginTop: 12, textAlign: 'center' },
});
