# Phase 3 작업 중단 — 재시작 현황 (2026-07-15)

이 문서는 세션 중단 시점의 맥락을 그대로 남긴 것이다. 다음 세션에서 이 문서를 먼저 읽고 이어서 진행할 것.

## 지금 어디까지 왔나

**원 지시**: 사용자가 Phase 3(기능 플래그 전환 — genesis.tsx 등 기존 화면을 처음 건드리는 단계) 전체 스펙을 지시했고, 그 안에 "착수 전 필수 조사 — genesisBlending.ts(computePersonaBlend) 어댑터 필요 여부, 결정하지 말고 조사만" 이라는 게이트가 있었다.

**진행 순서**:
1. 조사 완료 (Explore 에이전트 2개 병렬) → genesisBlending 경계 조사 결과 사용자에게 보고 → 승인받음
2. 추가 조사 완료 (Explore 에이전트 3개 병렬) → genesis.tsx/InterviewCallModal/scoreCalculator/sessionStore/questionBank 전체 코드, Phase 0 금지목록, 테스트 인프라, computeRomanticDNA/coupleStore 전체 조사
3. 조사 결과 3가지 설계 결정을 AskUserQuestion으로 확인받음 (아래 "확정된 설계 결정" 참조)
4. 구현 착수 — TaskList #11~#22로 12개 작업 분해, 현재 #11~#13 완료, #14(RLS 마이그레이션) 작업 도중 사용자가 중단 요청

## 확정된 설계 결정 (다시 묻지 말 것)

