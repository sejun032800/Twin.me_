// ─── adaptive-interview Edge Function (구현명세서 §6) ─────────────────────────
// llm-route/index.ts와 완전히 분리된 별도 엔드포인트다(공유 import 없음). 역할은
// 정확히 두 가지로 한정한다:
//   action: "generate" — adaptiveEngine이 고른 문항을 자연스러운 대화체로 포장
//   action: "parse"    — 자유서술 답변 → §6 JSON 계약으로 구조화, 실패 시 1회
//                        재시도 후 confidence:0 폴백(파싱/재시도 로직은 parsing.ts)
// Gemini 모델은 llm-route와 동일하게 gemini-2.5-flash를 유지한다.

import {
  generateUtterance,
  parseResponseWithRetry,
  RESPONSE_JSON_SCHEMA,
  type ParsedInterviewResponse,
} from './parsing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_MODEL = 'gemini-2.5-flash';

async function callGemini(prompt: string, useJsonSchema: boolean): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      // 파싱(parse)은 결정론적으로 스키마를 지키도록 낮은 온도, 발화 생성(generate)은
      // 자연스러운 대화체가 나오도록 llm-route와 동일한 온도(0.9)를 사용한다.
      temperature: useJsonSchema ? 0.2 : 0.9,
      ...(useJsonSchema ? { responseMimeType: 'application/json', responseSchema: RESPONSE_JSON_SCHEMA } : {}),
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API 오류: ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, targetDimension, questionText, userResponseText } = await req.json();

    if (!action || !targetDimension || !questionText) {
      return new Response(
        JSON.stringify({ error: 'action, targetDimension, questionText가 필요합니다' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'generate') {
      const utterance = await generateUtterance((p) => callGemini(p, false), targetDimension, questionText);
      return new Response(JSON.stringify({ utterance }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'parse') {
      if (!userResponseText) {
        return new Response(
          JSON.stringify({ error: 'userResponseText가 필요합니다' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const parsed: ParsedInterviewResponse = await parseResponseWithRetry(
        (p) => callGemini(p, true),
        targetDimension,
        questionText,
        userResponseText,
      );
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: `알 수 없는 action: ${action} (generate|parse만 허용)` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
