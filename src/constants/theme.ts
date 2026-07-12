// ─── 6 Sigma 테마 시스템 (Phase 6 1단계) ─────────────────────────────────────
// 제네시스 인터뷰 완료 후 산출된 AuraVector(6축 오라 벡터)의 dominant 채널을 기반으로
// 유저 고유의 다크 테마 팔레트를 생성한다. 오라 미확정(온보딩 전/진행 중) 상태에서는
// getDefaultDarkTheme()의 고정 다크 팔레트로 폴백한다.

import type { AuraVector, AuraAxis } from '@/types/genesis';
import { AURA_AXES } from '@/types/genesis';
import { auraChannelToCss } from '@/engine/auraEngine';
import { AURA_BASE_HUE, BRAND, SYS } from '@/constants/colors';

export type ThemeMode = 'sigma' | 'light' | 'dark';

export interface SigmaTheme {
  bg: string;          // 메인 배경색
  bgSecondary: string; // 서브 배경, 카드 배경
  card: string;        // 카드 컴포넌트 배경
  accent: string;      // 버튼, 활성 탭, 강조 요소
  accentSoft: string;  // accent + 낮은 opacity, 태그/칩 배경
  text: string;        // 기본 텍스트
  textMuted: string;   // 보조 텍스트, '#888' 계열
  border: string;      // 구분선, 테두리
  tabBar: string;      // 탭바 배경
}

// AuraChannel(hue/saturation/lightness) → hsl() 문자열 변환 헬퍼
function hsl(hue: number, saturation: number, lightness: number): string {
  return auraChannelToCss({ hue, saturation, lightness });
}

/** |axisScores| 절댓값이 가장 큰 축을 dominant로 선택한다 — meshStops는 축 순서 고정
 * 배열이라(§auraEngine.ts buildAuraVector 주석 참조) dominant 판별에 쓸 수 없다. */
function pickDominantAxis(axisScores: AuraVector['axisScores']): { axis: AuraAxis; score: number } {
  let dominantAxis: AuraAxis = AURA_AXES[0];
  let dominantScore = axisScores[dominantAxis];
  for (let i = 1; i < AURA_AXES.length; i++) {
    const axis = AURA_AXES[i];
    const score = axisScores[axis];
    if (Math.abs(score) > Math.abs(dominantScore)) {
      dominantAxis = axis;
      dominantScore = score;
    }
  }
  return { axis: dominantAxis, score: dominantScore };
}

export function buildSigmaTheme(auraVector: AuraVector): SigmaTheme {
  const { axis: dominantAxis, score: dominantScore } = pickDominantAxis(auraVector.axisScores);

  const hue = AURA_BASE_HUE[dominantAxis];
  // auraEngine.scoreToChannel()과 동일한 수식으로 saturation/lightness 산출
  const saturation = Math.min(92, 55 + Math.abs(dominantScore) * 35);
  const lightness = Math.max(40, Math.min(72, 55 + dominantScore * 8));

  return {
    bg: hsl(hue, saturation * 0.3, 12),
    bgSecondary: hsl(hue, saturation * 0.35, 16),
    card: hsl(hue, saturation * 0.4, 20),
    accent: hsl(hue, saturation, lightness),
    accentSoft: hsl(hue, saturation * 0.5, 25),
    text: SYS.TEXT_LIGHT,
    textMuted: hsl(hue, 20, 65),
    border: hsl(hue, saturation * 0.4, 25),
    tabBar: hsl(hue, saturation * 0.3, 12),
  };
}

export function getDefaultDarkTheme(): SigmaTheme {
  return {
    bg: SYS.BG_DARK_MIDNIGHT,
    bgSecondary: '#0F1626',
    card: SYS.CARD_DARK,
    accent: BRAND.CORAL,
    accentSoft: '#2D1F2B',
    text: SYS.TEXT_LIGHT,
    textMuted: SYS.TEXT_MUTED,
    border: SYS.CARD_DARK,
    tabBar: SYS.BG_DARK_MIDNIGHT,
  };
}

export function getLightTheme(): SigmaTheme {
  return {
    bg: '#FBF8F3',
    bgSecondary: '#F0F2F5',
    card: SYS.CARD_LIGHT,
    accent: BRAND.CORAL,
    accentSoft: '#FFE8E8',
    text: SYS.TEXT_DARK,
    textMuted: SYS.TEXT_MUTED,
    border: '#E8EAED',
    tabBar: SYS.CARD_LIGHT,
  };
}
