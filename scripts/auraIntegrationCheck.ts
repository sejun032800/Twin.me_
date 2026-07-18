// ─── 6sigma 오라 시스템 종단(end-to-end) 감사 스크립트 (STEP 1~11 통합 감사) ────────
// 실제 소스 모듈(auraEngine.buildAuraVector, auraThemeEngine.resolveSigmaAuraOpacity,
// useAuraDuskMotion)을 재구현 없이 그대로 import해서 실행한다 — exportAuraDayPreview.ts와
// 같은 원칙("RN 컴포넌트 자체만 Metro 없이 못 돌리니 계산 로직만 재현"; 여기서는 계산
// 로직조차 재현하지 않고 실제 함수를 직접 호출한다). AuraDuskGradient.tsx 자체(RN View/
// Reanimated/expo-linear-gradient 의존)는 Metro 밖에서 import 시 크래시하므로 이 스크립트의
// 범위 밖이다 — 그 부분은 코드 추적(정적 분석)으로만 검증했다.
//
// 실행: npx tsx scripts/auraIntegrationCheck.ts
// (주의: npm run preview:aura-day가 쓰는 ts-node는 이 환경의 Node 24 ESM 해석과 충돌해
//  기존 스크립트조차 실행이 안 되는 상태였다 — tsx로 우회했다. package.json은 건드리지 않음.)

import * as fs from 'fs';
import * as React from 'react';
import { buildAuraVector } from '../src/engine/auraEngine';
import { resolveSigmaAuraOpacity, AURA_OPACITY_TIERS } from '../src/engine/auraThemeEngine';
import { useAuraDuskMotion, type AuraDuskMotion } from '../src/hooks/useAuraDuskMotion';
import { SIGMA_ACCENT } from '../src/constants/colors';
import type { ProbabilityVector, EnneagramType, AuraVector } from '../src/types/genesis';

