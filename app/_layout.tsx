import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  useEffect(() => {
    if (loading || !fontsLoaded) return;
    if (!session) {
      router.replace('/(auth)/login');
    } else {
      router.replace('/(tabs)/feed');
    }
  }, [session, loading, fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.bg },
          headerTintColor: COLORS.text,
          headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 16 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="markets/create" options={{ title: 'New Bet', presentation: 'modal', headerTitleAlign: 'center' }} />
        <Stack.Screen name="markets/join"   options={{ title: 'Join Market', presentation: 'modal', headerTitleAlign: 'center' }} />
        <Stack.Screen name="markets/[id]"   options={{ title: 'Market' }} />
        <Stack.Screen name="markets/share"  options={{ title: 'Share Bet', headerTitleAlign: 'center' }} />
        <Stack.Screen name="profile"        options={{ title: 'Profile', headerTitleAlign: 'center' }} />
      </Stack>
    </>
  );
}
