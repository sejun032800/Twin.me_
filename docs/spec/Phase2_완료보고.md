# Phase 2 완료 보고 — 인터뷰 인프라 (문항뱅크, 그리디 엔진, adaptive-interview Edge Function)

## Exit Criteria 체크리스트 — 전부 충족 (자동화 스위트 기준)

- [x] `questionBank.ts`가 v2.1 §7 전체(3계층)를 문서 문구 그대로 포함
- [x] `adaptiveEngine.ts` 4개 함수 전부 순수함수, 결정론적 테스트 전부 통과
- [x] `adaptive-interview` Edge Function이 `llm-route`와 완전히 분리된 엔드포인트로 존재
- [x] Edge Function 계약 테스트(mock 기반) 전부 통과, 실제 API 호출 없이 CI 통과
- [x] Phase 0 금지 목록 + `llm-route/index.ts` 여전히 diff 0줄
- [x] tsc 에러 0건, 기존 jest 테스트 전부 그대로 통과

```
Test Suites: 9 passed, 9 total
Tests:       155 passed, 155 total   (Phase 0: 87 + Phase 2 신규: 68)
tsc: 에러 0건
```

## 만든 파일

| 파일 | 내용 |
|---|---|
| `src/lib/interview/questionBank.ts` | v2.1 §7.1(공통 7차원×3~4변형+오프너3+날개템플릿+스턴버그3×2) / §7.2(연애맥락 5차원×3+오프너4) / §7.3(16 MBTI×2문항) 전체를 문서 문구 그대로 이식. 총 105문항(7×4+3+6+5×3+4+16×2) |
| `src/lib/interview/adaptiveEngine.ts` | `computeUncertainty`(§5.1/§5.2), `selectNextQuestion`(§5.3 그리디+§7.4 우선순위), `checkEarlyStop`(§6), `estimateTimeCost`(§4) — 전부 순수함수, Phase 0 `constants.ts`의 σ_prior/임계값을 그대로 재사용(재정의 없음) |
| `supabase/functions/adaptive-interview/parsing.ts` | 프롬프트 빌더, §6 JSON 스키마, `validateParsedResponse`, `parseResponseWithRetry`(1회 재시도 후 confidence:0 폴백) — Deno API 미사용 순수 TS라 Jest로 직접 테스트 |
| `supabase/functions/adaptive-interview/index.ts` | Deno.serve 핸들러 — `action:'generate'\|'parse'`로 역할 분기, Gemini 2.5 Flash 호출(파싱 시 `responseSchema` 강제) |
| `supabase/functions/adaptive-interview/deno.json` | 신규 함수 import map(빈 인포트) |
| `supabase/config.toml` | `[functions.adaptive-interview]` 스탠자 추가(가산적) — `llm-route`(verify_jwt=false)와 달리 사용자별 인터뷰 데이터를 다루므로 `verify_jwt=true`로 설정 |

## 순수 로직 테스트 결과 (결정론적, mock 불필요)

- `computeUncertainty` — ENFP 예시: avo=1.000, enneagram_core≈0.969, anx≈0.826, N≈0.669, O=C=E=A≈0.298 (오차 ±0.001) 전부 통과
- `selectNextQuestion` — 5턴 연속 호출 시 `avoidance→enneagram_core→anxiety→N→O` 순서 정확히 재현. §7.4 우선순위(MBTI별→연애맥락→범용 폴백) 검증
- `checkEarlyStop` — (a)time_cap, (b)entropy_threshold, (c)min_turns_satisfied 3가지 트리거 및 미종료 케이스 개별 검증
- `estimateTimeCost` — A=30/B=20/C=10초
- `questionBank` 무결성 — 16 MBTI 전부 정확히 2문항, §7.1/§7.2 각 차원 문항 수 문서와 일치, id 중복 없음

## Edge Function 계약 테스트 결과 (Gemini mock, 실제 API 호출 없음)

- 정상 응답(1회 호출) → 스키마 파싱 성공
- 스키마 밖 응답(비-JSON, 범위 밖 값 2종) → 1회 재시도 트리거 확인, 재시도 프롬프트에 강한 리마인더 포함 확인
- 재시도도 실패(비-JSON 반복, 네트워크 reject 반복) → 정확히 2회 호출 후 `confidence:0` 폴백 반환 확인
- `generateUtterance`(발화 생성)는 재시도 없이 1회 호출 확인

## 격리 검증

```
$ git diff --stat -- (금지 12종 + llm-route/index.ts) → llm-route/index.ts 등 9종은 출력 없음(0줄)
  (userStore/coupleStore/sessionStore 3종은 Phase 1에서 이미 가산된 diff 그대로, 이번 Phase에서 추가 변경 없음)
$ 새 모듈의 실제 import → src/lib/interview/adaptiveEngine.ts가 userStore.ts/sessionStore.ts에서
  PsychProfile/InterviewSessionState를 "import type"으로만 참조(런타임 의존성 없음, Phase 1 지시사항대로)
$ 기존 파일이 lib/interview 또는 adaptive-interview를 참조 → NONE FOUND
```

## ⚠️ 사람이 직접 확인해야 하는 항목 — 실제 Gemini API 수동 검증 체크리스트

자동화 스위트는 Gemini를 전혀 호출하지 않는다(mock만 사용). 아래는 실제 `GEMINI_API_KEY`로 배포 후 사람이 1~2회 수동으로 확인해야 하는 항목이다 — 이번 보고에는 포함되지 않은, 아직 검증되지 않은 부분이다:

- [ ] `supabase functions deploy adaptive-interview`로 실제 배포 후 `action:'generate'` 호출 시 자연스러운 대화체 발화가 실제로 생성되는지
- [ ] `action:'parse'` 호출 시 실제 Gemini 응답이 `responseSchema` 강제로 항상 유효한 JSON을 반환하는지(모델이 스키마를 무시하는 경우가 실제로 있는지)
- [ ] 모호한 답변("음... 글쎄요", "그냥 그래요" 등)을 실제로 넣었을 때 `confidence`가 의도대로 낮게 나오는지
- [ ] 재시도 프롬프트(강한 리마인더)가 실제 모델 행동을 개선하는지, 아니면 여전히 실패해 폴백으로 떨어지는 빈도가 얼마나 되는지
- [ ] `GEMINI_API_KEY` 환경변수가 실제 프로젝트에 설정되어 있는지(로컬 개발환경 기준 확인 안 됨)

## 남은 이슈 없음 (Phase 2 범위 내)

Phase 2 범위(문항뱅크, 그리디 엔진, Edge Function 골격+계약)에서 막힌 부분은 없다. 다음 Phase 3(기능 플래그 전환 — genesis.tsx 등 기존 화면을 처음 건드리는 단계)로 진행하기 전 지시를 기다린다.
