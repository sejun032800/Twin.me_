// ─── User Store — 통합 유저 상태 (Zustand + AsyncStorage Persist) ────────────────
// docs/Twin_me_MASTER_v2.6.md §0.4(핵심 데이터 칩) 기준 User_Tone_Vector /
// User_Persona_Matrix를 비롯해 §2(온보딩 완료 여부), §8.7/FUN-SET-001C(founding-VIP),
// §9(구독 상태)까지 하나의 zustand persist 스토어로 통합한다.
// 기존 src/services/personaMatrixStore.ts, userToneVectorStore.ts가 각자 관리하던
// AsyncStorage 영속화 로직(load/save/clear + 개별 STORAGE_KEY)을 이 스토어 하나로 흡수한다.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EnneagramType, UserPersonaMatrix } from '../types/genesis';
import type { UserToneVector } from '../engine/userToneVectorBuilder';
import type { SubscriptionStatus } from '../services/iapService';

export interface UserState {
  userId: string | null;
  name: string | null;
  mbti: string | null;
  enneagramType: EnneagramType | null;
  personaMatrix: UserPersonaMatrix | null;
  toneVector: UserToneVector | null;
  isOnboardingComplete: boolean;
  isFoundingVip: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  lastGenesisAt: string | null;
  pushToken: string | null;
  /** §9.3 무료 플랜 월간 대화 횟수 카운터 — useMidnightSettlement가 매월 1일에 0으로 리셋 */
  monthlyChatCount: number;
}

export interface UserActions {
  setUserId: (userId: string | null) => void;
  setName: (name: string | null) => void;
  setMbti: (mbti: string | null) => void;
  setEnneagramType: (enneagramType: EnneagramType | null) => void;
  setPersonaMatrix: (personaMatrix: UserPersonaMatrix | null) => void;
  setToneVector: (toneVector: UserToneVector | null) => void;
  completeOnboarding: () => void;
  setFoundingVip: (isFoundingVip: boolean) => void;
  setSubscriptionStatus: (subscriptionStatus: SubscriptionStatus | null) => void;
  setLastGenesisAt: (lastGenesisAt: string | null) => void;
  setPushToken: (pushToken: string | null) => void;
  setMonthlyChatCount: (monthlyChatCount: number) => void;
  /** 로그아웃/계정 전환 시 온보딩 이전 상태로 완전 초기화 */
  reset: () => void;
}

const initialState: UserState = {
  userId: null,
  name: null,
  mbti: null,
  enneagramType: null,
  personaMatrix: null,
  toneVector: null,
  isOnboardingComplete: false,
  isFoundingVip: false,
  subscriptionStatus: null,
  lastGenesisAt: null,
  pushToken: null,
  monthlyChatCount: 0,
};

export const useUserStore = create<UserState & UserActions>()(
  persist(
    (set) => ({
      ...initialState,
      setUserId: (userId) => set({ userId }),
      setName: (name) => set({ name }),
      setMbti: (mbti) => set({ mbti }),
      setEnneagramType: (enneagramType) => set({ enneagramType }),
      setPersonaMatrix: (personaMatrix) => set({ personaMatrix }),
      setToneVector: (toneVector) => set({ toneVector }),
      completeOnboarding: () => set({ isOnboardingComplete: true }),
      setFoundingVip: (isFoundingVip) => set({ isFoundingVip }),
      setSubscriptionStatus: (subscriptionStatus) => set({ subscriptionStatus }),
      setLastGenesisAt: (lastGenesisAt) => set({ lastGenesisAt }),
      setPushToken: (pushToken) => set({ pushToken }),
      setMonthlyChatCount: (monthlyChatCount) => set({ monthlyChatCount }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: 'twin_user_store_v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
