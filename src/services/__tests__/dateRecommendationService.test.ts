// ─── dateRecommendationService 단위 테스트 (레이어4 — 순수 함수 + 모킹된 I/O 래퍼) ──

import type { DateCourse } from '../dateCourseService';

const mockGetPublicCourses = jest.fn();
jest.mock('@/services/dateCourseService', () => {
  const actual = jest.requireActual('../dateCourseService');
  return {
    ...actual,
    getPublicCourses: (...args: unknown[]) => mockGetPublicCourses(...args),
  };
});

const mockInvoke = jest.fn();
jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: (...args: Parameters<typeof mockInvoke>) => mockInvoke(...args),
    },
  },
}));

import {
  categoryCodeToName,
  categoryCodesToTags,
  jaccardSimilarity,
  scoreSimilarCourses,
  findSimilarCourses,
  computeUnvisitedCategories,
  dedupeByPlaceId,
  distanceRelevanceScore,
  findNearbyAlternatives,
  composeDateCourse,
  buildCandidatePool,
  DATE_RELEVANT_CATEGORY_CODES,
  type CourseForSimilarity,
  type VisitedStampSummary,
  type RecommendationCandidate,
  type AnonymizedCoupleContext,
} from '../dateRecommendationService';

beforeEach(() => {
  mockGetPublicCourses.mockReset();
  mockInvoke.mockReset();
});

describe('categoryCodeToName / categoryCodesToTags', () => {
  it('알려진 카테고리 코드는 카카오 공식 category_group_name을 반환한다', () => {
    expect(categoryCodeToName('CE7')).toBe('카페');
    expect(categoryCodeToName('FD6')).toBe('음식점');
  });

  it('알 수 없는 코드는 null', () => {
    expect(categoryCodeToName('ZZ9')).toBeNull();
  });

  it('카테고리 코드 목록을 중복 제거된 태그 목록으로 변환한다', () => {
    expect(categoryCodesToTags(['CE7', 'CE7', 'FD6'])).toEqual(['카페', '음식점']);
  });

  it('알 수 없는 코드는 무시한다', () => {
    expect(categoryCodesToTags(['CE7', 'ZZ9'])).toEqual(['카페']);
  });
});

describe('jaccardSimilarity', () => {
  it('완전히 동일한 태그 집합은 유사도 1', () => {
    expect(jaccardSimilarity(['카페', '음식점'], ['카페', '음식점'])).toBe(1);
  });

  it('교집합/합집합 공식대로 계산한다', () => {
    // 교집합 1개(카페), 합집합 3개(카페, 음식점, 로맨틱) → 1/3
    expect(jaccardSimilarity(['카페', '음식점'], ['카페', '로맨틱'])).toBeCloseTo(1 / 3, 10);
  });

  it('한쪽이 비어 있으면 0', () => {
    expect(jaccardSimilarity([], ['카페'])).toBe(0);
    expect(jaccardSimilarity(['카페'], [])).toBe(0);
  });

  it('겹치는 태그가 전혀 없으면 0', () => {
    expect(jaccardSimilarity(['카페'], ['숙박'])).toBe(0);
  });
});

function course(overrides: Partial<DateCourse> & { id: string }): DateCourse {
  return {
    title: '테스트 코스',
    area: '테스트 지역',
    places: [],
    tags: [],
    myScore: 0,
    partnerScore: 0,
    review: '',
    tierEmoji: '✨',
    tierName: '',
    likes: 0,
    ...overrides,
  };
}

describe('scoreSimilarCourses', () => {
  it('태그가 겹치는 코스만 점수 순으로 반환한다(겹침 0인 코스는 제외)', () => {
    const myCourse: CourseForSimilarity = { id: 'mine', categoryCodes: ['CE7', 'FD6'] };
    const pool: DateCourse[] = [
      course({ id: 'a', tags: ['카페'] }), // 겹침 1/2
      course({ id: 'b', tags: ['카페', '음식점'] }), // 겹침 2/2 = 1
      course({ id: 'c', tags: ['숙박'] }), // 겹침 0 → 제외
    ];

    const result = scoreSimilarCourses(myCourse, pool);

    expect(result.map((c) => c.courseId)).toEqual(['b', 'a']);
    expect(result[0].score).toBe(1);
    expect(result.find((c) => c.courseId === 'c')).toBeUndefined();
  });

  it('limit만큼만 반환한다', () => {
    const myCourse: CourseForSimilarity = { id: 'mine', categoryCodes: ['CE7'] };
    const pool: DateCourse[] = Array.from({ length: 10 }, (_, i) => course({ id: `c${i}`, tags: ['카페'] }));
    expect(scoreSimilarCourses(myCourse, pool, 3)).toHaveLength(3);
  });

  it('반환 구조에 candidateId/kind/reason이 포함된다(LLM 프롬프트용)', () => {
    const myCourse: CourseForSimilarity = { id: 'mine', categoryCodes: ['CE7'] };
    const pool: DateCourse[] = [course({ id: 'a', title: '카페 코스', tags: ['카페'] })];
    const [result] = scoreSimilarCourses(myCourse, pool);
    expect(result.kind).toBe('similar_course');
    expect(result.candidateId).toBe('course:a');
    expect(result.reason).toContain('카페');
  });
});

