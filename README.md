# 럽유럽미 (Love U Love Me)

> 상대를 사랑하는 과정에서 나에 대해 더 깊게 이해하고, 나를 사랑하는 방법을 알아가는 서비스

**궁합은 Hook, Relationship Mirror가 Product, Relationship History는 Retention.**
이 제품 논리를 Route · State · Component · Copy · Analytics 전체 구조에 반영한 실서비스
론칭 프로젝트입니다. 실측 확인된 사실과 미검증 항목을 분리해서 기록합니다 — "구현했다"와
"검증됐다"를 같은 말로 쓰지 않습니다.

- 기준 문서: [`docs/럽유럽미_기획서_v1.md`](docs/럽유럽미_기획서_v1.md)(기획 의도) ·
  [`docs/기능명세서.md`](docs/기능명세서.md)(**실제 구현 기준 Source of Truth**) ·
  [`docs/design-guide.md`](docs/design-guide.md)(비주얼·톤)
- 이 README는 아키텍처 소개 수준으로만 유지합니다. 화면별 상세 스펙·Route 표·QA 케이스는
  기능명세서로 갑니다 — 같은 내용을 두 곳에서 다르게 관리하지 않습니다.

---

## 실행

```bash
npm install
```

```bash
npm run dev
```

http://localhost:3000 · 기준 뷰포트 **393 × 852** (360px에서도 깨지지 않음)

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 (타입 체크 + 린트 포함) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test:ai` | AI 스키마/안전 검증 Contract Test (Provider Key 불필요) |
| `npm run test:ai:e2e` | 실제 `/api/ai/*` Route 왕복 (Key 없으면 SKIPPED로 정직하게 보고) |
| `node tests/run-observed-e2e.mjs` | Observed(사진) 파이프라인 E2E |

> ⚠️ `next dev`가 떠 있는 상태에서 `npm run build`를 돌리면 `.next`가 충돌합니다.
> 빌드 전에 dev 서버를 끄거나, 충돌 시 `.next`를 지우고 다시 시작하세요.

### 데스크톱 프로토타입 패널

`lg` 이상에서는 393×852 프레임 옆에 UT·개발용 패널이 함께 뜹니다.

- 현재 화면 (S번호 · 화면명) — Legacy Route는 저채도로 구분 표시(v1.11)
- 실시간 계산값: 동기화율 / 잘 맞는 신호 / 관찰 필요 신호 / 비교한 항목 / Mirror GAP
- Primary KPI: Mirror 진입률
- 전체 화면 점프, 답변 초기화, **한사랑 샘플 세션 불러오기**

---

## 스택

React 19 · **Next.js 15 (App Router)** · TypeScript (strict) · **Tailwind CSS v4** · Framer Motion · Lucide React

상태는 React Context + `localStorage`(`SessionProvider` = 현재 세션, `HistoryProvider` =
저장된 과거 관찰 Snapshot, 서로 다른 저장소 — 아래 "Current Result vs History" 참고)에서만
관리합니다. 별도 상태 관리 라이브러리는 쓰지 않습니다.

---

## 화면 ↔ Route 매핑

**v1.11부터 결과 화면이 통합됐습니다.** 궁합 결과(S21~S25, 5개 화면)와 Relationship
Mirror 결과(S27~S28, 2개 화면)가 각각 Canonical Route 1개로 합쳐졌습니다 — 화면 수를
줄이는 게 목적이 아니라 "우리 둘은 어떻게 맞는가?" / "나는 관계에서 어떤 사람인가?"라는
각각의 질문에 대한 답을 한 맥락에서 읽게 하기 위해서입니다. 구 Route는 삭제하지 않고
`redirect()`로 해당 section anchor로 보냅니다. 상세는 기능명세서 §13.

| WF | 화면 | Route |
|---|---|---|
| S01 | 스플래시 | `/` |
| S02~S04 | 온보딩 3단 | `/onboarding` |
| S05 | 관계 상태 | `/status` |
| S06 | 프로필 빌딩 인트로 | `/profile/intro` |
| S07 | 사진 입력 | `/profile/photos` |
| S08 | 사진 분석 로딩(실제 Vision Provider 호출) | `/profile/analyzing` |
| S09 | **Observed Me 결과** | `/profile/observed` |
| S10~S13 | Declared Me 질문 4개 | `/profile/declared/[1-4]` |
| S14 | 과거 관계 인트로 | `/profile/past/intro` |
| S15~S17 | Relationship Me 질문 3개 | `/profile/past/[1-3]` |
| S18 | **Relationship Profile** (Revisit 모드 지원) | `/profile/result` |
| S19 | 상대 정보 입력 | `/target` |
| S20 | 궁합 로딩 | `/compatibility/analyzing` |
| S21R | **Compatibility Result** (구 S21~S25 통합, Revisit 모드 지원) | `/compatibility` |
| S26 | **Mirror Teaser (KPI 전환점, 절대 삭제 안 함)** | `/mirror/teaser` |
| S27R | **Relationship Mirror Result** (구 S27~S28 통합, Revisit 모드 지원) | `/mirror` |
| S29 | 분석 후 홈 (Current Result Revisit 허브) | `/home` |
| E1 | 데이터 부족 | `/mirror`, `/profile/result` 내 상태 |
| E2 | AI 오류 | `/profile/analyzing?error=1`, `/compatibility/analyzing?error=1` |
| E3 | 확신 낮음 | `/compatibility` 내 상태 (비교 항목 3개 미만) |
| E4 | 연애 경험 없음 | `/profile/past/none` |
| F1 / F1-a / F2 / F3 | Relationship History / 기록 상세 / 변화 리포트 / 저장 직후 | `/history`, `/history/[id]`, `/history/report`, `/history/saved` |
| SH1 / SH2 | 궁합 / Mirror 공유 카드 | `/share/compatibility`, `/share/mirror` |
| X1 / X1-a / X1-b / X1-c | 다른 렌즈 허브 / MBTI / Astrology / 사주 | `/lens`, `/lens/mbti`, `/lens/astrology`, `/lens/saju` |
| P1 | Premium Paywall (Fake Door — 실제 결제 없음) | `/premium?source=...` |
| — | Privacy Policy + Analytics Consent 변경(v1.12 신설) | `/privacy` |

**Legacy Route (삭제하지 않고 redirect)**: `/compatibility/why`·`good`·`friction`·
`questions` → `/compatibility#...`, `/mirror/insight` → `/mirror#core-insight`.

**Current Result Revisit** (v1.11 신설, 새 Route 아님 — 같은 Route에 쿼리로 진입):
`/compatibility?view=revisit`, `/mirror?view=revisit`, `/profile/result?view=revisit`.
Home의 '최근 분석' 섹션에서 진입합니다. **Relationship History와는 다른 개념**입니다 —
Revisit은 지금 세션을 다시 계산해서 보여주는 것이고, History는 저장된 과거 스냅샷입니다.

---

## 디렉터리 구조

```
src/
├─ app/                    Route (App Router) — 화면당 하나
│  └─ api/ai/**            AI Route Handler (server-only 경계, 6개 dynamic)
├─ components/
│  ├─ common/              Button, ScreenLayout/Header, BottomSheet, ConfirmModal,
│  │                       Toast, BottomNavigation, ResultSectionNav(v1.11),
│  │                       ConsentBanner(v1.12), primitives
│  ├─ ai/                  AiModeNotice, NarrativeViews, AiDebugPanel
│  ├─ lovy/                Lovy, LovyMessage, LovyLoading
│  ├─ profile/             PhotoGrid, ObservationCard, ProfileLayerStack
│  ├─ compatibility/       SyncScore, SignalCard, ConversationCard, MbtiLensPanel
│  ├─ mirror/              MirrorComparisonRow, TeaserComparison
│  ├─ history/             HistoryChangeRow, PastObservationNote
│  ├─ premium/             PremiumEntryRow, RelationshipDeepReportView, DeepInsightCard
│  ├─ ut/                  UtRatingCard, UtSummaryCard, DeepReportUtFlow
│  └─ shell/               AppShell, PrototypePanel(prod 숨김, v1.12), MotionProvider,
│                           GaScriptLoader(v1.12)
├─ app/privacy/            Privacy Policy + Analytics Consent 변경 화면(v1.12)
├─ data/                   질문·라벨·카피·러비 에셋·축 정의 (순수 데이터)
├─ hooks/                  useAnalysis(결과 셀렉터) · useAiNarrative(AI 설명 캐시/재호출) ·
│                          useAnchorScroll(v1.11) · useShare · useAnalyticsConsent(v1.12)
├─ lib/
│  ├─ logic/               values · compatibility · mirror · profile · observed ·
│  │                       observedSignals(사진 신호 집계) · history · crossSourceInsights (순수 함수)
│  ├─ aiFingerprint.ts     AI 재호출/무효화 기준 (MBTI·출생정보·Premium 제외)
│  ├─ aiEvidenceResolver.ts EvidenceRef → 실제 세션 데이터 문장
│  ├─ historyRepository.ts localStorage 직접 접근 유일 지점(History 저장소 경계)
│  ├─ resultView.ts        Revisit 판정/링크 생성(v1.11)
│  ├─ returnTo.ts          Profile Revisit → 입력 Funnel → 복귀 경로(v1.11)
│  ├─ analytics.ts         trackEvent + Primary/Analysis-level KPI 스냅샷(v1.12)
│  ├─ analyticsConsent.ts  GA4 전송 동의 상태(v1.12)
│  ├─ utExport.ts          UT 결과 JSON 내보내기(v1.12)
│  ├─ validation.ts        입력 검증
│  ├─ routes.ts            Route 상수 + `RESULT_ANCHORS`(v1.11) + 화면 보드
│  └─ shareCard.ts         Canvas 2D 공유 카드 PNG 저장
├─ services/ai/            Provider 추상화 · 프롬프트 · 스키마 검증 · 안전장치 · 클라이언트
├─ services/aiService.ts   화면이 쓰는 유일한 분석 파사드
├─ state/                  SessionProvider(현재 세션, funnelAnalysisId 포함 v1.12) ·
│                          HistoryProvider(과거 Snapshot) · defaultAnswers
├─ styles/globals.css      Design Token (@theme) + reveal/Lovy 애니메이션
└─ types/                  도메인 타입
```

**UI는 분석 데이터를 직접 import하지 않습니다.** 모든 분석 결과는 `services/aiService.ts`
(+ `services/ai/aiClient.ts`)를 통해서만 들어오고, 계산식은 `lib/logic/*` 한 곳에만
존재합니다. 화면은 AI Provider를 알지 못합니다.

---

## 데이터 모델

기획서 §5.2 구조를 그대로 따릅니다.

| 개념 | 의미 | 출처 화면 |
|---|---|---|
| **Observed Me** | 사진에서 관찰된 취향·라이프스타일(실제 Vision 분석, 사진 1장씩 관찰 + 규칙 집계) | S07~S09 |
| **Declared Me** | 사용자가 직접 답한 관계 기준 | S10~S13 |
| **Relationship Me** | 과거 관계 경험에서 드러난 실제 기준 | S15~S17 |
| **Target Person** | 사용자가 *알고 있는* 상대 정보 | S19 |
| **Compatibility** | 두 사람의 공통점 / 차이 | S21R |
| **Relationship Mirror** | Declared Me vs Relationship Me | S26·S27R |
| **Relationship History** | 저장된 과거 Mirror Snapshot(현재 세션과 별개 저장소) | F1~F3 |

---

## ⚠️ 판정은 규칙이 한다 (AI가 하지 않는다)

**아래 계산은 심리 검사나 과학적 진단 로직이 아닙니다.** 입력값의 공통점·차이를 사용자가 직관적으로 읽을 수 있게 만든 규칙 기반 로직입니다.

```
Evidence → Deterministic Rule → AI Explanation → User Verification
```

AI는 동기화율·Mirror 판정(MATCH/GAP/CHANGE)·History 판정(STABLE/SHIFT/NEW)·MBTI·Sun Sign을
**만들거나 바꾸지 못합니다.** 서버가 AI 응답의 판정 필드를 규칙 값으로 덮어쓰고, 근거
문장도 AI가 아니라 코드가 실제 세션 데이터에서 만듭니다.

**AI 모드** — `AI_MODE`(server-only): `demo`(기본·Provider 미호출) / `real`(`AI_API_KEY`
필수) / `mock`(개발 전용, 검증 단계는 그대로 통과시키되 결과 `meta.mode`가 `'mock'`이라
real인 척하지 않는다). `.env.example` 참고.

**Observed(사진) 파이프라인** — 사진을 한 번에 전체 보내지 않고 **1장씩** Vision
Provider에 보내 관찰만 받고, "몇 장에서 반복됐는지"는 애플리케이션 코드가 집계합니다
(`lib/logic/observedSignals.ts`) — Provider가 반복 여부를 스스로 주장하지 못하게 하기
위해서입니다. 상세는 기능명세서 §6.9.5.

⚠️ **실제 Provider end-to-end는 아직 검증되지 않았습니다** (API Key 없음). 자세한 구분은
기능명세서 §12.1·§8.5.

**AI 검증 회귀 테스트**: `npm run dev` 후 `npm run test:ai` (Provider Key 불필요, 스키마/안전 검증만).
**Real Provider E2E**: `npm run test:ai:e2e` — 진짜 `/api/ai/*` Route를 왕복한다. Key가 없으면
`SKIPPED — KEY NOT AVAILABLE`을 정직하게 보고한다.

### 동기화율 (`lib/logic/compatibility.ts`)

4개 축(연락 방식 · 갈등 해결 · 개인 시간 · 애정 표현)을 1~5로 정규화한 뒤

```
축별 similarity = max(0, 1 - |나 - 상대| / 4)     // 완전 동일=1, 완전 반대=0
score = round(비교 가능한 축의 similarity 평균 × 100)
```

- `similarity >= 0.75` → 잘 맞는 신호 / `<= 0.25` → 관찰이 필요한 신호
- 상대 정보를 **'모름'**으로 남긴 축은 계산에서 제외되고, 비교 가능한 축이 3개 미만이면 점수를 만들지 않고 `?`(E3)로 둡니다
- 인위적인 하한선을 두지 않습니다 — 낮으면 낮게 보입니다(완전 반대 = 0점)

> 이 값은 **연애 성공 확률이 아닙니다.** 코드와 UI 어디에서도 success / prediction 같은 표현을 쓰지 않습니다. MBTI·출생정보·Premium 상태는 이 계산에 어디에도 들어가지 않습니다.

### Relationship Mirror (`lib/logic/mirror.ts`)

Relationship Me는 1~5 척도로 직접 수집된 값이 아니므로(과거 관계 질문은 선택형), 두
숫자를 빼서 판정하지 않습니다. **관계 경험 근거가 있는가**를 기준으로 판정합니다:

```
hardest 근거(가장 힘들었던 순간) + 말한 기준 낮음    → GAP
hardest 근거 + 말한 기준 높음                        → MATCH
important 근거(중요 요소로 선택) + 말한 기준 낮음     → GAP
important 근거 + 말한 기준 보통·높음                  → MATCH
근거 없음 + 말한 기준 높음                            → CHANGE
근거 없음 + 말한 기준 보통·낮음                       → UNKNOWN(판정하지 않음, 화면에 안 보임)
```

Teaser·Core Insight는 GAP이 있으면 첫 GAP 축, 없으면 차이가 가장 큰 축을 잡습니다.

### 검증된 기준 시나리오

한사랑(29세, 솔로, 연애 경험 있음) 페르소나로 전체 플로우를 통과하면 기획 기준값이 그대로 재현됩니다.

- 동기화율 **78** / 잘 맞는 신호 **4** / 관찰 필요한 신호 **2**
- Mirror: 개인 시간 `MATCH` · 연락 `GAP` · 취미 공유 `CHANGE`
- Core Insight: *"너는 연락 자체보다 '관계가 계속 연결되어 있다는 느낌'을 중요하게 보는 사람일지도 몰라."*

---

## Analytics & Primary KPI

`lib/analytics.ts`의 `trackEvent(name, properties)` 하나로 통일했습니다. 실제 SDK를
붙일 때는 `analyticsAdapter.ts`의 Adapter 경계만 바꾸면 됩니다(local store는 그대로 유지).

```
Primary KPI = relationship_mirror_entry_click / compatibility_result_view
= "궁합 결과를 본 사용자 중 Relationship Mirror에 진입한 비율"
```

`compatibility_result_view`는 정상 결과와 E3(확신 낮음) 둘 다에서 발생하고
`trackOnce`(세션당 1회)로 집계됩니다. Home에서의 '다시 보기'(Revisit)는 별도 이벤트
(`compatibility_result_revisit`/`mirror_result_revisit`)로만 기록되어 이 KPI를
오염시키지 않습니다.

`getPrimaryKpi()`로 현재 진입률을 읽을 수 있고, 데스크톱 프로토타입 패널에 실시간
표시됩니다(개발 모드 전용 — production 빌드에서는 렌더되지 않습니다). 전체 이벤트
목록은 `ANALYTICS_EVENTS` 상수(`lib/analytics.ts`)를 참고하세요.

**v1.12 — Analysis-level Funnel(추가, 기존 지표는 불변).** 위 Primary KPI는 세션(탭)
단위로만 dedup해서, 같은 탭에서 상대를 두 번 분석하면 분모는 그대로인데 분자만 늘 수
있었습니다. `funnelAnalysisId`(상대가 바뀔 때마다 새로 발급되는 랜덤 UUID)로 dedup하는
`compatibility_analysis_result_view`/`relationship_mirror_analysis_entry`를 별도로
추가해 분석 단위 전환율(`getAnalysisPrimaryKpi()`)도 볼 수 있습니다.

**GA4 — v1.12부터 실제로 연결 가능합니다.** `NEXT_PUBLIC_GA_MEASUREMENT_ID`가 있고,
production 빌드이고, 사용자가 `/privacy`의 Consent Gate에서 동의했을 때만
`next/script`로 gtag.js가 로드됩니다. 세 조건 중 하나라도 빠지면 로컬 store에만
남고 외부로는 나가지 않습니다 — **아직 실제 Measurement ID로 수신을 확인하지는
않았습니다(NOT VERIFIED).**

> 개발 모드에서는 React StrictMode가 effect를 두 번 실행하므로 화면 노출 계열 이벤트가 2로 보일 수 있습니다. 프로덕션 빌드에서는 1회만 발생합니다.

---

## 러비(Lovy)

- 최종 캐릭터 에셋 14종(`public/lovy/*.png`)만 사용합니다. 새 캐릭터를 만들지 않습니다.
- 역할은 **관찰자**입니다. 상담가·점쟁이·절대적 AI가 아닙니다.
  관찰 → 이상한 점 발견 → 질문 → 근거 제시 → 사용자 확인 → 학습
- 크게 쓰는 곳: Splash · Onboarding · AI Loading · 중요한 Insight · Mirror Teaser · Empty/Error
  일반 입력 화면에서는 38~46px 아바타 + 말풍선으로만 등장합니다.

---

## 프라이버시 UX

- **선택한 사진은 AI 분석을 위해 서버로 전송될 수 있습니다.** 분석이 끝나면 앱의 기록에는 관찰 결과와 근거만 남고 사진 원본은 저장하지 않습니다. Demo 모드(`AI_MODE≠real`)에서는 전송 자체가 없습니다 — 화면이 실제 모드를 보고 정확한 안내를 표시합니다.
- 러비의 관찰은 결론이 아니라 초안입니다. 항목별로 **수정 / 분석 제외 / 되돌리기**가 가능합니다.
- 상대 분석은 *"네가 알고 있는 정보를 기준으로"* 비교하며, 상대의 실제 마음이나 성격을 판정하지 않습니다.
- 공유 카드는 기본적으로 상대 정보를 포함하지 않습니다(토글로 선택).
- 사진에서 성적 지향·정치·종교·건강·경제 상태·인종은 추론하지 않고, 관계 규정(친구/연인/가족)도 단정하지 않습니다.
- 전체 정책은 `/privacy` 화면과 [`docs/privacy-policy.md`](./docs/privacy-policy.md)에서 볼 수 있습니다(v1.12). Home과 사진 입력 화면에 진입점이 있습니다. 같은 화면에서 Analytics Consent(동의/거부)도 언제든 바꿀 수 있습니다.

---

## 접근성

semantic HTML · 실제 `button`/`input[type=radio]`/`checkbox` 사용 · 모든 터치 타깃 44px 이상 · visible focus ring · icon-only 버튼 `aria-label` · 이미지 `alt`(장식은 `aria-hidden`) · `aria-live` 토스트/로딩 · 게이지·상태는 색만으로 구분하지 않고 스크린리더 텍스트를 함께 제공 · `prefers-reduced-motion` 시 애니메이션 정지 · 아코디언(v1.11)은 `aria-expanded` 동반.

> 첫 화면에 바로 보이는 등장 연출은 JS(Framer Motion) 대신 CSS 애니메이션으로 처리합니다. `useReducedMotion()`으로 `initial` prop을 갈아끼우면 서버 렌더 결과와 첫 클라이언트 렌더가 달라져 hydration이 깨지기 때문입니다.

---

## 현재 범위 밖 (의도적 제외)

- **Supabase 미연동.** 세션은 `localStorage`에만 저장됩니다. `docs/supabase-info.md`의 자격 증명은 아직 쓰지 않습니다. 붙일 때는 `services/aiService.ts`와 `state/SessionProvider.tsx` 두 경계만 건드리면 됩니다.
- **실제 AI Provider end-to-end 미검증.** API Key가 없어 스키마/안전 검증은 로컬 스텁으로 실측했지만, 실제 Provider 응답으로 왕복한 적은 없습니다.
- **사주 명식 계산 엔진 미연결.** 절입 시각·진태양시 등 정밀 계산이 필요해 `NEXT_PUBLIC_SAJU_ENGINE_READY=false`로 정직하게 "준비 중" 상태를 보여줍니다.
- **GA4는 코드상 연결 가능하지만 실제 수신은 미검증.** Measurement ID를 넣고 Consent까지 동의해도, 실제 GA4 대시보드에 이벤트가 도착하는 것을 확인한 적은 없습니다.
- **Rate Limit은 여전히 인스턴스 메모리 기반.** `RateLimitStore` 인터페이스로 경계는 분리했지만(v1.12), 연결할 공유 저장소(Redis 등) credential이 없어 `SharedRateLimitStore`는 구현하지 않았습니다 — 서버리스 다중 인스턴스에서 정확하지 않습니다(distributed rate limiting NOT VERIFIED).
- 실제 사용자 매칭 · 실제 결제(PG)는 포함하지 않습니다.
