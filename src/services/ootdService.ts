// ─── OOTD 저장소 (MASTER.md §7, 구버전 이식) ─────────────────────────────────────
// AsyncStorage 키 'twin_ootd_entries_v1'에 OOTDEntry[]를 JSON으로 보관한다.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OOTDEntry } from '@/types/ootd';

const OOTD_ENTRIES_KEY = 'twin_ootd_entries_v1';

export async function loadOOTDEntries(): Promise<OOTDEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(OOTD_ENTRIES_KEY);
    return raw ? (JSON.parse(raw) as OOTDEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveOOTDEntry(entry: OOTDEntry): Promise<void> {
  const entries = await loadOOTDEntries();
  await AsyncStorage.setItem(OOTD_ENTRIES_KEY, JSON.stringify([entry, ...entries]));
}

export async function deleteOOTDEntry(id: string): Promise<void> {
  const entries = await loadOOTDEntries();
  await AsyncStorage.setItem(
    OOTD_ENTRIES_KEY,
    JSON.stringify(entries.filter((e) => e.id !== id)),
  );
}
