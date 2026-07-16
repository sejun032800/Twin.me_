// ─── adaptiveEngine.ts 결정론적 단위테스트 (구현명세서 §9, v2.1 §5~§6) ─────────
import { big5Prior, enneagramCorePrior } from '../../inference/mbtiPrior';
import { ENNEAGRAM_TYPE_IDS, type EnneagramCoreId } from '../../matching/constants';
import { computeUncertainty, checkEarlyStop, estimateTimeCost, selectNextQuestion, type UncertaintyDimension } from '../adaptiveEngine';
import { QUESTION_BANK } from '../questionBank';

function toOrderedArray(p: Record<EnneagramCoreId, number>): number[] {
  return ENNEAGRAM_TYPE_IDS.map((id) => p[id]);
}

function expectWithinTolerance(actual: number, expected: number, tolerance: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe('computeUncertainty — v2.1 §5.4 ENFP 예시 (오차 ±0.001)', () => {
  const enfpBig5 = big5Prior('ENFP');
  const enfpCorePrior = enneagramCorePrior(enfpBig5);
  const uncertainty = computeUncertainty({ enneagramCore: toOrderedArray(enfpCorePrior) });

  it('avo(회피) = 1.000', () => {
    expectWithinTolerance(uncertainty.avoidance, 1.0, 0.001);
  });
  it('enneagram_core ≈ 0.969', () => {
    expectWithinTolerance(uncertainty.enneagram_core, 0.969, 0.001);
  });
  it('anx(불안) ≈ 0.826', () => {
    expectWithinTolerance(uncertainty.anxiety, 0.826, 0.001);
  });
  it('N(신경성) ≈ 0.669', () => {
    expectWithinTolerance(uncertainty.N, 0.669, 0.001);
  });
  it('O=C=E=A ≈ 0.298 (동률)', () => {
    expectWithinTolerance(uncertainty.O, 0.298, 0.001);
    expectWithinTolerance(uncertainty.C, 0.298, 0.001);
    expectWithinTolerance(uncertainty.E, 0.298, 0.001);
    expectWithinTolerance(uncertainty.A, 0.298, 0.001);
  });
});

describe('selectNextQuestion — v2.1 §5.4 우선순위(회피→애니어그램코어→불안→신경성→OCEA)', () => {
  const enfpBig5 = big5Prior('ENFP');
  const enfpCorePrior = enneagramCorePrior(enfpBig5);
  const uncertainty = computeUncertainty({ enneagramCore: toOrderedArray(enfpCorePrior) });

  it('5턴 연속 호출 시 avoidance → enneagram_core → anxiety → N → O 순으로 선택된다', () => {
    const asked = new Set<UncertaintyDimension>();
    const used = new Set<string>();
    const order: UncertaintyDimension[] = [];

    for (let turn = 0; turn < 5; turn++) {
      const result = selectNextQuestion(uncertainty, asked, 'ENFP', QUESTION_BANK, { usedQuestionIds: used });
      expect(result).not.toBeNull();
      if (!result) break;
      order.push(result.dimension);
      asked.add(result.dimension);
      used.add(result.question.id);
    }

    expect(order).toEqual(['avoidance', 'enneagram_core', 'anxiety', 'N', 'O']);
  });

  it('enneagram_core 타겟일 때 ENFP의 MBTI별 판별질문을 최우선으로 사용한다', () => {
    const result = selectNextQuestion(uncertainty, new Set(['avoidance']), 'ENFP', QUESTION_BANK);
    expect(result?.dimension).toBe('enneagram_core');
    expect(result?.question.tier).toBe('mbti_specific');
    expect(result?.question.mbtiType).toBe('ENFP');
  });

  it('MBTI별 문항이 모두 소진되면 연애맥락 오프너로, 그것도 소진되면 범용 오프너로 대체한다', () => {
    const usedQuestionIds = new Set(
      QUESTION_BANK.filter((q) => q.tier === 'mbti_specific' && q.mbtiType === 'ENFP').map((q) => q.id),
    );
    const result = selectNextQuestion(uncertainty, new Set(['avoidance']), 'ENFP', QUESTION_BANK, { usedQuestionIds });
    expect(result?.question.tier).toBe('romantic');

    QUESTION_BANK.filter((q) => q.tier === 'romantic' && q.targetDimension === 'enneagram_core').forEach((q) =>
      usedQuestionIds.add(q.id),
    );
    const result2 = selectNextQuestion(uncertainty, new Set(['avoidance']), 'ENFP', QUESTION_BANK, { usedQuestionIds });
    expect(result2?.question.tier).toBe('common');
  });

  it('모든 차원이 asked면 null을 반환한다', () => {
    const asked = new Set<UncertaintyDimension>([
      'O', 'C', 'E', 'A', 'N', 'anxiety', 'avoidance', 'enneagram_core',
    ]);
    expect(selectNextQuestion(uncertainty, asked, 'ENFP', QUESTION_BANK)).toBeNull();
  });
});

describe('checkEarlyStop — v2.1 §6 조기종료 3가지 트리거', () => {
  const highUncertainty = {
    O: 0.298, C: 0.298, E: 0.298, A: 0.298, N: 0.669, anxiety: 0.826, avoidance: 1.0, enneagram_core: 0.9,
  };
  const lowUncertainty = {
    O: 0.05, C: 0.05, E: 0.05, A: 0.05, N: 0.05, anxiety: 0.05, avoidance: 0.05, enneagram_core: 0.05,
  };
  const midUncertainty = {
    O: 0.3, C: 0.3, E: 0.3, A: 0.3, N: 0.3, anxiety: 0.3, avoidance: 0.3, enneagram_core: 0.3,
  };

  it('(a) 5분(300초) 이상 경과하면 time_cap으로 종료된다', () => {
    const result = checkEarlyStop(300, highUncertainty, 1);
    expect(result).toEqual({ stop: true, reason: 'time_cap' });
  });

  it('(a) 300초 미만이면 하드캡에 걸리지 않는다', () => {
    expect(checkEarlyStop(299, highUncertainty, 1).reason).not.toBe('time_cap');
  });

  it('(b) Ū < 0.15 이면 entropy_threshold로 종료된다 (최소턴 미충족이어도)', () => {
    const result = checkEarlyStop(60, lowUncertainty, 1);
    expect(result).toEqual({ stop: true, reason: 'entropy_threshold' });
  });

  it('(c) 최소 5턴 충족 + 모든 U_d<0.5 이면 min_turns_satisfied로 종료된다', () => {
    const result = checkEarlyStop(150, midUncertainty, 5);
    expect(result).toEqual({ stop: true, reason: 'min_turns_satisfied' });
  });

  it('(c) 5턴 미만이면 모든 U_d<0.5여도 종료되지 않는다', () => {
    const result = checkEarlyStop(90, midUncertainty, 4);
    expect(result).toEqual({ stop: false, reason: 'none' });
  });

  it('아무 조건도 만족하지 않으면 종료되지 않는다', () => {
    const result = checkEarlyStop(60, highUncertainty, 1);
    expect(result).toEqual({ stop: false, reason: 'none' });
  });
});

describe('estimateTimeCost — v2.1 §4 (A=30초, C=10초; 날개 후속질문은 §7 패치로 인터뷰 턴에서 제외됨)', () => {
  it('유형 A(서사형)는 30초', () => {
    expect(estimateTimeCost('A')).toBe(30);
  });
  it('유형 C(관계상태 직답)는 10초', () => {
    expect(estimateTimeCost('C')).toBe(10);
  });
});
