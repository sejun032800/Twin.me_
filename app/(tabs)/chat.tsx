// ─── FUN-CHA — 채팅 탭 3룸 구조, 인스타그램 DM 스타일 (MASTER.md §4) ────────────
// 룸1 연인방(lover) — 실제 사람, 연인 미연동 시 §0.3 싱글플레이어 원칙에 따라 잠금.
// 룸2 트윈방(twin) — 나를 복제한 AI, 내 말투로 실시간 꾸짖고 인정.
// 룸3 분석가방(analyst) — 냉정한 제3자 전문가 톤, 패턴 분석.
// activeChatRoom=null이면 룸 목록(인박스), 값이 있으면 해당 룸 채팅 화면.
// 실제 AI 연동(§4.3 이하)은 TODO — 지금은 전송 시 고정 스텁 메시지만 추가한다.

import { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useCoupleStore } from '@/store/coupleStore';
import { useSessionStore } from '@/store/sessionStore';
import { useUserStore } from '@/store/userStore';
import { useMatchEngine } from '@/hooks/useMatchEngine';
import { callLLM } from '@/api/llm';
import type { ClassifierMessage } from '@/engine/eventClassifier';
import { BRAND, SYS } from '@/constants/colors';
import { TYPOGRAPHY } from '@/constants/typography';

type RoomKey = 'lover' | 'twin' | 'analyst';

interface ChatMessage {
  id: string;
  role: 'me' | 'twin';
  text: string;
  timestamp: number;
}

const ROOM_LABELS: Record<RoomKey, string> = {
  lover: '연인',
  twin: '트윈',
  analyst: '분석가',
};

const ROOM_ORDER: RoomKey[] = ['lover', 'twin', 'analyst'];

