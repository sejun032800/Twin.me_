// welcome은 항상-다크 의도 화면. themeMode 리셋('dark')과 고정값이 일치하도록
// resetSession()의 기본값 유지 필요.

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

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
    // isOnboardingComplete = false 유지 → profile → kakao-guide → kakao-upload → genesis → invite-hook 순서
    router.replace('/(auth)/profile');
  }

  return (
    <View style={styles.container}>
      {/* DNA 글로우 링 */}
      <View style={styles.glowRing}>
        <View style={styles.glowInner}>
          <Text style={styles.dnaEmoji}>🧬</Text>
        </View>
      </View>

      {/* 키카피 */}
      <Text style={styles.tagline}>Twin.me</Text>
      <Text style={styles.title}>
        나를 닮은 AI가{'\n'}
        <Text style={styles.titleAccent}>연애를 돌아봐요</Text>
      </Text>
      <Text style={styles.subtitle}>
        카카오톡 대화로 트윈 AI를 만들고{'\n'}
        나의 소통 패턴을 함께 성찰해요
      </Text>

      {/* 버튼 그룹 */}
      <View style={styles.btnGroup}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={styles.primaryBtnText}>시작하기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.secondaryBtnText}>로그인</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleGuest} style={styles.guestBtn}>
        <Text style={styles.guestBtnText}>나중에 둘러볼게요</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#0A0D1A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  glowRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(186, 223, 219, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  glowInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 164, 164, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dnaEmoji: {
    fontSize: 48,
  },
  tagline: {
    fontSize: 13,
    color: '#5A6480',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#E8E4DC',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 8,
  },
  titleAccent: {
    color: '#FFA4A4',
  },
  subtitle: {
    fontSize: 14,
    color: '#5A6480',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 56,
  },
  btnGroup: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#FFA4A4',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255, 164, 164, 0.10)',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 164, 164, 0.25)',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFA4A4',
  },
  devBtn: {
    marginTop: 24,
    padding: 8,
  },
  devBtnText: {
    fontSize: 12,
    color: '#3A4055',
    textAlign: 'center',
  },
  guestBtn: {
    marginTop: 16,
    padding: 8,
  },
  guestBtnText: {
    fontSize: 13,
    color: '#3A4055',
    textAlign: 'center',
  },
});
