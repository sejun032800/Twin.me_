// ─── psychProfileAdapter.ts 단위테스트 (Phase 3) ────────────────────────────
// computeRomanticDNA.test.ts의 골든 테스트(§14 캐노니컬 커플, DNA%=83.4)를 재사용해,
// PsychProfile → PersonProfileV21 변환이 파이프라인 결과를 왜곡하지 않는지 검증한다.

import { jointDistribution } from '../../inference/enneagramWing';
import { computeRomanticDnaV21 } from '../computeRomanticDNA';
import { psychProfileToPersonProfileV21 } from '../psychProfileAdapter';
import type { PsychProfile } from '@/store/userStore';

function expectWithinTolerance(actual: number, expected: number, tolerance: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

const BIG5_A = { O: 0.7, C: 0.4, E: 0.75, A: 0.65, N: 0.45 };
const BIG5_B = { O: 0.35, C: 0.8, E: 0.3, A: 0.45, N: 0.35 };

// P_A/P_B(§14) — key '1'..'9' 순서 그대로 배열화(index i ↔ 유형 i+1).
const P_A_ARRAY = [0.03, 0.2, 0.03, 0.05, 0.03, 0.03, 0.55, 0.03, 0.05];
const P_B_ARRAY = [0.5, 0.05, 0.1, 0.05, 0.15, 0.1, 0.02, 0.02, 0.01];
const P_A_RECORD = { 1: 0.03, 2: 0.2, 3: 0.03, 4: 0.05, 5: 0.03, 6: 0.03, 7: 0.55, 8: 0.03, 9: 0.05 };
const P_B_RECORD = { 1: 0.5, 2: 0.05, 3: 0.1, 4: 0.05, 5: 0.15, 6: 0.1, 7: 0.02, 8: 0.02, 9: 0.01 };

const ATTACHMENT_A = { anxiety: 0.35, avoidance: 0.25 };
const ATTACHMENT_B = { anxiety: 0.2, avoidance: 0.45 };

const STATE_A = { intimacy: 0.8, passion: 0.75, commitment: 0.55 };
const STATE_B = { intimacy: 0.55, passion: 0.45, commitment: 0.7 };

function buildPsychProfile(
  big5: typeof BIG5_A,
  enneagramCore: number[],
  wingJointSource: typeof P_A_RECORD,
  attachment: typeof ATTACHMENT_A,
  sternbergState: typeof STATE_A,
): PsychProfile {
  const wingJoint = jointDistribution(wingJointSource, big5);
  return {
    big5,
    attachment,
    enneagramCore,
    enneagramWingJoint: wingJoint as unknown as Record<string, number>,
    sternbergState,
    mbtiEstimated: null,
    interviewMeta: {
      completedAt: '2026-07-15T00:00:00.000Z',
      turnsUsed: 12,
      elapsedSeconds: 240,
      stopReason: 'entropy_threshold',
      calibrationVersion: 'v2.1',
    },
  };
}

describe('psychProfileToPersonProfileV21', () => {
  it('§14 골든 테스트 값과 동일한 DNA% 파이프라인 결과를 재현한다(오차 ±0.1)', () => {
    const psychA = buildPsychProfile(BIG5_A, P_A_ARRAY, P_A_RECORD, ATTACHMENT_A, STATE_A);
    const psychB = buildPsychProfile(BIG5_B, P_B_ARRAY, P_B_RECORD, ATTACHMENT_B, STATE_B);

    const profileA = psychProfileToPersonProfileV21(psychA);
    const profileB = psychProfileToPersonProfileV21(psychB);

    const result = computeRomanticDnaV21(profileA, profileB);

    expectWithinTolerance(result.S_B5, 0.41, 0.1);
    expectWithinTolerance(result.S_EN, 0.561, 0.1);
    expectWithinTolerance(result.S_ST, 0.758, 0.1);
    expectWithinTolerance(result.S_ATT, 0.584, 0.1);
    expectWithinTolerance(result.dna_pct, 83.4, 0.1);
  });

  it('sternbergState가 null이면 중립값(0.5)으로 대체한다', () => {
    const psych = buildPsychProfile(BIG5_A, P_A_ARRAY, P_A_RECORD, ATTACHMENT_A, STATE_A);
    psych.sternbergState = null;
    const profile = psychProfileToPersonProfileV21(psych);
    expect(profile.sternbergState).toEqual({ intimacy: 0.5, passion: 0.5, commitment: 0.5 });
  });

  it('enneagramCore 배열을 EnneagramCoreId 키 Record로 정확히 변환한다', () => {
    const psych = buildPsychProfile(BIG5_A, P_A_ARRAY, P_A_RECORD, ATTACHMENT_A, STATE_A);
    const profile = psychProfileToPersonProfileV21(psych);
    expect(profile.enneagramCorePosterior[7]).toBeCloseTo(0.55, 6); // index 6 → 유형 7
    expect(profile.enneagramCorePosterior[1]).toBeCloseTo(0.03, 6);
  });
});
