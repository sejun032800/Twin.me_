# 6sigma 오라 시스템 종단(End-to-End) 감사 — 2026-07-18

STEP 1~11(엔진 → 조립 → 애니메이션 → UI 개편) 전체가 실제로 정상 동작하는지에 대한
종단 감사 결과. 이 감사에서 제품 코드(`app/`, `src/`)는 수정하지 않았다 — 유일하게
새로 만든 파일은 감사용 시뮬레이션 스크립트 `scripts/auraIntegrationCheck.ts` 하나다.

## 요약

| 항목 | 결과 |
|---|---|
| A. light/dark 회귀 없음 | ✅ **통과** |
| B. 데이터 흐름 종단 추적 (7단계) | ✅ **통과** (2건 참고사항, 버그 아님) |
| C. 자동 시뮬레이션 확장 | ✅ **통과** (1건 rigor 관련 참고) |
| D. 대비/접근성 재검증 (19조합) | ✅ **통과** — 19/19 |
| E. 테스트/타입 전체 재실행 | ✅ **통과** |

---

## A. light/dark 회귀 없음 재확인

**범위에 대한 정정**: `git diff`가 보여주는 건 이 6sigma 작업 중 **STEP 11 계열(11-1~11-7)**에서
미커밋 상태로 남은 변경뿐이다. STEP 1~10은 이전에 이미 커밋되어 있어(`git log`상 7/15~7/18
사이 커밋들, 특히 `auraEngine.ts`/`auraThemeEngine.ts`가 처음 만들어진 `6622deb`) diff로
다시 뽑을 수 있는 "이전 상태" 기준선이 없다. STEP 1-10은 diff가 아니라 **B 항목의 코드
추적**으로 현재 상태의 정합성을 검증했다.

미커밋 변경 파일 15개(+ 신규 4개) 전체를 라인 단위로 재확인한 결과:

| 파일 | light/dark 관련 변경 유무 |
|---|---|
| `app/(tabs)/index.tsx` | 없음 — light/dark JSX 블록을 `git show HEAD` 원본과 정밀 diff한 결과, `ShareCard`/`MasterQuestionModal`을 두 분기 밖으로 끌어올린 것 외 문자 단위로 동일 (이 두 컴포넌트는 각각 화면 밖 오프스크린 뷰·네이티브 Modal 포털이라 트리 위치가 픽셀에 영향 없음) |
| `app/(tabs)/chat.tsx`, `history.tsx`, `settings.tsx` | 없음 — 새로 추가된 조건문은 전부 `themeMode === 'sigma' ? X : 기존값` 형태이며 `else` 분기가 원래 무조건 값과 동일함을 라인별로 확인 |
| `AICoachingCard.tsx`, `MemoryRingSection.tsx`, `PartnerStatusBar.tsx` | 없음 — 동일한 `isSigma ? X : 기존값` 패턴, 역전(`!isSigma`) 오류 없음을 grep으로 재확인 |
| `DnaCompatibilityCard.tsx` | 없음 — sigma 분기가 기존 light/dark 로직보다 앞에서 early return하므로 light/dark 코드는 도달 경로 자체가 그대로 |
| `AuraDuskGradient.tsx` | light/dark에서 이 컴포넌트가 애초에 마운트되지 않으므로(모든 소비처에서 `themeMode==='sigma' &&`로 게이팅) prop 시그니처 변경은 영향 없음 |
| `useAuraDuskMotion.ts` | `frozen` 파라미터가 기본값 `false`인 옵셔널 추가라 기존 호출부(있었다면)와 동일 동작 |
| `useTheme.ts` | 유일한 실질 변경은 "`sigma`인데 `auraVector`가 없는" 엣지케이스의 폴백(`getLightTheme→getDefaultDarkTheme`)뿐 — `if (themeMode==='light')`/`if (themeMode==='dark')` 명시적 분기 자체는 diff에 등장하지 않음(미변경) |
| `sessionStore.ts` | `currentAuraScreenKey` 타입 변경뿐 — 이 필드는 어디서도 읽히지 않는 write-only 상태(grep 재확인)라 렌더링에 영향 없음 |
| `auraThemeEngine.ts`, `colors.ts` | 추가된 상수/함수는 sigma 전용 새 함수(`resolveSigmaAuraOpacity` 등)에서만 소비됨. `AURA_BASE_OPACITY.dark` 값 변경(0.12→0.25)도 소비처가 이 sigma 전용 함수 하나뿐임을 grep으로 확인 |
| `GlassPanel/Button/Ring`, `SigmaMainLayout.tsx` (신규) | light/dark에서 import조차 되지 않음(grep 재확인 — 실제 렌더 지점은 `SigmaMainLayout.tsx`와 `DnaCompatibilityCard.tsx`의 sigma 분기 둘뿐) |

