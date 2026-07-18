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
import { useSessionStore } from '@/store/sessionStore';
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
  const isSigma = useSessionStore((s) => s.themeMode) === 'sigma';
  const styles = makeStyles(theme, isSigma);
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

function makeStyles(theme: SigmaTheme, isSigma: boolean) {
  return StyleSheet.create({
    // 이 섹션은 애초에 자체 카드 배경(theme.card)이 없다 — 바깥 GlassPanel이 이미
    // 유일한 배경 레이어라 "카드 안에 카드" 문제 자체가 없다. 다만 title/label 텍스트는
    // theme.textMuted로 배경(GlassPanel의 블러+옅은 화이트 오버레이, 뒤에 오라가 비침) 위에
    // 직접 얹히므로, sigma에서는 GlassButton과 동일한 흰색+textShadow로 가독성을 보강한다.
    section: {
      gap: 12,
    },
    title: {
      ...TYPOGRAPHY.label,
      color: isSigma ? '#FFFFFF' : theme.textMuted,
      ...(isSigma ? {
        textShadowColor: 'rgba(0,0,0,0.45)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
      } : null),
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
      color: isSigma ? '#FFFFFF' : theme.textMuted,
      textAlign: 'center',
      ...(isSigma ? {
        textShadowColor: 'rgba(0,0,0,0.45)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
      } : null),
    },
  });
}