describe('findSimilarCourses (getPublicCourses 모킹)', () => {
  it('getPublicCourses 결과를 후보 풀로 써서 점수를 매긴다', async () => {
    mockGetPublicCourses.mockResolvedValue({
      courses: [course({ id: 'a', tags: ['카페'] }), course({ id: 'b', tags: ['숙박'] })],
      isMock: false,
    });

    const result = await findSimilarCourses({ id: 'mine', categoryCodes: ['CE7'] });

    expect(mockGetPublicCourses).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].courseId).toBe('a');
  });
});

describe('computeUnvisitedCategories', () => {
  it('데이트 관련 카테고리 중 방문 이력이 없는 것만 반환한다', () => {
    const visited: VisitedStampSummary[] = [
      { categoryCode: 'CE7', kakaoPlaceId: 'p1', confidence: 'auto' },
      { categoryCode: 'FD6', kakaoPlaceId: 'p2', confidence: 'user_confirmed' },
    ];
    const result = computeUnvisitedCategories(visited);
    expect(result).not.toContain('CE7');
    expect(result).not.toContain('FD6');
    expect(result).toEqual(expect.arrayContaining(['AT4', 'CT1', 'AD5']));
  });

  it('unverified 스탬프는 방문 이력으로 치지 않는다(카테고리가 여전히 미방문으로 남는다)', () => {
    const visited: VisitedStampSummary[] = [{ categoryCode: 'CE7', kakaoPlaceId: 'p1', confidence: 'unverified' }];
    expect(computeUnvisitedCategories(visited)).toContain('CE7');
  });

  it('방문 이력이 전혀 없으면 데이트 관련 카테고리 전부를 반환한다', () => {
    expect(computeUnvisitedCategories([])).toEqual([...DATE_RELEVANT_CATEGORY_CODES]);
  });
});

describe('dedupeByPlaceId', () => {
  it('먼저 등장한 place_id를 유지하고 이후 중복은 버린다', () => {
    const items = [{ placeId: 'a', v: 1 }, { placeId: 'b', v: 2 }, { placeId: 'a', v: 3 }];
    expect(dedupeByPlaceId(items)).toEqual([{ placeId: 'a', v: 1 }, { placeId: 'b', v: 2 }]);
  });

  it('이름이 달라도 place_id가 같으면 중복으로 취급한다(문자열 이름 dedup 금지)', () => {
    const items = [
      { placeId: 'kakao-1', name: '스타벅스' },
      { placeId: 'kakao-1', name: '스타벅스 홍대점(표기 다름)' },
    ];
    expect(dedupeByPlaceId(items)).toHaveLength(1);
  });
});

describe('distanceRelevanceScore', () => {
  it('거리 0이면 점수 1', () => {
    expect(distanceRelevanceScore(0, 1000)).toBe(1);
  });

  it('반경 끝(distance === radius)이면 점수 0', () => {
    expect(distanceRelevanceScore(1000, 1000)).toBe(0);
  });

  it('반경을 초과하면 0으로 clamp된다(음수 방지)', () => {
    expect(distanceRelevanceScore(2000, 1000)).toBe(0);
  });

  it('반경 절반이면 점수 0.5', () => {
    expect(distanceRelevanceScore(500, 1000)).toBeCloseTo(0.5, 10);
  });
});

