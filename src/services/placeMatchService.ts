// ─── placeMatchService — 방문 스탬프 ↔ 카카오 장소 매칭 스코어링/케이스 분기 (레이어2) ──
// MASTER.md §7 FUN-HIS-006, date-recommend-architecture.md 레이어2("검증/정규화").
// 이 파일은 전부 순수 함수다 — Supabase/네트워크 호출은 datePhotoStampService.ts의
// rematchDatePhotoStamp()가 담당하고(카카오 검색은 kakao-local-search Edge Function
// 경유), 여기서는 "이미 받아온 후보 목록을 어떻게 채점·분류할지"만 다룬다.
//
// score = w1·문자열유사도 + w2·거리감쇠(exp(-d/50m)) + w3·카테고리사전확률
// 카테고리사전확률(w3)은 이번 레이어에서 항상 0으로 고정한다 — categoryPriorScore()의
// TODO 주석 참고.

export interface KakaoPlaceCandidate {
  placeId: string;
  placeName: string;
  addressName: string;
  categoryGroupCode: string | null;
  distanceMeters: number;
}

// kakao-local-search Edge Function이 그대로 프록시하는 카카오 로컬 API 원본 문서 형태.
export interface RawKakaoDocument {
  id: string;
  place_name: string;
  category_group_code?: string | null;
  address_name?: string;
  road_address_name?: string;
  distance?: string;
}

export function normalizeKakaoDocument(doc: RawKakaoDocument): KakaoPlaceCandidate {
  return {
    placeId: doc.id,
    placeName: doc.place_name,
    addressName: doc.road_address_name || doc.address_name || '',
    categoryGroupCode: doc.category_group_code || null,
    distanceMeters: Number(doc.distance) || 0,
  };
}

export interface ScoredCandidate extends KakaoPlaceCandidate {
  score: number;
}

export type MatchCase = 'high_confidence_single' | 'ambiguous' | 'dense_area' | 'no_match';

export interface MatchResult {
  case: MatchCase;
  candidates: ScoredCandidate[];
  topCandidate: ScoredCandidate | null;
}

// ── 한글 자모 단위 편집거리 ──────────────────────────────────────────────────────
// 음절 레벤슈타인이 아니라 자모(초성/중성/종성) 단위로 분해한 뒤 편집거리를 계산해야
// "스벅"↔"스타벅스 홍대점"처럼 음절 경계가 다른 축약어 매칭에서 합리적인 유사도가
// 나온다(FUN-HIS-006 매칭 스코어 명세). 외부 라이브러리 없이 직접 구현했다 — 유니코드
// 완성형 한글(AC00~D7A3) 오프셋 산술로 분해 가능해 별도 의존성이 필요 없다.
const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const LEAD = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const VOWEL = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];
const TRAIL = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

export function hangulJamoDecompose(str: string): string {
  let result = '';
  for (const ch of str) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= HANGUL_BASE && code <= HANGUL_END) {
      const offset = code - HANGUL_BASE;
      const leadIndex = Math.floor(offset / (21 * 28));
      const vowelIndex = Math.floor((offset % (21 * 28)) / 28);
      const trailIndex = offset % 28;
      result += LEAD[leadIndex] + VOWEL[vowelIndex] + TRAIL[trailIndex];
    } else {
      result += ch;
    }
  }
  return result;
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prevDiag = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, dp[j], dp[j - 1]);
      prevDiag = temp;
    }
  }
  return dp[n];
}

function isSubsequence(shorter: string, longer: string): boolean {
  let i = 0;
  for (const ch of longer) {
    if (i < shorter.length && shorter[i] === ch) i++;
  }
  return i === shorter.length;
}

const SUBSTRING_BONUS = 0.25;
const SUBSEQUENCE_BONUS = 0.15;

// 부분일치 보너스: "스벅"의 각 글자(스, 벅)가 순서대로 "스타벅스 홍대점" 안에 등장하면
// (연속하지 않아도) 흔한 한글 상호명 줄임말 패턴으로 보고 보너스를 준다. 완전한
// 연속 부분문자열이면 더 확실한 신호이므로 더 큰 보너스를 준다.
export function koreanStringSimilarity(a: string, b: string): number {
  const normA = a.trim();
  const normB = b.trim();
  if (!normA || !normB) return 0;

  const jamoA = hangulJamoDecompose(normA);
  const jamoB = hangulJamoDecompose(normB);
  const maxLen = Math.max(jamoA.length, jamoB.length) || 1;
  const baseSim = 1 - levenshteinDistance(jamoA, jamoB) / maxLen;

  const [shorter, longer] = normA.length <= normB.length ? [normA, normB] : [normB, normA];
  let bonus = 0;
  if (longer.includes(shorter)) {
    bonus = SUBSTRING_BONUS;
  } else if (isSubsequence(shorter, longer)) {
    bonus = SUBSEQUENCE_BONUS;
  }

  return Math.min(1, Math.max(0, baseSim) + bonus);
}

