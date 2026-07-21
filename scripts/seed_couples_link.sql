-- ============================================================
-- 일회성 데모 데이터 준비 — 테스트 계정 A/B의 couples 연동을 SQL Editor에서
-- 직접 강제한다 (DB 레벨, RLS 우회 — SQL Editor는 postgres 소유자 권한으로
-- 실행되므로 앱의 "커플 업데이트" RLS 정책과 무관하게 안전하게 작동한다).
--
-- ⚠️ 참고: 코드 감사 중 couples 테이블의 "커플 업데이트" UPDATE RLS 정책
-- (creator_id = auth.uid() OR partner_id = auth.uid())이 자기 자신을 가리키는
-- 조건이라, 아직 partner_id가 비어 있는 row에 "새로 합류하는 쪽"이 update를
-- 시도하면 RLS가 이미 창을 지나기도 전이라 실제로 0행 갱신 + 무오류로 조용히
-- 실패할 가능성이 있습니다(앱의 joinCouple()이 update 후 error만 확인하고
-- 영향받은 행 수는 확인하지 않음). 즉 이전에 앱에서 "연동 완료" Alert가 떴어도
-- 실제 DB엔 반영 안 됐을 수 있으니, 아래 2번 쿼리로 먼저 실제 상태를 확인하세요.
-- 이 문제 자체는 이번 작업 범위 밖이라 별도로 고치지 않았습니다.
-- ============================================================

-- 1) 테스트 계정 A/B의 user id 확인 — 이메일을 실제 값으로 바꿔서 실행
select id, email from auth.users
where email in ('A_TEST_ACCOUNT_EMAIL', 'B_TEST_ACCOUNT_EMAIL');

-- 위 결과에서 나온 id를 아래 A_USER_ID / B_USER_ID 자리에 그대로 붙여넣고
-- 2)~4)를 순서대로 실행하세요.

-- 2) 현재 실제 연동 상태 확인 (앱 UI가 보여준 "연동 완료"와 무관하게 진짜 DB 상태)
select id, creator_id, partner_id, connected_at
from couples
where creator_id in ('A_USER_ID', 'B_USER_ID')
   or partner_id in ('A_USER_ID', 'B_USER_ID');

-- 3) 연동 강제 적용
--    3-a) 위 2)에서 A_USER_ID가 creator_id인 row가 이미 있고 partner_id가 비어 있으면:
update couples
set partner_id = 'B_USER_ID', connected_at = now()
where creator_id = 'A_USER_ID' and partner_id is null;

--    3-b) 2)에서 A/B 관련 row가 아예 없으면(둘 다 아직 초대코드를 안 만든 경우):
insert into couples (invite_code, creator_id, partner_id, connected_at)
values (upper(substr(md5(random()::text), 1, 8)), 'A_USER_ID', 'B_USER_ID', now());

-- 4) 검증 — partner_id가 정확히 채워졌는지 최종 확인
select id, creator_id, partner_id, connected_at
from couples
where creator_id = 'A_USER_ID' or partner_id = 'A_USER_ID';
