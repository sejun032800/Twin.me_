// ─── FUN-ONB/FUN-HOM — 클레이 트윈 아바타 (MASTER.md §2, §3, 구버전 ClayTwinAvatar.tsx 이식) ──
// 점토 성장 4단계(§3 "점토 성장 4단계 전환 조건")를 react-native-svg로 재현한다.
// Lottie/3D 렌더러 없이 SVG 도형만으로 무정형(0) → 실루엣(1) → 채색(2) → 완성+오라링(3)을
// 표현하며, 색상은 auraEngine.ts의 AuraVector 중 dominant 축(|axisScore| 최댓값)을 사용한다.

import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { auraChannelToCss } from '@/engine/auraEngine';
import { NEUTRAL_CLAY_CHANNEL } from '@/engine/auraThemeEngine';
import { AURA_AXES } from '@/types/genesis';
import type { AuraAxis, AuraVector } from '@/types/genesis';

const FACE_INK = '#33313D';

interface Props {
  size?: number;
  auraVector: AuraVector | null;
  clayStage?: 0 | 1 | 2 | 3;
}

function dominantColor(auraVector: AuraVector | null): string {
  if (!auraVector) return auraChannelToCss(NEUTRAL_CLAY_CHANNEL);

  let dominantAxis: AuraAxis = AURA_AXES[0];
  let maxAbs = -1;
  for (const axis of AURA_AXES) {
    const abs = Math.abs(auraVector.axisScores[axis]);
    if (abs > maxAbs) {
      maxAbs = abs;
      dominantAxis = axis;
    }
  }
  return auraChannelToCss(auraVector.channels[dominantAxis]);
}

export default function ClayTwinAvatar({ size = 100, auraVector, clayStage = 3 }: Props) {
  const color = clayStage === 0 ? auraChannelToCss(NEUTRAL_CLAY_CHANNEL) : dominantColor(auraVector);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (clayStage === 3) {
      rotation.value = withRepeat(withTiming(360, { duration: 8000, easing: Easing.linear }), -1, false);
    } else {
      rotation.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clayStage]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const isSilhouette = clayStage === 1;
  const showFace = clayStage >= 2;
  const showSmile = clayStage === 3;
  const showRing = clayStage === 3;

  const shapeProps = isSilhouette
    ? { fill: 'none', stroke: color, strokeWidth: 2 }
    : { fill: color, stroke: 'none' };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {showRing && (
        <Animated.View style={[{ position: 'absolute', width: size + 16, height: size + 16 }, ringStyle]}>
          <Svg width={size + 16} height={size + 16} viewBox="0 0 116 116">
            <Circle
              cx={58} cy={58} r={54}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeOpacity={0.6}
              strokeDasharray="10 8"
            />
          </Svg>
        </Animated.View>
      )}

      <Svg width={size} height={size} viewBox="0 0 100 100">
        {clayStage === 0 ? (
          <>
            <Circle cx={50} cy={52} r={42} fill={color} opacity={0.3} />
            <Circle cx={50} cy={54} r={34} fill={color} opacity={0.8} />
          </>
        ) : (
          <>
            <Circle cx={50} cy={52} r={42} opacity={isSilhouette ? 1 : 0.3} {...shapeProps} />
            <Circle cx={50} cy={54} r={34} opacity={isSilhouette ? 1 : 0.8} {...shapeProps} />
            <Circle cx={25} cy={20} r={8} {...shapeProps} />
            <Circle cx={75} cy={20} r={8} {...shapeProps} />
            <Ellipse cx={50} cy={58} rx={26} ry={22} {...shapeProps} />

            {showFace && (
              <>
                <Circle cx={42} cy={54} r={3} fill={FACE_INK} />
                <Circle cx={58} cy={54} r={3} fill={FACE_INK} />
              </>
            )}

            {showSmile && (
              <Path d="M42 66 Q50 72 58 66" stroke={FACE_INK} strokeWidth={2} fill="none" strokeLinecap="round" />
            )}
          </>
        )}
      </Svg>
    </View>
  );
}
