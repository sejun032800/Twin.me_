# Twin.me — 통합 기능 명세서 (SRS) MASTER

**Product Version:** 2.6 (엔진 파일 교차 감사 + 색상 아키텍처 확정 + 이식 명세 통합)
**Target Platform:** React Native (iOS / Android, Expo Managed Workflow)
**문서 일자:** 2026.07.05

### 기술 스택 확정 (v2.6) — 클로드 코드 구현 기준

| 항목 | 확정값 |
|---|---|
| 프레임워크 | React Native (Expo Managed Workflow) |
| 라우팅 | expo-router (파일 기반) |
| 개발 테스트 | Expo Go |
| 빌드/출시 | EAS Build |
| iOS 출시 | App Store (Bundle ID: `me.twin.app`) |
| Android 출시 | Google Play (Package: `me.twin.app`) |
| 백엔드 | Supabase (인증, DB, Realtime, Edge Functions) |
| LLM 호출 | Supabase Edge Function 프록시 경유 — 클라이언트 API 키 노출 금지 |
| 로컬 영속화 | AsyncStorage (엔진 상태, 페르소나, 말투 벡터) |
| 상태 관리 | Zustand (도메인별 store — AppContext 대체) |
| 구독/결제 | react-native-iap (IAP) |
| 애니메이션 | react-native-reanimated |
| 그라데이션 | expo-linear-gradient |
| 햅틱 | expo-haptics |
| 공유/캡처 | react-native-view-shot |

> **플랫폼 원칙:** 단일 코드베이스로 iOS/Android 동시 출시. 플랫폼별 분기(`Platform.OS`)는 최소화하고 Expo API로 통일. 웹 빌드는 지원하지 않는다.

> ⚠️ **전사 하드 제약 — 절대 위반 금지:**
> 1. **React Native 전용** — 웹 전용 API(`document`, `window` 등) 사용 금지. 모든 UI/로직은 React Native 컴포넌트로 작성.
> 2. **Expo Go 호환 필수** — 개발 중 모든 코드는 Expo Go로 즉시 테스트 가능해야 한다. Native Module이 필요한 라이브러리(Expo Go 미지원)를 추가할 때는 반드시 나에게 먼저 확인받아라.
> 3. **iOS + Android 동시 출시** — 한쪽 플랫폼에서만 동작하는 코드 작성 금지. EAS Build로 두 플랫폼 동시 빌드·출시가 가능한 구조를 유지한다.
**문서 성격:** `Twin.me(0630).md` + 이후 전체 스프린트 산출물(UI 색상 시스템 재설계, 신규 기능, 정합성 감사 수정사항)을 **완전 통합**한 단일 정본(Single Source of Truth). 본 문서 발효 이후 하위 모든 분산 문서(`Twin.me.md`, `Twin_me_0630_.md`, `Twin_me_UI.md`, `Chat_logic.md`, `Twin_response_logic.md`, `matching_algorithm_v2_2.md`, `genesis_interview.md`, 개별 스프린트 구현 프롬프트)는 참조 전용 보관. 충돌 시 **본 문서가 절대 우선**한다.

---

## 목차

0. 서비스 개요 및 핵심 철학
1. 디자인 시스템 & 컬러 아키텍처 ← **v2.6 확정**
2. 온보딩 및 데이터 가공 모듈
3. 메인 탭 — 연애 대시보드
4. 채팅 탭 — 트윈/거울/분석가 모듈
5. 일치율 코어 엔진 v2.2 ← **v2.6 보강**
6. 주간 리포트 및 페이월 시스템
7. 히스토리 탭 모듈
8. 설정 탭 — 프라이버시 컨트롤
9. 플랜 및 구독 정책
10. 플랜별 공유 카드 및 바이럴 엔진
11. 커플 Wrapped & 기념일 결산
12. 구현 우선순위 및 리스크 관리
13. 변경 이력
14. 이식 엔진 파일 명세 ← **v2.6 신규**

---

## 0. 서비스 개요 및 핵심 철학

### 0.1 기본 정의

Twin.me는 연인 간의 갈등에 개입해 답변을 대신 작성하거나 상대방의 심리를 재단하는 **'대리인(Agent)'이 아니다.** 오직 유저 개인이 자신의 대화 습관을 객관적으로 돌아보게 만드는 **'거울(Mirror)'**이자, 휘발되는 대화 속에서 연인이 건넨 다정한 말들을 보존하는 **'감성 아카이브(Archive)'**다.

### 0.2 가치 제안

타인을 염탐·통제하는 것이 아닌, 내 말투를 그대로 복제한 가상의 분신과의 대화를 통해 나의 소통 패턴을 성찰하고 성숙한 관계를 빚어내는 감성적 자가 성장의 경험.

1. 상대방 모르게 '나 혼자 보는' 은밀한 연애 오답 노트 및 대화 매너 교정 (싱글플레이어 가치).
2. 대화 더미 속에서 가장 다정한 문장을 추출해 박제하는 감성 아카이브.

### 0.3 싱글플레이어 원칙 (전사 공통 제약)

연인의 동의·연동 없이 혼자서도 100%의 가치를 경험한다. **모든 핵심 기능(트윈/거울방, 일치율, 리포트)은 연인 미가입 상태에서도 단독 작동해야 한다.**

### 0.4 핵심 데이터 칩 (DB 설계 원칙)

| 데이터 칩 | 내용 |
|---|---|
| `User_Tone_Vector` | 카톡에서 추출한 문체, 시그니처 드립, 종결어미, 이모티콘 패턴 |
| `User_Persona_Matrix` | 제네시스 인터뷰 + MBTI/애니어그램으로 정제된 심리·방어기제 점수 + 6색 오라 벡터 |
| `Shared_Memory_DB` | `Couple_ID`로 격리된 둘만의 벡터 DB — 대화 맥락, 위시리스트, 장소 정보 |
| `AuraVector` | 6축 성향 점수 → 개인 오라 테마 색상 매핑 |

### 0.5 영구 폐기 항목 — 재논의 금지

- 연인의 말투를 학습해 연인을 흉내 내는 AI 분신 구조
- 연인 AI와 사용자가 대화하는 구조
- 상대방의 속마음을 사용자에게 일러바치는 브리핑 리포트
- 보이스 클로닝 (상대방 음성 복제)

**폐기 근거:** "AI로 애인 대체" 및 "염탐" 프레임은 거울 철학과 정면 충돌하며 PR·법적 리스크를 유발한다.

### 0.6 Supabase 아키텍처 ★ v2.6 확정

백엔드는 **Supabase** 단일 스택으로 통일한다.

| 역할 | Supabase 서비스 | 비고 |
|---|---|---|
| 인증 | Supabase Auth (이메일/소셜) | 커플 연동은 invite code 기반 |
| DB | Supabase Postgres | `Couple_ID` 격리 RLS 정책 적용 |
| 실시간 | Supabase Realtime | 일치율 점수 실시간 동기화 |
| LLM 프록시 | Supabase Edge Functions | 클라이언트 API 키 노출 금지 — 모든 LLM 호출 경유 |
| 파일 저장 | Supabase Storage | 공유 카드 이미지, OOTD 사진 |

**클라이언트 SDK:** `src/lib/supabaseClient.ts` — `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` 환경변수 사용. Anon Key는 공개 가능(RLS로 보호). Service Role Key는 절대 클라이언트에 포함 금지.

**Edge Function 호출 패턴 (LLM 프록시):**
```typescript
// src/api/llm.ts — 새 코드베이스 표준 패턴
const { data, error } = await supabase.functions.invoke('llm-route', {
  body: { systemPrompt, userContext, temperature, maxTokens }
});
```

---

## 1. 디자인 시스템 & 컬러 아키텍처 ★ v2.5 신규 정의

> 이전 버전의 모든 색상 정의(네온 바이올렛 계열 등)는 이 장으로 완전 대체된다. 충돌 시 본 장 우선.

### 1.1 2-레이어 컬러 아키텍처

컬러 시스템은 두 개의 독립된 레이어로 구성된다.

- **Layer 1 — 브랜드 팔레트 (고정 구조층):** 앱 전체 UI 구조와 상호작용에 사용. 불변(Immutable).
- **Layer 2 — 오라 테마 (개인화 감성층):** 제네시스 인터뷰 결과로 자동 배정. 개인마다 다름.

### 1.2 Layer 1: 브랜드 팔레트 (Brand Palette)

앱의 뼈대를 이루는 4색 고정 팔레트. **그라데이션은 Mint → Cream → Pink → Coral 방향으로만 흐른다.**

| 토큰 | 색상값 | 용도 |
|---|---|---|
| `MINT` | `#BADFDB` | 그라데이션 시작점. 로고, DNA 링, 스플래시, 프리미엄 배너 시작색 |
| `CREAM` | `#FCF9EA` | 그라데이션 2번째. 카드 배경, 오프화이트 기반 라이트 모드 |
| `PINK` | `#FFBDBD` | 그라데이션 3번째. 강조 액센트 |
| `CORAL` | `#FFA4A4` | 그라데이션 끝점. **버튼, 토글, 세그먼트 thumb 등 인터랙티브 솔리드 컬러** |
| `CORAL_DEEP` | `#E07A82` | Coral 보다 진한 딥 코랄. 프레스 상태, 선택된 탭 강조 |

