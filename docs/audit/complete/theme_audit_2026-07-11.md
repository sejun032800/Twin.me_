# UI 통일감 전체 감사 — 라이트/다크 테마 일관성 검증 (2026-07-11)

## 목적
전체 소스코드(`app/(tabs)/*.tsx`, `app/(auth)/*.tsx`, `app/_layout.tsx`,
`app/(tabs)/_layout.tsx`, `src/components/**/*.tsx`, `src/hooks/useTheme.ts`,
`src/constants/colors.ts`)를 순회하며 라이트/다크 테마 원칙과 디자인 시스템에
위배되는 항목을 전수 조사한다. 코드 수정 없이 발견 → 분류 → 보고만 수행.

검사 항목: A(하드코딩 색상) · B(useTheme 우회) · C(테마 토큰 오용) ·
D(6-Sigma 아우라 테마 누락) · E(텍스트 대비 문제) · F(컴포넌트별 테마 누락) ·
G(아이콘/이미지 테마) · H(기타: StatusBar/SafeAreaView 등) — 20개 세부 항목.

---

## 🔴 HIGH

**[🔴 HIGH] app/(tabs)/chat.tsx:498 | C-9/E-13 테마 토큰 오용**
`room.locked && { color: '#555' }`가 `dmName`(기본값 `theme.text`)을 오버라이드.
locked 방 목록 행은 다크/시그마 테마에서 `theme.card`(`#1E293B`) 또는
`theme.bg`(다크) 위에 렌더링되는데 `#555`는 그 배경 대비 약 1.96:1로
WCAG AA(4.5:1) 대폭 미달 — 실질적으로 텍스트가 안 보임. 라이트 테마에서는
흰 배경 위라 우연히 정상 작동(≈7.5:1).
→ 권장: `theme.textMuted` 또는 `theme.border` 계열 토큰으로 교체.

**[🔴 HIGH] app/(tabs)/chat.tsx:503 | C-9/E-13 테마 토큰 오용**
`room.locked && { color: '#333' }`(`dmPreview` 오버라이드). 같은 배경 조건에서
`#333` vs `#1E293B` 대비는 약 1.16:1 — 다크/시그마 테마에서 사실상 카드와
구분 불가.
→ 권장: `theme.textMuted`에 opacity 조정(예: `theme.textMuted + '80'`) 또는
별도 disabled 토큰 도입.

---

## 🟡 MEDIUM

**[🟡 MEDIUM] app/(tabs)/_layout.tsx:24 | B-4 useTheme 우회**
`tabBarInactiveTintColor: themeMode === 'light' ? SYS.TEXT_MUTED : '#555'` —
`themeMode`를 직접 구독해 분기하고, 다크/시그마 분기 값은 `theme.textMuted`
(8줄에서 이미 계산된 `theme` 존재)를 안 쓰고 `'#555'` 하드코딩. 시그마 테마의
hue 기반 textMuted와 색조가 어긋남.
→ 권장: `theme.textMuted`로 교체, `themeMode` 구독 제거 가능.

**[🟡 MEDIUM] app/(tabs)/settings.tsx:285 | B-4/C-9**
`maximumTrackTintColor={themeMode === 'light' ? '#D0D0D0' : SYS.BG_DARK_MIDNIGHT}`
— Slider 트랙 색을 themeMode 직접 분기 + 하드코딩. 시그마 테마에서도 고정
`SYS.BG_DARK_MIDNIGHT` 사용돼 개인화 테마와 이질감.
→ 권장: `theme.border` 또는 `theme.bgSecondary`로 교체.

**[🟡 MEDIUM] src/components/InterviewCallModal.tsx:124,137,142,161,165,212,216 | F-15 부분 테마 적용**
`theme`를 import/사용하면서도 `safeArea`(124), `callerName`(137),
`callerSub`(142), `connectedText`(161), `actText`(165), `input`(212,216)은
전부 `SYS.BG_DARK_MIDNIGHT`/`SYS.TEXT_LIGHT`/`SYS.TEXT_MUTED`/`SYS.CARD_DARK`
고정값. 반면 `questionCard`/`questionText`(197,204)만 `theme.card`/`theme.text`
사용 — 같은 컴포넌트 안에서 테마 적용이 반반 섞여 라이트 테마 사용자에게는
"어두운 통화 화면 안에 흰 카드 하나만 떠 있는" 형태로 보임(콘텐츠 대비 자체는
깨지지 않으나 원칙 위반 + 시각적 이질감).
→ 권장: 통화 UI를 의도적으로 항상-다크로 갈 거면 `questionCard`/`questionText`도
`SYS.CARD_DARK`/`SYS.TEXT_LIGHT`로 통일하거나, 반대로 전체를 `theme.*`로 통일.

**[🟡 MEDIUM] app/(auth)/login.tsx:74,76 | F-15**
`container`/`input`이 `SYS.BG_DARK_MIDNIGHT`/`SYS.CARD_DARK`/`SYS.TEXT_LIGHT`
고정, `useTheme()` 미사용(파일 전체 0회 참조).
→ 권장: 재로그인 등으로 라이트 테마 사용자가 재진입 가능한 화면인지 확인 후
`useTheme()` 도입 여부 결정.

