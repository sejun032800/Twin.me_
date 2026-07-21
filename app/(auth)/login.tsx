import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabaseClient';
import { useUserStore } from '@/store/userStore';
import { useTheme } from '@/hooks/useTheme';
import type { SigmaTheme } from '@/constants/theme';

export default function Login() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  function proceedAfterLogin() {
    const isOnboardingComplete = useUserStore.getState().isOnboardingComplete;
    if (isOnboardingComplete) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/profile');
    }
  }

  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const isEmailNotConfirmed = /email not confirmed/i.test(error.message);
      if (isEmailNotConfirmed && __DEV__) {
        // 개발 전용 데모 우회 — 실제 Supabase 세션은 발급되지 않는다(서버가 이메일
        // 미인증 계정엔 세션 자체를 내주지 않음). 화면 전환만 흉내낼 뿐이라 이후
        // supabase.auth.getUser()를 쓰는 기능(초대코드 생성 등)은 여전히 실패한다 —
        // __DEV__ 분기이므로 프로덕션 빌드에는 이 버튼이 아예 생성되지 않는다.
        Alert.alert('로그인 실패', error.message, [
          { text: '확인', style: 'cancel' },
          { text: '건너뛰기(개발용)', onPress: proceedAfterLogin },
        ]);
      } else {
        Alert.alert('로그인 실패', error.message);
      }
    } else {
      proceedAfterLogin();
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <View>
          <View style={[styles.progressBar, { width: '33%' }]} />

          <Text style={styles.heading}>다시 만나요 👋</Text>
          <Text style={styles.subHeading}>이메일과 비밀번호로 로그인해요</Text>

          <Text style={styles.label}>이메일</Text>
          <TextInput
            style={styles.input}
            placeholder="이메일"
            placeholderTextColor={theme.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            placeholderTextColor={theme.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <View>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (loading || !email.trim() || !password.trim()) && styles.primaryBtnDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading || !email.trim() || !password.trim()}
          >
            <Text style={styles.primaryBtnText}>{loading ? '로그인 중...' : '로그인'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.linkText}>돌아가기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.back()}
          >
            <Text style={styles.backLinkText}>
              처음이세요?{' '}
              <Text style={styles.backLinkAccent}>회원가입하러 가기</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
      padding: 28,
      justifyContent: 'space-between',
    },
    progressBar: {
      height: 2,
      backgroundColor: '#FFA4A4',
      borderRadius: 1,
      marginBottom: 40,
    },
    heading: {
      fontSize: 26,
      fontWeight: '900',
      color: theme.text,
      lineHeight: 36,
      marginBottom: 8,
    },
    subHeading: {
      fontSize: 14,
      color: theme.textMuted,
      marginBottom: 36,
      lineHeight: 22,
    },
    label: {
      fontSize: 12,
      color: theme.textMuted,
      marginBottom: 8,
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      color: theme.text,
      fontSize: 16,
      borderWidth: 0.5,
      borderColor: theme.border,
      marginBottom: 16,
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
    primaryBtnDisabled: {
      backgroundColor: 'rgba(255, 164, 164, 0.25)',
    },
    linkText: {
      fontSize: 13,
      color: theme.textMuted,
      textAlign: 'center',
      marginTop: 16,
    },
    linkAccent: {
      color: '#FFA4A4',
      fontWeight: '600',
    },
    errorText: {
      fontSize: 12,
      color: '#EF4444',
      marginTop: -12,
      marginBottom: 12,
    },
    backLink: {
      paddingVertical: 10,
      alignItems: 'center',
    },
    backLinkText: {
      fontSize: 13,
      color: theme.textMuted,
      textAlign: 'center',
    },
    backLinkAccent: {
      color: '#FFA4A4',
      fontWeight: '600',
    },
  });
}
