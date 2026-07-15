// ─── 베이지안 사후분포 갱신 (v2.1 §8, Phase 0 신규 독립 모듈) ──────────────────
// 정규-정규 켤레(연속차원: Big5·애착)와 곱셈적 우도(애니어그램 코어) 갱신을 구현한다.
// 기존 src/engine/genesisInference.ts 를 import하지 않는다 — Strangler Fig Phase 0.
//
// σ_obs에 대한 참고: v2.1 §8은 "σ_obs = σ_item/√k"라고 서술하지만 σ_item(1턴 관측의
// 기저 노이즈 표준편차)의 실제 수치는 v2.1 어디에도 없다. 구현명세서 §6은 이를
// "confidence가 낮을수록 σ_obs를 확대"한다고 설명하므로, σ_obs는 이 모듈이 임의로
// 정하는 상수가 아니라 호출자(Gemini 파싱 confidence·turn count 등을 아는 상위 레이어)가
// 계산해 넘기는 입력값으로 설계했다 — 켤레 갱신 공식 자체(아래)는 v2.1 §8에 그대로 있다.

import type { Big5Vector, EnneagramCoreId } from '../matching/constants';

export interface ScalarPosterior {
  mean: number;
  variance: number;
}

/**
 * v2.1 §8 — 정규-정규 켤레 갱신(단일 스칼라 차원).
 * μ_post = [σ_obs²·μ_prior + σ_prior²·x̄] / [σ_obs² + σ_prior²]
 *
 * 사후분산은 v2.1 §8 본문에 명시적 수식이 없으나, 정규-정규 켤레의 표준 결과인
 * 조화평균 σ_post² = (σ_obs²·σ_prior²)/(σ_obs²+σ_prior²)를 사용한다(교재상 자명한
 * 보조 결과 — v2.1이 직접 인용한 값은 아니므로 별도 표기).
 */
export function updateScalarConjugate(
  priorMean: number,
  priorVariance: number,
  observedValue: number,
  obsVariance: number,
): ScalarPosterior {
  const denom = obsVariance + priorVariance;
  const posteriorMean = (obsVariance * priorMean + priorVariance * observedValue) / denom;
  const posteriorVariance = (obsVariance * priorVariance) / denom;
  return { mean: posteriorMean, variance: posteriorVariance };
}

/**
 * v2.1 §8 — Big5 중 한 차원을 갱신한다. 매 턴 즉시 갱신(스트리밍) 원칙에 따라
 * 한 번에 하나의 차원만 관측되므로, 나머지 차원은 그대로 통과시킨다.
 */
export function updateBig5Posterior(
  priorMean: Big5Vector,
  priorVariance: Record<keyof Big5Vector, number>,
  dimension: keyof Big5Vector,
  observedValue: number,
  obsVariance: number,
): { mean: Big5Vector; variance: Record<keyof Big5Vector, number> } {
  const { mean, variance } = updateScalarConjugate(
    priorMean[dimension],
    priorVariance[dimension],
    observedValue,
    obsVariance,
  );
  return {
    mean: { ...priorMean, [dimension]: mean },
    variance: { ...priorVariance, [dimension]: variance },
  };
}

export type AttachmentDimension = 'anxiety' | 'avoidance';

/**
 * v2.1 §8 — 애착(anx/avo) 중 한 차원을 갱신한다. Big5와 동일한 정규-정규 켤레 메커니즘.
 */
export function updateAttachmentPosterior(
  priorMean: Record<AttachmentDimension, number>,
  priorVariance: Record<AttachmentDimension, number>,
  dimension: AttachmentDimension,
  observedValue: number,
  obsVariance: number,
): { mean: Record<AttachmentDimension, number>; variance: Record<AttachmentDimension, number> } {
  const { mean, variance } = updateScalarConjugate(
    priorMean[dimension],
    priorVariance[dimension],
    observedValue,
    obsVariance,
  );
  return {
    mean: { ...priorMean, [dimension]: mean },
    variance: { ...priorVariance, [dimension]: variance },
  };
}

/**
 * v2.1 §8 — 애니어그램 코어 곱셈적 우도 갱신.
 * p_i^(post) ∝ p_i^(prior) · L(응답|코어유형 i)
 * likelihood는 희소맵 허용 — 명시되지 않은 유형은 우도 1.0(무정보)으로 취급한다.
 */
export function updateEnneagramCorePosterior(
  prior: Record<EnneagramCoreId, number>,
  likelihood: Partial<Record<EnneagramCoreId, number>>,
): Record<EnneagramCoreId, number> {
  const ids = Object.keys(prior).map(Number) as EnneagramCoreId[];
  const unnormalized: Record<EnneagramCoreId, number> = {} as Record<EnneagramCoreId, number>;
  let z = 0;
  for (const id of ids) {
    const l = likelihood[id] ?? 1.0;
    const value = prior[id] * l;
    unnormalized[id] = value;
    z += value;
  }

  const posterior: Record<EnneagramCoreId, number> = {} as Record<EnneagramCoreId, number>;
  for (const id of ids) {
    posterior[id] = z > 0 ? unnormalized[id] / z : 1 / ids.length;
  }
  return posterior;
}
