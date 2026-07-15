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

// ─── 연애 DNA v2.1 심리 프로파일 (Phase 1 — 그릇만 준비, 아직 아무도 읽지/쓰지 않음) ──
// docs/spec/연애_DNA_일치율_공식_v2.1.md §1 표기법을 그대로 반영한 사후상태.
// personaMatrix(Aura·제네시스 UX 소관, 애니어그램 코어 전용)와는 별개 슬롯으로 분리한다
// — 감사표(docs/audit/폐기_수정_항목_감사표.md)가 personaMatrix를 UX 소관으로 규정했으므로
// 순수 추론 상태(Big5·애착·애니어그램 코어+날개·스턴버그)를 섞지 않기 위함이다.
export interface PsychProfile {
  big5: { O: number; C: number; E: number; A: number; N: number };
  attachment: { anxiety: number; avoidance: number };
  enneagramCore: number[]; // p ∈ Δ⁹, length 9
  enneagramWingJoint: Record<string, number>; // q, key="{core}w{wing}"
  sternbergState: { intimacy: number; passion: number; commitment: number } | null;
  mbtiEstimated: { pE: number; pN_axis: number; pF: number; pJ: number } | null; // §10 보너스, 궁합 계산 미관여
  interviewMeta: {
    completedAt: string | null;
    turnsUsed: number;
    elapsedSeconds: number;
    stopReason: 'time_cap' | 'entropy_threshold' | 'min_turns_satisfied' | null;
    calibrationVersion: string; // 예: "v2.1"
  };
}

export interface UserState {
  userId: string | null;
  name: string | null;
  mbti: string | null;
  enneagramType: EnneagramType | null;
  personaMatrix: UserPersonaMatrix | null;
  /** 연애 DNA v2.1 심리 프로파일 — Phase 3 전까지는 아무도 읽거나 쓰지 않는 미사용 슬롯 */
  psychProfile: PsychProfile | null;
  toneVector: UserToneVector | null;
  isOnboardingComplete: boolean;
  isFoundingVip: boolean;
  /** 카카오톡 대화 업로드 완료 여부 — Helix 아카이브의 하드코딩 예시 카드 노출 판단 기준 */
  hasKakaoData: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  lastGenesisAt: string | null;
  pushToken: string | null;
  /** §9.3 무료 플랜 월간 대화 횟수 카운터 — useMidnightSettlement가 매월 1일에 0으로 리셋 */
  monthlyChatCount: number;
  /** 최초 가입 시각(ISO 문자열) — 무료 플랜 14일 트라이얼 기간 판정 기준 */
  joinedAt: string | null;
  _hasHydrated: boolean;
}

export interface UserActions {
  setUserId: (userId: string | null) => void;
  setName: (name: string | null) => void;
  setMbti: (mbti: string | null) => void;
  setEnneagramType: (enneagramType: EnneagramType | null) => void;
  setPersonaMatrix: (personaMatrix: UserPersonaMatrix | null) => void;
  setPsychProfile: (psychProfile: PsychProfile | null) => void;
  setToneVector: (toneVector: UserToneVector | null) => void;
  completeOnboarding: () => void;
  setFoundingVip: (isFoundingVip: boolean) => void;
  setHasKakaoData: (hasKakaoData: boolean) => void;
  setSubscriptionStatus: (subscriptionStatus: SubscriptionStatus | null) => void;
  setLastGenesisAt: (lastGenesisAt: string | null) => void;
  setPushToken: (pushToken: string | null) => void;
  setMonthlyChatCount: (monthlyChatCount: number) => void;
  setJoinedAt: (joinedAt: string) => void;
  setHasHydrated: (value: boolean) => void;
  /** 로그아웃/계정 전환 시 온보딩 이전 상태로 완전 초기화 */
  reset: () => void;
}

const initialState: UserState = {
  userId: null,
  name: null,
  mbti: null,
  enneagramType: null,
  personaMatrix: null,
  psychProfile: null,
  toneVector: null,
  isOnboardingComplete: false,
  isFoundingVip: false,
  hasKakaoData: false,
  subscriptionStatus: null,
  lastGenesisAt: null,
  pushToken: null,
  monthlyChatCount: 0,
  joinedAt: null,
  _hasHydrated: false,
};

// TODO: EAS Build 환경에서 createJSONStorage(() => AsyncStorage)를
// expo-secure-store 기반 암호화 스토리지로 교체 필요.
// 현재 personaMatrix(심리 프로파일), toneVector(말투 지문),
// 파트너 정보, 관계 이력이 평문으로 저장됨.
// 참고: https://docs.expo.dev/versions/latest/sdk/securestore/
export const useUserStore = create<UserState & UserActions>()(
  persist(
    (set) => ({
      ...initialState,
      setUserId: (userId) => set({ userId }),
      setName: (name) => set({ name }),
      setMbti: (mbti) => set({ mbti }),
      setEnneagramType: (enneagramType) => set({ enneagramType }),
      setPersonaMatrix: (personaMatrix) => set({ personaMatrix }),
      setPsychProfile: (psychProfile) => set({ psychProfile }),
      setToneVector: (toneVector) => set({ toneVector }),
      completeOnboarding: () => set({ isOnboardingComplete: true }),
      setFoundingVip: (isFoundingVip) => set({ isFoundingVip }),
      setHasKakaoData: (hasKakaoData) => set({ hasKakaoData }),
      setSubscriptionStatus: (subscriptionStatus) => set({ subscriptionStatus }),
      setLastGenesisAt: (lastGenesisAt) => set({ lastGenesisAt }),
      setPushToken: (pushToken) => set({ pushToken }),
      setMonthlyChatCount: (monthlyChatCount) => set({ monthlyChatCount }),
      setJoinedAt: (joinedAt) => set({ joinedAt }),
      setHasHydrated: (_hasHydrated) => set({ _hasHydrated }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: 'twin_user_store_v1',
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
