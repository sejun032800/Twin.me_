// ─── 메모리 맵 — 데이트 장소 저장소 & AI 동선 최적화 (MASTER.md §7, 구버전
// MemoryMapOptimizer.tsx 이식) ────────────────────────────────────────────────
// AsyncStorage 키 'twin_date_places_v1'에 DatePlace[]를 JSON으로 보관하고,
// callLLM으로 지역별 최적 방문 순서를 추천받는다.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { callLLM } from '@/api/llm';

export interface DatePlace {
  id: string;
  name: string;
  area: string;
  date: string; // YYYY-MM-DD
  rating?: number; // 1~5
  memo?: string;
}

const DATE_PLACES_KEY = 'twin_date_places_v1';

export async function loadDatePlaces(): Promise<DatePlace[]> {
  try {
    const raw = await AsyncStorage.getItem(DATE_PLACES_KEY);
    return raw ? (JSON.parse(raw) as DatePlace[]) : [];
  } catch {
    return [];
  }
}

export async function saveDatePlace(place: DatePlace): Promise<void> {
  const places = await loadDatePlaces();
  await AsyncStorage.setItem(DATE_PLACES_KEY, JSON.stringify([place, ...places]));
}

export async function deleteDatePlace(id: string): Promise<void> {
  const places = await loadDatePlaces();
  await AsyncStorage.setItem(
    DATE_PLACES_KEY,
    JSON.stringify(places.filter((p) => p.id !== id)),
  );
}

export async function optimizePlaces(places: DatePlace[]): Promise<DatePlace[]> {
  try {
    const response = await callLLM({
      systemPrompt: `데이트 장소 목록을 받아 지역별로 묶고
    효율적인 방문 순서를 추천해주세요.
    같은 지역 장소를 연속 배치하고
    이동 거리를 최소화하는 순서로 정렬해주세요.
    결과는 id 배열로만 반환해주세요.`,
      userMessage: JSON.stringify(places.map((p) => ({ id: p.id, area: p.area, name: p.name }))),
    });

    const orderedIds = JSON.parse(response.content) as string[];
    const placeById = new Map(places.map((p) => [p.id, p]));
    const reordered = orderedIds.map((id) => placeById.get(id)).filter((p): p is DatePlace => !!p);

    if (reordered.length !== places.length) return places;
    return reordered;
  } catch {
    return places;
  }
}
