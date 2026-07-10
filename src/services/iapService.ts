/**
 * iapService.ts — Native In-App Purchase pipeline (Step #50)
 *
 * Library : react-native-iap v15 (Nitro architecture)
 * Requires: Expo prebuild (bare workflow) or EAS Build
 *           → npx eas build (네이티브 코드 컴파일 필수)
 *
 * Flow (subscription):
 *   initIAP() → purchaseSubscription(planId) → verifyReceipt() → SubscriptionStatus
 *
 * Flow (one-time / theme):
 *   initIAP() → purchaseOneTimeProduct(sku) → transactionId
 *
 * Sandbox mode:
 *   In Expo Go / simulator (Nitro not linked), isNitroReady() returns false.
 *   All purchase functions return simulated success after a short delay.
 *   Sandbox snackbar + visual badge is shown in UI.
 *
 * Receipt verification:
 *   Endpoint is built from EXPO_PUBLIC_API_BASE_URL env var.
 *   If the var is empty the store receipt is trusted locally (dev / staging).
 *
 * teardownIAP() — call in component useEffect cleanup to prevent listener leaks.
 *
 * TODO(§0 하드 제약, 2026-07-08 감사): app.json의 `react-native-iap` config plugin은
 * prebuild/EAS Build 타임에만 적용되고 Expo Go는 app.json plugins를 아예 읽지 않으므로
 * 그 자체로는 Expo Go 실행에 영향 없음. 이 파일도 require('react-native-iap')를 iap()
 * 안에서 지연 호출하고 isNitroReady() 첫 호출을 try/catch로 감싸 sandbox로 폴백하지만,
 * 현재는 이 서비스를 런타임에 import하는 화면/스토어가 전무해 그 경로 자체가 실행된 적
 * 없음(usePremiumGate.ts가 유일한 런타임 import원인데 그마저 미사용 죽은 코드).
 * usePremiumGate 또는 구독 화면을 실제로 연결하는 시점에는, 반드시 순정 Expo Go 세션에서
 * "require 자체가 네이티브 크래시 없이 sandbox 모드로 폴백되는지" 1회 실기기 검증 필요.
 */

import { Platform } from 'react-native';

// react-native-iap is native-only — dynamically required so web builds compile cleanly
type IapModule = typeof import('react-native-iap');
let _rniap: IapModule | null = null;
function iap(): IapModule {
  if (!_rniap) _rniap = require('react-native-iap') as IapModule;
  return _rniap;
}

// ─── Public Types ─────────────────────────────────────────────────────────────

export type PlanId = 'coffee' | 'deep';

/** §8.2 개인형(single) / 커플 묶음형(couple) 2분할 가입 유형 */
export type SubscriptionType = 'single' | 'couple';

export interface SubscriptionStatus {
  isPremium: boolean;
  planId: PlanId | null;
  expiresAt: string | null;
  /** FUN-PAY-003 §8.10 — 베타 창립 멤버 VIP 프로모션 코드로 귀속됐는지 여부 */
  isFoundingVip?: boolean;
  /** ISO 문자열, founding-VIP 귀속 시점 + 12개월. 무료 기간 종료 판정 기준 */
  foundingVipFreeUntil?: string | null;
  /** 0.5 고정 — 무료 기간 종료 후에도 영구 유지되는 Deep Talk Night 할인율 */
  foundingVipDiscountRate?: number;
}

export const DEFAULT_SUBSCRIPTION_STATUS: SubscriptionStatus = {
  isPremium: false,
  planId: null,
  expiresAt: null,
};

// ─── SKU Registry (§8.2 가격 매트릭스 — 개인/커플 묶음 2단가 구조) ────────────

export const PLAN_SKUS = {
  COFFEE_TALK_SINGLE: 'sub_coffee_talk_single',
  COFFEE_TALK_COUPLE: 'sub_coffee_talk_couple',
  DEEP_NIGHT_SINGLE: 'sub_deep_night_single',
  DEEP_NIGHT_COUPLE: 'sub_deep_night_couple',
  /** FUN-PAY-003 §8.10 — founding-VIP 영구 50% 할인가 청구용 별도 SKU */
  FOUNDING_VIP_DEEP_NIGHT_SINGLE: 'founding_vip_deep_night_single',
  FOUNDING_VIP_DEEP_NIGHT_COUPLE: 'founding_vip_deep_night_couple',
} as const;

