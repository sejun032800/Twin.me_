// ─── FUN-HIS — 히스토리 탭 3서브탭 구조 (MASTER.md §7) ────────────────────────
// archive(나선형 Helix 앨범) / map(데이트 지도) / feed(인기 데이트코스) 3탭.
// map은 카카오맵 API 키 입력 전까지 플레이스홀더로 대체한다 — 수정하지 않음.
// archive의 실제 3D 나선 렌더러는 Expo Go 한계로 reanimated 기반 parallax
// (좌우 교차 translateX + 중앙 확대/선명 효과)로 근사한다.

import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { useCoupleStore } from '@/store/coupleStore';
import { useSessionStore } from '@/store/sessionStore';
import { useTheme } from '@/hooks/useTheme';
import { BRAND, SYS } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

type SubTab = 'archive' | 'map' | 'feed';

const SUB_TABS: Array<{ key: SubTab; label: string }> = [
  { key: 'archive', label: '아카이브' },
  { key: 'map', label: '지도' },
  { key: 'feed', label: '피드' },
];

const KAKAO_MAP_API_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_API_KEY ?? '';

// ─── 아카이브(Helix) ──────────────────────────────────────────────────────────
const CARD_WIDTH = 180;
const CARD_HEIGHT = 200;
const ITEM_MARGIN = 20;
const ITEM_HEIGHT = CARD_HEIGHT + ITEM_MARGIN * 2;
const PARALLAX_RANGE = 260; // 이 거리(px) 이상 멀어지면 최소 scale/opacity에 도달

const HELIX_CARDS = [
  { id: '1', emoji: '💌', label: '첫 만남', date: '2025.01.15', tags: ['#설렘', '#시작'] },
  { id: '2', emoji: '🍽️', label: '첫 데이트', date: '2025.01.22', tags: ['#맛집', '#떨림'] },
  { id: '3', emoji: '✈️', label: '첫 여행', date: '2025.03.10', tags: ['#여행', '#추억'] },
  { id: '4', emoji: '🎉', label: '100일', date: '2025.04.25', tags: ['#기념일', '#축하'] },
  { id: '5', emoji: '🌙', label: '야경', date: '2025.05.30', tags: ['#야경', '#로맨틱'] },
  { id: '6', emoji: '☕', label: '카페투어', date: '2025.06.14', tags: ['#카페', '#힐링'] },
];

// TODO: 실제 장소 데이터(kakaoParser 연동) 반영 전까지는 임시 표시값
const MOCK_PLACES_COUNT = 4;

function computeDDay(relationshipStartDate: string | null): number | null {
  if (!relationshipStartDate) return null;
  const start = new Date(`${relationshipStartDate}T00:00:00`);
  if (isNaN(start.getTime())) return null;
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diffDays = Math.floor((todayMidnight.getTime() - startMidnight.getTime()) / 86_400_000);
  return diffDays + 1;
}

interface HelixCardData {
  id: string;
  emoji: string;
  label: string;
  date: string;
  tags: string[];
}

