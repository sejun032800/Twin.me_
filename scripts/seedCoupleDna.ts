// ─── 일회성 데모 데이터 준비 스크립트 ───────────────────────────────────────────
// 테스트 계정 A/B가 이미 온보딩 인터뷰를 마쳐 user_psych_profiles에 실제 데이터가
// 있다는 전제 하에, 진짜 computeRomanticDnaV21() 계산을 실행해 couple_dna_results에
// 기록한다. 앱 소스(src/lib/matching/*)의 순수 계산 함수만 그대로 import해서
// 재사용하고, 그 파일들은 전혀 수정하지 않는다.
//
// src/lib/supabaseClient.ts는 일부러 쓰지 않는다 — 그 파일은
// @react-native-async-storage/async-storage를 import하는데, 이건 React Native
// 런타임 전용이라 일반 Node 스크립트에서 그대로 쓰면 즉시 에러가 난다. 그래서
// 이 스크립트는 자체적으로 별도 supabase-js 클라이언트를 만든다.
//
// 사전 준비:
//   1) scripts/.env.seed.local.example을 복사해 scripts/.env.seed.local로 저장하고
//      실제 값(SUPABASE_URL, SUPABASE_ANON_KEY, 테스트 계정 A/B 이메일+비밀번호)을 채운다.
//   2) couples 테이블에서 A/B가 실제로 연동돼 있는지 먼저 확인/강제한다
//      (scripts/seed_couples_link.sql을 Supabase SQL Editor에서 실행).
//   3) 아래 커맨드로 실행 (PowerShell 예시 — 프로젝트 루트에서):
//        Get-Content scripts\.env.seed.local | ForEach-Object {
//          if ($_ -match '^\s*([^#=]+)=(.*)$') { [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim()) }
//        }
//        npx tsx scripts/seedCoupleDna.ts
//
// 계산 자체는 실제 psychProfile을 그대로 쓰는 진짜 RDCS v2.1 로직이다(하드코딩 없음).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { psychProfileToPersonProfileV21 } from '../src/lib/matching/psychProfileAdapter';
import { computeRomanticDnaV21 } from '../src/lib/matching/computeRomanticDNA';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const A_EMAIL = process.env.ACCOUNT_A_EMAIL ?? '';
const A_PASSWORD = process.env.ACCOUNT_A_PASSWORD ?? '';
const B_EMAIL = process.env.ACCOUNT_B_EMAIL ?? '';
const B_PASSWORD = process.env.ACCOUNT_B_PASSWORD ?? '';

function requireEnv() {
  const missing = Object.entries({ SUPABASE_URL, SUPABASE_ANON_KEY, A_EMAIL, A_PASSWORD, B_EMAIL, B_PASSWORD })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`환경변수 누락: ${missing.join(', ')} — scripts/.env.seed.local을 확인하세요.`);
  }
}

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
}

// psychProfileService.ts의 fromRow()와 동일한 매핑 — 그 파일은 RN 클라이언트에
//묶여 있어 직접 import하지 않고, 이 부분만 여기서 그대로 재현한다(계산 로직이
// 아니라 DB 행 → 객체 변환일 뿐이므로 "새 계산 로직 추가"에 해당하지 않는다).
function rowToProfile(row: PsychProfileRow) {
  return {
    big5: { O: row.big5_o ?? 0, C: row.big5_c ?? 0, E: row.big5_e ?? 0, A: row.big5_a ?? 0, N: row.big5_n ?? 0 },
    attachment: { anxiety: row.attachment_anxiety ?? 0, avoidance: row.attachment_avoidance ?? 0 },
    enneagramCore: row.enneagram_core ?? [],
    enneagramWingJoint: row.enneagram_wing_joint ?? {},
    sternbergState:
      row.sternberg_intimacy !== null && row.sternberg_passion !== null && row.sternberg_commitment !== null
        ? { intimacy: row.sternberg_intimacy, passion: row.sternberg_passion, commitment: row.sternberg_commitment }
        : null,
    mbtiEstimated: null,
    interviewMeta: {
      completedAt: null,
      turnsUsed: 0,
      elapsedSeconds: 0,
      stopReason: null,
      calibrationVersion: 'v2.1',
    },
  };
}

async function signIn(email: string, password: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(`로그인 실패(${email}): ${error?.message ?? 'user 없음'}`);
  }
  return { client, userId: data.user.id };
}

async function fetchPsychProfile(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from('user_psych_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`psychProfile 조회 실패(${userId}): ${error.message}`);
  if (!data) {
    throw new Error(
      `user_psych_profiles에 ${userId} 행이 없습니다 — 이 계정이 실제로 온보딩 인터뷰를 완료했는지 확인하세요.`,
    );
  }
  return rowToProfile(data as PsychProfileRow);
}

async function main() {
  requireEnv();

  console.log('[1/4] 테스트 계정 A/B 로그인...');
  const a = await signIn(A_EMAIL, A_PASSWORD);
  const b = await signIn(B_EMAIL, B_PASSWORD);
  console.log(`  A userId=${a.userId}`);
  console.log(`  B userId=${b.userId}`);

  console.log('[2/4] couples 연동 상태 확인(A 세션 기준)...');
  const { data: coupleRow, error: coupleErr } = await a.client
    .from('couples')
    .select('id, creator_id, partner_id')
    .or(`creator_id.eq.${a.userId},partner_id.eq.${a.userId}`)
    .maybeSingle();
  if (coupleErr) throw new Error(`couples 조회 실패: ${coupleErr.message}`);
  if (!coupleRow || coupleRow.partner_id !== b.userId) {
    throw new Error(
      'A/B가 couples 테이블에서 아직 정확히 연동되어 있지 않습니다. ' +
        'scripts/seed_couples_link.sql을 Supabase SQL Editor에서 먼저 실행한 뒤 다시 시도하세요. ' +
        `(현재 조회된 row: ${JSON.stringify(coupleRow)})`,
    );
  }
  console.log(`  couples.id=${coupleRow.id} — 연동 확인됨`);

  console.log('[3/4] 실제 psychProfile로 DNA% 계산(computeRomanticDnaV21, 하드코딩 없음)...');
  const profileA = await fetchPsychProfile(a.client, a.userId);
  const profileB = await fetchPsychProfile(b.client, b.userId);
  const v21A = psychProfileToPersonProfileV21(profileA as never);
  const v21B = psychProfileToPersonProfileV21(profileB as never);
  const result = computeRomanticDnaV21(v21A, v21B);
  console.log('  결과:', result);

  console.log('[4/4] couple_dna_results에 기록...');
  const { error: insertErr } = await a.client.from('couple_dna_results').insert({
    couple_id: coupleRow.id,
    dna_pct: result.dna_pct,
    s_b5: result.S_B5,
    s_en: result.S_EN,
    s_st: result.S_ST,
    s_att: result.S_ATT,
    calibration_version: 'v2.1',
    computed_at: new Date().toISOString(),
  });
  if (insertErr) throw new Error(`couple_dna_results insert 실패: ${insertErr.message}`);

  console.log('\n✅ 완료');
  console.log(`DNA% = ${result.dna_pct.toFixed(1)}`);
  console.log(`S_B5=${result.S_B5.toFixed(4)} S_EN=${result.S_EN.toFixed(4)} S_ST=${result.S_ST.toFixed(4)} S_ATT=${result.S_ATT.toFixed(4)}`);
}

main().catch((e) => {
  console.error('\n❌ 스크립트 실패:', e instanceof Error ? e.message : e);
  process.exit(1);
});
