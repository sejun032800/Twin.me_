// ─── dateClusterService — 방문 스탬프 → 하루 코스 / 여행 클러스터링 (레이어3) ────────
// MASTER.md §7 FUN-HIS-007, date-recommend-architecture.md 레이어3("저장/클러스터링").
// 이 파일은 전부 순수 함수다 — date_photo_stamps를 실제로 조회하거나 date_courses에
// 쓰는 I/O는 이번 레이어 범위 밖(다음 단계에서 별도 함수로 감쌀 예정)이라, 여기서는
// "이미 조회된 스탬프 배열을 어떻게 묶을지"만 다룬다.
//
// ── memoryMapService.optimizePlaces를 재사용하지 않은 이유 ──────────────────────
// 확인해보니 optimizePlaces는 순수 함수가 아니라 callLLM()으로 Gemini를 호출해 방문
// 순서를 재배열하는 함수였다(이 레이어는 LLM 호출 금지). 게다가 그 함수가 다루는
// DatePlace(id/name/area/date/rating/memo)는애초에 좌표나 정밀 시각이 없는 수동 입력
// 리스트를 전제로 하고, "이동 거리를 최소화하는 순서"를 LLM에게 물어보는 설계다.
// date_photo_stamps는 반대로 이미 실제 방문 시각(taken_at)이 있는 "과거 기록"이므로,
// 굳이 지오메트리 기반 경로 재최적화(TSP류)를 할 이유가 없다 — 그날 실제로 방문한
// 순서를 왜곡 없이 보여주려면 taken_at 오름차순 정렬이 곧 정답이다. 그래서
// clusterStampsByDay()는 지오메트리 재정렬 없이 시간순 정렬만 한다.

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ClusterableStamp {
  id: string;
  takenAt: string | null; // date_photo_stamps.taken_at, ISO 8601('YYYY-MM-DD...')
  lat: number | null;
  lng: number | null;
  confidence: 'auto' | 'user_confirmed' | 'unverified';
}

// 클러스터링 가능 조건(unverified 아님, taken_at/lat/lng 모두 존재)을 통과한 스탬프.
// DayCluster.stamps는 이 타입만 담으므로 이후 정렬/centroid 계산에서 null 체크가
// 필요 없다.
export type ClusteredStamp = ClusterableStamp & { takenAt: string; lat: number; lng: number };

export interface DayCluster {
  id: string; // 보통 'YYYY-MM-DD', 같은 날짜 안에서 시간 간격으로 더 쪼개지면 'YYYY-MM-DD#n'
  date: string; // 'YYYY-MM-DD'
  stamps: ClusteredStamp[]; // taken_at 오름차순
  centroid: GeoPoint;
}

// 같은 날짜 안에서도 이 시간(시) 이상 공백이 있으면 별개 코스로 쪼갠다("시간상 연속된
// 스탬프"). 현재 레이어1(usePhotoMetadata.parseExifDate)은 EXIF에서 날짜만 뽑고 시각은
// 버리므로 실제 운영 데이터에서는 같은 날짜의 모든 스탬프가 자정(00:00)으로 찍혀 gap=0 —
// 즉 이 분할은 지금 당장은 사실상 트리거되지 않는다. 하지만 taken_at 컬럼 자체는
// TIMESTAMPTZ라 향후 레이어1이 실제 시각까지 채우도록 개선되면(이번 레이어 범위 밖이라
// 여기서 건드리지 않음) 별도 수정 없이 그대로 동작하도록 미리 구현해둔다.
const INTRA_DAY_SPLIT_GAP_HOURS = 6;

function centroidOf(points: GeoPoint[]): GeoPoint {
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
  return { lat, lng };
}

function isComplete(stamp: ClusterableStamp): stamp is ClusteredStamp {
  return stamp.confidence !== 'unverified' && stamp.takenAt !== null && stamp.lat !== null && stamp.lng !== null;
}

