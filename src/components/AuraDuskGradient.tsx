// ─── AuraDuskGradient — 위로 볼록한 수평선 곡선 오라 노을 배경 (MASTER.md §1.3 v2.8) ──
// useAuraDuskMotion()이 계산한 "수평선 높이 목표치(horizonTargetT)/이동 duration"을
// Reanimated로 부드럽게 트위닝해, react-native-svg 곡선(2차 베지어)이 화면 세로
// 45%~65% 밴드 안에서 위로 부풀었다 가라앉았다 숨쉰다.
//
// 레이어 구성:
//   1. 하늘(고정) — 사진 픽셀 샘플링 기반 앵커(DUSK_SKY_ANCHOR)로 천정→지평선을 항상
//      같은 절대 화면 좌표로 그리는 배경 Rect. 개인화된 colorB(그룹 B)가 그 사이에서
//      한 정지점으로 섞여 들어간다.
//   2. 지평선 노을(개인화, 애니메이션) — 곡선 아래를 채우는 Path. 곡선 바로 아래는
//      밝은 colorA(그룹 A), 화면 맨 아래로 갈수록 어두워진다. 이 Path의 `d`만
//      useAnimatedProps로 매 프레임 갱신되고, 하늘 Rect는 정적이라 갱신 비용이 없다.

import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAuraDuskMotion, HORIZON_T_MIN, HORIZON_T_MAX } from '@/hooks/useAuraDuskMotion';
import { auraChannelToCss } from '@/engine/auraEngine';
import { DUSK_SKY_ANCHOR } from '@/constants/colors';
import type { AuraVector } from '@/types/genesis';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface AuraDuskGradientProps {
  auraVector: AuraVector; // colorA, colorB
  // 이미 해석된 최종 opacity(0~1) — 호출부가 AURA_OPACITY_TIERS/resolveSigmaAuraOpacity
  // (auraThemeEngine.ts, STEP 11-1)로 화면키별 값을 계산해 그대로 넘긴다. 이 컴포넌트는
  // 더 이상 자체적으로 배율을 계산하지 않는다 — "화면별 강도 조회"는 단일 진실 공급원
  // (auraThemeEngine.ts) 책임이고, 이 컴포넌트는 받은 값을 그리기만 한다.
  opacity: number;
  reduceMotion: boolean; // true면 애니메이션 없이 정적 배경(밴드 중앙값에 고정)
  // true면 곡선 높이 갱신을 "그 순간 그대로" 멈춘다(STEP 11-2 useAuraDuskMotion(frozen) +
  // 이미 진행 중이던 곡선 트윈 자체도 즉시 취소). reduceMotion과 달리 미리 정해둔 높이로
  // 스냅하지 않는다 — 멈추는 지점은 매번 다르다. 기본값 false(항상 명시적으로 넘길 필요는
  // 없는 화면 — 예: 메인 히어로 — 을 위한 안전한 기본값).
  frozen?: boolean;
}

// 곡선 돔 높이 — 가장자리가 중앙(peak)보다 화면 높이의 이 비율만큼 더 아래(=낮게)
// 처지면서 "위로 볼록한" 형태를 만든다.
const BULGE_HEIGHT_RATIO = 0.08;

// 지평선 노을(그룹 A) 바닥 톤 — 곡선 바로 아래(밝음)에서 화면 맨 아래(어두움)로 갈수록
// lightness를 이 배율만큼 낮춘다.
const GROUND_BOTTOM_LIGHTNESS_FACTOR = 0.45;

// 고정 하늘 그라데이션에서 개인화된 colorB(그룹 B)가 섞여 들어가는 지점 — 0(천정)~1(지평선).
const SKY_COLOR_B_STOP_OFFSET = 0.62;

const HORIZON_T_MID = (HORIZON_T_MIN + HORIZON_T_MAX) / 2;

interface ContainerSize {
  width: number;
  height: number;
}