**결론: 통과.**

---

## B. 데이터 흐름 종단 추적

| # | 단계 | 코드 경로 | 상태 |
|---|---|---|---|
| 1 | 제네시스 완료 → `auraVector` 저장 | `useGenesisInterview.ts:258-263`의 `finalizePersonaMatrix()`가 `buildAuraVector(bayesianState.probabilities)` 호출 후 `UserPersonaMatrix.auraVector`에 포함 → `genesis.tsx:115-116`의 `handleStart()`가 `setPersonaMatrix(matrix)`로 `userStore`에 커밋 | ✅ 연결됨 |
| 2 | `useTheme()`의 `primaryAuraColor`/`secondaryAuraColor` | `theme.ts:34-56` `buildSigmaTheme(auraVector)` → `hsl()` 헬퍼(내부적으로 `auraChannelToCss` 그대로 호출) | ✅ 연결됨 |
| 3 | `AuraDuskGradient`가 색을 받아 렌더링 | **참고**: `AuraDuskGradient`는 `useTheme()`의 `primaryAuraColor`를 받는 게 아니라, 각 화면에서 `personaMatrix?.auraVector`를 직접 읽어 prop으로 넘기고, 컴포넌트 내부에서 `auraChannelToCss(auraVector.colorA/colorB)`로 독립 변환한다. 2번과 같은 함수(`auraChannelToCss`)를 같은 원본 데이터에 적용하므로 결과값은 항상 동일하지만, "useTheme의 파생 필드를 받는다"는 설명과 실제 배선은 다르다 — 버그는 아니지만 아키텍처 설명과 실제 구현 사이의 괴리로 인지해 둘 것. | ✅ 연결됨 (경로는 병렬, 값은 동일) |
| 4 | `useAuraDuskMotion`의 각도/span/freeze → `AuraDuskGradient` 실제 반영 | 훅 레벨은 C-1 스크립트로 실행 검증. 컴포넌트 레벨(`cancelAnimation(rotation)`이 진행 중이던 Reanimated 트윈을 그 순간 각도에서 멈추는 부분)은 `react-native-reanimated`가 RN 런타임 의존이라 이 환경에서 실행 불가 — 정적 코드 추적만 가능. 이펙트 3개(`reduceMotion` 정적 고정 / `!frozen`일 때만 `withTiming` / `frozen`일 때만 `cancelAnimation`)의 의존성 배열과 가드 조건을 재확인, 논리적 모순 없음. | ✅ 연결됨 (훅: 실행검증 / 컴포넌트: 정적검증만) |
| 5 | 화면별 `AURA_OPACITY_TIERS`가 실제로 다른 값 | `useSigmaAuraOpacity(...)` 호출부를 전체 grep: `settings.tsx→'settings'`, `history.tsx→'historyMap'`, `chat.tsx→'chatList'`, `SigmaMainLayout.tsx→'mainHero'` — 복붙 실수 없이 각자 올바른 키. 실행 결과는 C-2 표 참고. | ✅ 연결됨 |
| 6 | Glass 컴포넌트가 sigma 전용 | 전체 grep 결과 실제 JSX 렌더 지점은 `SigmaMainLayout.tsx`와 `DnaCompatibilityCard.tsx`의 `if (themeMode==='sigma')` 분기 두 곳뿐. light/dark 경로에서 import되는 곳 없음. | ✅ 연결됨 |
| 7 | 이중 카드 제거 적용 | `AICoachingCard`/`PartnerStatusBar`의 `card.backgroundColor`가 `isSigma ? 'transparent' : theme.card`로 정확히 반영됨. `MemoryRingSection`은 애초에 `theme.card`를 쓴 적이 없어 "제거할 이중 카드가 없었다"는 이전 감사 결과를 재확인. | ✅ 연결됨 |

**7단계 중 orphan(연결 끊김)이나 조건 역전은 없다.** 3번 항목은 버그는 아니지만 설계 설명과
실제 배선이 다르다는 점만 참고.

---

## C. 자동 시뮬레이션 확장 (`scripts/auraIntegrationCheck.ts`, 신규)

