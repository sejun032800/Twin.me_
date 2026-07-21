// ─── FUN-CPL — 연인 초대 코드 입력 (MASTER.md §3 커플 연동) ───────────────────
// 설정 탭 "연인 코드 입력"에서 진입. couples 테이블에서 코드를 조회해 partner_id를
// 채워 넣는 joinCouple()을 호출한다.

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabaseClient';
import { joinCouple } from '@/services/coupleService';
import { useCoupleStore } from '@/store/coupleStore';
import { useUserStore } from '@/store/userStore';
import { useTheme } from '@/hooks/useTheme';
import { BRAND } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';

export default function Join() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const setCoupleId = useCoupleStore((s) => s.setCoupleId);
  const setPartnerConnected = useCoupleStore((s) => s.setPartnerConnected);

  const [inputCode, setInputCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleJoin() {
    if (inputCode.length !== 6 || submitting) return;
    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('로그인 필요', '코드를 입력하려면 로그인이 필요해요.');
        return;
      }

      const { coupleId } = await joinCouple(inputCode, user.id);
      setCoupleId(coupleId);
      setPartnerConnected(true);

      // 온보딩 인터뷰(제네시스) 미완료 상태로 코드부터 입력한 파트너는 (tabs)로 보내지
      // 않고 인터뷰로 유도한다 — (tabs)는 온보딩 완료 가드가 없어 그대로 두면 personaMatrix
      // 없는 상태로 홈/DNA 카드 등이 렌더링된다.
      const isOnboardingComplete = useUserStore.getState().isOnboardingComplete;
      const nextRoute = isOnboardingComplete ? '/(tabs)' : '/(auth)/genesis';

      Alert.alert('연동 완료 🎉', '연인과 연결됐어요!', [
        { text: '확인', onPress: () => router.replace(nextRoute) },
      ]);
    } catch (e) {
      Alert.alert('오류', e instanceof Error ? e.message : '연동에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { top: insets.top + 12 }]}>
          <Text style={styles.backText}>← 뒤로</Text>
        </TouchableOpacity>

        <Text style={styles.title}>연인 코드 입력</Text>
        <Text style={styles.subtitle}>연인이 공유한 6자리 코드를 입력하세요</Text>

        <TextInput
          style={styles.codeInput}
          placeholder="ABC123"
          placeholderTextColor={theme.textMuted}
          value={inputCode}
          onChangeText={(text) => setInputCode(text.toUpperCase().slice(0, 6))}
          maxLength={6}
          autoCapitalize="characters"
          textAlign="center"
        />

        <TouchableOpacity
          style={[styles.joinBtn, (inputCode.length !== 6 || submitting) && styles.joinBtnDisabled]}
          onPress={handleJoin}
          disabled={inputCode.length !== 6 || submitting}
        >
          <Text style={styles.joinBtnText}>{submitting ? '연동 중...' : '연동하기'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg, padding: 32, justifyContent: 'center', gap: 16 },
    backBtn: { position: 'absolute', left: 24 },
    backText: { fontSize: 15, color: theme.text },
    title: { fontSize: 28, fontWeight: 'bold', color: BRAND.CORAL, marginBottom: 4, textAlign: 'center' },
    subtitle: { fontSize: 14, color: theme.textMuted, textAlign: 'center', marginBottom: 16 },
    codeInput: {
      backgroundColor: theme.card,
      borderRadius: 16,
      paddingVertical: 20,
      color: theme.text,
      fontSize: 32,
      fontWeight: 'bold',
      letterSpacing: 8,
    },
    joinBtn: { backgroundColor: BRAND.CORAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    joinBtnDisabled: { backgroundColor: theme.card },
    joinBtnText: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },
  });
}
