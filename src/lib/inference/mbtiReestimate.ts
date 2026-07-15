// ─── MBTI 축 재추정 (v2.1 §10, 보너스 — 출력 전용) — Phase 0 신규 독립 모듈 ────
// 구현명세서 §3: "이 값은 궁합 점수 계산에는 관여하지 않는 순수 출력 기능" — 아래
// 결과는 lib/matching/dnaCompatibility.ts / computeRomanticDNA.ts의 어떤 계산에도
// 입력으로 사용되지 않는다. 기존 엔진 파일을 import하지 않는다 — Strangler Fig Phase 0.

import type { Big5Vector } from '../matching/constants';
import { MBTI_REESTIMATE_SCALE } from '../matching/constants';

export interface MbtiAxisEstimate {
  pE: number; // P(축=E), s=0.15 기준 로지스틱
  pN_axis: number; // P(축=N), N/S↔O 대응
  pF: number; // P(축=F), T/F↔A 대응
  pJ: number; // P(축=J), J/P↔C 대응
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * v2.1 §10 식(6) — P(축=E) = σ_logistic((E_post−0.5)/s), s=0.15
 * (N/S↔O, T/F↔A, J/P↔C에 동일 구조 적용)
 */
export function reestimateMbtiAxes(big5Posterior: Big5Vector, s: number = MBTI_REESTIMATE_SCALE): MbtiAxisEstimate {
  return {
    pE: sigmoid((big5Posterior.E - 0.5) / s),
    pN_axis: sigmoid((big5Posterior.O - 0.5) / s),
    pF: sigmoid((big5Posterior.A - 0.5) / s),
    pJ: sigmoid((big5Posterior.C - 0.5) / s),
  };
}
