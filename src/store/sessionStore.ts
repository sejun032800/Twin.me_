// ─── Session Store — 휘발성 세션 상태 (Zustand) ─────────────────────
// docs/Twin_me_MASTER_v2.6.md §2(온보딩 — isGenesisInProgress), §4(채팅 탭 — 룸1/룸2/룸3
// activeChatRoom 'lover'|'twin'|'analyst'), §5.3(실시간 틱 엔진 — gateState는
// twinResponseEngine.evaluateGate()가 매 이벤트마다 갱신하는 판정 상태).
// 대부분의 값은 앱을 재시작하면 사라져야 하는 세션 한정 UI/런타임 상태이므로
// (스플래시 전환 여부, 현재 탭/룸, 인터뷰 진행 플래그, CrisisMode, 오라 화면 키 등)
// AsyncStorage persist를 사용하지 않는다. 단, privacyLevel(§8 프라이버시 슬라이더)과
// magicMirrorAccepted(§4 FUN-CHA-004 opt-in 여부)만은 재시작 후에도 유지되어야 하므로
// partialize로 그 값들만 persist한다.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GateState } from '../engine/twinResponseEngine';
import type { SigmaAuraScreenKey } from '../engine/auraThemeEngine';
import type { ThemeMode } from '../constants/theme';
import type { ComposedCourse } from '../services/dateRecommendationService';

export type ActiveTab = 'home' | 'chat' | 'history' | 'settings';
export type ActiveChatRoom = 'lover' | 'twin' | 'analyst' | null;

// ─── 연애 DNA v2.1 적응형 인터뷰 진행상태 (Phase 1 — 그릇만 준비, 아직 아무도 읽지/쓰지 않음) ─
// docs/spec/연애_DNA_일치율_공식_v2.1.md §5.3(그리디 선택)/§6(조기종료) — 완료 시점에만
// userStore.psychProfile/Supabase로 커밋되고, 그 전까지는 이 휘발성 세션 슬롯에만
// 임시 보관한다(구현명세서 §5). isGenesisInProgress(제네시스 인터뷰 진행 플래그)는 그대로 두고
// 별도 슬롯으로 분리한다.
export interface InterviewSessionState {
  turnsUsed: number;
  elapsedSeconds: number;
  nextTargetDimension: string | null;
  entropySnapshot: Record<string, number>;
}

// 오라 끄기(§8 FUN-SET-001B)는 privacyLevel과 별도 AsyncStorage 키('twin_aura_settings_v1')로
// 유지해야 해서, zustand persist의 partialize(단일 스토리지 키)로는 표현할 수 없다.
// 그래서 이 필드만 아래 setReduceAuraMotion 액션에서 직접 read/write하고, 모듈 로드 시
// 한 번 하이드레이션한다 — privacyLevel의 persist 파이프라인과는 별개로 동작한다.
const AURA_SETTINGS_KEY = 'twin_aura_settings_v1';

