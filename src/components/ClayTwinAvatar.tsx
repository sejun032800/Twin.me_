// ─── FUN-ONB/FUN-HOM — 클레이 트윈 아바타 (MASTER.md §2, §3, 구버전 ClayTwinAvatar.tsx 이식) ──
// 점토 성장 4단계(§3 "점토 성장 4단계 전환 조건")를 react-native-svg로 재현한다.
// Lottie/3D 렌더러 없이 SVG 도형만으로 무정형(0) → 실루엣(1) → 채색(2) → 완성+오라링(3)을
// 표현하며, 색상은 §1.3 2색 오라(colorA/colorB)를 useTheme()의 primaryAuraColor/secondaryAuraColor로
// 받아 대각선 LinearGradient 배경으로 렌더링한다(v2.7 — dominant 1축 단색 방식 폐기).

import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { auraChannelToCss } from '@/engine/auraEngine';
import { NEUTRAL_CLAY_CHANNEL } from '@/engine/auraThemeEngine';
import { useTheme } from '@/hooks/useTheme';
import type { AuraVector } from '@/types/genesis';

const FACE_INK = '#33313D';
const NEUTRAL_CLAY_COLOR = auraChannelToCss(NEUTRAL_CLAY_CHANNEL);

interface Props {
  size?: number;
  auraVector: AuraVector | null;
  clayStage?: 0 | 1 | 2 | 3;
}

// auraVector prop은 다른 소비처와의 인터페이스 호환을 위해 유지한다 — 색상은 더 이상 개별
// prop이 아니라 전역 sigma 테마(useTheme())의 2색 오라를 그대로 따른다.
export default function ClayTwinAvatar({ size = 100, auraVector: _auraVector, clayStage = 3 }: Props) {
  const { primaryAuraColor, secondaryAuraColor } = useTheme();
  const outlineColor = clayStage === 0 ? NEUTRAL_CLAY_COLOR : primaryAuraColor;
  const showGradientBg = clayStage >= 1; // 무정형(0) 단계는 그라데이션 없이 무채색 점토 유지

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

  // stage 1(실루엣): 단색 외곽선만. stage 2/3(채색): 도형 자체는 투명 처리해 뒤의
  // LinearGradient 배경이 몸통 색으로 그대로 비쳐 보이도록 한다.
  const shapeProps = isSilhouette
    ? { fill: 'none', stroke: outlineColor, strokeWidth: 2 }
    : { fill: showGradientBg ? 'transparent' : outlineColor, stroke: 'none' };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {showGradientBg && (
        <LinearGradient
          colors={[primaryAuraColor, secondaryAuraColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: 'absolute',
            width: size * 0.84,
            height: size * 0.84,
            borderRadius: (size * 0.84) / 2,
          }}
        />
      )}

      {showRing && (() => {
        const ringSize = size + 16;
        const ringCenter = ringSize / 2;
        const ringRadius = ringCenter - 4;
        return (
          <Animated.View style={[{ position: 'absolute', width: ringSize, height: ringSize }, ringStyle]}>
            <Svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
              <Circle
                cx={ringCenter} cy={ringCenter} r={ringRadius}
                fill="none"
                stroke={primaryAuraColor}
                strokeWidth={2}
                strokeOpacity={0.6}
                strokeDasharray="10 8"
              />
            </Svg>
          </Animated.View>
        );
      })()}

      <Svg width={size} height={size} viewBox="0 0 100 100">
        {clayStage === 0 ? (
          <>
            <Circle cx={50} cy={52} r={42} fill={outlineColor} opacity={0.3} />
            <Circle cx={50} cy={54} r={34} fill={outlineColor} opacity={0.8} />
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
