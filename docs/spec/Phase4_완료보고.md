# Phase 4 완료 보고 — 내부 검증 준비 (실기기 E2E는 다음 세션으로 이연)

**이번 세션 범위:** 사용자 지시에 따라 "Phase 4 마무리 + Phase 5 착수(조사만)"로 축소됨. 실기기 음성+타이핑 E2E 검증(Phase 4 체크리스트 3~7번)은 사용자 사정으로 다음 세션으로 이연됨 — **§ 아래 "미해결 블로커" 필독**.

## 이번 세션에서 한 것

1. v2.1 문서 패치(§4/§7/§8) 영향 분석 및 코드 반영
2. 원격 마이그레이션 4건 배포 (`user_psych_profiles`, `interview_sessions`, `couple_dna_results` 테이블 신규 생성 + 커플 상대방 프로파일 SELECT 정책)
3. 기존 베타 유저/데이터 실태 조사 (사실관계만, 정책 결정 없음)

## 1. v2.1 문서 패치 반영

문서가 §4(시간 예산)/§7(문항뱅크)/§8(베이지안 갱신)을 패치해, Phase 3에서 이 세션이 "임의 근사"로 도입했던 값들을 **확정값으로 승격**시켰다:
- σ_obs = 0.35, 애니어그램 우도 `L = exp(±2·lean)` — Phase 3 구현(`adaptiveInterviewSession.ts`)과 정확히 일치. 코드는 변경 없이 주석만 "임의값"→"v2.1 §8 확정값"으로 갱신.
- 애니어그램 날개 후속질문은 인터뷰 턴이 아니라 **결과화면 확인용 UX**로 공식 재분류됨 — 이미 Phase 3 구현이 이 방식을 취하고 있었음(우연히 일치했던 게 아니라, 이 세션의 설계가 이후 문서에 역으로 반영된 것으로 보임).

**코드 정리:** `adaptiveEngine.ts`의 `NarrativeQuestionType`에서 미사용 유형 `'B'`(날개 후속) 제거, `estimateTimeCost('B')` 분기 제거, `constants.ts`의 `TURN_SECONDS.wingFollowup` 제거. 관련 테스트(`adaptiveEngine.test.ts`) 갱신. tsc 0건, jest 165/165 통과(기존 166 − 삭제된 구식 테스트 1).

## 2. 원격 마이그레이션 배포

### 예상 밖 발견 — 배포 전 확인받은 사항

요청하신 `20260716000000_user_psych_profiles_partner_select.sql` 1건만으로는 배포가 **실패**하는 상황이었다: 그 정책이 대상으로 하는 `user_psych_profiles` 테이블 자체가 원격에 없었다. 조사 결과 Phase 1에서 만든 3개 테이블(`user_psych_profiles`/`interview_sessions`/`couple_dna_results`)이 **한 번도 원격에 배포된 적이 없었다** — 이번에 처음 배포함. (반대로 `couples`/`date_courses`/`partner_moods`는 2026-07-11 스키마가 CLI 이력 없이 이미 원격에 존재해 있었다.) 이 사실과 확장된 배포 범위(1건→4건)를 먼저 보고하고 승인을 받은 뒤 진행했다.

### 배포 절차

1. `supabase migration repair 20260711000000 --status applied --linked` — 이미 적용된 초기 스키마를 이력 장부에만 반영(SQL 재실행 없음). **이 명령도 자동 승인 필터가 최초 차단해 별도로 사용자 확인을 받았다.**
2. `supabase db push --linked --dry-run` → 정확히 4건만 대상으로 잡히는지 확인
3. `supabase db push --linked` → 4건 순서대로 적용 완료(`user_psych_profiles` → `interview_sessions` → `couple_dna_results` → 정책 파일)

### 배포 후 검증 (읽기 전용 집계 쿼리만 사용, PII 원본 미조회)

```
user_psych_profiles_exists = true
interview_sessions_exists  = true
couple_dna_results_exists  = true
user_psych_profiles 정책 개수 = 3  (본인 조회/본인 기록·갱신/커플 상대방 조회 — 예상과 일치)
```

