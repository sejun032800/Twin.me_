// ─── 6색 성향 테마 엔진 (Aura Theme Engine) — 합성/모션/컨텍스트 레이어 ───────────
// 6축 정의의 단일 진실 공급원: src/types/genesis.ts의 AURA_AXES.
// 축 라벨은 MASTER.md §1.3 기준(코드 변수명 우선)으로 확정됨:
//   attachmentSecurity / conflictResponse / expressiveness
//   independence / spontaneity / trustPace
// 오라 색상은 auraEngine.ts의 HSL 수식이 단일 진실 공급원 (MASTER.md §1.3 B안 확정).
// 본 파일은 auraEngine.ts가 산출한 AuraVector 위에
// 앰비언트 렌더링(메시 합성/모션/화면별 가중치/뮤트 파스텔 게이트)만 담당한다.

import type { AuraChannel, AuraVector } from '../types/genesis';
import { AURA_GROUP_A_CHANNELS, AURA_GROUP_B_CHANNELS } from '../constants/colors';
import type { OverflowStatus } from './scoreCalculator';

// ── 1. 뮤트 파스텔 게이트 (§2.2 — 원색/형광 노출 차단, §1.3 hue 안전 클램프) ────────
// auraEngine의 RGB→HSL 합성이 그룹별 hueSafetyRange 밖으로 새어나가지 않도록
// saturation/lightness 캡과 함께 hue를 그룹별 안전 대역으로 강제 클램핑한다.
export const MUTE_PASTEL_GATE = {
  saturationCap: 92,
  lightnessMin: 40,
  lightnessMax: 72,
} as const;

/**
 * hue를 hueSafetyRange의 중점(mid) 기준 [mid-180, mid+180) 구간으로 wrap-aware 정규화한 뒤 클램프한다.
 * 고정된 -180~180 정규화를 쓰면 그룹 B([155,260]처럼 0/360 경계를 걸치지 않는 범위)의
 * 정상값(예: 207°)이 180° 초과라는 이유만으로 반대편으로 잘못 랩핑되어 훼손된다.
 * 범위 자체의 중점을 기준점으로 잡으면 두 그룹 모두에서 안전하게 동작한다.
 */
function clampHueToSafetyRange(hue: number, hueSafetyRange: readonly [number, number]): number {
  const [lo, hi] = hueSafetyRange;
  const wrapFloor = (lo + hi) / 2 - 180;
  const normalizedHue = (((hue - wrapFloor) % 360) + 360) % 360 + wrapFloor;
  return Math.min(hi, Math.max(lo, normalizedHue));
}

export function clampToMutePastelGate(
  hue: number,
  saturation: number,
  lightness: number,
  hueSafetyRange: readonly [number, number],
): AuraChannel {
  const clampedHue = clampHueToSafetyRange(hue, hueSafetyRange);
  return {
    hue: ((clampedHue % 360) + 360) % 360,
    saturation: Math.min(MUTE_PASTEL_GATE.saturationCap, Math.max(0, saturation)),
    lightness: Math.min(MUTE_PASTEL_GATE.lightnessMax, Math.max(MUTE_PASTEL_GATE.lightnessMin, lightness)),
  };
}

// ── 2. 화면별 가중치 (§4.1 — contextMultiplier 라우팅) ───────────────────────────
export type AuraScreenKey = 'main' | 'chat' | 'historyMap' | 'helix' | 'settings' | 'other';

const BASE_CONTEXT_MULTIPLIER: Record<AuraScreenKey, number> = {
  main: 1.0,
  chat: 0.6,
  historyMap: 0.5,
  helix: 1.3,
  settings: 0.8,
  other: 0.0, // (auth) 등 온보딩 화면은 오라 미노출 — 완성 전 인터뷰 몰입 방해 방지
};

const CHAT_TWIN_ROOM_BOOST = 1.2; // "트윈방"(Self-AI/분석가) 진입 시 ×1.2

/** 경로 세그먼트 → AuraScreenKey. app/_layout.tsx 루트에서 usePathname()과 함께 사용. */
export function resolveAuraScreenKey(pathname: string): AuraScreenKey {
  if (pathname === '/' || pathname === '/index') return 'main';
  if (pathname.startsWith('/chat')) return 'chat';
  if (pathname.startsWith('/history')) return 'historyMap'; // history.tsx가 세부 variant로 재정의(helix)
  if (pathname.startsWith('/settings')) return 'settings';
  return 'other';
}

export interface ContextMultiplierOptions {
  /** 채팅 탭에서 룸1(연인)이 아닌 룸(Self-AI/분석가 '트윈')에 들어와 있는지 */
  isTwinRoom?: boolean;
  /** 역사 탭에서 나선(DNA Helix) 뷰가 활성인지 — true면 historyMap 대신 helix 가중치 사용 */
  isHelixView?: boolean;
}

