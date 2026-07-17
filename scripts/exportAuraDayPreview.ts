// ─── dev 전용 검증 스크립트 — 시뮬레이터 없이 오라 그라데이션 하루 타임라인 확인 ──────
// useAuraDuskMotion(computeCurrentSpanDeg/isWithinDaytime)과 auraEngine.buildAuraVector()의
// 실제 계산 결과를 오늘(대전 기준) 8개 대표 시각에 대해 뽑아 콘솔+JSON으로 출력한다.
// 실행: npm run preview:aura-day (ts-node 필요 — 아래 설치 안내 참고)

import * as fs from 'fs';
import * as SunCalc from 'suncalc';
import { buildAuraVector } from '../src/engine/auraEngine';
import { computeCurrentSpanDeg, isWithinDaytime, resolveKstNoonAnchor, SUNCALC_LOCATION } from '../src/hooks/useAuraDuskMotion';
import type { AuraChannel, ProbabilityVector } from '../src/types/genesis';

// AuraDuskGradient.tsx와 동일한 기준각(baseAngleDeg) 공식을 그대로 재현한다.
// RN 컴포넌트 자체는 Metro 없이 실행할 수 없어, 순수 계산 부분만 이 스크립트에 복제했다.
const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 844;
const PIVOT_X_RATIO = 1;
const PIVOT_Y_RATIO = 0.1;
const TARGET_CORNER_X_RATIO = 0;
const TARGET_CORNER_Y_RATIO = 1;
const GRADIENT_DIAGONAL_DEG = 45;

function computeBaseAngleDeg(width: number, height: number): number {
  const pivotX = width * PIVOT_X_RATIO;
  const pivotY = height * PIVOT_Y_RATIO;
  const cornerX = width * TARGET_CORNER_X_RATIO;
  const cornerY = height * TARGET_CORNER_Y_RATIO;
  const dx = cornerX - pivotX;
  const dy = cornerY - pivotY;
  const pivotToCornerDeg = Math.atan2(dy, dx) * (180 / Math.PI);
  return pivotToCornerDeg - GRADIENT_DIAGONAL_DEG;
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function channelToHex(channel: AuraChannel): string {
  return hslToHex(channel.hue, channel.saturation, channel.lightness);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

interface TimelineEntry {
  label: string;
  time: string;
  isDaytime: boolean;
  spanDeg: number;
  rotationMinDeg: number;
  rotationMidDeg: number;
  rotationMaxDeg: number;
}

function buildTimelineEntry(label: string, date: Date, baseAngleDeg: number): TimelineEntry {
  const daytime = isWithinDaytime(date);
  const spanDeg = computeCurrentSpanDeg(date);
  // 낮: t∈{0,0.5,1} / 밤: t∈{-1,-0.5,0} — useAuraDuskMotion의 낮/밤 t 게이팅 범위와 동일.
  const [tMin, tMid, tMax] = daytime ? [0, 0.5, 1] : [-1, -0.5, 0];
  const rotationFor = (t: number) => baseAngleDeg + t * (spanDeg / 2);
  return {
    label,
    time: date.toISOString(),
    isDaytime: daytime,
    spanDeg,
    rotationMinDeg: rotationFor(tMin),
    rotationMidDeg: rotationFor(tMid),
    rotationMaxDeg: rotationFor(tMax),
  };
}

function main() {
  // 도전자형(에니어그램 8번) 성향 — auraEngine.ts의 TYPE_AURA_AXIS_SCORES['8']과 동일한
  // axis score(attachmentSecurity:0.5, conflictResponse:0.9, expressiveness:0.3,
  // independence:0.7, spontaneity:0.3, trustPace:0.2)를 재현하는 확률 벡터.
  const sampleProbabilities = { '8': 1 } as unknown as ProbabilityVector;
  const auraVector = buildAuraVector(sampleProbabilities);

  const baseAngleDeg = computeBaseAngleDeg(SCREEN_WIDTH, SCREEN_HEIGHT);

  const now = new Date();
  // resolveKstNoonAnchor: suncalc가 UTC 정오 기준으로 "그날"을 판정하는 버그를 피하려고,
  // 실행 시각의 KST 캘린더 날짜에 대응하는 KST 정오를 넘긴다(useAuraDuskMotion.ts 참고).
  const times = SunCalc.getTimes(resolveKstNoonAnchor(now), SUNCALC_LOCATION.latitude, SUNCALC_LOCATION.longitude);
  // sunrise/sunset은 극지방 백야/극야가 아니면 null이 아니다 — 대전(36.35°N)은 온대 지역.
  const sunrise = times.sunrise!;
  const solarNoon = times.solarNoon;
  const sunset = times.sunset!;
  const solarMidnight = times.nadir;

  const timeline: TimelineEntry[] = [
    buildTimelineEntry('sunrise', sunrise, baseAngleDeg),
    buildTimelineEntry('sunrise+2h', addHours(sunrise, 2), baseAngleDeg),
    buildTimelineEntry('solarNoon', solarNoon, baseAngleDeg),
    buildTimelineEntry('solarNoon+2h', addHours(solarNoon, 2), baseAngleDeg),
    buildTimelineEntry('sunset', sunset, baseAngleDeg),
    buildTimelineEntry('sunset+2h', addHours(sunset, 2), baseAngleDeg),
    buildTimelineEntry('solarMidnight', solarMidnight, baseAngleDeg),
    buildTimelineEntry('solarMidnight+2h', addHours(solarMidnight, 2), baseAngleDeg),
  ];

  const result = {
    sampleColorA: channelToHex(auraVector.colorA),
    sampleColorB: channelToHex(auraVector.colorB),
    baseAngleDeg,
    timeline,
  };

  const json = JSON.stringify(result, null, 2);
  console.log(json);

  const outPath = '/tmp/aura-day-preview.json';
  fs.writeFileSync(outPath, json, 'utf-8');
  console.log(`\n[exportAuraDayPreview] 저장 완료: ${outPath}`);
}

main();
