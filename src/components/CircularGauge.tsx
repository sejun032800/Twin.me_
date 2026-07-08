import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { View } from 'react-native';
import { BRAND, SYS } from '@/constants/colors';

interface Props {
  score: number; // 0~100
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
}

export default function CircularGauge({ score, size = 220, strokeWidth = 12, trackColor }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference * (1 - progress / 100);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={BRAND.MINT} stopOpacity="1" />
            <Stop offset="100%" stopColor={BRAND.CORAL} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={center} cy={center} r={radius}
          stroke={trackColor ?? SYS.CARD_DARK} strokeWidth={strokeWidth} fill="none"
        />
        <Circle
          cx={center} cy={center} r={radius}
          stroke="url(#gaugeGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90, ${center}, ${center})`}
        />
      </Svg>
    </View>
  );
}
