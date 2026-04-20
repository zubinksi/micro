import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';

export default function RootLayout() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/(auth)/login');
    } else {
      router.replace('/(tabs)/feed');
    }
  }, [session, loading]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.bg },
          headerTintColor: COLORS.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="groups/create" options={{ title: 'New Group', presentation: 'modal' }} />
        <Stack.Screen name="groups/join"   options={{ title: 'Join Group',  presentation: 'modal' }} />
        <Stack.Screen name="groups/[id]"   options={{ title: 'Group' }} />
        <Stack.Screen name="markets/create" options={{ title: 'New Market', presentation: 'modal' }} />
        <Stack.Screen name="markets/[id]"   options={{ title: 'Market' }} />
      </Stack>
    </>
  );
}