export default function AuraDuskGradient({ auraVector, opacity: opacityProp, reduceMotion, frozen = false }: AuraDuskGradientProps) {
  const [containerSize, setContainerSize] = useState<ContainerSize>({ width: 0, height: 0 });
  const horizonT = useSharedValue(HORIZON_T_MID);

  const { horizonTargetT, moveDurationMs } = useAuraDuskMotion(frozen);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  // reduceMotion=true — 애니메이션 없이 밴드 중앙값에 고정한 정적 렌더링.
  useEffect(() => {
    if (!reduceMotion) return;
    horizonT.value = HORIZON_T_MID;
  }, [reduceMotion, horizonT]);

  // reduceMotion=false, frozen=false — 목표(horizonTargetT)가 바뀔 때마다, 또는 frozen이
  // 풀려 재개될 때마다 새 목표로 다시 트위닝한다. frozen인 동안은 이 효과가 아무것도 하지
  // 않는다 — 이미 진행 중이던 트윈을 "그 순간 그대로" 멈추는 건 아래의 별도 효과가 담당한다.
  useEffect(() => {
    if (reduceMotion || frozen) return;
    horizonT.value = withTiming(horizonTargetT, {
      duration: moveDurationMs,
      easing: Easing.inOut(Easing.sin),
    });
  }, [reduceMotion, frozen, horizonTargetT, moveDurationMs, horizonT]);

  // frozen=true — useAuraDuskMotion(frozen)이 목표 갱신만 멈춰줄 뿐, 이미 진행 중이던 곡선
  // 트윈 자체는 그대로 두면 다음 목표까지(최대 180초) 계속 움직이다 멈춘다 — "그 순간
  // 그대로 얼어붙기"가 아니게 된다. cancelAnimation은 트윈을 목표까지 마저 재생하지 않고
  // 지금 보간된 높이에서 즉시 멈춘다. frozen이 풀리면 위 효과가 이 높이를 새 시작점 삼아
  // 자연스럽게 재개한다.
  useEffect(() => {
    if (!frozen) return;
    cancelAnimation(horizonT);
  }, [frozen, horizonT]);

  const { width, height } = containerSize;
  const bulge = height * BULGE_HEIGHT_RATIO;

  // 곡선 경로 — M(왼쪽 가장자리, 처진 높이) Q(중앙, 솟은 높이) (오른쪽 가장자리, 처진 높이)
  // L(오른쪽 아래) L(왼쪽 아래) Z. peakY가 horizonT(밴드 45~65%)를 따라 오르내리고, 가장자리는
  // peakY보다 bulge만큼 아래에 위치해 "위로 볼록한" 돔 형태를 이룬다.
  const animatedGroundProps = useAnimatedProps(() => {
    const peakY = horizonT.value * height;
    const edgeY = peakY + bulge;
    return {
      d: `M0,${edgeY} Q${width / 2},${peakY} ${width},${edgeY} L${width},${height} L0,${height} Z`,
    };
  }, [width, height, bulge]);

  const opacity = Math.max(0, Math.min(1, opacityProp));
  const colorACss = auraChannelToCss(auraVector.colorA);
  const colorBCss = auraChannelToCss(auraVector.colorB);
  const groundBottomCss = auraChannelToCss({
    ...auraVector.colorA,
    lightness: auraVector.colorA.lightness * GROUND_BOTTOM_LIGHTNESS_FACTOR,
  });

  const hasMeasured = width > 0 && height > 0;

  return (
    <View style={[styles.container, { opacity }]} onLayout={handleLayout}>
      {hasMeasured && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            {/* 고정 하늘 그라데이션 — 성향과 무관, 사진 픽셀 샘플링 기반(MASTER §1.3).
                천정(고정 검보라) → colorB(개인화) → 지평선(고정 보라) 순으로, 곡선이
                오르내려도 항상 같은 절대 화면 좌표(userSpaceOnUse)를 기준으로 흐른다. */}
            <LinearGradient id="auraDuskSkyGradient" x1={0} y1={0} x2={0} y2={height} gradientUnits="userSpaceOnUse">
              <Stop offset={0} stopColor={DUSK_SKY_ANCHOR.ZENITH_BLACK_PURPLE} />
              <Stop offset={SKY_COLOR_B_STOP_OFFSET} stopColor={colorBCss} />
              <Stop offset={1} stopColor={DUSK_SKY_ANCHOR.HORIZON_PURPLE} />
            </LinearGradient>
            {/* 지평선 노을(그룹 A, 개인화) — 곡선 Path 자체의 bbox(objectBoundingBox) 기준이라
                숨쉬기로 곡선이 오르내려도 항상 "곡선 바로 아래=밝음, 화면 맨 아래=어두움"이
                유지된다. */}
            <LinearGradient id="auraDuskGroundGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset={0} stopColor={colorACss} />
              <Stop offset={1} stopColor={groundBottomCss} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#auraDuskSkyGradient)" />
          <AnimatedPath animatedProps={animatedGroundProps} fill="url(#auraDuskGroundGradient)" />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
