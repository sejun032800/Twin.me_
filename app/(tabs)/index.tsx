// ─── FUN-HOM-001~003 — 메인 탭 연애 대시보드 (MASTER.md §3, §5.1) ────────────────
// S_Current(자정 정산 공식 일치율, §5.1)를 화면 중앙에 표시. 아직 자정 정산 이벤트가
// 한 번도 없어 S_Current=0인 첫 실행 구간에서는 S_Base(MBTI 기준 점수)로 대체 노출한다.
// 티어는 scoreCalculator.getTierFromScore()(§5.8, FUN-HOM-003 10단계 매퍼)로 산출.
// 정보 밀도보다 여백과 감성을 우선하는 미니멀 레이아웃 — 카드 박스는 최소화한다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
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
import { useScoreStore, type EventHistoryEntry } from '@/store/scoreStore';
import { useSessionStore } from '@/store/sessionStore';
import { useTheme } from '@/hooks/useTheme';
import { useWeather } from '@/hooks/useWeather';
import { getTierFromScore, formatScore } from '@/engine/scoreCalculator';
import { shouldShowMasterQuestion, markShownToday, type MasterQuestion } from '@/services/masterQuestionService';
import { GRADIENT } from '@/constants/colors';
import type { SigmaTheme, ThemeMode } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

