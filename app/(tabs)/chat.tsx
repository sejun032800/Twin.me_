// ─── FUN-CHA — 채팅 탭 3룸 구조, 인스타그램 DM 스타일 (MASTER.md §4) ────────────
// 룸1 연인방(lover) — 실제 사람, 연인 미연동 시 §0.3 싱글플레이어 원칙에 따라 잠금.
// 룸2 트윈방(twin) — 나를 복제한 AI, 내 말투로 실시간 꾸짖고 인정.
// 룸3 분석가방(analyst) — 냉정한 제3자 전문가 톤, 패턴 분석.
// activeChatRoom=null이면 룸 목록(인박스), 값이 있으면 해당 룸 채팅 화면.
// 트윈 AI 응답: Gemini 2.5 Flash (Supabase Edge Function 프록시, 스트리밍 방식)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ActivityIndicator, Alert, Switch, AppState } from 'react-native';
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
import { callLLMStream } from '@/api/llm';
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
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

const FREE_MONTHLY_LIMIT = 4;

type RoomKey = 'lover' | 'twin' | 'analyst';

interface ChatMessage {
  id: string;
  role: 'me' | 'twin';
  text: string;
  timestamp: number;
}

export default function Chat() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isPartnerConnected = useCoupleStore((s) => s.isPartnerConnected);
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

  useFocusEffect(useCallback(() => {
    setAuraScreenKey('chat');
  }, [setAuraScreenKey]));
  const [showMirrorModal, setShowMirrorModal] = useState(false);
  const name = useUserStore((s) => s.name);
  const monthlyChatCount = useUserStore((s) => s.monthlyChatCount);
  const setMonthlyChatCount = useUserStore((s) => s.setMonthlyChatCount);
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
      locked: !isPartnerConnected,
    },
    {
      key: 'twin' as ActiveChatRoom,
      label: '트윈',
      subtitle: '나를 닮은 AI와 솔직하게 대화해요',
      icon: name ? name[0] : 'T',
      color: BRAND.MINT,
      locked: false,
    },
    {
      key: 'analyst' as ActiveChatRoom,
      label: '분석가',
      subtitle: '우리 대화 패턴을 함께 들여다봐요',
      icon: '📊',
      color: BRAND.CORAL,
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

    // §9.3 — 트윈방/분석가방은 무료 플랜 월 4회 제한 (Deep Talk Night만 무제한)
    const isGatedRoom = currentRoom === 'twin' || currentRoom === 'analyst';
    if (isGatedRoom && !hasDeepChatAccess && monthlyChatCount >= FREE_MONTHLY_LIMIT) {
      Alert.alert(
        '이번 달 대화 한도',
        '무료 플랜은 이번 달 4회 대화가 가능해요.\nCoffee Talk으로 업그레이드하면 30회까지!',
        [{ text: '확인' }],
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
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>🔒</Text>
          <Text style={styles.placeholderText}>연인을 초대해야 이용할 수 있어요</Text>
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
      return (
        <View style={styles.reportCard}>
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
        </View>
      );
    }

    return (
      <View style={styles.reportEmptyState}>
        <Text style={styles.placeholderText}>아직 이번 주 리포트가 없어요</Text>
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
      </View>
    );
  }

  function renderCoachingSection() {
    if (!coachingReport) return null;
    const { weekSummary, strengthPoints, growthPoints, thisWeekChallenge } = coachingReport;

    return (
      <View style={styles.coachingCard}>
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
      </View>
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
        {ROOMS.map((room) => (
          <TouchableOpacity
            key={room.key}
            style={styles.dmItem}
            onPress={() => !room.locked && setActiveChatRoom(room.key)}
            activeOpacity={room.locked ? 1 : 0.7}
          >
            <View style={[styles.dmAvatar, { backgroundColor: room.color + '40' }]}>
              <Text style={styles.dmAvatarText}>{room.icon}</Text>
              {!room.locked && <View style={[styles.dmOnlineDot, { backgroundColor: room.color }]} />}
            </View>

            <View style={styles.dmContent}>
              <View style={styles.dmTop}>
                <Text style={[styles.dmName, room.locked && { color: theme.textMuted }]}>
                  {room.label}
                </Text>
                {room.locked && <Text style={styles.dmTime}>초대 필요</Text>}
              </View>
              <Text style={[styles.dmPreview, room.locked && { color: theme.textMuted }]} numberOfLines={1}>
                {room.subtitle}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
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
              </View>
            )}

            {sensitiveWarning && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.sensitiveWarning}>
                <Text style={styles.sensitiveWarningText}>💛 {sensitiveWarning}</Text>
              </Animated.View>
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

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.bg },
  container: { flex: 1, backgroundColor: theme.bg },

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
    paddingTop: 8,
    paddingBottom: 16,
  },
  dmHeaderTitle: { ...TYPOGRAPHY.title, color: theme.text },
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
    paddingVertical: 14,
    gap: 14,
  },
  dmAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
  dmName: { ...TYPOGRAPHY.bodyMedium, color: theme.text },
  dmTime: { ...TYPOGRAPHY.caption, color: theme.textMuted },
  dmPreview: { ...TYPOGRAPHY.caption, color: theme.textMuted },

  // 룸 안 채팅 화면 헤더 (뒤로가기 + 룸 아바타/이름)
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  chatHeaderCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  chatHeaderAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chatHeaderAvatarText: { fontSize: 16 },
  chatHeaderName: { ...TYPOGRAPHY.bodyMedium, color: theme.text },
  chatHeaderSub: { ...TYPOGRAPHY.caption, color: theme.textMuted },

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

  // 분석가 룸 — 주간 리포트(§6)
  reportSection: { maxHeight: 320 },
  reportCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, gap: 8, margin: 8 },
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
  primaryReportBtnText: { ...TYPOGRAPHY.button, color: SYS.TEXT_LIGHT },
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
  generateReportBtnText: { ...TYPOGRAPHY.label, color: BRAND.CORAL },

  coachingCard: { backgroundColor: theme.card, borderRadius: 16, padding: 16, gap: 10, margin: 8 },
  coachingTitle: { ...TYPOGRAPHY.bodyMedium, color: theme.text },
  coachingSection: { ...TYPOGRAPHY.label, color: theme.accent, marginTop: 4 },
  coachingItem: { ...TYPOGRAPHY.body, color: theme.text, paddingLeft: 8 },
  challengeBox: { backgroundColor: theme.accentSoft, borderRadius: 12, padding: 12, gap: 6 },
  challengeTitle: { ...TYPOGRAPHY.label, color: theme.accent },
  challengeText: { ...TYPOGRAPHY.body, color: theme.text },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, paddingHorizontal: 16, gap: 8 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowTwin: { justifyContent: 'flex-start' },
  msgAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  bubble: { maxWidth: 280, padding: 12, paddingHorizontal: 16 },
  bubbleMe: { backgroundColor: BRAND.CORAL, borderRadius: 20, borderBottomRightRadius: 4 },
  bubbleTwin: { backgroundColor: theme.card, borderRadius: 20, borderBottomLeftRadius: 4 },
  bubbleText: { ...TYPOGRAPHY.body, color: SYS.TEXT_LIGHT },
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

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
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
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
  },
  input: {
    ...TYPOGRAPHY.body,
    color: theme.text,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND.CORAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: theme.card },
  });
}
