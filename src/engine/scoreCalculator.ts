// ─── DNA 일치율 코어 엔진 (Twin.me 2.0) ────────────────────────────────────────
// SRS §1 정규분포 기반 기준 점수 + 10단계 마스터 티어 매퍼.
// (구 v2.1의 24개 마이크로 이벤트·하드 클램프 필터는 v2.2로 완전히 대체되어
//  src/engine/metrics.ts 로 이관되었다 — docs/Twin.me.md §4 참고.)

import { DNA_PCT_CENTER, K_SCALE } from '../lib/matching/constants';

export type OverflowStatus = 'CRITICAL_LOSS' | 'EXCESS_GAIN' | 'NONE';
export type CompatibilityGrade = 'IDEAL' | 'AVERAGE' | 'COLLISION';

// ── 물리 상수 ──────────────────────────────────────────────────────────────────
const SCORE_FLOOR = 50.5;
const SCORE_PRE_INTERVIEW_CEILING = 89.5;
const INTERVIEW_MAX_BONUS = 5.0;

// S_Base 정규분포 파라미터(§1-2 수식) — 전국 커플 백분위 산출 시에도 동일 분포를 재사용한다.
const SCORE_DISTRIBUTION_MEAN = 70;
const SCORE_DISTRIBUTION_SD = 7.81;

// ── Z-Score 상성 등급 매핑 ───────────────────────────────────────────────────
const GRADE_TO_Z: Record<CompatibilityGrade, number> = {
  IDEAL: 2.5,
  AVERAGE: 0.0,
  COLLISION: -2.5,
};

// ── MBTI 상성 등급 추론 ──────────────────────────────────────────────────────
export function getMBTICompatibilityGrade(
  myMbti: string,
  partnerMbti: string,
): CompatibilityGrade {
  if (!myMbti || !partnerMbti || myMbti.length < 4 || partnerMbti.length < 4) return 'AVERAGE';
  const a = myMbti.toUpperCase();
  const b = partnerMbti.toUpperCase();

  const IDEAL_PAIRS: [string, string][] = [
    ['ENFJ', 'INFP'], ['INFP', 'ENFJ'],
    ['ENFJ', 'INTJ'], ['INTJ', 'ENFJ'],
    ['ENTP', 'INFJ'], ['INFJ', 'ENTP'],
    ['ENTJ', 'INFP'], ['INFP', 'ENTJ'],
    ['ISFJ', 'ESFP'], ['ESFP', 'ISFJ'],
    ['ISTJ', 'ESFP'], ['ESFP', 'ISTJ'],
    ['ENFP', 'INTJ'], ['INTJ', 'ENFP'],
    ['INFJ', 'ENFP'], ['ENFP', 'INFJ'],
    ['ISFP', 'ESFJ'], ['ESFJ', 'ISFP'],
  ];

  const COLLISION_PAIRS: [string, string][] = [
    ['ESTJ', 'INFP'], ['INFP', 'ESTJ'],
    ['ENTJ', 'ISFP'], ['ISFP', 'ENTJ'],
    ['ISTJ', 'ENFP'], ['ENFP', 'ISTJ'],
    ['ESTP', 'INFJ'], ['INFJ', 'ESTP'],
    ['INTJ', 'ESFP'], ['ESFP', 'INTJ'],
  ];

  if (IDEAL_PAIRS.some(([x, y]) => x === a && y === b)) return 'IDEAL';
  if (COLLISION_PAIRS.some(([x, y]) => x === a && y === b)) return 'COLLISION';

  // Heuristic: 반대 E/I + 같은 N/S + 같은 T/F → 보완적 관계 = IDEAL
  const oppEI = a[0] !== b[0];
  const sameNS = a[1] === b[1];
  const sameTF = a[2] === b[2];
  if (oppEI && sameNS && sameTF) return 'IDEAL';

  // 완전 반대 N/S AND T/F → COLLISION
  if (!sameNS && !sameTF) return 'COLLISION';

  return 'AVERAGE';
}