**텍스트 규칙:** 브랜드 팔레트 배경 위에는 **흰색(#FFFFFF) 또는 검정(#1A1A1A) 텍스트만** 사용. 브랜드 컬러 텍스트 사용 금지.

**그라데이션 사용 제한:** 시그니처 요소(로고·DNA 링·일치율 숫자·스플래시·프리미엄 스토어 배너)에만 허용. 일반 버튼·칩·토글에는 솔리드 Coral 사용.

### 1.3 Layer 2: 6축 오라 시스템 (Aura System)

제네시스 인터뷰 베이지안 추론 결과에서 **결정론적으로** 자동 도출. 사용자마다 유일한 조합.

> **v2.6 색상 정책 확정 — 고정 hex 방식 폐기:**  
> 오라 색상은 `src/engine/auraEngine.ts`의 HSL 수식이 단일 진실 공급원이다. 베이지안 확률 벡터 → 축 점수 → HSL 변환의 결정론적 파이프라인으로 산출된다. 이전에 명시했던 고정 hex 값(Deep Rose `#D98090` 등)은 **폐기**한다. 인터뷰가 진행될수록 특정 에니어그램 유형으로 확률이 수렴하면서 오라 색이 부드럽게 또렷해지는 것이 핵심 감성 연출이다.

#### 6축 정의 (코드 변수명 기준 — 단일 진실 공급원)

| 코드 변수명 | 한국어 개념 | 축 방향 A (score=-1) | 축 방향 B (score=+1) | 기준 Hue |
|---|---|---|---|---|
| `attachmentSecurity` | 애착 안정성 | 신중하게 곁을 내주는 | 단단하게 곁을 지키는 | 210° (Blue) |
| `conflictResponse` | 갈등 반응 | 갈등 앞에서 여백을 두는 | 갈등 앞에서 직진하는 | 15° (Red-Orange) |
| `expressiveness` | 감정 표현성 | 감정을 차분히 담아두는 | 감정을 풍부하게 표현하는 | 320° (Magenta-Pink) |
| `independence` | 자율성/의존성 | 함께하는 시간을 우선하는 | 자기만의 시간을 우선하는 | 165° (Teal) |
| `spontaneity` | 즉흥성/계획성 | 꼼꼼하게 계획하는 | 자유롭게 즉흥적인 | 45° (Gold) |
| `trustPace` | 신뢰 형성 속도 | 천천히 마음을 여는 | 빠르게 마음을 여는 | 265° (Violet) |

> **주의:** 축 라벨은 반드시 위 코드 변수명을 기준으로 사용한다. `genesis.ts`, `auraEngine.ts`, `auraStoryPool.ts`, `auraThemeEngine.ts` 전 파일이 이 6개 변수명으로 연동되어 있다. UI 텍스트·주석·문서에서 다른 이름(예: "불안-회피 애착", "논리-분석" 등)을 사용하면 충돌이 발생한다.

#### HSL 색상 산출 수식

```
hue        = AXIS_BASE_HUE[axis] + score × 15   (mod 360)
saturation = 55 + |score| × 35                  (중립 55% → 극단 90%)
lightness  = 55 + score × 8                     (방향에 따라 미세 톤 변화)
```

**뮤트 파스텔 게이트 (강제 상한):** saturation ≤ 92% / lightness 40~72% 범위를 벗어나지 않도록 `auraThemeEngine.clampToMutePastelGate()`로 클램핑. 오버플로우 피드백 상황에서도 이 범위를 초과하지 않는다.

**오라 적용 범위:** Deep Talk Night 공유 카드 배경, 제네시스 완료 후 스플래시 화면 아우라 링, 트윈 프로필 아바타 배경.

**화면별 오라 강도 (contextMultiplier):**

| 화면 | 가중치 | 비고 |
|---|---|---|
| `main` | 1.0 | 기본 |
| `helix` | 1.3 | DNA 나선 뷰 — 가장 강하게 |
| `settings` | 0.8 | — |
| `chat` (연인방) | 0.6 | — |
| `chat` (트윈방) | 0.72 | chat × 1.2 부스트 |
| `historyMap` | 0.5 | — |
| `other` (온보딩/auth) | 0.0 | 인터뷰 몰입 방해 방지 — 오라 완전 미노출 |

**추종 보간 (Universal Easing):** `value_display ← value_display + η × (value_target − value_display)`, η = 0.1. Reanimated `withTiming` 기반으로 근사.

**오라 끄기:** 설정에서 오라 줄이기/끄기 토글 제공. 끄기(`reduceAuraMotion=true`) 시 opacity=0 → 정적 스냅샷 배경으로 폴백. WCAG 명도 대비 표준 충족. Dissolve 모션 적용 시 `NEUTRAL_CLAY_CHANNEL` (hue:230, sat:6, light:55) 무채색으로 보간.

### 1.4 배경 및 시스템 컬러

| 토큰 | 색상값 | 용도 |
|---|---|---|
| `BG_DARK_MIDNIGHT` | `#0A0D1A` | 다크 모드 메인 배경 (스플래시, 딥 인디고 배너) |
| `BG_LIGHT_SNOW` | `#F8F9FA` | 라이트 모드 메인 배경 |
| `CARD_LIGHT` | `#FFFFFF` | 라이트 모드 카드·말풍선 |
| `CARD_DARK` | `#1E293B` | 다크 모드 카드·말풍선 |
| `BADGE_AI` | `#5FB3A8` | AI 룸 구분 뱃지 (Teal-Mint 계열, 인간과 시각 분리) |
| `CRISIS_RED` | `#EF4444` | Crisis Mode 경보 배경 펄스 |

### 1.5 타이포그래피

| 역할 | 서체 | 용도 |
|---|---|---|
| Display / 대제목 | Noto Serif CJK KR | 티어 칭호, 시그니처 문장, 카드 대형 타이틀 |
| Body | Noto Sans CJK KR | 본문, UI 레이블, 설명 텍스트 |
| 숫자 강조 | `tabular-nums` + `-1px` letter-spacing | 일치율 숫자 (e.g. `74.2%`) |

**점수 포맷 규칙:** 모든 `currentScore` 출력은 `.toFixed(1)` 문자열 바인딩 고정.

### 1.6 레이아웃 & 내비게이션

- 하단 고정형 4탭 바 (Tab Bar)
- 탭 스위칭: 터치 + 좌우 스와이프 제스처 지원, 하드웨어 가속 트랜지션
- 라이트 모드 기본. 다크 모드 선택 지원.

### 1.7 `colors.ts` 구현 스펙 ★ v2.6 신규 — 클로드 코드 구현 기준

`src/constants/colors.ts`를 새 코드베이스의 단일 색상 진실 공급원으로 작성한다. 컴포넌트는 이 파일의 토큰만 참조하며, 직접 hex 하드코딩을 금지한다.

```typescript
// src/constants/colors.ts

// ── Layer 1: 브랜드 팔레트 (불변) ────────────────────────────────────────────
export const BRAND = {
  MINT:        '#BADFDB',
  CREAM:       '#FCF9EA',
  PINK:        '#FFBDBD',
  CORAL:       '#FFA4A4',
  CORAL_DEEP:  '#E07A82',   // 프레스 상태, 선택된 탭
} as const;

// ── Layer 1: 배경 & 시스템 컬러 ───────────────────────────────────────────────
export const SYS = {
  BG_DARK_MIDNIGHT: '#0A0D1A',   // 다크모드 메인 배경, 스플래시, 딥 인디고 배너
  BG_LIGHT_SNOW:    '#F8F9FA',   // 라이트모드 메인 배경
  CARD_LIGHT:       '#FFFFFF',
  CARD_DARK:        '#1E293B',
  BADGE_AI:         '#5FB3A8',   // AI 룸 구분 뱃지
  CRISIS_RED:       '#EF4444',   // CrisisMode 배경 펄스
  TEXT_DARK:        '#1A1A1A',
  TEXT_LIGHT:       '#FFFFFF',
} as const;

// ── Layer 2: 오라 시스템 — 기준 hue 상수만 노출, 실제 색상은 auraEngine이 계산 ──
export const AURA_BASE_HUE = {
  attachmentSecurity: 210,
  conflictResponse:   15,
  expressiveness:     320,
  independence:       165,
  spontaneity:        45,
  trustPace:          265,
} as const;

// ── 그라데이션 (시그니처 요소 전용) ────────────────────────────────────────────
export const GRADIENT = {
  // 방향: Mint → Cream → Pink → Coral (135deg)
  BRAND_STOPS: [BRAND.MINT, BRAND.CREAM, BRAND.PINK, BRAND.CORAL] as const,
  BRAND_ANGLE: 135,
} as const;

// ── 다크모드 토큰 override ──────────────────────────────────────────────────────
export function getBg(isDark: boolean) {
  return isDark ? SYS.BG_DARK_MIDNIGHT : SYS.BG_LIGHT_SNOW;
}
export function getCard(isDark: boolean) {
  return isDark ? SYS.CARD_DARK : SYS.CARD_LIGHT;
}
export function getText(isDark: boolean) {
  return isDark ? SYS.TEXT_LIGHT : SYS.TEXT_DARK;
}
```

**컴포넌트 색상 적용 규칙:**

| 용도 | 토큰 |
|---|---|
| 인터랙티브 버튼(솔리드) | `BRAND.CORAL` |
| 버튼 프레스/선택된 탭 | `BRAND.CORAL_DEEP` |
| 카드 배경 | `getCard(isDark)` |
| 메인 배경 | `getBg(isDark)` |
| 시그니처 그라데이션 | `GRADIENT.BRAND_STOPS` (로고·DNA링·일치율 숫자·스플래시·프리미엄 배너에만 허용) |
| 일반 버튼·칩·토글 | 솔리드 `BRAND.CORAL` — 그라데이션 사용 금지 |
| 텍스트 | `getText(isDark)` — 브랜드 컬러 텍스트 사용 금지 |
| AI 룸 구분 뱃지 | `SYS.BADGE_AI` |
| CrisisMode 배경 | `SYS.CRISIS_RED` |

---

## 2. 온보딩 및 데이터 가공 모듈

### FUN-ONB-001 — 기초 정보 입력 및 커플 매칭

**정의:** 유저 가입 및 초대코드를 통한 1:1 커플 격리 서버 생성.

**UI 연출:** `BG_DARK_MIDNIGHT`(`#0A0D1A`) 배경, 토스 스타일 미니멀 입력 폼. 초대코드 입력 포커싱 시 테두리에 은은한 Coral 글로우 효과. 매칭 성공 시 두 DNA 나선이 화면 좌우에서 중앙으로 자석처럼 결합하는 햅틱 진동 연출.

**상세 로직:**
- 인증 완료 후 이름, 성별, MBTI, 애니어그램 유형(모를 경우 '모름' 체크) 수집.
- 선가입 유저(A)에게 Unique ID 기반 8자리 초대코드 생성 및 카카오톡 공유 기능 제공.
- 상대 유저(B) 코드 입력 시, 두 유저를 `Couple_ID`로 묶고 독립된 격리 네트워크(`Shared_Memory`) 할당.

### FUN-ONB-002 — 온디바이스 카톡 말투 학습

**정의:** 카카오톡 .txt 대화 파일을 안전하게 전처리하여 내 말투 유전자 추출.

**UI 연출:** 게이지 바가 차오르며 "개인정보 보호를 위해 기기 내부에서 상대방 대화 파기 중..." 문구 노출. 완료 시 시그니처 드립 TOP 3 카드 슬라이드 업.

**상세 로직:**
- iOS: 공식 단축어 매크로를 통한 자동 백업 및 파일 전송.
- Android/수동: 유저가 직접 내보낸 .txt 파일 인앱 업로드.
- **정형 파싱 (로컬 엔진):** 클라이언트 단에서 `[상대방 이름]`으로 시작하는 행 전체를 무조건 Drop. 전화번호·계좌번호 등 민감정보 마스킹(`***`).
- **말투 추출:** 본인 텍스트에서 자주 쓰인 감탄사·어미·비속어 빈도 분석 → `User_Tone_Vector` 빌드.
- **rawKakaoText 처리 (프라이버시 아키텍처):** 원본 파일에서 '기억할 만한 한 문장' 1개를 온디바이스 룰 기반으로 추출(웜 톤 90% / 재미있는 문장 10% 가중). 추출 직후 원본 .txt는 기기·서버에서 즉시 영구 파기. 추출된 1문장만 `rawKakaoText`로 저장.
- `User_Tone_Vector` 상세 스키마 및 수식은 `Chat_logic.md` 참조 (해당 문서는 이 SRS의 기술 부록).

### FUN-ONB-003 — 표층 즉시 분석 (D0 아하 모먼트)

**정의:** 카톡 업로드 직후 30초~1분 내, 데이터가 적어도 즉시 결과를 보여주는 표층 패턴 분석. LLM 호출 없음, 순수 로컬 처리.

**사용 지표:**

| 지표 | 추출 방법 |
|---|---|
| 종결어미 빈도 | 정규식 분석 (~음, ~네, ~ㅎㅎ 등) |
| 이모티콘/이모지 사용률 | 단순 카운팅 |
| 평균 답장 속도 | 타임스탬프 차이 계산 |
| 평균 메시지 길이 | 글자 수 카운팅 |
| 웃음 표현 빈도 | "ㅋㅋ", "ㅎㅎ" 패턴 매칭 |

**출력 예시:**
- "당신은 평균 12초 안에 답장합니다. 전국 상위 8% 빠른 응답 속도예요."
- "'ㅋㅋ' 대신 'ㅎㅎ'를 선호하는군요. 부드러운 사람으로 보일 가능성이 높아요."

### FUN-ONB-004 — Instagram DM 데이터 연동 ★ 신규

**정의:** 카카오톡 외 인스타그램 DM 대화 데이터를 추가 말투 학습 소스로 활용.

**UX 흐름:**
1. 인앱 스텝별 안내 모달 (Instagram 설정 → 데이터 다운로드 경로 스크린샷 가이드).
2. 유저가 다운로드한 `.zip` 파일 인앱 업로드.
3. 48시간 대기 상태 관리 + 푸시 알림 리마인더 발송.
4. `.zip` 파싱 → 기존 카카오톡 파이프라인과 동일 프로세스 적용 (내 발화만 추출, 상대방 발화 즉시 Drop).

**주의:** UX 플로우 디테일은 추가 설계 필요. 현재 개발 대기 상태.

---

## 3. 메인 탭 — 연애 대시보드

### FUN-HOM-001 — 정확도 배너 및 제네시스 인터뷰 퀘스트

**정의:** 가입 직후 AI 초기 상태를 고지하고 심층 인터뷰 참여 유도.

**UI 연출:** `BG_DARK_MIDNIGHT` 딥 인디고 배경, 은은한 Coral 톤 50% 진행 바 배너. 완료 시 배너가 연기처럼 파티클 증발하며 영구 소멸.

**인터뷰 완료 게이팅:** 인터뷰 미완료 상태에서 점수 상한선 고정 (§5 참조).

**상세 로직:**
- 카톡 업로드 초기: "현재 AI 정확도: 50%" + `[🎙️ 제네시스 인터뷰로 정확도 95% 올리기]` 버튼.
- 터치 시 전화 수신 풀스크린 UI 전환 → 음성 인터뷰(Realtime API/STT) 세션 개시.
- 4막 구조(소개→탐색→심화→마무리), 베이지안 추론으로 MBTI×에니어그램 Confidence 갱신.
- 완료 시 정확도 95% 해제, 배너 소멸. 지표는 설정 탭 [마이 트윈 AI 관리 센터]로 이식.

**제네시스 인터뷰 상세 명세는 §부록 G 참조.**

#### 점토 성장 4단계 전환 조건 ★ v2.6 신규 명세

인터뷰 진행 중 화면 중앙의 점토 오브젝트가 4단계로 성장한다. 전환 트리거는 `BayesianState.confidence` 기준.

| 단계 | `ClayStage` | 라벨 | 전환 트리거 | 햅틱 |
|---|---|---|---|---|
| 0 | `0` | 무정형 점토 | 초기 상태 (카톡 업로드 완료 시) | — |
| 1 | `1` | 쿠키 실루엣 | confidence ≥ 0.35 (첫 가설 형성) | 경량 |
| 2 | `2` | 입체화 | confidence ≥ 0.65 (가설 안정) | 중간 |
| 3 | `3` | 나의 트윈 | `shouldStopEarly()` = true (confidence ≥ 0.85 && margin ≥ 0.25) | 강한 더블 탭 |

**UI 연출:** 각 단계 전환 시 오라 메시 그라데이션이 현재 `AuraVector`로 흐르며 점토에 채색. 재인터뷰/리셋 시 `dissolveMeshStops(meshStops, t)` 함수로 무채색 점토(`NEUTRAL_CLAY_CHANNEL`)로 Dissolve 모션 적용.

**MVP 구현:** 실시간 3D 모핑 대신 단계별 Lottie 에셋 전환 또는 SVG 일러스트 교체로 구현. 3D 렌더러 미도입.

### FUN-HOM-002 — 실시간 상태 바 & 추억 링

**정의:** 상대방의 실시간 컨텍스트 파악 및 과거 데이트 아카이빙.

**UI 연출:** X(트위터) 트렌드 해시태그 스타일 좌우 슬라이드형 텍스트 칩 바 + 인스타 스토리 하이라이트 형태 동그란 링 아카이브. 링 테두리는 Mint→Coral 그라데이션.

**상세 로직:**
- 연인 AI가 백그라운드 분석한 상대 현재 상태를 해시태그로 실시간 노출 (예: `#오늘부장님잔소리폭발`).
- 추억 링 터치 시 해당 데이트 베스트 컷·OOTD 피드 노출.

**구현 주의:** `PartnerStatusBar`(실시간 해시태그 바)는 `FUN-HOM-002`와 `FUN-HOM-002B`(오버플로우 배너)를 별도 컴포넌트로 분리해야 한다. 코드 주석에서 두 ID가 혼재되어 있는 경우 분리 처리.

### FUN-HOM-002B — 오버플로우 알림 배너

**정의:** v2.2 일일 등락 포화 캡 초과 이벤트 발생 시 홈 최상단 배너 경보.

| 상태 | 배너 | 카피 | 액션 |
|---|---|---|---|
| `CRITICAL_LOSS` | 네온 와인 그라데이션 보더 바 | "오늘 두 분의 대화 온도는 임계점을 넘었습니다. 지금 즉시 거울을 켜세요." | `[🪞 내 대화 복기하기]` → FUN-CHA-003 강제 연동 |
| `EXCESS_GAIN` | 핑크 하트 펄스 애니메이션 | "오늘 다정함이 일일 학습 한도를 초과했습니다 💖 추억 월에 박제해 보세요." | `[📸 예쁜 말 수집하러 가기]` → 추억 탭 폴라로이드 월 |

### FUN-HOM-003 — 10단계 연애 DNA 마스터 티어

**정의:** `currentScore`를 5% 구간으로 매핑하여 10단계 마스터 티어 타이틀과 전용 테마 연동.

**UI 표기 제약:** 모든 스코어는 `.toFixed(1)` 문자열 바인딩 고정 (예: `74.2%`).

**10단계 티어 매트릭스:**

| 구간 | 칭호 | 테마 |
|---|---|---|
| 95.0~100.0% | 환상 속의 신화적 결합 | 골드 오로라 |
| 90.0~94.9% | 영혼까지 닮은 도플갱어 | 딥 퍼플 |
| 85.0~89.9% | 기적의 소울메이트 | 딥 퍼플 |
| 80.0~84.9% | 눈빛만 봐도 아는 사이 | 라벤더 하트 |
| 75.0~79.9% | 달달한 핑크빛 로맨스 | 브라이트 파스텔 핑크 |
| 70.0~74.9% | 다정다감한 모범 커플 | 소프트 쉘 핑크 |
| 65.0~69.9% | 평소엔 연인, 싸울 땐 웬수 | 소프트 옐로우 |
| 60.0~64.9% | 아슬아슬한 밀당 권태기 | 실버 그레이 |
| 55.0~59.9% | 말 한마디가 시한폭탄 | 딤 차콜 |
| 50.0~54.9% | 살얼음판 위 대치 상황 | 글래스모피즘 와인 |

티어는 모집단 기준 상위 백분위로도 동시 표기 (예: "전국 커플 상위 23%"). 공유 카드(§10) 핵심 입력값.

---

## 4. 채팅 탭 — 트윈/거울/분석가 모듈

### 4.1 핵심 정의 — 트윈 AI란 무엇인가

트윈 AI = **나 자신의 복제본.** 연인의 말투를 흉내 내는 AI가 아니라, 사용자 본인을 복제한 AI가 연애 상황을 분석해 사용자를 꾸짖고 성장시키는 거울이다.

- 트윈 AI = "더 현명한 나 자신" / "내 양심의 목소리"
- 작동 원료: 오직 내 데이터(`User_Tone_Vector` + `User_Persona_Matrix` + 내가 보낸 메시지)
- 연인 미가입 상태에서도 단독 작동 (§0.3 싱글플레이어 원칙)

### 4.2 채팅 탭 방 구조

| 룸 | 이름 | 정체성 | 톤 | 작동 |
|---|---|---|---|---|
| 룸 1 (최상단 고정) | 연인 실제 채팅방 | 실제 사람 | — | 실시간 메시징·이미지·위치 공유 |
| 룸 2 (중단) | 트윈(나의 분신) | 감정적인 나 자신 | 내 말투 그대로, 직감/양심 | 실시간 꾸짖고 인정 |
| 룸 3 (하단) | 분석가 트윈이 | 냉정한 제3자 전문가 | 차분한 상담사 톤 | 주간·월간 리포트 brief |

**룸 프로필 비주얼:**
- 룸 1: 프로필 테두리에 Mint→Coral 그라데이션 글로우.
- 룸 2: 사용자 아바타의 미러링(반전) 이미지 + `BADGE_AI`(`#5FB3A8`) 미니 DNA 이중나선 뱃지.
- 룸 3: 미니멀 챗봇 오피셜 프로필.

### 4.3 FUN-CHA-001 — 트윈 실시간 개입 (룸 2)

**말투 복제 연동:** 트윈의 모든 발화는 `User_Tone_Vector`를 프롬프트에 주입해 사용자 본인의 말투로 생성.

예: 일반 AI "그 표현은 상대가 서운할 수 있어요" → 트윈 "야, 너 방금 또 그 버릇 나왔다. '됐어' 이거 네 시그니처 빌런 멘트인 거 알지?"

**실시간 작동 트리거:** 룸 1 메시지가 룸 2 엔진으로 실시간 복사(Tapping) → 2.5초 버퍼 후 이벤트 탐지 → v2.2 엔진 연동.

**출력 3종 채널:**

| 채널 | 트리거 | 톤 |
|---|---|---|
| 🔴 경고(Warn) | 중대 코드(L-CRU/L-HRS) 또는 CRITICAL_LOSS/RAPID_SWING | 진지·묵직 |
| 🟡 권고(Advise) | 일반 감산(L-MIC/L-NEG) 또는 개입점수 ≥ θ | 부드러운 넛지 |
| 🔵 알림(Notify) | 가산(G-*), 배치 집계 요약 | 가벼움·인정 |

**개입 피로도 제어 (Anti-Nagging):**
- 개입 후 피로도↑ → 발화 게이트 통과 어려워짐 (EMA α=0.3).
- ADVISE/NOTIFY: 동일 코드 15분 쿨다운.
- WARN: 쿨다운 무시 (안전 우선).

**웰빙 가드레일:**
- 균형 의무: 경고/권고 누적 시 같은 세션에서 가산 인정 최소 1회.
- 자기비난 차단: 정서 취약 신호 감지 시 꾸짖음 강도 완화 → 지지 모드.
- 인격 불가침: "이 행동/버릇 하나"로만 한정. "넌 글러먹었어" 류 금지.
- **CrisisMode 헤징:** 트윈의 발화는 상대방 감정을 단정하지 않는 헤지드 언어를 사용. "서영이가 상처받았을 확률이 84%입니다"가 아니라 "이 패턴은 상대에게 거절감으로 읽힐 수 있어. 다시 보자."

**응답 분할 전송:** `User_Tone_Vector.rhythm.avgBurstSize` / `medianGapSec` 기반 분할 개수·시간차 적용. '말하는 중...' 타이핑 애니메이션 UI.

**트윈 응답 로직 상세 수식 및 코드 골격 → `Twin_response_logic.md` 참조 (부록 R).**

### 4.4 FUN-CHA-002 — 말투 교정 피드백

**정의:** AI 말풍선 롱 프레스 시 하단 바텀 시트 슬라이드 업.

**옵션:** [너무 다정함] / [너무 딱딱함] / [유머 코드 안 맞음] 라디오 버튼. 선택 완료 시 해당 말풍선이 플립(Flip) 애니메이션과 함께 수정된 답변으로 실시간 교체.

### 4.5 FUN-CHA-003 — 반성의 거울 (Mirroring Crisis Mode)

**정의:** 파국 징후 감지 시 유저 혼자만 보는 긴급 자기 성찰 경보 시스템.

**트리거 조건:**
- 갈등 임계 키워드("헤어져", "짜증나") 감지.
- v2.2 `CRITICAL_LOSS` 또는 `RAPID_SWING` 오버플로우.

**UI:** 풀스크린 오버레이. `CRISIS_RED`(`#EF4444`) 컬러가 은은하게 점멸(Pulse)하는 배경. 국가 재난문자 스타일 타이포그래피 경고창. 재난문자 특유 햅틱 패턴.

**출력 원칙 (헤지드 언어 필수):**
- 상대방 감정을 단정하는 표현 금지.
- "이 표현은 상대방에게 거절감으로 읽힐 수 있어" 형태 사용.
- 연인의 폰에는 아무것도 가지 않음 (은밀한 자가 교정).
- 하단에 `[내 대화 습관 인정하고 돌아가기]` 단일 액션 버튼.

### 4.6 FUN-CHA-004 — Magic Mirror (AI 선톡, Deep Talk Night 전용)

**정의:** AI가 먼저 유저에게 연애 상황을 챙겨주는 프로액티브 메시징. Deep Talk Night 전용.

**명시적 옵트인 필수:** 자동 활성화 절대 금지. 전용 동의 화면(카피: "Magic Mirror는 당신의 대화 패턴을 관찰하다가, 먼저 말 걸어도 될 것 같을 때만 톡을 보내요.") 통과 후 활성화.

**2단계 필터링:**
1. 1단계: 룸 1 메시지 100개당 1회 저비용 패턴 모니터링 (룰 기반, 비용 ≈ ₩0).
2. 2단계: 1→2단계 전환율 약 12%. 실제 발신 월 평균 4회. 하드캡 월 30회.

**발신 시 이유 투명 공개:** "어제 대화 톤이 평소보다 많이 차가웠더라. 괜찮아?"처럼 발신 맥락을 포함.

**설정에서 빈도 조절(줄이기/끄기) 가능.**

---

## 5. 일치율 코어 엔진 v2.2

> 상세 수식 및 이벤트 코드 전체 목록은 `matching_algorithm_v2_2.md` 참조 (부록 A). 본 절은 핵심 아키텍처만 서술.

### 5.1 점수 2층 구조

- **`S_Live`:** 화면 상단 게이지. 이벤트마다 실시간 재계산·애니메이션. 표시 전용(non-persistent).
- **`S_Current`:** 공식 일치율. 매일 자정 1회 정산, 영구 저장. 모든 시스템(티어·페이월)이 참조.
- **`S_Today_Open`:** 당일 00:00 `S_Current`. 당일 `S_Live`의 기준선.

### 5.2 기준 점수 (S_Base)

`Z_Total = 0.4·Z_M + 0.6·Z_E` → `S_Base = 70 + Z_Total·7.81` → 인터뷰 가산점(최대 +5.0) → `S_Master_Base`

**인터뷰 미완료 상한:** 제네시스 인터뷰 미완료 상태에서 `S_Current` 상한 = 72.0%. 인터뷰 완료 후 실제 값으로 해제.

### 5.3 실시간 틱 엔진

- **이벤트 약 100종 / 10개 군** 탐지. (`src/engine/eventClassifier.ts` 현재 커버리지 40~50종. 나머지는 새 코드베이스에서 추가.)
- **타nh 소프트 포화형 일일 제한:** 가산 점근 상한 `A_CAP_PLUS = +2.0`, 감산 점근 하한 `A_CAP_MINUS = -2.5`.
- **반파밍:** 동일 코드 당일 n번째 발생 시 `δ_final = δ_w · γ^(n-1)` (일반 γ=0.5 / L-CRU·L-HRS 군 γ=0.8). 코드별 일일 빈도 캡 N 초과 시 0.
- **부정성 가중:** 감산 이벤트에 κ=1.5 추가 가중.
- **유효 변동치 승수:** `δ_eff = δ_base × M_intensity × M_context × M_reciprocity × M_time` (M_intensity 0.5~1.5 / M_context 갈등 중 1.5 / M_reciprocity 상호 발생 1.2).

### 5.4 실시간 급락 감지 (Rapid-Swing Trigger)

30분 윈도우 내 누적 하락이 `RAPID_SWING_THRESHOLD = -1.5` 초과 시 → CrisisMode(FUN-CHA-003) 즉시 연동.

### 5.5 변동성 지수 (Volatility Index, V)

**정의:** 롤링 24h 델타 히스토리를 이용한 관계 안정성 측정.

```
V = std( [Δ_daily(t), Δ_daily(t-1), ..., Δ_daily(t-6)] )   // 7일 롤링 표준편차
```

V가 높을수록 관계가 불안정. 위기 감지 민감도를 V에 따라 동적 스케일링.

### 5.6 냉각 소실 (Cooling Bleed) ★ v2.6 신규 명세

**정의:** 대화가 없는 유휴 상태가 지속되면 당일 누적 점수(aValue)가 자연 감소한다.

```
a_bleed = a × exp(-β × (idle_min − 90))    // idle_min ≥ 90분일 때만 적용
β = 0.01 (기본값)
```

- 90분(`COOLING_BLEED_IDLE_MIN`) 미만 유휴: 소실 없음.
- 90분 이상 무응답 시 지수적으로 감소 시작.
- 구현: `metrics.coolingBleed(aValue, minutesIdle)`.

### 5.7 위기 메모리 & 동적 가산 캡 ★ v2.6 신규 명세

**정의:** 3일 연속 `CRITICAL_LOSS` 오버플로우 발생 시 관계 안정화를 위해 가산 캡을 임시 하향.

```
shouldActivateCrisisMemory(recentDailyStatuses: OverflowStatus[]): boolean
  → 최근 3일이 모두 'CRITICAL_LOSS'일 때 true

resolveActiveCapPlus(crisisMemoryActive: boolean): number
  → crisisMemoryActive = true  →  A_CAP_PLUS_CRISIS = 1.0  (기본 2.0에서 하향)
  → crisisMemoryActive = false →  A_CAP_PLUS = 2.0
```

**의도:** 관계가 3일 연속 위기 상태일 때 가산 이벤트의 점프 폭을 제한해, 급등락 없이 점진적 회복을 유도.

**`OverflowStatus` 분류 기준 (자정 정산 후 aEndOfDay 기준):**

| 값 | 조건 |
|---|---|
| `'EXCESS_GAIN'` | aEndOfDay > +1.0 |
| `'CRITICAL_LOSS'` | aEndOfDay < -1.0 |
| `'NONE'` | 그 외 |

### 5.8 기준 점수 산출 유틸 — `scoreCalculator.ts` ★ v2.6 신규 명세

`src/utils/scoreCalculator.ts`는 `metrics.ts`와 `auraThemeEngine.ts` 양쪽에서 `OverflowStatus` 타입을 공급하는 의존 파일이다. 새 코드베이스에 반드시 함께 이식해야 한다.

| 함수 | 역할 |
|---|---|
| `getMBTICompatibilityGrade()` | MBTI 4글자 쌍 → 상성 등급 판정 |
| `generateBaseScore(mbti, enneagram)` | Z-Score 변환 → `S_Base` 계산 |
| `computeNationalPercentile(score)` | Abramowitz-Stegun CDF 근사 → 전국 백분위 |
| `getTierFromScore(score)` | 10단계 티어 매핑 (`formatScore()` 포함) |
| `type OverflowStatus` | `'EXCESS_GAIN' \| 'CRITICAL_LOSS' \| 'NONE'` — `metrics.ts`, `auraThemeEngine.ts` 공유 타입 |

**이식 우선순위:** `genesis.ts` → `metrics.ts` → `scoreCalculator.ts` → `auraEngine.ts` 순서. `scoreCalculator.ts`를 먼저 이식하지 않으면 `metrics.ts`가 타입 에러를 낸다.

---

## 6. 주간 리포트 및 페이월 시스템

### 6.1 리포트 구조

**배달 트리거:** 매주 일요일 밤 10시 또는 카톡 .txt 업로드 학습 완료 시 룸 3(분석가 트윈이)으로 자동 발송.

**무료/유료 게이팅:**
- **무료:** 핵심 요약(하이라이트·매치스탯) + 워터마크. 공유 가능.
- **Coffee Talk:** 주간 리포트 블러 해제 + AI 감성 요약 카드.
- **Deep Talk Night:** 전체 상세 분석 + 행동 지표 + 커스텀 테마.

### 6.2 리포트 데이터 필드

1. 최근 대화 주제 및 흥미도 도넛 차트 (키워드 TOP 5)
2. 서로의 감정 패턴 (안정/불안 곡선, 주간 날씨 점수)
3. 트윈이의 감성 한줄평
4. (유료) 소통 매너리즘 지적, 가산 이벤트 TOP 3, 감산 이벤트 TOP 3

### 6.3 손실 회피 트라이얼

가입 첫 주: Coffee Talk 기능 풀 언락 (트라이얼). D7 이후 자동 Free 복귀 또는 전환 유도.

---

## 7. 히스토리 탭 모듈

### 7.1 탭 구조 (최종 확정) ★ FUN-HIS-001/005 수정 반영

**세그먼트 컨트롤 3탭 구성 (키 명칭 최종):**

| 탭 인덱스 | 키(Key) | 화면 명칭 | 내용 |
|---|---|---|---|
| 0 | `archive` | 추억 월 | 폴라로이드 형태 추억 아카이브 |
| 1 | `helix` | DNA 나선 | 3D 나선형 데이트 타임라인 ← 지도 뷰 대체 확정(A안) |
| 2 | `feed` | 무드 피드 | 파트너 무드 피드 |

**Dead code 정리:** `DateMapView` 및 `HistoryKakaoMapView`는 어디서도 호출되지 않는 dead code로 확인됨. 지도 뷰(뷰파인더 모드)는 `FUN-HIS-002` 데이트 셔틀 모달의 자체 지도 렌더링으로 대체. `history.tsx`에서 미사용 컴포넌트 제거.

### FUN-HIS-001 — DNA 나선 타임라인 (헬릭스 뷰)

**정의:** 중앙 수직 기둥을 나선형으로 휘감는 3D 램프 그래픽 인터페이스.

**레이아웃:** 타워 최하단(뿌리) = '사귀기로 한 날', 위로 올라갈수록 최신 데이트. 스크롤 시 카메라가 나선을 타고 3D 회전하며 상승/하강.

**HelixView 날짜 기반 포지셔닝:** `startedAt`(커플 결성일)을 앵커로 각 데이트 캡슐의 수직 위치 계산.

**햅틱 피드백:** 캡슐 터치 시 경량 햅틱.

**감성 필름 이펙트 (The Sentiment Ribbon):** 카톡 동기화 시 당일 베스트 다정 대사 1개가 만년필 폰트로 각인된 투명 아세테이트 레이어가 사진 카드 옆에 레이어드됨. 스크롤 시 빛을 받아 반짝이는 셰이더 효과.

**MVP 구현 주의:** 실시간 3D 모핑은 난이도 높음 → MVP는 단계별 Lottie/일러스트 전환 권장.

### FUN-HIS-002 — AI 데이트 코스 셔틀

**정의:** 커플 OOTD·날씨·위치·미쉐린 선호도 조합 맞춤형 코스 큐레이션.

**UI:** 인스타 스토리 '무물' 스티커 재질의 대화형 인터랙티브 팝업.

**상태:** FUN-HIS-001(지도 dead code 정리) 완료 후 자체 지도 렌더링 정상 동작 확인 필요.

### 추억 월 (Archive View)

폴라로이드 형태 데이트 사진 카드. `rawKakaoText`로 추출된 베스트 한 문장이 사진 하단에 인쇄. 기억 삭제 지우개 UI: 지우개 아이콘 터치 시 해당 행이 포토샵 지우개처럼 가루가 되어 흩날리며 사라지는 Dissolve 애니메이션.

### 무드 피드 (MoodFeed View)

파트너 무드 서비스(`moodFeedService.ts`) 연동. `VIRTUAL_FEED` mock/real 듀얼 모드 지원.

---

## 8. 설정 탭 — 프라이버시 컨트롤

### FUN-SET-001 — 마이 트윈 데이터 센터 & 프라이버시 슬라이더

**3단계 슬라이더:**

| 단계 | 명칭 | 작동 |
|---|---|---|
| Lv 3 | 완전복제 (💖) | EMA 실시간 갱신 ON. 말투 전면 학습. |
| Lv 2 | 최적화 (🎭) | 말투 EMA PAUSE. 키워드/관심사만 추출. |
| Lv 1 | 보호 (🤫) | 리스너 종료. 온보딩 스냅샷만 사용. |

**기억 삭제 지우개:** 학습 데이터 리스트 옆 지우개 아이콘. 터치 시 Dissolve 애니메이션 + 해당 벡터 DB 임베딩 영구 파기.

**Magic Mirror 토글:** 설정 탭 내 Magic Mirror 발신 On/Off 및 빈도 조절.

### FUN-SET-001B — 오라 테마 설정

제네시스 인터뷰 완료 후 배정된 오라 색상 미리보기. 오라 줄이기/끄기 토글 (끄기 시 정적 배경 폴백).

### FUN-SET-001C — Founding Twin VIP 코드

VIP 코드 입력 화면 (`/settings/vip-code.tsx`). 유효한 코드 입력 시 `isFoundingVip` 플래그 활성화 → 12개월 Deep Talk Night 무료 + 13개월차 자동 50% 할인 전환.

**백엔드 필수:** `vipPromotionService.ts`, `iapService.ts`에 `isFoundingVip` 필드 및 자동 전환 로직 구현.

### FUN-SET-002 — 비즈니스 스토어 배너 및 구독 플랜 카드

**배너 배경:** Mint→Coral 그라데이션이 4초 주기로 은은하게 브리딩(Breathing)하는 고급 셰이더. (구 네온 바이올렛→피치핑크 그라데이션에서 브랜드 팔레트로 변경.)

**구독 카드:** 프로스테드 글래스(Frosted Glass) 60% 블러로 매혹적 호기심 유도 → 결제 완료 시 블러 셔터가 위로 스르륵 열리며 활성화.

---

## 9. 플랜 및 구독 정책

### 9.1 플랜 컨셉

| 플랜 | 컨셉 |
|---|---|
| Free | 진입 경험 — 커플 DNA 일치율과 거울방 맛보기 |
| Coffee Talk | 낮의 카페 세션 |
| Deep Talk Night | 밤의 바 세션 — AI가 먼저 관계를 챙겨주는 유일한 플랜 |

### 9.2 가격 매트릭스

| 플랜 | 개인형 (월) | 커플 묶음형 (월 총액) | 할인율 |
|---|---|---|---|
| Free | ₩0 | — | — |
| Coffee Talk | ₩4,900 | ₩7,900 | 개인 2인(₩9,800) 대비 약 19% |
| Deep Talk Night | ₩9,900 | ₩14,900 | 개인 2인(₩19,800) 대비 약 25% |

`planTier` enum: `'free' | 'coffee' | 'deep'` — **커플 단위 저장** (`Couple_ID` 기준).

### 9.3 거울방 사용 한도

| 플랜 | 월 한도 |
|---|---|
| Free | 월 4회 (주 1회) |
| Coffee Talk | 월 30회 (일 1회) |
| Deep Talk Night | 월 100회 하드캡 / 실사용 평균 월 40회 추정 |

커플 묶음형 결제 시에도 **인당 동일** 적용 (1인 1거울방 구조).

### 9.4 LLM 모델 분기 로직

| 상황 | 모델 | 호출당 비용 |
|---|---|---|
| 일반 넛지 | Groq/Gemini (무료/저가) | ₩0~10 |
| 표준 거울 응답 | Anthropic 경량 모델 | ₩30~50 |
| 위기 감지 (Crisis Mode) | Anthropic 고품질 모델 | ₩150~250 |

### 9.5 2단계 페이월 넛지 UX

1단계 탭 공시: 개인형 가격만 노출 (`₩4,900 / ₩9,900`).
2단계 상세 화면: 개인 결제 vs 커플 패키지(강조) 선택. 연인 닉네임 동적 바인딩 ("OO이것도 사주기"). 커플 패키지 결제 완료 시 "OO에게 알림 보내기" 옵션 제공 (인앱 바이럴).

### 9.6 악용 방지 정책

| 정책 | 내용 |
|---|---|
| 거울방 월 하드캡 | Deep Talk Night 월 100회 절대 초과 불가 |
| 비정상 패턴 감지 | 5분 내 3회 이상 자동 차단 |
| 쿨다운 | 거울방 응답 후 최소 30분 (위기 감지 제외) |
| 선톡 하드캡 | 월 30회 절대 초과 불가 |
| 선톡 반복 차단 | 동일 패턴 24시간 내 재발신 불가 |

### 9.7 Founding Twin VIP 정책

**대상:** 클로즈드 베타 참여 30~100쌍.
**혜택:** 12개월 Deep Talk Night 완전 무료 + 13개월차부터 **평생 50% 할인(₩4,950/월 개인가 기준)**.
**비용 영향:** 30쌍 기준 3년 누적 +₩297,720 순이익 기여. 비용이 아닌 이익 구조.

---

## 10. 플랜별 공유 카드 및 바이럴 엔진

### 10.1 시스템 아키텍처

- **출력 사양:** 9:16 비율, 1080×1920 PNG (손실 없음).
- **렌더링:** `expo-linear-gradient` + ViewShot (네이티브 공유). Skia 의존성 미추가(현재 이탈 사유 명시 코드 주석에 존재).
- **프라이버시:** PII 및 민감 대화 원문 철저 필터링/온디바이스 마스킹. 통계적 집계 및 안전하게 라벨링된 에셋만 사용.

### 10.2 플랜별 카드 구성

| 요소 | Free | Coffee Talk | Deep Talk Night |
|---|---|---|---|
| 티어 칭호 | 카드 80% 대형 타이포 | 기본 | 골드 폰트 특화 |
| 일치율 숫자 | ✓ | ✓ | ✓ |
| 테마 컬러 | 파스텔 핑크 | 카페 라떼 베이지/웜톤 크림 | 오라 테마 완전 연동 |
| 프레임 | 기본 | 실버 테두리 | 골드 오로라 프레임 |
| AI 감성 요약 | ✗ | ✓ | ✓ (고도화) |
| 소통 키워드 | ✗ | ✓ (3개) | ✓ (3대 강점 수치화) |
| 시그니처 문장 | ✗ | ✗ | ✓ (만년필 캘리그라피) |
| 커플 고유 식별자 | ✗ | ✗ | ✓ (Twin Pair #00847) |
| 잠금 표시 | ✓ 3개 | ✓ 3개 | ✗ (전면 해제) |
| 워터마크 | ✓ | ✓ | ✓ |

**잠금 개수 통일:** Free와 Coffee Talk 모두 3개 잠금 표시 (§9.3 요약표 vs §9.5 상세본 모순은 상세본 기준으로 Coffee Talk = 3개로 확정).

### 10.3 Deep Talk Night 카드 킬러 기능

- **골드 오로라 프레임:** `AuraVector` 6축이 깊은 블러의 메시 그라데이션으로 흐름. 중복 디자인 생성 수학적 차단.
- **AI 시그니처 문장:** 두 AI 바 세션에서 추출한 가장 정서적인 대표 발화 1개를 만년필 캘리그라피 서체로 카드 정중앙에 렌더링. (예: "오늘도 고생했어, 진짜로.")
- **행동 기반 감성 문장:** (예: "87일 연속 다정한 인사로 하루를 열었습니다")

### 10.4 오라 끄기 대응

오라 줄이기/끄기 토글 활성화 시 Deep Talk Night 동적 메시 그라데이션 → 정적 스냅샷 배경으로 폴백. WCAG 명도 대비 표준 충족.

---

## 11. 커플 Wrapped & 기념일 결산

### 11.1 트리거

| 종류 | 트리거 |
|---|---|
| 연말 Wrapped | 매년 12월 말 |
| 기념일 결산 | D+100/D+200/D+365/매 1주년 |
| 임의 마일스톤 | 누적 데이트 N회·티어 첫 진입 등 |

### 11.2 8장 카드 시퀀스 (Spotify Wrapped 벤치마킹)

1. 표지: "올해 우리는 #△△△ 커플"
2. 최고의 날
3. 우리의 시그니처 드립 (G-HUM 최다 문구 TOP 3)
4. 가장 다정했던 한마디 (아카이브 추출)
5. 함께한 발자취 (데이트 횟수·이동 거리)
6. 극복의 순간 (C-ARC 발동 횟수)
7. 티어 여정 타임라인
8. 공유 요약 카드

### 11.3 게이팅 ★ 수정 반영

- **무료:** 핵심 카드 일부 + 워터마크 (조건부 잠금). **전 유저 풀 시퀀스 무조건 노출 금지** — 반드시 premium/paywall 조건 분기 구현 필요 (`CoupleWrappedModal.tsx`/`coupleWrappedService.ts` 내 tier 조건 분기 0건 상태 수정 완료 필요).
- **유료:** 전체 카드 + 커스텀 테마/폰트 + 고해상 무워터마크 + 상세 통계.
- **결제 연계:** 발급 시 "이 기념일 결산을 풀 버전으로 선물하기" 배너 노출.

---

## 12. 구현 우선순위 및 리스크 관리

### 12.1 구현 우선순위 (높은 순)

1. **D0 표층 분석 (FUN-ONB-003)** — 베타 시작 전 가장 먼저 작동해야 할 기능.
2. **히스토리 탭 dead code 정리 (FUN-HIS-001)** — `DateMapView`/`HistoryKakaoMapView` 제거, TABS_CONFIG `archive`/`helix` 키 역할 확정.
3. **커플 Wrapped 페이월 게이팅** — 현재 전 유저 풀 시퀀스 무조건 노출 버그. 긴급 수정.
4. **Founding Twin VIP 백엔드** — `vipPromotionService.ts`, `isFoundingVip` 필드, 13개월차 자동 전환 로직.
5. **바이럴 자산 해제** — §6 하이라이트·매치스탯 무료 워터마크 공유본.
6. **결제 주체 설계** — §9.2 커플 단위 엔타이틀먼트 + 결제 후 공유 트리거.
7. **Magic Mirror 옵트인** — §4.6. 심리적 부담 리스크 해소의 핵심 게이트.
8. **공유 카드 시스템 (§10)** — ViewShot 네이티브 PNG.
9. **커플 Wrapped (§11)** — 페이웰 게이팅 수정 후 전체.

### 12.2 신규 개발 체크포인트 (v2.6 기준 — 이전 버그 트래커 대체)

구 코드베이스는 전면 폐기. 아래는 새 코드베이스에서 **처음부터 올바르게 구현해야 할** 설계 요구사항이다.

| 항목 | 요구사항 | 참조 |
|---|---|---|
| 히스토리 탭 구조 | `archive` / `helix` / `feed` 3탭. 지도뷰 컴포넌트 미도입. | §7.1 |
| Wrapped 페이월 게이팅 | 무료 유저에게 풀 시퀀스 노출 금지. tier 분기 반드시 구현. | §11.3 |
| Founding VIP | `isFoundingVip` 필드, 12개월 무료, 13개월차 50% 자동 전환 로직을 초기 설계에 포함. | §9.7 |
| API 키 격리 | 클라이언트에 `EXPO_PUBLIC_ANTHROPIC_API_KEY` 직접 노출 절대 금지. 모든 LLM 호출은 Edge Function 프록시 경유. | §14.4 |
| 오라 색상 | 고정 hex 하드코딩 금지. `auraEngine.buildAuraVector()` 출력만 사용. | §1.3 |
| 색상 토큰 | 컴포넌트 내 직접 hex 사용 금지. `src/constants/colors.ts` 토큰만 참조. | §1.7 |
| PartnerStatusBar | FUN-HOM-002 / FUN-HOM-002B를 별도 컴포넌트로 분리 설계. 연인 미가입 폴백 UI 포함. | §3 |
| scoreCalculator.ts | 최우선 신규 작성. 없으면 metrics.ts 타입 에러. | §14.2 |

### 12.3 3대 리스크 및 대응

**① 심리적 부담 (거울방/Magic Mirror):**
- (a) Magic Mirror 명시적 옵트인 (자동 활성화 금지)
- (b) 발신 시 이유 투명 공개
- (c) 온보딩에 "이것만은 절대 안 합니다" 섹션 명시
- (d) CrisisMode 헤지드 언어 사용 (상대방 감정 단정 금지)

**② 경쟁 대응:**
- (a) 톤·철학 일관성 (기능은 복제 가능, 서사는 단기 복제 어려움)
- (b) 핵심 네이밍 상표 출원
- (c) Founding Twin 커뮤니티 락인

**③ 리텐션 (가장 위험한 단일 변수):**
- D0: FUN-ONB-003 표층 분석 즉시 충격
- D7: 주간 리포트 첫 도착 푸시
- D90: "90일 전 64.2% → 지금 71.8%" 성장 그래프

### 12.4 윤리·다크패턴 회피 원칙

- 불안 판매 방지: 보수적 임계 설정 필수.
- 유저 본인의 추억은 인질로 잠그지 않음.
- 공유는 항상 본인 동의 + 온디바이스 마스킹.
- 이별(Churn) 시: 즉시 강제 삭제 대신 유예(grace) + 데이터 주권 안내. 해지 플로우는 비난·만류 금지.

---

## 13. 변경 이력 (Changelog)

| 일자 | 버전 | 변경 내용 |
|---|---|---|
| 2026.06.12 | v1.0 | 최초 SRS — Mirror & Archive 피벗, 3룸 구조, 온보딩/히스토리/설정 기본 모듈 |
| 2026.06.14 | v2.0 | 엔진 v2.1→v2.2 전환, FUN-CHA-001 트윈 정의 Override (연인 흉내 AI 폐기) |
| 2026.06.20 | v2.1 | 보강판 #1 — 리포트 게이팅 반전, 커플 단위 결제, 선물하기, 커플 Wrapped 신설 |
| 2026.06.28 | v2.2 | 공유 카드 시스템 신설, Git 브랜치 전략 리스크 수정 |
| 2026.06.29 | v2.2.1 | 플랜 네이밍 확정(Coffee Talk/Deep Talk Night), 거울방 한도 정책, Magic Mirror 신설 |
| 2026.06.30 | v2.3 | 가격 매트릭스 확정, D0 표층 분석(FUN-ONB-003) 신설, Founding Twin VIP 확정, 3대 리스크 체계화, 전체 통합 |
| 2026.07.01~04 | v2.4 | 스프린트 시리즈: FUN-HIS-001/005 dead code 정리, Wrapped 게이팅, Founding VIP 구현, Magic Mirror 옵트인, rawKakaoText 프라이버시 재설계, ViewShot PNG 전환, CrisisMode 헤지드 언어, 변동성 지수(V) 구현, 무드피드 듀얼모드, Wrapped 2카드 추가, FUN-ONB-004(Instagram DM) 스코프 추가 |
| 2026.07.05 | v2.5 | 디자인 시스템 전면 재정의 (§1): 브랜드 팔레트 4색 확정(Mint/Cream/Pink/Coral), 6축 오라 시스템 색상 조정(Deep Rose·Soft Amber·Sage Mint), 2-레이어 컬러 아키텍처 공식화. FUN-HIS-001/005 탭 구조 최종 확정(A안). Wrapped 게이팅 긴급 수정 요구사항 명시. 전체 분산 문서를 단일 정본으로 통합. |
| **2026.07.05** | **v2.6 (본 문서)** | **엔진 파일 교차 감사 반영 + 기술 스택 확정: 오라 색상 정책 B안 확정, 6축 라벨 코드 변수명 기준 통일(§1.3), colors.ts 구현 스펙 신규(§1.7), 점토 4단계 전환 조건 명세(§3), coolingBleed(§5.6)/위기 메모리(§5.7)/scoreCalculator(§5.8) 추가, 부록G 인라인 통합, §12.2 신규 개발 체크포인트 교체, §14 이식 파일 명세 신규. 기술 스택 확정(§0.6): Expo Managed Workflow / Bundle ID me.twin.app / Supabase 백엔드 / EAS Build iOS+Android 동시 출시.** |

---

## 부록

### 부록 A — 일치율 코어 엔진 v2.2 이식 명세

> 구현 진실 공급원: `src/engine/metrics.ts` (이식 에셋, 수정 금지).  
> `matching_algorithm_v2_2.md`는 참조용 보관.

**이식할 함수 목록:**

| 함수 / 상수 | 역할 |
|---|---|
| `EVENT_REGISTRY` | 100종 이벤트 딕셔너리 + δ값 |
| `COMBO_REGISTRY` | 5종 콤보 (C-ARC, C-SYN, C-DSP) |
| `processTick()` | 단일 이벤트 처리 파이프라인 |
| `tanhSaturation()` | 일일 제한 공식 |
| `computeSLive()` | 실시간 게이지 |
| `settleMidnight()` | 자정 정산 + 항상성 감쇠 (λ=0.02) |
| `detectRapidSwing()` | 급락 감지 (threshold=-1.5, window=30분) |
| `detectCombos()` | 콤보 탐지 |
| `computeVolatilityIndex()` | 7일 롤링 표준편차 |
| `coolingBleed()` | 90분+ 유휴 시 지수 소실 (§5.6) |
| `shouldActivateCrisisMemory()` | 3일 연속 CRITICAL_LOSS 감지 (§5.7) |
| `resolveActiveCapPlus()` | 동적 가산 캡 반환 (§5.7) |
| `KAPPA`, `GAMMA_*`, `A_CAP_*`, `LAMBDA_DECAY` 등 | 물리 상수 전부 |

**이벤트 분류기:** `src/engine/eventClassifier.ts` — 현재 커버리지 약 40~50종. 이식 후 나머지 이벤트 코드 패턴은 새 코드베이스에서 추가 작성.

### 부록 G — 제네시스 인터뷰 전체 명세 ★ v2.6 인라인 통합

> `genesis_interview.md`는 참조용으로만 보관. 구현 기준은 본 부록이 우선한다.

#### G.1 4막 구조

| 막 | 카테고리 | 목적 | 질문 수 |
|---|---|---|---|
| 1막 | `icebreak` | 잡담/캘리브레이션 — 긴장 해소, 음성 입력 안착 | 범용 10개 중 일부 |
| 2막 | `core-motive` | 에니어그램 핵심 동기·두려움 탐색 — 가설 형성 | 유형별 1~3번 질문 |
| 3막 | `romantic-confirm` / `romantic-disconfirm` / `romantic-common` | 1위 가설 확증/반증 — 조기종료 판정 | 유형별 4~5번 질문 |
| 4막 | — | 마무리 — 오라 생성 연출 + 배정 | — |

#### G.2 베이지안 추론 엔진 파라미터

```
사전확률 p_i^(0) = softmax(β × affinity(MBTI, type_i))    β = 2.2
사후갱신 p_i ← p_i × L(r|type_i) / Z
확신도   confidence = 1 - H / log(9)        H = 섀넌 엔트로피
마진     margin = p(1st) - p(2nd)
조기종료 shouldStopEarly: confidence ≥ 0.85 && margin ≥ 0.25
```

**가설 스위치:** 매 갱신 시 1위 유형이 바뀌면 `didHypothesisSwitch()` = true → 반증 질문으로 전환.

#### G.3 씨드 질문 구성 (총 55개)

- 범용 공통: 10개 (`icebreak` 카테고리, 1막)
- 유형별: 9유형 × 5개 = 45개
  - 1~3번: `core-motive` (2막 — 핵심 동기·두려움)
  - 4번: `romantic-confirm` (3막 — 가설 확증)
  - 5번: `romantic-disconfirm` (3막 — 가설 반증, `vsType` 지정)
- 전체 질문 데이터: `src/data/genesisQuestionBank.ts` (이식 에셋, 수정 금지)

#### G.4 입력 모드

- 음성 우선(`voice`): Realtime API / STT 연동 — 전화 수신 풀스크린 UI
- 무음 폴백(`typing`): 텍스트 입력 (음성 권한 거부 또는 조용한 환경)
- 모드 전환: 인터뷰 도중 언제든지 전환 가능

#### G.5 타입 정의 단일 진실 공급원

`src/types/genesis.ts` — `genesis.ts` 파일 이식 에셋. 아래 타입을 모든 파일이 공유한다:
`BayesianState`, `PersonaBlend`, `AuraVector`, `UserPersonaMatrix`, `ClayStage`, `GenesisQuestion`, `GenesisAnswerArchetype`

### 부록 C — 말투 학습 엔진 (User_Tone_Vector Builder)
> 구현 참조: `src/services/kakaoIngestPipeline.ts` (파이프라인 구조만 이식, 의존성 재작성).  
> `Chat_logic.md`는 참조용 보관.

**카카오 파이프라인 이식 시 주의:** `kakaoIngestPipeline.ts`는 아래 파일들에 의존한다. 이 파일들은 THROW 대상이므로 새 코드베이스에서 재작성해야 한다:

| 의존 파일 | 처리 |
|---|---|
| `weeklyReportService` | 재작성 — API 키 Edge Function 프록시 뒤로 격리 |
| `kakaoBatchDetectionService` | 재작성 |
| `AppContext.tsx` | Zustand 도메인별 store로 해체 대체 |
| `matchEngineStore` | 재작성 |

이식 대상: `loadMemoryQuotes()` / `saveMemoryQuotes()` AsyncStorage 패턴, `appendMemoryWallNodes()` 중복 제거·정렬 알고리즘, 파이프라인 진입점 구조(`runKakaoIngestPipeline`).

### 부록 R — 트윈 AI 응답 생성 엔진 이식 명세

> 구현 진실 공급원: `src/engine/twinResponseEngine.ts` (순수 함수 부분만 이식).  
> `Twin_response_logic.md`는 참조용 보관.

**이식할 함수/상수:**

| 함수 / 상수 | 역할 |
|---|---|
| `computeInterventionScore()` | I(u) = \|δ_base\| × M_intensity × w_channel × (1−fatigue) |
| `shouldOpenGate()` | I(u) ≥ θ(0.12) 또는 중대 코드이면 발화 허용 |
| `routeChannel()` | WARN / ADVISE / NOTIFY 라우팅 |
| `updateFatigue()` | 피로도 EMA (α=0.3) |
| `isOnCooldown()` / `isRepeatPattern()` | 쿨다운 15분 / 24h 반복 패턴 체크 |
| `evaluateGate()` | 전체 판정 파이프라인 |
| `THETA_INTERVENE`, `ALPHA_FATIGUE`, `HARD_COOLDOWN_MS` 등 | 튜닝 상수 |

**버릴 것:** UI 연결 코드, `SelfAiNotifyItem` 렌더링 로직 → 새로 작성.

### 부록 M — 정합성 감사 기록
> 원문: `migration_status.md` 참조. 최신 상태는 §12.2에 반영.

---

## 14. 이식 엔진 파일 명세 ★ v2.6 신규

새 코드베이스로 **그대로 복사**할 파일 목록과 이식 순서. 이 파일들은 Twin.me의 실질적 기술 자산이다.

### 14.1 완전 이식 파일 (수정 없이 복사)

| 파일 | 새 경로 | 분류 | 비고 |
|---|---|---|---|
| `genesis.ts` | `src/types/genesis.ts` | 타입 정의 | 모든 파일의 타입 기반 |
| `metrics.ts` | `src/engine/metrics.ts` | 엔진 | `scoreCalculator.ts` 먼저 이식 필요 |
| `genesisInference.ts` | `src/engine/genesisInference.ts` | 엔진 | |
| `genesisBlending.ts` | `src/engine/genesisBlending.ts` | 엔진 | |
| `auraEngine.ts` | `src/engine/auraEngine.ts` | 엔진 | |
| `auraThemeEngine.ts` | `src/engine/auraThemeEngine.ts` | 엔진 | |
| `twinResponseEngine.ts` | `src/engine/twinResponseEngine.ts` | 엔진 | UI 연결 코드 제외 |
| `eventClassifier.ts` | `src/classifier/eventClassifier.ts` | 분류기 | 커버리지 ~50종, 추가 필요 |
| `genesisQuestionBank.ts` | `src/data/genesisQuestionBank.ts` | 데이터 | |
| `auraStoryPool.ts` | `src/data/auraStoryPool.ts` | 데이터 | |
| `kakaoIngestPipeline.ts` | `src/services/kakaoIngestPipeline.ts` | 서비스 | 의존성만 재작성 (부록C 참조) |

### 14.2 새로 작성할 파일 (`scoreCalculator.ts` 포함)

`src/utils/scoreCalculator.ts`는 이식 에셋에 포함되지 않아 **새로 작성**한다. 아래 스펙 기준:

```typescript
// src/utils/scoreCalculator.ts
export type OverflowStatus = 'EXCESS_GAIN' | 'CRITICAL_LOSS' | 'NONE';

export function getMBTICompatibilityGrade(mbtiA: string, mbtiB: string): string
export function generateBaseScore(mbti: string, enneagram: EnneagramType | null): number
  // Z_Total = 0.4·Z_M + 0.6·Z_E → S_Base = 70 + Z_Total·7.81
export function computeNationalPercentile(score: number): number
  // Abramowitz-Stegun CDF 근사
export function getTierFromScore(score: number): TierInfo
  // 10단계 티어 매핑 (§3 FUN-HOM-003 테이블 기준)
export function formatScore(score: number): string
  // score.toFixed(1) — 반드시 이 함수 경유. 직접 toFixed() 호출 금지
```

> **필수:** `scoreCalculator.ts`를 가장 먼저 작성해야 한다. `metrics.ts`가 `OverflowStatus` 타입을 이 파일에서 import하므로, 없으면 엔진 전체가 타입 에러를 낸다.

### 14.3 이식 순서 (의존성 기반)

```
1단계 — 독립 (즉시)
  src/utils/scoreCalculator.ts  ← 신규 작성 (최우선)
  src/types/genesis.ts          ← genesis.ts 이식
  src/data/genesisQuestionBank.ts
  src/data/auraStoryPool.ts

2단계 — 1단계 의존
  src/engine/metrics.ts
  src/engine/auraEngine.ts
  src/engine/genesisInference.ts

3단계 — 2단계 의존
  src/engine/genesisBlending.ts
  src/engine/auraThemeEngine.ts
  src/engine/twinResponseEngine.ts
  src/classifier/eventClassifier.ts

4단계 — 엔진 위에 store 설계
  src/store/userStore.ts
  src/store/coupleStore.ts
  src/store/scoreStore.ts
  src/store/sessionStore.ts

5단계 — store 위에 서비스 조립
  src/utils/colors.ts           ← §1.7 스펙 기준 신규 작성
  src/api/                      ← Edge Function 프록시 (API 키 격리)
  src/services/kakaoIngestPipeline.ts  ← 구조 이식, 의존성 재작성

6단계 — 서비스 위에 UI 전면 작성
  app/(tabs)/                   ← 새 컴포넌트 & 화면 전면 재작성
```

### 14.4 버릴 파일 (새 코드베이스에서 재작성)

| 파일 | 이유 |
|---|---|
| `app/(tabs)/history.tsx` (185KB) | Dead code 혼재, 탭 구조 충돌 |
| `app/(tabs)/chat.tsx` (145KB) | 덧댄 로직 과다, 3룸 구조 재설계 |
| `app/(tabs)/settings/index.tsx` (140KB) | 컴포넌트 분리 없이 단일 파일 집중 |
| `src/context/AppContext.tsx` (65KB) | 단일 Context에 전 상태 집중 → Zustand 분리 |
| `DateMapView`, `HistoryKakaoMapView` | Dead code 확정 |
| `kakaoUploadService`, `selfAiService`, `weeklyReportService`, `coachingService`, `magicMirrorService`, `aiMuseService` | 클라이언트에 API 키 직접 노출 — Edge Function 프록시로 재설계 |

---

*본 문서는 Twin.me 제품 명세의 단일 정본(Single Source of Truth)이다. 수정 시 본 문서를 직접 갱신하고 §13 변경 이력에 기록한다. 모든 하위 분산 문서는 본 문서에 충돌 시 본 문서가 우선한다.*
