// ─── adaptive-interview 계약 테스트 (Gemini mock — 실제 API 호출 없음) ─────────
// parsing.ts는 Deno API를 쓰지 않는 순수 TS라 Jest에서 그대로 import해 테스트할 수
// 있다. callGemini를 mock으로 주입해 재시도·폴백 로직만 검증한다.

import {
  buildFallbackResponse,
  buildGeneratePrompt,
  buildParsePrompt,
  generateUtterance,
  parseResponseWithRetry,
  validateParsedResponse,
} from '../parsing';

const VALID_JSON = JSON.stringify({
  target_dimension: 'avoidance',
  normalized_value: 0.62,
  confidence: 0.8,
  extracted_evidence: '가까워지는 게 불편하다고 답했다',
});

describe('validateParsedResponse — §6 계약 검증', () => {
  it('필드가 전부 유효하면 그대로 통과한다', () => {
    expect(validateParsedResponse(JSON.parse(VALID_JSON))).toEqual({
      target_dimension: 'avoidance',
      normalized_value: 0.62,
      confidence: 0.8,
      extracted_evidence: '가까워지는 게 불편하다고 답했다',
    });
  });

  it('normalized_value가 [0,1] 밖이면 무효 처리한다', () => {
    expect(validateParsedResponse({ target_dimension: 'N', normalized_value: 1.5, confidence: 0.5, extracted_evidence: 'x' })).toBeNull();
  });

  it('confidence가 숫자가 아니면 무효 처리한다', () => {
    expect(validateParsedResponse({ target_dimension: 'N', normalized_value: 0.5, confidence: 'high', extracted_evidence: 'x' })).toBeNull();
  });

  it('필수 필드가 빠지면 무효 처리한다', () => {
    expect(validateParsedResponse({ target_dimension: 'N', normalized_value: 0.5 })).toBeNull();
  });

  it('객체가 아니면 무효 처리한다', () => {
    expect(validateParsedResponse('not an object')).toBeNull();
    expect(validateParsedResponse(null)).toBeNull();
  });
});

describe('parseResponseWithRetry — 정상 응답', () => {
  it('첫 호출에서 유효한 JSON을 반환하면 재시도 없이 그대로 통과한다', async () => {
    const callGemini = jest.fn().mockResolvedValue(VALID_JSON);
    const result = await parseResponseWithRetry(callGemini, 'avoidance', '질문 텍스트', '사용자 답변');

    expect(result).toEqual(JSON.parse(VALID_JSON));
    expect(callGemini).toHaveBeenCalledTimes(1);
  });
});

describe('parseResponseWithRetry — 스키마 밖 응답 → 재시도 트리거', () => {
  it('첫 응답이 스키마를 벗어나면 1회 재시도하고, 두 번째 응답이 유효하면 그것을 반환한다', async () => {
    const callGemini = jest
      .fn()
      .mockResolvedValueOnce('이건 JSON이 아니라 그냥 텍스트입니다')
      .mockResolvedValueOnce(VALID_JSON);

    const result = await parseResponseWithRetry(callGemini, 'avoidance', '질문 텍스트', '사용자 답변');

    expect(callGemini).toHaveBeenCalledTimes(2);
    expect(result).toEqual(JSON.parse(VALID_JSON));
    // 재시도 프롬프트(2번째 호출)에는 스키마 강제 리마인더가 포함되어야 한다
    const secondPrompt = callGemini.mock.calls[1][0] as string;
    expect(secondPrompt).toContain('반드시 지정된 JSON 스키마만 출력하라');
  });

  it('필수 필드가 빠진 JSON(스키마는 맞지만 값이 무효)도 재시도를 트리거한다', async () => {
    const invalidButJson = JSON.stringify({ target_dimension: 'N', normalized_value: 2.0, confidence: 0.5, extracted_evidence: 'x' });
    const callGemini = jest.fn().mockResolvedValueOnce(invalidButJson).mockResolvedValueOnce(VALID_JSON);

    const result = await parseResponseWithRetry(callGemini, 'avoidance', '질문 텍스트', '사용자 답변');
    expect(callGemini).toHaveBeenCalledTimes(2);
    expect(result.confidence).toBe(0.8);
  });
});

describe('parseResponseWithRetry — 재시도도 실패 → confidence:0 폴백', () => {
  it('두 번 모두 무효 응답이면 폴백을 반환하고 정확히 2번만 호출한다', async () => {
    const callGemini = jest.fn().mockResolvedValue('여전히 JSON이 아님');

    const result = await parseResponseWithRetry(callGemini, 'anxiety', '질문 텍스트', '모호한 답변');

    expect(callGemini).toHaveBeenCalledTimes(2);
    expect(result).toEqual(buildFallbackResponse('anxiety'));
    expect(result.confidence).toBe(0);
  });

  it('네트워크 오류(reject)가 반복돼도 폴백으로 안전하게 종료된다', async () => {
    const callGemini = jest.fn().mockRejectedValue(new Error('network down'));

    const result = await parseResponseWithRetry(callGemini, 'O', '질문 텍스트', '답변');

    expect(callGemini).toHaveBeenCalledTimes(2);
    expect(result.confidence).toBe(0);
  });
});

describe('generateUtterance — 발화 생성 (재시도 없음, 스키마 강제 없음)', () => {
  it('callGemini를 정확히 한 번 호출하고 결과를 그대로 반환한다', async () => {
    const callGemini = jest.fn().mockResolvedValue('오늘 하루 어땠어? 편하게 말해줘~');
    const result = await generateUtterance(callGemini, 'O', '구체적인 계획 없이 여행을 떠나는 것, 끌리시나요?');

    expect(result).toBe('오늘 하루 어땠어? 편하게 말해줘~');
    expect(callGemini).toHaveBeenCalledTimes(1);
  });
});

describe('프롬프트 빌더', () => {
  it('buildGeneratePrompt는 차원과 질문 텍스트를 그대로 포함한다', () => {
    const prompt = buildGeneratePrompt('avoidance', '질문 텍스트입니다');
    expect(prompt).toContain('avoidance');
    expect(prompt).toContain('질문 텍스트입니다');
  });

  it('buildParsePrompt는 attempt=0일 때 강한 리마인더가 없다', () => {
    const prompt = buildParsePrompt('N', '질문', '답변', 0);
    expect(prompt).not.toContain('반드시 지정된 JSON 스키마만 출력하라');
  });
});
