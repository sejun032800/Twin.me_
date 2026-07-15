// ─── 트윈 AI 페르소나 어댑터 (Phase 3) ──────────────────────────────────────────
// 배경: genesisBlending.ts(computePersonaBlend)는 OFF 경로(useGenesisInterview.ts)의
// BayesianState.topType(argmax 유형)+confidence(스칼라)를 입력으로 쓴다. ON 경로
// (useAdaptiveInterview.ts)는 psychProfile.enneagramCore(p ∈ Δ⁹, 길이 9 확률벡터)로
// 결과를 저장하므로, 이 둘을 잇는 어댑터가 필요하다 — 조사 결과(genesisBlending.ts:62-74)
// computePersonaBlend는 topType+confidence 두 스칼라만 쓰고 BayesianState의 다른 필드는
// 참조하지 않으므로, 이 순수함수 하나로 충분하다. genesisBlending.ts/twinResponseEngine.ts
// 자체는 건드리지 않고 import만 한다(Phase 0 금지 목록 편집 금지 규칙 준수).
//
// enneagramCore 배열 인덱스 규약: index i(0-based) ↔ ENNEAGRAM_TYPES[i] = String(i+1).
// 이 규약은 이 코드베이스에 아직 없어(entropy()는 순서 무관), Phase 3에서 최초로
// psychProfile.enneagramCore를 실제로 채우는 useAdaptiveInterview.ts와 함께 이 파일이
// 규약을 정의한다.

import { ENNEAGRAM_TYPES, type EnneagramType } from '@/types/genesis';

export interface EnneagramCoreTopType {
  type: EnneagramType;
  confidence: number;
}

/** 섀넌 엔트로피(자연로그) — adaptiveEngine.ts의 entropy()와 동일 정의. */
function entropy(p: number[]): number {
  return -p.reduce((sum, pi) => sum + (pi > 0 ? pi * Math.log(pi) : 0), 0);
}

/**
 * enneagramCore(Δ⁹ 확률벡터) → {type, confidence} 변환.
 * confidence = 1 - H(p)/ln(9) — BayesianState.confidence와 동일 공식(types/genesis.ts 주석).
 * 길이가 9가 아니거나 전부 0이면 판별 불가로 간주해 confidence 0을 반환한다.
 */
export function enneagramCoreToTopType(p: number[]): EnneagramCoreTopType {
  if (p.length !== 9 || p.every((v) => v === 0)) {
    return { type: ENNEAGRAM_TYPES[0], confidence: 0 };
  }
  let maxIndex = 0;
  for (let i = 1; i < p.length; i++) {
    if (p[i] > p[maxIndex]) maxIndex = i;
  }
  const confidence = 1 - entropy(p) / Math.log(9);
  return { type: ENNEAGRAM_TYPES[maxIndex], confidence: Math.max(0, Math.min(1, confidence)) };
}
