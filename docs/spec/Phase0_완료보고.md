# Phase 0 완료 보고 — v2.1 궁합 엔진 순수함수 모듈 (Strangler Fig)

**갱신** (2차): v2.1 문서가 앵커행렬(§2)·M행렬(§11.2)·Readiness/Stability/PursueWithdraw/t^trait(§11.1)·
§14 전체 원시벡터 예제를 복원한 갱신판으로 교체됨에 따라, 1차 보고에서 "재현 불가"로
남겼던 골든 테스트 #2·#3과 "부분 통과"였던 #4를 우회 없이 다시 작성해 전부 통과시켰다.

## Exit Criteria 체크리스트 — 전부 충족

- [x] 6개 파일(+ mbtiReestimate.ts 보너스)이 기존 파일을 import하지 않고 독립적으로 존재
- [x] 기존 파일 diff 0줄 — 금지 파일 12종 전부 확인
- [x] jest-expo 설치·설정
- [x] **필수 테스트 5종 전부 완전 통과 (우회·블록-확인 테스트 없음)**
- [x] 각 상수·함수에 v2.1 절 번호 주석 존재

## 필수 테스트 5종 결과 — 전부 정식 통과

| # | 테스트 | 결과 | 비고 |
|---|---|---|---|
| 1 | MBTI→Big5 16유형 전체 | ✅ | 변경 없음 (원래부터 갭 없었음) |
| 2 | 애니어그램 코어 사전분포 (ENFP, U_EN=0.969) | ✅ | 앵커행렬 복원 후 `enneagramCorePrior(big5Prior('ENFP'))`의 U_EN이 0.969와 정확히 일치(오차 <0.001) |
| 3 | 날개 결합확률 (b=(0.63,0.55,0.78,0.50,0.38) → 8w7=14.4%, 7w8=14.3%, 3w2=13.0%) | ✅ | `enneagramCorePrior(b)`가 먼저 §9.2의 코어분포(7:18.0%,3:17.8%,8:16.6%)를 정확히 재현하고, 그 위에서 `jointDistribution()`이 세 값을 오차 ±0.1%p 이내로 재현 |
| 4 | 캐노니컬 커플 전체 파이프라인 (S_B5=0.410, S_EN=0.561, S_ST=0.758, S_ATT=0.584, DNA%=83.4) | ✅ | §14의 원시벡터(b, p, ψ, t^state)만으로 `PersonProfileV21`을 구성해 `computeRomanticDnaV21()` 전체 체인을 실행 — 중간 부분점수를 주입하지 않음 |
| 5 | 경계값 fuzzing (DNA% ∈ [50,100]) | ✅ | 15개 극단값 케이스, 변경 없음 |

```
Test Suites: 6 passed, 6 total
Tests:       87 passed, 87 total
Time:        ~2s
```

## 이번에 실제 구현으로 교체한 부분

| 파일 | 이전(Phase 0 1차) | 이번 |
|---|---|---|
| `lib/matching/constants.ts` | 앵커행렬·M행렬 throw 스텁 | v2.1 §2/§11.2 실제 수치 반영 |
| `lib/inference/mbtiPrior.ts` | `enneagramCorePrior()` 블록 | 앵커행렬만 채워지면 되도록 이미 제네릭하게 짜여 있어 **코드 변경 없이** 자동 통과 |
| `lib/inference/enneagramWing.ts` | `wingConditional()`/`jointDistribution()` 블록 | 동일 이유로 **코드 변경 없이** 자동 통과 |
| `lib/matching/dnaCompatibility.ts` | `computeS_B5(cos, readinessA, readinessB)`, `computeS_ATT(stabA,stabB,pursueWithdraw)` 등 외부입력 방식 | `computeS_B5(bigFiveA, bigFiveB)`, `computeS_ATT(attachmentA, attachmentB)`로 시그니처 변경 — Readiness/Stability/PursueWithdraw/t^trait을 내부에서 직접 계산(`computeReadiness`, `computeStability`, `computePursueWithdraw`, `computeSternbergTrait` 신규 export). `computeS_ENCore()`는 M행렬만 채워지면 되도록 이미 제네릭해 코드 변경 없음 |
| `lib/matching/computeRomanticDNA.ts` | `ExternalCompatibilityInputs` 필수 | 완전히 제거 — `computeRomanticDnaV21(profileA, profileB)` 두 인자만으로 전체 체인 동작 |

## 격리 검증 (재확인)

```
$ git diff --stat -- (금지 파일 12종) → 출력 없음, 0줄 diff
$ grep 새 모듈의 실제 import → 전부 lib/inference, lib/matching 내부 상호 참조뿐
$ grep 금지 파일들의 lib/* 참조 → NONE FOUND (역방향 연결 없음)
$ npx tsc --noEmit → 에러 0건
```

package.json/package-lock.json은 금지 목록 밖이라 jest-expo devDependency + test 스크립트만 유지(변경 없음, 1차 보고와 동일).

## 완성된 모듈 (갭 없음)

- `constants.ts` — σ_prior, Monte Carlo 상수, τ_c/τ_w/δ, **앵커행렬(9×5)**, **M행렬(9×9)**
- `mbtiPrior.ts` — `big5Prior()`, `attachmentPrior()`, `enneagramCorePrior()` — 전부 완전 구현
- `bayesianUpdate.ts` — `updateBig5Posterior()`, `updateAttachmentPosterior()`, `updateEnneagramCorePosterior()` — 완전 구현(변경 없음)
- `enneagramWing.ts` — `wingIdsOf()`, `wingConditional()`, `jointDistribution()`, `wingMarginal()` — 전부 완전 구현
- `mbtiReestimate.ts` — `reestimateMbtiAxes()` — 완전 구현(변경 없음)
- `dnaCompatibility.ts` — `computeReadiness()`, `computeS_B5()`, `computeS_ENCore()`, `computeWingBonus()`, `computeS_EN()`, `computeSternbergTrait()`, `blendSternberg()`, `computeS_ST()`, `computeStability()`, `computePursueWithdraw()`, `computeS_ATT()`, `computeSRaw()`, `computeDnaPercent()` — 전부 완전 구현, 외부입력 불필요
- `computeRomanticDNA.ts` — `analyzePersonV21()`, `computeRomanticDnaV21()` — 전부 완전 구현, 갭 없음

## 남은 이슈 없음

Phase 0에서 보고했던 4가지 갭(앵커행렬, M행렬, Readiness, Stability/PursueWithdraw/t^trait)은 v2.1 갱신판으로 전부 해소되었다. 다음 Phase(§4 데이터 모델 확장 등)로 진행하는 데 더 이상의 블로커가 없다.

## 부록 — 개별 테스트 파일 목록 (Phase 5.5에서 소급 기재)

통합감사(`docs/audit/통합감사_2026-07-16.md` §5)가 지적한 대로, 위 "필수 테스트 5종"은 시나리오 단위였고 실제 파일명이 개별적으로 나열되지 않았다. 이 Phase가 만든 테스트 파일은 다음과 같다(코드는 이전부터 그대로, 이 항목은 문서 보완일 뿐):

- `src/lib/inference/__tests__/bayesianUpdate.test.ts`
- `src/lib/inference/__tests__/enneagramWing.test.ts`
- `src/lib/inference/__tests__/mbtiPrior.test.ts`
- `src/lib/inference/__tests__/mbtiReestimate.test.ts`
- `src/lib/matching/__tests__/dnaCompatibility.test.ts`
- `src/lib/matching/__tests__/computeRomanticDNA.test.ts`
