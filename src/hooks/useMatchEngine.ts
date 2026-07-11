import { useCallback, useRef } from 'react';
import { classifyMessage, type ClassifierMessage, type ClassifierContext } from '@/engine/eventClassifier';
import { processTick, createFrequencyState, detectRapidSwing, detectCombos, coolingBleed, type ATick, type FrequencyState, type EventContext } from '@/engine/metrics';
import { useScoreStore } from '@/store/scoreStore';
import { evaluateGate, createGateState } from '@/engine/twinResponseEngine';
import { useSessionStore } from '@/store/sessionStore';

// FrequencyState: 코드별 당일 발생 횟수 추적 (자정 정산 전까지 메모리 유지)
const initialFreqState: FrequencyState = createFrequencyState();

export function useMatchEngine() {
  // sCurrent(자정 정산 값)는 읽기 전용 컨텍스트(갈등 판정)로만 쓰고, 이 훅 내부에서는
  // 절대 갱신하지 않는다 — settleMidnight()만이 sCurrent의 유일한 갱신 지점(§5.1).
  const sCurrent = useScoreStore((s) => s.sCurrent);
  const sLive = useScoreStore((s) => s.sLive);
  const setSLive = useScoreStore((s) => s.setSLive);
  const appendEventLog = useScoreStore((s) => s.appendEventLog);
  const gateState = useSessionStore((s) => s.gateState);
  const setGateState = useSessionStore((s) => s.setGateState);
  const setCrisisMode = useSessionStore((s) => s.setCrisisMode);

  // FrequencyState는 세션 내 메모리로 유지 (persist 불필요)
  const freqStateRef = useRef<FrequencyState>(initialFreqState);
  // 마지막 메시지 처리 시각 — coolingBleed(§5.6)의 유휴 시간 계산용
  const lastMessageAt = useRef<number | null>(null);
  // 이미 지급한 콤보를 "콤보코드:최신로그타임스탬프"로 기억해 같은 시퀀스에 중복 지급하지 않는다
  const awardedCombosRef = useRef<Set<string>>(new Set());

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

    const codes = classifyMessage(msg, ctx).filter(Boolean);
    if (codes.length === 0) return { codes: [], detections: [] };

    // sLive(냉각 적용 후 값)를 누적 기준점으로 이어받아야 같은 날 여러 메시지에 걸친
    // 누적 변화가 유지된다 — sCurrent를 기준점으로 삼으면 매 메시지마다 리셋돼버린다.
    let currentScore = cooledLive;
    const detections = [];
    // 각 이벤트 코드를 순서대로 처리하며
    // 게이트 상태를 누적 전파 (이전 코드의 nextState → 다음 코드 입력)
    let runningGateState = gateState ?? createGateState();

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

      const { detection, nextState } = evaluateGate(code, runningGateState);
      if (detection) detections.push(detection);
      runningGateState = nextState;
    }

    // 최종 게이트 상태만 1회 저장 (루프 도중 매번 저장하지 않음)
    setGateState(runningGateState);

    // rapidSwing/콤보 판정에 쓸 최신 이벤트 로그 (이번 메시지의 이벤트가 이미 append된 상태)
    const recentLog = useScoreStore.getState().eventLog;

    // 콤보 탐지 (부록A detectCombos, κ·γ 미적용 특례) — metrics.ts가 COMBO_REGISTRY 기준
    // bonus를 이미 계산해서 반환하므로 여기선 grouping/타이밍을 재구현하지 않고 그대로 가산한다.
    // latestLogTimestamp를 키에 포함해, 같은 시퀀스가 유지되는 동안 중복 지급되지 않게 한다.
    const comboHits = detectCombos(recentLog);
    const latestLogTimestamp = recentLog.length > 0 ? recentLog[recentLog.length - 1].t : 0;
    for (const combo of comboHits) {
      const awardKey = `${combo.code}:${latestLogTimestamp}`;
      if (awardedCombosRef.current.has(awardKey)) continue;
      awardedCombosRef.current.add(awardKey);
      currentScore = Math.max(0, Math.min(100, currentScore + combo.bonus));
    }

    // S_Current는 자정 정산(settleMidnight)에서만 갱신 — 실시간 변화는 S_Live만 반영한다(§5.1).
    setSLive(currentScore);

    // rapidSwing 감지 (§5.4 — 30분 윈도우 내 누적 하락 > 1.5)
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
