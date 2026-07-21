// ─── 6축 오라 매핑 엔진 (성향 → AuraVector, MASTER.md §1.3 v2.8) ────────────────
// 6축 점수를 3+3 그룹(Inner Warmth / Outer Rhythm)으로 묶어 그룹당 RGB 채널을
// 1:1 합성한 뒤 HSL로 변환, 덕 게이트(Dusk Gate)로 클램핑해 colorA/colorB 2색을 만든다.
// 축 점수는 베이지안 확률 벡터 전체의 가중합으로 계산되므로, 인터뷰가 진행될수록
// (특정 유형으로 확률이 수렴할수록) 오라 색이 부드럽게 그라데이션되며 또렷해진다.

import { AURA_GROUP_A_CHANNELS, AURA_GROUP_B_CHANNELS } from '../constants/colors';
import { clampToDuskGate } from './auraThemeEngine';
import { ENNEAGRAM_TYPES, AURA_AXES, AuraAxis, AuraAxisScores, AuraChannel, AuraVector, ProbabilityVector, ScoreBand } from '../types/genesis';

// 각 축이 표현하는 두 방향(direction A ↔ B). score -1(A) ~ +1(B).
export const AURA_AXIS_DIRECTIONS: Record<AuraAxis, { a: string; b: string }> = {
  attachmentSecurity: { a: '신중하게 곁을 내주는', b: '단단하게 곁을 지키는' },
  conflictResponse: { a: '갈등 앞에서 여백을 두는', b: '갈등 앞에서 직진하는' },
  expressiveness: { a: '감정을 차분히 담아두는', b: '감정을 풍부하게 표현하는' },
  independence: { a: '함께하는 시간을 우선하는', b: '자기만의 시간을 우선하는' },
  spontaneity: { a: '꼼꼼하게 계획하는', b: '자유롭게 즉흥적인' },
  trustPace: { a: '천천히 마음을 여는', b: '빠르게 마음을 여는' },
};

// 유형별 6축 성향 점수 — 모두 강점 프레임 어휘로만 해설되도록 방향을 설계함.
const TYPE_AURA_AXIS_SCORES: Record<string, AuraAxisScores> = {
  '1': { attachmentSecurity: 0.3, conflictResponse: 0.4, expressiveness: -0.3, independence: 0.2, spontaneity: -0.7, trustPace: -0.3 },
  '2': { attachmentSecurity: -0.2, conflictResponse: -0.5, expressiveness: 0.6, independence: -0.6, spontaneity: 0.2, trustPace: 0.5 },
  '3': { attachmentSecurity: 0.4, conflictResponse: 0.3, expressiveness: 0.2, independence: 0.3, spontaneity: 0.1, trustPace: 0.1 },
  '4': { attachmentSecurity: -0.3, conflictResponse: -0.2, expressiveness: 0.8, independence: 0.3, spontaneity: 0.4, trustPace: -0.2 },
  '5': { attachmentSecurity: 0.1, conflictResponse: -0.4, expressiveness: -0.7, independence: 0.8, spontaneity: -0.3, trustPace: -0.7 },
  '6': { attachmentSecurity: -0.4, conflictResponse: -0.3, expressiveness: 0.1, independence: -0.3, spontaneity: -0.5, trustPace: -0.4 },
  '7': { attachmentSecurity: 0.3, conflictResponse: -0.6, expressiveness: 0.7, independence: 0.4, spontaneity: 0.9, trustPace: 0.6 },
  '8': { attachmentSecurity: 0.5, conflictResponse: 0.9, expressiveness: 0.3, independence: 0.7, spontaneity: 0.3, trustPace: 0.2 },
  '9': { attachmentSecurity: 0.2, conflictResponse: -0.8, expressiveness: -0.4, independence: -0.1, spontaneity: 0.2, trustPace: 0.0 },
};

const DEFAULT_AXIS_SCORES: AuraAxisScores = {
  attachmentSecurity: 0, conflictResponse: 0, expressiveness: 0, independence: 0, spontaneity: 0, trustPace: 0,
};

