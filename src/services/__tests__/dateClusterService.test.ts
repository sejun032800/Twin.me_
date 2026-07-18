// ─── dateClusterService 단위 테스트 (레이어3 — 순수 함수만 검증, DB/네트워크 없음) ──

import {
  clusterStampsByDay,
  haversineDistanceMeters,
  estimateHomeContext,
  promoteTripClusters,
  MIN_TRIP_CONSECUTIVE_DAYS,
  type ClusterableStamp,
  type ClusteredStamp,
  type DayCluster,
  type GeoPoint,
} from '../dateClusterService';

// 서울 홍대 근방 좌표를 홈 turf로, 부산 근방을 여행지로 사용한다.
const HONGDAE: GeoPoint = { lat: 37.5563, lng: 126.9236 };
const HONGDAE_NEARBY: GeoPoint = { lat: 37.5565, lng: 126.924 };
const BUSAN: GeoPoint = { lat: 35.1796, lng: 129.0756 };

function stamp(overrides: Partial<ClusterableStamp> & { id: string }): ClusterableStamp {
  return {
    takenAt: '2026-07-01T10:00:00Z',
    lat: HONGDAE.lat,
    lng: HONGDAE.lng,
    confidence: 'auto',
    ...overrides,
  };
}

describe('clusterStampsByDay', () => {
  it('confidence가 unverified인 스탬프는 클러스터링에서 제외한다', () => {
    const stamps: ClusterableStamp[] = [
      stamp({ id: 'a', confidence: 'auto' }),
      stamp({ id: 'b', confidence: 'unverified' }),
    ];
    const clusters = clusterStampsByDay(stamps);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].stamps.map((s) => s.id)).toEqual(['a']);
  });

  it('taken_at/lat/lng가 없는 스탬프는 제외한다', () => {
    const stamps: ClusterableStamp[] = [
      stamp({ id: 'a' }),
      stamp({ id: 'b', takenAt: null }),
      stamp({ id: 'c', lat: null }),
      stamp({ id: 'd', lng: null }),
    ];
    const clusters = clusterStampsByDay(stamps);
    expect(clusters.flatMap((c) => c.stamps.map((s) => s.id))).toEqual(['a']);
  });

  it('같은 날짜의 스탬프를 하나의 클러스터로 묶고 시간순 정렬한다', () => {
    const stamps: ClusterableStamp[] = [
      stamp({ id: 'late', takenAt: '2026-07-01T11:00:00Z' }),
      stamp({ id: 'early', takenAt: '2026-07-01T09:00:00Z' }),
    ];
    const clusters = clusterStampsByDay(stamps);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].date).toBe('2026-07-01');
    expect(clusters[0].stamps.map((s) => s.id)).toEqual(['early', 'late']);
  });

  it('같은 날짜라도 6시간 넘게 공백이 있으면 별개 클러스터로 쪼갠다', () => {
    const stamps: ClusterableStamp[] = [
      stamp({ id: 'morning', takenAt: '2026-07-01T09:00:00Z' }),
      stamp({ id: 'noon', takenAt: '2026-07-01T11:00:00Z' }),
      stamp({ id: 'night', takenAt: '2026-07-01T20:00:00Z' }), // noon과 9시간 공백
    ];
    const clusters = clusterStampsByDay(stamps);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].stamps.map((s) => s.id)).toEqual(['morning', 'noon']);
    expect(clusters[1].stamps.map((s) => s.id)).toEqual(['night']);
    expect(clusters[0].id).toBe('2026-07-01#0');
    expect(clusters[1].id).toBe('2026-07-01#1');
  });

  it('실제 운영 데이터처럼 시각이 전부 자정으로 동일하면(레이어1 date-only 저장) 분할되지 않는다', () => {
    const stamps: ClusterableStamp[] = [
      stamp({ id: 'a', takenAt: '2026-07-01T00:00:00Z' }),
      stamp({ id: 'b', takenAt: '2026-07-01T00:00:00Z' }),
    ];
    const clusters = clusterStampsByDay(stamps);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].id).toBe('2026-07-01');
  });

  it('클러스터 중심점(centroid)은 스탬프 좌표의 평균이다', () => {
    const stamps: ClusterableStamp[] = [
      stamp({ id: 'a', lat: 10, lng: 20 }),
      stamp({ id: 'b', lat: 20, lng: 30 }),
    ];
    const clusters = clusterStampsByDay(stamps);
    expect(clusters[0].centroid).toEqual({ lat: 15, lng: 25 });
  });

  it('여러 날짜의 클러스터를 날짜 오름차순으로 반환한다', () => {
    const stamps: ClusterableStamp[] = [
      stamp({ id: 'later', takenAt: '2026-07-05T10:00:00Z' }),
      stamp({ id: 'earlier', takenAt: '2026-07-01T10:00:00Z' }),
    ];
    const clusters = clusterStampsByDay(stamps);
    expect(clusters.map((c) => c.date)).toEqual(['2026-07-01', '2026-07-05']);
  });
});

