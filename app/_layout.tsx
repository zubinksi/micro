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
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.surface },
          headerTintColor: COLORS.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="markets/create" options={{ title: 'New Market', presentation: 'modal', headerTitleAlign: 'center' }} />
        <Stack.Screen name="markets/join"   options={{ title: 'Join Market',  presentation: 'modal', headerTitleAlign: 'center' }} />
        <Stack.Screen name="markets/[id]"   options={{ title: '' }} />
      </Stack>
    </>
  );
}
