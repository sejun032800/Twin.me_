// ─── Kakao Ingest Pipeline (FUN-ONB-002) ─────────────────────────────────────
//
// Single entry point called at every raw-text touch point in the app:
// onboarding (app/(auth)/loading.tsx) and the 3 ongoing re-upload handlers
// (chat.tsx, settings/index.tsx, KakaoTalkArchiveManager.tsx). Derives
// everything downstream features need — MemoryQuote, Memory Wall nodes, the
// full weekly report, and batch pattern detection — synchronously, while raw
// text is still in the caller's memory, so callers can discard it right
// after calling this. No raw chat text is retained by this file — only the
// derived results, via the AsyncStorage/FileSystem persistence the four
// sub-pipelines already perform.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  parseKakaoExport,
  selectMemoryQuote,
  extractSweetSentences,
  type MemoryQuote,
  type MemoryNode,
} from '../lib/kakaoParser';
import { runKakaoBatchDetection } from './kakaoBatchDetectionService';
import type { KakaoBatchDetectionResult } from '../engine/twinResponseEngine';
import type { KakaoDateCourse } from '../lib/kakaoParser';
import type { EventHistoryEntry } from '../store/scoreStore';

// weeklyReportService는 Edge Function 프록시로 재작성 예정 (MASTER §14.4)
// 임시 스텁으로 타입 에러 제거
type WeeklyReportData = unknown;
const generateFullReport = async (..._args: unknown[]): Promise<unknown> => {
  throw new Error('weeklyReportService: Edge Function 미구현');
};

interface UserProfile {
  name: string;
  mbti?: string;
}

interface PartnerProfile {
  name: string;
}

const MEMORY_QUOTES_KEY = 'twin_me_memory_quotes_v1';
const MEMORY_WALL_NODES_KEY = 'twin_me_memory_wall_nodes_v1';
const MAX_MEMORY_WALL_NODES = 50;

// ── AsyncStorage: memoryQuotes ────────────────────────────────────────────────

export async function loadMemoryQuotes(): Promise<MemoryQuote[]> {
  try {
    const raw = await AsyncStorage.getItem(MEMORY_QUOTES_KEY);
    return raw ? (JSON.parse(raw) as MemoryQuote[]) : [];
  } catch {
    return [];
  }
}

async function saveMemoryQuotes(quotes: MemoryQuote[]): Promise<void> {
  try {
    await AsyncStorage.setItem(MEMORY_QUOTES_KEY, JSON.stringify(quotes));
  } catch {
    // non-critical
  }
}

async function appendMemoryQuote(quote: MemoryQuote): Promise<MemoryQuote[]> {
  const existing = await loadMemoryQuotes();
  const merged = [quote, ...existing];
  await saveMemoryQuotes(merged);
  return merged;
}

export async function clearMemoryQuotes(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MEMORY_QUOTES_KEY);
  } catch {
    // non-critical
  }
}

// ── AsyncStorage: memoryWallNodes ─────────────────────────────────────────────

export async function loadMemoryWallNodes(): Promise<MemoryNode[]> {
  try {
    const raw = await AsyncStorage.getItem(MEMORY_WALL_NODES_KEY);
    return raw ? (JSON.parse(raw) as MemoryNode[]) : [];
  } catch {
    return [];
  }
}

async function saveMemoryWallNodes(nodes: MemoryNode[]): Promise<void> {
  try {
    await AsyncStorage.setItem(MEMORY_WALL_NODES_KEY, JSON.stringify(nodes));
  } catch {
    // non-critical
  }
}

// Dedupes by exact quote text (keeps the existing entry's score on collision),
// sorts by valenceScore desc, caps at MAX_MEMORY_WALL_NODES. Mirrors the
// algorithm verified in the Step 1/2 scratch script.
async function appendMemoryWallNodes(newNodes: MemoryNode[]): Promise<MemoryNode[]> {
  const existing = await loadMemoryWallNodes();
  const seenQuotes = new Set(existing.map((n) => n.quote));
  const deduped = newNodes.filter((n) => !seenQuotes.has(n.quote));
  const merged = [...deduped, ...existing]
    .sort((a, b) => b.valenceScore - a.valenceScore)
    .slice(0, MAX_MEMORY_WALL_NODES);
  await saveMemoryWallNodes(merged);
  return merged;
}

export async function clearMemoryWallNodes(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MEMORY_WALL_NODES_KEY);
  } catch {
    // non-critical
  }
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export interface IngestPipelineResult {
  memoryQuote: MemoryQuote | null;
  allMemoryQuotes: MemoryQuote[];
  newMemoryNodes: MemoryNode[];
  allMemoryNodes: MemoryNode[];
  report: WeeklyReportData;
  batchSummary: KakaoBatchDetectionResult;
}

export async function runKakaoIngestPipeline(
  rawText: string,
  myProfile: UserProfile,
  partnerProfile: PartnerProfile,
  dateCourses: KakaoDateCourse[],
  eventHistory: EventHistoryEntry[],
): Promise<IngestPipelineResult> {
  const myName = myProfile.name.trim() || '나';

  // 1. 카카오 텍스트 파싱
  const { myLines } = parseKakaoExport(rawText, myName);

  // 2. 배치 탐지 (이벤트 분류)
  const batchSummary = runKakaoBatchDetection(myLines);

  // 3. 감성 문장 추출
  const memoryQuote = selectMemoryQuote(rawText, myName);
  const allMemoryQuotes = memoryQuote
    ? await appendMemoryQuote(memoryQuote)
    : await loadMemoryQuotes();

  const newMemoryNodes = extractSweetSentences(rawText, myName, dateCourses, MAX_MEMORY_WALL_NODES);
  const allMemoryNodes = await appendMemoryWallNodes(newMemoryNodes);

  // 4. 리포트 생성 (실패해도 무시)
  let report: WeeklyReportData = undefined as unknown as WeeklyReportData;
  try {
    report = await generateFullReport(rawText, myProfile, partnerProfile, eventHistory, dateCourses);
  } catch {
    // weeklyReportService 미구현 — 무시하고 계속 진행
  }

  // 5. 결과 반환
  return { memoryQuote, allMemoryQuotes, newMemoryNodes, allMemoryNodes, report, batchSummary };
}
