# 6 Sigma 테마 — 메시 그라데이션 배경 구현 명세

## 목표
`auraEngine.buildAuraVector()`가 산출한 6개 `meshStops`(AuraChannel[])를
두 번째 사진처럼 6색이 부드럽게 번지는 메시 그라데이션 배경으로 렌더링한다.

---

## 1. 구현 방식: SVG RadialGradient 6개 겹치기

`react-native-svg`(이미 설치됨)의 `Svg` + `Defs` + `RadialGradient` + `Rect` 조합으로
각 축 색상을 화면 곳곳에 원형으로 배치하고 서로 자연스럽게 blend한다.

### 각 RadialGradient 배치 위치 (6개 고정 포인트)

| 인덱스 | cx | cy | 설명 |
|---|---|---|---|
| 0 (attachmentSecurity) | 20% | 20% | 좌상단 |
| 1 (conflictResponse) | 80% | 15% | 우상단 |
| 2 (expressiveness) | 50% | 50% | 중앙 |
| 3 (independence) | 15% | 75% | 좌하단 |
| 4 (spontaneity) | 85% | 70% | 우하단 |
| 5 (trustPace) | 50% | 90% | 하단 중앙 |

각 RadialGradient:
- r="60%" (퍼짐 반경)
- 내부 색상: `hsl(hue, saturation%, lightness%)` opacity 0.7
- 외부 색상: 동일 hsl opacity 0.0 (투명으로 fade)

### SVG 레이어 구조
```
<Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
  <Defs>
    {meshStops.map((channel, i) => (
      <RadialGradient
        key={i}
        id={`rg${i}`}
        cx={CX_POSITIONS[i]}
        cy={CY_POSITIONS[i]}
        r="60%"
      >
        <Stop offset="0%" stopColor={auraChannelToCss(channel)} stopOpacity="0.7" />
        <Stop offset="100%" stopColor={auraChannelToCss(channel)} stopOpacity="0" />
      </RadialGradient>
    ))}
  </Defs>
  {/* 베이스 배경: 매우 어두운 단색 */}
  <Rect width="100%" height="100%" fill="#050810" />
  {/* 6색 메시 레이어 — add blend */}
  {meshStops.map((_, i) => (
    <Rect key={i} width="100%" height="100%" fill={`url(#rg${i})`} />
  ))}
</Svg>
```

---

## 2. src/components/AuraMeshBackground.tsx 신규 생성

props:
```typescript
interface Props {
  auraVector: AuraVector | null;
  screenKey?: AuraScreenKey;  // 화면별 opacity 조절용
  children: React.ReactNode;
}
```

동작:
- `auraVector`가 null이면 베이스 배경(`#050810`)만 렌더링하고 children 표시
- `auraVector`가 있으면 `meshStops` 6개로 SVG 메시 그라데이션 렌더링
- `screenKey`에 따라 `computeAuraOpacity()`로 전체 SVG opacity 조절
  - main: 1.0
  - chat: 0.6
  - settings: 0.8
  - helix: 1.3 (max 1.0으로 클램프)
- 최상단에 반투명 다크 오버레이(`rgba(5, 8, 16, 0.45)`)를 추가로 얹어
  텍스트 가독성을 확보한다.
- children은 SVG 위에 absolute로 올라오도록 View로 감싼다.

구조:
```
<View style={{ flex: 1 }}>
  {/* SVG 메시 그라데이션 레이어 */}
  <Svg style={{ position: 'absolute', width: '100%', height: '100%' }}>
    ...
  </Svg>
  {/* 다크 오버레이 — 가독성 확보 */}
  <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(5,8,16,0.45)' }} />
  {/* 실제 콘텐츠 */}
  <View style={{ flex: 1 }}>
    {children}
  </View>
</View>
```