export interface SessionState {
  isAppReady: boolean; // 스플래시 → 앱 전환 완료 여부
  activeTab: ActiveTab;
  activeChatRoom: ActiveChatRoom;
  isGenesisInProgress: boolean; // 제네시스 인터뷰 진행 중
  /** 연애 DNA v2.1 적응형 인터뷰 진행상태 — Phase 3 전까지는 아무도 읽거나 쓰지 않는 미사용 슬롯 */
  interviewSession: InterviewSessionState;
  isCrisisMode: boolean; // CrisisMode(FUN-CHA-003) 활성 여부
  crisisModeTriggeredAt: number | null; // timestamp ms
  gateState: GateState | null; // twinResponseEngine 판정 상태
  // 화면별 오라 강도 라우팅용 — STEP 11-1의 SigmaAuraScreenKey('mainHero'|'chatList'|
  // 'chatRoom'|'historyMap'|'helix'|'settings'|'other') 어휘를 그대로 쓴다. sigma
  // 전용 오라 opacity/freeze 체계를 위한 값이지만, 추적 자체는 기존과 동일하게
  // themeMode와 무관하게 항상 이루어진다(가벼운 네비게이션 북마크라 무해함).
  currentAuraScreenKey: SigmaAuraScreenKey;
  themeMode: ThemeMode; // 화면 테마 설정(설정 탭 §8 FUN-SET-001B)
  privacyLevel: 0 | 1 | 2; // AI 학습 범위(설정 탭 §8 프라이버시 슬라이더) — 0=보호 1=최적화 2=완전복제
  reduceAuraMotion: boolean; // 오라 줄이기/끄기(§8 FUN-SET-001B) — true면 정적 무채색 폴백
  isEarlyDatingMode: boolean; // 연애 초기 모드(§4 채팅 탭) — true면 트윈 AI가 조심스럽고 설레는 초기 연애 톤으로 응답
  magicMirrorAccepted: boolean; // Magic Mirror(§4 FUN-CHA-004) opt-in 수락 여부 — 트윈방 최초 진입 1회 안내 게이팅
  pendingChatMessage: string | null; // MasterQuestionModal "채팅에서 답하기" → chat.tsx 마운트 시 인풋에 미리 채워넣을 질문
  overflowBannerDismissedDate: string | null; // OverflowBanner 닫기 상태 — 탭 이동/언마운트에도 유지되도록 스토어에 저장
  /** Phase 3 — FEATURE_DNA_V21 개발자 런타임 재정의(설정 탭 개발자 메뉴). null이면 env 기본값(false)을 따른다. */
  devFeatureDnaV21Override: boolean | null;
  /** FEATURE_AI_DATE_RECOMMEND(§7 FUN-HIS-002/006/007) 개발자 런타임 재정의. null이면 env 기본값(false)을 따른다. */
  devFeatureAiDateRecommendOverride: boolean | null;
  /** date-recommend-setup → date-recommend-result 전달용 — router.replace 전에 여기 담고, result 화면 마운트 시
   * 읽은 뒤 즉시 비운다(pendingChatMessage와 동일 패턴). URL 파라미터로는 후보 배열(좌표/점수/근거 포함)이
   * 너무 커서 직렬화하기 부적합해 이 방식을 택했다. */
  pendingDateRecommendResult: ComposedCourse[] | null;
  /** map 탭 FAB "📷 사진으로 코스 추가"를 setup 화면의 "스탬프 부족" 안내에서도 유도하기 위한 신호 —
   * true로 설정 후 router.back()하면 history.tsx가 포커스 시 OOTD 업로드 시트를 자동으로 열고 즉시 false로 되돌린다. */
  pendingOotdUploadTrigger: boolean;
}

export interface SessionActions {
  setAppReady: (ready: boolean) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setActiveChatRoom: (room: ActiveChatRoom) => void;
  setGenesisInProgress: (inProgress: boolean) => void;
  /** 지정한 필드만 병합 갱신(부분 업데이트) */
  setInterviewSession: (update: Partial<InterviewSessionState>) => void;
  resetInterviewSession: () => void;
  /** true로 설정 시 crisisModeTriggeredAt도 Date.now()로 함께 기록 */
  setCrisisMode: (active: boolean) => void;
  setGateState: (state: GateState | null) => void;
  setAuraScreenKey: (key: SigmaAuraScreenKey) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setPrivacyLevel: (level: 0 | 1 | 2) => void;
  setReduceAuraMotion: (reduce: boolean) => void;
  setEarlyDatingMode: (value: boolean) => void;
  setMagicMirrorAccepted: (value: boolean) => void;
  setPendingChatMessage: (msg: string | null) => void;
  setOverflowBannerDismissedDate: (date: string | null) => void;
  setDevFeatureDnaV21Override: (value: boolean | null) => void;
  setDevFeatureAiDateRecommendOverride: (value: boolean | null) => void;
  setPendingDateRecommendResult: (result: ComposedCourse[] | null) => void;
  setPendingOotdUploadTrigger: (value: boolean) => void;
  reset: () => void;
}

