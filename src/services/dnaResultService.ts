// ─── DNA Result Service — couple_dna_results (Phase 5.5) ───────────────────────
// 근거: docs/audit/통합감사_2026-07-16.md §2/§3. couple_dna_results는 couple_id에
// UNIQUE 제약이 없는 append-only 이력 로그다(원본 마이그레이션 주석 — 과거 결과를
// 재현/비교하기 위해 의도적으로 이렇게 설계됨) — 그래서 진짜 upsert가 아니라
// INSERT만 하고, 조회는 computed_at DESC LIMIT 1로 최신 결과만 가져온다.
// computeAndSaveCoupleDna()는 GenesisV21Screen과 DnaCompatibilityCard가 공유하는
// "파트너 프로필이 준비됐으면 계산해서 저장" 로직 — 두 곳에서 각자 다시 구현하지
// 않도록 여기 한 곳에 둔다(커플이 인터뷰를 비동시에 완료하는 시나리오 대응).

import { supabase } from '@/lib/supabaseClient';
import type { DnaResult } from '@/store/coupleStore';
import type { PsychProfile } from '@/store/userStore';
import { getPartnerPsychProfile } from './psychProfileService';
import { psychProfileToPersonProfileV21 } from '@/lib/matching/psychProfileAdapter';
import { computeRomanticDnaV21 } from '@/lib/matching/computeRomanticDNA';

interface CoupleDnaResultRow {
  dna_pct: number;
  s_b5: number;
  s_en: number;
  s_st: number;
  s_att: number;
  calibration_version: string;
  computed_at: string;
}

function toDnaResult(row: CoupleDnaResultRow): DnaResult {
  return {
    dnaPct: row.dna_pct,
    sB5: row.s_b5,
    sEn: row.s_en,
    sSt: row.s_st,
    sAtt: row.s_att,
    calibrationVersion: row.calibration_version,
    computedAt: row.computed_at,
  };
}

/** couple_dna_results에 새 결과 행을 append한다(UNIQUE 제약 없음 — 이력 로그). */
export async function insertCoupleDnaResult(coupleId: string, result: DnaResult): Promise<void> {
  const { error } = await supabase.from('couple_dna_results').insert({
    couple_id: coupleId,
    dna_pct: result.dnaPct,
    s_b5: result.sB5,
    s_en: result.sEn,
    s_st: result.sSt,
    s_att: result.sAtt,
    calibration_version: result.calibrationVersion,
    computed_at: result.computedAt,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/** couple_dna_results에서 이 커플의 가장 최근 결과 1건을 가져온다. 아직 없으면 null. */
export async function getLatestCoupleDnaResult(coupleId: string): Promise<DnaResult | null> {
  const { data, error } = await supabase
    .from('couple_dna_results')
    .select('*')
    .eq('couple_id', coupleId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }

  return toDnaResult(data as CoupleDnaResultRow);
}

/**
 * 파트너 프로필이 이미 준비돼 있으면 연애 DNA를 계산해 couple_dna_results에 기록하고
 * 반환한다. 파트너가 아직 인터뷰를 완료하지 않았거나(getPartnerPsychProfile null) 중간에
 * 오류(RLS 미배포/네트워크 등)가 나면 조용히 null을 반환한다 — 호출부는 이 값을
 * "아직 계산할 수 없음"으로 취급하면 된다(크래시 없음).
 */
export async function computeAndSaveCoupleDna(
  myProfile: PsychProfile,
  coupleId: string,
  partnerUserId: string,
): Promise<DnaResult | null> {
  try {
    const partnerProfile = await getPartnerPsychProfile(partnerUserId);
    if (!partnerProfile) return null;

    const myV21 = psychProfileToPersonProfileV21(myProfile);
    const partnerV21 = psychProfileToPersonProfileV21(partnerProfile);
    const result = computeRomanticDnaV21(myV21, partnerV21);

    const dnaResult: DnaResult = {
      dnaPct: result.dna_pct,
      sB5: result.S_B5,
      sEn: result.S_EN,
      sSt: result.S_ST,
      sAtt: result.S_ATT,
      calibrationVersion: 'v2.1',
      computedAt: new Date().toISOString(),
    };

    await insertCoupleDnaResult(coupleId, dnaResult);
    return dnaResult;
  } catch {
    return null;
  }
}
