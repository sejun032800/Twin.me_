// ─── Session Store — 휘발성 세션 상태 (Zustand) ─────────────────────
// docs/Twin_me_MASTER_v2.6.md §2(온보딩 — isGenesisInProgress), §4(채팅 탭 — 룸1/룸2/룸3
// activeChatRoom 'lover'|'twin'|'analyst'), §5.3(실시간 틱 엔진 — gateState는
// twinResponseEngine.evaluateGate()가 매 이벤트마다 갱신하는 판정 상태).
// 대부분의 값은 앱을 재시작하면 사라져야 하는 세션 한정 UI/런타임 상태이므로
// (스플래시 전환 여부, 현재 탭/룸, 인터뷰 진행 플래그, CrisisMode, 오라 화면 키 등)
// AsyncStorage persist를 사용하지 않는다. 단, privacyLevel(§8 프라이버시 슬라이더)만은
// 재시작 후에도 유지되어야 하므로 partialize로 그 값만 persist한다.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GateState } from '../engine/twinResponseEngine';
import type { AuraScreenKey } from '../engine/auraThemeEngine';
import type { ThemeMode } from '../constants/theme';

export type ActiveTab = 'home' | 'chat' | 'history' | 'settings';
export type ActiveChatRoom = 'lover' | 'twin' | 'analyst' | null;

export interface SessionState {
  isAppReady: boolean; // 스플래시 → 앱 전환 완료 여부
  activeTab: ActiveTab;
  activeChatRoom: ActiveChatRoom;
  isGenesisInProgress: boolean; // 제네시스 인터뷰 진행 중
  isCrisisMode: boolean; // CrisisMode(FUN-CHA-003) 활성 여부
  crisisModeTriggeredAt: number | null; // timestamp ms
  gateState: GateState | null; // twinResponseEngine 판정 상태
  currentAuraScreenKey: AuraScreenKey; // 화면별 오라 강도 라우팅용
  themeMode: ThemeMode; // 화면 테마 설정(설정 탭 §8 FUN-SET-001B)
  privacyLevel: 0 | 1 | 2; // AI 학습 범위(설정 탭 §8 프라이버시 슬라이더) — 0=보호 1=최적화 2=완전복제
}

export interface SessionActions {
  setAppReady: (ready: boolean) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setActiveChatRoom: (room: ActiveChatRoom) => void;
  setGenesisInProgress: (inProgress: boolean) => void;
  /** true로 설정 시 crisisModeTriggeredAt도 Date.now()로 함께 기록 */
  setCrisisMode: (active: boolean) => void;
  setGateState: (state: GateState | null) => void;
  setAuraScreenKey: (key: AuraScreenKey) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setPrivacyLevel: (level: 0 | 1 | 2) => void;
  reset: () => void;
}

const initialState: SessionState = {
  isAppReady: false,
  activeTab: 'home',
  activeChatRoom: null,
  isGenesisInProgress: false,
  isCrisisMode: false,
  crisisModeTriggeredAt: null,
  gateState: null,
  currentAuraScreenKey: 'other',
  themeMode: 'dark',
  privacyLevel: 1,
};

export const useSessionStore = create<SessionState & SessionActions>()(
  persist(
    (set) => ({
      ...initialState,
      setAppReady: (ready) => set({ isAppReady: ready }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setActiveChatRoom: (room) => set({ activeChatRoom: room }),
      setGenesisInProgress: (inProgress) => set({ isGenesisInProgress: inProgress }),
      setCrisisMode: (active) =>
        set((state) => ({
          isCrisisMode: active,
          crisisModeTriggeredAt: active ? Date.now() : state.crisisModeTriggeredAt,
        })),
      setGateState: (state) => set({ gateState: state }),
      setAuraScreenKey: (key) => set({ currentAuraScreenKey: key }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setPrivacyLevel: (privacyLevel) => set({ privacyLevel }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: 'twin_session_privacy_v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ privacyLevel: state.privacyLevel }),
    },
  ),
);
