-- ============================================================
-- date_courses — kakao_place_id 참조 컬럼 추가
-- 2026-07-18
-- 근거: docs/date-recommend-architecture.md 레이어 3 — "date_courses는 기존
-- 테이블 유지, kakao_place_id 참조 컬럼만 추가". 레이어4(findNearbyAlternatives)가
-- place_id 기준 dedup을 요구하므로(문자열 이름 dedup은 표기 차이로 중복 누락
-- 위험이 있어 금지), 코스에 담긴 장소를 카카오 장소 ID로 명확히 식별해야 한다.
--
-- 기존 date_courses.places(JSONB)는 이미 자유 형식 장소 배열을 담고 있어 이
-- 컬럼과 별개다 — kakao_place_id는 코스의 "대표 장소"(예: 코스 담기 시 기준이
-- 된 첫 스탬프의 매칭 결과)를 가리키는 단일 참조로, JSONB 내부 각 장소의
-- place_id를 대체하지 않는다. 로컬 테이블 FK가 아닌 외부 API의 문자열 ID이므로
-- REFERENCES 제약은 걸지 않는다(kakao_place_id는 이 스키마 안의 어떤 테이블도
-- 아닌 카카오 로컬 API 응답의 id 필드를 가리킨다).
-- ============================================================

ALTER TABLE date_courses ADD COLUMN IF NOT EXISTS kakao_place_id TEXT;
