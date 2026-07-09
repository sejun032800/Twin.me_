# Twin.me 구버전 vs 신버전 전면 비교 분석

> **구버전:** Twin.Me-main (폐기된 앱, AppContext 기반 모놀리식 구조)  
> **신버전:** Twin.me_ (현재 개발 중, Zustand + Supabase Edge Function 기반)  
> **작성일:** 2026-07-08

---

## 1. 아키텍처 & 기술 스택

| 항목 | 구버전 | 신버전 | 비고 |
|---|---|---|---|
| 상태 관리 | AppContext.tsx (단일 65KB 모놀리스) | Zustand 4개 도메인 스토어 | userStore/coupleStore/scoreStore/sessionStore |
| 라우팅 | expo-router | expo-router | 동일 |
| 백엔드 | Supabase (직접 호출) | Supabase (Edge Function 프록시) | 신버전은 API 키 클라이언트 노출 없음 |
| LLM | Anthropic Claude (클라이언트 직접 호출, API 키 노출) | Gemini 2.5 Flash (Edge Function 프록시) | 신버전: 보안 강화 + 무료 API |
| 인증 | Supabase Auth | Supabase Auth | 동일 |
| 실시간 | Supabase Realtime | Supabase Realtime | 동일 |
| 영속화 | AsyncStorage (서비스별 개별 관리) | Zustand persist + AsyncStorage | 신버전: 통합 관리 |
| Expo SDK | 52.x | 54.x | |
| React | 18.x | 19.1.0 | |
| TypeScript | 5.x | 6.0.x | |

---

## 2. 온보딩 & 인증

| 기능 | 구버전 | 신버전 |
|---|---|---|
| 회원가입/로그인 | ✅ 이메일 | ✅ 이메일 |
| 소셜 로그인 | ✅ Google/Kakao/Naver/Apple (account-link.tsx) | ⚠️ UI만 (TODO) |
| 프로필 입력 | ✅ 이름/MBTI | ✅ 이름/MBTI/연애시작일 |
| 카카오톡 업로드 | ✅ txt | ✅ txt + zip 자동 압축해제 |
| 제네시스 인터뷰 | ✅ 4막 구조 | ✅ 4막 + confidence 임계값 연동 |
| 점토 성장 애니메이션 | ✅ ClayTwinAvatar 컴포넌트 (3D) | ⚠️ 이모지 텍스트만 (Lottie 미도입) |
| 오라 생성 ceremony | ✅ 시각적 연출 | ⚠️ 텍스트+원형 뷰 수준 |
| 개발용 테스트 진입 | ❌ | ✅ __DEV__ 플래그 버튼 |

---

## 3. 홈 탭 (메인 대시보드)

| 기능 | 구버전 | 신버전 |
|---|---|---|
| 일치율 게이지 | ✅ 원형 | ✅ 원형 (SVG RadialGradient) |
| S_Live / S_Current 2층 구조 | ⚠️ 혼용 | ✅ 명확히 분리 |
| 티어 시스템 | ✅ 10단계 | ✅ 10단계 |
| D-day 표시 | ✅ | ✅ |
| AI 코칭 카드 | ✅ AICoachingCard.tsx | ❌ 미구현 |
| 파트너 상태 바 | ✅ PartnerStatusBar (실시간) | ✅ PartnerStatusBar (sLive 기반) |
| 오버플로우 배너 | ✅ AccuracyBanner.tsx | ✅ OverflowBanner.tsx |
| 메모리 링 섹션 | ✅ MemoryRingSection.tsx | ❌ 미구현 |
| 클레이 트윈 아바타 | ✅ ClayTwinAvatar.tsx | ❌ 미구현 |
| 인터뷰 콜 모달 | ✅ InterviewCallModal.tsx | ❌ 미구현 |
| 마스터 퀘스천 모달 | ✅ MasterQuestionUnlockModal.tsx | ❌ 미구현 |
| 공유 카드 | ✅ | ✅ ViewShot + expo-sharing |
| 분위기 태그 | ⚠️ 파트너 실시간 연동 | ✅ sLive 기반 동적 생성 |

---

## 4. 채팅 탭

