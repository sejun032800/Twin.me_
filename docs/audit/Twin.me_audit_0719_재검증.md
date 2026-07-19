# Twin.me 감사 재검증 — 2026.07.19 (구현 착수 전 사전 조사)

> **기준 문서:** `docs/Twin_me_MASTER_v2.7.md`, `docs/audit/Twin.me_audit_0719.md`
> **방법:** 감사 파일(`Twin.me_audit_0719.md`)의 모든 항목을 `grep`/파일 열람으로 코드베이스와 직접 재대조. 감사 파일 작성 시점 이후 회귀·해결·신규 발견 여부를 함께 기록.
> **스코프 제외 (이번 재검증·계획 대상에서 완전히 제외, 코드는 읽되 판단·계획 없음):**
> - AI 데이트코스 추천 기능 전체 (카카오맵 SDK 연동, 지도 핀+연결선 시각화, `dateRecommendation` 서비스/모달, `FEATURE_AI_DATE_RECOMMEND` 관련 전체)
> - 오라 시스템(6 Sigma 테마) 전체 (Sigma 테마 온보딩 화면, `auraEngine`/`auraThemeEngine` 관련 전체)
>
> 각각 별도 세션에서 단독 진행 예정.

---

## 1. 재검증 결과표

| 우선 | 항목 | 감사 파일 근거 | 재검증 결과 | 세부 |
|---|---|---|---|---|
| P0 | RDCS v2.1 카드 미노출 | `useFeatureDnaV21()` 기본 OFF | **변동 없음 (단, 구현 완성도는 감사 시점보다 높음)** | `src/config/featureFlags.ts`의 `ENV_DEFAULT`는 그대로 `false`. 다만 `GenesisV21Screen.tsx`, `DnaCompatibilityCard.tsx`, `psychProfileService.ts`(Supabase upsert), `dnaResultService.ts`가 이미 실제로 read/write하고 있음을 확인 — `userStore.ts`/`coupleStore.ts`/`sessionStore.ts`의 "Phase 1 그릇만 준비, 아무도 읽지/쓰지 않음" 주석은 **stale**(아래 신규 발견 참고). 즉 플래그만 켜면 거의 동작하는 상태에 가까움. `app/(tabs)/settings.tsx`에 `__DEV__` 전용 토글 존재(프로덕션 빌드엔 노출 안 됨 → 데모 시 env var 전환 필요). |
| P0 | 콜드스타트 온보딩 오탐 (스플래시 레이스컨디션) | `splash.tsx`가 `_hasHydrated` 미대기 | **변동 없음 — 버그 그대로 재현 가능** | `app/(auth)/splash.tsx`의 `navigate()`(22~29행)가 `useUserStore.getState().isOnboardingComplete`만 읽고 `_hasHydrated` 체크 없음. 애니메이션 고정 2.3초 뒤 강제 판정 — 저사양 기기/느린 스토리지에서 재현 가능성 그대로. |
| P0 | Helix 아카이브 — 실 카카오데이터 연동 0% | `HELIX_CARDS` 하드코딩 6개, `MOCK_PLACES_COUNT=4` | **변동 없음** | `app/(tabs)/history.tsx:140,160,261,307-308` 그대로. `hasKakaoData=true`여도 플레이스홀더 카드만 배열에서 빠질 뿐 나머지 6장은 여전히 하드코딩. |
| P0 | Magic Mirror 발신 엔진 자체가 없음 | `MagicMirrorModal.tsx` 134줄, 동의 UI뿐 | **변동 없음** | 파일 여전히 134줄, 동의 UI 전용. 100개당 1회 모니터링/전환율/월 캡 로직 검색 결과 0건. |
| P1→제외 | 카카오맵 SDK 실연동 안 됨 | `history.tsx` 888행 TODO | **제외 (AI 데이트코스 범위)** | 코드 상태는 감사 시점과 동일(TODO 그대로 존재)하나 이번 세션 판단·계획 대상 아님. |
| P1→제외 | AI 데이트코스 지도 핀+연결선 시각화 | `date-recommend-result.tsx` 5행 | **제외 (AI 데이트코스 범위)** | 코드 상태 동일, 이번 세션 대상 아님. |
| P1 | 소셜 로그인 | 코드 전체 카카오/OAuth 0건 | **변동 없음** | `kakao.*login`, `OAuth` 계열 검색 0건(카카오맵/카카오파싱 매치만 존재, 로그인과 무관). |
| P1 | IAP 실기기 결제 미검증 | `iapService.ts` 상단 주석 "1회 실기기 검증 필요" | **부분 해결(상태 호전) — 단, 실기기 미검증 자체는 그대로** | 파일 내부 주석은 "usePremiumGate가 유일한 런타임 import인데 그마저 미사용 죽은 코드"라 되어 있으나 이는 **stale**: 실제로는 `app/_layout.tsx`가 `useVipReconcile()`/`useBillingTracker()`를 마운트마다 호출하고, `settings.tsx:421`이 `purchaseSubscription('coffee')`를 직접 호출함 — 이미 런타임에 라이브로 연결된 상태. "Expo Go에서 sandbox 폴백이 크래시 없이 동작하는지 실기기 1회 검증" 자체는 여전히 미수행. |
| P1→제외 | Sigma 테마 온보딩 유도 화면 없음 | `genesis.tsx`/`invite-hook.tsx` 0건 | **제외 (오라 시스템 범위)** | 참고: `invite-hook.tsx:166`에 "내 오라 색 보기 →" 문구는 존재하나 별도 논의하지 않음. |
| P1 | 주간 리포트 서버 자동발송 스케줄러 없음 | cron/schedule 코드 0건 | **변동 없음** | `weeklyReportService.ts`, `supabase/functions/*` 전체에 cron/schedule 키워드 0건. 온디맨드 생성 함수만 존재. |
| P1 | 포그라운드 알림 인앱 분기 없음 | `useNotifications.ts` 주석 | **변동 없음** | `useNotifications.ts:20-21` "배너는 OS/handler 설정을 따르고 별도 처리는 하지 않는다" 그대로. |
| P2 | Instagram DM 연동 미착수 | 0건 | **변동 없음** | `instagram` 키워드 전체 검색 0건. |
| P2 | console.log 프로덕션 잔존 | `AuraDuskGradient.tsx:92`, `index.tsx:153` | **변동 없음** | 두 줄 모두 그대로 존재. |
| P2 | 라이트 테마 하드코딩 색상 | `settings.tsx` `#FFFFFF` 다수 | **상태 악화(신규 발견 추가)** | `settings.tsx`에 `#FFFFFF` 7곳 그대로. **신규 발견:** `app/(tabs)/_layout.tsx`의 라이트모드 탭바가 `backgroundColor:'#FBF8F3'`, `tabBarActiveTintColor:'#FFA4A4'`, `tabBarInactiveTintColor:'#C0C0C0'`을 직접 하드코딩 — 감사표에 없던 새 위반 지점(§1.7 위반). |
| P2 | 웰컴 화면 카피 톤 차이 | 서술형, 코드 근거 약함 | **변동 없음(판단 보류)** | 카피 톤 문제라 코드로 검증할 성격이 아님 — 그대로 유지. |
| 참고 | DateMapView 잔여과제 서술 낡음 | 마스터=제거됨, 구현보고서=낡음 | **이미 해결됨(회귀 없음)** | `DateMapView`/`HistoryKakaoMapView` 전체 검색 0건. |
| 참고 | 연인방 잠금화면 초대 UX | `chat.tsx` `loverLockScreen` | **이미 해결됨(회귀 없음)** | `chat.tsx:437-465`에 `inviteCode` 기반 CTA 그대로 존재. |
| 참고 | 로그인/가입 빈 입력 비활성화 | `disabled` 조건 | **이미 해결됨(회귀 없음)** | `login.tsx:73`, `signup.tsx:71` 그대로. |
| 참고 | Wrapped 페이월 게이팅 | `usePremiumGate` 기준 | **이미 해결됨(회귀 없음)** | `WrappedModal.tsx`가 `hasReportAccess` 기준 `lockOverlay` 정상 렌더 확인. |
| 참고 | LLM API 키 클라이언트 노출 우려 | `callLLM()`→Edge Function | **이미 해결됨(회귀 없음)** | `src/api/llm.ts`가 `supabase.functions.invoke('llm-route', ...)`만 사용. `EXPO_PUBLIC_ANTHROPIC_API_KEY` 등 클라이언트 노출 키 검색 0건. |
| 신규 | 스토어 주석 stale (Phase 1 미사용 슬롯) | 감사표에 없음 | **신규 발견** | `userStore.ts`/`coupleStore.ts`/`sessionStore.ts`의 `psychProfile`/`dnaResult`/`interviewSession` 주석이 "아무도 읽지/쓰지 않음"이라 되어 있으나 `GenesisV21Screen.tsx`/`DnaCompatibilityCard.tsx`가 실제로 사용 중(플래그 OFF라 기본 경로에서는 도달 불가). 코드 버그는 아니고 주석 정합성 문제. |
| 신규 | Founding VIP 자동전환 로직 | 감사표에 없음(마스터 §9.7 요구) | **확인됨 — 정상 구현** | `vipPromotionService.ts` + `iapService.reconcileFoundingVipExpiry()` + `useVipReconcile()`(앱 런치마다 호출)로 12개월 무료→13개월차 전환 로직 존재. |
| 신규 | PartnerStatusBar/OverflowBanner 분리 | 감사표에 없음(마스터 §3 요구) | **확인됨 — 정상 구현** | 두 컴포넌트로 정확히 분리되어 `app/(tabs)/index.tsx`에 각각 임포트됨. |

