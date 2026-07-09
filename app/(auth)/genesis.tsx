// ─── FUN-HOM-001 Override — 트윈 제네시스 인터뷰 (MASTER.md §2, 부록G) ──────────
// useGenesisInterview 상태 머신을 phase별로 렌더링만 담당한다.
// phase: idle → asking/act-transition → confirming → ceremony → done.

import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useGenesisInterview } from '@/hooks/useGenesisInterview';
import InterviewCallModal from '@/components/InterviewCallModal';
import { useUserStore } from '@/store/userStore';
import { useScoreStore } from '@/store/scoreStore';
import { buildAuraVector, auraChannelToCss } from '@/engine/auraEngine';
import { ENNEAGRAM_TYPE_NAME, type AuraAxis, type ClayStage } from '@/types/genesis';
import { BRAND, SYS } from '@/constants/colors';

const CLAY_EMOJI: Record<ClayStage, string> = { 0: '🌫️', 1: '🍪', 2: '✨', 3: '🪞' };
const ACT_LABEL: Record<number, string> = { 1: '1막', 2: '2막', 3: '3막', 4: '4막' };

// MASTER §3 — 베이지안 confidence가 오를수록 점토가 또렷해진다.
function getClayStage(confidence: number): ClayStage {
  if (confidence >= 0.85) return 3;
  if (confidence >= 0.65) return 2;
  if (confidence >= 0.35) return 1;
  return 0;
}

// MASTER §1.3 6축 한국어 라벨
const AXIS_LABEL_KO: Record<string, string> = {
  attachmentSecurity: '애착 안정성',
  conflictResponse: '갈등 반응',
  expressiveness: '감정 표현성',
  independence: '자율성',
  spontaneity: '즉흥성',
  trustPace: '신뢰 속도',
};

