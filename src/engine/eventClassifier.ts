// ─── 실시간 이벤트 분류기 (v2.2 틱 엔진 입력단) ────────────────────────────────
//
// 메시지 스트림에서 EventCode를 근사 탐지하는 온디바이스 규칙 엔진.
// useCrisisIntelligence.ts와 동일한 설계 철학: 정규식 기반 어휘 탐지(즉시) +
// 필요 시 구조적 패턴(타이밍·길이·상호성) 근사. LLM 정밀 분류는 상위 훅에서
// 선택적으로 얹을 수 있으나, 본 파일은 항상 오프라인에서 동작하는 폴백 레이어다.
//
// ⚠️ 근사치 명시: 아래 패턴은 검증된 언어학적 분류기가 아니라 자기성찰용 휴리스틱이다.
// 특히 L-HRS(고트만 4 호스맨)는 단일 문장이 아닌 구조 패턴으로만 근사한다.

import type { EventCode } from './metrics';

export interface ClassifierMessage {
  role: 'me' | 'partner';
  text: string;
  timestamp: number;
}

export interface ClassifierContext {
  /** 최근 대화 히스토리 (오래된 → 최신 순). 구조적 탐지(타이밍/길이)에 사용 */
  history: ClassifierMessage[];
  /** 현재 세션이 갈등 국면인지 (M_context 승수 및 콤보 탐지에 활용) */
  inConflict?: boolean;
}

// ── 어휘 패턴 테이블 ───────────────────────────────────────────────────────────
// 각 코드는 발화 텍스트에 대한 정규식 힌트 배열을 가진다. 하나라도 매치되면 후보로 채택.

