// ─── FUN-SHARE — 공유 카드 (MASTER.md §10) ────────────────────────────────────
// ViewShot으로 캡처될 순수 표시용 카드. 캡처 안정성을 위해 다크 배경/고정 크기로
// 테마와 무관하게 렌더링한다(§10.2 Free 티어 기준 — 오라 테마 완전 연동은 Deep Talk
// Night 전용 킬러 기능(§10.3)이라 이후 단계에서 확장).

import { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { getTierFromScore, formatScore } from '@/engine/scoreCalculator';
import { BRAND, SYS, GRADIENT } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/typography';

export interface ShareCardProps {
  score: number;
}

const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard({ score }, ref) {
  const tier = getTierFromScore(score);

  return (
    <View ref={ref} style={styles.card}>
      <Text style={styles.logo}>Twin.me</Text>

      <View style={styles.scoreSection}>
        <MaskedView maskElement={<Text style={styles.score}>{formatScore(score)}</Text>}>
          <LinearGradient
            colors={[...GRADIENT.BRAND_STOPS]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={[styles.score, { opacity: 0 }]}>{formatScore(score)}</Text>
          </LinearGradient>
        </MaskedView>
        <Text style={styles.tierText}>{tier.emoji} {tier.title}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>나만의 트윈 AI로 연애를 돌아봐요</Text>
        <Text style={styles.footerUrl}>twin.me</Text>
      </View>
    </View>
  );
});

export default ShareCard;

const styles = StyleSheet.create({
  card: {
    width: 300,
    height: 400,
    backgroundColor: SYS.BG_DARK_MIDNIGHT,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    ...TYPOGRAPHY.title,
    color: BRAND.CORAL,
  },
  scoreSection: {
    alignItems: 'center',
    gap: 8,
  },
  score: {
    ...TYPOGRAPHY.display,
    fontVariant: ['tabular-nums'],
  },
  tierText: {
    ...TYPOGRAPHY.label,
    color: SYS.TEXT_LIGHT,
    marginTop: 4,
  },
  footer: {
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    ...TYPOGRAPHY.caption,
    color: SYS.TEXT_LIGHT,
    textAlign: 'center',
  },
  footerUrl: {
    ...TYPOGRAPHY.caption,
    color: BRAND.CORAL,
  },
});
