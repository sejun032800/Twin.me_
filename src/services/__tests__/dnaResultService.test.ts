// ─── dnaResultService 통합 테스트 — 파트너 비동시 완료 시나리오 (Phase 5.5) ────────
// 근거: docs/audit/통합감사_2026-07-16.md §2 — 커플 두 명이 인터뷰를 다른 시점에
// 끝내도, 먼저 끝난 사람 쪽 화면(DnaCompatibilityCard)이 나중에 다시 조회하면
// 결과를 보게 되는지 검증한다("A먼저완료→B완료", "B먼저완료→A완료" 두 순서 모두).
// supabase/psychProfileService는 인메모리 페이크로 모킹하고, PsychProfile 픽스처는
// 이미 검증된 adaptiveInterviewSession의 순수 상태머신으로 직접 생성한다(중복 방지).

import type { PsychProfile } from '@/store/userStore';

// ── 인메모리 페이크 backend 상태 ────────────────────────────────────────────────
const mockProfiles = new Map<string, PsychProfile>();
const mockDnaRows = new Map<string, Array<{ computed_at: string; [key: string]: unknown }>>();

jest.mock('@/services/psychProfileService', () => ({
  getPartnerPsychProfile: jest.fn(async (partnerUserId: string) => mockProfiles.get(partnerUserId) ?? null),
}));

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'couple_dna_results') throw new Error(`예상치 못한 테이블: ${table}`);
      return {
        insert: async (row: Record<string, unknown>) => {
          const list = mockDnaRows.get(row.couple_id as string) ?? [];
          list.push({ ...row, computed_at: row.computed_at as string });
          mockDnaRows.set(row.couple_id as string, list);
          return { error: null };
        },
        select: () => ({
          eq: (_col: string, coupleId: string) => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => {
                  const list = mockDnaRows.get(coupleId) ?? [];
                  if (list.length === 0) return { data: null, error: null };
                  const latest = [...list].sort((a, b) => (a.computed_at < b.computed_at ? 1 : -1))[0];
                  return { data: latest, error: null };
                },
              }),
            }),
          }),
        }),
      };
    },
  },
}));

import { createInterviewSession, getNextStep, applyNarrativeAnswer, applySternbergAnswer, finalizeProfile } from '@/lib/interview/adaptiveInterviewSession';
import { computeAndSaveCoupleDna, getLatestCoupleDnaResult } from '../dnaResultService';

function buildProfile(mbti: string): PsychProfile {
  let state = createInterviewSession(mbti);
  for (let i = 0; i < 50; i++) {
    const step = getNextStep(state);
    if (step.kind === 'done') return finalizeProfile(state);
    const parsed = { normalizedValue: 0.3, confidence: 0.9 };
    state = step.kind === 'narrative'
      ? applyNarrativeAnswer(state, step.dimension, step.question, parsed)
      : applySternbergAnswer(state, step.component, step.question, parsed);
  }
  throw new Error('테스트 픽스처 생성 실패 — 인터뷰가 종료되지 않음');
}

const COUPLE_ID = 'couple-test-1';
const USER_A = 'user-a';
const USER_B = 'user-b';

beforeEach(() => {
  mockProfiles.clear();
  mockDnaRows.clear();
});

describe('파트너 비동시 완료 — A가 먼저 끝나는 경우', () => {
  it('A 완료 시점엔 결과 없음 → B 완료 시 계산됨 → A가 나중에 다시 조회해도 동일 결과를 본다', async () => {
    const profileA = buildProfile('ENFP');
    const profileB = buildProfile('ISTJ');

    // 1) A가 먼저 완료 — 이 시점엔 B의 프로필이 아직 없음
    const resultAtATime = await computeAndSaveCoupleDna(profileA, COUPLE_ID, USER_B);
    expect(resultAtATime).toBeNull();
    expect(await getLatestCoupleDnaResult(COUPLE_ID)).toBeNull();

    // 2) B가 나중에 완료 — 이제 A의 프로필이 이미 존재하므로 계산 성공
    mockProfiles.set(USER_A, profileA);
    const resultAtBTime = await computeAndSaveCoupleDna(profileB, COUPLE_ID, USER_A);
    expect(resultAtBTime).not.toBeNull();
    expect(resultAtBTime!.dnaPct).toBeGreaterThanOrEqual(50);
    expect(resultAtBTime!.dnaPct).toBeLessThanOrEqual(100);

    // 3) A가 나중에 (DnaCompatibilityCard 재진입 시뮬레이션) 다시 조회 → B가 계산한 것과 동일한 결과
    const laterFetchByA = await getLatestCoupleDnaResult(COUPLE_ID);
    expect(laterFetchByA).not.toBeNull();
    expect(laterFetchByA!.dnaPct).toBeCloseTo(resultAtBTime!.dnaPct, 10);
    expect(laterFetchByA!.sB5).toBeCloseTo(resultAtBTime!.sB5, 10);
  });
});

describe('파트너 비동시 완료 — B가 먼저 끝나는 경우(순서 반대)', () => {
  it('B 완료 시점엔 결과 없음 → A 완료 시 계산됨 → B가 나중에 다시 조회해도 동일 결과를 본다', async () => {
    const profileA = buildProfile('ENFP');
    const profileB = buildProfile('ISTJ');

    // 1) B가 먼저 완료 — 이 시점엔 A의 프로필이 아직 없음
    const resultAtBTime = await computeAndSaveCoupleDna(profileB, COUPLE_ID, USER_A);
    expect(resultAtBTime).toBeNull();

    // 2) A가 나중에 완료 — 계산 성공
    mockProfiles.set(USER_B, profileB);
    const resultAtATime = await computeAndSaveCoupleDna(profileA, COUPLE_ID, USER_B);
    expect(resultAtATime).not.toBeNull();

    // 3) B가 나중에 다시 조회 → A가 계산한 것과 동일한 결과
    const laterFetchByB = await getLatestCoupleDnaResult(COUPLE_ID);
    expect(laterFetchByB).not.toBeNull();
    expect(laterFetchByB!.dnaPct).toBeCloseTo(resultAtATime!.dnaPct, 10);
  });
});

describe('둘 다 미완료', () => {
  it('아무도 계산하지 않은 상태에서 조회하면 null(대기 UI로 이어짐)', async () => {
    expect(await getLatestCoupleDnaResult(COUPLE_ID)).toBeNull();
  });
});
