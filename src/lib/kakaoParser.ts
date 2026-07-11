// ── KakaoDateCourse 타입 인라인 정의 (kakaoIngestPipeline이 여기서 직접 import) ──
export interface KakaoDateCourse {
  id: string;
  title: string;
  date: string;           // YYYY-MM-DD
  latitude: number;
  longitude: number;
  myRating: number;       // 1–5 (0 = pending visit)
  myReview: string;
  partnerRating: number;  // 1–5 (0 = partner hasn't reviewed yet)
  partnerReview: string;
  kakaoPlaceId?: string;
  layerId?: string;
  imageUrl?: string;
  myOotd?: string;
  partnerOotd?: string;
  isRead?: boolean;
  area?: string;
}

// ─── KakaoTalk .txt Pre-processing Pipeline ──────────────────────────────────
//
// Security contract:
//   1. All lines that begin with "[<partner name>]" are DROPPED before any
//      analysis — partner's utterances never leave the device in raw form.
//      This is enforced in parseKakaoExport (system/partner-line skip), and
//      independently in both extractSweetSentences() and selectMemoryQuote()
//      via a `speaker !== myName` guard — partner lines never become quote
//      candidates in either pipeline.
//   2. Phone numbers and account numbers are masked with "***".
//   3. The raw file string is never stored; only the sanitised output is kept
//      and only the extracted persona tokens are sent to the server.

export interface ParseResult {
  myLines: string[];
  droppedPartnerLines: number;
  maskedCount: number;
  topDrips: string[];        // top-3 signature expressions
}

// ─── Chat Style Profile ───────────────────────────────────────────────────────

export interface ChatStyleProfile {
  burstInterval: number;          // ms to wait before AI responds after rapid sends
  avgCharsPerBubble: number;      // avg chars per message bubble
  splitTriggerPatterns: string[]; // top-5 user endings that signal a new bubble
  typingSpeedFactor: number;      // ms per character for delay calculation
}

export const DEFAULT_CHAT_STYLE_PROFILE: ChatStyleProfile = {
  burstInterval: 2000,
  avgCharsPerBubble: 15,
  splitTriggerPatterns: ['ㅋㅋ', 'ㅠㅠ', '근데', '음', '!', '?'],
  typingSpeedFactor: 60,
};

// ── Phone & account number patterns ──────────────────────────────────────────

// Korean mobile: 010-XXXX-XXXX, 010.XXXX.XXXX, 01012345678
const PHONE_RE =
  /(?:01[016789])[-.\s]?\d{3,4}[-.\s]?\d{4}/g;

// Korean landline: 02-XXXX-XXXX, 031-XXX-XXXX etc.
const LANDLINE_RE =
  /0\d{1,2}[-.\s]\d{3,4}[-.\s]\d{4}/g;

// Bank account numbers: XX-XXXXXX-XXXXX (hypen-separated, 3 segments)
// Middle segment: 3-8 digits to cover banks like NH(3), KB(6), etc.
const ACCOUNT_RE =
  /\d{2,4}[-–]\d{3,8}[-–]\d{2,6}/g;

function maskSensitive(text: string): [string, number] {
  let count = 0;
  let result = text
    .replace(PHONE_RE, () => { count++; return '***'; })
    .replace(LANDLINE_RE, () => { count++; return '***'; })
    .replace(ACCOUNT_RE, () => { count++; return '***'; });
  return [result, count];
}

// ── KakaoTalk line classifier ─────────────────────────────────────────────────
//
// Two export formats are supported:
//   iOS:         [이름] [오전/오후 HH:MM] message content
//   Android/PC:  2024. 6. 15. 오후 11:23, 이름 : message content
//
// System lines (date headers, entry/exit notices) look like:
//   --------------- 2024년 1월 1일 월요일 ---------------
//   홍길동 님이 들어왔습니다.

const IOS_MSG_RE = /^\[(.+?)\] \[(오전|오후) (\d{1,2}):(\d{2})\] (.*)$/;
const ANDROID_MSG_RE =
  /^\d{4}\.\s?\d{1,2}\.\s?\d{1,2}\.\s?(오전|오후)\s?(\d{1,2}):(\d{2}),\s?(.+?)\s?:\s?(.*)$/;

export interface ParsedKakaoLine {
  speaker: string;
  content: string;
  hour: number;   // 24h
  minute: number;
}

