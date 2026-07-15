# Twin.me — 온보딩 인터뷰 및 '연애 DNA 일치율' 전면 개정 구현 명세서

**대상 독자:** Claude Code (구현 에이전트)
**문서 성격:** 실행 지시서(operational spec) — 수식·이론적 근거는 별첨 문서가 단일 진실 공급원(SSOT)이며, 본 문서는 그것을 실제 Twin.me 코드베이스에 이식하는 방법을 규정한다.
**필수 선행 조건:** 아래 §1의 두 문서를 **반드시 먼저 전체 읽고** 작업을 시작할 것.

---

## 0. 목적과 범위

**목적:** 별첨 수식 명세서(v2.1)에 정의된 적응형 인터뷰·궁합 산출 로직을, Twin.me의 기존 온보딩 인터뷰와 "연애 DNA 일치율" 기능을 대체하는 실제 코드로 구현한다.

**In-scope (건드려야 하는 것):**
- 온보딩 인터뷰 플로우 전체 (현재 Genesis Interview 4막 구조로 추정 — §2 현황 파악에서 확인)
- 애니어그램/Big5/애착 추론 엔진 (현재 `genesisInference.ts`, `genesisBlending.ts`로 추정)
- "연애 DNA 일치율" 궁합 계산 로직 (현재 `scoreCalculator.ts` 내부 또는 미구현 상태로 추정)
- 관련 Zustand 스토어 스키마, Supabase 테이블 스키마, Edge Function

**Out-of-scope (건드리지 않는 것) — §11에서 재확인:**
- Aura 색상 시스템, HelixView, MoodFeed, Couple Wrapped, VIP 프로모션 로직
- `twinResponseEngine.ts` (트윈 AI의 일상 대화 응답 로직 자체)
- 카카오 데이터 파이프라인의 온디바이스 추출 아키텍처 (단, 인터뷰 데이터와의 연동 지점만 확인)

---

## 1. 의존 문서 (SSOT)

| 문서 | 역할 |
|---|---|
| `연애_DNA_일치율_공식_v2.1.md` | 전체 수식·상수·문항뱅크의 유일한 정답 소스. Part I(초기 사전분포) ~ Part V(검증)까지 전부 |
| 본 문서 | 위 수식을 코드로 옮기는 방법, 파일 배치, 데이터 모델, 마이그레이션, 테스트 전략 |

두 문서를 프로젝트 저장소에 `docs/spec/` 아래 배치하고, 구현 중 수식 해석에 모호함이 생기면 **반드시 v2.1 문서를 재확인**한다. 구현 편의를 위해 수식을 임의로 단순화·변형하지 않는다. 단순화가 필요하다고 판단되면 코드를 바꾸기 전에 먼저 사람에게 확인을 구한다.

---

## 2. Phase 0 — 현황 파악 (구현 착수 전 필수)

본 문서의 파일 경로·모듈명은 기존 메모리 기록에 근거한 **추정치**이며, 실제 저장소 구조와 다를 수 있다. 아래를 먼저 조사하고, 이후 모든 절의 "추정 경로"를 실제 경로로 교체해 작업할 것.

```
1. 온보딩 관련 파일 전수 검색
   - Genesis Interview 관련 스크린/컴포넌트 (4막 구조로 추정)
   - kakao-guide.tsx, invite-hook.tsx 와의 플로우 연결 지점
2. genesisInference.ts, genesisBlending.ts 전체 로직 분석
   - 현재 베이지안 애니어그램 추론이 어떤 인터페이스로 노출되는지
   - 대체 대상인지, 일부 재사용 가능한지 판단해 보고
3. scoreCalculator.ts 내 궁합/매칭 관련 로직 위치 확인
   - "연애 DNA 일치율"이라는 명칭의 기존 구현이 있는지, 다른 이름(예: 궁합도·매칭스코어)으로 존재하는지
4. Zustand 4-store(userStore, coupleStore, scoreStore, sessionStore) 현재 스키마 전체 덤프
5. Supabase 테이블 스키마 전체 확인 (사용자 프로필, 인터뷰 응답 저장 여부, 궁합 결과 저장 여부)
6. Edge Function 목록과 Gemini 2.5 Flash 호출 지점 확인
7. 기존 베타 유저가 이미 온보딩을 완료한 상태인지, 완료했다면 몇 명·어떤 데이터 형태로 저장되어 있는지
```

**조사 결과를 §3~§9 착수 전에 요약 보고할 것** — 특히 4~7번 결과에 따라 §4(데이터 모델)와 §8(마이그레이션)의 실제 작업량이 크게 달라진다.

