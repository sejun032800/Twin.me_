// ─── geohash.ts — 표준 geohash(base32) 인코더, Deno API 미사용 순수 TS ────────────
// index.ts(Deno.serve)와 분리해두는 이유는 adaptive-interview/parsing.ts와 동일하다:
// Deno 전역을 참조하지 않는 순수 함수라 Jest에서 바로 import해 단위 테스트할 수 있다.
// date-recommend-architecture.md 레이어2 "지오해시 셀(≈50m 격자)" 캐시 키 생성에 쓰인다.
// precision=7이면 셀 크기가 위도 방향 ≈153m×153m로 "≈50m"보다 다소 크지만, 카카오
// 무료 쿼터 절약이 목적인 캐시 키라 약간 넓은 셀(과매칭 위험보다 캐시 히트율을 우선)로도
// 충분하다 — 문서의 "≈"가 정확한 50m 격자를 요구하는 것은 아니라고 판단했다.

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(lat: number, lng: number, precision = 7): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let isEven = true;
  let bit = 0;
  let charIndex = 0;
  let hash = '';

  while (hash.length < precision) {
    if (isEven) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        charIndex = (charIndex << 1) + 1;
        lngMin = mid;
      } else {
        charIndex = charIndex << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        charIndex = (charIndex << 1) + 1;
        latMin = mid;
      } else {
        charIndex = charIndex << 1;
        latMax = mid;
      }
    }
    isEven = !isEven;

    if (bit < 4) {
      bit++;
    } else {
      hash += BASE32[charIndex];
      bit = 0;
      charIndex = 0;
    }
  }

  return hash;
}
