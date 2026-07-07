// ─── 타이포그래피 토큰 (MASTER.md §1.5) ──────────────────────────────────────
// Display/Title: NotoSerifKR (감성적 강조)
// Body/UI: NotoSansKR (가독성)

export const FONTS = {
  // Serif — 로고, 일치율 숫자, 섹션 타이틀
  serifRegular: 'NotoSerifKR-Regular',
  serifBold: 'NotoSerifKR-Bold',
  // Sans — 본문, 버튼, 입력창, 일반 UI
  sansRegular: 'NotoSansKR-Regular',
  sansMedium: 'NotoSansKR-Medium',
  sansBold: 'NotoSansKR-Bold',
} as const;

export const TYPOGRAPHY = {
  // Display — 로고, 일치율 큰 숫자
  display: { fontFamily: FONTS.serifBold, fontSize: 48, letterSpacing: -1 },
  // Title — 화면 제목
  title: { fontFamily: FONTS.serifBold, fontSize: 28 },
  // Heading — 섹션 헤더
  heading: { fontFamily: FONTS.sansBold, fontSize: 20 },
  // Body — 일반 본문
  body: { fontFamily: FONTS.sansRegular, fontSize: 16, lineHeight: 24 },
  // BodyMedium — 강조 본문
  bodyMedium: { fontFamily: FONTS.sansMedium, fontSize: 16, lineHeight: 24 },
  // Caption — 부가 설명
  caption: { fontFamily: FONTS.sansRegular, fontSize: 13, lineHeight: 18 },
  // Button — 버튼 텍스트
  button: { fontFamily: FONTS.sansBold, fontSize: 16 },
  // Label — 탭/섹션 레이블
  label: { fontFamily: FONTS.sansMedium, fontSize: 14 },
} as const;
