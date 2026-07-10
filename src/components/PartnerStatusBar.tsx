// ─── FUN-HOM-002 — 파트너 상태 바 (MASTER.md §3) ──────────────────────────────
// 커플 미연동 시 초대 유도, 연동 시 연인의 현재 상태 태그(S_Live 기반)를 보여준다.

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCoupleStore } from '@/store/coupleStore';
import { useScoreStore } from '@/store/scoreStore';
import { useUserStore } from '@/store/userStore';
import { useTheme } from '@/hooks/useTheme';
import { getPartnerMood, setMyMood, MOOD_OPTIONS, type PartnerMood } from '@/services/partnerMoodService';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';
import { BRAND, SYS } from '@/constants/colors';

function statusTagsFor(sLive: number): string[] {
  if (sLive >= 70) return ['💚 안정적', '☀️ 평온함'];
  if (sLive >= 40) return ['🌤️ 보통', '⏳ 여유로움'];
  return ['🌧️ 주의', '💔 회복 중'];
}

export default function PartnerStatusBar() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const isPartnerConnected = useCoupleStore((s) => s.isPartnerConnected);
  const partnerName = useCoupleStore((s) => s.partnerName);
  const coupleId = useCoupleStore((s) => s.coupleId);
  const userId = useUserStore((s) => s.userId);
  const sLive = useScoreStore((s) => s.sLive);
  const [partnerMood, setPartnerMood] = useState<PartnerMood | null>(null);
  const [showMoodPicker, setShowMoodPicker] = useState(false);

  useEffect(() => {
    if (!isPartnerConnected || !coupleId || !userId) return;
    getPartnerMood(coupleId, userId).then(setPartnerMood);
  }, [isPartnerConnected, coupleId, userId]);

  async function handleSelectMood(emoji: string, text: string) {
    if (!coupleId || !userId) return;
    try {
      await setMyMood(emoji, text, coupleId, userId);
    } catch {
      Alert.alert('저장 실패', '무드를 저장하지 못했어요. 다시 시도해주세요.');
    } finally {
      setShowMoodPicker(false);
    }
  }

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
      <View style={styles.nameRow}>
        <View style={styles.nameRowLeft}>
          <Text style={styles.partnerName}>{partnerName ?? '연인'}</Text>
          {partnerMood && (
            <Text style={styles.partnerMoodText}>
              {partnerMood.emoji} {partnerMood.text}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.moodSetBtn} onPress={() => setShowMoodPicker(true)}>
          <Text style={styles.moodSetBtnText}>내 무드 설정</Text>
        </TouchableOpacity>
      </View>

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

      <Modal
        visible={showMoodPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoodPicker(false)}
      >
        <View style={styles.moodOverlay}>
          <TouchableOpacity
            style={styles.moodBackdrop}
            activeOpacity={1}
            onPress={() => setShowMoodPicker(false)}
          />
          <View style={[styles.moodSheet, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
            <Text style={styles.moodSheetTitle}>지금 내 기분은?</Text>
            <View style={styles.moodGrid}>
              {MOOD_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.text}
                  style={styles.moodOption}
                  onPress={() => handleSelectMood(option.emoji, option.text)}
                >
                  <Text style={styles.moodOptionEmoji}>{option.emoji}</Text>
                  <Text style={styles.moodOptionText}>{option.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
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
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    nameRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    partnerName: {
      ...TYPOGRAPHY.bodyMedium,
      color: theme.text,
    },
    partnerMoodText: {
      ...TYPOGRAPHY.caption,
      color: theme.textMuted,
    },
    moodSetBtn: {
      backgroundColor: BRAND.MINT,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    moodSetBtnText: {
      ...TYPOGRAPHY.caption,
      color: SYS.TEXT_DARK,
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
    moodOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    moodBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    moodSheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      gap: 16,
    },
    moodSheetTitle: {
      ...TYPOGRAPHY.title,
      color: theme.text,
      textAlign: 'center',
    },
    moodGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
    },
    moodOption: {
      width: '47%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.bgSecondary,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    moodOptionEmoji: {
      fontSize: 22,
    },
    moodOptionText: {
      ...TYPOGRAPHY.bodyMedium,
      color: theme.text,
    },
  });
}
