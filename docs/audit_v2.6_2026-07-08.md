# Twin.me MASTER v2.6 코드베이스 감사 (2026-07-08)

> `docs/Twin_me_MASTER_v2.6.md` 전체 기준으로 코드베이스 구현 현황을 점검한 결과. 코드 수정 없이 현황 파악만 수행.

**점검 기준:** ✅ 구현 완료(코드에 실제로 존재하고 동작함) / ⚠️ 부분 구현(UI만 있거나 스텁/TODO 상태) / ❌ 미구현(코드에 전혀 없음)

---

## §0 서비스 개요

| 항목 | 상태 | 근거 |
|---|---|---|
| 싱글플레이어 원칙 | ✅ | `chat.tsx`에서 `lover` 룸만 `!isPartnerConnected`일 때 잠기고 `twin`/`analyst` 룸과 일치율 엔진은 항상 단독 동작. 단 "리포트"는 §6에서 보듯 아예 미구현이라 이 부분만 원칙 검증 불가 |
| 하드 제약 (RN/Expo Go 호환) | ⚠️ | `react-native-iap`가 이미 `app.json` plugins에 등록되어 있음 — 이는 Native Module이라 **Expo Go에서 동작 불가**(커스텀 dev client 필요), 스펙이 명시한 "먼저 확인받아라" 절차를 거쳤는지 불명. iOS/Android 동시 출시 자체는 위반 없음 |

## §1 디자인 시스템

| 항목 | 상태 | 근거 |
|---|---|---|
| colors.ts 토큰 시스템 | ✅ | `src/constants/colors.ts`에 BRAND/SYS/AURA_BASE_HUE/GRADIENT/getBg·getCard·getText 전부 스펙값과 일치 |
| 6축 오라 시스템 (HSL) | ✅ | `auraEngine.ts:64-66` 수식 정확 구현, `auraThemeEngine.ts` clampToMutePastelGate·contextMultiplier(0.72 포함)·η=0.1 모두 구현 |
| 라이트/다크/6Sigma 테마 | ✅ | `useTheme.ts`+`constants/theme.ts`의 `buildSigmaTheme` 등 3모드 정상 동작, 전 탭에서 소비 확인 |
| colors.ts 적용 규칙 준수 | ⚠️ | 위반 다수: `history.tsx`(11건 raw hex, 그라데이션 버튼 2건), `settings.tsx`(`#0F1626`,`#EF4444` 등), `index.tsx` trackColor 하드코딩 |
| 폰트 시스템 | ⚠️ | 폰트 로딩·토큰 정의는 완료되나 `settings.tsx`는 TYPOGRAPHY 토큰 3회 vs 원시 스타일 14회로 일관성 부족 |
| 그라데이션 (시그니처 전용) | ⚠️ | 홈 일치율 숫자는 올바르게 사용하나, `history.tsx`의 "코스 지도 담기"/"AI 데이트 추천" 일반 버튼에 그라데이션 사용 — 규칙 위반 |

## §2 온보딩

| 항목 | 상태 | 근거 |
|---|---|---|
| 카카오 업로드 (zip/txt) | ✅ | `kakao-upload.tsx`가 zip(JSZip)/txt 둘 다 처리, `kakaoIngestPipeline.ts` 파싱 연결 |
| 제네시스 인터뷰 4막 구조 | ✅ | `useGenesisInterview.ts`에 4막 상태머신 실존, `genesisQuestionBank.ts` 55문항 스펙과 정확히 일치 |
| 점토 4단계 전환 (ClayStage) | ⚠️ | 상태 자체는 있으나 confidence 임계값(0.35/0.65/0.85)과 연동 안 되고 막 전환에만 하드코딩, Lottie/SVG 없이 이모지 텍스트로만 표현 |
| 베이지안 추론 엔진 연결 | ✅ | `genesisInference.ts`의 shouldStopEarly/didHypothesisSwitch가 실제로 인터뷰 흐름에서 호출됨 |
| 오라 생성 ceremony 연출 | ⚠️ | `buildAuraVector()`는 호출·저장되지만 시각적 ceremony(오라 링/스플래시)가 없고 텍스트+버튼뿐 |

## §3 메인 탭 홈

| 항목 | 상태 | 근거 |
|---|---|---|
| 일치율 게이지 (원형) | ✅ | `index.tsx`에 `CircularGauge` 렌더링 |
| S_Current/S_Base 표시 | ✅ | scoreStore에서 직접 바인딩 |
| 티어 시스템 | ✅ | `scoreCalculator.ts`의 `getRelationshipTier()`(이름은 스펙과 다름) 10단계 전부 정확히 구현·렌더링 |
| D-day 표시 | ✅ | `computeDDay` + coupleStore 연동 |
| PartnerStatusBar (FUN-HOM-002) | ❌ | 컴포넌트 자체가 존재하지 않음. 홈의 무드 태그는 정적 하드코딩 배열일 뿐, FUN-HOM-002B와의 분리 요구사항도 해당 없음(둘 다 없음) |

