# Supabase 스키마 감사 (2026-07-11)

코드베이스 전체를 스캔해 Supabase 관련 파일과 스키마 정의를 파악한 결과.

## 1. `supabase/migrations/` — 디렉토리 자체가 없음

`supabase/` 아래에는 마이그레이션 SQL 파일이 전혀 없다. 실제 내용물:

```
supabase/config.toml
supabase/functions/llm-route/{deno.json, .npmrc, index.ts}
supabase/functions/delete-account/{deno.json, index.ts}
supabase/.temp/...  (CLI 캐시 파일들)
```

## 2. `supabase/schema.sql` — 존재하지 않음

리포지토리 전체에서 `*.sql` 파일을 검색했지만 한 건도 없다.

## 3. `src/lib/supabaseClient.ts` (`src/api/supabase.ts`는 없음)

```ts
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] 환경변수 미설정 — .env 파일을 확인하세요.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## 4. `src/services/` 중 Supabase 쿼리를 포함하는 파일 (3개)

`src/services/` 전체 17개 파일을 grep했고, `supabase` import + 쿼리가 있는 파일은 아래 3개뿐이다. 나머지(`aiMuseService`, `billingTrackerService`, `coachingService`, `kakaoIngestPipeline`, `kakaoBatchDetectionService`, `masterQuestionService`, `memoryMapService`, `notificationService`, `ootdService`, `partnerSensitiveService`, `vipPromotionService`, `weatherService`, `weeklyReportService`, `wrappedService`, `iapService`)는 Supabase를 사용하지 않는다.

### `src/services/coupleService.ts` (전체)

```ts
// ─── Couple Service — 초대 코드 생성/검증 (Supabase couples 테이블) ─────────────
// docs/Twin_me_MASTER_v2.6.md §3 커플 연동. 테이블 스키마/RLS 정책은 Supabase
// 콘솔에서 별도 실행이 필요하다 — 이 파일의 함수들은 couples 테이블이 존재해야 동작한다.

import { supabase } from '@/lib/supabaseClient';

export async function createCouple(inviteCode: string, creatorId: string): Promise<string> {
  const { data, error } = await supabase
    .from('couples')
    .insert({ invite_code: inviteCode, creator_id: creatorId })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '초대 코드 생성에 실패했어요.');
  }

  return data.id as string;
}

