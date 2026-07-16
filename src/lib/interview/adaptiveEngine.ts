// ─── 적응형 인터뷰 그리디 엔진 (v2.1 §3~§8, Strangler Fig 신규 독립 모듈) ───────
// 기존 src/engine/genesisInference.ts, src/hooks/useGenesisInterview.ts 를
// import하지 않는다. Phase 0 lib/matching/constants.ts의 σ_prior/임계값 상수를
// 그대로 재사용한다(재정의 없음). Phase 1에서 만든 PsychProfile/InterviewSessionState
// 타입을 입출력 형태로 참조한다(타입 전용 import — 런타임 의존성 없음).

import type { PsychProfile } from '../../store/userStore';
import type { InterviewSessionState } from '../../store/sessionStore';
import {
  EARLY_STOP_MIN_NARRATIVE_TURNS,
  EARLY_STOP_PER_DIM_THRESHOLD,
  EARLY_STOP_UBAR_THRESHOLD,
  INTERVIEW_HARD_CAP_SECONDS,
  SIGMA_MAX,
  SIGMA_PRIOR,
  TURN_SECONDS,
} from '../matching/constants';
import type { CommonDimension, QuestionBankEntry, QuestionTier, RomanticDimension } from './questionBank';

// 그리디 선택 대상 8개 차원 — v2.1 §5.1(연속차원 7개) + §5.2(애니어그램 코어).
// 이름은 questionBank.ts의 TargetDimension과 그대로 맞춰 두 모듈 간 매핑 비용을 없앤다.
export type UncertaintyDimension = 'O' | 'C' | 'E' | 'A' | 'N' | 'anxiety' | 'avoidance' | 'enneagram_core';

export type UncertaintyMap = Record<UncertaintyDimension, number>;

function entropy(p: number[]): number {
  return -p.reduce((sum, pi) => sum + (pi > 0 ? pi * Math.log(pi) : 0), 0);
}

/**
 * v2.1 §5.1 식(1) — U_d = σ_prior(d)² / σ_max² (연속차원: O,C,E,A,N,anx,avo)
 * v2.1 §5.2 식(2) — U_EN = H(p⁽⁰⁾) / ln(9) (애니어그램 코어, 섀넌 엔트로피)
 *
 * σ_prior(d)는 §5.1 표의 고정 설계 상수(MBTI가 그 차원에 얼마나 직접 대응하는지)이지
 * 개인별 사후분산이 아니다 — 따라서 O/C/E/A/N/anx/avo의 U_d는 모든 사용자에게
 * 동일하며(§5.4 예시가 ENFP뿐 아니라 어떤 MBTI에도 동일하게 재현되는 이유), profile
 * 인자는 오직 U_EN(애니어그램 코어 엔트로피) 계산에만 실제로 사용된다.
 */
export function computeUncertainty(
  profile: Pick<PsychProfile, 'enneagramCore'>,
  sigmaValues: typeof SIGMA_PRIOR = SIGMA_PRIOR,
): UncertaintyMap {
  const sigmaMaxSq = SIGMA_MAX * SIGMA_MAX;
  return {
    O: (sigmaValues.O * sigmaValues.O) / sigmaMaxSq,
    C: (sigmaValues.C * sigmaValues.C) / sigmaMaxSq,
    E: (sigmaValues.E * sigmaValues.E) / sigmaMaxSq,
    A: (sigmaValues.A * sigmaValues.A) / sigmaMaxSq,
    N: (sigmaValues.N * sigmaValues.N) / sigmaMaxSq,
    anxiety: (sigmaValues.anx * sigmaValues.anx) / sigmaMaxSq,
    avoidance: (sigmaValues.avo * sigmaValues.avo) / sigmaMaxSq,
    enneagram_core: entropy(profile.enneagramCore) / Math.log(9),
  };
}

const ALL_UNCERTAINTY_DIMENSIONS: UncertaintyDimension[] = [
  'O', 'C', 'E', 'A', 'N', 'anxiety', 'avoidance', 'enneagram_core',
];

export interface SelectQuestionOptions {
  /** 이미 사용한(다시 뽑지 말아야 할) 문항 id — 같은 차원이 여러 턴에 걸쳐 재선택될 수 있어(§7.3 판별질문 ①②) 필요 */
  usedQuestionIds?: Set<string>;
  /** 직전 질문의 계층(common/romantic) — §7.4 "직전 질문과 같은 맥락이 연속되지 않도록 교차 배치" 규칙용 */
  previousTier?: QuestionTier;
}

export interface SelectedQuestion {
  dimension: UncertaintyDimension;
  question: QuestionBankEntry;
}

function pickFirstUnused(pool: QuestionBankEntry[], used: Set<string>): QuestionBankEntry | null {
  return pool.find((q) => !used.has(q.id)) ?? null;
}

/** 직전 계층과 다른 계층을 우선 선택하고, 없으면 아무 미사용 항목이나 선택한다. */
function pickAlternating(pool: QuestionBankEntry[], used: Set<string>, previousTier?: QuestionTier): QuestionBankEntry | null {
  if (previousTier) {
    const alternate = pool.find((q) => !used.has(q.id) && q.tier !== previousTier);
    if (alternate) return alternate;
  }
  return pickFirstUnused(pool, used);
}

