// ─── GlassPanel — 6sigma 모드 전용 범용 유리 패널 (STEP 11-3) ────────────────────
// BlurView(expo-blur) 위에 반투명 화이트 오버레이 + 얇은 테두리로 글래스모피즘 기반을
// 구성한다. 콘텐츠 카드의 기반 컴포넌트 — themeMode 분기는 갖지 않으며, sigma 모드일
// 때만 쓰도록 호출부(11-4~)에서 조건 렌더링한다.
//
// 의존성 안내 — expo-blur가 아직 설치되어 있지 않다면 아래 명령으로 설치할 것
// (이 SDK 버전에 맞는 버전을 자동으로 잡아주므로 plain npm install보다 권장):
//   npx expo install expo-blur

import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';

const DEFAULT_INTENSITY = 35; // 요구 범위 30~40의 중앙값
const DEFAULT_BORDER_RADIUS = 22; // 요구 범위 20~24의 중앙값 — "코끼리 warmth" 언어(모서리 둥글게)

interface GlassPanelProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}

export default function GlassPanel({ children, style, intensity = DEFAULT_INTENSITY }: GlassPanelProps) {
  // style로 borderRadius를 오버라이드하면(예: GlassRing이 원형 클리핑을 위해 size/2를 넘기는
  // 경우) 그림자 래퍼뿐 아니라 실제로 블러를 클리핑하는 안쪽 레이어까지 같은 반지름을 써야
  // 모양이 어긋나지 않는다 — flatten해서 세 레이어에 동일하게 적용한다.
  const flatStyle = StyleSheet.flatten(style) as ViewStyle | undefined;
  const borderRadius = flatStyle?.borderRadius ?? DEFAULT_BORDER_RADIUS;

  return (
    <View style={[styles.shadowWrapper, { borderRadius }, style]}>
      <BlurView intensity={intensity} tint="dark" style={[styles.blur, { borderRadius }]}>
        <View style={[styles.overlay, { borderRadius }]}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrapper: {
    // BlurView 쪽(overflow:hidden 필요)이 아니라 이 바깥 래퍼에 그림자를 얹는다 —
    // overflow:hidden과 shadow*는 RN에서 함께 쓸 수 없기 때문(hidden이 그림자를 잘라먹음).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  blur: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
