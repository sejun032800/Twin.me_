// ─── PsychProfile → PersonProfileV21 어댑터 (Phase 3) ──────────────────────────
// userStore.psychProfile(적응형 인터뷰가 채우는 사후상태)은 computeRomanticDnaV21이
// 요구하는 PersonProfileV21과 형태가 다르다(조사 결과):
//   - enneagramCore: number[](길이 9, index i ↔ EnneagramCoreId i+1) → Record<EnneagramCoreId, number>
//   - enneagramWingJoint: Record<string, number>(key="{core}w{wing}") → Record<WingKey, number>
//   - wingMarginal 필드 자체가 PsychProfile에는 없어 재계산이 필요
//   - sternbergState/mbtiEstimated는 PsychProfile에서 null 가능 — PersonProfileV21은 non-null 요구
// analyzePersonV21()을 다시 호출하지 않고(원본 InterviewResponses 스트림이 이미 소실됨),
// 이미 계산된 사후값을 직접 변환한다.

import { ENNEAGRAM_TYPE_IDS, type EnneagramCoreId } from './constants';
import { wingMarginal as computeWingMarginal, type WingKey } from '../inference/enneagramWing';
import { reestimateMbtiAxes } from '../inference/mbtiReestimate';
import type { PersonProfileV21 } from './computeRomanticDNA';
import type { PsychProfile } from '@/store/userStore';

/** 관계 특이적 데이터(스턴버그)가 아직 없을 때(파트너 미연결 등)의 중립값 — §7 척도 중앙값. */
const NEUTRAL_STERNBERG = { intimacy: 0.5, passion: 0.5, commitment: 0.5 };

export function psychProfileToPersonProfileV21(profile: PsychProfile): PersonProfileV21 {
  const enneagramCorePosterior = {} as Record<EnneagramCoreId, number>;
  ENNEAGRAM_TYPE_IDS.forEach((id, i) => {
    enneagramCorePosterior[id] = profile.enneagramCore[i] ?? 0;
  });

  const wingJoint = profile.enneagramWingJoint as Record<WingKey, number>;

  return {
    big5Posterior: profile.big5,
    attachmentPosterior: profile.attachment,
    enneagramCorePosterior,
    wingJoint,
    wingMarginal: computeWingMarginal(wingJoint),
    sternbergState: profile.sternbergState ?? NEUTRAL_STERNBERG,
    // 궁합 계산에는 사용하지 않는 출력 전용 값(§10) — big5Posterior의 결정론적 함수라 매번 재계산해도 동일하다.
    mbtiEstimate: reestimateMbtiAxes(profile.big5),
  };
}
