// ─── GlassRing — 6sigma 모드 전용 원형 진행률 글래스 배경 (STEP 11-3) ─────────────
// DnaCompatibilityCard(연애 DNA 일치율)의 6sigma 모드 전용 배경. 원형으로 클리핑한
// GlassPanel(=blur+틴트+테두리) 위에 react-native-svg로 진행률 아크를 그리고, 중앙에
// 숫자를 얹는다. themeMode 분기는 갖지 않음 — 호출부(DnaCompatibilityCard)에서 sigma일
// 때만 이 컴포넌트를 쓰도록 조건 렌더링한다.
//
// 의존성 안내 — expo-blur 미설치 시 설치 명령(직접 설치하지 않음): npx expo install expo-blur

import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import GlassPanel from './GlassPanel';
import { SIGMA_ACCENT } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/typography';

const STROKE_WIDTH_RATIO = 0.045; // size 대비 아크 두께 비율
const FONT_SIZE_RATIO = 0.22; // size 대비 중앙 숫자 폰트 크기 비율
const TRACK_COLOR = 'rgba(255,255,255,0.15)'; // 아크 뒤 트랙 — glass 톤에 맞춘 옅은 화이트

interface GlassRingProps {
  progress: number; // 0~100
  size: number;
}

export default function GlassRing({ progress, size }: GlassRingProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  const strokeWidth = size * STROKE_WIDTH_RATIO;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <GlassPanel style={{ width: size, height: size, borderRadius: size / 2 }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle
            cx={center} cy={center} r={radius}
            stroke={TRACK_COLOR} strokeWidth={strokeWidth} fill="none"
          />
          <Circle
            cx={center} cy={center} r={radius}
            stroke={SIGMA_ACCENT.RING}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90, ${center}, ${center})`}
          />
        </Svg>
        <View style={styles.centerTextWrapper}>
          <Text
            style={[
              styles.centerText,
              { fontSize: size * FONT_SIZE_RATIO },
            ]}
          >
            {clamped.toFixed(1)}%
          </Text>
        </View>
      </GlassPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  centerTextWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    ...TYPOGRAPHY.display,
    color: '#F8F9FA',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
