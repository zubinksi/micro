import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Share, Platform, Clipboard,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS } from '@/lib/constants';

function getAppBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://micro.vercel.app';
}

export default function ShareMarketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [question,   setQuestion]   = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading,    setLoading]    = useState(true);
  const [copied,     setCopied]     = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('markets')
      .select('question, invite_code')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setQuestion(data.question);
          setInviteCode(data.invite_code ?? '');
        }
        setLoading(false);
      });
  }, [id]);

  const shareUrl = `${getAppBaseUrl()}/api/og?id=${id}`;

  const handleShare = async () => {
    await Share.share({
      message: `"${question}"\nJoin my prediction on Hunch: ${shareUrl}`,
      url:     shareUrl,
      title:   question,
    });
  };

  const handleCopy = () => {
    Clipboard.setString(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.inner}>

        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={32} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>Market created</Text>
        <Text style={styles.question} numberOfLines={3}>{question}</Text>

        {/* Invite code */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Invite code</Text>
          <Text style={styles.codeValue}>{inviteCode}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? COLORS.yes : COLORS.primary} />
            <Text style={[styles.copyBtnText, copied && styles.copyBtnTextCopied]}>
              {copied ? 'Copied!' : 'Copy code'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Share link */}
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color="#fff" />
          <Text style={styles.shareBtnText}>Invite friends</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewBtn}
          onPress={() => router.replace(`/markets/${id}`)}
        >
          <Text style={styles.viewBtnText}>View market →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.bg },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  inner:            { flex: 1, padding: 28, justifyContent: 'center' },
  successIcon:      { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: COLORS.primary + '33' },
  title:            { fontFamily: FONTS.serif, fontSize: 30, color: COLORS.text, marginBottom: 10 },
  question:         { fontFamily: FONTS.sans, fontSize: 16, color: COLORS.textMuted, lineHeight: 22, marginBottom: 32 },
  codeCard:         { backgroundColor: COLORS.surface, borderRadius: 4, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  codeLabel:        { fontFamily: FONTS.sansMedium, fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  codeValue:        { fontFamily: FONTS.sansBold, fontSize: 32, color: COLORS.text, letterSpacing: 6, marginBottom: 16 },
  copyBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 16 },
  copyBtnText:      { fontFamily: FONTS.sansMedium, color: COLORS.primary, fontSize: 14 },
  copyBtnTextCopied:{ color: COLORS.yes },
  shareBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 4, paddingVertical: 16, marginBottom: 12 },
  shareBtnText:     { fontFamily: FONTS.sansBold, color: '#fff', fontSize: 16 },
  viewBtn:          { paddingVertical: 12, alignItems: 'center' },
  viewBtnText:      { fontFamily: FONTS.sansMedium, color: COLORS.textMuted, fontSize: 15 },
});
