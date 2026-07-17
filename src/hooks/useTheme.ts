// ─── useTheme — 6 Sigma 테마 훅 (Phase 6 1단계, §8 FUN-SET-001B 라이트 모드) ──────
// sessionStore.themeMode에 따라 분기한다: light/dark는 고정 팔레트, sigma는
// personaMatrix.auraVector가 있으면(제네시스 완료) 개인화된 SigmaTheme, 없으면
// (온보딩 전/진행 중) 라이트 팔레트로 폴백한다.

import { useSessionStore } from '@/store/sessionStore';
import { useUserStore } from '@/store/userStore';
import { buildSigmaTheme, getDefaultDarkTheme, getLightTheme, type SigmaTheme } from '@/constants/theme';
import { SYS } from '@/constants/colors';

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

  // sigma: 제네시스 완료 시 오라 기반 테마, 미완료 시 라이트
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
  return getLightTheme();
}
