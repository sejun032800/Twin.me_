// ─── v2.1 상수 모듈 — 연애 DNA 일치율 공식 v2.1 전용 (Phase 0/1, Strangler Fig) ──
// 출처: docs/연애_DNA_일치율_공식_v2.1.md (SSOT, 갱신판 — §2 앵커행렬·§11.2 M행렬 복원).
// 이 파일은 기존 src/engine/*, src/store/* 를 import하지 않는 완전 독립 모듈이다.
//
// Phase 0에서 "v2.1 문서만으로는 복원 불가능"으로 보고했던 4개 갭(앵커행렬, M행렬,
// Readiness(), Stability()/PursueWithdraw()/t^trait)은 v2.1 갱신판 §2/§11.1/§11.2에
// 실제 수치·수식이 전부 복원되어 더 이상 갭이 아니다. 앵커행렬·M행렬은 아래에 그대로
// 옮겨 적었고, Readiness/Stability/PursueWithdraw/t^trait 수식은 lib/matching/
// dnaCompatibility.ts에 구현했다.

export interface Big5Vector {
  O: number;
  C: number;
  E: number;
  A: number;
  N: number;
}

export const ENNEAGRAM_TYPE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type EnneagramCoreId = (typeof ENNEAGRAM_TYPE_IDS)[number];

// ── §5.1 표 — 연속차원(Big5, 애착) σ_prior ────────────────────────────────────
// O,C,E,A: MBTI 단일 축에 직접 대응 → 0.12
// N: 두 축의 약한 2차보정만 존재 → 0.18
// anx: N으로부터의 간접 유도(r≈0.5) → 0.20
// avo: E,A 평균으로부터의 가장 약한 간접 유도(r≈0.2~0.3) → 0.22
export const SIGMA_PRIOR = {
  O: 0.12,
  C: 0.12,
  E: 0.12,
  A: 0.12,
  N: 0.18,
  anx: 0.2,
  avo: 0.22,
} as const; // v2.1 §5.1

export type UncertaintyDimension = keyof typeof SIGMA_PRIOR;

// σ_max = max(σ_prior) — 식 (1)의 정규화 분모
export const SIGMA_MAX = 0.22; // v2.1 §5.1 식(1)

// ── §2 — 애니어그램 코어 사전분포 온도 τ_c ────────────────────────────────────
export const TAU_CORE = 0.35; // v2.1 §2 "τ_c = 0.35"

// ── §9.1 — 날개 조건부확률 온도 τ_w ──────────────────────────────────────────
// "코어 판별보다 더 촘촘한 구분이 필요하므로 τ_c=0.35보다 낮게 설정"
export const TAU_WING = 0.25; // v2.1 §9.1

// ── §11.2 — 날개 궁합 블렌딩 가중치 δ ────────────────────────────────────────
export const WING_BONUS_DELTA = 0.08; // v2.1 §11.2 식(8), §16 한계 3 "임의값"

// ── §12 — 원점수 결합 가중치 (식 9) ──────────────────────────────────────────
export const RAW_SCORE_WEIGHTS = {
  B5: 0.25,
  EN: 0.15,
  ST: 0.3,
  ATT: 0.3,
} as const; // v2.1 §12 식(9)

// ── §12 — Monte Carlo 재캘리브레이션 상수 (식 10) ────────────────────────────
export const MU_HAT = 0.5259; // v2.1 §12 — 10만 쌍 재시뮬레이션 평균
export const SIGMA_HAT = 0.0726; // v2.1 §12 — 10만 쌍 재시뮬레이션 표준편차
export const K_SCALE = 25 / 2.5758; // v2.1 §12 — ≈ 9.7056
export const DNA_PCT_MIN = 50;
export const DNA_PCT_MAX = 100;
export const DNA_PCT_CENTER = 75; // v2.1 §12 식(10) — "clamp(75 + k·z, 50, 100)"

// ── §6 — 조기종료 임계값 ─────────────────────────────────────────────────────
export const EARLY_STOP_UBAR_THRESHOLD = 0.15; // v2.1 §6 "θ=0.15 권장"
export const EARLY_STOP_MIN_NARRATIVE_TURNS = 5; // v2.1 §6 (c) "최소 5턴(서사형) 충족"
export const EARLY_STOP_PER_DIM_THRESHOLD = 0.5; // v2.1 §6 (c) "모든 U_d < 0.5"