export function clusterStampsByDay(stamps: ClusterableStamp[]): DayCluster[] {
  const usable = stamps.filter(isComplete);

  const byDate = new Map<string, ClusteredStamp[]>();
  for (const stamp of usable) {
    const date = stamp.takenAt.slice(0, 10);
    const list = byDate.get(date) ?? [];
    list.push(stamp);
    byDate.set(date, list);
  }

  const clusters: DayCluster[] = [];
  for (const [date, dayStamps] of byDate) {
    const sorted = [...dayStamps].sort((a, b) => a.takenAt.localeCompare(b.takenAt));

    const subGroups: ClusteredStamp[][] = [];
    let current: ClusteredStamp[] = [];
    for (const stamp of sorted) {
      if (current.length > 0) {
        const prev = current[current.length - 1];
        const gapHours = (new Date(stamp.takenAt).getTime() - new Date(prev.takenAt).getTime()) / 3_600_000;
        if (gapHours > INTRA_DAY_SPLIT_GAP_HOURS) {
          subGroups.push(current);
          current = [];
        }
      }
      current.push(stamp);
    }
    if (current.length > 0) subGroups.push(current);

    subGroups.forEach((group, index) => {
      clusters.push({
        id: subGroups.length > 1 ? `${date}#${index}` : date,
        date,
        stamps: group,
        centroid: centroidOf(group),
      });
    });
  }

  return clusters.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

// ── 거리 계산 ───────────────────────────────────────────────────────────────────
const EARTH_RADIUS_METERS = 6_371_000;

export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ── 홈 위치 / 평소 활동반경 근사 ──────────────────────────────────────────────────
// userStore.ts / coupleStore.ts 확인 결과 위도·경도·주소 등 "홈 위치"에 해당하는 필드가
// 전혀 없다(coupleId/partnerName/relationshipStartDate/anniversaries/dnaResult뿐).
// 온보딩이나 설정에서 홈 주소를 입력받는 기능 자체가 아직 없으므로, 이번 레이어에서는
// date_photo_stamps 자체의 지리적 분포에서 근사할 수밖에 없다.
//
// "첫 방문 스탬프의 중심점"을 홈으로 쓰는 방식은 채택하지 않았다 — 앱을 처음 쓰기
// 시작한 시점에 마침 여행 중이었다면(흔한 케이스) 여행지가 그대로 "홈"으로 고정되는
// 결함이 있다. 대신 "가장 자주 방문한 동네(=날짜-클러스터가 가장 많이 몰린 지리적
// 버킷)"를 홈으로 추정한다 — 이상치(가끔 가는 여행지)에 덜 흔들리고, 표본이 쌓일수록
// 자연히 정교해진다. 격자 크기(약 0.01도 ≈ 1.1km)는 "동네" 스케일로 잡았다: 카카오
// 매칭(레이어2)이 쓰는 ≈150m 셀보다 넓게 잡아야 같은 동네의 여러 가게가 서로 다른
// 홈 버킷으로 쪼개지지 않는다.
//
// 평소 활동반경은 "홈 앵커로부터 전체 날짜-클러스터까지 거리의 중앙값"에 안전 배수
// (×2.5)를 곱해 구한다. 처음엔 "홈 버킷 안에서 관측된 가장 먼 지점(spread)"으로
// 시도했으나, 그 값은 버킷 크기(≈1.1km)에 의해 원천적으로 상한이 걸려 있어 배수를
// 곱해도 항상 최소값(MIN_ACTIVITY_RADIUS_METERS)으로 수렴해버리는 결함이 있었다 —
// 즉 실제 데이터가 어떻든 반경이 사실상 고정값이 되는 셈이라 "평소 활동반경을
// 데이터에서 근사한다"는 목적에 맞지 않았다. 중앙값은 버킷 경계에 갇히지 않고 커플의
// 실제 이동 범위(홈 버킷 밖의 이웃 동네까지 포함)를 반영한다. 홈 근처에서만 주로
// 데이트하는 커플은 중앙값이 0에 가까워 자연히 최소값(폴백과 유사한 범위)으로 수렴하고,
// 여러 동네를 넓게 다니는 커플은 중앙값이 커지며 반경도 함께 넓어진다.
// 표본이 5개 미만이면(MIN_CLUSTERS_FOR_ADAPTIVE_RADIUS) 중앙값 자체가 신뢰하기 어려워
// (예: 2개뿐이면 둘 중 하나가 그대로 중앙값이 되어버림) 고정 폴백값을 쓴다. 폴백값
// 25km는 서울 대도시권(강남↔홍대 시내 이동 + 인접 위성도시 정도)을 감싸면서, 국내
// 근교 당일치기 여행지(가평 약 60km, 인천 앞바다 등)는 넘어서도록 잡은 값이다 —
// 정밀한 값이 아니라 "명백한 도시 내 데이트"와 "명백한 근교 이상 이동"을 가르는
// 대략적 경계로, 실제 홈 주소/설정값이 생기면 이 폴백은 그쪽으로 대체돼야 한다.
//
// 홈 앵커 자체(어느 동네가 "홈"인지)는 여전히 버킷 최빈값으로 찾는다 — 이건 버킷
// 크기에 갇히는 문제가 없다(단순히 "가장 많이 방문한 동네가 어디인가"를 고르는
// 이산적 다수결 문제이지, 연속적인 거리 통계가 아니기 때문이다). 격자 크기(약 0.01도
// ≈ 1.1km)는 "동네" 스케일로 잡았다: 카카오 매칭(레이어2)이 쓰는 ≈150m 셀보다 넓게
// 잡아야 같은 동네의 여러 가게가 서로 다른 홈 버킷으로 쪼개지지 않는다.
const HOME_BUCKET_GRID_DEGREES = 0.01;
const MIN_CLUSTERS_FOR_ADAPTIVE_RADIUS = 5;
const ADAPTIVE_RADIUS_MULTIPLIER = 2.5;
const MIN_ACTIVITY_RADIUS_METERS = 10_000;
const MAX_ACTIVITY_RADIUS_METERS = 60_000;
const FALLBACK_ACTIVITY_RADIUS_METERS = 25_000;

export interface HomeContext {
  anchor: GeoPoint;
  activityRadiusMeters: number;
  supportingClusterCount: number;
}

function bucketKey(point: GeoPoint): string {
  const latBucket = Math.round(point.lat / HOME_BUCKET_GRID_DEGREES);
  const lngBucket = Math.round(point.lng / HOME_BUCKET_GRID_DEGREES);
  return `${latBucket},${lngBucket}`;
}

function totalStampCount(clusters: DayCluster[]): number {
  return clusters.reduce((sum, c) => sum + c.stamps.length, 0);
}

function median(sortedValues: number[]): number {
  const n = sortedValues.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 : sortedValues[mid];
}

export function estimateHomeContext(dayClusters: DayCluster[]): HomeContext | null {
  if (dayClusters.length === 0) return null;

  const buckets = new Map<string, DayCluster[]>();
  for (const cluster of dayClusters) {
    const key = bucketKey(cluster.centroid);
    const list = buckets.get(key) ?? [];
    list.push(cluster);
    buckets.set(key, list);
  }

  let best: { key: string; clusters: DayCluster[] } | null = null;
  for (const [key, clusters] of buckets) {
    const better =
      !best ||
      clusters.length > best.clusters.length ||
      (clusters.length === best.clusters.length && totalStampCount(clusters) > totalStampCount(best.clusters)) ||
      (clusters.length === best.clusters.length &&
        totalStampCount(clusters) === totalStampCount(best.clusters) &&
        key < best.key);
    if (better) best = { key, clusters };
  }

  const homeClusters = best!.clusters;
  const anchor = centroidOf(homeClusters.map((c) => c.centroid));

  let activityRadiusMeters = FALLBACK_ACTIVITY_RADIUS_METERS;
  if (dayClusters.length >= MIN_CLUSTERS_FOR_ADAPTIVE_RADIUS) {
    const distances = dayClusters.map((c) => haversineDistanceMeters(anchor, c.centroid)).sort((a, b) => a - b);
    const medianDistance = median(distances);
    activityRadiusMeters = clamp(
      medianDistance * ADAPTIVE_RADIUS_MULTIPLIER,
      MIN_ACTIVITY_RADIUS_METERS,
      MAX_ACTIVITY_RADIUS_METERS,
    );
  }

  return { anchor, activityRadiusMeters, supportingClusterCount: homeClusters.length };
}

// ── 여행(멀티데이) 승격 ────────────────────────────────────────────────────────────
// date-recommend-architecture.md 레이어3 "3일 이상 연속 시 '여행 1일차/2일차/3일차'
// 자동 라벨링"을 승격 기준선으로 채택했다 — MASTER.md FUN-HIS-007은 "연속된 날짜"라고만
// 적어 최소 일수를 명시하지 않지만, architecture.md가 이 기능을 위해 쓰인 더 구체적인
// 구현 스펙이라 거기 명시된 "3일 이상"을 그대로 따른다. 즉 2일 연속 반경 이탈은(둘 다
// 검증된 스탬프 + 홈 반경 밖이어도) 아직 "여행"으로 승격하지 않고 각각 독립된 하루
// 코스로 남는다.
export const MIN_TRIP_CONSECUTIVE_DAYS = 3;

export interface TripDay {
  dayIndex: number; // 1부터 시작 — "여행 N일차"의 N
  cluster: DayCluster;
}

export interface TripCluster {
  id: string;
  startDate: string;
  endDate: string;
  days: TripDay[];
}

export interface PromotionResult {
  trips: TripCluster[];
  // 여행으로 승격되지 않은 날짜의 클러스터 — clusterStampsByDay가 만든 sub-cluster
  // 단위 그대로 반환한다(승격되지 않았으므로 하루 단위로 합칠 이유가 없다).
  standaloneDayClusters: DayCluster[];
}

function isNextCalendarDay(date: string, next: string): boolean {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10) === next;
}

