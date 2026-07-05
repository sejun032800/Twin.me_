# Twin.me 사후 정합성 검증 — 2026-07-02

이 파일은 12개 구현 프롬프트 적용 후 0630 명세서 기준 사후 정합성 검증 결과다. 정합(코드 수정 불필요) 항목은 제외하고, **후속 작업이 필요한 항목만** 남겼다.

| 기능 ID | 명세서 위치 | 코드 위치 | 판정 | 불일치 상세 | 선행 작업 | 권고 우선순위 | 상태 |
|---|---|---|---|---|---|---|---|
| FUN-HOM-002 | §2 | `app/(tabs)/index.tsx`, `src/components/home/MemoryRingSection.tsx` | 부분 정합 | 스펙의 "추억 링"은 구현됐으나 "상대방 실시간 상태 해시태그 텍스트 바"는 코드에서 확인 불가. 코드 주석은 오버플로우 배너(FUN-HOM-002B 대상)까지 전부 "FUN-HOM-002"로 라벨링해 두 기능이 뒤섞여 표기됨(`index.tsx:5,80,617`) | — | 2 | 대기 |
| FUN-HIS-001 | §6 | `app/(tabs)/history.tsx` (`ArchiveView`/`HelixView` 렌더 L5142-5145, `DateMapView` 정의 L3047-3346·미사용) | 충돌 | 스펙은 "지도(뷰파인더)/DNA나선 2-way 토글"을 요구하나 실제 렌더 트리(L5140-5150)는 ArchiveView·HelixView·MoodFeedView 3-way 스와이프 탭만 렌더링. `DateMapView`와 `HistoryKakaoMapView`(지도 컴포넌트, L39)는 파일에 정의는 되어 있으나 어디서도 호출되지 않는 dead code — 사용자가 지도 뷰에 도달할 UI 경로가 없음 | FUN-HIS-005 | 1 | 긴급 |
| FUN-HIS-002 | §6 | `src/services/dateShuttleService.ts`, `history.tsx` L1581(`DateShuttleModal`) | 확인 필요 | 데이트셔틀 모달 자체는 존재하나, FUN-HIS-001의 지도뷰 유실과 별개로 정상 동작하는 자체 지도 렌더링을 갖는지 이번 검증에서 확인하지 못함 | FUN-HIS-001 | 2 | 대기 |
| FUN-HIS-005 | §6 | `history.tsx` TABS_CONFIG L163-170, `MoodFeedView` L4566, `partnerMoodService.ts` | 부분 정합 | 무드 피드 자체는 구현되었으나, 스펙이 명시한 3분할 라벨 "[추억 월][데이트 지도][무드 피드]"와 달리 실제 라벨은  "[추억 월][나선][무드 피드]"로 "데이트 지도"가 FUN-HIS-001의 DNA 나선으로 대체됨 — 두 기능 스펙이 같은 탭 슬롯을 두고 충돌한 결과로 보임 | FUN-HIS-001 | 1 | 긴급 |
| §8.10 Founding Twin VIP | §8.10 | 미구현 (`docs/superpowers/specs/2026-07-02-founding-vip-promo-code-design.md`는 설계 문서만 존재) | 미구현 | `vipPromotionService.ts`, `app/(tabs)/settings/vip-code.tsx` 등 실제 코드 전무. `isFoundingVip` 필드가 `iapService.ts`의 `SubscriptionStatus`에 아직 없음(grep 0건). 12개월 무료→13개월차 자동 50%할인 전환 로직 없음 | §8.2(완료) | 1 | 긴급 |
| §9.3-9.6 공유카드 플랜 분기 | §9 | `src/components/share/PlanShareCard.tsx:89-219`(`FreeCardBody`/`CoffeeCardBody`/`DeepCardBody`) | 부분 정합 | 3단계 디자인 분기(테두리·톤·시그니처문장 유무) 자체는 정확히 구현됨(Free 파스텔 무테두리, Coffee 실버프레임, Deep 골드오로라+시그니처문장). 다만 잠금 개수는 §9.3 요약표("Free 3개/Coffee 2개/Deep 0개")와 §9.5 상세본("Coffee 잔여잠금 3개") 사이에 명세서 자체 모순이 있고, 코드(`PlanShareCard.tsx:139-143`)는 상세본을 따라 Coffee에도 3개 잠금줄을 렌더링함 | — | 2 | 대기 |
| §9.7 비기능요구사항 | §9.7 | `src/utils/planShareExport.ts:2,18,78-79` | 부분 정합 | 1080×1920 무손실 PNG 내보내기는 구현됨. 다만 스펙이 요구한 "react-native-skia 또는 하드웨어가속 캔버스" 대신 `expo-linear-gradient`+`dom-to-image-more`(웹) 조합을 사용하며, 파일 내 주석에 "Skia 등 신규 네이티브 의존성 추가하지 않음"이라고 명시적으로 이탈 사유를 남김. 오라 끄기 시 정적 스냅샷 폴백 여부는 이번 검증에서 확인하지 못함 | — | 2 | 대기 |
| §10 커플 Wrapped | §10 | `coupleWrappedService.ts`, `CoupleWrappedModal.tsx:155-274`, `useWrappedScheduler.ts` | 부분 정합 | 트리거(연말/기념일/마일스톤)와 8장 카드 시퀀스(`buildPages` L155)는 구현됨. 그러나 §10.3이 요구하는 무료/유료 게이팅(무료=핵심카드 일부+워터마크 vs 유료=전체시퀀스+커스텀테마+무워터마크)이 코드에 없음 — `CoupleWrappedModal.tsx`/`coupleWrappedService.ts`/`useWrappedScheduler.ts` 전체에서 premium/paywall/watermark/tier 조건분기 0건(grep 확인), 모든 유저에게 풀 시퀀스가 무조건 노출되는 것으로 추정됨 | — | 1 | 긴급 |
| Git 브랜치 전략 (점검 g) | 커밋이력 | `git log --oneline` | 부분 정합 | PR #1(user-tone-vector-engine), #2(plan-share-card), `feature/instant-analysis`, `feature/twin-response-engine`, `feature/share-card`는 merge를 경유했으나, "7/2 개인정비 커밋"·"07/01 연등 커밋"·"7/2 오후 커밋"·"7/2 점심"·"7/1 개인정비 커밋"·"6/20 사지방 3차 커밋" 등 다수 커밋은 feature 브랜치 없이 main에 직접 반영됨 — v2.2 changelog가 명시한 "force push 금지 → feature 브랜치 경유" 정책이 부분적으로만 지켜짐. 단, force-push로 폐기된 커밋의 흔적(비선형 히스토리)은 발견되지 않음 | — | 2 | 대기 |

## 참고
- 나머지 항목(FUN-ONB-001~003, FUN-HOM-001/002B/003, §3.1~3.7 전체, §4 엔진 전체, §5.2~5.8 전체, FUN-SET-001/001B/001C, §8.2~8.9)은 0630 명세서와 완전 정합으로 확인되어 이 표에서 제외했다. 상세 근거가 다시 필요하면 git 이력에서 2026-07-02 최초 버전을 참조.
- FUN-HIS-001/005 충돌(지도 뷰 dead code)은 이번 검증에서 새로 발견된 항목이다.
