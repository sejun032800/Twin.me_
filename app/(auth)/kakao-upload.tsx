import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { runKakaoIngestPipeline } from '@/services/kakaoIngestPipeline';
import { parseKakaoLine, analyzeD0, type D0Analysis } from '@/lib/kakaoParser';
import D0ResultScreen from '@/components/D0ResultScreen';
import { useUserStore } from '@/store/userStore';
import { useCoupleStore } from '@/store/coupleStore';
import { useScoreStore } from '@/store/scoreStore';
import { useTheme } from '@/hooks/useTheme';
import { SYS } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';

const D0_DATE_HEADER_RE = /(\d{4})년 (\d{1,2})월 (\d{1,2})일/;

export default function KakaoUpload() {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [uploaded, setUploaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rawText, setRawText] = useState<string | null>(null);
  const [d0Analysis, setD0Analysis] = useState<D0Analysis | null>(null);
  const [showD0, setShowD0] = useState(false);

  const name = useUserStore((s) => s.name);
  const mbti = useUserStore((s) => s.mbti);
  const setHasKakaoData = useUserStore((s) => s.setHasKakaoData);
  const partnerName = useCoupleStore((s) => s.partnerName);
  const eventLog = useScoreStore((s) => s.eventLog);

  async function handlePick() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/plain', 'application/zip', 'application/x-zip-compressed'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    try {
      const asset = result.assets[0];
      const uri = asset.uri;
      const fileName = asset.name ?? '';

      let text: string;

      if (fileName.endsWith('.zip')) {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const zip = await JSZip.loadAsync(base64, { base64: true });

        const txtFile = Object.values(zip.files).find(
          (f) => !f.dir && f.name.endsWith('.txt')
        );

        if (!txtFile) {
          Alert.alert('파일 없음', 'zip 파일 안에 .txt 파일이 없어요.');
          return;
        }

        text = await txtFile.async('string');
      } else {
        text = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      setRawText(text);
      setUploaded(true);
    } catch {
      Alert.alert('파일 읽기 실패', '텍스트 파일을 다시 선택해주세요.');
    }
  }

  async function handleSkip() {
    router.replace('/(auth)/genesis');
  }

  async function handleNext() {
    if (!uploaded || !rawText) return;
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const myProfile = { name: name ?? '나', mbti: mbti ?? undefined };
      const partnerProfile = { name: partnerName ?? '연인' };

      await runKakaoIngestPipeline(
        rawText,
        myProfile,
        partnerProfile,
        [],        // dateCourses: 온보딩 단계라 빈 배열
        eventLog,  // eventHistory: scoreStore의 현재 로그
      );

      // 말투 벡터 저장 (batchSummary 기반)
      // TODO: Phase 5에서 userToneVectorBuilder 연결

      setHasKakaoData(true);
    } catch (e) {
      const isStubError = e instanceof Error &&
        e.message.includes('weeklyReportService');
      if (!isStubError) {
        console.warn('카카오 파이프라인 오류:', e);
      }
      // 스텁 에러는 정상, 그 외 오류도 계속 진행
    }

    // FUN-ONB-003 — D0 표층 즉시 분석: 내 발화 + 타임스탬프 추출 후 로컬 계산
    const myName = name ?? '나';
    const myLines: string[] = [];
    const timestamps: number[] = [];
    let currentDate = new Date();

    for (const raw of rawText.split('\n')) {
      const dateMatch = raw.match(D0_DATE_HEADER_RE);
      if (dateMatch) {
        const [, y, m, d] = dateMatch;
        currentDate = new Date(Number(y), Number(m) - 1, Number(d));
        continue;
      }

      const parsed = parseKakaoLine(raw);
      if (!parsed || parsed.speaker !== myName) continue;

      const ts = new Date(currentDate);
      ts.setHours(parsed.hour, parsed.minute, 0, 0);
      myLines.push(parsed.content);
      timestamps.push(Math.floor(ts.getTime() / 1000));
    }

    setLoading(false);
    setD0Analysis(analyzeD0(myLines, timestamps));
    setShowD0(true);
  }

  if (showD0 && d0Analysis) {
    return (
      <D0ResultScreen
        analysis={d0Analysis}
        onContinue={() => router.replace('/(auth)/genesis')}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View>
        <View style={styles.progressBar} />

        <Text style={styles.heading}>카카오톡 대화 가져오기</Text>
        <Text style={styles.desc}>
          카카오톡 대화 내보내기(.txt)를 업로드하면{'\n'}
          나를 닮은 트윈 AI가 만들어져요.
        </Text>

        <TouchableOpacity style={styles.uploadBtn} onPress={handlePick}>
          <Text style={styles.uploadIcon}>
            {uploaded ? '✅' : '📂'}
          </Text>
          <Text style={styles.uploadBtnText}>
            {uploaded ? '파일 선택됨' : '파일 선택하기'}
          </Text>
          <Text style={styles.uploadBtnSub}>
            {uploaded ? '다시 선택하려면 탭하세요' : '.txt 또는 .zip 파일'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.privacyNote}>
          🔒 상대방 대화는 업로드 즉시 파기됩니다{'\n'}
          원본 파일은 기기에 저장되지 않아요
        </Text>
      </View>

      <View>
        <TouchableOpacity
          style={[styles.nextBtn, !uploaded && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!uploaded || loading}
        >
          {loading
            ? <ActivityIndicator color={SYS.TEXT_LIGHT} />
            : <Text style={styles.nextBtnText}>시작하기</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>나중에 할게요</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
      padding: 28,
      justifyContent: 'space-between',
    },
    progressBar: {
      height: 2,
      width: '75%',
      backgroundColor: '#FFA4A4',
      borderRadius: 1,
      marginBottom: 40,
    },
    heading: {
      fontSize: 24,
      fontWeight: '900',
      color: theme.text,
      lineHeight: 34,
      marginBottom: 8,
    },
    desc: {
      fontSize: 14,
      color: theme.textMuted,
      lineHeight: 22,
      marginBottom: 36,
    },
    uploadBtn: {
      backgroundColor: theme.card,
      borderRadius: 16,
      paddingVertical: 28,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 164, 164, 0.30)',
      borderStyle: 'dashed',
      gap: 10,
      marginBottom: 16,
    },
    uploadIcon: {
      fontSize: 36,
    },
    uploadBtnText: {
      fontSize: 15,
      color: '#FFA4A4',
      fontWeight: '600',
    },
    uploadBtnSub: {
      fontSize: 12,
      color: theme.textMuted,
    },
    privacyNote: {
      fontSize: 11,
      color: theme.textMuted,
      textAlign: 'center',
      lineHeight: 17,
      marginBottom: 8,
    },
    nextBtn: {
      backgroundColor: '#FFA4A4',
      borderRadius: 14,
      paddingVertical: 18,
      alignItems: 'center',
    },
    nextBtnDisabled: {
      backgroundColor: 'rgba(255, 164, 164, 0.20)',
    },
    nextBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    skipText: {
      fontSize: 13,
      color: theme.textMuted,
      textAlign: 'center',
      marginTop: 16,
    },
  });
}