describe('haversineDistanceMeters', () => {
  it('같은 좌표는 거리 0', () => {
    expect(haversineDistanceMeters(HONGDAE, HONGDAE)).toBeCloseTo(0, 5);
  });

  it('위도 1도 차이는 약 111km', () => {
    const a: GeoPoint = { lat: 37, lng: 127 };
    const b: GeoPoint = { lat: 38, lng: 127 };
    expect(haversineDistanceMeters(a, b)).toBeGreaterThan(110_000);
    expect(haversineDistanceMeters(a, b)).toBeLessThan(112_000);
  });

  it('서울-부산 거리는 약 300~350km 범위', () => {
    const d = haversineDistanceMeters(HONGDAE, BUSAN);
    expect(d).toBeGreaterThan(300_000);
    expect(d).toBeLessThan(350_000);
  });
});

function dayCluster(date: string, centroid: GeoPoint, stampCount = 1): DayCluster {
  const stamps: ClusteredStamp[] = Array.from({ length: stampCount }, (_, i) => ({
    id: `${date}-${i}`,
    takenAt: `${date}T10:00:00Z`,
    lat: centroid.lat,
    lng: centroid.lng,
    confidence: 'auto',
  }));
  return { id: date, date, stamps, centroid };
}

describe('estimateHomeContext', () => {
  it('클러스터가 없으면 null', () => {
    expect(estimateHomeContext([])).toBeNull();
  });

  it('가장 많은 날짜-클러스터가 몰린 지리적 버킷을 홈으로 추정한다', () => {
    const clusters = [
      dayCluster('2026-07-01', HONGDAE),
      dayCluster('2026-07-02', HONGDAE_NEARBY),
      dayCluster('2026-07-03', HONGDAE),
      dayCluster('2026-07-10', BUSAN), // 가끔 가는 여행지 — 이상치
    ];
    const home = estimateHomeContext(clusters);
    expect(home).not.toBeNull();
    // 홈 앵커는 홍대 근방(부산이 아님)이어야 한다.
    expect(haversineDistanceMeters(home!.anchor, HONGDAE)).toBeLessThan(5_000);
    expect(home!.supportingClusterCount).toBe(3);
  });

  it('날짜-클러스터가 5개 미만이면(중앙값 신뢰 불가) 고정 폴백 반경을 쓴다', () => {
    const clusters = [dayCluster('2026-07-01', HONGDAE), dayCluster('2026-07-02', HONGDAE)];
    const home = estimateHomeContext(clusters);
    expect(home!.activityRadiusMeters).toBe(25_000);
  });

  it('표본이 충분(5개 이상)하고 홈 근처에서만 데이트하면 중앙값이 0에 가까워 최소 반경으로 수렴한다', () => {
    const clusters = Array.from({ length: 6 }, (_, i) => dayCluster(`2026-07-0${i + 1}`, HONGDAE));
    const home = estimateHomeContext(clusters);
    expect(home!.activityRadiusMeters).toBe(10_000); // MIN_ACTIVITY_RADIUS_METERS
  });

  it('표본이 충분하고 여러 동네에 넓게 퍼져 데이트하면 중앙값 기반으로 최소/최대 사이의 반경을 계산한다', () => {
    // 홈 버킷(홍대, count=2)과 그로부터 각각 ~8km 떨어진 서로 다른 동네 3곳(각 count=1) —
    // 거리 오름차순 정렬 시 [0, 0, ~8000, ~8000, ~8000]의 중앙값은 ~8000m.
    const farA: GeoPoint = { lat: 37.5563 + 0.072, lng: 126.9236 };
    const farB: GeoPoint = { lat: 37.5563 - 0.072, lng: 126.9236 };
    const farC: GeoPoint = { lat: 37.5563, lng: 126.9236 + 0.09 };
    const clusters = [
      dayCluster('2026-07-01', HONGDAE),
      dayCluster('2026-07-02', HONGDAE),
      dayCluster('2026-07-03', farA),
      dayCluster('2026-07-04', farB),
      dayCluster('2026-07-05', farC),
    ];
    const home = estimateHomeContext(clusters);
    // 앵커는 여전히 최빈 버킷인 홍대여야 한다(count=2가 나머지 count=1들보다 많음).
    expect(haversineDistanceMeters(home!.anchor, HONGDAE)).toBeLessThan(1_000);
    // 중앙값(~8km) × 2.5배수 ≈ 20km — floor(10km)/ceiling(60km) 사이여야 의미 있는 검증이 된다.
    expect(home!.activityRadiusMeters).toBeGreaterThan(10_000);
    expect(home!.activityRadiusMeters).toBeLessThan(60_000);
  });
});

