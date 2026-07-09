// ─── 사진 메타데이터 추출 훅 (MASTER.md §7, 구버전 usePhotoMetadata.ts 이식) ─────────
// expo-image-picker의 exif 데이터(launchImageLibraryAsync 호출 시 exif: true 필요)에서
// 촬영 날짜/GPS 좌표를 추출한다. 역지오코딩(locationName)은 추후 구현 — 현재는 null 고정.

export interface PhotoMetadata {
  dateTaken: string | null; // YYYY-MM-DD
  latitude: number | null;
  longitude: number | null;
  locationName: string | null; // 역지오코딩 결과 (추후 구현)
}

function parseExifDate(dateTimeOriginal: unknown): string | null {
  if (typeof dateTimeOriginal !== 'string') return null;
  // 'YYYY:MM:DD HH:MM:SS' → 'YYYY-MM-DD'
  const match = dateTimeOriginal.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseExifCoordinate(value: unknown): number | null {
  return typeof value === 'number' && !isNaN(value) ? value : null;
}

async function extractMetadata(
  imageUri: string,
  exif?: Record<string, any> | null,
): Promise<PhotoMetadata> {
  try {
    if (!exif) {
      return { dateTaken: null, latitude: null, longitude: null, locationName: null };
    }

    return {
      dateTaken: parseExifDate(exif.DateTimeOriginal),
      latitude: parseExifCoordinate(exif.GPSLatitude),
      longitude: parseExifCoordinate(exif.GPSLongitude),
      locationName: null,
    };
  } catch {
    return { dateTaken: null, latitude: null, longitude: null, locationName: null };
  }
}

export function usePhotoMetadata() {
  return { extractMetadata };
}
