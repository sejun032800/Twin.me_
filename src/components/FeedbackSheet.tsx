// ─── FUN-CHA-002 — 말투 교정 피드백 시트 (MASTER.md §4.4) ──────────────────────
// 트윈/분석가 방 AI 말풍선 롱프레스 시 열리는 하단 시트. 피드백 타입을 골라
// 확인하면 onSelect로 해당 타입을 전달, 호출부가 답변을 재요청해 말풍선을 교체한다.

import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { BRAND, SYS, MODAL_BACKDROP } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

export type FeedbackType = 'too_warm' | 'too_cold' | 'humor_mismatch';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: FeedbackType) => void;
}

const OPTIONS: { type: FeedbackType; label: string }[] = [
  { type: 'too_warm', label: '😊 너무 다정함' },
  { type: 'too_cold', label: '😐 너무 딱딱함' },
  { type: 'humor_mismatch', label: '😅 유머 코드 안 맞음' },
];

export default function FeedbackSheet({ visible, onClose, onSelect }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<FeedbackType | null>(null);

  function handleConfirm() {
    if (!selected) return;
    onSelect(selected);
    setSelected(null);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>트윈 응답 조정</Text>

          <View style={styles.optionList}>
            {OPTIONS.map((option) => {
              const isSelected = selected === option.type;
              return (
                <TouchableOpacity
                  key={option.type}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => setSelected(option.type)}
                >
                  <Text style={styles.optionText}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!selected}
          >
            <Text style={styles.confirmBtnText}>확인</Text>
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
      backgroundColor: MODAL_BACKDROP,
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
    optionList: {
      gap: 12,
    },
    option: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 16,
    },
    optionSelected: {
      borderColor: BRAND.CORAL,
      backgroundColor: BRAND.CORAL + '20',
    },
    optionText: {
      ...TYPOGRAPHY.body,
      color: theme.text,
    },
    confirmBtn: {
      backgroundColor: BRAND.CORAL,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    confirmBtnDisabled: {
      opacity: 0.4,
    },
    confirmBtnText: {
      ...TYPOGRAPHY.button,
      color: SYS.TEXT_LIGHT,
    },
  });
}
