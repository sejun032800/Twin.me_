// ─── 적응형 인터뷰 문항뱅크 (v2.1 §7, Strangler Fig 신규 독립 모듈) ────────────
// 기존 src/data/genesisQuestionBank.ts 를 import하지 않는다. 문항 텍스트는 v2.1
// 문서(docs/spec/연애_DNA_일치율_공식_v2.1.md §7.1~§7.3)를 요약·의역 없이 그대로 옮겼다.
//
// 3계층 구조 (§7):
//   common        — §7.1 공통질문 세트 (생활 일반, 전 사용자 공통)
//   romantic      — §7.2 연애 맥락 질문 세트 (연애 경험으로 재구성)
//   mbti_specific — §7.3 MBTI별 애니어그램 판별 질문 세트 (16 MBTI × 2문항)

export type CommonDimension = 'avoidance' | 'anxiety' | 'N' | 'O' | 'C' | 'E' | 'A';
export type RomanticDimension = 'N' | 'O' | 'C' | 'E' | 'A'; // §7.2 — 회피·불안은 §7.1 재사용(문서 §7.2 서두)
export type TargetDimension = CommonDimension | 'enneagram_core' | 'enneagram_wing' | 'sternberg';
export type QuestionTier = 'common' | 'romantic' | 'mbti_specific';
export type SternbergComponent = 'intimacy' | 'passion' | 'commitment';

export interface QuestionBankEntry {
  id: string;
  targetDimension: TargetDimension;
  tier: QuestionTier;
  text: string;
  /** tier==='mbti_specific'일 때만 존재 */
  mbtiType?: string;
  /** tier==='mbti_specific'일 때 §2·§5.4 기준 상위 후보 애니어그램 유형(예: ['1','6','5']) */
  topCandidates?: string[];
  /** targetDimension==='sternberg'일 때만 존재 */
  sternbergComponent?: SternbergComponent;
  /** 같은 (targetDimension, tier[, mbtiType/sternbergComponent]) 그룹 내 1-based 순번 */
  variantIndex: number;
}

// ── 7.1 공통질문 세트 ─────────────────────────────────────────────────────────

const COMMON_AVOIDANCE: string[] = [
  '감정적으로 아주 가까워지는 관계가 되면 오히려 불편해지는 편인가요, 더 편안해지는 편인가요?',
  '힘든 일이 있을 때, 누군가에게 털어놓는 편인가요, 혼자 정리하고 넘어가는 편인가요?',
  '연인이 하루 일과를 시시콜콜 궁금해하면 어떤 기분이 드세요?',
  "관계에서 '적당한 거리감'과 '가까운 밀착' 중 더 편안한 쪽은요?",
];

const COMMON_ANXIETY: string[] = [
  '연인의 연락이 평소보다 뜸해지면 어떤 생각이 가장 먼저 드시나요?',
  '상대방이 오늘따라 좀 시큰둥해 보이면, 이유를 계속 생각하게 되는 편인가요?',
  "'이 사람이 날 정말 좋아하는 게 맞나' 하는 의심이 관계에서 자주 드는 편인가요?",
  '다투고 난 뒤, 화해하기 전까지 마음이 얼마나 불편하신가요?',
];

const COMMON_N: string[] = [
  '예상치 못한 안 좋은 일이 생겼을 때, 그 감정이 얼마나 오래 가는 편인가요?',
  '스트레스 받는 상황에서 몸이나 마음에 티가 잘 나는 편인가요?',
  '하루 중 안 좋았던 일 하나가 나머지 시간 전체 기분을 좌우하는 편인가요?',
  '화가 나거나 속상할 때, 그 감정이 비교적 쉽게 가라앉는 편인가요?',
];

const COMMON_O: string[] = [
  '구체적인 계획 없이 여행을 떠나는 것, 끌리시나요 부담스러우신가요?',
  '늘 가던 맛집 vs 한 번도 안 가본 식당, 둘 중 더 끌리는 선택은요?',
  '낯설고 실험적인 영화나 예술작품에 흥미가 가는 편인가요?',
  "새로운 아이디어를 접했을 때 먼저 드는 생각이 '오 재밌다'인가요, '음 글쎄'인가요?",
];

const COMMON_C: string[] = [
  '세운 계획은 웬만하면 그대로 지키는 편인가요, 상황 따라 유동적으로 바꾸는 편인가요?',
  '마감이 다가올 때, 미리 끝내놓는 편인가요 막판에 몰아서 하는 편인가요?',
  '방이나 책상 정리 상태, 스스로 어떻게 평가하세요?',
  '약속시간에 여유있게 도착하는 편인가요, 아슬아슬하게 맞추는 편인가요?',
];

