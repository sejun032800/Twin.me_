/**
 * usePremiumGate.ts — Step #40
 *
 * Single source of truth for subscription-based feature gating.
 * Reads subscriptionStatus from useUserStore (Zustand) and exposes plan-tier
 * permission flags consumed by UI components.
 *
 * 읽기 전용 — subscriptionStatus를 직접 수정하지 않음.
 * 만료 처리는 useVipReconcile.ts가 단독 담당.
 *
 * Tier matrix:
 *   free   → no premium features
 *   coffee → hasReportAccess (blur removed), hasLuxuryUI
 *   deep   → hasReportAccess + hasDeepChatAccess, hasLuxuryUI
 */

import { useUserStore } from '../store/userStore';
import { DEFAULT_SUBSCRIPTION_STATUS, type PlanId } from '../services/iapService';

export type PlanTier = 'free' | 'coffee' | 'deep';

export interface PremiumGateResult {
  isPremium: boolean;
  planTier: PlanTier;
  /** Weekly report blur removal — coffee_talk or deep_talk_night */
  hasReportAccess: boolean;
  /** Unlimited deep-chat sessions + deep inference — deep_talk_night only */
  hasDeepChatAccess: boolean;
  /** Luxury UI animations (gold badge, particle aura) — any premium tier */
  hasLuxuryUI: boolean;
  planId: PlanId | null;
}

function deriveTier(planId: PlanId | null, isPremium: boolean): PlanTier {
  if (!isPremium) return 'free';
  if (planId === 'deep') return 'deep';
  if (planId === 'coffee') return 'coffee';
  return 'free';
}

export function usePremiumGate(): PremiumGateResult {
  const { subscriptionStatus } = useUserStore();
  const { isPremium, isFoundingVip, planId } = subscriptionStatus ?? DEFAULT_SUBSCRIPTION_STATUS;

  // isPremium/isFoundingVip은 iapService.reconcileFoundingVipExpiry()가 이미
  // 만료 여부를 반영해둔 값이므로, 여기서는 그대로 읽어 판단할 뿐 만료 시각을
  // 직접 계산하거나 subscriptionStatus를 갱신하지 않는다.
  const tier = deriveTier(planId, isPremium);

  return {
    isPremium,
    planTier: tier,
    hasReportAccess: tier === 'coffee' || tier === 'deep',
    hasDeepChatAccess: tier === 'deep',
    hasLuxuryUI: isPremium || !!isFoundingVip,
    planId: isPremium ? planId : null,
  };
}
