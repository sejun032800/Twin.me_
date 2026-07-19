// 스플래시는 테마 초기화 이전 시점에 렌더링되므로 고정 다크 배경 유지.

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
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  // AsyncStorage 복원(onRehydrateStorage)이 끝나기 전에 isOnboardingComplete를 읽으면
  // 재방문 유저가 초기값(false)으로 오판되어 웰컴 화면으로 튕길 수 있다. _hasHydrated가
  // true가 될 때까지 대기하되, 저장소 손상 등으로 하이드레이션 이벤트가 영영 안 오는
  // 극단적 케이스를 대비해 3초 타임아웃 안전장치를 둔다.
  function waitForHydration(): Promise<void> {
    return new Promise((resolve) => {
      if (useUserStore.getState()._hasHydrated) {
        resolve();
        return;
      }
      const timeout = setTimeout(() => {
        unsubscribe();
        resolve();
      }, 3000);
      const unsubscribe = useUserStore.subscribe((state) => {
        if (state._hasHydrated) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
  }

  async function navigate() {
    await waitForHydration();
    const isComplete = useUserStore.getState().isOnboardingComplete;
    if (isComplete) {
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
    color: SYS.TEXT_MUTED,
  },
});
