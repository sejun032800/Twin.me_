import { useCallback, useRef } from 'react';
import { classifyMessage, type ClassifierMessage, type ClassifierContext } from '@/engine/eventClassifier';
import { processTick, createFrequencyState, type FrequencyState, type EventContext } from '@/engine/metrics';
import { useScoreStore } from '@/store/scoreStore';
import { evaluateGate, createGateState } from '@/engine/twinResponseEngine';
import { useSessionStore } from '@/store/sessionStore';

// FrequencyState: 코드별 당일 발생 횟수 추적 (자정 정산 전까지 메모리 유지)
const initialFreqState: FrequencyState = createFrequencyState();

export function useMatchEngine() {
  const { sCurrent, setSCurrent, setSLive, appendEventLog } = useScoreStore();
  const { gateState, setGateState } = useSessionStore();

  // FrequencyState는 세션 내 메모리로 유지 (persist 불필요)
  const freqStateRef = useRef<FrequencyState>(initialFreqState);

  const processMessage = useCallback((
    text: string,
    role: 'me' | 'partner',
    history: ClassifierMessage[],
  ) => {
    const msg: ClassifierMessage = {
      role,
      text,
      timestamp: Date.now(),
    };

    const ctx: ClassifierContext = {
      history: [...history, msg],
      inConflict: sCurrent < 40,
    };

    const codes = classifyMessage(msg, ctx);
    if (codes.length === 0) return { codes: [], detections: [] };

    let currentScore = sCurrent;
    const detections = [];
    const currentGateState = gateState ?? createGateState();

    for (const code of codes) {
      const eventCtx: EventContext = {
        inConflict: sCurrent < 40,
        intensity: 1.0,
        sender: role,
      };

      try {
        const result = processTick(code, freqStateRef.current, eventCtx);
        currentScore = Math.max(0, Math.min(100, currentScore + result.deltaFinal));
        appendEventLog({ code, t: Date.now(), delta: result.deltaFinal });
      } catch {
        // 개별 이벤트 처리 실패 시 무시하고 계속
      }

      const { detection, nextState } = evaluateGate(code, currentGateState);
      if (detection) detections.push(detection);
      setGateState(nextState);
    }

    setSCurrent(currentScore);
    setSLive(currentScore);

    return { codes, detections };
  }, [sCurrent, gateState, setSCurrent, setSLive, appendEventLog, setGateState]);

  return { processMessage };
}