1. **genesisBlending 어댑터**: Phase 3 범위에 포함. 순수함수 `enneagramCoreToTopType()` 하나로 충분 — `genesisBlending.ts`/`twinResponseEngine.ts` 자체는 편집하지 않고 import만 한다. **완료**(`src/lib/interview/personaAdapter.ts`).
2. **genesis.tsx 구조**: 완전히 분리된 렌더 경로(얼리 리턴). 컴포넌트 최상단에서 `useFeatureDnaV21()` 확인 후 ON이면 `<GenesisV21Screen/>`으로 바로 리턴, OFF면 기존 `useGenesisInterview` 기반 로직이 그대로(무수정) 실행. **아직 미착수**(Task #19, #20).
3. **computeRomanticDnaV21(파트너 프로필 조회)**: Phase 3에 포함. `user_psych_profiles` RLS에 커플 상대방 SELECT 허용 정책 추가 + 파트너 fetch 서비스 함수까지 이번에 만든다. **RLS 마이그레이션 작성 도중 중단**(Task #14).
4. **회귀 테스트 방식**: 로직 레벨 검증(Phase 1 방식) — RN 컴포넌트 스냅샷/E2E 인프라는 새로 구축하지 않는다. tsc+jest 전체 통과 + `git diff`로 기존 라인 무삭제 확인하는 방식.

## 완료된 작업 (git status 기준 — 커밋 안 됨, 전부 워킹트리에 있음)

- `M app/(tabs)/settings.tsx` — `__DEV__` 블록에 `FEATURE_DNA_V21` 런타임 토글 버튼 추가(기존 DB 연결 검증 버튼 옆), `devFeatureDnaV21Override`/`setDevFeatureDnaV21Override`/`envFeatureDnaV21Default` 훅 추가
- `M src/store/sessionStore.ts` — `devFeatureDnaV21Override: boolean | null` 필드 + `setDevFeatureDnaV21Override` 액션 추가(append only, 기존 라인 무수정 확인됨)
- `A src/config/featureFlags.ts` — `useFeatureDnaV21()` 훅 신규(env 기본값 false + dev override 우선)
- `A src/lib/interview/personaAdapter.ts` — `enneagramCoreToTopType(p: number[]) → {type, confidence}` 신규. **중요 규약**: enneagramCore 배열 index i(0-based) ↔ EnneagramType/EnneagramCoreId `i+1`. 이 규약은 기존 테스트(`adaptiveEngine.test.ts`의 `toOrderedArray` 헬퍼, `ENNEAGRAM_TYPE_IDS` 순서)와 일치함을 확인했다.
- `A src/lib/interview/__tests__/personaAdapter.test.ts` — 5개 테스트 전부 통과 확인(`npx jest` 실행 완료)
- `A src/lib/matching/psychProfileAdapter.ts` — `psychProfileToPersonProfileV21(profile: PsychProfile) → PersonProfileV21` 신규. `enneagramCore`(배열)→`Record<EnneagramCoreId,number>`, `wingMarginal` 재계산(`wingMarginal()` 재사용), `sternbergState` null→중립값(0.5,0.5,0.5) 폴백, `mbtiEstimate`는 `reestimateMbtiAxes(big5)`로 매번 재계산(궁합 계산 미관여 필드라 안전).
- `A src/lib/matching/__tests__/psychProfileAdapter.test.ts` — `computeRomanticDNA.test.ts`의 §14 골든 테스트 값(DNA%=83.4 등)을 재사용한 라운드트립 검증 포함, 3개 테스트 전부 통과 확인.

## Task #14(RLS 마이그레이션) — 다음에 바로 이어서 할 것

**조사 완료, 아직 파일 미작성.** 스키마 확인 결과:
- `couples` 테이블(`20260711000000_initial_schema.sql`): `id`, `invite_code`, `creator_id`(auth.users FK), `partner_id`(auth.users FK, nullable), `connected_at`, `created_at`
- `user_psych_profiles` 테이블(`20260715120000_user_psych_profiles.sql`)의 기존 RLS: `"본인 프로파일만 조회"` — `FOR SELECT USING (auth.uid() = user_id)` 하나뿐. **이 정책은 건드리지 않는다** — PostgreSQL의 permissive RLS는 여러 SELECT 정책이 OR로 합쳐지므로, 새 정책을 추가만 하면 됨.

**다음에 만들 파일**: `supabase/migrations/20260716000000_user_psych_profiles_partner_select.sql` (타임스탬프는 실행 시점 기준으로 조정)
```sql
CREATE POLICY "커플 상대방 프로파일 조회" ON user_psych_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM couples c
      WHERE (c.creator_id = auth.uid() AND c.partner_id = user_psych_profiles.user_id)
         OR (c.partner_id = auth.uid() AND c.creator_id = user_psych_profiles.user_id)
    )
  );
```
이 SQL은 이미 위 investigation에서 검증된 형태이니 그대로 새 마이그레이션 파일에 옮기면 된다. **주의**: 이 마이그레이션은 로컬 파일 생성만으로 끝나지 않는다 — 실제 원격 Supabase 프로젝트(`xcngcuenlpmnraythdjn`)에 적용(`supabase db push` 또는 대시보드)하려면 다시 `SUPABASE_ACCESS_TOKEN`이 필요하다(Phase 2 실통화 검증 때처럼). 이번 세션에서 이미 겪었던 토큰 형식 문제(`sbp_`로 시작해야 함)와 채팅에 값 노출 금지 원칙을 기억할 것.

## 아직 손도 안 댄 작업 (Task #15~#22)

| # | 작업 | 핵심 메모 |
|---|---|---|
| 15 | `src/services/psychProfileService.ts` 신규 | `upsertMyPsychProfile`, `getPartnerPsychProfile`, `logInterviewTurn`(interview_sessions insert). `coupleService.ts` 패턴 참고(`supabase.from(...).select/insert/update`). `getPartnerPsychProfile`은 Task #14 RLS 정책이 실제 배포돼야 동작 |
| 16 | `scoreCalculator.ts`에 `computeDnaNationalPercentile` 추가 | **중요**: `src/lib/matching/constants.ts`에 이미 `K_SCALE = 25/2.5758 ≈ 9.7056`, `DNA_PCT_CENTER = 75` 상수가 정의돼 있음(Phase 0/1에서 만듦) — 사용자가 말한 "Φ((dnaPct−75)/9.7056)" 그대로. 매직넘버로 하드코딩하지 말고 이 상수 import해서 재사용할 것. `scoreCalculator.ts`는 append-only 대상 파일(Phase 0 금지 12종 중 하나) — 기존 `computeNationalPercentile`은 그대로 두고 옆에 새 함수만 추가 |
| 17 | `src/hooks/useAdaptiveInterview.ts` 신규 | `adaptiveEngine.ts`(`computeUncertainty`/`selectNextQuestion`/`checkEarlyStop`/`estimateTimeCost`, 전부 순수함수, 그대로 갖다 쓸 수 있음 확인됨), `questionBank.ts`(`QUESTION_BANK` 등), `adaptive-interview` Edge Function(`supabase.functions.invoke('adaptive-interview', {action:'generate'|'parse',...})`) 호출. `sessionStore.interviewSession`(`turnsUsed`/`elapsedSeconds`/`nextTargetDimension`/`entropySnapshot`, 이미 존재하는 필드라 그대로 씀)과 `setInterviewSession`/`resetInterviewSession` 액션 재사용. 매 턴 `interview_sessions` insert(Task #15의 `logInterviewTurn` 사용). 완료 시 `userStore.setPsychProfile()` 호출(기존 액션, 이미 존재). `isGenerating` 로딩 상태 노출 |
| 18 | `InterviewCallModal.tsx`에 `mode`/`isGenerating` prop 추가 | append-only 대상 파일. `mode?: 'act'\|'progress'`(기본 `'act'`, 생략 시 기존과 100% 동일 동작), `mode==='progress'`일 때 71번째 줄 근처의 `{act}막 진행 중` 텍스트 대신 턴/시간 진행률 표시하는 새 조건부 블록 추가. 기존 `'act'` 렌더링 라인은 절대 수정하지 않음 |
| 19 | `GenesisV21Screen` 컴포넌트 신규 | `src/components/GenesisV21Screen.tsx`(app/ 라우트 디렉터리 아님 — expo-router가 자동으로 라우트 등록하지 않도록 주의). `useAdaptiveInterview` 사용, 카피 "최대 5분, 대부분 3~4분"(v2.1 §6), 완료 시: (a) `personaAdapter.enneagramCoreToTopType` + 기존 `computePersonaBlend`(import만, genesisBlending.ts 무편집) → `setPersonaMatrix`, (b) `psychProfileAdapter.psychProfileToPersonProfileV21` + `isPartnerConnected`면 Task #15의 `getPartnerPsychProfile`로 상대방 프로필 조회 시도 → 성공 시 `computeRomanticDnaV21` → `setDnaResult`(coupleStore, 기존 액션), 실패/미연결 시 기존 "파트너 미연결" 패턴처럼 `dnaResult`는 null 유지, (c) `sBase` 산출: `dnaResult` 있으면 `dnaPct` 기반(Task #16 함수 활용), 없으면 OFF 경로와 동일하게 `generateBaseScore(getMBTICompatibilityGrade(mbti,mbti),'AVERAGE')`로 폴백 |
| 20 | `genesis.tsx` 최상단에 플래그 분기 1줄 추가 | `export default function Genesis() {` 바로 다음 줄에 `const dnaV21 = useFeatureDnaV21(); if (dnaV21) return <GenesisV21Screen />;` 추가하는 것만. 그 아래 기존 코드(현재 `const router = useRouter();`부터 끝까지) **완전히 무수정** — 이게 "바이트 단위 동일" 요구사항을 지키는 핵심 지점 |
| 21 | 통합테스트 | `adaptive-interview` mock으로 인터뷰 시작→5턴~조기종료→psychProfile 커밋→dnaResult 계산까지 체인 1회 이상 통과 |
| 22 | 최종 검증 + 보고서 | `git diff -- <금지 12종 파일들> \| grep -E '^-[^-]'`로 삭제/수정된 줄이 없는지 확인(추가만 있어야 함), `npx tsc --noEmit`, `npx jest` 전체 통과, `docs/spec/Phase3_완료보고.md` 작성 |

## 재시작 시 반드시 다시 읽어야 할 참고 자료

- `docs/spec/연애_DNA_일치율_공식_v2.1.md` (전체, 특히 §6 인터뷰 시간 카피)
- `docs/spec/Twin.me_연애DNA_구현명세서.md` §5, §8
- `docs/spec/Phase2_완료보고.md` (adaptive-interview Edge Function 실통화 검증 결과 — 레이턴시/실패율 수치, `useAdaptiveInterview` 설계 시 참고)
- 이번 세션에서 확인한 **Phase 0 금지 12종**: `src/engine/genesisInference.ts`, `src/types/genesis.ts`, `src/engine/genesisBlending.ts`, `src/hooks/useGenesisInterview.ts`, `app/(auth)/genesis.tsx`, `src/data/genesisQuestionBank.ts`, `src/components/InterviewCallModal.tsx`, `src/engine/scoreCalculator.ts`, `src/store/userStore.ts`, `src/store/coupleStore.ts`, `src/store/scoreStore.ts`, `src/store/sessionStore.ts`(뒤 4개는 추가만 허용) + 별도로 `supabase/functions/llm-route/index.ts`. 이 목록은 저장소 어디에도 한 곳에 정리돼 있지 않고 `docs/spec/폐기_수정_항목_감사표.md`의 "현재 위치" 컬럼을 취합해 역산한 것 — 재확인하고 싶으면 그 문서를 다시 보면 됨.
- `PersonProfileV21`/`InterviewResponses`/`EnneagramCoreId`(숫자 1~9) 타입은 `src/lib/matching/computeRomanticDNA.ts`와 `src/lib/matching/constants.ts`에, `EnneagramType`(문자열 '1'~'9')은 `src/types/genesis.ts`에 — **두 타입이 이름은 비슷해도 숫자/문자열로 다르다는 것에 주의**(어댑터 두 개가 이미 이 차이를 각각 올바르게 처리하고 있음, 재작성 시 실수하지 말 것).

## 미해결 리스크/주의사항

- Task #19 `GenesisV21Screen`이 `useUserStore`/`useCoupleStore`의 기존 액션(`setPersonaMatrix`, `setPsychProfile`, `setDnaResult`, `completeOnboarding`, `setLastGenesisAt`)을 호출하는 것은 "편집"이 아니라 "사용"이므로 append-only 규칙과 무관하다 — 새 파일에서 자유롭게 써도 된다.
- 파트너 미연결 시 UI 패턴은 `PartnerStatusBar.tsx`(`!isPartnerConnected → 초대 유도 카드`)를 참고하라고 이미 조사에서 확인함.
- 회귀 검증(Task #22)에서 `git diff | grep '^-[^-]'`가 비어있어야 한다는 게 "바이트 단위 동일"의 실질적 증빙 방법이라고 사용자에게 제안한 적은 없음 — 내가 정한 검증 방법이니, 최종 보고 시 이 방법론 자체도 같이 설명할 것.
