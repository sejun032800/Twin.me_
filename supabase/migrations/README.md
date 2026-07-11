# Twin.me Supabase 마이그레이션

## 초기 실행 방법

### 방법 A — Supabase 콘솔 (권장, 현재)
1. Supabase 대시보드 → SQL Editor
2. `20260711000000_initial_schema.sql` 전체 복사 후 실행

### 방법 B — CLI
```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

## 테이블 구조

| 테이블 | 설명 | RLS |
|---|---|---|
| couples | 커플 연동 (초대 코드 기반) | ✅ |
| date_courses | 데이트 코스 피드 | ✅ |
| partner_moods | 파트너 무드 (24h TTL) | ✅ |

## 주의사항
- couples 테이블이 date_courses, partner_moods의 상위 참조이므로 반드시 먼저 생성
- partner_moods 만료 레코드는 자동 삭제되지 않음 — 주기적 수동 정리 또는 pg_cron 필요
