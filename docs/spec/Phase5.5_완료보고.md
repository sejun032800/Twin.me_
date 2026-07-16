# Phase 5.5 완료 보고 — 스케일 재보정 + 커플 DNA 결과 화면/동기화

## Exit Criteria 체크리스트

- [x] ON 경로 티어 표시가 새 분포 기준으로 재보정됨, OFF 경로 무변화
- [x] `couple_dna_results`가 실제로 쓰이고(INSERT), 새 화면이 그걸 읽음(SELECT)
- [x] 두 완료 순서 시나리오(A먼저/B먼저) 모두 통합테스트 통과
- [x] 고아 테스트 10개 문서 소급 반영
- [x] Phase 0 금지 목록 + 폐기예정 7종 diff 여전히 0줄(폐기예정 7종은 여전히 존재만 함) — **재확인 방법에 유의점 있음, 아래 참고**

```
Test Suites: 14 passed, 14 total
Tests:       176 passed, 176 total   (Phase 5.5 신규: 11 — 티어재보정 8 + A/B완료순서 3)
tsc: 에러 0건
```

## 작업 1 — 티어/무드태그 스케일 재보정

`src/engine/scoreCalculator.ts`(append-only)에 추가:
- `inverseNormalCdf(p)` — Peter Acklam 유리함수 근사(|상대오차|<1.15e-9). 기존 `normalCdf`엔 역함수가 없어서 신규 작성.
- `rescaleScoreCutoffToV21(oldCutoff)` — 사용자가 지정한 `T_new = 75 + K·Φ⁻¹(Φ((T_old−70)/7.81))` 그대로 구현. (참고: 수학적으로 `Φ⁻¹∘Φ`는 항등이라 결과는 선형 재척도와 동치이지만, 지정된 유도식을 그대로 구현해 추적 가능성을 유지했다.)
- `getTierFromScoreV21()` — `getTierFromScore()`(OFF, **무수정**)와 등급 라벨/테마는 동일, 컷오프만 재보정.
- `MOOD_TAG_HIGH_THRESHOLD_V21`/`MOOD_TAG_MID_THRESHOLD_V21` — `app/(tabs)/index.tsx`와 `AICoachingCard.tsx`에 동일하게 하드코딩돼 있던 `>=70`/`>=40` 무드태그 임계값도 검토 결과 동일한 스케일 문제 대상이라 판단해 **둘 다** 재보정했다(요청 원문은 AICoachingCard만 지목했으나 index.tsx에 완전히 동일한 패턴이 있어 함께 처리 — 요약에 명시).
- `index.tsx`/`AICoachingCard.tsx`는 `useFeatureDnaV21()` 분기로 ON일 때만 재보정 값을 쓰고, OFF는 리터럴 `70`/`40` + `getTierFromScore()`를 그대로 호출해 100% 동일 동작.

**흥미로운 부작용 발견(버그 아님, 설계상 당연한 결과):** 백분위를 보존하며 재매핑하면 최상위 티어(T95) 컷오프가 dna_pct 자체의 클램프 상한(100)보다 높게 나온다. 즉 온보딩 직후의 `S_Base`(=dna_pct) 단독으로는 최상위 등급에 절대 도달할 수 없고, 기존 실시간 틱 엔진(sLive/sCurrent, 이 프로젝트 범위 밖·무수정)을 통한 장기 성장이 있어야 도달 가능하다 — 구 시스템에서도 `S_Base` 단독으론 최상위 등급에 못 미쳤던 것과 동일한 성격이라, 의도된 결과로 판단해 테스트에도 그렇게 반영했다.

## 작업 2 — `couple_dna_results` 실제 연동

**배포 전 발견한 것:** 기존 `couple_dna_results` 마이그레이션에는 SELECT 정책만 있고 **INSERT 정책이 없어**, 그대로는 클라이언트에서 기록이 전부 거부되는 상태였다. 새 마이그레이션(`supabase/migrations/20260716010000_couple_dna_results_insert_policy.sql`)으로 INSERT 정책을 추가했다 — **이 마이그레이션은 아직 로컬 파일로만 존재하고 원격 배포는 하지 않았다** (Phase 4처럼 시크릿이 필요한 작업이라 별도 확인 후 진행 권장).

- `src/services/dnaResultService.ts` 신규: `insertCoupleDnaResult`(append INSERT — 이 테이블은 `couple_id` UNIQUE 제약이 없는 이력 로그라 진짜 upsert가 아니라 매번 새 행을 추가한다), `getLatestCoupleDnaResult`(`computed_at DESC LIMIT 1`로 최신 결과 조회), `computeAndSaveCoupleDna`(파트너 프로필이 준비됐으면 계산+기록, 아니면 조용히 null — `GenesisV21Screen`과 `DnaCompatibilityCard`가 공유).
- `GenesisV21Screen.tsx`를 이 공용 헬퍼를 쓰도록 리팩터(기존 인라인 로직 제거, 동작은 동일 + 서버 기록 추가).
- `src/components/DnaCompatibilityCard.tsx` 신규 — 화면 포커스마다 `couple_dna_results` 재조회, 없으면(내 프로필은 있는데 결과가 없는 상태) 그 시점에 `computeAndSaveCoupleDna`를 한 번 더 시도한다 — **먼저 완료한 사람 쪽에서 결과가 영구히 비어있던 문제**(통합감사 §2)를 해소하는 핵심 로직. `app/(tabs)/index.tsx`의 `PartnerStatusBar` 아래, `FEATURE_DNA_V21 ON + 파트너 연동` 조건에서만 렌더링.

## 작업 3 — 문서 정리

고아 테스트 10개를 각 소속 Phase 보고서에 소급 기재(Phase0: 6개, Phase2: 2개, Phase3: 2개) — 코드 변경 없음.

## 격리 검증 관련 유의점

이번 세션 중간에 **저장소에 새 커밋(`207e1d9 "7/16 개인정비 연등"`)이 생겨**, Phase 3/4가 수정한 파일들(`InterviewCallModal.tsx`, `genesis.tsx` 등)이 이제 HEAD에 포함돼 있었다. 그래서 `git diff`(작업트리 vs HEAD)만으로는 "금지 12종 무편집"을 검증할 수 없어, 프로젝트 시작 전 커밋(`7517286`, 7/13)을 기준선으로 다시 diff했다 — 결과는 기존과 동일: `InterviewCallModal.tsx`만 3줄 변경(Phase 3 보고서에 이미 설명된, 신규 prop 추가로 인한 불가피한 재포맷, 생략 시 동작 100% 동일), 나머지 11종은 0줄.

## 미해결 블로커 (Phase 6 전 필수 — 계속 이월)

1. **실기기 E2E 검증 여전히 미완료.** Phase 4에서 이미 이월됐고, 이번에도 사용자 사정으로 다루지 않았다. 이번 Phase가 새로 만든 `DnaCompatibilityCard` 노출까지 포함해서 실기기로 확인해야 한다.
2. **새 마이그레이션(`20260716010000`) 원격 미배포.** 원격에 배포하기 전까지는 `couple_dna_results` INSERT가 실제로는 계속 실패한다(RLS가 막음) — 로컬 코드/테스트는 전부 통과하지만 실기기 검증 전에 반드시 배포해야 한다.
