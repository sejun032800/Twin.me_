// ─── 오케스트레이션 (v2.1 §13, Strangler Fig 신규 독립 모듈) ───────────────────
// analyzePersonV21() / computeRomanticDnaV21() — 하위 순수함수 모듈들을 §13
// 의사코드 순서 그대로 연결한다. 기존 엔진/스토어 파일을 import하지 않는다.
//
// v2.1 갱신판이 앵커행렬(§2)·M행렬(§11.2)·Readiness/Stability/PursueWithdraw/t^trait
// (§11.1)를 전부 복원해, 이전 버전에서 필요했던 `ExternalCompatibilityInputs`
// (외부에서 계산해 넘겨야 했던 값들)가 더 이상 필요 없다 — 두 사람의 사후 프로필만
// 있으면 전체 체인이 끝까지 계산된다.

import type { Big5Vector, EnneagramCoreId } from './constants';
import { attachmentPrior, big5Prior, enneagramCorePrior } from '../inference/mbtiPrior';
import {
  updateAttachmentPosterior,
  updateBig5Posterior,
  updateEnneagramCorePosterior,
} from '../inference/bayesianUpdate';
import { jointDistribution, wingMarginal, type WingKey } from '../inference/enneagramWing';
import { reestimateMbtiAxes, type MbtiAxisEstimate } from '../inference/mbtiReestimate';
import {
  blendSternberg,
  computeDnaPercent,
  computeS_ATT,
  computeS_B5,
  computeS_EN,
  computeS_ENCore,
  computeS_ST,
  computeSRaw,
  computeSternbergTrait,
  computeWingBonus,
  type AttachmentVector,
  type SternbergTriangle,
} from './dnaCompatibility';

export interface ScalarObservation {
  value: number;
  obsVariance: number;
}

export interface InterviewResponses {
  /** 스트리밍 순서대로 적용되는 Big5 관측(§8). 안 물어본 차원은 생략 가능 — MBTI 사전값 유지. */
  big5Observations: Partial<Record<keyof Big5Vector, ScalarObservation>>;
  /** 스트리밍 순서대로 적용되는 애착 관측(§8). */
  attachmentObservations: Partial<Record<'anxiety' | 'avoidance', ScalarObservation>>;
  /** 턴 순서대로 적용되는 애니어그램 코어 우도(§8 곱셈적 갱신, 희소맵). */
  enneagramLikelihoods: Partial<Record<EnneagramCoreId, number>>[];
  /** §7 유형 C — 스턴버그 관계상태 직답(고정 3문항, 엔트로피 무관). */
  sternbergState: SternbergTriangle;
}

export interface PersonProfileV21 {
  big5Posterior: Big5Vector;
  attachmentPosterior: AttachmentVector;
  enneagramCorePosterior: Record<EnneagramCoreId, number>;
  wingJoint: Record<WingKey, number>;
  wingMarginal: Record<EnneagramCoreId, number>;
  sternbergState: SternbergTriangle;
  mbtiEstimate: MbtiAxisEstimate; // §10, 궁합 계산에는 사용하지 않는 출력 전용 값
}

/** v2.1 §13 `analyze_person_v21` — MBTI 사전값 → 인터뷰 관측 반영 → 사후상태 반환. */
export function analyzePersonV21(mbti: string, interview: InterviewResponses): PersonProfileV21 {
  let big5 = big5Prior(mbti);
  let attachment = attachmentPrior(big5);
  let big5Variance = { O: 0.12 ** 2, C: 0.12 ** 2, E: 0.12 ** 2, A: 0.12 ** 2, N: 0.18 ** 2 };
  let attachmentVariance = { anxiety: 0.2 ** 2, avoidance: 0.22 ** 2 };

  let enneagramCore = enneagramCorePrior(big5);

  for (const [dimension, obs] of Object.entries(interview.big5Observations) as [keyof Big5Vector, ScalarObservation][]) {
    const updated = updateBig5Posterior(big5, big5Variance, dimension, obs.value, obs.obsVariance);
    big5 = updated.mean;
    big5Variance = updated.variance;
  }

  for (const [dimension, obs] of Object.entries(interview.attachmentObservations) as [
    'anxiety' | 'avoidance',
    ScalarObservation,
  ][]) {
    const updated = updateAttachmentPosterior(attachment, attachmentVariance, dimension, obs.value, obs.obsVariance);
    attachment = updated.mean;
    attachmentVariance = updated.variance;
  }

  for (const likelihood of interview.enneagramLikelihoods) {
    enneagramCore = updateEnneagramCorePosterior(enneagramCore, likelihood);
  }

  const wingJoint = jointDistribution(enneagramCore, big5);
  const wingMarg = wingMarginal(wingJoint);
  const mbtiEstimate = reestimateMbtiAxes(big5);

  return {
    big5Posterior: big5,
    attachmentPosterior: attachment,
    enneagramCorePosterior: enneagramCore,
    wingJoint,
    wingMarginal: wingMarg,
    sternbergState: interview.sternbergState,
    mbtiEstimate,
  };
}

export interface RomanticDnaResult {
  dna_pct: number;
  S_B5: number;
  S_EN: number;
  S_ST: number;
  S_ATT: number;
}

/** v2.1 §13 `compute_romantic_dna_v21` — 두 사람의 사후 프로필만으로 DNA%까지 전부 계산한다. */
export function computeRomanticDnaV21(profileA: PersonProfileV21, profileB: PersonProfileV21): RomanticDnaResult {
  const sB5 = computeS_B5(profileA.big5Posterior, profileB.big5Posterior);

  const sEnCore = computeS_ENCore(profileA.enneagramCorePosterior, profileB.enneagramCorePosterior);
  const wingBonus = computeWingBonus(profileA.wingMarginal, profileB.wingMarginal);
  const sEN = computeS_EN(sEnCore, wingBonus);

  const traitA = computeSternbergTrait(profileA.big5Posterior, profileA.enneagramCorePosterior, profileA.attachmentPosterior.avoidance);
  const traitB = computeSternbergTrait(profileB.big5Posterior, profileB.enneagramCorePosterior, profileB.attachmentPosterior.avoidance);
  const tA = blendSternberg(profileA.sternbergState, traitA);
  const tB = blendSternberg(profileB.sternbergState, traitB);
  const sST = computeS_ST(tA, tB);

  const sATT = computeS_ATT(profileA.attachmentPosterior, profileB.attachmentPosterior);

  const sRaw = computeSRaw(sB5, sEN, sST, sATT);
  const dnaPct = computeDnaPercent(sRaw);

  return { dna_pct: dnaPct, S_B5: sB5, S_EN: sEN, S_ST: sST, S_ATT: sATT };
}
