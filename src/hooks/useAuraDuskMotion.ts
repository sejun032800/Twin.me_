// ─── useAuraDuskMotion — 오라 노을 수평선 "숨쉬기" 모션 상태 훅 (렌더링 로직 없음) ──
// v2.8(MASTER.md §1.3): 일출/일몰 실시간 연동(하루 리듬)은 완전히 폐기하고, 항상
// "저녁 7~9시" 무드로 고정한다. 대신 화면 세로 45%~65% 밴드 안에서 수평선 높이가
// 3분(180초) 주기로 랜덤 목표 지점을 향해 부드럽게 오르내리는 숨쉬기 메커니즘만
// v2.7과 동일하게 유지한다. 실제 화면 보간(프레임 단위 애니메이션)은 다음 단계에서
// Reanimated의 useAnimatedStyle/withTiming이 이 훅의 반환값(목표 t + duration)을 받아
// 처리한다.

import { useEffect, useRef, useState } from 'react';

// 수평선 높이 밴드 — 화면 세로 기준 비율(0~1). MASTER §1.3: "화면 세로 45%~65% 사이
// 밴드에서 수평선 높이가 결정".
export const HORIZON_T_MIN = 0.45;
export const HORIZON_T_MAX = 0.65;
const HORIZON_T_MID = (HORIZON_T_MIN + HORIZON_T_MAX) / 2;

// 숨쉬기 이동 속도: 밴드 전체 폭을 180초에 주파(v2.7과 동일 주기 유지).
export const T_TRAVERSAL_SECONDS = 180;
const T_SPEED_PER_SEC = (HORIZON_T_MAX - HORIZON_T_MIN) / T_TRAVERSAL_SECONDS; // t단위/초

const T_ARRIVAL_EPSILON = 0.001; // |현재t - 목표t|가 이보다 작으면 도달로 간주
const T_TICK_INTERVAL_MS = 150; // 도달 감지 tick 간격

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export interface AuraDuskMotion {
  horizonTargetT: number; // HORIZON_T_MIN~HORIZON_T_MAX 사이 목표치 — 화면 세로 기준 수평선 높이
  moveDurationMs: number;
}

/**
 * @param frozen true인 동안 애니메이션을 "그 순간 그대로" 정지시킨다(STEP 11-2, 예: 채팅방
 *   진입 중). 미리 정해둔 특정 높이로 스냅하는 게 아니라, 목표 재추출 tick을 그대로 멈춰서
 *   마지막으로 계산된 값에서 얼어붙는다. frozen이 다시 false가 되면 멈췄던
 *   currentTRef/targetTRef 값 그대로에서 원래 로직이 재개되므로(강제 스냅 없음), 얼어붙는
 *   지점은 "그때그때 다른" 임의의 순간이 된다.
 */
export function useAuraDuskMotion(frozen: boolean = false): AuraDuskMotion {
  const [horizonTargetT, setHorizonTargetT] = useState<number>(HORIZON_T_MID);
  const [moveDurationMs, setMoveDurationMs] = useState<number>(0);

  // 렌더 트리거 없이 tick 루프에서 읽고 쓰는 내부 상태.
  const currentTRef = useRef(HORIZON_T_MID);
  const targetTRef = useRef(HORIZON_T_MID);

  // 목표 t 재추출. "목표값이 바뀔 때마다" 그 목표까지 걸리는 duration을 함께 계산해 노출한다.
  function pickNewTarget() {
    const newTargetT = randomInRange(HORIZON_T_MIN, HORIZON_T_MAX);
    targetTRef.current = newTargetT;

    const distance = Math.abs(newTargetT - currentTRef.current);
    const durationMs = (distance / T_SPEED_PER_SEC) * 1000;

    setMoveDurationMs(durationMs);
    setHorizonTargetT(newTargetT);
  }

  useEffect(() => {
    pickNewTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tick마다 현재 t를 목표 방향으로 speed*dt만큼 이동, 도달 시 새 목표 재추출.
  // frozen이면 인터벌 자체를 만들지 않는다 — currentTRef/targetTRef는 freeze 직전 값 그대로
  // 유지되고, horizonTargetT/moveDurationMs도 더 이상 갱신되지 않아 정지된다.
  // frozen이 false로 풀리면 effect가 다시 돌면서 lastTickMs를 그 시점으로 재설정하므로,
  // 멈춰 있던 시간만큼의 dt가 한꺼번에 몰려 튀는 일 없이 멈춘 지점에서 자연스럽게 이어진다.
  useEffect(() => {
    if (frozen) return;
    let lastTickMs = Date.now();
    const id = setInterval(() => {
      const nowMs = Date.now();
      const dtSec = (nowMs - lastTickMs) / 1000;
      lastTickMs = nowMs;

      const target = targetTRef.current;
      const current = currentTRef.current;
      const direction = Math.sign(target - current);
      const step = T_SPEED_PER_SEC * dtSec;
      let nextT = current + direction * step;
      if ((direction > 0 && nextT > target) || (direction < 0 && nextT < target)) {
        nextT = target; // 오버슈트 방지
      }
      currentTRef.current = nextT;

      if (Math.abs(target - nextT) < T_ARRIVAL_EPSILON) {
        currentTRef.current = target;
        pickNewTarget();
      }
    }, T_TICK_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen]);

  return { horizonTargetT, moveDurationMs };
}
