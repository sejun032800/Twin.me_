// ─── FUN-HOM-002 — 파트너 무드 서비스 (MASTER.md §3, 구버전 partnerMoodService.ts 이식) ─
// 연인이 앱에서 설정한 현재 무드를 Supabase partner_moods 테이블에 기록/조회한다.
// 스키마: supabase/migrations/20260711000000_initial_schema.sql — partner_moods 테이블

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
