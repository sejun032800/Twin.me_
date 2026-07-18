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
import SigmaMainLayout from '@/components/SigmaMainLayout';
import { useUserStore } from '@/store/userStore';
import { useCoupleStore } from '@/store/coupleStore';
import { useScoreStore, type EventHistoryEntry } from '@/store/scoreStore';
import { useSessionStore } from '@/store/sessionStore';
import { useTheme } from '@/hooks/useTheme';
import { useWeather } from '@/hooks/useWeather';
import { useFeatureDnaV21 } from '@/config/featureFlags';
import DnaCompatibilityCard from '@/components/DnaCompatibilityCard';
import {
  getTierFromScore,
  getTierFromScoreV21,
  formatScore,
  MOOD_TAG_HIGH_THRESHOLD_V21,
  MOOD_TAG_MID_THRESHOLD_V21,
} from '@/engine/scoreCalculator';
import { shouldShowMasterQuestion, markShownToday, type MasterQuestion } from '@/services/masterQuestionService';
import { GRADIENT, SYS } from '@/constants/colors';
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
  const reduceAuraMotion = useSessionStore((s) => s.reduceAuraMotion);

  // 이 화면의 화면키('main')는 setAuraScreenKey로 세션에 기록된다(STEP 11 이전부터의
  // 기존 코드 그대로 유지). sigma 전용 오라 opacity는 더 이상 이 화면키 문자열을 직접
  // 소비하지 않고, SigmaMainLayout 내부에서 useSigmaAuraOpacity('mainHero')로 조회한다.
  // auraVector는 personaMatrix를 store에서 다시 조회하지 않고 useTheme()이 반환하는
  // 값 하나만 거친다(theme.ts의 buildSigmaTheme가 채워 넣는 동일 원본) — 단, 여기서는
  // themeMode==='sigma'일 때만 non-null이라(else엔 theme.auraVector가 null), 아래
  // hasAuraVector/effectiveThemeMode 폴백 계산에 그대로 써도 기존 personaMatrix 기반
  // 계산과 동일하게 동작한다(둘 다 "sigma && auraVector 확정" 여부만 판단하면 되므로).
  const auraVector = theme.auraVector;
  const hasAuraVector = auraVector !== null;

  // 방어적 폴백 — 설정 화면은 hasAuraVector가 false일 때 '✨ 6 Sigma' 버튼을 disabled 처리해
  // themeMode==='sigma' 진입 자체를 막지만(정상 흐름), 세션 복원/레이스 컨디션 등으로
  // themeMode==='sigma'인데 personaMatrix.auraVector가 아직 null인 상태가 잠깐 존재할 수
  // 있다. 이 엣지케이스는 dark 모드로 취급해 안전하게 폴백한다(useTheme.ts와 달리 여기서는
  // light가 아니라 dark로 폴백 — 오라 배경 레이어 자체가 dark 계열 전제이기 때문).
  const effectiveThemeMode: ThemeMode = themeMode === 'sigma' && !hasAuraVector ? 'dark' : themeMode;

  // 메인 탭 베이스 배경 — 3-way(ThemeMode='sigma'|'light'|'dark') 명시 분기.
  // sigma가 dark와 같은 값(SYS.BG_DARK_MIDNIGHT)을 쓰는 것은 "sigma가 우연히 dark로
  // 합쳐진 버그"가 아니라 "sigma도 의도적으로 BG_DARK_MIDNIGHT를 베이스로 쓴다"는
  // 선택이다 — sigma 테마의 오라 색조 tint(theme.bg)에 기대지 않고 항상 이 고정값을
  // 깔아야, 그 위에 얹는 저-opacity AuraDuskGradient가 유저마다 다른 베이스 명도/색조
  // 위에서 흔들리지 않고 항상 같은 대비로 보인다. light 모드는 유저가 명시적으로 고른
  // 라이트 팔레트이므로 그대로 존중한다.
  const mainBaseBg =
    effectiveThemeMode === 'light' ? theme.bg :
    effectiveThemeMode === 'sigma' ? SYS.BG_DARK_MIDNIGHT :
    SYS.BG_DARK_MIDNIGHT; // dark

  const styles = useMemo(() => makeStyles(theme, themeMode, mainBaseBg), [theme, themeMode, mainBaseBg]);

  // STEP 11-1의 AURA_OPACITY_TIERS 어휘와 일치시킴('main' → 'mainHero').
  useFocusEffect(useCallback(() => {
    setAuraScreenKey('mainHero');
  }, [setAuraScreenKey]));

  useEffect(() => {
    console.log('[Home] sigma 레이아웃 분기 상태', {
      themeMode,
      effectiveThemeMode,
      hasAuraVector,
      mainBaseBg,
      reduceAuraMotion,
    });
  }, [themeMode, effectiveThemeMode, hasAuraVector, mainBaseBg, reduceAuraMotion]);

  const dnaV21 = useFeatureDnaV21();
  const displayScore = sLive > 0 ? sLive : (sCurrent > 0 ? sCurrent : sBase);
  const tier = dnaV21 ? getTierFromScoreV21(displayScore) : getTierFromScore(displayScore);
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

  const moodTagHighThreshold = dnaV21 ? MOOD_TAG_HIGH_THRESHOLD_V21 : 70;
  const moodTagMidThreshold = dnaV21 ? MOOD_TAG_MID_THRESHOLD_V21 : 40;
  const moodTags = displayScore >= moodTagHighThreshold
    ? ['💚 안정적', '☀️ 평온함', '💬 소통 중']
    : displayScore >= moodTagMidThreshold
    ? ['🌤️ 보통', '💭 생각 중', '⏳ 여유롭게']
    : ['🌧️ 주의 필요', '💔 회복 중', '🤔 돌아보기'];

  // ShareCard 캡처용 오프스크린 뷰 + 마스터 질문 모달 — light/dark·sigma 두 경로 모두 동일하게
  // 필요해서 분기 밖에 한 번만 둔다. shareCardOffscreen은 top:-9999로 항상 화면 밖이고
  // MasterQuestionModal은 RN 네이티브 Modal(포털)이라 트리 상 위치가 렌더 픽셀에 영향을
  // 주지 않는다 — 두 분기에 중복 작성할 필요 없이 여기 한 곳으로 충분하다.
  const sharedOverlays = (
    <>
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
    </>
  );

  // sigma 전용 레이아웃 — light/dark 렌더링 경로(아래)와 완전히 분리된 별도 컴포넌트로
  // 위임한다. auraVector 널 체크는 TS 타입 좁히기 + effectiveThemeMode 계산이 깨지는
  // 경우에 대비한 이중 방어(effectiveThemeMode==='sigma'는 정의상 이미 auraVector!==null을
  // 함의하지만, SigmaMainLayout의 auraVector prop이 non-null이라 TS가 이 좁히기를 요구한다).
  if (effectiveThemeMode === 'sigma' && auraVector) {
    return (
      <>
        <SigmaMainLayout
          name={name}
          personaMatrix={personaMatrix}
          auraVector={auraVector}
          reduceAuraMotion={reduceAuraMotion}
          displayScore={displayScore}
          tier={tier}
          scoreStory={scoreStory}
          moodTags={moodTags}
          headerSubText={headerSubText}
          isPartnerConnected={isPartnerConnected}
          dnaV21={dnaV21}
          sharing={sharing}
          onShare={handleShare}
          onHistoryPress={() => router.push('/(tabs)/history')}
          onInvitePress={() => router.push('/(tabs)/settings')}
          onChatPress={() => {
            setActiveChatRoom('twin');
            router.push('/(tabs)/chat');
          }}
        />
        {sharedOverlays}
      </>
    );
  }

  // ── light/dark 렌더링 경로 — STEP 11 이전과 완전히 동일(1px도 변경 없음) ──────────
  return (
    <>
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

        {/* 8b. FEATURE_DNA_V21 ON + 연동 완료 유저 → 연애 DNA 일치율 카드(Phase 5.5) */}
        {dnaV21 && isPartnerConnected && <DnaCompatibilityCard />}

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
      </SafeAreaView>
      {sharedOverlays}
    </>
  );
}

function makeStyles(theme: SigmaTheme, themeMode: ThemeMode, mainBaseBg: string) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: mainBaseBg },
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
      backgroundColor: mainBaseBg,
      borderTopWidth: 0.5,
      borderTopColor: theme.border,
    },
    ctaBtn: {
      backgroundColor: '#FFA4A4',
      borderRadius: 14,
      paddingVertical: 18,
      alignItems: 'center',
    },
    // CORAL(#FFA4A4) 배경 위 흰색 텍스트는 명도 대비 ~1.9:1로 WCAG AA(4.5:1)에
    // 크게 못 미친다 — TEXT_DARK(#1A1A1A)로 바꾸면 ~9.2:1로 다크모드 기준까지 충족.
    ctaBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: SYS.TEXT_DARK,
    },
    shareCardOffscreen: {
      position: 'absolute',
      top: -9999,
      left: 0,
    },
  });
}
