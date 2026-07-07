// ─── FUN-HOM-001~003 — 메인 탭 연애 대시보드 (MASTER.md §3, §5.1) ────────────────
// S_Current(자정 정산 공식 일치율, §5.1)를 화면 중앙에 표시. 아직 자정 정산 이벤트가
// 한 번도 없어 S_Current=0인 첫 실행 구간에서는 S_Base(MBTI 기준 점수)로 대체 노출한다.
// 티어는 scoreCalculator.getRelationshipTier()(§5.8, FUN-HOM-003 10단계 매퍼)로 산출.
// 정보 밀도보다 여백과 감성을 우선하는 미니멀 레이아웃 — 카드 박스는 최소화한다.

import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CircularGauge from '@/components/CircularGauge';
import { useUserStore } from '@/store/userStore';
import { useCoupleStore } from '@/store/coupleStore';
import { useScoreStore } from '@/store/scoreStore';
import { getRelationshipTier, formatScore } from '@/engine/scoreCalculator';
import { BRAND, SYS, GRADIENT } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/typography';

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

function statusEmoji(score: number): string {
  if (score >= 70) return '💚';
  if (score >= 40) return '🌤️';
  return '🌧️';
}

export default function Home() {
  const router = useRouter();
  const name = useUserStore((s) => s.name);
  const relationshipStartDate = useCoupleStore((s) => s.relationshipStartDate);
  const sCurrent = useScoreStore((s) => s.sCurrent);
  const sBase = useScoreStore((s) => s.sBase);

  const displayScore = sCurrent > 0 ? sCurrent : sBase;
  const tier = getRelationshipTier(displayScore);
  const dDay = computeDDay(relationshipStartDate);

  const statusMessage =
    displayScore >= 70 ? '오늘도 잘 하고 있어요' :
    displayScore >= 40 ? '평범한 하루예요' :
    '조금 더 신경 써볼까요';

  const moodTags = displayScore >= 70
    ? ['💚 안정적', '☀️ 평온함', '💬 소통 중']
    : displayScore >= 40
    ? ['🌤️ 보통', '💭 생각 중', '⏳ 여유롭게']
    : ['🌧️ 주의 필요', '💔 회복 중', '🤔 돌아보기'];

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        alwaysBounceVertical={true}
      >
        <View style={styles.header}>
          <Text style={styles.headerName}>{name ?? '트윈'}</Text>
          {dDay !== null && (
            <Text style={styles.headerDday}>연애 {dDay}일째</Text>
          )}
        </View>

        <View style={styles.gaugeSection}>
          <View style={styles.gaugeContainer}>
            <CircularGauge score={displayScore} />
            <View style={styles.gaugeCenter}>
              <MaskedView
                maskElement={
                  <Text style={styles.score}>{formatScore(displayScore)}</Text>
                }
              >
                <LinearGradient
                  colors={[...GRADIENT.BRAND_STOPS]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={[styles.score, { opacity: 0 }]}>
                    {formatScore(displayScore)}
                  </Text>
                </LinearGradient>
              </MaskedView>
              <Text style={styles.tierText}>{tier.emoji} {tier.title}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.statusText}>{statusEmoji(displayScore)} {statusMessage}</Text>

        <View style={styles.tagRow}>
          {moodTags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/chat')}>
            <Ionicons name="chatbubble-ellipses" size={20} color={BRAND.CORAL} />
            <Text style={styles.actionBtnText}>트윈과 대화</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)/history')}>
            <Ionicons name="time" size={20} color={BRAND.MINT} />
            <Text style={styles.actionBtnText}>히스토리 보기</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    gap: 24,
  },
  header: {
    marginTop: 8,
    alignItems: 'center',
    gap: 4,
  },
  headerName: {
    ...TYPOGRAPHY.heading,
    color: SYS.TEXT_LIGHT,
  },
  headerDday: {
    ...TYPOGRAPHY.caption,
    color: '#888',
  },
  gaugeSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  gaugeContainer: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gaugeCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    ...TYPOGRAPHY.display,
    fontVariant: ['tabular-nums'],
  },
  tierText: {
    ...TYPOGRAPHY.label,
    color: SYS.TEXT_LIGHT,
    marginTop: 8,
  },
  statusText: {
    ...TYPOGRAPHY.caption,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  tag: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagText: {
    ...TYPOGRAPHY.caption,
    color: SYS.TEXT_LIGHT,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D3F55',
  },
  actionBtnText: {
    ...TYPOGRAPHY.label,
    color: SYS.TEXT_LIGHT,
    marginTop: 6,
  },
});
