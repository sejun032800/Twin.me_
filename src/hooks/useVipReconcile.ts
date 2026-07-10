// ─── FUN-PAY-003 §9.7 — Founding VIP 13개월차 자동 전환 ────────────────────────
// 앱 마운트 시 1회, isFoundingVip 유저의 subscriptionStatus를 reconcileFoundingVipExpiry()
// (iapService.ts)로 재조정한다. 무료 기간(foundingVipFreeUntil) 만료 시 isPremium만
// false로 전환되고, isFoundingVip/foundingVipDiscountRate(0.5 평생 할인)는 영구 유지된다.

import { useEffect } from 'react';
import { useUserStore } from '@/store/userStore';
import { reconcileFoundingVipExpiry } from '@/services/iapService';
import { logBillingEvent } from '@/services/billingTrackerService';

export function useVipReconcile() {
  const hasHydrated = useUserStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;

    const { isFoundingVip, subscriptionStatus, setSubscriptionStatus } = useUserStore.getState();
    if (!isFoundingVip || !subscriptionStatus) return;

    const reconciled = reconcileFoundingVipExpiry(subscriptionStatus);
    if (reconciled !== subscriptionStatus) {
      setSubscriptionStatus(reconciled);
      logBillingEvent({ type: 'expired', planId: 'founding_vip' });
    }
  }, [hasHydrated]);
}
