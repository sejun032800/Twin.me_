// ─── FUN-SET — 설정 탭 (MASTER.md §8) ────────────────────────────────────────
// §8 FUN-SET-001(프라이버시 슬라이더), FUN-SET-001B(오라 테마), FUN-SET-001C(Founding VIP,
// 커플 연동 전 단계) 기준. 오라 온/오프는 아직 sessionStore에 reduceAuraMotion 필드가
// 없어 로컬 AsyncStorage('twin_aura_motion_v1')로 직접 관리한다.
// 프라이버시 슬라이더의 실제 AI 학습 범위 연동, 계정 관리/지원 섹션의 실제 화면 이동은
// Phase 7 이후 구현 예정이라 현재는 TODO 스텁으로 남긴다.

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Switch, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabaseClient';
import { useUserStore } from '@/store/userStore';
import { useCoupleStore } from '@/store/coupleStore';
import { useScoreStore } from '@/store/scoreStore';
import { useSessionStore } from '@/store/sessionStore';
import { useTheme } from '@/hooks/useTheme';
import { BRAND, SYS } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

const AURA_MOTION_KEY = 'twin_aura_motion_v1';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const PRIVACY_LEVEL_TEXT = [
  '🛡️ 보호 — 최소한의 데이터만 학습해요',
  '⚡ 최적화 — 균형잡힌 학습으로 트윈을 개선해요',
  '💗 완전복제 — 모든 대화를 학습해 나를 완벽히 복제해요',
];

interface SettingsRowItem {
  key: string;
  icon?: string;
  label: string;
  sub?: string;
  onPress?: () => void;
  right?: ReactNode;
}

