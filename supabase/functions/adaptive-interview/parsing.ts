// ─── adaptive-interview 응답 파싱 로직 (순수 TS — Deno API 미사용, Jest로 테스트 가능) ──
// 구현명세서 §6 Edge Function 계약. Gemini 호출 자체(네트워크 I/O)는 index.ts가
// 담당하고, 여기서는 "무엇을 프롬프트로 보낼지"와 "받은 텍스트가 유효한 JSON
// 계약을 만족하는지"만 순수 함수로 판단한다 — callGemini를 인자로 주입받으므로
// 실제 Gemini API를 호출하지 않고도(mock) 재시도·폴백 로직을 전부 테스트할 수 있다.
//
// llm-route/index.ts를 import하지 않는다 — 완전히 분리된 엔드포인트.

export interface ParsedInterviewResponse {
  target_dimension: string;
  normalized_value: number;
  confidence: number;
  extracted_evidence: string;
}

/** 구현명세서 §6 — Gemini structured output(responseSchema)에 그대로 전달하는 JSON 스키마. */
export const RESPONSE_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    target_dimension: { type: 'STRING' },
    normalized_value: { type: 'NUMBER' },
    confidence: { type: 'NUMBER' },
    extracted_evidence: { type: 'STRING' },
  },
  required: ['target_dimension', 'normalized_value', 'confidence', 'extracted_evidence'],
} as const;

/** (a) 발화 생성 — adaptiveEngine이 고른 문항을 자연스러운 대화체로 포장한다. */
export function buildGeneratePrompt(targetDimension: string, questionText: string): string {
  return [
    '너는 사용자와 대화하며 연애 성향을 파악하는 AI 트윈이다.',
    '다음 질문을 자연스러운 대화체로 사용자에게 건네라(연결어·리액션 포함, 질문의 의미는 바꾸지 말 것):',
    `[차원: ${targetDimension}] ${questionText}`,
  ].join('\n');
}

/** (b) 응답 파싱 — 자유서술 답변을 §6 JSON 스키마로 변환하도록 지시하는 프롬프트. */
export function buildParsePrompt(
  targetDimension: string,
  questionText: string,
  userResponseText: string,
  attempt = 0,
): string {
  const strictReminder =
    attempt > 0 ? '\n\n반드시 지정된 JSON 스키마만 출력하라. 스키마 밖의 텍스트나 설명을 절대 덧붙이지 마라.' : '';
  return [
    '너는 사용자의 자유서술 답변을 구조화된 수치로 변환하는 파서다.',
    `질문(차원: ${targetDimension}): ${questionText}`,
    `사용자 답변: ${userResponseText}`,
    '',
    '이 답변을 바탕으로 target_dimension(차원 이름 그대로), normalized_value([0,1] 정규화 값),',
    'confidence([0,1] 확신도 — 답변이 모호하거나 질문과 무관하면 낮게), extracted_evidence(판단 근거를 자체 언어로 1문장 요약)를',
    'JSON으로만 반환하라.' + strictReminder,
  ].join('\n');
}

/** 파싱된 값이 §6 계약(타입·범위)을 만족하는지 검증한다. 하나라도 어긋나면 null. */
export function validateParsedResponse(raw: unknown): ParsedInterviewResponse | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const { target_dimension, normalized_value, confidence, extracted_evidence } = obj;

  if (typeof target_dimension !== 'string' || target_dimension.length === 0) return null;
  if (typeof normalized_value !== 'number' || Number.isNaN(normalized_value) || normalized_value < 0 || normalized_value > 1) {
    return null;
  }
  if (typeof confidence !== 'number' || Number.isNaN(confidence) || confidence < 0 || confidence > 1) return null;
  if (typeof extracted_evidence !== 'string') return null;

  return { target_dimension, normalized_value, confidence, extracted_evidence };
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * 파싱 실패 시 폴백 — confidence:0으로 반환해, 이 값을 소비하는 bayesianUpdate.ts의
 * 정규-정규 켤레 갱신에서 σ_obs가 극단적으로 커지도록(즉 사전분포가 그대로 유지되도록)
 * 하는 안전장치다(구현명세서 §6).
 */
export function buildFallbackResponse(targetDimension: string): ParsedInterviewResponse {
  return {
    target_dimension: targetDimension,
    normalized_value: 0.5,
    confidence: 0,
    extracted_evidence: '파싱 실패 — 사전분포를 그대로 유지합니다.',
  };
}

export type GeminiCaller = (prompt: string) => Promise<string>;

/**
 * 구현명세서 §6 — 파싱 실패(모호한 답변, 스키마 밖 응답) 시 1회 재시도하고, 그래도
 * 실패하면 confidence:0 폴백을 반환한다. callGemini는 실제 Gemini 호출(index.ts) 또는
 * 테스트용 mock을 그대로 주입받는 순수 오케스트레이션 함수다.
 */
export async function parseResponseWithRetry(
  callGemini: GeminiCaller,
  targetDimension: string,
  questionText: string,
  userResponseText: string,
  maxRetries = 1,
): Promise<ParsedInterviewResponse> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const prompt = buildParsePrompt(targetDimension, questionText, userResponseText, attempt);
    let raw: string;
    try {
      raw = await callGemini(prompt);
    } catch {
      continue; // 네트워크/API 오류도 재시도 대상으로 취급
    }
    const parsed = tryParseJson(raw);
    const validated = parsed !== null ? validateParsedResponse(parsed) : null;
    if (validated) return validated;
  }
  return buildFallbackResponse(targetDimension);
}

/** 발화 생성은 스키마 강제가 필요 없으므로 재시도 없이 그대로 반환한다. */
export async function generateUtterance(
  callGemini: GeminiCaller,
  targetDimension: string,
  questionText: string,
): Promise<string> {
  return callGemini(buildGeneratePrompt(targetDimension, questionText));
}
