// ─── FUN-CHA — 채팅 탭 3룸 구조, 인스타그램 DM 스타일 (MASTER.md §4) ────────────
// 룸1 연인방(lover) — 실제 사람, 연인 미연동 시 §0.3 싱글플레이어 원칙에 따라 잠금.
// 룸2 트윈방(twin) — 나를 복제한 AI, 내 말투로 실시간 꾸짖고 인정.
// 룸3 분석가방(analyst) — 냉정한 제3자 전문가 톤, 패턴 분석.
// activeChatRoom=null이면 룸 목록(인박스), 값이 있으면 해당 룸 채팅 화면.
// 트윈 AI 응답: Gemini 2.5 Flash (Supabase Edge Function 프록시, 스트리밍 방식)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ActivityIndicator, Alert, Switch, AppState, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useCoupleStore } from '@/store/coupleStore';
import { useSessionStore } from '@/store/sessionStore';
import type { ActiveChatRoom } from '@/store/sessionStore';
import { useUserStore } from '@/store/userStore';
import { useMatchEngine } from '@/hooks/useMatchEngine';
import { useTheme } from '@/hooks/useTheme';
import { usePremiumGate } from '@/hooks/usePremiumGate';
import { useCrisisIntelligence, type CrisisMessage } from '@/hooks/useCrisisIntelligence';
import { useSigmaAuraOpacity } from '@/hooks/useTheme';
import { callLLMStream } from '@/api/llm';
import AuraDuskGradient from '@/components/AuraDuskGradient';
import GlassPanel from '@/components/glass/GlassPanel';
import GlassButton from '@/components/glass/GlassButton';
import MagicMirrorModal from '@/components/MagicMirrorModal';
import MuseSheet from '@/components/MuseSheet';
import FeedbackSheet from '@/components/FeedbackSheet';
import { scheduleLocalNotification } from '@/services/notificationService';
import { detectSensitiveContent } from '@/services/partnerSensitiveService';
import { generateWeeklyReport, getLastReport, type WeeklyReport } from '@/services/weeklyReportService';
import { generateCoachingReport, getCoachingReport, type CoachingReport } from '@/services/coachingService';
import type { ClassifierMessage } from '@/engine/eventClassifier';
import { buildPersonaBlendPromptSection } from '@/engine/genesisBlending';
import { pickFewShotAnchors } from '@/engine/userToneVectorBuilder';
import { formatScore } from '@/engine/scoreCalculator';
import { BRAND, SYS } from '@/constants/colors';
import type { SigmaTheme, ThemeMode } from '@/constants/theme';
import { FONTS, TYPOGRAPHY } from '@/constants/typography';

const FREE_MONTHLY_LIMIT = 10;
const FREE_TRIAL_DAYS = 14; // 첫 설치 후 14일간 무제한

type RoomKey = 'lover' | 'twin' | 'analyst';

interface ChatMessage {
  id: string;
  role: 'me' | 'twin';
  text: string;
  timestamp: number;
}

