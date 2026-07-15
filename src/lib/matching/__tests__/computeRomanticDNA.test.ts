// ─── 골든 테스트 #4 — 캐노니컬 커플 전체 파이프라인 (구현명세서 §9, v2.1 §14) ───
// v2.1 §14가 제시하는 "인터뷰 후 사후값(원시 입력 전체)" b, p, ψ, t^state를 그대로
// PersonProfileV21로 구성해 computeRomanticDnaV21()에 넘긴다. 중간 부분점수
// (S_B5, S_EN, S_ST, S_ATT)는 사전에 계산된 값을 주입하지 않고, 전부 원시 프로필로부터
// 이 함수가 직접 유도한 값이다.
//
// 기대값(v2.1 §14): S_B5=0.410, S_EN=0.561, S_ST=0.758, S_ATT=0.584, DNA%=83.4 (오차 ±0.1)

import { jointDistribution, wingMarginal } from '../../inference/enneagramWing';
import { reestimateMbtiAxes } from '../../inference/mbtiReestimate';
import { computeRomanticDnaV21, type PersonProfileV21 } from '../computeRomanticDNA';

function expectWithinTolerance(actual: number, expected: number, tolerance: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

// v2.1 §14 표 — A(ENFP 성향)/B(ISTJ 성향) 캐노니컬 커플의 인터뷰 후 사후값 전체
const BIG5_A = { O: 0.7, C: 0.4, E: 0.75, A: 0.65, N: 0.45 };
const BIG5_B = { O: 0.35, C: 0.8, E: 0.3, A: 0.45, N: 0.35 };

const P_A = { 1: 0.03, 2: 0.2, 3: 0.03, 4: 0.05, 5: 0.03, 6: 0.03, 7: 0.55, 8: 0.03, 9: 0.05 };
const P_B = { 1: 0.5, 2: 0.05, 3: 0.1, 4: 0.05, 5: 0.15, 6: 0.1, 7: 0.02, 8: 0.02, 9: 0.01 };

const ATTACHMENT_A = { anxiety: 0.35, avoidance: 0.25 };
const ATTACHMENT_B = { anxiety: 0.2, avoidance: 0.45 };

const STATE_A = { intimacy: 0.8, passion: 0.75, commitment: 0.55 };
const STATE_B = { intimacy: 0.55, passion: 0.45, commitment: 0.7 };

function buildProfile(
  big5: typeof BIG5_A,
  p: typeof P_A,
  attachment: typeof ATTACHMENT_A,
  state: typeof STATE_A,
): PersonProfileV21 {
  const wingJoint = jointDistribution(p, big5);
  return {
    big5Posterior: big5,
    attachmentPosterior: attachment,
    enneagramCorePosterior: p,
    wingJoint,
    wingMarginal: wingMarginal(wingJoint),
    sternbergState: state,
    mbtiEstimate: reestimateMbtiAxes(big5),
  };
}

describe('골든 테스트 #4 — 캐노니컬 커플 전체 파이프라인 (v2.1 §14, 오차 허용 ±0.1)', () => {
  const profileA = buildProfile(BIG5_A, P_A, ATTACHMENT_A, STATE_A);
  const profileB = buildProfile(BIG5_B, P_B, ATTACHMENT_B, STATE_B);
  const result = computeRomanticDnaV21(profileA, profileB);

  it('S_B5 ≈ 0.410', () => {
    expectWithinTolerance(result.S_B5, 0.41, 0.1);
  });

  it('S_EN ≈ 0.561 (S_EN,core≈0.604, WingBonus≈0.068 경유)', () => {
    expectWithinTolerance(result.S_EN, 0.561, 0.1);
  });

  it('S_ST ≈ 0.758', () => {
    expectWithinTolerance(result.S_ST, 0.758, 0.1);
  });

  it('S_ATT ≈ 0.584', () => {
    expectWithinTolerance(result.S_ATT, 0.584, 0.1);
  });

  it('DNA% ≈ 83.4', () => {
    expectWithinTolerance(result.dna_pct, 83.4, 0.1);
  });
});

describe('WingBonus 중간값 검증 (v2.1 §14 "WingBonus(A,B) = 0.068")', () => {
  it('A/B 날개 주변확률로 계산한 WingBonus가 0.068에 근접한다', () => {
    const profileA = buildProfile(BIG5_A, P_A, ATTACHMENT_A, STATE_A);
    const profileB = buildProfile(BIG5_B, P_B, ATTACHMENT_B, STATE_B);
    const ids = Object.keys(profileA.wingMarginal).map(Number);
    const wingBonus = ids.reduce(
      (sum, k) => sum + profileA.wingMarginal[k as keyof typeof profileA.wingMarginal] * profileB.wingMarginal[k as keyof typeof profileB.wingMarginal],
      0,
    );
    expectWithinTolerance(wingBonus, 0.068, 0.01);
  });
});
