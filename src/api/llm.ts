import { supabase, supabaseUrl } from '@/lib/supabaseClient';

export interface LLMRequest {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
}

export async function callLLM(request: LLMRequest): Promise<LLMResponse> {
  const { data, error } = await supabase.functions.invoke('llm-route', {
    body: request,
  });

  if (error) {
    throw new Error(`LLM 호출 실패: ${error.message}`);
  }

  return data as LLMResponse;
}

export async function callLLMStream(
  request: LLMRequest,
  onChunk: (text: string) => void,
  onDone: () => void,
): Promise<void> {
  const session = await supabase.auth.getSession();

  const response = await fetch(`${supabaseUrl}/functions/v1/llm-route`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.data.session?.access_token}`,
      'Content-Type': 'application/json',
      'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({ ...request, stream: true }),
  });

  if (!response.ok || !response.body) {
    const err = await response.text();
    throw new Error(`LLM 스트리밍 호출 실패: ${err}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;

      try {
        const json = JSON.parse(payload);
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) onChunk(text);
      } catch {
        // 불완전한 JSON 조각은 무시
      }
    }
  }

  onDone();
}
