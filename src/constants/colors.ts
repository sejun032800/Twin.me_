// src/constants/colors.ts

// ── Layer 1: 브랜드 팔레트 (불변) ────────────────────────────────────────────
export const BRAND = {
  MINT:        '#BADFDB',
  CREAM:       '#FCF9EA',
  PINK:        '#FFBDBD',
  CORAL:       '#FFA4A4',
  CORAL_DEEP:  '#E07A82',   // 프레스 상태, 선택된 탭
} as const;

// ── 6sigma 모드 전용 글래스모피즘 accent (STEP 11-3) ─────────────────────────
// light/dark 모드와는 무관 — themeMode==='sigma'일 때만 쓰는 src/components/glass/*
// 컴포넌트 전용 색이다. DEFAULT는 rgb(226,120,226)로 분해되며, glass 컴포넌트들이
// 이 값을 알파 블렌딩해 틴트/테두리를 만든다.
export const SIGMA_ACCENT = {
  DEFAULT: '#E278E2',
  PRESSED: '#D345D3', // GlassButton 눌림 상태 테두리
  RING:    '#EB84E2', // GlassRing 진행률 아크
} as const;

// ── Layer 1: 배경 & 시스템 컬러 ───────────────────────────────────────────────
export const SYS = {
  BG_DARK_MIDNIGHT: '#0A0D1A',   // 다크모드 메인 배경, 스플래시, 딥 인디고 배너
  BG_LIGHT_SNOW:    '#F8F9FA',   // 라이트모드 메인 배경
  CARD_LIGHT:       '#FFFFFF',
  CARD_DARK:        '#1E293B',
  BADGE_AI:         '#5FB3A8',   // AI 룸 구분 뱃지
  CRISIS_RED:       '#EF4444',   // CrisisMode 배경 펄스
  TEXT_DARK:        '#1A1A1A',
  TEXT_LIGHT:       '#FFFFFF',
  TEXT_MUTED:       '#888888',   // 보조 텍스트 (라벨/캡션 회색조)
  TAB_INACTIVE_LIGHT: '#C0C0C0', // 라이트모드 탭바 비활성 아이콘/라벨
} as const;

// ── 모달 백드롭 — 테마 무관 고정 딤 배경 (스크림은 관례적으로 항상 검정 계열) ──────
export const MODAL_BACKDROP_LIGHT = 'rgba(0,0,0,0.5)';
export const MODAL_BACKDROP = 'rgba(0,0,0,0.6)';
export const MODAL_BACKDROP_HEAVY = 'rgba(0,0,0,0.8)';

// ── Layer 2: 오라 시스템 (v2.7) — 그룹별 RGB 채널 range 상수만 노출, 실제 합성은 auraEngine이 계산 ──
export const AURA_GROUP_A_CHANNELS = {
  // Inner Warmth — expressiveness/attachmentSecurity/trustPace → R/G/B
  R: { base: 230, coeff: 35, min: 190, max: 255 }, // expressiveness
  G: { base: 150, coeff: 70, min: 90,  max: 220 }, // attachmentSecurity
  B: { base: 140, coeff: 30, min: 105, max: 170 }, // trustPace
  hueSafety: [-15, 50] as const, // 로즈·코랄·골드 대역 밖으로 탈출 금지
} as const;

export const AURA_GROUP_B_CHANNELS = {
  // Outer Rhythm — conflictResponse/spontaneity/independence → R/G/B
  R: { base: 145, coeff: 15, min: 130, max: 160 }, // conflictResponse
  G: { base: 190, coeff: 45, min: 145, max: 235 }, // spontaneity
  B: { base: 210, coeff: 45, min: 165, max: 255 }, // independence
  hueSafety: [155, 260] as const, // 틸·스카이블루·바이올렛 대역 밖으로 탈출 금지
} as const;

// ── 그라데이션 (시그니처 요소 전용) ────────────────────────────────────────────
export const GRADIENT = {
  // 방향: Mint → Cream → Pink → Coral (135deg)
  BRAND_STOPS: [BRAND.MINT, BRAND.CREAM, BRAND.PINK, BRAND.CORAL] as const,
  BRAND_ANGLE: 135,
} as const;

// ── 다크모드 토큰 override ──────────────────────────────────────────────────────
export function getBg(isDark: boolean) {
  return isDark ? SYS.BG_DARK_MIDNIGHT : SYS.BG_LIGHT_SNOW;
}
export function getCard(isDark: boolean) {
  return isDark ? SYS.CARD_DARK : SYS.CARD_LIGHT;
}
export function getText(isDark: boolean) {
  return isDark ? SYS.TEXT_LIGHT : SYS.TEXT_DARK;
}