// ── §4 — 시간 예산 모델 (5분 상한) ───────────────────────────────────────────
export const INTERVIEW_HARD_CAP_SECONDS = 300; // v2.1 §4/§6 "5분 하드 캡"
export const INTERVIEW_QA_BUDGET_SECONDS = 280; // v2.1 §4 "실질 Q&A 예산 약 280초"
export const TURN_SECONDS = {
  narrative: 30, // v2.1 §4 유형 A — 서사형 개방질문
  sternberg: 10, // v2.1 §4 유형 C — 관계상태 직답 (엔트로피 무관, 고정 포함)
} as const;
// v2.1 §4/§7 패치(Phase 4) — 날개 판별 후속질문(구 유형 B)은 인터뷰 턴이 아니라
// 결과화면 확인용 UX로 재분류되어 시간예산에서 제외됐다. TURN_SECONDS.wingFollowup은
// 이 패치로 제거했다 — questionBank.ts의 ENNEAGRAM_WING_TEMPLATE 자체는 결과화면용
// 문구로 그대로 남겨둔다(삭제 아님).

// ── §10 — MBTI 축 재추정 로지스틱 스케일 ─────────────────────────────────────
export const MBTI_REESTIMATE_SCALE = 0.15; // v2.1 §10 식(6) "s = 0.15"

// ── §2 — 애니어그램 원형 앵커행렬 E_i (Big5 공간, 9×5) ───────────────────────
// 애니어그램-FFM 상관연구(Wagner, 1981; Newgent et al., 2004) 기반 9유형별 대표 좌표.
const ENNEAGRAM_ANCHOR_MATRIX: Record<EnneagramCoreId, Big5Vector> = {
  1: { O: 0.45, C: 0.8, E: 0.45, A: 0.45, N: 0.55 },
  2: { O: 0.5, C: 0.4, E: 0.65, A: 0.8, N: 0.55 },
  3: { O: 0.5, C: 0.75, E: 0.75, A: 0.45, N: 0.4 },
  4: { O: 0.75, C: 0.35, E: 0.4, A: 0.5, N: 0.7 },
  5: { O: 0.75, C: 0.55, E: 0.25, A: 0.4, N: 0.55 },
  6: { O: 0.5, C: 0.65, E: 0.45, A: 0.6, N: 0.7 },
  7: { O: 0.75, C: 0.35, E: 0.8, A: 0.55, N: 0.35 },
  8: { O: 0.45, C: 0.6, E: 0.75, A: 0.3, N: 0.35 },
  9: { O: 0.5, C: 0.4, E: 0.35, A: 0.75, N: 0.35 },
}; // v2.1 §2

/** 애니어그램 9유형 원형 앵커행렬 E_i (Big5 공간, 9×5). v2.1 §2. */
export function getEnneagramAnchorMatrix(): Record<EnneagramCoreId, Big5Vector> {
  return ENNEAGRAM_ANCHOR_MATRIX;
}

// ── §11.2 — 애니어그램 궁합행렬 M (9×9, 대칭) ────────────────────────────────
// 날개(Wing)·화살(Arrow) 이론 및 임상적 궁합 관찰 반영. 행/열 순서는 유형 1~9.
const ENNEAGRAM_COMPATIBILITY_MATRIX: number[][] = [
  [0.6, 0.75, 0.55, 0.65, 0.6, 0.7, 0.5, 0.55, 0.7],
  [0.75, 0.6, 0.65, 0.7, 0.45, 0.65, 0.7, 0.8, 0.75],
  [0.55, 0.65, 0.6, 0.5, 0.55, 0.6, 0.75, 0.7, 0.55],
  [0.65, 0.7, 0.5, 0.6, 0.75, 0.55, 0.55, 0.65, 0.5],
  [0.6, 0.45, 0.55, 0.75, 0.6, 0.65, 0.55, 0.6, 0.65],
  [0.7, 0.65, 0.6, 0.55, 0.65, 0.6, 0.65, 0.55, 0.75],
  [0.5, 0.7, 0.75, 0.55, 0.55, 0.65, 0.6, 0.7, 0.65],
  [0.55, 0.8, 0.7, 0.65, 0.6, 0.55, 0.7, 0.6, 0.6],
  [0.7, 0.75, 0.55, 0.5, 0.65, 0.75, 0.65, 0.6, 0.6],
]; // v2.1 §11.2

/** 애니어그램 궁합행렬 M (9×9). v2.1 §11.2 "S_EN,core = p_A^T · M · p_B". */
export function getEnneagramCompatibilityMatrix(): number[][] {
  return ENNEAGRAM_COMPATIBILITY_MATRIX;
}