### 원상복구 확인

`git diff -- supabase/config.toml` → **0줄**(변경 없음, Phase 2 때처럼 verify_jwt를 임시로 끄는 절차 자체가 이번엔 필요 없었음). `supabase/.temp/cli-latest`라는 CLI 자체 캐시 파일이 새로 생겼으나 리포지토리 추적 대상도 원격 설정도 아닌 로컬 도구 캐시라 별도 원상복구 대상 아님.

### 시크릿 처리

`supabase_token.txt`, `supabase_db_password.txt` 둘 다 작업 종료 직후 삭제 완료 — 삭제 확인 완료(재확인 결과 두 파일 모두 scratchpad에 존재하지 않음). 두 값 모두 채팅에 노출한 적 없음(파일 경유 + `$(cat ...)` 참조로만 사용).

## 3. 기존 베타 유저/데이터 실태 조사 (사실관계만)

읽기 전용 집계 쿼리(`select count(*)`, `to_regclass(...)`)로만 확인했고, 실제 유저 데이터(이메일 등)는 조회하지 않았다.

| 항목 | 결과 |
|---|---|
| `auth.users` 실 가입자 수 | **3명** |
| `public.couples` 레코드 수 | **0건** |
| 연동 완료 커플 수 (`partner_id IS NOT NULL`) | **0쌍** |
| 구버전 온보딩(MBTI+애니어그램) 완료 후 서버에 저장된 유저 | **해당 없음** — 애초에 그 데이터를 저장할 서버 테이블이 이번 배포 전까지 존재하지 않았으므로, "구버전 데이터가 서버에 있는지"라는 질문 자체가 성립하지 않는다(Phase 3 보고서의 추정이 사실로 확정됨: 기존 유저의 페르소나/심리 데이터는 각자 기기의 AsyncStorage에만 있다) |

**결론:** 현재 원격 프로젝트는 사실상 사전 출시/내부 테스트 상태다(가입자 3명, 커플 0쌍). "베타 유저 데이터 마이그레이션" 대상 자체가 지금 시점엔 실질적으로 없다. 다만 이 조사는 프로젝트 상태를 스냅샷한 것일 뿐, 실제 클로즈드 베타(문서 목표: 30~100쌍) 시작 이후에는 상황이 달라질 것이므로 Phase 5 정책은 여전히 필요하다.

**정책 결정(옵션 a: 사후분포 초기값 이관 / 옵션 b: 재인터뷰 요구)은 위 사실관계 보고로 그치고, 결정하지 않았다** — 지시하신 대로 사용자 판단으로 넘긴다.

## 미해결 블로커 — 다음 세션(특히 Phase 6 착수 전) 반드시 확인할 것

**실기기/Expo Go 음성+타이핑 E2E 검증이 아직 수행되지 않았다.** 이번 세션은 사용자 사정으로 이 부분을 명시적으로 보류했다. Phase 4 원래 Exit Criteria 중 아래 항목들이 여전히 미완료 상태다:

- [ ] 음성+타이핑 각 1회 이상 E2E 완주 (5분 캡 또는 조기종료 관찰)
- [ ] `interview_sessions` 원격 테이블에 실제 턴 로그 전 필드 정상 적재 확인 (테이블은 이번에 생성됐으나 실사용 데이터로 검증된 적 없음)
- [ ] 커플 화면 `dnaResult` 노출 정상 확인
- [ ] 파싱 실패율(confidence:0 폴백) 관찰치 보고

**이 항목들이 완료되기 전까지 Phase 6(전면 전환)로 진행해서는 안 된다** — 다음 세션은 이 문서를 먼저 확인하고, 사용자가 실기기 테스트를 완료했는지부터 물어볼 것.

## 계속 보류 중인 별도 이슈 (Phase 3 보고서부터 이어짐)

- `couple_dna_results` 테이블(서버측 DNA 결과 저장)에 `GenesisV21Screen`이 아직 쓰지 않는 갭 — 이전 지시대로 계속 보류.
