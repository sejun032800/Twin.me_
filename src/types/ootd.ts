// ─── OOTD 타입 정의 (MASTER.md §7, 구버전 OOTDArchiveGrid/OOTDUploadSheet 이식) ────

export interface OOTDEntry {
  id: string;
  imageUri: string; // 로컬 파일 URI
  date: string; // YYYY-MM-DD
  mood?: string; // 선택적 무드 태그
  note?: string; // 짧은 메모
  createdAt: string; // ISO timestamp
}