| 기능 | 구버전 | 신버전 |
|---|---|---|
| 3룸 구조 (연인/트윈/분석가) | ✅ | ✅ |
| 트윈 AI 응답 | ✅ Claude (API 키 노출) | ✅ Gemini (Edge Function 프록시) |
| 말투 복제 toneVector | ✅ 전 레벨 적용 | ✅ privacyLevel 2에서만 적용 |
| 스트리밍 응답 | ✅ useChatStream.ts | ❌ 일반 요청/응답 |
| Magic Mirror 모달 | ✅ MagicMirrorOptInModal.tsx | ❌ 미구현 |
| 주간 리포트 모달 | ✅ WeeklyReportModal.tsx | ✅ 분석가 룸 내 리포트 카드 |
| CrisisMode UI | ✅ | ✅ FadeIn 오버레이 |
| 연인 초기 모드 토글 | ✅ | ❌ 미구현 |
| 페이월 게이팅 | ✅ | ✅ 월 4회 무료 한도 |
| 키보드 회피 | ✅ react-native-avoid-softinput | ⚠️ KeyboardAvoidingView (offset 고정) |

---

## 5. 히스토리 탭

| 기능 | 구버전 | 신버전 |
|---|---|---|
| 탭 구조 | 추억 월 / 지도 / 무드 피드 | 아카이브 / 지도 / 피드 |
| 나선형 DNA 헬릭스 뷰 | ✅ RelationshipHelix.tsx (3D) | ⚠️ parallax 스크롤 근사 |
| 카카오맵 연동 | ✅ KakaoMapView.tsx | ⚠️ API 키 입력 시 활성화 (플레이스홀더) |
| 네이버맵 연동 | ✅ NaverMapView.tsx | ❌ 미구현 |
| OOTD 아카이브 그리드 | ✅ OOTDArchiveGrid.tsx | ❌ 미구현 |
| OOTD 업로드 시트 | ✅ OOTDUploadSheet.tsx | ❌ 미구현 |
| 데이트 코스 피드 | ✅ moodFeedService.ts | ✅ dateCourseService.ts (Supabase 연동) |
| AI 데이트 추천 | ✅ dateShuttleService.ts | ✅ callLLM() 기반 |
| 스토리 뷰어 | ✅ StoryViewer.tsx | ❌ 미구현 |
| 메모리 맵 최적화 | ✅ MemoryMapOptimizer.tsx | ❌ 미구현 |
| Wrapped | ✅ coupleWrappedService.ts | ✅ wrappedService.ts + WrappedModal.tsx |
| 하이라이트 갤러리 | ✅ kakaoHighlightService.ts | ❌ 미구현 |
| 사진 메타데이터 추출 | ✅ usePhotoMetadata.ts | ❌ 미구현 |

---

## 6. 설정 탭

| 기능 | 구버전 | 신버전 |
|---|---|---|
| 화면 테마 | ✅ 라이트/다크 | ✅ 라이트/다크/6 Sigma |
| 프라이버시 컨트롤 | ✅ privacyService.ts | ✅ sessionStore.privacyLevel + AI 프롬프트 연동 |
| 오라 끄기 | ✅ | ✅ sessionStore.reduceAuraMotion |
| 프로필 수정 | ✅ | ✅ |
| 개인정보 수정 | ✅ personal-info.tsx | ⚠️ TODO |
| 비밀번호/보안 | ✅ security.tsx | ⚠️ TODO |
| 소셜 계정 연동 | ✅ account-link.tsx | ⚠️ TODO |
| 커플 초대 코드 | ✅ inviteCodeService.ts | ✅ coupleService.ts + Supabase |
| Founding VIP | ✅ vip-code.tsx | ✅ settings 내 Modal |
| 13개월차 자동 전환 | ✅ | ✅ useVipReconcile.ts |
| 계정 삭제 (2단계) | ✅ | ✅ Edge Function delete-account |
| 데이터 권한 | ✅ data-permissions.tsx | ⚠️ TODO |
| AI 트윈 설정 | ✅ twin-ai.tsx | ⚠️ privacyLevel로 근사 |
| 지원/법률 링크 | ✅ | ✅ Linking.openURL |
| 테마 샵 | ❌ | ✅ (준비 중 Alert) |

---

## 7. 일치율 코어 엔진

| 기능 | 구버전 | 신버전 |
|---|---|---|
| processTick / eventClassifier | ✅ | ✅ |
| S_Live / S_Current 분리 | ⚠️ 혼용 | ✅ 명확히 분리 |
| settleMidnight 자정 정산 | ✅ | ✅ useMidnightSettlement.ts |
| coolingBleed | ⚠️ 미호출 | ✅ useMatchEngine에서 호출 |
| 위기 메모리 crisisMemoryActive | ✅ | ✅ |
| volatilityIndex | ⚠️ | ✅ 자정 정산 후 갱신 |
| rapidSwing → CrisisMode | ✅ | ✅ |
| 이벤트 커버리지 | ~50종 | ~77% (~74종) |

