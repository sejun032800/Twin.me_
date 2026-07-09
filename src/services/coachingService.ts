// ─── FUN-CHA — 코칭 서비스 (MASTER.md §4, 구버전 coachingService.ts 이식) ─────────
// 최근 7일 scoreHistory/eventLog/volatilityIndex를 집계해 Gemini(callLLM)로 구체적인
// 행동 코칭 리포트를 생성한다. 분석가 채팅방에서 주간 리포트 아래에 노출된다.
// 주 단위로 캐시(월요일 기준)해 같은 주에는 재생성하지 않는다.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useScoreStore } from '@/store/scoreStore';
import { callLLM } from '@/api/llm';
import type { EventCode } from '@/engine/metrics';

const COACHING_REPORT_KEY = 'twin_coaching_report_v1';
const REPORT_WINDOW_DAYS = 7;
const TOP_EVENTS_COUNT = 5;

export interface CoachingReport {
  weekSummary: string; // 이번 주 관계 요약
  strengthPoints: string[]; // 잘하고 있는 점 2~3개
  growthPoints: string[]; // 개선할 점 2~3개
  thisWeekChallenge: string; // 이번 주 실천 과제 1개
  generatedAt: string;
}

interface CoachingCache {
  weekKey: string;
  report: CoachingReport;
}

// 이번 주 월요일(YYYY-MM-DD)을 캐시 키로 사용
function currentWeekKey(): string {
  const now = new Date();
  const day = now.getDay(); // 0(일) ~ 6(토)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  return monday.toISOString().slice(0, 10);
}

function topEventCodes(eventLog: { code: EventCode }[]): string[] {
  const counts = new Map<EventCode, number>();
  for (const { code } of eventLog) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_EVENTS_COUNT)
    .map(([code]) => code);
}

async function readCache(): Promise<CoachingCache | null> {
  try {
    const raw = await AsyncStorage.getItem(COACHING_REPORT_KEY);
    return raw ? (JSON.parse(raw) as CoachingCache) : null;
  } catch {
    return null;
  }
}

async function writeCache(report: CoachingReport): Promise<void> {
  const cache: CoachingCache = { weekKey: currentWeekKey(), report };
  await AsyncStorage.setItem(COACHING_REPORT_KEY, JSON.stringify(cache));
}

export async function getCoachingReport(): Promise<CoachingReport | null> {
  const cache = await readCache();
  return cache?.weekKey === currentWeekKey() ? cache.report : null;
}

export async function generateCoachingReport(): Promise<CoachingReport> {
  const cached = await getCoachingReport();
  if (cached) return cached;

  const { scoreHistory, eventLog, volatilityIndex } = useScoreStore.getState();
  const recentScoreHistory = scoreHistory.slice(-REPORT_WINDOW_DAYS);
  const topEvents = topEventCodes(eventLog);

  const response = await callLLM({
    systemPrompt: `당신은 전문 연애 관계 코치입니다.
   커플의 이번 주 관계 데이터를 분석해
   구체적이고 실천 가능한 코칭을 제공해주세요.
   반드시 아래 JSON 형식으로만 응답하세요:
   {
     "weekSummary": "이번 주 관계 요약 (2문장)",
     "strengthPoints": ["잘한 점1", "잘한 점2"],
     "growthPoints": ["개선점1", "개선점2"],
     "thisWeekChallenge": "이번 주 실천 과제"
   }`,
    userMessage: JSON.stringify({ scoreHistory: recentScoreHistory, topEvents, volatilityIndex }),
  });

  const parsed = JSON.parse(response.content) as Omit<CoachingReport, 'generatedAt'>;
  const report: CoachingReport = { ...parsed, generatedAt: new Date().toISOString() };

  await writeCache(report);
  return report;
}
