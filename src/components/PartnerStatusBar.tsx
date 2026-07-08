// ─── FUN-HOM-002 — 파트너 상태 바 (MASTER.md §3) ──────────────────────────────
// 커플 미연동 시 초대 유도, 연동 시 연인의 현재 상태 태그(S_Live 기반)를 보여준다.

import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useCoupleStore } from '@/store/coupleStore';
import { useScoreStore } from '@/store/scoreStore';
import { useTheme } from '@/hooks/useTheme';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';
import { BRAND } from '@/constants/colors';

function statusTagsFor(sLive: number): string[] {
  if (sLive >= 70) return ['💚 안정적', '☀️ 평온함'];
  if (sLive >= 40) return ['🌤️ 보통', '⏳ 여유로움'];
  return ['🌧️ 주의', '💔 회복 중'];
}

export default function PartnerStatusBar() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const isPartnerConnected = useCoupleStore((s) => s.isPartnerConnected);
  const partnerName = useCoupleStore((s) => s.partnerName);
  const sLive = useScoreStore((s) => s.sLive);

  if (!isPartnerConnected) {
    return (
      <View style={[styles.card, styles.inviteRow]}>
        <Text style={styles.inviteText}>연인을 초대하면 함께할 수 있어요</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings')}>
          <Text style={styles.inviteLink}>초대하기 →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tags = statusTagsFor(sLive);

  return (
    <View style={styles.card}>
      <Text style={styles.partnerName}>{partnerName ?? '연인'}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tagRow}
      >
        {tags.map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    inviteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    inviteText: {
      ...TYPOGRAPHY.body,
      color: theme.textMuted,
      flex: 1,
    },
    inviteLink: {
      ...TYPOGRAPHY.label,
      color: BRAND.CORAL,
    },
    partnerName: {
      ...TYPOGRAPHY.bodyMedium,
      color: theme.text,
    },
    tagRow: {
      flexDirection: 'row',
      gap: 8,
    },
    tag: {
      backgroundColor: theme.bg,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    tagText: {
      ...TYPOGRAPHY.caption,
      color: theme.text,
    },
  });
}
