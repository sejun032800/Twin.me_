// ─── dateRecommendSetupService — UI 레이어 전용 데이터 어댑터 (app/(modals)/date-recommend-setup.tsx가 사용) ──
// 이번 작업 범위는 "이미 있는 함수들을 호출하는 화면"이라 레이어1~5 서비스 파일
// (datePhotoStampService.ts / dateClusterService.ts / dateRecommendationService.ts /
// placeMatchService.ts / Edge Functions)은 절대 수정하지 않는다. 문제는 그 레이어들
// 중 어느 것도 "커플의 date_photo_stamps를 실제로 조회해서 레이어4 입력 타입으로
// 변환하는" 함수를 갖고 있지 않다는 점이다 — 의도적으로 그렇게 설계됐다
// (dateRecommendationService.ts의 CourseForSimilarity 정의부 주석: "실제 통합
// 시점(다음 레이어 이후)에는 date_photo_stamps를 조회하는 쪽이 DayCluster.stamps의
// id와 category_code를 조인해 이 타입으로 변환해주면 된다" — 이 파일이 바로 그
// "다음 레이어 이후"의 통합 지점이다).
//
// 그래서 이 화면이 필요로 하는 조회+변환 로직을 기존 서비스 파일에 끼워 넣는 대신
// (그건 "레이어 수정"이 된다) 완전히 새 파일로 분리했다. 화면 컴포넌트가 Supabase를
// 직접 호출하지 않는다는 이 저장소의 기존 컨벤션도 그대로 지킨다 — 여기서 하는 일은
// 순수 신규 비즈니스 로직이 아니라 "이미 존재하는 스키마를 이미 존재하는 순수 함수
// 입력 형태로 조립"하는 것뿐이다(clusterStampsByDay는 레이어3 함수를 그대로 재사용).

import { supabase } from '@/lib/supabaseClient';
import { clusterStampsByDay, type ClusterableStamp } from '@/services/dateClusterService';
import type { CourseForSimilarity, VisitedStampSummary } from '@/services/dateRecommendationService';

interface DatePhotoStampRow {
  id: string;
  taken_at: string | null;
  lat: number | null;
  lng: number | null;
  confidence: 'auto' | 'user_confirmed' | 'unverified';
  category_code: string | null;
  kakao_place_id: string | null;
}

async function fetchCoupleStamps(coupleId: string): Promise<DatePhotoStampRow[]> {
  const { data, error } = await supabase
    .from('date_photo_stamps')
    .select('id, taken_at, lat, lng, confidence, category_code, kakao_place_id')
    .eq('couple_id', coupleId);

  if (error || !data) return [];
  return data as DatePhotoStampRow[];
}

export interface DateRecommendSetupContext {
  verifiedStampCount: number; // confidence !== 'unverified'
  visitedStamps: VisitedStampSummary[]; // findNearbyAlternatives 입력
  latestCourse: CourseForSimilarity | null; // findSimilarCourses 입력 — 가장 최근 하루 코스
  latestOrigin: { lat: number; lng: number } | null; // findNearbyAlternatives 기준 좌표(최근 코스 중심점)
}

const EMPTY_CONTEXT: DateRecommendSetupContext = {
  verifiedStampCount: 0,
  visitedStamps: [],
  latestCourse: null,
  latestOrigin: null,
};

/**
 * setup 화면 진입 시 한 번 호출한다. couple_id 기준 date_photo_stamps를 전부 읽어서:
 *   1. 진입 조건 체크용 verifiedStampCount
 *   2. findNearbyAlternatives()에 그대로 넘길 visitedStamps
 *   3. clusterStampsByDay()(레이어3, 재사용)로 하루 코스를 묶은 뒤 가장 최근 코스를
 *      findSimilarCourses()의 CourseForSimilarity로 변환
 *   4. 같은 최근 코스의 centroid를 findNearbyAlternatives()의 기준 좌표로 재사용
 *      (별도로 기기 GPS 권한을 요청하지 않는다 — "안 해본 곳"의 기준은 이 커플이
 *      실제로 데이트하던 곳 근처가 더 적절하고, 이미 갖고 있는 데이터로 충분하다)
 * 를 한 번에 만들어 반환한다.
 */
export async function fetchDateRecommendSetupContext(coupleId: string | null): Promise<DateRecommendSetupContext> {
  if (!coupleId) return EMPTY_CONTEXT;

  const rows = await fetchCoupleStamps(coupleId);
  const verifiedStampCount = rows.filter((r) => r.confidence !== 'unverified').length;

  const visitedStamps: VisitedStampSummary[] = rows.map((r) => ({
    categoryCode: r.category_code,
    kakaoPlaceId: r.kakao_place_id,
    confidence: r.confidence,
  }));

  const clusterable: ClusterableStamp[] = rows.map((r) => ({
    id: r.id,
    takenAt: r.taken_at,
    lat: r.lat,
    lng: r.lng,
    confidence: r.confidence,
  }));
  const dayClusters = clusterStampsByDay(clusterable);

  if (dayClusters.length === 0) {
    return { verifiedStampCount, visitedStamps, latestCourse: null, latestOrigin: null };
  }

  // clusterStampsByDay는 날짜 오름차순으로 반환한다(dateClusterService.ts) — 마지막 원소가 최신.
  const latest = dayClusters[dayClusters.length - 1];
  const categoryById = new Map(rows.map((r) => [r.id, r.category_code]));
  const categoryCodes = latest.stamps
    .map((s) => categoryById.get(s.id))
    .filter((c): c is string => !!c);

  return {
    verifiedStampCount,
    visitedStamps,
    latestCourse: { id: latest.id, categoryCodes },
    latestOrigin: latest.centroid,
  };
}