export default function Chat() {
  const isPartnerConnected = useCoupleStore((s) => s.isPartnerConnected);
  const activeChatRoom = useSessionStore((s) => s.activeChatRoom);
  const setActiveChatRoom = useSessionStore((s) => s.setActiveChatRoom);
  const name = useUserStore((s) => s.name);
  const { processMessage } = useMatchEngine();
  const [chatHistory, setChatHistory] = useState<ClassifierMessage[]>([]);
  const headerHeight = useHeaderHeight();

  const [messagesByRoom, setMessagesByRoom] = useState<Record<RoomKey, ChatMessage[]>>({
    lover: [],
    twin: [],
    analyst: [],
  });
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const currentRoom = activeChatRoom as RoomKey | null;
  const isLoverLocked = currentRoom === 'lover' && !isPartnerConnected;
  const messages = currentRoom ? messagesByRoom[currentRoom] : [];

  async function handleSend() {
    if (!currentRoom || !inputText.trim() || isLoverLocked) return;

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
      const { name, personaMatrix } = useUserStore.getState();
      const systemPrompt = `너는 ${name ?? '사용자'}의 트윈 AI야.
${name ?? '사용자'}의 말투와 성격을 그대로 흉내 내서 대화해.
규칙:
- 반말로 짧게 1문장으로만 답해
- 이모티콘 가끔 써
- 질문엔 질문으로 받아쳐
- 너무 친절하거나 AI스럽게 말하지 마
에니어그램 유형: ${personaMatrix?.enneagramType ?? '미확정'}`;

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

  function getPreview(key: RoomKey): string {
    const msgs = messagesByRoom[key];
    if (msgs.length > 0) return msgs[msgs.length - 1].text;
    if (key === 'lover') return isPartnerConnected ? '연인과 대화해보세요' : '연인을 초대해야 이용할 수 있어요';
    if (key === 'twin') return '트윈 AI와 대화하세요';
    return '대화 패턴을 분석해드려요';
  }

  function renderAvatar(key: RoomKey) {
    if (key === 'lover') {
      return (
        <View style={[styles.avatar, { backgroundColor: BRAND.PINK }]}>
          <Text style={styles.avatarText}>{isPartnerConnected ? '연' : '🔒'}</Text>
        </View>
      );
    }
    if (key === 'twin') {
      const initial = name?.trim() ? name.trim()[0] : '트';
      return (
        <View style={[styles.avatar, { backgroundColor: BRAND.MINT }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.avatar, { backgroundColor: BRAND.CORAL }]}>
        <Text style={styles.avatarText}>AI</Text>
      </View>
    );
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
    if (currentRoom === 'analyst') {
      return (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>대화 패턴을 분석해드려요</Text>
        </View>
      );
    }
    return null;
  }

  function renderHeader() {
    return (
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {currentRoom && (
            <TouchableOpacity style={styles.headerBackBtn} onPress={() => setActiveChatRoom(null)}>
              <Text style={styles.headerIcon}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{currentRoom ? ROOM_LABELS[currentRoom] : '채팅'}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Text style={styles.headerIcon}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Text style={styles.headerIcon}>🔍</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderRoomList() {
    return (
      <ScrollView bounces={true} alwaysBounceVertical={true}>
        {ROOM_ORDER.map((key) => (
          <TouchableOpacity key={key} style={styles.listItem} onPress={() => setActiveChatRoom(key)}>
            {renderAvatar(key)}
            <View style={styles.listItemBody}>
              <Text style={styles.listItemName}>{ROOM_LABELS[key]}</Text>
              <Text style={styles.listItemPreview} numberOfLines={1}>{getPreview(key)}</Text>
            </View>
            <Text style={styles.listItemTime}>{''}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  function renderChatScreen() {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
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
            {messages.map((msg) => {
              const fromMe = msg.role === 'me';
              return (
                <View
                  key={msg.id}
                  style={[styles.bubbleRow, fromMe ? styles.bubbleRowMe : styles.bubbleRowOther]}
                >
                  <View style={[styles.bubble, fromMe ? styles.bubbleMe : styles.bubbleOther]}>
                    <Text style={styles.bubbleText}>{msg.text}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={[styles.input, isLoverLocked && styles.inputDisabled]}
            placeholder={isLoverLocked ? '입력할 수 없어요' : `${name ?? '나'}로 메시지 보내기`}
            placeholderTextColor="#888"
            value={inputText}
            onChangeText={setInputText}
            editable={!isLoverLocked}
          />
          <TouchableOpacity
            style={[styles.sendBtn, isLoverLocked && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={isLoverLocked}
          >
            <Text style={styles.sendBtnText}>전송</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        {renderHeader()}
        {currentRoom === null ? renderRoomList() : renderChatScreen()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT },
  container: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SYS.BG_DARK_MIDNIGHT,
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBackBtn: { paddingRight: 4 },
  headerTitle: { ...TYPOGRAPHY.heading, color: SYS.TEXT_LIGHT },
  headerRight: { flexDirection: 'row', gap: 16 },
  headerIconBtn: { paddingHorizontal: 4 },
  headerIcon: { fontSize: 20, color: SYS.TEXT_LIGHT },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: SYS.TEXT_DARK },
  listItemBody: { flex: 1, gap: 2 },
  listItemName: { fontSize: 15, fontWeight: 'bold', color: SYS.TEXT_LIGHT },
  listItemPreview: { fontSize: 13, color: '#888' },
  listItemTime: { fontSize: 12, color: '#888' },

  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  placeholderIcon: { fontSize: 32 },
  placeholderText: { fontSize: 15, color: '#888', textAlign: 'center' },
  messageList: { flex: 1 },
  messageListContent: { padding: 16, gap: 8 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, marginVertical: 4 },
  bubbleMe: { backgroundColor: BRAND.CORAL },
  bubbleOther: { backgroundColor: SYS.CARD_DARK },
  bubbleText: { ...TYPOGRAPHY.body, color: SYS.TEXT_LIGHT },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 0 : 8,
    borderTopWidth: 1,
    borderTopColor: SYS.CARD_DARK,
  },
  input: {
    ...TYPOGRAPHY.body,
    flex: 1,
    backgroundColor: SYS.CARD_DARK,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: SYS.TEXT_LIGHT,
  },
  inputDisabled: { opacity: 0.5 },
  sendBtn: {
    backgroundColor: BRAND.CORAL,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendBtnDisabled: { backgroundColor: SYS.CARD_DARK },
  sendBtnText: { fontSize: 14, fontWeight: 'bold', color: SYS.TEXT_LIGHT },
});
