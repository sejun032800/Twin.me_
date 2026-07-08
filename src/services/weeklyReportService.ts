// ─── FUN-CHA — 주간 연애 리포트 (MASTER.md §6) ────────────────────────────────
// 최근 7일 scoreHistory/eventLog/volatilityIndex를 집계하고 Gemini(callLLM)로
// 자연어 요약을 생성한다. 무료는 summary만, 유료(isPremium)는 fullAnalysis도 포함.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useScoreStore } from '@/store/scoreStore';
import { callLLM } from '@/api/llm';
import type { EventCode } from '@/engine/metrics';

const WEEKLY_REPORT_KEY = 'twin_weekly_report_v1';
const REPORT_WINDOW_DAYS = 7;
const TOP_EVENTS_COUNT = 3;

export interface WeeklyReport {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;
  avgScore: number;
  maxScore: number;
  minScore: number;
  volatilityIndex: number;
  topEvents: string[]; // 가장 많이 발생한 이벤트 코드 TOP 3
  summary: string; // AI 생성 요약 (무료 제공)
  fullAnalysis?: string; // AI 생성 상세 분석 (유료 전용)
  generatedAt: string;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
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

export async function generateWeeklyReport(isPremium: boolean): Promise<WeeklyReport> {
  const store = useScoreStore.getState();
  const recentHistory = store.scoreHistory.slice(-REPORT_WINDOW_DAYS);

  const scores = recentHistory.length > 0
    ? recentHistory.map((h) => h.score)
    : [store.sCurrent || store.sBase];

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const topEvents = topEventCodes(store.eventLog);

  const weekStart = recentHistory[0]?.date ?? todayDateString();
  const weekEnd = recentHistory[recentHistory.length - 1]?.date ?? todayDateString();

  const statsPayload = JSON.stringify({ avgScore, maxScore, minScore, topEvents });

  const summaryResponse = await callLLM({
    systemPrompt:
      '당신은 연애 관계 분석 전문가입니다. 주어진 데이터를 바탕으로 이번 주 연애 관계를 따뜻하고 통찰력 있게 2-3문장으로 요약해주세요.',
    userMessage: statsPayload,
  });

  let fullAnalysis: string | undefined;
  if (isPremium) {
    const fullResponse = await callLLM({
      systemPrompt:
        '상세한 관계 패턴 분석과 개선 제안을 제공해주세요. 구체적인 행동 지침을 포함해주세요.',
      userMessage: statsPayload,
    });
    fullAnalysis = fullResponse.content;
  }

  const report: WeeklyReport = {
    weekStart,
    weekEnd,
    avgScore,
    maxScore,
    minScore,
    volatilityIndex: store.volatilityIndex,
    topEvents,
    summary: summaryResponse.content,
    fullAnalysis,
    generatedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(WEEKLY_REPORT_KEY, JSON.stringify(report));
  return report;
}

export async function getLastReport(): Promise<WeeklyReport | null> {
  try {
    const raw = await AsyncStorage.getItem(WEEKLY_REPORT_KEY);
    return raw ? (JSON.parse(raw) as WeeklyReport) : null;
  } catch {
    return null;
  }
}
