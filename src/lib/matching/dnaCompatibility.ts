// ─── 궁합 점수 및 표준화 (v2.1 §11-§12, Strangler Fig 신규 독립 모듈) ──────────
// 기존 src/engine/scoreCalculator.ts 를 import하지 않는다.
//
// v2.1 갱신판 §11.1/§11.2가 Readiness/Stability/PursueWithdraw/t^trait/M행렬을
// 전부 복원해, 이전 버전에서 "외부 입력 필요"로 남겨뒀던 부분을 전부 내부 계산으로
// 교체했다 — 더 이상 호출자가 이 값들을 별도로 산출해 넘길 필요가 없다.

import type { Big5Vector, EnneagramCoreId } from './constants';
import {
  DNA_PCT_CENTER,
  DNA_PCT_MAX,
  DNA_PCT_MIN,
  K_SCALE,
  MU_HAT,
  RAW_SCORE_WEIGHTS,
  SIGMA_HAT,
  WING_BONUS_DELTA,
  getEnneagramCompatibilityMatrix,
} from './constants';

export interface SternbergTriangle {
  intimacy: number;
  passion: number;
  commitment: number;
}

export interface AttachmentVector {
  anxiety: number;
  avoidance: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── §11.1 — Big Five 부분점수 ────────────────────────────────────────────────

/** 두 벡터 간 코사인 유사도. 순수 수학, 어떤 벡터에든 적용 가능한 범용 함수. */
export function cosineSimilarity(a: Big5Vector, b: Big5Vector): number {
  const dot = a.O * b.O + a.C * b.C + a.E * b.E + a.A * b.A + a.N * b.N;
  const normA = Math.sqrt(a.O ** 2 + a.C ** 2 + a.E ** 2 + a.A ** 2 + a.N ** 2);
  const normB = Math.sqrt(b.O ** 2 + b.C ** 2 + b.E ** 2 + b.A ** 2 + b.N ** 2);
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

/** v2.1 §11.1 — c_X = b_X − 0.5 (Big5를 0 중심으로 이동). cos(c_A,c_B) 계산 전 필수 전처리. */
function centerBig5(big5: Big5Vector): Big5Vector {
  return { O: big5.O - 0.5, C: big5.C - 0.5, E: big5.E - 0.5, A: big5.A - 0.5, N: big5.N - 0.5 };
}

/** v2.1 §11.1 식(11a) — Readiness_X = 0.4·(1−N_X) + 0.3·A_X + 0.3·C_X */
export function computeReadiness(big5: Big5Vector): number {
  return 0.4 * (1 - big5.N) + 0.3 * big5.A + 0.3 * big5.C;
}

/**
 * v2.1 §11.1 — Big Five 부분점수.
 * c_X = b_X−0.5,  S_B5,sim = (cos(c_A,c_B)+1)/2
 * Readiness_X = 0.4·(1−N_X)+0.3·A_X+0.3·C_X
 * S_B5 = 0.4·S_B5,sim + 0.6·[(Readiness_A+Readiness_B)/2]
 */
export function computeS_B5(bigFiveA: Big5Vector, bigFiveB: Big5Vector): number {
  const cos = cosineSimilarity(centerBig5(bigFiveA), centerBig5(bigFiveB));
  const sB5Sim = (cos + 1) / 2;
  const readinessA = computeReadiness(bigFiveA);
  const readinessB = computeReadiness(bigFiveB);
  return 0.4 * sB5Sim + 0.6 * ((readinessA + readinessB) / 2);
}

// ── §11.2 — 애니어그램 부분점수(코어+날개) ───────────────────────────────────

/** v2.1 §11.2 — S_EN,core = p_A^T · M · p_B (M은 §11.2 9×9 궁합행렬). */
export function computeS_ENCore(pA: Record<EnneagramCoreId, number>, pB: Record<EnneagramCoreId, number>): number {
  const m = getEnneagramCompatibilityMatrix();
  const ids = Object.keys(pA).map(Number) as EnneagramCoreId[];
  let sum = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = 0; j < ids.length; j++) {
      sum += pA[ids[i]] * m[i][j] * pB[ids[j]];
    }
  }
  return sum;
}

/** v2.1 §9.3/§11.2 — WingBonus = Σ_{k=1}^{9} r_A(k)·r_B(k). */
export function computeWingBonus(rA: Record<EnneagramCoreId, number>, rB: Record<EnneagramCoreId, number>): number {
  const ids = Object.keys(rA).map(Number) as EnneagramCoreId[];
  return ids.reduce((sum, id) => sum + rA[id] * (rB[id] ?? 0), 0);
}

