// ─── FUN-HIS — 히스토리 탭 3서브탭 구조 (MASTER.md §7) ────────────────────────
// archive(추억 월) / helix(DNA 나선) / feed(무드 피드) 3탭 최종 확정 구조(§7.1).
// helix는 스펙상 3D 나선형 데이트 타임라인이지만, MVP는 지시대로 scoreHistory
// 월별/일별 점수 리스트로 대체한다 — 3D 렌더러는 이후 단계에서 교체.

import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useScoreStore } from '@/store/scoreStore';
import { BRAND, SYS } from '@/constants/colors';

type SubTab = 'archive' | 'helix' | 'feed';

const SUB_TABS: Array<{ key: SubTab; label: string }> = [
  { key: 'archive', label: '아카이브' },
  { key: 'helix', label: '나선' },
  { key: 'feed', label: '피드' },
];

function barColor(score: number): string {
  if (score >= 70) return BRAND.MINT;
  if (score >= 40) return BRAND.CORAL;
  return BRAND.PINK;
}

export default function History() {
  const [subTab, setSubTab] = useState<SubTab>('archive');
  const scoreHistory = useScoreStore((s) => s.scoreHistory);

  const sortedHistory = [...scoreHistory].sort((a, b) => a.date.localeCompare(b.date));

  function renderArchive() {
    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        bounces={true}
        alwaysBounceVertical={true}
      >
        {/* TODO: kakaoParser의 MemoryNode 데이터 연결 예정 — 폴라로이드 추억 카드로 교체 */}
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            아직 추억이 없어요{'\n'}카톡 대화를 업로드하면 채워져요 💌
          </Text>
        </View>
      </ScrollView>
    );
  }

  function renderHelix() {
    if (sortedHistory.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={styles.tabContent}
          bounces={true}
          alwaysBounceVertical={true}
        >
          <View style={styles.card}>
            <Text style={styles.emptyText}>아직 기록이 없어요</Text>
          </View>
        </ScrollView>
      );
    }
    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        bounces={true}
        alwaysBounceVertical={true}
      >
        {sortedHistory.map((entry) => (
          <View key={entry.date} style={styles.historyRow}>
            <Text style={styles.historyDate}>{entry.date}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${Math.max(0, Math.min(100, entry.score))}%`, backgroundColor: barColor(entry.score) },
                ]}
              />
            </View>
            <Text style={styles.historyScore}>{entry.score.toFixed(1)}</Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  function renderFeed() {
    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        bounces={true}
        alwaysBounceVertical={true}
      >
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            주간 리포트가 여기 쌓여요{'\n'}매주 월요일에 업데이트돼요 📊
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.tabBar}>
          {SUB_TABS.map(({ key, label }) => {
            const selected = subTab === key;
            return (
              <TouchableOpacity key={key} style={styles.tabItem} onPress={() => setSubTab(key)}>
                <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{label}</Text>
                {selected && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {subTab === 'archive' && renderArchive()}
        {subTab === 'helix' && renderHelix()}
        {subTab === 'feed' && renderFeed()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT },
  container: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: SYS.CARD_DARK,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  tabLabel: { fontSize: 15, color: '#888' },
  tabLabelActive: { color: BRAND.CORAL, fontWeight: 'bold' },
  tabUnderline: {
    marginTop: 8,
    height: 2,
    width: 24,
    backgroundColor: BRAND.CORAL,
    borderRadius: 1,
  },

  tabContent: { padding: 16, gap: 12 },
  card: {
    backgroundColor: SYS.CARD_DARK,
    borderRadius: 16,
    padding: 20,
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyDate: {
    fontSize: 13,
    color: SYS.TEXT_LIGHT,
    width: 84,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: SYS.CARD_DARK,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  historyScore: {
    fontSize: 13,
    color: SYS.TEXT_LIGHT,
    width: 44,
    textAlign: 'right',
  },
});
