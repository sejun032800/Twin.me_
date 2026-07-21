// ─── SigmaMainLayout — 메인 탭의 themeMode==='sigma' 전용 레이아웃 (STEP 11-4) ────
// app/(tabs)/index.tsx의 light/dark 렌더링 경로와 완전히 분리된 별도 컴포넌트.
// 기존 index.tsx의 makeStyles/styles.* 를 억지로 재사용하지 않고, GlassPanel/
// GlassButton(STEP 11-3) + AuraDuskGradient(mainHero 티어, STEP 11-1)로 새로 구성한다.
// 데이터/비즈니스 로직(점수 계산, 공유, 마스터 질문 등)은 전부 index.tsx의 Home()이
// 소유한 채 이미 계산된 값만 props로 받는다 — 이 컴포넌트는 순수하게 sigma 전용
// 프레젠테이션만 담당한다(단일 진실 공급원 유지, 로직 중복/드리프트 방지).

import { Pressable, View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AuraDuskGradient from '@/components/AuraDuskGradient';
import ShootingStarField from '@/components/ShootingStarField';
import ClayTwinAvatar from '@/components/ClayTwinAvatar';
import CircularGauge from '@/components/CircularGauge';
import AICoachingCard from '@/components/AICoachingCard';
import MemoryRingSection from '@/components/MemoryRingSection';
import PartnerStatusBar from '@/components/PartnerStatusBar';
import DnaCompatibilityCard from '@/components/DnaCompatibilityCard';
import OverflowBanner from '@/components/OverflowBanner';
import GlassPanel from '@/components/glass/GlassPanel';
import GlassButton from '@/components/glass/GlassButton';
import { useSigmaAuraOpacity } from '@/hooks/useTheme';
import { SIGMA_ACCENT, SYS } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/typography';
import { formatScore } from '@/engine/scoreCalculator';
import type { RelationshipTier } from '@/engine/scoreCalculator';
import type { AuraVector, UserPersonaMatrix } from '@/types/genesis';

// 히어로 영역(오라가 화면을 시각적으로 지배하는 상단 큰 영역) 높이 비율 — 요구 범위 60~70%의 중앙값.
const HERO_HEIGHT_RATIO = 0.65;

// 배경 밝기가 계속 바뀌는 애니메이션 아우라 위에 얹는 텍스트는 GlassButton/GlassRing과 동일하게
// 흰색 고정 + textShadow 조합으로 가독성을 확보한다(고정 테마색이 아니라 이 조합만 안전함).
const heroTextShadow = {
  textShadowColor: 'rgba(0,0,0,0.45)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

interface SigmaMainLayoutProps {
  name: string | null;
  personaMatrix: UserPersonaMatrix | null;
  auraVector: AuraVector;
  reduceAuraMotion: boolean;
  displayScore: number;
  tier: RelationshipTier;
  scoreStory: string;
  moodTags: string[];
  headerSubText: string;
  isPartnerConnected: boolean;
  dnaV21: boolean;
  sharing: boolean;
  onShare: () => void;
  onHistoryPress: () => void;
  onInvitePress: () => void;
  onChatPress: () => void;
}

export default function SigmaMainLayout({
  name,
  personaMatrix,
  auraVector,
  reduceAuraMotion,
  displayScore,
  tier,
  scoreStory,
  moodTags,
  headerSubText,
  isPartnerConnected,
  dnaV21,
  sharing,
  onShare,
  onHistoryPress,
  onInvitePress,
  onChatPress,
}: SigmaMainLayoutProps) {
  // STEP 11-1에서 준비해둔 조회 훅 — 'mainHero' 티어(0.5)를 그대로 최종 opacity로 쓴다
  // (더 이상 contextMultiplier 곱셈을 거치지 않음). 이 컴포넌트는 sigma일 때만 마운트되므로
  // 훅 내부의 "themeMode!=='sigma'면 0" 분기는 여기선 항상 통과하지만, 단일 진실 공급원을
  // 그대로 재사용하는 편이 "여기서만 다른 계산식을 쓰는" 드리프트보다 안전하다.
  const heroOpacity = useSigmaAuraOpacity('mainHero');

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* 1. 히어로 — 오라가 화면의 ~65%를 지배. AuraDuskGradient는 부모 높이에 absoluteFill되므로
          이 View에 명시적 height를 주는 것만으로 "상단 큰 영역"에 가둘 수 있다. */}
      <View style={styles.heroRegion}>
        <AuraDuskGradient
          auraVector={auraVector}
          opacity={typeof heroOpacity === 'number' ? heroOpacity : 0}
          reduceMotion={reduceAuraMotion}
        />
        {/* FUN-HOM-004 — 별똥별. AuraDuskGradient와 같은 레이어(그 위), 메인 탭 히어로에서만.
            SigmaMainLayout 자체가 이미 themeMode==='sigma' 전용이라 별도 분기가 필요 없다. */}
        <ShootingStarField />
        <View style={styles.heroContent}>
          <View style={styles.headerTextGroup}>
            <Text style={[styles.headerName, heroTextShadow]}>{name ?? '안녕하세요'}</Text>
            {headerSubText.length > 0 && (
              <Text style={[styles.headerSub, heroTextShadow]}>{headerSubText}</Text>
            )}
          </View>

          {!isPartnerConnected && (
            <Pressable onPress={onInvitePress}>
              <GlassPanel style={styles.inviteBanner} intensity={25}>
                <Text style={styles.inviteBannerEmoji}>💌</Text>
                <View style={styles.inviteBannerText}>
                  <Text style={[styles.inviteBannerTitle, heroTextShadow]}>연인을 초대해보세요</Text>
                  <Text style={styles.inviteBannerDesc}>함께 쓰면 일치율이 더 정확해져요</Text>
                </View>
                <Text style={styles.inviteBannerArrow}>›</Text>
              </GlassPanel>
            </Pressable>
          )}

          <View style={styles.avatarWrap}>
            <ClayTwinAvatar
              size={112}
              auraVector={personaMatrix?.auraVector ?? null}
              clayStage={personaMatrix?.clayStage ?? 3}
            />
          </View>

          <View style={styles.gaugeContainer}>
            <CircularGauge score={displayScore} size={188} strokeWidth={10} trackColor="rgba(255,255,255,0.22)" />
            <View style={styles.gaugeCenter}>
              <Text style={[styles.score, heroTextShadow]}>{formatScore(displayScore)}</Text>
              <Text style={[styles.tierText, heroTextShadow]}>{tier.emoji} {tier.title}</Text>
            </View>
          </View>
          <Text style={[styles.scoreStory, heroTextShadow]}>{scoreStory}</Text>

          <View style={styles.moodRow}>
            {moodTags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* 2. 히어로 아래 콘텐츠 — 기존 index.tsx가 보여주던 정보(오늘의 트윈 상태=AI 코칭,
          최근 대화 미리보기=추억 링 등)를 GlassPanel로 감싼다. 각 하위 컴포넌트 자체는
          light/dark와 동일한 파일을 그대로 재사용한다(내부는 useTheme()이 sigma 팔레트를
          알아서 적용). */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <GlassPanel style={styles.cardWrapper}>
          <AICoachingCard />
        </GlassPanel>

        <GlassPanel style={styles.cardWrapper}>
          <MemoryRingSection />
        </GlassPanel>

        <View style={styles.actionsRow}>
          <GlassButton style={styles.actionBtn} onPress={onHistoryPress}>
            <View style={styles.actionBtnInner}>
              <Ionicons name="time-outline" size={20} color="#FFFFFF" />
              <Text style={[styles.actionBtnText, heroTextShadow]}>히스토리</Text>
            </View>
          </GlassButton>
          <GlassButton style={styles.actionBtn} onPress={onShare} disabled={sharing}>
            <View style={styles.actionBtnInner}>
              {sharing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="share-outline" size={20} color="#FFFFFF" />
              )}
              <Text style={[styles.actionBtnText, heroTextShadow]}>공유하기</Text>
            </View>
          </GlassButton>
        </View>

        {isPartnerConnected && (
          <GlassPanel style={styles.cardWrapper}>
            <PartnerStatusBar />
          </GlassPanel>
        )}

        {/* DnaCompatibilityCard는 STEP 11-4에서 자체적으로 sigma 분기(GlassRing 배경)를
            갖도록 수정했으므로 여기서 추가로 GlassPanel로 감싸지 않는다(이중 래핑 방지). */}
        {dnaV21 && isPartnerConnected && <DnaCompatibilityCard />}

        <OverflowBanner />
      </ScrollView>

      {/* 3. 하단 고정 CTA — GlassButton으로 교체 */}
      <View style={styles.bottomCTA}>
        <GlassButton onPress={onChatPress}>
          <Text style={[styles.ctaBtnText, heroTextShadow]}>트윈과 대화하기 →</Text>
        </GlassButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SYS.BG_DARK_MIDNIGHT,
  },
  heroRegion: {
    height: `${HERO_HEIGHT_RATIO * 100}%`,
    position: 'relative',
    overflow: 'hidden',
  },
  heroContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 10,
  },
  headerTextGroup: {
    alignItems: 'center',
    gap: 4,
  },
  headerName: {
    ...TYPOGRAPHY.heading,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSub: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    alignSelf: 'stretch',
  },
  inviteBannerEmoji: {
    fontSize: 22,
    flexShrink: 0,
  },
  inviteBannerText: {
    flex: 1,
  },
  inviteBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inviteBannerDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  inviteBannerArrow: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.75)',
    flexShrink: 0,
  },
  avatarWrap: {
    marginTop: 4,
  },
  gaugeContainer: {
    width: 188,
    height: 188,
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
    fontSize: 42,
    color: '#F8F9FA',
    fontVariant: ['tabular-nums'],
  },
  tierText: {
    ...TYPOGRAPHY.label,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
  },
  scoreStory: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: `${SIGMA_ACCENT.DEFAULT}66`, // 40% 알파
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  tagText: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    fontSize: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  cardWrapper: {
    padding: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
  },
  actionBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomCTA: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: SYS.BG_DARK_MIDNIGHT,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