---

## 8. 백엔드 / 서비스

| 서비스 | 구버전 | 신버전 |
|---|---|---|
| 인증 | Supabase Auth | Supabase Auth |
| LLM 프록시 | ❌ 클라이언트 직접 호출 | ✅ Edge Function llm-route (Gemini) |
| 계정 삭제 | ❌ | ✅ Edge Function delete-account |
| couples 테이블 | ❌ | ✅ (SQL 실행 필요) |
| date_courses 테이블 | ❌ | ✅ (SQL 실행 필요) |
| 실시간 커플 동기화 | ✅ realtimeService.ts | ⚠️ 구조만 (미연동) |
| 날씨 서비스 | ✅ weatherService.ts | ❌ |
| 위치 서비스 | ✅ useGeoLocation.ts | ❌ |
| 파트너 무드 서비스 | ✅ partnerMoodService.ts | ❌ |
| 파트너 민감 감지 | ✅ partnerSensitiveService.ts | ❌ |
| 결제 추적 | ✅ billingTrackerService.ts | ❌ |
| AI 뮤즈 | ✅ aiMuseService.ts | ❌ |
| 코칭 서비스 | ✅ coachingService.ts | ❌ |

---

## 9. 푸시 알림

| 항목 | 구버전 | 신버전 |
|---|---|---|
| 로컬 알림 | ✅ localNotificationService.ts | ✅ notificationService.ts |
| 원격 푸시 | ✅ | ⚠️ EAS 프로젝트 연결 후 가능 |
| 자정 정산 알림 | ✅ | ✅ |
| 트윈 AI 응답 알림 | ❌ | ✅ |
| 리포트 도착 알림 | ✅ useReportScheduler.ts | ⚠️ TODO |

---

## 10. IAP / 구독

| 항목 | 구버전 | 신버전 |
|---|---|---|
| 플랜 구조 | ✅ Coffee Talk / Deep Talk Night | ✅ 동일 |
| react-native-iap | ✅ v15 | ✅ v15 |
| Founding VIP | ✅ | ✅ |
| 페이월 게이팅 | ✅ usePremiumGate | ✅ 실제 연동됨 |
| 거울방 한도 | ✅ 월 단위 | ✅ 월 단위 (4/30/100) |
| 리포트 접근 제한 | ✅ | ✅ |
| 네이티브 결제 테스트 | ⚠️ 샌드박스 | ⚠️ EAS Build 필요 |

---

## 11. 디자인 시스템

| 항목 | 구버전 | 신버전 |
|---|---|---|
| 폰트 | 시스템 폰트 | ✅ NotoSans/Serif KR |
| 컬러 토큰 | ❌ 하드코딩 다수 | ✅ colors.ts 토큰 시스템 |
| 테마 | 라이트/다크 | ✅ 라이트/다크/6 Sigma |
| 오라 시스템 | ✅ AuraMeshBackground (구현됨) | ⚠️ 단색 HSL (메시 보류) |
| 그라데이션 규칙 | ❌ 무분별 사용 | ✅ 시그니처 요소 전용 |
| TYPOGRAPHY 토큰 | ❌ | ✅ typography.ts |

---

## 12. 전체 요약

| 카테고리 | 구버전 우위 | 신버전 우위 | 동등 |
|---|---|---|---|
| 기능 완성도 | 더 많은 기능 (OOTD, 날씨, 위치 등) | 핵심 기능 안정적 | 엔진/결제 |
| 보안 | API 키 노출 | Edge Function 격리 | — |
| 아키텍처 | — | Zustand 도메인 분리 | — |
| 코드 품질 | — | 토큰 시스템, 타입 안전성 | — |
| 오라/감성 UI | AuraMeshBackground 구현됨 | 단색 HSL (보류) | — |
| 지도 | 카카오+네이버 | 카카오만 (플레이스홀더) | — |
| 스트리밍 | ✅ | ❌ | — |

### 신버전에서 구현해야 할 구버전 기능 우선순위

1. **AI 스트리밍 응답** — 대화 UX 핵심
2. **OOTD 업로드/아카이브** — 히스토리 탭 핵심 콘텐츠
3. **위치 기반 지도 서비스** — 카카오맵 실제 연동
4. **파트너 실시간 상태** — 커플 연동 핵심
5. **AI 코칭 카드** — 홈 탭 감성 요소
6. **오라 메시 그라데이션** — 6 Sigma 테마 완성
7. **날씨/분위기 연동** — 데이트 코스 추천 품질
8. **스트리밍 리포트** — 주간 리포트 UX
