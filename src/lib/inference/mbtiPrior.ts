// ─── MBTI 기반 초기 사전분포 (v2.1 §2, Phase 0 신규 독립 모듈) ─────────────────
// 기존 src/engine/genesisInference.ts 를 import하지 않는다 — Strangler Fig Phase 0.

import type { Big5Vector, EnneagramCoreId } from '../matching/constants';
import { TAU_CORE, getEnneagramAnchorMatrix } from '../matching/constants';

export type MbtiType = string;

const MBTI_RE = /^[EI][SN][TF][JP]$/;

function assertValidMbti(mbti: MbtiType): asserts mbti is string {
  if (!MBTI_RE.test(mbti)) {
    throw new Error(`[mbtiPrior] 유효하지 않은 MBTI 문자열: "${mbti}" (EISNTFJP 4글자여야 함)`);
  }
}

/**
 * v2.1 §2 — MBTI 기반 Big Five 초기 사전분포.
 * O = 0.5 + 0.15·sign(N/S; N=+1,S=−1)
 * C = 0.5 + 0.15·sign(J/P; J=+1,P=−1)
 * E = 0.5 + 0.15·sign(E/I; E=+1,I=−1)
 * A = 0.5 + 0.15·sign(T/F; F=+1,T=−1)
 * N = 0.5 + 0.05·sign(T/F;F=+1,T=−1) + 0.05·sign(E/I;I=+1,E=−1)
 */
export function big5Prior(mbti: MbtiType): Big5Vector {
  const normalized = mbti.toUpperCase();
  assertValidMbti(normalized);
  const [ei, sn, tf, jp] = normalized.split('');

  const signNS = sn === 'N' ? 1 : -1;
  const signJP = jp === 'J' ? 1 : -1;
  const signEI = ei === 'E' ? 1 : -1;
  const signTF_F = tf === 'F' ? 1 : -1;
  const signEI_I = ei === 'I' ? 1 : -1;

  return {
    O: 0.5 + 0.15 * signNS,
    C: 0.5 + 0.15 * signJP,
    E: 0.5 + 0.15 * signEI,
    A: 0.5 + 0.15 * signTF_F,
    N: 0.5 + 0.05 * signTF_F + 0.05 * signEI_I,
  };
}

/**
 * v2.1 §2 — 애착 초기값. anx⁽⁰⁾ = N⁽⁰⁾,  avo⁽⁰⁾ = 1 − (E⁽⁰⁾+A⁽⁰⁾)/2
 */
export function attachmentPrior(big5: Big5Vector): { anxiety: number; avoidance: number } {
  return {
    anxiety: big5.N,
    avoidance: 1 - (big5.E + big5.A) / 2,
  };
}

function squaredEuclidean(a: Big5Vector, b: Big5Vector): number {
  return (a.O - b.O) ** 2 + (a.C - b.C) ** 2 + (a.E - b.E) ** 2 + (a.A - b.A) ** 2 + (a.N - b.N) ** 2;
}

/**
 * v2.1 §2 — 애니어그램 코어 초기값. 9개 원형 앵커 E_i와의 softmax 거리:
 * p_i⁽⁰⁾ = exp(−‖b⁽⁰⁾−E_i‖²/2τ_c²) / Σⱼ(...),   τ_c = 0.35
 */
export function enneagramCorePrior(big5: Big5Vector): Record<EnneagramCoreId, number> {
  const anchors = getEnneagramAnchorMatrix();

  const ids = Object.keys(anchors) as unknown as EnneagramCoreId[];
  const scores = ids.map((id) => Math.exp(-squaredEuclidean(big5, anchors[id]) / (2 * TAU_CORE * TAU_CORE)));
  const sum = scores.reduce((a, c) => a + c, 0);

  const result = {} as Record<EnneagramCoreId, number>;
  ids.forEach((id, i) => {
    result[id] = scores[i] / sum;
  });
  return result;
}
