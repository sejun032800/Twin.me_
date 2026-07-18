-- ============================================================
-- date_photo_stamps — 사진 기반 방문 스탬프 (FUN-HIS-006)
-- 2026-07-18
-- 근거: docs/Twin_me_MASTER_v2.7.md §7 FUN-HIS-002/006/007(v2.7.1),
-- docs/date-recommend-architecture.md 레이어 1~3.
-- 사진 업로드(EXIF 시간/GPS) + 사용자 상호명 입력을 카카오 로컬 API로 검증한
-- "방문 스탬프" 1건 = 사진 1장. 이후 레이어3(코스 클러스터링/여행 승격)과
-- 레이어4(후보군 생성)가 이 테이블을 읽는다 — unverified 스탬프는 레이어4에서
-- 반드시 제외해야 한다(FUN-HIS-006 본문).
--
-- taken_at/lat/lng를 NOT NULL로 강제하지 않는다: src/hooks/usePhotoMetadata.ts는
-- EXIF가 없는 사진에 대해 dateTaken/latitude/longitude를 모두 null로 반환하는
-- 기존 동작을 이미 갖고 있고(스텁이었던 locationName만 이번에 실구현화 대상),
-- 이 훅의 출력을 그대로 받아 적재하는 테이블이 그보다 더 엄격한 제약을 걸면
-- EXIF 없는 사진은 애초에 적재 자체가 불가능해진다.
-- ============================================================

CREATE TABLE IF NOT EXISTS date_photo_stamps (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id        UUID REFERENCES couples(id) ON DELETE CASCADE NOT NULL,
  photo_uri        TEXT NOT NULL,
  taken_at         TIMESTAMPTZ,
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  user_input_name  TEXT,
  kakao_place_id   TEXT,
  -- auto: 고신뢰 단독 자동확정 / user_confirmed: 분점 모호 후보 중 사용자 직접 선택
  -- / unverified: 매칭 실패(반경 확장 후에도 후보 없음) → 수동 주소 입력, 후보군 생성 제외
  confidence       TEXT NOT NULL DEFAULT 'unverified'
                     CHECK (confidence IN ('auto', 'user_confirmed', 'unverified')),
  category_code    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE date_photo_stamps ENABLE ROW LEVEL SECURITY;

-- 과거 audit에서 RLS 정책 누락 사례가 있었으므로(20260716010000 근거 주석 참고),
-- select/insert/update를 couple_id 기준으로 명시적으로 각각 작성한다.
CREATE POLICY "커플 멤버만 조회" ON date_photo_stamps
  FOR SELECT USING (
    couple_id IN (
      SELECT id FROM couples
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

CREATE POLICY "커플 멤버만 등록" ON date_photo_stamps
  FOR INSERT WITH CHECK (
    couple_id IN (
      SELECT id FROM couples
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

-- 재매칭 큐(매칭 실패 스탬프 주기적 재시도) 및 분점 모호 케이스의 사용자 직접
-- 선택 결과 반영을 위해 UPDATE 허용. WITH CHECK로 couple_id를 다른 커플로
-- 바꿔치기하는 것도 함께 차단한다.
CREATE POLICY "커플 멤버만 수정" ON date_photo_stamps
  FOR UPDATE USING (
    couple_id IN (
      SELECT id FROM couples
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  ) WITH CHECK (
    couple_id IN (
      SELECT id FROM couples
      WHERE creator_id = auth.uid() OR partner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_date_photo_stamps_couple_id ON date_photo_stamps(couple_id);
-- 하루/여행 단위 클러스터링(FUN-HIS-007)이 couple_id + taken_at 순으로 스캔한다.
CREATE INDEX IF NOT EXISTS idx_date_photo_stamps_couple_taken_at ON date_photo_stamps(couple_id, taken_at);
