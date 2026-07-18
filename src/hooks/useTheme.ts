// ─── useTheme — 6 Sigma 테마 훅 (Phase 6 1단계, §8 FUN-SET-001B 라이트 모드) ──────
// sessionStore.themeMode에 따라 분기한다: light/dark는 고정 팔레트, sigma는
// personaMatrix.auraVector가 있으면(제네시스 완료) 개인화된 SigmaTheme, 없으면
// (온보딩 전/진행 중, 정상 흐름에서는 발생하지 않아야 함) dark 고정 팔레트로 폴백한다.

import { useSessionStore } from '@/store/sessionStore';
import { useUserStore } from '@/store/userStore';
import { buildSigmaTheme, getDefaultDarkTheme, getLightTheme, type SigmaTheme } from '@/constants/theme';
import { SYS } from '@/constants/colors';
import {
  resolveSigmaAuraOpacity,
  type AuraOpacityTierValue,
  type ContextMultiplierOptions,
  type SigmaAuraScreenKey,
} from '@/engine/auraThemeEngine';

// §8 FUN-SET-001B — 오라 끄기(reduceAuraMotion) 시 sigma 테마의 오라 파생 색상을 전부
// 무채색으로 오버라이드한다. light/dark는 애초에 오라와 무관한 고정 팔레트라 대상에서 제외한다.
const REDUCED_AURA_ACCENT = SYS.TEXT_MUTED;
const REDUCED_AURA_GRADIENT_STOPS = [REDUCED_AURA_ACCENT, REDUCED_AURA_ACCENT] as const;

export function useTheme(): SigmaTheme {
  const themeMode = useSessionStore((s) => s.themeMode);
  const personaMatrix = useUserStore((s) => s.personaMatrix);
  const reduceAuraMotion = useSessionStore((s) => s.reduceAuraMotion);

  if (themeMode === 'light') return getLightTheme();
  if (themeMode === 'dark') return getDefaultDarkTheme();

  // sigma: 제네시스 완료 시 오라 기반 테마, 미완료(엣지케이스) 시 아래에서 dark로 폴백
  if (personaMatrix?.auraVector) {
    const sigmaTheme = buildSigmaTheme(personaMatrix.auraVector);
    if (reduceAuraMotion) {
      return {
        ...sigmaTheme,
        /** @deprecated v2.6까지의 dominant-1축 단색 노출 필드. 신규 소비처는
         * primaryAuraColor(또는 gradientStops)를 쓸 것 — 기존 소비처 마이그레이션
         * 전까지 값만 primaryAuraColor와 동일하게 유지한다. */
        accent: REDUCED_AURA_ACCENT,
        primaryAuraColor: REDUCED_AURA_ACCENT,
        secondaryAuraColor: REDUCED_AURA_ACCENT,
        gradientStops: REDUCED_AURA_GRADIENT_STOPS,
      };
    }
    return sigmaTheme;
  }
  // themeMode==='sigma'인데 auraVector가 아직 없는 엣지케이스 — light가 아니라
  // getDefaultDarkTheme()으로 폴백한다. index.tsx의 mainBaseBg도 이 엣지케이스에서
  // dark로 폴백하도록 맞춰뒀으므로(effectiveThemeMode), 배경/텍스트/카드 색상 체계가
  // 같은 방향(dark)으로 일관되게 떨어져야 라이트/다크가 섞인 화면이 안 생긴다.
  return getDefaultDarkTheme();
}

/**
 * 6sigma 전용 화면별 오라 opacity 조회 훅(STEP 11-1) — themeMode를 직접 읽어
 * AURA_OPACITY_TIERS(auraThemeEngine.ts)를 조회한다. themeMode!=='sigma'면 무조건
 * 0(오라 미노출) — light/dark는 이 opacity 체계와 완전히 무관하다.
 * chatRoom은 'frozen' 마커를 그대로 반환하며, 이를 실제 opacity 숫자로 고정하는
 * 로직은 11-2(freeze 로직)에서 구현한다.
 * 아직 어떤 화면(app/(tabs)/*.tsx)에서도 호출하지 않는다 — 11-4~11-7에서 화면별로 연결 예정.
 */
export function useSigmaAuraOpacity(
  screenKey: SigmaAuraScreenKey,
  opts: ContextMultiplierOptions = {},
): AuraOpacityTierValue | number {
  const themeMode = useSessionStore((s) => s.themeMode);
  if (themeMode !== 'sigma') return 0;
  return resolveSigmaAuraOpacity(screenKey, opts);
}
