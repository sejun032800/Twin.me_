import { useCallback, useRef } from 'react';
import { classifyMessage, type ClassifierMessage, type ClassifierContext } from '@/engine/eventClassifier';
import { processTick, createFrequencyState, detectRapidSwing, coolingBleed, type ATick, type FrequencyState, type EventContext } from '@/engine/metrics';
import { useScoreStore } from '@/store/scoreStore';
import { evaluateGate, createGateState } from '@/engine/twinResponseEngine';
import { useSessionStore } from '@/store/sessionStore';

// FrequencyState: 코드별 당일 발생 횟수 추적 (자정 정산 전까지 메모리 유지)
const initialFreqState: FrequencyState = createFrequencyState();

export function useMatchEngine() {
  // sCurrent(자정 정산 값)는 읽기 전용 컨텍스트(갈등 판정)로만 쓰고, 이 훅 내부에서는
  // 절대 갱신하지 않는다 — settleMidnight()만이 sCurrent의 유일한 갱신 지점(§5.1).
  const { sCurrent, sLive, setSLive, appendEventLog } = useScoreStore();
  const { gateState, setGateState } = useSessionStore();
  const setCrisisMode = useSessionStore((s) => s.setCrisisMode);

  // FrequencyState는 세션 내 메모리로 유지 (persist 불필요)
  const freqStateRef = useRef<FrequencyState>(initialFreqState);
  // 마지막 메시지 처리 시각 — coolingBleed(§5.6)의 유휴 시간 계산용
  const lastMessageAt = useRef<number | null>(null);

  const processMessage = useCallback((
    text: string,
    role: 'me' | 'partner',
    history: ClassifierMessage[],
  ) => {
    // §5.6 냉각 소실 — 유휴 상태였다면 sLive를 표시용으로만 감쇠시킨다 (sCurrent엔 영향 없음)
    const minutesIdle = lastMessageAt.current
      ? (Date.now() - lastMessageAt.current) / 60000
      : 0;
    const cooledLive = coolingBleed(sLive, minutesIdle);
    if (cooledLive !== sLive) {
      setSLive(cooledLive);
    }
    lastMessageAt.current = Date.now();

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

    // sLive(냉각 적용 후 값)를 누적 기준점으로 이어받아야 같은 날 여러 메시지에 걸친
    // 누적 변화가 유지된다 — sCurrent를 기준점으로 삼으면 매 메시지마다 리셋돼버린다.
    let currentScore = cooledLive;
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

    // S_Current는 자정 정산(settleMidnight)에서만 갱신 — 실시간 변화는 S_Live만 반영한다(§5.1).
    setSLive(currentScore);

    // rapidSwing 감지 (§5.4 — 30분 윈도우 내 누적 하락 > 1.5)
    const recentLog = useScoreStore.getState().eventLog;
    let cumulative = 0;
    const ticks: ATick[] = recentLog.map((e) => {
      cumulative += e.delta;
      return { t: e.t, aValue: cumulative };
    });
    const currentA = ticks.length > 0 ? ticks[ticks.length - 1].aValue : 0;
    if (detectRapidSwing(ticks, currentA)) {
      setCrisisMode(true);
    }

    return { codes, detections };
  }, [sCurrent, sLive, gateState, setSLive, appendEventLog, setGateState, setCrisisMode]);

  return { processMessage };
}