function to24h(ampm: string, hourStr: string): number {
  let h = parseInt(hourStr, 10);
  if (ampm === '오후' && h < 12) h += 12;
  if (ampm === '오전' && h === 12) h = 0;
  return h;
}

// Parses a single raw line from either export format. Returns null for
// system lines (date headers, join/exit notices) that carry no message.
export function parseKakaoLine(raw: string): ParsedKakaoLine | null {
  const ios = raw.match(IOS_MSG_RE);
  if (ios) {
    const [, speaker, ampm, hourStr, minStr, content] = ios;
    return { speaker, content, hour: to24h(ampm, hourStr), minute: parseInt(minStr, 10) };
  }

  const android = raw.match(ANDROID_MSG_RE);
  if (android) {
    const [, ampm, hourStr, minStr, speaker, content] = android;
    return { speaker: speaker.trim(), content, hour: to24h(ampm, hourStr), minute: parseInt(minStr, 10) };
  }

  return null;
}

// ── Signature drip extraction ─────────────────────────────────────────────────
//
// Counts token frequency in own messages. Tokens: Korean slang atoms,
// emoticons, shortened words (2-6 chars). Returns top-3 by frequency.

function extractTopDrips(lines: string[]): string[] {
  const freq = new Map<string, number>();

  // Slang / emotional expression candidates: ≥2 chars, allow Korean+punctuation
  const TOKEN_RE = /[ㄱ-ㅎㅏ-ㅣ가-힣a-zA-Z0-9!?ㅋㅎㄷ]{2,6}/g;

  for (const line of lines) {
    const tokens = line.match(TOKEN_RE) ?? [];
    for (const t of tokens) {
      // Filter out purely numeric tokens and very common particles
      if (/^\d+$/.test(t)) continue;
      if (['그래서', '그러면', '근데', '그리고', '하지만', '그런데'].includes(t)) continue;
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }

  return [...freq.entries()]
    .filter(([, v]) => v >= 3)          // must appear at least 3 times
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([token]) => token);
}

// ── Main parse entry point ────────────────────────────────────────────────────

export function parseKakaoExport(
  rawText: string,
  myName: string,
): ParseResult {
  const lines = rawText.split('\n');
  const myLines: string[] = [];
  let droppedPartnerLines = 0;
  let totalMasked = 0;

  for (const raw of lines) {
    const parsed = parseKakaoLine(raw);

    if (!parsed) {
      // System line (date header, join/exit notice) — skip silently
      continue;
    }

    if (parsed.speaker !== myName) {
      // Partner's line — DROP entirely, never process further
      droppedPartnerLines++;
      continue;
    }

    // Own line — mask sensitive data
    const [sanitised, masked] = maskSensitive(parsed.content);
    totalMasked += masked;
    myLines.push(sanitised);
  }

  const topDrips = extractTopDrips(myLines);

  return {
    myLines,
    droppedPartnerLines,
    maskedCount: totalMasked,
    topDrips,
  };
}

// ── Unit-testable pure helper (exported for tests) ────────────────────────────

export function maskPII(text: string): string {
  return maskSensitive(text)[0];
}

// ─── Chat Rhythm Analysis Engine ──────────────────────────────────────────────
//
// Extracts ChatStyleProfile from a KakaoTalk export by analysing only the
// user's own messages. No partner data is read.