function RowGroup({ items }: { items: SettingsRowItem[] }) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.rowGroup}>
      {items.map((item, i) => (
        <View key={item.key}>
          {i > 0 && <View style={styles.divider} />}
          <TouchableOpacity
            style={styles.row}
            onPress={item.onPress}
            disabled={!item.onPress}
            activeOpacity={item.onPress ? 0.7 : 1}
          >
            <View style={styles.rowLeft}>
              {item.icon && <Text style={styles.rowIcon}>{item.icon}</Text>}
              <View>
                <Text style={styles.rowText}>{item.label}</Text>
                {item.sub && <Text style={styles.rowSub}>{item.sub}</Text>}
              </View>
            </View>
            {item.right ?? (item.onPress && <Ionicons name="chevron-forward" size={18} color="#555" />)}
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

export default function Settings() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const router = useRouter();
  const name = useUserStore((s) => s.name);
  const mbti = useUserStore((s) => s.mbti);
  const personaMatrix = useUserStore((s) => s.personaMatrix);
  const resetUser = useUserStore((s) => s.reset);
  const themeMode = useSessionStore((s) => s.themeMode);
  const setThemeMode = useSessionStore((s) => s.setThemeMode);
  const privacyLevel = useSessionStore((s) => s.privacyLevel);
  const setPrivacyLevel = useSessionStore((s) => s.setPrivacyLevel);
  const hasAuraVector = !!personaMatrix?.auraVector;
  const inviteCode = useCoupleStore((s) => s.inviteCode);
  const setInviteCode = useCoupleStore((s) => s.setInviteCode);
  const isPartnerConnected = useCoupleStore((s) => s.isPartnerConnected);
  const resetCouple = useCoupleStore((s) => s.reset);
  const resetScore = useScoreStore((s) => s.reset);
  const resetSession = useSessionStore((s) => s.reset);

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

  async function handleDeleteAccountConfirmed() {
    await supabase.auth.signOut();
    resetUser();
    resetCouple();
    resetScore();
    resetSession();
    router.replace('/(auth)/welcome');
  }

  function handleDeleteAccountFinalConfirm() {
    Alert.alert(
      '최종 확인',
      '연애 DNA 일치율 로그, 커스텀 데이트 지도 핀, 주간 연애 리포트 등 앱 내 모든 아카이브 데이터가 즉시 파기되며 복구가 불가능합니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '확인', style: 'destructive', onPress: handleDeleteAccountConfirmed },
      ],
    );
  }

  function handleDeleteAccount() {
    Alert.alert(
      '정말로 삭제하시겠어요?',
      '그동안의 기록이 전부 지워집니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '이어하기', style: 'destructive', onPress: handleDeleteAccountFinalConfirm },
      ],
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. 프로필 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>프로필</Text>
          <View style={styles.rowGroup}>
            <View style={[styles.row, styles.profileRow]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{name?.trim() ? name.trim()[0] : '?'}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{name ?? '이름 없음'}</Text>
                <Text style={styles.profileMbti}>{mbti ?? 'MBTI 미입력'}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => router.push('/(auth)/profile?from=settings')}>
              <Text style={styles.rowText}>프로필 수정</Text>
              <Ionicons name="chevron-forward" size={18} color="#555" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. 화면 테마 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>화면 테마</Text>
          <View style={styles.rowGroup}>
            <View style={styles.row}>
              <Text style={styles.rowText}>화면 테마 설정</Text>
              <Text style={styles.rowValue}>
                {themeMode === 'sigma' ? '✨ 6 Sigma' : themeMode === 'light' ? '☀️ 라이트' : '🌙 다크'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.themeBtnRow}>
              <TouchableOpacity
                style={[
                  styles.themeBtn,
                  themeMode === 'sigma' ? styles.themeBtnSelected : styles.themeBtnUnselected,
                  !hasAuraVector && styles.themeBtnDisabled,
                ]}
                onPress={() => { if (hasAuraVector) setThemeMode('sigma'); }}
                disabled={!hasAuraVector}
              >
                <Text style={styles.themeBtnText}>✨ 6 Sigma</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themeBtn, themeMode === 'light' ? styles.themeBtnSelected : styles.themeBtnUnselected]}
                onPress={() => setThemeMode('light')}
              >
                <Text style={styles.themeBtnText}>☀️ 라이트</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.themeBtn, themeMode === 'dark' ? styles.themeBtnSelected : styles.themeBtnUnselected]}
                onPress={() => setThemeMode('dark')}
              >
                <Text style={styles.themeBtnText}>🌙 다크</Text>
              </TouchableOpacity>
            </View>
            {!hasAuraVector && (
              <Text style={styles.themeHint}>제네시스 인터뷰 완료 후 활성화돼요</Text>
            )}
          </View>
        </View>

        {/* 3. 테마 샵 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>테마 샵</Text>
          <TouchableOpacity
            style={styles.themeShopCard}
            onPress={() => Alert.alert('준비 중', '테마 샵은 곧 오픈돼요 🎨')}
          >
            <Text style={styles.themeShopIcon}>🎨</Text>
            <View style={styles.themeShopInfo}>
              <Text style={styles.themeShopTitle}>나만의 테마 꾸미기</Text>
              <Text style={styles.themeShopSub}>스킨 · 배경 · 폰트 3종 테마 상점 →</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#555" />
          </TouchableOpacity>
        </View>

        {/* 4. 프라이버시 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>프라이버시</Text>
          <View style={styles.rowGroup}>
            <View style={styles.privacyCard}>
              <View style={styles.row}>
                <Text style={styles.rowText}>프라이버시 컨트롤 센터</Text>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>Lv 3</Text>
                </View>
              </View>
              <Text style={styles.privacyDesc}>AI 학습 데이터 수집 범위를 직접 제어하세요.</Text>

              <Slider
                minimumValue={0}
                maximumValue={2}
                step={1}
                value={privacyLevel}
                onValueChange={(v) => setPrivacyLevel(Math.round(v) as 0 | 1 | 2)}
                minimumTrackTintColor={BRAND.CORAL}
                maximumTrackTintColor="#0F1626"
                thumbTintColor={BRAND.CORAL}
                style={styles.slider}
              />
              <Text style={styles.privacyLevelText}>
                {PRIVACY_LEVEL_TEXT[privacyLevel]}
              </Text>
            </View>
          </View>
        </View>

        {/* 5. 계정 관리 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>계정 관리</Text>
          <RowGroup
            items={[
              { key: 'personal', icon: '👤', label: '개인정보', sub: '이름 · 이메일', onPress: () => { /* TODO */ } },
              { key: 'security', icon: '🔒', label: '비밀번호 및 보안', sub: '비밀번호 변경 · 2단계 인증', onPress: () => { /* TODO */ } },
              { key: 'data', icon: '📋', label: '내 정보 및 권한', sub: '데이터 다운로드 · 앱 권한', onPress: () => { /* TODO */ } },
              { key: 'social', icon: '🔗', label: '소셜 계정 연동', sub: 'Google · Kakao · Naver · Apple', onPress: () => { /* TODO */ } },
            ]}
          />
        </View>

        {/* 6. 커플 연동 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>커플 연동</Text>
          <View style={styles.rowGroup}>
            <View style={styles.row}>
              <Text style={styles.rowText}>초대 코드</Text>
              <Text style={styles.rowValue}>{inviteCode ?? '미생성'}</Text>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                const code = generateInviteCode();
                setInviteCode(code);
                Alert.alert('초대 코드 생성됨', `코드: ${code}\n연인에게 공유하세요 💌`);
              }}
            >
              <Text style={styles.rowText}>초대 코드 생성</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowText}>연동 상태</Text>
              <Text style={styles.rowValue}>{isPartnerConnected ? '연동됨' : '미연동'}</Text>
            </View>
          </View>
        </View>

        {/* 7. 오라 설정 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>오라 설정</Text>
          <View style={styles.rowGroup}>
            <View style={styles.row}>
              <Text style={styles.rowText}>오라 효과</Text>
              <Switch
                value={auraEnabled}
                onValueChange={toggleAura}
                trackColor={{ false: '#333', true: BRAND.CORAL }}
                thumbColor={SYS.TEXT_LIGHT}
              />
            </View>
          </View>
        </View>

        {/* 8. 지원 및 법률 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>지원 및 법률</Text>
          <RowGroup
            items={[
              {
                key: 'help',
                icon: '❓',
                label: '도움말 센터',
                onPress: () => {
                  // TODO: 실제 URL로 교체 필요
                  Linking.openURL('https://twin.me/help');
                },
              },
              {
                key: 'privacy-policy',
                icon: '📄',
                label: '개인정보 처리방침',
                onPress: () => {
                  // TODO: 실제 URL로 교체 필요
                  Linking.openURL('https://twin.me/privacy');
                },
              },
              {
                key: 'terms',
                icon: '📋',
                label: '서비스 이용약관',
                onPress: () => {
                  // TODO: 실제 URL로 교체 필요
                  Linking.openURL('https://twin.me/terms');
                },
              },
            ]}
          />
        </View>

        {/* 9. 앱 정보 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>앱 정보</Text>
          <RowGroup
            items={[
              { key: 'version', label: '버전', right: <Text style={styles.rowValue}>1.0.0</Text> },
              { key: 'master-version', label: 'MASTER.md 버전', right: <Text style={styles.rowValue}>v2.6</Text> },
            ]}
          />
        </View>

        {/* 10. 계정 섹션 (하단) */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>계정</Text>
          <View style={styles.rowGroup}>
            <TouchableOpacity style={styles.row} onPress={handleLogout}>
              <Text style={styles.logoutText}>로그아웃</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={handleDeleteAccount}>
              <Text style={styles.logoutText}>계정 삭제</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.bg },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 48,
  },

  section: { marginBottom: 28 },
  sectionHeader: {
    fontSize: 12,
    color: '#555',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 8,
  },

  rowGroup: {
    backgroundColor: theme.card,
    borderRadius: 14,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: theme.border },
  row: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { fontSize: 18 },
  rowText: { fontSize: 15, color: theme.text },
  rowSub: { fontSize: 12, color: '#666', marginTop: 2 },
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
  profileName: { fontSize: 17, fontWeight: 'bold', color: theme.text },
  profileMbti: { fontSize: 14, color: '#888' },

  themeBtnRow: { flexDirection: 'row', gap: 12, padding: 16 },
  themeBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  themeBtnSelected: { backgroundColor: BRAND.CORAL },
  themeBtnUnselected: { backgroundColor: '#0F1626' },
  themeBtnDisabled: { opacity: 0.4 },
  themeBtnText: { fontSize: 14, fontWeight: 'bold', color: SYS.TEXT_LIGHT },
  themeHint: {
    ...TYPOGRAPHY.caption,
    color: theme.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  themeShopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 20,
  },
  themeShopIcon: { fontSize: 28 },
  themeShopInfo: { flex: 1, gap: 2 },
  themeShopTitle: { ...TYPOGRAPHY.bodyMedium, color: theme.text },
  themeShopSub: { ...TYPOGRAPHY.caption, color: theme.textMuted },

  privacyCard: { padding: 16, gap: 8 },
  levelBadge: { backgroundColor: BRAND.MINT, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  levelBadgeText: { fontSize: 12, fontWeight: 'bold', color: SYS.TEXT_DARK },
  privacyDesc: { fontSize: 13, color: '#888', lineHeight: 18 },
  slider: { width: '100%', height: 32, marginTop: 4 },
  privacyLevelText: { fontSize: 14, fontWeight: 'bold', color: SYS.TEXT_LIGHT, textAlign: 'center' },
  });
}
