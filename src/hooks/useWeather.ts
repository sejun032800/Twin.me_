// ─── 날씨 훅 (구버전 weatherService.ts 이식) ────────────────────────────────────
// useGeoLocation으로 실제 위치를 조회한 뒤 해당 좌표로 현재 날씨를 가져온다.
// 위치 조회 실패 시 useGeoLocation 내부에서 서울 기본 좌표로 대체된다.

import { useEffect, useState } from 'react';
import { getCurrentWeather, type WeatherData } from '@/services/weatherService';
import { useGeoLocation } from './useGeoLocation';

const SEOUL_LATITUDE = 37.5665;
const SEOUL_LONGITUDE = 126.978;

export function useWeather(): WeatherData | null {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const { requestLocation } = useGeoLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loc = await requestLocation();
      const lat = loc?.latitude ?? SEOUL_LATITUDE;
      const lon = loc?.longitude ?? SEOUL_LONGITUDE;
      const data = await getCurrentWeather(lat, lon);
      if (!cancelled) setWeather(data);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return weather;
}
