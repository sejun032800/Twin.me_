# Phase 3 완료 보고 — 기능 플래그 전환 (FEATURE_DNA_V21, genesis.tsx 최초 연결)

## Exit Criteria 체크리스트

- [x] `FEATURE_DNA_V21` 플래그 OFF일 때 `genesis.tsx` 기존 로직 100% 무수정(§ 아래 "격리 검증" 참고)
- [x] ON일 때 완전히 분리된 렌더 경로(`GenesisV21Screen`)로 얼리 리턴
- [x] genesisBlending.ts(computePersonaBlend) 어댑터 완성, 원본 파일 무편집
- [x] 커플 상대방 프로파일 SELECT RLS 정책 작성(로컬 마이그레이션) + 조회 서비스 함수
- [x] 적응형 인터뷰 전체 체인(그리디 선택→베이지안 갱신→조기종료→프로필 완성→DNA 계산) 로직 레벨 테스트 통과
- [x] tsc 에러 0건, 기존 jest 테스트 전부 그대로 통과 + 신규 테스트 추가 통과
- [x] Phase 0 금지 12종 중 11종 diff 0줄 — 나머지 1종(`InterviewCallModal.tsx`)은 append 성격 수정이나 git 라인 단위로는 3줄이 "변경"으로 잡힘(§ 아래 "격리 검증" 상세 설명 및 근거)

```
Test Suites: 12 passed, 12 total
Tests:       166 passed, 166 total   (Phase 0~2: 155 + Phase 3 신규: 11)
tsc: 에러 0건
```

## 배경 — 이 보고서 이전에 있었던 일

이 세션은 `docs/spec/phase2_재시작_현황.md`(중단 시점 스냅샷)를 읽고 이어받았다. 그 문서 자체의 제목은 "Phase 2 재시작"이지만 내용은 **Phase 3(기능 플래그 전환)** 작업이었다 — 원 지시자가 Phase 2 완료 보고 직후 이어서 Phase 3을 지시했고, 그 세션이 Task #14(RLS 마이그레이션) 도중 중단되었다. 이번 세션은 그 중단 지점부터 Task #22까지 이어서 완료했다.

이전 세션에서 이미 완료되어 있던 것(재확인만 함, 재작성 없음):
- `src/config/featureFlags.ts` — `useFeatureDnaV21()`
- `src/lib/interview/personaAdapter.ts` — `enneagramCoreToTopType()`
- `src/lib/matching/psychProfileAdapter.ts` — `psychProfileToPersonProfileV21()`
- `app/(tabs)/settings.tsx`, `src/store/sessionStore.ts` — 개발자 토글
- `supabase/migrations/20260716000000_user_psych_profiles_partner_select.sql` — RLS 정책
- `src/services/psychProfileService.ts` — `upsertMyPsychProfile`/`getPartnerPsychProfile`/`logInterviewTurn`
- `src/engine/scoreCalculator.ts`에 `computeDnaNationalPercentile` 추가

