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

// FEATURE_AI_DATE_RECOMMEND — AI 데이트 코스 셔틀(FUN-HIS-002/006/007, v2.7.1).
// 기본값 false(OFF). docs/date-recommend-architecture.md 레이어4/5(후보군 생성,
// LLM 구성)와 신규 모달 라우트(app/(modals)/date-recommend-*)를 이 플래그로
// 감싼다. FEATURE_DNA_V21과 동일하게 env 기본값 + sessionStore 개발자 메뉴
// 오버라이드를 지원한다 — 이번 커밋의 마이그레이션(date_photo_stamps 등)
// 자체는 이 플래그와 무관하게 적용되지만, 이후 작성할 기능 코드는 전부 이
// 플래그로 감싼다.
const ENV_DEFAULT_AI_DATE_RECOMMEND = process.env.EXPO_PUBLIC_FEATURE_AI_DATE_RECOMMEND === 'true';

export function useFeatureAiDateRecommend(): boolean {
  const override = useSessionStore((s) => s.devFeatureAiDateRecommendOverride);
  return override ?? ENV_DEFAULT_AI_DATE_RECOMMEND;
}
