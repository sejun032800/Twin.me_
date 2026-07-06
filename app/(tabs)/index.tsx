// ─── FUN-HOM-001~003 — 메인 탭 연애 대시보드 (MASTER.md §3, §5.1) ────────────────
// S_Current(자정 정산 공식 일치율, §5.1)를 화면 중앙에 표시. 아직 자정 정산 이벤트가
// 한 번도 없어 S_Current=0인 첫 실행 구간에서는 S_Base(MBTI 기준 점수)로 대체 노출한다.
// 티어는 scoreCalculator.getRelationshipTier()(§5.8, FUN-HOM-003 10단계 매퍼)로 산출.

import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '@/store/userStore';
import { useCoupleStore } from '@/store/coupleStore';
import { useScoreStore } from '@/store/scoreStore';
import { getRelationshipTier, formatScore } from '@/engine/scoreCalculator';
import { BRAND, SYS } from '@/constants/colors';

function computeDDay(relationshipStartDate: string | null): number | null {
  if (!relationshipStartDate) return null;
  const start = new Date(`${relationshipStartDate}T00:00:00`);
  if (isNaN(start.getTime())) return null;
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diffDays = Math.floor((todayMidnight.getTime() - startMidnight.getTime()) / 86_400_000);
  return diffDays + 1; // 시작일을 1일째로 카운트
}

export default function Home() {
  const name = useUserStore((s) => s.name);
  const relationshipStartDate = useCoupleStore((s) => s.relationshipStartDate);
  const sCurrent = useScoreStore((s) => s.sCurrent);
  const sBase = useScoreStore((s) => s.sBase);

  const displayScore = sCurrent > 0 ? sCurrent : sBase;
  const tier = getRelationshipTier(displayScore);
  const dDay = computeDDay(relationshipStartDate);

  const statusMessage =
    displayScore >= 70 ? '오늘도 잘 하고 있어요 💚' :
    displayScore >= 40 ? '평범한 하루예요' :
    '조금 더 신경 써볼까요';

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.name}>{name ?? '트윈'}</Text>
          <Text style={styles.dday}>
            {dDay !== null ? `연애 ${dDay}일째` : '연애 시작일을 입력해주세요'}
          </Text>
        </View>

        <View style={styles.scoreArea}>
          {/* TODO: GRADIENT.BRAND_STOPS 텍스트 그라데이션 — expo-linear-gradient + MaskedView 도입 후 교체 */}
          <Text style={styles.score}>{formatScore(displayScore)}</Text>
          <Text style={styles.scoreLabel}>오늘의 관계 온도</Text>
        </View>

        <View style={styles.tierBadge}>
          <Text style={styles.tierText}>{tier.emoji} {tier.title}</Text>
        </View>

        <Text style={styles.statusMessage}>{statusMessage}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT },
  container: {
    flex: 1,
    backgroundColor: SYS.BG_DARK_MIDNIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 20,
  },
  header: {
    position: 'absolute',
    top: 64,
    alignItems: 'center',
    gap: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: SYS.TEXT_LIGHT,
  },
  dday: {
    fontSize: 14,
    color: '#888',
  },
  scoreArea: {
    alignItems: 'center',
    gap: 8,
  },
  score: {
    fontSize: 64,
    fontWeight: 'bold',
    color: BRAND.CORAL,
    fontVariant: ['tabular-nums'],
  },
  scoreLabel: {
    fontSize: 16,
    color: SYS.TEXT_LIGHT,
  },
  tierBadge: {
    backgroundColor: SYS.CARD_DARK,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  tierText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: BRAND.CORAL,
  },
  statusMessage: {
    fontSize: 14,
    color: '#888',
    marginTop: 12,
  },
});
