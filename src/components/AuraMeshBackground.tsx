// ─── AuraMeshBackground — 6색 메시 그라데이션 배경 (6sigma_mesh_gradient_spec.md) ──
// auraVector.meshStops 6개를 화면 6개 고정 포인트에 RadialGradient로 배치해
// 서로 자연스럽게 번지는 배경을 만든다. screenKey별 가중치는 MESH_OPACITY_BY_SCREEN이
// 담당한다 — auraThemeEngine.computeAuraOpacity()는 앰비언트 오버레이용 저강도 값이라
// 뚜렷하게 보여야 하는 배경 메시에는 별도 상수를 쓴다.

import { View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop, G } from 'react-native-svg';
import { auraChannelToCss } from '@/engine/auraEngine';
import type { AuraScreenKey } from '@/engine/auraThemeEngine';
import type { AuraVector } from '@/types/genesis';

interface Props {
  auraVector: AuraVector | null;
  screenKey?: AuraScreenKey;
  children: React.ReactNode;
}

const CX_POSITIONS = ['20%', '80%', '50%', '15%', '85%', '50%'];
const CY_POSITIONS = ['20%', '15%', '50%', '75%', '70%', '90%'];

// computeAuraOpacity는 앰비언트 오버레이용 낮은 값을 반환하므로
// 배경 메시 그라데이션은 별도로 높은 opacity 사용
const MESH_OPACITY_BY_SCREEN: Record<AuraScreenKey, number> = {
  main: 0.85,
  chat: 0.55,
  historyMap: 0.5,
  helix: 1.0,
  settings: 0.7,
  other: 0.0,
};

export default function AuraMeshBackground({ auraVector, screenKey = 'other', children }: Props) {
  const meshOpacity = MESH_OPACITY_BY_SCREEN[screenKey] ?? 0.0;

  return (
    <View style={{ flex: 1 }}>
      <Svg style={{ position: 'absolute', width: '100%', height: '100%' }}>
        <Defs>
          {auraVector?.meshStops.map((channel, i) => (
            <RadialGradient key={i} id={`rg${i}`} cx={CX_POSITIONS[i]} cy={CY_POSITIONS[i]} r="60%">
              <Stop offset="0%" stopColor={auraChannelToCss(channel)} stopOpacity="0.9" />
              <Stop offset="100%" stopColor={auraChannelToCss(channel)} stopOpacity="0" />
            </RadialGradient>
          ))}
        </Defs>
        <Rect width="100%" height="100%" fill="#050810" />
        {auraVector && (
          <G opacity={meshOpacity}>
            {auraVector.meshStops.map((_, i) => (
              <Rect key={i} width="100%" height="100%" fill={`url(#rg${i})`} />
            ))}
          </G>
        )}
      </Svg>
      <View
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(5, 8, 16, 0.3)',
        }}
      />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
