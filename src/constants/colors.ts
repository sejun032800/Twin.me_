// src/constants/colors.ts

// ── Layer 1: 브랜드 팔레트 (불변) ────────────────────────────────────────────
export const BRAND = {
  MINT:        '#BADFDB',
  CREAM:       '#FCF9EA',
  PINK:        '#FFBDBD',
  CORAL:       '#FFA4A4',
  CORAL_DEEP:  '#E07A82',   // 프레스 상태, 선택된 탭
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
} as const;

// ── 모달 백드롭 — 테마 무관 고정 딤 배경 (스크림은 관례적으로 항상 검정 계열) ──────
export const MODAL_BACKDROP_LIGHT = 'rgba(0,0,0,0.5)';
export const MODAL_BACKDROP = 'rgba(0,0,0,0.6)';
export const MODAL_BACKDROP_HEAVY = 'rgba(0,0,0,0.8)';

// ── Layer 2: 오라 시스템 — 기준 hue 상수만 노출, 실제 색상은 auraEngine이 계산 ──
export const AURA_BASE_HUE = {
  attachmentSecurity: 210,
  conflictResponse:   15,
  expressiveness:     320,
  independence:       165,
  spontaneity:        45,
  trustPace:          265,
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