function byTierAndDimension(
  questionBank: QuestionBankEntry[],
  tier: QuestionTier,
  targetDimension: QuestionBankEntry['targetDimension'],
): QuestionBankEntry[] {
  return questionBank.filter((q) => q.tier === tier && q.targetDimension === targetDimension);
}

function mbtiSpecificPool(questionBank: QuestionBankEntry[], mbtiType: string): QuestionBankEntry[] {
  return questionBank
    .filter((q) => q.tier === 'mbti_specific' && q.mbtiType === mbtiType.toUpperCase())
    .sort((a, b) => a.variantIndex - b.variantIndex);
}

/**
 * v2.1 §5.3 — 그리디 argmax 선택 + §7.4 3계층 우선순위 규칙.
 * 1) 아직 묻지 않은(또는 문항이 남아있는) 차원 중 U_d가 가장 큰 차원을 target으로 고른다.
 * 2) target별로 §7.4 규칙에 따라 실제 문항을 뽑는다:
 *    - enneagram_core: MBTI별 판별질문 → 연애맥락 오프너 → 범용 오프너 순
 *    - avoidance/anxiety: 공통(이미 연애 맥락) 세트에서 미사용 변형
 *    - O/C/E/A/N: 공통+연애맥락 통합 풀에서 미사용 항목, 직전 맥락과 교차 배치
 * 문항이 남아있지 않은 차원은 후보에서 제외하고 차순위 차원으로 넘어간다.
 */
export function selectNextQuestion(
  uncertainty: UncertaintyMap,
  askedDimensions: Set<UncertaintyDimension>,
  mbtiType: string,
  questionBank: QuestionBankEntry[],
  options: SelectQuestionOptions = {},
): SelectedQuestion | null {
  const used = options.usedQuestionIds ?? new Set<string>();

  const ranked = ALL_UNCERTAINTY_DIMENSIONS.filter((d) => !askedDimensions.has(d)).sort(
    (a, b) => uncertainty[b] - uncertainty[a],
  );

  for (const dimension of ranked) {
    let question: QuestionBankEntry | null = null;

    if (dimension === 'enneagram_core') {
      question =
        pickFirstUnused(mbtiSpecificPool(questionBank, mbtiType), used) ??
        pickFirstUnused(byTierAndDimension(questionBank, 'romantic', 'enneagram_core'), used) ??
        pickFirstUnused(byTierAndDimension(questionBank, 'common', 'enneagram_core'), used);
    } else if (dimension === 'avoidance' || dimension === 'anxiety') {
      question = pickFirstUnused(byTierAndDimension(questionBank, 'common', dimension), used);
    } else {
      const dim = dimension as CommonDimension & RomanticDimension;
      const pool = [...byTierAndDimension(questionBank, 'common', dim), ...byTierAndDimension(questionBank, 'romantic', dim)];
      question = pickAlternating(pool, used, options.previousTier);
    }

    if (question) return { dimension, question };
    // 이 차원엔 더 뽑을 문항이 없음 — 차순위 차원으로 넘어간다
  }

  return null;
}

export type EarlyStopReason = 'time_cap' | 'entropy_threshold' | 'min_turns_satisfied' | 'none';

export interface EarlyStopResult {
  stop: boolean;
  reason: EarlyStopReason;
}

/**
 * v2.1 §6 조기종료 규칙:
 *   (a) 누적시간 ≥ 5분(하드 캡)
 *   (b) Ū = (1/8)ΣU_d < θ(0.15)
 *   (c) 최소 5턴(서사형) 충족 AND 모든 U_d < 0.5
 * (a)→(b)→(c) 순으로 검사한다(하드 캡이 최우선).
 */
export function checkEarlyStop(elapsedSeconds: number, uncertainty: UncertaintyMap, turnsUsed: number): EarlyStopResult {
  if (elapsedSeconds >= INTERVIEW_HARD_CAP_SECONDS) {
    return { stop: true, reason: 'time_cap' };
  }

  const values = ALL_UNCERTAINTY_DIMENSIONS.map((d) => uncertainty[d]);
  const uBar = values.reduce((a, b) => a + b, 0) / values.length;
  if (uBar < EARLY_STOP_UBAR_THRESHOLD) {
    return { stop: true, reason: 'entropy_threshold' };
  }

  if (turnsUsed >= EARLY_STOP_MIN_NARRATIVE_TURNS && values.every((v) => v < EARLY_STOP_PER_DIM_THRESHOLD)) {
    return { stop: true, reason: 'min_turns_satisfied' };
  }

  return { stop: false, reason: 'none' };
}

// v2.1 §4/§7 패치(Phase 4) — 날개 판별 후속질문(구 유형 B)은 인터뷰 턴이 아니라
// 결과화면 확인용 UX로 재분류되어 시간예산 계산 대상에서 빠졌다(TURN_SECONDS 참고).
export type NarrativeQuestionType = 'A' | 'C';

/** v2.1 §4 — 유형 A(서사형)=30초, C(관계상태 직답)=10초. */
export function estimateTimeCost(questionType: NarrativeQuestionType): number {
  if (questionType === 'A') return TURN_SECONDS.narrative;
  return TURN_SECONDS.sternberg;
}

// InterviewSessionState는 이 모듈의 함수 입출력과 구조적으로 호환되는 타입임을
// 명시하기 위한 참조용 타입 별칭 — Phase 3에서 sessionStore와 연결할 때 사용한다.
export type { InterviewSessionState };
