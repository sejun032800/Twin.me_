import { View, Text, StyleSheet } from 'react-native';
import { SYS, BRAND } from '@/constants/colors';

export default function Settings() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>설정 탭</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT, alignItems: 'center', justifyContent: 'center' },
  text: { color: BRAND.CORAL, fontSize: 20 },
});
