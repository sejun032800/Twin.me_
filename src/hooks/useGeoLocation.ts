// ─── 위치 서비스 훅 (구버전 useGeoLocation.ts 이식) ─────────────────────────────
// 위치 권한을 요청해 현재 좌표와 역지오코딩된 도시/구 정보를 제공한다.
// 권한 거부 또는 조회 실패 시 서울 기본 좌표로 대체한다.

import { useState } from 'react';
import * as Location from 'expo-location';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  city?: string; // 도시명 (역지오코딩)
  district?: string; // 구/동
}

const SEOUL_FALLBACK: GeoLocation = { latitude: 37.5665, longitude: 126.978, city: '서울' };

export function useGeoLocation() {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestLocation(): Promise<GeoLocation | null> {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation(SEOUL_FALLBACK);
        return SEOUL_FALLBACK;
      }

      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;

      let city: string | undefined;
      let district: string | undefined;
      try {
        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        city = address?.city ?? undefined;
        district = address?.district ?? undefined;
      } catch {
        // 역지오코딩 실패는 치명적이지 않음 — 좌표만으로 진행
      }

      const result: GeoLocation = { latitude, longitude, city, district };
      setLocation(result);
      return result;
    } catch {
      setError('위치 정보를 가져오지 못했어요.');
      setLocation(SEOUL_FALLBACK);
      return SEOUL_FALLBACK;
    } finally {
      setLoading(false);
    }
  }

  return { location, loading, error, requestLocation };
}
