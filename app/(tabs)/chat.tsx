// ─── FUN-CHA — 채팅 탭 3룸 구조, 인스타그램 DM 스타일 (MASTER.md §4) ────────────
// 룸1 연인방(lover) — 실제 사람, 연인 미연동 시 §0.3 싱글플레이어 원칙에 따라 잠금.
// 룸2 트윈방(twin) — 나를 복제한 AI, 내 말투로 실시간 꾸짖고 인정.
// 룸3 분석가방(analyst) — 냉정한 제3자 전문가 톤, 패턴 분석.
// activeChatRoom=null이면 룸 목록(인박스), 값이 있으면 해당 룸 채팅 화면.
// 실제 AI 연동(§4.3 이하)은 TODO — 지금은 전송 시 고정 스텁 메시지만 추가한다.

import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ActivityIndicator, Alert } from 'react-native';
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
import { callLLM } from '@/api/llm';
import { scheduleLocalNotification } from '@/services/notificationService';
import { generateWeeklyReport, getLastReport, type WeeklyReport } from '@/services/weeklyReportService';
import type { ClassifierMessage } from '@/engine/eventClassifier';
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
  const styles = makeStyles(theme);
  const isPartnerConnected = useCoupleStore((s) => s.isPartnerConnected);
  const activeChatRoom = useSessionStore((s) => s.activeChatRoom);
  const setActiveChatRoom = useSessionStore((s) => s.setActiveChatRoom);
  const isCrisisMode = useSessionStore((s) => s.isCrisisMode);
  const setCrisisMode = useSessionStore((s) => s.setCrisisMode);
  const name = useUserStore((s) => s.name);
  const monthlyChatCount = useUserStore((s) => s.monthlyChatCount);
  const setMonthlyChatCount = useUserStore((s) => s.setMonthlyChatCount);
  const { hasReportAccess, hasDeepChatAccess } = usePremiumGate();
  const { processMessage } = useMatchEngine();
  const [chatHistory, setChatHistory] = useState<ClassifierMessage[]>([]);

  const [messagesByRoom, setMessagesByRoom] = useState<Record<RoomKey, ChatMessage[]>>({
    lover: [],
    twin: [],
    analyst: [],
  });
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const [lastReport, setLastReport] = useState<WeeklyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const currentRoom = activeChatRoom as RoomKey | null;
  const isLoverLocked = currentRoom === 'lover' && !isPartnerConnected;
  const messages = currentRoom ? messagesByRoom[currentRoom] : [];

  useEffect(() => {
    if (currentRoom === 'analyst') {
      getLastReport().then(setLastReport);
    }
  }, [currentRoom]);

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

    // 트윈 AI 응답 생성
    let replyText = '...';
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
        systemPrompt = `너는 ${name ?? '사용자'}의 완벽한 복제 AI야.
${name ?? '사용자'}의 말투, 성격, 감정 패턴을 최대한 그대로 흉내 내.
에니어그램 유형: ${personaMatrix?.enneagramType ?? '미확정'}
toneVector가 있다면 그 말투 패턴을 적극 반영해.
반말로 짧게 1문장으로만 답해. 이모티콘 자주 써.
${toneSummary}`;
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

      const response = await callLLM({
        systemPrompt,
        userMessage: inputText.trim(),
        maxTokens: 200,
      });
      replyText = response.content;
    } catch (e) {
      console.error('LLM 호출 실패:', e);
      replyText = detections.length > 0
        ? `[${detections[0].label}] 감지됐어요`
        : '응, 들었어 💙';
    }

    // 앱이 백그라운드일 때만 알림 (포그라운드에서는 화면에 바로 보임)
    // AppState로 백그라운드 감지는 복잡하므로 일단 항상 발송 (TODO)
    if (replyText) {
      await scheduleLocalNotification('트윈의 메시지', replyText.slice(0, 50));
    }

    const twinMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'twin',
      text: replyText,
      timestamp: Date.now() + 1,
    };

    setMessagesByRoom((prev) => ({
      ...prev,
      [currentRoom]: [...prev[currentRoom], twinMsg],
    }));
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

  function renderListHeader() {
    return (
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
                <Text style={[styles.dmName, room.locked && { color: '#555' }]}>
                  {room.label}
                </Text>
                {room.locked && <Text style={styles.dmTime}>초대 필요</Text>}
              </View>
              <Text style={[styles.dmPreview, room.locked && { color: '#333' }]} numberOfLines={1}>
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
                      <View style={[styles.bubble, msg.role === 'me' ? styles.bubbleMe : styles.bubbleTwin]}>
                        <Text style={[styles.bubbleText, msg.role !== 'me' && { color: theme.text }]}>{msg.text}</Text>
                      </View>
                      <Text style={[styles.msgTime, msg.role === 'me' && { textAlign: 'right' }]}>
                        {formatTime(msg.timestamp)}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {currentRoom === 'analyst' && (
              <TouchableOpacity
                style={styles.generateReportBtn}
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

            <View style={styles.inputBar}>
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
  crisisDesc: { ...TYPOGRAPHY.caption, color: SYS.TEXT_LIGHT, lineHeight: 20 },
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
  dmTime: { ...TYPOGRAPHY.caption, color: '#555' },
  dmPreview: { ...TYPOGRAPHY.caption, color: '#666' },

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
  chatHeaderSub: { ...TYPOGRAPHY.caption, color: '#555' },

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

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, paddingHorizontal: 16, gap: 8 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowTwin: { justifyContent: 'flex-start' },
  msgAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  bubble: { maxWidth: 280, padding: 12, paddingHorizontal: 16 },
  bubbleMe: { backgroundColor: BRAND.CORAL, borderRadius: 20, borderBottomRightRadius: 4 },
  bubbleTwin: { backgroundColor: theme.card, borderRadius: 20, borderBottomLeftRadius: 4 },
  bubbleText: { ...TYPOGRAPHY.body, color: SYS.TEXT_LIGHT },
  msgTime: { ...TYPOGRAPHY.caption, color: '#555', marginTop: 4, paddingHorizontal: 4 },

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
