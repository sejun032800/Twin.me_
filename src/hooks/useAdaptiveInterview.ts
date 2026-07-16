// ─── 적응형 인터뷰 React 훅 (Phase 3) ──────────────────────────────────────────
// 순수 상태머신(src/lib/interview/adaptiveInterviewSession.ts)을 React 상태/zustand
// 스토어/Supabase에 바인딩하는 얇은 wrapper. 그리디 선택·베이지안 갱신 등 핵심
// 로직은 전부 그 모듈의 순수함수로 위임하고, 이 파일은 네트워크 I/O(adaptive-interview
// Edge Function)와 로깅(psychProfileService)만 담당한다 — 회귀 검증은 로직 레벨에서
// 이뤄지므로(docs/spec/phase2_재시작_현황.md) 이 훅 자체는 별도 단위테스트 대상이 아니다.

import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useUserStore } from '@/store/userStore';
import { useSessionStore } from '@/store/sessionStore';
import { logInterviewTurn, upsertMyPsychProfile } from '@/services/psychProfileService';
import {
  applyNarrativeAnswer,
  applySternbergAnswer,
  computeMeanUncertainty,
  computeUncertaintyMap,
  createInterviewSession,
  finalizeProfile,
  getNextStep,
  type InterviewStep,
  type ParsedInterviewResponse,
  type SessionState,
} from '@/lib/interview/adaptiveInterviewSession';

/** interview_sessions.session_id(UUID 컬럼)용 — 암호학적 무작위는 불필요, 세션 구분용 식별자. */
function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type AdaptiveInterviewPhase = 'idle' | 'asking' | 'done';

interface AdaptiveInterviewResponse {
  utterance?: string;
  normalized_value?: number;
  confidence?: number;
}

export function useAdaptiveInterview(mbti: string) {
  const userId = useUserStore((s) => s.userId);
  const setPsychProfile = useUserStore((s) => s.setPsychProfile);
  const setInterviewSession = useSessionStore((s) => s.setInterviewSession);
  const resetInterviewSession = useSessionStore((s) => s.resetInterviewSession);

  const sessionRef = useRef<SessionState | null>(null);
  const stepRef = useRef<InterviewStep | null>(null);
  const sessionIdRef = useRef('');
  const turnIndexRef = useRef(0);

  const [phase, setPhase] = useState<AdaptiveInterviewPhase>('idle');
  const [questionText, setQuestionText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invokeEdge = useCallback(
    async (
      action: 'generate' | 'parse',
      targetDimension: string,
      questionText: string,
      userResponseText?: string,
    ): Promise<AdaptiveInterviewResponse> => {
      const { data, error: invokeError } = await supabase.functions.invoke('adaptive-interview', {
        body: { action, targetDimension, questionText, userResponseText },
      });
      if (invokeError) throw new Error(invokeError.message);
      return (data ?? {}) as AdaptiveInterviewResponse;
    },
    [],
  );

  const presentStep = useCallback(
    async (step: InterviewStep) => {
      stepRef.current = step;

      if (step.kind === 'done') {
        const finalState = sessionRef.current;
        if (finalState) {
          const profile = finalizeProfile(finalState);
          setPsychProfile(profile);
          if (userId) {
            upsertMyPsychProfile(userId, profile).catch(() => {});
          }
        }
        resetInterviewSession();
        setPhase('done');
        return;
      }

      const state = sessionRef.current;
      if (!state) return;
      const dimension = step.kind === 'narrative' ? step.dimension : step.component;

      setInterviewSession({
        turnsUsed: state.turnsUsed,
        elapsedSeconds: state.elapsedSeconds,
        nextTargetDimension: dimension,
        entropySnapshot: computeUncertaintyMap(state),
      });

      setIsGenerating(true);
      try {
        const data = await invokeEdge('generate', dimension, step.question.text, undefined);
        setQuestionText(data.utterance ?? step.question.text);
      } catch {
        setQuestionText(step.question.text);
      } finally {
        setIsGenerating(false);
      }
      setPhase('asking');
    },
    [invokeEdge, resetInterviewSession, setInterviewSession, setPsychProfile, userId],
  );

  const start = useCallback(async () => {
    sessionRef.current = createInterviewSession(mbti);
    sessionIdRef.current = generateSessionId();
    turnIndexRef.current = 0;
    setError(null);
    resetInterviewSession();
    await presentStep(getNextStep(sessionRef.current));
  }, [mbti, presentStep, resetInterviewSession]);

  const submitAnswer = useCallback(
    async (text: string) => {
      const state = sessionRef.current;
      const step = stepRef.current;
      if (!state || !step || step.kind === 'done' || !text.trim()) return;

      setIsGenerating(true);
      setError(null);
      try {
        const dimension = step.kind === 'narrative' ? step.dimension : step.component;
        const raw = await invokeEdge('parse', dimension, step.question.text, text);
        const parsed: ParsedInterviewResponse = {
          normalizedValue: raw.normalized_value ?? 0.5,
          confidence: raw.confidence ?? 0,
        };

        const entropyBefore = computeMeanUncertainty(state);
        const nextState =
          step.kind === 'narrative'
            ? applyNarrativeAnswer(state, step.dimension, step.question, parsed)
            : applySternbergAnswer(state, step.component, step.question, parsed);
        const entropyAfter = computeMeanUncertainty(nextState);

        if (userId) {
          logInterviewTurn({
            sessionId: sessionIdRef.current,
            userId,
            turnIndex: turnIndexRef.current++,
            questionId: step.question.id,
            targetDimension: dimension,
            rawResponseText: text,
            parsedValue: parsed.normalizedValue,
            confidence: parsed.confidence,
            entropyBefore,
            entropyAfter,
          }).catch(() => {});
        }

        sessionRef.current = nextState;
        await presentStep(getNextStep(nextState));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsGenerating(false);
      }
    },
    [invokeEdge, presentStep, userId],
  );

  return { phase, questionText, isGenerating, error, start, submitAnswer };
}