export default function Genesis() {
  const router = useRouter();
  const mbti = useUserStore((s) => s.mbti);
  const enneagramType = useUserStore((s) => s.enneagramType);
  const setPersonaMatrix = useUserStore((s) => s.setPersonaMatrix);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const setSBase = useScoreStore((s) => s.setSBase);
  const setSCurrent = useScoreStore((s) => s.setSCurrent);

  const {
    act,
    phase,
    inputMode,
    currentQuestion,
    pendingConfirm,
    bayesianState,
    progress,
    start,
    submitTranscript,
    confirmArchetype,
    switchToTyping,
    switchToVoice,
    finalizePersonaMatrix,
  } = useGenesisInterview(mbti ?? '');

  const [inputText, setInputText] = useState('');

  const dynamicClayStage = getClayStage(bayesianState.confidence);

  const auraVector = useMemo(
    () => buildAuraVector(bayesianState.probabilities),
    [bayesianState.probabilities],
  );
  const dominantAxis = Object.entries(auraVector.axisScores).reduce((a, b) =>
    Math.abs(a[1]) > Math.abs(b[1]) ? a : b,
  )[0] as AuraAxis;
  const dominantColor = auraChannelToCss(auraVector.channels[dominantAxis]);

  useEffect(() => {
    if (phase === 'done') {
      router.replace('/(tabs)');
    }
  }, [phase, router]);

  function handleSubmit() {
    if (!inputText.trim()) return;
    submitTranscript(inputText.trim());
    setInputText('');
  }

  function handleStart() {
    const matrix = finalizePersonaMatrix();
    setPersonaMatrix(matrix);
    // TODO: Phase 5에서 커플 연동 후 getMBTICompatibilityGrade()로 실제 상성 계산
    // 지금은 에니어그램 유형별 기본 점수로 초기화
    const BASE_SCORE_BY_TYPE: Record<string, number> = {
      '1': 68, '2': 72, '3': 70, '4': 65, '5': 63,
      '6': 67, '7': 74, '8': 69, '9': 71,
    };
    const baseScore = enneagramType ? (BASE_SCORE_BY_TYPE[enneagramType] ?? 65) : 65;
    setSBase(baseScore);
    // 앱 첫 실행 시 S_Current를 S_Base로 초기화 — 이후로는 settleMidnight()만이 갱신한다(§5.1).
    setSCurrent(baseScore);
    completeOnboarding();
    router.replace('/(tabs)');
  }

  if (phase === 'idle') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.idleDesc}>나를 닮은 AI를 만들기 위해{'\n'}10분 정도 대화해요</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={start}>
          <Text style={styles.primaryBtnText}>트윈 인터뷰 시작</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (phase === 'asking' || phase === 'act-transition') {
    return (
      <>
        {/* G.4 입력 모드 — 음성 우선: 전화 수신 풀스크린 UI (실제 STT는 TODO, 타이핑으로 대체) */}
        <InterviewCallModal
          visible={inputMode === 'voice'}
          onClose={switchToTyping}
          question={currentQuestion?.prompt ?? ''}
          onSubmit={(text) => {
            setInputText(text);
            submitTranscript(text);
          }}
          confidence={bayesianState.confidence}
          act={act}
        />

        {/* G.4 무음 폴백 — 텍스트 입력 UI */}
        {inputMode === 'typing' && (
          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>

            <Text style={styles.clayEmoji}>{CLAY_EMOJI[dynamicClayStage]}</Text>
            <Text style={styles.actLabel}>{ACT_LABEL[act]}</Text>

            <Text style={styles.questionText}>{currentQuestion?.prompt ?? ''}</Text>

            <TextInput
              style={styles.input}
              placeholder="답변을 입력하세요"
              placeholderTextColor={SYS.TEXT_MUTED}
              value={inputText}
              onChangeText={setInputText}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit}>
              <Text style={styles.primaryBtnText}>제출</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={switchToVoice}>
              <Text style={styles.linkText}>🎙️ 음성으로 답할게요</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </>
    );
  }

  if (phase === 'confirming') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.confirmTitle}>아, 이런 말이지?</Text>
        <Text style={styles.confirmLabel}>{pendingConfirm?.archetype.label}</Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => pendingConfirm && confirmArchetype(pendingConfirm.archetype.id)}
        >
          <Text style={styles.primaryBtnText}>확인</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={switchToTyping}>
          <Text style={styles.secondaryBtnText}>다시 답하기</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (phase === 'ceremony') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(800)} style={styles.ceremonyContent}>
          <View style={[styles.auraPreview, { backgroundColor: dominantColor }]}>
            <Text style={styles.auraPreviewEmoji}>🪞</Text>
          </View>
          <Text style={styles.ceremonyTitle}>트윈이 완성됐어요 ✨</Text>
          <Text style={styles.ceremonyAxis}>당신의 핵심 성향: {AXIS_LABEL_KO[dominantAxis]}</Text>
          <Text style={styles.ceremonyType}>
            에니어그램 {bayesianState.topType}유형 · {ENNEAGRAM_TYPE_NAME[bayesianState.topType]}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleStart}>
            <Text style={styles.primaryBtnText}>시작하기</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    );
  }

  // phase === 'done' — useEffect가 자동 이동시키므로 렌더링할 게 없다
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SYS.BG_DARK_MIDNIGHT,
  },
  scrollContent: {
    padding: 32,
    justifyContent: 'center',
    flexGrow: 1,
    gap: 20,
  },
  idleDesc: {
    fontSize: 18,
    color: SYS.TEXT_LIGHT,
    textAlign: 'center',
    lineHeight: 26,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: SYS.CARD_DARK,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: BRAND.CORAL,
    borderRadius: 3,
  },
  clayEmoji: {
    fontSize: 64,
    textAlign: 'center',
  },
  actLabel: {
    fontSize: 14,
    color: SYS.TEXT_MUTED,
    textAlign: 'center',
  },
  questionText: {
    fontSize: 20,
    color: SYS.TEXT_LIGHT,
    textAlign: 'center',
  },
  input: {
    backgroundColor: SYS.CARD_DARK,
    borderRadius: 12,
    padding: 16,
    color: SYS.TEXT_LIGHT,
    fontSize: 16,
  },
  linkText: {
    fontSize: 14,
    color: BRAND.MINT,
    textAlign: 'center',
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: SYS.TEXT_LIGHT,
    textAlign: 'center',
  },
  confirmLabel: {
    fontSize: 18,
    color: BRAND.CORAL,
    textAlign: 'center',
  },
  ceremonyContent: {
    alignItems: 'center',
    gap: 16,
  },
  auraPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraPreviewEmoji: {
    fontSize: 48,
  },
  ceremonyTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: BRAND.CORAL,
    textAlign: 'center',
  },
  ceremonyAxis: {
    fontSize: 15,
    color: SYS.TEXT_LIGHT,
    textAlign: 'center',
  },
  ceremonyType: {
    fontSize: 18,
    color: SYS.TEXT_LIGHT,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: BRAND.CORAL,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: SYS.TEXT_LIGHT,
  },
  secondaryBtn: {
    backgroundColor: SYS.CARD_DARK,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    color: SYS.TEXT_LIGHT,
  },
});
