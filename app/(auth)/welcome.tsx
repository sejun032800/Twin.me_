import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND, SYS } from '@/constants/colors';

export default function Welcome() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Twin.me</Text>
      <Text style={styles.sub}>나를 닮은 AI와 함께{'\n'}연애를 돌아보세요</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.push('/(auth)/signup')}>
        <Text style={styles.btnText}>시작하기</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
        <Text style={styles.link}>이미 계정이 있어요</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 },
  logo: { fontSize: 40, fontWeight: 'bold', color: BRAND.CORAL },
  sub: { fontSize: 18, color: SYS.TEXT_LIGHT, textAlign: 'center', lineHeight: 28 },
  btn: { width: '100%', backgroundColor: BRAND.CORAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  btnText: { fontSize: 16, fontWeight: 'bold', color: SYS.TEXT_LIGHT },
  link: { fontSize: 14, color: BRAND.MINT, marginTop: 8 },
});