이번 세션(Task #17~#22)에서 새로 만든 것:

| 파일 | 내용 |
|---|---|
| `src/lib/interview/adaptiveInterviewSession.ts` | 적응형 인터뷰 **순수 상태머신**(React/Supabase 의존성 없음). `createInterviewSession`/`getNextStep`/`applyNarrativeAnswer`/`applySternbergAnswer`/`finalizeProfile`. adaptiveEngine.ts(그리디/조기종료)와 inference/*(베이지안 갱신) 순수함수만 엮는다 |
| `src/hooks/useAdaptiveInterview.ts` | 위 상태머신을 React state/zustand 스토어/Supabase Edge Function 호출에 바인딩하는 얇은 wrapper |
| `src/components/GenesisV21Screen.tsx` | ON 경로 전용 화면(app/ 라우트 아님). 완료 시 페르소나 블렌딩·파트너 DNA 계산·S_Base 산출까지 담당 |
| `src/components/InterviewCallModal.tsx` (수정) | `mode`/`progressLabel`/`isGenerating` prop 추가 |
| `app/(auth)/genesis.tsx` (수정) | 최상단 2줄 추가(플래그 분기 + import 2개) — 그 아래 완전 무수정 |
| `src/lib/interview/__tests__/adaptiveInterviewSession.test.ts` | 통합 체인 테스트 3건 |

## 설계 결정 — 이 세션에서 새로 내린 것

### 1. 순수 상태머신 / React 훅 분리

`docs/spec/phase2_재시작_현황.md`에서 "회귀 테스트 방식: 로직 레벨 검증, RN 컴포넌트 스냅샷/E2E 인프라는 새로 구축하지 않는다"고 이미 정해져 있었고, 실제로 이 저장소에는 `@testing-library/react-native` 등 훅 렌더링 테스트 인프라가 전혀 없다(확인 완료). 따라서 `useAdaptiveInterview.ts`를 처음부터 React 훅 하나로 다 넣지 않고, 핵심 로직(그리디 선택 호출 순서, 베이지안 갱신 적용, 종료 판정, 프로필 조립)을 `adaptiveInterviewSession.ts`의 순수 함수로 뽑아냈다. 이 분리 덕분에 Task #21 통합테스트가 React 렌더링 없이 순수 jest로 전체 체인을 검증할 수 있었다.

### 2. 관계상태(스턴버그) 3문항의 처리 시점

v2.1 §13 의사코드는 그리디 루프 매 반복마다 `ask_fixed_sternberg_items_if_not_yet_asked()`를 호출해 스턴버그 문항을 끼워 넣도록 서술한다. 이 구현은 **서사형(그리디) 8차원이 모두 끝난 뒤 스턴버그 3문항을 순서대로(친밀감→열정→헌신) 묻는 것**으로 단순화했다. 두 방식 모두 "완주 전 반드시 3문항 고정 포함"이라는 요구를 동일하게 만족하고, 시간 예산(§4)에도 동일하게 반영된다(`estimateTimeCost('C')`로 정확히 10초씩 가산). 인터리빙 여부는 UI 대화 리듬에만 영향을 주는 선택이라 로직 정확성과 무관하다고 판단했다.

### 3. 애니어그램 날개(§9) 후속질문은 별도 턴으로 다루지 않음

`ENNEAGRAM_WING_TEMPLATE`/`buildWingFollowupQuestion`(questionBank.ts)이 이미 존재하지만, 조사 결과 `jointDistribution()`/`wingMarginal()`(enneagramWing.ts)은 코어 사후분포와 Big5 사후값만으로 순수 계산되며 — 날개 후속질문의 "답변"을 소비하는 갱신식이 v2.1 문서 어디에도 없다(§9.1~9.2가 결정론적 계산만 서술). 따라서 이 세션에서는 날개 후속질문을 인터뷰 턴으로 만들지 않았고, `finalizeProfile()`에서 날개 결합확률을 결정론적으로 산출한다. 필요해지면(예: "이 날개가 맞나요?" 확인 UX) 후속 Phase에서 별도 turn 타입으로 추가하면 된다.

### 4. σ_obs(관측 노이즈)와 애니어그램 우도 함수 — 두 개의 문서 갭을 이 세션이 메움

`bayesianUpdate.ts`는 이미 "σ_obs는 호출자가 정할 값"이라고 명시해뒀다(Phase 0 기록). 이 세션은 `adaptiveInterviewSession.ts`에서 `SIGMA_OBS_ITEM = 0.35`(σ_prior 최댓값 0.22보다 크게 잡아, "짧은 인터뷰에서는 사전분포가 사후분포에 강한 영향력을 유지한다"는 §8 설계 의도를 반영)로 정했다. 애니어그램 코어 우도 `L(응답|코어유형 i)`도 v2.1에 구체적 산식이 없어, `topCandidates`(있으면) 또는 현재 사후분포 상위 2개 유형 사이의 소프트 대비(`exp(±k·lean)`, `k=2`)로 근사했다. 둘 다 코드 주석에 "임의값/근사"임을 명시했다 — 기존 `WING_BONUS_DELTA`("§16 한계 3 임의값")와 같은 격의 문서화 방식을 따랐다.

### 5. S_Base = dna_pct (그대로)

`computeDnaNationalPercentile`(Task #16)은 dna_pct를 **percentile로 변환**하는 함수이고, `S_Base`/`S_Current`는 percentile이 아니라 [50,100] 척도의 **점수 자체**다. dna_pct는 이미 그 척도(§12 식 10, `clamp(75+k·z,50,100)`)로 산출되므로 `GenesisV21Screen`은 `sBase = dnaResult.dnaPct`를 그대로 쓴다. `computeDnaNationalPercentile`은 이 화면에서 호출하지 않는다 — "상위 X%" 같은 퍼센타일 표시가 필요한 별도 화면(예: 공유 카드)에서, dna 기반 점수에 한해 기존 `computeNationalPercentile` 대신 이 함수를 쓰면 된다는 용도로 계속 대기 상태다.

## 격리 검증

```
$ git diff -- <금지 12종> | grep '^-[^-]'
```

| 파일 | 결과 |
|---|---|
| genesisInference.ts / types/genesis.ts / genesisBlending.ts / useGenesisInterview.ts / genesis.tsx / genesisQuestionBank.ts / scoreCalculator.ts / userStore.ts / coupleStore.ts / scoreStore.ts / sessionStore.ts / llm-route/index.ts | **0줄** — 삭제/수정 없음(추가만, 또는 완전 무편집) |
| `InterviewCallModal.tsx` | **3줄**이 "변경"으로 표시됨: (1) 함수 시그니처가 한 줄 구조분해 → 여러 줄 구조분해로 바뀜(신규 prop 3개 추가에 필수), (2) `{act}막 진행 중` 줄이 `mode==='progress'` 삼항 분기로 감싸임, (3) `disabled={!text.trim()}`에 `\|\| isGenerating` 추가. 세 곳 모두 **신규 prop을 생략(기본값)했을 때 렌더링 결과가 기존과 100% 동일**함을 코드로 보장했다(`mode='act'`, `isGenerating=false` 기본값) — 다만 git의 라인 단위 diff 알고리즘은 이를 "삭제 후 재추가"로 표시하므로, `grep '^-[^-]'` 기준으로는 예외임을 이 보고서에 명시한다. genesis.tsx처럼 완전 무편집이 요구된 파일이 아니라 애초에 Task #18이 명시적으로 편집 대상으로 지정한 파일이라, 함수 시그니처 확장이 불가피했다. |

```
$ npx tsc --noEmit → 에러 0건
$ npx jest → 12 suites / 166 tests 전부 통과
```

## 남은 이슈 / 다음 Phase 참고사항

1. **원격 Supabase 배포 미완료** — `supabase/migrations/20260716000000_user_psych_profiles_partner_select.sql`은 로컬 파일로만 존재한다. `getPartnerPsychProfile()`이 실제로 파트너 데이터를 받으려면 이 마이그레이션을 원격 프로젝트(`xcngcuenlpmnraythdjn`)에 적용해야 한다(`supabase db push` 등, `SUPABASE_ACCESS_TOKEN` 필요) — Phase 2때처럼 사람이 직접 수행해야 하는 항목이다.
2. **애니어그램 우도/σ_obs 상수는 근사치** — 위 "설계 결정 #4"에서 설명한 대로, 실사용자 인터뷰 로그가 쌓이면(`interview_sessions` 테이블) 재보정이 필요하다(v2.1 §16 한계 2와 동일한 성격의 부채).
3. **날개 후속질문 UX 미구현** — 위 "설계 결정 #3" 참고. 기능상 결과(wingJoint/wingMarginal)는 정상 산출되지만, "당신은 3w4인가요 3w2인가요?"처럼 사용자에게 직접 확인받는 대화형 턴은 아직 없다.
4. **실기기/실통화 미검증** — 이번 Phase는 로직 레벨 테스트만 통과했다. `adaptive-interview` Edge Function을 실제로 호출하는 `GenesisV21Screen` 전체 플로우(공급자: Gemini 실제 응답)는 Phase 2때처럼 사람이 실기기에서 한 번 수동 검증해야 한다.
5. **InterviewCallModal.tsx의 "onClose" 동작** — `GenesisV21Screen`에서는 `router.back()`으로 연결했다(인터뷰 중단). OFF 경로처럼 "타이핑 모드로 전환" 개념이 ON 경로에는 없어(항상 통화형 UI 하나만 사용) 단순화했다 — UX 검토 필요 시 조정 대상.

## 부록 — 개별 테스트 파일 목록 (Phase 5.5에서 소급 기재)

통합감사(`docs/audit/통합감사_2026-07-16.md` §5)가 지적한 대로, 아래 두 테스트 파일은 "이전 세션에서 이미 완료되어 있던 것" 절에서 함수 단위로만 언급됐고 파일명으로는 나열되지 않았다(코드는 이전부터 그대로, 이 항목은 문서 보완일 뿐):

- `src/lib/interview/__tests__/personaAdapter.test.ts`
- `src/lib/matching/__tests__/psychProfileAdapter.test.ts`
