// ─── date-course-compose 프롬프트/검증 로직 (순수 TS — Deno API 미사용, Jest로 테스트 가능) ──
// date-recommend-architecture.md 레이어5, MASTER.md §7 FUN-HIS-002 "LLM 구성 계약".
// index.ts(Deno.serve, Gemini 호출)와 분리해 adaptive-interview/parsing.ts와 동일한
// 패턴을 따른다 — 여기서는 "무엇을 프롬프트로 보낼지"와 "받은 응답을 신뢰해도 되는지"만
// 순수 함수로 판단한다.
//
// 이 파일은 src/services/*를 import하지 않는다 — Edge Function은 배포 단위가
// 독립적이라(supabase/functions/<name>/ 디렉터리 하나가 그대로 배포됨) src/ 트리에
// 의존하면 안 된다. 그래서 RecommendationCandidate(src/services/dateRecommendationService.ts)와
// 구조적으로 겹치지만 이 파일 안에서 자체적으로 정의한 PromptCandidate를 쓴다 — 호출
// 클라이언트가 RecommendationCandidate를 PromptCandidate로 매핑해서 보낸다.
//
// ★★★ 이 파일의 핵심 존재 이유(레이어5 전체의 유일한 존재 이유) ★★★
// validateComposedCourses()가 없으면 LLM이 지어낸 장소가 그대로 사용자에게 노출될 수
// 있다. 이 함수를 호출하지 않고 Gemini 응답을 그대로 반환하는 코드 경로를 index.ts에
// 만들면 절대 안 된다.

export interface PromptCandidate {
  candidateId: string; // RecommendationCandidate.candidateId 그대로(예: 'place:kakao123', 'course:abc')
  name: string;
  kind: string; // 'similar_course' | 'nearby_place'
  reason: string;
  detail: string; // 사람이 읽는 부가 설명(태그 목록 또는 카테고리명) — 프롬프트 렌더링용
}

// MASTER.md §7 익명화 규칙 — 전송 허용 5개 필드만 담는다. couple_id/user_id/리뷰 원문은
// 이 타입에 아예 필드 자체가 없다(타입 설계로 원천 차단 — 나중에 필드를 추가하고 싶다면
// 반드시 MASTER §7 익명화 규칙을 다시 확인할 것).
export interface AnonymizedCoupleContext {
  tags: string[];
  avgRatingBand: number; // 평균 평점대(숫자만)
  areaLabel: string; // 지역(구/동 단위까지)
  budgetLabel: string; // 예산대 라벨
  unvisitedCategories: string[]; // 안 해본 카테고리 목록
}

/** Gemini structured output(responseSchema)에 그대로 전달하는 JSON 스키마. */
export const COMPOSE_RESPONSE_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    courses: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          candidateIds: { type: 'ARRAY', items: { type: 'STRING' } },
          theme: { type: 'STRING' },
          copy: { type: 'STRING' },
        },
        required: ['candidateIds', 'theme', 'copy'],
      },
    },
  },
  required: ['courses'],
} as const;

export function buildComposePrompt(candidates: PromptCandidate[], context: AnonymizedCoupleContext): string {
  const candidateLines = candidates
    .map((c) => `- id="${c.candidateId}" | 이름: ${c.name} | ${c.detail} | 선정 근거: ${c.reason}`)
    .join('\n');

  return [
    '너는 커플을 위한 데이트 코스를 큐레이션하는 AI다.',
    '',
    '★ 절대 규칙: 아래 [후보 리스트]에 있는 id 중에서만 골라 코스를 구성하라.',
    '[후보 리스트]에 없는 id, 없는 장소 이름, 없는 코스를 절대 새로 만들어내지 마라.',
    '후보 리스트에 마음에 드는 것이 없더라도 있는 것 중에서만 골라야 한다.',
    '',
    `커플 취향 태그: ${context.tags.join(', ') || '정보 없음'}`,
    `평균 평점대: ${context.avgRatingBand}`,
    `지역: ${context.areaLabel}`,
    `예산대: ${context.budgetLabel}`,
    `안 해본 카테고리: ${context.unvisitedCategories.join(', ') || '없음'}`,
    '',
    '[후보 리스트]',
    candidateLines,
    '',
    '위 후보들로 최대 3개의 코스를 제안하라. 각 코스는 다음을 포함한다:',
    '- candidateIds: 방문 순서대로 정렬된 후보 id 배열(위 후보 리스트의 id를 그대로 사용, 최소 1개)',
    '- theme: 코스 테마를 나타내는 짧은 제목',
    '- copy: 왜 이 커플에게 맞는 코스인지 1~2문장 설명',
    '너의 역할은 순서 배치·테마 서술·설명 문구 작성으로 한정된다. 장소 자체를 만들어내는 것은 너의 역할이 아니다.',
  ].join('\n');
}

