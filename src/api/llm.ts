import { supabase } from '@/lib/supabaseClient';

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
