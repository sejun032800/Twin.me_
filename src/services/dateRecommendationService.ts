// ─── dateRecommendationService — 후보군 생성 (레이어4) ────────────────────────────
// date-recommend-architecture.md 레이어4("후보군 생성"). 이 파일은 LLM을 호출하지
// 않는다(레이어5에서 별도 Edge Function으로 담당) — 여기서는 두 갈래로 후보를 모은다:
//   findSimilarCourses()    — 순수 로컬 계산. 외부 API 호출 없음(dateCourseService의
//                             기존 Supabase 조회만 사용).
//   findNearbyAlternatives() — 카카오 API 필요. 레이어2가 만든 kakao-local-search
//                             Edge Function을 카테고리 검색 모드로 재사용한다.
//
// ── 레이어3 타입을 확장하지 않은 이유 ────────────────────────────────────────────
// dateClusterService.ClusterableStamp(레이어3, 완료된 레이어라 건드리지 않음)는
// 클러스터링에만 필요한 필드(id/takenAt/lat/lng/confidence)만 갖고 있고
// category_code가 없다 — 클러스터링 자체엔 카테고리가 필요 없어서다. 이 레이어는
// "그 코스에 어떤 카테고리들이 있었는지"가 반드시 필요하므로, 레이어3 타입을 억지로
// 확장하는 대신 이 파일 안에서만 쓰는 별도 입력 타입(CourseForSimilarity/
// VisitedStampSummary)을 정의했다. 실제 통합 시점(다음 레이어 이후)에는
// date_photo_stamps를 조회하는 쪽이 DayCluster.stamps의 id와 category_code를 조인해
// 이 타입으로 변환해주면 된다.

import { supabase } from '@/lib/supabaseClient';
import { getPublicCourses, type DateCourse, type DateCoursePlace } from '@/services/dateCourseService';
import { normalizeKakaoDocument, type RawKakaoDocument } from '@/services/placeMatchService';

// ── LLM 프롬프트에 그대로 넣을 수 있는 공통 후보 구조 ──────────────────────────────
// 레이어5(LLM 구성)는 "이 리스트의 후보 중에서만 골라 순서·문구를 짜라"는 계약을 쓸
// 예정이라(architecture.md 레이어5), 후보가 코스 유래든 장소 유래든 상관없이 균일하게
// "이름 + 점수 + 근거"를 노출할 수 있어야 프롬프트 렌더링 코드가 분기 없이 순회할 수
// 있다. 그래서 공통 필드(candidateId/kind/name/score/reason)를 베이스로 두고, 실제
// LLM이 place_id를 검증해야 하는 nearby_place만 좌표/place_id 같은 grounding 정보를
// 추가로 들고 있게 했다(similar_course는 이미 존재하는 우리 코스를 재사용하는 것이라
// 좌표 단위 grounding이 필요 없다).
export interface RecommendationCandidateBase {
  candidateId: string;
  score: number;
  reason: string; // 한국어 근거 문장 — LLM 프롬프트에 그대로 노출 가능
  name: string;
}

export interface SimilarCourseCandidate extends RecommendationCandidateBase {
  kind: 'similar_course';
  courseId: string;
  area: string;
  tags: string[];
  places: DateCoursePlace[];
}

export interface NearbyPlaceCandidate extends RecommendationCandidateBase {
  kind: 'nearby_place';
  placeId: string; // kakao_place_id — 레이어5 후처리 검증(응답에 포함된 place_id 대조)의 기준
  address: string;
  categoryGroupCode: string;
  categoryName: string; // 사람이 읽는 카테고리명(예: "카페") — LLM 프롬프트/추후 UI 표시용
  lat: number;
  lng: number;
}

export type RecommendationCandidate = SimilarCourseCandidate | NearbyPlaceCandidate;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. findSimilarCourses — 유사 코스 추천 (외부 API 호출 없음)
// ═══════════════════════════════════════════════════════════════════════════════

