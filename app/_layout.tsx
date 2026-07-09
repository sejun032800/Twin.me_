import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useMidnightSettlement } from '@/hooks/useMidnightSettlement';
import { useNotifications } from '@/hooks/useNotifications';
import { useVipReconcile } from '@/hooks/useVipReconcile';
import { useBillingTracker } from '@/hooks/useBillingTracker';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'NotoSansKR-Regular': require('../assets/fonts/NotoSansKR-Regular.ttf'),
    'NotoSansKR-Medium': require('../assets/fonts/NotoSansKR-Medium.ttf'),
    'NotoSansKR-Bold': require('../assets/fonts/NotoSansKR-Bold.ttf'),
    'NotoSerifKR-Regular': require('../assets/fonts/NotoSerifKR-Regular.ttf'),
    'NotoSerifKR-Bold': require('../assets/fonts/NotoSerifKR-Bold.ttf'),
  });

  useMidnightSettlement(fontsLoaded || !!fontError);
  useNotifications();
  useVipReconcile();
  useBillingTracker();

  useEffect(() => {
    console.log('fontsLoaded:', fontsLoaded);
    console.log('fontError:', fontError);
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="light" />
    </>
  );
}
