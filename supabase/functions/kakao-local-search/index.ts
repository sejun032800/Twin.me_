// ─── kakao-local-search Edge Function (date-recommend-architecture.md 레이어2, MASTER.md §7 FUN-HIS-006) ──
// llm-route/adaptive-interview와 완전히 분리된 별도 엔드포인트다. 역할은 카카오 로컬
// API(키워드 검색)를 그대로 프록시하는 것 하나로 한정한다 — 클라이언트가 KAKAO_REST_API_KEY를
// 직접 들고 있지 않도록 이 함수 안에서만 Deno.env로 읽는다.
//
// 반경 단계적 확장(50→150→300m)을 클라이언트가 아니라 이 함수 안에서 처리하기로 했다:
//   1. 모바일 클라이언트→Edge Function 왕복은 느리고(특히 불안정한 네트워크) 비용이 크다.
//      50/150/300m를 순차로 시도하는 로직을 클라이언트가 하면 최대 3번의 별도 invoke가
//      필요하지만, 여기서 처리하면 왕복 1회로 끝난다.
//   2. "반경을 넓혀가며 재시도"는 카카오 API 자체의 호출 방식(설계)에 종속된 통합 계층의
//      관심사이지, placeMatchService(§레이어2 스코어링/케이스 분기)의 비즈니스 로직이
//      아니다 — 그쪽은 "이미 찾은 후보 집합을 어떻게 평가할지"만 순수 함수로 다룬다.
//   3. 이 재처리는 사진 업로드 시점의 실시간 타이핑 검색이 아니라(레이어1은 이미 완료),
//      백그라운드 재매칭 흐름이라 왕복이 다소 길어져도(최악 300m까지 3회 카카오 호출)
//      허용 가능하다.
// 명시적으로 radius를 지정해 호출하면 확장 없이 해당 반경 1회만 검색한다 — 이후 레이어
// (밀집 지역 재정렬 등)가 특정 반경을 고정해 호출하고 싶을 때를 위한 탈출구다.
//
// 캐싱: 지오해시 셀(geohash.ts, precision=7 ≈153m 격자) + 정규화된 검색어를 키로
// kakao_place_search_cache 테이블에 TTL 1일로 저장한다(스키마: supabase/migrations/
// 20260718000200_kakao_place_search_cache.sql). 이 테이블은 RLS로 클라이언트 접근이
// 전면 차단돼 있고 SERVICE_ROLE_KEY를 쓰는 이 함수만 읽고 쓴다 — 여러 커플이 같은 실제
// 장소(예: 같은 스타벅스 지점)를 검색할 때 카카오 무료 쿼터를 커플 간에도 공유 절약하기
// 위해 클라이언트 로컬 캐시(AsyncStorage)가 아닌 서버 공유 캐시로 설계했다.
//
// ── 레이어4 확장(date-recommend-architecture.md 레이어4 "이색 코스 추천") ──────────
// findNearbyAlternatives()가 "안 가본 카테고리로 주변을 둘러보기"를 하려면 카카오
// 카테고리 검색(키워드 없이 category_group_code + 좌표만으로 검색하는 별도 엔드포인트
// /v2/local/search/category.json)이 필요한데, 기존 이 함수는 키워드 검색
// (/v2/local/search/keyword.json)만 지원했다. category_group_code 파라미터가 오면
// 카테고리 검색 모드로 분기하도록 이 함수에 추가했다 — query 모드와는 별개 진입점이고
// 캐싱/CORS/에러 응답 형식은 동일하게 재사용한다. 카테고리 모드는 "이 카테고리의 장소를
// 최대한 둘러보기"가 목적이라(레이어2의 "특정 이름의 장소 하나를 찾기"와 달리) 50→150→300m
// 반경 확장을 적용하지 않는다 — 대신 고정 기본 반경(1km, 카테고리 브라우징에 적당한
// 동네 스케일)으로 단일 검색하고, 필요하면 호출부가 radius로 직접 조절한다.
import { createClient } from '@supabase/supabase-js';
import { encodeGeohash } from './geohash.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RADIUS_STEPS_METERS = [50, 150, 300];
const DEFAULT_CATEGORY_RADIUS_METERS = 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const GEOHASH_PRECISION = 7;

interface KakaoDocument {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  distance: string;
  place_url: string;
}

async function searchKakaoByKeyword(query: string, lat: number, lng: number, radius: number): Promise<KakaoDocument[]> {
  const apiKey = Deno.env.get('KAKAO_REST_API_KEY');
  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  url.searchParams.set('query', query);
  url.searchParams.set('x', String(lng));
  url.searchParams.set('y', String(lat));
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('sort', 'distance');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`카카오 로컬 API 오류(${response.status}): ${err}`);
  }

  const data = await response.json();
  return (data.documents ?? []) as KakaoDocument[];
}