// ── [수식 1-2] S_Base 정규분포 변환형 기준 점수 ────────────────────────────────
// S_Base = 70 + (Z_Total × 7.81)
// Z_Total = (0.4 × Z_MBTI) + (0.6 × Z_Enneagram)
export function generateBaseScore(
  mbtiGrade: CompatibilityGrade,
  enneagramGrade: CompatibilityGrade,
): number {
  const zMbti = GRADE_TO_Z[mbtiGrade];
  const zEnneagram = GRADE_TO_Z[enneagramGrade];
  const zTotal = 0.4 * zMbti + 0.6 * zEnneagram;
  const sBase = SCORE_DISTRIBUTION_MEAN + zTotal * SCORE_DISTRIBUTION_SD;
  // 극단 케이스 가드: 50.5%(하방) ~ 89.5%(상방 인터뷰 전)
  return Math.max(SCORE_FLOOR, Math.min(SCORE_PRE_INTERVIEW_CEILING, sBase));
}

// ── 전국 커플 백분위 (공유 카드 REQ-COM-03) ────────────────────────────────────
// Abramowitz-Stegun 근사(최대 오차 1.5×10⁻⁷)로 표준정규 CDF를 계산해, S_Base와
// 동일한 정규분포(mean=70, sd=7.81) 위에서 "상위 X%" 위치를 결정론적으로 산출한다.
// 난수(Math.random)를 절대 사용하지 않는다 — 동일 점수는 항상 동일 백분위를 반환.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(x: number, mean: number, sd: number): number {
  return 0.5 * (1 + erf((x - mean) / (sd * Math.SQRT2)));
}

/** score가 전국 커플 분포 상위 몇 %에 위치하는지 반환 (1~99로 클램프). */
export function computeNationalPercentile(score: number): number {
  const topFraction = 1 - normalCdf(score, SCORE_DISTRIBUTION_MEAN, SCORE_DISTRIBUTION_SD);
  const topPercent = Math.round(topFraction * 100);
  return Math.max(1, Math.min(99, topPercent));
}

// ── 연애 DNA v2.1 전국 백분위 (Phase 3) ─────────────────────────────────────
// v2.1 §12 식(10)의 역변환: dnaPct = clamp(75 + K_SCALE·z, 50, 100)이므로
// z = (dnaPct - 75) / K_SCALE는 이미 표준정규(mean=0, sd=1)다.
// computeNationalPercentile과 동일한 erf 기반 CDF를 표준정규에 그대로 적용한다.
export function computeDnaNationalPercentile(dnaPct: number): number {
  const z = (dnaPct - DNA_PCT_CENTER) / K_SCALE;
  const topFraction = 1 - normalCdf(z, 0, 1);
  const topPercent = Math.round(topFraction * 100);
  return Math.max(1, Math.min(99, topPercent));
}

// ── [수식 §1.2] S_Master_Base = S_Base + Bonus_Interview (최대 +5.0%) ──────────
export function computeMasterBase(sBase: number, interviewBonus: number): number {
  const clampedBonus = Math.max(0, Math.min(INTERVIEW_MAX_BONUS, interviewBonus));
  return sBase + clampedBonus;
}

// ── 전체 앱 UI 포맷 함수: 소수점 한 자리 고정 ────────────────────────────────
export function formatScore(score: number): string {
  return score.toFixed(1);
}

// ── 10단계 티어 타입 ────────────────────────────────────────────────────────────
export interface TierTheme {
  gradient: readonly [string, string, string];
  glowColor: string;
  borderColor: string;
  textColor: string;
  bgColor: string;
}

export interface RelationshipTier {
  emoji: string;
  title: string;
  description: string;
  theme: TierTheme;
}

