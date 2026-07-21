// ─── GlassButton — 6sigma 모드 전용 유리 버튼 (STEP 11-3) ────────────────────────
// GlassPanel과 같은 블러 레이어링(그림자 래퍼 → BlurView(테두리+클리핑) → 틴트 오버레이)을
// 쓰되, 오버레이 색을 SIGMA_ACCENT.DEFAULT 틴트로, 테두리를 SIGMA_ACCENT 계열로 바꾼 버전.
// 텍스트는 뒤에 어떤 오라 색이 오든(배경 밝기가 계속 바뀌는 환경) 가독성을 지키기 위해
// 흰색 고정 + textShadow 조합만 쓴다. themeMode 분기는 갖지 않음 — 호출부에서 sigma일 때만 사용.
//
// 의존성 안내 — expo-blur 미설치 시 설치 명령(직접 설치하지 않음): npx expo install expo-blur

import { Pressable, View, Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle, type GestureResponderEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { SIGMA_ACCENT } from '@/constants/colors';

const DEFAULT_INTENSITY = 35;
const BORDER_RADIUS = 22;

// SIGMA_ACCENT.DEFAULT를 "r,g,b" 문자열로 분해 — 상태별로 알파만 바꿔 rgba()에 꽂아 쓴다.
// 하드코딩된 분해값을 직접 유지하지 않고 상수에서 매번 파생시켜, colors.ts의 팔레트가
// 바뀌어도 이 파일을 따로 손보지 않게 한다.
function hexToRgbString(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

const TINT_RGB = hexToRgbString(SIGMA_ACCENT.DEFAULT);
const TINT_DEFAULT = `rgba(${TINT_RGB},0.16)`;
const TINT_PRESSED = `rgba(${TINT_RGB},0.26)`;
const BORDER_DEFAULT = `rgba(${TINT_RGB},0.4)`;

interface GlassButtonProps {
  onPress?: (event: GestureResponderEvent) => void;
  children?: ReactNode;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  intensity?: number;
}

export default function GlassButton({
  onPress,
  children,
  label,
  disabled = false,
  style,
  textStyle,
  intensity = DEFAULT_INTENSITY,
}: GlassButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.shadowWrapper, disabled && styles.disabled, style]}
    >
      {({ pressed }) => (
        <BlurView
          intensity={intensity}
          tint="dark"
          style={[
            styles.blur,
            { borderColor: pressed ? SIGMA_ACCENT.PRESSED : BORDER_DEFAULT },
          ]}
        >
          <View style={[styles.overlay, { backgroundColor: pressed ? TINT_PRESSED : TINT_DEFAULT }]}>
            {/* children이 오면 텍스트 스타일링은 호출부 책임 — label 경로만 흰색+textShadow를 강제한다. */}
            {children ?? <Text style={[styles.label, textStyle]}>{label}</Text>}
          </View>
        </BlurView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadowWrapper: {
    borderRadius: BORDER_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  disabled: {
    opacity: 0.5,
  },
  blur: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
