// ─── 연애 DNA v2.1 제네시스 화면 (Phase 3, FEATURE_DNA_V21 ON 경로) ─────────────
// app/(auth)/genesis.tsx가 useFeatureDnaV21()===true일 때 얼리 리턴으로 렌더하는
// 완전히 분리된 화면. useGenesisInterview(OFF 경로)를 전혀 참조하지 않는다.
// v2.1 §6 카피: 인터뷰는 최대 5분, 대부분 3~4분 내 자연 종료된다.

import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import InterviewCallModal from '@/components/InterviewCallModal';
import { useAdaptiveInterview } from '@/hooks/useAdaptiveInterview';
import { useUserStore } from '@/store/userStore';
import { useCoupleStore } from '@/store/coupleStore';
import { useScoreStore } from '@/store/scoreStore';
import { useSessionStore } from '@/store/sessionStore';
import { enneagramCoreToTopType } from '@/lib/interview/personaAdapter';
import { computePersonaBlend } from '@/engine/genesisBlending';
import { computeAndSaveCoupleDna } from '@/services/dnaResultService';
import { buildAuraVector, auraChannelToCss, AURA_AXIS_DIRECTIONS, toScoreBand } from '@/engine/auraEngine';
import { generateBaseScore, getMBTICompatibilityGrade } from '@/engine/scoreCalculator';
import { getAllAuraStoryEntries } from '@/data/auraStoryPool';
import { INTERVIEW_HARD_CAP_SECONDS } from '@/lib/matching/constants';
import { ENNEAGRAM_TYPES, ENNEAGRAM_TYPE_NAME, type ProbabilityVector, type AuraAxis, type EnneagramType } from '@/types/genesis';
import { SYS } from '@/constants/colors';

const MBTI_RE = /^[EI][SN][TF][JP]$/i;

// genesis.tsx(레거시 ceremony phase)와 동일한 6축 한국어 라벨 — 표시 목적 매핑일 뿐,
// 계산 로직이 아니라 이 화면에도 그대로 복제해 둔다.
const AXIS_LABEL_KO: Record<string, string> = {
  attachmentSecurity: '애착 안정성',
  conflictResponse: '갈등 반응',
  expressiveness: '감정 표현성',
  independence: '자율성',
  spontaneity: '즉흥성',
  trustPace: '신뢰 속도',
};

interface PersonaSummary {
  dominantAxis: AuraAxis;
  dominantDirectionLabel: string;
  colorACss: string;
  colorBCss: string;
  enneagramType: EnneagramType;
  storyTitle: string | null;
}

