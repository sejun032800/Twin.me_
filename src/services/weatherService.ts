// ─── 날씨 서비스 (구버전 weatherService.ts 이식) ────────────────────────────────
// Open-Meteo(API 키 불필요)로 현재 날씨를 조회해 홈 탭 분위기 태그/AI 코칭에
// 날씨 컨텍스트를 제공한다. AsyncStorage에 1시간 캐시.

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WeatherData {
  temperature: number; // 현재 기온 (°C)
  weatherCode: number; // WMO 날씨 코드
  description: string; // 날씨 설명 (한국어)
  emoji: string; // 날씨 이모지
  isGoodForDate: boolean; // 데이트하기 좋은 날씨 여부
}

const WEATHER_CACHE_KEY = 'twin_weather_cache_v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

const FALLBACK_WEATHER: WeatherData = {
  temperature: -999,
  weatherCode: 0,
  description: '날씨 정보 없음',
  emoji: '🌡️',
  isGoodForDate: true,
};

interface WeatherCache {
  latitude: number;
  longitude: number;
  fetchedAt: number;
  data: WeatherData;
}

function mapWeatherCode(code: number): { description: string; emoji: string; isGoodForDate: boolean } {
  if (code === 0) return { description: '맑음', emoji: '☀️', isGoodForDate: true };
  if (code >= 1 && code <= 3) return { description: '구름 조금', emoji: '⛅', isGoodForDate: true };
  if (code >= 45 && code <= 48) return { description: '안개', emoji: '🌫️', isGoodForDate: false };
  if (code >= 51 && code <= 67) return { description: '비', emoji: '🌧️', isGoodForDate: false };
  if (code >= 71 && code <= 77) return { description: '눈', emoji: '❄️', isGoodForDate: false };
  if (code >= 80 && code <= 82) return { description: '소나기', emoji: '🌦️', isGoodForDate: false };
  if (code >= 95 && code <= 99) return { description: '뇌우', emoji: '⛈️', isGoodForDate: false };
  return { description: '알 수 없음', emoji: '🌡️', isGoodForDate: true };
}

async function readCache(latitude: number, longitude: number): Promise<WeatherData | null> {
  try {
    const raw = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as WeatherCache;

    const isFresh = Date.now() - cache.fetchedAt < CACHE_TTL_MS;
    const isSameLocation = cache.latitude === latitude && cache.longitude === longitude;
    return isFresh && isSameLocation ? cache.data : null;
  } catch {
    return null;
  }
}

async function writeCache(latitude: number, longitude: number, data: WeatherData): Promise<void> {
  try {
    const cache: WeatherCache = { latitude, longitude, fetchedAt: Date.now(), data };
    await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // non-critical
  }
}

export async function getCurrentWeather(latitude: number, longitude: number): Promise<WeatherData> {
  const cached = await readCache(latitude, longitude);
  if (cached) return cached;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=Asia/Seoul`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`날씨 API 호출 실패: ${response.status}`);

    const json = await response.json();
    const temperature = json?.current?.temperature_2m;
    const weatherCode = json?.current?.weather_code;

    if (typeof temperature !== 'number' || typeof weatherCode !== 'number') {
      throw new Error('날씨 응답 형식이 올바르지 않아요');
    }

    const { description, emoji, isGoodForDate } = mapWeatherCode(weatherCode);
    const data: WeatherData = { temperature, weatherCode, description, emoji, isGoodForDate };

    await writeCache(latitude, longitude, data);
    return data;
  } catch {
    return FALLBACK_WEATHER;
  }
}
