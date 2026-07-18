// ─── 연애 DNA 일치율 카드 (Phase 5.5, FEATURE_DNA_V21 ON 경로) ──────────────────
// 근거: docs/audit/통합감사_2026-07-16.md §2/§3 — 커플이 인터뷰를 비동시에 완료해도
// (한쪽이 먼저 끝나도) 나중에 이 카드에 진입/포커스할 때마다 최신 결과를 다시 조회하고,
// 아직 없으면(내 프로필은 있는데 결과가 없는 상태) 이 시점에 재계산을 한 번 더 시도한다
// — 폴링/구독은 이번 범위 밖이라 화면 포커스 시 refetch로 충분하다(요청 범위).

import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { useCoupleStore } from '@/store/coupleStore';
import { useSessionStore } from '@/store/sessionStore';
import { getLatestCoupleDnaResult, computeAndSaveCoupleDna } from '@/services/dnaResultService';
import { useTheme } from '@/hooks/useTheme';
import GlassPanel from '@/components/glass/GlassPanel';
import GlassRing from '@/components/glass/GlassRing';
import { TYPOGRAPHY } from '@/constants/typography';
import type { SigmaTheme } from '@/constants/theme';

export default function DnaCompatibilityCard() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const themeMode = useSessionStore((s) => s.themeMode);
  const psychProfile = useUserStore((s) => s.psychProfile);
  const coupleId = useCoupleStore((s) => s.coupleId);
  const partnerUserId = useCoupleStore((s) => s.partnerUserId);
  const dnaResult = useCoupleStore((s) => s.dnaResult);
  const setDnaResult = useCoupleStore((s) => s.setDnaResult);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!coupleId || !partnerUserId) return;

      (async () => {
        setLoading(true);
        try {
          const latest = await getLatestCoupleDnaResult(coupleId);
          if (latest) {
            if (!cancelled) setDnaResult(latest);
            return;
          }
          // 결과가 아직 없음 — 파트너가 그 사이 완료했을 수도 있으니 한 번 더 시도.
          if (psychProfile) {
            const computed = await computeAndSaveCoupleDna(psychProfile, coupleId, partnerUserId);
            if (computed && !cancelled) setDnaResult(computed);
          }
        } catch {
          // 조회 실패(네트워크 등) — 기존 dnaResult(있다면 로컬 캐시) 유지, 크래시 없음.
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coupleId, partnerUserId]),
  );

  // themeMode==='sigma' 전용 분기(STEP 11-4) — GlassRing을 점수 배경으로 쓴다.
  // light/dark는 이 분기를 절대 거치지 않고 아래의 기존 렌더링 경로를 그대로 탄다.
  if (themeMode === 'sigma') {
    if (loading && !dnaResult) {
      return (
        <GlassPanel style={sigmaStyles.card}>
          <ActivityIndicator color="#FFFFFF" />
        </GlassPanel>
      );
    }

    if (!dnaResult) {
      return (
        <GlassPanel style={sigmaStyles.card}>
          <Text style={sigmaStyles.waitingTitle}>연애 DNA 일치율</Text>
          <Text style={sigmaStyles.waitingText}>파트너가 인터뷰를 완료하면 결과가 나타나요</Text>
        </GlassPanel>
      );
    }

    return (
      <GlassPanel style={sigmaStyles.card}>
        <Text style={sigmaStyles.title}>연애 DNA 일치율</Text>
        <GlassRing progress={dnaResult.dnaPct} size={140} />
        <View style={sigmaStyles.breakdownRow}>
          <View style={sigmaStyles.breakdownItem}>
            <Text style={sigmaStyles.breakdownLabel}>성격</Text>
            <Text style={sigmaStyles.breakdownValue}>{Math.round(dnaResult.sB5 * 100)}</Text>
          </View>
          <View style={sigmaStyles.breakdownItem}>
            <Text style={sigmaStyles.breakdownLabel}>애니어그램</Text>
            <Text style={sigmaStyles.breakdownValue}>{Math.round(dnaResult.sEn * 100)}</Text>
          </View>
          <View style={sigmaStyles.breakdownItem}>
            <Text style={sigmaStyles.breakdownLabel}>스턴버그</Text>
            <Text style={sigmaStyles.breakdownValue}>{Math.round(dnaResult.sSt * 100)}</Text>
          </View>
          <View style={sigmaStyles.breakdownItem}>
            <Text style={sigmaStyles.breakdownLabel}>애착</Text>
            <Text style={sigmaStyles.breakdownValue}>{Math.round(dnaResult.sAtt * 100)}</Text>
          </View>
        </View>
      </GlassPanel>
    );
  }

  if (loading && !dnaResult) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={theme.text} />
      </View>
    );
  }

  if (!dnaResult) {
    return (
      <View style={styles.card}>
        <Text style={styles.waitingTitle}>연애 DNA 일치율</Text>
        <Text style={styles.waitingText}>파트너가 인터뷰를 완료하면 결과가 나타나요</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>연애 DNA 일치율</Text>
      <Text style={styles.percent}>{dnaResult.dnaPct.toFixed(1)}%</Text>
      <View style={styles.breakdownRow}>
        <View style={styles.breakdownItem}>
          <Text style={styles.breakdownLabel}>성격</Text>
          <Text style={styles.breakdownValue}>{Math.round(dnaResult.sB5 * 100)}</Text>
        </View>
        <View style={styles.breakdownItem}>
          <Text style={styles.breakdownLabel}>애니어그램</Text>
          <Text style={styles.breakdownValue}>{Math.round(dnaResult.sEn * 100)}</Text>
        </View>
        <View style={styles.breakdownItem}>
          <Text style={styles.breakdownLabel}>스턴버그</Text>
          <Text style={styles.breakdownValue}>{Math.round(dnaResult.sSt * 100)}</Text>
        </View>
        <View style={styles.breakdownItem}>
          <Text style={styles.breakdownLabel}>애착</Text>
          <Text style={styles.breakdownValue}>{Math.round(dnaResult.sAtt * 100)}</Text>
        </View>
      </View>
    </View>
  );
}

const sigmaStyles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  title: {
    ...TYPOGRAPHY.label,
    color: '#FFFFFF',
  },
  waitingTitle: {
    ...TYPOGRAPHY.label,
    color: '#FFFFFF',
  },
  waitingText: {
    ...TYPOGRAPHY.body,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownLabel: {
    ...TYPOGRAPHY.caption,
    color: 'rgba(255,255,255,0.75)',
  },
  breakdownValue: {
    ...TYPOGRAPHY.bodyMedium,
    color: '#FFFFFF',
  },
});

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      gap: 8,
      alignItems: 'center',
    },
    title: {
      ...TYPOGRAPHY.label,
      color: theme.text,
    },
    waitingTitle: {
      ...TYPOGRAPHY.label,
      color: theme.text,
    },
    percent: {
      ...TYPOGRAPHY.display,
      fontSize: 36,
      color: theme.text,
      fontVariant: ['tabular-nums'],
    },
    waitingText: {
      ...TYPOGRAPHY.body,
      color: theme.textMuted,
      textAlign: 'center',
    },
    breakdownRow: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 4,
    },
    breakdownItem: {
      alignItems: 'center',
    },
    breakdownLabel: {
      ...TYPOGRAPHY.caption,
      color: theme.textMuted,
    },
    breakdownValue: {
      ...TYPOGRAPHY.bodyMedium,
      color: theme.text,
    },
  });
}
