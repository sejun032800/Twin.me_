// ─── AuraDuskGradient — 회전하는 2색 오라 노을 배경 (MASTER.md §1.3) ────────────
// useAuraDuskMotion()이 계산한 "경계선 각도 목표치/이동 duration"을 Reanimated로
// 부드럽게 트위닝해, 화면 대각선의 2배 크기 오버사이즈 그라데이션 뷰를 회전시킨다.
// 좌표를 매 프레임 재계산하지 않고 transform(rotate)만 갱신하는 방식으로 성능을 확보한다.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAuraDuskMotion } from '@/hooks/useAuraDuskMotion';
import { auraChannelToCss } from '@/engine/auraEngine';
import type { AuraVector } from '@/types/genesis';

interface AuraDuskGradientProps {
  auraVector: AuraVector;    // colorA, colorB
  contextMultiplier: number; // 화면별 오라 강도 (§1.3 화면별 가중치 테이블)
  reduceMotion: boolean;     // true면 애니메이션 없이 정적 배경
}

// 회전축(피벗): 컨테이너 우측 상단에서 세로 10% 지점.
const PIVOT_X_RATIO = 1;
const PIVOT_Y_RATIO = 0.1;

// 기준각 계산용 목표 코너: 화면 좌하단.
const TARGET_CORNER_X_RATIO = 0;
const TARGET_CORNER_Y_RATIO = 1;

// 오버사이즈 정사각형 뷰 내부에서 LinearGradient의 start(0,0)→end(1,1) 대각선은
// 정사각형이므로 항상 45도 — 피벗→목표 코너 각도에서 이 값을 빼야 그라데이션의
// "실제 색 경계선"이 목표 코너를 향하는 회전각(기준각)이 된다.
const GRADIENT_DIAGONAL_DEG = 45;

interface ContainerSize {
  width: number;
  height: number;
}

export default function AuraDuskGradient({ auraVector, contextMultiplier, reduceMotion }: AuraDuskGradientProps) {
  const [containerSize, setContainerSize] = useState<ContainerSize>({ width: 0, height: 0 });
  const rotation = useSharedValue(0);

  const { boundaryAngleTargetDeg, moveDurationMs } = useAuraDuskMotion();

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  // 기준각(baseAngleDeg) — 피벗(우측 상단 세로 10%)에서 목표 코너(좌하단)를 향하는 실제
  // 화면 대각선 방향. 컨테이너가 리사이즈/회전되면 onLayout이 다시 불려 containerSize가
  // 바뀌고, 이 useMemo도 함께 재계산된다.
  const baseAngleDeg = useMemo(() => {
    const { width, height } = containerSize;
    if (width === 0 && height === 0) return 0;

    const pivotX = width * PIVOT_X_RATIO;
    const pivotY = height * PIVOT_Y_RATIO;
    const cornerX = width * TARGET_CORNER_X_RATIO;
    const cornerY = height * TARGET_CORNER_Y_RATIO;

    const dx = cornerX - pivotX;
    const dy = cornerY - pivotY;
    const pivotToCornerDeg = Math.atan2(dy, dx) * (180 / Math.PI);

    return pivotToCornerDeg - GRADIENT_DIAGONAL_DEG;
  }, [containerSize.width, containerSize.height]);

  // reduceMotion=true — 애니메이션 없이 기준각 + 중립 오프셋(0)에 고정한 정적 렌더링.
  useEffect(() => {
    if (!reduceMotion) return;
    rotation.value = baseAngleDeg;
  }, [reduceMotion, baseAngleDeg, rotation]);

  // reduceMotion=false — 목표(boundaryAngleTargetDeg)가 바뀔 때마다 기준각 + 목표 오프셋으로
  // 다시 트위닝. moveDurationMs만 의존성에 걸면 span 갱신(60초 간격)에는 반응하지 않아,
  // 애니메이션 도중 불필요하게 트윈이 재시작(끊김)되는 걸 피한다.
  useEffect(() => {
    if (reduceMotion) return;
    const targetDeg = baseAngleDeg + boundaryAngleTargetDeg;
    // eslint-disable-next-line no-console
    console.log('[AuraDuskGradient] 목표 갱신', { targetAngle: targetDeg, moveDurationMs });
    rotation.value = withTiming(targetDeg, {
      duration: moveDurationMs,
      easing: Easing.inOut(Easing.sin),
    });
  }, [reduceMotion, baseAngleDeg, boundaryAngleTargetDeg, moveDurationMs, rotation]);

  const animatedGradientStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const opacity = Math.min(1, Math.max(0, contextMultiplier));
  const colorACss = auraChannelToCss(auraVector.colorA);
  const colorBCss = auraChannelToCss(auraVector.colorB);

  const diagonal = Math.sqrt(containerSize.width ** 2 + containerSize.height ** 2);
  const oversizeSide = diagonal * 2;
  const pivotX = containerSize.width * PIVOT_X_RATIO;
  const pivotY = containerSize.height * PIVOT_Y_RATIO;
  // 피벗이 곧 회전축이 되도록, 뷰 중심이 피벗과 겹치게 절반만큼 좌상단으로 당겨 배치한다
  // (RN은 transformOrigin을 지원하지 않으므로 배치 좌표로 회전축을 흉내낸다).
  const offsetLeft = pivotX - oversizeSide / 2;
  const offsetTop = pivotY - oversizeSide / 2;

  const hasMeasured = containerSize.width > 0 && containerSize.height > 0;

  return (
    <View style={[styles.container, { opacity }]} onLayout={handleLayout}>
      {hasMeasured && (
        <Animated.View
          style={[
            styles.oversizeGradient,
            { width: oversizeSide, height: oversizeSide, left: offsetLeft, top: offsetTop },
            animatedGradientStyle,
          ]}
        >
          <LinearGradient
            colors={[colorACss, colorBCss]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  oversizeGradient: {
    position: 'absolute',
  },
});