const LEXICAL_PATTERNS: Partial<Record<EventCode, RegExp[]>> = {
  // G-CON
  'G-CON-001': [/내가\s*다시\s*생각해\s*봤는데/, /돌아보니\s*내가/, /나\s*그때\s*(말이\s*심했나|왜\s*그랬는지)\s*생각해\s*봤어/],
  'G-CON-002': [/내가\s*(방금|아까)?\s*말이?\s*(짧았|심했)/, /미안해?[.,!]?\s*$/, /내\s*잘못/, /사과할게/],
  'G-CON-003': [/전화로\s*(차분히|얘기)/, /통화로\s*(풀자|얘기하자)/, /만나서\s*얘기하자/],
  'G-CON-004': [/우리\s*(헤어지지|끝내지)\s*말자/, /가지\s*마.{0,10}(사랑해|미안해)/, /제발\s*(진정해|화\s*풀어).{0,15}(사랑해|미안해)/],
  'G-CON-005': [/나\s*(사실|지금)\s*(속상|서운|불안|화가)/, /내\s*감정이/],
  'G-CON-006': [/잠깐\s*(쉬자|숨\s*고르자)/, /시간\s*좀\s*갖자/],
  'G-CON-007': [/우리\s*둘\s*다\s*(예민|잘못)/, /같이\s*고치자/],
  'G-CON-008': [/아까\s*미안/, /먼저\s*미안하다고/],
  'G-CON-009': [/네\s*말도\s*일리\s*있어/, /그럴\s*수도\s*있겠다/],
  'G-CON-010': [/그래도\s*사랑해/, /싸워도\s*좋아해/],

  // G-REG
  'G-REG-001': [/진짜\s*힘들었겠다/, /속상했겠네/, /많이\s*힘들지/],
  'G-REG-002': [/잘했어/, /멋있다/, /예쁘다|이쁘다/, /최고야/, /자랑스러워/],
  'G-REG-006': [/이제\s*(끝났|퇴근|수업\s*끝)/, /나\s*이제\s*(자유|한가)/],
  'G-REG-007': [/그때\s*말했던/, /저번에\s*얘기한/],
  'G-REG-008': [/사실\s*나\s*좀\s*불안/, /고민\s*있는데/],
  'G-REG-009': [/고마워/, /덕분이야|덕분에/],
  'G-REG-010': [/밥\s*먹었어/, /뭐\s*시켜줄까/, /뭐\s*먹고\s*싶어/],
  'G-REG-011': [/사과\s*받아줄게/, /장난인\s*거\s*알아/, /그래\s*화해하자/],
  'G-REG-012': [/잘\s*잤어/, /오늘\s*안\s*힘들어/, /컨디션\s*어때/],
  // G-REG-004: '우리' + 미래형 어미 경량 결합 (G-FUT류의 구체적 계획과는 구분되는 가벼운 결속 표현)
  'G-REG-004': [/우리\s*\S{0,6}(할\s*거야|하자고|갈\s*거야|될\s*거야|해야지)/],

  // G-HUM
  'G-HUM-003': [/우리\s*(그거|그\s*드립)\s*있잖아/, /또\s*그\s*드립\??/, /우리끼리\s*(아는|통하는)\s*(거|얘기)/],
  'G-HUM-004': [/짤\s*(보내|봐)/, /밈\s*(보내|봐)/],
  'G-HUM-005': [/(바보야|멍청아)\s*ㅋㅋ/, /놀리는\s*거\s*아니야.{0,6}귀여워서/, /장난이야\s*자기야/],
  'G-HUM-006': [/(어색하네|정적)\s*(ㅋㅋ|ㅎㅎ)/, /침묵\s*깨는\s*셈\s*치고/, /분위기\s*전환\s*좀\s*해볼게/],
  'G-HUM-008': [/가사\s*처럼/, /노래\s*가사/],
  'G-HUM-010': [/나\s*진짜\s*바보/, /나\s*왜\s*이러냐/],

  // G-FUT
  'G-FUT-001': [/주말에\s*.*(갈래|가자|볼래)/, /다음\s*주에\s*(만나|보자|갈까)/],
  'G-FUT-002': [/여름에\s*여행/, /내년에\s*같이/, /나중에\s*우리/],
  // G-FUT-003: '우리' 강한 결속 표현 (G-REG-004의 경량 미래형과 달리 단정적 결속 서술)
  'G-FUT-003': [/우리는?\s*(진짜|정말)\s*(잘\s*맞아|찰떡|운명)/, /우리\s*팀\s*이잖아/, /우리\s*하나잖아/],
  'G-FUT-004': [/기념일\s*(준비|챙기|계획)/, /(백일|1주년|100일)\s*(준비|계획)/],
  'G-FUT-005': [/같이\s*살자/, /동거/, /결혼/],
  'G-FUT-006': [/버킷리스트/, /하고\s*싶은\s*거\s*(같이|리스트)/],
  'G-FUT-007': [/저번에\s*약속한\s*거/, /약속\s*지켰/],
  'G-FUT-008': [/시험\s*잘\s*봐/, /면접\s*화이팅/, /잘\s*될\s*거야/],

  // G-RES
  'G-RES-002': [/굿모닝|좋은\s*아침/, /잘\s*자|굿나잇/],
  // G-RES-003: 단절 종료 직후 "내가 먼저" 연락했음을 명시 (G-REG-006의 단순 안부와 구분)
  'G-RES-003': [/끝나자마자\s*(연락|톡)\s*했어/, /나오자마자\s*생각나서/, /수업\s*끝나고\s*바로\s*(연락|톡)/],
  'G-RES-004': [/지금\s*.*(하는\s*중|가는\s*중|먹는\s*중)/],
  'G-RES-005': [/이제\s*회의/, /수업\s*들어가/, /못\s*볼\s*것\s*같아/],
  'G-RES-006': [/전화\s*할까/, /통화\s*하자/, /영상통화/],
  'G-RES-008': [/자느라\s*늦었/, /답장\s*늦어서\s*미안/],

  // G-INT
  'G-INT-001': [/자기야/, /애기야/, /여보/, /자기\s/],
  'G-INT-002': [/보고\s*싶/, /그립다/],
  'G-INT-003': [/사랑해/, /사랑한다/],
  'G-INT-004': [/안아주고\s*싶/, /손\s*잡고\s*싶/],
  // G-INT-005: 사진·영상 실제 공유 (G-INT-004의 스킨십 텍스트와 구분)
  'G-INT-005': [/(사진|셀카)\s*(보내줄게|찍었어|보내|봐봐)/, /방금\s*찍은\s*사진/, /이거\s*내\s*사진/],
  'G-INT-006': [/나\s*지금\s*.*(있어|도착)/, /위치\s*공유/],
  'G-INT-007': [/사실\s*나\s*(고민|불안)이\s*있는데/, /진지하게\s*얘기하고\s*싶은데/],
  // G-INT-008: 음성·영상 메시지 실제 전송 (G-RES-006의 통화 "제안"과 구분)
  'G-INT-008': [/음성\s*메시지\s*(보낼게|남겼어)/, /영상\s*메시지\s*보냈어/, /목소리\s*녹음해서\s*보낼게/],

  // L-MIC
  'L-MIC-001': [/별거\s*아니잖아|별거\s*아니야|별거\s*아님/, /왜\s*그걸로\s*(상처|화|짜증|힘들)/, /그게\s*뭐가\s*문제야|그게\s*어때서/],
  'L-MIC-005': [/알았어\s*그럼/, /^ㅋ$/, /^ㅇㄴ$/],
  'L-MIC-006': [/^뭐해\??$/, /^어\??$/, /^내일\s*봄\??$/],
  'L-MIC-007': [/그건\s*그렇고|그나저나|아무튼/, /갑자기\s*(뭐|왜\s*딴\s*소리)/],
  'L-MIC-008': [/전\s*여친|전\s*남친/, /걔는\s*안\s*그러던데/, /친구는\s*더/],
  'L-MIC-009': [/미안한데\s*너도/, /미안하지만\s*너도\s*잘못/],
  // L-MIC-010: 약속된 통화 시간 반복 무시 (G-RES-006의 통화 "제안"과 반대 극성)
  'L-MIC-010': [/(전화|통화)\s*하기로\s*했잖아/, /약속한\s*시간\s*(넘었는데|지났는데).{0,10}(전화|연락)\s*없/, /통화\s*하자더니\s*또/],
  'L-MIC-011': [/^ㅇㅇ$/, /^ㅎ$/, /^ㅇ$/],
  'L-MIC-012': [/다음에\s*가자(?!.*(주말|다음\s*주))/, /나중에\s*(가자|하자)(?!.*계획)/],

  // L-CRU
  'L-CRU-002': [/헤어지든가/, /이럴\s*거면\s*그만두자/, /끝내자/, /관두자/],
  'L-CRU-003': [/너는?\s*맨날/, /너\s*때문에/, /너\s*때문이잖아/],
  'L-CRU-004': [/입\s*닫아/, /시끄러워/, /닥쳐/],
  'L-CRU-006': [/그때도\s*네가/, /예전에도\s*그랬잖아/, /또\s*그\s*얘기냐/],
  // L-CRU-007: 길들이기용 무응답 예고 (L-CRU-012의 "관계 단절 협박"과 달리 침묵 자체를 무기화)
  'L-CRU-007': [/대답\s*(안\s*할\s*거야|안\s*할래|하기\s*싫어)/, /무시할\s*거야/, /알아서\s*해/],
  'L-CRU-008': [/내\s*친구도\s*(다\s*)?너\s*이상하대/, /다들\s*너\s*그렇대/],
  'L-CRU-009': [/또\s*헤어지자|한다/],
  'L-CRU-010': [/그것\s*때문에\s*그런\s*거\s*아니야/],
  'L-CRU-011': [/ㅋ\s*수준\s*보소/, /그거밖에\s*못해/, /한심하다/],
  'L-CRU-012': [/차단한다/, /연락\s*끊는다/, /차단할\s*거야/],

  // L-HRS (lexical seed — 구조 패턴과 병행 사용)
  'L-HRS-001': [/넌\s*항상/, /넌\s*맨날/, /항상\s*그런\s*식/],
  'L-HRS-002': [/ㅋ\s*진짜\??\s*웃기다/, /🙄/, /수준\s*알만하다/],
  'L-HRS-003': [/내\s*탓\s*아니/, /나는\s*잘못\s*없/, /억울해/],
  'L-HRS-008': [/또\s*시작이네/, /또\s*저런다/],

  // L-NEG
  // L-NEG-004: 매번 짧게 끊는 종결(원 초안에선 L-NEG-008 자리에 잘못 매핑돼 있었음 — metrics.ts 레지스트리 기준으로 정정)
  'L-NEG-004': [/^(알겠어\.|됐어\.|그래\.|ㅇㅋ\.|오케이\.)$/],
  'L-NEG-006': [/약속\s*(취소|못\s*가|못\s*갈\s*것\s*같아)/, /노쇼/],
  'L-NEG-007': [/기념일.*몰랐/, /오늘이\s*무슨\s*날인지\s*몰랐/],
  // L-NEG-008: 디지털 회피(원 초안에선 L-NEG-004 자리에 잘못 매핑돼 있었음 — metrics.ts 레지스트리 기준으로 정정)
  'L-NEG-008': [/(인스타|카톡).{0,10}(올리면서|봤으면서|읽었으면서).{0,15}(답장|연락).{0,5}(안\s*해|못\s*해)/],
};

