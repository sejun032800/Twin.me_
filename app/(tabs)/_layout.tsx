import { Tabs } from 'expo-router';
import { BRAND, SYS } from '@/constants/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: SYS.BG_DARK_MIDNIGHT, borderTopColor: '#1E293B' },
        tabBarActiveTintColor: BRAND.CORAL,
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="chat" options={{ title: '채팅' }} />
      <Tabs.Screen name="history" options={{ title: '히스토리' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>
  );
}
