// ─── date-recommend-result — AI 추천 데이트코스 결과 (FUN-HIS-002 "화면 흐름" 3단계) ──
// setup 화면이 sessionStore.pendingDateRecommendResult에 담아 넘긴 레이어5 결과를
// 그대로 렌더링한다. 이 화면도 레이어1~5 로직은 호출만 하고 수정하지 않았다.
//
// 지도 위 핀+연결선 시각화(architecture.md 원안)는 이번 v1에서 스킵했다 — 카카오맵
// SDK가 아직 미연동 상태이고(history.tsx의 KAKAO_MAP_API_KEY 플레이스홀더 분기 참고),
// 신규 지도 SDK 연동은 이번 작업 범위 밖으로 명시돼 있다. 대신 카드 리스트만으로 v1을
// 구성했고, 지도 시각화는 카카오맵 SDK 연동 시점에 이 화면에 추가하면 된다.

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useSessionStore } from '@/store/sessionStore';
import { useFeatureAiDateRecommend } from '@/config/featureFlags';
import { loadDatePlaces, saveDatePlace, type DatePlace } from '@/services/memoryMapService';
import type { ComposedCourse, RecommendationCandidate } from '@/services/dateRecommendationService';
import { BRAND, SYS } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

function candidateSecondaryLine(candidate: RecommendationCandidate): string {
  return candidate.kind === 'nearby_place' ? candidate.address : candidate.area;
}

function candidateCategoryLabel(candidate: RecommendationCandidate): string {
  return candidate.kind === 'nearby_place' ? candidate.categoryName : candidate.tags.join(', ');
}

// "이 코스 담기" → 기존 memoryMapService.saveDatePlace 재사용. similar_course 후보는
// 이미 여러 장소를 담은 기존 코스라 그 places[]를 그대로 펼치고(handleAddCourseToMap이
// history.tsx의 피드 탭에서 하던 것과 동일한 패턴), nearby_place 후보는 그 자체가
// 하나의 장소라 1건으로 변환한다.
function candidateToNewPlaces(candidate: RecommendationCandidate, reason: string): Omit<DatePlace, 'id'>[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (candidate.kind === 'nearby_place') {
    return [{ name: candidate.name, area: candidate.address, date: todayStr, memo: reason }];
  }
  return candidate.places.map((p) => ({ name: p.name, area: candidate.area, date: todayStr, memo: reason }));
}

export default function DateRecommendResultScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const featureEnabled = useFeatureAiDateRecommend();
  const pendingResult = useSessionStore((s) => s.pendingDateRecommendResult);
  const setPendingDateRecommendResult = useSessionStore((s) => s.setPendingDateRecommendResult);

  const [courses, setCourses] = useState<ComposedCourse[]>([]);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  // pendingChatMessage와 동일한 패턴 — 마운트 시 1회 읽고 즉시 비운다(다음 진입 때
  // 이전 결과가 잔존해 잘못 노출되는 것을 방지).
  useEffect(() => {
    if (pendingResult) {
      setCourses(pendingResult);
      setPendingDateRecommendResult(null);
    } else if (courses.length === 0) {
      // 결과 없이 직접 진입(딥링크, 새로고침 등) — 되돌아갈 곳이 없으므로 지도 탭으로.
      router.replace('/(tabs)/history?tab=map');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingResult]);

  useEffect(() => {
    if (!featureEnabled) router.replace('/(tabs)/history?tab=map');
  }, [featureEnabled, router]);

  async function handleSaveCourse(course: ComposedCourse, index: number) {
    if (savingIndex !== null) return;
    setSavingIndex(index);
    try {
      const existing = await loadDatePlaces();
      const newPlaces = course.candidates
        .flatMap((c) => candidateToNewPlaces(c, course.copy))
        .filter((p) => !existing.find((e) => e.name === p.name));

      if (newPlaces.length === 0) {
        Alert.alert('이미 담겨 있어요', '이 코스의 장소가 이미 내 지도에 있어요.');
        return;
      }

      for (let i = 0; i < newPlaces.length; i++) {
        await saveDatePlace({ id: `${Date.now()}_${i}`, ...newPlaces[i] });
      }

      Alert.alert('📍 지도에 담았어요', `${course.theme} 코스의 장소 ${newPlaces.length}개가\n내 지도에 추가됐어요.`, [
        { text: '확인', onPress: () => router.replace('/(tabs)/history?tab=map') },
      ]);
    } catch {
      Alert.alert('오류', '코스를 담지 못했어요.');
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>✨ 추천 데이트코스</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/history?tab=map')} hitSlop={8}>
          <Text style={styles.closeBtn}>닫기</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {courses.map((course, index) => (
          <View key={`${course.theme}_${index}`} style={styles.courseCard}>
            <Text style={styles.courseTheme}>{course.theme}</Text>
            <Text style={styles.courseCopy}>{course.copy}</Text>

            <View style={styles.placeList}>
              {course.candidates.map((candidate) => (
                <View key={candidate.candidateId} style={styles.placeRow}>
                  <View style={styles.placeRowInfo}>
                    <Text style={styles.placeName} numberOfLines={1}>
                      📍 {candidate.name}
                    </Text>
                    <Text style={styles.placeMeta} numberOfLines={1}>
                      {candidateSecondaryLine(candidate)} · {candidateCategoryLabel(candidate)}
                    </Text>
                    <Text style={styles.placeReason} numberOfLines={2}>
                      {candidate.reason}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, savingIndex === index && styles.saveBtnDisabled]}
              onPress={() => handleSaveCourse(course, index)}
              disabled={savingIndex !== null}
            >
              <Text style={styles.saveBtnText}>
                {savingIndex === index ? '담는 중...' : '📍 이 코스 담기'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    title: { ...TYPOGRAPHY.heading, color: theme.text },
    closeBtn: { ...TYPOGRAPHY.body, color: theme.textMuted },
    content: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
    courseCard: {
      backgroundColor: theme.card,
      borderRadius: 18,
      padding: 18,
      gap: 12,
      borderWidth: 0.5,
      borderColor: theme.border,
    },
    courseTheme: { ...TYPOGRAPHY.bodyMedium, color: theme.text, fontWeight: '700' },
    courseCopy: { ...TYPOGRAPHY.caption, color: theme.textMuted },
    placeList: { gap: 10 },
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
    },
    placeRowInfo: { flex: 1, gap: 2 },
    placeName: { fontSize: 14, fontWeight: '600', color: theme.text },
    placeMeta: { fontSize: 11, color: theme.textMuted },
    placeReason: { fontSize: 11, color: theme.textMuted, fontStyle: 'italic' },
    saveBtn: {
      backgroundColor: BRAND.CORAL,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { fontSize: 13, fontWeight: '700', color: SYS.TEXT_LIGHT },
  });
}
