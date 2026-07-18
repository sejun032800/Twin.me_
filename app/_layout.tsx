import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useMidnightSettlement } from '@/hooks/useMidnightSettlement';
import { useNotifications } from '@/hooks/useNotifications';
import { useVipReconcile } from '@/hooks/useVipReconcile';
import { useBillingTracker } from '@/hooks/useBillingTracker';
import { useSessionStore } from '@/store/sessionStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'NotoSansKR-Regular': require('../assets/fonts/NotoSansKR-Regular.ttf'),
    'NotoSansKR-Medium': require('../assets/fonts/NotoSansKR-Medium.ttf'),
    'NotoSansKR-Bold': require('../assets/fonts/NotoSansKR-Bold.ttf'),
    'NotoSerifKR-Regular': require('../assets/fonts/NotoSerifKR-Regular.ttf'),
    'NotoSerifKR-Bold': require('../assets/fonts/NotoSerifKR-Bold.ttf'),
  });
  const themeMode = useSessionStore((s) => s.themeMode);

  useMidnightSettlement(fontsLoaded || !!fontError);
  useNotifications();
  useVipReconcile();
  useBillingTracker();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        {/* date-recommend-setup/result(FUN-HIS-002 진입 UI) — presentation:'modal'로만
            등록하면 되고 나머지 라우트는 그대로 파일 기반 자동 등록에 맡긴다. */}
        <Stack.Screen name="(modals)/date-recommend-setup" options={{ presentation: 'modal' }} />
        <Stack.Screen name="(modals)/date-recommend-result" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
    </>
  );
}
