# Twin.me 코드베이스 정밀 전수 감사 보고서 (2026-07-09)

## 조사 개요

- **범위**: `app/` + `src/` 전체 약 86개 파일 (코드 수정 없이 순수 조사만 수행)
- **방법**: 6개 영역(① 탭 화면 `app/(tabs)/*` + `app/_layout.tsx`, ② 인증/온보딩 `app/(auth)/*`, ③ `src/components/*`, ④ `src/services/*`, ⑤ `src/hooks/*` + `src/store/*`, ⑥ `src/engine/*` + `src/lib/*` + `src/api/*` + `src/data/*` + `src/types/*` + `src/utils/*` + `src/constants/*`)로 나누어 각 파일을 전체 정독하고, 5개 카테고리(죽은 코드 / 구버전 이식 잔재 / 런타임 잠재 버그 / UI-UX / 보안-프라이버시) 관점에서 교차 검증
- **결과**: 높음 12건, 중간 31건, 낮음 40건 — 총 83건 (중복 보고 병합 후 기준)

---

## 심각도: 높음 (12건)

```
[심각도: 높음] app/_layout.tsx:42
문제: <StatusBar style="light" />가 sessionStore.themeMode와 무관하게 항상 고정되어 있다.
영향: 라이트 테마(밝은 배경) 사용 시에도 상태바 아이콘/텍스트가 흰색으로 강제되어 시계·배터리·신호 아이콘이 배경에 묻혀 잘 안 보인다. useTheme()의 themeMode를 구독해 분기해야 한다.
```

```
[심각도: 높음] app/(tabs)/settings.tsx:567
문제: privacyLevelText 스타일이 color: SYS.TEXT_LIGHT(#FFFFFF)로 하드코딩되어 있다. 이 텍스트는 backgroundColor: theme.card인 rowGroup(L500) 안에 위치하는데, 라이트 테마에서 theme.card는 SYS.CARD_LIGHT(#FFFFFF)이다.
영향: 라이트 모드에서 "🛡️ 보호 — 최소한의 데이터만 학습해요" 같은 프라이버시 레벨 설명 텍스트가 흰 배경 위에 흰 글씨로 렌더링되어 완전히 안 보인다.
```

```
[심각도: 높음] app/(tabs)/history.tsx:219-288
문제: FeedTab의 filter(정렬 필터 칩)와 ootdOnly(OOTD 전용 스위치) state가 UI(Switch value, 칩 selected 스타일)에만 반영되고, 실제 courses 목록(L288)에는 전혀 적용되지 않는다. getPublicCourses() 호출(L225)도 파라미터 없이 항상 전체 목록을 가져온다.
영향: 사용자가 "⭐ 별점순"/"🕐 최신순"/"📍 내 지역" 필터나 "OOTD만 보기" 스위치를 조작해도 목록이 전혀 바뀌지 않는 완전히 죽은 기능.
```

```
[심각도: 높음] app/(auth)/splash.tsx:21-38
문제: navigate()는 매 렌더마다 새로 정의되는 일반 함수로 isOnboardingComplete를 클로저로 캡처하는데, 이를 실행하는 useEffect(() => {...}, [])는 마운트 시 딱 한 번만 실행되어 그 시점의 navigate 참조(및 그 안의 isOnboardingComplete 값)를 영구히 고정시킨다. userStore는 zustand persist + AsyncStorage로 비동기 하이드레이션되므로 컴포넌트 최초 렌더 시점에는 항상 initialState 기본값(isOnboardingComplete: false)이다.
영향: 온보딩을 이미 완료한 재방문 유저가 앱을 재실행할 때마다 스플래시 이후 /(tabs)가 아니라 /(auth)/welcome으로 튕겨나갈 가능성이 높다 — 재방문 유저 라우팅이 상시 깨져 있을 수 있는 핵심 버그.
```

```
[심각도: 높음] src/components/InterviewCallModal.tsx:82-99
문제: 전체화면 Modal(statusBarTranslucent) 내부 multiline TextInput이 KeyboardAvoidingView로 감싸지 않았다. 저장소 전체(src/)에 KeyboardAvoidingView를 쓰는 파일이 한 곳도 없음(app/(tabs)/chat.tsx 제외).
영향: 제네시스(온보딩) 인터뷰가 기본적으로 이 모달(voice 모드, app/(auth)/genesis.tsx:124-134)로 진입하는데, 키보드가 올라오면 답변 입력창과 전송/종료 버튼이 가려질 수 있다. 온보딩 핵심 플로우에 직접 영향.
```

```
[심각도: 높음] src/lib/kakaoParser.ts:590-643 (extractSweetSentences)
문제: 파일 헤더(23-28행)의 보안 계약은 "[파트너 이름]으로 시작하는 라인은 분석 전에 전부 DROP"이라고 명시하고 selectMemoryQuote(L510)는 이를 지키지만, extractSweetSentences는 rawText를 자체 정규식(WALL_MSG_RE)으로 다시 훑으며 parseKakaoExport의 필터링을 거치지 않고 speaker가 myName이 아니면 `speaker: 'partner'`로 태깅해 파트너 원문을 그대로 MemoryNode.quote 후보로 채택한다. kakaoIngestPipeline.ts:146이 마스킹 전 rawText 전체를 그대로 넘겨 호출하고, 결과는 AsyncStorage(twin_me_memory_wall_nodes_v1)에 영구 저장되어 MemoryRingSection/HighlightGallery UI에 노출된다.
영향: 파일이 스스로 선언한 "파트너 발화는 절대 후보가 되지 않는다"는 불변식이 위반된다. 파트너 동의 없이 파트너의 원문 메시지가 기기에 영구 저장·화면에 표시된다.
```

```
[심각도: 높음] src/services/iapService.ts:145-160 ↔ src/hooks/usePremiumGate.ts:51-70
문제: reconcileFoundingVipExpiry()는 founding-VIP 무료기간 만료 시 isPremium만 false로 바꾸고 isFoundingVip/foundingVipDiscountRate(0.5)는 "영구 할인" 요건에 따라 보존하도록 설계됐다. 그런데 buildFoundingVipStatus()가 expiresAt을 foundingVipFreeUntil과 동일하게 설정해두어, usePremiumGate.ts의 자체 만료 타이머(setTimeout)가 같은 시점에 별도로 발동해 setSubscriptionStatus({ ...DEFAULT_SUBSCRIPTION_STATUS })를 호출한다. 이는 isFoundingVip/foundingVipDiscountRate를 포함해 전체 상태를 완전히 초기화한다.
영향: founding VIP 13개월차 유저가 chat.tsx/history.tsx/WrappedModal.tsx 중 하나라도 마운트된 상태로 만료 시점을 맞으면, 영구 유지되어야 할 50% 평생 할인 자격이 통째로 사라지는 경쟁 상태(race condition) 버그.
```

