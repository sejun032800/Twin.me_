# UI 기능 전수 감사 보고서
**감사 일자:** 2026-07-11
**감사 기준:** 코드 정적 분석 (실기기 테스트 미포함)
**감사 범위:** 온보딩 7개 화면 + 메인 탭 4개 (UI 리디자인 Phase 1~5 완료 후)

---

## 종합 요약

| 구분 | ✅ 정상 | ⚠️ 주의 | ❌ 결함 | 합계 |
|---|---|---|---|---|
| 온보딩 (welcome/login/signup/profile/kakao-upload/genesis/join) | 35 | 2 | 2 | 39 |
| 메인 탭 (index/chat/history/settings) | 63 | 0 | 1 | 64 |
| **전체** | **98** | **2** | **3** | **103** |

**결론:** UI 리디자인(Phase 1~5) 과정에서 새로 발생한 기능 결함은 없음. 발견된 ❌ 3건은 모두 리디자인 이전부터 존재하던 사전 결함(pre-existing gap)이며, 아래 상세에서 근거를 명시한다.

---

## 화면별 상세

### 1. welcome.tsx
| 항목 | 상태 | 비고 |
|---|---|---|
| "시작하기" 버튼 | ✅ | `onPress={() => router.push('/(auth)/signup')}` |
| "로그인" 버튼 | ✅ | `onPress={() => router.push('/(auth)/login')}` |
| 개발자 바로가기 버튼 | ✅ | `{__DEV__ && ...}` + `handleDevSkip()` → `router.replace('/(auth)/profile')` |
| 나중에 둘러볼게요(guest) 버튼 | ✅ | `handleGuest()` → `router.replace('/(tabs)')` |

---

### 2. login.tsx
| 항목 | 상태 | 비고 |
|---|---|---|
| 이메일 TextInput | ✅ | `onChangeText={setEmail}` |
| 비밀번호 TextInput | ✅ | `onChangeText={setPassword}` |
| 로그인 버튼 → signInWithPassword() | ✅ | `handleLogin()` 내 `supabase.auth.signInWithPassword({ email, password })` |
| 버튼 비활성화 조건(이메일/비밀번호 미입력 시) | ❌ | `disabled={loading}`만 존재. 이메일/비밀번호 빈 값 체크 없음 — **리디자인 이전 원본 코드에도 동일하게 없던 로직**(Phase 5는 스타일만 교체, 이 조건은 손대지 않음) |
| 회원가입 링크 → router.push('/(auth)/signup') | ⚠️ | 실제로는 "돌아가기" `router.back()`만 존재. signup으로의 직접 링크 없음 — 원본부터 동일한 구조(welcome 화면이 허브 역할). 기능은 정상 작동하나 감사 항목이 가정한 경로와 다름 |
| 에러 메시지 표시 로직 | ✅ | 실패 시 `Alert.alert('로그인 실패', error.message)` (인라인 텍스트가 아닌 네이티브 Alert) |

---

### 3. signup.tsx
| 항목 | 상태 | 비고 |
|---|---|---|
| 이메일/비밀번호 TextInput | ✅ | `onChangeText={setEmail}` / `onChangeText={setPassword}` |
| 가입 버튼 → signUp() | ✅ | `handleSignup()` 내 `supabase.auth.signUp({ email, password })` |
| 버튼 비활성화 조건 | ❌ | login.tsx와 동일한 사전 결함 — `disabled={loading}`만 존재 |
| 로그인 링크 → router.push('/(auth)/login') | ⚠️ | 실제로는 "돌아가기" `router.back()`. login.tsx와 동일한 사전 설계 |
| 에러 메시지 표시 로직 | ✅ | 실패 시 `Alert.alert('가입 실패', error.message)`, 성공 시 확인 이메일 안내 Alert |

---