export const OFFICIAL_PRICE_MATRIX: Record<
  'COFFEE_TALK_SINGLE' | 'COFFEE_TALK_COUPLE' | 'DEEP_NIGHT_SINGLE' | 'DEEP_NIGHT_COUPLE',
  number
> = {
  COFFEE_TALK_SINGLE: 4900,
  COFFEE_TALK_COUPLE: 7900, // 인당 ₩3,950 효과
  DEEP_NIGHT_SINGLE: 9900,
  DEEP_NIGHT_COUPLE: 14900, // 인당 ₩7,450 효과
};

export interface PlanPricingInfo {
  tierName: 'Coffee Talk' | 'Deep Talk Night';
  displayPriceSingle: string;
  displayPriceCouple: string;
  priceValueSingle: number;
  priceValueCouple: number;
}

/** FUN-PAY-003 §8.10 — founding-VIP 무료 기간 종료 후 영구 적용되는 Deep Talk Night 50% 할인가 */
const FOUNDING_VIP_DEEP_NIGHT_SINGLE = 4950;
const FOUNDING_VIP_DEEP_NIGHT_COUPLE = 7450;

/**
 * UI 컴포넌트용 동적 메타데이터 매핑 — 파트너 연동 여부에 따라 추천 상품이 달라지고,
 * foundingVipDiscountActive가 true면 Deep Talk Night에 §8.10 영구 50% 할인가를 적용한다.
 * Coffee Talk은 §8.10 범위 밖이므로 영향받지 않는다.
 */
export function getPlanMetadataByStatus(
  _isPartnerLinked: boolean,
  foundingVipDiscountActive: boolean = false,
): PlanPricingInfo[] {
  return [
    {
      tierName: 'Coffee Talk',
      displayPriceSingle: '월 ₩4,900',
      displayPriceCouple: '월 ₩7,900 (커플 패키지)',
      priceValueSingle: OFFICIAL_PRICE_MATRIX.COFFEE_TALK_SINGLE,
      priceValueCouple: OFFICIAL_PRICE_MATRIX.COFFEE_TALK_COUPLE,
    },
    foundingVipDiscountActive
      ? {
          tierName: 'Deep Talk Night',
          displayPriceSingle: '월 ₩4,950 (Founding Twin 50% 할인)',
          displayPriceCouple: '월 ₩7,450 (Founding Twin 50% 할인)',
          priceValueSingle: FOUNDING_VIP_DEEP_NIGHT_SINGLE,
          priceValueCouple: FOUNDING_VIP_DEEP_NIGHT_COUPLE,
        }
      : {
          tierName: 'Deep Talk Night',
          displayPriceSingle: '월 ₩9,900',
          displayPriceCouple: '월 ₩14,900 (커플 패키지)',
          priceValueSingle: OFFICIAL_PRICE_MATRIX.DEEP_NIGHT_SINGLE,
          priceValueCouple: OFFICIAL_PRICE_MATRIX.DEEP_NIGHT_COUPLE,
        },
  ];
}

/**
 * 순수함수 — founding-VIP 무료 기간(foundingVipFreeUntil) 만료를 재조정한다.
 * 만료 시 isPremium만 false로 전환하고, isFoundingVip/foundingVipDiscountRate는
 * §8.10 "13개월차부터 평생 50% 할인" 요건에 따라 영구 유지한다.
 * useVipReconcile.ts에서 앱 런치마다 호출된다.
 */
export function reconcileFoundingVipExpiry(status: SubscriptionStatus): SubscriptionStatus {
  const isExpired =
    !!status.foundingVipFreeUntil &&
    new Date(status.foundingVipFreeUntil).getTime() < Date.now();

  if (status.isFoundingVip && isExpired && status.planId === 'deep') {
    return {
      ...status,
      isPremium: false,
      isFoundingVip: true,
      foundingVipDiscountRate: 0.5,
    };
  }

  return status;
}