function buildScoreStory(eventLog: EventHistoryEntry[], sLive: number, sCurrent: number): string {
  if (!eventLog || eventLog.length === 0) {
    return '트윈과 대화할수록 정확해져요';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEvents = eventLog.filter((e) => e.t >= today.getTime());

  const delta = sLive - sCurrent;
  const absDelta = Math.abs(delta).toFixed(1);

  if (todayEvents.length === 0) {
    if (delta > 0.5) return `어제보다 ${absDelta}점 올랐어요 ↑`;
    if (delta < -0.5) return `어제보다 ${absDelta}점 내려갔어요 ↓`;
    return '오늘도 꾸준히 유지 중이에요';
  }

  const posCount = todayEvents.filter((e) => e.delta > 0).length;

  const hasApology = todayEvents.some((e) => e.code === 'G-CON-002' || e.code === 'G-CON-008');
  if (hasApology && delta > 0) {
    return `화해 덕분에 ${absDelta}점 회복했어요 💚`;
  }

  const hasTikitaka = todayEvents.some((e) => e.code === 'G-HUM-007');
  if (hasTikitaka) {
    return '오늘 티키타카가 좋았어요 ✨';
  }

  const hasCrisis = todayEvents.some((e) => e.code.startsWith('L-CRU') || e.code.startsWith('L-HRS'));
  if (hasCrisis && delta < 0) {
    return `오늘 ${absDelta}점 내려갔어요. 대화가 필요할 것 같아요`;
  }

  if (delta > 0.5) return `오늘 ${absDelta}점 올랐어요 ↑`;
  if (delta < -0.5) return `오늘 ${absDelta}점 내려갔어요 ↓`;
  if (posCount >= 3) return `오늘 좋은 대화가 ${posCount}번 있었어요 💚`;

  return '오늘도 꾸준히 함께하고 있어요';
}

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
  const router = useRouter();
  const theme = useTheme();
  const name = useUserStore((s) => s.name);
  const personaMatrix = useUserStore((s) => s.personaMatrix);
  const relationshipStartDate = useCoupleStore((s) => s.relationshipStartDate);
  const isPartnerConnected = useCoupleStore((s) => s.isPartnerConnected);
  const sLive = useScoreStore((s) => s.sLive);
  const sCurrent = useScoreStore((s) => s.sCurrent);
  const sBase = useScoreStore((s) => s.sBase);
  const eventLog = useScoreStore((s) => s.eventLog);
  const { weather, loading: weatherLoading } = useWeather();
  const setAuraScreenKey = useSessionStore((s) => s.setAuraScreenKey);
  const themeMode = useSessionStore((s) => s.themeMode);
  const setActiveChatRoom = useSessionStore((s) => s.setActiveChatRoom);
  const styles = useMemo(() => makeStyles(theme, themeMode), [theme, themeMode]);

  useFocusEffect(useCallback(() => {
    setAuraScreenKey('main');
  }, [setAuraScreenKey]));

  const displayScore = sLive > 0 ? sLive : (sCurrent > 0 ? sCurrent : sBase);
  const tier = getTierFromScore(displayScore);
  const dDay = computeDDay(relationshipStartDate);
  const scoreStory = buildScoreStory(eventLog, sLive, sCurrent);

  const viewShotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  const [masterQuestion, setMasterQuestion] = useState<MasterQuestion | null>(null);
  const [mqVisible, setMqVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const mq = await shouldShowMasterQuestion(displayScore);
      if (mq) setMasterQuestion(mq);
    })();
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

  const dDayText = dDay !== null ? `연애 ${dDay}일째` : null;
  const weatherText = !weatherLoading && weather && weather.temperature > -999
    ? `${weather.emoji} ${weather.temperature}°`
    : null;
  const headerSubText = [dDayText, weatherText].filter(Boolean).join(' · ');

  const moodTags = displayScore >= 70
    ? ['💚 안정적', '☀️ 평온함', '💬 소통 중']
    : displayScore >= 40
    ? ['🌤️ 보통', '💭 생각 중', '⏳ 여유롭게']
    : ['🌧️ 주의 필요', '💔 회복 중', '🤔 돌아보기'];

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        alwaysBounceVertical={true}
      >
        {/* ── ABOVE FOLD ── */}
        {/* 1. 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerName}>{name ?? '안녕하세요'}</Text>
            {headerSubText.length > 0 && (
              <Text style={styles.headerDday}>{headerSubText}</Text>
            )}
          </View>
        </View>

        {/* 미연동 유저 → Above Fold 상단에 초대 배너 */}
        {!isPartnerConnected && (
          <TouchableOpacity
            style={styles.inviteBanner}
            onPress={() => router.push('/(tabs)/settings')}
            activeOpacity={0.8}
          >
            <Text style={styles.inviteBannerEmoji}>💌</Text>
            <View style={styles.inviteBannerText}>
              <Text style={styles.inviteBannerTitle}>연인을 초대해보세요</Text>
              <Text style={styles.inviteBannerDesc}>
                함께 쓰면 일치율이 더 정확해져요
              </Text>
            </View>
            <Text style={styles.inviteBannerArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* 2. 아바타 + 아우라 glow */}
        <View style={styles.heroSection}>
          <View style={styles.avatarGlow} />
          <ClayTwinAvatar
            size={120}
            auraVector={personaMatrix?.auraVector ?? null}
            clayStage={personaMatrix?.clayStage ?? 3}
          />
        </View>

        {/* 3. 점수 게이지 */}
        <View style={styles.scoreSection}>
          <View style={styles.gaugeContainer}>
            <CircularGauge
              score={displayScore}
              size={220}
              trackColor={theme.border}
            />
            <View style={styles.gaugeCenter}>
              {themeMode === 'light' ? (
                <Text style={[styles.score, { color: '#E07A82' }]}>
                  {formatScore(displayScore)}
                </Text>
              ) : (
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
              )}
              <Text style={styles.tierText}>{tier.emoji} {tier.title}</Text>
            </View>
          </View>
          <Text style={styles.scoreStory}>{scoreStory}</Text>
        </View>

        {/* 4. 무드 태그 */}
        <View style={styles.moodRow}>
          {moodTags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        {/* ── 구분 힌트 ── */}
        <View style={styles.scrollHint}>
          <Text style={styles.scrollHintText}>아래로 스크롤해보세요</Text>
          <Text style={styles.scrollHintIcon}>↓</Text>
        </View>

        {/* ── BELOW FOLD ── */}
        {/* 5. AI 코칭 카드 */}
        <View style={styles.coachingWrapper}>
          <AICoachingCard />
        </View>

        {/* 6. 추억 링 */}
        <MemoryRingSection />

        {/* 7. 액션 버튼 2개 */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/(tabs)/history')}
          >
            <Ionicons name="time-outline" size={22} color={theme.text} />
            <Text style={styles.actionBtnText}>히스토리</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleShare}
            disabled={sharing}
          >
            {sharing ? (
              <ActivityIndicator size="small" color={theme.text} />
            ) : (
              <Ionicons name="share-outline" size={22} color={theme.text} />
            )}
            <Text style={styles.actionBtnText}>공유하기</Text>
          </TouchableOpacity>
        </View>

        {/* 8. 연동 완료 유저 → Below Fold에 PartnerStatusBar */}
        {isPartnerConnected && <PartnerStatusBar />}

        {/* 9. OverflowBanner (조건부) */}
        <OverflowBanner />
      </ScrollView>

      {/* 하단 고정 CTA — ScrollView 밖 */}
      <View style={styles.bottomCTA}>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => {
            setActiveChatRoom('twin');
            router.push('/(tabs)/chat');
          }}
        >
          <Text style={styles.ctaBtnText}>트윈과 대화하기 →</Text>
        </TouchableOpacity>
      </View>

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
        onSendToChat={(q) => {
          useSessionStore.getState().setPendingChatMessage(q);
          router.push('/(tabs)/chat');
          setMqVisible(false);
          markShownToday();
        }}
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: SigmaTheme, themeMode: ThemeMode) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.bg },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 0,
      paddingBottom: 24,
      gap: 0,
    },
    header: {
      marginTop: 8,
      marginBottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    headerTextGroup: {
      alignItems: 'center',
      gap: 4,
    },
    headerName: {
      ...TYPOGRAPHY.heading,
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    headerDday: {
      ...TYPOGRAPHY.caption,
      fontSize: 12,
      color: theme.textMuted,
    },
    inviteBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 189, 189, 0.10)',
      borderRadius: 14,
      padding: 14,
      gap: 12,
      marginBottom: 8,
      borderWidth: 0.5,
      borderColor: 'rgba(255, 189, 189, 0.20)',
    },
    inviteBannerEmoji: {
      fontSize: 24,
      flexShrink: 0,
    },
    inviteBannerText: {
      flex: 1,
    },
    inviteBannerTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    inviteBannerDesc: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: 2,
    },
    inviteBannerArrow: {
      fontSize: 18,
      color: theme.textMuted,
      flexShrink: 0,
    },
    // 히어로 섹션 — 아바타 + 글로우
    heroSection: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      marginBottom: 16,
      position: 'relative',
      height: 148,
    },
    avatarGlow: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: 'rgba(255, 164, 164, 0.10)',
      top: '50%',
      marginTop: -90,
      alignSelf: 'center',
    },
    // 점수 섹션
    scoreSection: {
      alignItems: 'center',
      gap: 6,
      marginBottom: 16,
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
      fontSize: 48,
      fontVariant: ['tabular-nums'],
    },
    tierText: {
      ...TYPOGRAPHY.label,
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      marginTop: 6,
    },
    scoreStory: {
      fontSize: 12,
      color: theme.textMuted,
      textAlign: 'center',
      marginTop: 4,
      lineHeight: 18,
    },
    // 무드 태그 행
    moodRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 24,
    },
    tag: {
      // Mint tint는 라이트/다크 모두 잘 보이므로 유지하되, 다크에서는 살짝 더 불투명하게
      backgroundColor: themeMode === 'dark'
        ? 'rgba(186, 223, 219, 0.15)'
        : 'rgba(186, 223, 219, 0.20)',
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderWidth: 0,
    },
    tagText: {
      ...TYPOGRAPHY.caption,
      color: '#3A8C85',
      fontSize: 12,
    },
    // 스크롤 힌트
    scrollHint: {
      alignItems: 'center',
      paddingVertical: 20,
      gap: 4,
      borderTopWidth: 0.5,
      borderTopColor: theme.border,
      marginBottom: 24,
    },
    scrollHintText: {
      fontSize: 11,
      color: theme.textMuted,
      letterSpacing: 0.5,
    },
    scrollHintIcon: {
      fontSize: 12,
      color: theme.textMuted,
    },
    coachingWrapper: {
      // Coral tint 배경은 라이트/다크 모두 잘 동작하므로 유지, 테두리만 테마 토큰으로
      backgroundColor: 'rgba(255, 164, 164, 0.07)',
      borderRadius: 16,
      borderWidth: 0.5,
      borderColor: theme.border,
      overflow: 'hidden',
      marginBottom: 20,
    },
    // 액션 버튼 2개 (히스토리/공유)
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
      marginHorizontal: 0,
      marginBottom: 20,
    },
    actionBtn: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      gap: 6,
      borderWidth: 0.5,
      borderColor: theme.border,
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
    },
    // 하단 고정 CTA
    bottomCTA: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
      backgroundColor: theme.bg,
      borderTopWidth: 0.5,
      borderTopColor: theme.border,
    },
    ctaBtn: {
      backgroundColor: '#FFA4A4',
      borderRadius: 14,
      paddingVertical: 18,
      alignItems: 'center',
    },
    ctaBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    shareCardOffscreen: {
      position: 'absolute',
      top: -9999,
      left: 0,
    },
  });
}
