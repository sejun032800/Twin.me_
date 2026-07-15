-- ============================================================
-- couple_dna_results — 연애 DNA v2.1 궁합 결과 저장
-- 2026-07-15
-- 근거: docs/spec/Twin.me_연애DNA_구현명세서.md §4.2, v2.1 §12-13
-- couple_id는 20260711000000_initial_schema.sql이 정의한 couples.id(UUID,
-- gen_random_uuid() 기본값)를 참조한다 — 이 저장소에 이미 커밋된 스키마를
-- 직접 확인해 FK 타입을 맞췄다(라이브 프로젝트에 대한 `supabase db pull`은
-- 이 환경에 접근 토큰이 없어 실행하지 못했으나, couples 테이블 자체가 이미
-- 이 마이그레이션 디렉터리에 존재해 별도 확인이 필요하지 않았다).
-- calibration_version을 반드시 태깅해, 향후 μ̂/σ̂/M행렬/앵커행렬이 갱신되어도
-- 과거 결과를 재현/비교할 수 있게 한다.
-- Phase 1 — 이 테이블은 아직 어떤 코드에서도 읽거나 쓰지 않는다(신규 생성만).
-- ============================================================

CREATE TABLE IF NOT EXISTS couple_dna_results (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id            UUID REFERENCES couples(id) ON DELETE CASCADE NOT NULL,

  -- v2.1 §12 식(10) — clamp(75 + k·z, 50, 100)
  dna_pct              DOUBLE PRECISION NOT NULL CHECK (dna_pct >= 50 AND dna_pct <= 100),
  -- v2.1 §11 네 부분점수 — DNA% 기여도 분해 UI에 사용(구현명세서 §10 DoD)
  s_b5                 DOUBLE PRECISION NOT NULL,
  s_en                 DOUBLE PRECISION NOT NULL,
  s_st                 DOUBLE PRECISION NOT NULL,
  s_att                DOUBLE PRECISION NOT NULL,

  calibration_version  TEXT NOT NULL DEFAULT 'v2.1',
  computed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE couple_dna_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "커플 멤버만 조회" ON couple_dna_results
  FOR SELECT USING (
    couple_id IN (
      SELECT id FROM couples
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_couple_dna_results_couple_id ON couple_dna_results(couple_id);
