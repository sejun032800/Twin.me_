// ─── 적응형 인터뷰 순수 상태머신 (Phase 3) ──────────────────────────────────────
// adaptiveEngine.ts(그리디 선택/조기종료)와 inference/*(베이지안 갱신) 순수함수만 엮은
// 오케스트레이션 계층 — React/Supabase 의존성이 전혀 없어 jest로 직접 테스트 가능하다
// (회귀 검증 방식: docs/spec/phase2_재시작_현황.md "로직 레벨 검증"). 실제 네트워크 I/O와
// React 상태 바인딩은 src/hooks/useAdaptiveInterview.ts가 이 모듈을 감싸서 담당한다.
//
// v2.1 §13 의사코드의 "ask_fixed_sternberg_items_if_not_yet_asked()"는 이 구현에서
// 서사형(그리디) 루프가 끝난 뒤 한 번에 3문항(친밀감/열정/헌신 순)을 묻는 것으로
// 단순화했다 — 두 방식 모두 "완주 전 반드시 3문항 고정 포함"이라는 스펙 요구를
// 만족하며, 시간 예산(§4)에도 동일하게 반영된다(estimateTimeCost('C')).
//
// §9 날개 판별 후속질문(ENNEAGRAM_WING_TEMPLATE)은 이 세션에서 별도 턴으로 다루지
// 않는다 — jointDistribution()/wingMarginal()이 이미 코어 사후분포+Big5만으로
// 순수 계산되고(§9.1~9.2), 후속질문 답변을 소비하는 갱신식이 v2.1 어디에도 없기
// 때문이다(조사 확인 완료). 날개 결과는 finalizeProfile()에서 결정론적으로 산출한다.
// Phase 4 — v2.1 §4/§7이 패치되어 이 설계가 "이 세션의 판단"이 아니라 문서상
// 확정 사항으로 반영됐다(날개 후속질문은 결과화면 확인용 UX, 인터뷰 턴 아님).

import {
  ENNEAGRAM_TYPE_IDS,
  SIGMA_PRIOR,
  type Big5Vector,
  type EnneagramCoreId,
} from '../matching/constants';
import { attachmentPrior, big5Prior, enneagramCorePrior } from '../inference/mbtiPrior';
import {
  updateAttachmentPosterior,
  updateBig5Posterior,
  updateEnneagramCorePosterior,
  type AttachmentDimension,
} from '../inference/bayesianUpdate';
import { jointDistribution } from '../inference/enneagramWing';
import { reestimateMbtiAxes } from '../inference/mbtiReestimate';
import {
  checkEarlyStop,
  computeUncertainty,
  estimateTimeCost,
  selectNextQuestion,
  type UncertaintyDimension,
  type UncertaintyMap,
} from './adaptiveEngine';
import { getSternbergQuestions, QUESTION_BANK, type QuestionBankEntry, type QuestionTier, type SternbergComponent } from './questionBank';
import type { PsychProfile } from '../../store/userStore';

/** adaptive-interview Edge Function 'parse' 응답을 이 모듈이 필요로 하는 형태로 축소한 것. */
export interface ParsedInterviewResponse {
  normalizedValue: number; // [0,1]
  confidence: number; // [0,1], 0이면 이 턴은 사전분포를 그대로 유지(무갱신)
}

export interface SessionState {
  mbti: string;
  big5Mean: Big5Vector;
  big5Variance: Record<keyof Big5Vector, number>;
  attachmentMean: Record<AttachmentDimension, number>;
  attachmentVariance: Record<AttachmentDimension, number>;
  enneagramCorePosterior: Record<EnneagramCoreId, number>;
  askedDimensions: UncertaintyDimension[];
  usedQuestionIds: string[];
  previousTier: QuestionTier | undefined;
  sternbergAnswers: Partial<Record<SternbergComponent, number>>;
  turnsUsed: number; // 서사형(Type A) 턴만 카운트 — §6 (c) "최소 5턴(서사형)"
  elapsedSeconds: number;
}

export type InterviewStep =
  | { kind: 'narrative'; dimension: UncertaintyDimension; question: QuestionBankEntry }
  | { kind: 'sternberg'; component: SternbergComponent; question: QuestionBankEntry }
  | { kind: 'done' };

const STERNBERG_ORDER: SternbergComponent[] = ['intimacy', 'passion', 'commitment'];