### 4. profile.tsx
| 항목 | 상태 | 비고 |
|---|---|---|
| 이름 TextInput | ✅ | `onChangeText={setLocalName}` |
| MBTI 선택 → setMbti() 연결 | ✅ | `selectAxis()`가 로컬 `mbtiSelection` state를 갱신하고, `handleComplete()`에서 4축을 조합해 store의 `setMbti(mbti)`를 일괄 호출 — 매 탭마다가 아닌 완료 시점 커밋(의도된 설계, 결함 아님) |
| 다음/완료 버튼 → setName() + router.push() | ✅ | `handleComplete()` → `setName(name.trim())` 후 `from==='settings'`면 `router.back()`, 아니면 `router.push('/(auth)/kakao-upload')` |
| 필수 항목 미입력 시 버튼 비활성화 | ✅ | `disabled={!allAxesSelected \|\| !name.trim() \|\| submitting}` + `nextBtnDisabled` 스타일 |

---

### 5. kakao-upload.tsx
| 항목 | 상태 | 비고 |
|---|---|---|
| 파일 선택 버튼 → handlePick() → DocumentPicker | ✅ | `onPress={handlePick}` → `DocumentPicker.getDocumentAsync(...)` |
| 시작하기 버튼 → handleNext() → runKakaoIngestPipeline() | ✅ | `onPress={handleNext}` → `await runKakaoIngestPipeline(...)` |
| 버튼 비활성화 조건(uploaded === false) | ✅ | `disabled={!uploaded \|\| loading}` |
| 나중에 할게요 → handleSkip() → router.replace('/(auth)/genesis') | ✅ | 확인됨 |
| D0 분석 결과 화면 → onContinue → router.replace('/(auth)/genesis') | ✅ | `<D0ResultScreen ... onContinue={() => router.replace('/(auth)/genesis')} />` |

---

### 6. genesis.tsx
| 항목 | 상태 | 비고 |
|---|---|---|
| 인터뷰 시작 버튼 → start() | ✅ | |
| 텍스트 입력 → handleSubmit() → submitTranscript() | ✅ | `onChangeText={setInputText}`, 제출은 버튼에서 처리 |
| 제출 버튼 → handleSubmit() | ✅ | `handleSubmit()` 내부에서 `submitTranscript(inputText.trim())` 호출 |
| 음성으로 답할게요 → switchToVoice() | ✅ | |
| InterviewCallModal onClose → switchToTyping() | ✅ | |
| InterviewCallModal onSubmit → submitTranscript() | ✅ | |
| 확인 버튼(confirming) → confirmArchetype() | ✅ | `pendingConfirm && confirmArchetype(pendingConfirm.archetype.id)` |
| 다시 답하기 → switchToTyping() | ✅ | |
| 시작하기(ceremony) → handleStart() → finalizePersonaMatrix() + router.replace('/(tabs)') | ✅ | |
| phase === 'done' → useEffect router.replace('/(tabs)') | ✅ | |

---

### 7. join.tsx
| 항목 | 상태 | 비고 |
|---|---|---|
| 코드 입력 TextInput → onChangeText | ✅ | `onChangeText={(text) => setInputCode(text.toUpperCase().slice(0, 6))}` |
| 연동하기 버튼 → joinCouple() → supabase 호출 | ✅ | `supabase.auth.getUser()` 후 `joinCouple(inputCode, user.id)` |
| 버튼 비활성화 조건(코드 미입력) | ✅ | `disabled={inputCode.length !== 6 \|\| submitting}` |
| 성공 시 → setCoupleId() + setIsPartnerConnected() + router.replace() | ✅ | 실제 store 액션명은 `setPartnerConnected(true)`(감사 항목의 `setIsPartnerConnected`와 이름만 다름, 동일 기능). `router.replace('/(tabs)')`는 성공 Alert의 확인 버튼 `onPress`에서 실행 |
| 에러 메시지 표시 로직 | ✅ | 미로그인 시 `Alert.alert('로그인 필요', ...)`, catch 시 `Alert.alert('오류', ...)` |

---