```
[심각도: 높음] src/services/kakaoIngestPipeline.ts:29-31, 149-152
문제: generateFullReport는 "weeklyReportService: Edge Function 미구현"을 던지는 임시 스텁이며, runKakaoIngestPipeline() 내부에서 이 호출(149행)이 parseKakaoExport/runKakaoBatchDetection 호출(151-152행)보다 먼저 실행된다. 스텁이 항상 예외를 던진 뒤 뒤따르는 배치 탐지 코드는 절대 실행되지 않는다.
영향: kakao-upload.tsx가 예외를 "정상"으로 삼키도록 되어 있어 크래시는 없지만, 카카오톡 업로드 온보딩에서 runKakaoBatchDetection이 한 번도 호출되지 않는다 — import되고 코드는 정상이지만 도달 불가능.
```

```
[심각도: 높음] src/services/coachingService.ts:75-90 (generateCoachingReport)
문제: callLLM() 응답을 try/catch 없이 곧바로 JSON.parse(response.content) 한다. 시스템 프롬프트가 "반드시 JSON 형식으로만 응답"을 요구해도 LLM이 코드펜스로 감싸거나 부연 설명을 덧붙이면 JSON.parse가 SyntaxError를 던진다. 이 함수 자체에는 폴백이 없다.
영향: 예외가 chat.tsx의 try/catch에서 console.error만 찍히고 끝나, UI는 로딩 스피너가 잠깐 돌다 아무 것도 표시하지 않고 조용히 사라진다. 같은 패턴의 aiMuseService.ts/memoryMapService.ts는 폴백이 있는데 이 파일만 방어가 빠져 있다.
```

```
[심각도: 높음] src/hooks/useWeather.ts:16-29
문제: useEffect가 마운트 시 사용자 제스처 없이 자동으로 useGeoLocation().requestLocation()을 호출한다. 반면 같은 훅을 쓰는 history.tsx는 "AI 추천" 버튼 클릭 시에만 호출하는 대조적 패턴이다.
영향: 홈 탭이 마운트되는 순간 OS 위치 권한 다이얼로그가 아무 설명 없이 뜬다. useGeoLocation()은 훅 호출마다 독립적인 로컬 state를 새로 만들므로, useWeather()를 쓰는 화면이 둘 이상이 되면 각각 별도로 권한 요청/GPS 조회가 중복 발생할 위험도 있다.
```

```
[심각도: 높음] src/hooks/useMatchEngine.ts:56-76
문제: 루프 시작 전 한 번만 계산한 currentGateState(재할당 없는 const)를 매 코드 반복마다 evaluateGate에 그대로 넘긴다. classifyMessage()는 한 메시지에서 여러 코드를 동시에 반환하는 경우가 흔하다.
영향: codes.length > 1인 메시지에서 두 번째 이후 코드는 첫 번째 코드가 만든 nextState를 반영하지 않은 채 판정되어 게이트 감지(위기 트리거 등)가 누락되거나 잘못 발동할 수 있다. 최종 setGateState도 마지막 코드의 결과만 남아 중간 상태 전이가 유실된다.
```

```
[심각도: 높음] src/hooks/useVipReconcile.ts:12-21, src/hooks/useBillingTracker.ts:18-33, src/hooks/useMidnightSettlement.ts:68-89
문제: 세 훅 모두 app/_layout.tsx에서 마운트 시 1회 useUserStore.getState()/useScoreStore.getState()를 직접 읽는다. 그러나 이 스토어들은 AsyncStorage로 비동기 하이드레이션되며, 저장소 전체에 persist.hasHydrated()/onFinishHydration 같은 하이드레이션 완료 대기 로직이 전혀 없다(0건). 콜드 스타트 시 이 훅들이 실행되는 시점에 스토어가 여전히 초기값(subscriptionStatus:null, sBase:0, lastSettledAt:null 등)일 수 있다.
영향: useMidnightSettlement가 lastSettledAt=null을 "오늘 정산 안 됨"으로 오판해 0점 기준으로 즉시 정산을 실행, scoreHistory에 오염된 엔트리가 기록될 수 있다. useVipReconcile/useBillingTracker는 guard clause에 걸려 그 앱 실행 동안 VIP 재조정/만료 알림이 조용히 스킵된다. 타이밍 의존적 비결정적 버그라 저사양 기기·콜드 스타트에서 더 잘 발생.
```

---

## 심각도: 중간 (31건)

```
[심각도: 중간] app/_layout.tsx:28-29
문제: console.log('fontsLoaded:', ...) / console.log('fontError:', ...) 디버그 로그가 남아있다.
영향: 프로덕션 빌드에서도 매 렌더마다 콘솔에 로그 출력. 민감정보는 아니나 정리되지 않은 디버그 코드.
```

```
[심각도: 중간] app/(tabs)/settings.tsx:537,539
문제: themeBtnUnselected(backgroundColor: SYS.BG_DARK_MIDNIGHT), themeBtnText(color: SYS.TEXT_LIGHT)가 테마 모드와 무관하게 고정.
영향: 라이트 테마 화면 한가운데 "라이트"/"다크" 미선택 버튼이 항상 진한 네이비색 섬처럼 떠 있어 전체 톤과 어긋난다.
```

```
[심각도: 중간] app/(tabs)/chat.tsx:704,705,721,791
문제: dmTime/dmPreview/chatHeaderSub/msgTime 등 보조 텍스트가 '#555'/'#666'로 하드코딩되어 theme.textMuted를 쓰지 않는다.
영향: 다크 테마(기본값)에서 대비비 약 2~3:1로 채팅 리스트 시간/미리보기, 말풍선 타임스탬프가 흐릿하게 보인다.
```