function mergeClustersOfDay(date: string, clusters: DayCluster[]): DayCluster {
  const stamps = clusters.flatMap((c) => c.stamps).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  return { id: date, date, stamps, centroid: centroidOf(stamps) };
}

export function promoteTripClusters(
  dayClusters: DayCluster[],
  homeAnchor: GeoPoint,
  activityRadiusMeters: number,
): PromotionResult {
  const byDate = new Map<string, DayCluster[]>();
  for (const c of dayClusters) {
    const list = byDate.get(c.date) ?? [];
    list.push(c);
    byDate.set(c.date, list);
  }

  const sortedDates = [...byDate.keys()].sort();
  const isAway = new Map<string, boolean>();
  for (const date of sortedDates) {
    const clustersOfDay = byDate.get(date)!;
    const centroid = centroidOf(clustersOfDay.map((c) => c.centroid));
    isAway.set(date, haversineDistanceMeters(homeAnchor, centroid) > activityRadiusMeters);
  }

  const trips: TripCluster[] = [];
  const standaloneDates = new Set(sortedDates);

  let i = 0;
  while (i < sortedDates.length) {
    if (!isAway.get(sortedDates[i])) {
      i++;
      continue;
    }

    let j = i;
    while (
      j + 1 < sortedDates.length &&
      isNextCalendarDay(sortedDates[j], sortedDates[j + 1]) &&
      isAway.get(sortedDates[j + 1])
    ) {
      j++;
    }

    const runDates = sortedDates.slice(i, j + 1);
    if (runDates.length >= MIN_TRIP_CONSECUTIVE_DAYS) {
      const days: TripDay[] = runDates.map((date, index) => ({
        dayIndex: index + 1,
        cluster: mergeClustersOfDay(date, byDate.get(date)!),
      }));
      trips.push({
        id: `trip-${runDates[0]}-${runDates[runDates.length - 1]}`,
        startDate: runDates[0],
        endDate: runDates[runDates.length - 1],
        days,
      });
      for (const d of runDates) standaloneDates.delete(d);
    }

    i = j + 1;
  }

  const standaloneDayClusters = dayClusters.filter((c) => standaloneDates.has(c.date));

  return { trips, standaloneDayClusters };
}
