// app/(auth)/kakao-guide.tsx
// 카카오톡 대화 내보내기 방법을 안내하는 4단계 가이드 화면.
// kakao-upload.tsx 진입 전에 거치며, auth 화면군과 동일하게 항상-다크 고정.

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

const STEPS = [
  {
    step: '1',
    emoji: '💬',
    title: '카카오톡 앱 열기',
    desc: '연인과의 채팅방으로 들어가세요',
    sub: '어떤 채팅방이든 괜찮아요',
  },
  {
    step: '2',
    emoji: '⚙️',
    title: '우측 상단 메뉴 탭',
    desc: '채팅방 안에서 오른쪽 위 ≡ 아이콘을 눌러요',
    sub: '설정 → 대화 내용 → 대화 내보내기',
  },
  {
    step: '3',
    emoji: '📁',
    title: '"파일로 저장" 선택',
    desc: '.zip 또는 .txt 파일로 저장돼요',
    sub: 'zip이면 더 좋지만 txt도 가능해요',
  },
  {
    step: '4',
    emoji: '📤',
    title: '파일을 Twin.me로 가져오기',
    desc: '"파일 앱"이나 "내 파일"에서 저장된 파일을 찾아요',
    sub: '다음 화면에서 파일을 선택하면 끝이에요',
  },
];

export default function KakaoGuide() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const isLast = currentStep === STEPS.length - 1;
  const step = STEPS[currentStep];

  function handleNext() {
    if (isLast) {
      router.push('/(auth)/kakao-upload');
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }

  return (
    <View style={styles.container}>
      {/* 프로그레스 바 */}
      <View style={styles.progressTrack}>
        <View style={[
          styles.progressFill,
          { width: `${((currentStep + 1) / STEPS.length) * 100}%` }
        ]} />
      </View>

      {/* 스텝 인디케이터 */}
      <View style={styles.stepIndicator}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.stepDot,
              i === currentStep && styles.stepDotActive,
              i < currentStep && styles.stepDotDone,
            ]}
          />
        ))}
      </View>

      {/* 메인 콘텐츠 */}
      <View style={styles.content}>
        <View style={styles.emojiCard}>
          <Text style={styles.emoji}>{step.emoji}</Text>
        </View>

        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>STEP {step.step} / {STEPS.length}</Text>
        </View>

        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.desc}>{step.desc}</Text>
        <Text style={styles.sub}>{step.sub}</Text>
      </View>

      {/* 하단 버튼 */}
      <View style={styles.bottom}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleNext}>
          <Text style={styles.primaryBtnText}>
            {isLast ? '파일 선택하러 가기 →' : '다음'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => router.push('/(auth)/genesis')}
        >
          <Text style={styles.skipText}>카카오 없이 시작할게요</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0D1A',
    padding: 28,
    paddingTop: 20,
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 2,
    backgroundColor: '#131726',
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: 24,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFA4A4',
    borderRadius: 1,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1C2235',
  },
  stepDotActive: {
    backgroundColor: '#FFA4A4',
    width: 20,
  },
  stepDotDone: {
    backgroundColor: '#BADFDB',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emojiCard: {
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: '#131726',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emoji: {
    fontSize: 56,
  },
  stepBadge: {
    backgroundColor: 'rgba(255,164,164,0.12)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  stepBadgeText: {
    fontSize: 11,
    color: '#FFA4A4',
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#E8E4DC',
    textAlign: 'center',
    lineHeight: 34,
  },
  desc: {
    fontSize: 15,
    color: '#A0AABF',
    textAlign: 'center',
    lineHeight: 24,
  },
  sub: {
    fontSize: 12,
    color: '#3A4055',
    textAlign: 'center',
    lineHeight: 18,
  },
  bottom: {
    gap: 12,
    paddingTop: 24,
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
  },
});
