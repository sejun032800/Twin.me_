// ─── useTheme — 6 Sigma 테마 훅 (Phase 6 1단계, §8 FUN-SET-001B 라이트 모드) ──────
// sessionStore.themeMode에 따라 분기한다: light/dark는 고정 팔레트, sigma는
// personaMatrix.auraVector가 있으면(제네시스 완료) 개인화된 SigmaTheme, 없으면
// (온보딩 전/진행 중) 라이트 팔레트로 폴백한다.

import { useSessionStore } from '@/store/sessionStore';
import { useUserStore } from '@/store/userStore';
import { buildSigmaTheme, getDefaultDarkTheme, getLightTheme, type SigmaTheme } from '@/constants/theme';

export function useTheme(): SigmaTheme {
  const themeMode = useSessionStore((s) => s.themeMode);
  const personaMatrix = useUserStore((s) => s.personaMatrix);

  if (themeMode === 'light') return getLightTheme();
  if (themeMode === 'dark') return getDefaultDarkTheme();

  // sigma: 제네시스 완료 시 오라 기반 테마, 미완료 시 라이트
  if (personaMatrix?.auraVector) {
    return buildSigmaTheme(personaMatrix.auraVector);
  }
  return getLightTheme();
}
