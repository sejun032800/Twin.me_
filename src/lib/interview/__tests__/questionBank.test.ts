// ─── questionBank.ts 데이터 무결성 검증 (v2.1 §7 전체 이식 확인) ───────────────
import {
  QUESTION_BANK,
  getCommonQuestions,
  getMbtiSpecificQuestions,
  getRomanticQuestions,
  getEnneagramOpeners,
  getSternbergQuestions,
  buildWingFollowupQuestion,
  ENNEAGRAM_WING_TEMPLATE,
} from '../questionBank';

const ALL_16_MBTI = [
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
];

describe('§7.3 MBTI별 판별질문 — 16유형 전부 정확히 2문항', () => {
  it.each(ALL_16_MBTI)('%s는 정확히 2개의 판별질문을 갖는다', (mbti) => {
    const qs = getMbtiSpecificQuestions(mbti);
    expect(qs).toHaveLength(2);
    qs.forEach((q) => {
      expect(q.tier).toBe('mbti_specific');
      expect(q.mbtiType).toBe(mbti);
      expect(q.topCandidates).toHaveLength(3);
      expect(q.text.length).toBeGreaterThan(0);
    });
  });

  it('16유형 전부 존재하고 중복이 없다', () => {
    const distinctTypes = new Set(QUESTION_BANK.filter((q) => q.tier === 'mbti_specific').map((q) => q.mbtiType));
    expect(distinctTypes.size).toBe(16);
  });

  it('ISTJ 상위 후보는 1·6·5다 (§7.3 표)', () => {
    const qs = getMbtiSpecificQuestions('ISTJ');
    expect(qs[0].topCandidates).toEqual(['1', '6', '5']);
  });
});

describe('§7.1 공통질문 세트 — 차원별 문항 수 (문서 그대로)', () => {
  it.each([
    ['avoidance', 4],
    ['anxiety', 4],
    ['N', 4],
    ['O', 4],
    ['C', 4],
    ['E', 4],
    ['A', 4],
  ] as const)('%s 차원은 %i개 변형을 갖는다', (dimension, count) => {
    expect(getCommonQuestions(dimension)).toHaveLength(count);
  });

  it('애니어그램 범용 오프너는 3개다', () => {
    expect(getEnneagramOpeners('common')).toHaveLength(3);
  });

  it('스턴버그 관계상태는 3개 하위요소 × 2개 변형 = 6개다', () => {
    expect(getSternbergQuestions()).toHaveLength(6);
    expect(getSternbergQuestions('intimacy')).toHaveLength(2);
    expect(getSternbergQuestions('passion')).toHaveLength(2);
    expect(getSternbergQuestions('commitment')).toHaveLength(2);
  });
});

describe('§7.2 연애 맥락 질문 세트 — 차원별 문항 수 (회피·불안 제외 5개 차원)', () => {
  it.each([
    ['N', 3],
    ['O', 3],
    ['C', 3],
    ['E', 3],
    ['A', 3],
  ] as const)('%s 차원은 %i개 연애맥락 변형을 갖는다', (dimension, count) => {
    expect(getRomanticQuestions(dimension)).toHaveLength(count);
  });

  it('애니어그램 연애맥락 오프너는 4개다', () => {
    expect(getEnneagramOpeners('romantic')).toHaveLength(4);
  });

  it('회피·불안은 로맨틱 전용 세트가 없다 — §7.2 문서가 명시한 대로 §7.1을 재사용', () => {
    const romanticEntries = QUESTION_BANK.filter((q) => q.tier === 'romantic');
    const dims = new Set(romanticEntries.map((q) => q.targetDimension));
    expect(dims.has('avoidance')).toBe(false);
    expect(dims.has('anxiety')).toBe(false);
  });
});

describe('§9 날개 후속질문 템플릿', () => {
  it('플레이스홀더 3개를 모두 치환한다', () => {
    const result = buildWingFollowupQuestion('탐구자', '4번', '6번');
    expect(result).toBe('방금 말씀하신 스타일이 탐구자에 가까운데, 그 안에서도 4번 쪽에 더 가까우세요, 6번 쪽에 더 가까우세요?');
    expect(ENNEAGRAM_WING_TEMPLATE).toContain('[코어유형 설명]');
  });
});

describe('전체 문항뱅크 — id 중복 없음', () => {
  it('모든 id가 고유하다', () => {
    const ids = QUESTION_BANK.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('총 문항 수가 예상과 일치한다 (7×4 common + 3 opener + 6 sternberg + 5×3 romantic + 4 romantic opener + 16×2 mbti)', () => {
    const expectedTotal = 7 * 4 + 3 + 6 + 5 * 3 + 4 + 16 * 2;
    expect(QUESTION_BANK).toHaveLength(expectedTotal);
  });
});
