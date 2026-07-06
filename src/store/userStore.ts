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
  mbti: string | null;
  enneagramType: EnneagramType | null;
  personaMatrix: UserPersonaMatrix | null;
  toneVector: UserToneVector | null;
  isOnboardingComplete: boolean;
  isFoundingVip: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  lastGenesisAt: string | null;
}

export interface UserActions {
  setUserId: (userId: string | null) => void;
  setMbti: (mbti: string | null) => void;
  setEnneagramType: (enneagramType: EnneagramType | null) => void;
  setPersonaMatrix: (personaMatrix: UserPersonaMatrix | null) => void;
  setToneVector: (toneVector: UserToneVector | null) => void;
  completeOnboarding: () => void;
  setFoundingVip: (isFoundingVip: boolean) => void;
  setSubscriptionStatus: (subscriptionStatus: SubscriptionStatus | null) => void;
  setLastGenesisAt: (lastGenesisAt: string | null) => void;
  /** 로그아웃/계정 전환 시 온보딩 이전 상태로 완전 초기화 */
  reset: () => void;
}

const initialState: UserState = {
  userId: null,
  mbti: null,
  enneagramType: null,
  personaMatrix: null,
  toneVector: null,
  isOnboardingComplete: false,
  isFoundingVip: false,
  subscriptionStatus: null,
  lastGenesisAt: null,
};

export const useUserStore = create<UserState & UserActions>()(
  persist(
    (set) => ({
      ...initialState,
      setUserId: (userId) => set({ userId }),
      setMbti: (mbti) => set({ mbti }),
      setEnneagramType: (enneagramType) => set({ enneagramType }),
      setPersonaMatrix: (personaMatrix) => set({ personaMatrix }),
      setToneVector: (toneVector) => set({ toneVector }),
      completeOnboarding: () => set({ isOnboardingComplete: true }),
      setFoundingVip: (isFoundingVip) => set({ isFoundingVip }),
      setSubscriptionStatus: (subscriptionStatus) => set({ subscriptionStatus }),
      setLastGenesisAt: (lastGenesisAt) => set({ lastGenesisAt }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: 'twin_user_store_v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
