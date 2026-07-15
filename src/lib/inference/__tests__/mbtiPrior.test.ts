// ─── 골든 테스트 #1 — MBTI→Big5 초기값 16유형 전체 (구현명세서 §9) ─────────────
// 기대값은 v2.1 §2 공식(O=.5+.15·sign(N/S), C=.5+.15·sign(J/P), E=.5+.15·sign(E/I),
// A=.5+.15·sign(T/F;F=+1), N=.5+.05·sign(T/F;F=+1)+.05·sign(E/I;I=+1))을 16개 유형에
// 직접 대입해 손으로 유도한 값이다 — 재계산 금지 대상은 "구현이 이 값을 재현하는지"이며
// 이 기대값 자체가 v2.1 §2 수식의 유일한 근거다. 구현명세서 §9 예시(ISTJ→(.35,.65,.35,.35,.50))와
// 정확히 일치함을 아래 표의 ISTJ 행에서 재확인할 수 있다.

import { attachmentPrior, big5Prior, enneagramCorePrior } from '../mbtiPrior';
import type { Big5Vector } from '../../matching/constants';

const EXPECTED_BIG5: Record<string, Big5Vector> = {
  ISTJ: { O: 0.35, C: 0.65, E: 0.35, A: 0.35, N: 0.5 },
  ISFJ: { O: 0.35, C: 0.65, E: 0.35, A: 0.65, N: 0.6 },
  INFJ: { O: 0.65, C: 0.65, E: 0.35, A: 0.65, N: 0.6 },
  INTJ: { O: 0.65, C: 0.65, E: 0.35, A: 0.35, N: 0.5 },
  ISTP: { O: 0.35, C: 0.35, E: 0.35, A: 0.35, N: 0.5 },
  ISFP: { O: 0.35, C: 0.35, E: 0.35, A: 0.65, N: 0.6 },
  INFP: { O: 0.65, C: 0.35, E: 0.35, A: 0.65, N: 0.6 },
  INTP: { O: 0.65, C: 0.35, E: 0.35, A: 0.35, N: 0.5 },
  ESTP: { O: 0.35, C: 0.35, E: 0.65, A: 0.35, N: 0.4 },
  ESFP: { O: 0.35, C: 0.35, E: 0.65, A: 0.65, N: 0.5 },
  ENFP: { O: 0.65, C: 0.35, E: 0.65, A: 0.65, N: 0.5 },
  ENTP: { O: 0.65, C: 0.35, E: 0.65, A: 0.35, N: 0.4 },
  ESTJ: { O: 0.35, C: 0.65, E: 0.65, A: 0.35, N: 0.4 },
  ESFJ: { O: 0.35, C: 0.65, E: 0.65, A: 0.65, N: 0.5 },
  ENFJ: { O: 0.65, C: 0.65, E: 0.65, A: 0.65, N: 0.5 },
  ENTJ: { O: 0.65, C: 0.65, E: 0.65, A: 0.35, N: 0.4 },
};

describe('big5Prior — v2.1 §2, 16개 MBTI 유형 전체', () => {
  it.each(Object.entries(EXPECTED_BIG5))('%s → 기대 Big5 벡터를 정확히 재현한다', (mbti, expected) => {
    const result = big5Prior(mbti);
    expect(result.O).toBeCloseTo(expected.O, 10);
    expect(result.C).toBeCloseTo(expected.C, 10);
    expect(result.E).toBeCloseTo(expected.E, 10);
    expect(result.A).toBeCloseTo(expected.A, 10);
    expect(result.N).toBeCloseTo(expected.N, 10);
  });

  it('구현명세서 §9 골든 테스트 예시(ISTJ→(.35,.65,.35,.35,.50))와 정확히 일치한다', () => {
    expect(big5Prior('ISTJ')).toEqual({ O: 0.35, C: 0.65, E: 0.35, A: 0.35, N: 0.5 });
  });

  it('소문자 입력도 대문자와 동일하게 처리한다', () => {
    expect(big5Prior('istj')).toEqual(big5Prior('ISTJ'));
  });

  it('유효하지 않은 MBTI 문자열은 명시적으로 던진다', () => {
    expect(() => big5Prior('ABCD')).toThrow();
    expect(() => big5Prior('')).toThrow();
  });
});

describe('attachmentPrior — v2.1 §2', () => {
  it('anx⁽⁰⁾ = N⁽⁰⁾, avo⁽⁰⁾ = 1 − (E⁽⁰⁾+A⁽⁰⁾)/2', () => {
    const big5 = big5Prior('ISTJ'); // E=.35, A=.35, N=.5
    const attachment = attachmentPrior(big5);
    expect(attachment.anxiety).toBeCloseTo(0.5, 10);
    expect(attachment.avoidance).toBeCloseTo(1 - (0.35 + 0.35) / 2, 10);
  });

  it.each(Object.entries(EXPECTED_BIG5))('%s — anxiety는 항상 N과 같다', (mbti) => {
    const big5 = big5Prior(mbti);
    expect(attachmentPrior(big5).anxiety).toBe(big5.N);
  });
});

describe('골든 테스트 #2 — enneagramCorePrior (v2.1 §5.4, ENFP 예시, U_EN≈0.969)', () => {
  function entropy(p: Record<number, number>): number {
    return -Object.values(p).reduce((sum: number, pi) => sum + (pi > 0 ? pi * Math.log(pi) : 0), 0);
  }

  it('ENFP 자기보고 Big5 사전값으로 계산한 애니어그램 코어 사전분포의 정규화 엔트로피 U_EN이 0.969에 근접한다', () => {
    const big5 = big5Prior('ENFP'); // O=.65,C=.35,E=.65,A=.65,N=.50
    const p = enneagramCorePrior(big5);

    const sum = Object.values(p).reduce((a: number, b) => a + (b as number), 0);
    expect(sum).toBeCloseTo(1, 10);

    const uEn = entropy(p) / Math.log(9);
    expect(uEn).toBeCloseTo(0.969, 2); // v2.1 §5.4 표
  });

  it('9개 확률이 모두 0 이상이고 합이 1이다(유효한 분포)', () => {
    const p = enneagramCorePrior(big5Prior('ISTJ'));
    for (const v of Object.values(p)) {
      expect(v as number).toBeGreaterThanOrEqual(0);
    }
    expect(Object.values(p).reduce((a: number, b) => a + (b as number), 0)).toBeCloseTo(1, 10);
  });
});
