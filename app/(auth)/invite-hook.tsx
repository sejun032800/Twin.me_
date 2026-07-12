// app/(auth)/invite-hook.tsx
// genesis.tsx의 handleStart() 완료 후 진입하는 "오라 공유 + 파트너 초대" 훅 화면.
// 항상-다크 고정.

import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, Alert, BackHandler } from 'react-native';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { useCoupleStore } from '@/store/coupleStore';
import { createCouple } from '@/services/coupleService';
import { auraChannelToCss } from '@/engine/auraEngine';
import type { AuraAxis } from '@/types/genesis';

export default function InviteHook() {
  const router = useRouter();
  const navigation = useNavigation();
  const personaMatrix = useUserStore((s) => s.personaMatrix);
  const name = useUserStore((s) => s.name);
  const userId = useUserStore((s) => s.userId);
  const inviteCode = useCoupleStore((s) => s.inviteCode);
  const setInviteCode = useCoupleStore((s) => s.setInviteCode);
  const setCoupleId = useCoupleStore((s) => s.setCoupleId);
  const [codeReady, setCodeReady] = useState(false);
  const [codeError, setCodeError] = useState(false);

  // 화면 진입 직후 파트너 초대 코드가 없으면 자동 생성 — 공유 메시지에 코드를 실을 수 있도록 선행한다.
  useEffect(() => {
    async function ensureInviteCode() {
      if (inviteCode) {
        setCodeReady(true);
        return;
      }
      if (!userId) return;

      try {
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newCoupleId = await createCouple(newCode, userId);
        setInviteCode(newCode);
        setCoupleId(newCoupleId);
        setCodeReady(true);
      } catch (e) {
        console.warn('[invite-hook] 코드 자동 생성 실패:', e);
        setCodeError(true);
        setCodeReady(true);
      }
    }

    ensureInviteCode();
  }, [inviteCode, userId]);

  // 뒤로가기(iOS 스와이프)로 이미 완료된 제네시스 인터뷰로 돌아가는 걸 막는다.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => subscription.remove();
    }, []),
  );

  // 아우라 대표 채널 추출 — auraChannelToCss()는 hsl() 문자열을 반환하므로
  // (헥스가 아님) 알파 tint는 hsla()로 직접 구성한다.
  const auraVector = personaMatrix?.auraVector ?? null;
  const dominantChannel = auraVector
    ? auraVector.channels[
        Object.entries(auraVector.axisScores).reduce((a, b) =>
          Math.abs(a[1]) > Math.abs(b[1]) ? a : b,
        )[0] as AuraAxis
      ]
    : null;

  const auraColor = dominantChannel ? auraChannelToCss(dominantChannel) : '#FFA4A4';

  function auraTint(alpha: number): string {
    return dominantChannel
      ? `hsla(${dominantChannel.hue}, ${dominantChannel.saturation}%, ${dominantChannel.lightness}%, ${alpha})`
      : `rgba(255, 164, 164, ${alpha})`;
  }

  async function handleShare() {
    const code = inviteCode ?? '설정에서 확인';

    try {
      await Share.share({
        message:
          `${name ?? '나'}의 트윈이 완성됐어 🧬\n` +
          `우리 연애 DNA 일치율 확인해볼래?\n\n` +
          `초대 코드: ${code}\n\n` +
          `Twin.me 설치 후 설정 → 커플 연동 → 코드 입력하면 돼 💌`,
        title: 'Twin.me 파트너 초대',
      });
    } catch {
      Alert.alert('공유에 실패했어요', '다시 시도해주세요.');
    }
  }

  function handleSkip() {
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      {/* 아우라 글로우 */}
      <View style={[styles.glowOuter, { backgroundColor: auraTint(0.094) }]}>
        <View style={[styles.glowInner, { backgroundColor: auraTint(0.145) }]}>
          <Text style={styles.mirrorEmoji}>🪞</Text>
        </View>
      </View>

      {/* 타이틀 */}
      <Text style={styles.title}>
        {name ?? '당신'}의{'\n'}
        <Text style={[styles.titleAccent, { color: auraColor }]}>트윈이 완성됐어요</Text>
      </Text>

      <Text style={styles.desc}>
        지금 연인에게 보여주면{'\n'}
        일치율을 함께 확인할 수 있어요
      </Text>

      {/* 공유 카드 미리보기 */}
      <View style={[styles.previewCard, { borderColor: auraTint(0.188) }]}>
        <View style={[styles.previewAura, { backgroundColor: auraTint(0.125) }]}>
          <Text style={styles.previewEmoji}>🧬</Text>
        </View>
        <View style={styles.previewText}>
          <Text style={styles.previewTitle}>
            {name ?? '나'}의 트윈 AI 완성
          </Text>
          <Text style={styles.previewSub}>
            연애 DNA 일치율을 함께 확인해요
          </Text>
          <TouchableOpacity
            style={[styles.previewBadge, { backgroundColor: auraTint(0.125) }]}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.7}
          >
            <Text style={[styles.previewBadgeText, { color: auraColor }]}>
              내 오라 색 보기 →
            </Text>
          </TouchableOpacity>
          {codeReady && inviteCode && (
            <View style={styles.codeRow}>
              <Text style={styles.codeLabel}>초대 코드</Text>
              <Text style={[styles.codeValue, { color: auraColor }]}>
                {inviteCode}
              </Text>
            </View>
          )}
          {codeReady && !inviteCode && codeError && (
            <Text style={styles.codeError}>
              코드 생성 실패 — 설정에서 다시 시도해주세요
            </Text>
          )}
          {!codeReady && (
            <Text style={styles.codeLoading}>초대 코드 준비 중...</Text>
          )}
        </View>
      </View>

      {/* 안내 텍스트 */}
      <Text style={styles.hint}>
        연인이 없어도 혼자서 모든 기능을 쓸 수 있어요
      </Text>

      {/* 버튼 */}
      <View style={styles.btnGroup}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleShare}>
          <Text style={styles.primaryBtnText}>💌 연인에게 보내기</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>나중에 할게요 — 앱 먼저 둘러볼게요</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0D1A',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  glowOuter: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mirrorEmoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#E8E4DC',
    textAlign: 'center',
    lineHeight: 38,
  },
  titleAccent: {
    fontWeight: '900',
  },
  desc: {
    fontSize: 15,
    color: '#5A6480',
    textAlign: 'center',
    lineHeight: 24,
  },
  previewCard: {
    width: '100%',
    backgroundColor: '#131726',
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  previewAura: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  previewEmoji: {
    fontSize: 26,
  },
  previewText: {
    flex: 1,
    gap: 4,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E8E4DC',
  },
  previewSub: {
    fontSize: 12,
    color: '#5A6480',
    lineHeight: 18,
  },
  previewBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  codeLabel: {
    fontSize: 11,
    color: '#5A6480',
  },
  codeValue: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
  },
  codeError: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 6,
  },
  codeLoading: {
    fontSize: 11,
    color: '#5A6480',
    marginTop: 6,
  },
  hint: {
    fontSize: 12,
    color: '#3A4055',
    textAlign: 'center',
  },
  btnGroup: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  primaryBtn: {
    backgroundColor: '#FFA4A4',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skipBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 13,
    color: '#3A4055',
    textAlign: 'center',
  },
});
