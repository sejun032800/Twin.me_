import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabaseClient';
import { BRAND, SYS, GRADIENT } from '@/constants/colors';

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('가입 실패', error.message);
    } else {
      Alert.alert('확인 이메일 발송', '이메일을 확인해주세요.', [
        { text: '확인', onPress: () => router.replace('/(auth)/profile') }
      ]);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>회원가입</Text>
      <TextInput
        style={styles.input}
        placeholder="이메일"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호 (6자 이상)"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity onPress={handleSignup} disabled={loading}>
        <LinearGradient
          colors={[...GRADIENT.BRAND_STOPS]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.btn}
        >
          <Text style={styles.btnText}>{loading ? '가입 중...' : '가입하기'}</Text>
        </LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>돌아가기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT, padding: 32, justifyContent: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: BRAND.CORAL, marginBottom: 8 },
  input: { backgroundColor: SYS.CARD_DARK, borderRadius: 12, padding: 16, color: SYS.TEXT_LIGHT, fontSize: 16 },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { fontSize: 16, fontWeight: 'bold', color: SYS.TEXT_LIGHT },
  link: { fontSize: 14, color: BRAND.MINT, textAlign: 'center', marginTop: 8 },
});
