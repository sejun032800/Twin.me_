// ─── v2.1 스케일 재보정 테스트 (Phase 5.5) ──────────────────────────────────────
// rescaleScoreCutoffToV21/getTierFromScoreV21/무드태그 임계값 — 통합감사
// (docs/audit/통합감사_2026-07-16.md §1c)가 지적한 스케일 불일치를 고친 결과 검증.
// getTierFromScore(OFF 경로)는 이 파일에서 절대 수정하지 않고 스냅샷 검증만 한다.

import {
  getTierFromScore,
  getTierFromScoreV21,
  rescaleScoreCutoffToV21,
  MOOD_TAG_HIGH_THRESHOLD_V21,
  MOOD_TAG_MID_THRESHOLD_V21,
} from '../scoreCalculator';

function normalCdfRef(x: number, mean: number, sd: number): number {
  // 테스트 전용 참조 구현(erf 기반) — scoreCalculator.ts의 비공개 normalCdf와 별개로,
  // 백분위 보존 여부를 독립적으로 재검증하기 위해 동일 공식을 다시 구현한다.
  function erf(v: number): number {
    const sign = v < 0 ? -1 : 1;
    const av = Math.abs(v);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const t = 1 / (1 + p * av);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-av * av);
    return sign * y;
  }
  return 0.5 * (1 + erf((x - mean) / (sd * Math.SQRT2)));
}

describe('rescaleScoreCutoffToV21 — 백분위 보존', () => {
  it('옛 분포(mean=70,sd=7.81)에서의 백분위와 새 분포(mean=75,sd≈9.7056)에서의 백분위가 일치한다', () => {
    for (const oldCutoff of [95, 90, 85, 80, 75, 70, 65, 60, 55, 40]) {
      const newCutoff = rescaleScoreCutoffToV21(oldCutoff);
      const oldPercentile = normalCdfRef(oldCutoff, 70, 7.81);
      const newPercentile = normalCdfRef(newCutoff, 75, 25 / 2.5758);
      expect(newPercentile).toBeCloseTo(oldPercentile, 6);
    }
  });

  it('70(구 분포 평균)은 새 분포에서 75 근처로 매핑된다(평균→평균)', () => {
    expect(rescaleScoreCutoffToV21(70)).toBeCloseTo(75, 4);
  });

  it('컷오프 순서가 뒤집히지 않는다(단조증가 유지)', () => {
    const cutoffs = [55, 60, 65, 70, 75, 80, 85, 90, 95].map(rescaleScoreCutoffToV21);
    for (let i = 1; i < cutoffs.length; i++) {
      expect(cutoffs[i]).toBeGreaterThan(cutoffs[i - 1]);
    }
  });
});

describe('getTierFromScoreV21 — 재보정된 컷오프로 등급 판정', () => {
  it('재보정된 70 컷오프(≈75) 바로 위/아래에서 등급이 갈린다', () => {
    const cutoff70 = rescaleScoreCutoffToV21(70);
    expect(getTierFromScoreV21(cutoff70 + 0.01).title).toBe('다정다감한 모범 커플');
    expect(getTierFromScoreV21(cutoff70 - 0.01).title).not.toBe('다정다감한 모범 커플');
  });

  it('극단적으로 낮은 점수는 최하위 등급', () => {
    expect(getTierFromScoreV21(0).title).toBe('살얼음판 위 대치 상황');
  });

  it('컷오프를 확실히 넘는 점수는 최상위 등급', () => {
    // 참고: 백분위를 보존하며 재매핑하면 최상위 컷오프(T95)가 dna_pct 자체의
    // 상한(100)보다 높게 나온다(구 시스템도 S_Base 단독으론 최상위 등급에 못 미치고,
    // sLive/sCurrent의 장기 성장을 통해서만 도달 가능했던 것과 동일한 성격) —
    // 그래서 score=100이 아니라 컷오프+여유값으로 "도달 가능함" 자체만 검증한다.
    const cutoff95 = rescaleScoreCutoffToV21(95);
    expect(getTierFromScoreV21(cutoff95 + 5).title).toBe('환상 속의 신화적 결합');
  });
});

describe('getTierFromScore(OFF 경로) — 무수정 회귀 확인', () => {
  it('기존 컷오프 그대로 동작한다(스냅샷)', () => {
    expect(getTierFromScore(95).title).toBe('환상 속의 신화적 결합');
    expect(getTierFromScore(75).title).toBe('달달한 핑크빛 로맨스');
    expect(getTierFromScore(70).title).toBe('다정다감한 모범 커플');
    expect(getTierFromScore(54).title).toBe('살얼음판 위 대치 상황');
  });
});

describe('무드태그 임계값(MOOD_TAG_*_THRESHOLD_V21)', () => {
  it('HIGH(구 70) > MID(구 40), 둘 다 유한한 값', () => {
    expect(Number.isFinite(MOOD_TAG_HIGH_THRESHOLD_V21)).toBe(true);
    expect(Number.isFinite(MOOD_TAG_MID_THRESHOLD_V21)).toBe(true);
    expect(MOOD_TAG_HIGH_THRESHOLD_V21).toBeGreaterThan(MOOD_TAG_MID_THRESHOLD_V21);
  });
});