## §4 채팅 탭

| 항목 | 상태 | 근거 |
|---|---|---|
| 3룸 구조 | ✅ | lover/twin/analyst 정상 구현 |
| 트윈 AI 응답 (LLM 연동) | ✅ | 실제 프로바이더는 **Gemini**(스펙 문서에 "Gemini 연동"이라 명시된 것과 일치), `llm.ts`는 Edge Function만 호출하고 클라이언트에 API 키 노출 없음(보안 이상 없음 확인) |
| 말투 복제 (toneVector) | ✅ | privacyLevel===2 분기에서 toneVector 주입 확인(단, 이 분기에서만 적용됨) |
| CrisisMode (FUN-CHA-003) | ❌ | `isCrisisMode`/`setCrisisMode` 스토어 필드만 존재하고 실제로 어디서도 호출·렌더링되지 않는 완전한 죽은 코드 |
| 이벤트 분류 + 엔진 연결 | ✅ | `useMatchEngine.ts`가 classifyMessage→processTick 정상 연결. 커버리지는 96종 중 약 74종(~77%)으로 스펙이 말한 40~50종보다 실제로는 더 진척됨 |

## §5 일치율 코어 엔진

| 항목 | 상태 | 근거 |
|---|---|---|
| processTick/eventClassifier 연동 | ⚠️ | 연동 자체는 되지만, `useMatchEngine.ts`가 매 메시지마다 `sCurrent`를 즉시 덮어써서 S_Live/S_Current 2층 구조가 실질적으로 붕괴됨 |
| settleMidnight 자정 정산 | ✅ | `useMidnightSettlement.ts`가 정상 마운트·호출 (Phase 7-2에서 구현) |
| coolingBleed | ⚠️ | 함수는 정확히 구현되어 있으나 **어디서도 호출되지 않는 죽은 코드** |
| 위기 메모리 (crisisMemoryActive) | ✅ | shouldActivateCrisisMemory/resolveActiveCapPlus 모두 useMidnightSettlement에서 실제 호출됨 |
| 변동성 지수 (volatilityIndex) | ⚠️ | computeVolatilityIndex 정의는 있으나 **호출부 전무**, 스토어 필드도 0에 고정된 채 방치 |
| rapidSwing 감지 | ⚠️ | detectRapidSwing 정의는 있으나 **어디서도 호출 안 됨**, CrisisMode 트리거 경로 자체가 없음(§4 CrisisMode ❌와 직결) |

## §6 주간 리포트

| 항목 | 상태 | 근거 |
|---|---|---|
| 리포트 생성 로직 | ❌ | weeklyReportService 등 관련 파일이 코드베이스에 전혀 없음 |
| 페이월 게이팅 | ❌ | 게이팅할 리포트 자체가 없어 N/A |

## §7 히스토리 탭

| 항목 | 상태 | 근거 |
|---|---|---|
| 아카이브 (Helix 나선형) | ⚠️ | 탭 키가 스펙의 `archive/helix/feed`가 아니라 `archive/map/feed`로 되어있고, helix는 별도 탭 없이 archive 안에 좌우 패럴랙스 스크롤로만 근사 구현됨 |
| 지도 (카카오맵) | ✅ | 스펙이 dead code로 지목한 `DateMapView`/`HistoryKakaoMapView`는 실제로 이미 삭제됨(정리 완료). 단, "지도뷰 컴포넌트 자체를 없애라"는 체크포인트 관점에서는 `renderMap()`이 여전히 존재(§12 항목1 참고) |
| 피드 (데이트코스) | ❌ | moodFeedService.ts 자체가 없고, 피드는 하드코딩된 MOCK_COURSES 배열뿐. FUN-HIS-002 AI 데이트 코스 셔틀도 미구현(버튼은 있으나 onPress 없음) |

## §8 설정 탭

| 항목 | 상태 | 근거 |
|---|---|---|
| 프라이버시 컨트롤 슬라이더 | ✅ | sessionStore.privacyLevel과 실연동, chat.tsx 프롬프트에 반영됨 (Phase 7-1) |
| 오라 끄기 토글 | ⚠️ | UI 토글 + AsyncStorage 저장은 있으나, 스펙이 요구하는 "정적 스냅샷 배경 폴백" 등 실제 오라 렌더링과의 연결 지점이 코드에 없음 |
| 프로필 수정 | ✅ | `/(auth)/profile?from=settings`로 연결, 이름/MBTI 실제 갱신됨(단 이메일 등 다른 개인정보 항목은 별도 미구현) |
| 커플 연동 (초대코드) | ⚠️ | 코드(createCouple/joinCouple)는 완성됐으나 Supabase `couples` 테이블 생성 SQL이 아직 사용자에 의해 실행되지 않은 상태 |
| 계정 삭제 (2단계 확인) | ⚠️ | 2단계 확인 UI는 완성되어 있으나, 실제 서버/계정 데이터 삭제 로직 없이 signOut+로컬 리셋만 수행 |
| 테마 전환 | ✅ | light/dark/sigma 전환 정상 동작 |

