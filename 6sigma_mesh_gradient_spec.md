# 6 Sigma 오라 그라데이션 — 구현 명세 (v2.7 전면 재작성)

> **이 문서는 v2.7 기준으로 전면 재작성됨. 이전 6-mesh 설계는 실제 구현 없이 폐기됨.**
> 과거 버전(v2.6 시절)은 6축 각각을 독립 hue로 삼아 `RadialGradient` 6개를 겹치는
> "메시 그라데이션" 배경을 설계했으나, 이 설계는 한 번도 구현되지 않았다. 실제로는
> 모든 소비처가 "6축 중 절댓값이 가장 큰 축 1개"만 골라 단색으로 쓰는 임시 로직에
> 머물러 있었다(`docs/Twin_me_MASTER_v2.7.md` §1.3 통합감사 발견 사항). v2.7은 이
> 축소 로직과 6-mesh 설계를 모두 폐기하고, 아래 3+3 그룹 합성 + 피벗 스윕 애니메이션
> 방식으로 새로 확정했다. 이 문서는 그 확정 사양과 실제 코드 매핑만 다룬다.

---

## 1. 색상 모델 — 6축 → 3+3 그룹 → RGB 채널 합성

(요약 출처: `docs/Twin_me_MASTER_v2.7.md` §1.3 — 상세 수식/근거는 그쪽이 단일 진실 공급원)

6축을 의미 단위로 두 그룹으로 나누고, 그룹마다 정확히 1색(HSL)을 합성한다. 결과는
"6색 메시"가 아니라 **웜톤(그룹 A) ↔ 쿨톤(그룹 B) 2색**이며, 이 두 색이 `colorA`/`colorB`로
그라데이션의 두 정지점이 된다.

| 그룹 | 코드 변수명 | 한국어 개념 | 담당 RGB 채널 |
|---|---|---|---|
| **A. Inner Warmth**(마음을 다루는 방식) | `expressiveness` | 감정 표현성 | R |
| | `attachmentSecurity` | 애착 안정성 | G |
| | `trustPace` | 신뢰 형성 속도 | B |
| **B. Outer Rhythm**(관계에서 움직이는 방식) | `conflictResponse` | 갈등 반응 | R |
| | `spontaneity` | 즉흥성/계획성 | G |
| | `independence` | 자율성/의존성 | B |

축 라벨은 반드시 위 코드 변수명 기준(`genesis.ts` / `auraEngine.ts` / `auraStoryPool.ts` /
`auraThemeEngine.ts` 전 파일 공통). 그룹 분리는 **색상 합성 단계에만** 적용되고, 베이지안
확률 갱신 자체(§3, `genesisInference.ts`)에는 영향을 주지 않는다.

각 축 점수(score ∈ [-1, +1])를 1차식으로 R/G/B(0~255)에 매핑한 뒤 합성 RGB → HSL 변환,
마지막으로 뮤트 파스텔 게이트(`saturation ≤ 92%`, `lightness 40~72%`, 그룹별 hue 안전
범위)로 클램핑한다. 정확한 계수/클램프 값은 MASTER §1.3 참조.