---

## 3. 아키텍처 매핑

v2.1 문서의 각 절을 어떤 모듈이 책임지는지 정의한다. 경로는 추정치이며 §2 조사 결과에 맞게 조정한다.

| v2.1 절 | 대상 모듈(추정 경로) | 책임 | 성격 |
|---|---|---|---|
| §2 MBTI 초기 사전분포 | `lib/inference/mbtiPrior.ts` (신규) | `big5Prior()`, `enneagramCorePrior()` | 순수함수, LLM 미사용 |
| §3~§6 적응형 인터뷰 제어 | `lib/interview/adaptiveEngine.ts` (신규, `genesisInference.ts` 대체) | 불확실성 계산(식 1,2), 그리디 문항선택(§5.3), 조기종료 판정(§6) | 순수함수 |
| §7 문항뱅크 | `lib/interview/questionBank.ts` 또는 `assets/interview/questionBank.json` (신규) | 3계층 문항 데이터 | 정적 데이터 |
| §8 베이지안 사후분포 갱신 | `lib/inference/bayesianUpdate.ts` (신규, `genesisBlending.ts` 대체) | 정규-정규 켤레 갱신, 애니어그램 곱셈적 갱신 | 순수함수 |
| §9 애니어그램 날개 | `lib/inference/enneagramWing.ts` (신규) | `wingConditional()`, `jointDistribution()`, `wingMarginal()` | 순수함수 |
| §10 MBTI 축 재추정 | `lib/inference/mbtiReestimate.ts` (신규) | 보너스 출력 전용 — **궁합 계산 파이프라인에 입력으로 들어가지 않음**, 오직 UI 표시용 | 순수함수 |
| §11~§13 궁합 점수 및 표준화 | `lib/matching/dnaCompatibility.ts` (신규, `scoreCalculator.ts` 내 관련 로직 대체) | `S_B5, S_EN, S_ST, S_ATT, S_raw, DNA%` 계산 | 순수함수 |
| 앵커행렬·M행렬·Monte Carlo 상수 | `lib/matching/constants.ts` (신규) | 하드코딩 상수 전용 모듈 — 재캘리브레이션 시 이 파일만 교체 | 상수 |
| §13 오케스트레이션 | `lib/matching/computeRomanticDNA.ts` (신규) | `analyzePersonV21()`, `computeRomanticDnaV21()` — 위 모듈들을 연결 | 오케스트레이터 |
| 자연어 응답 → 정규화 값 변환 | `supabase/functions/adaptive-interview/index.ts` (신규 또는 기존 인터뷰 Edge Function 확장) | Gemini 2.5 Flash 호출, 자유서술 답변을 [0,1] 값으로 파싱 | LLM 사용 |

**설계 원칙:** 엔트로피 계산·베이지안 갱신·궁합 점수 산출은 전부 **결정론적 순수함수**로 구현한다. Gemini 2.5 Flash는 오직 "자연어 답변 → 구조화된 수치"로의 변환(§7 참고)과 인터뷰 대화 생성에만 관여하며, 수식 계산 자체에는 관여하지 않는다 — 비용·재현성·테스트 가능성을 위해 이 경계를 반드시 지킬 것.

---

## 4. 데이터 모델 변경

### 4.1 Zustand — userStore 확장 (추정 인터페이스)

```typescript
interface UserPsychProfile {
  mbtiSelfReport: string;                    // 기존 유지

  big5: { O: number; C: number; E: number; A: number; N: number };       // §2, §8 사후값
  attachment: { anxiety: number; avoidance: number };                     // §4, §8 사후값
  enneagramCore: number[];                   // p ∈ Δ⁹, 길이 9
  enneagramWingJoint: Record<string, number>; // q, key="{core}w{wing}", 예: "3w4"
  sternbergState: { intimacy: number; passion: number; commitment: number } | null; // §7, 관계 특이적이라 커플 연결 전엔 null

  mbtiEstimated?: { pE: number; pN_axis: number; pF: number; pJ: number }; // §10 보너스, UI 전용

  interviewMeta: {
    completedAt: string | null;
    turnsUsed: number;
    elapsedSeconds: number;
    stopReason: 'time_cap' | 'entropy_threshold' | 'min_turns_satisfied';
    calibrationVersion: string;              // 예: "v2.1"  — §9 버전 태깅 참고
  };
}
```

### 4.2 Supabase 스키마 변경