describe('findNearbyAlternatives (kakao-local-search invoke 모킹)', () => {
  function kakaoDoc(id: string, placeName: string, distance: string) {
    return {
      id,
      place_name: placeName,
      category_group_code: 'CE7',
      address_name: '서울 마포구',
      road_address_name: '서울 마포구',
      x: '126.9236',
      y: '37.5563',
      distance,
      place_url: '',
    };
  }

  it('안 가본 카테고리마다 kakao-local-search를 카테고리 모드로 호출한다', async () => {
    mockInvoke.mockResolvedValue({ data: { documents: [], radiusUsed: 1000, cached: false }, error: null });

    const visited: VisitedStampSummary[] = [
      { categoryCode: 'CE7', kakaoPlaceId: 'p1', confidence: 'auto' },
      { categoryCode: 'FD6', kakaoPlaceId: 'p2', confidence: 'auto' },
    ];
    await findNearbyAlternatives(visited, { lat: 37.5563, lng: 126.9236 });

    // CE7/FD6는 이미 방문했으므로 나머지(AT4/CT1/AD5) 3개 카테고리만 호출돼야 한다.
    expect(mockInvoke).toHaveBeenCalledTimes(3);
    const calledCategories = mockInvoke.mock.calls.map((call) => call[1].body.categoryGroupCode);
    expect(calledCategories.sort()).toEqual(['AD5', 'AT4', 'CT1']);
  });

  it('이미 방문한 place_id는 후보에서 제외한다', async () => {
    mockInvoke.mockResolvedValue({
      data: { documents: [kakaoDoc('visited-place', '이미 간 곳', '100')], radiusUsed: 1000, cached: false },
      error: null,
    });

    const visited: VisitedStampSummary[] = [
      { categoryCode: null, kakaoPlaceId: 'visited-place', confidence: 'auto' },
    ];
    const result = await findNearbyAlternatives(visited, { lat: 37.5563, lng: 126.9236 });

    expect(result.find((c) => c.placeId === 'visited-place')).toBeUndefined();
  });

  it('결과에 place_id/이름/주소/카테고리/좌표/근거가 모두 포함된다', async () => {
    mockInvoke.mockImplementation(async (_name: string, opts: { body: { categoryGroupCode: string } }) => {
      if (opts.body.categoryGroupCode !== 'FD6') {
        return { data: { documents: [], radiusUsed: 1000, cached: false }, error: null };
      }
      return {
        data: { documents: [kakaoDoc('new-place', '새로운 맛집', '250')], radiusUsed: 1000, cached: false },
        error: null,
      };
    });

    const result = await findNearbyAlternatives([], { lat: 37.5563, lng: 126.9236 });
    const candidate = result.find((c) => c.placeId === 'new-place');

    expect(candidate).toMatchObject({
      kind: 'nearby_place',
      candidateId: 'place:new-place',
      placeId: 'new-place',
      name: '새로운 맛집',
      address: '서울 마포구',
      lat: 37.5563,
      lng: 126.9236,
    });
    expect(candidate!.reason).toContain('약 250m');
    expect(candidate!.score).toBeGreaterThan(0);
  });

  it('카테고리 하나가 실패해도(에러) 나머지 카테고리 결과는 반환한다', async () => {
    mockInvoke.mockImplementation(async (_name: string, opts: { body: { categoryGroupCode: string } }) => {
      if (opts.body.categoryGroupCode === 'FD6') {
        return { data: null, error: { message: '네트워크 오류' } };
      }
      if (opts.body.categoryGroupCode === 'CE7') {
        return {
          data: { documents: [kakaoDoc('ok-place', '카페 후보', '50')], radiusUsed: 1000, cached: false },
          error: null,
        };
      }
      return { data: { documents: [], radiusUsed: 1000, cached: false }, error: null };
    });

    const result = await findNearbyAlternatives([], { lat: 37.5563, lng: 126.9236 });
    expect(result.find((c) => c.placeId === 'ok-place')).toBeDefined();
  });

  it('결과를 place_id 기준으로 dedup한다(여러 카테고리 검색에서 같은 장소가 중복 등장해도 1건만)', async () => {
    mockInvoke.mockResolvedValue({
      data: { documents: [kakaoDoc('dup-place', '복합 공간', '100')], radiusUsed: 1000, cached: false },
      error: null,
    });

    const result = await findNearbyAlternatives([], { lat: 37.5563, lng: 126.9236 });
    const dupMatches = result.filter((c) => c.placeId === 'dup-place');
    expect(dupMatches).toHaveLength(1);
  });
});

const CONTEXT: AnonymizedCoupleContext = {
  tags: ['카페'],
  avgRatingBand: 4.5,
  areaLabel: '마포구 홍대',
  budgetLabel: '3~7만',
  unvisitedCategories: ['AT4'],
};

function nearbyCandidate(overrides: Partial<RecommendationCandidate> & { candidateId: string }): RecommendationCandidate {
  return {
    kind: 'nearby_place',
    placeId: overrides.candidateId.replace('place:', ''),
    name: '테스트 장소',
    address: '서울 마포구',
    categoryGroupCode: 'CE7',
    categoryName: '카페',
    lat: 37.5563,
    lng: 126.9236,
    score: 0.8,
    reason: '테스트 근거',
    ...overrides,
  } as RecommendationCandidate;
}

