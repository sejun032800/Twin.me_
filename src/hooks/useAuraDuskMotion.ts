// ─── useAuraDuskMotion — 오라 노을 경계선 모션 상태 훅 (렌더링 로직 없음) ──────────
// 하루 중 태양의 위치(일출/태양남중/일몰/태양자정)를 4개 앵커로 삼아
// "경계선 부채꼴 반각(span/2)"과 "경계선 각도 목표치"를 계산해 반환한다.
// 실제 화면 보간(프레임 단위 애니메이션)은 다음 단계에서 Reanimated의
// useAnimatedStyle/withTiming이 이 훅의 반환값(목표 각도 + duration)을 받아 처리한다.
//
// 레이어 구성:
//   레이어 1+2 — t(-1~1) 상태 머신: 낮(0~1)/밤(-1~0) 구간에서 랜덤 목표를 뽑고
//                고정 속도(180초에 전체 구간 -1~1을 주파)로 이동, 도달 시 재추출.
//   레이어 3   — span(부채꼴 전체 폭, SPAN_MIN~SPAN_MAX): 4개 태양 앵커 사이를
//                코사인 이징으로 보간, 1분 간격으로만 재계산(고빈도 갱신 불필요).

import { useEffect, useRef, useState } from 'react';
import * as SunCalc from 'suncalc';

// 위치: 대전 — 추후 위치 권한 연동 시 이 상수만 교체하면 된다.
export const SUNCALC_LOCATION = { latitude: 36.3504, longitude: 127.3845 } as const;

// 레이어 3 — span(부채꼴 전체 폭) 범위.
export const SPAN_MIN = 3;
export const SPAN_MAX = 10;

// 레이어 1+2 — t 이동 속도: 전체 구간(-1~1, 거리 2)을 180초에 주파.
export const T_TRAVERSAL_SECONDS = 180;
export const T_SPEED_PER_SEC = 2 / T_TRAVERSAL_SECONDS; // t단위/초

const T_ARRIVAL_EPSILON = 0.01; // |현재t - 목표t|가 이보다 작으면 도달로 간주
const T_TICK_INTERVAL_MS = 150; // 레이어1+2 도달 감지 tick 간격
const SPAN_REFRESH_INTERVAL_MS = 60_000; // 레이어3 재계산 간격(1분)

export type AnchorKind = 'MAX' | 'MIN';
export interface DuskAnchor {
  timeMs: number;
  kind: AnchorKind;
}

/** 코사인 이징: 0→0, 1→1, 중간에서 부드러운 S커브(선형이 아님). */
export function easeCosine(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return (1 - Math.cos(clamped * Math.PI)) / 2;
}

/**
 * 앵커 A→B 사이에서 현재 시각(nowMs)의 span 값을 코사인 이징으로 보간한다.
 * nowMs가 정확히 anchorA/anchorB 시각과 같으면 각 앵커의 kind(MAX/MIN)에 대응하는
 * SPAN_MAX/SPAN_MIN 값을 그대로 반환한다 — 순수 함수라 anchor만 조작하면 독립적으로 테스트 가능.
 */
export function interpolateSpan(nowMs: number, anchorA: DuskAnchor, anchorB: DuskAnchor): number {
  const vA = anchorA.kind === 'MAX' ? SPAN_MAX : SPAN_MIN;
  const vB = anchorB.kind === 'MAX' ? SPAN_MAX : SPAN_MIN;
  const span = anchorB.timeMs - anchorA.timeMs;
  const progress = span === 0 ? 0 : (nowMs - anchorA.timeMs) / span;
  const eased = easeCosine(progress);
  return vA + (vB - vA) * eased;
}

/**
 * 특정 날짜(date)의 4개 태양 앵커: sunrise(MAX) → solarNoon(MIN) → sunset(MAX) → solarMidnight(MIN).
 * solarMidnight은 suncalc의 nadir(태양이 가장 낮은 지점 = 태양남중의 반대편, 태양남중 ±12시간)를 그대로 쓴다.
 * ("전날/다음날 solarNoon ±24시간"으로는 태양자정이 아니라 solarNoon 자신이 재현될 뿐이라
 * 실제로는 태양남중에서 12시간 떨어진 지점을 써야 한다 — suncalc가 이를 nadir로 직접 제공한다.)
 */
// suncalc는 sunrise/sunset을 `Date | null`로 타입핑한다(극지방 백야/극야에서 해당 이벤트가
// 아예 발생하지 않을 수 있기 때문). SUNCALC_LOCATION은 대전(위도 36.35°N, 온대 지역)으로
// 고정돼 있어 이 경우가 절대 발생하지 않으므로, non-null 단언으로 처리한다.

// 대전(SUNCALC_LOCATION) 고정 — 한국은 DST가 없어 연중 고정 오프셋(UTC+9)으로 안전하다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * suncalc.getTimes()는 입력 Date의 "UTC 정오 기준" 태양일로 그날의 sunrise/sunset을 계산한다
 * (내부 toDays()의 정수부가 UTC 자정이 아니라 UTC 정오에서 바뀐다). 그래서 KST 새벽~오전
 * 시각(UTC로는 전날 오후~자정에 해당)을 그대로 넘기면 하루 전 날짜의 sunrise/sunset이
 * 반환되는 버그가 생긴다 — 실제로 07:25 KST를 넘기면 전날 05:24~19:47 KST 값이 나옴을 확인했다.
 * 이를 피하려면 쿼리 시각의 "KST 캘린더 날짜"를 먼저 구하고, 그 날짜의 KST 정오(=UTC 03:00)를
 * suncalc에 넘겨야 한다 — UTC 03:00은 어떤 날짜든 그날의 UTC-정오 기준 앵커 창 안에 안전하게
 * 들어가므로, 항상 의도한 KST 캘린더 날짜의 sunrise/sunset이 나온다.
 */