async function searchKakaoByCategory(
  categoryGroupCode: string,
  lat: number,
  lng: number,
  radius: number,
): Promise<KakaoDocument[]> {
  const apiKey = Deno.env.get('KAKAO_REST_API_KEY');
  const url = new URL('https://dapi.kakao.com/v2/local/search/category.json');
  url.searchParams.set('category_group_code', categoryGroupCode);
  url.searchParams.set('x', String(lng));
  url.searchParams.set('y', String(lat));
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('sort', 'distance');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`카카오 로컬 API 오류(${response.status}): ${err}`);
  }

  const data = await response.json();
  return (data.documents ?? []) as KakaoDocument[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, categoryGroupCode, lat, lng, radius } = await req.json();

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return new Response(
        JSON.stringify({ error: 'lat, lng가 필요합니다' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (query && categoryGroupCode) {
      return new Response(
        JSON.stringify({ error: 'query와 categoryGroupCode는 동시에 지정할 수 없습니다' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!query && !categoryGroupCode) {
      return new Response(
        JSON.stringify({ error: 'query 또는 categoryGroupCode 중 하나가 필요합니다' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── 카테고리 검색 모드 ─────────────────────────────────────────────────────
    if (categoryGroupCode) {
      const categoryRadius = typeof radius === 'number' ? radius : DEFAULT_CATEGORY_RADIUS_METERS;
      const geohashCell = encodeGeohash(lat, lng, GEOHASH_PRECISION);
      const cacheKey = `${geohashCell}:cat:${categoryGroupCode}:${categoryRadius}`;

      const { data: cached } = await supabase
        .from('kakao_place_search_cache')
        .select('results, radius_used, expires_at')
        .eq('cache_key', cacheKey)
        .maybeSingle();

      if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
        return new Response(
          JSON.stringify({ documents: cached.results, radiusUsed: cached.radius_used, cached: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const documents = await searchKakaoByCategory(categoryGroupCode, lat, lng, categoryRadius);

      await supabase.from('kakao_place_search_cache').upsert(
        {
          cache_key: cacheKey,
          geohash_cell: geohashCell,
          query_text: `category:${categoryGroupCode}`,
          radius_used: categoryRadius,
          results: documents,
          cached_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        },
        { onConflict: 'cache_key' },
      );

      return new Response(
        JSON.stringify({ documents, radiusUsed: categoryRadius, cached: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 키워드 검색 모드(기존 로직 그대로) ──────────────────────────────────────
    const normalizedQuery = String(query).trim().toLowerCase();
    if (!normalizedQuery) {
      return new Response(
        JSON.stringify({ error: 'query가 비어 있습니다' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 명시적 radius가 오면 캐시/확장 없이 단일 반경 검색만 수행한다(위 헤더 주석 참고).
    if (typeof radius === 'number') {
      const documents = await searchKakaoByKeyword(normalizedQuery, lat, lng, radius);
      return new Response(
        JSON.stringify({ documents, radiusUsed: radius, cached: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const geohashCell = encodeGeohash(lat, lng, GEOHASH_PRECISION);
    const cacheKey = `${geohashCell}:${normalizedQuery}`;

    const { data: cached } = await supabase
      .from('kakao_place_search_cache')
      .select('results, radius_used, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      return new Response(
        JSON.stringify({ documents: cached.results, radiusUsed: cached.radius_used, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let documents: KakaoDocument[] = [];
    let radiusUsed = RADIUS_STEPS_METERS[RADIUS_STEPS_METERS.length - 1];
    for (const step of RADIUS_STEPS_METERS) {
      documents = await searchKakaoByKeyword(normalizedQuery, lat, lng, step);
      if (documents.length > 0) {
        radiusUsed = step;
        break;
      }
    }

    // 캐시 쓰기 실패는 검색 결과 응답 자체를 막을 이유가 없으므로 별도 처리하지 않고
    // upsert 에러는 무시한다(캐시는 최적화일 뿐 정합성에 필수가 아님).
    await supabase.from('kakao_place_search_cache').upsert(
      {
        cache_key: cacheKey,
        geohash_cell: geohashCell,
        query_text: normalizedQuery,
        radius_used: radiusUsed,
        results: documents,
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      },
      { onConflict: 'cache_key' },
    );

    return new Response(
      JSON.stringify({ documents, radiusUsed, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
