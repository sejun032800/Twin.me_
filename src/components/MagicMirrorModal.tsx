// ─── FUN-CHA-004 — Magic Mirror opt-in 모달 (MASTER.md §4, 구버전 MagicMirrorOptInModal.tsx 이식) ──
// 트윈방 최초 진입 시 1회, 트윈이 말투/대화 패턴을 분석해 피드백을 주는 기능에 대한
// 명시적 동의를 구한다. 자동 활성화 금지 원칙(§4.6)에 따라 반드시 사용자 액션으로만
// 활성화되며, 동의 여부는 sessionStore.magicMirrorAccepted에 영구 저장된다.

import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { BRAND, SYS } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const FEATURES = [
  '💬 말투 패턴 분석',
  '🔍 소통 습관 인사이트',
  '✨ 맞춤형 대화 제안',
];

export default function MagicMirrorModal({ visible, onAccept, onDecline }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.icon}>🪞</Text>
          <Text style={styles.title}>Magic Mirror</Text>
          <Text style={styles.desc}>
            트윈이 당신의 말투와 대화 패턴을 분석해{'\n'}
            더 나은 소통 방식을 제안해드려요.{'\n'}
            대화 데이터는 기기에만 저장되며{'\n'}
            외부로 전송되지 않아요.
          </Text>

          <View style={styles.featureList}>
            {FEATURES.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color={BRAND.MINT} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={onAccept}>
              <Text style={styles.primaryBtnText}>시작하기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onDecline}>
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
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 24,
      gap: 16,
    },
    icon: {
      fontSize: 48,
      textAlign: 'center',
    },
    title: {
      ...TYPOGRAPHY.title,
      color: theme.text,
      textAlign: 'center',
    },
    desc: {
      ...TYPOGRAPHY.body,
      color: theme.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },
    featureList: {
      gap: 10,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    featureText: {
      ...TYPOGRAPHY.label,
      color: theme.text,
    },
    actions: {
      gap: 10,
      marginTop: 4,
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
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    secondaryBtnText: {
      ...TYPOGRAPHY.button,
      color: theme.text,
    },
  });
}