export function createInterviewSession(mbti: string): SessionState {
  const big5Mean = big5Prior(mbti);
  const attachmentMean = attachmentPrior(big5Mean);
  const enneagramCorePosterior = enneagramCorePrior(big5Mean);

  return {
    mbti,
    big5Mean,
    big5Variance: {
      O: SIGMA_PRIOR.O ** 2,
      C: SIGMA_PRIOR.C ** 2,
      E: SIGMA_PRIOR.E ** 2,
      A: SIGMA_PRIOR.A ** 2,
      N: SIGMA_PRIOR.N ** 2,
    },
    attachmentMean,
    attachmentVariance: { anxiety: SIGMA_PRIOR.anx ** 2, avoidance: SIGMA_PRIOR.avo ** 2 },
    enneagramCorePosterior,
    askedDimensions: [],
    usedQuestionIds: [],
    previousTier: undefined,
    sternbergAnswers: {},
    turnsUsed: 0,
    elapsedSeconds: 0,
  };
}

export function computeUncertaintyMap(state: SessionState): UncertaintyMap {
  const enneagramCore = ENNEAGRAM_TYPE_IDS.map((id) => state.enneagramCorePosterior[id]);
  return computeUncertainty({ enneagramCore });
}

export function computeMeanUncertainty(state: SessionState): number {
  const map = computeUncertaintyMap(state);
  const values = Object.values(map);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function nextSternbergStep(state: SessionState): InterviewStep {
  const used = new Set(state.usedQuestionIds);
  const component = STERNBERG_ORDER.find((c) => state.sternbergAnswers[c] === undefined);
  if (!component) return { kind: 'done' };

  const question = getSternbergQuestions(component).find((q) => !used.has(q.id));
  if (!question) return { kind: 'done' };

  return { kind: 'sternberg', component, question };
}

/** v2.1 §5.3/§6 — 다음에 물을 질문(서사형 그리디 or 관계상태 고정)을 결정한다. */
export function getNextStep(state: SessionState): InterviewStep {
  const uncertainty = computeUncertaintyMap(state);
  const early = checkEarlyStop(state.elapsedSeconds, uncertainty, state.turnsUsed);

  if (!early.stop) {
    const selected = selectNextQuestion(uncertainty, new Set(state.askedDimensions), state.mbti, QUESTION_BANK, {
      usedQuestionIds: new Set(state.usedQuestionIds),
      previousTier: state.previousTier,
    });
    if (selected) {
      return { kind: 'narrative', dimension: selected.dimension, question: selected.question };
    }
    // 이 시점에서 선택 가능한 서사형 문항이 더 없음(8개 차원 모두 소진) — 관계상태로 넘어간다.
  }

  return nextSternbergStep(state);
}

/** 이 세션이 종료된 이유 — finalizeProfile()에서 interviewMeta.stopReason으로 기록한다. */
export function resolveStopReason(state: SessionState): PsychProfile['interviewMeta']['stopReason'] {
  const uncertainty = computeUncertaintyMap(state);
  const early = checkEarlyStop(state.elapsedSeconds, uncertainty, state.turnsUsed);
  if (early.stop) return early.reason as 'time_cap' | 'entropy_threshold' | 'min_turns_satisfied';
  return null; // 조기종료 조건 미충족 상태로(문항 소진 등) 끝난 경우
}

// v2.1 §8 확정값(Phase 4 문서 패치) — σ_obs = 0.35. σ_prior 최댓값(0.22)보다 크게
// 잡아, 짧은 인터뷰에서는 사전분포(MBTI)가 사후분포에 여전히 강한 영향력을 유지한다는
// §8 설계 의도를 수치로 구현한다. confidence로 나누므로 confidence↓일수록 obsVariance는
// 더 커진다(§8 "문항별 신뢰도가 낮으면 실제 관측 표준오차를 σ_obs/confidence로 확대").
const SIGMA_OBS_ITEM = 0.35;
const SIGMA_OBS_ITEM_SQ = SIGMA_OBS_ITEM * SIGMA_OBS_ITEM;

// v2.1 §8 확정값(Phase 4 문서 패치) — L(응답|후보유형 i) = exp(k·lean_i), k=2.
// lean_i는 사후분포 상위 2개 후보(§7.3 판별질문이면 그 문항이 대조하는 두 후보) 중
// 어느 쪽에 더 가까운지를 나타내는 부호 있는 정합도. confidence=0이면 두 우도 모두
// 1(무갱신)이 되도록 설계했다.
const ENNEAGRAM_LIKELIHOOD_K = 2;

function pickDiscriminationPair(
  posterior: Record<EnneagramCoreId, number>,
  question: QuestionBankEntry,
): [EnneagramCoreId, EnneagramCoreId] {
  if (question.topCandidates && question.topCandidates.length >= 2) {
    return [Number(question.topCandidates[0]) as EnneagramCoreId, Number(question.topCandidates[1]) as EnneagramCoreId];
  }
  // topCandidates가 없는 범용/연애맥락 오프너 — 현재 사후분포 상위 2개 유형을 암묵적 대비 대상으로 쓴다.
  const sorted = ENNEAGRAM_TYPE_IDS.slice().sort((a, b) => posterior[b] - posterior[a]);
  return [sorted[0], sorted[1]];
}

function buildEnneagramLikelihood(
  posterior: Record<EnneagramCoreId, number>,
  question: QuestionBankEntry,
  normalizedValue: number,
  confidence: number,
): Partial<Record<EnneagramCoreId, number>> {
  const [idA, idB] = pickDiscriminationPair(posterior, question);
  const lean = (0.5 - normalizedValue) * confidence; // 0(idA쪽)에 가까울수록 +, 1(idB쪽)에 가까울수록 -
  return {
    [idA]: Math.exp(ENNEAGRAM_LIKELIHOOD_K * lean),
    [idB]: Math.exp(-ENNEAGRAM_LIKELIHOOD_K * lean),
  };
}

/** v2.1 §8 — 서사형(Type A) 질문 응답을 사후분포에 반영한다(순수함수, 새 상태 반환). */
export function applyNarrativeAnswer(
  state: SessionState,
  dimension: UncertaintyDimension,
  question: QuestionBankEntry,
  parsed: ParsedInterviewResponse,
): SessionState {
  let big5Mean = state.big5Mean;
  let big5Variance = state.big5Variance;
  let attachmentMean = state.attachmentMean;
  let attachmentVariance = state.attachmentVariance;
  let enneagramCorePosterior = state.enneagramCorePosterior;

  if (parsed.confidence > 0) {
    const obsVariance = SIGMA_OBS_ITEM_SQ / parsed.confidence;

    if (dimension === 'anxiety' || dimension === 'avoidance') {
      const updated = updateAttachmentPosterior(attachmentMean, attachmentVariance, dimension, parsed.normalizedValue, obsVariance);
      attachmentMean = updated.mean;
      attachmentVariance = updated.variance;
    } else if (dimension === 'enneagram_core') {
      const likelihood = buildEnneagramLikelihood(enneagramCorePosterior, question, parsed.normalizedValue, parsed.confidence);
      enneagramCorePosterior = updateEnneagramCorePosterior(enneagramCorePosterior, likelihood);
    } else {
      const updated = updateBig5Posterior(big5Mean, big5Variance, dimension, parsed.normalizedValue, obsVariance);
      big5Mean = updated.mean;
      big5Variance = updated.variance;
    }
  }

  return {
    ...state,
    big5Mean,
    big5Variance,
    attachmentMean,
    attachmentVariance,
    enneagramCorePosterior,
    askedDimensions: [...state.askedDimensions, dimension],
    usedQuestionIds: [...state.usedQuestionIds, question.id],
    previousTier: question.tier,
    turnsUsed: state.turnsUsed + 1,
    elapsedSeconds: state.elapsedSeconds + estimateTimeCost('A'),
  };
}

/** v2.1 §4 유형 C — 관계상태 직답. 엔트로피 갱신 없이 값만 직접 기록한다. */
export function applySternbergAnswer(
  state: SessionState,
  component: SternbergComponent,
  question: QuestionBankEntry,
  parsed: ParsedInterviewResponse,
): SessionState {
  return {
    ...state,
    sternbergAnswers: { ...state.sternbergAnswers, [component]: parsed.normalizedValue },
    usedQuestionIds: [...state.usedQuestionIds, question.id],
    elapsedSeconds: state.elapsedSeconds + estimateTimeCost('C'),
  };
}

/** v2.1 §9/§10 — 최종 PsychProfile 조립(userStore.setPsychProfile 입력 형태). */
export function finalizeProfile(state: SessionState): PsychProfile {
  const enneagramCore = ENNEAGRAM_TYPE_IDS.map((id) => state.enneagramCorePosterior[id]);
  const wingJoint = jointDistribution(state.enneagramCorePosterior, state.big5Mean);
  const mbtiEstimated = reestimateMbtiAxes(state.big5Mean);

  return {
    big5: state.big5Mean,
    attachment: state.attachmentMean,
    enneagramCore,
    enneagramWingJoint: wingJoint,
    sternbergState: {
      intimacy: state.sternbergAnswers.intimacy ?? 0.5,
      passion: state.sternbergAnswers.passion ?? 0.5,
      commitment: state.sternbergAnswers.commitment ?? 0.5,
    },
    mbtiEstimated,
    interviewMeta: {
      completedAt: new Date().toISOString(),
      turnsUsed: state.turnsUsed,
      elapsedSeconds: state.elapsedSeconds,
      stopReason: resolveStopReason(state),
      calibrationVersion: 'v2.1',
    },
  };
}
