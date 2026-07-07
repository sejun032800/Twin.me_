// ─── useTheme — 6 Sigma 테마 훅 (Phase 6 1단계) ──────────────────────────────
// personaMatrix.auraVector가 있으면(제네시스 완료) 개인화된 SigmaTheme을,
// 없으면(온보딩 전/진행 중) 고정 다크 팔레트를 반환한다.

import { useUserStore } from '@/store/userStore';
import { buildSigmaTheme, getDefaultDarkTheme, type SigmaTheme } from '@/constants/theme';

export function useTheme(): SigmaTheme {
  const auraVector = useUserStore((s) => s.personaMatrix?.auraVector);

  if (auraVector) {
    return buildSigmaTheme(auraVector);
  }
  return getDefaultDarkTheme();
}
