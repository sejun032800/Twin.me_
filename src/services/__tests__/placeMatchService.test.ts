// ─── placeMatchService 단위 테스트 (레이어2 — 순수 함수만 검증, 네트워크/Supabase 없음) ──

import {
  hangulJamoDecompose,
  levenshteinDistance,
  koreanStringSimilarity,
  distanceDecayScore,
  categoryPriorScore,
  computeMatchScore,
  classifyMatch,
  normalizeKakaoDocument,
  DEFAULT_WEIGHTS,
  DENSE_AREA_CANDIDATE_THRESHOLD,
  type KakaoPlaceCandidate,
} from '../placeMatchService';

describe('hangulJamoDecompose', () => {
  it('완성형 한글 음절을 초성/중성/종성으로 분해한다', () => {
    expect(hangulJamoDecompose('스벅')).toBe('ㅅㅡㅂㅓㄱ');
  });

  it('종성이 없는 음절은 종성 없이 분해한다', () => {
    expect(hangulJamoDecompose('가')).toBe('ㄱㅏ');
  });

  it('한글이 아닌 문자는 그대로 통과시킨다', () => {
    expect(hangulJamoDecompose('스벅 A1')).toBe('ㅅㅡㅂㅓㄱ A1');
  });
});

describe('levenshteinDistance', () => {
  it('동일 문자열은 거리 0', () => {
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
  });

  it('빈 문자열과의 거리는 상대 길이', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });

  it('표준 편집거리 예시(kitten → sitting = 3)', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('koreanStringSimilarity', () => {
  it('완전히 동일한 상호명은 유사도 1에 가깝다', () => {
    expect(koreanStringSimilarity('스타벅스 홍대점', '스타벅스 홍대점')).toBeCloseTo(1, 5);
  });

  it('"스벅" 같은 흔한 줄임말이 실제 상호명("스타벅스 홍대점")과 무관한 상호명보다 훨씬 높은 유사도를 받는다', () => {
    const abbreviation = koreanStringSimilarity('스벅', '스타벅스 홍대점');
    const unrelated = koreanStringSimilarity('스벅', '김밥천국 신촌점');
    expect(abbreviation).toBeGreaterThan(unrelated);
  });

  it('부분일치(연속 부분문자열)가 있으면 순서만 맞는 부분일치보다 더 높은 점수를 받는다', () => {
    // "홍대점"은 "AA 홍대점"의 연속 부분문자열 — 부분일치 보너스가 더 크게 붙어야 한다.
    const substring = koreanStringSimilarity('홍대점', 'AA 홍대점');
    // "스벅"은 "스타벅스"의 부분문자열이 아니라 순서만 맞는 subsequence
    const subsequence = koreanStringSimilarity('스벅', '스타벅스');
    expect(substring).toBeGreaterThan(subsequence);
  });

  it('빈 문자열은 유사도 0', () => {
    expect(koreanStringSimilarity('', '스타벅스')).toBe(0);
    expect(koreanStringSimilarity('스타벅스', '')).toBe(0);
  });
});

describe('distanceDecayScore', () => {
  it('거리 0m는 감쇠 1', () => {
    expect(distanceDecayScore(0)).toBeCloseTo(1, 10);
  });

  it('exp(-d/50) 공식을 그대로 따른다(d=50 → e^-1)', () => {
    expect(distanceDecayScore(50)).toBeCloseTo(Math.exp(-1), 10);
  });

  it('거리가 멀수록 감쇠 점수가 낮아진다', () => {
    expect(distanceDecayScore(500)).toBeLessThan(distanceDecayScore(50));
  });
});

describe('categoryPriorScore', () => {
  it('레이어2에서는 항상 0을 반환한다(TODO — 레이어4 이후 구현)', () => {
    const candidate: KakaoPlaceCandidate = {
      placeId: '1',
      placeName: '스타벅스 홍대점',
      addressName: '서울 마포구',
      categoryGroupCode: 'CE7',
      distanceMeters: 10,
    };
    expect(categoryPriorScore(candidate)).toBe(0);
  });
});

describe('computeMatchScore', () => {
  it('기본 가중치에서 문자열유사도·거리감쇠만 점수에 기여한다(카테고리사전확률 가중치 0)', () => {
    const candidate: KakaoPlaceCandidate = {
      placeId: '1',
      placeName: '스타벅스 홍대점',
      addressName: '서울 마포구',
      categoryGroupCode: 'CE7',
      distanceMeters: 0,
    };
    const expected =
      DEFAULT_WEIGHTS.stringSim * koreanStringSimilarity('스타벅스 홍대점', candidate.placeName) +
      DEFAULT_WEIGHTS.distanceDecay * distanceDecayScore(0);
    expect(computeMatchScore(candidate, '스타벅스 홍대점')).toBeCloseTo(expected, 10);
  });
});

describe('normalizeKakaoDocument', () => {
  it('카카오 원본 문서를 camelCase 후보 객체로 변환한다', () => {
    const normalized = normalizeKakaoDocument({
      id: 'kakao-123',
      place_name: '스타벅스 홍대점',
      category_group_code: 'CE7',
      road_address_name: '서울 마포구 양화로 1',
      address_name: '서울 마포구 동교동 1',
      distance: '42',
    });
    expect(normalized).toEqual({
      placeId: 'kakao-123',
      placeName: '스타벅스 홍대점',
      addressName: '서울 마포구 양화로 1',
      categoryGroupCode: 'CE7',
      distanceMeters: 42,
    });
  });

  it('road_address_name이 없으면 address_name으로 폴백한다', () => {
    const normalized = normalizeKakaoDocument({
      id: 'kakao-1',
      place_name: 'X',
      address_name: '지번 주소',
      distance: '5',
    });
    expect(normalized.addressName).toBe('지번 주소');
  });
});

function candidate(overrides: Partial<KakaoPlaceCandidate>): KakaoPlaceCandidate {
  return {
    placeId: 'id',
    placeName: '이름',
    addressName: '주소',
    categoryGroupCode: null,
    distanceMeters: 10,
    ...overrides,
  };
}

describe('classifyMatch — FUN-HIS-006 케이스 분기표', () => {
  it('후보가 없으면 no_match', () => {
    const result = classifyMatch([], '스타벅스');
    expect(result.case).toBe('no_match');
    expect(result.candidates).toEqual([]);
    expect(result.topCandidate).toBeNull();
  });

  it('1위 점수가 압도적으로 높고 2위와 격차가 크면 high_confidence_single', () => {
    const candidates = [
      candidate({ placeId: 'a', placeName: '스타벅스 홍대점', distanceMeters: 5 }),
      candidate({ placeId: 'b', placeName: '전혀 다른 상호명 매장', distanceMeters: 400 }),
    ];
    const result = classifyMatch(candidates, '스타벅스 홍대점');
    expect(result.case).toBe('high_confidence_single');
    expect(result.topCandidate?.placeId).toBe('a');
    expect(result.candidates).toHaveLength(1);
  });

  it('1·2위 점수가 근접하면(동일 브랜드 다른 지점 등) ambiguous, 후보 최대 3개 반환', () => {
    const candidates = [
      candidate({ placeId: 'a', placeName: '스타벅스 강남점', distanceMeters: 30 }),
      candidate({ placeId: 'b', placeName: '스타벅스 역삼점', distanceMeters: 35 }),
      candidate({ placeId: 'c', placeName: '스타벅스 선릉점', distanceMeters: 40 }),
    ];
    const result = classifyMatch(candidates, '스타벅스');
    expect(result.case).toBe('ambiguous');
    expect(result.candidates.length).toBeLessThanOrEqual(3);
    expect(result.topCandidate).not.toBeNull();
  });

  it('반경 내 후보 수가 임계치를 넘으면 dense_area — 재정렬된 상위 후보를 반환한다', () => {
    const candidates = Array.from({ length: DENSE_AREA_CANDIDATE_THRESHOLD + 1 }, (_, i) =>
      candidate({ placeId: `p${i}`, placeName: `가게 ${i}`, distanceMeters: i * 10 }),
    );
    const result = classifyMatch(candidates, '가게 3');
    expect(result.case).toBe('dense_area');
    expect(result.candidates.length).toBeLessThanOrEqual(10);
    // 밀집 지역 가중치(문자열유사도↑)에서 정확히 일치하는 "가게 3"이 최상위여야 한다.
    expect(result.topCandidate?.placeId).toBe('p3');
  });

  it('점수가 최소 허용치 미만이면(전부 무관한 후보) no_match', () => {
    const candidates = [
      candidate({ placeId: 'a', placeName: '완전 무관한 상호명', distanceMeters: 5000 }),
      candidate({ placeId: 'b', placeName: '역시 무관한 상호명', distanceMeters: 6000 }),
    ];
    const result = classifyMatch(candidates, '스타벅스 홍대점');
    expect(result.case).toBe('no_match');
    expect(result.topCandidate).toBeNull();
  });
});