export function computeContextMultiplier(screenKey: AuraScreenKey, opts: ContextMultiplierOptions = {}): number {
  const resolvedKey: AuraScreenKey = screenKey === 'historyMap' && opts.isHelixView ? 'helix' : screenKey;
  let multiplier = BASE_CONTEXT_MULTIPLIER[resolvedKey];
  if (resolvedKey === 'chat' && opts.isTwinRoom) multiplier *= CHAT_TWIN_ROOM_BOOST;
  return multiplier;
}

// ── 3. 전역 불투명도 (§3.1 — auraOpacity = base_opacity × contextMultiplier) ─────
export const AURA_BASE_OPACITY = { dark: 0.12, light: 0.08 } as const;

export function computeAuraOpacity(
  isLight: boolean,
  screenKey: AuraScreenKey,
  opts: ContextMultiplierOptions = {},
  reduceAuraMotion = false,
): number {
  if (reduceAuraMotion) return 0;
  const base = isLight ? AURA_BASE_OPACITY.light : AURA_BASE_OPACITY.dark;
  return Math.max(0, Math.min(1, base * computeContextMultiplier(screenKey, opts)));
}

// ── 4. 추종 보간 (§3.2 — Universal Easing) ──────────────────────────────────────
// value_display ← value_display + η·(value_target − value_display), η = 0.08~0.12.
// Reanimated의 withTiming 기반 애니메이션에서는 프레임 루프 대신 "체감상 동등한"
// duration으로 근사한다: 지수감쇠가 자연스러운 정지에 도달하는 시간(≈ -1/ln(1-η) 프레임)을
// 60fps 기준 ms로 환산.
export const AURA_FOLLOW_ETA = 0.1; // 0.08~0.12 권장 범위의 중앙값

export function etaToTimingDurationMs(eta: number = AURA_FOLLOW_ETA): number {
  const framesTo95Percent = Math.log(0.05) / Math.log(1 - eta); // ~99% 근접까지 프레임 수
  return Math.round((framesTo95Percent * 1000) / 60);
}

/** 단발 추종(비-worklet 컨텍스트). worklet 내부에서는 withTiming(target, {duration: etaToTimingDurationMs()})을 직접 사용할 것. */
export function followEasingStep(current: number, target: number, eta: number = AURA_FOLLOW_ETA): number {
  return current + eta * (target - current);
}

// ── 5. v2.2 엔진 연동 — 오버플로우 채도 피드백 (§4.1) ────────────────────────────
// 경고 자체는 항상 구조색 레드(#EF4444)로만 수행하고, 여기서는 "분위기색"만 미세 변조한다.
const OVERFLOW_SATURATION_DELTA = { EXCESS_GAIN: 1.12, CRITICAL_LOSS: 0.82, NONE: 1.0 } as const;

export function applyOverflowSaturationFeedback(vector: AuraVector, overflowStatus: OverflowStatus): AuraVector {
  const factor = OVERFLOW_SATURATION_DELTA[overflowStatus] ?? 1.0;
  if (factor === 1.0) return vector;

  // colorA/colorB는 서로 다른 hueSafetyRange(그룹 A/B)를 쓰므로 배열 순회로 통합하지 않고
  // 각각 명시적으로 게이트를 재적용한다.
  const colorA: AuraChannel = clampToMutePastelGate(
    vector.colorA.hue,
    vector.colorA.saturation * factor,
    vector.colorA.lightness,
    AURA_GROUP_A_CHANNELS.hueSafety,
  );
  const colorB: AuraChannel = clampToMutePastelGate(
    vector.colorB.hue,
    vector.colorB.saturation * factor,
    vector.colorB.lightness,
    AURA_GROUP_B_CHANNELS.hueSafety,
  );

  return { ...vector, colorA, colorB };
}

// ── 6. Dissolve — 재인터뷰/리셋 시 무채색 점토로 (§4.3 4대 모션 중 Dissolve) ──────
export const NEUTRAL_CLAY_CHANNEL: AuraChannel = { hue: 230, saturation: 6, lightness: 55 };

/** t=0(현재 색상) → t=1(무채색 점토)로 보간한 메시 정지점. Reanimated interpolateColor와 함께 사용. */
export function dissolveMeshStops(meshStops: AuraChannel[], t: number): AuraChannel[] {
  const clamped = Math.max(0, Math.min(1, t));
  return meshStops.map((c) => ({
    hue: c.hue,
    saturation: c.saturation + (NEUTRAL_CLAY_CHANNEL.saturation - c.saturation) * clamped,
    lightness: c.lightness + (NEUTRAL_CLAY_CHANNEL.lightness - c.lightness) * clamped,
  }));
}

export function defaultNeutralMeshStops(count = 6): AuraChannel[] {
  return Array.from({ length: count }, (_, i) => ({
    ...NEUTRAL_CLAY_CHANNEL,
    hue: (NEUTRAL_CLAY_CHANNEL.hue + i * 12) % 360,
  }));
}