기존 `preview:aura-day`가 쓰는 `ts-node`가 이 환경의 Node 24 ESM 해석과 충돌해 기존
스크립트조차 실행 안 되는 상태였다(별도 버그, `package.json`은 건드리지 않았고 `npx tsx`로
우회 실행). 참고로 남긴다.

### C-2. 화면키별 opacity

| screenKey | opacity |
|---|---|
| mainHero | 0.5 |
| chatList | 0.35 |
| historyMap | 0.3 |
| settings | 0.35 |

4개 화면키 중 `chatList`와 `settings`가 같은 값(0.35)이다 — **버그가 아니라 11-1에서 확정한
원래 스펙 그대로**(`AURA_OPACITY_TIERS`를 애초에 그렇게 정의함). 완전히 4개 전부 다른 값을
기대한다면 스펙 자체를 다시 논의해야 한다.

### C-1. 채팅방 진입 → 정지 → 퇴장 → 재개

`useAuraDuskMotion`을 `react-test-renderer`로 실제 마운트해 실행(재구현 아님), 실제
wall-clock 5초 대기:

| 시점 | boundaryAngleTargetDeg |
|---|---|
| 목록 화면(진입 전, 1초 경과) | 1.7186063008556256 |
| 방 진입 직후(frozen=true 전환) | 1.7186063008556256 |
| 5초 경과 후(frozen 유지) | 1.7186063008556256 |
| 퇴장 직후(frozen=false, 타이머 미진행) | 1.7186063008556256 |

`unchangedWhileFrozen: true`, `resumedFromFrozenPoint: true`.

**rigor 관련 참고**: 이 5초 창은 요청 스펙 그대로지만, `boundaryAngleTargetDeg`는 목표 도달
(최대 ~90초) 또는 span 재계산(60초)이 일어나야 바뀌는 값이라 — frozen이 아니었어도 5초
안에는 어차피 안 바뀔 가능성이 높다. 즉 이 5초 데모 자체는 "값이 고정됐다"를 보여주는
용도로는 좋지만, 그것만으로 freeze 메커니즘이 실제로 동작을 막았다는 증명으로는 약하다.
STEP 11-2에서 만든 Jest 테스트(5분 대기 + 가드를 일부러 제거해 테스트가 실패하는지 확인하는
네거티브 컨트롤 포함)가 이 메커니즘의 실질적 증거이고, 이번 스크립트는 실제 훅을 실행한
"라이브 데모"로 보면 된다. 두 검증 모두 정상.

전체 JSON 결과: `/tmp/aura-integration-check.json`

---

## D. 대비/접근성 재검증 (19조합)

9개 순수 에니어그램 유형 + 랜덤 10개(시드 고정 재현 가능 — "지난번 랜덤 10개"의 정확한 값은
이전 대화 기록에 없어 새로 생성했음, 투명하게 밝힘) = 19조합 전체를, 3개 opacity 티어
(0.5/0.35/0.3) × 그룹A/B에서 흰색 텍스트와 GlassRing 텍스트(`#F8F9FA`) 대비, SIGMA_ACCENT와의
hue 거리를 계산했다.

- **19/19 조합 모두 모든 opacity 티어에서 AA(4.5:1) 통과** — 최저치는 pure-type-7의 4.82:1
- **19/19 조합 모두 SIGMA_ACCENT hue 거리 15° 이상 유지** — 최저치는 pure-type-2의 44.8°
  (임의로 잡은 보수적 기준선이라 참고용)

기준 미달 조합 없음.

전제: BlurView의 실제 vibrancy 렌더링은 근사하지 않고 "블러 없이 오라 opacity만 배경에
합성"한 보수적 근사치다 — 실제 블러는 더 어둡게 만드는 경향이라 이 근사치보다 실제 대비가
더 좋을 가능성이 높다.

---

## E. 테스트/타입 전체 재실행

- `tsc --noEmit`: exit 0, 에러 0건 (신규 감사 스크립트 포함 전체)
- `jest`: 16 suites / 192 tests 전부 통과
- `expo-blur`: `package.json`에 `~15.0.8`로 설치 확인됨, `node_modules/expo-blur` 존재 확인

---

## 코드 수정 범위

이번 감사에서 건드린 파일은 `scripts/auraIntegrationCheck.ts`(신규) 하나뿐이며, `app/`·`src/`
기존 제품 코드는 전혀 수정하지 않았다.
