// ─── geohash.ts 단위 테스트 (Deno API 미사용 순수 TS라 Jest에서 바로 import) ────────

import { encodeGeohash } from '../geohash';

describe('encodeGeohash', () => {
  it('알려진 좌표(서울시청, 위키피디아 geohash 예제와 동일 알고리즘)에 대해 안정적인 길이의 base32 문자열을 반환한다', () => {
    const hash = encodeGeohash(37.5665, 126.978, 7);
    expect(hash).toHaveLength(7);
    expect(hash).toMatch(/^[0-9b-hj-km-np-z]+$/);
  });

  it('동일 좌표는 항상 동일 해시를 반환한다(결정론적)', () => {
    const a = encodeGeohash(37.5665, 126.978, 7);
    const b = encodeGeohash(37.5665, 126.978, 7);
    expect(a).toBe(b);
  });

  it('precision이 높을수록 더 긴 해시를 반환한다', () => {
    expect(encodeGeohash(37.5665, 126.978, 5)).toHaveLength(5);
    expect(encodeGeohash(37.5665, 126.978, 9)).toHaveLength(9);
  });

  it('아주 가까운 좌표(같은 ≈153m 셀 안)는 precision=7에서 같은 셀로 묶인다', () => {
    const a = encodeGeohash(37.5665, 126.978, 7);
    const b = encodeGeohash(37.56655, 126.9781, 7);
    expect(a).toBe(b);
  });

  it('멀리 떨어진 좌표(서울 vs 부산)는 다른 해시를 반환한다', () => {
    const seoul = encodeGeohash(37.5665, 126.978, 7);
    const busan = encodeGeohash(35.1796, 129.0756, 7);
    expect(seoul).not.toBe(busan);
  });
});