### 8. index.tsx (홈)
| 항목 | 상태 | 비고 |
|---|---|---|
| PartnerStatusBar 렌더링 | ✅ | |
| OverflowBanner 렌더링 | ✅ | |
| ClayTwinAvatar size=100 렌더링 | ✅ | |
| AICoachingCard 래퍼 내 렌더링 | ✅ | `<View style={styles.coachingWrapper}><AICoachingCard /></View>` |
| MemoryRingSection 렌더링 | ✅ | |
| "트윈과 대화" 버튼 → router.push('/(tabs)/chat') | ✅ | |
| "히스토리 보기" 버튼 → router.push('/(tabs)/history') | ✅ | |
| "공유하기" 버튼 → handleShare() → ViewShot.capture() + Sharing.shareAsync() | ✅ | |
| sharing 중 ActivityIndicator | ✅ | |
| MasterQuestionModal visible/onClose/onSendToChat | ✅ | |
| onSendToChat → setPendingChatMessage() + router.push('/(tabs)/chat') | ✅ | |
| 날씨 로딩 중 ActivityIndicator | ✅ | |

---

### 9. chat.tsx (채팅)
| 항목 | 상태 | 비고 |
|---|---|---|
| 룸 카드 탭 → setActiveChatRoom(room.key) | ✅ | `!room.locked && setActiveChatRoom(room.key)` |
| 잠긴 룸(lover) onPress 무효화 | ✅ | `activeOpacity={room.locked ? 1 : 0.7}` + 조건부 호출 |
| 뒤로가기 버튼 → setActiveChatRoom(null) | ✅ | |
| 연애 초기 모드 Switch → setEarlyDatingMode() | ✅ | |
| 입력 TextInput → setInputText() | ✅ | |
| 전송 버튼 → handleSend() | ✅ | |
| 전송 버튼 비활성화(inputText 빈 값/isLoverLocked) | ✅ | `disabled={!inputText.trim() \|\| isLoverLocked}` |
| handleSend 내 FREE_MONTHLY_LIMIT 체크 → Alert | ✅ | |
| handleSend 내 callLLMStream 호출 | ✅ | |
| MuseSheet 열기 버튼 → setMuseVisible(true) | ✅ | |
| MuseSheet onClose → setMuseVisible(false) | ✅ | |
| MuseSheet onSelect → setInputText(text) | ✅ | |
| MagicMirrorModal onAccept → setMagicMirrorAccepted(true) + setShowMirrorModal(false) | ✅ | |
| MagicMirrorModal onDecline → setShowMirrorModal(false) | ✅ | |
| FeedbackSheet onSelect → handleFeedbackSelect() | ✅ | |
| AI 말풍선 롱프레스 → handleBubbleLongPress() → setFeedbackTarget + setFeedbackVisible(true) | ✅ | `msg.role !== 'twin'`이면 조기 리턴 (내 메시지엔 롱프레스 없음, 의도된 동작) |
| CrisisMode 오버레이 "확인했어요" → setCrisisMode(false) | ✅ | |
| 분석가 룸 "이번 주 리포트 생성" → handleGenerateReport() | ✅ | |
| 분석가 룸 "이번 주 코칭 받기" → handleGenerateCoaching() | ✅ | |

---

### 10. history.tsx (히스토리)
| 항목 | 상태 | 비고 |
|---|---|---|
| 서브탭 전환 → setSubTab(key) | ✅ | |
| ArchiveTab Wrapped 보기 버튼 → setWrappedVisible(true) | ✅ | |
| WrappedModal onClose → setWrappedVisible(false) | ✅ | |
| FeedTab OOTD Switch → setOotdOnly() | ✅ | |
| FeedTab 필터 칩 → setFilter(f.key) | ✅ | |
| FeedTab '내 지역' 필터 → requestLocation() | ✅ | |
| FeedTab '이 코스 내 지도에 담기' 버튼 → onPress 존재 여부 | ❌ | `<TouchableOpacity style={[styles.courseMapBtn, styles.courseMapBtnSolid]}>`에 **onPress 자체가 없음**. 버튼을 눌러도 아무 동작 안 함 — Phase 3 리디자인 이전 원본 코드에서도 onPress가 없던 사전 결함(스타일만 교체, 핸들러 추가 범위 아니었음) |
| 지도 탭 '+ 장소 추가' → setAddPlaceVisible(true) | ✅ | |
| AddPlaceModal onClose → setAddPlaceVisible(false) | ✅ | |
| AddPlaceModal onSaved → handlePlaceSaved() → setPlaces() | ✅ | |
| 장소 삭제 아이콘 → handleDeletePlace(id) → deleteDatePlace() | ✅ | |
| 지도 탭 '동선 최적화' → handleOptimize() → optimizePlaces() | ✅ | |
| 지도 탭 'AI 데이트 추천' → handleAIRecommend() → callLLM() | ✅ | |
| 지도 탭 버튼 비활성화 조건(places.length < 2, optimizing, aiLoading) | ✅ | |

