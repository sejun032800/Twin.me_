// ─── FUN-ONB — 인터뷰 콜 모달 (MASTER.md §2, 부록G, 구버전 InterviewCallModal.tsx 이식) ──
// 제네시스 인터뷰(부록G) 질문을 "전화 수신" UI로 감싸 몰입감을 높인다.
// 실제 음성 STT/Realtime API는 TODO — 지금은 타이핑 입력을 답변 제출 수단으로 사용한다.

import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ClayTwinAvatar from '@/components/ClayTwinAvatar';
import { useTheme } from '@/hooks/useTheme';
import { BRAND, SYS } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

interface Props {
  visible: boolean;
  onClose: () => void;
  question: string;
  onSubmit: (text: string) => void;
  confidence: number; // 0~1
  act: 1 | 2 | 3 | 4;
}

function signalLevel(confidence: number): 0 | 1 | 2 | 3 {
  if (confidence >= 0.66) return 3;
  if (confidence >= 0.33) return 2;
  if (confidence > 0) return 1;
  return 0;
}

export default function InterviewCallModal({ visible, onClose, question, onSubmit, confidence, act }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [text, setText] = useState('');
  const level = signalLevel(confidence);

  useEffect(() => {
    setText('');
  }, [question]);

  function handleSubmit() {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText('');
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
        <View style={styles.container}>
        <View style={styles.callerInfo}>
          <ClayTwinAvatar size={100} auraVector={null} clayStage={3} />
          <Text style={styles.callerName}>트윈</Text>
          <Text style={styles.callerSub}>당신의 AI 트윈</Text>
        </View>

        <View style={styles.statusBlock}>
          <View style={styles.statusRow}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedText}>연결됨</Text>
          </View>
          <Text style={styles.actText}>{act}막 진행 중</Text>
          <View style={styles.signalBars}>
            {[1, 2, 3].map((bar) => (
              <View
                key={bar}
                style={[
                  styles.signalBar,
                  { height: 6 + bar * 4 },
                  bar <= level ? styles.signalBarActive : styles.signalBarInactive,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.questionWrap}>
          <View style={styles.questionPointer} />
          <View style={styles.questionCard}>
            <Text style={styles.questionText}>{question}</Text>
          </View>
        </View>

        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="답변하기..."
            placeholderTextColor={SYS.TEXT_MUTED}
            value={text}
            onChangeText={setText}
            multiline
          />
          <View style={styles.callButtonsRow}>
            <TouchableOpacity style={styles.endCallBtn} onPress={onClose}>
              <Ionicons name="call" size={26} color={SYS.TEXT_LIGHT} style={styles.endCallIcon} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sendBtn} onPress={handleSubmit} disabled={!text.trim()}>
              <Ionicons name="call" size={24} color={SYS.TEXT_LIGHT} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(confidence * 100)}%` }]} />
        </View>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: SYS.BG_DARK_MIDNIGHT,
    },
    container: {
      flex: 1,
      paddingHorizontal: 24,
      justifyContent: 'space-between',
    },
    callerInfo: {
      alignItems: 'center',
      gap: 6,
    },
    callerName: {
      ...TYPOGRAPHY.heading,
      color: SYS.TEXT_LIGHT,
      marginTop: 12,
    },
    callerSub: {
      ...TYPOGRAPHY.caption,
      color: SYS.TEXT_MUTED,
    },
    statusBlock: {
      alignItems: 'center',
      gap: 8,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    connectedDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#4ADE80',
    },
    connectedText: {
      ...TYPOGRAPHY.caption,
      color: '#4ADE80',
    },
    actText: {
      ...TYPOGRAPHY.caption,
      color: SYS.TEXT_MUTED,
    },
    signalBars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 3,
      marginTop: 4,
    },
    signalBar: {
      width: 4,
      borderRadius: 2,
    },
    signalBarActive: {
      backgroundColor: BRAND.MINT,
    },
    signalBarInactive: {
      backgroundColor: SYS.CARD_DARK,
    },
    questionWrap: {
      alignItems: 'center',
    },
    questionPointer: {
      width: 0,
      height: 0,
      borderLeftWidth: 10,
      borderRightWidth: 10,
      borderBottomWidth: 10,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: theme.card,
    },
    questionCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      width: '100%',
    },
    questionText: {
      ...TYPOGRAPHY.body,
      color: theme.text,
      textAlign: 'center',
      lineHeight: 24,
    },
    inputArea: {
      gap: 16,
    },
    input: {
      backgroundColor: SYS.CARD_DARK,
      borderRadius: 20,
      paddingHorizontal: 18,
      paddingVertical: 14,
      color: SYS.TEXT_LIGHT,
      ...TYPOGRAPHY.body,
      maxHeight: 100,
    },
    callButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 40,
    },
    endCallBtn: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: SYS.CRISIS_RED,
      alignItems: 'center',
      justifyContent: 'center',
    },
    endCallIcon: {
      transform: [{ rotate: '135deg' }],
    },
    sendBtn: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#4ADE80',
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: SYS.CARD_DARK,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: BRAND.MINT,
      borderRadius: 2,
    },
  });
}
