import { View, Text, StyleSheet } from 'react-native';
import { BRAND, SYS } from '@/constants/colors';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Twin.me</Text>
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: BRAND.CORAL,
  },
});
