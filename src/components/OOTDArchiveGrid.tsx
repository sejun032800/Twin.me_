// ─── FUN-HIS — OOTD 아카이브 그리드 (MASTER.md §7, 구버전 OOTDArchiveGrid.tsx 이식) ──
// 아카이브 탭에 3열 그리드로 OOTD 사진을 노출한다. 이미 스크롤 컨테이너(헬릭스
// Animated.ScrollView) 위쪽 비스크롤 영역에 배치되므로 내부 FlatList는
// scrollEnabled={false}로 두고 그리드 레이아웃 용도로만 사용한다.

import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet, Dimensions } from 'react-native';
import { loadOOTDEntries } from '@/services/ootdService';
import type { OOTDEntry } from '@/types/ootd';
import OOTDUploadSheet from '@/components/OOTDUploadSheet';
import StoryViewer from '@/components/StoryViewer';
import { useTheme } from '@/hooks/useTheme';
import { BRAND, SYS, MODAL_BACKDROP_LIGHT, MODAL_BACKDROP_HEAVY } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

const GRID_GAP = 4;
const ITEM_SIZE = Dimensions.get('window').width / 3 - GRID_GAP;

export default function OOTDArchiveGrid() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [entries, setEntries] = useState<OOTDEntry[]>([]);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [storyVisible, setStoryVisible] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);

  const refresh = useCallback(() => {
    loadOOTDEntries().then(setEntries);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleSaved(entry: OOTDEntry) {
    setEntries((prev) => [entry, ...prev]);
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>👗 우리의 OOTD</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setUploadVisible(true)}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={styles.emptyText}>첫 OOTD를 기록해보세요</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setUploadVisible(true)}>
            <Text style={styles.emptyBtnText}>사진 추가하기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          numColumns={3}
          scrollEnabled={false}
          initialNumToRender={50}
          windowSize={1}
          columnWrapperStyle={styles.row}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.gridItem}
              activeOpacity={0.85}
              onPress={() => {
                setStoryIndex(index);
                setStoryVisible(true);
              }}
            >
              <Image source={{ uri: item.imageUri }} style={styles.gridImage} />
              <Text style={styles.gridDate}>{item.date}</Text>
              {item.mood && (
                <View style={styles.moodBadge}>
                  <Text style={styles.moodBadgeText}>{item.mood}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <OOTDUploadSheet
        visible={uploadVisible}
        onClose={() => setUploadVisible(false)}
        onSaved={handleSaved}
      />

      <StoryViewer
        visible={storyVisible}
        entries={entries}
        initialIndex={storyIndex}
        onClose={() => setStoryVisible(false)}
      />
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      ...TYPOGRAPHY.label,
      color: theme.textMuted,
    },
    addBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnText: {
      ...TYPOGRAPHY.label,
      color: theme.text,
    },
    row: {
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    gridItem: {
      width: ITEM_SIZE,
      height: ITEM_SIZE,
      borderRadius: 8,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: theme.card,
    },
    gridImage: {
      width: '100%',
      height: '100%',
    },
    gridDate: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      ...TYPOGRAPHY.caption,
      color: SYS.TEXT_LIGHT,
      textShadowColor: MODAL_BACKDROP_HEAVY,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    moodBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: MODAL_BACKDROP_LIGHT,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    moodBadgeText: {
      ...TYPOGRAPHY.caption,
      color: SYS.TEXT_LIGHT,
      fontSize: 10,
    },
    emptyState: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 24,
      backgroundColor: theme.card,
      borderRadius: 16,
    },
    emptyIcon: {
      fontSize: 32,
    },
    emptyText: {
      ...TYPOGRAPHY.body,
      color: theme.textMuted,
    },
    emptyBtn: {
      backgroundColor: BRAND.CORAL,
      borderRadius: 14,
      paddingHorizontal: 20,
      paddingVertical: 10,
      marginTop: 4,
    },
    emptyBtnText: {
      ...TYPOGRAPHY.button,
      color: SYS.TEXT_LIGHT,
    },
  });
}
