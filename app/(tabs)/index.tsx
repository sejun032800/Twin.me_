// ─── FUN-HOM-001~003 — 메인 탭 연애 대시보드 (MASTER.md §3, §5.1) ────────────────
// S_Current(자정 정산 공식 일치율, §5.1)를 화면 중앙에 표시. 아직 자정 정산 이벤트가
// 한 번도 없어 S_Current=0인 첫 실행 구간에서는 S_Base(MBTI 기준 점수)로 대체 노출한다.
// 티어는 scoreCalculator.getTierFromScore()(§5.8, FUN-HOM-003 10단계 매퍼)로 산출.
// 정보 밀도보다 여백과 감성을 우선하는 미니멀 레이아웃 — 카드 박스는 최소화한다.

import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import CircularGauge from '@/components/CircularGauge';
import PartnerStatusBar from '@/components/PartnerStatusBar';
import OverflowBanner from '@/components/OverflowBanner';
import AICoachingCard from '@/components/AICoachingCard';
import ClayTwinAvatar from '@/components/ClayTwinAvatar';
import MemoryRingSection from '@/components/MemoryRingSection';
import MasterQuestionModal from '@/components/MasterQuestionModal';
import ShareCard from '@/components/ShareCard';
import { useUserStore } from '@/store/userStore';
import { useCoupleStore } from '@/store/coupleStore';
import { useScoreStore } from '@/store/scoreStore';
import { useTheme } from '@/hooks/useTheme';
import { getTierFromScore, formatScore } from '@/engine/scoreCalculator';
import { shouldShowMasterQuestion, markShownToday, type MasterQuestion } from '@/services/masterQuestionService';
import { BRAND, SYS, GRADIENT } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
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
  const theme = useTheme();
  const styles = makeStyles(theme);
  const name = useUserStore((s) => s.name);
  const personaMatrix = useUserStore((s) => s.personaMatrix);
  const relationshipStartDate = useCoupleStore((s) => s.relationshipStartDate);
  const sLive = useScoreStore((s) => s.sLive);
  const sCurrent = useScoreStore((s) => s.sCurrent);
  const sBase = useScoreStore((s) => s.sBase);

  const displayScore = sLive > 0 ? sLive : (sCurrent > 0 ? sCurrent : sBase);
  const tier = getTierFromScore(displayScore);
  const dDay = computeDDay(relationshipStartDate);

  const viewShotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  const [masterQuestion, setMasterQuestion] = useState<MasterQuestion | null>(null);
  const [mqVisible, setMqVisible] = useState(false);

  useEffect(() => {
    const mq = shouldShowMasterQuestion(displayScore);
    if (mq) setMasterQuestion(mq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayScore]);

  useEffect(() => {
    if (masterQuestion) {
      const t = setTimeout(() => setMqVisible(true), 3000);
      return () => clearTimeout(t);
    }
  }, [masterQuestion]);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) throw new Error('캡처에 실패했어요');

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('오류', '이 기기에서는 공유 기능을 사용할 수 없어요.');
        return;
      }
      await Sharing.shareAsync(uri);
    } catch {
      Alert.alert('오류', '공유 카드를 만들지 못했어요. 다시 시도해주세요.');
    } finally {
      setSharing(false);
    }
  }

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

        <PartnerStatusBar />

        <OverflowBanner />

        <View style={{ alignItems: 'center', marginVertical: 8 }}>
          <ClayTwinAvatar
            size={80}
            auraVector={personaMatrix?.auraVector ?? null}
            clayStage={3}
          />
        </View>

        <AICoachingCard />

        <View style={styles.gaugeSection}>
          <View style={styles.gaugeContainer}>
            <CircularGauge
              score={displayScore}
              size={220}
              trackColor={theme.border}
            />
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

        <MemoryRingSection />

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
          {sharing ? (
            <ActivityIndicator color={SYS.TEXT_LIGHT} />
          ) : (
            <>
              <Ionicons name="share-outline" size={20} color={SYS.TEXT_LIGHT} />
              <Text style={styles.shareBtnText}>공유하기</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.shareCardOffscreen} pointerEvents="none">
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
          <ShareCard score={displayScore} />
        </ViewShot>
      </View>

      <MasterQuestionModal
        visible={mqVisible}
        question={masterQuestion}
        onClose={() => {
          setMqVisible(false);
          markShownToday();
        }}
        onSendToChat={() => {
          router.push('/(tabs)/chat');
          // TODO: 채팅 탭에 질문 전달 (sessionStore 활용)
        }}
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.bg },
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
      color: theme.text,
    },
    headerDday: {
      ...TYPOGRAPHY.caption,
      color: theme.textMuted,
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
      color: theme.text,
      marginTop: 8,
    },
    statusText: {
      ...TYPOGRAPHY.caption,
      color: theme.textMuted,
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
      backgroundColor: theme.card,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    tagText: {
      ...TYPOGRAPHY.caption,
      color: theme.text,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 16,
    },
    actionBtn: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionBtnText: {
      ...TYPOGRAPHY.label,
      color: theme.text,
      marginTop: 6,
    },
    shareBtn: {
      flexDirection: 'row',
      backgroundColor: BRAND.CORAL,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    shareBtnText: {
      ...TYPOGRAPHY.button,
      color: SYS.TEXT_LIGHT,
    },
    shareCardOffscreen: {
      position: 'absolute',
      top: -9999,
      left: 0,
    },
  });
}
