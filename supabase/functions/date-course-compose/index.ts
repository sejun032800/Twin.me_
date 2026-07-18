// ─── date-course-compose Edge Function (date-recommend-architecture.md 레이어5, MASTER.md §7 FUN-HIS-002) ──
// llm-route와 완전히 분리된 별도 엔드포인트다(llm-route/index.ts는 수정하지 않았다) —
// JSON 스키마를 강제하는 별도 계약이라 공유 코드 없이 독립적으로 둔다.
//
// 이 함수의 유일한 존재 이유: 레이어4가 검증한 후보(candidatePool)의 candidateId
// 안에서만 LLM이 고르게 하는 것. compose.ts의 validateComposedCourses()가 그 보장을
// 담당하며, 이 파일은 그 결과를 그대로 반환한다 — 검증을 우회해 Gemini 원본 응답을
// 그대로 내보내는 경로를 절대 추가하지 않는다.
//
// Gemini responseSchema(COMPOSE_RESPONSE_JSON_SCHEMA)로 1차 방어(구조 강제)를 걸고,
// validateComposedCourses()로 2차 방어(내용 검증 — candidateId 실존 여부)를 건다.
// adaptive-interview가 "parse" action에서 쓰는 것과 동일한 Gemini structured output
// 패턴(responseMimeType: 'application/json' + responseSchema)을 재사용한다.

import { buildComposePrompt, validateComposedCourses, COMPOSE_RESPONSE_JSON_SCHEMA, type PromptCandidate, type AnonymizedCoupleContext } from './compose.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_MODEL = 'gemini-2.5-flash';

async function callGemini(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      // 코스 조립은 후보 리스트 안에서만 골라야 하는 결정론적 과제라 낮은 온도를 쓴다
      // (adaptive-interview의 "parse" action과 동일한 근거).
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: COMPOSE_RESPONSE_JSON_SCHEMA,
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
    const { candidates, context } = (await req.json()) as {
      candidates?: PromptCandidate[];
      context?: AnonymizedCoupleContext;
    };

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return new Response(
        JSON.stringify({ error: 'candidates가 필요합니다(빈 배열 불가)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!context) {
      return new Response(
        JSON.stringify({ error: 'context가 필요합니다' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const prompt = buildComposePrompt(candidates, context);

    let rawText: string;
    try {
      rawText = await callGemini(prompt);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: `LLM 호출 실패: ${String(err)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // 스키마 강제(responseSchema)가 실패한 극단적 경우 — 빈 결과로 안전하게 폴백한다.
      // (courses:[]는 "제안할 것이 없다"로 해석되어야지, 검증되지 않은 텍스트를 courses로
      // 둔갑시켜서는 안 된다.)
      return new Response(
        JSON.stringify({ courses: [], discardedCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ★ 2차 안전장치 — 이 호출을 절대 생략하지 않는다.
    const { courses, discardedCount } = validateComposedCourses(parsed, candidates);

    return new Response(
      JSON.stringify({ courses, discardedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
