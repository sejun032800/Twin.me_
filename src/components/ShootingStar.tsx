// ─── ShootingStar — 개별 별똥별 (FUN-HOM-004, MASTER.md §3 v2.8) ─────────────────
// AuraDuskGradient의 밤하늘 영역(그룹 B, 화면 상단)에서 무작위 x좌표로 시작해 대각선
// 아래로 1.5~2.5초 낙하한다. 낙하 중 터치하면 멈추고 반짝인 뒤 onCaught()을 호출하고,
// 안 잡히고 수평선(곡선 경계 도달 가능한 최대 지점)에 닿으면 그대로 소멸한다. 두 경우
// 모두 화면에서 완전히 사라지는 시점에 onDone()을 호출해, 부모(ShootingStarField)가
// "이전 별 소멸 후 다음 간격 카운트 시작" 규칙을 지킬 수 있게 한다.
//
// 애니메이션은 이 코드베이스의 기존 관례(AuraDuskGradient/useAuraDuskMotion)를 따라
// JS 타이머로 시퀀싱한다 — reanimated 콜백+runOnJS 대신 setTimeout으로 애니메이션
// duration에 맞춰 onCaught/onDone을 호출한다(프레임 단위 정밀 동기화가 필요 없는
// 장식적 이펙트라 이 편이 이 파일 하나로 흐름을 읽기 쉽다).

import { useEffect, useMemo, useRef } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, cancelAnimation, Easing } from 'react-native-reanimated';
import { HORIZON_T_MAX } from '@/hooks/useAuraDuskMotion';

// 네온 별 색상 후보 4개 (MASTER §3 FUN-HOM-004).
export const NEON_STAR_COLORS = ['#C9A8FF', '#7FE8E0', '#FFD98A', '#FF9ED6'] as const;
export type NeonStarColor = (typeof NEON_STAR_COLORS)[number];

const STAR_SIZE = 9;
const TRAIL_LENGTH = 34;
const HIT_SLOP = { top: 24, bottom: 24, left: 24, right: 24 };

const FALL_DURATION_MIN_MS = 1500;
const FALL_DURATION_MAX_MS = 2500;
const DRIFT_MIN_PX = 50;
const DRIFT_MAX_PX = 130;

const FADE_IN_MS = 150;
const VANISH_FADE_MS = 320;
const CATCH_SPARKLE_MS = 260;
const CATCH_FADE_MS = 380;

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

interface ShootingStarProps {
  startX: number; // 시작 x좌표(px) — 부모가 컨테이너 너비 안에서 무작위로 뽑아 전달
  fieldHeight: number; // 부모(하늘 영역) 높이(px) — 소멸 y좌표 계산용
  colorSet: NeonStarColor;
  onCaught: () => void; // 터치로 잡혔을 때 즉시 1회 호출(오버레이 트리거)
  onDone: () => void; // 화면에서 완전히 사라진 시점(소멸 or 잡힌 뒤 반짝임 종료) 1회 호출
}

export default function ShootingStar({ startX, fieldHeight, colorSet, onCaught, onDone }: ShootingStarProps) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  const caughtRef = useRef(false);
  const doneRef = useRef(false);

  // 낙하 목표치 — 마운트 시 1회만 뽑아 고정(재계산되면 궤적이 도중에 틀어져 보인다).
  const { fallDurationMs, driftDx, endY, travelAngleDeg } = useMemo(() => {
    const duration = randomInRange(FALL_DURATION_MIN_MS, FALL_DURATION_MAX_MS);
    const drift = randomInRange(DRIFT_MIN_PX, DRIFT_MAX_PX) * (Math.random() < 0.5 ? -1 : 1);
    const targetY = fieldHeight * HORIZON_T_MAX; // 수평선이 도달할 수 있는 가장 낮은 지점
    const angleDeg = Math.atan2(targetY, drift) * (180 / Math.PI);
    return { fallDurationMs: duration, driftDx: drift, endY: targetY, travelAngleDeg: angleDeg };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function callOnceOnDone() {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }

  useEffect(() => {
    opacity.value = withTiming(1, { duration: FADE_IN_MS });
    translateY.value = withTiming(endY, { duration: fallDurationMs, easing: Easing.linear });
    translateX.value = withTiming(driftDx, { duration: fallDurationMs, easing: Easing.linear });

    const vanishTimer = setTimeout(() => {
      if (caughtRef.current) return;
      opacity.value = withTiming(0, { duration: VANISH_FADE_MS });
      setTimeout(callOnceOnDone, VANISH_FADE_MS);
    }, fallDurationMs);

    return () => clearTimeout(vanishTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCatch() {
    if (caughtRef.current) return;
    caughtRef.current = true;

    cancelAnimation(translateX);
    cancelAnimation(translateY);
    cancelAnimation(opacity);

    scale.value = withSequence(
      withTiming(1.9, { duration: CATCH_SPARKLE_MS / 2, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: CATCH_SPARKLE_MS / 2, easing: Easing.in(Easing.quad) }),
    );
    opacity.value = withTiming(0, { duration: CATCH_FADE_MS });

    onCaught();
    setTimeout(callOnceOnDone, CATCH_FADE_MS);
  }

  const groupStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const headStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // 궤적(trail) — 별머리 뒤쪽(진행 방향의 반대)으로 고정 길이만큼 떨어진 위치에,
  // 진행 각도(travelAngleDeg)로 회전시켜 붙인다. RN의 rotate는 요소 중심 기준으로
  // 돌아가므로, 중심을 미리 반대 방향으로 밀어둔 뒤 회전시키면 한쪽 끝이 별머리에 맞닿는다.
  const travelAngleRad = (travelAngleDeg * Math.PI) / 180;
  const trailOffsetX = -Math.cos(travelAngleRad) * (TRAIL_LENGTH / 2);
  const trailOffsetY = -Math.sin(travelAngleRad) * (TRAIL_LENGTH / 2);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrapper, { left: startX }, groupStyle]}
    >
      <View
        style={[
          styles.trail,
          {
            backgroundColor: colorSet,
            left: STAR_SIZE / 2 - 1 + trailOffsetX,
            top: STAR_SIZE / 2 - TRAIL_LENGTH / 2 + trailOffsetY,
            transform: [{ rotate: `${travelAngleDeg - 90}deg` }],
          },
        ]}
      />
      <Pressable onPress={handleCatch} hitSlop={HIT_SLOP}>
        <Animated.View
          style={[
            styles.head,
            headStyle,
            {
              backgroundColor: colorSet,
              shadowColor: colorSet,
            },
          ]}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    width: STAR_SIZE,
    height: STAR_SIZE,
  },
  head: {
    width: STAR_SIZE,
    height: STAR_SIZE,
    borderRadius: STAR_SIZE / 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 6,
  },
  trail: {
    position: 'absolute',
    width: 2,
    height: TRAIL_LENGTH,
    borderRadius: 1,
    opacity: 0.3,
  },
});
