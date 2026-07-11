// auth 화면군(login, signup, join, kakao-upload)은 브랜드 일관성을 위해
// 항상-다크 크롬을 유지합니다. useTheme() 미적용 의도적.

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { runKakaoIngestPipeline } from '@/services/kakaoIngestPipeline';
import { useUserStore } from '@/store/userStore';
import { useCoupleStore } from '@/store/coupleStore';
import { useScoreStore } from '@/store/scoreStore';
import { BRAND, SYS } from '@/constants/colors';

export default function KakaoUpload() {
  const router = useRouter();
  const [uploaded, setUploaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rawText, setRawText] = useState<string | null>(null);

  const name = useUserStore((s) => s.name);
  const mbti = useUserStore((s) => s.mbti);
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

    } catch (e) {
      const isStubError = e instanceof Error &&
        e.message.includes('weeklyReportService');
      if (!isStubError) {
        console.warn('카카오 파이프라인 오류:', e);
      }
      // 스텁 에러는 정상, 그 외 오류도 계속 진행
    } finally {
      setLoading(false);
      router.replace('/(auth)/genesis');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>카카오톡 대화 가져오기</Text>
      <Text style={styles.desc}>
        카카오톡 대화 내보내기(.txt)를 업로드하면{'\n'}
        나를 닮은 트윈 AI가 만들어져요.
      </Text>

      <TouchableOpacity style={styles.uploadBtn} onPress={handlePick}>
        <Text style={styles.uploadBtnText}>
          {uploaded ? '✅ 파일 선택됨' : '📂 파일 선택'}
        </Text>
      </TouchableOpacity>

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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SYS.BG_DARK_MIDNIGHT, padding: 32, justifyContent: 'center', gap: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: BRAND.CORAL },
  desc: { fontSize: 16, color: SYS.TEXT_LIGHT, lineHeight: 24 },
  uploadBtn: { backgroundColor: SYS.CARD_DARK, borderRadius: 14, paddingVertical: 20, alignItems: 'center', borderWidth: 1, borderColor: BRAND.CORAL, borderStyle: 'dashed' },
  uploadBtnText: { fontSize: 16, color: BRAND.CORAL },
  nextBtn: { backgroundColor: BRAND.CORAL, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: SYS.CARD_DARK },
  nextBtnText: { fontSize: 16, fontWeight: 'bold', color: SYS.TEXT_LIGHT },
  skipText: { fontSize: 14, color: SYS.TEXT_MUTED, textAlign: 'center' },
});