const INITIAL_INTERVIEW_SESSION: InterviewSessionState = {
  turnsUsed: 0,
  elapsedSeconds: 0,
  nextTargetDimension: null,
  entropySnapshot: {},
};

const initialState: SessionState = {
  isAppReady: false,
  activeTab: 'home',
  activeChatRoom: null,
  isGenesisInProgress: false,
  interviewSession: INITIAL_INTERVIEW_SESSION,
  isCrisisMode: false,
  crisisModeTriggeredAt: null,
  gateState: null,
  currentAuraScreenKey: 'other',
  themeMode: 'dark',
  privacyLevel: 1,
  reduceAuraMotion: false,
  isEarlyDatingMode: false,
  magicMirrorAccepted: false,
  pendingChatMessage: null,
  overflowBannerDismissedDate: null,
  devFeatureDnaV21Override: null,
  devFeatureAiDateRecommendOverride: null,
  pendingDateRecommendResult: null,
  pendingOotdUploadTrigger: false,
};

export const useSessionStore = create<SessionState & SessionActions>()(
  persist(
    (set) => ({
      ...initialState,
      setAppReady: (ready) => set({ isAppReady: ready }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setActiveChatRoom: (room) => set({ activeChatRoom: room }),
      setGenesisInProgress: (inProgress) => set({ isGenesisInProgress: inProgress }),
      setInterviewSession: (update) =>
        set((state) => ({ interviewSession: { ...state.interviewSession, ...update } })),
      resetInterviewSession: () => set({ interviewSession: INITIAL_INTERVIEW_SESSION }),
      setCrisisMode: (active) =>
        set((state) => ({
          isCrisisMode: active,
          crisisModeTriggeredAt: active ? Date.now() : state.crisisModeTriggeredAt,
        })),
      setGateState: (state) => set({ gateState: state }),
      setAuraScreenKey: (key) => set({ currentAuraScreenKey: key }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setPrivacyLevel: (privacyLevel) => set({ privacyLevel }),
      setReduceAuraMotion: (reduceAuraMotion) => {
        set({ reduceAuraMotion });
        AsyncStorage.setItem(AURA_SETTINGS_KEY, JSON.stringify(reduceAuraMotion)).catch(() => {});
      },
      setEarlyDatingMode: (isEarlyDatingMode) => set({ isEarlyDatingMode }),
      setMagicMirrorAccepted: (magicMirrorAccepted) => set({ magicMirrorAccepted }),
      setPendingChatMessage: (pendingChatMessage) => set({ pendingChatMessage }),
      setOverflowBannerDismissedDate: (overflowBannerDismissedDate) => set({ overflowBannerDismissedDate }),
      setDevFeatureDnaV21Override: (devFeatureDnaV21Override) => set({ devFeatureDnaV21Override }),
      setDevFeatureAiDateRecommendOverride: (devFeatureAiDateRecommendOverride) =>
        set({ devFeatureAiDateRecommendOverride }),
      setPendingDateRecommendResult: (pendingDateRecommendResult) => set({ pendingDateRecommendResult }),
      setPendingOotdUploadTrigger: (pendingOotdUploadTrigger) => set({ pendingOotdUploadTrigger }),
      reset: () => {
        set({ ...initialState });
        AsyncStorage.removeItem(AURA_SETTINGS_KEY).catch(() => {});
      },
    }),
    {
      name: 'twin_session_privacy_v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ privacyLevel: state.privacyLevel, magicMirrorAccepted: state.magicMirrorAccepted }),
    },
  ),
);

// reduceAuraMotion 하이드레이션 — 독립 스토리지 키라 persist의 merge 대상이 아니므로 직접 읽는다.
AsyncStorage.getItem(AURA_SETTINGS_KEY)
  .then((raw) => {
    if (raw !== null) {
      useSessionStore.setState({ reduceAuraMotion: JSON.parse(raw) as boolean });
    }
  })
  .catch(() => {});