```
[심각도: 중간] app/(tabs)/chat.tsx:284-288
문제: `if (fullText) { await scheduleLocalNotification(...) }`가 앱이 포그라운드인지 여부와 무관하게 항상 실행된다("AppState로 백그라운드 감지는 복잡하므로 일단 항상 발송 (TODO)" 주석 있음).
영향: 트윈 채팅방을 보고 있는 중에도(이미 화면에 답장이 스트리밍 표시되는데도) 동일 메시지에 대한 로컬 푸시 알림이 뜬다.
```

```
[심각도: 중간] app/(tabs)/history.tsx:224-229
문제: getPublicCourses().then(...)에 .catch()가 없다.
영향: 네트워크 오류 시 Promise reject 시 setLoading(false)가 실행되지 않아 ActivityIndicator가 영구 회전하는 무한 로딩 상태에 빠진다.
```

```
[심각도: 중간] app/(tabs)/history.tsx:246,264,291,300,313,327,339,547
문제: FeedTab/renderMap 곳곳에서 카드·칩·배지 배경색을 theme.card/theme.bgSecondary 대신 `themeMode === 'light' ? A : SYS.CARD_DARK` 삼항식으로 직접 분기한다. themeMode가 'sigma'인 경우도 else 분기(다크 고정색)로 떨어진다.
영향: sigma(개인화 오라) 테마 사용자는 다른 요소(accent, border 등)는 오라 색상으로 렌더링되는데 피드 탭 카드/칩/배지만 고정색으로 표시되어 색상이 서로 어긋난다.
```

```
[심각도: 중간] app/(tabs)/history.tsx:411-470
문제: AddPlaceModal(장소 추가 모달)이 하단 고정(justifyContent:'flex-end') 레이아웃으로 TextInput 3개와 저장 버튼을 배치하지만 KeyboardAvoidingView로 감싸지 않는다.
영향: 특히 Android 및 화면이 작은 iOS 기기에서 키보드가 올라오면 하단 입력창/저장 버튼이 가려질 수 있다.
```

```
[심각도: 중간] app/(tabs)/history.tsx:507-511
문제: handleAIRecommend에서 `await supabase.auth.getUser();` 결과를 변수에 담지 않고 버린다. settings.tsx의 동일 패턴(L111-112)은 `if (!user) return;` 가드가 있는 것과 대조적으로 이 함수엔 가드가 없다.
영향: user가 null이어도 이후 로직이 그대로 진행되어 로그인 안 된 상태에서도 AI 추천 API 호출이 시도될 수 있다.
```

```
[심각도: 중간] app/(tabs)/index.tsx:230-233 ↔ src/components/MasterQuestionModal.tsx:17,26-30
문제: MasterQuestionModal의 onSendToChat 콜백은 `(question: string) => void`로 실제 질문 텍스트를 인자로 넘기도록 설계됐으나, 실제 호출부(index.tsx)는 인자를 무시하고 router.push('/(tabs)/chat')만 호출한다("TODO: 채팅 탭에 질문 전달" 주석).
영향: 사용자가 "채팅에서 답하기"를 눌러도 질문 내용이 전달되지 않아 채팅 탭으로 이동만 될 뿐 무엇에 답해야 하는지 알 수 없다.
```

```
[심각도: 중간] app/(auth)/login.tsx:14-23
문제: signInWithPassword 성공 시 isOnboardingComplete나 서버 프로필 존재 여부를 확인하지 않고 무조건 router.replace('/(auth)/profile')로 이동한다.
영향: 이미 온보딩을 마친 계정으로 재로그인(기기 변경, 로그아웃 후 재로그인 등)하면 이름/MBTI를 처음부터 다시 입력하도록 강요받고 기존 값을 프리필하지 않아 조용히 덮어써진다. 제네시스 인터뷰까지 다시 거치게 됨.
```

```
[심각도: 중간, 확신 낮음] app/(auth)/login.tsx, signup.tsx, join.tsx
문제: 세 화면 모두 KeyboardAvoidingView 없이 justifyContent:'center'인 plain View만 사용(ScrollView도 아님).
영향: 작은 화면 기기에서 두 번째 입력창/제출 버튼이 키보드에 가려질 위험(실기기 미확인, 코드 구조상의 잠재 위험).
```

```
[심각도: 중간] app/(auth)/profile.tsx (전체 스타일)
문제: useTheme()를 전혀 호출하지 않고 SYS.BG_DARK_MIDNIGHT/SYS.TEXT_LIGHT로 고정. 이 화면은 settings.tsx의 "프로필 수정"(router.push('/(auth)/profile?from=settings'))을 통해 온보딩 완료 후에도 재진입 가능한데 settings.tsx는 완전히 테마 대응되어 있다.
영향: 라이트 모드 유저가 "프로필 수정"을 누르면 화면이 갑자기 고정 다크 배경으로 전환됐다 뒤로가기 시 다시 라이트로 돌아온다 — 테마 일관성이 깨지는 눈에 띄는 UX 결함.
```

```
[심각도: 중간, 외부 설정 의존/확인 불가] app/(auth)/profile.tsx:54-58
문제: handleComplete()는 supabase.auth.getUser()가 실패하면 setUserId/updateUser를 조용히 건너뛰고도 로컬 상태는 저장한 뒤 다음 단계로 진행한다. Supabase 이메일 확인 설정이 켜져 있으면 signUp() 직후 활성 세션이 없을 수 있음.
영향: userId가 설정되지 않은 채 온보딩이 완료되면 이후 userId 의존 기능(커플 연동, 서버 동기화)이 조용히 깨질 수 있다.
```

```
[심각도: 중간] app/(auth)/kakao-upload.tsx:93-96
문제: runKakaoIngestPipeline 호출을 감싼 catch가 모든 예외를 구분 없이 console.log만 하고 삼킨다("weeklyReportService 스텁 에러는 무시" 주석이지만 zip 파싱 실패, AsyncStorage 쓰기 실패 등 실제 오류도 동일하게 무시).
영향: 카톡 데이터 처리 파이프라인의 실제 실패가 사용자/로그 상 구분되지 않아 디버깅이 어렵고, 실패해도 성공한 것처럼 다음 화면으로 넘어간다.
```

```
[심각도: 중간] app/(auth)/join.tsx:26-29
문제: supabase.auth.getUser()가 user를 반환하지 못하면 바로 return하는데 이 경로에 Alert가 없다(다른 실패 경로는 모두 Alert.alert 사용).
영향: 세션 만료 상태에서 "연동하기"를 누르면 아무 반응이 없는 것처럼 보여 버그로 오인될 수 있다.
```

