// ─── FUN-HOM — AI 코칭 카드 (MASTER.md §3, 구버전 AICoachingCard.tsx 이식) ────────
// 홈 탭 상단에 오늘의 관계 코칭 한 마디를 표시한다. Gemini가 현재 점수/티어/
// 변동성/위기메모리/무드태그를 바탕으로 1문장 코칭 메시지를 생성하며, 하루 한 번만
// 생성해 AsyncStorage(twin_coaching_cache_v1)에 날짜와 함께 캐시한다.

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useScoreStore } from '@/store/scoreStore';
import { useTheme } from '@/hooks/useTheme';
import { callLLM } from '@/api/llm';
import { getTierFromScore } from '@/engine/scoreCalculator';
import { SYS } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

const CACHE_KEY = 'twin_coaching_cache_v1';
const FALLBACK_MESSAGE = '오늘도 서로를 아껴주세요 💙';

interface CoachingCache {
  date: string; // YYYY-MM-DD
  message: string;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AICoachingCard() {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const sLive = useScoreStore((s) => s.sLive);
  const sCurrent = useScoreStore((s) => s.sCurrent);
  const sBase = useScoreStore((s) => s.sBase);
  const volatilityIndex = useScoreStore((s) => s.volatilityIndex);
  const crisisMemoryActive = useScoreStore((s) => s.crisisMemoryActive);

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCoachingMessage() {
      const today = todayDateString();

      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const cache = JSON.parse(raw) as CoachingCache;
          if (cache.date === today && cache.message) {
            if (!cancelled) {
              setMessage(cache.message);
              setLoading(false);
            }
            return;
          }
        }
      } catch {
        // 캐시 파싱 실패 시 무시하고 새로 생성
      }

      const displayScore = sLive > 0 ? sLive : (sCurrent > 0 ? sCurrent : sBase);
      const tierInfo = getTierFromScore(displayScore);
      const moodTags = displayScore >= 70
        ? ['💚 안정적', '☀️ 평온함', '💬 소통 중']
        : displayScore >= 40
        ? ['🌤️ 보통', '💭 생각 중', '⏳ 여유롭게']
        : ['🌧️ 주의 필요', '💔 회복 중', '🤔 돌아보기'];

      try {
        const response = await callLLM({
          systemPrompt:
            '당신은 연애 관계 코치입니다.\n현재 커플의 관계 데이터를 보고\n오늘 하루를 위한 따뜻한 코칭 한 마디를 해주세요.\n반드시 1문장으로, 구체적이고 실천 가능하게.',
          userMessage: JSON.stringify({
            score: displayScore,
            tier: tierInfo.title,
            volatilityIndex,
            crisisMemoryActive,
            moodTags,
          }),
          maxTokens: 100,
        });

        const coachingMessage = response.content.trim() || FALLBACK_MESSAGE;
        if (!cancelled) setMessage(coachingMessage);

        await AsyncStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ date: today, message: coachingMessage } satisfies CoachingCache),
        );
      } catch (e) {
        console.error('AI 코칭 메시지 생성 실패:', e);
        if (!cancelled) setMessage(FALLBACK_MESSAGE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCoachingMessage();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>AI 코치</Text>
      </View>
      <Text style={styles.icon}>✨</Text>
      {loading ? (
        <ActivityIndicator color={theme.text} />
      ) : (
        <Text style={styles.message}>{message}</Text>
      )}
    </View>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      gap: 12,
      position: 'relative',
    },
    icon: {
      fontSize: 24,
    },
    message: {
      ...TYPOGRAPHY.body,
      color: theme.text,
      flex: 1,
    },
    badge: {
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: SYS.BADGE_AI,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeText: {
      ...TYPOGRAPHY.caption,
      color: SYS.TEXT_LIGHT,
    },
  });
}