const COMMON_E: string[] = [
  '낯선 사람들 사이에 있을 때 에너지가 차오르나요, 소모되나요?',
  '주말에 에너지를 충전하는 방법이 사람 만나는 쪽인가요, 혼자만의 시간인가요?',
  '모임에서 먼저 말을 거는 편인가요, 누가 먼저 걸어주길 기다리는 편인가요?',
  '긴 하루 끝에 누군가와 수다 떨고 싶어지나요, 혼자 조용히 있고 싶어지나요?',
];

const COMMON_A: string[] = [
  '의견 충돌이 생기면, 상대 입장을 먼저 이해하려는 편인가요, 내 입장을 먼저 설명하는 편인가요?',
  '누군가 부탁을 해오면, 거절하기 어려운 편인가요, 필요하면 편하게 거절하는 편인가요?',
  '다른 사람이 잘못했을 때, 이해하고 넘어가는 편인가요, 짚고 넘어가는 편인가요?',
  '의견 조율에서 내가 좀 손해봐도 괜찮다는 쪽인가요, 공정하게 반반이어야 한다는 쪽인가요?',
];

const COMMON_ENNEAGRAM_OPENER: string[] = [
  '요즘 스트레스를 받을 때 가장 먼저 드는 생각이나 행동 패턴을 말씀해주실 수 있나요?',
  '스스로 생각하기에, 내가 제일 두려워하는 상황은 어떤 건가요?',
  '사람들이 나에 대해 종종 오해하는 게 있다면 뭘까요?',
];

/** §9 코어 확정 후 날개 판별 후속질문 템플릿 — [코어유형 설명]/[날개①]/[날개②] 플레이스홀더는 호출 시 치환한다. */
export const ENNEAGRAM_WING_TEMPLATE =
  '방금 말씀하신 스타일이 [코어유형 설명]에 가까운데, 그 안에서도 [날개①] 쪽에 더 가까우세요, [날개②] 쪽에 더 가까우세요?';

/** §7.1 스턴버그 관계상태(고정 3문항, 각 2개 변형) */
const COMMON_STERNBERG: Record<SternbergComponent, string[]> = {
  intimacy: ['이 사람과 있으면 깊이 이해받는다고 느끼나요?', '이 사람에게는 뭐든 편하게 얘기할 수 있나요?'],
  passion: ['이 사람에게 신체적·감정적 끌림을 느끼나요?', '이 사람을 생각하면 아직 설레는 마음이 있나요?'],
  commitment: ['이 관계를 장기적으로 지속하고 싶나요?', '이 사람과의 미래를 구체적으로 그려본 적 있나요?'],
};

// ── 7.2 연애 맥락 질문 세트 ────────────────────────────────────────────────────
// "7.1의 회피·불안 문항은 이미 '연인' 상황을 소재로 삼고 있어 그대로 두고,
//  나머지 차원을 연애 경험으로 재구성한 변형을 추가한다" (§7.2 서두)

const ROMANTIC_N: string[] = [
  '연애 중 다툼이 생기면, 그 여운이 며칠씩 가는 편인가요, 금방 털어내는 편인가요?',
  '상대의 말 한마디에 서운함이 오래 남는 편인가요?',
  '헤어짐이나 권태기처럼 힘든 시기를 겪고 나면, 일상으로 돌아오기까지 보통 얼마나 걸리는 편인가요?',
];

const ROMANTIC_O: string[] = [
  '연애할 때 판에 박힌 데이트보다 즉흥적이고 새로운 데이트를 더 좋아하는 편인가요?',
  '연인과 가치관이나 인생관 같은 걸 깊게 토론하는 걸 즐기는 편인가요?',
  '연애 스타일이 만나는 사람마다 매번 비슷한 편인가요, 상대에 따라 나도 많이 달라지는 편인가요?',
];

const ROMANTIC_C: string[] = [
  '기념일이나 서로의 약속을 꼼꼼히 챙기는 편인가요, 즉흥적으로 챙기는 편인가요?',
  '연애 중 미래 계획(동거, 결혼 등)을 구체적으로 미리 얘기해두는 편인가요?',
  '다툼이 생기면, 원인을 논리적으로 정리해서 대화로 풀어가는 편인가요?',
];

const ROMANTIC_E: string[] = [
  '연인과 있을 때, 둘이서만 조용히 있는 데이트가 좋나요, 사람들과 어울리는 데이트가 좋나요?',
  '썸 타는 단계에서, 먼저 적극적으로 다가가는 편인가요, 상대가 다가오길 기다리는 편인가요?',
  '연인과 다투고 나서, 친구들에게 바로 털어놓는 편인가요, 혼자 삭이는 편인가요?',
];