```
[심각도: 중간] src/components/InterviewCallModal.tsx:47,111-118
문제: statusBarTranslucent 전체화면 Modal인데 SafeAreaView 없이 paddingTop:64/paddingBottom:32를 하드코딩. 같은 패턴의 StoryViewer.tsx는 SafeAreaView edges={['top']}를 정확히 사용.
영향: 노치/다이내믹 아일랜드가 큰 기기나 하단 제스처 바 기기에서 발신자 정보/통화 버튼이 시스템 UI에 가려질 수 있다.
```

```
[심각도: 중간] src/components/OOTDUploadSheet.tsx:144-151
문제: 하단 바텀시트(justifyContent:'flex-end') 안의 noteInput(multiline TextInput)이 KeyboardAvoidingView 없이 배치되어 있다.
영향: "오늘 하루 한 줄" 메모 입력 시 입력창과 바로 아래 저장 버튼이 키보드에 가려질 위험이 크다.
```

```
[심각도: 중간] src/components/OOTDUploadSheet.tsx:71-75, 153-155
문제: extractMetadata가 사진 EXIF에서 GPS 좌표를 사용자 동의 절차 없이 자동 추출하고 handleSave를 통해 AsyncStorage(ootdService.ts)에 평문 영구 저장한다. 화면에는 저장 "이후"에야 "📍 위치 정보가 감지됐어요" 안내만 뜬다(유사 기능인 MagicMirrorModal.tsx는 명시적 opt-in 모달을 둠).
영향: 정밀 위치 정보가 사용자 인지 전에 이미 수집·저장 완료되어 프라이버시 관점에서 문제될 수 있다.
```

```
[심각도: 중간] src/components/OOTDArchiveGrid.tsx (history.tsx의 ArchiveTab 배치 구조)
문제: OOTDArchiveGrid는 Animated.ScrollView 내부가 아니라 그 "위쪽 비스크롤 영역"(고정 View의 자식)에 배치되어 있다. FlatList(scrollEnabled=false) 자체의 중첩 경고는 없지만, 이 영역이 스크롤 불가능한 순수 View이기 때문에 OOTD 사진이 쌓여 그리드 행 수가 늘수록(numColumns=3) 화면 높이를 초과해도 스크롤할 방법이 없다.
영향: OOTD 아카이브가 쌓일수록(실사용자가 계속 쓸 기능일수록) 아카이브 탭 상단이 화면을 넘쳐 하이라이트 갤러리/Helix/Wrapped 버튼 등 하단 콘텐츠를 밀어내거나 가릴 수 있다.
```

```
[심각도: 중간] src/services/iapService.ts:234-548 (purchaseSubscription, purchaseOneTimeProduct, initIAP, teardownIAP, getAvailableSubscriptions, verifyThemeOwnership 등)
문제: 저장소 전체에서 이 함수들을 import하는 곳이 자기 자신 외에는 없다(구독/단건결제 UI 미연결).
영향: 결제 플로우 전체가 어떤 화면에서도 연결되어 있지 않다 — 기능은 완성되어 있어도 사용자에게 도달하는 경로가 없는 사실상 죽은 코드.
```

```
[심각도: 중간] src/services/vipPromotionService.ts:166-173 (loadFoundingVipState)
문제: redeemVipCode(mock 모드)는 `vip_promo_state:${userId}` 키로 AsyncStorage에 저장하지만, 이를 읽는 loadFoundingVipState()는 저장소 전체에서 어디에서도 호출되지 않는다. 실제 영속화는 userStore.ts의 zustand persist가 담당.
영향: 죽은 함수이며 `vip_promo_state:${userId}` 엔트리가 아무도 읽지 않는 고아 데이터로 남는다.
```

```
[심각도: 중간] src/services/masterQuestionService.ts:32-37 ↔ app/(tabs)/index.tsx:74-78
문제: lastShownDate는 모듈 로드 시 AsyncStorage.getItem(SHOWN_KEY).then(...)으로 비동기 하이드레이션되며 이를 기다리는 동기화 장치가 없다. shouldShowMasterQuestion()은 동기 함수인데 index.tsx가 마운트 직후 useEffect에서 곧바로 호출한다.
영향: 앱 재시작 직후 AsyncStorage 읽기가 완료되기 전이면 lastShownDate가 여전히 null이라 "오늘 이미 봤는지" 판정이 실패해 이미 오늘 본 사용자에게 마스터 퀘스천이 다시 노출될 수 있다.
```

```
[심각도: 중간] src/services/wrappedService.ts:35-89, src/components/WrappedModal.tsx:24-39,79-84
문제: generateWrapped()는 hasReportAccess 여부와 무관하게 무조건 callLLM을 호출해 aiSummary를 생성한다. WrappedModal은 무료 유저에게 통계 위에 lockOverlay를 얹어 시각적으로만 가릴 뿐 LLM 호출 자체는 동일하게 발생. 날짜 기반 캐시도 없어(coachingService/weeklyReportService와 달리) 재오픈마다 재생성됨.
영향: 무료 유저가 모달을 열 때마다 잠금 콘텐츠임에도 Gemini API 호출 비용이 발생.
```

```
[심각도: 중간] src/services/partnerSensitiveService.ts:13-18, 27-36 (detectSensitiveContent)
문제: text.includes(pattern) 방식의 단순 부분 문자열 매칭이며 "또", "전에는", "됐어" 같은 매우 일반적인 표현이 패턴 목록에 포함.
영향: "또 만나자!", "그렇게 됐어 다행이야"처럼 무관한 정상 메시지도 오탐지되어 불필요한 감정 넛지가 자주 뜬다.
```

```
[심각도: 중간] src/services/iapService.ts:109-137 (getPlanMetadataByStatus)
문제: 첫 파라미터 `_isPartnerLinked`가 밑줄 처리되어 미사용. 주석은 "파트너 연동 여부에 따라 추천 상품이 달라진다"고 하지만 실제로는 이 값을 참조하지 않는다. 이 함수를 호출하는 곳도 코드베이스 어디에도 없다.
영향: 문서화된 동작(파트너 연동별 추천 차등)이 구현되지 않았고, 함수 자체도 죽은 코드.
```

