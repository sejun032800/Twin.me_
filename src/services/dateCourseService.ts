// ─── FUN-HIS-002 — 인기 데이트코스 피드 (MASTER.md §7) ────────────────────────
// 조회 실패 시에는 MOCK_COURSES로 폴백한다.
// 스키마: supabase/migrations/20260711000000_initial_schema.sql — date_courses 테이블

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