export function analyzeChatRhythm(
  rawText: string,
  myName: string,
): ChatStyleProfile {
  interface TimedMsg {
    minuteOfDay: number;
    charCount: number;
    ending: string;
  }

  const msgs: TimedMsg[] = [];

  for (const raw of rawText.split('\n')) {
    const parsed = parseKakaoLine(raw);
    if (!parsed || parsed.speaker !== myName) continue;

    const minuteOfDay = parsed.hour * 60 + parsed.minute;
    const charCount = parsed.content.replace(/\s/g, '').length;
    const ending = parsed.content.trimEnd().slice(-3).trim();
    msgs.push({ minuteOfDay, charCount, ending });
  }

  if (msgs.length < 3) return DEFAULT_CHAT_STYLE_PROFILE;

  // 1. burstInterval — how densely the user sends consecutive messages
  let burstCount = 0;
  for (let i = 1; i < msgs.length; i++) {
    const diff = msgs[i].minuteOfDay - msgs[i - 1].minuteOfDay;
    if (diff >= 0 && diff <= 2) burstCount++;
  }
  const burstRatio = burstCount / msgs.length;
  const burstInterval =
    burstRatio > 0.4  ? 1400 :
    burstRatio > 0.25 ? 1800 :
    burstRatio > 0.1  ? 2200 : 2700;

  // 2. avgCharsPerBubble
  const totalChars = msgs.reduce((s, msg) => s + msg.charCount, 0);
  const avgCharsPerBubble = Math.max(5, Math.round(totalChars / msgs.length));

  // 3. splitTriggerPatterns — most common message endings (top-5)
  const endFreq = new Map<string, number>();
  for (const { ending } of msgs) {
    if (ending.length > 0) endFreq.set(ending, (endFreq.get(ending) ?? 0) + 1);
  }
  const extracted = [...endFreq.entries()]
    .filter(([k, v]) => v >= 2 && k.trim().length > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  const splitTriggerPatterns =
    extracted.length >= 2
      ? extracted
      : [...extracted, ...DEFAULT_CHAT_STYLE_PROFILE.splitTriggerPatterns].slice(0, 5);

  // 4. typingSpeedFactor — proportional to avg message length
  const typingSpeedFactor = Math.max(
    30,
    Math.min(120, Math.round(35 + avgCharsPerBubble * 1.4)),
  );

  return { burstInterval, avgCharsPerBubble, splitTriggerPatterns, typingSpeedFactor };
}

// ─── FUN-ONB-003: Instant Surface Analysis (D0 아하 모먼트) ──────────────────
//
// Entirely local, regex/timestamp arithmetic only — no LLM calls, no network.
// Only aggregate counters are returned; no raw message text or partner
// content is retained past this function's execution.

export type EndingKey = 'eum' | 'ne' | 'hh' | 'yo';

const ENDING_PATTERNS: { key: EndingKey; re: RegExp }[] = [
  { key: 'eum', re: /음[~!.?ㅋㅎㅠㅜ]*$/ },
  { key: 'ne', re: /네[~!.?ㅋㅎㅠㅜ]*$/ },
  { key: 'hh', re: /ㅎ{2,}$/ },
  { key: 'yo', re: /요[~!.?ㅋㅎㅠㅜ]*$/ },
];

// Common emoji blocks (pictographs, symbols, transport, supplemental, dingbats).
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;

export interface InstantAnalysisMetrics {
  endingCounts: Record<EndingKey, number>;
  dominantEnding: EndingKey | null;
  emojiCount: number;
  emojiRate: number;          // emoji chars / non-whitespace chars, 0~1
  avgReplySeconds: number | null; // null when not enough partner→me pairs
  avgMessageLength: number;   // non-whitespace chars per message
  kkCount: number;            // "ㅋㅋ" pattern occurrences
  hhCount: number;            // "ㅎㅎ" pattern occurrences
  sampleSize: number;         // number of my messages analysed
}

// Reply-gap cap: pairs spanning more than this are treated as a new
// conversation (next day / long silence) and excluded from the average.
const MAX_REPLY_GAP_MINUTES = 120;

// Yield to the JS event loop every N lines so a large export (tens of
// thousands of lines) never freezes the UI thread in one long tick.
const LINES_PER_CHUNK = 4000;
const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function analyzeInstantMetrics(
  rawText: string,
  myName: string,
): Promise<InstantAnalysisMetrics> {
  const endingCounts: Record<EndingKey, number> = { eum: 0, ne: 0, hh: 0, yo: 0 };
  let emojiCount = 0;
  let nonWhitespaceChars = 0;
  let kkCount = 0;
  let hhCount = 0;
  let myMessageCount = 0;
  let totalCharLength = 0;

  const replyGaps: number[] = [];
  // Only the timestamp of the last partner line is kept in memory, purely
  // to measure my reply latency — partner message content is never read.
  let lastPartnerMinuteOfDay: number | null = null;

  const lines = rawText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const parsed = parseKakaoLine(lines[i]);

    if (parsed) {
      const minuteOfDay = parsed.hour * 60 + parsed.minute;

      if (parsed.speaker !== myName) {
        lastPartnerMinuteOfDay = minuteOfDay;
      } else {
        if (lastPartnerMinuteOfDay !== null) {
          const gap = minuteOfDay - lastPartnerMinuteOfDay;
          if (gap >= 0 && gap <= MAX_REPLY_GAP_MINUTES) replyGaps.push(gap);
          lastPartnerMinuteOfDay = null; // consumed — next gap starts fresh
        }

        const content = parsed.content;
        myMessageCount++;
        const chars = content.replace(/\s/g, '').length;
        totalCharLength += chars;
        nonWhitespaceChars += chars;
        emojiCount += (content.match(EMOJI_RE) ?? []).length;
        kkCount += (content.match(/ㅋ{2,}/g) ?? []).length;
        hhCount += (content.match(/ㅎ{2,}/g) ?? []).length;

        const trimmed = content.trimEnd();
        for (const { key, re } of ENDING_PATTERNS) {
          if (re.test(trimmed)) endingCounts[key]++;
        }
      }
    }

    if (i > 0 && i % LINES_PER_CHUNK === 0) await yieldToEventLoop();
  }

  const dominantEnding = (Object.keys(endingCounts) as EndingKey[]).reduce<EndingKey | null>(
    (best, key) => {
      if (endingCounts[key] === 0) return best;
      if (!best || endingCounts[key] > endingCounts[best]) return key;
      return best;
    },
    null,
  );

  const avgReplySeconds =
    replyGaps.length === 0
      ? null
      : Math.round((replyGaps.reduce((s, g) => s + g, 0) / replyGaps.length) * 60);

  return {
    endingCounts,
    dominantEnding,
    emojiCount,
    emojiRate: nonWhitespaceChars > 0 ? emojiCount / nonWhitespaceChars : 0,
    avgReplySeconds,
    avgMessageLength: myMessageCount > 0 ? Math.round(totalCharLength / myMessageCount) : 0,
    kkCount,
    hhCount,
    sampleSize: myMessageCount,
  };
}

