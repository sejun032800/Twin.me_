// ─── FUN-HIS — 하이라이트 갤러리 (MASTER.md §7, 구버전 kakaoHighlightService.ts 이식) ─
// 카카오 인제스트 파이프라인(kakaoIngestPipeline.ts)이 추출·저장한 메모리 노드를
// 히스토리 아카이브 탭에 가로 스크롤 하이라이트 카드로 노출한다. 데이터는
// loadMemoryWallNodes()가 읽는 AsyncStorage 키를 그대로 재사용한다.

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { loadMemoryWallNodes } from '@/services/kakaoIngestPipeline';
import type { MemoryNode } from '@/lib/kakaoParser';
import { useTheme } from '@/hooks/useTheme';
import { BRAND } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

export default function HighlightGallery() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [nodes, setNodes] = useState<MemoryNode[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadMemoryWallNodes().then((loaded) => {
      if (!cancelled) setNodes(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>💬 카카오 하이라이트</Text>

      {nodes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>카카오톡을 업로드하면 다정한 말들이 여기 모여요 💌</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {nodes.map((node) => (
            <View key={node.id} style={styles.card}>
              <Text style={styles.cardDate}>{node.date}</Text>
              <Text style={styles.cardQuote} numberOfLines={3}>{node.quote}</Text>
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>{node.tag}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    section: {
      gap: 12,
      paddingHorizontal: 20,
      marginBottom: 8,
    },
    title: {
      ...TYPOGRAPHY.label,
      color: theme.textMuted,
    },
    scrollContent: {
      gap: 12,
      paddingRight: 8,
    },
    card: {
      width: 200,
      height: 120,
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 14,
      justifyContent: 'space-between',
    },
    cardDate: {
      ...TYPOGRAPHY.caption,
      color: theme.textMuted,
    },
    cardQuote: {
      ...TYPOGRAPHY.body,
      color: theme.text,
    },
    tagBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.accentSoft,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    tagBadgeText: {
      ...TYPOGRAPHY.caption,
      color: BRAND.CORAL,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      backgroundColor: theme.card,
      borderRadius: 16,
    },
    emptyText: {
      ...TYPOGRAPHY.caption,
      color: theme.textMuted,
      textAlign: 'center',
    },
  });
}
