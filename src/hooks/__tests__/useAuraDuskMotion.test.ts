// span 보간 순수 함수(easeCosine/interpolateSpan) 검증.
// suncalc에 의존하는 훅 본체(useAuraDuskMotion)는 실행하지 않고, 앵커를 직접 구성해
// 순수 함수만 독립적으로 테스트한다.

import { easeCosine, interpolateSpan, SPAN_MIN, SPAN_MAX, type DuskAnchor } from '../useAuraDuskMotion';

describe('easeCosine', () => {
  it('progress=0에서 0을 반환한다', () => {
    expect(easeCosine(0)).toBe(0);
  });

  it('progress=1에서 1을 반환한다', () => {
    expect(easeCosine(1)).toBeCloseTo(1, 10);
  });

  it('progress=0.5에서 정확히 0.5를 반환한다(코사인 이징의 중점)', () => {
    expect(easeCosine(0.5)).toBeCloseTo(0.5, 10);
  });

  it('0~1 범위 밖 입력은 클램프된다', () => {
    expect(easeCosine(-1)).toBe(0);
    expect(easeCosine(2)).toBeCloseTo(1, 10);
  });
});

describe('interpolateSpan', () => {
  const ANCHOR_A_TIME = 1_000_000;
  const ANCHOR_B_TIME = 1_000_000 + 3600_000; // 1시간 뒤

  function makeAnchors(kindA: 'MAX' | 'MIN', kindB: 'MAX' | 'MIN'): [DuskAnchor, DuskAnchor] {
    return [
      { timeMs: ANCHOR_A_TIME, kind: kindA },
      { timeMs: ANCHOR_B_TIME, kind: kindB },
    ];
  }

  it('현재 시각이 앵커 A와 정확히 같으면 A의 kind에 대응하는 값을 그대로 반환한다 (MAX→MIN)', () => {
    const [a, b] = makeAnchors('MAX', 'MIN');
    expect(interpolateSpan(ANCHOR_A_TIME, a, b)).toBeCloseTo(SPAN_MAX, 10);
  });

  it('현재 시각이 앵커 B와 정확히 같으면 B의 kind에 대응하는 값을 그대로 반환한다 (MAX→MIN)', () => {
    const [a, b] = makeAnchors('MAX', 'MIN');
    expect(interpolateSpan(ANCHOR_B_TIME, a, b)).toBeCloseTo(SPAN_MIN, 10);
  });

  it('현재 시각이 앵커 A와 정확히 같으면 MIN→MAX 구간에서도 A의 값(SPAN_MIN)을 반환한다', () => {
    const [a, b] = makeAnchors('MIN', 'MAX');
    expect(interpolateSpan(ANCHOR_A_TIME, a, b)).toBeCloseTo(SPAN_MIN, 10);
  });

  it('현재 시각이 앵커 B와 정확히 같으면 MIN→MAX 구간에서도 B의 값(SPAN_MAX)을 반환한다', () => {
    const [a, b] = makeAnchors('MIN', 'MAX');
    expect(interpolateSpan(ANCHOR_B_TIME, a, b)).toBeCloseTo(SPAN_MAX, 10);
  });

  it('두 앵커의 중간 시점에서는 코사인 이징의 중점(정확히 산술 평균)이 나온다', () => {
    const [a, b] = makeAnchors('MAX', 'MIN');
    const midMs = (ANCHOR_A_TIME + ANCHOR_B_TIME) / 2;
    const expected = (SPAN_MAX + SPAN_MIN) / 2;
    expect(interpolateSpan(midMs, a, b)).toBeCloseTo(expected, 10);
  });

  it('중간 시점 이전(progress<0.5)에는 코사인 이징 값이 선형 진행률보다 A쪽에 더 가깝다(느리게 출발하는 S커브)', () => {
    const [a, b] = makeAnchors('MAX', 'MIN');
    const quarterMs = ANCHOR_A_TIME + (ANCHOR_B_TIME - ANCHOR_A_TIME) * 0.25;
    const linearValue = SPAN_MAX + (SPAN_MIN - SPAN_MAX) * 0.25;
    const easedValue = interpolateSpan(quarterMs, a, b);
    // MAX(10)→MIN(3)로 감소하는 구간이므로, 출발이 느린 이징 값은 선형값보다 "더 큰(=A에 더 가까운)" 값이어야 한다.
    expect(easedValue).toBeGreaterThan(linearValue);
    expect(easedValue).toBeLessThanOrEqual(SPAN_MAX);
    expect(easedValue).toBeGreaterThanOrEqual(SPAN_MIN);
  });

  it('결과값은 항상 [SPAN_MIN, SPAN_MAX] 범위 안에 있다', () => {
    const [a, b] = makeAnchors('MIN', 'MAX');
    for (const t of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
      const ms = ANCHOR_A_TIME + (ANCHOR_B_TIME - ANCHOR_A_TIME) * t;
      const value = interpolateSpan(ms, a, b);
      expect(value).toBeGreaterThanOrEqual(SPAN_MIN);
      expect(value).toBeLessThanOrEqual(SPAN_MAX);
    }
  });
});