// ─── FUN-ONB-002: Memory Quote Selection ─────────────────────────────────────
//
// After parsing, pick ONE memorable line from the user's own messages to keep
// as a lasting "memory quote" — this is the only verbatim chat text retained
// once the raw export is purged (see userStore.ts / kakaoIngestPipeline.ts).
// Entirely on-device, rule-based, no LLM call. Partner lines are never
// candidates, consistent with this file's security contract (see file header).

export interface MemoryQuote {
  text: string;
  date: string;        // 'YYYY-MM-DD'
  category: 'warm' | 'funny';
  uploadedAt: number;  // Date.now()
}

const QUOTE_DATE_HEADER_RE = /(\d{4})년 (\d{1,2})월 (\d{1,2})일/;
const QUOTE_URL_RE = /https?:\/\/|www\./i;

// 감동/다정 버킷 — 우선순위: 한 줄이 warm과 funny 키워드를 모두 포함하면 warm으로 분류한다.
const WARM_KEYWORDS = [
  // 기존 유지
  '사랑해', '보고싶어', '고마워', '덕분에', '행복해', '소중해',
  '최고야', '잘했어', '대단해', '응원해', '믿어', '함께',
  // 2030 추가 — 애정 표현
  '좋아해', '너무좋아', '설레', '설렌다', '두근', '심쿵',
  '칭찬해', '뿌듯해', '자랑스러워', '멋있어', '예뻐', '잘생겼어',
  '완전좋아', '진짜좋아', '너무예뻐', '너무멋있어',
  // 2030 추가 — 위로/공감
  '힘내', '괜찮아', '잘될거야', '잘하고있어', '걱정마',
  '고생했어', '수고했어', '애썼어', '많이힘들었겠다',
  '네편이야', '내가있잖아', '같이있을게', '어디있어도',
  // 2030 추가 — 존재 표현
  '없으면안돼', '필요해', '생각났어', '자꾸생각나', '보고싶다죽겠어',
  '왜이렇게보고싶지', '빨리보고싶다', '언제봐',
  // 2030 추가 — 감탄/리액션
  '실화야', '대박', '완전', '진짜로', '레전드', '역대급',
  '미쳤다', '소름', '눈물난다', '울컥',
  // 이모지
  '🫶', '🫠', '🥰', '😍', '🤍', '🩷', '🩵', '💙', '💚', '🫂', '😊', '🥲',
];