/** v2.1 §11.2 식(8) — S_EN = (1−δ)·S_EN,core + δ·WingBonus, δ=0.08 */
export function computeS_EN(sEnCore: number, wingBonus: number, delta: number = WING_BONUS_DELTA): number {
  return (1 - delta) * sEnCore + delta * wingBonus;
}

// ── §11.1 — 스턴버그 부분점수 ─────────────────────────────────────────────────

/** v2.1 §14 예제의 "heart_X" — 코어 사후분포 중 2,3,4유형(하트그룹) 확률의 합. */
function heartGroupSum(p: Record<EnneagramCoreId, number>): number {
  return (p[2] ?? 0) + (p[3] ?? 0) + (p[4] ?? 0);
}

/**
 * v2.1 §11.1 식(11b) — 스턴버그 삼각형 성향(trait) 추정치.
 * I_X = 0.5·A_X + 0.3·heart_X + 0.2·(1−N_X)
 * P_X = 0.5·E_X + 0.5·O_X
 * C_X = 0.6·C_X(성실성) + 0.4·(1−avo_X)
 */
export function computeSternbergTrait(
  big5: Big5Vector,
  enneagramCorePosterior: Record<EnneagramCoreId, number>,
  avoidance: number,
): SternbergTriangle {
  const heart = heartGroupSum(enneagramCorePosterior);
  return {
    intimacy: 0.5 * big5.A + 0.3 * heart + 0.2 * (1 - big5.N),
    passion: 0.5 * big5.E + 0.5 * big5.O,
    commitment: 0.6 * big5.C + 0.4 * (1 - avoidance),
  };
}

/** v2.1 §11.1 — t_X = 0.6·t^state_X + 0.4·t^trait_X */
export function blendSternberg(state: SternbergTriangle, trait: SternbergTriangle): SternbergTriangle {
  return {
    intimacy: 0.6 * state.intimacy + 0.4 * trait.intimacy,
    passion: 0.6 * state.passion + 0.4 * trait.passion,
    commitment: 0.6 * state.commitment + 0.4 * trait.commitment,
  };
}

/** v2.1 §11.1 — S_ST = 1 − ‖t_A−t_B‖/√3 */
export function computeS_ST(tA: SternbergTriangle, tB: SternbergTriangle): number {
  const dist = Math.sqrt(
    (tA.intimacy - tB.intimacy) ** 2 + (tA.passion - tB.passion) ** 2 + (tA.commitment - tB.commitment) ** 2,
  );
  return 1 - dist / Math.sqrt(3);
}

// ── §11.1 — 애착 부분점수 ─────────────────────────────────────────────────────

/** v2.1 §11.1 식(11c) — Stability_X = 1 − 0.5·(anx_X + avo_X) */
export function computeStability(attachment: AttachmentVector): number {
  return 1 - 0.5 * (attachment.anxiety + attachment.avoidance);
}

/** v2.1 §11.1 식(11c) — PursueWithdraw = anx_A·avo_B + anx_B·avo_A */
export function computePursueWithdraw(attachmentA: AttachmentVector, attachmentB: AttachmentVector): number {
  return attachmentA.anxiety * attachmentB.avoidance + attachmentB.anxiety * attachmentA.avoidance;
}

/** v2.1 §11.1 — S_ATT = clamp(0.5·(Stability_A+Stability_B) − 0.5·PursueWithdraw, 0, 1) */
export function computeS_ATT(attachmentA: AttachmentVector, attachmentB: AttachmentVector): number {
  const stabilityA = computeStability(attachmentA);
  const stabilityB = computeStability(attachmentB);
  const pursueWithdraw = computePursueWithdraw(attachmentA, attachmentB);
  return clamp(0.5 * (stabilityA + stabilityB) - 0.5 * pursueWithdraw, 0, 1);
}

// ── §12 — 원점수 결합과 표준화 ────────────────────────────────────────────────

/** v2.1 §12 식(9) — S_raw = 0.25·S_B5 + 0.15·S_EN + 0.30·S_ST + 0.30·S_ATT */
export function computeSRaw(sB5: number, sEN: number, sST: number, sATT: number): number {
  return RAW_SCORE_WEIGHTS.B5 * sB5 + RAW_SCORE_WEIGHTS.EN * sEN + RAW_SCORE_WEIGHTS.ST * sST + RAW_SCORE_WEIGHTS.ATT * sATT;
}

/**
 * v2.1 §12 식(10) — DNA% = clamp(75 + k·(S_raw−μ̂)/σ̂, 50, 100)
 * μ̂=0.5259, σ̂=0.0726, k=25/2.5758≈9.7056.
 */
export function computeDnaPercent(sRaw: number): number {
  const z = (sRaw - MU_HAT) / SIGMA_HAT;
  return clamp(DNA_PCT_CENTER + K_SCALE * z, DNA_PCT_MIN, DNA_PCT_MAX);
}
