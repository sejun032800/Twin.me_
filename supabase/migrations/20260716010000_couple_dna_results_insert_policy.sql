-- ============================================================
-- couple_dna_results — 커플 멤버 INSERT 허용 (Phase 5.5)
-- 2026-07-16
-- 근거: docs/audit/통합감사_2026-07-16.md §2/§3 — GenesisV21Screen이 계산한
-- 연애 DNA 결과를 실제로 이 테이블에 기록하려면 SELECT 정책뿐 아니라 INSERT
-- 정책이 필요하다. 기존 20260715120200_couple_dna_results.sql 마이그레이션은
-- "커플 멤버만 조회" SELECT 정책만 만들고 INSERT 정책을 빠뜨려서, RLS가 켜진
-- 상태에서 클라이언트 INSERT가 전부 거부되는 상태였다(신규 발견, 조기 수정 아님
-- — 원래 그 마이그레이션이 실제로 배포된 적조차 없었으므로 아직 아무도 영향받지 않음).
-- 이 테이블은 couple_id에 UNIQUE 제약이 없어(과거 결과 재현/비교 목적, 원본 마이그레이션
-- 주석 참고) 매번 새 행을 append하는 이력 로그로 설계돼 있다 — 그래서 진짜 upsert가
-- 아니라 INSERT만 허용하고, 조회 측(dnaResultService.getLatestCoupleDnaResult)이
-- computed_at DESC LIMIT 1로 최신 결과만 골라 읽는다.
-- ============================================================

CREATE POLICY "커플 멤버만 기록" ON couple_dna_results
  FOR INSERT WITH CHECK (
    couple_id IN (
      SELECT id FROM couples
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );
