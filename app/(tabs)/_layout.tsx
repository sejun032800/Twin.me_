import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useSessionStore } from '@/store/sessionStore';
import { SYS } from '@/constants/colors';

export default function TabsLayout() {
  const theme = useTheme();
  const themeMode = useSessionStore((s) => s.themeMode);
  const isLight = themeMode === 'light';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: isLight
          ? {
              backgroundColor: theme.bg,
              borderTopWidth: 0,
              elevation: 0,
              shadowOpacity: 0,
              height: 60,
              paddingBottom: 8,
              paddingTop: 4,
            }
          : {
              backgroundColor: theme.tabBar,
              borderTopColor: theme.border,
              borderTopWidth: 1,
              height: 60,
              paddingBottom: 8,
              paddingTop: 4,
            },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: isLight ? SYS.TAB_INACTIVE_LIGHT : theme.textMuted,
        tabBarLabelStyle: isLight
          ? { fontSize: 10, fontWeight: '500', marginTop: 2 }
          : { fontSize: 11, marginTop: 2 },
        tabBarIconStyle: { marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: '채팅',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: '히스토리',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
