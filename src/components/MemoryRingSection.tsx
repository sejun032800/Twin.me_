// ─── FUN-HOM — 메모리 링 섹션 (MASTER.md §3, 구버전 MemoryRingSection.tsx 이식) ───
// 홈 탭 하단에 카카오 인제스트 파이프라인(kakaoIngestPipeline.ts)이 추출·저장한
// 메모리 노드(추억 문장)들을 가로 스크롤 링 형태로 노출한다. 데이터는
// loadMemoryWallNodes()가 읽는 AsyncStorage 키('twin_me_memory_wall_nodes_v1')를
// 그대로 재사용한다 — 별도 키로 새로 저장하지 않는다.

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { loadMemoryWallNodes } from '@/services/kakaoIngestPipeline';
import type { MemoryNode } from '@/lib/kakaoParser';
import { useTheme } from '@/hooks/useTheme';
import { BRAND } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

function ringGlyph(node: MemoryNode): { icon: string; label: string } {
  const [first, ...rest] = node.tag.trim().split(' ');
  const label = rest.join(' ') || node.quote;
  return { icon: first || node.quote[0] || '💭', label: label.slice(0, 6) };
}

export default function MemoryRingSection() {
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
      <Text style={styles.title}>✨ 우리의 기억</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {nodes.length === 0 ? (
          <View style={styles.item}>
            <View style={styles.placeholderRing}>
              <Ionicons name="add" size={24} color={theme.textMuted} />
            </View>
            <Text style={styles.label}>카톡 업로드 시 채워져요</Text>
          </View>
        ) : (
          nodes.map((node) => {
            const { icon, label } = ringGlyph(node);
            return (
              <View key={node.id} style={styles.item}>
                <View style={styles.ring}>
                  <Text style={styles.ringIcon}>{icon}</Text>
                </View>
                <Text style={styles.label} numberOfLines={1}>{label}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    section: {
      gap: 12,
    },
    title: {
      ...TYPOGRAPHY.label,
      color: theme.textMuted,
    },
    scrollContent: {
      gap: 16,
      paddingRight: 8,
    },
    item: {
      alignItems: 'center',
      width: 72,
      gap: 6,
    },
    ring: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.accentSoft,
      borderWidth: 2,
      borderColor: BRAND.CORAL,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringIcon: {
      fontSize: 24,
    },
    placeholderRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 2,
      borderColor: theme.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      ...TYPOGRAPHY.caption,
      color: theme.textMuted,
      textAlign: 'center',
    },
  });
}