const ROMANTIC_A: string[] = [
  '연인과 의견이 갈릴 때, 맞춰주는 편인가요, 내 의견을 관철하는 편인가요?',
  '연인이 실수했을 때, 너그럽게 넘어가는 편인가요, 짚고 넘어가는 편인가요?',
  '데이트 코스나 메뉴를 정할 때, 상대 의견을 우선하는 편인가요?',
];

const ROMANTIC_ENNEAGRAM_OPENER: string[] = [
  '연애할 때 나도 모르게 반복되는 패턴이 있다면 뭘까요?',
  '전 연인에게 가장 많이 들었던 말이나 별명이 있다면요?',
  '연애에서 제일 참기 힘든 순간은 언제인가요?',
  "'나 진짜 연애할 때 이런 건 못 참아' 하는 게 있다면요?",
];

// ── 7.3 MBTI별 애니어그램 판별 질문 세트 (표 그대로, 16유형 × 2문항) ─────────────

interface MbtiDiscriminatorRow {
  mbti: string;
  topCandidates: string[];
  questions: [string, string];
}

const MBTI_DISCRIMINATOR_TABLE: MbtiDiscriminatorRow[] = [
  {
    mbti: 'ISTJ',
    topCandidates: ['1', '6', '5'],
    questions: [
      "규칙을 지키는 이유가 '이게 옳으니까'에 가까운가요, '이래야 불안하지 않으니까'에 가까운가요?",
      '중요한 결정 앞에서, 믿을 만한 사람들 의견을 구하는 편인가요, 혼자 충분히 조사한 뒤 결정하는 편인가요?',
    ],
  },
  {
    mbti: 'ISFJ',
    topCandidates: ['6', '1', '9'],
    questions: [
      "걱정될 때 '최악의 상황에 대비해야 해'와 '내가 더 완벽했어야 했는데', 어느 쪽 생각이 더 자주 드나요?",
      '갈등 상황에서 상대가 날 어떻게 생각할지 계속 신경쓰이나요, 그냥 조용히 넘어가고 싶은 마음이 더 큰가요?',
    ],
  },
  {
    mbti: 'INFJ',
    topCandidates: ['6', '5', '1'],
    questions: [
      '불안하거나 확신이 안 설 때, 믿는 사람에게 확인받고 싶어지나요, 혼자 더 파고들어 답을 찾고 싶어지나요?',
      "통찰을 쌓는 이유가 '세상을 더 정확히 이해하고 싶어서'인가요, '옳은 방향으로 이끌고 싶어서'인가요?",
    ],
  },
  {
    mbti: 'INTJ',
    topCandidates: ['5', '1', '6'],
    questions: [
      "혼자 있을 때 생각이 '이 문제를 더 깊이 이해하고 싶다'에 가깝나요, '이게 더 나은 방식이었을 텐데'처럼 개선점을 찾는 쪽에 가깝나요?",
      "계획이 틀어졌을 때, '내가 더 철저했어야 했다'는 자책이 큰가요, '예상 못한 변수가 생길 줄 알았다'는 확인 쪽에 가까운가요?",
    ],
  },
  {
    mbti: 'ISTP',
    topCandidates: ['9', '5', '4'],
    questions: [
      "혼자만의 시간이 필요한 이유가 '그냥 조용히 흘러가는 게 편해서'인가요, '집중해서 뭔가를 깊이 파고들고 싶어서'인가요?",
      '몰입하는 대상이 어떤 원리·시스템을 이해하는 쪽에 가깝나요, 나만의 감각이나 취향을 표현하는 쪽에 가깝나요?',
    ],
  },
  {
    mbti: 'ISFP',
    topCandidates: ['9', '6', '2'],
    questions: [
      "누군가를 도울 때, '갈등 없이 다 같이 편했으면 해서'에 가깝나요, '이 사람에게 필요한 존재가 되고 싶어서'에 가깝나요?",
      "결정을 미루게 될 때, '어느 쪽이든 상관없어서'에 가깝나요, '잘못된 선택을 할까봐 걱정돼서'에 가깝나요?",
    ],
  },
  {
    mbti: 'INFP',
    topCandidates: ['4', '9', '5'],
    questions: [
      "내 감정을 다룰 때 '이건 나만의 특별한 감정이야'라고 느끼는 편인가요, '너무 매몰되지 말고 평온해지자'고 다독이는 편인가요?",
      '혼자만의 시간에 감정이나 의미를 깊이 느끼고 표현하는 쪽인가요, 어떤 주제를 체계적으로 파고들어 이해하는 쪽인가요?',
    ],
  },
  {
    mbti: 'INTP',
    topCandidates: ['5', '4', '9'],
    questions: [
      "몰입할 때 '이 원리를 완전히 이해하고 싶다'는 지적 욕구가 강한가요, '이건 나만의 관점에서 다르게 보인다'는 감각이 강한가요?",
      "생각이 많아질 때 그 생각에 깊이 빠져드는 편인가요, 어느 순간 '그만 생각하고 싶다'며 거리를 두는 편인가요?",
    ],
  },
  {
    mbti: 'ESTP',
    topCandidates: ['8', '3', '7'],
    questions: [
      "원하는 걸 얻을 때 '내가 주도권을 쥐고 밀어붙여서'에 가깝나요, '남들보다 뛰어난 결과로 증명해서'에 가깝나요?",
      "다음 목표로 넘어가는 이유가 '성취했다는 걸 보여주고 싶어서'인가요, '새로운 게 더 재밌을 것 같아서'인가요?",
    ],
  },
  {
    mbti: 'ESFP',
    topCandidates: ['2', '9', '6'],
    questions: [
      "사람들과 있을 때 '내가 이들에게 힘이 되고 있다'는 느낌이 중요한가요, '다들 편안하고 즐거운 분위기'인 게 더 중요한가요?",
      "누군가에게 잘해줄 때 '이 사람이 날 필요로 하면 좋겠다'는 마음인가요, '이 관계가 안전하게 유지됐으면'하는 마음이 더 큰가요?",
    ],
  },
  {
    mbti: 'ENFP',
    topCandidates: ['2', '7', '4'],
    questions: [
      "새로운 사람을 만날 때 설레는 이유가 '특별한 관계를 맺고 싶어서'인가요, '어떤 재밌는 가능성이 열릴지 궁금해서'인가요?",
      '기분이 가라앉을 때, 빨리 기분전환할 거리를 찾는 편인가요, 그 감정을 충분히 느끼고 들여다보는 편인가요?',
    ],
  },
  {
    mbti: 'ENTP',
    topCandidates: ['7', '8', '4'],
    questions: [
      "논쟁을 즐기는 이유가 '다양한 관점을 탐색하는 게 재밌어서'인가요, '내 주장을 관철시키고 싶어서'인가요?",
      '화가 날 때 감정을 바로 표출하며 맞서는 편인가요, 속으로 삭이며 나만의 방식으로 곱씹는 편인가요?',
    ],
  },
  {
    mbti: 'ESTJ',
    topCandidates: ['8', '3', '1'],
    questions: [
      "일을 추진할 때 '내가 책임지고 이끌어야 해'라는 마음이 큰가요, '최고의 결과로 인정받고 싶다'는 마음이 큰가요?",
      "일 처리 기준이 '가장 효율적이고 좋은 결과'인가요, '올바르고 원칙에 맞는 방식'인가요?",
    ],
  },
  {
    mbti: 'ESFJ',
    topCandidates: ['3', '6', '2'],
    questions: [
      "인정받고 싶은 이유가 '내가 유능하다는 걸 보여주고 싶어서'인가요, '이 사람들에게 필요한 존재이고 싶어서'인가요?",
      "관계를 유지하려는 노력이 '이 관계가 흔들리지 않았으면' 하는 불안 때문인가요, '내가 도움이 되고 싶은' 마음 때문인가요?",
    ],
  },
  {
    mbti: 'ENFJ',
    topCandidates: ['3', '6', '2'],
    questions: [
      "사람들을 이끌 때 '우리 팀이 좋은 성과를 내는 것'이 중요한가요, '각자 필요한 걸 채워주는 것'이 더 중요한가요?",
      "누군가를 챙길 때 '내가 필요한 존재였으면' 하는 마음이 큰가요, '이 관계가 안전하고 예측 가능했으면' 하는 마음이 큰가요?",
    ],
  },
  {
    mbti: 'ENTJ',
    topCandidates: ['3', '8', '1'],
    questions: [
      "목표를 이룰 때 더 중요한 건 '최고의 성과로 증명하는 것'인가요, '내가 통제권을 쥐고 이끄는 것'인가요?",
      "누군가 잘못하고 있을 때 '내가 나서서 바로잡아야 한다'는 마음이 강한가요, '원칙대로 하지 않는 게 불편하다'는 마음이 강한가요?",
    ],
  },
];

