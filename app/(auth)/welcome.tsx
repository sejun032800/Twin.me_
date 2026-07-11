// welcome은 항상-다크 의도 화면. themeMode 리셋('dark')과 고정값이 일치하도록
// resetSession()의 기본값 유지 필요.

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND, SYS, GRADIENT } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/typography';

export default function Welcome() {
  const router = useRouter();

  async function handleGuest() {
    // 게스트 모드: 온보딩 스킵하고 탭으로 바로 진입
    // userStore의 isOnboardingComplete는 false로 유지
    // (다음 앱 실행 시 다시 welcome으로 돌아옴)
    router.replace('/(tabs)');
  }

  function handleDevSkip() {
    // 개발 테스트용 — 로그인 없이 온보딩 흐름 진입
    // isOnboardingComplete = false 유지 → profile → kakao-upload → genesis 순서
    router.replace('/(auth)/profile');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Twin.me</Text>
      <Text style={styles.sub}>나를 닮은 AI와 함께{'\n'}연애를 돌아보세요</Text>
      <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
        <LinearGradient
          colors={[...GRADIENT.BRAND_STOPS]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.btn}
        >
          <Text style={styles.btnText}>시작하기</Text>
        </LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
        <Text style={styles.link}>이미 계정이 있어요</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleGuest}>
        <Text style={styles.guest}>나중에 둘러볼게요</Text>
      </TouchableOpacity>
      {__DEV__ && (
        <TouchableOpacity onPress={handleDevSkip} style={styles.devBtn}>
          <Text style={styles.devBtnText}>🛠️ 개발용: 온보딩 테스트</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 },
  logo: { ...TYPOGRAPHY.display, color: BRAND.CORAL },
  sub: { ...TYPOGRAPHY.body, color: SYS.TEXT_LIGHT, textAlign: 'center' },
  btn: { width: '100%', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  btnText: { ...TYPOGRAPHY.button, color: SYS.TEXT_LIGHT },
  link: { ...TYPOGRAPHY.caption, color: BRAND.MINT, marginTop: 8 },
  guest: { fontSize: 13, color: SYS.TEXT_MUTED, marginTop: 8 },
  devBtn: { marginTop: 24, padding: 12, borderWidth: 1, borderColor: SYS.TEXT_MUTED, borderRadius: 8 },
  devBtnText: { fontSize: 12, color: SYS.TEXT_MUTED, textAlign: 'center' },
});
