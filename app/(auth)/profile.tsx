// ─── FUN-ONB-001 — 기초 정보 입력 (MASTER.md §2) ─────────────────────────────
// 인증 완료 후 이름/MBTI를 수집한다. 애니어그램 유형은 제네시스 인터뷰(§2 FUN-ONB-003)에서
// 베이지안 추론으로 갱신되므로 이 화면에서는 다루지 않는다.

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabaseClient';
import { useUserStore } from '@/store/userStore';
import { useCoupleStore } from '@/store/coupleStore';
import { useTheme } from '@/hooks/useTheme';
import { BRAND } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';

type MbtiAxisKey = 'EI' | 'SN' | 'TF' | 'JP';

const MBTI_AXES: Array<{ key: MbtiAxisKey; options: readonly [string, string] }> = [
  { key: 'EI', options: ['E', 'I'] },
  { key: 'SN', options: ['S', 'N'] },
  { key: 'TF', options: ['T', 'F'] },
  { key: 'JP', options: ['J', 'P'] },
];

type MbtiSelection = Record<MbtiAxisKey, string | null>;

const EMPTY_MBTI_SELECTION: MbtiSelection = { EI: null, SN: null, TF: null, JP: null };

export default function Profile() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const setMbti = useUserStore((s) => s.setMbti);
  const setUserId = useUserStore((s) => s.setUserId);
  const setName = useUserStore((s) => s.setName);
  const setRelationshipStartDate = useCoupleStore((s) => s.setRelationshipStartDate);

  const [name, setLocalName] = useState('');
  const [relationshipStartDate, setLocalRelationshipStartDate] = useState('');
  const [mbtiSelection, setMbtiSelection] = useState<MbtiSelection>(EMPTY_MBTI_SELECTION);
  const [submitting, setSubmitting] = useState(false);

  const allAxesSelected = MBTI_AXES.every(({ key }) => mbtiSelection[key] !== null);

  function selectAxis(key: MbtiAxisKey, value: string) {
    setMbtiSelection((prev) => ({ ...prev, [key]: value }));
  }

  async function handleComplete() {
    if (!allAxesSelected || !name.trim() || submitting) return;

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (relationshipStartDate && !DATE_RE.test(relationshipStartDate)) {
      Alert.alert('날짜 형식 오류', 'YYYY-MM-DD 형식으로 입력해주세요.\n예: 2024-01-15');
      return;
    }

    setSubmitting(true);

    const mbti = MBTI_AXES.map(({ key }) => mbtiSelection[key]).join('');
    setMbti(mbti);
    setName(name.trim());
    setRelationshipStartDate(relationshipStartDate || null);

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // 게스트 모드로 진행 — userId는 null 유지
      console.warn('Supabase 세션 없음, 게스트 모드로 진행');
    } else {
      setUserId(data.user.id);
      await supabase.auth.updateUser({ data: { name: name.trim() } });
    }

    setSubmitting(false);

    if (from === 'settings') {
      router.back();
      return;
    }

    Alert.alert(
      '카카오 대화를 가져올까요?',
      '대화를 가져오면 트윈 AI가 내 말투를\n더 정확하게 배울 수 있어요.',
      [
        {
          text: '가져올게요',
          onPress: () => router.push('/(auth)/kakao-guide'),
        },
        {
          text: '건너뛸게요',
          style: 'cancel',
          onPress: () => router.push('/(auth)/genesis'),
        },
      ],
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>프로필 입력</Text>

      <TextInput
        style={styles.input}
        placeholder="닉네임"
        placeholderTextColor={theme.textMuted}
        value={name}
        onChangeText={setLocalName}
      />

      <TextInput
        style={styles.input}
        placeholder="연애 시작일 (YYYY-MM-DD)"
        placeholderTextColor={theme.textMuted}
        value={relationshipStartDate}
        onChangeText={setLocalRelationshipStartDate}
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.label}>MBTI</Text>
      {MBTI_AXES.map(({ key, options }) => (
        <View key={key} style={styles.axisRow}>
          {options.map((option) => {
            const selected = mbtiSelection[key] === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.axisBtn, selected ? styles.axisBtnSelected : styles.axisBtnUnselected]}
                onPress={() => selectAxis(key, option)}
              >
                <Text style={styles.axisBtnText}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      <TouchableOpacity
        style={[styles.nextBtn, (!allAxesSelected || !name.trim()) && styles.nextBtnDisabled]}
        onPress={handleComplete}
        disabled={!allAxesSelected || !name.trim() || submitting}
      >
        <Text style={styles.nextBtnText}>{submitting ? '처리 중...' : '다음'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    scrollContent: { padding: 32, justifyContent: 'center', flexGrow: 1, gap: 16 },
    title: { fontSize: 28, fontWeight: 'bold', color: BRAND.CORAL, marginBottom: 8 },
    input: { backgroundColor: theme.card, borderRadius: 12, padding: 16, color: theme.text, fontSize: 16 },
    label: { fontSize: 14, color: theme.text, marginTop: 8 },
    axisRow: { flexDirection: 'row', gap: 12 },
    axisBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    axisBtnSelected: { backgroundColor: BRAND.CORAL },
    axisBtnUnselected: { backgroundColor: theme.card },
    axisBtnText: { fontSize: 16, fontWeight: 'bold', color: theme.text },
    nextBtn: { backgroundColor: BRAND.CORAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
    nextBtnDisabled: { backgroundColor: theme.card },
    nextBtnText: { fontSize: 16, fontWeight: 'bold', color: theme.text },
  });
}