export interface ComposedCourseRaw {
  candidateIds: string[];
  theme: string;
  copy: string;
}

export interface ValidatedComposeResult {
  courses: ComposedCourseRaw[];
  discardedCount: number; // 후처리 검증에서 폐기된 코스 항목 수(관측성용)
}

function isWellFormedCourse(raw: unknown): raw is ComposedCourseRaw {
  if (typeof raw !== 'object' || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.candidateIds) || obj.candidateIds.length === 0) return false;
  if (!obj.candidateIds.every((id) => typeof id === 'string')) return false;
  if (typeof obj.theme !== 'string' || obj.theme.length === 0) return false;
  if (typeof obj.copy !== 'string' || obj.copy.length === 0) return false;
  return true;
}

/**
 * ★ 레이어5의 핵심 안전장치(2차 검증) ★
 * LLM이 반환한 각 코스 항목에 대해, 그 코스가 참조하는 candidateId가 전부(하나도
 * 빠짐없이) 원래 후보 리스트(candidatePool)에 실존하는지 대조한다.
 *
 * 부분 신뢰 금지 원칙: 코스 하나에 candidateId 3개가 있는데 그중 1개라도 후보
 * 리스트에 없으면, 나머지 2개가 유효하더라도 그 코스 항목 전체를 폐기한다(유효한
 * candidateId만 골라 살리는 "부분 구제"를 하지 않는다) — LLM이 하나를 지어냈다는 것은
 * 그 코스 항목의 나머지 판단(순서·테마·문구)도 같은 환각의 산물일 수 있다는 뜻이므로,
 * 항목 전체를 신뢰할 수 없다고 본다.
 *
 * 스키마 자체가 깨진 항목(candidateIds가 배열이 아니거나, theme/copy 누락 등)도
 * 동일하게 폐기 대상이다 — Gemini responseSchema가 구조를 강제하긴 하지만, 이건 그
 * 강제가 실패했을 때를 대비한 방어선이다(2차 안전장치이므로 1차 방어를 신뢰하지 않는다).
 */
export function validateComposedCourses(rawResponse: unknown, candidatePool: PromptCandidate[]): ValidatedComposeResult {
  const validIds = new Set(candidatePool.map((c) => c.candidateId));

  if (typeof rawResponse !== 'object' || rawResponse === null) {
    return { courses: [], discardedCount: 0 };
  }
  const rawCourses = (rawResponse as Record<string, unknown>).courses;
  if (!Array.isArray(rawCourses)) {
    return { courses: [], discardedCount: 0 };
  }

  const courses: ComposedCourseRaw[] = [];
  let discardedCount = 0;

  for (const rawCourse of rawCourses) {
    if (!isWellFormedCourse(rawCourse)) {
      discardedCount++;
      continue;
    }
    const allCandidateIdsExist = rawCourse.candidateIds.every((id) => validIds.has(id));
    if (!allCandidateIdsExist) {
      discardedCount++;
      continue;
    }
    courses.push(rawCourse);
  }

  return { courses, discardedCount };
}
