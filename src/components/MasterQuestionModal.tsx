// ─── FUN-HOM/FUN-CHA — 마스터 퀘스천 모달 (MASTER.md §3, §4, 구버전 이식) ─────────
// 트윈 AI가 관계 점수 조건 충족 시 던지는 심층 성찰 질문을 반투명 오버레이 카드로
// 노출한다. masterQuestionService.shouldShowMasterQuestion()이 고른 질문을 그대로
// 표시만 하고, 실제 노출 여부/하루 1회 제한은 서비스 쪽 상태에 위임한다.

import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { MasterQuestion } from '@/services/masterQuestionService';
import { BRAND, SYS, MODAL_BACKDROP } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

interface Props {
  visible: boolean;
  question: MasterQuestion | null;
  onClose: () => void;
  onSendToChat: (question: string) => void;
}

export default function MasterQuestionModal({ visible, question, onClose, onSendToChat }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  if (!question) return null;

  function handleSendToChat() {
    if (!question) return;
    onSendToChat(question.question);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>✨ 트윈의 질문</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{question.category}</Text>
            </View>
          </View>

          <Text style={styles.question}>{question.question}</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSendToChat}>
              <Text style={styles.primaryBtnText}>채팅에서 답하기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryBtnText}>나중에</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: MODAL_BACKDROP,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 24,
      gap: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      ...TYPOGRAPHY.label,
      color: theme.textMuted,
    },
    badge: {
      backgroundColor: theme.accentSoft,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: {
      ...TYPOGRAPHY.caption,
      color: theme.text,
    },
    question: {
      ...TYPOGRAPHY.heading,
      color: theme.text,
      textAlign: 'center',
      lineHeight: 30,
    },
    actions: {
      gap: 10,
    },
    primaryBtn: {
      backgroundColor: BRAND.CORAL,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
    },
    primaryBtnText: {
      ...TYPOGRAPHY.button,
      color: SYS.TEXT_LIGHT,
    },
    secondaryBtn: {
      backgroundColor: theme.card,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    secondaryBtnText: {
      ...TYPOGRAPHY.button,
      color: theme.textMuted,
    },
  });
}
