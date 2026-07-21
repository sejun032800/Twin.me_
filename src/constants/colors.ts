// src/constants/colors.ts

// ── Layer 1: 브랜드 팔레트 (불변) ────────────────────────────────────────────
export const BRAND = {
  MINT:        '#BADFDB',
  CREAM:       '#FCF9EA',
  PINK:        '#FFBDBD',
  CORAL:       '#FFA4A4',
  CORAL_DEEP:  '#E07A82',   // 프레스 상태, 선택된 탭
} as const;

// ── 6sigma 모드 전용 글래스모피즘 accent (v2.8 — 오키드→틸-시안 재배치, MASTER §1.3/§1.7) ──
// light/dark 모드와는 무관 — themeMode==='sigma'일 때만 쓰는 src/components/glass/*
// 컴포넌트 전용 색이다. 그룹 B(Outer Rhythm)가 보라 계열(hue 255°~300°)로 이동하면서
// 기존 오키드(hue 300°)와 겹치게 돼, 그룹 B가 비운 틸-시안(hue ~175°~190°)으로 재배치했다.
export const SIGMA_ACCENT = {
  DEFAULT: '#5FD4C8',
  PRESSED: '#3FB3A6', // GlassButton 눌림 상태 테두리
  ON_ACCENT_TEXT: '#1A1A1A', // SYS.TEXT_DARK
  RING: '#7AE0D6', // GlassRing 진행률 아크
  RING_NUMERAL: '#F8F9FA', // 일치율 숫자 (모드 무관 고정)
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

// ── Layer 2: 오라 시스템 (v2.8) — 여름밤 노을, 그룹별 RGB 채널 range 상수만 노출, 실제 합성은 auraEngine이 계산 ──
export const AURA_GROUP_A_CHANNELS = {
  // Inner Warmth — 지평선 노을. expressiveness/attachmentSecurity/trustPace → R/G/B
  R: { base: 150, coeff: 35, min: 115, max: 185 }, // expressiveness
  G: { base: 70,  coeff: 35, min: 40,  max: 105 }, // attachmentSecurity
  B: { base: 55,  coeff: 18, min: 38,  max: 73  }, // trustPace
  hueSafety: [-15, 50] as const, // 로즈·코랄·골드 대역 밖으로 탈출 금지
} as const;

export const AURA_GROUP_B_CHANNELS = {
  // Outer Rhythm — 어두운 밤하늘(보라 계열). conflictResponse/spontaneity/independence → R/G/B
  R: { base: 28, coeff: 10, min: 18, max: 38  }, // conflictResponse
  G: { base: 40, coeff: 22, min: 18, max: 62  }, // spontaneity
  B: { base: 78, coeff: 35, min: 43, max: 113 }, // independence
  hueSafety: [255, 300] as const, // 딥블루·보라·마젠타 대역 밖으로 탈출 금지 (v2.8 변경 — 기존 155~260 틸~바이올렛에서 이동)
} as const;

// ── 고정 하늘 그라데이션 앵커 (사진 픽셀 샘플링 기반, 성향과 무관하게 고정, v2.8 신규) ──
export const DUSK_SKY_ANCHOR = {
  HORIZON_PURPLE: '#663479', // 지평선 근처(그룹 B 하단, 곡선 경계 바로 위), hue 283° L34%
  ZENITH_BLACK_PURPLE: '#180E20', // 천정(화면 최상단), hue 272° L9%
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
