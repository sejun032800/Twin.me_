// ─── date-course-compose compose.ts 단위 테스트 (Gemini mock 없음 — 순수 검증 로직만) ──
// validateComposedCourses는 이 기능 전체의 유일한 존재 이유(검증된 후보 안에서만
// 고르게 하는 것)를 지키는 함수라 가장 꼼꼼히 검증한다.

import { buildComposePrompt, validateComposedCourses, type PromptCandidate, type AnonymizedCoupleContext } from '../compose';

const CONTEXT: AnonymizedCoupleContext = {
  tags: ['카페', '음식점'],
  avgRatingBand: 4.5,
  areaLabel: '마포구 홍대',
  budgetLabel: '3~7만',
  unvisitedCategories: ['AT4'],
};

function candidate(overrides: Partial<PromptCandidate> & { candidateId: string }): PromptCandidate {
  return {
    name: '테스트 장소',
    kind: 'nearby_place',
    reason: '테스트 근거',
    detail: '카페',
    ...overrides,
  };
}

describe('buildComposePrompt', () => {
  it('후보 리스트의 candidateId를 프롬프트 텍스트에 그대로 포함시킨다', () => {
    const prompt = buildComposePrompt([candidate({ candidateId: 'place:abc123', name: '스타벅스' })], CONTEXT);
    expect(prompt).toContain('place:abc123');
    expect(prompt).toContain('스타벅스');
  });

  it('익명화 규칙에 따른 5개 필드(태그/평점대/지역/예산대/안해본카테고리)만 프롬프트에 노출한다', () => {
    const prompt = buildComposePrompt([], CONTEXT);
    expect(prompt).toContain('카페, 음식점');
    expect(prompt).toContain('4.5');
    expect(prompt).toContain('마포구 홍대');
    expect(prompt).toContain('3~7만');
    expect(prompt).toContain('AT4');
  });

  it('"리스트에 없는 id를 새로 만들지 마라"는 절대 규칙 문구를 포함한다', () => {
    const prompt = buildComposePrompt([], CONTEXT);
    expect(prompt).toMatch(/새로 만들어내지 마라/);
  });
});

describe('validateComposedCourses — 정상 케이스', () => {
  const pool: PromptCandidate[] = [
    candidate({ candidateId: 'place:a' }),
    candidate({ candidateId: 'place:b' }),
    candidate({ candidateId: 'course:c' }),
  ];

  it('모든 candidateId가 후보 리스트에 실존하면 그대로 통과시킨다', () => {
    const raw = {
      courses: [
        { candidateIds: ['place:a', 'place:b'], theme: '카페 투어', copy: '둘 다 카페를 좋아해서 추천' },
        { candidateIds: ['course:c'], theme: '기존 인기 코스', copy: '이미 검증된 코스' },
      ],
    };
    const result = validateComposedCourses(raw, pool);
    expect(result.courses).toHaveLength(2);
    expect(result.discardedCount).toBe(0);
  });

  it('코스가 0개인 정상 응답(courses: [])도 그대로 통과시킨다', () => {
    const result = validateComposedCourses({ courses: [] }, pool);
    expect(result.courses).toEqual([]);
    expect(result.discardedCount).toBe(0);
  });
});

describe('validateComposedCourses — 존재하지 않는 place_id가 섞인 응답', () => {
  const pool: PromptCandidate[] = [candidate({ candidateId: 'place:a' }), candidate({ candidateId: 'place:b' })];

  it('코스 하나에 존재하지 않는 candidateId가 하나라도 섞여 있으면 그 코스 항목 전체를 폐기한다', () => {
    const raw = {
      courses: [
        {
          // place:a는 실존하지만 place:fabricated는 후보 리스트에 없음 — 부분 신뢰 금지로
          // place:a까지 포함해 이 코스 항목 전체가 버려져야 한다.
          candidateIds: ['place:a', 'place:fabricated'],
          theme: 'LLM이 지어낸 코스',
          copy: '환각 포함',
        },
      ],
    };
    const result = validateComposedCourses(raw, pool);
    expect(result.courses).toHaveLength(0);
    expect(result.discardedCount).toBe(1);
  });

  it('여러 코스 중 하나만 오염됐으면 그 하나만 버리고 나머지 유효한 코스는 살린다', () => {
    const raw = {
      courses: [
        { candidateIds: ['place:a'], theme: '정상 코스 1', copy: '정상' },
        { candidateIds: ['place:b', 'place:없는곳'], theme: '오염된 코스', copy: '환각' },
        { candidateIds: ['place:b'], theme: '정상 코스 2', copy: '정상' },
      ],
    };
    const result = validateComposedCourses(raw, pool);
    expect(result.courses).toHaveLength(2);
    expect(result.courses.map((c) => c.theme)).toEqual(['정상 코스 1', '정상 코스 2']);
    expect(result.discardedCount).toBe(1);
  });

  it('완전히 지어낸 candidateId만 있는 코스는 통째로 폐기된다', () => {
    const raw = {
      courses: [{ candidateIds: ['place:완전히지어낸곳'], theme: '가짜 코스', copy: '가짜' }],
    };
    const result = validateComposedCourses(raw, pool);
    expect(result.courses).toHaveLength(0);
    expect(result.discardedCount).toBe(1);
  });
});

describe('validateComposedCourses — 스키마 자체가 깨진 응답(구조 방어)', () => {
  const pool: PromptCandidate[] = [candidate({ candidateId: 'place:a' })];

  it('최상위 courses 필드가 없으면 빈 결과', () => {
    expect(validateComposedCourses({}, pool)).toEqual({ courses: [], discardedCount: 0 });
  });

  it('courses가 배열이 아니면 빈 결과', () => {
    expect(validateComposedCourses({ courses: 'not-an-array' }, pool)).toEqual({ courses: [], discardedCount: 0 });
  });

  it('응답 자체가 object가 아니면(null/문자열 등) 빈 결과', () => {
    expect(validateComposedCourses(null, pool)).toEqual({ courses: [], discardedCount: 0 });
    expect(validateComposedCourses('그냥 문자열', pool)).toEqual({ courses: [], discardedCount: 0 });
  });

  it('candidateIds가 빈 배열인 코스는 폐기한다(참조하는 후보가 하나도 없는 코스는 무의미)', () => {
    const raw = { courses: [{ candidateIds: [], theme: '빈 코스', copy: '내용 없음' }] };
    const result = validateComposedCourses(raw, pool);
    expect(result.courses).toHaveLength(0);
    expect(result.discardedCount).toBe(1);
  });

  it('theme이나 copy가 빠진 코스는 폐기한다', () => {
    const raw = { courses: [{ candidateIds: ['place:a'], theme: '테마만 있음' }] };
    const result = validateComposedCourses(raw, pool);
    expect(result.courses).toHaveLength(0);
    expect(result.discardedCount).toBe(1);
  });

  it('candidateIds에 문자열이 아닌 값이 섞이면 폐기한다', () => {
    const raw = { courses: [{ candidateIds: ['place:a', 123], theme: 'T', copy: 'C' }] };
    const result = validateComposedCourses(raw, pool);
    expect(result.courses).toHaveLength(0);
    expect(result.discardedCount).toBe(1);
  });
});
