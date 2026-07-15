# Phase 1 완료 보고 — 데이터 모델 확장 (Zustand + Supabase, 전부 가산적)

## Exit Criteria 체크리스트 — 전부 충족

- [x] 4개 파일(userStore, coupleStore, sessionStore) + 신규 migration 3개에 필드 추가 완료
- [x] 기존 필드 diff 없음 — 추가만 있고 수정/삭제 없음을 git diff로 확인
- [x] Phase 0 금지 목록 12종 파일 diff 여전히 0줄 (userStore/coupleStore/sessionStore 3종은 "추가만" 허용 대상이라 diff는 있으나 전부 `+`뿐, 삭제 라인 0건)
- [x] 마이그레이션 로컬 적용 후 기존 앱 빌드·실행 정상
- [x] tsc 에러 0건
- [x] `couples` 테이블 실제 스키마 확인 결과 보고 (아래)

## `couples` 테이블 스키마 확인 — 라이브 DB 접근 불가, 그러나 저장소 내에서 확정 가능했음

지시대로 `supabase login`/`supabase db pull --linked`을 시도했으나 이 환경에는 `SUPABASE_ACCESS_TOKEN`이 없어 `LegacyPlatformAuthRequiredError`로 실패했다(라이브 프로젝트 `xcngcuenlpmnraythdjn`에 접근 불가).

다만 작업 도중 `supabase/migrations/` 디렉터리를 다시 확인한 결과, **감사표 작성 시점(7/11 오전)에는 없었던 `20260711000000_initial_schema.sql`이 같은 날 오후 커밋(`b7348a3`)으로 이미 저장소에 커밋되어 있었다** — 즉 팀이 그사이 콘솔에서 수동 생성해오던 `couples`/`date_courses`/`partner_moods` 스키마를 실제 SQL 마이그레이션으로 문서화해둔 상태였다. 이 파일이 정의한 `couples.id`는 `UUID DEFAULT gen_random_uuid()`이므로, 별도의 라이브 DB 조회 없이 저장소 자체에서 FK 타입을 확정할 수 있었다.

로컬 Postgres(`postgres:15-alpine`)에 `auth.users` 스텁을 만들고 기존 `20260711000000_initial_schema.sql` + 신규 마이그레이션 3개를 순서대로 적용해 실제로 `couple_dna_results.couple_id UUID REFERENCES couples(id)`가 오류 없이 걸리는 것까지 확인했다(아래 로그).

## 완료한 작업

### Zustand — 전부 가산적 (기존 필드 무변경)

| 파일 | 추가 내용 |
|---|---|
| `src/store/userStore.ts` | `PsychProfile` 인터페이스 신규, `UserState.psychProfile: PsychProfile \| null`(초기값 `null`), `setPsychProfile` 액션. 기존 `personaMatrix`(Aura·제네시스 UX 소관)는 그대로 두고 별도 슬롯으로 분리 |
| `src/store/coupleStore.ts` | `DnaResult` 인터페이스 신규, `CoupleState.dnaResult: DnaResult \| null`(초기값 `null`), `setDnaResult` 액션 |
| `src/store/sessionStore.ts` | `InterviewSessionState` 인터페이스 신규, `SessionState.interviewSession`(초기값 `{turnsUsed:0, elapsedSeconds:0, nextTargetDimension:null, entropySnapshot:{}}`), `setInterviewSession`(부분 병합)/`resetInterviewSession` 액션. 기존 `isGenesisInProgress`는 그대로 유지 |

```
$ git diff --stat -- src/store/userStore.ts src/store/coupleStore.ts src/store/sessionStore.ts
 src/store/coupleStore.ts  | 19 +++++++++++++++++++
 src/store/sessionStore.ts | 28 ++++++++++++++++++++++++++++
 src/store/userStore.ts    | 26 ++++++++++++++++++++++++++
 3 files changed, 73 insertions(+)   ← 삭제 0줄
```

### Supabase — 신규 마이그레이션 3종 (기존 테이블 ALTER 없음)

| 파일 | 내용 |
|---|---|
| `supabase/migrations/20260715120000_user_psych_profiles.sql` | `user_id UUID REFERENCES auth.users(id)`. Big5/애착은 스칼라 컬럼(향후 재캘리브레이션 집계 쿼리 대비), 애니어그램 코어·날개 결합확률·MBTI 재추정은 JSONB(손실 없는 보존), 인터뷰 메타 포함. RLS: 본인만 조회/기록 |
| `supabase/migrations/20260715120100_interview_sessions.sql` | 턴 단위 로그 — `session_id, user_id FK, turn_index, question_id, target_dimension, raw_response_text, parsed_value, confidence, entropy_before, entropy_after, created_at`. RLS: 본인만 조회/기록(영구 보존 전제, 삭제 정책 없음) |
| `supabase/migrations/20260715120200_couple_dna_results.sql` | `couple_id UUID REFERENCES couples(id)`, `dna_pct`(50~100 체크 제약), `s_b5/s_en/s_st/s_att`, `calibration_version`, `computed_at`. RLS: 커플 멤버만 조회 |

### 로컬 마이그레이션 적용 로그 (postgres:15-alpine + auth 스키마 스텁)

```
=== applying 20260711000000_initial_schema.sql === exit 0
=== applying 20260715120000_user_psych_profiles.sql === exit 0
=== applying 20260715120100_interview_sessions.sql === exit 0
=== applying 20260715120200_couple_dna_results.sql === exit 0
```

`\d couple_dna_results`로 FK를 직접 확인:
```
Foreign-key constraints:
    "couple_dna_results_couple_id_fkey" FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE
```

### 빌드 검증

- `npx tsc --noEmit -p tsconfig.json` → 에러 0건
- `npx jest src/lib` → 87 passed (Phase 0 결과 그대로 유지, 회귀 없음)
- `npx expo export --platform web` → 1530개 모듈(앱 전체 화면 트리 포함) 정상 번들링 성공 — userStore/coupleStore/sessionStore를 소비하는 기존 화면 전부 포함해 빌드 정상 확인

## 참고 — 실제 Supabase 프로젝트 반영 시 필요한 절차

이 3개 마이그레이션 파일은 로컬 검증만 마쳤고, 실제 프로젝트(`xcngcuenlpmnraythdjn`)에는 아직 적용되지 않았다. 사람이 `SUPABASE_ACCESS_TOKEN`으로 로그인한 뒤 `supabase db push`(또는 콘솔 SQL Editor에서 순서대로 실행)해야 반영된다.

## 남은 이슈 없음

Phase 1 범위(스키마 확장) 내에서 막힌 부분은 없다. 다음 Phase 2(인터뷰 인프라: 문항뱅크, 그리디 엔진, adaptive-interview Edge Function)로 진행하기 전 지시를 기다린다.