---

### 11. settings.tsx (설정)
| 항목 | 상태 | 비고 |
|---|---|---|
| 프로필 수정 → router.push('/(auth)/profile?from=settings') | ✅ | |
| 화면 테마 라이트/다크/시그마 버튼 → setThemeMode() | ✅ | |
| 6-Sigma 버튼 hasAuraVector=false 시 disabled | ✅ | |
| 테마 샵 카드 → Alert '준비 중' | ✅ | |
| 프라이버시 Slider → setPrivacyLevel() | ✅ | |
| 오라 효과 Switch → setReduceAuraMotion() | ✅ | |
| 초대 코드 생성 → createCouple() + setInviteCode() + setCoupleId() | ✅ | |
| 연인 코드 입력 → router.push('/(auth)/join') | ✅ | |
| Founding VIP 코드 입력 → setVipModalVisible(true) | ✅ | |
| VIP 모달 확인 → handleRedeemVip() → redeemVipCode() | ✅ | |
| VIP 모달 취소 → setVipModalVisible(false) + setVipCodeInput('') | ✅ | |
| VIP 이미 활성화 시 버튼 disabled | ✅ | `disabled={isFoundingVip}` |
| Coffee Talk 구독 → purchaseSubscription('coffee') | ✅ | |
| 도움말 → Linking.openURL() | ✅ | |
| 개인정보처리방침 → Linking.openURL() | ✅ | |
| 서비스 이용약관 → Linking.openURL() | ✅ | |
| 로그아웃 → handleLogout() → supabase.auth.signOut() + reset stores | ✅ | |
| 계정 삭제 → handleDeleteAccount() → 2단계 Alert | ✅ | `handleDeleteAccount()` → `handleDeleteAccountFinalConfirm()` → `handleDeleteAccountConfirmed()` |
| DB 연결 검증 → handleSchemaHealthCheck() (__DEV__ 조건) | ✅ | |

---

## ⚠️ 주의 항목 목록

1. **login.tsx — "회원가입 링크"**: 감사 항목은 `router.push('/(auth)/signup')` 경로를 가정했으나, 실제 구현은 "돌아가기" `router.back()`만 존재. welcome.tsx가 signup/login 양쪽 진입점 역할을 하는 구조라 기능적으로는 문제없으나, login 화면 자체에서 signup으로 바로 넘어가는 경로는 없음.
2. **signup.tsx — "로그인 링크"**: 위와 동일한 구조 — `router.push('/(auth)/login')` 대신 `router.back()`만 존재.

이 2건은 Phase 5 리디자인 이전부터 있던 화면 설계이며, 이번 스타일 교체 작업에서 변경되지 않았다.

---

## ❌ 결함 항목 목록

1. **login.tsx / signup.tsx — 버튼 비활성화 조건 누락**: 이메일·비밀번호가 비어 있어도 로그인/가입 버튼이 활성 상태로 남아있음(`disabled`는 `loading` 상태만 체크). 빈 값으로 눌러도 Supabase 호출이 실패하고 Alert가 뜨므로 치명적이진 않지만, UX상 사전 방지가 안 됨. **Phase 5 리디자인 범위 밖의 사전 결함**(로직 변경 금지 원칙에 따라 이번 작업에서 건드리지 않음).
2. **history.tsx — '이 코스 내 지도에 담기' 버튼에 onPress 없음**: `courseMapBtnSolid` 스타일이 적용된 `TouchableOpacity`에 어떤 핸들러도 연결되어 있지 않아, 탭해도 아무 반응이 없음. **Phase 3 리디자인 이전 원본 코드부터 존재하던 사전 결함**으로, 카드 스타일만 교체되었을 뿐 인터랙션 로직은 원래부터 미구현 상태였음.

