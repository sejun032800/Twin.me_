// ─── FUN-HIS/§11 — 커플 Wrapped 모달 ──────────────────────────────────────────
// §11.3 게이팅: 무료 유저는 풀 시퀀스를 볼 수 없다 — 통계 카드 위에 반투명 잠금
// 오버레이를 씌워 실제 숫자를 가린다(블러 대신, RN 기본 View로도 확실히 가려짐).

import { useEffect, useState } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { usePremiumGate } from '@/hooks/usePremiumGate';
import { generateWrapped, type WrappedData } from '@/services/wrappedService';
import { formatScore } from '@/engine/scoreCalculator';
import { BRAND, SYS } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

interface WrappedModalProps {
  visible: boolean;
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '.');
}

export default function WrappedModal({ visible, onClose }: WrappedModalProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { hasReportAccess } = usePremiumGate();
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && !data) {
      setLoading(true);
      generateWrapped(hasReportAccess).then((result) => {
        setData(result);
        setLoading(false);
      });
    }
  }, [visible, data, hasReportAccess]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>✨ 우리의 연애 결산</Text>

          {loading || !data ? (
            <ActivityIndicator color={BRAND.CORAL} style={styles.loading} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.statsContent}>
              <View style={styles.statsWrapper}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>💯 연간 평균</Text>
                  <Text style={styles.statValue}>{formatScore(data.avgScore)}점</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>🏆 최고의 날</Text>
                  <Text style={styles.statValue}>
                    {data.bestDay ? `${formatDate(data.bestDay.date)} (${formatScore(data.bestDay.score)}점)` : '-'}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>💔 힘들었던 날</Text>
                  <Text style={styles.statValue}>
                    {data.worstDay ? `${formatDate(data.worstDay.date)} (${formatScore(data.worstDay.score)}점)` : '-'}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>⚡ 위기 극복</Text>
                  <Text style={styles.statValue}>{data.totalCrisisCount}번</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>🔥 현재 안정 연속</Text>
                  <Text style={styles.statValue}>{data.currentStableStreak}일</Text>
                </View>

                <Text style={styles.aiSummary}>{data.aiSummary}</Text>

                {!hasReportAccess && (
                  <View style={styles.lockOverlay}>
                    <Text style={styles.lockIcon}>🔒</Text>
                    <Text style={styles.lockText}>Coffee Talk으로 잠금 해제</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 24,
      paddingHorizontal: 20,
      paddingBottom: 32,
      maxHeight: '80%',
      gap: 16,
    },
    title: { ...TYPOGRAPHY.heading, color: theme.text, textAlign: 'center' },
    loading: { marginVertical: 40 },
    statsContent: { paddingBottom: 8 },
    statsWrapper: {
      position: 'relative',
      backgroundColor: theme.bg,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statLabel: { ...TYPOGRAPHY.body, color: theme.textMuted },
    statValue: { ...TYPOGRAPHY.bodyMedium, color: theme.text },
    aiSummary: {
      ...TYPOGRAPHY.body,
      color: theme.text,
      lineHeight: 22,
      marginTop: 4,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    lockOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(10,13,26,0.85)',
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    lockIcon: { fontSize: 32 },
    lockText: { ...TYPOGRAPHY.bodyMedium, color: SYS.TEXT_LIGHT },
    closeBtn: {
      backgroundColor: BRAND.CORAL,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
    },
    closeBtnText: { ...TYPOGRAPHY.button, color: SYS.TEXT_LIGHT },
  });
}
