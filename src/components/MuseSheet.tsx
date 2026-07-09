// ─── FUN-CHA — AI 뮤즈 시트 (MASTER.md §4, 구버전 aiMuseService.ts 이식) ──────────
// 트윈방 입력창의 "✨" 버튼에서 열리는 하단 시트. 대화 맥락 기반 메시지 제안 3개를
// 보여주고, 탭 하면 해당 텍스트를 입력창에 채워 넣는다.

import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useScoreStore } from '@/store/scoreStore';
import { useCoupleStore } from '@/store/coupleStore';
import { useTheme } from '@/hooks/useTheme';
import { generateMuseSuggestions, type MuseSuggestion } from '@/services/aiMuseService';
import { BRAND } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (text: string) => void;
  recentMessages: string[];
}

export default function MuseSheet({ visible, onClose, onSelect, recentMessages }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const sLive = useScoreStore((s) => s.sLive);
  const partnerName = useCoupleStore((s) => s.partnerName);
  const [suggestions, setSuggestions] = useState<MuseSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadSuggestions() {
    setLoading(true);
    try {
      const result = await generateMuseSuggestions({
        recentMessages,
        partnerName: partnerName ?? '연인',
        score: sLive,
      });
      setSuggestions(result);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (visible) loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>✨ AI 뮤즈</Text>
          <Text style={styles.subtitle}>연인에게 보낼 말을 골라보세요</Text>

          {loading ? (
            <ActivityIndicator style={styles.loading} color={BRAND.CORAL} />
          ) : (
            <View style={styles.suggestionList}>
              {suggestions.map((suggestion, i) => (
                <TouchableOpacity
                  key={`${suggestion.text}-${i}`}
                  style={styles.card}
                  onPress={() => {
                    onSelect(suggestion.text);
                    onClose();
                  }}
                >
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{suggestion.category}</Text>
                  </View>
                  <Text style={styles.cardText}>{suggestion.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.refreshBtn} onPress={loadSuggestions} disabled={loading}>
            <Text style={styles.refreshBtnText}>다른 제안 보기 🔄</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      gap: 16,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: 'center',
    },
    title: {
      ...TYPOGRAPHY.title,
      color: theme.text,
      textAlign: 'center',
    },
    subtitle: {
      ...TYPOGRAPHY.caption,
      color: theme.textMuted,
      textAlign: 'center',
      marginTop: -8,
    },
    loading: {
      marginVertical: 24,
    },
    suggestionList: {
      gap: 12,
    },
    card: {
      backgroundColor: theme.bgSecondary,
      borderRadius: 16,
      padding: 16,
      gap: 8,
    },
    categoryBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.accentSoft,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    categoryBadgeText: {
      ...TYPOGRAPHY.caption,
      color: BRAND.CORAL,
    },
    cardText: {
      ...TYPOGRAPHY.body,
      color: theme.text,
    },
    refreshBtn: {
      alignSelf: 'center',
      paddingVertical: 8,
    },
    refreshBtnText: {
      ...TYPOGRAPHY.label,
      color: theme.textMuted,
    },
  });
}