// 거리감쇠: exp(-d/50m) — FUN-HIS-006 매칭 스코어 명세식 그대로.
export function distanceDecayScore(distanceMeters: number): number {
  return Math.exp(-distanceMeters / 50);
}

// TODO(레이어4 이후): 같은 날 앞뒤 스탬프의 카테고리 흐름을 보조 신호로 사용(옵션,
// date-recommend-architecture.md 레이어2 "카테고리사전확률" 항목). 이를 구현하려면
// 같은 커플의 인접 스탬프 카테고리 이력을 조회해야 해서 순수 함수 경계를 벗어난다 —
// 이 레이어에서는 항상 0을 반환하고, 가중치(categoryPrior)도 0으로 고정해 최종 점수에
// 기여하지 않는다.
export function categoryPriorScore(_candidate: KakaoPlaceCandidate): number {
  return 0;
}

export interface MatchWeights {
  stringSim: number;
  distanceDecay: number;
  categoryPrior: number;
}

export const DEFAULT_WEIGHTS: MatchWeights = { stringSim: 0.6, distanceDecay: 0.4, categoryPrior: 0 };
// 밀집 지역: 거리 가중치↓, 문자열유사도 가중치↑ 재정렬(FUN-HIS-006 케이스 분기표).
export const DENSE_AREA_WEIGHTS: MatchWeights = { stringSim: 0.8, distanceDecay: 0.2, categoryPrior: 0 };

export function computeMatchScore(
  candidate: KakaoPlaceCandidate,
  query: string,
  weights: MatchWeights = DEFAULT_WEIGHTS,
): number {
  const stringSim = koreanStringSimilarity(query, candidate.placeName);
  const distanceDecay = distanceDecayScore(candidate.distanceMeters);
  const categoryPrior = categoryPriorScore(candidate);
  return weights.stringSim * stringSim + weights.distanceDecay * distanceDecay + weights.categoryPrior * categoryPrior;
}

// ── 케이스 분기 ─────────────────────────────────────────────────────────────────
// FUN-HIS-006 케이스 분기표(고신뢰 단독 / 분점 모호 / 밀집 지역 / 매칭 실패) 4가지를
// 그대로 구현한다. 밀집 지역이 다른 세 케이스보다 먼저 판정되는 이유: 후보 수가
// 임계치를 넘으면 "재정렬"이 이미 그 자체로 케이스이지, 재정렬 후에 다시 고신뢰/분점모호로
// 나누는 것은 문서의 4행 표를 상호 배타적 케이스로 다루는 해석과 맞지 않는다.
export const DENSE_AREA_CANDIDATE_THRESHOLD = 15;
export const DENSE_AREA_RESULT_LIMIT = 10;
export const HIGH_CONFIDENCE_SCORE_GAP = 0.15;
export const MIN_ACCEPTABLE_SCORE = 0.35;
export const AMBIGUOUS_CANDIDATE_LIMIT = 3;

export function classifyMatch(rawCandidates: KakaoPlaceCandidate[], query: string): MatchResult {
  if (rawCandidates.length === 0) {
    return { case: 'no_match', candidates: [], topCandidate: null };
  }

  const isDense = rawCandidates.length > DENSE_AREA_CANDIDATE_THRESHOLD;
  const weights = isDense ? DENSE_AREA_WEIGHTS : DEFAULT_WEIGHTS;

  const scored: ScoredCandidate[] = rawCandidates
    .map((c) => ({ ...c, score: computeMatchScore(c, query, weights) }))
    .sort((a, b) => b.score - a.score);

  if (isDense) {
    return { case: 'dense_area', candidates: scored.slice(0, DENSE_AREA_RESULT_LIMIT), topCandidate: scored[0] };
  }

  const top = scored[0];
  if (top.score < MIN_ACCEPTABLE_SCORE) {
    return { case: 'no_match', candidates: scored, topCandidate: null };
  }

  const second = scored[1];
  const gap = second ? top.score - second.score : Infinity;

  if (gap >= HIGH_CONFIDENCE_SCORE_GAP) {
    return { case: 'high_confidence_single', candidates: [top], topCandidate: top };
  }

  return { case: 'ambiguous', candidates: scored.slice(0, AMBIGUOUS_CANDIDATE_LIMIT), topCandidate: top };
}