// ── WCAG 상대휘도/대비 공식 (지난 감사 턴에서 쓴 것과 동일) ──────────────────────
type RGB = [number, number, number];

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminance([r, g, b]: RGB): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
function blend(base: RGB, color: RGB, alpha: number): RGB {
  return [0, 1, 2].map((i) => base[i] * (1 - alpha) + color[i] * alpha) as RGB;
}
function hslToRgb(h: number, s: number, l: number): RGB {
  const S = s / 100;
  const L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
function hexToRgb(hex: string): RGB {
  const v = hex.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
function rgbToHue(rgb: RGB): number {
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue: number;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  return (hue + 360) % 360;
}
function circularHueDistance(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

const BG_DARK_MIDNIGHT: RGB = [10, 13, 26];
const WHITE: RGB = [255, 255, 255];
const GLASS_RING_NEAR_WHITE: RGB = [248, 249, 250]; // GlassRing 텍스트 색 #F8F9FA
const AA_THRESHOLD = 4.5;
// 시각 구분 기준으로 쓴 최소 hue 거리(도) — 정량 규격이 없어 임의로 잡은 보수적 하한선.
// 이보다 작으면 accent 색이 배경 hue와 시각적으로 거의 같은 색 계열로 섞여 보일 위험이 있다는
// 신호로만 쓴다(엄밀한 접근성 표준이 아니라 디자인 휴리스틱).
const MIN_DISTINGUISHABLE_HUE_DISTANCE = 15;

const SIGMA_ACCENT_DEFAULT_HUE = rgbToHue(hexToRgb(SIGMA_ACCENT.DEFAULT));
const SIGMA_ACCENT_RING_HUE = rgbToHue(hexToRgb(SIGMA_ACCENT.RING));

// ── Part C-2: 화면키별 opacity 실제 산출값 (auraThemeEngine.resolveSigmaAuraOpacity 직접 호출) ──
function checkOpacityPerScreen() {
  const screenKeys = ['mainHero', 'chatList', 'historyMap', 'settings'] as const;
  return screenKeys.map((key) => ({
    screenKey: key,
    opacity: resolveSigmaAuraOpacity(key),
    tierTableValue: (AURA_OPACITY_TIERS as Record<string, unknown>)[key],
  }));
}

// ── Part C-1: 채팅방 진입(frozen=true)→5초 대기→퇴장(frozen=false) 실제 훅 실행 ──────
// react-test-renderer로 useAuraDuskMotion을 실제로 마운트해 구동한다(재구현 아님).
// 이 리포지토리엔 react-test-renderer 타입 선언이 없어(11-2 테스트 때와 동일한 이유)
// require + 캐스팅으로 쓴다. 시간 경과는 fake timer가 아니라 실제 wall-clock 대기다.
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkChatRoomFreezeResume() {
  const RTR = require('react-test-renderer') as {
    act: (callback: () => void | Promise<void>) => void | Promise<void>;
    create: (element: React.ReactElement) => { update: (element: React.ReactElement) => void; unmount: () => void };
  };
  const { act, create } = RTR;

  let latest!: AuraDuskMotion;
  function Harness({ frozen }: { frozen: boolean }) {
    latest = useAuraDuskMotion(frozen);
    return null;
  }

  let renderer!: ReturnType<typeof create>;
  await act(() => {
    renderer = create(React.createElement(Harness, { frozen: false }));
  });

  // 채팅 목록 화면 — 잠깐 자연 진행시켜 마운트 직후 초기값이 아니게 만든다.
  await sleep(1000);
  const beforeRoom: AuraDuskMotion = { ...latest };

  // 방 진입 — frozen=true
  await act(() => {
    renderer.update(React.createElement(Harness, { frozen: true }));
  });
  const atFreezeMoment: AuraDuskMotion = { ...latest };

  // 실제 5초 대기(요청 사양) — frozen 상태에서 값이 전혀 바뀌지 않아야 한다.
  await sleep(5000);
  const after5Seconds: AuraDuskMotion = { ...latest };

  // 방 퇴장 — frozen=false. 타이머를 전혀 진행시키지 않은 시점의 값을 바로 캡처해서
  // "재개 직후 첫 값 == 멈춘 지점"을 확인한다(11-2 테스트와 동일한 검증 방식).
  await act(() => {
    renderer.update(React.createElement(Harness, { frozen: false }));
  });
  const immediatelyAfterResume: AuraDuskMotion = { ...latest };

  await act(() => {
    renderer.unmount();
  });

  const unchangedWhileFrozen =
    atFreezeMoment.boundaryAngleTargetDeg === after5Seconds.boundaryAngleTargetDeg &&
    atFreezeMoment.currentSpanDeg === after5Seconds.currentSpanDeg &&
    atFreezeMoment.moveDurationMs === after5Seconds.moveDurationMs;

  const resumedFromFrozenPoint =
    after5Seconds.boundaryAngleTargetDeg === immediatelyAfterResume.boundaryAngleTargetDeg &&
    after5Seconds.currentSpanDeg === immediatelyAfterResume.currentSpanDeg;

  return {
    beforeRoom,
    atFreezeMoment,
    after5Seconds,
    immediatelyAfterResume,
    unchangedWhileFrozen,
    resumedFromFrozenPoint,
    note:
      'boundaryAngleTargetDeg/currentSpanDeg/moveDurationMs는 훅(useAuraDuskMotion) 레벨의 ' +
      '값이다. AuraDuskGradient.tsx의 Reanimated cancelAnimation(rotation) 단계(실제 화면 ' +
      '회전각을 그 순간 그대로 멈추는 부분)는 react-native-reanimated/RN 코어에 의존해 ' +
      'Metro 밖에서는 import 자체가 크래시하므로 이 스크립트로 실행 검증할 수 없다 — ' +
      '그 부분은 코드 추적(정적 분석)으로만 확인했다.',
  };
}

// ── Part D: 9 순수 유형 + 10 랜덤 샘플 = 19개 조합 ────────────────────────────────
// 시드 고정 PRNG(mulberry32) — "지난번 랜덤 10개"의 정확한 값은 이 세션에서 재구성할
// 근거가 없어(이전 대화에 기록 없음) 새로 생성한다. 재현 가능하도록 시드를 고정해 둔다.
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ENNEAGRAM_TYPES: EnneagramType[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function randomProbabilityVector(rng: () => number): ProbabilityVector {
  const raw = ENNEAGRAM_TYPES.map(() => rng());
  const sum = raw.reduce((a, b) => a + b, 0);
  const normalized = raw.map((v) => v / sum);
  const result = {} as ProbabilityVector;
  ENNEAGRAM_TYPES.forEach((type, i) => { result[type] = normalized[i]; });
  return result;
}

interface ContrastCombo {
  label: string;
  colorAHex: string;
  colorBHex: string;
  colorAHue: number;
  colorBHue: number;
  rows: Array<{
    screenTier: string;
    opacity: number;
    group: 'A' | 'B';
    compositedRgb: string;
    whiteContrast: number;
    whitePassAA: boolean;
    glassRingContrast: number;
    glassRingPassAA: boolean;
  }>;
  hueDistance: {
    accentDefaultVsColorA: number;
    accentDefaultVsColorB: number;
    accentRingVsColorA: number;
    accentRingVsColorB: number;
    minDistance: number;
    accentDistinguishable: boolean;
  };
}

function rgbHex(rgb: RGB): string {
  return '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function analyzeCombo(label: string, auraVector: AuraVector): ContrastCombo {
  const colorARgb = hslToRgb(auraVector.colorA.hue, auraVector.colorA.saturation, auraVector.colorA.lightness);
  const colorBRgb = hslToRgb(auraVector.colorB.hue, auraVector.colorB.saturation, auraVector.colorB.lightness);

  const opacityTiers: Array<{ screenTier: string; opacity: number }> = [
    { screenTier: 'mainHero', opacity: AURA_OPACITY_TIERS.mainHero },
    { screenTier: 'chatList/settings', opacity: AURA_OPACITY_TIERS.chatList },
    { screenTier: 'historyMap', opacity: AURA_OPACITY_TIERS.historyMap },
  ];

  const rows: ContrastCombo['rows'] = [];
  for (const { screenTier, opacity } of opacityTiers) {
    for (const [group, rgb] of [['A', colorARgb], ['B', colorBRgb]] as const) {
      const composited = blend(BG_DARK_MIDNIGHT, rgb, opacity);
      const whiteContrast = contrastRatio(WHITE, composited);
      const glassRingContrast = contrastRatio(GLASS_RING_NEAR_WHITE, composited);
      rows.push({
        screenTier,
        opacity,
        group,
        compositedRgb: rgbHex(composited),
        whiteContrast: Number(whiteContrast.toFixed(2)),
        whitePassAA: whiteContrast >= AA_THRESHOLD,
        glassRingContrast: Number(glassRingContrast.toFixed(2)),
        glassRingPassAA: glassRingContrast >= AA_THRESHOLD,
      });
    }
  }

  const hueDistances = {
    accentDefaultVsColorA: circularHueDistance(SIGMA_ACCENT_DEFAULT_HUE, auraVector.colorA.hue),
    accentDefaultVsColorB: circularHueDistance(SIGMA_ACCENT_DEFAULT_HUE, auraVector.colorB.hue),
    accentRingVsColorA: circularHueDistance(SIGMA_ACCENT_RING_HUE, auraVector.colorA.hue),
    accentRingVsColorB: circularHueDistance(SIGMA_ACCENT_RING_HUE, auraVector.colorB.hue),
  };
  const minDistance = Math.min(...Object.values(hueDistances));

  return {
    label,
    colorAHex: rgbHex(colorARgb),
    colorBHex: rgbHex(colorBRgb),
    colorAHue: Number(auraVector.colorA.hue.toFixed(1)),
    colorBHue: Number(auraVector.colorB.hue.toFixed(1)),
    rows,
    hueDistance: {
      ...hueDistances,
      minDistance: Number(minDistance.toFixed(1)),
      accentDistinguishable: minDistance >= MIN_DISTINGUISHABLE_HUE_DISTANCE,
    },
  };
}

function checkContrastAcross19Combos(): ContrastCombo[] {
  const combos: ContrastCombo[] = [];

  // 9개 순수 유형 케이스
  for (const type of ENNEAGRAM_TYPES) {
    const probabilities = { [type]: 1 } as unknown as ProbabilityVector;
    combos.push(analyzeCombo(`pure-type-${type}`, buildAuraVector(probabilities)));
  }

  // 10개 랜덤 샘플(시드 고정 — 재현 가능)
  const rng = mulberry32(20260718);
  for (let i = 0; i < 10; i++) {
    const probabilities = randomProbabilityVector(rng);
    combos.push(analyzeCombo(`random-${i + 1}`, buildAuraVector(probabilities)));
  }

  return combos;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(80));
  console.log('[C-2] 화면키별 opacity 실제 산출값 (resolveSigmaAuraOpacity 직접 호출)');
  console.log('='.repeat(80));
  const opacityPerScreen = checkOpacityPerScreen();
  console.table(opacityPerScreen);

  console.log('\n' + '='.repeat(80));
  console.log('[C-1] 채팅방 진입(frozen=true) → 5초 대기 → 퇴장(frozen=false) 실제 훅 실행');
  console.log('='.repeat(80));
  const freezeResume = await checkChatRoomFreezeResume();
  console.log('beforeRoom (frozen=false, 1초 경과 후):', freezeResume.beforeRoom);
  console.log('atFreezeMoment (frozen=true 전환 직후):', freezeResume.atFreezeMoment);
  console.log('after5Seconds (frozen=true 유지, 5초 경과 후):', freezeResume.after5Seconds);
  console.log('immediatelyAfterResume (frozen=false 전환 직후, 타이머 미진행):', freezeResume.immediatelyAfterResume);
  console.log('\n5초간 값 불변(unchangedWhileFrozen):', freezeResume.unchangedWhileFrozen);
  console.log('재개 직후 첫 값이 멈춘 값과 동일(resumedFromFrozenPoint):', freezeResume.resumedFromFrozenPoint);
  console.log('\n참고:', freezeResume.note);

  console.log('\n' + '='.repeat(80));
  console.log('[D] 9 순수 유형 + 10 랜덤 샘플 = 19개 조합 대비/hue 거리 검증');
  console.log('='.repeat(80));
  const contrastCombos = checkContrastAcross19Combos();

  const summaryRows = contrastCombos.map((c) => ({
    label: c.label,
    colorA: c.colorAHex,
    colorB: c.colorBHex,
    worstWhiteContrast: Math.min(...c.rows.map((r) => r.whiteContrast)),
    allRowsPassAA: c.rows.every((r) => r.whitePassAA && r.glassRingPassAA),
    minAccentHueDistance: c.hueDistance.minDistance,
    accentDistinguishable: c.hueDistance.accentDistinguishable,
  }));
  console.table(summaryRows);

  const failingCombos = contrastCombos.filter(
    (c) => !c.rows.every((r) => r.whitePassAA && r.glassRingPassAA) || !c.hueDistance.accentDistinguishable,
  );

  if (failingCombos.length === 0) {
    console.log('\n✅ 19개 조합 전체 — 모든 opacity 티어에서 흰색/GlassRing 텍스트 AA(4.5:1) 통과, accent hue 거리도 기준(15°) 이상.');
  } else {
    console.log(`\n⚠️ 기준 미달 조합 ${failingCombos.length}개:`);
    for (const c of failingCombos) {
      console.log(`  - ${c.label} (colorA=${c.colorAHex}, colorB=${c.colorBHex})`);
      for (const r of c.rows) {
        if (!r.whitePassAA || !r.glassRingPassAA) {
          console.log(`      ${r.screenTier} group${r.group}: composited=${r.compositedRgb} white=${r.whiteContrast}:1 glassRing=${r.glassRingContrast}:1`);
        }
      }
      if (!c.hueDistance.accentDistinguishable) {
        console.log(`      accent hue distance 최소값=${c.hueDistance.minDistance}° (기준 ${MIN_DISTINGUISHABLE_HUE_DISTANCE}° 미만)`);
      }
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    opacityPerScreen,
    chatRoomFreezeResume: freezeResume,
    contrastCombos19: contrastCombos,
    failingComboLabels: failingCombos.map((c) => c.label),
  };

  const outPath = '/tmp/aura-integration-check.json';
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n[auraIntegrationCheck] 저장 완료: ${outPath}`);
}

main().catch((err) => {
  console.error('[auraIntegrationCheck] 실행 실패:', err);
  process.exitCode = 1;
});