// ── 다중 이모지 패턴 (경멸/조롱 등 근사 신호) ─────────────────────────────────

const LAUGH_RE = /ㅋ{2,}|ㅎ{2,}|😂|🤣/;
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

function last(arr: ClassifierMessage[]): ClassifierMessage | undefined {
  return arr[arr.length - 1];
}

/**
 * 단일 신규 메시지(msg)를 대화 히스토리 컨텍스트와 함께 분류해 후보 EventCode 목록을 반환한다.
 * msg는 이미 ctx.history 마지막 원소로 포함되어 있다고 가정한다 (호출측이 push 후 전달).
 */
export function classifyMessage(msg: ClassifierMessage, ctx: ClassifierContext): EventCode[] {
  const hits: EventCode[] = [];
  const { history } = ctx;
  const idx = history.length - 1;
  const prev = history[idx - 1];
  const text = msg.text.trim();

  // ── 1. 어휘 패턴 매치 ──
  for (const [code, patterns] of Object.entries(LEXICAL_PATTERNS) as [EventCode, RegExp[]][]) {
    if (patterns.some((p) => p.test(text))) hits.push(code);
  }

  // ── 2. 구조적 패턴: 장문 vs 단답 ──
  if (prev && prev.role !== msg.role) {
    const prevLen = prev.text.trim().length;
    const curLen = text.length;

    if (prevLen >= 100) {
      const ratio = curLen / prevLen;
      if (curLen <= 3 && /^(ㅇㅇ|웅|ㅇ|ㅎ)$/.test(text)) {
        hits.push('L-MIC-002');
      } else if (ratio >= 0.8 && ratio <= 1.2) {
        hits.push('G-REG-005');
      }
    }
  }

  // ── 3. 즉시/신속 응답 (평소 대비 — 30초 이내 상호 응답) ──
  if (prev && prev.role !== msg.role) {
    const gapMs = msg.timestamp - prev.timestamp;
    if (gapMs >= 0 && gapMs <= 30_000) hits.push('G-RES-007');
    if (gapMs >= 0 && gapMs <= 15_000) hits.push('G-RES-001');
  }

  // ── 4. 읽씹/방치 (직전 상대 메시지 이후 경과 시간) ──
  if (prev && prev.role !== msg.role) {
    const gapMs = msg.timestamp - prev.timestamp;
    const ONE_HOUR = 60 * 60 * 1000;
    const SIX_HOURS = 6 * ONE_HOUR;
    if (gapMs >= SIX_HOURS && prev.text.trim().length >= 20) {
      hits.push('L-CRU-005'); // 안읽씹 6시간+ (장문 서운함 가정 근사)
    } else if (gapMs >= ONE_HOUR) {
      hits.push('L-MIC-004');
    }
  }

  // ── 5. 드립 성공 / 받아치기 (직전 내 메시지 뒤 상대 폭소) ──
  if (prev && prev.role !== msg.role && LAUGH_RE.test(text)) {
    if (prev.role === 'me') hits.push('G-HUM-001');
    else hits.push('G-HUM-002');
  }

  // ── 6. 이모지 합주 (연속 2메시지 모두 이모지만) ──
  if (prev && EMOJI_RE.test(text) && EMOJI_RE.test(prev.text) && text.replace(EMOJI_RE, '').trim().length === 0) {
    hits.push('G-HUM-009');
  }

  // ── 7. 티키타카 연쇄: 최근 5턴이 모두 60초 이내 상호 응답 ──
  if (history.length >= 5) {
    const lastFive = history.slice(-5);
    const rapidPingPong = lastFive.every((m, i) => {
      if (i === 0) return true;
      const gp = m.timestamp - lastFive[i - 1].timestamp;
      return gp >= 0 && gp <= 60_000 && m.role !== lastFive[i - 1].role;
    });
    if (rapidPingPong) hits.push('G-HUM-007');
  }

  // ── 8. 대화 독점 (최근 10메시지 중 한쪽이 80%+ 점유) ──
  if (history.length >= 10) {
    const lastTen = history.slice(-10);
    const mine = lastTen.filter((m) => m.role === 'me').length;
    const ratio = mine / lastTen.length;
    if (ratio >= 0.8 || ratio <= 0.2) hits.push('L-MIC-003');
  }

  // ── 9. 선톡 비대칭 (최근 10회 대화 시작 메시지 중 한쪽이 항상 먼저) ──
  if (history.length >= 10) {
    const lastTen = history.slice(-10);
    const initiators = lastTen.filter((m, i) => i === 0 || m.role !== lastTen[i - 1].role);
    const mineInit = initiators.filter((m) => m.role === 'me').length;
    if (initiators.length >= 4 && mineInit === 0) hits.push('L-NEG-002');
  }

  // ── 10. 문체 동기화 (최근 4턴 중 상대와 종결 문자가 연속 2회+ 일치) ──
  if (history.length >= 4) {
    const lastFour = history.slice(-4);
    const endingMatches = lastFour.filter((m, i) => {
      if (i === 0) return false;
      const curEnd = m.text.trim().slice(-1);
      const prevEnd = lastFour[i - 1].text.trim().slice(-1);
      return curEnd.length > 0 && curEnd === prevEnd && m.role !== lastFour[i - 1].role;
    }).length;
    if (endingMatches >= 2) hits.push('G-REG-003');
  }

  // ── 11. 의도적 교착 (날선 말 직후 3시간+ 무응답) ──
  if (prev && prev.role !== msg.role) {
    const gapMs = msg.timestamp - prev.timestamp;
    const THREE_HOURS = 3 * 60 * 60 * 1000;
    const sharpTone = /짜증나|시끄러워|말\s*시키지\s*마|됐어\./;
    if (gapMs >= THREE_HOURS && sharpTone.test(prev.text)) {
      hits.push('L-CRU-001');
    }
  }

  // ── 12. 응답 지연 누적 (직전 5개 회신 간격 평균 대비 3배+ 느린 회신) ──
  if (prev && prev.role !== msg.role && history.length >= 6) {
    const gapMs = msg.timestamp - prev.timestamp;
    const priorGaps: number[] = [];
    for (let i = history.length - 2; i > 0 && priorGaps.length < 5; i--) {
      const cur = history[i];
      const before = history[i - 1];
      if (cur.role !== before.role) {
        const g = cur.timestamp - before.timestamp;
        if (g > 0) priorGaps.push(g);
      }
    }
    if (priorGaps.length >= 3) {
      const avgGap = priorGaps.reduce((sum, g) => sum + g, 0) / priorGaps.length;
      const FIVE_MIN = 5 * 60 * 1000;
      if (gapMs > avgGap * 3 && gapMs > FIVE_MIN) {
        hits.push('L-NEG-001');
      }
    }
  }

  // ── 13. 질문 무응답 (상대 질문에 답하지 않고 화제 전환) ──
  if (prev && prev.role !== msg.role) {
    const partnerAsked = /\?|뭐\s*(해|야)\??$|왜\??$|언제\??$|어디\??$/.test(prev.text.trim());
    const pivotAway = /^(아\s*근데|그나저나|참\s*나|어\s*근데)/.test(text.trim());
    if (partnerAsked && pivotAway) {
      hits.push('L-NEG-003');
    }
  }

  // ── 14. 관심 비대칭 (최근 내 메시지 중 자기중심 표현 60%+) ──
  {
    const recentMyMsgs = history.filter((m) => m.role === 'me').slice(-5);
    if (recentMyMsgs.length >= 4) {
      const selfCount = recentMyMsgs.filter((m) => /나는|내가/.test(m.text)).length;
      if (selfCount / recentMyMsgs.length >= 0.6) {
        hits.push('L-NEG-005');
      }
    }
  }

  void idx;
  return Array.from(new Set(hits));
}

