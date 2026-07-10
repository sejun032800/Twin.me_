// ─── FUN-HIS — OOTD 업로드 시트 (MASTER.md §7, 구버전 OOTDUploadSheet.tsx 이식) ───
// 하단 바텀시트 형태로 갤러리에서 사진을 골라 무드 태그/메모와 함께 저장한다.

import { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Image, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { usePhotoMetadata } from '@/hooks/usePhotoMetadata';
import { saveOOTDEntry } from '@/services/ootdService';
import type { OOTDEntry } from '@/types/ootd';
import { BRAND, SYS } from '@/constants/colors';
import type { SigmaTheme } from '@/constants/theme';
import { TYPOGRAPHY } from '@/constants/typography';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: (entry: OOTDEntry) => void;
}

const MOOD_TAGS = ['#설레는', '#평온한', '#행복한', '#피곤한', '#사랑스러운'];

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function OOTDUploadSheet({ visible, onClose, onSaved }: Props) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { extractMetadata } = usePhotoMetadata();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [dateTaken, setDateTaken] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  function reset() {
    setImageUri(null);
    setMood(null);
    setNote('');
    setDateTaken(null);
    setLatitude(null);
    setLongitude(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '사진을 선택하려면 갤러리 접근 권한이 필요해요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
      exif: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);

      const meta = await extractMetadata(asset.uri, asset.exif);
      setDateTaken(meta.dateTaken);
      setLatitude(meta.latitude);
      setLongitude(meta.longitude);

      if (meta.latitude !== null && meta.longitude !== null) {
        Alert.alert(
          '📍 위치 정보 감지됨',
          '사진에서 위치 정보가 발견됐어요. 함께 저장할까요?',
          [
            { text: '저장 안 함', onPress: () => { setLatitude(null); setLongitude(null); } },
            { text: '저장', style: 'default' },
          ]
        );
      }
    }
  }

  async function handleSave() {
    if (!imageUri || saving) return;
    setSaving(true);
    try {
      const entry: OOTDEntry = {
        id: Date.now().toString(),
        imageUri,
        date: dateTaken ?? todayDateString(),
        mood: mood ?? undefined,
        note: note.trim() || undefined,
        createdAt: new Date().toISOString(),
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
      };
      await saveOOTDEntry(entry);
      onSaved(entry);
      reset();
      onClose();
    } catch {
      Alert.alert('오류', 'OOTD 저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>오늘의 OOTD</Text>

          <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage} activeOpacity={0.85}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>📷 사진 추가</Text>
              </View>
            )}
          </TouchableOpacity>

          {dateTaken && <Text style={styles.dateInfoText}>📅 {dateTaken} (사진에서 추출됨)</Text>}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.moodRow}
          >
            {MOOD_TAGS.map((tag) => {
              const selected = mood === tag;
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.moodChip, selected && styles.moodChipActive]}
                  onPress={() => setMood(selected ? null : tag)}
                >
                  <Text style={[styles.moodChipText, selected && styles.moodChipTextActive]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TextInput
            style={styles.noteInput}
            placeholder="오늘 하루 한 줄..."
            placeholderTextColor={theme.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
          />

          {latitude !== null && longitude !== null && (
            <Text style={styles.locationInfoText}>📍 위치 정보가 감지됐어요</Text>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, !imageUri && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!imageUri || saving}
          >
            <Text style={styles.saveBtnText}>{saving ? '저장 중...' : '저장'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(theme: SigmaTheme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      gap: 16,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: 'center',
    },
    title: {
      ...TYPOGRAPHY.title,
      color: theme.text,
      textAlign: 'center',
    },
    imagePicker: {
      alignSelf: 'center',
      width: 180,
      height: 180,
      borderRadius: 16,
      overflow: 'hidden',
    },
    imagePreview: {
      width: '100%',
      height: '100%',
    },
    imagePlaceholder: {
      width: '100%',
      height: '100%',
      borderRadius: 16,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imagePlaceholderText: {
      ...TYPOGRAPHY.label,
      color: theme.textMuted,
    },
    dateInfoText: {
      ...TYPOGRAPHY.caption,
      color: theme.textMuted,
      textAlign: 'center',
    },
    locationInfoText: {
      ...TYPOGRAPHY.caption,
      color: theme.textMuted,
    },
    moodRow: {
      gap: 8,
    },
    moodChip: {
      backgroundColor: theme.accentSoft,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    moodChipActive: {
      backgroundColor: BRAND.CORAL,
    },
    moodChipText: {
      ...TYPOGRAPHY.caption,
      color: theme.text,
    },
    moodChipTextActive: {
      color: SYS.TEXT_LIGHT,
    },
    noteInput: {
      backgroundColor: theme.bgSecondary,
      borderRadius: 14,
      padding: 14,
      color: theme.text,
      ...TYPOGRAPHY.body,
      minHeight: 48,
      maxHeight: 100,
    },
    saveBtn: {
      backgroundColor: BRAND.CORAL,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
    },
    saveBtnDisabled: {
      opacity: 0.5,
    },
    saveBtnText: {
      ...TYPOGRAPHY.button,
      color: SYS.TEXT_LIGHT,
    },
  });
}
