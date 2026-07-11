// ─── FUN-ONB-003 — D0 표층 즉시 분석 결과 화면 (MASTER.md §2) ───────────────────
// 카카오톡 업로드 직후 LLM 없이 순수 로컬 처리로 보여주는 "아하 모먼트" 화면.
// 항상-다크 고정 — auth 화면군과 동일하게 브랜드 일관성을 위해 useTheme() 미적용.

import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { D0Analysis } from '@/lib/kakaoParser';
import { BRAND, SYS } from '@/constants/colors';
import { FONTS } from '@/constants/typography';

interface Props {
  analysis: D0Analysis;
  onContinue: () => void;
}

const LAUGH_COPY: Record<D0Analysis['laughPattern'], { value: string; desc: string }> = {
  'ㅋㅋ': { value: "'ㅋㅋ' 스타일", desc: '시원시원하고 활기찬 사람으로 보여요' },
  'ㅎㅎ': { value: "'ㅎㅎ' 스타일", desc: '부드럽고 따뜻한 사람으로 보여요' },
  mixed: { value: "'ㅋㅋ'+'ㅎㅎ' 혼합", desc: '상황에 따라 유연하게 반응해요' },
  none: { value: '이모지 선호', desc: '텍스트보다 이모지로 감정을 표현해요' },
};

function messageLengthDesc(avg: number): string {
  if (avg < 10) return '짧고 임팩트 있게 소통하는 스타일이에요';
  if (avg < 30) return '간결하면서도 내용 있는 소통을 해요';
  if (avg < 60) return '충분히 생각을 담아 전달하는 스타일이에요';
  return '상세하고 풍부하게 감정을 전달해요';
}

export default function D0ResultScreen({ analysis, onContinue }: Props) {
  const {
    avgReplySpeedSec,
    replySpeedPercentile,
    laughPattern,
    avgMessageLength,
    dominantEnding,
    totalMessages,
  } = analysis;

  const replySpeedValue = avgReplySpeedSec < 60
    ? `${avgReplySpeedSec}초`
    : `${Math.round(avgReplySpeedSec / 60)}분`;
  const replySpeedColor = replySpeedPercentile <= 15 ? BRAND.MINT : BRAND.CORAL;
  const laughCopy = LAUGH_COPY[laughPattern];

  const cards = [
    {
      icon: '⚡',
      title: '평균 답장 속도',
      value: replySpeedValue,
      valueColor: replySpeedColor,
      desc: `전국 상위 ${replySpeedPercentile}% 빠른 응답 속도예요`,
    },
    {
      icon: '😄',
      title: '웃음 표현 스타일',
      value: laughCopy.value,
      valueColor: BRAND.CORAL,
      desc: laughCopy.desc,
    },
    {
      icon: '💬',
      title: '평균 메시지 길이',
      value: `${Math.round(avgMessageLength)}자`,
      valueColor: BRAND.CORAL,
      desc: messageLengthDesc(avgMessageLength),
    },
    {
      icon: '✍️',
      title: '시그니처 말버릇',
      value: `'${dominantEnding}'`,
      valueColor: BRAND.CORAL,
      desc: '가장 자주 쓰는 마무리 표현이에요',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 나의 대화 DNA 분석</Text>
        <Text style={styles.subtitle}>카카오톡 {totalMessages}개 메시지 분석 완료</Text>
      </View>

      <ScrollView contentContainerStyle={styles.cardList} showsVerticalScrollIndicator={false}>
        {cards.map((card, index) => (
          <Animated.View key={card.title} entering={FadeIn.delay(index * 150)} style={styles.card}>
            <Text style={styles.cardIcon}>{card.icon}</Text>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={[styles.cardValue, { color: card.valueColor }]}>{card.value}</Text>
            <Text style={styles.cardDesc}>{card.desc}</Text>
          </Animated.View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.divider} />
        <Text style={styles.privacyText}>
          이 분석은 기기 안에서만 처리됐어요. 원본 대화는 즉시 파기됩니다.
        </Text>
        <TouchableOpacity style={styles.continueBtn} onPress={onContinue}>
          <Text style={styles.continueBtnText}>다음으로 →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT, padding: 24 },
  header: { marginTop: 16, marginBottom: 20, gap: 6 },
  title: { fontFamily: FONTS.serifBold, fontSize: 22, color: BRAND.CORAL },
  subtitle: { fontSize: 14, color: SYS.TEXT_MUTED },
  cardList: { gap: 14, paddingBottom: 16 },
  card: {
    backgroundColor: SYS.CARD_DARK,
    borderRadius: 16,
    padding: 20,
    gap: 6,
  },
  cardIcon: { fontSize: 22 },
  cardTitle: { fontSize: 14, color: SYS.TEXT_MUTED },
  cardValue: { fontSize: 26, fontWeight: 'bold' },
  cardDesc: { fontSize: 14, color: SYS.TEXT_LIGHT, lineHeight: 20 },
  footer: { gap: 14, paddingTop: 8, paddingBottom: 8 },
  divider: { height: 1, backgroundColor: SYS.CARD_DARK },
  privacyText: { fontSize: 11, color: SYS.TEXT_MUTED, textAlign: 'center' },
  continueBtn: {
    backgroundColor: BRAND.CORAL,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnText: { fontSize: 16, fontWeight: 'bold', color: SYS.TEXT_LIGHT },
});