export interface CourseForSimilarity {
  id: string;
  categoryCodes: string[]; // 코스에 포함된 스탬프들의 category_code, 중복 포함 가능
}

// 카카오 로컬 API의 공식 category_group_code → category_group_name 매핑(카카오
// 개발자 문서에 고정 게시된 18개 값). "로맨틱"/"힙한" 같은 주관적 무드 태그를 새로
// 발명하는 대신 카카오가 이미 공식적으로 붙여둔 이름을 그대로 태그로 쓴다 — 이렇게
// 하면 이 매핑 자체는 판단이 아니라 사실(카카오 API 스펙)이 된다. 다만 date_courses.tags
// (예: MOCK_COURSES의 "로맨틱"/"시크"/"차분함")는 사람이 직접 지은 무드 형용사라서,
// 카테고리 원문 태그("음식점"/"카페")와 문자 그대로 겹칠 일은 현재 데이터에서는 드물다
// — 이건 유사도 함수의 결함이 아니라 date_courses.tags 스키마가 애초에 카테고리
// 코드화돼 있지 않다는 데이터 한계다(아래 findSimilarCourses 주석 참고).
const KAKAO_CATEGORY_GROUP_NAME: Record<string, string> = {
  MT1: '대형마트',
  CS2: '편의점',
  PS3: '어린이집,유치원',
  SC4: '학교',
  AC5: '학원',
  PK6: '주차장',
  OL7: '주유소,충전소',
  SW8: '지하철역',
  BK9: '은행',
  CT1: '문화시설',
  AG2: '중개업소',
  PO3: '공공기관',
  AT4: '관광명소',
  AD5: '숙박',
  FD6: '음식점',
  CE7: '카페',
  HP8: '병원',
  PM9: '약국',
};

export function categoryCodeToName(categoryGroupCode: string): string | null {
  return KAKAO_CATEGORY_GROUP_NAME[categoryGroupCode] ?? null;
}

export function categoryCodesToTags(categoryCodes: string[]): string[] {
  const tags = categoryCodes.map(categoryCodeToName).filter((name): name is string => !!name);
  return [...new Set(tags)];
}

