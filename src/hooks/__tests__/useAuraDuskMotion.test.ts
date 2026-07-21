// v2.8: 일출/일몰 리듬(easeCosine/interpolateSpan, suncalc 앵커)이 완전히 제거되고
// 화면 세로 45%~65% 밴드 안에서 목표 t가 3분 주기로 오르내리는 숨쉬기만 남았다.
// horizonTargetT가 항상 밴드 안에 있는지 + frozen(STEP 11-2) 동작을 검증한다.
// frozen 파트는 react-test-renderer로 훅 본체를 실제로 마운트해 검증한다.

import React from 'react';
import {
  HORIZON_T_MIN,
  HORIZON_T_MAX,
  useAuraDuskMotion,
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

// 훅 내부 비공개 상수(T_TICK_INTERVAL_MS=150)는 export되지 않으므로, frozen 테스트에서는
// 목표 순회 시간(최대 180초)보다 충분히 긴 시간을 하드코딩해 안전 마진을 둔다.
const LONG_ENOUGH_TO_COVER_ALL_INTERVALS_MS = 5 * 60 * 1000; // 5분 — 180초 순회를 넘김

describe('useAuraDuskMotion — horizonTargetT 밴드 범위', () => {
  function Harness({ onChange }: { onChange: (v: AuraDuskMotion) => void }) {
    const motion = useAuraDuskMotion(false);
    onChange(motion);
    return null;
  }

  it('마운트 직후 horizonTargetT는 항상 [HORIZON_T_MIN, HORIZON_T_MAX] 범위 안에 있다', () => {
    let latest!: AuraDuskMotion;
    act(() => {
      create(React.createElement(Harness, { onChange: (v) => { latest = v; } }));
    });
    expect(latest.horizonTargetT).toBeGreaterThanOrEqual(HORIZON_T_MIN);
    expect(latest.horizonTargetT).toBeLessThanOrEqual(HORIZON_T_MAX);
  });

  it('시간이 흘러 목표가 재추출된 뒤에도 horizonTargetT는 항상 밴드 범위 안에 있다', () => {
    jest.useFakeTimers();
    let latest!: AuraDuskMotion;
    act(() => {
      create(React.createElement(Harness, { onChange: (v) => { latest = v; } }));
    });

    act(() => {
      jest.advanceTimersByTime(LONG_ENOUGH_TO_COVER_ALL_INTERVALS_MS);
    });

    expect(latest.horizonTargetT).toBeGreaterThanOrEqual(HORIZON_T_MIN);
    expect(latest.horizonTargetT).toBeLessThanOrEqual(HORIZON_T_MAX);
    jest.useRealTimers();
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

  it('frozen=true인 동안에는 목표 순회 주기(최대 180초)를 훨씬 넘겨도 값이 전혀 변하지 않는다', () => {
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

    // frozen이 아니었다면 이 정도 시간이면 목표 도달(재추출)이 최소 한 번은 일어났어야 한다 —
    // 그런데도 두 값 모두 freeze 시점 그대로여야 "얼어붙었다"고 할 수 있다.
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

    // 재개 — 타이머를 아직 전혀 진행시키지 않았으므로, 이 시점의 값은 "정해둔 높이로 스냅"된
    // 것이 아니라 멈춘 지점 그대로여야 한다.
    act(() => {
      renderer.update(React.createElement(Harness, { frozen: false, onChange: (v) => { latest = v; } }));
    });

    expect(latest).toEqual(frozenSnapshot);
  });
});
