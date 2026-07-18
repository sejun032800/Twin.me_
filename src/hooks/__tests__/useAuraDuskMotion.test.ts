// span 보간 순수 함수(easeCosine/interpolateSpan) 검증 + frozen(STEP 11-2) 동작 검증.
// 순수 함수 파트는 suncalc에 의존하는 훅 본체를 실행하지 않고 앵커를 직접 구성해 독립적으로
// 테스트한다. frozen 파트만 react-test-renderer로 훅 본체를 실제로 마운트해 검증한다.

import React from 'react';
import {
  easeCosine,
  interpolateSpan,
  SPAN_MIN,
  SPAN_MAX,
  useAuraDuskMotion,
  type DuskAnchor,
  type AuraDuskMotion,
} from '../useAuraDuskMotion';

// react-test-renderer는 이 리포지토리에 타입 선언이 없어(@types 패키지 미설치) 정적 import
// 대신 require + 최소 타입 캐스팅으로 사용한다.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ReactTestRenderer = require('react-test-renderer') as {
  act: (callback: () => void) => void;
  create: (element: React.ReactElement) => { update: (element: React.ReactElement) => void; unmount: () => void };
};
const { act, create } = ReactTestRenderer;

// 훅 내부 비공개 상수(SPAN_REFRESH_INTERVAL_MS=60_000, T_TICK_INTERVAL_MS=150)는 export되지
// 않으므로, frozen 테스트에서는 두 인터벌 주기보다 충분히 긴 시간을 하드코딩해 안전 마진을 둔다.
const LONG_ENOUGH_TO_COVER_ALL_INTERVALS_MS = 5 * 60 * 1000; // 5분 — span(60s)/t순회(최대 90s)를 모두 넘김

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

describe('useAuraDuskMotion — frozen (STEP 11-2)', () => {
  // 훅을 실제로 마운트해 반환값을 캡처하는 최소 테스트 하네스.
  // frozen prop이 바뀔 때마다 renderer.update()로 리렌더시켜 훅에 새 인자를 전달한다.
  function Harness({ frozen, onChange }: { frozen: boolean; onChange: (v: AuraDuskMotion) => void }) {
    const motion = useAuraDuskMotion(frozen);
    onChange(motion);
    return null;
  }

  let mathRandomSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    // pickNewTarget의 randomInRange가 매번 같은 값을 뽑도록 고정해 테스트를 결정론적으로 만든다.
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
    jest.useRealTimers();
  });

  it('frozen=true인 동안에는 인터벌 주기(span 60s/t순회 최대 90s)를 훨씬 넘겨도 값이 전혀 변하지 않는다', () => {
    let latest!: AuraDuskMotion;
    let renderer!: { update: (element: React.ReactElement) => void };

    act(() => {
      renderer = create(React.createElement(Harness, { frozen: false, onChange: (v) => { latest = v; } }));
    });

    // 잠시 자연 진행시킨 뒤(마운트 직후 초기값이 안정된 뒤) freeze로 전환한다.
    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    act(() => {
      renderer.update(React.createElement(Harness, { frozen: true, onChange: (v) => { latest = v; } }));
    });

    const frozenSnapshot: AuraDuskMotion = { ...latest };

    act(() => {
      jest.advanceTimersByTime(LONG_ENOUGH_TO_COVER_ALL_INTERVALS_MS);
    });

    // frozen이 아니었다면 이 정도 시간이면 span 재계산과 t 목표 도달(재추출)이 최소 한 번씩은
    // 일어났어야 한다 — 그런데도 4개 값 모두 freeze 시점 그대로여야 "얼어붙었다"고 할 수 있다.
    expect(latest).toEqual(frozenSnapshot);
  });

  it('frozen을 false로 되돌리면 멈춘 지점에서부터 이어서 재개된다 — 재개 직후 첫 값이 멈춘 값과 같다', () => {
    let latest!: AuraDuskMotion;
    let renderer!: { update: (element: React.ReactElement) => void };

    act(() => {
      renderer = create(React.createElement(Harness, { frozen: false, onChange: (v) => { latest = v; } }));
    });

    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    act(() => {
      renderer.update(React.createElement(Harness, { frozen: true, onChange: (v) => { latest = v; } }));
    });

    const frozenSnapshot: AuraDuskMotion = { ...latest };

    act(() => {
      jest.advanceTimersByTime(LONG_ENOUGH_TO_COVER_ALL_INTERVALS_MS);
    });

    // 사전 조건 재확인 — 재개 전까지는 계속 멈춰 있어야 한다.
    expect(latest).toEqual(frozenSnapshot);

    // 재개 — 타이머를 아직 전혀 진행시키지 않았으므로, 이 시점의 값은 "정해둔 각도로 스냅"된
    // 것이 아니라 멈춘 지점 그대로여야 한다.
    act(() => {
      renderer.update(React.createElement(Harness, { frozen: false, onChange: (v) => { latest = v; } }));
    });

    expect(latest).toEqual(frozenSnapshot);
  });
});