// 자카드 유사도(교집합/합집합)를 선택했다 — 처음엔 코사인 유사도(빈도 가중)를
// 검토했으나, 코사인의 장점(상대적 빈도 반영)은 비교 대상인 date_courses.tags가
// 빈도 없는 단순 문자열 배열이라(예: ['로맨틱','시크','차분함'] — 각 태그가 1번씩만
// 존재, 카운트 정보 없음) 애초에 살릴 수 없다. 반대로 우리 코스 쪽(categoryCodes)엔
// 중복(예: 카페 3번)이 있어 두 쪽의 "벡터" 성격이 비대칭이다. 이 비대칭 상황에서
// 코사인을 억지로 적용하면 한쪽만 인위적으로 원-핫화해야 해 코사인의 이점이 사라지고
// 자카드와 사실상 동일해진다 — 그래서 처음부터 집합 기반인 자카드를 택해 불필요한
// 복잡도를 넣지 않았다.
export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionSize++;
  }
  const unionSize = new Set([...setA, ...setB]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

// 순수 함수 — 후보 풀은 파라미터로 받는다(호출부인 findSimilarCourses가 I/O를 맡는다).
export function scoreSimilarCourses(
  course: CourseForSimilarity,
  candidatePool: DateCourse[],
  limit = 5,
): SimilarCourseCandidate[] {
  const courseTags = categoryCodesToTags(course.categoryCodes);

  return candidatePool
    .map((candidate): SimilarCourseCandidate => {
      const score = jaccardSimilarity(courseTags, candidate.tags);
      const overlap = candidate.tags.filter((tag) => courseTags.includes(tag));
      return {
        kind: 'similar_course',
        candidateId: `course:${candidate.id}`,
        courseId: candidate.id,
        name: candidate.title,
        area: candidate.area,
        tags: candidate.tags,
        places: candidate.places,
        score,
        reason:
          overlap.length > 0
            ? `우리 코스와 겹치는 태그: ${overlap.join(', ')}`
            : '겹치는 태그는 없지만 인기 코스 참고용으로 포함',
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function findSimilarCourses(course: CourseForSimilarity, limit = 5): Promise<SimilarCourseCandidate[]> {
  const { courses } = await getPublicCourses();
  return scoreSimilarCourses(course, courses, limit);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. findNearbyAlternatives — 이색(안 해본) 코스 후보 확장 (카카오 API 필요)
// ═══════════════════════════════════════════════════════════════════════════════

export interface VisitedStampSummary {
  categoryCode: string | null;
  kakaoPlaceId: string | null;
  confidence: 'auto' | 'user_confirmed' | 'unverified';
}

// "데이트 코스"로 의미 있는 카테고리만 안 해본 카테고리 후보로 취급한다 — 카카오의
// 18개 category_group_code를 전부 순회하면 은행/편의점/주차장/약국처럼 "안 가본
// 카테고리"로 추천할 이유가 없는 생활 인프라 카테고리까지 섞여버린다. 음식점·카페·
// 관광명소·문화시설·숙박(여행 중이면 숙박도 "코스"의 일부) 5개로 한정했다.
export const DATE_RELEVANT_CATEGORY_CODES = ['FD6', 'CE7', 'AT4', 'CT1', 'AD5'] as const;

export function computeUnvisitedCategories(visitedStamps: VisitedStampSummary[]): string[] {
  const visitedCategories = new Set(
    visitedStamps
      .filter((s) => s.confidence !== 'unverified')
      .map((s) => s.categoryCode)
      .filter((c): c is string => !!c),
  );
  return DATE_RELEVANT_CATEGORY_CODES.filter((code) => !visitedCategories.has(code));
}

// place_id 기준 dedup — 문자열 이름 dedup 금지(표기 차이로 인한 중복 누락 위험,
// architecture.md 레이어4 명시 사항). 이미 본 place_id는 뒤에 나온 것을 버린다.
export function dedupeByPlaceId<T extends { placeId: string }>(candidates: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.placeId)) continue;
    seen.add(candidate.placeId);
    result.push(candidate);
  }
  return result;
}

// 거리 관련성 점수 — placeMatchService.distanceDecayScore(exp(-d/50m))를 그대로
// 가져다 쓰지 않았다. 그 함수는 레이어2의 "이 후보가 방금 찍은 사진 속 그 가게가
// 맞는가"(수십~수백m 단위로 예민하게 갈려야 함)를 위해 50m 감쇠 상수로 튜닝된
// 함수라, 이 레이어의 탐색 반경(기본 1km)에 그대로 쓰면 몇백m만 떨어져도 점수가
// 거의 0으로 죽어버려 후보 간 변별력이 사라진다. 대신 탐색에 실제 사용한 반경을
// 기준으로 선형 감쇠(반경 끝에서 0)하는 별도 함수를 둔다 — "둘러보기" 맥락에 맞는
// 스케일이다.
export function distanceRelevanceScore(distanceMeters: number, radiusMeters: number): number {
  if (radiusMeters <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - distanceMeters / radiusMeters));
}

// kakao-local-search Edge Function이 그대로 프록시하는 카카오 원본 문서 — placeMatchService
// 재사용을 위해 RawKakaoDocument를 상속하되(x/y가 없는 필드만 필요한 곳에서 재사용 가능),
// 여기서는 좌표(x/y)도 함께 필요해 확장한다.
interface KakaoLocalDocument extends RawKakaoDocument {
  x: string;
  y: string;
}

interface KakaoLocalSearchResponse {
  documents: KakaoLocalDocument[];
  radiusUsed: number;
  cached: boolean;
}

export interface FindNearbyAlternativesOptions {
  radiusMeters?: number; // 기본 1km(Edge Function DEFAULT_CATEGORY_RADIUS_METERS와 동일)
  limitPerCategory?: number;
}

const DEFAULT_SEARCH_RADIUS_METERS = 1000;
const DEFAULT_LIMIT_PER_CATEGORY = 5;

export async function findNearbyAlternatives(
  visitedStamps: VisitedStampSummary[],
  origin: { lat: number; lng: number },
  options: FindNearbyAlternativesOptions = {},
): Promise<NearbyPlaceCandidate[]> {
  const radiusMeters = options.radiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS;
  const limitPerCategory = options.limitPerCategory ?? DEFAULT_LIMIT_PER_CATEGORY;

  const unvisitedCategories = computeUnvisitedCategories(visitedStamps);
  const visitedPlaceIds = new Set(
    visitedStamps.map((s) => s.kakaoPlaceId).filter((id): id is string => !!id),
  );

  const allCandidates: NearbyPlaceCandidate[] = [];

  for (const categoryGroupCode of unvisitedCategories) {
    const { data, error } = await supabase.functions.invoke('kakao-local-search', {
      body: { categoryGroupCode, lat: origin.lat, lng: origin.lng, radius: radiusMeters },
    });

    // 카테고리 하나가 실패해도(네트워크 오류 등) 나머지 카테고리는 계속 진행한다 —
    // 부분 성공을 허용해야 "이색 코스 후보가 아예 0개"가 되는 상황을 피할 수 있다.
    if (error || !data) continue;

    const { documents } = data as KakaoLocalSearchResponse;
    const categoryName = categoryCodeToName(categoryGroupCode) ?? categoryGroupCode;

    // normalizeKakaoDocument(placeMatchService, 레이어2 산출물 — 건드리지 않고 재사용)는
    // 매칭 스코어링에 필요한 필드만 노출해 좌표(x/y)를 담지 않는다. 여기서는 좌표가
    // 필요하므로(LLM/지도 표시용) doc 원본에서 직접 x/y를 함께 읽는다.
    const categoryCandidates = documents
      .filter((doc) => !visitedPlaceIds.has(doc.id))
      .map((doc): NearbyPlaceCandidate => {
        const place = normalizeKakaoDocument(doc);
        return {
          kind: 'nearby_place',
          candidateId: `place:${place.placeId}`,
          placeId: place.placeId,
          name: place.placeName,
          address: place.addressName,
          categoryGroupCode,
          categoryName,
          lat: Number(doc.y) || 0,
          lng: Number(doc.x) || 0,
          score: distanceRelevanceScore(place.distanceMeters, radiusMeters),
          reason: `안 가본 카테고리(${categoryName})에서 새로 발견한 장소 · 기준 좌표에서 약 ${Math.round(place.distanceMeters)}m`,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limitPerCategory);

    allCandidates.push(...categoryCandidates);
  }

  return dedupeByPlaceId(allCandidates);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. composeDateCourse — LLM 구성 (레이어5, date-course-compose Edge Function 호출)
// ═══════════════════════════════════════════════════════════════════════════════
// supabase/functions/date-course-compose/compose.ts의 PromptCandidate/
// AnonymizedCoupleContext와 구조적으로 동일하지만 이 파일에서 별도로 정의한다 — Edge
// Function은 독립 배포 단위라 src/ 트리를 import하지 않고(반대로 여기서도 supabase/
// functions/를 import하지 않는다), 요청 바디로 주고받는 "계약"만 양쪽이 구조적으로
// 맞추면 된다.

// MASTER.md §7 익명화 규칙 — 이 5개 필드만 Edge Function으로 전송한다. couple_id/
// user_id/리뷰 원문은 이 타입에 필드 자체가 없다.
export interface AnonymizedCoupleContext {
  tags: string[];
  avgRatingBand: number;
  areaLabel: string;
  budgetLabel: string;
  unvisitedCategories: string[];
}

export interface ComposedCourse {
  theme: string;
  copy: string;
  candidates: RecommendationCandidate[]; // 방문 순서대로 — 이미 서버에서 검증을 통과한 candidateId만 포함
}

interface PromptCandidatePayload {
  candidateId: string;
  name: string;
  kind: string;
  reason: string;
  detail: string;
}

// RecommendationCandidate(레이어4 산출물, 좌표/score 등 내부 필드 포함) 중 LLM 프롬프트에
// 실제로 필요한 필드만 추려서 보낸다 — candidate 자체는 couple_id/user_id/리뷰 원문이
// 아닌 공개 장소/코스 데이터라 익명화 규칙 위반이 아니지만, 그래도 불필요한 필드(좌표,
// 내부 점수 등)까지 프롬프트에 욱여넣을 이유는 없어 최소 집합으로 축소한다.
function toPromptCandidate(candidate: RecommendationCandidate): PromptCandidatePayload {
  return {
    candidateId: candidate.candidateId,
    name: candidate.name,
    kind: candidate.kind,
    reason: candidate.reason,
    detail: candidate.kind === 'similar_course' ? candidate.tags.join(', ') : candidate.categoryName,
  };
}

interface ComposeEdgeFunctionResponse {
  courses: { candidateIds: string[]; theme: string; copy: string }[];
  discardedCount: number;
  error?: string;
}

/**
 * 레이어4의 두 후보군 생성 함수 결과를 하나의 후보 리스트로 합친다 — composeDateCourse()에
 * 그대로 넘길 수 있는 형태. 유사 코스와 이색 장소를 구분 없이 한 배열로 합치는 이유는
 * date-course-compose가 애초에 kind로 두 종류를 구분해 처리하도록 설계돼 있어서다
 * (RecommendationCandidateBase 공통 필드 설계 근거는 파일 상단 주석 참고).
 */
export async function buildCandidatePool(
  course: CourseForSimilarity,
  visitedStamps: VisitedStampSummary[],
  origin: { lat: number; lng: number },
  options: { similarLimit?: number } & FindNearbyAlternativesOptions = {},
): Promise<RecommendationCandidate[]> {
  const [similar, nearby] = await Promise.all([
    findSimilarCourses(course, options.similarLimit),
    findNearbyAlternatives(visitedStamps, origin, options),
  ]);
  return [...similar, ...nearby];
}

/**
 * date-course-compose Edge Function을 호출해 후보 리스트를 코스로 조립한다.
 *
 * ★ 이 함수는 Edge Function이 이미 validateComposedCourses()로 검증을 마친 결과를
 * 그대로 신뢰한다 — 클라이언트에서 같은 검증을 다시 하지 않는다. 검증의 유일한
 * 권위 있는 위치는 Edge Function이다(supabase/functions/date-course-compose/compose.ts
 * 상단 주석 참고) — 모든 호출 경로(이 함수, 향후 다른 클라이언트, 테스트 스크립트 등)가
 * 예외 없이 동일한 보장을 받도록 하기 위함이다. 아래 .filter()는 검증 로직의 재구현이
 * 아니라, candidateById.get()이 혹시 undefined를 반환하는 극단적 케이스(예: 호출자가
 * buildCandidatePool과 다른 candidates 배열을 실수로 넘긴 경우)에 대비한 단순 null 가드다.
 */
export async function composeDateCourse(
  candidates: RecommendationCandidate[],
  context: AnonymizedCoupleContext,
): Promise<ComposedCourse[]> {
  if (candidates.length === 0) return [];

  const { data, error } = await supabase.functions.invoke('date-course-compose', {
    body: { candidates: candidates.map(toPromptCandidate), context },
  });

  if (error || !data) {
    throw new Error(`데이트 코스 구성 실패: ${error?.message ?? '응답 없음'}`);
  }

  const { courses } = data as ComposeEdgeFunctionResponse;
  const candidateById = new Map(candidates.map((c) => [c.candidateId, c]));

  return courses
    .map((course): ComposedCourse => ({
      theme: course.theme,
      copy: course.copy,
      candidates: course.candidateIds
        .map((id) => candidateById.get(id))
        .filter((c): c is RecommendationCandidate => !!c),
    }))
    .filter((course) => course.candidates.length > 0);
}