const TIER_THEMES = {
  GOLD_AURORA: {
    gradient: ['#FFD700', '#FFA500', '#FF8C00'] as const,
    glowColor: '#FFD700',
    borderColor: 'rgba(255,215,0,0.60)',
    textColor: '#FFD700',
    bgColor: 'rgba(255,215,0,0.08)',
  },
  NEON_VIOLET: {
    gradient: ['#7C3AED', '#9333EA', '#A855F7'] as const,
    glowColor: '#9333EA',
    borderColor: 'rgba(147,51,234,0.60)',
    textColor: '#C084FC',
    bgColor: 'rgba(147,51,234,0.10)',
  },
  DEEP_PURPLE: {
    gradient: ['#4C1D95', '#6D28D9', '#7C3AED'] as const,
    glowColor: '#7C3AED',
    borderColor: 'rgba(124,58,237,0.55)',
    textColor: '#A78BFA',
    bgColor: 'rgba(124,58,237,0.10)',
  },
  LAVENDER_HEART: {
    gradient: ['#9F7AEA', '#B794F4', '#D6BCFA'] as const,
    glowColor: '#B794F4',
    borderColor: 'rgba(183,148,244,0.50)',
    textColor: '#B794F4',
    bgColor: 'rgba(183,148,244,0.10)',
  },
  BRIGHT_PASTEL_PINK: {
    gradient: ['#F9A8D4', '#FB7185', '#F43F5E'] as const,
    glowColor: '#FB7185',
    borderColor: 'rgba(251,113,133,0.50)',
    textColor: '#FB7185',
    bgColor: 'rgba(249,168,212,0.10)',
  },
  SOFT_SHELL_PINK: {
    gradient: ['#FECDD3', '#FDA4AF', '#FB7185'] as const,
    glowColor: '#FDA4AF',
    borderColor: 'rgba(253,164,175,0.45)',
    textColor: '#FDA4AF',
    bgColor: 'rgba(253,205,211,0.10)',
  },
  SOFT_YELLOW: {
    gradient: ['#FDE68A', '#FCD34D', '#FBBF24'] as const,
    glowColor: '#FBBF24',
    borderColor: 'rgba(251,191,36,0.45)',
    textColor: '#D97706',
    bgColor: 'rgba(253,230,138,0.12)',
  },
  SILVER_GRAY: {
    gradient: ['#CBD5E1', '#94A3B8', '#64748B'] as const,
    glowColor: '#94A3B8',
    borderColor: 'rgba(148,163,184,0.40)',
    textColor: '#94A3B8',
    bgColor: 'rgba(203,213,225,0.08)',
  },
  DIM_CHARCOAL: {
    gradient: ['#475569', '#334155', '#1E293B'] as const,
    glowColor: '#475569',
    borderColor: 'rgba(71,85,105,0.40)',
    textColor: '#64748B',
    bgColor: 'rgba(71,85,105,0.10)',
  },
  GLASSMORPHISM_WINE: {
    gradient: ['#7F1D1D', '#991B1B', '#B91C1C'] as const,
    glowColor: '#DC2626',
    borderColor: 'rgba(220,38,38,0.45)',
    textColor: '#FCA5A5',
    bgColor: 'rgba(127,29,29,0.15)',
  },
} as const;

