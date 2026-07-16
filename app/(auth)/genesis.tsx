// ─── FUN-HOM-001 Override — 트윈 제네시스 인터뷰 (MASTER.md §2, 부록G) ──────────
// useGenesisInterview 상태 머신을 phase별로 렌더링만 담당한다.
// phase: idle → asking/act-transition → confirming → ceremony → done.
// genesis 화면은 아우라/테마 생성 이전 온보딩 단계이므로 항상-다크 고정.

import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useGenesisInterview } from '@/hooks/useGenesisInterview';
import { useFeatureDnaV21 } from '@/config/featureFlags';
import GenesisV21Screen from '@/components/GenesisV21Screen';
import InterviewCallModal from '@/components/InterviewCallModal';
import { useUserStore } from '@/store/userStore';
import { useScoreStore } from '@/store/scoreStore';
import { buildAuraVector, auraChannelToCss, AURA_AXIS_DIRECTIONS, toScoreBand } from '@/engine/auraEngine';
import { generateBaseScore, getMBTICompatibilityGrade } from '@/engine/scoreCalculator';
import { getAllAuraStoryEntries } from '@/data/auraStoryPool';
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
  const dnaV21 = useFeatureDnaV21();
  if (dnaV21) return <GenesisV21Screen />;

  const router = useRouter();
  const mbti = useUserStore((s) => s.mbti);
  const setPersonaMatrix = useUserStore((s) => s.setPersonaMatrix);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const setSBase = useScoreStore((s) => s.setSBase);
  const setSCurrent = useScoreStore((s) => s.setSCurrent);
  const setLastGenesisAt = useUserStore((s) => s.setLastGenesisAt);

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
  const dominantScore = auraVector.axisScores[dominantAxis];
  const dominantDirection = AURA_AXIS_DIRECTIONS[dominantAxis];
  const dominantDirectionLabel = dominantScore > 0 ? dominantDirection.b : dominantDirection.a;
  const dominantStory = getAllAuraStoryEntries().find(
    (e) => e.axis === dominantAxis && e.band === toScoreBand(dominantScore),
  );

  useEffect(() => {
    if (phase === 'done') {
      router.replace('/(auth)/invite-hook');
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
    setLastGenesisAt(new Date().toISOString());
    // 커플 연동 전(§0.3 싱글플레이어 원칙) 파트너 MBTI/에니어그램이 없으므로,
    // 커플 상성이 아닌 "자기 자신과의 상성"으로 개인 기준점(S_Base)을 산출한다.
    // 커플 연동 후에는 Phase 5에서 실제 파트너 데이터로 getMBTICompatibilityGrade()를
    // 다시 호출해 sBase를 갱신해야 한다.
    const mbtiGrade = mbti ? getMBTICompatibilityGrade(mbti, mbti) : 'AVERAGE';
    const baseScore = generateBaseScore(mbtiGrade, 'AVERAGE');
    setSBase(baseScore);
    // 앱 첫 실행 시 S_Current를 S_Base로 초기화 — 이후로는 settleMidnight()만이 갱신한다(§5.1).
    setSCurrent(baseScore);
    completeOnboarding();
    router.replace('/(auth)/invite-hook');
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
          clayStage={dynamicClayStage}
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
          <Text style={styles.ceremonyDirection}>당신은 {dominantDirectionLabel} 성향이에요</Text>
          {dominantStory && (
            <Text style={styles.ceremonyStory}>✨ {dominantStory.title}</Text>
          )}
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
    backgroundColor: '#0A0D1A',
  },
  scrollContent: {
    padding: 28,
    justifyContent: 'center',
    flexGrow: 1,
    gap: 24,
  },
  idleDesc: {
    fontSize: 18,
    color: '#E8E4DC',
    textAlign: 'center',
    lineHeight: 28,
  },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: '#131726',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFA4A4',
    borderRadius: 1,
  },
  clayEmoji: {
    fontSize: 72,
    textAlign: 'center',
  },
  actLabel: {
    fontSize: 12,
    color: '#5A6480',
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  questionText: {
    fontSize: 22,
    color: '#E8E4DC',
    textAlign: 'center',
    lineHeight: 34,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#131726',
    borderRadius: 14,
    padding: 18,
    color: '#E8E4DC',
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  linkText: {
    fontSize: 13,
    color: '#BADFDB',
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
    gap: 18,
  },
  auraPreview: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraPreviewEmoji: {
    fontSize: 52,
  },
  ceremonyTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFA4A4',
    textAlign: 'center',
  },
  ceremonyAxis: {
    fontSize: 15,
    color: '#5A6480',
    textAlign: 'center',
  },
  ceremonyType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8E4DC',
    textAlign: 'center',
  },
  ceremonyDirection: {
    fontSize: 15,
    color: '#E8E4DC',
    textAlign: 'center',
  },
  ceremonyStory: {
    fontSize: 13,
    color: '#5A6480',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
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
  secondaryBtn: {
    backgroundColor: '#131726',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    color: '#E8E4DC',
  },
});
