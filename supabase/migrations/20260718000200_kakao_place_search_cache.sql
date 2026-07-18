-- ============================================================
-- kakao_place_search_cache — 카카오 로컬 API 검색 결과 캐시 (레이어2)
-- 2026-07-18
-- 근거: docs/date-recommend-architecture.md 레이어2 부가 장치 — "지오해시 셀(≈50m
-- 격자)+카테고리 기준, TTL 1일 — 카카오 무료 쿼터 절약". supabase/functions/
-- kakao-local-search/index.ts가 geohash_cell + 정규화된 검색어를 cache_key로 써서
-- 이 테이블을 읽고 쓴다.
--
-- 서버 공유 캐시로 설계한 이유: 여러 커플이 같은 실제 장소(예: 같은 스타벅스 지점)를
-- 검색하는 일이 흔하므로, 클라이언트 로컬 캐시(AsyncStorage)로는 커플 간 쿼터 절약
-- 효과가 없다. Edge Function이 SERVICE_ROLE_KEY로만 접근하므로 RLS는 켜두되 정책을
-- 하나도 만들지 않는다 — "정책 0개 = anon/authenticated 전면 차단"을 의도한 것이며,
-- service role은 RLS를 우회하므로 Edge Function 접근에는 영향이 없다. 과거 audit에서
-- RLS 정책 누락이 이슈였던 것과 반대로, 여기서는 "정책을 아예 열지 않는 것" 자체가
-- 의도된 보안 설계임을 명시적으로 남긴다.
-- ============================================================

CREATE TABLE IF NOT EXISTS kakao_place_search_cache (
  cache_key     TEXT PRIMARY KEY,
  geohash_cell  TEXT NOT NULL,
  query_text    TEXT NOT NULL,
  radius_used   INTEGER NOT NULL,
  results       JSONB NOT NULL,
  cached_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 day')
);

ALTER TABLE kakao_place_search_cache ENABLE ROW LEVEL SECURITY;
-- 의도적으로 정책 없음 — 클라이언트(anon/authenticated)는 select/insert/update/delete
-- 전부 차단된다. kakao-local-search Edge Function만 SERVICE_ROLE_KEY로 접근한다.

CREATE INDEX IF NOT EXISTS idx_kakao_place_search_cache_expires_at ON kakao_place_search_cache(expires_at);
