// ─── 6 Sigma 테마 시스템 (Phase 6 1단계, v2.7 2색 오라 반영) ───────────────────
// 제네시스 인터뷰 완료 후 산출된 AuraVector(§1.3 3+3 그룹 RGB 합성 결과 colorA/colorB)를
// 기반으로 유저 고유의 다크 테마 팔레트를 생성한다. 오라 미확정(온보딩 전/진행 중) 상태에서는
// getDefaultDarkTheme()의 고정 다크 팔레트로 폴백한다.

import type { AuraVector } from '@/types/genesis';
import { auraChannelToCss } from '@/engine/auraEngine';
import { BRAND, SYS } from '@/constants/colors';

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

  // ── v2.7: 2색 오라 (§1.3 그룹 A/B RGB 합성 결과, 그대로 노출) ───────────────
  primaryAuraColor: string;              // colorA(Inner Warmth) → CSS hsl()
  secondaryAuraColor: string;            // colorB(Outer Rhythm) → CSS hsl()
  gradientStops: readonly [string, string]; // [primaryAuraColor, secondaryAuraColor] — 그라데이션 렌더 소비처용
}

// AuraChannel(hue/saturation/lightness) → hsl() 문자열 변환 헬퍼
function hsl(hue: number, saturation: number, lightness: number): string {
  return auraChannelToCss({ hue, saturation, lightness });
}

export function buildSigmaTheme(auraVector: AuraVector): SigmaTheme {
  const { colorA, colorB } = auraVector;
  const { hue, saturation, lightness } = colorA;

  const primaryAuraColor = hsl(colorA.hue, colorA.saturation, colorA.lightness);
  const secondaryAuraColor = hsl(colorB.hue, colorB.saturation, colorB.lightness);

  return {
    bg: hsl(hue, saturation * 0.3, 12),
    bgSecondary: hsl(hue, saturation * 0.35, 16),
    card: hsl(hue, saturation * 0.4, 20),
    accent: primaryAuraColor,
    accentSoft: hsl(hue, saturation * 0.5, 25),
    text: SYS.TEXT_LIGHT,
    textMuted: hsl(hue, 20, 65),
    border: hsl(hue, saturation * 0.4, 25),
    tabBar: hsl(hue, saturation * 0.3, 12),

    primaryAuraColor,
    secondaryAuraColor,
    gradientStops: [primaryAuraColor, secondaryAuraColor] as const,
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

    primaryAuraColor: BRAND.CORAL,
    secondaryAuraColor: BRAND.MINT,
    gradientStops: [BRAND.CORAL, BRAND.MINT] as const,
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

    primaryAuraColor: BRAND.CORAL,
    secondaryAuraColor: BRAND.MINT,
    gradientStops: [BRAND.CORAL, BRAND.MINT] as const,
  };
}
