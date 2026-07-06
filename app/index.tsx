import { Redirect } from 'expo-router';
import { useUserStore } from '@/store/userStore';

export default function Root() {
  const isOnboardingComplete = useUserStore((s) => s.isOnboardingComplete);
  return isOnboardingComplete
    ? <Redirect href="/(tabs)" />
    : <Redirect href="/(auth)/welcome" />;
}
