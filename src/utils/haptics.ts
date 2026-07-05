import * as Haptics from 'expo-haptics';

let lastHapticTime = 0;

export const triggerHaptic = (hapticAction: () => void): void => {
  const now = Date.now();
  // Block calls within 100ms to prevent motor overload and perceptual fatigue
  if (now - lastHapticTime < 100) return;
  lastHapticTime = now;
  try {
    hapticAction();
  } catch {
    // Haptics may be unavailable in simulators or restricted environments
  }
};

// Error 알림이 예고 없이 곧바로 터지면 유저가 놀란다 — 300ms 쿠션을 두어
// 화면으로 "뭔가 잘못됐다"를 먼저 인지한 뒤 몸으로 느끼게 한다.
export const triggerErrorHaptic = (): void => {
  setTimeout(() => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Haptics may be unavailable in simulators or restricted environments
    }
  }, 300);
};

// 인스타 릴스 스크롤처럼, 스와이프가 세그먼트 경계를 넘을 때마다
// 100ms 디바운스로 selectionAsync를 톡- 톡- 튕겨주는 손맛 피드백.
export const triggerSwipeSelectionHaptic = (): void => {
  triggerHaptic(() => Haptics.selectionAsync());
};
