// ─── 트윈 제네시스 인터뷰 엔진 — 상태 머신 훅 (FUN-HOM-001 Override) ───────────
// 4막(잡담/개인성향/연애성향/엔딩) 진행, 음성-타이핑 하이브리드 폴백,
// STT 왜곡 방지용 되짚기(confirm) 단계, 베이지안 갱신, 점토 성장,
// 3채널 블렌딩·6색 오라 산출을 하나의 세션으로 오케스트레이션한다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { computePersonaBlend } from '../engine/genesisBlending';
import {
  didHypothesisSwitch,
  initBayesianState,
  shouldStopEarly,
  updatePosterior,
} from '../engine/genesisInference';
import { buildAuraVector } from '../engine/auraEngine';
import {
  getCoreMotiveQuestions,
  getIcebreakQuestions,
  getRomanticQuestions,
  matchArchetype,
  resolveRomanticQuestionMix,
} from '../data/genesisQuestionBank';
import {
  BayesianState,
  ClayStage,
  GenesisAct,
  GenesisAnswerArchetype,
  GenesisInputMode,
  GenesisQuestion,
  MbtiType,
  PersonaBlend,
  UserPersonaMatrix,
} from '../types/genesis';

// 5~10초 무발화 시 타이핑 모드로 폴백 (§1.2)
const SILENCE_TIMEOUT_MS = 7000;
const ACT2_MAX_QUESTIONS = 6;
const ACT3_MAX_QUESTIONS = 4;

export type GenesisPhase =
  | 'idle'
  | 'asking'       // 질문 표시 + 음성/타이핑 입력 대기
  | 'confirming'   // "아, ~라는 거지?" 되짚기
  | 'act-transition'
  | 'ceremony'
  | 'done';

interface PendingConfirm {
  question: GenesisQuestion;
  archetype: GenesisAnswerArchetype;
  transcript: string;
}

export interface UseGenesisInterviewResult {
  act: GenesisAct;
  phase: GenesisPhase;
  clayStage: ClayStage;
  inputMode: GenesisInputMode;
  currentQuestion: GenesisQuestion | null;
  pendingConfirm: PendingConfirm | null;
  bayesianState: BayesianState;
  personaBlend: PersonaBlend;
  progress: number; // 0-100
  pulseSignal: number; // 답변이 accept될 때마다 증가 — "빛 입자 흡수" 리액션 트리거
  start: () => void;
  submitTranscript: (text: string) => void;
  confirmArchetype: (archetypeId: string) => void;
  switchToTyping: () => void;
  switchToVoice: () => void;
  finalizePersonaMatrix: () => UserPersonaMatrix;
}

