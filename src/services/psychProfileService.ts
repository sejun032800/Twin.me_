// ─── Psych Profile Service — user_psych_profiles / interview_sessions (Phase 3) ─
// docs/spec/연애_DNA_일치율_공식_v2.1.md §4~§6, 구현명세서 §4.2.
// coupleService.ts 패턴 참고(supabase.from(...).select/insert/update, 에러는 throw).
// 스키마: supabase/migrations/20260715120000_user_psych_profiles.sql,
//         supabase/migrations/20260715120100_interview_sessions.sql,
//         supabase/migrations/20260716000000_user_psych_profiles_partner_select.sql
//         (getPartnerPsychProfile은 마지막 마이그레이션의 RLS 정책이 실제 배포돼야 동작한다)

import { supabase } from '@/lib/supabaseClient';
import type { PsychProfile } from '@/store/userStore';

interface PsychProfileRow {
  big5_o: number | null;
  big5_c: number | null;
  big5_e: number | null;
  big5_a: number | null;
  big5_n: number | null;
  attachment_anxiety: number | null;
  attachment_avoidance: number | null;
  enneagram_core: number[] | null;
  enneagram_wing_joint: Record<string, number> | null;
  sternberg_intimacy: number | null;
  sternberg_passion: number | null;
  sternberg_commitment: number | null;
  mbti_estimated: { pE: number; pN_axis: number; pF: number; pJ: number } | null;
  interview_completed_at: string | null;
  interview_turns_used: number | null;
  interview_elapsed_seconds: number | null;
  interview_stop_reason: PsychProfile['interviewMeta']['stopReason'];
  calibration_version: string;
}

function toRow(profile: PsychProfile): Omit<PsychProfileRow, 'calibration_version'> & { calibration_version: string } {
  return {
    big5_o: profile.big5.O,
    big5_c: profile.big5.C,
    big5_e: profile.big5.E,
    big5_a: profile.big5.A,
    big5_n: profile.big5.N,
    attachment_anxiety: profile.attachment.anxiety,
    attachment_avoidance: profile.attachment.avoidance,
    enneagram_core: profile.enneagramCore,
    enneagram_wing_joint: profile.enneagramWingJoint,
    sternberg_intimacy: profile.sternbergState?.intimacy ?? null,
    sternberg_passion: profile.sternbergState?.passion ?? null,
    sternberg_commitment: profile.sternbergState?.commitment ?? null,
    mbti_estimated: profile.mbtiEstimated,
    interview_completed_at: profile.interviewMeta.completedAt,
    interview_turns_used: profile.interviewMeta.turnsUsed,
    interview_elapsed_seconds: profile.interviewMeta.elapsedSeconds,
    interview_stop_reason: profile.interviewMeta.stopReason,
    calibration_version: profile.interviewMeta.calibrationVersion,
  };
}

function fromRow(row: PsychProfileRow): PsychProfile {
  return {
    big5: { O: row.big5_o ?? 0, C: row.big5_c ?? 0, E: row.big5_e ?? 0, A: row.big5_a ?? 0, N: row.big5_n ?? 0 },
    attachment: { anxiety: row.attachment_anxiety ?? 0, avoidance: row.attachment_avoidance ?? 0 },
    enneagramCore: row.enneagram_core ?? [],
    enneagramWingJoint: row.enneagram_wing_joint ?? {},
    sternbergState:
      row.sternberg_intimacy !== null && row.sternberg_passion !== null && row.sternberg_commitment !== null
        ? { intimacy: row.sternberg_intimacy, passion: row.sternberg_passion, commitment: row.sternberg_commitment }
        : null,
    mbtiEstimated: row.mbti_estimated,
    interviewMeta: {
      completedAt: row.interview_completed_at,
      turnsUsed: row.interview_turns_used ?? 0,
      elapsedSeconds: row.interview_elapsed_seconds ?? 0,
      stopReason: row.interview_stop_reason,
      calibrationVersion: row.calibration_version,
    },
  };
}

/** 본인 psychProfile을 user_psych_profiles에 upsert한다(user_id UNIQUE 제약 기준). */
export async function upsertMyPsychProfile(userId: string, profile: PsychProfile): Promise<void> {
  const { error } = await supabase
    .from('user_psych_profiles')
    .upsert({ user_id: userId, ...toRow(profile), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * 커플 상대방의 psychProfile을 조회한다. RLS 정책("커플 상대방 프로파일 조회")이
 * 실제 배포되어 있어야 결과가 반환된다 — 미배포/미연동/미완료 시 null.
 */
export async function getPartnerPsychProfile(partnerUserId: string): Promise<PsychProfile | null> {
  const { data, error } = await supabase
    .from('user_psych_profiles')
    .select('*')
    .eq('user_id', partnerUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }

  return fromRow(data as PsychProfileRow);
}

export interface InterviewTurnLog {
  sessionId: string;
  userId: string;
  turnIndex: number;
  questionId: string;
  targetDimension: string;
  rawResponseText: string | null;
  parsedValue: number | null;
  confidence: number | null;
  entropyBefore: number;
  entropyAfter: number;
}

/** 인터뷰 턴 1회를 interview_sessions에 append 로그한다(영구 보존, 삭제 없음). */
export async function logInterviewTurn(turn: InterviewTurnLog): Promise<void> {
  const { error } = await supabase.from('interview_sessions').insert({
    session_id: turn.sessionId,
    user_id: turn.userId,
    turn_index: turn.turnIndex,
    question_id: turn.questionId,
    target_dimension: turn.targetDimension,
    raw_response_text: turn.rawResponseText,
    parsed_value: turn.parsedValue,
    confidence: turn.confidence,
    entropy_before: turn.entropyBefore,
    entropy_after: turn.entropyAfter,
  });

  if (error) {
    throw new Error(error.message);
  }
}
