// ─── datePhotoStampService.rematchDatePhotoStamp 테스트 (레이어2 — Supabase/Edge Function 모킹) ──
// kakao-local-search Edge Function 응답과 date_photo_stamps 테이블을 인메모리 페이크로
// 모킹해, "high_confidence_single일 때만 자동 UPDATE"와 "그 외 케이스는 unverified 유지"
// 분기가 정확히 지켜지는지 검증한다. placeMatchService의 실제 classifyMatch()를 그대로
// 사용한다(이중 모킹으로 로직을 가리지 않기 위함).

interface FakeStampRow {
  id: string;
  user_input_name: string | null;
  lat: number | null;
  lng: number | null;
  kakao_place_id: string | null;
  category_code: string | null;
  confidence: string;
}

const mockStamps = new Map<string, FakeStampRow>();
const mockInvoke = jest.fn();

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'date_photo_stamps') throw new Error(`예상치 못한 테이블: ${table}`);
      return {
        select: () => ({
          eq: (_col: string, id: string) => ({
            single: async () => {
              const row = mockStamps.get(id);
              return row ? { data: row, error: null } : { data: null, error: { message: '존재하지 않음' } };
            },
          }),
        }),
        update: (patch: Partial<FakeStampRow>) => ({
          eq: async (_col: string, id: string) => {
            const row = mockStamps.get(id);
            if (row) Object.assign(row, patch);
            return { error: null };
          },
        }),
      };
    },
    functions: {
      // mockInvoke를 직접 대입하면(값으로 캡처) jest.mock 팩토리가 require 시점에
      // 즉시 실행되면서 아직 초기화 전인 mockInvoke(undefined)를 읽어버린다 — mockStamps는
      // 중첩 클로저(select/eq/single) 안에서 지연 참조되어 문제없지만, invoke는 객체 리터럴
      // 값으로 바로 대입돼 그 보호를 못 받는다. 화살표 함수로 한 겹 감싸 호출 시점까지
      // mockInvoke 참조를 미룬다.
      invoke: (...args: Parameters<typeof mockInvoke>) => mockInvoke(...args),
    },
  },
}));

import { rematchDatePhotoStamp } from '../datePhotoStampService';

function seedStamp(overrides: Partial<FakeStampRow> & { id: string }) {
  const row: FakeStampRow = {
    user_input_name: '스타벅스 홍대점',
    lat: 37.5563,
    lng: 126.9236,
    kakao_place_id: null,
    category_code: null,
    confidence: 'unverified',
    ...overrides,
  };
  mockStamps.set(row.id, row);
  return row;
}

beforeEach(() => {
  mockStamps.clear();
  mockInvoke.mockReset();
});

describe('rematchDatePhotoStamp', () => {
  it('상호명이 없으면 검색을 시도하지 않고 no_match를 반환한다', async () => {
    seedStamp({ id: 's1', user_input_name: null });

    const outcome = await rematchDatePhotoStamp('s1');

    expect(outcome.case).toBe('no_match');
    expect(outcome.updated).toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('좌표가 없으면 검색을 시도하지 않고 no_match를 반환한다', async () => {
    seedStamp({ id: 's2', lat: null });

    const outcome = await rematchDatePhotoStamp('s2');

    expect(outcome.case).toBe('no_match');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('고신뢰 단독 매칭이면 kakao_place_id/category_code를 채우고 confidence를 auto로 갱신한다', async () => {
    seedStamp({ id: 's3' });
    mockInvoke.mockResolvedValue({
      data: {
        documents: [
          { id: 'kakao-1', place_name: '스타벅스 홍대점', category_group_code: 'CE7', road_address_name: '서울 마포구', distance: '10' },
          { id: 'kakao-2', place_name: '전혀 다른 상호명 매장', category_group_code: 'FD6', road_address_name: '서울 마포구', distance: '900' },
        ],
        radiusUsed: 50,
        cached: false,
      },
      error: null,
    });

    const outcome = await rematchDatePhotoStamp('s3');

    expect(outcome.case).toBe('high_confidence_single');
    expect(outcome.updated).toBe(true);
    expect(mockStamps.get('s3')?.kakao_place_id).toBe('kakao-1');
    expect(mockStamps.get('s3')?.category_code).toBe('CE7');
    expect(mockStamps.get('s3')?.confidence).toBe('auto');
  });

  it('분점 모호 케이스는 자동 UPDATE하지 않고 unverified를 유지한다', async () => {
    seedStamp({ id: 's4', user_input_name: '스타벅스' });
    mockInvoke.mockResolvedValue({
      data: {
        documents: [
          { id: 'kakao-a', place_name: '스타벅스 강남점', category_group_code: 'CE7', road_address_name: '서울 강남구', distance: '30' },
          { id: 'kakao-b', place_name: '스타벅스 역삼점', category_group_code: 'CE7', road_address_name: '서울 강남구', distance: '35' },
        ],
        radiusUsed: 150,
        cached: false,
      },
      error: null,
    });

    const outcome = await rematchDatePhotoStamp('s4');

    expect(outcome.case).toBe('ambiguous');
    expect(outcome.updated).toBe(false);
    expect(mockStamps.get('s4')?.confidence).toBe('unverified');
    expect(mockStamps.get('s4')?.kakao_place_id).toBeNull();
  });

  it('카카오 검색 결과가 비어 있으면 no_match이고 UPDATE하지 않는다', async () => {
    seedStamp({ id: 's5' });
    mockInvoke.mockResolvedValue({ data: { documents: [], radiusUsed: 300, cached: false }, error: null });

    const outcome = await rematchDatePhotoStamp('s5');

    expect(outcome.case).toBe('no_match');
    expect(outcome.updated).toBe(false);
  });

  it('존재하지 않는 스탬프면 에러를 던진다', async () => {
    await expect(rematchDatePhotoStamp('missing')).rejects.toThrow('스탬프 조회 실패');
  });

  it('Edge Function 호출이 실패하면 에러를 던진다', async () => {
    seedStamp({ id: 's6' });
    mockInvoke.mockResolvedValue({ data: null, error: { message: '네트워크 오류' } });

    await expect(rematchDatePhotoStamp('s6')).rejects.toThrow('카카오 로컬 검색 실패');
  });
});