```
[심각도: 중간] src/lib/kakaoParser.ts:540, 611 (WALL_MSG_RE)
문제: extractSweetSentences 전용 정규식이 IOS_MSG_RE와 동일한 iOS 내보내기 포맷만 매치한다. 파일 상단의 양쪽 포맷을 지원하는 parseKakaoLine()을 재사용하지 않고 자체 재구현했다.
영향: Android/PC에서 내보낸 카카오톡 대화(`2024. 6. 15. 오후 11:23, 이름 : ...`) 포맷에 대해서는 추억 벽(Memory Wall) 기능이 항상 빈 결과만 반환한다.
```

```
[심각도: 중간] src/engine/auraThemeEngine.ts (resolveAuraScreenKey, computeContextMultiplier, computeAuraOpacity, followEasingStep, applyOverflowSaturationFeedback, dissolveMeshStops, defaultNeutralMeshStops 등)
문제: 이 파일이 export하는 함수 중 NEUTRAL_CLAY_CHANNEL(상수)과 AuraScreenKey(타입)만 실제 앱 코드에서 import된다. 나머지는 저장소 전체에서 자기 자신 외에 호출되지 않는다. sessionStore.ts의 setAuraScreenKey 액션도 호출부가 없어 currentAuraScreenKey는 항상 초기값 'other'에 머문다.
영향: docs/audit_v2.6_2026-07-08.md 등 기존 감사 문서는 이 로직을 "✅ 구현 완료"로 표시했지만, 실제 렌더링 경로에는 배선되지 않았다 — 화면별 오라 강도 조절, Dissolve 모션, 오버플로우 채도 피드백 등 6-Sigma 오라 스펙의 상당 부분이 실제로는 미작동 상태.
```

```
[심각도: 중간] "AppContext" 잔존 주석 (7곳): src/hooks/usePremiumGate.ts:5, src/services/iapService.ts:143, src/services/vipPromotionService.ts:163, src/lib/kakaoParser.ts:1,392,510, src/types/genesis.ts:4
문제: 모두 실제 import가 아닌 주석/JSDoc 텍스트이지만, "Reads subscriptionStatus from AppContext"(usePremiumGate.ts:5), "AppContext 하이드레이션에서 앱 런치마다 호출된다"(iapService.ts:143, vipPromotionService.ts:163), "see AppContext.tsx"(kakaoParser.ts:392), "AppContext, genesisInference, genesisBlending, auraEngine이 공유한다"(genesis.ts:4)처럼 이미 삭제된 AppContext.tsx를 실제 아키텍처인 것처럼 서술한다. 실제 소비자는 Zustand 스토어(userStore.ts)와 useVipReconcile.ts 훅이다.
영향: 기능상 문제는 없으나 신규 합류자가 실제 하이드레이션/영속화 로직을 존재하지 않는 AppContext.tsx에서 찾다가 혼란을 겪을 수 있다. 문서-코드 불일치가 7곳에 걸쳐 반복되는 시스템적 패턴.
```

```
[심각도: 중간] src/hooks/useCrisisIntelligence.ts (전체)
문제: aggression/defensiveness/empathyDecay 3-signal 스코어링 + LLM refinement 파이프라인이 온전히 구현되어 있으나, 저장소 전체에서 자기 자신 정의 외에 import하는 곳이 없다. chat.tsx 헤더 주석도 "실제 AI 연동(§4.3 이하)은 TODO"라고 명시.
영향: 완성된 위기 감지 기능이 UI에 전혀 연결되지 않은 죽은 코드. 향후 연동 시 llmRoutingService 스텁(항상 throw)도 함께 교체해야 함을 놓치기 쉽다.
```

```
[심각도: 중간] src/store/userStore.ts:82-84, src/store/coupleStore.ts:66-69, src/store/scoreStore.ts:98-101
문제: 네 스토어 모두 createJSONStorage(() => AsyncStorage)만 사용하고 암호화 레이어(예: expo-secure-store)가 없다. userStore는 personaMatrix(에니어그램+베이지안 심리 프로파일+오라 벡터)와 toneVector(카톡 원문 기반 말투 지문)를, coupleStore는 파트너 이름/연애 시작일/기념일을, scoreStore는 관계 갈등 이벤트 로그와 400일치 점수 히스토리를 평문 저장한다.
영향: 루팅/탈옥 기기나 기기 백업 추출 시 심리 프로파일·연애 갈등 이력 등 민감한 개인 데이터가 그대로 노출된다.
```

---

## 심각도: 낮음 (40건)

```
[심각도: 낮음] app/(tabs)/settings.tsx:278
문제: <Slider maximumTrackTintColor={SYS.BG_DARK_MIDNIGHT} />가 테마와 무관하게 고정.
영향: 라이트 모드에서 슬라이더의 미충전 트랙이 거의 검정에 가까운 색으로 카드(흰 배경) 위에 이질적으로 도드라짐.
```

```
[심각도: 낮음] app/(tabs)/settings.tsx:69,195,254,492,516
문제: 화살표 아이콘 색, sectionHeader/rowSub 텍스트가 '#555'/'#666'로 하드코딩되어 theme.textMuted를 쓰지 않는다.
영향: 다크 모드에서 대비비 약 2.1~2.8:1로 WCAG AA 기준(4.5:1) 미달, 작은 텍스트가 흐릿하게 보임.
```

```
[심각도: 낮음] app/(tabs)/chat.tsx:6
문제: 파일 헤더 주석 "실제 AI 연동(§4.3 이하)은 TODO — 지금은 전송 시 고정 스텁 메시지만 추가한다"가 실제 구현(callLLMStream 실시간 스트리밍 연동)과 맞지 않는다.
영향: 문서-코드 불일치로 유지보수자가 잘못된 전제로 코드를 읽을 위험.
```

```
[심각도: 낮음] app/(tabs)/history.tsx:483-485
문제: loadDatePlaces().then(setPlaces)에 .catch()가 없다.
영향: 실패 시 unhandled promise rejection 발생하나 places는 초기값(빈 배열) 유지되어 빈 상태로 표시되므로 체감 영향은 적음.
```

```
[심각도: 낮음] app/(tabs)/history.tsx:693-694 (HelixCard 사용처)
문제: helixTag의 backgroundColor가 SYS.BG_DARK_MIDNIGHT로 테마와 무관하게 고정.
영향: 라이트 모드에서 아카이브 카드 안 태그 칩만 진한 네이비색으로 떠 보여 시각적으로 이질적(가독성 자체는 문제없음).
```

