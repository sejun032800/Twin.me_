// ─── personaAdapter.ts 단위테스트 (Phase 3) ─────────────────────────────────
import { enneagramCoreToTopType } from '../personaAdapter';

describe('enneagramCoreToTopType', () => {
  it('한 유형에 확률이 완전히 쏠리면 confidence=1, 해당 유형을 반환한다', () => {
    const p = [0, 0, 1, 0, 0, 0, 0, 0, 0]; // index 2 → '3'
    const result = enneagramCoreToTopType(p);
    expect(result.type).toBe('3');
    expect(result.confidence).toBeCloseTo(1, 5);
  });

  it('균등분포(9개 동일 확률)면 confidence=0에 가깝다', () => {
    const p = Array(9).fill(1 / 9);
    const result = enneagramCoreToTopType(p);
    expect(result.confidence).toBeCloseTo(0, 5);
  });

  it('argmax 인덱스를 올바른 EnneagramType 문자열로 매핑한다(index i ↔ "i+1")', () => {
    const p = [0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.6, 0.05]; // index 7 → '8'
    const result = enneagramCoreToTopType(p);
    expect(result.type).toBe('8');
  });

  it('길이가 9가 아니면 confidence 0으로 폴백한다', () => {
    const result = enneagramCoreToTopType([0.5, 0.5]);
    expect(result.confidence).toBe(0);
  });

  it('confidence는 항상 [0,1] 범위다', () => {
    const p = [0.11, 0.12, 0.1, 0.13, 0.09, 0.11, 0.12, 0.1, 0.12];
    const result = enneagramCoreToTopType(p);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