**적용 범위:** Deep Talk Night 공유 카드 배경, 제네시스 완료 후 스플래시 아우라 링,
트윈 프로필 아바타 배경 — 항상 `colorA`/`colorB` 2색을 함께 사용한다(v2.6의 "dominant
1축 단색" 방식은 폐기).

---

## 2. 피벗 기반 부채꼴 스윕 애니메이션

배경은 정적 2색 그라데이션이 아니라, 하루 중 태양 위치를 따라 천천히 회전각이
흔들리는(노을처럼 일렁이는) 오버사이즈 `LinearGradient`다. 구현은 3개 레이어로
나뉜다.

### 2.1 회전축(피벗)

- 컨테이너 **우측 상단에서 세로 10% 지점**(`PIVOT_X_RATIO = 1`, `PIVOT_Y_RATIO = 0.1`).
- 그라데이션 뷰는 화면 대각선의 2배 크기로 오버사이즈해, 피벗을 중심으로 회전해도
  네 모서리가 항상 뷰 밖으로 나가지 않게 한다.
- React Native는 `transformOrigin`을 지원하지 않으므로, 뷰 중심이 피벗과 겹치도록
  좌표를 `offsetLeft/offsetTop`으로 당겨 배치해 회전축을 흉내낸다.
- 기준각(`baseAngleDeg`)은 "피벗 → 목표 코너(좌하단)" 방향의 실제 화면 대각선
  각도에서, 그라데이션 자체의 대각선(정사각형이므로 항상 45°)을 뺀 값이다. 컨테이너
  리사이즈 시 `onLayout`으로 재계산된다.

### 2.2 t(-1~1) 자유도와 낮/밤 게이팅

- 회전각의 "기준각으로부터의 오프셋"을 만드는 자유도가 `t ∈ [-1, 1]`이다.
- 현재가 낮(일출~일몰)이면 다음 목표 `t`를 `[0, 1]`에서, 밤이면 `[-1, 0]`에서 랜덤으로
  뽑는다 — 즉 낮/밤 경계를 t=0에 고정해, 밤과 낮이 서로 다른 절반의 오프셋만 쓰도록
  게이팅한다.
- 목표 도달 시(`|target - current| < 0.01`) 새 목표를 재추출한다.

### 2.3 이동 속도

- t가 전체 구간(`-1 → 1`, 거리 2)을 주파하는 데 **3분(180초)**이 걸리는 고정 속도
  (`T_TRAVERSAL_SECONDS = 180`)로 움직인다. 목표까지 거리가 짧으면 그만큼 짧은
  시간에 도달한다(속도는 고정, duration은 거리에 비례).
- 150ms 간격 tick 루프에서 현재 t를 목표 방향으로 전진시키고, 도달 시점에 새 목표
  duration을 함께 계산해 Reanimated `withTiming`에 넘긴다.

### 2.4 span(부채꼴 폭) — 하루 4앵커 리듬

- `span`(3°~10°, `SPAN_MIN`/`SPAN_MAX`)은 t 오프셋에 곱해지는 배율로, 부채꼴 전체
  폭 역할을 한다(`boundaryAngleTargetDeg = t_target × span/2`).
- 하루 중 태양 위치 기준 4개 앵커 사이를 **코사인 이징**으로 보간한다:
  - 일출(sunrise) — MAX(10°)
  - 태양남중(solarNoon) — MIN(3°)
  - 일몰(sunset) — MAX(10°)
  - 태양자정(solar midnight, `suncalc`의 `nadir`) — MIN(3°)
- 1분 간격으로만 재계산(고빈도 갱신 불필요). 위치는 대전 좌표
  (`SUNCALC_LOCATION`)로 고정 — 추후 위치 권한 연동 시 이 상수만 교체.

---

## 3. 실제 구현 파일 매핑

| 파일 | 역할 |
|---|---|
| `src/hooks/useAuraDuskMotion.ts` | 로직 레이어. 태양 앵커 계산(`suncalc`), t 상태 머신(레이어 1+2), span 보간(레이어 3). 렌더링을 전혀 하지 않는 순수 훅 — `boundaryAngleTargetDeg`, `currentSpanDeg`, `moveDurationMs`, `isDaytime`만 반환한다. |
| `src/components/AuraDuskGradient.tsx` | 렌더러. `useAuraDuskMotion()`의 반환값을 받아 피벗 기준각(`baseAngleDeg`)을 계산하고, `Animated.View` + `expo-linear-gradient`로 오버사이즈 그라데이션을 회전시킨다. `reduceMotion=true`면 애니메이션 없이 기준각에 정적 고정. |
| `src/engine/auraEngine.ts` | 색 계산. 베이지안 확률 벡터 → 6축 점수(`computeAuraAxisScores`) → 3+3 그룹 RGB 합성(`composeGroupRgb`) → HSL 변환(`rgbToHsl`) → `AuraVector { colorA, colorB, axisScores }` 산출(`buildAuraVector`). |
| `src/engine/auraThemeEngine.ts` | 파스텔 게이트. `clampToMutePastelGate()`로 hue를 그룹별 안전 대역에 wrap-aware 클램핑, saturation/lightness 캡 적용. 화면별 `contextMultiplier`, 전역 오라 opacity, 추종 보간(η), 오버플로우 채도 피드백, Dissolve(무채색 보간)도 이 파일이 담당. |

---

## 4. 소비처 현황

같은 `AuraVector`(colorA/colorB)를 쓰지만, 화면 목적에 따라 소비 방식이 서로 다르다.

| 화면/컴포넌트 | 방식 | 색 출처 | 왜 이 방식인가 |
|---|---|---|---|
| `ClayTwinAvatar.tsx` | **정적 그라데이션** — `expo-linear-gradient` 대각선 1회 렌더 | `useTheme().primaryAuraColor` / `secondaryAuraColor` | 아바타는 여러 화면에 반복 노출되는 작은 UI 요소라, 화면마다 회전 애니메이션을 새로 도는 것은 낭비이자 시선 분산. 정적 2색 그라데이션으로 충분히 "오라"를 표현한다. |
| `invite-hook.tsx` | **정적 그라데이션, `useTheme()` 경유** | `useTheme().primaryAuraColor` / `secondaryAuraColor` | 이 화면은 `genesis.tsx`의 `handleStart()`(→ `setPersonaMatrix()`) 완료 **이후**에만 진입하므로, 마운트 시점엔 이미 스토어에 `personaMatrix.auraVector`가 반영돼 있다. `useTheme()`을 쓰면 `reduceAuraMotion`(오라 끄기) 오버라이드까지 자동으로 함께 적용되므로 별도 처리가 필요 없다. |
| `genesis.tsx` | **로컬 계산** — `buildAuraVector()`를 화면에서 직접 호출, `reduceAuraMotion`만 수동 오버라이드 | 로컬 `useMemo(buildAuraVector(bayesianState.probabilities))` | **`useTheme()`을 쓰지 않는 이유:** `useTheme()`은 스토어의 `personaMatrix.auraVector`를 읽는데, 이 값은 `handleStart()`가 실행돼야(=제네시스 완료 버튼을 눌러야) 채워진다. 세레모니 화면(오라 프리뷰)은 바로 그 버튼을 누르기 **전** 단계이므로, `useTheme()`으로 바꾸면 라이트 폴백이나 재인터뷰 시 이전 오라가 잘못 노출되는 회귀가 생긴다. 그래서 인터뷰 진행 중 실시간으로 갱신되는 베이지안 확률(`bayesianState.probabilities`)을 화면에서 직접 `buildAuraVector()`에 넣어 로컬로 계산하고, `reduceAuraMotion`(오라 끄기)만 `useTheme.ts`와 동일한 무채색(`SYS.TEXT_MUTED`)으로 별도 반영한다. |
| main 탭(`app/(tabs)/index.tsx`) | **`AuraDuskGradient` 실시간 애니메이션** | `personaMatrix?.auraVector`, `contextMultiplier = computeContextMultiplier('main')` | 메인 탭은 앱의 "거실"에 해당하는 상시 체류 화면이라, §2의 피벗 스윕 애니메이션(하루 리듬을 반영하는 노을 효과)을 온전히 보여줄 가치가 있는 유일한 위치. 다른 화면은 정적/부분 노출로 충분하지만, 메인 탭은 `contextMultiplier` 1.0(최대 가중치 축에 속함)로 오라를 가장 강하게 드러낸다. |

---

## 5. 참고

- `src/hooks/__tests__/useAuraDuskMotion.test.ts` — 앵커 보간, KST 자정 경계, t 상태 머신에 대한 유닛 테스트.
- 상세 화면별 `contextMultiplier` 표, 오라 끄기 정책, Dissolve 모션은 `docs/Twin_me_MASTER_v2.7.md` §1.3 원문 참조.
