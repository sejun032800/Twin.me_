// ─── Score Store — 일치율 코어 엔진 v2.2 상태 (Zustand + AsyncStorage Persist) ───
// docs/Twin_me_MASTER_v2.6.md §5 — S_Live(실시간 게이지, non-persistent 표시용) /
// S_Current(자정 정산 공식 일치율) / S_Base(MBTI+에니어그램 기준 점수) 2층 구조(§5.1).
// §5.6 냉각 소실(Cooling Bleed)은 metrics.coolingBleed(aValue, minutesIdle)가 순수
// 함수로 계산하고, 이 스토어는 그 입출력(sLive/sCurrent)만 보관한다.
// §5.7 위기 메모리 — dailyStatusHistory 최근 7일을 보관하면 소비 측(예: metrics.
// shouldActivateCrisisMemory)이 최근 3일 슬라이스를 뽑아 crisisMemoryActive/
// volatilityIndex 갱신 여부를 판단해 setCrisisMemoryActive/setVolatilityIndex를 호출한다.
// 기존 src/services/matchEngineStore.ts의 load/save/clear AsyncStorage 로직(자정 정산
// 상태 + 이벤트 히스토리)을 이 스토어 하나로 흡수한다.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OverflowStatus } from '../engine/scoreCalculator';
import type { EventCode } from '../engine/metrics';

const SCORE_HISTORY_MAX_DAYS = 400; // 연간 Wrapped(§11) 최고점 조회를 위해 400일 보존
const DAILY_STATUS_MAX_DAYS = 7;
const EVENT_LOG_MAX_MS = 24 * 60 * 60 * 1000; // 24h

export interface ScoreHistoryEntry {
  date: string; // YYYY-MM-DD
  score: number;
}

export interface EventHistoryEntry {
  code: EventCode;
  t: number; // timestamp ms
  delta: number; // 해당 이벤트의 실제 적용 delta
}

export interface ScoreState {
  sLive: number; // 실시간 게이지 (0~100)
  sCurrent: number; // 당일 누적 점수
  sBase: number; // 기준 점수 (MBTI+에니어그램 산출)
  scoreHistory: ScoreHistoryEntry[]; // 최근 400일
  dailyStatusHistory: OverflowStatus[]; // 최근 7일 (위기 메모리용)
  crisisMemoryActive: boolean;
  volatilityIndex: number;
  eventLog: EventHistoryEntry[]; // 최근 24h 이벤트 로그
  lastSettledAt: string | null; // 마지막 자정 정산 시각 ISO
  _hasHydrated: boolean;
}

export interface ScoreActions {
  setSLive: (sLive: number) => void;
  setSCurrent: (sCurrent: number) => void;
  setSBase: (sBase: number) => void;
  /** 400일 초과분은 오래된 것부터 자동 제거 */
  appendScoreHistory: (entry: ScoreHistoryEntry) => void;
  /** 7일 초과분은 오래된 것부터 자동 제거 */
  appendDailyStatus: (status: OverflowStatus) => void;
  setCrisisMemoryActive: (active: boolean) => void;
  setVolatilityIndex: (v: number) => void;
  /** 24h(entry.t 기준) 초과 항목은 자동 제거 */
  appendEventLog: (entry: EventHistoryEntry) => void;
  setLastSettledAt: (iso: string) => void;
  setHasHydrated: (value: boolean) => void;
  reset: () => void;
}

const initialState: ScoreState = {
  sLive: 0,
  sCurrent: 0,
  sBase: 0,
  scoreHistory: [],
  dailyStatusHistory: [],
  crisisMemoryActive: false,
  volatilityIndex: 0,
  eventLog: [],
  lastSettledAt: null,
  _hasHydrated: false,
};

// TODO: EAS Build 환경에서 createJSONStorage(() => AsyncStorage)를
// expo-secure-store 기반 암호화 스토리지로 교체 필요.
// 현재 personaMatrix(심리 프로파일), toneVector(말투 지문),
// 파트너 정보, 관계 이력이 평문으로 저장됨.
// 참고: https://docs.expo.dev/versions/latest/sdk/securestore/
export const useScoreStore = create<ScoreState & ScoreActions>()(
  persist(
    (set) => ({
      ...initialState,
      setSLive: (sLive) => set({ sLive }),
      setSCurrent: (sCurrent) => set({ sCurrent }),
      setSBase: (sBase) => set({ sBase }),
      appendScoreHistory: (entry) =>
        set((state) => ({
          scoreHistory: [...state.scoreHistory, entry].slice(-SCORE_HISTORY_MAX_DAYS),
        })),
      appendDailyStatus: (status) =>
        set((state) => ({
          dailyStatusHistory: [...state.dailyStatusHistory, status].slice(-DAILY_STATUS_MAX_DAYS),
        })),
      setCrisisMemoryActive: (active) => set({ crisisMemoryActive: active }),
      setVolatilityIndex: (v) => set({ volatilityIndex: v }),
      appendEventLog: (entry) =>
        set((state) => {
          const cutoff = Date.now() - EVENT_LOG_MAX_MS;
          return { eventLog: [...state.eventLog, entry].filter((e) => e.t >= cutoff) };
        }),
      setLastSettledAt: (iso) => set({ lastSettledAt: iso }),
      setHasHydrated: (_hasHydrated) => set({ _hasHydrated }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: 'twin_score_store_v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        const { _hasHydrated, ...rest } = state;
        return rest;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