// 웃긴 버킷
const FUNNY_KEYWORDS = [
  // 기존 유지
  '배꼽', '웃겨', '미쳤다', '말이돼',
  // 2030 추가
  'ㄹㅇㅋㅋ', '진짜ㅋㅋ', '아ㅋㅋ',
  '개웃겨', '존웃', '빵터졌어', '빵터짐', '뒤집어졌어',
  '말이되냐', '이게맞냐', '실화냐', '레전드ㅋㅋ',
  '어이없어ㅋㅋ', '황당ㅋㅋ', '뭐야이게ㅋㅋ',
  // 이모지 (웃음 맥락)
  '🤭', '😆', '🫢', '💀',
];
// "ㅋㅋㅋ 3회 이상 / ㅎㅎㅎ 3회 이상" — also naturally covers 4+/5+ repeats like "ㅋㅋㅋㅋㅋ".
const FUNNY_REPEAT_PATTERNS = [/ㅋ{3,}/, /ㅎ{3,}/];

function isEligibleQuoteLine(text: string): boolean {
  const len = text.trim().length;
  if (len < 15 || len > 100) return false;
  if (QUOTE_URL_RE.test(text)) return false;
  return true;
}

function classifyQuoteCandidate(text: string): 'warm' | 'funny' | null {
  if (WARM_KEYWORDS.some((k) => text.includes(k))) return 'warm';
  const isFunny =
    FUNNY_KEYWORDS.some((k) => text.includes(k)) ||
    FUNNY_REPEAT_PATTERNS.some((re) => re.test(text));
  return isFunny ? 'funny' : null;
}

interface QuoteCandidate {
  text: string;
  date: string;
}

function pickRandomCandidate(
  pool: QuoteCandidate[],
  category: 'warm' | 'funny',
): MemoryQuote | null {
  if (pool.length === 0) return null;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  const [maskedQuote] = maskSensitive(chosen.text);
  return { text: maskedQuote, date: chosen.date, category, uploadedAt: Date.now() };
}

export function selectMemoryQuote(rawText: string, myName: string): MemoryQuote | null {
  const warmCandidates: QuoteCandidate[] = [];
  const funnyCandidates: QuoteCandidate[] = [];
  let currentDate = '2020-01-01';

  for (const raw of rawText.split('\n')) {
    const line = raw.trim();

    const dateMatch = line.match(QUOTE_DATE_HEADER_RE);
    if (dateMatch) {
      const [, y, m, d] = dateMatch;
      currentDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      continue;
    }

    const parsed = parseKakaoLine(raw);
    if (!parsed || parsed.speaker !== myName) continue;

    const content = parsed.content.trim();
    if (!isEligibleQuoteLine(content)) continue;

    const category = classifyQuoteCandidate(content);
    if (category === 'warm') warmCandidates.push({ text: content, date: currentDate });
    else if (category === 'funny') funnyCandidates.push({ text: content, date: currentDate });
  }

  const preferWarm = Math.random() < 0.9;
  if (preferWarm) {
    return pickRandomCandidate(warmCandidates, 'warm') ?? pickRandomCandidate(funnyCandidates, 'funny');
  }
  return pickRandomCandidate(funnyCandidates, 'funny') ?? pickRandomCandidate(warmCandidates, 'warm');
}

// ─── Memory Wall — Sweet Sentence Extraction (Step #24, relocated FUN-ONB-002) ─
//
// Scores each of the user's own lines (myName only — partner lines are
// dropped via parseKakaoLine()'s speaker check before scoring, matching this
// file's security contract) against a valence-keyword table and returns the
// top candidates. Relocated here (from useMemoryWall.ts) so it has no
// dependency on React/userStore — kakaoIngestPipeline.ts calls this
// directly, and useMemoryWall.ts re-exports it for its own hook's use.

interface ValencePattern {
  pattern: RegExp;
  score: number;
  tag: string;
}

