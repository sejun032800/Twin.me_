// ─── LLM JSON 응답 파싱 헬퍼 ──────────────────────────────────────────────────
// callLLM 응답에 ```json ... ``` 코드펜스나 부연 설명이 섞여 오는 경우를 대비해
// JSON.parse 전에 코드펜스 안쪽만 추출한다. 코드펜스가 없으면 원문 그대로 사용.

const JSON_CODE_FENCE_RE = /```(?:json)?\s*([\s\S]*?)```/i;

export function extractJsonContent(content: string): string {
  const match = content.match(JSON_CODE_FENCE_RE);
  return match ? match[1].trim() : content.trim();
}
