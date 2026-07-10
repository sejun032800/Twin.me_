// ─── FUN-CHA — AI 뮤즈 (MASTER.md §4, 구버전 aiMuseService.ts 이식) ───────────────
// 대화 맥락과 관계 상태를 바탕으로 연인에게 보낼 감성적인 메시지 3가지를 제안한다.

import { callLLM } from '@/api/llm';
import { extractJsonContent } from '@/lib/llmJson';

export type MuseCategory = '애정' | '위로' | '응원' | '유머' | '감사';

export interface MuseSuggestion {
  text: string;
  category: MuseCategory;
}

export interface MuseContext {
  recentMessages: string[];
  partnerName: string;
  score: number;
}

const FALLBACK_SUGGESTIONS: MuseSuggestion[] = [
  { text: '오늘 하루도 수고했어 💙', category: '위로' },
  { text: '네 생각이 나서', category: '애정' },
  { text: '보고 싶다', category: '애정' },
];

export async function generateMuseSuggestions(context: MuseContext): Promise<MuseSuggestion[]> {
  try {
    const response = await callLLM({
      systemPrompt: `당신은 연애 감성 작가입니다.
   주어진 대화 맥락과 관계 상태를 보고
   연인에게 보낼 따뜻한 메시지 3가지를 제안해주세요.
   각 메시지는 50자 이내로, 자연스러운 한국어로 작성해주세요.
   반드시 아래 JSON 형식으로만 응답하세요:
   [{"text":"...", "category":"애정"}, ...]`,
      userMessage: JSON.stringify(context),
    });

    const parsed = JSON.parse(extractJsonContent(response.content)) as MuseSuggestion[];
    if (!Array.isArray(parsed) || parsed.length === 0) return FALLBACK_SUGGESTIONS;
    return parsed;
  } catch {
    return FALLBACK_SUGGESTIONS;
  }
}
