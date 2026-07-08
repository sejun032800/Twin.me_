// ─── FUN-CPL — 연인 초대 코드 입력 (MASTER.md §3 커플 연동) ───────────────────
// 설정 탭 "연인 코드 입력"에서 진입. couples 테이블에서 코드를 조회해 partner_id를
// 채워 넣는 joinCouple()을 호출한다.

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabaseClient';
import { joinCouple } from '@/services/coupleService';
import { useCoupleStore } from '@/store/coupleStore';
import { BRAND, SYS } from '@/constants/colors';

export default function Join() {
  const router = useRouter();
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
      if (!user) return;

      const { coupleId } = await joinCouple(inputCode, user.id);
      setCoupleId(coupleId);
      setPartnerConnected(true);
      Alert.alert('연동 완료 🎉', '연인과 연결됐어요!', [
        { text: '확인', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e) {
      Alert.alert('오류', e instanceof Error ? e.message : '연동에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← 뒤로</Text>
      </TouchableOpacity>

      <Text style={styles.title}>연인 코드 입력</Text>
      <Text style={styles.subtitle}>연인이 공유한 6자리 코드를 입력하세요</Text>

      <TextInput
        style={styles.codeInput}
        placeholder="ABC123"
        placeholderTextColor="#555"
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT, padding: 32, justifyContent: 'center', gap: 16 },
  backBtn: { position: 'absolute', top: 60, left: 24 },
  backText: { fontSize: 15, color: SYS.TEXT_LIGHT },
  title: { fontSize: 28, fontWeight: 'bold', color: BRAND.CORAL, marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 14, color: SYS.TEXT_MUTED, textAlign: 'center', marginBottom: 16 },
  codeInput: {
    backgroundColor: SYS.CARD_DARK,
    borderRadius: 16,
    paddingVertical: 20,
    color: SYS.TEXT_LIGHT,
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  joinBtn: { backgroundColor: BRAND.CORAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  joinBtnDisabled: { backgroundColor: SYS.CARD_DARK },
  joinBtnText: { fontSize: 16, fontWeight: 'bold', color: SYS.TEXT_LIGHT },
});