---

## 다음 액션

1. **(우선순위 상)** `history.tsx`의 '이 코스 내 지도에 담기' 버튼에 실제 동작(예: `memoryMapService`에 장소 일괄 저장 또는 지도 탭으로 이동 + 장소 프리필)을 연결. 사용자가 누를 수 있는 버튼이 아무 반응 없이 방치되는 것은 가장 눈에 띄는 결함.
2. **(우선순위 중)** `login.tsx`/`signup.tsx`에 이메일/비밀번호 빈 값 체크를 추가해 버튼을 `disabled` 처리(예: `disabled={loading || !email.trim() || !password.trim()}`). 별도 로직 변경 작업으로 분리해 진행 권장.
3. **(우선순위 하, 선택)** login/signup 화면에 상대 화면(회원가입 ↔ 로그인)으로 바로 이동하는 링크 추가 여부는 UX 결정 필요 — 현재 구조(welcome 허브 + 뒤로가기)가 의도된 설계라면 대응 불필요.
4. 위 결함들을 수정한 뒤 **출시 전 실기기 E2E 테스트 진행 권장** — 특히 카카오 업로드 파이프라인, 제네시스 인터뷰 음성/텍스트 전환, 크라이시스 모드 오버레이는 정적 분석만으로 실제 UX 흐름(애니메이션 타이밍, 키보드 회피 등)을 완전히 검증할 수 없음.

---

## 2026-07-11 결함 수정 완료

발견된 ❌ 결함 3건 중 실제 기능 결함 2건을 수정하고, 나머지 1건(login↔signup 직접 링크 부재)은 설계 결정 보류로 확정했다.

| 항목 | 이전 상태 | 수정 후 상태 | 수정 방법 요약 |
|---|---|---|---|
| history.tsx '이 코스 내 지도에 담기' | ❌ onPress 없음 | ✅ | `History`에 `handleAddCourseToMap(course)`를 추가하고 `FeedTab`에 `onAddToMap` prop으로 전달, 버튼 `onPress={() => onAddToMap(course)}` 연결. `DatePlace` 실제 타입(`id/name/area/date/memo`, `emoji`·`category`·`lat`·`lng` 필드 없음)에 맞춰 코스의 장소를 변환·중복 제거 후 `saveDatePlace()`로 순차 저장(병렬 호출 시 read-then-write 경쟁 상태 발생 방지), `setPlaces()` 갱신 → `setSubTab('map')` 전환 → 완료 Alert 표시 |
| login.tsx 버튼 비활성화 조건 | ❌ `disabled={loading}`만 존재 | ✅ | `disabled={loading \|\| !email.trim() \|\| !password.trim()}` + `style` 배열에 동일 조건으로 `primaryBtnDisabled` 분기 추가 |
| signup.tsx 버튼 비활성화 조건 | ❌ `disabled={loading}`만 존재 | ✅ | login.tsx와 동일한 방식으로 이메일/비밀번호 빈 값 체크 추가 |

**부가 개선(결함은 아니었으나 함께 반영):** login.tsx/signup.tsx 하단에 "처음이세요? 회원가입하러 가기" / "이미 계정이 있으세요? 로그인하러 가기" `backLink` 텍스트를 추가해 welcome으로 돌아가는 경로를 더 명확히 안내(기존 "돌아가기" 링크는 유지, 신규 링크는 추가). 화면 간 직접 `router.push` 연결은 감사에서 확인된 대로 welcome 허브 구조를 유지하기 위해 추가하지 않음.

**검증:** `npx tsc --noEmit` 에러 0개 확인.
