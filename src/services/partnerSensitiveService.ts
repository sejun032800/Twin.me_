// ─── FUN-CHA — 파트너 민감 감지 (MASTER.md §4, 구버전 partnerSensitiveService.ts 이식) ─
// 채팅 전송 전 텍스트를 순수 함수로 검사해 민감한 표현 패턴을 감지한다.
// LLM 호출 없이 즉시 응답하며, 전송을 막지 않고 조심스러운 넛지만 제공한다.

export type SensitiveCategory = '갈등' | '비교' | '압박' | '무시';

export interface SensitiveDetection {
  detected: boolean;
  category: SensitiveCategory | null;
  suggestion: string | null;
}

const SENSITIVE_PATTERNS: Record<SensitiveCategory, string[]> = {
  갈등: ['짜증', '화나', '싫어', '왜 그래', '또', '항상', '절대'],
  비교: ['다른 사람', '친구는', '옛날엔', '전에는'],
  압박: ['빨리', '당장', '지금 당장', '해야지', '해야 해'],
  무시: ['됐어', '알았어', '몰라', '상관없어'],
};

const SUGGESTIONS: Record<SensitiveCategory, string> = {
  갈등: '조금 감정이 격해진 것 같아요. 잠깐 숨 고르고 얘기해볼까요?',
  비교: '비교는 상대방에게 상처가 될 수 있어요.',
  압박: '조급함이 느껴져요. 천천히 얘기해봐요.',
  무시: '이 표현이 상대방을 섭섭하게 할 수 있어요.',
};

export function detectSensitiveContent(text: string): SensitiveDetection {
  for (const category of Object.keys(SENSITIVE_PATTERNS) as SensitiveCategory[]) {
    const patterns = SENSITIVE_PATTERNS[category];
    if (patterns.some((pattern) => text.includes(pattern))) {
      return { detected: true, category, suggestion: SUGGESTIONS[category] };
    }
  }

  return { detected: false, category: null, suggestion: null };
}
