// ─── adaptiveInterviewSession 통합 체인 테스트 (Phase 3, Task #21) ─────────────
// "인터뷰 시작 → 턴 진행(조기종료/문항소진) → psychProfile 완성 → dnaResult 계산"
// 전체 체인이 순수 로직 레벨에서 최소 1회 통과하는지 검증한다(로직 레벨 검증 방식 —
// docs/spec/phase2_재시작_현황.md). React/Supabase는 개입하지 않는다.

import {
  applyNarrativeAnswer,
  applySternbergAnswer,
  createInterviewSession,
  finalizeProfile,
  getNextStep,
  type ParsedInterviewResponse,
  type SessionState,
} from '../adaptiveInterviewSession';
import { psychProfileToPersonProfileV21 } from '../../matching/psychProfileAdapter';
import { computeRomanticDnaV21 } from '../../matching/computeRomanticDNA';
import type { PsychProfile } from '../../../store/userStore';

const MAX_TURNS_GUARD = 50; // 8개 서사형 차원 + 3개 스턴버그 = 최대 11턴이면 끝나야 함

function runInterviewToCompletion(mbti: string, answerFor: (dimension: string) => ParsedInterviewResponse): PsychProfile {
  let state: SessionState = createInterviewSession(mbti);

  for (let i = 0; i < MAX_TURNS_GUARD; i++) {
    const step = getNextStep(state);
    if (step.kind === 'done') {
      return finalizeProfile(state);
    }
    if (step.kind === 'narrative') {
      state = applyNarrativeAnswer(state, step.dimension, step.question, answerFor(step.dimension));
    } else {
      state = applySternbergAnswer(state, step.component, step.question, answerFor(step.component));
    }
  }

  throw new Error(`인터뷰가 ${MAX_TURNS_GUARD}턴 내에 종료되지 않았습니다(무한루프 의심)`);
}

describe('adaptiveInterviewSession — 통합 체인', () => {
  it('ENFP: 인터뷰 시작→턴 진행→종료→psychProfile 완성까지 1회 통과', () => {
    const profile = runInterviewToCompletion('ENFP', () => ({ normalizedValue: 0.2, confidence: 0.9 }));

    expect(profile.enneagramCore).toHaveLength(9);
    expect(profile.enneagramCore.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(profile.sternbergState).not.toBeNull();
    expect(profile.sternbergState?.intimacy).toBeCloseTo(0.2, 5);
    expect(profile.interviewMeta.turnsUsed).toBeGreaterThanOrEqual(5);
    expect(profile.interviewMeta.elapsedSeconds).toBeGreaterThan(0);
    expect(profile.interviewMeta.completedAt).not.toBeNull();
    expect(profile.interviewMeta.calibrationVersion).toBe('v2.1');
  });

  it('두 사용자의 psychProfile → psychProfileAdapter → computeRomanticDnaV21까지 체인이 끝까지 통과한다', () => {
    const profileA = runInterviewToCompletion('ENFP', () => ({ normalizedValue: 0.2, confidence: 0.9 }));
    const profileB = runInterviewToCompletion('ISTJ', () => ({ normalizedValue: 0.8, confidence: 0.9 }));

    const personA = psychProfileToPersonProfileV21(profileA);
    const personB = psychProfileToPersonProfileV21(profileB);
    const result = computeRomanticDnaV21(personA, personB);

    expect(Number.isFinite(result.dna_pct)).toBe(true);
    expect(result.dna_pct).toBeGreaterThanOrEqual(50);
    expect(result.dna_pct).toBeLessThanOrEqual(100);
    expect(Number.isFinite(result.S_B5)).toBe(true);
    expect(Number.isFinite(result.S_EN)).toBe(true);
    expect(Number.isFinite(result.S_ST)).toBe(true);
    expect(Number.isFinite(result.S_ATT)).toBe(true);
  });

  it('confidence:0(파싱 실패 폴백) 응답만 계속 받으면 사전분포를 그대로 유지한 채 정상 종료된다', () => {
    const profile = runInterviewToCompletion('INTJ', () => ({ normalizedValue: 0.5, confidence: 0 }));

    // INTJ: O = 0.5 + 0.15·sign(N/S=+1) = 0.65 (§2) — confidence:0이므로 갱신 없이 사전값 그대로.
    expect(profile.big5.O).toBeCloseTo(0.65, 5);
  });
});