// ── [FUN-HOM-003] 5% 격차 10단계 마스터 티어 매퍼 ────────────────────────────
export function getTierFromScore(score: number): RelationshipTier {
  if (score >= 95.0) return {
    emoji: '🏆', title: '환상 속의 신화적 결합',
    description: '대화 호흡과 어휘 동기화가 신의 경지에 이른 기적적 상태',
    theme: TIER_THEMES.GOLD_AURORA,
  };
  if (score >= 90.0) return {
    emoji: '🧬', title: '영혼까지 닮은 도플갱어',
    description: '문체와 말버릇, 이모티콘 칩셋까지 완벽 대칭인 축복 구간',
    theme: TIER_THEMES.NEON_VIOLET,
  };
  if (score >= 85.0) return {
    emoji: '💖', title: '기적의 소울메이트',
    description: '성격 상성 최상 및 지속적 다정함 수집으로 한계령을 돌파한 워너비',
    theme: TIER_THEMES.DEEP_PURPLE,
  };
  if (score >= 80.0) return {
    emoji: '✨', title: '눈빛만 봐도 아는 사이',
    description: '단어 몇 개, 이모지 하나로도 속마음을 100% 관통하는 상태',
    theme: TIER_THEMES.LAVENDER_HEART,
  };
  if (score >= 75.0) return {
    emoji: '🍃', title: '달달한 핑크빛 로맨스',
    description: '평수기 평균 이상. 서로에 대한 지지와 예쁜 리액션이 당연한 상태',
    theme: TIER_THEMES.BRIGHT_PASTEL_PINK,
  };
  if (score >= 70.0) return {
    emoji: '🌸', title: '다정다감한 모범 커플',
    description: '서로가 1순위인 모범 지점. 큰 풍파 없이 예쁜 대화의 정석을 지키는 상태',
    theme: TIER_THEMES.SOFT_SHELL_PINK,
  };
  if (score >= 65.0) return {
    emoji: '🎭', title: '평소엔 연인, 싸울 땐 웬수',
    description: '대한민국 커플 80%가 머무는 현실 지대. 삐끗하면 단답형 빌런으로 돌변',
    theme: TIER_THEMES.SOFT_YELLOW,
  };
  if (score >= 60.0) return {
    emoji: '📉', title: '아슬아슬한 밀당 권태기',
    description: '읽씹/안읽씹이 길어지고 업무형 연락이 고착화되기 시작한 징후',
    theme: TIER_THEMES.SILVER_GRAY,
  };
  if (score >= 55.0) return {
    emoji: '⚡', title: '말 한마디가 시한폭탄',
    description: '날카로운 비난이나 억압 표현이 자주 탐지되어 사소한 톡에도 크게 터질 위기',
    theme: TIER_THEMES.DIM_CHARCOAL,
  };
  return {
    emoji: '🚨', title: '살얼음판 위 대치 상황',
    description: '대화 단절이 3시간을 넘어 바닥 가드라인(50.5%)까지 추락한 파국 직전 상태',
    theme: TIER_THEMES.GLASSMORPHISM_WINE,
  };
}

// ── 연애 DNA v2.1 티어/무드태그 스케일 재보정 (Phase 5.5) ────────────────────────
// 통합감사(docs/audit/통합감사_2026-07-16.md §1c) 발견: getTierFromScore()의 컷오프와
// AICoachingCard/index.tsx의 무드태그 임계값(70/40)은 옛 S_Base 분포(mean=70,sd=7.81)
// 기준으로 고정돼 있다. v2.1 dna_pct는 다른 분포(mean=75, sd=K_SCALE≈9.7056)를 가지므로
// 같은 컷오프 숫자를 그대로 쓰면 백분위 의미가 달라진다. 아래는 사용자가 지정한 유도식
// T_new = 75 + K_SCALE·Φ⁻¹(Φ((T_old−70)/7.81))을 그대로 구현해, 옛 분포에서의 백분위를
// 그대로 보존하며 새 분포로 컷오프를 재매핑한다. getTierFromScore() 자체는 무수정.

// 표준정규 분위함수(Φ⁻¹) — Peter Acklam의 유리함수 근사(|상대오차| < 1.15e-9).
// scoreCalculator.ts에 정방향 CDF(normalCdf)만 있고 역함수가 없어 새로 추가한다.
function inverseNormalCdf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

/** 옛 S_Base 분포(mean=70,sd=7.81) 기준 컷오프를 dna_pct 분포로 백분위 보존 재매핑한다. */
export function rescaleScoreCutoffToV21(oldCutoff: number): number {
  const z = (oldCutoff - SCORE_DISTRIBUTION_MEAN) / SCORE_DISTRIBUTION_SD;
  const p = normalCdf(z, 0, 1);
  const zBack = inverseNormalCdf(p);
  return DNA_PCT_CENTER + K_SCALE * zBack;
}

const V21_TIER_CUTOFF = {
  T95: rescaleScoreCutoffToV21(95.0),
  T90: rescaleScoreCutoffToV21(90.0),
  T85: rescaleScoreCutoffToV21(85.0),
  T80: rescaleScoreCutoffToV21(80.0),
  T75: rescaleScoreCutoffToV21(75.0),
  T70: rescaleScoreCutoffToV21(70.0),
  T65: rescaleScoreCutoffToV21(65.0),
  T60: rescaleScoreCutoffToV21(60.0),
  T55: rescaleScoreCutoffToV21(55.0),
};