const VALENCE_PATTERNS: ValencePattern[] = [
  { pattern: /사랑해|사랑한다|사랑스러워|사랑이야|사랑해요/,         score: 10, tag: '💕 사랑'    },
  { pattern: /좋아해|좋아한다|너를 좋아|많이 좋아|좋아하는/,         score: 9,  tag: '💕 좋아'    },
  { pattern: /약속해|약속할게|약속이야|영원히|평생 함께|함께 있을게/, score: 9,  tag: '🤝 약속'    },
  { pattern: /행복해|행복하다|행복했어|행복이야|너무 행복|너무행복/,  score: 8,  tag: '😊 행복'    },
  { pattern: /보고싶어|보고싶다|보고파|보고 싶어|보고 싶다/,         score: 8,  tag: '🌙 그리움'  },
  { pattern: /설레|두근|심쿵|떨려|설렌다|설렜어|두근거려|두근두근/,  score: 7,  tag: '💓 설렘'    },
  { pattern: /예쁘다|예뻐|예쁨|이쁘다|이뻐|잘생겼어|잘생겼다|멋있어|멋있다|멋져/, score: 7, tag: '✨ 칭찬' },
  { pattern: /감사해|감사합니다|고마워|고맙다|너무 고마/,            score: 7,  tag: '🙏 감사'    },
  { pattern: /최고야|최고다|최고임|세상에서 제일|세상 최고|짱이야/,   score: 7,  tag: '🏆 최고'    },
  { pattern: /기억할게|기억해|잊지 못해|잊을 수 없어|평생 기억/,     score: 7,  tag: '📸 추억'    },
  { pattern: /함께라서|같이 있어서|옆에 있어|곁에 있어|네 곁에/,    score: 7,  tag: '🤗 함께'    },
  { pattern: /완벽해|완벽하다|딱이야|찰떡이야|딱 맞아/,             score: 6,  tag: '💯 완벽'    },
  { pattern: /처음 봤는데|처음 만났|첫 만남|처음 본|처음이야/,       score: 6,  tag: '🌟 첫 만남' },
  { pattern: /안아주고|안겨|따뜻해|포근해|따뜻하다|포근하다/,        score: 6,  tag: '🫂 온기'    },
  { pattern: /웃음이|미소가|웃는 모습|웃겨서|방긋|웃음꽃/,          score: 5,  tag: '😄 웃음'    },
];

const MIN_VALENCE_SCORE = 5;

const WALL_DATE_HEADER_RE = /(\d{4})년 (\d{1,2})월 (\d{1,2})일/;

export interface MemoryNode {
  id: string;
  date: string;         // display: '2024.01.20'
  rawDate: Date;
  quote: string;
  tag: string;
  speaker: 'me' | 'partner';
  valenceScore: number;
  imageUri: string | null;  // real photo URI, or null for gradient fallback
}

function scoreMessage(text: string): { score: number; tag: string } {
  let totalScore = 0;
  let bestTag = '';
  let bestScore = 0;

  for (const { pattern, score, tag } of VALENCE_PATTERNS) {
    if (pattern.test(text)) {
      totalScore += score;
      if (score > bestScore) {
        bestScore = score;
        bestTag = tag;
      }
    }
  }

  if (totalScore > 0) {
    if (text.length > 20) totalScore += 2;
    if (text.length > 40) totalScore += 2;
  }

  return { score: totalScore, tag: bestTag || '💬 대화' };
}

function findClosestImage(msgDate: Date, courses: KakaoDateCourse[]): string | null {
  const withImage = courses.filter((c) => c.imageUrl);
  if (!withImage.length) return null;

  const msgTime = msgDate.getTime();
  const closest = withImage.reduce((prev, curr) => {
    const pd = Math.abs(new Date(prev.date).getTime() - msgTime);
    const cd = Math.abs(new Date(curr.date).getTime() - msgTime);
    return cd < pd ? curr : prev;
  });

  return closest.imageUrl ?? null;
}

export function extractSweetSentences(
  rawText: string,
  myName: string,
  courses: KakaoDateCourse[],
  maxCount = 7,
): MemoryNode[] {
  const lines = rawText.split('\n');
  let currentDate = new Date(2020, 0, 1);
  const candidates: MemoryNode[] = [];
  const seenQuotes = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const dateMatch = line.match(WALL_DATE_HEADER_RE);
    if (dateMatch) {
      const [, y, m, d] = dateMatch;
      currentDate = new Date(Number(y), Number(m) - 1, Number(d));
      continue;
    }

    const parsed = parseKakaoLine(lines[i]);
    if (!parsed) continue;
    if (parsed.speaker !== myName) continue; // 파트너 발화는 후보에서 제외 — 보안 계약

    const content = parsed.content.trim();
    const { score, tag } = scoreMessage(content);
    if (score < MIN_VALENCE_SCORE) continue;

    if (seenQuotes.has(content)) continue;
    seenQuotes.add(content);

    const [maskedText] = maskSensitive(content);

    const y    = String(currentDate.getFullYear());
    const mo   = String(currentDate.getMonth() + 1).padStart(2, '0');
    const d    = String(currentDate.getDate()).padStart(2, '0');

    candidates.push({
      id: `mem-${i}`,
      date: `${y}.${mo}.${d}`,
      rawDate: new Date(currentDate),
      quote: maskedText,
      tag,
      speaker: 'me',
      valenceScore: score,
      imageUri: findClosestImage(currentDate, courses),
    });
  }

  return candidates
    .sort((a, b) => b.valenceScore - a.valenceScore)
    .slice(0, maxCount);
}

