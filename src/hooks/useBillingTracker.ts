// ─── §9 결제 추적 훅 (구버전 billingTrackerService.ts 이식) ──────────────────────
// 앱 마운트 시 Founding VIP 무료 기간이 7일 이내로 임박했으면 로컬 알림을 1회
// 예약한다. 오늘 이미 보냈으면 재발송하지 않는다(AsyncStorage 날짜 체크).

import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserStore } from '@/store/userStore';
import { checkExpiryWarning } from '@/services/billingTrackerService';
import { scheduleLocalNotification } from '@/services/notificationService';

const EXPIRY_NOTIF_KEY = 'twin_expiry_notif_v1';

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useBillingTracker() {
  useEffect(() => {
    (async () => {
      const { subscriptionStatus } = useUserStore.getState();
      if (!subscriptionStatus || !checkExpiryWarning(subscriptionStatus)) return;

      const today = todayDateString();
      const lastNotifDate = await AsyncStorage.getItem(EXPIRY_NOTIF_KEY);
      if (lastNotifDate === today) return;

      await scheduleLocalNotification(
        '구독 만료 임박 ⚠️',
        'Founding VIP 혜택이 7일 후 만료돼요. 확인해보세요.',
      );
      await AsyncStorage.setItem(EXPIRY_NOTIF_KEY, today);
    })();
  }, []);
}
