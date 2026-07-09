// ─── FUN-HIS — 스토리 뷰어 (MASTER.md §7, 구버전 StoryViewer.tsx 이식) ────────────
// OOTD 사진들을 인스타그램 스토리 형식의 전체화면 슬라이드로 노출한다.
// 좌측 1/3 탭 = 이전, 우측 2/3 탭 = 다음, 마지막에서 다음 탭 시 종료, 5초 자동 진행.

import { useEffect, useState } from 'react';
import { Modal, View, Text, Image, Pressable, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { OOTDEntry } from '@/types/ootd';
import { BRAND } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/typography';

const AUTO_ADVANCE_MS = 5000;
const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {
  visible: boolean;
  entries: OOTDEntry[];
  initialIndex?: number;
  onClose: () => void;
}

export default function StoryViewer({ visible, entries, initialIndex = 0, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) setCurrentIndex(initialIndex);
  }, [visible, initialIndex]);

  function goNext() {
    setCurrentIndex((i) => {
      if (i >= entries.length - 1) {
        onClose();
        return i;
      }
      return i + 1;
    });
  }

  function goPrev() {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }

  // 탭으로 인덱스가 바뀔 때마다 이 effect가 재생성되어 자동 진행 타이머가 리셋된다.
  useEffect(() => {
    if (!visible || entries.length === 0) return;
    const id = setInterval(goNext, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, currentIndex, entries.length]);

  if (!visible || entries.length === 0) return null;
  const current = entries[currentIndex] ?? entries[0];

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.container}>
        <Image source={{ uri: current.imageUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />

        <View style={styles.tapZoneRow} pointerEvents="box-none">
          <Pressable style={styles.tapLeft} onPress={goPrev} />
          <Pressable style={styles.tapRight} onPress={goNext} />
        </View>

        <SafeAreaView edges={['top']} style={styles.topOverlay} pointerEvents="box-none">
          <View style={styles.progressRow}>
            {entries.map((entry, i) => (
              <View
                key={entry.id}
                style={[styles.progressBar, i === currentIndex ? styles.progressBarActive : styles.progressBarInactive]}
              />
            ))}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </SafeAreaView>

        <View style={styles.bottomInfo} pointerEvents="none">
          <Text style={styles.date}>{current.date}</Text>
          {current.mood && (
            <View style={styles.moodBadge}>
              <Text style={styles.moodBadgeText}>{current.mood}</Text>
            </View>
          )}
          {current.note && <Text style={styles.note}>{current.note}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  tapZoneRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  tapLeft: {
    width: SCREEN_WIDTH / 3,
    height: '100%',
  },
  tapRight: {
    width: (SCREEN_WIDTH / 3) * 2,
    height: '100%',
  },
  topOverlay: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 12,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  progressBarActive: {
    backgroundColor: BRAND.CORAL,
  },
  progressBarInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  bottomInfo: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 40,
    gap: 8,
  },
  date: {
    ...TYPOGRAPHY.heading,
    color: '#FFFFFF',
  },
  moodBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  moodBadgeText: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
  },
  note: {
    ...TYPOGRAPHY.caption,
    color: 'rgba(255, 255, 255, 0.85)',
  },
});