export default function GenesisV21Screen() {
  const router = useRouter();
  const mbti = useUserStore((s) => s.mbti);
  const setPersonaMatrix = useUserStore((s) => s.setPersonaMatrix);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const setLastGenesisAt = useUserStore((s) => s.setLastGenesisAt);
  const setSBase = useScoreStore((s) => s.setSBase);
  const setSCurrent = useScoreStore((s) => s.setSCurrent);
  const isPartnerConnected = useCoupleStore((s) => s.isPartnerConnected);
  const partnerUserId = useCoupleStore((s) => s.partnerUserId);
  const coupleId = useCoupleStore((s) => s.coupleId);
  const setDnaResult = useCoupleStore((s) => s.setDnaResult);
  const interviewSession = useSessionStore((s) => s.interviewSession);
  const reduceAuraMotion = useSessionStore((s) => s.reduceAuraMotion);

  const { phase, questionText, isGenerating, error, start, submitAnswer } = useAdaptiveInterview(mbti ?? '');
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [personaSummary, setPersonaSummary] = useState<PersonaSummary | null>(null);
  const startedRef = useRef(false);
  const finishStartedRef = useRef(false);

  const validMbti = !!mbti && MBTI_RE.test(mbti);

  useEffect(() => {
    if (validMbti && !startedRef.current) {
      startedRef.current = true;
      start();
    }
  }, [validMbti, start]);

  useEffect(() => {
    if (phase !== 'done' || finishStartedRef.current) return;
    finishStartedRef.current = true;
    setFinishing(true);
    finalizeOnboardingData()
      .catch(() => {})
      .finally(() => {
        setFinishing(false);
        setFinished(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function finalizeOnboardingData() {
    const profile = useUserStore.getState().psychProfile;
    if (!profile) return;

    // (a) 트윈 페르소나 — enneagramCore(Δ⁹) → topType/confidence → 기존 3채널 블렌딩(genesisBlending.ts, 편집 없이 import만).
    const { type, confidence } = enneagramCoreToTopType(profile.enneagramCore);
    const blend = computePersonaBlend(type, confidence);
    const probabilities = ENNEAGRAM_TYPES.reduce((acc, t, i) => {
      acc[t] = profile.enneagramCore[i] ?? 0;
      return acc;
    }, {} as ProbabilityVector);
    const ranked = [...ENNEAGRAM_TYPES].sort((a, b) => probabilities[b] - probabilities[a]);
    const auraVector = buildAuraVector(probabilities);

    // 'done' 화면에 표시할 개인 성향 요약 — genesis.tsx(레거시) ceremony phase와 동일한
    // 파생값(dominantAxis/방향 레이블/스토리)을 여기서도 그대로 계산해 state에 담아둔다.
    // 새 엔진 로직이 아니라 이미 계산된 auraVector를 화면 표시용으로 가공하는 것뿐이다.
    const dominantAxis = Object.entries(auraVector.axisScores).reduce((a, b) =>
      Math.abs(a[1]) > Math.abs(b[1]) ? a : b,
    )[0] as AuraAxis;
    const dominantScore = auraVector.axisScores[dominantAxis];
    const dominantDirection = AURA_AXIS_DIRECTIONS[dominantAxis];
    const dominantDirectionLabel = dominantScore > 0 ? dominantDirection.b : dominantDirection.a;
    const dominantStory = getAllAuraStoryEntries().find(
      (e) => e.axis === dominantAxis && e.band === toScoreBand(dominantScore),
    );
    setPersonaSummary({
      dominantAxis,
      dominantDirectionLabel,
      colorACss: reduceAuraMotion ? SYS.TEXT_MUTED : auraChannelToCss(auraVector.colorA),
      colorBCss: reduceAuraMotion ? SYS.TEXT_MUTED : auraChannelToCss(auraVector.colorB),
      enneagramType: type,
      storyTitle: dominantStory?.title ?? null,
    });

    setPersonaMatrix({
      enneagramType: type,
      bayesian: {
        probabilities,
        topType: type,
        secondType: ranked[1] ?? type,
        confidence,
        margin: probabilities[ranked[0]] - (probabilities[ranked[1]] ?? 0),
        topTypeHistory: [type],
        askedQuestionIds: [],
      },
      auraVector,
      blend,
      accuracyUnlocked: true,
      completedAt: new Date().toISOString(),
      clayStage: 3,
    });
    setLastGenesisAt(new Date().toISOString());

    // (b) 파트너 연동 시 연애 DNA 계산 시도 — 실패/미연결/파트너 미완료면 dnaResult는
    // null 유지(PartnerStatusBar와 동일 패턴). 성공 시 couple_dna_results에도 기록되어,
    // 나중에 파트너가 완료했을 때 DnaCompatibilityCard가 재시도할 수 있는 근거가 된다.
    let dnaPct: number | null = null;
    if (isPartnerConnected && partnerUserId && coupleId) {
      const computed = await computeAndSaveCoupleDna(profile, coupleId, partnerUserId);
      if (computed) {
        dnaPct = computed.dnaPct;
        setDnaResult(computed);
      }
    }

    // (c) S_Base — dna_pct는 이미 [50,100] 척도의 궁합 점수이므로 그대로 S_Base로 쓴다.
    // 미연결/실패 시 OFF 경로와 동일하게 "자기 자신과의 상성" 폴백을 사용한다.
    const sBase = dnaPct ?? generateBaseScore(mbti ? getMBTICompatibilityGrade(mbti, mbti) : 'AVERAGE', 'AVERAGE');
    setSBase(sBase);
    setSCurrent(sBase);
  }

  function handleFinish() {
    completeOnboarding();
    router.replace('/(auth)/invite-hook');
  }

  if (!validMbti) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.desc}>MBTI 정보가 필요해요. 이전 단계로 돌아가 MBTI를 입력해주세요.</Text>
      </ScrollView>
    );
  }

  if (phase === 'idle') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.desc}>나를 닮은 AI를 만들기 위해{'\n'}대화를 나눠요{'\n\n'}최대 5분, 대부분 3~4분이면 충분해요</Text>
      </ScrollView>
    );
  }

  if (phase === 'asking') {
    const progressLabel = `${interviewSession.turnsUsed}턴 진행 · ${interviewSession.elapsedSeconds}초 경과`;
    return (
      <InterviewCallModal
        visible
        onClose={() => router.back()}
        question={questionText}
        onSubmit={submitAnswer}
        confidence={Math.min(1, interviewSession.elapsedSeconds / INTERVIEW_HARD_CAP_SECONDS)}
        act={1}
        mode="progress"
        progressLabel={progressLabel}
        isGenerating={isGenerating}
      />
    );
  }

  // phase === 'done'
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>트윈이 완성됐어요 ✨</Text>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {finishing ? (
        <Text style={styles.desc}>결과를 계산하는 중...</Text>
      ) : (
        finished &&
        personaSummary && (
          <Animated.View entering={FadeIn.duration(800)} style={styles.summaryContent}>
            <View style={styles.auraPreview}>
              <View style={[styles.auraGlow, styles.auraGlowA, { backgroundColor: personaSummary.colorACss }]} />
              <View style={[styles.auraGlow, styles.auraGlowB, { backgroundColor: personaSummary.colorBCss }]} />
              <LinearGradient
                colors={[personaSummary.colorACss, personaSummary.colorBCss]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.auraPreviewGradient}
              />
              <Text style={styles.auraPreviewEmoji}>🪞</Text>
            </View>
            <Text style={styles.summaryAxis}>당신의 핵심 성향: {AXIS_LABEL_KO[personaSummary.dominantAxis]}</Text>
            <Text style={styles.summaryType}>
              에니어그램 {personaSummary.enneagramType}유형 · {ENNEAGRAM_TYPE_NAME[personaSummary.enneagramType]}
            </Text>
            <Text style={styles.summaryDirection}>당신은 {personaSummary.dominantDirectionLabel} 성향이에요</Text>
            {personaSummary.storyTitle && <Text style={styles.summaryStory}>✨ {personaSummary.storyTitle}</Text>}
          </Animated.View>
        )
      )}
      {finished && (
        <TouchableOpacity style={styles.primaryBtn} onPress={handleFinish}>
          <Text style={styles.primaryBtnText}>시작하기</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
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
  desc: {
    fontSize: 18,
    color: '#E8E4DC',
    textAlign: 'center',
    lineHeight: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFA4A4',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: '#FCA5A5',
    textAlign: 'center',
  },
  summaryContent: {
    alignItems: 'center',
    gap: 18,
  },
  auraPreview: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraPreviewGradient: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  auraGlow: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    opacity: 0.55,
  },
  auraGlowA: {
    top: -16,
    left: -16,
  },
  auraGlowB: {
    bottom: -16,
    right: -16,
  },
  auraPreviewEmoji: {
    fontSize: 52,
  },
  summaryAxis: {
    fontSize: 15,
    color: '#5A6480',
    textAlign: 'center',
  },
  summaryType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8E4DC',
    textAlign: 'center',
  },
  summaryDirection: {
    fontSize: 15,
    color: '#E8E4DC',
    textAlign: 'center',
  },
  summaryStory: {
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
});