// ── 조립 ──────────────────────────────────────────────────────────────────────

function buildDimensionEntries(
  dimension: CommonDimension,
  tier: 'common' | 'romantic',
  texts: string[],
): QuestionBankEntry[] {
  return texts.map((text, i) => ({
    id: `${tier}-${dimension}-${i + 1}`,
    targetDimension: dimension,
    tier,
    text,
    variantIndex: i + 1,
  }));
}

function buildEnneagramOpenerEntries(tier: 'common' | 'romantic', texts: string[]): QuestionBankEntry[] {
  return texts.map((text, i) => ({
    id: `${tier}-enneagram-opener-${i + 1}`,
    targetDimension: 'enneagram_core',
    tier,
    text,
    variantIndex: i + 1,
  }));
}

function buildSternbergEntries(): QuestionBankEntry[] {
  const components: SternbergComponent[] = ['intimacy', 'passion', 'commitment'];
  return components.flatMap((component) =>
    COMMON_STERNBERG[component].map((text, i) => ({
      id: `common-sternberg-${component}-${i + 1}`,
      targetDimension: 'sternberg' as const,
      tier: 'common' as const,
      text,
      sternbergComponent: component,
      variantIndex: i + 1,
    })),
  );
}

function buildMbtiDiscriminatorEntries(): QuestionBankEntry[] {
  return MBTI_DISCRIMINATOR_TABLE.flatMap((row) =>
    row.questions.map((text, i) => ({
      id: `mbti-${row.mbti}-${i + 1}`,
      targetDimension: 'enneagram_core' as const,
      tier: 'mbti_specific' as const,
      text,
      mbtiType: row.mbti,
      topCandidates: row.topCandidates,
      variantIndex: i + 1,
    })),
  );
}