describe('composeDateCourse (date-course-compose invoke 모킹)', () => {
  it('빈 후보 리스트면 Edge Function을 호출하지 않고 빈 배열을 반환한다', async () => {
    const result = await composeDateCourse([], CONTEXT);
    expect(result).toEqual([]);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('date-course-compose를 candidateId 기반 payload로 호출하고, 응답의 candidateId를 원본 candidate로 하이드레이션한다', async () => {
    const candidates = [
      nearbyCandidate({ candidateId: 'place:a', name: '카페 A' }),
      nearbyCandidate({ candidateId: 'place:b', name: '카페 B' }),
    ];
    mockInvoke.mockResolvedValue({
      data: {
        courses: [{ candidateIds: ['place:a', 'place:b'], theme: '카페 투어', copy: '둘 다 좋아해서' }],
        discardedCount: 0,
      },
      error: null,
    });

    const result = await composeDateCourse(candidates, CONTEXT);

    expect(mockInvoke).toHaveBeenCalledWith('date-course-compose', expect.objectContaining({
      body: expect.objectContaining({ context: CONTEXT }),
    }));
    // 전송 payload가 candidateId 기반 최소 필드로 축소됐는지 확인(좌표 등 불필요한 필드 제외)
    const sentBody = mockInvoke.mock.calls[0][1].body;
    expect(sentBody.candidates).toEqual([
      { candidateId: 'place:a', name: '카페 A', kind: 'nearby_place', reason: '테스트 근거', detail: '카페' },
      { candidateId: 'place:b', name: '카페 B', kind: 'nearby_place', reason: '테스트 근거', detail: '카페' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].theme).toBe('카페 투어');
    expect(result[0].candidates.map((c) => c.candidateId)).toEqual(['place:a', 'place:b']);
    expect(result[0].candidates[0].name).toBe('카페 A'); // 원본 candidate로 정확히 하이드레이션됐는지
  });

  it('Edge Function이 이미 검증을 마쳐 반환한 courses를 그대로 신뢰한다(클라이언트가 재검증하지 않음)', async () => {
    // Edge Function이 실수로라도 후보에 없는 candidateId를 내려보내면, 이 클라이언트
    // 함수는 그걸 "검증된 것"으로 신뢰하고 하이드레이션을 시도한다 — 다만 존재하지
    // 않는 id는 candidateById.get()이 undefined를 반환해 자동으로 걸러진다(보안
    // 검증이 아니라 단순 null 가드 — Edge Function 신뢰가 이 함수의 설계 전제다).
    const candidates = [nearbyCandidate({ candidateId: 'place:a' })];
    mockInvoke.mockResolvedValue({
      data: {
        courses: [{ candidateIds: ['place:a', 'place:unknown-to-client'], theme: 'T', copy: 'C' }],
        discardedCount: 0,
      },
      error: null,
    });

    const result = await composeDateCourse(candidates, CONTEXT);
    expect(result).toHaveLength(1);
    expect(result[0].candidates.map((c) => c.candidateId)).toEqual(['place:a']);
  });

  it('하이드레이션 결과 후보가 하나도 안 남는 코스는 걸러낸다', async () => {
    mockInvoke.mockResolvedValue({
      data: { courses: [{ candidateIds: ['place:completely-unknown'], theme: 'T', copy: 'C' }], discardedCount: 0 },
      error: null,
    });
    const result = await composeDateCourse([nearbyCandidate({ candidateId: 'place:a' })], CONTEXT);
    expect(result).toEqual([]);
  });

  it('Edge Function 호출이 실패하면 에러를 던진다', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: '네트워크 오류' } });
    await expect(composeDateCourse([nearbyCandidate({ candidateId: 'place:a' })], CONTEXT)).rejects.toThrow(
      '데이트 코스 구성 실패',
    );
  });
});

describe('buildCandidatePool', () => {
  it('findSimilarCourses와 findNearbyAlternatives 결과를 하나의 배열로 합친다', async () => {
    mockGetPublicCourses.mockResolvedValue({
      courses: [
        {
          id: 'course-1',
          title: '카페 코스',
          area: '홍대',
          places: [],
          tags: ['카페'],
          myScore: 0,
          partnerScore: 0,
          review: '',
          tierEmoji: '✨',
          tierName: '',
          likes: 0,
        },
      ],
      isMock: false,
    });
    mockInvoke.mockResolvedValue({ data: { documents: [], radiusUsed: 1000, cached: false }, error: null });

    const pool = await buildCandidatePool({ id: 'mine', categoryCodes: ['CE7'] }, [], { lat: 37.5563, lng: 126.9236 });

    expect(pool.some((c) => c.kind === 'similar_course')).toBe(true);
  });
});
