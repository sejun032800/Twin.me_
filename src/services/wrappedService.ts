// ─── FUN-HIS/§11 — 커플 Wrapped 연간 결산 ─────────────────────────────────────
// scoreStore.scoreHistory(최근 400일)에서 연간 최고/최저/평균을 뽑고, AI 한 줄
// 총평을 callLLM()으로 생성한다.
//
// 주의: dailyStatusHistory는 §5.7 위기 메모리 용도로 최근 7일치만 보관하도록
// scoreStore에 설계돼 있다(DAILY_STATUS_MAX_DAYS=7). 그래서 "총 위기 횟수"/"현재
// 안정 연속 일수"는 진짜 연간 통계가 아니라 최근 7일 창 안에서의 값이다 —
// 연간 단위로 정확히 집계하려면 scoreStore에 별도의 장기 위기 이력 필드가
// 추가로 필요하다(현재 범위 밖).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useScoreStore } from '@/store/scoreStore';
import { callLLM } from '@/api/llm';

export interface WrappedDay {
  date: string; // YYYY-MM-DD
  score: number;
}

export interface WrappedData {
  avgScore: number;
  maxScore: number;
  minScore: number;
  bestDay: WrappedDay | null;
  worstDay: WrappedDay | null;
  /** 최근 7일 창 내 CRITICAL_LOSS 발생 횟수 — 위 주의사항 참고 */
  totalCrisisCount: number;
  /** 마지막 CRITICAL_LOSS 이후 안정적으로 유지된 일수 (최근 7일 창 기준) */
  currentStableStreak: number;
  aiSummary: string;
}

const EMPTY_SUMMARY = '아직 쌓인 기록이 없어요. 조금 더 함께 시간을 보내볼까요?';
const FALLBACK_SUMMARY = '한 해 동안 쌓아온 이야기들이 참 소중해요.';
const FREE_SUMMARY = '구독 후 AI 총평을 확인해보세요 ✨';
const WRAPPED_CACHE_KEY = 'twin_wrapped_cache_v1';

interface WrappedCache {
  date: string; // YYYY-MM-DD
  isPremium: boolean;
  data: WrappedData;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function generateWrapped(isPremium: boolean): Promise<WrappedData> {
  const today = todayDateString();

  try {
    const raw = await AsyncStorage.getItem(WRAPPED_CACHE_KEY);
    if (raw) {
      const cache = JSON.parse(raw) as WrappedCache;
      if (cache.date === today && cache.isPremium === isPremium) {
        return cache.data;
      }
    }
  } catch {
    // 캐시 파싱 실패 시 무시하고 재생성
  }

  const store = useScoreStore.getState();
  const history = store.scoreHistory;
  const dailyStatusHistory = store.dailyStatusHistory;

  const totalCrisisCount = dailyStatusHistory.filter((s) => s === 'CRITICAL_LOSS').length;
  const lastCrisisIndex = dailyStatusHistory.lastIndexOf('CRITICAL_LOSS');
  const currentStableStreak =
    lastCrisisIndex === -1 ? dailyStatusHistory.length : dailyStatusHistory.length - lastCrisisIndex - 1;

  if (history.length === 0) {
    const emptyData: WrappedData = {
      avgScore: 0,
      maxScore: 0,
      minScore: 0,
      bestDay: null,
      worstDay: null,
      totalCrisisCount,
      currentStableStreak,
      aiSummary: EMPTY_SUMMARY,
    };
    await saveWrappedCache(today, isPremium, emptyData);
    return emptyData;
  }

  const scores = history.map((h) => h.score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  const bestEntry = history.reduce((a, b) => (b.score > a.score ? b : a));
  const worstEntry = history.reduce((a, b) => (b.score < a.score ? b : a));

  let aiSummary = FREE_SUMMARY;
  if (isPremium) {
    aiSummary = FALLBACK_SUMMARY;
    try {
      const response = await callLLM({
        systemPrompt:
          '당신은 연애 관계 분석 전문가입니다. 주어진 연간 통계를 바탕으로 이 커플의 한 해를 따뜻하고 통찰력 있게 한 문장으로 총평해주세요.',
        userMessage: JSON.stringify({ avgScore, maxScore, minScore, totalCrisisCount, currentStableStreak }),
        maxTokens: 150,
      });
      aiSummary = response.content;
    } catch {
      // LLM 실패 시 기본 총평으로 폴백
    }
  }

  const data: WrappedData = {
    avgScore,
    maxScore,
    minScore,
    bestDay: { date: bestEntry.date, score: bestEntry.score },
    worstDay: { date: worstEntry.date, score: worstEntry.score },
    totalCrisisCount,
    currentStableStreak,
    aiSummary,
  };
  await saveWrappedCache(today, isPremium, data);
  return data;
}

async function saveWrappedCache(date: string, isPremium: boolean, data: WrappedData): Promise<void> {
  try {
    const cache: WrappedCache = { date, isPremium, data };
    await AsyncStorage.setItem(WRAPPED_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 캐시 저장 실패는 무시
  }
}
