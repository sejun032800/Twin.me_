-- ============================================================
-- user_psych_profiles — 커플 상대방 프로파일 SELECT 허용
-- 2026-07-16
-- 근거: docs/spec/phase2_재시작_현황.md Task #14
-- 기존 "본인 프로파일만 조회" 정책(20260715120000_user_psych_profiles.sql)은
-- 그대로 두고, permissive RLS의 OR 합성 특성을 이용해 커플 상대방 조회를
-- 허용하는 정책을 추가만 한다. computeRomanticDnaV21이 파트너 프로필을
-- 조회하려면 이 정책이 필요하다(Phase 3, GenesisV21Screen).
-- ============================================================

CREATE POLICY "커플 상대방 프로파일 조회" ON user_psych_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM couples c
      WHERE (c.creator_id = auth.uid() AND c.partner_id = user_psych_profiles.user_id)
         OR (c.partner_id = auth.uid() AND c.creator_id = user_psych_profiles.user_id)
    )
  );