- 기존 `profiles`(또는 동등 테이블)에 위 구조를 `psych_profile JSONB` 컬럼으로 추가할지, 정규화된 별도 테이블 `user_psych_profiles`로 분리할지는 **§2 조사 결과에 따라 판단**한다. 쿼리 패턴(예: 애니어그램 코어별 집계가 자주 필요한지)에 따라 선택.
- **`interview_sessions`(신규 테이블):** 턴 단위 로그 — `question_id, target_dimension, raw_response_text, parsed_value, entropy_before, entropy_after, timestamp`. 이 원시 데이터는 v2.1 §16 한계에서 언급한 "실사용자 데이터 축적 후 앵커행렬·M행렬·σ_prior 재추정"에 필수이므로 **반드시 영구 보존**한다.
- **`couple_dna_results`(신규 또는 기존 확장):** `couple_id, dna_pct, s_b5, s_en, s_st, s_att, calibration_version, computed_at`. `calibration_version`을 반드시 태깅해, 향후 μ̂·σ̂나 M행렬이 갱신되어도 과거 결과를 재현/비교할 수 있게 한다.

---

## 5. 인터뷰 플로우 재설계

- 기존 "4막 구조" UX 프레임은 유지 가능(사용자에게는 여전히 서사적으로 느껴지도록) — 다만 **막 내부의 문항 순서는 고정되지 않고 §5.3 그리디 알고리즘이 실시간 결정**한다.
- 음성 대화 + 타이핑 겸용: 두 입력 경로 모두 텍스트로 정규화한 뒤 동일한 파싱 파이프라인(§6)을 통과시킨다. 음성 입력은 STT 이후 동일 처리.
- 5분 타이머는 하드 캡이지 목표 시간이 아님 — UI 카피는 "최대 5분, 대부분 3~4분에 끝나요" 정도로 기대치를 관리한다(v2.1 §6 참고).
- 조기종료 시 사용자에게 "생각보다 빨리 파악됐어요" 류의 카피로 긍정적으로 안내하고, 하드 캡(5분) 도달 시에는 자연스럽게 "이 정도면 충분히 알 것 같아요"로 마무리한다.
- 인터뷰 진행 상태(현재 턴, 남은 예산, 다음 타겟 차원)는 `sessionStore`에 임시 보관하고, 완료 시점에만 `userStore`/Supabase에 커밋한다(중도 이탈 시 재개 가능하도록 세션 스냅샷을 주기적으로 Supabase에 upsert할 것을 권장).

---

## 6. 자연어 응답 파싱 (Edge Function 계약)

Gemini 2.5 Flash에게 요구하는 작업은 정확히 두 가지로 한정한다:

1. **다음 발화 생성**: `adaptiveEngine.ts`가 결정한 `target dimension`과 `questionBank.ts`에서 뽑은 문항 텍스트를 자연스러운 대화체로 포장(연결어, 리액션 포함)해서 전달.
2. **응답 파싱**: 사용자의 자유서술 답변을 받아, 해당 차원의 `[0,1]` 정규화 값(및 신뢰도)으로 변환. 구조화된 출력(JSON) 스키마를 강제할 것:

```json
{
  "target_dimension": "avoidance",
  "normalized_value": 0.62,
  "confidence": 0.8,
  "extracted_evidence": "짧은 인용 없이 판단 근거를 자체 언어로 1문장 요약"
}
```

파싱 실패(모호한 답변, 질문과 무관한 답변) 시 `confidence`를 낮게 반환하도록 프롬프트에 명시하고, `bayesianUpdate.ts`는 `confidence`를 `σ_obs`에 반영(신뢰도가 낮을수록 `σ_obs` 확대 → 사전분포 영향력 유지)한다.

---

## 7. 궁합 계산 엔진 재설계

- 기존 궁합/매칭 관련 로직을 §11~§13 수식으로 **전면 교체**한다. 부분적으로 재사용 가능한 로직이 있더라도, 가중치·정규화 방식이 근본적으로 다르므로(v2.1 §15 변경사항 표 참고) 병행 유지보다는 교체를 권장.
- M행렬(9×9), 앵커행렬(9×5), Monte Carlo 상수(`μ̂=0.5259, σ̂=0.0726, k=9.7056, δ=0.08`)는 `constants.ts`에 하드코딩하되, 출처(v2.1 문서 절 번호)를 주석으로 명시한다.
- `computeRomanticDnaV21()`은 두 사람의 `UserPsychProfile`을 입력받아 `{ dna_pct, S_B5, S_EN, S_ST, S_ATT }`를 반환하는 단일 진입점으로 설계한다 — UI 레이어는 이 함수 호출 결과만 소비하고 내부 수식을 알 필요가 없도록 캡슐화한다.