export async function joinCouple(
  inviteCode: string,
  partnerId: string,
): Promise<{ coupleId: string; creatorId: string }> {
  const { data: couple, error: fetchError } = await supabase
    .from('couples')
    .select('id, creator_id, partner_id')
    .eq('invite_code', inviteCode)
    .single();

  if (fetchError || !couple) {
    throw new Error('유효하지 않은 초대 코드예요.');
  }

  if (couple.partner_id) {
    throw new Error('이미 연동된 코드입니다');
  }

  const { error: updateError } = await supabase
    .from('couples')
    .update({ partner_id: partnerId, connected_at: new Date().toISOString() })
    .eq('id', couple.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { coupleId: couple.id as string, creatorId: couple.creator_id as string };
}
```

**참고:** `couples` 테이블의 `CREATE TABLE` 문은 코드/문서 어디에도 없음 (콘솔에서 수동 생성 추정). 사용 컬럼: `id`, `invite_code`, `creator_id`, `partner_id`, `connected_at`.

### `src/services/dateCourseService.ts` (전체)

```ts
// ─── FUN-HIS-002 — 인기 데이트코스 피드 (MASTER.md §7) ────────────────────────
// Supabase date_courses 테이블에서 공개 코스를 가져온다. 아래 SQL을 Supabase 콘솔
// (SQL Editor)에서 먼저 실행해야 실제 데이터가 조회된다 — 실행 전까지, 혹은 조회
// 실패 시에는 MOCK_COURSES로 폴백한다.
//
// CREATE TABLE date_courses (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,
//   title TEXT NOT NULL,
//   area TEXT,
//   places JSONB DEFAULT '[]',
//   tags TEXT[] DEFAULT '{}',
//   my_score DECIMAL(2,1),
//   partner_score DECIMAL(2,1),
//   review TEXT,
//   is_public BOOLEAN DEFAULT false,
//   likes INTEGER DEFAULT 0,
//   tier_emoji TEXT,
//   tier_name TEXT,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// ALTER TABLE date_courses ENABLE ROW LEVEL SECURITY;
//
// CREATE POLICY "공개 코스 전체 조회" ON date_courses
//   FOR SELECT USING (is_public = true);
//
// CREATE POLICY "본인 코스 관리" ON date_courses
//   FOR ALL USING (
//     couple_id IN (
//       SELECT id FROM couples
//       WHERE creator_id = auth.uid() OR partner_id = auth.uid()
//     )
//   );

import { supabase } from '@/lib/supabaseClient';

export interface DateCoursePlace {
  name: string;
  emoji: string;
}

export interface DateCourse {
  id: string;
  title: string;
  area: string;
  places: DateCoursePlace[];
  tags: string[];
  myScore: number;
  partnerScore: number;
  review: string;
  tierEmoji: string;
  tierName: string;
  likes: number;
}

const MOCK_COURSES: DateCourse[] = [
  {
    id: '1',
    tierEmoji: '🏆',
    tierName: '환상 속의 신화적 결합',
    title: '경리단길 와인 데이트',
    area: '경리단길',
    places: [
      { emoji: '🍷', name: '경리단길 와인바' },
      { emoji: '🗼', name: 'N서울타워' },
      { emoji: '☕', name: '해방촌 루프탑' },
    ],
    tags: ['시크', '로맨틱', '차분함'],
    myScore: 4.9,
    partnerScore: 5.0,
    review: '조용히 우리 얘기만 할 수 있어서 좋았어요.',
    likes: 128,
  },
  {
    id: '2',
    tierEmoji: '✨',
    tierName: '다정다감한 모범 커플',
    title: '홍대 쇼핑 & 맛집 투어',
    area: '홍대',
    places: [
      { emoji: '☕', name: '카페 골목' },
      { emoji: '👗', name: '무신사 스탠다드' },
      { emoji: '🥩', name: '연남동 돼지고기' },
    ],
    tags: ['페미닌', '캐주얼', '힐링'],
    myScore: 4.5,
    partnerScore: 4.7,
    review: '쇼핑하고 맛있는 것까지 먹으니 하루가 꽉 찼어요.',
    likes: 96,
  },
  {
    id: '3',
    tierEmoji: '💎',
    tierName: '눈빛만 봐도 아는 사이',
    title: '성수동 팝업 산책',
    area: '성수동',
    places: [
      { emoji: '🎪', name: '성수 팝업' },
      { emoji: '🏭', name: '카페 할아버지공장' },
      { emoji: '🌿', name: '뚝섬 한강' },
    ],
    tags: ['힙한', '감성', '여유'],
    myScore: 4.8,
    partnerScore: 4.6,
    review: '사진 찍을 곳이 많아서 종일 웃으면서 걸었어요.',
    likes: 84,
  },
];

interface DateCourseRow {
  id: string;
  title: string;
  area: string | null;
  places: DateCoursePlace[] | null;
  tags: string[] | null;
  my_score: number | null;
  partner_score: number | null;
  review: string | null;
  tier_emoji: string | null;
  tier_name: string | null;
  likes: number | null;
}

function rowToDateCourse(row: DateCourseRow): DateCourse {
  return {
    id: row.id,
    title: row.title,
    area: row.area ?? '',
    places: row.places ?? [],
    tags: row.tags ?? [],
    myScore: row.my_score ?? 0,
    partnerScore: row.partner_score ?? 0,
    review: row.review ?? '',
    tierEmoji: row.tier_emoji ?? '✨',
    tierName: row.tier_name ?? '',
    likes: row.likes ?? 0,
  };
}

export interface PublicCoursesResult {
  courses: DateCourse[];
  isMock: boolean;
}

export async function getPublicCourses(): Promise<PublicCoursesResult> {
  try {
    const { data, error } = await supabase
      .from('date_courses')
      .select('*')
      .eq('is_public', true)
      .order('likes', { ascending: false })
      .limit(20);

    if (error || !data) return { courses: MOCK_COURSES, isMock: true };
    return { courses: (data as DateCourseRow[]).map(rowToDateCourse), isMock: false };
  } catch {
    return { courses: MOCK_COURSES, isMock: true };
  }
}
```

### `src/services/partnerMoodService.ts` (전체)

```ts
// ─── FUN-HOM-002 — 파트너 무드 서비스 (MASTER.md §3, 구버전 partnerMoodService.ts 이식) ─
// 연인이 앱에서 설정한 현재 무드를 Supabase partner_moods 테이블에 기록/조회한다.
// 아래 SQL을 Supabase 콘솔(SQL Editor)에서 먼저 실행해야 실제 데이터가 동작한다.
//
// CREATE TABLE partner_moods (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
//   couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,
//   mood_emoji TEXT NOT NULL,
//   mood_text TEXT NOT NULL,
//   created_at TIMESTAMPTZ DEFAULT NOW(),
//   expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
// );
//
// ALTER TABLE partner_moods ENABLE ROW LEVEL SECURITY;
//
// CREATE POLICY "커플 멤버만 조회" ON partner_moods
//   FOR SELECT USING (
//     couple_id IN (
//       SELECT id FROM couples
//       WHERE creator_id = auth.uid() OR partner_id = auth.uid()
//     )
//   );
//
// CREATE POLICY "본인 무드만 등록" ON partner_moods
//   FOR INSERT WITH CHECK (auth.uid() = user_id);

import { supabase } from '@/lib/supabaseClient';

export interface PartnerMood {
  emoji: string;
  text: string;
  expiresAt: string;
}

export const MOOD_OPTIONS = [
  { emoji: '😊', text: '행복해' },
  { emoji: '😴', text: '피곤해' },
  { emoji: '😤', text: '짜증나' },
  { emoji: '🥰', text: '보고싶어' },
  { emoji: '😰', text: '걱정돼' },
  { emoji: '🎉', text: '신나' },
  { emoji: '😢', text: '슬퍼' },
  { emoji: '😌', text: '평온해' },
];

interface PartnerMoodRow {
  mood_emoji: string;
  mood_text: string;
  expires_at: string;
}

export async function setMyMood(
  emoji: string,
  text: string,
  coupleId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('partner_moods').insert({
    user_id: userId,
    couple_id: coupleId,
    mood_emoji: emoji,
    mood_text: text,
  });

  if (error) throw new Error(`무드 저장 실패: ${error.message}`);
}

export async function getPartnerMood(coupleId: string, myUserId: string): Promise<PartnerMood | null> {
  try {
    const { data, error } = await supabase
      .from('partner_moods')
      .select('mood_emoji, mood_text, expires_at')
      .eq('couple_id', coupleId)
      .neq('user_id', myUserId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as PartnerMoodRow;
    return { emoji: row.mood_emoji, text: row.mood_text, expiresAt: row.expires_at };
  } catch {
    return null;
  }
}
```

---

## 요약: 코드베이스가 파악하는 스키마 전체 (테이블 3개, 전부 주석에만 존재)

| 테이블 | CREATE TABLE 실존 위치 | RLS | 참조 서비스 |
|---|---|---|---|
| `couples` | 없음 (어디에도 정의 안 됨) | 불명 | coupleService.ts |
| `date_courses` | dateCourseService.ts 주석 | 있음 (2 정책) | dateCourseService.ts |
| `partner_moods` | partnerMoodService.ts 주석 | 있음 (2 정책) | partnerMoodService.ts |

즉 실제 마이그레이션 파일로 관리되는 스키마는 없고, 각 서비스 파일 상단 주석에 "Supabase 콘솔에서 수동 실행" 전제의 SQL이 조각조각 흩어져 있는 상태다. `couples` 테이블은 그 주석조차 없어 스키마 정의가 코드베이스 어디에도 없다.
