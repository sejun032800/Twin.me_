// ─── date-recommend-setup — AI 추천 데이트코스 조건 입력 (FUN-HIS-002 "화면 흐름" 1단계) ──
// date-recommend-architecture.md "UI/UX 구조 — 지도 탭" 전체 플로우 참고. 이 화면은
// 레이어1~5(수집/매칭/클러스터링/후보군 생성/LLM 구성)의 기존 함수를 호출만 한다 —
// 후보군 생성/LLM 구성 로직(findSimilarCourses/findNearbyAlternatives/
// composeDateCourse 본체) 자체는 건드리지 않았다. 다만 이 화면의 예산대/시간대 칩이
// 실제로 반영되게 하려고 AnonymizedCoupleContext(레이어4/5)에 timeSlotLabel 필드를
// 추가했고, avgRatingBand를 조회하는 dateCourseService.getCoupleAvgRatingBand()를
// 새로 추가했다 — 두 변경 모두 이 화면의 요구사항 때문에 파생된 것이다.
//
// 후보 리스트 생성은 "유사한 곳 ↔ 안 해본 곳" 토글값에 따라 레이어4의 두 함수 중
// 하나만 호출한다(둘을 섞지 않는다 — 사용자 지시 그대로).

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { useCoupleStore } from '@/store/coupleStore';
import { useSessionStore } from '@/store/sessionStore';
import { useFeatureAiDateRecommend } from '@/config/featureFlags';
import { fetchDateRecommendSetupContext, type DateRecommendSetupContext } from '@/services/dateRecommendSetupService';
import { getCoupleAvgRatingBand } from '@/services/dateCourseService';
import {
  findSimilarCourses,
  findNearbyAlternatives,
  composeDateCourse,
  categoryCodesToTags,
  computeUnvisitedCategories,
  type RecommendationCandidate,
  type AnonymizedCoupleContext,
} from '@/services/dateRecommendationService';
import { BRAND, SYS } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

// 최소 검증된(confidence≠unverified) 스탬프 수 — 이 미만이면 추천 자체가 무의미하다고
// 판단했다. clusterStampsByDay는 스탬프를 날짜로 묶는데, 2건 이하로는 사실상 "최근 코스"가
// 카테고리 1~2개짜리 초박형 데이터가 되어 findSimilarCourses의 자카드 유사도가 거의 항상
// 0에 수렴하고(date_courses.tags는 보통 코스당 2~3개), findNearbyAlternatives도 "안 해본
// 카테고리"가 사실상 전체 목록과 같아져 개인화 신호가 없다. 그렇다고 문턱을 너무 높이면
// FUN-HIS-006(사진 업로드 유도)이 막 시작된 초기 유저에게 이 기능 자체가 너무 먼 목표가
// 되어버린다 — 이 화면 아래 handleOptimize()(동선 최적화)가 이미 "장소 2개 이상"이라는
// 낮은 문턱을 쓰고 있는 것과 같은 맥락에서, 3을 최소 기준으로 잡았다.
const MIN_VERIFIED_STAMPS = 3;

const BUDGET_OPTIONS = ['~3만', '3~7만', '7만+'] as const;
const TIME_OPTIONS = ['낮', '저녁', '종일'] as const;
type RecommendMode = 'similar' | 'novel';

