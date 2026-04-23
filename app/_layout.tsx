import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import {
  DMSerifDisplay_400Regular,
} from '@expo-google-fonts/dm-serif-display';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const [fontsLoaded] = useFonts({
    DMSerifDisplay_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
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
          headerStyle: { backgroundColor: COLORS.surface },
          headerTintColor: COLORS.text,
          headerTitleStyle: { fontFamily: 'DMSans_700Bold', fontSize: 16 },
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
        <Stack.Screen name="markets/share"  options={{ title: '', presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="profile"        options={{ title: 'Profile', headerTitleAlign: 'center' }} />
      </Stack>
    </>
  );
}