**[🟡 MEDIUM] app/(auth)/signup.tsx:70,72 | F-15**
login.tsx와 동일 패턴, `useTheme()` 미사용.
→ 권장: 상동.

**[🟡 MEDIUM] app/(auth)/join.tsx:86,92,101 | F-15**
연인 코드 입력 화면도 `SYS.BG_DARK_MIDNIGHT`/`SYS.CARD_DARK` 고정,
`useTheme()` 미사용. settings.tsx 등 이미 테마가 적용된 화면에서 진입할
가능성이 있는 화면이라 다른 auth 화면보다 불일치 체감 가능성 더 큼.
→ 권장: `useTheme()` 도입 검토.

**[🟡 MEDIUM] app/(auth)/kakao-upload.tsx:137,140,143 | F-15**
동일 패턴.
→ 권장: 상동.

**[🟡 MEDIUM] app/(auth)/splash.tsx:58 | F-15**
동일 패턴(단, 스플래시는 테마 로드 이전 시점이라 고정이 합리적일 수 있음 —
판단 필요).
→ 권장: 스플래시는 예외로 유지해도 무방, 다른 화면과 구분해서 검토 권장.

**[🟡 MEDIUM] app/(auth)/genesis.tsx:239,256,279,353 | F-15**
온보딩 인터뷰 전체가 `SYS.BG_DARK_MIDNIGHT`/`SYS.CARD_DARK` 고정,
`useTheme()` 미사용. 다만 이 화면은 sigma 테마 자체가 아직 생성되기 전
단계라 고정이 의도적일 가능성 높음.
→ 권장: 의도된 디자인이면 주석으로 명시 권장, 아니면 `theme` 적용.

**[🟡 MEDIUM] app/(auth)/welcome.tsx:53,57 | F-15**
최초 진입 화면, `SYS.BG_DARK_MIDNIGHT` 고정. 로그아웃 시 `resetSession()`으로
`themeMode`가 `'dark'`로 리셋되긴 하나, 리셋 로직과 이 화면의 고정값이
우연히 일치하는 구조라 결합도가 암묵적.
→ 권장: 명시적 의도라면 주석 추가 권장.

---

## 🟢 LOW

**[🟢 LOW] src/components/ClayTwinAvatar.tsx:15 | A-1**
`FACE_INK = '#33313D'` — SVG 클레이 아바타 이목구비 잉크 색, 일러스트 고유색이라
테마 무관이 합리적.
→ 권장: 유지 가능, 필요시 `ILLUSTRATION_INK` 같은 이름의 상수로 `colors.ts`에 승격.

**[🟢 LOW] src/components/StoryViewer.tsx:75,96,128,143,147,154,158 | A-1/A-2**
풀스크린 포토스토리 뷰어 전체가 `#000000`/`#FFFFFF`/`rgba(255,255,255,x)` 고정.
Instagram/Snapchat류 스토리 뷰어의 관례적 "항상 다크 크롬" 패턴이라 의도적일
가능성 높음.
→ 권장: 의도적이면 유지, 아니면 `theme` 도입.

**[🟢 LOW] src/components/InterviewCallModal.tsx:157,161,241 | A-1**
`'#4ADE80'`(통화 수신 그린) — 통화 UI 관례색(수락=초록/거절=빨강)이라 테마
무관이 자연스러움, 다만 상수 미정의.
→ 권장: `SYS`에 `CALL_ACCEPT_GREEN` 등으로 승격 고려.

**[🟢 LOW] app/(tabs)/settings.tsx:390, app/(tabs)/history.tsx:289 | A-1**
`Switch trackColor={{ false: '#333', ... }}` 하드코딩. 스위치 off-트랙
관례색이라 리스크 낮음.
→ 권장: `theme.border` 대체 가능.

**[🟢 LOW] app/(tabs)/chat.tsx:625,639, app/(auth)/join.tsx:65 | A-1**
`placeholderTextColor="#555"` 하드코딩. placeholder는 관례적으로 저대비
허용되는 영역.
→ 권장: `theme.textMuted` 대체 가능(완전성 목적).

**[🟢 LOW] app/(tabs)/chat.tsx:846,848,854 | A-1/A-2**
`sensitiveWarning`(민감정보 경고 배너) `rgba(255,200,0,0.15)`/`'#FFB800'`
하드코딩 — 시맨틱 경고색이라 테마 무관이 자연스러우나 토큰 미정의.
→ 권장: `SYS.WARNING_AMBER` 등으로 승격 고려.

