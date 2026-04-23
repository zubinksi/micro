import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS } from '@/lib/constants';

export default function JoinMarketScreen() {
  const { user } = useAuth();
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 8 || !user) return;

    setLoading(true);
    setError('');

    const { data: market, error: mErr } = await supabase
      .from('markets')
      .select('id, question, status')
      .eq('invite_code', trimmed)
      .single();

    if (mErr || !market) {
      setError('Invalid invite code. Double-check and try again.');
      setLoading(false);
      return;
    }

    const { error: joinErr } = await supabase
      .from('market_members')
      .insert({ market_id: market.id, user_id: user.id });

    setLoading(false);

    if (joinErr && joinErr.code !== '23505') {
      setError('Could not join market. Please try again.');
      return;
    }

    router.replace(`/markets/${market.id}`);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.hint}>
          Enter the invite code shared by the market creator.
        </Text>

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
            : <Text style={styles.btnText}>Join Market</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.bg },
  inner:      { flex: 1, padding: 24, justifyContent: 'center' },
  hint:       { fontFamily: FONTS.sans, color: COLORS.textMuted, fontSize: 14, marginBottom: 28, lineHeight: 20, textAlign: 'center' },
  input:      { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 4, padding: 18, fontFamily: FONTS.sansBold, fontSize: 28, color: COLORS.text, letterSpacing: 6, textAlign: 'center', marginBottom: 20 },
  error:      { fontFamily: FONTS.sans, color: COLORS.no, marginBottom: 12, textAlign: 'center', fontSize: 13 },
  btn:        { backgroundColor: COLORS.primary, borderRadius: 4, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:{ opacity: 0.4 },
  btnText:    { fontFamily: FONTS.sansBold, color: '#fff', fontSize: 16 },
});