## §9 구독/플랜

| 항목 | 상태 | 근거 |
|---|---|---|
| Coffee Talk/Deep Talk 플랜 | ✅ | `iapService.ts`의 가격 매트릭스가 스펙과 정확히 일치 |
| IAP 연동 | ⚠️ | react-native-iap 실제 API 호출 코드는 있으나, 네이티브 빌드가 아닌 현재 개발 환경에서는 샌드박스 모드로 가짜 성공만 반환 |
| Founding VIP | ⚠️ | redeem 로직/13개월차 자동전환 로직(`reconcileFoundingVipExpiry`)까지 작성되어 있으나 **둘 다 앱 어디서도 호출되지 않는 완전히 고립된 백엔드 로직**, `/settings/vip-code.tsx` 진입 화면도 없음 |
| 페이월 게이팅 (usePremiumGate) | ⚠️ | 훅 자체는 완성도 있게 구현되어 있으나 **어디서도 사용되지 않는 죽은 코드**. 거울방 월 사용 한도(Free 4회/Coffee 30회/Deep 100회) 로직은 아예 없음 |

## §10 공유 카드

| 항목 | 상태 | 근거 |
|---|---|---|
| 공유 카드 생성 | ❌ | 관련 컴포넌트/화면 전무 |
| ViewShot 연동 | ❌ | 패키지는 설치돼 있으나(`package.json`) 실제 import/사용 코드가 전혀 없음 |

## §11 Wrapped

| 항목 | 상태 | 근거 |
|---|---|---|
| 커플 Wrapped | ❌ | `CoupleWrappedModal.tsx`/`coupleWrappedService.ts` 파일 자체가 존재하지 않음 |
| 페이월 게이팅 | ❌ | 스펙이 "긴급 수정 필요"라 지적한 버그가, 기능 자체가 없어져서 오히려 더 원점 상태(게이팅할 대상이 없음) |

## §12.2 신규 개발 체크포인트 (8개 항목 전수 확인)

| 항목 | 상태 | 근거 |
|---|---|---|
| 히스토리 탭 구조 | ⚠️ | archive/helix/feed가 아니라 archive/map/feed로 구현, 지도 컴포넌트(`renderMap`)도 여전히 존재 |
| Wrapped 페이월 게이팅 | ❌ | 기능 자체 부재로 미해결 |
| Founding VIP | ⚠️ | isFoundingVip 필드/12개월무료/13개월차 전환 로직 모두 코드상 존재하나 전부 미호출 상태(죽은 코드) |
| API 키 격리 | ✅ | 전체 리포에서 Anthropic/Gemini/OpenAI 키의 클라이언트 노출 없음 확인(보안 이상 없음) |
| 오라 색상 | ✅ | 고정 hex 없이 auraEngine.buildAuraVector() 단일 경로로만 산출 |
| 색상 토큰 | ⚠️ | 13개 파일에서 57건의 원시 hex 잔존 확인 |
| PartnerStatusBar | ❌ | 컴포넌트 자체가 존재하지 않음 |
| scoreCalculator.ts | ⚠️ | 경로가 `src/utils/`가 아니라 `src/engine/`, `computeNationalPercentile`/`getTierFromScore`는 다른 이름(`getNationalPercentileTop`/`getRelationshipTier`)으로 존재, `formatScore()`를 안 쓰고 직접 `.toFixed(1)` 호출하는 곳(`useMidnightSettlement.ts`, `history.tsx`)이 남아있음 |

---

## 전체 요약 (56개 항목 기준)

| 상태 | 개수 | 비율 |
|---|---|---|
| ✅ 구현 완료 | 24 | 43% |
| ⚠️ 부분 구현 | 21 | 37.5% |
| ❌ 미구현 | 11 | 19.5% |

**가장 심각한 공백 (완전 미구현, 스펙상 우선순위 높음):**
- §6 주간 리포트 — 서비스 자체 부재 (§12.1 우선순위 5위 "바이럴 자산" 전제 조건)
- §10/§11 공유 카드·커플 Wrapped — 파일 자체 없음 (§11.3은 스펙이 "긴급 수정" 대상으로 지목했으나 오히려 기능이 사라진 상태)
- CrisisMode(§4)·PartnerStatusBar(§3) — 스토어/타입만 있고 UI·트리거 전무

**가장 흔한 패턴 — "정의는 있으나 호출되지 않는 죽은 코드":** coolingBleed, computeVolatilityIndex, detectRapidSwing, usePremiumGate, reconcileFoundingVipExpiry, redeemVipCode/vipPromotionService 전체, CrisisMode. 엔진/서비스 레이어는 상당히 잘 작성돼 있는데 UI/훅에서 실제로 연결하는 마지막 단계가 빠진 경우가 반복적으로 나타납니다.
