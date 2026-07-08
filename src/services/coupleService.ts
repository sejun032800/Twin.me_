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
