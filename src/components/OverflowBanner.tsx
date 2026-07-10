// ─── FUN-HOM-002B — 오버플로우 알림 배너 (MASTER.md §3) ───────────────────────
// v2.2 일일 등락 포화 캡 초과 이벤트(CRITICAL_LOSS/EXCESS_GAIN) 발생 시 홈 최상단에
// 경보 배너를 띄운다. 닫기는 sessionStore.overflowBannerDismissedDate에 당일치 날짜를
// 기록해 처리한다 — 탭 이동 등으로 언마운트돼도 상태가 유지되며, 다음 날(날짜가
// 바뀌면) 다시 노출된다.

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useScoreStore } from '@/store/scoreStore';
import { useSessionStore } from '@/store/sessionStore';
import { useTheme } from '@/hooks/useTheme';
import { BRAND, SYS } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/typography';
import type { OverflowStatus } from '@/engine/scoreCalculator';

const COPY: Record<'CRITICAL_LOSS' | 'EXCESS_GAIN', { bg: string; border: string; text: string }> = {
  EXCESS_GAIN: {
    bg: 'rgba(186, 223, 219, 0.2)', // BRAND.MINT 기반
    border: BRAND.MINT,
    text: '💚 오늘 관계가 매우 좋아요! 이 에너지를 유지해보세요',
  },
  CRITICAL_LOSS: {
    bg: 'rgba(239, 68, 68, 0.1)', // SYS.CRISIS_RED 기반
    border: SYS.CRISIS_RED,
    text: '⚠️ 오늘 관계가 많이 힘들었어요. 잠깐 쉬어가세요',
  },
};

export default function OverflowBanner() {
  const theme = useTheme();
  const dailyStatusHistory = useScoreStore((s) => s.dailyStatusHistory);
  const todayStatus: OverflowStatus = dailyStatusHistory[dailyStatusHistory.length - 1] ?? 'NONE';

  const dismissedDate = useSessionStore((s) => s.overflowBannerDismissedDate);
  const setDismissedDate = useSessionStore((s) => s.setOverflowBannerDismissedDate);

  if (todayStatus === 'NONE') return null;

  const today = new Date().toDateString();
  const isDismissed = dismissedDate === today;
  if (isDismissed) return null;

  const copy = COPY[todayStatus];

  function handleDismiss() {
    setDismissedDate(today);
  }

  return (
    <View style={[styles.banner, { backgroundColor: copy.bg, borderColor: copy.border }]}>
      <Text style={[styles.text, { color: theme.text }]}>{copy.text}</Text>
      <TouchableOpacity onPress={handleDismiss} hitSlop={8}>
        <Ionicons name="close" size={18} color={theme.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginHorizontal: 0,
    marginBottom: 8,
  },
  text: {
    ...TYPOGRAPHY.body,
    flex: 1,
  },
});
