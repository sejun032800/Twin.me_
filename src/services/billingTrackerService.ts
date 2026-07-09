// ─── §9 결제 추적 서비스 (구버전 billingTrackerService.ts 이식) ─────────────────
// 구독 상태 변경/결제 실패/만료 임박 등 결제 관련 이벤트를 로컬에 기록하고,
// Founding VIP 무료 기간 만료 임박 여부를 판정한다. 일반 구독(expiresAt)의
// 만료 체크는 iapService.ts(reconcileFoundingVipExpiry 등)에 위임한다.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SubscriptionStatus } from '@/services/iapService';

export type BillingEventType =
  | 'subscribed'
  | 'cancelled'
  | 'expired'
  | 'payment_failed'
  | 'vip_activated'
  | 'expiry_warning';

export interface BillingEvent {
  type: BillingEventType;
  planId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const BILLING_EVENTS_KEY = 'twin_billing_events_v1';
const MAX_BILLING_EVENTS = 50;
const EXPIRY_WARNING_DAYS = 7;

export async function logBillingEvent(event: Omit<BillingEvent, 'timestamp'>): Promise<void> {
  try {
    const history = await getBillingHistory();
    const entry: BillingEvent = { ...event, timestamp: new Date().toISOString() };
    const merged = [entry, ...history].slice(0, MAX_BILLING_EVENTS);
    await AsyncStorage.setItem(BILLING_EVENTS_KEY, JSON.stringify(merged));
  } catch {
    // non-critical
  }
}

export async function getBillingHistory(): Promise<BillingEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(BILLING_EVENTS_KEY);
    return raw ? (JSON.parse(raw) as BillingEvent[]) : [];
  } catch {
    return [];
  }
}

export function checkExpiryWarning(subscriptionStatus: SubscriptionStatus): boolean {
  if (!subscriptionStatus.foundingVipFreeUntil) return false;

  const msUntilExpiry = new Date(subscriptionStatus.foundingVipFreeUntil).getTime() - Date.now();
  const daysUntilExpiry = msUntilExpiry / (24 * 60 * 60 * 1000);

  return daysUntilExpiry > 0 && daysUntilExpiry <= EXPIRY_WARNING_DAYS;
}