---

## 2. 우선순위 재조정 (7/22 투자자 데모 기준)

- **RDCS v2.1 미노출** — P0 유지. 구현체가 이미 대부분 존재해 작업량은 재평가로 오히려 감소("플래그 켜고 스모크 테스트"가 핵심). 투자자가 볼 확률이 가장 높은 항목이라 최우선.
- **스플래시 레이스컨디션** — P0 유지. 수정 비용 매우 낮고, 콜드스타트 재현 시 치명적.
- **Helix 아카이브 하드코딩** — P0였으나, 3일 내 전체 파이프라인 완성 리스크가 커서 **사용자 결정: 이번 세션에서 손대지 않음**(데모 스크립트에서 카톡 업로드 데모 자체를 하지 않는 방향으로 대응, 코드는 별도 세션).
- **Magic Mirror 발신 엔진** — 백그라운드 opt-in 기능이라 데모에서 상호작용으로 보여주기 어려움. **사용자 결정: P1로 하향, 이번 세션 스킵.**
- **소셜 로그인** — Native Module 필요 가능성 높아 사전 확인 필요(§0 하드 제약). **사용자 결정: 이번 범위 제외.**
- IAP 미검증은 이미 라이브 연결된 상태라 무게가 가벼워짐. 색상 하드코딩 항목은 신규 발견분(`_layout.tsx`)이 추가되어 범위가 약간 넓어짐.

