// ─── dnaCompatibility.ts 단위 검증 + 골든 테스트 #5 (경계값 fuzzing) ──────────
// 골든 테스트 #4(캐노니컬 커플 전체 파이프라인)는 computeRomanticDNA.test.ts에서
// analyzePersonV21()/computeRomanticDnaV21() 전체 체인으로 검증한다 — 여기서는
// v2.1 §14 예제의 중간 계산식(Readiness, S_ST 성향값, S_ATT 등)을 개별 함수 단위로
// 검증한다.

import {
  computeDnaPercent,
  computeS_ATT,
  computeS_B5,
  computeS_ENCore,
  computeS_ST,
  computeSRaw,
  computeSternbergTrait,
  computeStability,
  computePursueWithdraw,
  computeReadiness,
  computeWingBonus,
  cosineSimilarity,
  blendSternberg,
} from '../dnaCompatibility';

function expectWithinTolerance(actual: number, expected: number, tolerance: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

// v2.1 §14 캐노니컬 커플 원시값
const BIG5_A = { O: 0.7, C: 0.4, E: 0.75, A: 0.65, N: 0.45 };
const BIG5_B = { O: 0.35, C: 0.8, E: 0.3, A: 0.45, N: 0.35 };
const P_A = { 1: 0.03, 2: 0.2, 3: 0.03, 4: 0.05, 5: 0.03, 6: 0.03, 7: 0.55, 8: 0.03, 9: 0.05 };
const P_B = { 1: 0.5, 2: 0.05, 3: 0.1, 4: 0.05, 5: 0.15, 6: 0.1, 7: 0.02, 8: 0.02, 9: 0.01 };
const ATTACHMENT_A = { anxiety: 0.35, avoidance: 0.25 };
const ATTACHMENT_B = { anxiety: 0.2, avoidance: 0.45 };
const STATE_A = { intimacy: 0.8, passion: 0.75, commitment: 0.55 };
const STATE_B = { intimacy: 0.55, passion: 0.45, commitment: 0.7 };

describe('v2.1 §14 중간 계산식 — 개별 함수 검증', () => {
  it('Readiness_A ≈ 0.535, Readiness_B ≈ 0.635', () => {
    expectWithinTolerance(computeReadiness(BIG5_A), 0.535, 0.001);
    expectWithinTolerance(computeReadiness(BIG5_B), 0.635, 0.001);
  });

  it('S_B5 ≈ 0.410 (cos(c_A,c_B)≈-0.704 경유)', () => {
    expectWithinTolerance(computeS_B5(BIG5_A, BIG5_B), 0.41, 0.001);
  });

  it('t^trait_A ≈ (0.519, 0.725, 0.540), t^trait_B ≈ (0.415, 0.325, 0.700)', () => {
    const traitA = computeSternbergTrait(BIG5_A, P_A, ATTACHMENT_A.avoidance);
    const traitB = computeSternbergTrait(BIG5_B, P_B, ATTACHMENT_B.avoidance);
    expectWithinTolerance(traitA.intimacy, 0.519, 0.001);
    expectWithinTolerance(traitA.passion, 0.725, 0.001);
    expectWithinTolerance(traitA.commitment, 0.54, 0.001);
    expectWithinTolerance(traitB.intimacy, 0.415, 0.001);
    expectWithinTolerance(traitB.passion, 0.325, 0.001);
    expectWithinTolerance(traitB.commitment, 0.7, 0.001);
  });

  it('t_A ≈ (0.688, 0.740, 0.546), t_B ≈ (0.496, 0.400, 0.700), S_ST ≈ 0.758', () => {
    const traitA = computeSternbergTrait(BIG5_A, P_A, ATTACHMENT_A.avoidance);
    const traitB = computeSternbergTrait(BIG5_B, P_B, ATTACHMENT_B.avoidance);
    const tA = blendSternberg(STATE_A, traitA);
    const tB = blendSternberg(STATE_B, traitB);
    expectWithinTolerance(tA.intimacy, 0.688, 0.001);
    expectWithinTolerance(tA.passion, 0.74, 0.001);
    expectWithinTolerance(tA.commitment, 0.546, 0.001);
    expectWithinTolerance(tB.intimacy, 0.496, 0.001);
    expectWithinTolerance(tB.passion, 0.4, 0.001);
    expectWithinTolerance(tB.commitment, 0.7, 0.001);
    expectWithinTolerance(computeS_ST(tA, tB), 0.758, 0.001);
  });

  it('Stability_A ≈ 0.700, Stability_B ≈ 0.675, PursueWithdraw ≈ 0.2075, S_ATT ≈ 0.584', () => {
    expectWithinTolerance(computeStability(ATTACHMENT_A), 0.7, 0.001);
    expectWithinTolerance(computeStability(ATTACHMENT_B), 0.675, 0.001);
    expectWithinTolerance(computePursueWithdraw(ATTACHMENT_A, ATTACHMENT_B), 0.2075, 0.001);
    expectWithinTolerance(computeS_ATT(ATTACHMENT_A, ATTACHMENT_B), 0.584, 0.001);
  });

  it('S_EN,core ≈ 0.604 (M행렬 실제값 사용)', () => {
    expectWithinTolerance(computeS_ENCore(P_A, P_B), 0.604, 0.001);
  });
});

describe('골든 테스트 #5 — 경계값 fuzzing (v2.1 §12 식(10), DNA% ∈ [50,100] 항상 성립)', () => {
  const extremeInputs = [
    -1000, -100, -10, -1, -0.5259, 0, 0.1, 0.5259, 1, 2, 10, 100, 1000, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER,
  ];

  it.each(extremeInputs)('S_raw=%p 이어도 DNA%는 항상 [50,100] 안에 있다', (sRaw) => {
    const dnaPct = computeDnaPercent(sRaw);
    expect(dnaPct).toBeGreaterThanOrEqual(50);
    expect(dnaPct).toBeLessThanOrEqual(100);
  });

  it('S_raw = μ̂(0.5259)이면 DNA% = 75 (z=0 지점)', () => {
    expectWithinTolerance(computeDnaPercent(0.5259), 75, 0.001);
  });
});

describe('보조 검증 — 순수 수학 부분', () => {
  it('cosineSimilarity — 동일 벡터는 유사도 1', () => {
    const v = { O: 0.6, C: 0.4, E: 0.7, A: 0.5, N: 0.3 };
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 10);
  });

  it('computeWingBonus — 두 주변확률이 완전히 겹치면(동일 벡터) 그 제곱합과 같다', () => {
    const r = { 1: 0.5, 2: 0.5, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 } as Record<number, number>;
    expect(computeWingBonus(r as never, r as never)).toBeCloseTo(0.5, 10);
  });

  it('computeS_ATT — 0,1 범위로 클램프된다', () => {
    // stability=1(anx=-2,avo=2 → 1-0.5*0), pursueWithdraw=-8(매우 음수) → 5 → clamp 1
    expect(computeS_ATT({ anxiety: -2, avoidance: 2 }, { anxiety: -2, avoidance: 2 })).toBe(1);
    // stability=-1(anx=avo=2), pursueWithdraw=8(매우 양수) → -5 → clamp 0
    expect(computeS_ATT({ anxiety: 2, avoidance: 2 }, { anxiety: 2, avoidance: 2 })).toBe(0);
  });

  it('computeSRaw — v2.1 §12 식(9) 가중합', () => {
    expectWithinTolerance(computeSRaw(0.41, 0.561, 0.758, 0.584), 0.589, 0.001);
  });
});
