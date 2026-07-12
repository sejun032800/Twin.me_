// auth 화면군(login, signup, join, kakao-upload)은 브랜드 일관성을 위해
// 항상-다크 크롬을 유지합니다. useTheme() 미적용 의도적.

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabaseClient';
import { useUserStore } from '@/store/userStore';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('로그인 실패', error.message);
    } else {
      const isOnboardingComplete = useUserStore.getState().isOnboardingComplete;
      if (isOnboardingComplete) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/profile');
      }
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
            placeholderTextColor="#5A6480"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={styles.input}
            placeholder="비밀번호"
            placeholderTextColor="#5A6480"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0D1A',
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
    color: '#E8E4DC',
    lineHeight: 36,
    marginBottom: 8,
  },
  subHeading: {
    fontSize: 14,
    color: '#5A6480',
    marginBottom: 36,
    lineHeight: 22,
  },
  label: {
    fontSize: 12,
    color: '#5A6480',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#131726',
    borderRadius: 12,
    padding: 16,
    color: '#E8E4DC',
    fontSize: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 16,
  },
  inputFocused: {
    borderColor: 'rgba(255, 164, 164, 0.40)',
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
    color: '#5A6480',
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
    color: '#3A4055',
    textAlign: 'center',
  },
  backLinkAccent: {
    color: '#FFA4A4',
    fontWeight: '600',
  },
});
