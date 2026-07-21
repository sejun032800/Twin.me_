// ─── ShootingStarField — 별똥별 스폰 컨테이너 (FUN-HOM-004, MASTER.md §3 v2.8) ────
// AuraDuskGradient(메인 탭 히어로)와 같은 레이어 위에 얹혀, 8~15초 랜덤 간격으로
// 별똥별을 하나씩 낙하시킨다. 별을 잡으면 loadMemoryQuotes()(rawKakaoText,
// MemoryQuote[])에서 category 가중치(warm 90% / funny 10%)로 하나를 뽑아 오버레이로
// 보여주고, 카톡 미업로드 신규 유저처럼 데이터가 아직 없으면 TEMPORARY_AFFECTIONATE_LINES
// 폴백 문구를 대신 보여준다. 6sigma 전용 — 호출부(SigmaMainLayout)가 themeMode==='sigma'
// 일 때만 마운트한다(이 컴포넌트 자체는 조건 분기를 갖지 않는다).
//
// MemoryNode/HighlightGallery(히스토리·홈의 "우리의 기억" 섹션)와는 별개의 데이터
// 경로다 — 그쪽은 건드리지 않는다.

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import ShootingStar, { NEON_STAR_COLORS, type NeonStarColor } from './ShootingStar';
import { loadMemoryQuotes } from '@/services/kakaoIngestPipeline';
import type { MemoryQuote } from '@/lib/kakaoParser';
import { TEMPORARY_AFFECTIONATE_LINES } from '@/data/temporaryAffectionateLines';

const SPAWN_GAP_MIN_MS = 8000;
const SPAWN_GAP_MAX_MS = 15000;
const OVERLAY_AUTO_DISMISS_MS = 4000;

// MemoryQuote 선택 가중치 — warm 90% / funny 10% (MASTER §3 FUN-HOM-004, §2 FUN-ONB-002와
// 동일한 웜톤 우선 비중을 별똥별 오버레이에도 그대로 승계한다).
const WARM_WEIGHT = 0.9;

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickRandomStarColor(): NeonStarColor {
  return NEON_STAR_COLORS[Math.floor(Math.random() * NEON_STAR_COLORS.length)];
}

function pickWeightedMemoryQuote(quotes: MemoryQuote[]): MemoryQuote {
  const warmPool = quotes.filter((q) => q.category === 'warm');
  const funnyPool = quotes.filter((q) => q.category === 'funny');

  const useWarm = warmPool.length > 0 && (funnyPool.length === 0 || Math.random() < WARM_WEIGHT);
  const pool = useWarm ? warmPool : funnyPool.length > 0 ? funnyPool : warmPool;

  return pool[Math.floor(Math.random() * pool.length)];
}

function pickFallbackLine(): string {
  const idx = Math.floor(Math.random() * TEMPORARY_AFFECTIONATE_LINES.length);
  return TEMPORARY_AFFECTIONATE_LINES[idx];
}

interface ActiveStar {
  id: number;
  startX: number;
  colorSet: NeonStarColor;
}

interface ContainerSize {
  width: number;
  height: number;
}

export default function ShootingStarField() {
  const [containerSize, setContainerSize] = useState<ContainerSize>({ width: 0, height: 0 });
  const [activeStar, setActiveStar] = useState<ActiveStar | null>(null);
  const [overlayText, setOverlayText] = useState<string | null>(null);

  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerSizeRef = useRef<ContainerSize>({ width: 0, height: 0 });

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    containerSizeRef.current = { width, height };
    setContainerSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const scheduleNextStar = useCallback(() => {
    const delayMs = randomInRange(SPAWN_GAP_MIN_MS, SPAWN_GAP_MAX_MS);
    spawnTimerRef.current = setTimeout(() => {
      const { width } = containerSizeRef.current;
      if (width > 0) {
        setActiveStar({ id: Date.now(), startX: Math.random() * width, colorSet: pickRandomStarColor() });
      }
    }, delayMs);
  }, []);

  // 컨테이너 크기를 처음 측정한 뒤에만 스폰 루프를 시작한다 — width=0 상태로 시작하면
  // startX 범위를 뽑을 수 없다.
  useEffect(() => {
    if (containerSize.width === 0 || spawnTimerRef.current !== null || activeStar !== null) return;
    scheduleNextStar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerSize.width]);

  useEffect(() => {
    return () => {
      if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    };
  }, []);

  async function showQuoteOverlay() {
    const quotes = await loadMemoryQuotes();
    const text = quotes.length > 0 ? pickWeightedMemoryQuote(quotes).text : pickFallbackLine();

    setOverlayText(text);
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => setOverlayText(null), OVERLAY_AUTO_DISMISS_MS);
  }

  function handleCaught() {
    void showQuoteOverlay();
  }

  // 별이 화면에서 완전히 사라진 시점(잡힘 or 미포착 소멸 모두)에만 다음 간격 카운트를
  // 시작한다 — "이전 별 소멸 후 다음 간격 카운트 시작" 규칙.
  function handleDone() {
    spawnTimerRef.current = null;
    setActiveStar(null);
    scheduleNextStar();
  }

  return (
    <View style={styles.container} onLayout={handleLayout} pointerEvents="box-none">
      {activeStar && containerSize.height > 0 && (
        <ShootingStar
          key={activeStar.id}
          startX={activeStar.startX}
          fieldHeight={containerSize.height}
          colorSet={activeStar.colorSet}
          onCaught={handleCaught}
          onDone={handleDone}
        />
      )}

      {overlayText && (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(220)}
          style={styles.overlayWrapper}
          pointerEvents="box-none"
        >
          <Pressable onPress={() => setOverlayText(null)} style={styles.overlayCard}>
            <Text style={styles.overlayText}>{overlayText}</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  overlayCard: {
    backgroundColor: 'rgba(10,13,26,0.55)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  overlayText: {
    color: '#F8F9FA',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