describe('promoteTripClusters — FUN-HIS-007', () => {
  const homeAnchor = HONGDAE;
  const radius = 25_000;

  it(`${MIN_TRIP_CONSECUTIVE_DAYS}일 이상 연속으로 반경을 벗어나면 여행으로 승격하고 N일차 라벨을 붙인다`, () => {
    const clusters = [
      dayCluster('2026-07-10', BUSAN),
      dayCluster('2026-07-11', BUSAN),
      dayCluster('2026-07-12', BUSAN),
    ];
    const result = promoteTripClusters(clusters, homeAnchor, radius);
    expect(result.trips).toHaveLength(1);
    expect(result.trips[0].startDate).toBe('2026-07-10');
    expect(result.trips[0].endDate).toBe('2026-07-12');
    expect(result.trips[0].days.map((d) => d.dayIndex)).toEqual([1, 2, 3]);
    expect(result.standaloneDayClusters).toHaveLength(0);
  });

  it('2일 연속 반경 이탈만으로는 승격하지 않는다(최소 3일 미달)', () => {
    const clusters = [dayCluster('2026-07-10', BUSAN), dayCluster('2026-07-11', BUSAN)];
    const result = promoteTripClusters(clusters, homeAnchor, radius);
    expect(result.trips).toHaveLength(0);
    expect(result.standaloneDayClusters).toHaveLength(2);
  });

  it('연속일만으로는 승격하지 않는다 — 이틀 연속 홍대 데이트는 여행이 아니다', () => {
    const clusters = [
      dayCluster('2026-07-01', HONGDAE),
      dayCluster('2026-07-02', HONGDAE_NEARBY),
      dayCluster('2026-07-03', HONGDAE),
    ];
    const result = promoteTripClusters(clusters, homeAnchor, radius);
    expect(result.trips).toHaveLength(0);
    expect(result.standaloneDayClusters).toHaveLength(3);
  });

  it('반경 밖이어도 날짜가 연속되지 않으면(중간에 스탬프 없는 날) 별개로 취급한다', () => {
    const clusters = [
      dayCluster('2026-07-10', BUSAN),
      dayCluster('2026-07-11', BUSAN),
      // 7/12 스탬프 없음
      dayCluster('2026-07-13', BUSAN),
    ];
    const result = promoteTripClusters(clusters, homeAnchor, radius);
    expect(result.trips).toHaveLength(0);
    expect(result.standaloneDayClusters).toHaveLength(3);
  });

  it('여행 도중 홈 반경 안으로 복귀하면 그 지점에서 러닝이 끊긴다(종료 조건)', () => {
    const clusters = [
      dayCluster('2026-07-10', BUSAN),
      dayCluster('2026-07-11', BUSAN),
      dayCluster('2026-07-12', HONGDAE), // 복귀
      dayCluster('2026-07-13', BUSAN),
    ];
    const result = promoteTripClusters(clusters, homeAnchor, radius);
    expect(result.trips).toHaveLength(0); // 앞뒤 모두 2일 이하라 승격 기준 미달
    expect(result.standaloneDayClusters).toHaveLength(4);
  });

  it('4일 연속 여행 뒤 복귀하면 4일 전부 하나의 트립으로 묶인다', () => {
    const clusters = [
      dayCluster('2026-07-10', BUSAN),
      dayCluster('2026-07-11', BUSAN),
      dayCluster('2026-07-12', BUSAN),
      dayCluster('2026-07-13', BUSAN),
      dayCluster('2026-07-14', HONGDAE),
    ];
    const result = promoteTripClusters(clusters, homeAnchor, radius);
    expect(result.trips).toHaveLength(1);
    expect(result.trips[0].days).toHaveLength(4);
    expect(result.standaloneDayClusters.map((c) => c.date)).toEqual(['2026-07-14']);
  });

  it('전부 홈 반경 안이면 여행이 없다', () => {
    const clusters = [dayCluster('2026-07-01', HONGDAE), dayCluster('2026-07-02', HONGDAE)];
    const result = promoteTripClusters(clusters, homeAnchor, radius);
    expect(result.trips).toHaveLength(0);
    expect(result.standaloneDayClusters).toHaveLength(2);
  });
});