```
[심각도: 낮음] app/(tabs)/history.tsx:836,691
문제: courseArrow, helixDate 등 보조 텍스트가 '#555'/'#666'로 하드코딩.
영향: 다크 테마에서 대비비 낮음. 동일 패턴 반복.
```

```
[심각도: 낮음] app/(tabs)/_layout.tsx:17
문제: tabBarStyle.borderTopColor가 SYS.CARD_DARK로 테마와 무관하게 고정.
영향: 라이트 테마에서 탭바 상단 테두리만 어두운 색 선으로 표시되어 시각적 일관성 저하(가독성 문제는 아님).
```

```
[심각도: 낮음] app/(tabs)/chat.tsx:46, history.tsx:151·216·370·474, index.tsx:55, settings.tsx:49·79 등
문제: `const styles = makeStyles(theme);`가 컴포넌트 렌더마다(useMemo 없이) StyleSheet.create()를 새로 호출한다. HelixCard 같은 리스트 아이템에서는 렌더될 때마다 반복 생성됨.
영향: 기능상 문제는 없으나 불필요한 재계산/재할당으로 경미한 성능 낭비.
```

```
[심각도: 낮음] app/(auth)/profile.tsx:85-92
문제: relationshipStartDate 입력란이 placeholder "YYYY-MM-DD" 힌트만 있고 포맷 검증이 없다(computeDDay의 isNaN 가드는 있어 크래시는 없음).
영향: 형식이 틀린 날짜 입력 시 D-day 표시가 조용히 사라질 뿐 안내가 없어 사용자가 원인을 알 수 없다.
```

```
[심각도: 낮음] app/(auth)/kakao-upload.tsx:21
문제: `const setToneVector = useUserStore((s) => s.setToneVector);`로 가져오지만 파일 어디서도 호출되지 않는다("Phase 5에서 연결" TODO와 일치).
영향: 죽은 바인딩으로, 실제로 연결됐다는 착각을 줄 수 있음.
```

```
[심각도: 낮음] app/(auth)/join.tsx:56
문제: placeholderTextColor="#555" 하드코딩(같은 파일 다른 텍스트는 SYS.TEXT_LIGHT/TEXT_MUTED 토큰 사용).
영향: 고정 다크 배경이라 당장 문제는 없으나 토큰 일관성이 깨짐.
```

```
[심각도: 낮음] app/(auth)/join.tsx:77 (backBtn: position:'absolute', top:60, left:24)
문제: app/(auth) 폴더 전체에 SafeAreaView/useSafeAreaInsets 사용이 없다(0건). join.tsx만 유일하게 상단에 절대 위치로 요소 배치.
영향: top:60 고정값이 기기별 노치/Dynamic Island 높이 차이를 반영하지 못해 상태바에 가리거나 과도한 여백이 생길 수 있다.
```

```
[심각도: 낮음] src/components/ClayTwinAvatar.tsx:67-68
문제: 오라 링 SVG viewBox="0 0 116 116"가 하드코딩되어 있어 size 기본값 100일 때만 정확히 맞는다. 실제 렌더 크기는 size에 따라 바뀌지만 viewBox는 고정.
영향: 현재 두 사용처(index.tsx, InterviewCallModal.tsx) 모두 size 100(또는 기본값)이라 당장 드러나지 않지만, 다른 크기로 재사용하는 순간 시각적으로 깨진다.
```

```
[심각도: 낮음] src/components/ClayTwinAvatar.tsx:20,55-58,82-106
문제: clayStage?: 0|1|2|3 4단계가 모두 구현돼 있지만 실제 호출부(index.tsx, InterviewCallModal.tsx) 둘 다 clayStage={3}으로 고정.
영향: 0/1/2 단계 렌더링 분기(무정형 원, 실루엣, 얼굴 없는 채색)가 실제 앱에서 도달 불가능한 죽은 코드일 가능성이 높다.
```

```
[심각도: 낮음, 확인 필요] src/components/OOTDArchiveGrid.tsx:58-82
문제: FlatList에 scrollEnabled={false}만 주고 initialNumToRender/getItemLayout 미지정. 스크롤 비활성 상태에서 초기 렌더 개수(기본 10) 이후 항목이 전부 렌더링되는지는 RN 버전/레이아웃 타이밍에 따라 갈리는 알려진 함정.
영향: OOTD 항목이 10개(약 3~4행) 초과 시 일부 사진이 렌더링되지 않을 수 있다(실기기 확인 필요).
```

```
[심각도: 낮음] src/components/OverflowBanner.tsx:39,49-52
문제: 헤더 주석은 "닫기는 세션 메모리(useRef)에만 당일치 날짜를 기록"한다고 되어 있으나, useRef는 컴포넌트 인스턴스에 종속되어 언마운트 시 초기화된다.
영향: 특정 네비게이션 구성에서는 같은 날 배너를 닫아도 화면을 벗어났다 돌아오면 다시 노출될 수 있다(Expo Router 탭 freeze 여부에 따라 다름).
```

```
[심각도: 낮음] src/components/MuseSheet.tsx:100-105, src/components/PartnerStatusBar.tsx:198-204
문제: 바텀시트(justifyContent:'flex-end')가 padding:24만 지정하고 useSafeAreaInsets 등으로 하단 안전영역을 보정하지 않는다(WrappedModal.tsx는 paddingBottom:32로 부분 처리함).
영향: 홈 인디케이터가 있는 기기에서 시트 하단 버튼/텍스트가 제스처 바에 가깝게 붙어 보일 수 있다.
```

```
[심각도: 낮음] src/services/weatherService.ts:18-24, 67-92 ↔ app/(tabs)/index.tsx:133-137
문제: API 실패 시 FALLBACK_WEATHER(temperature:0, emoji:'🌡️', description:'날씨 정보 없음')를 반환하는데 호출부는 `weather.emoji weather.temperature°`로만 렌더링(description은 UI 미노출).
영향: 실패 시 사용자가 "🌡️ 0°"를 실제 기온으로 오인할 수 있다(한겨울엔 그럴듯한 값이라 구분 불가) — 실패 상태를 알리는 UI 신호 없음.
```