export const QUESTION_BANK: QuestionBankEntry[] = [
  ...buildDimensionEntries('avoidance', 'common', COMMON_AVOIDANCE),
  ...buildDimensionEntries('anxiety', 'common', COMMON_ANXIETY),
  ...buildDimensionEntries('N', 'common', COMMON_N),
  ...buildDimensionEntries('O', 'common', COMMON_O),
  ...buildDimensionEntries('C', 'common', COMMON_C),
  ...buildDimensionEntries('E', 'common', COMMON_E),
  ...buildDimensionEntries('A', 'common', COMMON_A),
  ...buildEnneagramOpenerEntries('common', COMMON_ENNEAGRAM_OPENER),
  ...buildSternbergEntries(),
  ...buildDimensionEntries('N', 'romantic', ROMANTIC_N),
  ...buildDimensionEntries('O', 'romantic', ROMANTIC_O),
  ...buildDimensionEntries('C', 'romantic', ROMANTIC_C),
  ...buildDimensionEntries('E', 'romantic', ROMANTIC_E),
  ...buildDimensionEntries('A', 'romantic', ROMANTIC_A),
  ...buildEnneagramOpenerEntries('romantic', ROMANTIC_ENNEAGRAM_OPENER),
  ...buildMbtiDiscriminatorEntries(),
];

// ── 조회 헬퍼 ──────────────────────────────────────────────────────────────────

export function getMbtiSpecificQuestions(mbtiType: string): QuestionBankEntry[] {
  return QUESTION_BANK.filter((q) => q.tier === 'mbti_specific' && q.mbtiType === mbtiType.toUpperCase());
}

export function getCommonQuestions(dimension: CommonDimension): QuestionBankEntry[] {
  return QUESTION_BANK.filter((q) => q.tier === 'common' && q.targetDimension === dimension);
}

export function getRomanticQuestions(dimension: RomanticDimension): QuestionBankEntry[] {
  return QUESTION_BANK.filter((q) => q.tier === 'romantic' && q.targetDimension === dimension);
}

export function getEnneagramOpeners(tier: 'common' | 'romantic'): QuestionBankEntry[] {
  return QUESTION_BANK.filter((q) => q.tier === tier && q.targetDimension === 'enneagram_core');
}

export function getSternbergQuestions(component?: SternbergComponent): QuestionBankEntry[] {
  return QUESTION_BANK.filter(
    (q) => q.targetDimension === 'sternberg' && (component === undefined || q.sternbergComponent === component),
  );
}

/** §9 날개 후속질문 — 플레이스홀더를 실제 코어유형 설명/날개 이름으로 치환한다. */
export function buildWingFollowupQuestion(coreDescription: string, wingA: string, wingB: string): string {
  return ENNEAGRAM_WING_TEMPLATE.replace('[코어유형 설명]', coreDescription)
    .replace('[날개①]', wingA)
    .replace('[날개②]', wingB);
}
