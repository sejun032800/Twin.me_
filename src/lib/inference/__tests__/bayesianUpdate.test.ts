// ─── bayesianUpdate.ts 보조 검증 (골든 테스트 5종 외 보충) ─────────────────────
import {
  updateAttachmentPosterior,
  updateBig5Posterior,
  updateEnneagramCorePosterior,
  updateScalarConjugate,
} from '../bayesianUpdate';

describe('updateScalarConjugate — v2.1 §8 정규-정규 켤레', () => {
  it('사전과 관측이 동일하면 사후 평균도 그 값과 같다', () => {
    const { mean } = updateScalarConjugate(0.5, 0.12 ** 2, 0.5, 0.3 ** 2);
    expect(mean).toBeCloseTo(0.5, 10);
  });

  it('사후 평균은 항상 사전평균과 관측값 사이에 위치한다', () => {
    const { mean } = updateScalarConjugate(0.35, 0.12 ** 2, 0.9, 0.3 ** 2);
    expect(mean).toBeGreaterThan(0.35);
    expect(mean).toBeLessThan(0.9);
  });

  it('사후분산은 사전분산보다 항상 작다(정보가 추가되므로)', () => {
    const { variance } = updateScalarConjugate(0.5, 0.12 ** 2, 0.8, 0.3 ** 2);
    expect(variance).toBeLessThan(0.12 ** 2);
  });
});

describe('updateBig5Posterior / updateAttachmentPosterior', () => {
  it('지정한 차원만 갱신되고 나머지는 그대로 유지된다', () => {
    const prior = { O: 0.65, C: 0.35, E: 0.65, A: 0.65, N: 0.5 };
    const priorVariance = { O: 0.12 ** 2, C: 0.12 ** 2, E: 0.12 ** 2, A: 0.12 ** 2, N: 0.18 ** 2 };
    const { mean } = updateBig5Posterior(prior, priorVariance, 'N', 0.9, 0.2 ** 2);
    expect(mean.O).toBe(0.65);
    expect(mean.C).toBe(0.35);
    expect(mean.N).not.toBe(0.5);
  });

  it('애착 차원 갱신도 동일한 방식으로 동작한다', () => {
    const prior = { anxiety: 0.5, avoidance: 0.35 };
    const priorVariance = { anxiety: 0.2 ** 2, avoidance: 0.22 ** 2 };
    const { mean } = updateAttachmentPosterior(prior, priorVariance, 'avoidance', 0.8, 0.25 ** 2);
    expect(mean.anxiety).toBe(0.5);
    expect(mean.avoidance).not.toBe(0.35);
  });
});

describe('updateEnneagramCorePosterior — v2.1 §8 곱셈적 우도', () => {
  it('결과 확률의 합은 항상 1이다', () => {
    const prior = { 1: 1 / 9, 2: 1 / 9, 3: 1 / 9, 4: 1 / 9, 5: 1 / 9, 6: 1 / 9, 7: 1 / 9, 8: 1 / 9, 9: 1 / 9 } as Record<
      1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
      number
    >;
    const posterior = updateEnneagramCorePosterior(prior, { 7: 1.8, 1: 0.55 });
    const sum = Object.values(posterior).reduce((a: number, b) => a + (b as number), 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('명시되지 않은 유형은 우도 1.0(무정보)로 취급해 상대비율이 유지된다', () => {
    const prior = { 1: 0.2, 2: 0.2, 3: 0.2, 4: 0.1, 5: 0.1, 6: 0.1, 7: 0.05, 8: 0.03, 9: 0.02 } as Record<
      1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
      number
    >;
    const posterior = updateEnneagramCorePosterior(prior, { 1: 2.0 });
    // 1번 유형만 우도가 걸렸으므로 2번:3번 비율은 사전과 동일하게 유지되어야 한다
    expect(posterior[2] / posterior[3]).toBeCloseTo(prior[2] / prior[3], 10);
  });
});