export function resolveKstNoonAnchor(date: Date): Date {
  const kstShifted = new Date(date.getTime() + KST_OFFSET_MS);
  const year = kstShifted.getUTCFullYear();
  const month = kstShifted.getUTCMonth();
  const day = kstShifted.getUTCDate();
  return new Date(Date.UTC(year, month, day, 3, 0, 0, 0)); // KST 정오 = UTC 03:00
}

function getDayAnchors(date: Date): DuskAnchor[] {
  const times = SunCalc.getTimes(resolveKstNoonAnchor(date), SUNCALC_LOCATION.latitude, SUNCALC_LOCATION.longitude);
  return [
    { timeMs: times.sunrise!.getTime(), kind: 'MAX' },
    { timeMs: times.solarNoon.getTime(), kind: 'MIN' },
    { timeMs: times.sunset!.getTime(), kind: 'MAX' },
    { timeMs: times.nadir.getTime(), kind: 'MIN' },
  ];
}

/**
 * 자정 전후로 "가장 가까운 두 앵커"가 어제/오늘/내일에 걸쳐 있을 수 있으므로
 * 3일치 앵커를 모아 시간순 정렬한다.
 */
function getAnchorsAroundNow(now: Date): DuskAnchor[] {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const anchors = [
    ...getDayAnchors(new Date(now.getTime() - oneDayMs)),
    ...getDayAnchors(now),
    ...getDayAnchors(new Date(now.getTime() + oneDayMs)),
  ];
  return anchors.sort((a, b) => a.timeMs - b.timeMs);
}

/** now를 감싸는 두 앵커(직전 A, 직후 B)를 찾는다. */
function findBracket(now: Date): [DuskAnchor, DuskAnchor] {
  const anchors = getAnchorsAroundNow(now);
  const nowMs = now.getTime();
  for (let i = 0; i < anchors.length - 1; i++) {
    if (anchors[i].timeMs <= nowMs && nowMs <= anchors[i + 1].timeMs) {
      return [anchors[i], anchors[i + 1]];
    }
  }
  // 방어적 폴백(대전 위치에서는 이론상 도달하지 않음) — 첫 구간으로 대체.
  return [anchors[0], anchors[1]];
}

// export: scripts/exportAuraDayPreview.ts 등 dev 검증 스크립트가 훅과 동일한 로직으로
// 임의 시각의 span/낮밤 여부를 재현할 수 있도록 노출한다(로직 재구현으로 인한 드리프트 방지).
export function computeCurrentSpanDeg(now: Date): number {
  const [a, b] = findBracket(now);
  return interpolateSpan(now.getTime(), a, b);
}

export function isWithinDaytime(now: Date): boolean {
  const times = SunCalc.getTimes(resolveKstNoonAnchor(now), SUNCALC_LOCATION.latitude, SUNCALC_LOCATION.longitude);
  return now.getTime() >= times.sunrise!.getTime() && now.getTime() <= times.sunset!.getTime();
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export interface AuraDuskMotion {
  boundaryAngleTargetDeg: number; // t_target * (currentSpanDeg / 2) — "기준각" 오프셋. 절대각은 다음 단계에서 기준각을 더해 조합한다.
  currentSpanDeg: number;
  moveDurationMs: number;
  isDaytime: boolean;
}

export function useAuraDuskMotion(): AuraDuskMotion {
  const [currentSpanDeg, setCurrentSpanDeg] = useState<number>(() => computeCurrentSpanDeg(new Date()));
  const [isDaytime, setIsDaytime] = useState<boolean>(() => isWithinDaytime(new Date()));
  const [boundaryAngleTargetDeg, setBoundaryAngleTargetDeg] = useState<number>(0);
  const [moveDurationMs, setMoveDurationMs] = useState<number>(0);

  // 렌더 트리거 없이 tick 루프에서 읽고 쓰는 내부 상태.
  const currentTRef = useRef(0);
  const targetTRef = useRef(0);
  const spanRef = useRef(currentSpanDeg);

  useEffect(() => {
    spanRef.current = currentSpanDeg;
  }, [currentSpanDeg]);

  // 레이어3 — span은 1분 간격으로만 재계산(고빈도 갱신 불필요).
  useEffect(() => {
    const id = setInterval(() => {
      setCurrentSpanDeg(computeCurrentSpanDeg(new Date()));
    }, SPAN_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // 레이어1+2 — 목표 t 재추출. "목표값이 바뀔 때마다" 그 목표까지 걸리는 duration을 함께 계산해 노출한다.
  function pickNewTarget(now: Date) {
    const daytime = isWithinDaytime(now);
    setIsDaytime(daytime);

    const newTargetT = daytime ? randomInRange(0, 1) : randomInRange(-1, 0);
    targetTRef.current = newTargetT;

    const distance = Math.abs(newTargetT - currentTRef.current);
    const durationMs = (distance / T_SPEED_PER_SEC) * 1000;

    setMoveDurationMs(durationMs);
    setBoundaryAngleTargetDeg(newTargetT * (spanRef.current / 2));
  }

  useEffect(() => {
    pickNewTarget(new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 레이어1+2 — tick마다 현재 t를 목표 방향으로 speed*dt만큼 이동, 도달 시 새 목표 재추출.
  useEffect(() => {
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
        pickNewTarget(new Date(nowMs));
      }
    }, T_TICK_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { boundaryAngleTargetDeg, currentSpanDeg, moveDurationMs, isDaytime };
}
