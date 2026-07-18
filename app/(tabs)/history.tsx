// ─── FUN-HIS — 히스토리 탭 3서브탭 구조 (MASTER.md §7) ────────────────────────
// archive(나선형 Helix 앨범) / map(데이트 지도) / feed(인기 데이트코스) 3탭.
// map은 카카오맵 API 키 입력 전까지 플레이스홀더로 대체하되, "등록된 장소" 섹션은
// 메모리 맵(memoryMapService)과 연동해 장소 CRUD 및 AI 동선 최적화를 제공한다.
// archive의 실제 3D 나선 렌더러는 Expo Go 한계로 reanimated 기반 parallax
// (좌우 교차 translateX + 중앙 확대/선명 효과)로 근사한다.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { useUserStore } from '@/store/userStore';
import { useCoupleStore } from '@/store/coupleStore';
import { useScoreStore } from '@/store/scoreStore';
import { useSessionStore } from '@/store/sessionStore';
import { useTheme, useSigmaAuraOpacity } from '@/hooks/useTheme';
import { usePremiumGate } from '@/hooks/usePremiumGate';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { supabase } from '@/lib/supabaseClient';
import { callLLM } from '@/api/llm';
import { getPublicCourses, type DateCourse } from '@/services/dateCourseService';
import { loadDatePlaces, saveDatePlace, deleteDatePlace, optimizePlaces } from '@/services/memoryMapService';
import type { DatePlace } from '@/services/memoryMapService';
import AuraDuskGradient from '@/components/AuraDuskGradient';
import WrappedModal from '@/components/WrappedModal';
import OOTDArchiveGrid from '@/components/OOTDArchiveGrid';
import HighlightGallery from '@/components/HighlightGallery';
import { formatScore } from '@/engine/scoreCalculator';
import { BRAND, SYS, MODAL_BACKDROP_LIGHT } from '@/constants/colors';
import type { SigmaTheme, ThemeMode } from '@/constants/theme';
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
  { id: '1', emoji: '💌', label: '첫 만남', date: '2025.01.15', tags: ['#설렘', '#시작'], cardBg: 'rgba(255, 164, 164, 0.08)' },
  { id: '2', emoji: '🍽️', label: '첫 데이트', date: '2025.01.22', tags: ['#맛집', '#떨림'], cardBg: 'rgba(255, 189, 189, 0.08)' },
  { id: '3', emoji: '✈️', label: '첫 여행', date: '2025.03.10', tags: ['#여행', '#추억'], cardBg: 'rgba(186, 223, 219, 0.10)' },
  { id: '4', emoji: '🎉', label: '100일', date: '2025.04.25', tags: ['#기념일', '#축하'], cardBg: 'rgba(255, 164, 164, 0.10)' },
  { id: '5', emoji: '🌙', label: '야경', date: '2025.05.30', tags: ['#야경', '#로맨틱'], cardBg: 'rgba(125, 224, 200, 0.08)' },
  { id: '6', emoji: '☕', label: '카페투어', date: '2025.06.14', tags: ['#카페', '#힐링'], cardBg: 'rgba(252, 249, 234, 0.40)' },
];

const PLACEHOLDER_CARD: HelixCardData = {
  id: 'placeholder',
  emoji: '✨',
  label: '첫 추억을 기록해봐요',
  date: '',
  tags: ['#우리만의', '#이야기'],
  cardBg: 'rgba(255, 164, 164, 0.06)',
  isPlaceholder: true,
};

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
  cardBg: string;
  isPlaceholder?: boolean;
}

type HistoryStyles = ReturnType<typeof makeStyles>;