---

## 3. 이번 세션 최종 확정 작업 범위

**진행:**
1. 스플래시 레이스컨디션 수정 (`app/(auth)/splash.tsx` — `_hasHydrated` 대기 로직 추가)
2. RDCS v2.1 플래그 활성화 + 스모크 테스트 (`EXPO_PUBLIC_FEATURE_DNA_V21=true` 전환, `GenesisV21Screen`/`DnaCompatibilityCard` 엣지케이스 확인)
3. console.log 제거 (`AuraDuskGradient.tsx:92`, `index.tsx:153`)
4. 색상 하드코딩 토큰화 (`settings.tsx` 7곳, `app/(tabs)/_layout.tsx` 탭바 3곳 → `colors.ts` 토큰)

**손대지 않음 (사용자 확정 결정):**
- Helix 아카이브 실카카오데이터 연동 — 별도 세션
- Magic Mirror 발신 엔진 — P1 하향, 이번엔 스킵
- 소셜 로그인 — 이번 범위 제외
- AI 데이트코스 추천 전체, 오라 시스템(6 Sigma 테마) 전체 — 스코프 제외 유지

**데모 이후로 미룸:** 주간 리포트 스케줄러, 포그라운드 알림 인앱 분기, Instagram DM 연동.

---

*작성 기준일: 2026-07-19*
*원본 감사: `docs/audit/Twin.me_audit_0719.md` / 기준 스펙: `docs/Twin_me_MASTER_v2.7.md`*
