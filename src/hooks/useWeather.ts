// ─── 날씨 훅 (구버전 weatherService.ts 이식) ────────────────────────────────────
// 서울 기본 좌표로 현재 날씨를 가져온다. 위치 권한은 사용자 동의 없이 요청하지
// 않으며, 위치 기반 정확한 날씨는 추후 사용자가 명시적으로 허용할 때 별도 구현한다.

import { useEffect, useState } from 'react';
import { getCurrentWeather, type WeatherData } from '@/services/weatherService';

export interface UseWeatherResult {
  weather: WeatherData | null;
  loading: boolean;
  error: boolean;
}

export function useWeather(): UseWeatherResult {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const DEFAULT_LAT = 37.5665;
    const DEFAULT_LON = 126.978;
    getCurrentWeather(DEFAULT_LAT, DEFAULT_LON)
      .then((data) => {
        setWeather(data);
        setError(data.temperature <= -999);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return { weather, loading, error };
}
