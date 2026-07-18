# Twin.me — 지도 탭 AI 데이트코스 추천 기능 설계 뼈대

작성일: 2026-07-18 (설계 논의 기준)

---

## 0. 목표

- 히스토리 탭 > **지도** 서브탭에 "사진 기반 데이트 기록"과 "AI 코스 추천"을 통합
- 핵심 원칙: **LLM은 절대 장소를 지어내지 않는다.** 실제 존재 검증(카카오 로컬 API)을 거친 후보만 LLM에게 넘기고, LLM은 선별·구성·서술만 담당한다.

---

## 1. 전체 아키텍처 (5개 레이어)

```
[1] 데이터 수집        사진 업로드 + EXIF(시간/GPS) + 사용자 상호명 입력
        ↓
[2] 검증/정규화        카카오 로컬 API 매칭 → confidence 태깅
        ↓
[3] 저장               방문 스탬프 → 코스 클러스터링 → date_courses
        ↓
[4] 후보군 생성        내부 유사도(로컬 계산) / 외부 API 반경검색(카카오)
        ↓
[5] LLM 구성           검증된 후보만 넣고 코스로 조립 + 후처리 검증
```

---

## 2. 레이어별 상세

### 레이어 1 — 데이터 수집
- 기존 `src/hooks/usePhotoMetadata.ts` 확장 대상
  - 이미 있음: EXIF `dateTaken` / `latitude` / `longitude` 추출
  - 비어있음(스텁): `locationName` — 이번 기능에서 실제로 채우는 지점
- 신규 UX: 사진 업로드 흐름(OOTD 업로드 근처)에 **상호명 입력 스텝** 추가
  - 카피 방향: "실제 상호명을 지도에 찍어주면 AI 데이트코스 추천 정확도가 늘어나요!"
  - 입력은 자유 텍스트, 정확도는 레이어 2에서 검증

### 레이어 2 — 검증/정규화 (`placeMatchService.ts` 신규)

**매칭 스코어 합성**
```
score = w1·문자열유사도(자모분해+부분포함) + w2·거리감쇠(exp(-d/50m)) + w3·카테고리사전확률
```
- 문자열유사도: 음절 레벤슈타인이 아니라 **한글 자모 단위 편집거리 + 부분일치 보너스** ("스벅"↔"스타벅스 홍대점" 매칭 위함)
- 거리감쇠: 가까울수록 급격히 가중
- 카테고리사전확률: 같은 날 앞뒤 스탬프의 카테고리 흐름을 보조 신호로 사용(옵션)

**실패 유형 4가지 및 분기 처리**

| 케이스 | 조건 | 처리 |
|---|---|---|
| 고신뢰 단독 | 1위 점수 높고 2위와 격차 큼 | 자동 확정 + 원탭 확인 칩 항상 노출(완전 무음 자동확정 금지) |
| 분점 모호 | 1·2위 점수 근접, 동일 브랜드 | 후보 3개(이름+거리+주소) 나열해 직접 선택 |
| 밀집 지역 | 반경 내 후보 수 > 임계치(예 15) | 거리 가중치↓, 문자열유사도 가중치↑ 재정렬 |
| 매칭 실패 | 반경 내 유효 후보 없음 | 반경 단계적 확장(50→150→300m) → 실패 시 수동 주소 입력 + `unverified` 저장 |

**부가 장치**
- 캐싱: 지오해시 셀(≈50m 격자) + 카테고리 기준, TTL 1일 — 카카오 무료 쿼터 절약
- 재시도 큐: 매칭 실패 스탬프는 버리지 않고 보관, 히스토리 탭 진입 시 등 주기적 재매칭
- 신뢰도 영속화: 스탬프마다 `confidence: auto | user_confirmed | unverified` 저장 → 후보군 생성 시 `unverified` 제외

### 레이어 3 — 저장 / 클러스터링

**신규 테이블 `date_photo_stamps`**
```
couple_id, photo_uri, taken_at, lat, lng,
user_input_name, kakao_place_id, confidence, category_code
```

**코스 클러스터링**
- 기본 단위: **하루 코스** (같은 날짜 + 시간상 연속된 스탬프)
- 기존 `memoryMapService.optimizePlaces`의 동선 정렬 로직 재사용

**여행(멀티데이) 승격 로직**
- 승격 조건 = **연속일 + 장소 근접성 이탈** 둘 다 필요
  - 연속일: D일, D+1일 모두 스탬프 존재
  - 반경 이탈: 사용자 홈 위치 기준 "평소 활동반경" 밖 (반경 안이면 "이틀 연속 홍대 데이트"가 여행으로 오인식되는 것 방지)
- 3일 이상 연속 시 "여행 1일차/2일차/3일차" 자동 라벨링
- 종료 조건: 다음 날 스탬프 없음 OR 평소 반경 안으로 복귀
- 노출 위치: 지도 탭 상단 **"여행 앨범" 가로 스크롤 섹션** (AI 추천 FAB과는 별개 — 여행은 "기록 회고", FAB 추천은 "다음 데이트 제안"으로 목적이 다름)

- `date_courses`는 기존 테이블 유지, `kakao_place_id` 참조 컬럼만 추가

### 레이어 4 — 후보군 생성 (`dateRecommendationService.ts` 신규)

- **유사 코스 추천 (내부 계산, LLM 불필요)**
  - `findSimilarCourses()`: 검증된 카테고리/태그를 커플의 과거 코스, 공개 피드 코스와 벡터 비교
