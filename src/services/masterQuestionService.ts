// ─── FUN-HOM/FUN-CHA — 마스터 퀘스천 서비스 (MASTER.md §3, §4, 구버전 이식) ───────
// 관계 점수가 특정 임계값을 넘으면 트윈 AI가 깊은 관계 성찰 질문을 하루 1회 제안한다.
// "오늘 이미 보여줬는지" 판정은 twin_mq_shown_v1 키의 마지막 날짜와 비교하는데, 이
// 값을 sessionStore.ts의 reduceAuraMotion과 동일한 패턴으로 모듈 로드 시 한 번
// AsyncStorage에서 하이드레이션해 모듈 변수에 캐시한다 — shouldShowMasterQuestion()을
// 동기 함수로 유지하면서도 날짜 판정에 반영하기 위함.

import AsyncStorage from '@react-native-async-storage/async-storage';

const SHOWN_KEY = 'twin_mq_shown_v1';

export interface MasterQuestion {
  id: string;
  question: string;
  category: '성찰' | '소통' | '미래' | '감사';
  minScore: number; // 이 질문이 뜨기 위한 최소 점수
}

const MASTER_QUESTIONS: MasterQuestion[] = [
  { id: '1', question: '우리가 처음 만났을 때 네가 가장 인상 깊었던 순간은?', category: '성찰', minScore: 60 },
  { id: '2', question: '최근 내가 너에게 고마웠지만 표현 못한 게 있어?', category: '감사', minScore: 55 },
  { id: '3', question: '우리 관계에서 가장 바꾸고 싶은 한 가지는 뭐야?', category: '소통', minScore: 50 },
  { id: '4', question: '5년 후 우리 모습을 상상하면 어떤 장면이 떠올라?', category: '미래', minScore: 65 },
  { id: '5', question: '내가 힘들 때 네가 가장 해줬으면 하는 것은?', category: '소통', minScore: 45 },
];

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// 마지막으로 보여준 날짜(YYYY-MM-DD) — 모듈 로드 시 한 번 하이드레이션.
let lastShownDate: string | null = null;
AsyncStorage.getItem(SHOWN_KEY)
  .then((raw) => {
    lastShownDate = raw;
  })
  .catch(() => {});

export function shouldShowMasterQuestion(score: number): MasterQuestion | null {
  if (lastShownDate === todayDateString()) return null;

  const eligible = MASTER_QUESTIONS.filter((q) => score >= q.minScore);
  if (eligible.length === 0) return null;

  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function markShownToday(): void {
  const today = todayDateString();
  lastShownDate = today;
  AsyncStorage.setItem(SHOWN_KEY, today).catch(() => {});
}
