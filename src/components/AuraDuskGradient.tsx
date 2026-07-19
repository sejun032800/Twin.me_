// ─── AuraDuskGradient — 회전하는 2색 오라 노을 배경 (MASTER.md §1.3) ────────────
// useAuraDuskMotion()이 계산한 "경계선 각도 목표치/이동 duration"을 Reanimated로
// 부드럽게 트위닝해, 화면 대각선의 2배 크기 오버사이즈 그라데이션 뷰를 회전시킨다.
// 좌표를 매 프레임 재계산하지 않고 transform(rotate)만 갱신하는 방식으로 성능을 확보한다.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAuraDuskMotion } from '@/hooks/useAuraDuskMotion';
import { auraChannelToCss } from '@/engine/auraEngine';
import type { AuraVector } from '@/types/genesis';

interface AuraDuskGradientProps {
  auraVector: AuraVector; // colorA, colorB
  // 이미 해석된 최종 opacity(0~1) — 호출부가 AURA_OPACITY_TIERS/resolveSigmaAuraOpacity
  // (auraThemeEngine.ts, STEP 11-1)로 화면키별 값을 계산해 그대로 넘긴다. 이 컴포넌트는
  // 더 이상 자체적으로 배율을 계산하지 않는다 — "화면별 강도 조회"는 단일 진실 공급원
  // (auraThemeEngine.ts) 책임이고, 이 컴포넌트는 받은 값을 그리기만 한다.
  opacity: number;
  reduceMotion: boolean; // true면 애니메이션 없이 정적 배경
  // true면 각도/색 갱신을 "그 순간 그대로" 멈춘다(STEP 11-2 useAuraDuskMotion(frozen) +
  // 이미 진행 중이던 회전 트윈 자체도 즉시 취소). reduceMotion과 달리 미리 정해둔 각도로
  // 스냅하지 않는다 — 멈추는 지점은 매번 다르다. 기본값 false(항상 명시적으로 넘길 필요는
  // 없는 화면 — 예: 메인 히어로 — 을 위한 안전한 기본값).
  frozen?: boolean;
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

export default function AuraDuskGradient({ auraVector, opacity: opacityProp, reduceMotion, frozen = false }: AuraDuskGradientProps) {
  const [containerSize, setContainerSize] = useState<ContainerSize>({ width: 0, height: 0 });
  const rotation = useSharedValue(0);

  const { boundaryAngleTargetDeg, moveDurationMs } = useAuraDuskMotion(frozen);

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

  // reduceMotion=false, frozen=false — 목표(boundaryAngleTargetDeg)가 바뀔 때마다, 또는
  // frozen이 풀려 재개될 때마다 기준각 + 목표 오프셋으로 다시 트위닝한다. frozen인 동안은
  // 이 효과가 아무것도 하지 않는다 — 이미 진행 중이던 트윈을 "그 순간 그대로" 멈추는 건
  // 아래의 별도 효과가 담당한다. moveDurationMs만 의존성에 걸면 span 갱신(60초 간격)에는
  // 반응하지 않아, 애니메이션 도중 불필요하게 트윈이 재시작(끊김)되는 걸 피한다.
  useEffect(() => {
    if (reduceMotion || frozen) return;
    const targetDeg = baseAngleDeg + boundaryAngleTargetDeg;
    rotation.value = withTiming(targetDeg, {
      duration: moveDurationMs,
      easing: Easing.inOut(Easing.sin),
    });
  }, [reduceMotion, frozen, baseAngleDeg, boundaryAngleTargetDeg, moveDurationMs, rotation]);

  // frozen=true — useAuraDuskMotion(frozen)이 목표/span 갱신만 멈춰줄 뿐, 이미 진행 중이던
  // 화면 회전 트윈 자체는 그대로 두면 다음 목표까지(최대 ~90초) 계속 움직이다 멈춘다 —
  // "그 순간 그대로 얼어붙기"가 아니게 된다. cancelAnimation은 트윈을 목표까지 마저 재생하지
  // 않고 지금 보간된 각도에서 즉시 멈춘다(미리 정해둔 각도로 스냅하는 게 아니라, 매번 다른
  // "멈춘 순간의 각도"). frozen이 풀리면 위 효과가 이 각도를 새 시작점 삼아 자연스럽게 재개한다.
  useEffect(() => {
    if (!frozen) return;
    cancelAnimation(rotation);
  }, [frozen, rotation]);

  const animatedGradientStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const opacity = Math.max(0, Math.min(1, opacityProp));
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
