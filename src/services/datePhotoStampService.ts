// ─── FUN-HIS-006 — 사진 기반 방문 스탬프 저장/재매칭 (MASTER.md §7, date-recommend-architecture.md 레이어1/2) ──
// 스키마: supabase/migrations/20260718000000_date_photo_stamps.sql — date_photo_stamps 테이블
// 레이어1(데이터 수집) 범위: 카카오 로컬 API 매칭(레이어2)은 아직 붙지 않았으므로
// kakao_place_id/category_code는 항상 null, confidence는 항상 'unverified'로 기록한다.
//
// 레이어2(검증/정규화): rematchDatePhotoStamp()가 kakao-local-search Edge Function을
// 호출해 후보를 받아 placeMatchService.classifyMatch()(순수 함수)로 채점·분류한 뒤,
// 'high_confidence_single'일 때만 자동으로 kakao_place_id/category_code/confidence='auto'로
// UPDATE한다. 'ambiguous'/'dense_area'는 사용자가 후보 중 하나를 직접 골라야 하는
// 케이스라 이번 레이어(아직 UI 없음)에서는 자동으로 confidence를 바꾸지 않고 unverified로
// 둔다 — 호출한 쪽이 반환된 case/candidates를 보고 다음 레이어에서 UI를 붙이게 된다.
// 이 함수를 "어디서(언제) 호출할지"(예: 히스토리 탭 진입 시 재시도 큐 처리)는 이번 레이어
// 범위 밖 — 함수만 준비해두고 트리거는 다음 단계에서 정한다.

import { supabase } from '@/lib/supabaseClient';
import {
  classifyMatch,
  normalizeKakaoDocument,
  type MatchCase,
  type RawKakaoDocument,
  type ScoredCandidate,
} from '@/services/placeMatchService';

export interface DatePhotoStampInput {
  photoUri: string;
  takenAt: string | null; // usePhotoMetadata.dateTaken, 'YYYY-MM-DD'
  lat: number | null;
  lng: number | null;
  userInputName: string | null;
}

export async function saveDatePhotoStamp(input: DatePhotoStampInput, coupleId: string): Promise<void> {
  const { error } = await supabase.from('date_photo_stamps').insert({
    couple_id: coupleId,
    photo_uri: input.photoUri,
    taken_at: input.takenAt,
    lat: input.lat,
    lng: input.lng,
    user_input_name: input.userInputName,
    kakao_place_id: null,
    confidence: 'unverified',
    category_code: null,
  });

  if (error) throw new Error(`방문 스탬프 저장 실패: ${error.message}`);
}

interface DatePhotoStampRow {
  id: string;
  user_input_name: string | null;
  lat: number | null;
  lng: number | null;
}

interface KakaoLocalSearchResponse {
  documents: RawKakaoDocument[];
  radiusUsed: number;
  cached: boolean;
}

export interface RematchOutcome {
  stampId: string;
  case: MatchCase;
  updated: boolean; // true면 kakao_place_id/category_code/confidence='auto'로 갱신됨
  topCandidate: ScoredCandidate | null;
  candidates: ScoredCandidate[];
}

export async function rematchDatePhotoStamp(stampId: string): Promise<RematchOutcome> {
  const { data: stamp, error: fetchError } = await supabase
    .from('date_photo_stamps')
    .select('id, user_input_name, lat, lng')
    .eq('id', stampId)
    .single();

  if (fetchError || !stamp) {
    throw new Error(`스탬프 조회 실패: ${fetchError?.message ?? '존재하지 않는 스탬프'}`);
  }

  const row = stamp as DatePhotoStampRow;

  // 상호명이나 좌표가 없으면 애초에 검색이 불가능하다 — unverified 그대로 두고 종료.
  if (!row.user_input_name || row.lat === null || row.lng === null) {
    return { stampId, case: 'no_match', updated: false, topCandidate: null, candidates: [] };
  }

  const { data: searchResult, error: searchError } = await supabase.functions.invoke('kakao-local-search', {
    body: { query: row.user_input_name, lat: row.lat, lng: row.lng },
  });

  if (searchError || !searchResult) {
    throw new Error(`카카오 로컬 검색 실패: ${searchError?.message ?? '응답 없음'}`);
  }

  const { documents } = searchResult as KakaoLocalSearchResponse;
  const candidates = documents.map(normalizeKakaoDocument);
  const match = classifyMatch(candidates, row.user_input_name);

  let updated = false;
  if (match.case === 'high_confidence_single' && match.topCandidate) {
    const { error: updateError } = await supabase
      .from('date_photo_stamps')
      .update({
        kakao_place_id: match.topCandidate.placeId,
        category_code: match.topCandidate.categoryGroupCode,
        confidence: 'auto',
      })
      .eq('id', stampId);

    if (updateError) throw new Error(`스탬프 갱신 실패: ${updateError.message}`);
    updated = true;
  }

  return { stampId, case: match.case, updated, topCandidate: match.topCandidate, candidates: match.candidates };
}