function HelixCard({
  card,
  index,
  scrollY,
  viewportHeight,
}: {
  card: HelixCardData;
  index: number;
  scrollY: SharedValue<number>;
  viewportHeight: SharedValue<number>;
}) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const baseOffset = index % 2 === 0 ? -50 : 50;

  const animatedStyle = useAnimatedStyle(() => {
    const itemCenter = index * ITEM_HEIGHT + ITEM_HEIGHT / 2;
    const viewportCenter = scrollY.value + viewportHeight.value / 2;
    const distance = Math.abs(itemCenter - viewportCenter);

    const scale = interpolate(distance, [0, PARALLAX_RANGE], [1, 0.8], Extrapolation.CLAMP);
    const opacity = interpolate(distance, [0, PARALLAX_RANGE], [1, 0.4], Extrapolation.CLAMP);
    const translateX = interpolate(
      distance,
      [0, PARALLAX_RANGE],
      [baseOffset * 0.3, baseOffset],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateX }, { scale }],
    };
  });

  return (
    <Animated.View style={[styles.helixItem, animatedStyle]}>
      <Text style={styles.helixEmoji}>{card.emoji}</Text>
      <Text style={styles.helixLabel}>{card.label}</Text>
      <Text style={styles.helixDate}>{card.date}</Text>
      <View style={styles.helixTags}>
        {card.tags.map((tag) => (
          <View key={tag} style={styles.helixTag}>
            <Text style={styles.helixTagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function ArchiveTab() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const relationshipStartDate = useCoupleStore((s) => s.relationshipStartDate);
  const dDay = computeDDay(relationshipStartDate);

  const scrollY = useSharedValue(0);
  const viewportHeight = useSharedValue(500);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.helixHeader}>
        <Text style={styles.helixTitle}>✨ 우리만의 시간</Text>
        <Text style={styles.helixSub}>카카오톡이 기억하는 가장 다정한 순간들</Text>
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={styles.helixContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        alwaysBounceVertical={true}
        onLayout={(e) => {
          viewportHeight.value = e.nativeEvent.layout.height;
        }}
      >
        {HELIX_CARDS.map((card, i) => (
          <HelixCard key={card.id} card={card} index={i} scrollY={scrollY} viewportHeight={viewportHeight} />
        ))}
      </Animated.ScrollView>

      <View style={styles.helixStatsBar}>
        <Text style={styles.helixStatItem}>❤️ {dDay !== null ? `D+${dDay}일` : '-'}</Text>
        <Text style={styles.helixStatItem}>📸 {HELIX_CARDS.length}장</Text>
        <Text style={styles.helixStatItem}>📍 {MOCK_PLACES_COUNT}곳</Text>
      </View>
    </View>
  );
}

// ─── 피드 ────────────────────────────────────────────────────────────────────
type FeedFilterKey = 'rating' | 'recent' | 'nearby';

const FEED_FILTERS: Array<{ key: FeedFilterKey; label: string }> = [
  { key: 'rating', label: '⭐ 별점순' },
  { key: 'recent', label: '🕐 최신순' },
  { key: 'nearby', label: '📍 내 지역' },
];

const MOCK_COURSES = [
  {
    id: '1',
    tierEmoji: '🏆',
    tierTitle: '환상 속의 신화적 결합',
    region: '경리단길',
    places: [
      { emoji: '🍷', name: '경리단길 와인바' },
      { emoji: '🗼', name: 'N서울타워' },
      { emoji: '☕', name: '해방촌 루프탑' },
    ],
    tags: ['시크', '로맨틱', '차분함'],
    myRating: 4.9,
    partnerRating: 5.0,
    review: '조용히 우리 얘기만 할 수 있어서 좋았어요.',
  },
  {
    id: '2',
    tierEmoji: '✨',
    tierTitle: '다정다감한 모범 커플',
    region: '홍대',
    places: [
      { emoji: '☕', name: '카페 골목' },
      { emoji: '👗', name: '무신사 스탠다드' },
      { emoji: '🥩', name: '연남동 돼지고기' },
    ],
    tags: ['페미닌', '캐주얼', '힐링'],
    myRating: 4.5,
    partnerRating: 4.7,
    review: '쇼핑하고 맛있는 것까지 먹으니 하루가 꽉 찼어요.',
  },
  {
    id: '3',
    tierEmoji: '💎',
    tierTitle: '눈빛만 봐도 아는 사이',
    region: '성수동',
    places: [
      { emoji: '🎪', name: '성수 팝업' },
      { emoji: '🏭', name: '카페 할아버지공장' },
      { emoji: '🌿', name: '뚝섬 한강' },
    ],
    tags: ['힙한', '감성', '여유'],
    myRating: 4.8,
    partnerRating: 4.6,
    review: '사진 찍을 곳이 많아서 종일 웃으면서 걸었어요.',
  },
];

function FeedTab() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const themeMode = useSessionStore((s) => s.themeMode);
  const [ootdOnly, setOotdOnly] = useState(false);
  const [filter, setFilter] = useState<FeedFilterKey>('rating');

  return (
    <ScrollView
      contentContainerStyle={styles.feedContent}
      showsVerticalScrollIndicator={false}
      bounces={true}
      alwaysBounceVertical={true}
    >
      <Text style={styles.feedTitle}>💑 인기 데이트코스</Text>

      <View style={[styles.ootdBar, { backgroundColor: themeMode === 'light' ? '#F5E8EC' : SYS.CARD_DARK }]}>
        <Text style={styles.ootdText}>✨ 내 현재 OOTD & 무드 코스만 보기</Text>
        <Switch
          value={ootdOnly}
          onValueChange={setOotdOnly}
          trackColor={{ false: '#333', true: BRAND.CORAL }}
          thumbColor={SYS.TEXT_LIGHT}
        />
      </View>

      <View style={styles.filterRow}>
        {FEED_FILTERS.map((f) => {
          const selected = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                { backgroundColor: themeMode === 'light' ? '#F5E8EC' : SYS.CARD_DARK },
                selected && styles.filterChipActive,
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: theme.textMuted },
                  selected && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {MOCK_COURSES.map((course) => (
        <View
          key={course.id}
          style={[styles.courseCard, { backgroundColor: themeMode === 'light' ? '#FFFFFF' : SYS.CARD_DARK }]}
        >
          <View style={styles.courseHeader}>
            <Text style={styles.courseCoupleLabel}>
              익명의 [{course.tierEmoji} {course.tierTitle}] 커플
            </Text>
            <View
              style={[
                styles.courseRegionBadge,
                { backgroundColor: themeMode === 'light' ? '#FFE8E8' : SYS.BG_DARK_MIDNIGHT },
              ]}
            >
              <Text style={[styles.courseRegionText, { color: BRAND.CORAL }]}>📍 {course.region}</Text>
            </View>
          </View>

          <View style={styles.coursePlaces}>
            {course.places.map((place, i) => (
              <View key={place.name} style={styles.coursePlaceRow}>
                <View
                  style={[
                    styles.coursePlaceChip,
                    { backgroundColor: themeMode === 'light' ? '#FFF0F0' : SYS.BG_DARK_MIDNIGHT },
                  ]}
                >
                  <Text style={[styles.coursePlaceText, { color: theme.textMuted }]}>{place.name}{place.emoji}</Text>
                </View>
                {i < course.places.length - 1 && <Text style={styles.courseArrow}>→</Text>}
              </View>
            ))}
          </View>

          <View style={styles.courseTags}>
            {course.tags.map((tag) => (
              <View
                key={tag}
                style={[styles.courseTag, { backgroundColor: themeMode === 'light' ? '#F5E8EC' : SYS.BG_DARK_MIDNIGHT }]}
              >
                <Text style={[styles.courseTagText, { color: theme.textMuted }]}>{tag}</Text>
              </View>
            ))}
          </View>

          <View style={styles.courseRatingRow}>
            <Text style={styles.courseRatingText}>나의 별점 ⭐{course.myRating.toFixed(1)}</Text>
            <View
              style={[
                styles.courseRatingDivider,
                { backgroundColor: themeMode === 'light' ? '#E8D0D5' : '#2D3F55' },
              ]}
            />
            <Text style={styles.courseRatingText}>연인의 별점 ⭐{course.partnerRating.toFixed(1)}</Text>
          </View>

          <Text style={[styles.courseReview, { color: theme.textMuted }]}>"{course.review}"</Text>

          <TouchableOpacity style={[styles.courseMapBtn, styles.courseMapBtnSolid]}>
            <Text style={styles.courseMapBtnText}>🗺️ 이 코스 내 지도에 담기</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

export default function History() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const themeMode = useSessionStore((s) => s.themeMode);
  const [subTab, setSubTab] = useState<SubTab>('archive');

  function renderMap() {
    if (!KAKAO_MAP_API_KEY) {
      return (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderEmoji}>🗺️</Text>
          <Text style={styles.mapPlaceholderTitle}>지도 기능 준비 중</Text>
          <Text style={[styles.mapPlaceholderDesc, { color: theme.textMuted }]}>
            .env 파일에 EXPO_PUBLIC_KAKAO_MAP_API_KEY를{'\n'}
            입력하면 바로 활성화돼요
          </Text>

          <View
            style={[styles.mapPinList, { backgroundColor: themeMode === 'light' ? '#F5E8EC' : SYS.CARD_DARK }]}
          >
            <Text style={styles.mapPinListTitle}>📍 등록된 장소</Text>
            <Text style={[styles.mapPinEmpty, { color: theme.textMuted }]}>아직 기록된 장소가 없어요</Text>
          </View>

          <TouchableOpacity style={[styles.aiRecommendBtn, styles.aiRecommendSolid]}>
            <Ionicons name="sparkles" size={18} color={SYS.TEXT_LIGHT} />
            <Text style={styles.aiRecommendText}>AI 데이트 추천</Text>
          </TouchableOpacity>
        </View>
      );
    }
    // TODO: 카카오맵 SDK 연동 후 실제 지도 렌더링
    return null;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.tabBar}>
          {SUB_TABS.map(({ key, label }) => {
            const selected = subTab === key;
            return (
              <TouchableOpacity key={key} style={styles.tabItem} onPress={() => setSubTab(key)}>
                <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{label}</Text>
                {selected && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {subTab === 'archive' && <ArchiveTab />}
        {subTab === 'map' && renderMap()}
        {subTab === 'feed' && <FeedTab />}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.bg },
  container: { flex: 1, backgroundColor: theme.bg },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: SYS.CARD_DARK,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  tabLabel: { fontSize: 15, color: SYS.TEXT_MUTED },
  tabLabelActive: { color: BRAND.CORAL, fontWeight: 'bold' },
  tabUnderline: {
    marginTop: 8,
    height: 2,
    width: 24,
    backgroundColor: BRAND.CORAL,
    borderRadius: 1,
  },

  // 아카이브 — 나선형 Helix 앨범
  helixHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    alignItems: 'center',
  },
  helixTitle: { ...TYPOGRAPHY.heading, color: theme.text },
  helixSub: { ...TYPOGRAPHY.caption, color: SYS.TEXT_MUTED, marginTop: 4 },
  helixContent: { paddingVertical: 20 },
  helixItem: {
    width: CARD_WIDTH,
    minHeight: CARD_HEIGHT,
    marginVertical: ITEM_MARGIN,
    alignSelf: 'center',
    backgroundColor: theme.card,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  helixEmoji: { fontSize: 48 },
  helixLabel: { ...TYPOGRAPHY.label, color: theme.text },
  helixDate: { ...TYPOGRAPHY.caption, color: '#666' },
  helixTags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 4 },
  helixTag: { backgroundColor: SYS.BG_DARK_MIDNIGHT, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  helixTagText: { ...TYPOGRAPHY.caption, color: BRAND.MINT },
  helixStatsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: SYS.CARD_DARK,
  },
  helixStatItem: { ...TYPOGRAPHY.label, color: theme.text },

  // 지도 — 카카오맵 연동 전 플레이스홀더 (수정 금지)
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  mapPlaceholderEmoji: { fontSize: 64 },
  mapPlaceholderTitle: { ...TYPOGRAPHY.heading, color: theme.text },
  mapPlaceholderDesc: { ...TYPOGRAPHY.body, textAlign: 'center', lineHeight: 24 },
  mapPinList: { width: '100%', borderRadius: 16, padding: 20, gap: 8, marginTop: 8 },
  mapPinListTitle: { ...TYPOGRAPHY.label, color: SYS.TEXT_MUTED },
  mapPinEmpty: { ...TYPOGRAPHY.caption },
  aiRecommendBtn: { width: '100%', marginTop: 8 },
  aiRecommendSolid: { backgroundColor: BRAND.CORAL, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  aiRecommendText: { ...TYPOGRAPHY.button, color: SYS.TEXT_LIGHT },

  // 피드 — 인기 데이트코스
  feedContent: { paddingBottom: 20 },
  feedTitle: { ...TYPOGRAPHY.heading, color: theme.text, padding: 20, paddingBottom: 12 },

  ootdBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 12,
  },
  ootdText: { ...TYPOGRAPHY.bodyMedium, color: theme.text, flex: 1 },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  filterChip: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  filterChipActive: { backgroundColor: BRAND.CORAL },
  filterChipText: { ...TYPOGRAPHY.caption },
  filterChipTextActive: { color: SYS.TEXT_LIGHT },

  courseCard: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  courseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  courseCoupleLabel: { ...TYPOGRAPHY.bodyMedium, color: theme.text, flex: 1 },
  courseRegionBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  courseRegionText: { ...TYPOGRAPHY.caption },

  coursePlaces: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  coursePlaceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coursePlaceChip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  coursePlaceText: { ...TYPOGRAPHY.caption },
  courseArrow: { ...TYPOGRAPHY.caption, color: '#555' },

  courseTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  courseTag: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  courseTagText: { ...TYPOGRAPHY.caption },

  courseRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  courseRatingText: { ...TYPOGRAPHY.caption, color: SYS.TEXT_MUTED },
  courseRatingDivider: { width: 1, height: 12 },

  courseReview: { ...TYPOGRAPHY.caption, fontStyle: 'italic' },

  courseMapBtn: { marginTop: 4 },
  courseMapBtnSolid: {
    backgroundColor: BRAND.CORAL,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseMapBtnText: { ...TYPOGRAPHY.button, color: SYS.TEXT_LIGHT },
  });
}