// ── 윈도우 기반 4-호스맨 패턴 근사 탐지 (고트만 모델) ──────────────────────────
// 단발 메시지가 아닌 최근 대화 창(기본 24h) 전체 구조를 스캔한다.

export function classifyHorsemenPatterns(window: ClassifierMessage[]): EventCode[] {
  const hits: EventCode[] = [];
  const myMsgs = window.filter((m) => m.role === 'me');
  if (myMsgs.length < 4) return hits;

  const criticismHits = myMsgs.filter((m) => /넌\s*(항상|맨날)|매번\s*그래/.test(m.text)).length;
  const contemptHits = myMsgs.filter((m) => /ㅋ\s*수준|한심|🙄|어이없/.test(m.text)).length;
  const defensivenessHits = myMsgs.filter((m) => /내\s*탓\s*아니|억울해|나는\s*잘못\s*없/.test(m.text)).length;

  const recentSix = myMsgs.slice(-6);
  const avgLen = recentSix.reduce((s, m) => s + m.text.trim().length, 0) / Math.max(recentSix.length, 1);
  const stonewalling = avgLen < 4;

  if (criticismHits >= 2) hits.push('L-HRS-001');
  if (contemptHits >= 2) hits.push('L-HRS-002');
  if (defensivenessHits >= 2) hits.push('L-HRS-003');
  if (stonewalling) hits.push('L-HRS-004');
  if (criticismHits >= 1 && defensivenessHits >= 1) hits.push('L-HRS-005');
  if (contemptHits >= 4) hits.push('L-HRS-006');

  const avoidanceHits = myMsgs.filter((m) => /그건\s*그렇고|아무튼|암튼\s*됐고/.test(m.text)).length;
  if (avoidanceHits >= 2) hits.push('L-HRS-007');

  return Array.from(new Set(hits));
}
