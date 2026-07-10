// ─── Couple Store — 커플 연동 상태 (Zustand + AsyncStorage Persist) ──────────────
// docs/Twin_me_MASTER_v2.6.md §0.3(싱글플레이어 원칙) — 연인 미가입/미연동 상태에서도
// 모든 핵심 기능(트윈/거울방, 일치율, 리포트)이 단독 작동해야 하므로, 이 스토어의
// isPartnerConnected=false가 정상 초기 상태이며 어떤 화면도 이를 전제로 막혀서는 안 된다.
// §3(메인 탭) — relationshipStartDate/anniversaries는 연애 대시보드의 D-day·추억 표기에 쓰인다.
// §9(플랜) — planTier는 Couple_ID 기준으로 저장되므로(§9.2), coupleId가 결제/플랜 조회의 키가 된다.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Anniversary {
  id: string;
  label: string;
  date: string; // YYYY-MM-DD
}

export interface CoupleState {
  coupleId: string | null;
  partnerUserId: string | null;
  partnerName: string | null;
  relationshipStartDate: string | null; // YYYY-MM-DD
  /** 연인 미가입 시 false — §0.3 싱글플레이어 원칙상 정상 초기 상태 */
  isPartnerConnected: boolean;
  /** 내가 생성한 초대 코드 */
  inviteCode: string | null;
  anniversaries: Anniversary[];
}

export interface CoupleActions {
  setCoupleId: (coupleId: string | null) => void;
  setPartnerInfo: (partnerUserId: string | null, partnerName: string | null) => void;
  setRelationshipStartDate: (relationshipStartDate: string | null) => void;
  setPartnerConnected: (isConnected: boolean) => void;
  setInviteCode: (inviteCode: string | null) => void;
  addAnniversary: (anniversary: Anniversary) => void;
  removeAnniversary: (id: string) => void;
  reset: () => void;
}

const initialState: CoupleState = {
  coupleId: null,
  partnerUserId: null,
  partnerName: null,
  relationshipStartDate: null,
  isPartnerConnected: false,
  inviteCode: null,
  anniversaries: [],
};

// TODO: EAS Build 환경에서 createJSONStorage(() => AsyncStorage)를
// expo-secure-store 기반 암호화 스토리지로 교체 필요.
// 현재 personaMatrix(심리 프로파일), toneVector(말투 지문),
// 파트너 정보, 관계 이력이 평문으로 저장됨.
// 참고: https://docs.expo.dev/versions/latest/sdk/securestore/
export const useCoupleStore = create<CoupleState & CoupleActions>()(
  persist(
    (set) => ({
      ...initialState,
      setCoupleId: (coupleId) => set({ coupleId }),
      setPartnerInfo: (partnerUserId, partnerName) => set({ partnerUserId, partnerName }),
      setRelationshipStartDate: (relationshipStartDate) => set({ relationshipStartDate }),
      setPartnerConnected: (isConnected) => set({ isPartnerConnected: isConnected }),
      setInviteCode: (inviteCode) => set({ inviteCode }),
      addAnniversary: (anniversary) =>
        set((state) => ({ anniversaries: [...state.anniversaries, anniversary] })),
      removeAnniversary: (id) =>
        set((state) => ({ anniversaries: state.anniversaries.filter((a) => a.id !== id) })),
      reset: () => set({ ...initialState }),
    }),
    {
      name: 'twin_couple_store_v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
