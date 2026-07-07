import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { useUserStore } from '@/store/userStore';
import { BRAND, SYS } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/typography';

export default function Splash() {
  const router = useRouter();
  const isOnboardingComplete = useUserStore((s) => s.isOnboardingComplete);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  function navigate() {
    if (isOnboardingComplete) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/welcome');
    }
  }

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 800 }),
      withTiming(1, { duration: 1000 }),
      withTiming(0, { duration: 500 }, (finished) => {
        if (finished) runOnJS(navigate)();
      }),
    );
    scale.value = withTiming(1, { duration: 800 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, animStyle]}>
        <Text style={styles.logo}>Twin.me</Text>
        <Text style={styles.tagline}>나를 닮은 AI</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SYS.BG_DARK_MIDNIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    ...TYPOGRAPHY.display,
    color: BRAND.CORAL,
  },
  tagline: {
    ...TYPOGRAPHY.body,
    color: '#888',
  },
});
