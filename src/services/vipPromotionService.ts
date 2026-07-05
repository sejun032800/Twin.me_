/**
 * VIP Promotion Service (FUN-PAY-003 §8.10)
 *
 * Founding Twin 베타 창립 멤버 프로모션 코드 검증 및 계정 귀속.
 * EXPO_PUBLIC_API_BASE_URL이 설정되지 않았거나 'mock'을 포함하면 Mock 모드로 동작
 * (inviteCodeService.ts와 동일한 mock/real 이원화 패턴).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SubscriptionStatus } from './iapService';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
export const isMockMode =
  API_BASE === '' || API_BASE.toLowerCase().includes('mock');

const REDEEM_ENDPOINT = `${API_BASE}/api/v1/vip/redeem`;
const TIMEOUT_MS = 10_000;

const USED_CODES_KEY = 'vip_promo_used_codes';
const STATE_KEY_PREFIX = 'vip_promo_state:';

const SEED_CODES = new Set([
  'FOUNDINGTWIN01',
  'FOUNDINGTWIN02',
  'FOUNDINGTWIN03',
  'FOUNDINGTWIN04',
  'FOUNDINGTWIN05',
  'FOUNDINGTWIN06',
  'FOUNDINGTWIN07',
  'FOUNDINGTWIN08',
  'FOUNDINGTWIN09',
  'FOUNDINGTWIN10',
]);

const MESSAGES = {
  invalidCode: '유효하지 않은 코드예요. 다시 확인해 주세요.',
  alreadyUsed: '이미 사용된 코드예요.',
  networkError: '네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
  success:
    '12개월간 Deep Talk Night가 완전 무료로 적용됐어요. 나의 대화 유전자를 완전히 보존하고, 12개월의 성찰 자산을 쌓아보세요.',
} as const;

export interface VipRedeemResult {
  success: boolean;
  message: string;
  status?: SubscriptionStatus;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function normalizeCode(raw: string): string {
  return raw.replace(/\s/g, '').toUpperCase();
}

async function loadUsedCodes(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(USED_CODES_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

async function markCodeUsed(code: string): Promise<void> {
  const used = await loadUsedCodes();
  used.add(code);
  await AsyncStorage.setItem(USED_CODES_KEY, JSON.stringify(Array.from(used)));
}

function twelveMonthsFromNow(): string {
  const freeUntil = new Date();
  freeUntil.setMonth(freeUntil.getMonth() + 12);
  return freeUntil.toISOString();
}

function buildFoundingVipStatus(freeUntilIso: string): SubscriptionStatus {
  return {
    isPremium: true,
    planId: 'deep',
    isFoundingVip: true,
    foundingVipFreeUntil: freeUntilIso,
    foundingVipDiscountRate: 0.5,
    expiresAt: freeUntilIso,
  };
}

// ── Mock: code redemption ─────────────────────────────────────────────────────

async function redeemMock(userId: string, promoCode: string): Promise<VipRedeemResult> {
  await new Promise((resolve) => setTimeout(resolve, 700));

  const normalized = normalizeCode(promoCode);

  if (!SEED_CODES.has(normalized)) {
    return { success: false, message: MESSAGES.invalidCode };
  }

  const usedCodes = await loadUsedCodes();
  if (usedCodes.has(normalized)) {
    return { success: false, message: MESSAGES.alreadyUsed };
  }

  await markCodeUsed(normalized);
  const status = buildFoundingVipStatus(twelveMonthsFromNow());
  await AsyncStorage.setItem(`${STATE_KEY_PREFIX}${userId}`, JSON.stringify(status));

  return { success: true, message: MESSAGES.success, status };
}

// ── Live: code redemption ──────────────────────────────────────────────────────

async function redeemLive(userId: string, promoCode: string): Promise<VipRedeemResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(REDEEM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code: normalizeCode(promoCode) }),
      signal: controller.signal,
    });

    if (response.ok) {
      const data = (await response.json()) as { foundingVipFreeUntil: string };
      return {
        success: true,
        message: MESSAGES.success,
        status: buildFoundingVipStatus(data.foundingVipFreeUntil),
      };
    }

    if (response.status === 404) {
      return { success: false, message: MESSAGES.invalidCode };
    }
    if (response.status === 409) {
      return { success: false, message: MESSAGES.alreadyUsed };
    }
    return { success: false, message: MESSAGES.networkError };
  } catch {
    return { success: false, message: MESSAGES.networkError };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Founding Twin VIP 프로모션 코드를 검증하고 계정에 귀속한다.
 * 실패 케이스(존재하지 않는 코드/이미 사용된 코드/네트워크 오류) 전부
 * { success: false, message }로 귀결한다 — throw하지 않는다.
 */
export async function redeemVipCode(
  userId: string,
  promoCode: string,
): Promise<VipRedeemResult> {
  if (isMockMode) return redeemMock(userId, promoCode);
  return redeemLive(userId, promoCode);
}

/**
 * 앱 런치 시 AppContext 하이드레이션에서 호출 — 계정에 귀속된 founding-VIP 상태를
 * AsyncStorage에서 복원한다. 저장된 상태가 없으면 null.
 */
export async function loadFoundingVipState(userId: string): Promise<SubscriptionStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(`${STATE_KEY_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as SubscriptionStatus) : null;
  } catch {
    return null;
  }
}