```
[심각도: 낮음] src/services/weatherService.ts:26-31, 44-65
문제: 위도/경도 원본 좌표가 twin_weather_cache_v1 키에 암호화 없이 평문으로 AsyncStorage 저장된다.
영향: 기기 물리 접근 시 제3자가 파일시스템 조회로 사용자의 대략적 위치(캐시 시점 기준)를 알아낼 수 있다.
```

```
[심각도: 낮음] src/services/dateCourseService.ts:141-155 ↔ app/(tabs)/history.tsx
문제: Supabase date_courses 테이블 조회 실패 시 MOCK_COURSES(가짜 좋아요 수·후기 포함)로 조용히 폴백하며 이를 구분하는 플래그가 없다.
영향: "인기 데이트코스" UI가 항상 정상으로 보이지만 실제로는 하드코딩된 가짜 통계를 실제 유저 데이터처럼 노출할 위험(현재 Supabase 테이블 미생성 상태에서 특히 해당).
```

```
[심각도: 낮음] src/components/PartnerStatusBar.tsx:39-48, src/services/partnerMoodService.ts:53-67
문제: setMyMood 실패(예: partner_moods 테이블 미생성)를 catch에서 조용히 무시하고 모달만 닫는다. 저장 실패를 알리는 토스트/에러 UI가 없다.
영향: 사용자는 무드를 선택했다고 생각하지만 실제로는 저장되지 않았을 수 있고 아무 피드백도 받지 못한다.
```

```
[심각도: 낮음] src/components/AICoachingCard.tsx ↔ src/services/coachingService.ts
문제: 홈 탭의 AICoachingCard.tsx는 자체적으로 twin_coaching_cache_v1 키와 별도의 callLLM 호출 로직을 컴포넌트 안에 직접 구현한다. 반면 coachingService.ts는 twin_coaching_report_v1 키로 별개의 "주간 코칭 리포트" 서비스를 제공한다. 두 기능이 "코칭"이라는 이름으로 병존하지만 캐시 키·프롬프트·데이터 소스(일간 vs 주간)가 다르고 코드가 공유되지 않는다.
영향: 기능적 충돌은 없으나 "코칭 메시지" 수정 시 두 곳을 모두 고쳐야 함을 놓치기 쉬운 구조.
```

```
[심각도: 낮음] src/lib/kakaoParser.ts:473-504, 590-643 (selectMemoryQuote, extractSweetSentences)
문제: 두 함수 모두 추출한 문장에 maskSensitive()/maskPII()를 적용하지 않는다(parseKakaoExport의 myLines 파이프라인만 마스킹). 원문을 그대로 AsyncStorage에 영구 저장.
영향: 감성 키워드와 전화번호가 같은 문장에 있으면(예: "010-1234-5678로 전화해줘 고마워") 번호가 마스킹 없이 영구 저장·노출될 수 있다.
```

```
[심각도: 낮음] src/engine/scoreCalculator.ts:26,72,110 (getMBTICompatibilityGrade, generateBaseScore, computeMasterBase)
문제: "S_Base = 70 + Z_Total×7.81" 등 §5 수식을 구현한 이 세 함수는 저장소 전체에서 호출되지 않는다(유일한 참조는 genesis.tsx의 TODO 주석). 실제로는 genesis.tsx의 handleStart()가 BASE_SCORE_BY_TYPE 하드코딩 테이블로 sBase를 초기화한다.
영향: 문서화된 MBTI+에니어그램 기반 정규분포 점수 산출 로직이 실제로는 전혀 사용되지 않고 고정 상수(65~74)로 대체됨.
```

```
[심각도: 낮음] src/engine/genesisBlending.ts:86 (buildPersonaBlendPromptSection)
문제: export되어 있으나 이 파일 밖에서 import하는 곳이 없다.
영향: PersonaBlend를 자연어 톤 지침으로 바꿔 LLM에 주입하는 기능이 실제 트윈 AI 응답에 반영되지 않고 있을 가능성.
```

```
[심각도: 낮음] src/engine/auraEngine.ts:10 (AURA_AXIS_DIRECTIONS)
문제: 6축 방향 설명 문자열 테이블이 export되어 있지만 다른 파일에서 참조되지 않는다.
영향: "Why My Aura" 계열 UI에 쓰일 것으로 보이나 현재 미사용 데이터.
```

```
[심각도: 낮음] src/data/auraStoryPool.ts:91 (getAllAuraStoryEntries)
문제: export되어 있으나 호출부 없음.
```

```
[심각도: 낮음] src/engine/userToneVectorBuilder.ts:366 (pickFewShotAnchors)
문제: export되어 있으나 호출부 없음. Stage 3 few-shot anchor 주입 기능이 실제 LLM 프롬프트 조립에 연결되지 않은 것으로 보임.
```

```
[심각도: 낮음] src/engine/metrics.ts:488,492
문제: `const humCount = codes.filter(...)`로 계산한 값을 바로 다음 줄(별도 window.filter(...).length 재계산)에서는 쓰지 않고 `void humCount;`로 버린다.
영향: 기능 버그는 아니나 매 콤보 탐지 호출마다 불필요한 배열 순회가 발생하고, 리뷰어가 이 값이 로직에 쓰이는 것으로 오해할 수 있다.
```

```
[심각도: 낮음] src/lib/kakaoParser.ts:2-19 ↔ src/services/dateCourseService.ts:43-55
문제: 동일한 이름 `DateCourse` interface가 완전히 다른 필드 구성으로 두 곳에 정의되어 있다(kakaoParser.ts는 "내 데이트 기록", dateCourseService.ts는 "공개 추천 코스"). kakaoParser.ts 주석은 "AppContext 의존성 제거를 위해 인라인 정의"라 밝혀 원래 공유 타입이었던 흔적이 남아 있다.
영향: 즉각적인 컴파일 에러는 없으나 동일 이름의 무관한 두 타입이 존재해 import 시 실수 위험, 개념 혼동 소지.
```

```
[심각도: 낮음] src/lib/supabaseClient.ts:3-6
문제: EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_ANON_KEY가 없으면 빈 문자열로 폴백한 뒤 그대로 createClient('', '')를 호출한다(하드코딩된 키/시크릿은 없음 — 양호).
영향: env 미설정 배포 환경에서 supabase-js가 모듈 로드 시점에 즉시 예외를 던져 앱 전체가 크래시할 수 있다.
```