function skuFor(
  planId: PlanId,
  subscriptionType: SubscriptionType,
  foundingVipDiscountActive?: boolean,
): string {
  if (planId === 'coffee') {
    return subscriptionType === 'couple' ? PLAN_SKUS.COFFEE_TALK_COUPLE : PLAN_SKUS.COFFEE_TALK_SINGLE;
  }
  if (foundingVipDiscountActive) {
    return subscriptionType === 'couple'
      ? PLAN_SKUS.FOUNDING_VIP_DEEP_NIGHT_COUPLE
      : PLAN_SKUS.FOUNDING_VIP_DEEP_NIGHT_SINGLE;
  }
  return subscriptionType === 'couple' ? PLAN_SKUS.DEEP_NIGHT_COUPLE : PLAN_SKUS.DEEP_NIGHT_SINGLE;
}

// ─── §5.8 실시간 단건 결제(OTP) SKU 레지스트리 ─────────────────────────────────
// 테마 상품(ThemeShop)은 자체 sku를 가지므로 별도 관리 — 여기엔 v2.2 엔진 트리거와
// 직결되는 3대 순간형 상품만 등록한다.

export const ONE_TIME_SKUS = {
  /** EXCESS_GAIN — 하이라이트 공유 카드 즉시 언락 */
  highlightUnlock: 'highlight_unlock_single',
  /** CRITICAL_LOSS/Rapid-Swing — 월간 거울방 한도 소진 시 반성의 거울 즉시 열기 */
  mirrorRoomUnlock: 'mirror_room_unlock_single',
  /** 마스터 커플 질문 생성 — Deep Talk Night 미가입자용 그날 밤 질문지 단건 해금 */
  masterQuestionUnlock: 'master_question_unlock_single',
} as const;

// ─── API Endpoint (env-var based, no hardcoded domain) ───────────────────────

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

function getVerifyEndpoint(): string | null {
  return API_BASE ? `${API_BASE}/api/v1/billing/verify-receipt` : null;
}

function getThemeOwnershipEndpoint(): string | null {
  return API_BASE ? `${API_BASE}/api/v1/themes/verify-ownership` : null;
}

// ─── Sandbox Detection ────────────────────────────────────────────────────────
// isNitroReady() lazily tries NitroModules.createHybridObject<RnIap>('RnIap').
// In Expo Go / unlinked environments this throws → sandbox mode.
// In a proper EAS Build the native module is present → live IAP.

let _isSandbox = false;

if (Platform.OS === 'web') {
  _isSandbox = true;
} else {
  try {
    _isSandbox = !iap().isNitroReady();
  } catch {
    _isSandbox = true;
  }
}

/** Returns true when running in Expo Go / simulator without native IAP support. */
export function isSandboxMode(): boolean {
  return _isSandbox;
}

// ─── Connection Lifecycle ─────────────────────────────────────────────────────

let _connected = false;

/**
 * Opens the IAP billing connection.
 * Idempotent — safe to call multiple times.
 * Falls into sandbox mode if the native module is unavailable.
 */
export async function initIAP(): Promise<void> {
  if (_connected) return;
  if (_isSandbox) {
    _connected = true;
    return;
  }
  try {
    await iap().initConnection();
    _connected = true;
  } catch {
    // Native IAP module unavailable (Expo Go, Android emulator, TestFlight sandbox)
    _isSandbox = true;
    _connected = true;
  }
}

/**
 * Closes the IAP billing connection and removes all native listeners.
 * Call in useEffect cleanup to prevent listener leaks on component unmount.
 */
export async function teardownIAP(): Promise<void> {
  if (!_connected) return;
  if (!_isSandbox) {
    try {
      await iap().endConnection();
    } catch {
      // endConnection can throw on Android if already disconnected — safe to ignore
    }
  }
  _connected = false;
}

// ─── Store Product Info ───────────────────────────────────────────────────────

