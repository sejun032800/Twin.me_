// ─── dateCourseService 단위 테스트 — getCoupleAvgRatingBand(신규 함수) ────────────
// date_courses는 supabase.from('date_courses')를 호출별로 다른 select 컬럼으로
// 두 번 쓴다(자체 평점 조회 vs getPublicCourses의 폴백 조회) — 아래 mockFrom은
// select() 인자로 어느 쪽 호출인지 구분해 각기 다른 결과를 반환한다.

type QueryResult = { data: unknown; error: unknown };

function chainable(result: QueryResult) {
  const builder: {
    eq: jest.Mock;
    order: jest.Mock;
    limit: jest.Mock;
    then: (resolve: (v: QueryResult) => void) => void;
  } = {
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    then: (resolve) => resolve(result),
  };
  return builder;
}

let ownScoreResult: QueryResult = { data: [], error: null };
let publicCoursesResult: QueryResult = { data: null, error: { message: 'mock: MOCK_COURSES 폴백 강제' } };

const mockFrom = jest.fn((table: string) => {
  if (table !== 'date_courses') throw new Error(`예상치 못한 테이블: ${table}`);
  return {
    select: (columns: string) =>
      columns === 'my_score, partner_score' ? chainable(ownScoreResult) : chainable(publicCoursesResult),
  };
});

jest.mock('@/lib/supabaseClient', () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { getCoupleAvgRatingBand } from '../dateCourseService';

beforeEach(() => {
  mockFrom.mockClear();
  ownScoreResult = { data: [], error: null };
  publicCoursesResult = { data: null, error: { message: 'mock: MOCK_COURSES 폴백 강제' } };
});

// MOCK_COURSES(dateCourseService.ts)의 myScore/partnerScore 6개 값 평균 —
// (4.9+5.0+4.5+4.7+4.8+4.6)/6 = 4.75, 소수 첫째자리 반올림(JS Math.round 특성상
// .5는 올림) → 4.8. 아래 폴백 케이스들의 기대값으로 재사용한다.
const MOCK_COURSES_AVG_ROUNDED = 4.8;

describe('getCoupleAvgRatingBand', () => {
  it('coupleId가 있고 자체 평점 데이터가 있으면 my_score/partner_score 평균을 반환한다', async () => {
    ownScoreResult = {
      data: [
        { my_score: 4, partner_score: 5 },
        { my_score: 3, partner_score: 4 },
      ],
      error: null,
    };
    await expect(getCoupleAvgRatingBand('couple-1')).resolves.toBe(4);
  });

  it('점수 중 null이 섞여 있으면 null을 제외하고 평균을 낸다', async () => {
    ownScoreResult = {
      data: [
        { my_score: 5, partner_score: null },
        { my_score: null, partner_score: null },
      ],
      error: null,
    };
    await expect(getCoupleAvgRatingBand('couple-1')).resolves.toBe(5);
  });

  it('coupleId가 null이면(미연동) 자체 조회를 건너뛰고 바로 공개 코스 평균으로 대체한다', async () => {
    const result = await getCoupleAvgRatingBand(null);
    expect(result).toBe(MOCK_COURSES_AVG_ROUNDED);
    expect(mockFrom).toHaveBeenCalledTimes(1); // 자체 조회 없이 공개 코스 조회만 1회
  });

  it('coupleId는 있지만 자체 코스가 하나도 없는 신규 커플은 공개 코스 평균으로 대체한다', async () => {
    ownScoreResult = { data: [], error: null };
    const result = await getCoupleAvgRatingBand('new-couple');
    expect(result).toBe(MOCK_COURSES_AVG_ROUNDED);
  });

  it('자체 코스는 있지만 평점이 전부 null이면 공개 코스 평균으로 대체한다', async () => {
    ownScoreResult = { data: [{ my_score: null, partner_score: null }], error: null };
    const result = await getCoupleAvgRatingBand('couple-1');
    expect(result).toBe(MOCK_COURSES_AVG_ROUNDED);
  });

  it('자체 조회가 에러를 반환해도 예외를 던지지 않고 공개 코스 평균으로 대체한다', async () => {
    ownScoreResult = { data: null, error: { message: '네트워크 오류' } };
    const result = await getCoupleAvgRatingBand('couple-1');
    expect(result).toBe(MOCK_COURSES_AVG_ROUNDED);
  });
});
