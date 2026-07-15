// ─── 기능 플래그 (Phase 3) ──────────────────────────────────────────────────
// FEATURE_DNA_V21 — 연애 DNA v2.1 적응형 인터뷰 경로. 기본값 false(OFF).
// 저장소에 기존 원격 설정(remote config) 체계가 없어 가장 단순한 env 기반으로
// 도입한다. 개발 중에는 sessionStore.devFeatureDnaV21Override(설정 탭 개발자
// 메뉴 토글)로 런타임 재정의가 가능하다 — env 값보다 우선한다.

import { useSessionStore } from '@/store/sessionStore';

const ENV_DEFAULT = process.env.EXPO_PUBLIC_FEATURE_DNA_V21 === 'true';

export function useFeatureDnaV21(): boolean {
  const override = useSessionStore((s) => s.devFeatureDnaV21Override);
  return override ?? ENV_DEFAULT;
}