// ─── FUN-ONB-003: D0 표층 즉시 분석 (MASTER.md §2) ────────────────────────────
//
// 업로드 직후 30초~1분 내 보여주는 "아하 모먼트" 화면용 지표. LLM 호출 없이
// myLines/timestamps(둘 다 내 발화만, 같은 인덱스)만으로 순수 로컬 계산한다.

export interface D0Analysis {
  avgReplySpeedSec: number;
  replySpeedPercentile: number;
  emojiDensity: number;
  laughPattern: 'ㅋㅋ' | 'ㅎㅎ' | 'mixed' | 'none';
  avgMessageLength: number;
  dominantEnding: string;
  totalMessages: number;
}

const D0_EMOJI_RE = /[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}]/gu;
const D0_ENDING_PATTERNS = ['ㅇㅇ', 'ㄷㄷ', 'ㄱㄱ', '~', '!', '...', 'ㅠ', 'ㅜ', 'ㄹㅇ', 'ㅋ', 'ㅎ'];

function d0ReplySpeedPercentile(avgSec: number): number {
  if (avgSec < 10) return 2;
  if (avgSec < 30) return 8;
  if (avgSec < 60) return 15;
  if (avgSec < 180) return 35;
  if (avgSec < 600) return 60;
  return 80;
}

export function analyzeD0(myLines: string[], timestamps: number[]): D0Analysis {
  const totalMessages = myLines.length;

  // 답장 속도 — 연속 메시지 간 시간 차이 평균(초). myLines/timestamps는 이미
  // 파트너 발화가 제외된 내 발화만 담고 있어, 남은 인접 쌍이 곧 "같은 발신자
  // 연속 제외" 후의 비교 대상이다.
  const gaps: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    const diff = timestamps[i] - timestamps[i - 1];
    if (diff > 0) gaps.push(diff);
  }
  const avgReplySpeedSec = gaps.length > 0
    ? Math.round(gaps.reduce((sum, g) => sum + g, 0) / gaps.length)
    : 0;
  const replySpeedPercentile = d0ReplySpeedPercentile(avgReplySpeedSec);

  // 이모지 밀도
  let emojiCount = 0;
  for (const line of myLines) {
    emojiCount += (line.match(D0_EMOJI_RE) ?? []).length;
  }
  const emojiDensity = totalMessages > 0 ? emojiCount / totalMessages : 0;

  // 웃음 패턴
  const kkLineCount = myLines.filter((l) => l.includes('ㅋ')).length;
  const hhLineCount = myLines.filter((l) => l.includes('ㅎ')).length;
  let laughPattern: D0Analysis['laughPattern'];
  if (kkLineCount === 0 && hhLineCount === 0) laughPattern = 'none';
  else if (kkLineCount > hhLineCount * 1.5) laughPattern = 'ㅋㅋ';
  else if (hhLineCount > kkLineCount * 1.5) laughPattern = 'ㅎㅎ';
  else laughPattern = 'mixed';

  // 평균 메시지 길이
  const avgMessageLength = totalMessages > 0
    ? myLines.reduce((sum, l) => sum + l.length, 0) / totalMessages
    : 0;

  // 시그니처 종결 — 각 메시지 마지막 2글자 기준 패턴 카운팅
  const endingCounts = new Map<string, number>();
  for (const line of myLines) {
    const tail = line.trim().slice(-2);
    for (const pattern of D0_ENDING_PATTERNS) {
      if (tail.includes(pattern)) {
        endingCounts.set(pattern, (endingCounts.get(pattern) ?? 0) + 1);
      }
    }
  }
  let dominantEnding = '';
  let bestCount = 0;
  for (const pattern of D0_ENDING_PATTERNS) {
    const count = endingCounts.get(pattern) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      dominantEnding = pattern;
    }
  }

  return {
    avgReplySpeedSec,
    replySpeedPercentile,
    emojiDensity,
    laughPattern,
    avgMessageLength,
    dominantEnding,
    totalMessages,
  };
}
