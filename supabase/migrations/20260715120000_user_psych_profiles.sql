-- ============================================================
-- user_psych_profiles — 연애 DNA v2.1 심리 프로파일 영구 저장
-- 2026-07-15
-- 근거: docs/spec/연애_DNA_일치율_공식_v2.1.md §1(표기법), §16 한계 2
--   ("실사용자 데이터가 쌓이면 각 차원의 실제 예측오차 분산으로 재보정해야 한다")
--   — 원시 사후분포 값을 손실 없이 영구 보존해야 향후 σ_prior/앵커행렬/M행렬
--   재캘리브레이션이 가능하다.
-- 감사표(docs/audit/폐기_수정_항목_감사표.md)가 지적한 대로, 기존에는 심리
-- 프로파일이 AsyncStorage(zustand persist)로만 로컬 저장되어 서버 영속화가
-- 전혀 없었다 — 이 테이블이 그 최초의 서버측 저장소다.
-- Phase 1 — 이 테이블은 아직 어떤 코드에서도 읽거나 쓰지 않는다(신규 생성만).
-- ============================================================

CREATE TABLE IF NOT EXISTS user_psych_profiles (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Big Five 사후값 — v2.1 §1 `b = (O,C,E,A,N) ∈ [0,1]⁵`
  big5_o                DOUBLE PRECISION,
  big5_c                DOUBLE PRECISION,
  big5_e                DOUBLE PRECISION,
  big5_a                DOUBLE PRECISION,
  big5_n                DOUBLE PRECISION,

  -- 애착 사후값 — v2.1 §1 `ψ = (anx, avo)`
  attachment_anxiety    DOUBLE PRECISION,
  attachment_avoidance  DOUBLE PRECISION,

  -- 애니어그램 코어 사후확률 — v2.1 §1 `p ∈ Δ⁹` (길이 9 배열, JSON 손실 없이 보존)
  enneagram_core        JSONB,
  -- 애니어그램 코어×날개 결합확률 — v2.1 §1 `q ∈ Δ¹⁸`, key="{core}w{wing}"
  enneagram_wing_joint  JSONB,

  -- 스턴버그 관계상태 직답(§7 고정 3문항) — 커플 연결 전엔 NULL(관계 특이적)
  sternberg_intimacy    DOUBLE PRECISION,
  sternberg_passion     DOUBLE PRECISION,
  sternberg_commitment  DOUBLE PRECISION,

  -- MBTI 축 재추정 — v2.1 §10 보너스, 궁합 계산에는 관여하지 않는 UI 전용 출력
  mbti_estimated        JSONB,

  -- 인터뷰 메타 — v2.1 §4~§6
  interview_completed_at     TIMESTAMPTZ,
  interview_turns_used       INTEGER,
  interview_elapsed_seconds  INTEGER,
  interview_stop_reason      TEXT CHECK (
    interview_stop_reason IN ('time_cap', 'entropy_threshold', 'min_turns_satisfied')
  ),
  -- μ̂/σ̂/M행렬/앵커행렬 등이 향후 갱신되어도 과거 결과를 재현/비교할 수 있도록 태깅
  calibration_version   TEXT NOT NULL DEFAULT 'v2.1',

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_psych_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 프로파일만 조회" ON user_psych_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 프로파일만 기록/갱신" ON user_psych_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_psych_profiles_user_id ON user_psych_profiles(user_id);