export interface StoreProduct {
  productId: string;
  localizedPrice: string;
  title?: string;
  description?: string;
}

/**
 * Fetches live subscription product metadata (price, title) from the store.
 * Returns hardcoded Korean won prices when in sandbox mode.
 */
export async function getAvailableSubscriptions(): Promise<StoreProduct[]> {
  if (_isSandbox) {
    return [
      {
        productId: PLAN_SKUS.COFFEE_TALK_SINGLE,
        localizedPrice: '₩4,900/월',
        title: 'Coffee Talk',
        description: '주간 리포트 언락 + 데이트 코스 셔틀 무제한',
      },
      {
        productId: PLAN_SKUS.COFFEE_TALK_COUPLE,
        localizedPrice: '₩7,900/월',
        title: 'Coffee Talk (커플 묶음)',
        description: '주간 리포트 언락 + 데이트 코스 셔틀 무제한 · 인당 ₩3,950',
      },
      {
        productId: PLAN_SKUS.DEEP_NIGHT_SINGLE,
        localizedPrice: '₩9,900/월',
        title: 'Deep Talk Night',
        // ⚠️ HOLD (SRS 보강판 #1 §3.4): '속마음 브리핑 리포트'는 거울 철학과 충돌
        // 개연성이 있어 창업가 의사결정 전까지 문구에서 격리됨.
        description: '취중진담 연출 + 고음질 보이스 클로닝 (무제한)',
      },
      {
        productId: PLAN_SKUS.DEEP_NIGHT_COUPLE,
        localizedPrice: '₩14,900/월',
        title: 'Deep Talk Night (커플 묶음)',
        description: '취중진담 연출 + 고음질 보이스 클로닝 (무제한) · 인당 ₩7,450',
      },
    ];
  }

  try {
    const result = await iap().fetchProducts({
      skus: Object.values(PLAN_SKUS),
      type: 'subs',
    });
    const subs = (result ?? []) as Array<{ id: string; displayPrice: string; title?: string; description?: string }>;
    return subs.map((s) => ({
      productId: s.id,
      localizedPrice: s.displayPrice,
      title: s.title,
      description: s.description,
    }));
  } catch {
    return [];
  }
}

// ─── Receipt Verification ─────────────────────────────────────────────────────

async function verifyReceipt(payload: {
  platform: string;
  productId: string;
  receipt: string;
  transactionId: string;
}): Promise<{ expiresAt: string | null }> {
  const endpoint = getVerifyEndpoint();

  if (!endpoint) {
    // No backend configured (dev / preview) — trust the store receipt locally.
    return { expiresAt: null };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`VERIFY_FAILED:${res.status}`);
  }

  return res.json() as Promise<{ expiresAt: string | null }>;
}

// ─── Subscription Purchase ────────────────────────────────────────────────────

/**
 * Opens the OS native subscription sheet for the given plan.
 * Waits for the store callback, verifies the receipt with the backend,
 * and returns the updated SubscriptionStatus.
 *
 * In sandbox mode, simulates a successful purchase after 1.2 s.
 *
 * @throws `(err as Error & { userCancelled: true })` when the user dismisses
 *         the payment sheet without completing the purchase.
 */
