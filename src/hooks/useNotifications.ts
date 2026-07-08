// ─── Notifications Hook — 앱 루트에서 1회 마운트 (Phase 7-4) ────────────────────
// 푸시 토큰을 등록해 userStore.pushToken에 저장하고, 알림 수신/탭 리스너를 건다.
// 알림 data.screen 값에 따라 해당 탭으로 이동시킨다.

import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { registerForPushNotifications } from '@/services/notificationService';
import { useUserStore } from '@/store/userStore';

export function useNotifications() {
  const router = useRouter();
  const setPushToken = useUserStore((s) => s.setPushToken);

  useEffect(() => {
    registerForPushNotifications().then((token) => {
      if (token) setPushToken(token);
    });

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      // 포그라운드 수신 — 배너는 OS/handler 설정을 따르고 별도 처리는 하지 않는다.
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen;
      if (screen === 'chat') {
        router.push('/(tabs)/chat');
      } else if (screen === 'home') {
        router.push('/(tabs)');
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [router, setPushToken]);
}