---

## 8. 마이그레이션 및 롤아웃

- **기존 베타 유저 데이터 처리 정책은 Claude Code가 임의 결정하지 말 것.** §2 조사에서 기존 완료 유저 수와 데이터 형태를 파악한 뒤, 다음 두 옵션을 사람에게 제시하고 결정을 구한다:
  - (a) 기존 애니어그램/성향 결과를 v2.1의 사후분포 초기값으로 마이그레이션하고 재인터뷰는 선택적으로 유도
  - (b) 전체 유저에게 신규 인터뷰 재응시를 요구
- Feature flag(예: `FEATURE_DNA_V21`)로 신규 로직을 게이팅하고, 기존 로직과 병행 가능한 구조로 최소 1단계는 배포할 것을 권장 — 특히 소규모 베타 단계이므로 롤백 용이성을 우선한다.

---

## 9. 테스트 계획

v2.1 문서에서 이미 **Python으로 정밀 검증된 수치**를 골든 테스트케이스로 그대로 이식한다 (수작업 재계산 금지, 아래 값을 정확히 재현하는지만 확인):

| 테스트 대상 | 입력 | 기대값 (v2.1 출처) |
|---|---|---|
| MBTI→Big5 초기값 16행 전체 | 각 MBTI 문자열 | v2.1 §2 표 (예: ISTJ→(.35,.65,.35,.35,.50)) |
| 애니어그램 코어 사전분포 | ENFP 예시 Big5 벡터 | v2.1 §5.4 (U_EN=0.969 산출 근거 확률분포) |
| 날개 결합확률 | b=(0.63,0.55,0.78,0.50,0.38) | 8w7 14.4%, 7w8 14.3%, 3w2 13.0% (§9.2) |
| 캐노니컬 커플 전체 파이프라인 | v2.1 §14의 A/B 프로필 전체 | `S_B5=0.410, S_EN=0.561, S_ST=0.758, S_ATT=0.584, DNA%=83.4` |
| 클리핑 경계 | z가 극단값일 때 | `DNA% ∈ [50,100]` 항상 성립 (unit test로 경계값 fuzzing) |

이 외에 §5(그리디 선택)·§6(조기종료)에 대해서는 시뮬레이션 기반 통합테스트(다양한 응답 패턴을 mock해 5분 캡 및 엔트로피 임계값 각각이 정상 트리거되는지)를 작성한다.

---

## 10. 완료 기준 (Definition of Done)

- [ ] 기존 온보딩 인터뷰가 §5 적응형 5분 인터뷰로 완전히 교체됨
- [ ] Big5·애착이 정규-정규 켤레 사후분포로, 애니어그램이 코어+날개 결합확률로 저장됨
- [ ] 커플 화면에서 "연애 DNA 일치율"이 v2.1 수식 기반 `DNA%`로 노출되고, 4개 부분점수 기여도 분해가 UI 설명에 활용 가능한 형태로 제공됨
- [ ] §9 골든 테스트케이스 전부 통과
- [ ] `calibration_version` 태깅이 결과 저장 시 누락 없이 기록됨
- [ ] 기존 기능(Aura, MoodFeed, VIP 등) 회귀 없음 — 특히 `twinResponseEngine.ts`와의 연동 지점(트윈이 인터뷰 진행자 역할을 겸하는 경우) 정상 동작 확인
- [ ] §8 마이그레이션 정책이 사람의 결정을 거쳐 확정·적용됨

---

## 11. 비목표 재확인

다음은 본 개정 작업 범위에서 명시적으로 제외한다. 작업 중 이 영역의 코드를 수정해야 할 필요가 발견되면, 먼저 사람에게 보고하고 별도 작업으로 분리할 것:

- Aura 색상 시스템 및 6축 HSL 계산
- HelixView, MoodFeed, Couple Wrapped
- VIP 프로모션(`vipPromotionService.ts`, `iapService.ts`)
- 카카오 데이터 온디바이스 추출 아키텍처 자체 (연동 지점 확인만 수행)
- `twinResponseEngine.ts`의 일상 대화 응답 로직 (인터뷰 진행자 역할과의 인터페이스만 확인)

---

*작업 순서 권장: §2 현황파악 → §3~§4 순수함수/데이터모델(테스트 우선 작성) → §5~§6 인터뷰 플로우/Edge Function → §7 궁합 엔진 → §9 전체 테스트 → §8 마이그레이션 결정 → 배포. 각 단계 완료 시 §9 골든 테스트케이스로 회귀를 확인하며 진행할 것.*
