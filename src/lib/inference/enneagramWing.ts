// ─── 애니어그램 날개 조건부확률·결합분포 (v2.1 §9, Strangler Fig 신규 독립 모듈) ──
// 기존 src/engine/genesisInference.ts 를 import하지 않는다.

import type { Big5Vector, EnneagramCoreId } from '../matching/constants';
import { TAU_WING, getEnneagramAnchorMatrix } from '../matching/constants';

export type WingKey = `${EnneagramCoreId}w${EnneagramCoreId}`;

/** v2.1 §9.1 — 코어유형 i의 날개는 {i−1, i+1} (mod 9, 9와 1이 순환 인접). */
export function wingIdsOf(core: EnneagramCoreId): [EnneagramCoreId, EnneagramCoreId] {
  const low = (core === 1 ? 9 : core - 1) as EnneagramCoreId;
  const high = (core === 9 ? 1 : core + 1) as EnneagramCoreId;
  return [low, high];
}

function squaredEuclidean(a: Big5Vector, b: Big5Vector): number {
  return (a.O - b.O) ** 2 + (a.C - b.C) ** 2 + (a.E - b.E) ** 2 + (a.A - b.A) ** 2 + (a.N - b.N) ** 2;
}

export interface WingConditional {
  low: EnneagramCoreId;
  high: EnneagramCoreId;
  pLow: number; // P(wing=low | core)
  pHigh: number; // P(wing=high | core)
}

/**
 * v2.1 §9.1 — 날개 조건부확률.
 * d_lo = ‖b−E_{i−1}‖², d_hi = ‖b−E_{i+1}‖²
 * P(wing=i−1|core=i) = exp(−d_lo/2τ_w²) / [exp(−d_lo/2τ_w²)+exp(−d_hi/2τ_w²)]
 */
export function wingConditional(big5: Big5Vector, core: EnneagramCoreId): WingConditional {
  const anchors = getEnneagramAnchorMatrix();
  const [low, high] = wingIdsOf(core);

  const dLo = squaredEuclidean(big5, anchors[low]);
  const dHi = squaredEuclidean(big5, anchors[high]);
  const expLo = Math.exp(-dLo / (2 * TAU_WING * TAU_WING));
  const expHi = Math.exp(-dHi / (2 * TAU_WING * TAU_WING));
  const z = expLo + expHi;

  return { low, high, pLow: expLo / z, pHigh: expHi / z };
}

/**
 * v2.1 §9.2 — 결합확률(18칸). q(i,w) = p_i · P(w|core=i), Σ_{(i,w)} q(i,w) = 1
 */
export function jointDistribution(
  corePosterior: Record<EnneagramCoreId, number>,
  big5: Big5Vector,
): Record<WingKey, number> {
  const joint: Record<string, number> = {};
  const ids = Object.keys(corePosterior).map(Number) as EnneagramCoreId[];

  for (const core of ids) {
    const { low, high, pLow, pHigh } = wingConditional(big5, core);
    joint[`${core}w${low}`] = corePosterior[core] * pLow;
    joint[`${core}w${high}`] = corePosterior[core] * pHigh;
  }

  return joint as Record<WingKey, number>;
}

/**
 * v2.1 §9.3 — 날개 번호 주변확률. "날개로서 어떤 번호가 얼마나 등장하는지"를
 * 코어와 무관하게 합산한다. r(k) = Σ_{i : k∈wings(i)} q(i,k), Σ_k r(k) = 1
 * 결합확률 q만 주어지면 되므로 앵커행렬 없이도 동작한다.
 */
export function wingMarginal(joint: Record<string, number>): Record<EnneagramCoreId, number> {
  const marginal: Record<number, number> = {};
  for (const key of Object.keys(joint)) {
    const wing = Number(key.split('w')[1]);
    marginal[wing] = (marginal[wing] ?? 0) + joint[key];
  }
  return marginal as Record<EnneagramCoreId, number>;
}