export default function Chat() {
  const theme = useTheme();
  const router = useRouter();
  const isPartnerConnected = useCoupleStore((s) => s.isPartnerConnected);
  const inviteCode = useCoupleStore((s) => s.inviteCode);
  const activeChatRoom = useSessionStore((s) => s.activeChatRoom);
  const setActiveChatRoom = useSessionStore((s) => s.setActiveChatRoom);
  const isCrisisMode = useSessionStore((s) => s.isCrisisMode);
  const setCrisisMode = useSessionStore((s) => s.setCrisisMode);
  const isEarlyDatingMode = useSessionStore((s) => s.isEarlyDatingMode);
  const setEarlyDatingMode = useSessionStore((s) => s.setEarlyDatingMode);
  const magicMirrorAccepted = useSessionStore((s) => s.magicMirrorAccepted);
  const setMagicMirrorAccepted = useSessionStore((s) => s.setMagicMirrorAccepted);
  const pendingMsg = useSessionStore((s) => s.pendingChatMessage);
  const setPendingChatMessage = useSessionStore((s) => s.setPendingChatMessage);
  const setAuraScreenKey = useSessionStore((s) => s.setAuraScreenKey);
  const themeMode = useSessionStore((s) => s.themeMode);
  const isSigma = themeMode === 'sigma';
  const reduceAuraMotion = useSessionStore((s) => s.reduceAuraMotion);
  const styles = useMemo(() => makeStyles(theme, themeMode), [theme, themeMode]);

  // STEP 11-1 화면키 어휘로 목록/방을 구분한다('chat' 단일 키였던 기존 로직에는 이 구분이
  // 없었음) — activeChatRoom이 null이면 목록, 아니면(어느 방이든) 방 안. useFocusEffect의
  // useCallback deps에 activeChatRoom을 넣어, 포커스 유지 중 방을 드나들 때도(탭 전환 없이)
  // 즉시 재평가되게 한다.
  useFocusEffect(useCallback(() => {
    setAuraScreenKey(activeChatRoom === null ? 'chatList' : 'chatRoom');
  }, [setAuraScreenKey, activeChatRoom]));
  const [showMirrorModal, setShowMirrorModal] = useState(false);
  const name = useUserStore((s) => s.name);
  const monthlyChatCount = useUserStore((s) => s.monthlyChatCount);
  const setMonthlyChatCount = useUserStore((s) => s.setMonthlyChatCount);
  const joinedAt = useUserStore((s) => s.joinedAt);
  const isTrialPeriod = !joinedAt
    ? true
    : Date.now() - new Date(joinedAt).getTime() < FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const { hasReportAccess, hasDeepChatAccess } = usePremiumGate();
  const { processMessage } = useMatchEngine();
  const { result: crisisResult, runAnalysis: analyzeConversation } = useCrisisIntelligence();
  const [chatHistory, setChatHistory] = useState<ClassifierMessage[]>([]);

  const [messagesByRoom, setMessagesByRoom] = useState<Record<RoomKey, ChatMessage[]>>({
    lover: [],
    twin: [],
    analyst: [],
  });
  const [inputText, setInputText] = useState('');
  const [sensitiveWarning, setSensitiveWarning] = useState<string | null>(null);
  const [museVisible, setMuseVisible] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<string | null>(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const [lastReport, setLastReport] = useState<WeeklyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [coachingReport, setCoachingReport] = useState<CoachingReport | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(false);

  const currentRoom = activeChatRoom as RoomKey | null;
  const isLoverLocked = currentRoom === 'lover' && !isPartnerConnected;
  const messages = currentRoom ? messagesByRoom[currentRoom] : [];

  // sigma 전용 오라 배경 — light/dark는 아래 값들을 전혀 참조하지 않는다(렌더링에서
  // themeMode==='sigma' 게이트로 걸러짐). opacity는 방 안에 들어가도 항상 chatList
  // 티어(0.35) 값 그대로 유지한다 — "방 진입 직전 값을 그대로 유지하고 opacity 자체를
  // 바꾸진 마"라는 요구사항대로, 이 화면에서 방에 들어가는 유일한 경로가 목록이므로
  // chatList 값이 곧 "직전 화면 값"과 항상 같다. 각도/색 갱신만 멈추는 건 frozen prop이
  // 담당한다.
  // auraVector는 personaMatrix를 store에서 다시 조회하지 않고 useTheme()이 반환하는
  // 값 하나만 거친다(theme.ts의 buildSigmaTheme가 채워 넣는 동일 원본).
  const auraVector = theme.auraVector;
  const chatAuraOpacity = useSigmaAuraOpacity('chatList');
  const isInChatRoom = currentRoom !== null;

  useEffect(() => {
    if (pendingMsg) {
      setInputText(pendingMsg);
      setActiveChatRoom('twin');
      setPendingChatMessage(null);
    }
  }, [pendingMsg]);

  useEffect(() => {
    if (crisisResult?.crisisActive) {
      setCrisisMode(true);
    }
  }, [crisisResult, setCrisisMode]);

  useEffect(() => {
    if (currentRoom === 'analyst') {
      getLastReport().then(setLastReport);
      getCoachingReport().then(setCoachingReport);
    }
  }, [currentRoom]);

  useEffect(() => {
    if (currentRoom === 'twin' && !magicMirrorAccepted) {
      const t = setTimeout(() => setShowMirrorModal(true), 1000);
      return () => clearTimeout(t);
    }
  }, [currentRoom, magicMirrorAccepted]);

  async function handleGenerateReport() {
    if (reportLoading) return;
    setReportLoading(true);
    try {
      const report = await generateWeeklyReport(hasReportAccess);
      setLastReport(report);
    } catch (e) {
      console.error('주간 리포트 생성 실패:', e);
    } finally {
      setReportLoading(false);
    }
  }

  async function handleGenerateCoaching() {
    if (coachingLoading) return;
    setCoachingLoading(true);
    try {
      const report = await generateCoachingReport();
      setCoachingReport(report);
    } catch (e) {
      console.error('코칭 리포트 생성 실패:', e);
    } finally {
      setCoachingLoading(false);
    }
  }

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const ROOMS = [
    {
      key: 'lover' as ActiveChatRoom,
      label: '연인',
      subtitle: '연인을 초대하면 함께할 수 있어요',
      icon: '🔒',
      color: BRAND.PINK,
      cardBg: 'rgba(255, 189, 189, 0.08)',
      locked: !isPartnerConnected,
    },
    {
      key: 'twin' as ActiveChatRoom,
      label: '트윈',
      subtitle: '나를 닮은 AI와 솔직하게 대화해요',
      icon: name ? name[0] : 'T',
      color: BRAND.MINT,
      cardBg: 'rgba(186, 223, 219, 0.10)',
      locked: false,
    },
    {
      key: 'analyst' as ActiveChatRoom,
      label: '분석가',
      subtitle: '우리 대화 패턴을 함께 들여다봐요',
      icon: '📊',
      color: BRAND.CORAL,
      cardBg: 'rgba(255, 164, 164, 0.07)',
      locked: false,
    },
  ];

  const currentRoomData = ROOMS.find((r) => r.key === currentRoom);

  async function handleSend() {
    if (!currentRoom || !inputText.trim() || isLoverLocked) return;

    // FUN-CHA — 민감 표현 감지 (비차단, 전송은 허용하되 넛지만 노출)
    const detection = detectSensitiveContent(inputText.trim());
    if (detection.detected && detection.suggestion) {
      setSensitiveWarning(detection.suggestion);
      setTimeout(() => setSensitiveWarning(null), 4000);
    }

    // §9.3 — 트윈방/분석가방은 무료 플랜 월 FREE_MONTHLY_LIMIT회 제한 (Deep Talk Night만 무제한).
    // 단, 가입 후 FREE_TRIAL_DAYS일간은 트라이얼 기간이라 한도 체크를 건너뛴다.
    const isGatedRoom = currentRoom === 'twin' || currentRoom === 'analyst';
    if (isGatedRoom && !isTrialPeriod && !hasDeepChatAccess && monthlyChatCount >= FREE_MONTHLY_LIMIT) {
      Alert.alert(
        '이번 달 대화를 다 썼어요',
        `무료 플랜은 매달 ${FREE_MONTHLY_LIMIT}회 대화할 수 있어요.\n` +
        'Deep Talk Night로 업그레이드하면 무제한으로 대화할 수 있어요.',
        [
          { text: '나중에', style: 'cancel' },
          { text: '업그레이드 보기', onPress: () => router.push('/(tabs)/settings') },
        ],
      );
      return;
    }
    if (isGatedRoom) {
      setMonthlyChatCount(monthlyChatCount + 1);
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'me',
      text: inputText.trim(),
      timestamp: Date.now(),
    };

    setMessagesByRoom((prev) => ({
      ...prev,
      [currentRoom]: [...prev[currentRoom], userMsg],
    }));

    // chatHistory 업데이트
    const newHistory: ClassifierMessage[] = [
      ...chatHistory,
      { role: 'me', text: inputText.trim(), timestamp: userMsg.timestamp },
    ];
    setChatHistory(newHistory);

    // 엔진 처리
    const { detections } = processMessage(inputText.trim(), 'me', chatHistory);

    setInputText('');

    // 트윈 AI 응답 생성 — '말하는 중...' 스트리밍 타이핑 (MASTER.md §4.3 응답 분할 전송)
    const twinMsgId = (Date.now() + 1).toString();
    const twinMsg: ChatMessage = {
      id: twinMsgId,
      role: 'twin',
      text: '',
      timestamp: Date.now() + 1,
    };
    setMessagesByRoom((prev) => ({
      ...prev,
      [currentRoom]: [...prev[currentRoom], twinMsg],
    }));

    let fullText = '';
    try {
      const { name, personaMatrix, toneVector } = useUserStore.getState();
      const privacyLevel = useSessionStore.getState().privacyLevel;

      let systemPrompt: string;
      if (privacyLevel === 0) {
        systemPrompt = `너는 ${name ?? '사용자'}의 트윈 AI야.
최소한의 정보만 사용해서 일반적인 대화 상대로만 행동해.
개인 정보나 말투 패턴은 학습하지 않는다.
반말로 짧게 1문장으로만 답해.`;
      } else if (privacyLevel === 2) {
        const toneSummary =
          toneVector
            ? `말투 특성: 웃음체 ${Math.round(toneVector.laughter.frequency * 100)}%, 이모지 평균 ${toneVector.emoji.density.toFixed(1)}개/메시지`
            : '';
        const myLines = chatHistory.filter((m) => m.role === 'me').map((m) => m.text);
        const anchors = toneVector && myLines.length > 0 ? pickFewShotAnchors(myLines, toneVector) : [];
        const fewShotSection = anchors.length > 0 ? `\n[예시 발화]\n${anchors.join('\n')}` : '';
        systemPrompt = `너는 ${name ?? '사용자'}의 완벽한 복제 AI야.
${name ?? '사용자'}의 말투, 성격, 감정 패턴을 최대한 그대로 흉내 내.
에니어그램 유형: ${personaMatrix?.enneagramType ?? '미확정'}
toneVector가 있다면 그 말투 패턴을 적극 반영해.
반말로 짧게 1문장으로만 답해. 이모티콘 자주 써.
${toneSummary}${fewShotSection}`;
      } else {
        systemPrompt = `너는 ${name ?? '사용자'}의 트윈 AI야.
${name ?? '사용자'}의 말투와 성격을 그대로 흉내 내서 대화해.
규칙:
- 반말로 짧게 1문장으로만 답해
- 이모티콘 가끔 써
- 질문엔 질문으로 받아쳐
- 너무 친절하거나 AI스럽게 말하지 마
에니어그램 유형: ${personaMatrix?.enneagramType ?? '미확정'}`;
      }

      const earlyModeInstruction = isEarlyDatingMode
        ? '\n연애 초기 모드: 아직 서로 알아가는 단계야. 설레고 조심스러운 톤으로 답해. 너무 친하게 굴지 말고 적당한 거리감을 유지해.'
        : '';
      systemPrompt += earlyModeInstruction;

      const blendSection = personaMatrix?.blend
        ? buildPersonaBlendPromptSection(personaMatrix.blend)
        : '';
      if (blendSection) {
        systemPrompt += `\n${blendSection}`;
      }

      await callLLMStream(
        { systemPrompt, userMessage: inputText.trim(), maxTokens: 200 },
        (chunk) => {
          fullText += chunk;
          setMessagesByRoom((prev) => ({
            ...prev,
            [currentRoom]: prev[currentRoom].map((m) =>
              m.id === twinMsgId ? { ...m, text: m.text + chunk } : m
            ),
          }));
        },
        () => {
          // 완료 — 추가 처리 없음
        },
      );
    } catch (e) {
      console.warn('LLM 스트리밍 호출 실패:', e);
      fullText = detections.length > 0
        ? `[${detections[0].label}] 감지됐어요`
        : '응, 들었어 💙';
      setMessagesByRoom((prev) => ({
        ...prev,
        [currentRoom]: prev[currentRoom].map((m) =>
          m.id === twinMsgId ? { ...m, text: fullText } : m
        ),
      }));
    }

    // 앱이 백그라운드일 때만 알림 (포그라운드에서는 화면에 바로 보임)
    if (fullText && AppState.currentState !== 'active') {
      await scheduleLocalNotification('트윈의 메시지', fullText.slice(0, 50));
    }

    // FUN-CHA-003 — 트윈방 대화 위기 감지 (Crisis Intelligence Engine)
    if (currentRoom === 'twin') {
      const recentMsgs = messagesByRoom.twin?.slice(-10) ?? [];
      const crisisMessages: CrisisMessage[] = recentMsgs.map((m) => ({
        role: m.role === 'me' ? 'user' : 'ai',
        text: m.text,
        timestamp: m.timestamp,
        type: 'normal',
      }));
      analyzeConversation(crisisMessages);
    }
  }

  // FUN-CHA-002 — AI 말풍선 롱프레스 → 말투 교정 피드백 시트 오픈
  function handleBubbleLongPress(msg: ChatMessage) {
    if (msg.role !== 'twin') return;
    setFeedbackTarget(msg.id);
    setFeedbackVisible(true);
  }

  async function handleFeedbackSelect(type: 'too_warm' | 'too_cold' | 'humor_mismatch') {
    setFeedbackVisible(false);
    if (!feedbackTarget || !currentRoom) return;

    const feedbackInstruction: Record<string, string> = {
      too_warm: '이전 답변이 너무 다정했어. 좀 더 담담하고 솔직하게 다시 말해줘. 1문장.',
      too_cold: '이전 답변이 너무 딱딱했어. 좀 더 따뜻하고 친근하게 다시 말해줘. 1문장.',
      humor_mismatch: '이전 답변의 유머가 안 맞았어. 유머 없이 진지하게 다시 말해줘. 1문장.',
    };

    const msgs = messagesByRoom[currentRoom];
    const targetIdx = msgs.findIndex((m) => m.id === feedbackTarget);
    const prevUserMsg = msgs.slice(0, targetIdx).filter((m) => m.role === 'me').at(-1);
    if (!prevUserMsg) return;

    setMessagesByRoom((prev) => ({
      ...prev,
      [currentRoom]: prev[currentRoom].map((m) =>
        m.id === feedbackTarget ? { ...m, text: '✍️ 수정 중...' } : m
      ),
    }));

    const { name, personaMatrix } = useUserStore.getState();
    const systemPrompt = `너는 ${name ?? '사용자'}의 트윈 AI야. ${feedbackInstruction[type]} 에니어그램 유형: ${personaMatrix?.enneagramType ?? '미확정'} 반말로 1문장만.`;

    let revised = '';
    try {
      await callLLMStream(
        { systemPrompt, userMessage: prevUserMsg.text, maxTokens: 100 },
        (chunk) => {
          revised += chunk;
          setMessagesByRoom((prev) => ({
            ...prev,
            [currentRoom]: prev[currentRoom].map((m) =>
              m.id === feedbackTarget ? { ...m, text: revised } : m
            ),
          }));
        },
        () => {},
      );
    } catch {
      setMessagesByRoom((prev) => ({
        ...prev,
        [currentRoom]: prev[currentRoom].map((m) =>
          m.id === feedbackTarget ? { ...m, text: '다시 시도해줘 😅' } : m
        ),
      }));
    }
    setFeedbackTarget(null);
  }

  function renderPlaceholder() {
    if (currentRoom === 'lover' && isLoverLocked) {
      return (
        <View style={styles.loverLockScreen}>
          {/* 감성 배경 */}
          <View style={styles.loverLockGlow} />

          {/* 아이콘 */}
          <Text style={styles.loverLockIcon}>💌</Text>

          {/* 타이틀 */}
          <Text style={styles.loverLockTitle}>
            연인과 함께하면{'\n'}더 특별해져요
          </Text>
          <Text style={styles.loverLockDesc}>
            초대 코드를 공유하면{'\n'}
            연인방이 열리고 일치율도 더 정확해져요
          </Text>

          {/* 초대 코드 표시 — sigma에서는 GlassPanel(카드 안에 카드 방지를 위해 loverCodeCard
              자체 배경은 makeStyles에서 투명 처리). */}
          {inviteCode ? (
            isSigma ? (
              <GlassPanel style={{ width: '100%', borderRadius: 14 }}>
                <View style={styles.loverCodeCard}>
                  <Text style={styles.loverCodeLabel}>내 초대 코드</Text>
                  <Text style={styles.loverCodeValue}>{inviteCode}</Text>
                </View>
              </GlassPanel>
            ) : (
              <View style={styles.loverCodeCard}>
                <Text style={styles.loverCodeLabel}>내 초대 코드</Text>
                <Text style={styles.loverCodeValue}>{inviteCode}</Text>
              </View>
            )
          ) : null}

          {/* 공유 버튼 */}
          {isSigma ? (
            <GlassButton
              style={styles.loverShareBtnGlass}
              onPress={async () => {
                const code = inviteCode ?? '설정에서 확인';
                await Share.share({
                  message:
                    `나 Twin.me 써보고 있는데 같이 해볼래? 🧬\n` +
                    `초대 코드: ${code}\n` +
                    `Twin.me 설치 후 설정 → 커플 연동 → 코드 입력해줘 💌`,
                });
              }}
            >
              <Text style={styles.loverShareBtnText}>💌 연인에게 보내기</Text>
            </GlassButton>
          ) : (
            <TouchableOpacity
              style={styles.loverShareBtn}
              onPress={async () => {
                const code = inviteCode ?? '설정에서 확인';
                await Share.share({
                  message:
                    `나 Twin.me 써보고 있는데 같이 해볼래? 🧬\n` +
                    `초대 코드: ${code}\n` +
                    `Twin.me 설치 후 설정 → 커플 연동 → 코드 입력해줘 💌`,
                });
              }}
            >
              <Text style={styles.loverShareBtnText}>💌 연인에게 보내기</Text>
            </TouchableOpacity>
          )}

          {/* 설정으로 이동 */}
          <TouchableOpacity
            style={styles.loverSettingsBtn}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <Text style={styles.loverSettingsBtnText}>
              설정에서 초대 코드 관리하기
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (currentRoom === 'twin') {
      return (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>트윈 AI와 대화하세요</Text>
        </View>
      );
    }
    return null;
  }

  function renderReportSection() {
    if (lastReport) {
      const content = (
        <>
          <Text style={styles.reportTitle}>📊 주간 연애 리포트</Text>
          <Text style={styles.reportPeriod}>{lastReport.weekStart} ~ {lastReport.weekEnd}</Text>
          <View style={styles.reportStats}>
            <Text style={styles.reportStatText}>평균 {formatScore(lastReport.avgScore)}점</Text>
            <Text style={styles.reportStatText}>최고 {formatScore(lastReport.maxScore)}점</Text>
            <Text style={styles.reportStatText}>최저 {formatScore(lastReport.minScore)}점</Text>
          </View>
          <Text style={styles.reportSummary}>{lastReport.summary}</Text>
          {!lastReport.fullAnalysis && (
            <TouchableOpacity style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>🔒 상세 분석은 Coffee Talk 이상</Text>
            </TouchableOpacity>
          )}
          {lastReport.fullAnalysis && (
            <Text style={styles.reportFull}>{lastReport.fullAnalysis}</Text>
          )}
        </>
      );
      // sigma에서는 GlassPanel(margin/radius만 지닌 얇은 외곽 래퍼)이 카드 레이어를 맡고,
      // reportCard(내부 padding, 투명 배경)는 콘텐츠 레이아웃만 담당한다 — GlassPanel에
      // padding까지 넘기면 블러 표면 자체가 줄어드는 문제를 피하기 위함.
      return isSigma ? (
        <GlassPanel style={{ margin: 8, borderRadius: 16 }}>
          <View style={styles.reportCard}>{content}</View>
        </GlassPanel>
      ) : (
        <View style={styles.reportCard}>{content}</View>
      );
    }

    return (
      <View style={styles.reportEmptyState}>
        <Text style={styles.placeholderText}>아직 이번 주 리포트가 없어요</Text>
        {isSigma ? (
          <GlassButton
            style={styles.primaryReportBtnGlass}
            onPress={handleGenerateReport}
            disabled={reportLoading}
          >
            {reportLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryReportBtnText}>리포트 생성하기</Text>
            )}
          </GlassButton>
        ) : (
          <TouchableOpacity
            style={styles.primaryReportBtn}
            onPress={handleGenerateReport}
            disabled={reportLoading}
          >
            {reportLoading ? (
              <ActivityIndicator color={SYS.TEXT_LIGHT} />
            ) : (
              <Text style={styles.primaryReportBtnText}>리포트 생성하기</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function renderCoachingSection() {
    if (!coachingReport) return null;
    const { weekSummary, strengthPoints, growthPoints, thisWeekChallenge } = coachingReport;

    const content = (
      <>
        <Text style={styles.coachingTitle}>🎯 이번 주 코칭</Text>
        <Text style={styles.reportSummary}>{weekSummary}</Text>

        <Text style={styles.coachingSection}>💪 잘하고 있어요</Text>
        {strengthPoints.map((p, i) => (
          <Text key={i} style={styles.coachingItem}>• {p}</Text>
        ))}

        <Text style={styles.coachingSection}>🌱 함께 성장해요</Text>
        {growthPoints.map((p, i) => (
          <Text key={i} style={styles.coachingItem}>• {p}</Text>
        ))}

        <View style={styles.challengeBox}>
          <Text style={styles.challengeTitle}>✅ 이번 주 실천 과제</Text>
          <Text style={styles.challengeText}>{thisWeekChallenge}</Text>
        </View>
      </>
    );

    // sigma에서는 GlassPanel(margin/radius만 지닌 얇은 외곽 래퍼)이 카드 레이어를 맡고,
    // coachingCard(내부 padding, 투명 배경)는 콘텐츠 레이아웃만 담당한다.
    return isSigma ? (
      <GlassPanel style={{ margin: 8, borderRadius: 16 }}>
        <View style={styles.coachingCard}>{content}</View>
      </GlassPanel>
    ) : (
      <View style={styles.coachingCard}>{content}</View>
    );
  }

  function renderListHeader() {
    return (
      <View>
        <View style={styles.dmHeader}>
          <Text style={styles.dmHeaderTitle}>채팅</Text>
          <View style={styles.dmHeaderIcons}>
            <TouchableOpacity style={styles.dmHeaderBtn}>
              <Ionicons name="videocam-outline" size={24} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.dmHeaderBtn}>
              <Ionicons name="create-outline" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.earlyModeRow}>
          <Text style={styles.earlyModeLabel}>연애 초기 모드</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {isEarlyDatingMode && <Text>💕</Text>}
            <Switch
              value={isEarlyDatingMode}
              onValueChange={setEarlyDatingMode}
              trackColor={{ false: SYS.CARD_DARK, true: BRAND.CORAL }}
              thumbColor={SYS.TEXT_LIGHT}
            />
          </View>
        </View>
      </View>
    );
  }

  function renderChatHeader() {
    return (
      <View style={styles.chatHeader}>
        <TouchableOpacity
          onPress={() => setActiveChatRoom(null)}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.chatHeaderCenter}>
          <View style={[styles.chatHeaderAvatar, { backgroundColor: currentRoomData?.color + '33', borderColor: currentRoomData?.color }]}>
            <Text style={styles.chatHeaderAvatarText}>{currentRoomData?.icon}</Text>
          </View>
          <View>
            <Text style={styles.chatHeaderName}>{currentRoomData?.label}</Text>
            <Text style={styles.chatHeaderSub}>Twin.me</Text>
          </View>
        </View>

        <View style={{ width: 40 }} />
      </View>
    );
  }

  function renderRoomList() {
    return (
      <ScrollView bounces={true} alwaysBounceVertical={true}>
        {ROOMS.map((room) => {
          const inner = (
            <>
              <View style={[styles.dmAvatar, { backgroundColor: room.color + '40' }]}>
                <Text style={styles.dmAvatarText}>{room.icon}</Text>
                {!room.locked && <View style={[styles.dmOnlineDot, { backgroundColor: room.color }]} />}
              </View>

              <View style={styles.dmContent}>
                <View style={styles.dmTop}>
                  <Text style={[styles.dmName, isSigma && styles.dmNameSigma, room.locked && { color: theme.textMuted }]}>
                    {room.label}
                  </Text>
                  {room.locked && <Text style={styles.dmTime}>초대 필요</Text>}
                </View>
                <Text
                  style={[styles.dmPreview, isSigma && styles.dmPreviewSigma, room.locked && { color: theme.textMuted }]}
                  numberOfLines={1}
                >
                  {room.subtitle}
                </Text>
              </View>
            </>
          );

          // UIredesign_v2.md §6-Sigma 각주 — 룸 카드 3개(연인방/트윈방/분석가방)의 flat
          // tint 배경(Pink/Mint/Coral)은 sigma에서 GlassPanel로 대체된다("이중 카드" 방지를
          // 위해 room.cardBg 틴트는 sigma에서 전달하지 않는다). GlassPanel은 margin/radius만
          // 지닌 얇은 외곽 래퍼이고, 실제 padding/레이아웃은 안쪽 TouchableOpacity(dmItemInner)가
          // 맡는다 — GlassPanel에 padding까지 넘기면 블러 표면 자체가 줄어드는 문제를 피한다.
          return isSigma ? (
            <GlassPanel key={room.key} style={{ marginHorizontal: 16, marginBottom: 10, borderRadius: 16 }}>
              <TouchableOpacity
                style={styles.dmItemInner}
                onPress={() => !room.locked && setActiveChatRoom(room.key)}
                activeOpacity={room.locked ? 1 : 0.7}
              >
                {inner}
              </TouchableOpacity>
            </GlassPanel>
          ) : (
            <TouchableOpacity
              key={room.key}
              style={[styles.dmItem, { backgroundColor: room.cardBg }]}
              onPress={() => !room.locked && setActiveChatRoom(room.key)}
              activeOpacity={room.locked ? 1 : 0.7}
            >
              {inner}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  function renderChatScreen() {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          {isCrisisMode && (
            <Animated.View entering={FadeIn.duration(500)} style={styles.crisisOverlay}>
              <Text style={styles.crisisTitle}>⚠️ 관계 주의 신호</Text>
              <Text style={styles.crisisDesc}>
                최근 대화에서 급격한 변화가 감지됐어요.{'\n'}
                잠깐 멈추고 서로의 감정을 확인해보세요.
              </Text>
              <TouchableOpacity style={styles.crisisDismiss} onPress={() => setCrisisMode(false)}>
                <Text style={styles.crisisDismissText}>확인했어요</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          {/*
            TODO: EAS Build 환경에서 react-native-avoid-softinput으로 교체.
            현재는 iPhone 14 Pro 기준 고정 offset(120) 사용.
            교체 시 keyboardVerticalOffset 제거하고
            AvoidSoftInput.setShouldMimicIOSBehavior(true) 적용.
          */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
          >
            {currentRoom === 'analyst' && (
              <ScrollView style={styles.reportSection} showsVerticalScrollIndicator={false}>
                {renderReportSection()}
                {renderCoachingSection()}
              </ScrollView>
            )}

            {messages.length === 0 ? (
              renderPlaceholder()
            ) : (
              <ScrollView
                ref={scrollRef}
                style={styles.messageList}
                contentContainerStyle={styles.messageListContent}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                keyboardShouldPersistTaps="handled"
              >
                {messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[styles.msgRow, msg.role === 'me' ? styles.msgRowMe : styles.msgRowTwin]}
                  >
                    {msg.role !== 'me' && (
                      <View style={[styles.msgAvatar, { backgroundColor: currentRoomData?.color + '33' }]}>
                        <Text style={{ fontSize: 14 }}>{currentRoomData?.icon}</Text>
                      </View>
                    )}
                    <View>
                      <TouchableOpacity
                        activeOpacity={msg.role === 'me' ? 1 : 0.7}
                        onLongPress={msg.role === 'me' ? undefined : () => handleBubbleLongPress(msg)}
                        delayLongPress={400}
                        style={[styles.bubble, msg.role === 'me' ? styles.bubbleMe : styles.bubbleTwin]}
                      >
                        <Text style={[styles.bubbleText, msg.role !== 'me' && { color: theme.text }]}>{msg.text}</Text>
                      </TouchableOpacity>
                      <Text style={[styles.msgTime, msg.role === 'me' && { textAlign: 'right' }]}>
                        {formatTime(msg.timestamp)}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {currentRoom === 'analyst' && (
              <View style={styles.analystBtnRow}>
                {isSigma ? (
                  <GlassButton style={styles.analystBtnFlex} onPress={handleGenerateReport} disabled={reportLoading}>
                    {reportLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.generateReportBtnText}>이번 주 리포트 생성</Text>
                    )}
                  </GlassButton>
                ) : (
                  <TouchableOpacity
                    style={[styles.generateReportBtn, styles.analystBtnFlex]}
                    onPress={handleGenerateReport}
                    disabled={reportLoading}
                  >
                    {reportLoading ? (
                      <ActivityIndicator color={BRAND.CORAL} />
                    ) : (
                      <Text style={styles.generateReportBtnText}>이번 주 리포트 생성</Text>
                    )}
                  </TouchableOpacity>
                )}
                {isSigma ? (
                  <GlassButton style={styles.analystBtnFlex} onPress={handleGenerateCoaching} disabled={coachingLoading}>
                    {coachingLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.generateReportBtnText}>이번 주 코칭 받기</Text>
                    )}
                  </GlassButton>
                ) : (
                  <TouchableOpacity
                    style={[styles.generateReportBtn, styles.analystBtnFlex]}
                    onPress={handleGenerateCoaching}
                    disabled={coachingLoading}
                  >
                    {coachingLoading ? (
                      <ActivityIndicator color={BRAND.CORAL} />
                    ) : (
                      <Text style={styles.generateReportBtnText}>이번 주 코칭 받기</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {sensitiveWarning && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.sensitiveWarning}>
                <Text style={styles.sensitiveWarningText}>💛 {sensitiveWarning}</Text>
              </Animated.View>
            )}

            {/* 남은 대화 횟수 상시 노출 — 트윈/분석가 룸에서만 표시 */}
            {currentRoom !== 'lover' && !hasDeepChatAccess && (
              <View style={styles.limitBanner}>
                {isTrialPeriod ? (
                  <Text style={styles.limitBannerText}>✨ 14일 무료 체험 중</Text>
                ) : (
                  <Text
                    style={[
                      styles.limitBannerText,
                      (FREE_MONTHLY_LIMIT - monthlyChatCount) <= 2 && { color: '#FFA4A4' },
                    ]}
                  >
                    이번 달 {FREE_MONTHLY_LIMIT - monthlyChatCount}회 남았어요
                  </Text>
                )}
              </View>
            )}

            <View style={styles.inputBar}>
              {currentRoom === 'twin' && (
                <TouchableOpacity style={styles.museBtn} onPress={() => setMuseVisible(true)}>
                  <Text style={styles.museBtnText}>✨</Text>
                </TouchableOpacity>
              )}
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder={isLoverLocked ? '입력할 수 없어요' : `${name ?? '나'}로 메시지 보내기`}
                  placeholderTextColor="#555"
                  editable={!isLoverLocked}
                  multiline
                  maxLength={500}
                />
              </View>
              <TouchableOpacity
                style={[styles.sendBtn, (!inputText.trim() || isLoverLocked) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!inputText.trim() || isLoverLocked}
              >
                <Ionicons
                  name="arrow-up"
                  size={20}
                  color={inputText.trim() && !isLoverLocked ? SYS.TEXT_LIGHT : '#555'}
                />
              </TouchableOpacity>
            </View>

            <MuseSheet
              visible={museVisible}
              onClose={() => setMuseVisible(false)}
              onSelect={(text) => setInputText(text)}
              recentMessages={messagesByRoom['twin']?.slice(-5).map((m) => m.text) ?? []}
            />
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {/* sigma 전용 오라 배경 — light/dark에서는 마운트 자체를 안 한다(props로 숨기는 게
          아니라 렌더 트리에서 아예 제외). opacity는 목록/방 어디서든 chatList 티어(0.35)
          그대로 — 방 안(currentRoom!==null)에서만 frozen=true로 각도/색 갱신을 멈춘다. */}
      {themeMode === 'sigma' && auraVector && (
        <AuraDuskGradient
          auraVector={auraVector}
          opacity={typeof chatAuraOpacity === 'number' ? chatAuraOpacity : 0}
          reduceMotion={reduceAuraMotion}
          frozen={isInChatRoom}
        />
      )}
      <View style={styles.container}>
        {currentRoom === null ? renderListHeader() : renderChatHeader()}
        {currentRoom === null ? renderRoomList() : renderChatScreen()}
      </View>

      <MagicMirrorModal
        visible={showMirrorModal}
        onAccept={() => {
          setMagicMirrorAccepted(true);
          setShowMirrorModal(false);
        }}
        onDecline={() => setShowMirrorModal(false)}
      />

      <FeedbackSheet
        visible={feedbackVisible}
        onClose={() => { setFeedbackVisible(false); setFeedbackTarget(null); }}
        onSelect={handleFeedbackSelect}
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: SigmaTheme, themeMode: ThemeMode) {
  const isSigma = themeMode === 'sigma';
  // GlassPanel/GlassButton은 계속 움직이는 오라 위에 반투명하게 얹히므로, 그 위의 텍스트는
  // 고정 테마색 대신 흰색 고정 + textShadow 조합으로 가독성을 보장한다(SigmaMainLayout/
  // PartnerStatusBar와 동일 관례).
  const sigmaTextShadow = isSigma ? {
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  } : null;
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.bg },
  // sigma에서만 투명 — 뒤에 깔리는 AuraDuskGradient가 비쳐 보이게 한다. light/dark는
  // 이 화면에 오라 레이어 자체가 마운트되지 않으므로 theme.bg 그대로(기존과 동일).
  container: { flex: 1, backgroundColor: themeMode === 'sigma' ? 'transparent' : theme.bg },

  // CrisisMode(FUN-CHA-003) — rapidSwing 감지 시 채팅 화면 상단 경고 오버레이
  crisisOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: SYS.CRISIS_RED,
    padding: 16,
    gap: 8,
  },
  crisisTitle: { ...TYPOGRAPHY.bodyMedium, color: SYS.CRISIS_RED },
  // crisisOverlay는 15% 반투명 CRISIS_RED가 theme.bg 위에 얹히는 구조라 실제 배경은
  // 테마별로 크게 다르다(라이트: 거의 흰색, 다크: 거의 검정에 가까운 진한 색).
  // theme.text 대비 WCAG AA(4.5:1) 검증: 라이트 ≈13.6:1, 다크 ≈16.9:1 — 모두 통과.
  // SYS.TEXT_LIGHT(항상 흰색) 사용 시 라이트 테마에서 ≈1.3:1로 실패했던 지점.
  // SYS.CRISIS_RED도 라이트 테마에서 ≈2.9:1로 AA 기준 미달이라 제외.
  crisisDesc: { ...TYPOGRAPHY.caption, color: theme.text, lineHeight: 20 },
  crisisDismiss: {
    alignSelf: 'flex-end',
    backgroundColor: SYS.CRISIS_RED,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  crisisDismissText: { ...TYPOGRAPHY.caption, color: SYS.TEXT_LIGHT },

  // 룸 목록 화면 헤더 (인스타 DM 스타일 — 타이틀 + 아이콘)
  dmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  dmHeaderTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    fontWeight: '700',
    color: theme.text,
  },
  dmHeaderIcons: { flexDirection: 'row', gap: 4 },
  dmHeaderBtn: { padding: 8 },

  // 연애 초기 모드 토글(구버전 기능 이식) — 룸 목록 헤더 아래, 구분선 위 배치
  earlyModeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  earlyModeLabel: { ...TYPOGRAPHY.caption, color: theme.textMuted },

  // 룸 목록 아이템 (인스타 DM 스타일 — 플랫 리스트)
  dmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    gap: 14,
  },
  // sigma 전용 — GlassPanel(카드 안에 카드 방지를 위한 얇은 외곽 래퍼)이 margin/radius를,
  // 이 스타일(dmItem에서 margin만 뺀 버전)이 내부 콘텐츠 padding/레이아웃을 담당한다.
  // GlassPanel에 padding까지 있는 스타일을 그대로 넘기면 블러 표면 자체가 안으로
  // 줄어들어(그 안의 텍스트는 여백 없이 유리 테두리에 바싹 붙어 보임) 이렇게 분리한다.
  dmItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 14,
  },
  dmAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dmAvatarText: { fontSize: 24 },
  dmOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: theme.bg,
  },
  dmContent: { flex: 1, gap: 4 },
  dmTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dmName: { fontSize: 15, fontWeight: '600', color: theme.text },
  dmNameSigma: { color: '#FFFFFF', ...sigmaTextShadow },
  dmTime: { ...TYPOGRAPHY.caption, color: theme.textMuted },
  dmPreview: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  dmPreviewSigma: { color: '#FFFFFF', ...sigmaTextShadow },

  // 룸 안 채팅 화면 헤더 (뒤로가기 + 룸 아바타/이름)
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
    backgroundColor: theme.bg,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  chatHeaderCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  chatHeaderAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chatHeaderAvatarText: { fontSize: 16 },
  chatHeaderName: { fontSize: 16, fontWeight: '600', color: theme.text },
  chatHeaderSub: { fontSize: 11, color: theme.textMuted, marginTop: 1 },

  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placeholderIcon: { fontSize: 32 },
  placeholderText: { fontSize: 15, color: SYS.TEXT_MUTED, textAlign: 'center' },
  messageList: { flex: 1 },
  messageListContent: { padding: 16, gap: 8 },

  // 연인방 잠금 화면 — 초대 코드 인라인 CTA
  loverLockScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
    position: 'relative',
  },
  loverLockGlow: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255, 189, 189, 0.08)',
    top: '20%',
  },
  loverLockIcon: {
    fontSize: 56,
  },
  loverLockTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
    lineHeight: 32,
  },
  loverLockDesc: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  // sigma에서는 이 배경을 뚫어서, GlassPanel(블러+테두리)이 유일한 카드 레이어가 되게 한다
  // ("카드 안에 카드" 이중 레이어 방지 — GlassPanel은 전달받은 style의 borderRadius를
  // 그대로 채택하므로 이 스타일 객체를 그대로 재사용해도 모양이 어긋나지 않는다).
  loverCodeCard: {
    backgroundColor: isSigma ? 'transparent' : theme.card,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 6,
    borderWidth: isSigma ? 0 : 0.5,
    borderColor: 'rgba(255, 189, 189, 0.20)',
    width: '100%',
  },
  loverCodeLabel: {
    fontSize: 11,
    color: isSigma ? '#FFFFFF' : theme.textMuted,
    letterSpacing: 1,
    ...sigmaTextShadow,
  },
  loverCodeValue: {
    fontSize: 24,
    fontWeight: '900',
    // PINK는 아우라의 웜톤 그룹과 색상대가 겹칠 수 있어 sigma에서는 흰색+textShadow로 대체.
    color: isSigma ? '#FFFFFF' : BRAND.PINK,
    letterSpacing: 4,
    ...sigmaTextShadow,
  },
  loverShareBtn: {
    backgroundColor: BRAND.PINK,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  // GlassButton은 자체 borderRadius(22)/padding을 쓰므로, 전달하는 style은 레이아웃 속성만
  // 남긴다(backgroundColor/borderRadius/paddingVertical을 넘기면 모양이 어긋난다).
  loverShareBtnGlass: {
    width: '100%',
  },
  loverShareBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    ...sigmaTextShadow,
  },
  loverSettingsBtn: {
    paddingVertical: 8,
  },
  loverSettingsBtnText: {
    fontSize: 13,
    color: theme.textMuted,
    textAlign: 'center',
  },

  // 분석가 룸 — 주간 리포트(§6)
  reportSection: { maxHeight: 320 },
  reportCard: { backgroundColor: isSigma ? 'transparent' : theme.card, borderRadius: 16, padding: 16, gap: 8, margin: 8 },
  reportTitle: { ...TYPOGRAPHY.bodyMedium, color: theme.text },
  reportPeriod: { ...TYPOGRAPHY.caption, color: theme.textMuted },
  reportStats: { flexDirection: 'row', gap: 12 },
  reportStatText: { ...TYPOGRAPHY.label, color: theme.text },
  reportSummary: { ...TYPOGRAPHY.body, color: theme.text, lineHeight: 22 },
  premiumBadge: { backgroundColor: theme.accentSoft, borderRadius: 8, padding: 10 },
  premiumBadgeText: { ...TYPOGRAPHY.caption, color: theme.text },
  reportFull: { ...TYPOGRAPHY.body, color: theme.text, lineHeight: 22 },
  reportEmptyState: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  primaryReportBtn: {
    backgroundColor: BRAND.CORAL,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  // GlassButton은 자체 borderRadius/padding을 쓰므로 레이아웃 속성만 남긴다.
  primaryReportBtnGlass: {},
  primaryReportBtnText: { ...TYPOGRAPHY.button, color: isSigma ? '#FFFFFF' : SYS.TEXT_LIGHT, ...sigmaTextShadow },
  analystBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  analystBtnFlex: {
    flex: 1,
    marginHorizontal: 0,
  },
  generateReportBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.CORAL,
    paddingVertical: 10,
    alignItems: 'center',
  },
  generateReportBtnText: { ...TYPOGRAPHY.label, color: isSigma ? '#FFFFFF' : BRAND.CORAL, ...sigmaTextShadow },

  coachingCard: { backgroundColor: isSigma ? 'transparent' : theme.card, borderRadius: 16, padding: 16, gap: 10, margin: 8 },
  coachingTitle: { ...TYPOGRAPHY.bodyMedium, color: theme.text },
  // theme.accent는 오라 벡터마다 임의의 hue를 가져(§1.3) 배경(같은 오라 색 계열)과
  // 대비가 보장되지 않으므로, sigma에서는 GlassButton과 동일하게 흰색+textShadow로 고정.
  coachingSection: { ...TYPOGRAPHY.label, color: isSigma ? '#FFFFFF' : theme.accent, marginTop: 4, ...sigmaTextShadow },
  coachingItem: { ...TYPOGRAPHY.body, color: theme.text, paddingLeft: 8 },
  challengeBox: { backgroundColor: isSigma ? 'rgba(255,255,255,0.10)' : theme.accentSoft, borderRadius: 12, padding: 12, gap: 6 },
  challengeTitle: { ...TYPOGRAPHY.label, color: isSigma ? '#FFFFFF' : theme.accent, ...sigmaTextShadow },
  challengeText: { ...TYPOGRAPHY.body, color: theme.text },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, paddingHorizontal: 16, gap: 8 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowTwin: { justifyContent: 'flex-start' },
  msgAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  bubble: { maxWidth: 280, padding: 12, paddingHorizontal: 16 },
  bubbleMe: {
    backgroundColor: BRAND.CORAL,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    padding: 11,
    paddingHorizontal: 15,
    maxWidth: 280,
  },
  bubbleTwin: {
    backgroundColor: theme.card,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 11,
    paddingHorizontal: 15,
    maxWidth: 280,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  bubbleText: { fontSize: 14, lineHeight: 21, color: '#FFFFFF' },
  msgTime: { ...TYPOGRAPHY.caption, color: theme.textMuted, marginTop: 4, paddingHorizontal: 4 },

  sensitiveWarning: {
    backgroundColor: 'rgba(255, 200, 0, 0.15)',
    borderTopWidth: 1,
    borderTopColor: '#FFB800',
    padding: 10,
    paddingHorizontal: 16,
  },
  sensitiveWarningText: {
    ...TYPOGRAPHY.caption,
    color: '#FFB800',
  },

  limitBanner: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
  },
  limitBannerText: {
    fontSize: 11,
    color: theme.textMuted,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 10,
    gap: 8,
    borderTopWidth: 0.5,
    borderTopColor: theme.border,
    backgroundColor: theme.bg,
  },
  museBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  museBtnText: {
    fontSize: 18,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 42,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  input: {
    ...TYPOGRAPHY.body,
    color: theme.text,
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BRAND.CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: 'rgba(255, 164, 164, 0.25)' },
  });
}
