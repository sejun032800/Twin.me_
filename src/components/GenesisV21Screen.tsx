// ─── 연애 DNA v2.1 제네시스 화면 (Phase 3, FEATURE_DNA_V21 ON 경로) ─────────────
// app/(auth)/genesis.tsx가 useFeatureDnaV21()===true일 때 얼리 리턴으로 렌더하는
// 완전히 분리된 화면. useGenesisInterview(OFF 경로)를 전혀 참조하지 않는다.
// v2.1 §6 카피: 인터뷰는 최대 5분, 대부분 3~4분 내 자연 종료된다.

import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
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
import { buildAuraVector } from '@/engine/auraEngine';
import { generateBaseScore, getMBTICompatibilityGrade } from '@/engine/scoreCalculator';
import { INTERVIEW_HARD_CAP_SECONDS } from '@/lib/matching/constants';
import { ENNEAGRAM_TYPES, type ProbabilityVector } from '@/types/genesis';

const MBTI_RE = /^[EI][SN][TF][JP]$/i;

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

  const { phase, questionText, isGenerating, error, start, submitAnswer } = useAdaptiveInterview(mbti ?? '');
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);
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
        finished && (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleFinish}>
            <Text style={styles.primaryBtnText}>시작하기</Text>
          </TouchableOpacity>
        )
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
