-- ============================================================
-- interview_sessions — 적응형 인터뷰 턴 단위 로그
-- 2026-07-15
-- 근거: docs/spec/Twin.me_연애DNA_구현명세서.md §4.2, v2.1 §5(그리디 선택)/§8(베이지안 갱신)
-- 턴마다 "무엇을 물었고(target_dimension), 무엇을 관측했고(parsed_value/confidence),
-- 불확실성이 어떻게 줄었는지(entropy_before/after)"를 손실 없이 기록한다 — v2.1 §16
-- 한계 2가 요구하는 재캘리브레이션 원자재. 이 로그는 반드시 영구 보존한다(삭제 정책 없음).
-- Phase 1 — 이 테이블은 아직 어떤 코드에서도 읽거나 쓰지 않는다(신규 생성만).
-- ============================================================

CREATE TABLE IF NOT EXISTS interview_sessions (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- 인터뷰 1회 진행 전체를 묶는 세션 식별자(재개 가능한 세션의 키)
  session_id         UUID NOT NULL,
  user_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  -- 세션 내 턴 순서(0부터) — 스트리밍 갱신 순서 재구성에 필요
  turn_index         INTEGER NOT NULL,

  question_id        TEXT NOT NULL,
  -- v2.1 §5 불확실성 지표의 대상 차원(O,C,E,A,N,anx,avo,enneagram_core 중 하나)
  target_dimension   TEXT NOT NULL,

  raw_response_text  TEXT,
  -- Gemini 파싱 결과 — 구현명세서 §6 JSON 계약의 normalized_value/confidence
  parsed_value        DOUBLE PRECISION,
  confidence          DOUBLE PRECISION,

  -- v2.1 §5 정규화 불확실성 지표 — 이 턴 전/후 값(그리디 선택 검증·재캘리브레이션용)
  entropy_before      DOUBLE PRECISION,
  entropy_after       DOUBLE PRECISION,

  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 세션 로그만 조회" ON interview_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 세션 로그만 기록" ON interview_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_session_id ON interview_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON interview_sessions(user_id);