- **이색(안 해본) 코스 추천 (외부 API 필요)**
  - `findNearbyAlternatives()`: 검증 장소의 카테고리+좌표로 카카오 카테고리 반경검색 → **place_id 기준 dedup** (문자열 이름 dedup 금지 — 표기 차이로 중복 누락 위험)

**외부 데이터 소스 결론**
- 카카오 로컬 API: 장소명/주소/좌표/카테고리 — 있음, 평점 없음
- 네이버 지역 검색 API: 보조용, 평점 없음
- 다이닝코드/망고플레이트: 제3자 개발자 API 없음 (다이닝코드 `partner.diningcode.com`은 업주 등록용, 데이터 조회용 아님)
- Tripadvisor Content API: 실존하나 국내 로컬 맛집 커버리지 얇음, 관광지 위주 보조 용도로만
- Google Places API: 평점 있으나 유료 + 국내 소형 매장 커버리지 약함
- → **v1 결론**: 평점은 외부 API 대신 우리 자체 `date_courses.my_score/partner_score`로 대체

### 레이어 5 — LLM 구성

- 신규 Edge Function `date-course-compose` (기존 `llm-route`와 분리 — JSON 스키마 강제 계약)
- 프롬프트에는 **검증된 후보 리스트(place_id 포함)만** 전달
- 시스템 프롬프트: "이 리스트의 place_id 중에서만 골라 순서·테마·문구를 짜라. 리스트에 없는 이름은 절대 만들지 마라."
- **후처리 검증기**: 응답에 포함된 place_id가 후보 리스트에 실제로 존재하는지 대조 → 없으면 해당 응답 폐기(2차 안전장치)
- LLM의 역할 한정: 순서 배치 / 테마 서술 / "왜 이 커플에게 맞는지" 카피 생성

### 익명화 규칙 (외부 전송 데이터)
- 전송 금지: couple_id, user_id, 리뷰 원문 텍스트 그대로
- 전송 허용: tags 배열, 평균 평점대(숫자만), 지역(구/동 단위까지), 예산대 라벨, "안 해본 카테고리 목록"
- 리뷰 원문은 감정/키워드 요약 태그로 변환 후에만 전송

---

## 3. UI/UX 구조 — 지도 탭

### FAB (우측 하단, Siri 스타일 원형 버튼)
- 탭 시 세로 스택으로 옵션 펼침(아래→위 staggered fade+slide), 배경 반투명 dim

```
        [✨ AI 추천 데이트코스]
        [📍 장소 직접 추가]
        [📷 사진으로 코스 추가]
              (●) ← FAB 본체
```
- 각 옵션은 **아이콘 원형 + 텍스트 라벨이 붙은 pill 형태** (라벨 없는 아이콘 단독 방식 채택 안 함)

### 라우팅 구조 (신규)
```
app/(modals)/date-recommend-setup.tsx   ← 조건 입력 전용 페이지
app/(modals)/date-recommend-result.tsx  ← 결과 페이지 (지도+카드)
```
- 루트 `app/_layout.tsx`의 `<Stack>`에 두 라우트를 `presentation: 'modal'`로 등록
- FAB "AI 추천 데이트코스" → `router.push('/(modals)/date-recommend-setup')`

### 전체 플로우
```
지도 탭 FAB → [AI 추천 데이트코스]
  ↓ router.push
setup 페이지 (전용 화면)
  - 조건 체크: 검증된 스탬프 최소 N건 미달 시 → 사진 추가 유도 안내로 분기
  - 예산대 칩 선택 (~3만 / 3~7만 / 7만+)
  - 가능 시간대 칩 선택 (낮 / 저녁 / 종일)
  - 유사한 곳 vs 안 해본 곳 토글
  ↓ "추천받기" 제출 (로딩: "우리 데이트 스타일 분석 중...")
  ↓ router.replace (뒤로가기 시 setup으로 안 돌아가고 지도로 이탈)
result 페이지
  - 지도 위 핀+연결선 시각화 + 카드 리스트 병행
  - 핀 탭 → 후보 상세(주소/카테고리/추천 이유 한 줄)
  - 카드 "이 코스 담기" → memoryMapService에 저장 → 지도 탭 복귀
```

---

## 4. 아직 정하지 않은 것 (다음 단계 후보)

- `date_photo_stamps` 및 `date_courses` 스키마 마이그레이션 SQL 확정
- setup 페이지 세부 와이어프레임 (칩 배치, 유효성 검사)
- 카카오 로컬/모빌리티 API 무료 쿼터 실측 확인 (개발자 계정 발급 후 확인 필요)
- `placeMatchService.ts` / `dateRecommendationService.ts` / `date-course-compose` Edge Function 실제 코드화
- 자모 분해 편집거리 라이브러리 선정 (직접 구현 vs 기존 npm 패키지)

---

## 5. 관련 기존 코드 레퍼런스 (재사용/확장 대상)

| 기존 파일 | 역할 |
|---|---|
| `src/hooks/usePhotoMetadata.ts` | EXIF 추출, `locationName` 스텁 채우는 대상 |
| `src/services/memoryMapService.ts` | 장소 CRUD, `optimizePlaces` 동선 정렬 — 코스 클러스터링·"코스 담기"에 재사용 |
| `src/services/dateCourseService.ts` | 기존 `date_courses` 공개 피드 조회 — 내부 유사도 비교 대상 |
| `app/(tabs)/history.tsx` | 지도 서브탭 placeholder, FAB 삽입 위치 |
| `src/api/llm.ts` / `supabase/functions/llm-route` | 기존 Gemini 프록시 패턴 — `date-course-compose`는 별도 계약으로 분리 |