function HelixCard({
  card,
  index,
  scrollY,
  viewportHeight,
  styles,
  hasKakaoData,
}: {
  card: HelixCardData;
  index: number;
  scrollY: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  styles: HistoryStyles;
  hasKakaoData: boolean;
}) {
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

  if (card.isPlaceholder) {
    return (
      <Animated.View style={[styles.helixItem, { backgroundColor: card.cardBg }, animatedStyle]}>
        <Text style={styles.helixEmoji}>{card.emoji}</Text>
        <Text style={styles.helixLabel}>{card.label}</Text>
        <Text style={styles.helixDate}>지도 탭에서 장소를 추가해보세요</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.helixItem, { backgroundColor: card.cardBg }, animatedStyle]}>
      {!hasKakaoData && (
        <View style={styles.helixExampleBadge}>
          <Text style={styles.helixExampleBadgeText}>예시</Text>
        </View>
      )}
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
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const relationshipStartDate = useCoupleStore((s) => s.relationshipStartDate);
  const hasKakaoData = useUserStore((s) => s.hasKakaoData);
  const dDay = computeDDay(relationshipStartDate);
  const [wrappedVisible, setWrappedVisible] = useState(false);

  const displayCards = hasKakaoData ? HELIX_CARDS : [PLACEHOLDER_CARD, ...HELIX_CARDS];

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

      <OOTDArchiveGrid />

      <HighlightGallery />

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
        {displayCards.map((card, i) => (
          <HelixCard
            key={card.id}
            card={card}
            index={i}
            scrollY={scrollY}
            viewportHeight={viewportHeight}
            styles={styles}
            hasKakaoData={hasKakaoData}
          />
        ))}
      </Animated.ScrollView>

      <View style={styles.helixStatsBar}>
        <Text style={styles.helixStatItem}>❤️ {dDay !== null ? `D+${dDay}일` : '-'}</Text>
        <Text style={styles.helixStatItem}>📸 {HELIX_CARDS.length}장</Text>
        <Text style={styles.helixStatItem}>📍 {MOCK_PLACES_COUNT}곳</Text>
      </View>

      <TouchableOpacity style={[styles.wrappedBtn, styles.wrappedBtnSolid]} onPress={() => setWrappedVisible(true)}>
        <Text style={styles.wrappedBtnText}>✨ 우리의 Wrapped 보기</Text>
      </TouchableOpacity>

      <WrappedModal visible={wrappedVisible} onClose={() => setWrappedVisible(false)} />
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

function FeedTab({ onAddToMap }: { onAddToMap: (course: DateCourse) => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { hasReportAccess } = usePremiumGate();
  const { location, requestLocation } = useGeoLocation();
  const [ootdOnly, setOotdOnly] = useState(false);
  const [filter, setFilter] = useState<FeedFilterKey>('rating');
  const [courses, setCourses] = useState<DateCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMockCourses, setIsMockCourses] = useState(false);

  useEffect(() => {
    getPublicCourses()
      .then(({ courses: data, isMock }) => {
        setCourses(data);
        setIsMockCourses(isMock);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredCourses = useMemo(() => {
    let result = [...courses];

    // OOTD 필터: 별점 4.5 이상만
    if (ootdOnly) {
      result = result.filter((c) => (c.myScore + c.partnerScore) / 2 >= 4.5);
    }

    // 정렬 필터
    if (filter === 'rating') {
      result.sort((a, b) => (b.myScore + b.partnerScore) - (a.myScore + a.partnerScore));
    } else if (filter === 'recent') {
      result.sort((a, b) => b.id.localeCompare(a.id));
    } else if (filter === 'nearby') {
      const city = location?.city ?? location?.district ?? null;
      if (city) {
        result = result.filter((c) => c.area.includes(city));
      }
    }

    return result;
  }, [courses, ootdOnly, filter, location]);

  return (
    <ScrollView
      contentContainerStyle={styles.feedContent}
      showsVerticalScrollIndicator={false}
      bounces={true}
      alwaysBounceVertical={true}
    >
      <Text style={styles.feedTitle}>💑 인기 데이트코스</Text>

      {isMockCourses && (
        <View style={styles.mockBannerCard}>
          <Text style={styles.mockBannerTitle}>💌 아직 공유된 코스가 없어요</Text>
          <Text style={styles.mockBannerDesc}>
            데이트 후 코스를 공유하면{'\n'}
            여기에 모여요
          </Text>
        </View>
      )}

      {!hasReportAccess && (
        <View style={styles.freeFeedBanner}>
          <Text style={styles.freeFeedBannerText}>Coffee Talk 이상에서 전체 피드를 볼 수 있어요</Text>
        </View>
      )}

      <View style={styles.ootdBar}>
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
                selected && styles.filterChipActive,
              ]}
              onPress={async () => {
                setFilter(f.key);
                if (f.key === 'nearby' && !location) {
                  await requestLocation();
                }
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selected && styles.filterChipTextActive,
                ]}
              >
                {f.key === 'nearby' && selected && !location ? '📍 위치 확인 중...' : f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.feedLoading} color={BRAND.CORAL} />
      ) : courses.length === 0 ? (
        <Text style={styles.feedEmptyText}>아직 공유된 코스가 없어요</Text>
      ) : filteredCourses.length === 0 ? (
        <Text style={styles.feedFilterEmptyText}>현재 필터에 맞는 코스가 없어요</Text>
      ) : (
        filteredCourses.map((course) => (
          <View
            key={course.id}
            style={styles.courseCard}
          >
            <View style={styles.courseHeader}>
              <Text style={styles.courseCoupleLabel}>
                익명의 [{course.tierEmoji} {course.tierName}] 커플
              </Text>
              <View style={styles.courseRegionBadge}>
                <Text style={styles.courseRegionText}>📍 {course.area}</Text>
              </View>
            </View>

            <View style={styles.coursePlaces}>
              {course.places.map((place, i) => (
                <View key={place.name} style={styles.coursePlaceRow}>
                  <View
                    style={[
                      styles.coursePlaceChip,
                      { backgroundColor: theme.accentSoft },
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
                  style={[styles.courseTag, { backgroundColor: theme.card }]}
                >
                  <Text style={[styles.courseTagText, { color: theme.textMuted }]}>{tag}</Text>
                </View>
              ))}
            </View>

            <View style={styles.courseRatingRow}>
              <Text style={styles.courseRatingText}>나의 별점 ⭐{formatScore(course.myScore)}</Text>
              <View
                style={[
                  styles.courseRatingDivider,
                  { backgroundColor: theme.border },
                ]}
              />
              <Text style={styles.courseRatingText}>연인의 별점 ⭐{formatScore(course.partnerScore)}</Text>
            </View>

            <Text style={[styles.courseReview, { color: theme.textMuted }]}>"{course.review}"</Text>

            <TouchableOpacity
              style={[styles.courseMapBtn, styles.courseMapBtnSolid]}
              onPress={() => onAddToMap(course)}
            >
              <Text style={styles.courseMapBtnText}>📍 이 코스 내 지도에 담기</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ─── 장소 추가 모달 ────────────────────────────────────────────────────────────
const RATING_OPTIONS = [1, 2, 3, 4, 5];

function AddPlaceModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (place: DatePlace) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setName('');
    setArea('');
    setDate(null);
    setRating(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const place: DatePlace = {
        id: Date.now().toString(),
        name: name.trim(),
        area: area.trim(),
        date: date
          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          : '',
        rating: rating ?? undefined,
      };
      await saveDatePlace(place);
      onSaved(place);
      reset();
      onClose();
    } catch {
      Alert.alert('오류', '장소 저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>장소 추가</Text>

          <TextInput
            style={styles.placeInput}
            placeholder="장소명"
            placeholderTextColor={theme.textMuted}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.placeInput}
            placeholder="지역 (예: 홍대)"
            placeholderTextColor={theme.textMuted}
            value={area}
            onChangeText={setArea}
          />
          <TouchableOpacity
            style={[styles.placeInput, styles.placeDateBtn]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={[styles.placeDateBtnText, !date && { color: theme.textMuted }]}>
              {date
                ? `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
                : '날짜 선택 (선택사항)'}
            </Text>
            <Text style={styles.placeDateIcon}>📅</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={date ?? new Date()}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (event.type === 'set' && selectedDate) {
                  setDate(selectedDate);
                }
              }}
              locale="ko-KR"
            />
          )}

          <View style={styles.ratingRow}>
            {RATING_OPTIONS.map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.ratingBtn, rating === n && styles.ratingBtnActive]}
                onPress={() => setRating(rating === n ? null : n)}
              >
                <Text style={[styles.ratingBtnText, rating === n && styles.ratingBtnTextActive]}>⭐{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.placeModalActions}>
            <TouchableOpacity style={styles.placeCancelBtn} onPress={handleClose}>
              <Text style={styles.placeCancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.placeSaveBtn, !name.trim() && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!name.trim() || saving}
            >
              <Text style={styles.saveBtnText}>{saving ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function History() {
  const theme = useTheme();
  const themeMode = useSessionStore((s) => s.themeMode);
  const reduceAuraMotion = useSessionStore((s) => s.reduceAuraMotion);
  const styles = useMemo(() => makeStyles(theme, themeMode), [theme, themeMode]);
  const setAuraScreenKey = useSessionStore((s) => s.setAuraScreenKey);

  useFocusEffect(useCallback(() => {
    setAuraScreenKey('helix');
  }, [setAuraScreenKey]));

  // sigma 전용 오라 배경 — light/dark는 아래 값들을 전혀 참조하지 않는다(렌더링에서
  // themeMode==='sigma' 게이트로 걸러짐). 서브탭(아카이브/지도/피드)과 무관하게 항상
  // historyMap 티어(0.3)를 쓴다 — "나선의 시간탑"(아카이브 헬릭스 뷰)도 예외 없이 동일.
  // 여기는 움직임을 멈추지 않는 화면이라 frozen은 명시적으로 넘기지 않는다(기본값 false).
  // auraVector는 personaMatrix를 store에서 다시 조회하지 않고 useTheme()이 반환하는
  // 값 하나만 거친다(theme.ts의 buildSigmaTheme가 채워 넣는 동일 원본).
  const auraVector = theme.auraVector;
  const historyAuraOpacity = useSigmaAuraOpacity('historyMap');

  const [subTab, setSubTab] = useState<SubTab>('archive');
  const [aiLoading, setAiLoading] = useState(false);
  const [places, setPlaces] = useState<DatePlace[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [addPlaceVisible, setAddPlaceVisible] = useState(false);
  const { location, requestLocation } = useGeoLocation();

  useEffect(() => {
    loadDatePlaces()
      .then(setPlaces)
      .catch(() => console.warn('장소 목록 로드 실패'));
  }, []);

  function handlePlaceSaved(place: DatePlace) {
    setPlaces((prev) => [place, ...prev]);
  }

  async function handleDeletePlace(id: string) {
    await deleteDatePlace(id);
    setPlaces((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleOptimize() {
    if (places.length < 2 || optimizing) return;
    setOptimizing(true);
    try {
      const result = await optimizePlaces(places);
      setPlaces(result);
    } finally {
      setOptimizing(false);
    }
  }

  function handleAddCourseToMap(course: DateCourse) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const newPlaces: DatePlace[] = course.places
      .filter((p) => !places.find((existing) => existing.name === p.name))
      .map((p, i) => ({
        id: `${course.id}_${i}_${Date.now()}`,
        name: p.name,
        area: course.area,
        date: todayStr,
        memo: `${course.title} 코스`,
      }));

    if (newPlaces.length === 0) {
      setSubTab('map');
      Alert.alert('이미 담겨 있어요', `${course.title} 코스의 장소가 이미 내 지도에 있어요.`);
      return;
    }

    (async () => {
      try {
        for (const p of newPlaces) {
          await saveDatePlace(p);
        }
        setPlaces((prev) => [...newPlaces, ...prev]);
        setSubTab('map');
        Alert.alert(
          '📍 지도에 담았어요',
          `${course.title} 코스의 장소 ${newPlaces.length}개가\n내 지도에 추가됐어요.`,
          [{ text: '확인' }],
        );
      } catch {
        Alert.alert('오류', '장소를 지도에 담지 못했어요.');
      }
    })();
  }

  async function handleAIRecommend() {
    setAiLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('로그인 필요', '로그인 후 이용해주세요.');
        setAiLoading(false);
        return;
      }
      const loc = location || (await requestLocation());
      const coupleArea = loc?.city ?? loc?.district ?? '서울';

      const response = await callLLM({
        systemPrompt: `당신은 데이트 코스 전문가입니다.
        커플의 연애 데이터를 바탕으로
        ${coupleArea} 지역의 데이트 코스 3가지를 추천해주세요.
        각 코스는 장소 3곳과 분위기 태그를 포함해주세요.`,
        userMessage: JSON.stringify({
          avgScore: useScoreStore.getState().sLive,
          tags: ['감성', '로맨틱'],
          area: coupleArea,
        }),
        maxTokens: 500,
      });

      Alert.alert('AI 데이트 추천 🗺️', response.content);
    } catch {
      Alert.alert('오류', 'AI 추천을 불러오지 못했어요.');
    } finally {
      setAiLoading(false);
    }
  }

  function renderMap() {
    if (!KAKAO_MAP_API_KEY) {
      return (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderEmoji}>🗺️</Text>
          <Text style={styles.mapPlaceholderTitle}>지도 기능 준비 중</Text>
          <Text style={styles.mapPlaceholderDesc}>
            .env 파일에 EXPO_PUBLIC_KAKAO_MAP_API_KEY를{'\n'}
            입력하면 바로 활성화돼요
          </Text>

          <View style={styles.mapPinList}>
            <Text style={styles.mapPinListTitle}>📍 등록된 장소</Text>
            {places.length === 0 ? (
              <Text style={[styles.mapPinEmpty, { color: theme.textMuted }]}>아직 기록된 장소가 없어요</Text>
            ) : (
              <View style={styles.placeList}>
                {places.map((place) => (
                  <View key={place.id} style={styles.placeRow}>
                    <View style={styles.placeRowInfo}>
                      <Text style={styles.placeRowName} numberOfLines={1}>
                        📍 {place.name}
                      </Text>
                      <Text style={styles.placeRowMeta} numberOfLines={1}>
                        {[place.area, place.date, place.rating ? `⭐${place.rating}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeletePlace(place.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={20} color={SYS.CRISIS_RED} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.addPlaceBtn} onPress={() => setAddPlaceVisible(true)}>
              <Text style={styles.addPlaceBtnText}>+ 장소 추가</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.aiRecommendBtn,
              styles.optimizeBtnSolid,
              (places.length < 2 || optimizing) && styles.disabledBtn,
            ]}
            onPress={handleOptimize}
            disabled={places.length < 2 || optimizing}
          >
            {optimizing ? (
              <ActivityIndicator color={SYS.TEXT_LIGHT} />
            ) : (
              <Text style={styles.aiRecommendText}>✨ 동선 최적화</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.aiRecommendBtn, styles.aiRecommendSolid]}
            onPress={handleAIRecommend}
            disabled={aiLoading}
          >
            {aiLoading ? (
              <ActivityIndicator color={SYS.TEXT_LIGHT} />
            ) : (
              <Text style={styles.aiRecommendText}>✨ AI 데이트 추천</Text>
            )}
          </TouchableOpacity>

          <AddPlaceModal
            visible={addPlaceVisible}
            onClose={() => setAddPlaceVisible(false)}
            onSaved={handlePlaceSaved}
          />
        </View>
      );
    }
    // TODO: 카카오맵 SDK 연동 후 실제 지도 렌더링
    return null;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {/* sigma 전용 오라 배경 — light/dark에서는 마운트 자체를 안 한다(props로 숨기는 게
          아니라 렌더 트리에서 아예 제외). 움직임은 그대로 유지 — 정지시키지 않는다. */}
      {themeMode === 'sigma' && auraVector && (
        <AuraDuskGradient
          auraVector={auraVector}
          opacity={typeof historyAuraOpacity === 'number' ? historyAuraOpacity : 0}
          reduceMotion={reduceAuraMotion}
        />
      )}
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
        {subTab === 'feed' && <FeedTab onAddToMap={handleAddCourseToMap} />}
      </View>
    </SafeAreaView>
  );
}

// themeMode는 History()(safeArea/container 배경 분기)만 실제로 쓴다 — ArchiveTab/FeedTab/
// AddPlaceModal도 같은 makeStyles를 재사용하지만 container/safeArea 키를 참조하지 않으므로
// 기본값(themeMode 생략)으로 호출해도 무해하다.
function makeStyles(theme: SigmaTheme, themeMode: ThemeMode = 'dark') {
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.bg },
  // sigma에서만 투명 — 뒤에 깔리는 AuraDuskGradient가 비쳐 보이게 한다. light/dark는
  // 이 화면에 오라 레이어 자체가 마운트되지 않으므로 theme.bg 그대로(기존과 동일).
  container: { flex: 1, backgroundColor: themeMode === 'sigma' ? 'transparent' : theme.bg },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.bg,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  tabLabel: { fontSize: 14, color: theme.textMuted, fontWeight: '500' },
  tabLabelActive: { color: '#FFA4A4', fontWeight: '700' },
  tabUnderline: {
    marginTop: 6,
    height: 2,
    width: 20,
    backgroundColor: '#FFA4A4',
    borderRadius: 1,
  },

  // 아카이브 — 나선형 Helix 앨범
  helixHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    alignItems: 'center',
  },
  helixTitle: { fontSize: 20, fontWeight: '700', color: theme.text },
  helixSub: { fontSize: 12, color: theme.textMuted, marginTop: 4 },
  helixContent: { paddingVertical: 20 },
  helixItem: {
    width: CARD_WIDTH,
    minHeight: CARD_HEIGHT,
    marginVertical: ITEM_MARGIN,
    alignSelf: 'center',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 8,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  helixEmoji: { fontSize: 44 },
  helixLabel: { fontSize: 14, fontWeight: '600', color: theme.text },
  helixDate: { fontSize: 11, color: theme.textMuted },
  helixTags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 4 },
  helixTag: { backgroundColor: 'rgba(255, 255, 255, 0.6)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  helixTagText: { fontSize: 10, color: '#3A8C85' },
  helixExampleBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  helixExampleBadgeText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  helixStatsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 14,
    marginHorizontal: 20,
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: theme.border,
    marginBottom: 12,
  },
  helixStatItem: { fontSize: 13, fontWeight: '500', color: theme.text },

  // 커플 Wrapped(§11) 진입 버튼
  wrappedBtn: { marginHorizontal: 20, marginBottom: 16, borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: '#FFA4A4' },
  wrappedBtnSolid: { backgroundColor: BRAND.CORAL },
  wrappedBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // 지도 — 카카오맵 연동 전 플레이스홀더. "등록된 장소" 섹션은 memoryMapService 연동
  mapPlaceholder: { flex: 1, alignItems: 'center', padding: 28, gap: 12 },
  mapPlaceholderEmoji: { fontSize: 56 },
  mapPlaceholderTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  mapPlaceholderDesc: { fontSize: 13, color: theme.textMuted, textAlign: 'center', lineHeight: 20 },
  mapPinList: {
    width: '100%',
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 18,
    gap: 10,
    borderWidth: 0.5,
    borderColor: theme.border,
    marginTop: 4,
  },
  mapPinListTitle: { fontSize: 12, color: theme.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  mapPinEmpty: { ...TYPOGRAPHY.caption },
  placeList: { gap: 10, marginTop: 4 },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  placeRowInfo: { flex: 1, gap: 2 },
  placeRowName: { fontSize: 14, fontWeight: '500', color: theme.text },
  placeRowMeta: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  addPlaceBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FFA4A4',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addPlaceBtnText: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },
  aiRecommendBtn: { width: '100%', marginTop: 8 },
  aiRecommendSolid: { backgroundColor: '#FFA4A4', borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' },
  optimizeBtnSolid: { backgroundColor: '#BADFDB', borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginBottom: 8 },
  disabledBtn: { opacity: 0.4 },
  aiRecommendText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // 장소 추가 모달
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: MODAL_BACKDROP_LIGHT },
  sheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center' },
  title: { ...TYPOGRAPHY.title, color: theme.text, textAlign: 'center' },
  placeInput: {
    backgroundColor: theme.bg,
    borderRadius: 12,
    padding: 14,
    color: theme.text,
    fontSize: 14,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  placeDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeDateBtnText: {
    fontSize: 14,
    color: theme.text,
  },
  placeDateIcon: {
    fontSize: 16,
  },
  ratingRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  ratingBtn: {
    backgroundColor: theme.accentSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ratingBtnActive: { backgroundColor: BRAND.CORAL },
  ratingBtnText: { ...TYPOGRAPHY.caption, color: theme.text },
  ratingBtnTextActive: { color: SYS.TEXT_LIGHT },
  placeModalActions: { flexDirection: 'row', gap: 12 },
  placeCancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: theme.bg,
  },
  placeCancelBtnText: { fontSize: 14, fontWeight: '600', color: theme.textMuted },
  placeSaveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#FFA4A4',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { ...TYPOGRAPHY.button, color: SYS.TEXT_LIGHT },

  // 피드 — 인기 데이트코스
  feedContent: { paddingBottom: 20 },
  feedTitle: { ...TYPOGRAPHY.heading, color: theme.text, padding: 20, paddingBottom: 12 },
  mockBannerCard: {
    backgroundColor: 'rgba(186, 223, 219, 0.08)',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(186, 223, 219, 0.15)',
  },
  mockBannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  mockBannerDesc: {
    fontSize: 13,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  freeFeedBanner: {
    backgroundColor: theme.accentSoft,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  freeFeedBannerText: { ...TYPOGRAPHY.caption, color: BRAND.CORAL, textAlign: 'center' },

  ootdBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  ootdText: { fontSize: 13, fontWeight: '500', color: theme.text, flex: 1 },

  feedLoading: { marginTop: 40 },
  feedEmptyText: { ...TYPOGRAPHY.body, color: theme.textMuted, textAlign: 'center', marginTop: 40 },
  feedFilterEmptyText: { ...TYPOGRAPHY.caption, color: theme.textMuted, textAlign: 'center', marginTop: 40 },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  filterChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  filterChipActive: { backgroundColor: '#FFA4A4', borderColor: '#FFA4A4' },
  filterChipText: { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '700' },

  courseCard: {
    backgroundColor: theme.card,
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 14,
    gap: 12,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  courseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  courseCoupleLabel: { ...TYPOGRAPHY.bodyMedium, color: theme.text, flex: 1 },
  courseRegionBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(186, 223, 219, 0.20)' },
  courseRegionText: { fontSize: 11, color: '#3A8C85', fontWeight: '500' },

  coursePlaces: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  coursePlaceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coursePlaceChip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  coursePlaceText: { ...TYPOGRAPHY.caption },
  courseArrow: { ...TYPOGRAPHY.caption, color: theme.textMuted },

  courseTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  courseTag: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  courseTagText: { ...TYPOGRAPHY.caption },

  courseRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  courseRatingText: { ...TYPOGRAPHY.caption, color: SYS.TEXT_MUTED },
  courseRatingDivider: { width: 1, height: 12 },

  courseReview: { ...TYPOGRAPHY.caption, fontStyle: 'italic' },

  courseMapBtn: { marginTop: 4 },
  courseMapBtnSolid: {
    backgroundColor: '#FFA4A4',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseMapBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  });
}