import:
- `Svg, Defs, RadialGradient, Rect, Stop` from `react-native-svg`
- `auraChannelToCss` from `@/engine/auraEngine`
- `computeAuraOpacity, AuraScreenKey` from `@/engine/auraThemeEngine`
- `AuraVector` from `@/types/genesis`
- `useUserStore` from `@/store/userStore`

---

## 3. src/constants/theme.ts 수정

`buildSigmaTheme()` 함수를 단순화한다.
메시 그라데이션 배경은 `AuraMeshBackground`가 담당하므로,
`theme.ts`는 카드/텍스트/탭바 등 UI 요소 색상만 담당한다.

dominant 축 선택 로직은 유지하되,
bg/card 계열 색상을 아래로 교체:

```
bg: 'transparent'  // AuraMeshBackground가 배경 담당
bgSecondary: 'transparent'
card: `hsla(${dominantHue}, ${dominantSat * 0.3}%, 15%, 0.75)`  // 반투명 카드
accent: `hsl(${dominantHue}, ${dominantSat}%, ${dominantLight}%)`
accentSoft: `hsla(${dominantHue}, ${dominantSat * 0.4}%, 25%, 0.6)`
text: '#FFFFFF'
textMuted: `hsl(${dominantHue}, 20%, 70%)`
border: `hsla(${dominantHue}, ${dominantSat * 0.4}%, 50%, 0.25)`
tabBar: `hsla(${dominantHue}, ${dominantSat * 0.3}%, 8%, 0.9)`  // 반투명 탭바
```

카드가 반투명이어야 배경 그라데이션이 비쳐 보인다.

---

## 4. 각 탭 화면에 AuraMeshBackground 적용

아래 파일들에서 최상위 SafeAreaView를 AuraMeshBackground로 감싸거나 교체한다.

### app/(tabs)/index.tsx
- SafeAreaView의 backgroundColor를 제거
- AuraMeshBackground로 전체 감싸기
- screenKey='main'

### app/(tabs)/chat.tsx  
- SafeAreaView의 backgroundColor를 제거
- AuraMeshBackground로 감싸기
- screenKey='chat'

### app/(tabs)/history.tsx
- 동일하게 적용
- screenKey='helix' (아카이브 탭 활성 시) 또는 'historyMap'

### app/(tabs)/settings.tsx
- 동일하게 적용
- screenKey='settings'

### app/(tabs)/_layout.tsx
- tabBarStyle의 backgroundColor → theme.tabBar (반투명)
- tabBarStyle에 `borderTopColor: theme.border` 적용

---

## 5. theme.ts의 getDefaultDarkTheme() 수정

6 Sigma 미적용 시(제네시스 미완료) 다크 폴백:
- bg: 'transparent' (배경은 AuraMeshBackground가 단순 어두운 배경 렌더링)
- card: 'rgba(30, 41, 59, 0.85)'
- tabBar: 'rgba(10, 13, 26, 0.95)'
- accent: '#FFA4A4'
- border: 'rgba(30, 41, 59, 0.8)'

---

## 6. 주의사항

- `StyleSheet.create()` 안에 동적 색상 불가 → inline style 또는 makeStyles 패턴 유지
- SVG는 Expo Go에서 정상 동작 확인됨 (react-native-svg 이미 설치)
- `react-native-svg`의 `RadialGradient`에서 cx/cy는 문자열 `"20%"` 형태로 전달
- 채도/명도가 높은 meshStops 색상이 너무 강하면 다크 오버레이 opacity를 0.45→0.55로 조정
- `AuraMeshBackground`는 auth 화면(온보딩)에는 적용하지 않는다 (MASTER §1.3 other=0.0)

---

## 완료 후 검증

1. `npx tsc --noEmit` 에러 0건
2. Expo Go에서 제네시스 완료 후 각 탭 진입 시 메시 그라데이션 배경 확인
3. 텍스트/카드 가독성 확인 (다크 오버레이로 충분히 읽힘)
4. 탭 전환 시 배경 색조 변화 확인 (screenKey별 opacity 차이)