/** getTierFromScore()의 v2.1 전용 버전 — 등급 라벨/테마는 동일, 컷오프만 재보정. */
export function getTierFromScoreV21(score: number): RelationshipTier {
  if (score >= V21_TIER_CUTOFF.T95) return {
    emoji: '🏆', title: '환상 속의 신화적 결합',
    description: '대화 호흡과 어휘 동기화가 신의 경지에 이른 기적적 상태',
    theme: TIER_THEMES.GOLD_AURORA,
  };
  if (score >= V21_TIER_CUTOFF.T90) return {
    emoji: '🧬', title: '영혼까지 닮은 도플갱어',
    description: '문체와 말버릇, 이모티콘 칩셋까지 완벽 대칭인 축복 구간',
    theme: TIER_THEMES.NEON_VIOLET,
  };
  if (score >= V21_TIER_CUTOFF.T85) return {
    emoji: '💖', title: '기적의 소울메이트',
    description: '성격 상성 최상 및 지속적 다정함 수집으로 한계령을 돌파한 워너비',
    theme: TIER_THEMES.DEEP_PURPLE,
  };
  if (score >= V21_TIER_CUTOFF.T80) return {
    emoji: '✨', title: '눈빛만 봐도 아는 사이',
    description: '단어 몇 개, 이모지 하나로도 속마음을 100% 관통하는 상태',
    theme: TIER_THEMES.LAVENDER_HEART,
  };
  if (score >= V21_TIER_CUTOFF.T75) return {
    emoji: '🍃', title: '달달한 핑크빛 로맨스',
    description: '평수기 평균 이상. 서로에 대한 지지와 예쁜 리액션이 당연한 상태',
    theme: TIER_THEMES.BRIGHT_PASTEL_PINK,
  };
  if (score >= V21_TIER_CUTOFF.T70) return {
    emoji: '🌸', title: '다정다감한 모범 커플',
    description: '서로가 1순위인 모범 지점. 큰 풍파 없이 예쁜 대화의 정석을 지키는 상태',
    theme: TIER_THEMES.SOFT_SHELL_PINK,
  };
  if (score >= V21_TIER_CUTOFF.T65) return {
    emoji: '🎭', title: '평소엔 연인, 싸울 땐 웬수',
    description: '대한민국 커플 80%가 머무는 현실 지대. 삐끗하면 단답형 빌런으로 돌변',
    theme: TIER_THEMES.SOFT_YELLOW,
  };
  if (score >= V21_TIER_CUTOFF.T60) return {
    emoji: '📉', title: '아슬아슬한 밀당 권태기',
    description: '읽씹/안읽씹이 길어지고 업무형 연락이 고착화되기 시작한 징후',
    theme: TIER_THEMES.SILVER_GRAY,
  };
  if (score >= V21_TIER_CUTOFF.T55) return {
    emoji: '⚡', title: '말 한마디가 시한폭탄',
    description: '날카로운 비난이나 억압 표현이 자주 탐지되어 사소한 톡에도 크게 터질 위기',
    theme: TIER_THEMES.DIM_CHARCOAL,
  };
  return {
    emoji: '🚨', title: '살얼음판 위 대치 상황',
    description: '대화 단절이 3시간을 넘어 바닥 가드라인(50.5%)까지 추락한 파국 직전 상태',
    theme: TIER_THEMES.GLASSMORPHISM_WINE,
  };
}

// AICoachingCard.tsx/index.tsx의 무드태그 임계값(70/40)도 동일한 재보정 대상이다 —
// 둘 다 scoreStore.sBase/sCurrent를 그대로 소비하는 동일 성격의 하드코딩 컷오프였다.
export const MOOD_TAG_HIGH_THRESHOLD_V21 = rescaleScoreCutoffToV21(70);
export const MOOD_TAG_MID_THRESHOLD_V21 = rescaleScoreCutoffToV21(40);
