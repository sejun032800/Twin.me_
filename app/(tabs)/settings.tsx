// ─── FUN-SET — 설정 탭 (MASTER.md §8) ────────────────────────────────────────
// §8 FUN-SET-001(프라이버시), FUN-SET-001C(Founding VIP/커플 연동 전 단계),
// §1.3(오라 시스템 — 오라 끄기 토글) 기준. 오라 온/오프는 아직 sessionStore에
// reduceAuraMotion 필드가 없어 로컬 AsyncStorage('twin_aura_motion_v1')로 직접 관리한다.

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabaseClient';
import { useUserStore } from '@/store/userStore';
import { useCoupleStore } from '@/store/coupleStore';
import { useScoreStore } from '@/store/scoreStore';
import { BRAND, SYS } from '@/constants/colors';

const AURA_MOTION_KEY = 'twin_aura_motion_v1';

export default function Settings() {
  const router = useRouter();
  const name = useUserStore((s) => s.name);
  const mbti = useUserStore((s) => s.mbti);
  const resetUser = useUserStore((s) => s.reset);
  const inviteCode = useCoupleStore((s) => s.inviteCode);
  const isPartnerConnected = useCoupleStore((s) => s.isPartnerConnected);
  const resetCouple = useCoupleStore((s) => s.reset);
  const resetScore = useScoreStore((s) => s.reset);

  const [auraEnabled, setAuraEnabled] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(AURA_MOTION_KEY).then((raw) => {
      if (raw !== null) setAuraEnabled(JSON.parse(raw));
    });
  }, []);

  function toggleAura(value: boolean) {
    setAuraEnabled(value);
    AsyncStorage.setItem(AURA_MOTION_KEY, JSON.stringify(value));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    resetUser();
    resetCouple();
    resetScore();
    router.replace('/(auth)/welcome');
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        {/* 프로필 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>프로필</Text>
          <View style={[styles.row, styles.profileRow]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{name?.trim() ? name.trim()[0] : '?'}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{name ?? '이름 없음'}</Text>
              <Text style={styles.profileMbti}>{mbti ?? 'MBTI 미입력'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.row} onPress={() => { /* TODO: 프로필 수정 화면 구현 */ }}>
            <Text style={styles.rowText}>프로필 수정</Text>
          </TouchableOpacity>
        </View>

        {/* 계정 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>계정</Text>
          <TouchableOpacity style={styles.row} onPress={handleLogout}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </TouchableOpacity>
        </View>

        {/* 커플 연동 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>커플 연동</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>초대 코드</Text>
            <Text style={styles.rowValue}>{inviteCode ?? '미생성'}</Text>
          </View>
          <TouchableOpacity style={styles.row} onPress={() => { /* TODO: 초대 코드 생성 로직 구현 */ }}>
            <Text style={styles.rowText}>초대 코드 생성</Text>
          </TouchableOpacity>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>연동 상태</Text>
            <Text style={styles.rowValue}>{isPartnerConnected ? '연동됨' : '미연동'}</Text>
          </View>
        </View>

        {/* 오라 설정 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>오라 설정</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>오라 효과</Text>
            <Switch
              value={auraEnabled}
              onValueChange={toggleAura}
              trackColor={{ false: '#333', true: BRAND.CORAL }}
              thumbColor={SYS.TEXT_LIGHT}
            />
          </View>
        </View>

        {/* 앱 정보 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>앱 정보</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>버전</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>MASTER.md 버전</Text>
            <Text style={styles.rowValue}>v2.6</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT },
  container: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT, padding: 16 },

  section: { marginBottom: 24 },
  sectionHeader: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  row: {
    backgroundColor: SYS.CARD_DARK,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: { fontSize: 15, color: SYS.TEXT_LIGHT },
  rowLabel: { fontSize: 15, color: SYS.TEXT_LIGHT },
  rowValue: { fontSize: 15, color: '#888' },
  logoutText: { fontSize: 15, color: '#EF4444', fontWeight: 'bold' },

  profileRow: { gap: 16 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND.CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: 'bold', color: SYS.TEXT_LIGHT },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 17, fontWeight: 'bold', color: SYS.TEXT_LIGHT },
  profileMbti: { fontSize: 14, color: '#888' },
});
