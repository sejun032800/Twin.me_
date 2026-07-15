// ─── 골든 테스트 #3 — 날개 결합확률 (구현명세서 §9, v2.1 §9.2 실계산 예시) ─────
// 입력 b=(0.63,0.55,0.78,0.50,0.38)에 대해:
//   1) enneagramCorePrior(b)로 코어유형 사후분포를 구하면 v2.1 §9.2가 제시한
//      "7유형 18.0%, 3유형 17.8%, 8유형 16.6%, ..." 와 정확히 일치한다(§2 앵커행렬
//      복원 후 직접 검증됨 — 별도 사전 확률을 주입하지 않는다).
//   2) 그 p와 b로 jointDistribution()을 계산하면 상위 결합확률이
//      8w7=14.4%, 7w8=14.3%, 3w2=13.0% (오차 허용 ±0.1%p)에 정확히 일치한다.

import { enneagramCorePrior } from '../mbtiPrior';
import { jointDistribution, wingIdsOf, wingMarginal } from '../enneagramWing';
import type { Big5Vector } from '../../matching/constants';

const EXAMPLE_B5: Big5Vector = { O: 0.63, C: 0.55, E: 0.78, A: 0.5, N: 0.38 };

describe('wingIdsOf — v2.1 §9.1 순환 인접 규칙', () => {
  it('일반 유형은 {i-1, i+1}이다', () => {
    expect(wingIdsOf(5)).toEqual([4, 6]);
  });
  it('1유형의 날개는 {9, 2}이다 (순환)', () => {
    expect(wingIdsOf(1)).toEqual([9, 2]);
  });
  it('9유형의 날개는 {8, 1}이다 (순환)', () => {
    expect(wingIdsOf(9)).toEqual([8, 1]);
  });
});

describe('골든 테스트 #3 — 날개 결합확률 (v2.1 §9.2)', () => {
  const p = enneagramCorePrior(EXAMPLE_B5);

  it('코어유형 사후분포가 v2.1 §9.2 예시(7:18.0%, 3:17.8%, 8:16.6%)를 정확히 재현한다', () => {
    expect(p[7] * 100).toBeCloseTo(18.0, 1);
    expect(p[3] * 100).toBeCloseTo(17.8, 1);
    expect(p[8] * 100).toBeCloseTo(16.6, 1);
  });

  it('결합확률 상위 3개가 8w7=14.4%, 7w8=14.3%, 3w2=13.0%를 오차 ±0.1%p 이내로 재현한다', () => {
    const joint = jointDistribution(p, EXAMPLE_B5);
    const sorted = Object.entries(joint).sort((a, b) => b[1] - a[1]);
    const top3 = sorted.slice(0, 3).map(([key, value]) => [key, Math.round(value * 1000) / 10]);

    const asMap = Object.fromEntries(sorted.map(([k, v]) => [k, v * 100]));
    expect(asMap['8w7']).toBeCloseTo(14.4, 1);
    expect(asMap['7w8']).toBeCloseTo(14.3, 1);
    expect(asMap['3w2']).toBeCloseTo(13.0, 1);

    // 참고용 — 실제 상위 3개 키가 이 세 조합과 일치하는지도 함께 확인
    expect(top3.map(([key]) => key)).toEqual(expect.arrayContaining(['8w7', '7w8', '3w2']));
  });

  it('결합확률의 총합은 1이다', () => {
    const joint = jointDistribution(p, EXAMPLE_B5);
    const sum = Object.values(joint).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe('wingMarginal — v2.1 §9.3', () => {
  it('실제 조인트 분포로부터 날개 번호별 주변확률 합이 1이 된다', () => {
    const p = enneagramCorePrior(EXAMPLE_B5);
    const joint = jointDistribution(p, EXAMPLE_B5);
    const marginal = wingMarginal(joint);
    const sum = Object.values(marginal).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});