```
[심각도: 낮음] src/api/llm.ts:30-38 (callLLMStream)
문제: supabase.auth.getSession()의 error를 확인하지 않고 바로 session.data.session?.access_token을 사용한다.
영향: 세션 조회 실패 시 "Authorization: Bearer undefined" 헤더로 요청이 나가 실패 원인이 "세션 없음"이 아니라 "LLM 호출 실패"로만 보고되어 디버깅이 어려워짐.
```

```
[심각도: 낮음, 이론적 위험] src/data/genesisQuestionBank.ts:307-324 (matchArchetype)
문제: question.archetypes[0]를 안전 폴백으로 쓰는데 archetypes가 빈 배열이면 undefined 반환(현재 모든 질문은 archetypes 1개 이상이라 실제 트리거 안 됨).
영향: 향후 archetypes 없는 질문이 추가되면 호출부에서 undefined 역참조 위험.
```

```
[심각도: 낮음] src/hooks/useWeather.ts:12,31
문제: 훅이 WeatherData | null만 반환하고 loading/error 상태를 노출하지 않는다.
영향: 소비 측(index.tsx)이 "로딩 중"과 "조회 실패"를 구분할 UI를 만들 수 없다.
```

```
[심각도: 낮음] src/hooks/useWeather.ts:19-22
문제: weatherService.getCurrentWeather는 좌표 기준 1시간 캐시를 쓰지만, 캐시 확인 전에 매 마운트마다 requestLocation()으로 실 GPS fix를 새로 수행한다.
영향: 날씨 데이터는 캐시돼도 위치 조회는 캐시되지 않아 불필요한 배터리/GPS 사용이 매 마운트마다 발생.
```

```
[심각도: 낮음] src/hooks/useMatchEngine.ts:14-16
문제: `useScoreStore()`, `useSessionStore()`를 셀렉터 없이 스토어 전체 구독한다.
영향: processMessage와 무관한 필드(scoreHistory, themeMode 등)가 바뀔 때도 chat.tsx가 불필요하게 리렌더된다.
```

```
[심각도: 낮음] src/hooks/useCrisisIntelligence.ts:195-197,220,223
문제: AbortController를 만들어 abortRef에 저장하지만 llmRoutingService.routeInference 호출에 ctrl.signal을 전달하지 않는다 — 실제 진행 중인 요청을 취소하지는 못한다.
영향: 현재는 스텁이라 무해하나, 실제 Edge Function으로 교체되면 연속 메시지 입력 시 취소되지 않은 이전 요청들이 계속 네트워크 자원을 소모한다.
```

```
[심각도: 낮음] src/hooks/useMidnightSettlement.ts:80, src/hooks/useBillingTracker.ts:19-32
문제: runSettlement() 호출 및 async IIFE 전체가 try/catch로 감싸지지 않았다. scheduleLocalNotification 내부 Notifications.scheduleNotificationAsync 실패 시(알림 권한 미부여 등) unhandled promise rejection 발생.
영향: 정산/구독 데이터 자체는 갱신된 뒤라 치명적이지 않으나 실패가 조용히 콘솔 경고로만 남고 재시도/로깅 경로가 없다.
```

```
[심각도: 낮음] src/hooks/useNotifications.ts:16-18
문제: registerForPushNotifications().then((token) => {...})에 .catch()가 없다.
영향: 권한 요청 API가 예외를 던지면 unhandled promise rejection 발생(리스너 등록 자체는 영향 없음).
```

```
[심각도: 낮음] src/store/sessionStore.ts:35,51,68,90 (currentAuraScreenKey, setAuraScreenKey)
문제: 정의는 있으나 스토어 자기 자신 외에는 저장소 전체에서 setAuraScreenKey를 호출하거나 currentAuraScreenKey를 읽는 곳이 없다(위 auraThemeEngine.ts 미배선 이슈와 직결).
영향: "화면별 오라 강도 라우팅" 의도 기능이 실제로 어디에도 연결되지 않은 죽은 상태.
```

```
[심각도: 낮음] src/store/userStore.ts:25,41 (lastGenesisAt, setLastGenesisAt)
문제: 정의는 있으나 저장소 전체에서 이 필드를 set/get하는 곳이 스토어 정의 자체 외에는 없다.
영향: "마지막 제네시스 인터뷰 시각"을 기록하려는 의도로 보이나 값이 영구히 null로 남는다.
```

---

## 검증 결과 문제없음 (참고용)

- `app/(auth)/kakao-upload.tsx:91,95`의 `console.log(result.batchSummary)` / `console.log(e)` — `KakaoBatchDetectionResult` 타입은 통계 집계값만 포함하고 원문 텍스트는 없음을 코드 확인. 민감정보 노출 아님.
- `src/components/*` 16개 파일 전체에서 `SYS.TEXT_LIGHT`/`#fff` 하드코딩 사용처를 전수 확인한 결과, 모두 항상 고정된 어두운 배경(전체화면 오버레이 등) 또는 항상 고정 컬러 배경(코랄/민트 버튼) 위에서만 쓰여 라이트 모드 백텍스트-백배경 버그는 발견되지 않음.
- `src/lib/supabaseClient.ts`에 하드코딩된 키/시크릿 없음(env var 미설정 시 크래시 위험은 낮음 항목으로 별도 보고).
- `src/engine/` 핵심 수식 대부분(auraEngine, genesisInference, genesisBlending, scoreCalculator의 get/formatScore, metrics의 tanh/settleMidnight, twinResponseEngine, userToneVectorBuilder)은 0-나눗셈, 빈 배열 접근 등에 방어 코드가 있어 특별한 런타임 위험 없음.
- `src/constants/colors.ts`/`theme.ts`/`typography.ts`가 참조하는 필드명은 `src/types/genesis.ts`의 `AURA_AXES`와 정확히 일치, 불일치 없음.

---

## 조사 방법 메모

이 보고서는 6개 병렬 조사 에이전트(탭 화면, 인증 플로우, 컴포넌트, 서비스, 훅/스토어, 엔진/라이브러리)가 각각 담당 파일을 전체 정독하고 상호 참조(Grep으로 실제 호출부 확인)한 결과를 취합·중복 제거한 것이다. "AppContext 잔존 주석" 등 여러 그룹에서 동일하게 발견된 항목은 하나의 항목으로 병합했다. 코드 수정은 전혀 수행하지 않았다.
