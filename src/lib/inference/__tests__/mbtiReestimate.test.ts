import { reestimateMbtiAxes } from '../mbtiReestimate';

describe('reestimateMbtiAxes — v2.1 §10 식(6)', () => {
  it('Big5 값이 정확히 0.5이면 각 축의 확률은 0.5(완전 불확실)이다', () => {
    const result = reestimateMbtiAxes({ O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 });
    expect(result.pE).toBeCloseTo(0.5, 10);
    expect(result.pN_axis).toBeCloseTo(0.5, 10);
    expect(result.pF).toBeCloseTo(0.5, 10);
    expect(result.pJ).toBeCloseTo(0.5, 10);
  });

  it('E=0.65일 때 s=0.15면 sigmoid(1)만큼 E축 확률이 상승한다', () => {
    const result = reestimateMbtiAxes({ O: 0.5, C: 0.5, E: 0.65, A: 0.5, N: 0.5 });
    const expected = 1 / (1 + Math.exp(-1));
    expect(result.pE).toBeCloseTo(expected, 10);
  });

  it('결과는 항상 (0,1) 구간 내에 있다', () => {
    const result = reestimateMbtiAxes({ O: 0.99, C: 0.01, E: 0.99, A: 0.01, N: 0.5 });
    for (const v of Object.values(result)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
  });
});