/** 베이지안 확률 벡터 전체를 가중합해 6축 점수를 계산한다 (인터뷰 진행 중에도 부드럽게 갱신). */
export function computeAuraAxisScores(probabilities: ProbabilityVector | null): AuraAxisScores {
  if (!probabilities) return { ...DEFAULT_AXIS_SCORES };

  const result = { ...DEFAULT_AXIS_SCORES };
  for (const axis of AURA_AXES) {
    let weighted = 0;
    for (const type of ENNEAGRAM_TYPES) {
      const p = probabilities[type] ?? 0;
      weighted += p * (TYPE_AURA_AXIS_SCORES[type]?.[axis] ?? 0);
    }
    result[axis] = Math.max(-1, Math.min(1, weighted));
  }
  return result;
}

/** 3구간 스코어밴드 — Why My Aura 카피 풀 매핑 키. low=A극 우세 / mid=균형 / high=B극 우세. */
export function toScoreBand(score: number): ScoreBand {
  if (score <= -0.33) return 'low';
  if (score >= 0.33) return 'high';
  return 'mid';
}

interface RgbChannelSpec {
  base: number;
  coeff: number;
  min: number;
  max: number;
}

interface GroupChannelSpec {
  R: RgbChannelSpec;
  G: RgbChannelSpec;
  B: RgbChannelSpec;
  hueSafety: readonly [number, number];
}

function clampChannel(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** MASTER.md §1.3 RGB 채널 합성 수식 — group[R/G/B].base + score×coeff → clamp(min, max). */
function composeGroupRgb(spec: GroupChannelSpec, scores: readonly [number, number, number]): [number, number, number] {
  const r = clampChannel(spec.R.base + scores[0] * spec.R.coeff, spec.R.min, spec.R.max);
  const g = clampChannel(spec.G.base + scores[1] * spec.G.coeff, spec.G.min, spec.G.max);
  const b = clampChannel(spec.B.base + scores[2] * spec.B.coeff, spec.B.min, spec.B.max);
  return [r, g, b];
}

/** RGB(0-255) → HSL(hue 0-360, saturation/lightness 0-100). 순수 TS, 외부 라이브러리 의존 없음. */
export function rgbToHsl(r: number, g: number, b: number): { hue: number; saturation: number; lightness: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const lightness = (max + min) / 2;

  let hue = 0;
  let saturation = 0;
  const delta = max - min;
  if (delta !== 0) {
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case rNorm:
        hue = (gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        hue = (bNorm - rNorm) / delta + 2;
        break;
      default:
        hue = (rNorm - gNorm) / delta + 4;
        break;
    }
    hue *= 60;
  }

  return { hue, saturation: saturation * 100, lightness: lightness * 100 };
}

/** 그룹 점수 3개를 RGB 합성 → HSL 변환 → 덕 게이트로 클램핑한 최종 AuraChannel. */
function buildGroupColor(spec: GroupChannelSpec, scores: readonly [number, number, number]): AuraChannel {
  const [r, g, b] = composeGroupRgb(spec, scores);
  const { hue, saturation, lightness } = rgbToHsl(r, g, b);
  return clampToDuskGate(hue, saturation, lightness, spec.hueSafety);
}

export function buildAuraVector(probabilities: ProbabilityVector | null): AuraVector {
  const axisScores = computeAuraAxisScores(probabilities);

  const colorA = buildGroupColor(AURA_GROUP_A_CHANNELS, [
    axisScores.expressiveness,
    axisScores.attachmentSecurity,
    axisScores.trustPace,
  ]);

  const colorB = buildGroupColor(AURA_GROUP_B_CHANNELS, [
    axisScores.conflictResponse,
    axisScores.spontaneity,
    axisScores.independence,
  ]);

  return { colorA, colorB, axisScores };
}

export function auraChannelToCss({ hue, saturation, lightness }: AuraChannel): string {
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