**[🟢 LOW] 모달 백드롭 그룹 | A-2**
MagicMirrorModal.tsx:69, MasterQuestionModal.tsx:63, OOTDUploadSheet.tsx:189,
PartnerStatusBar.tsx:198, MuseSheet.tsx:100, OOTDArchiveGrid.tsx:153,161,
history.tsx:799, WrappedModal.tsx:102, settings.tsx:595 — `rgba(0,0,0,0.5~0.8)`
딤 배경 반복. 모달 스크림은 관례적으로 테마 무관 고정이 표준 패턴.
→ 권장: 공용 `MODAL_BACKDROP` 상수로 통합해 매직넘버 중복만 제거 권장.

**[🟢 LOW] src/components/OverflowBanner.tsx:18,23 | A-2**
`COPY` 테이블의 `bg: 'rgba(186,223,219,0.2)'`/`'rgba(239,68,68,0.1)'`이
`BRAND.MINT`/`SYS.CRISIS_RED`를 rgba 매직넘버로 재작성(주석에 출처는 명시돼
있음). 텍스트는 51줄에서 `theme.text`로 올바르게 처리돼 대비 문제는 없음.
→ 권장: 알파 헬퍼 함수(`withAlpha(BRAND.MINT, 0.2)`)로 리팩터링 고려.

**[🟢 LOW] app/(auth)/welcome.tsx:59,60,61 | E-13**
`guest`/`devBtn`/`devBtnText`가 `#555`/`#333`를 고정 다크 배경
(`SYS.BG_DARK_MIDNIGHT`) 위에 사용. 대비 약 2.65:1로 AA 미달이지만
"나중에 둘러볼게요"/개발용 버튼은 보조 링크 성격이라 즉각적 사용성 파괴는
아님.
→ 권장: `SYS.TEXT_MUTED`(`#888888`, 대비 ≈5.6:1)로 교체 시 AA 통과.

**[🟢 LOW] app/_layout.tsx:9,22,42 | B-4(형식상)**
`themeMode`를 직접 구독해 `StatusBar style`(42줄, `light`↔`dark` 콘텐츠 색상
자동 반전)과 `app/(tabs)/_layout.tsx` 24줄에 사용. StatusBar 쪽은 로직 자체가
올바르게 반전되어 있고(라이트일 때 `dark` 콘텐츠), theme 토큰으로 대체할
대상(StatusBar contentStyle enum)이 애초에 없어 불가피한 직접 구독.
→ 권장: 실질적 결함 아님 — 참고용으로만 기록.

**[🟢 LOW] src/components/ShareCard.tsx:52,61,73,82,87 | F-15**
공유 이미지 캡처 카드 전체가 `SYS.BG_DARK_MIDNIGHT` 고정, `useTheme()` 미사용.
공유용 이미지 카드는 브랜드 통일성을 위해 테마 무관 고정이 일반적 패턴.
→ 권장: 의도적이면 유지.

---

## D/G/H 카테고리 — 발견 없음

- **D (6-Sigma 분기 누락)**: `themeMode` 값은 실제로는 `'sigma'`(문항의
  `'6sigma'` 표기와 다름)이며, sigma 분기는 `useTheme()` 훅 한 곳에서 중앙
  처리되어 개별 컴포넌트가 별도로 분기할 필요가 없는 구조.
  `ClayTwinAvatar`/`useTheme()` 모두 `auraVector` 없을 때 폴백 존재
  (`NEUTRAL_CLAY_CHANNEL`, `getLightTheme()`) — undefined 리스크 없음.
- **G (아이콘/이미지)**: `Ionicons color` 전수 확인 결과 대부분
  `theme.text`/`theme.textMuted`/`BRAND.*`/`SYS.*` 토큰 사용, 하드코딩된 곳은
  위 InterviewCallModal(`SYS.TEXT_LIGHT`, 항상-다크 화면이라 정합) 외 없음.
- **H-19 (StatusBar)**: 로직 정상(라이트→`dark` 콘텐츠, 다크/시그마→`light`
  콘텐츠).
- **H-20 (SafeAreaView/KeyboardAvoidingView 배경)**: 전수 확인, 인라인
  하드코딩 배경 없음 — 모두 `styles.safeArea` 경유(테마 적용 화면은
  `theme.bg`, 고정-다크 화면은 해당 섹션의 일관된 고정값).
- **하드코딩 `'white'`/`'black'` 문자열 리터럴**: 전체 검색 결과 0건.

---

## 종합 요약

| 심각도 | 개수 |
|---|---|
| 🔴 HIGH | 2 |
| 🟡 MEDIUM | 10 |
| 🟢 LOW | 11 |
| **전체** | **23** |

## 참고 — 이번 대화에서 이미 수정 완료된 항목 (본 감사 이전)
- `app/(tabs)/settings.tsx` — `themeBtnUnselectedBg`/`themeBtnTextColor` 직접
  계산 제거, `theme.card`/`theme.text`로 교체.
- `app/(tabs)/chat.tsx:694` — `crisisDesc` 색상 `SYS.TEXT_LIGHT` →
  `theme.text`로 교체(라이트 테마 대비 문제 해결, WCAG AA 근거 주석 포함).

수정은 미실시 — 보고 전용 문서.