export function useGenesisInterview(mbti: MbtiType): UseGenesisInterviewResult {
  const [act, setAct] = useState<GenesisAct>(1);
  const [phase, setPhase] = useState<GenesisPhase>('idle');
  const [clayStage, setClayStage] = useState<ClayStage>(0);
  const [inputMode, setInputMode] = useState<GenesisInputMode>('voice');
  const [bayesianState, setBayesianState] = useState<BayesianState>(() => initBayesianState(mbti));
  const [pulseSignal, setPulseSignal] = useState(0);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const act1QueueRef = useRef<GenesisQuestion[]>(getIcebreakQuestions());
  const act2QueueRef = useRef<GenesisQuestion[]>([]);
  const act3QueueRef = useRef<GenesisQuestion[]>([]);
  const cursorRef = useRef(0);
  const [currentQuestion, setCurrentQuestion] = useState<GenesisQuestion | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      setInputMode('typing'); // "말로 하기 어려우면 적어줘도 돼" 폴백
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer]);

  useEffect(() => clearSilenceTimer, [clearSilenceTimer]);

  // inputMode는 여기서 건드리지 않는다 — 전화 수신 UI(voice)는 세션당 1회(start())만
  // 트리거되어야 하고, 이후 질문 전환에서 사용자가 이미 타이핑 모드로 전환했다면
  // 그 선택이 다음 질문에도 유지돼야 한다(매 질문마다 콜 UI가 재노출되는 버그 방지).
  const presentQuestion = useCallback(
    (question: GenesisQuestion | null) => {
      setCurrentQuestion(question);
      setPhase(question ? 'asking' : 'act-transition');
      if (question) armSilenceTimer();
    },
    [armSilenceTimer],
  );

  const beginAct2 = useCallback((state: BayesianState) => {
    act2QueueRef.current = getCoreMotiveQuestions(state.topType);
    cursorRef.current = 0;
    setAct(2);
    setClayStage(1);
    presentQuestion(act2QueueRef.current[0] ?? null);
  }, [presentQuestion]);

  const beginAct3 = useCallback((state: BayesianState) => {
    const mix = resolveRomanticQuestionMix(state.confidence, state.margin);
    act3QueueRef.current = getRomanticQuestions(state.topType, mix, ACT3_MAX_QUESTIONS);
    cursorRef.current = 0;
    setAct(3);
    setClayStage(2);
    presentQuestion(act3QueueRef.current[0] ?? null);
  }, [presentQuestion]);

  const beginCeremony = useCallback(() => {
    setAct(4);
    setClayStage(3);
    setPhase('ceremony');
    setCurrentQuestion(null);
    clearSilenceTimer();
  }, [clearSilenceTimer]);

  const start = useCallback(() => {
    setAct(1);
    setClayStage(0);
    setInputMode('voice'); // 세션 시작 시 1회만 — 이후는 presentQuestion이 유지한다
    setBayesianState(initBayesianState(mbti));
    act1QueueRef.current = getIcebreakQuestions();
    cursorRef.current = 0;
    presentQuestion(act1QueueRef.current[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mbti, presentQuestion]);

  // ── 1막: 내용 무관 — 그냥 다음 질문으로 순차 진행 ──────────────────────────
  const advanceAct1 = useCallback(() => {
    cursorRef.current += 1;
    const next = act1QueueRef.current[cursorRef.current];
    if (next) {
      presentQuestion(next);
    } else {
      beginAct2(bayesianState);
    }
  }, [bayesianState, beginAct2, presentQuestion]);

  // ── 2막/3막 공통: 베이지안 갱신 후 다음 질문 또는 다음 막으로 전이 ──────────
  const advanceAfterUpdate = useCallback(
    (nextState: BayesianState) => {
      const switched = didHypothesisSwitch(nextState);

      if (act === 2) {
        if (switched) {
          // 가설 스위치 — 새 1위 유형의 확증/반증 노드로 질문 풀 전면 교체
          const asked = new Set(nextState.askedQuestionIds);
          act2QueueRef.current = getCoreMotiveQuestions(nextState.topType).filter((q) => !asked.has(q.id));
          cursorRef.current = -1; // 아래에서 +1 되어 0부터 시작
        }

        const stopEarly = shouldStopEarly(nextState);
        const askedCount = nextState.askedQuestionIds.length;
        cursorRef.current += 1;
        const next = act2QueueRef.current[cursorRef.current];

        if (stopEarly || askedCount >= ACT2_MAX_QUESTIONS || !next) {
          beginAct3(nextState);
        } else {
          presentQuestion(next);
        }
        return;
      }

      if (act === 3) {
        const stopEarly = shouldStopEarly(nextState);
        cursorRef.current += 1;
        const next = act3QueueRef.current[cursorRef.current];

        if (stopEarly || !next) {
          beginCeremony();
        } else {
          presentQuestion(next);
        }
      }
    },
    [act, beginAct3, beginCeremony, presentQuestion],
  );

  const submitTranscript = useCallback(
    (text: string) => {
      clearSilenceTimer();
      if (!currentQuestion) return;

      if (act === 1) {
        advanceAct1();
        return;
      }

      const archetype = matchArchetype(currentQuestion, text);
      if (!archetype) {
        // 저신뢰 답변("잘 모르겠어요" 등 키워드 매칭 0건) — 확정 해석 대신 재질문한다.
        // 같은 질문에 머무르므로 currentQuestion/phase는 그대로 두고 침묵 타이머만 재무장한다.
        Alert.alert(
          '조금 더 말해줄 수 있을까요?',
          '방금 답변에서 확실한 힌트를 찾지 못했어요. 조금 더 구체적으로 다시 답해주세요.',
        );
        armSilenceTimer();
        return;
      }
      setPendingConfirm({ question: currentQuestion, archetype, transcript: text });
      setPhase('confirming');
    },
    [act, advanceAct1, armSilenceTimer, clearSilenceTimer, currentQuestion],
  );

  const confirmArchetype = useCallback(
    (archetypeId: string) => {
      if (!pendingConfirm) return;
      const chosen =
        pendingConfirm.question.archetypes.find((a) => a.id === archetypeId) ?? pendingConfirm.archetype;

      const nextState = updatePosterior(bayesianState, chosen.likelihood, pendingConfirm.question.id);
      setBayesianState(nextState);
      setPulseSignal((n) => n + 1);
      setPendingConfirm(null);
      advanceAfterUpdate(nextState);
    },
    [advanceAfterUpdate, bayesianState, pendingConfirm],
  );

  const switchToTyping = useCallback(() => {
    clearSilenceTimer();
    setInputMode('typing');
    // confirming 단계("다시 답하기")에서 호출된 경우 AI의 재해석을 취소하고 같은
    // 질문의 재입력 상태로 되돌린다. asking/act-transition 단계에서 호출되면(콜 UI
    // 종료 버튼) 이미 phase==='asking'이라 아래 두 줄은 사실상 no-op이다.
    setPendingConfirm(null);
    setPhase((prev) => (prev === 'confirming' ? 'asking' : prev));
  }, [clearSilenceTimer]);

  const switchToVoice = useCallback(() => {
    setInputMode('voice');
    armSilenceTimer();
  }, [armSilenceTimer]);

  const personaBlend = useMemo(
    () => computePersonaBlend(bayesianState.topType, bayesianState.confidence),
    [bayesianState],
  );

  const progress = useMemo(() => {
    const actWeight = { 1: 10, 2: 40, 3: 40, 4: 10 } as Record<GenesisAct, number>;
    const base = act === 1 ? 0 : act === 2 ? actWeight[1] : act === 3 ? actWeight[1] + actWeight[2] : 90;
    if (act === 4) return 100;
    const queue = act === 1 ? act1QueueRef.current : act === 2 ? act2QueueRef.current : act3QueueRef.current;
    const within = queue.length > 0 ? (Math.max(0, cursorRef.current) / queue.length) * actWeight[act] : 0;
    return Math.min(99, Math.round(base + within));
  }, [act]);

  const finalizePersonaMatrix = useCallback((): UserPersonaMatrix => {
    const auraVector = buildAuraVector(bayesianState.probabilities);
    return {
      enneagramType: bayesianState.topType,
      bayesian: bayesianState,
      auraVector,
      blend: personaBlend,
      accuracyUnlocked: true,
      completedAt: new Date().toISOString(),
      clayStage: 3,
    };
  }, [bayesianState, personaBlend]);

  return {
    act,
    phase,
    clayStage,
    inputMode,
    currentQuestion,
    pendingConfirm,
    bayesianState,
    personaBlend,
    progress,
    pulseSignal,
    start,
    submitTranscript,
    confirmArchetype,
    switchToTyping,
    switchToVoice,
    finalizePersonaMatrix,
  };
}
