-- ============================================================
-- Twin.me Initial Schema
-- 2026-07-11
-- Supabase SQL Editor 또는 supabase db push 로 실행
-- ============================================================

-- ─── 확장 ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. couples ──────────────────────────────────────────────
-- coupleService.ts가 참조하는 컬럼을 코드에서 역추적해 정의
-- 컬럼: id, invite_code, creator_id, partner_id, connected_at
CREATE TABLE IF NOT EXISTS couples (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_code   TEXT NOT NULL UNIQUE,
  creator_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  partner_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE couples ENABLE ROW LEVEL SECURITY;

-- 본인이 속한 커플만 조회 가능
CREATE POLICY "커플 멤버 조회" ON couples
  FOR SELECT USING (
    creator_id = auth.uid() OR partner_id = auth.uid()
  );

-- 커플 생성은 본인만
CREATE POLICY "커플 생성" ON couples
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- 커플 업데이트(파트너 연동)는 커플 멤버만
CREATE POLICY "커플 업데이트" ON couples
  FOR UPDATE USING (
    creator_id = auth.uid() OR partner_id = auth.uid()
  );

-- ─── 2. date_courses ─────────────────────────────────────────
-- dateCourseService.ts 주석에서 추출
CREATE TABLE IF NOT EXISTS date_courses (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id      UUID REFERENCES couples(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  area           TEXT,
  places         JSONB DEFAULT '[]',
  tags           TEXT[] DEFAULT '{}',
  my_score       DECIMAL(2,1),
  partner_score  DECIMAL(2,1),
  review         TEXT,
  is_public      BOOLEAN DEFAULT false,
  likes          INTEGER DEFAULT 0,
  tier_emoji     TEXT,
  tier_name      TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE date_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "공개 코스 전체 조회" ON date_courses
  FOR SELECT USING (is_public = true);

CREATE POLICY "본인 코스 관리" ON date_courses
  FOR ALL USING (
    couple_id IN (
      SELECT id FROM couples
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

-- ─── 3. partner_moods ────────────────────────────────────────
-- partnerMoodService.ts 주석에서 추출
CREATE TABLE IF NOT EXISTS partner_moods (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  couple_id   UUID REFERENCES couples(id) ON DELETE CASCADE,
  mood_emoji  TEXT NOT NULL,
  mood_text   TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

ALTER TABLE partner_moods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "커플 멤버만 조회" ON partner_moods
  FOR SELECT USING (
    couple_id IN (
      SELECT id FROM couples
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

CREATE POLICY "본인 무드만 등록" ON partner_moods
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 만료된 무드 자동 정리 (Supabase pg_cron 또는 Edge Function에서 호출)
-- DELETE FROM partner_moods WHERE expires_at < NOW();
