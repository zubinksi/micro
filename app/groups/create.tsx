import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useGroups } from '@/hooks/useGroups';
import { COLORS } from '@/lib/constants';

export default function CreateGroupScreen() {
  const { user } = useAuth();
  const { createGroup } = useGroups(user?.id);
  const [name, setName]         = useState('');
  const [description, setDesc]  = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    const result = await createGroup(name.trim(), description.trim() || undefined);
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
        <Text style={styles.hint}>Give your crew a name. Share the invite code and let the games begin.</Text>

        <Text style={styles.label}>Group name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. The Degenerates"
          placeholderTextColor={COLORS.textDim}
          maxLength={60}
          autoFocus
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDesc}
          placeholder="What's this group about?"
          placeholderTextColor={COLORS.textDim}
          multiline
          numberOfLines={3}
          maxLength={200}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (loading || !name.trim()) && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={loading || !name.trim()}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Create group</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner:     { flex: 1, padding: 24 },
  hint:      { color: COLORS.textMuted, fontSize: 14, marginBottom: 28, lineHeight: 20 },
  label:     { color: COLORS.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input:     {
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text, marginBottom: 20,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  error:     { color: COLORS.no, marginBottom: 12, fontSize: 13 },
  btn:       { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
});
