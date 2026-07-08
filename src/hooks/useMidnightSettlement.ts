// ─── Midnight Settlement Hook (MASTER.md §5.4 자정 정산) ─────────────────────
// 앱 루트에서 한 번만 마운트한다. 시작 시 마지막 정산일이 오늘과 다르면 즉시 정산하고,
// 이후 자정마다 settleMidnight()을 실행해 scoreHistory/dailyStatusHistory를 갱신한다.
// aEndOfDay(당일 누적 이벤트 A값)는 별도 누적 필드가 없어 eventLog(최근 24h) 델타 합으로
// 근사하고, sTodayOpen은 useMatchEngine이 이벤트마다 sCurrent에 델타를 바로 반영하는
// 현재 구조상 sCurrent에서 그 누적분을 역산해 구한다.

import { useEffect } from 'react';
import { settleMidnight, shouldActivateCrisisMemory, resolveActiveCapPlus, computeVolatilityIndex } from '@/engine/metrics';
import { useScoreStore } from '@/store/scoreStore';
import { scheduleLocalNotification } from '@/services/notificationService';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function runSettlement() {
  const store = useScoreStore.getState();
  const aEndOfDay = store.eventLog.reduce((sum, e) => sum + e.delta, 0);
  const sTodayOpen = store.sCurrent - aEndOfDay;
  const capPlusOverride = resolveActiveCapPlus(store.crisisMemoryActive);

  const result = settleMidnight(sTodayOpen, aEndOfDay, store.sBase, capPlusOverride);

  store.appendScoreHistory({ date: todayDateString(), score: result.sCurrent });
  store.appendDailyStatus(result.overflowStatus);
  store.setCrisisMemoryActive(shouldActivateCrisisMemory(useScoreStore.getState().dailyStatusHistory));
  store.setLastSettledAt(new Date().toISOString());
  store.setSCurrent(result.sCurrent);

  // §5.5 변동성 지수 — 7일 롤링 구간의 일별 증감(Δ_daily) 표준편차.
  // scoreHistory는 일별 settled 절대점수라 연속 항목 차분으로 Δ_daily를 구해야 한다
  // (원점수 자체의 표준편차를 넣으면 "변동성"이 아니라 "기준점 높낮이"를 재게 된다).
  const recentScores = useScoreStore.getState().scoreHistory
    .slice(-8)
    .map((h) => h.score);
  const dailyDeltas = recentScores.slice(1).map((score, i) => score - recentScores[i]);

  if (dailyDeltas.length >= 2) {
    const vi = computeVolatilityIndex(dailyDeltas);
    useScoreStore.getState().setVolatilityIndex(vi);
  }

  await scheduleLocalNotification(
    '오늘의 연애 온도 📊',
    `오늘 하루 ${result.sCurrent.toFixed(1)}점으로 마무리됐어요`,
  );
}

function msUntilNextMidnight(): number {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setDate(now.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);
  return nextMidnight.getTime() - now.getTime();
}

export function useMidnightSettlement(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const lastSettledAt = useScoreStore.getState().lastSettledAt;
    const lastSettledDate = lastSettledAt ? lastSettledAt.slice(0, 10) : null;
    if (lastSettledDate !== todayDateString()) {
      runSettlement();
    }

    let intervalId: ReturnType<typeof setInterval> | undefined;
    const timeoutId = setTimeout(() => {
      runSettlement();
      intervalId = setInterval(runSettlement, ONE_DAY_MS);
    }, msUntilNextMidnight());

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [enabled]);
}