export async function purchaseSubscription(
  planId: PlanId,
  subscriptionType: SubscriptionType = 'single',
  foundingVipDiscountActive?: boolean,
): Promise<SubscriptionStatus> {
  const sku = skuFor(planId, subscriptionType, foundingVipDiscountActive);

  if (_isSandbox) {
    await new Promise<void>((r) => setTimeout(r, 1_200));
    return { isPremium: true, planId, expiresAt: null };
  }

  return new Promise<SubscriptionStatus>((resolve, reject) => {
    let settled = false;

    function settle(fn: () => void) {
      if (settled) return;
      settled = true;
      updateSub.remove();
      errorSub.remove();
      fn();
    }

    const { purchaseUpdatedListener, purchaseErrorListener, getReceiptIOS, finishTransaction, requestPurchase } = iap();

    const updateSub = purchaseUpdatedListener(async (purchase) => {
      if (purchase.productId !== sku) return;

      let receipt: string | undefined;
      if (Platform.OS === 'ios') {
        try {
          receipt = await getReceiptIOS();
        } catch {
          receipt = undefined;
        }
      } else {
        receipt = (purchase as { purchaseToken?: string }).purchaseToken ?? undefined;
      }

      if (!receipt) {
        settle(() => reject(new Error('RECEIPT_MISSING')));
        return;
      }

      try {
        const data = await verifyReceipt({
          platform: Platform.OS,
          productId: sku,
          receipt,
          transactionId:
            (purchase as { transactionId?: string }).transactionId ??
            (purchase as { id?: string }).id ??
            '',
        });

        await finishTransaction({ purchase, isConsumable: false });

        settle(() =>
          resolve({
            isPremium: true,
            planId,
            expiresAt: data.expiresAt ?? null,
          }),
        );
      } catch (err) {
        settle(() => reject(err));
      }
    });

    const errorSub = purchaseErrorListener((err) => {
      if ((err as { code?: string }).code === 'E_USER_CANCELLED') {
        const cancelErr = new Error('USER_CANCELLED') as Error & { userCancelled: boolean };
        cancelErr.userCancelled = true;
        settle(() => reject(cancelErr));
      } else {
        settle(() => reject(new Error(String((err as { message?: string }).message ?? 'IAP_ERROR'))));
      }
    });

    requestPurchase({
      type: 'subs',
      request: {
        apple: { sku },
        google: { skus: [sku] },
      },
    }).catch((err: unknown) => settle(() => reject(err)));
  });
}

// ─── One-Time Product Purchase (used by ThemeShop) ───────────────────────────

/**
 * Triggers the OS native purchase sheet for a one-time (in-app) product.
 * Returns the transactionId on success.
 *
 * In sandbox mode, simulates success and returns a synthetic transaction ID.
 */
export async function purchaseOneTimeProduct(sku: string): Promise<string> {
  if (_isSandbox) {
    await new Promise<void>((r) => setTimeout(r, 900));
    return `sandbox-txn-${Date.now()}`;
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    function settle(fn: () => void) {
      if (settled) return;
      settled = true;
      updateSub.remove();
      errorSub.remove();
      fn();
    }

    const { purchaseUpdatedListener, purchaseErrorListener, finishTransaction, requestPurchase } = iap();

    const updateSub = purchaseUpdatedListener(async (purchase) => {
      if (purchase.productId !== sku) return;
      try {
        await finishTransaction({ purchase, isConsumable: false });
        settle(() =>
          resolve(
            (purchase as { transactionId?: string }).transactionId ??
            (purchase as { id?: string }).id ??
            '',
          ),
        );
      } catch (err) {
        settle(() => reject(err));
      }
    });

    const errorSub = purchaseErrorListener((err) => {
      if ((err as { code?: string }).code === 'E_USER_CANCELLED') {
        const cancelErr = new Error('USER_CANCELLED') as Error & { userCancelled: boolean };
        cancelErr.userCancelled = true;
        settle(() => reject(cancelErr));
      } else {
        settle(() => reject(new Error(String((err as { message?: string }).message ?? 'IAP_ERROR'))));
      }
    });

    requestPurchase({
      type: 'in-app',
      request: {
        apple: { sku },
        google: { skus: [sku] },
      },
    }).catch((err: unknown) => settle(() => reject(err)));
  });
}

// ─── Theme Ownership Verification ────────────────────────────────────────────

/**
 * Verifies theme product ownership with the backend after a successful purchase.
 * Falls back to trusting the local receipt if the backend is unreachable or
 * the API_BASE env var is not configured.
 */
export async function verifyThemeOwnership(
  sku: string,
  transactionId: string,
): Promise<boolean> {
  if (_isSandbox) return true;

  const endpoint = getThemeOwnershipEndpoint();
  if (!endpoint) return true; // No backend configured — trust locally

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, transactionId }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { owned?: boolean };
    return json.owned === true;
  } catch {
    return true; // Backend unreachable → trust successful IAP receipt locally
  }
}