export default function DateRecommendSetupScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const params = useLocalSearchParams<{ entry?: string }>();
  const featureEnabled = useFeatureAiDateRecommend();
  const coupleId = useCoupleStore((s) => s.coupleId);
  const setPendingOotdUploadTrigger = useSessionStore((s) => s.setPendingOotdUploadTrigger);
  const setPendingDateRecommendResult = useSessionStore((s) => s.setPendingDateRecommendResult);
  const { requestLocation } = useGeoLocation();

  const [loadingContext, setLoadingContext] = useState(true);
  const [context, setContext] = useState<DateRecommendSetupContext | null>(null);
  const [budget, setBudget] = useState<(typeof BUDGET_OPTIONS)[number]>(BUDGET_OPTIONS[1]);
  const [timeSlot, setTimeSlot] = useState<(typeof TIME_OPTIONS)[number]>(TIME_OPTIONS[0]);
  const [mode, setMode] = useState<RecommendMode>('similar');
  const [submitting, setSubmitting] = useState(false);

  // 플래그가 꺼진 상태로 이 라우트에 진입할 방법은 FAB가 이미 숨겨져 있어 정상 흐름에서는
  // 없지만(§0.3과 별개로 이 기능 자체의 게이팅 방어), 이전 세션의 스택 잔존/딥링크 같은
  // 엣지케이스를 대비해 방어적으로 한 번 더 막는다.
  useEffect(() => {
    if (!featureEnabled) router.back();
  }, [featureEnabled, router]);

  // 안드로이드 콜드스타트 시 history.tsx FAB 클릭(entry='fab' 파라미터 동반) 없이
  // 이 모달이 정상 스택 히스토리 없이 단독 마운트되는 사례 방어. 이 경우 back()은
  // 갈 곳이 없어 'GO_BACK not handled'를 내므로 홈으로 replace한다.
  useEffect(() => {
    if (params.entry !== 'fab') {
      router.replace('/(tabs)');
    }
  }, [params.entry, router]);

  useEffect(() => {
    let cancelled = false;
    fetchDateRecommendSetupContext(coupleId).then((ctx) => {
      if (!cancelled) {
        setContext(ctx);
        setLoadingContext(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [coupleId]);

  function handleGoAddPhoto() {
    setPendingOotdUploadTrigger(true);
    router.back();
  }

  async function handleSubmit() {
    if (!context || submitting) return;
    setSubmitting(true);
    try {
      let candidates: RecommendationCandidate[];

      if (mode === 'similar') {
        // insufficientData 체크에서 latestCourse !== null을 이미 보장했다.
        candidates = await findSimilarCourses(context.latestCourse!);
      } else {
        candidates = await findNearbyAlternatives(context.visitedStamps, context.latestOrigin!);
      }

      if (candidates.length === 0) {
        Alert.alert('추천할 후보가 없어요', '조건에 맞는 코스를 찾지 못했어요. 다른 방식으로 다시 시도해보세요.');
        setSubmitting(false);
        return;
      }

      const [location, avgRatingBand] = await Promise.all([
        requestLocation(),
        getCoupleAvgRatingBand(coupleId),
      ]);
      const anonymizedContext: AnonymizedCoupleContext = {
        tags: categoryCodesToTags(context.latestCourse?.categoryCodes ?? []),
        avgRatingBand,
        areaLabel: location?.district ?? location?.city ?? '지역 정보 없음',
        budgetLabel: budget,
        timeSlotLabel: timeSlot,
        unvisitedCategories: computeUnvisitedCategories(context.visitedStamps),
      };

      const composed = await composeDateCourse(candidates, anonymizedContext);

      if (composed.length === 0) {
        Alert.alert('추천을 만들지 못했어요', '잠시 후 다시 시도해주세요.');
        setSubmitting(false);
        return;
      }

      setPendingDateRecommendResult(composed);
      router.replace('/(modals)/date-recommend-result');
    } catch {
      Alert.alert('오류', '데이트 코스를 추천받는 데 실패했어요.');
      setSubmitting(false);
    }
  }

  if (loadingContext) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={BRAND.CORAL} />
        </View>
      </SafeAreaView>
    );
  }

  if (submitting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerFill}>
          <ActivityIndicator color={BRAND.CORAL} size="large" />
          <Text style={styles.loadingText}>우리 데이트 스타일 분석 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const insufficientData = !context || context.verifiedStampCount < MIN_VERIFIED_STAMPS || !context.latestCourse;

  if (insufficientData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerFill}>
          <Text style={styles.emptyEmoji}>📸</Text>
          <Text style={styles.emptyTitle}>아직 데이트 기록이 부족해요</Text>
          <Text style={styles.emptyDesc}>
            사진을 더 올려주세요{'\n'}
            (검증된 방문 기록 {MIN_VERIFIED_STAMPS}건 이상 필요 · 현재 {context?.verifiedStampCount ?? 0}건)
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleGoAddPhoto}>
            <Text style={styles.primaryBtnText}>📷 사진 추가하러 가기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>✨ AI 추천 데이트코스</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.closeBtn}>닫기</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>예산대</Text>
        <View style={styles.chipRow}>
          {BUDGET_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.chip, budget === option && styles.chipActive]}
              onPress={() => setBudget(option)}
            >
              <Text style={[styles.chipText, budget === option && styles.chipTextActive]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>가능한 시간대</Text>
        <View style={styles.chipRow}>
          {TIME_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.chip, timeSlot === option && styles.chipActive]}
              onPress={() => setTimeSlot(option)}
            >
              <Text style={[styles.chipText, timeSlot === option && styles.chipTextActive]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>어떤 스타일을 찾고 있나요?</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'similar' && styles.toggleBtnActive]}
            onPress={() => setMode('similar')}
          >
            <Text style={[styles.toggleBtnText, mode === 'similar' && styles.toggleBtnTextActive]}>
              유사한 곳
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'novel' && styles.toggleBtnActive]}
            onPress={() => setMode('novel')}
          >
            <Text style={[styles.toggleBtnText, mode === 'novel' && styles.toggleBtnTextActive]}>
              안 해본 곳
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
        <Text style={styles.submitBtnText}>추천받기</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.bg },
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
    loadingText: { ...TYPOGRAPHY.body, color: theme.textMuted },
    emptyEmoji: { fontSize: 56 },
    emptyTitle: { ...TYPOGRAPHY.heading, color: theme.text, textAlign: 'center' },
    emptyDesc: { ...TYPOGRAPHY.body, color: theme.textMuted, textAlign: 'center' },
    primaryBtn: {
      marginTop: 12,
      backgroundColor: BRAND.CORAL,
      borderRadius: 14,
      paddingVertical: 15,
      paddingHorizontal: 28,
      alignItems: 'center',
    },
    primaryBtnText: { ...TYPOGRAPHY.button, color: SYS.TEXT_LIGHT },
    secondaryBtn: { paddingVertical: 10 },
    secondaryBtnText: { ...TYPOGRAPHY.body, color: theme.textMuted },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    title: { ...TYPOGRAPHY.heading, color: theme.text },
    closeBtn: { ...TYPOGRAPHY.body, color: theme.textMuted },
    content: { flex: 1, paddingHorizontal: 20, gap: 8 },
    sectionLabel: { ...TYPOGRAPHY.label, color: theme.text, marginTop: 16, marginBottom: 4 },
    chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    chip: {
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 9,
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
    },
    chipActive: { backgroundColor: BRAND.CORAL, borderColor: BRAND.CORAL },
    chipText: { ...TYPOGRAPHY.caption, color: theme.textMuted, fontWeight: '600' },
    chipTextActive: { color: SYS.TEXT_LIGHT },
    toggleRow: { flexDirection: 'row', gap: 10 },
    toggleBtn: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      backgroundColor: theme.card,
      borderWidth: 0.5,
      borderColor: theme.border,
    },
    toggleBtnActive: { backgroundColor: BRAND.CORAL_DEEP, borderColor: BRAND.CORAL_DEEP },
    toggleBtnText: { ...TYPOGRAPHY.bodyMedium, color: theme.text },
    toggleBtnTextActive: { color: SYS.TEXT_LIGHT },
    submitBtn: {
      marginHorizontal: 20,
      marginBottom: 20,
      backgroundColor: BRAND.CORAL,
      borderRadius: 16,
      paddingVertical: 17,
      alignItems: 'center',
    },
    submitBtnText: { ...TYPOGRAPHY.button, color: SYS.TEXT_LIGHT },
  });
}
