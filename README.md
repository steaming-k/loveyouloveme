# 럽유럽미 (Love U Love Me)

> 상대를 사랑하는 과정에서 나에 대해 더 깊게 이해하고, 나를 사랑하는 방법을 알아가는 서비스

**궁합은 Hook, Relationship Mirror가 Product, Relationship History는 Retention.**
이 제품 논리를 Route · State · Component · Copy · Analytics 전체 구조에 반영한 실서비스
론칭 프로젝트입니다. 실측 확인된 사실과 미검증 항목을 분리해서 기록합니다 — "구현했다"와
"검증됐다"를 같은 말로 쓰지 않습니다.

**기준 문서** — 현재 버전 **v1.45**

| 문서 | 담는 것 | 언제 보나 |
|---|---|---|
| [`docs/기능명세_현행.md`](docs/기능명세_현행.md) | **지금 제품이 무엇인가**만. 화면·로직 기준 통합 | "지금 어떻게 동작하지?" |
| [`docs/기능명세서.md`](docs/기능명세서.md) | v1.0부터의 **누적 기록** — 버전별 절 + 변경 이력 + 판단 근거 | "왜 이렇게 됐지?" |
| [`docs/럽유럽미_기획서_v1.md`](docs/럽유럽미_기획서_v1.md) | 기획 의도 · 가치 가설 · 성공지표 | "왜 만들지?" |
| [`docs/design-guide.md`](docs/design-guide.md) | 비주얼 · 톤 · 컴포넌트 규칙 | "어떻게 보이지?" |
| [`docs/versions/`](docs/versions/README.md) | 과거 버전 동결본 | "그때는 어땠지?" |

> 두 기능명세 문서는 **역할이 다릅니다.** `기능명세_현행.md`는 현재 상태만 담아 위에서
> 아래로 한 번에 읽히게 하고, `기능명세서.md`는 판단 근거와 철회된 시도까지 남깁니다.
> **실제 구현 기준 Source of Truth는 두 문서 모두**이며, 현행 동작이 궁금하면 앞의 것을 봅니다.

- 이 README는 아키텍처 소개 수준으로만 유지합니다. 화면별 상세 스펙·Route 표·QA 케이스는
  기능명세 문서로 갑니다 — 같은 내용을 두 곳에서 다르게 관리하지 않습니다.

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
| `npm run test:ai` | AI 스키마/안전 검증 Contract Test **508건** (Provider Key 불필요 · **dev 서버 필요**) — v1.42의 시제 fixture 3종 + 근거 귀속 CA0~CA4 + 질문 Job Safety AQ0~AQ6에, v1.43에서 **Compatibility 계약 C0~C9**(질문 게이트 · 시제 · dimension별 근거) + **Relationship 근거 귀속 R0~R7**(`value_gap`·PastFactor 7개·`selfGap`의 축 오귀속 차단 + 별칭 과필터 방지) + **History 계약 H0~H4**(canonical axis · `history` ref 성립) + **Deep Report 시제 D0~D5** 추가 |
| `npm run test:observed` | 사진 파이프라인 E2E 10건 (`/api/ai/observed-profile` 왕복 · **dev 서버 필요**) |
| `npm run test:lifecycle` | Lifecycle Fixture **144건** — Relationship Stage/Job · **불변 검사**(단계만 바꿔도 동기화율·Mirror·Premium 게이트 동일) · Ended/Dating/Long-term Safety · **Premium Deep Report 본문의 구조적 안전**(v1.40.1 · `audience` 카운트) · Paywall↔본문 대칭 · fixture enum guard · legacy 세션 · **Production Deep Report Unlock**(CTA → success → preparing → report · Fake Door BottomSheet 0 · `demo_unlock`에 결제 완료 주장 0 · `payment` mode 경로 보존 · 다른 미출시 feature의 Fake Door 유지) (**dev 서버 필요**) |
| `npm run test:relationship-evidence` | Relationship Evidence Fixture **280건** (v1.41 80 → v1.42 154 → v1.43 280) — v1.43에서 **AI Task Contract 구조 검사 TC0~TC6**(Task 5종 × 차원 7개가 전부 채워졌는가 · 시제·게이트 source가 각각 하나인가 · 축 enum이 프롬프트·파서에서 같은 상수인가 · 지문에 policy input이 들어갔는가) + **C4~C5 · CMP-CTX · D-CACHE**(compatibility·deep-report 캐시 identity) + **CC0~CC7**(User Correction Trust Boundary — 사용자 수정이 AI 서술·기록과 모순되지 않는가 · **correction은 cache identity에 들어가지 않는다**는 것과 그 커플링까지) 추가 — **stage ≠ evidence 양방향**(`dating`인데 근거가 없으면 current 0 · `talking`인데 근거를 넣으면 current 사용) · **legacy 무변경**(현재 근거가 없는 세션의 판정이 v1.40.1과 JSON 수준에서 동일) · 점수 불변 · scope 정직성(mixed면 이름 붙이지 않음) · `ended` 시제 전수 · Premium ⑨ · Ended safety 회귀 · **Resolver가 stage를 import하지 않는지 구조 검사**(R1) · **v1.42 A0~A15** — AI 지문이 S30을 보는가 · stage가 달라도 근거·시제가 같으면 같은 지문인가 · AI context에 raw status 0건인가(R2) · AI가 없어도 결정론 결과가 완결되는가 · **CA4b**(근거의 source는 유지되고 시제만 바뀌는가) · **AQ-D**(AI 질문 게이트가 결정론 질문과 같은 술어를 쓰는가) · **CF0~CF6 · CF-R**(같은 시제에서 질문 정책만 달라도 캐시 identity가 갈리는가) (**dev 서버 필요**) |
| `npm run test:history` | Logic Fixture 100건 — History H0~H10 + Observed 시간축 + 근거 묶음 + Solo Premium 게이트 + `네가 말한 너` 문구 무결성 + 샘플 근거 정합성 · S07 사진 게이트(v1.37) + **관찰 시퀀스 시간 예산**(v1.38) (Provider Key 불필요 · **dev 서버 필요**) |
| `npm run test:trust` | Trust Boundary Fixture **205건** (v1.44) — **입력을 신뢰할 수 없을 때 무엇을 말하는가.** 손상 세션 강등 · AI `meta` 부재 방어 · 근거 없는 Home 단정 차단 · 근거 없는 시간적 변화 주장 차단. 유효 입력의 문구가 **그대로인지도 함께** 고정한다(과필터 방지) (**dev 서버 필요**) |
| `npm run test:premium` | Premium Deep Report v2 Fixture **196건** (v1.45+ · PREM-V2-01~15 + LOVY-01~12 + POSTREV-01~18 + RELEASE-01~06 + PROD-UNLOCK-01~10) — 고데이터에서 Chapter **7~10개** · Chapter마다 독립 근거 2종 · 같은 축 반복 상한 · **FREE 중복 0** · Sparse **filler 0** · `ended` outward **0** · **AI 500·parse 실패에도 Chapter 유지** · 다른 Chapter 근거 차단 · 헤더 N = 실제 Chapter 수 · Accordion A11y·Analytics Privacy·Production Guard 정적 guard · **캐릭터 통합**(kind마다 러비 포즈 존재 · 인접 중복 0 · 원본↔runtime SHA-256 동일 · 러비 한마디가 세션에 따라 변하지 않음 · 중간 메모가 Chapter 수에 미포함 · Sparse 메모 0 · `ended` 안전 카피 · Provider 1회 · promptVersion 불변) (**dev 서버 필요**) |
| `npm run test:nav` | Navigation Fixture **40건** (v1.46.2 · NAV-01~15) — **뒤로가기가 직전 맥락으로 가는가.** 결과→상세→복귀 · 진입 경로가 다르면 복귀도 다름 · 직접 진입일 때만 fallback · 가드 redirect·로딩 화면이 back 경로에 남지 않음 · back/forward 왕복 안정 · 스크롤/펼침 복원과 분석 범위 격리 (**dev 서버 필요**) |
| `npm run test:ai:e2e` | 실제 `/api/ai/*` Route 왕복 (**dev 서버 필요** · Key 없으면 SKIPPED로 정직하게 보고) |
| `node tests/run-observed-e2e.mjs` | `npm run test:observed`와 같은 스크립트 |

> ⚠️ **테스트 7종은 모두 `http://localhost:3000`의 Route를 왕복합니다** — 스크립트가 서버를
> 직접 띄우지 않습니다(v1.39 확인). 서버 없이 실행하면 `ECONNREFUSED ::1:3000`으로 즉시
> 실패합니다. 터미널을 두 개 씁니다.
>
> ```
> 터미널 A:  npm run dev
> 터미널 B:  npm run test:ai && npm run test:observed && npm run test:history && npm run test:lifecycle && npm run test:relationship-evidence && npm run test:trust && npm run test:premium && npm run test:nav
> ```
>
> `test:history`는 검증 로직을 스크립트에 복제하지 않고 개발 전용 Route
> `/api/dev/history-test`(Production 404)를 통해 **화면과 같은 판정 함수**를 호출합니다.
> `test:ai`/`test:observed`는 `/api/ai/*`를 왕복하므로 Provider Key가 없으면 demo 경로로
> 검증되고, 있으면 `meta.mode=real` 경로로 검증됩니다. 대상 서버는 `LYM_BASE_URL`로 바꿀
> 수 있지만, 두 dev 전용 Route는 Production에서 404이므로 `test:ai`·`test:history`를
> 배포 URL로 돌릴 수는 없습니다.

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
| S05 | 관계 상태 (6개 전부 지원 · v1.40) | `/status` |
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
│  ├─ lovy/                Lovy, LovyMessage, LovyNote(v1.20),
│  │                       LovyObservation + ObservationField(v1.20)
│  ├─ report/              ReportShell — Header/Section/EvidenceBlock (v1.20)
│  ├─ profile/             PhotoGrid, ObservationCard, ProfileLayerStack
│  ├─ compatibility/       SyncScore, SignalCard, ConversationCard, MbtiLensPanel,
│  │                       FirstSurprise(v1.20)
│  ├─ lens/                BirthProfileForm, LensStateBlocks, LensCoreBridge(v1.20)
│  ├─ mirror/              MirrorComparisonRow, TeaserComparison
│  ├─ history/             HistoryChangeRow, PastObservationNote
│  ├─ premium/             PremiumEntryRow, RelationshipDeepReportView, DeepInsightCard,
│  │                       PremiumUnlockSuccess(v1.21)
│  ├─ ut/                  UtRatingCard, UtSummaryCard, DeepReportUtFlow
│  └─ shell/               AppShell, PrototypePanel(prod 숨김, v1.12), MotionProvider,
│                           GaScriptLoader(v1.12)
├─ app/privacy/            Privacy Policy + Analytics Consent 변경 화면(v1.12)
├─ data/                   질문·라벨·카피·러비 에셋·축 정의 (순수 데이터)
├─ hooks/                  useAnalysis(결과 셀렉터) · useAiNarrative(AI 설명 캐시/재호출) ·
│                          useAnchorScroll(v1.11) · useShare · useAnalyticsConsent(v1.12)
├─ lib/
│  ├─ logic/               values · compatibility · mirror · profile · observed ·
│  │                       observedSignals(사진 신호 집계) · history(커플 변화) ·
│  │                       soloHistory(Solo·Observed 시간축) · crossSourceInsights (순수 함수)
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

## Product Principle

```
HOOK      궁합 · MBTI          익숙해서 들어온다
  ↓
SURPRISE  YOUR SIGNAL · Mirror  "어? 여기서는 실제 내가 답한 관계 신호까지 보네"
  ↓
VALUE     판정 + 근거 + 행동     "나한테 실제로 의미가 있네"
  ↓
RETENTION History · 변화 비교    "러비가 예전에 어떻게 답했는지도 기억하네"
  ↓
PREMIUM   Cross-source 연결      "더 길게 쓴 게 아니라 따로 보던 걸 연결해서 보여주네"
```

> **사용자는 기능의 개수를 사는 것이 아니라,
> 자신의 관계를 더 잘 이해하게 되는 깊이를 산다.**

새 기능을 넣을지 판단할 때 **어느 단계를 강화하는가**를 먼저 답합니다. 어느 단계도
강화하지 않으면 넣지 않습니다.

- **HOOK은 익숙하게, 해석은 다르게** — 동기화율은 첫 viewport에 그대로 있고,
  `잠깐. 숫자만 보면 놓치는 게 하나 있어.`는 점수를 본 **뒤에** 옵니다.
- **SURPRISE는 설명이 아니라 사용자 자신의 결과에서 나옵니다.** 그래서 이 단계의
  품질은 카피가 아니라 **근거 정확도**에 달려 있습니다 — v1.36이 고친 것이 이 지점입니다
  (자세히: `기능명세서.md` §33).
- **사진은 입장권이 아닙니다.** Observed는 보강 근거이고, 없으면 그 섹션만 없습니다.
  v1.37 전까지는 원칙만 그랬고 실제로는 사진 3장을 못 내면 S07에서 퍼널이 끝났습니다 —
  Surprise가 사용자 자신의 답에서 나오는데, 자기 답을 낼 기회 자체를 못 얻던 셈입니다
  (자세히: `기능명세서.md` §34).
- **기다림은 신뢰를 만들지 않습니다.** 궁합 관찰은 Provider를 기다리는 화면이 아니라
  deterministic 계산인데 6.1초를 붙잡고 있었습니다. 단계를 **교체**하지 않고 **쌓도록**
  바꾸니 4단계와 문구를 그대로 두고도 2.5초가 됐습니다 (자세히: `기능명세서.md` §35).
- **Lens는 Core보다 무거워질 수 없습니다.** MBTI는 Hook이지만 Supporting Lens입니다.
  4축 관찰표는 **판정의 근거**이므로 Surprise 뒤로 보내고 기본은 접습니다 — 지우는 게
  아니라 Core와 같은 읽기 순서(`결론 → 한 문장 → Surprise → 근거`)를 적용한 것입니다.
- **RETENTION은 습관이 아니라 계기입니다.** `streak`·`연속 기록`을 쓰지 않습니다.
- **PREMIUM은 길이가 아니라 연결입니다.** 무료 문장을 반복하는 section은 삭제 대상입니다.
- **상태는 판정을 바꾸지 않고, 판정을 어떻게 쓸지를 바꿉니다** (v1.40) — 아래 참고.

### Relationship Lifecycle (v1.40)

```
RELATIONSHIP STAGE  →  CURRENT JOB  →  INTERPRETATION  →  ACTION  →  RETENTION
```

두 개의 **다른 축**을 섞지 않습니다.

| 축 | 값 | 정하는 주체 |
|---|---|---|
| **STAGE** | `none` · `talking` · `dating` · `long_term` · `ended` | 사용자가 S05에서 선택 (`answers.status`에서 도출) |
| **SUFFICIENCY** | `no_target` · `unknown_target` · `couple` | 상대 입력에서 도출 (`soloModeOfTarget()`) |
| **JOB** | `none` · `unknown` · `talking` · `dating` · `long_term` · `ended` | 위 둘의 곱 |

지원하는 관계 단계와 각 단계의 일:

| 사용자 선택 | JOB | 지금 하는 일 | 하지 않는 것 |
|---|---|---|---|
| 솔로 (경험 유무 무관) | `none` | 내 관계 기준 이해 | 상대 추정 |
| (상대 정보가 부족할 때) | `unknown` | 알아가기 전 내 기준 확인 | 호감 성공 전략 |
| 관심 가는 사람이 있음 | `talking` | 기대 차이 **확인** | 성공 확률 |
| 연애 중 | `dating` | 기대 **조율** · 갈등 회복 | 호감 올리기 · '다음 관계' |
| 기혼 / 오래 함께하는 중 | `long_term` | 반복되는 차이 **조율** · 같이 이야기해볼 질문 | 데이터에 없는 생활 문제 |
| 최근 관계가 끝남 | `ended` | 관계 **회고** → 다음 기준 | 접근 · 재회 · 치유 약속 · **상대를 향한 모든 행동·질문** |

- **`unknown`은 단계가 아니라 데이터 상태입니다.** 그래서 STAGE 목록에 없습니다.
- **`married`는 별도 Job이 아닙니다.** 결혼이 바꾸는 Job(가사·재정·주거·양육)의 데이터를
  받지 않으므로, 선택지는 남기고 해석은 `long_term`과 공유합니다 — 없는 데이터로 개인화를
  흉내내지 않습니다.
- **STAGE·JOB은 저장되지 않습니다.** v1.0부터 있던 `answers.status`에서 매번 도출하므로
  기존 세션에 마이그레이션이 필요 없습니다.
- **`ended`의 금지는 카피가 아니라 코드입니다.** `JOB_ACTION_KINDS.ended`에 `ask`·`try`·
  `align`이 없고, 화면은 `jobAllowsOutwardAction()` 한 곳만 보고 블록 자체를 교체합니다.
  **유료 리포트 본문도 같은 규칙을 받습니다**(v1.40.1) — 아래 참고.
- **단계는 evidence가 아닙니다.** AI에는 저카디널리티 context로만 전달되고
  `evidenceRefs`에 들어가지 않습니다.

### Ended Safety를 어휘에서 구조로 (v1.40.1)

v1.40은 위 규칙을 만들었고 무료 화면에서는 지켜졌지만, **유료 Deep Report 본문에서는
지켜지지 않았습니다.** `buildActions()`가 `ended` 사용자에게도 `서로 원하는 기준을 한 번
이야기해보기`(TRY) · `각자 어떤 의미로 받아들이는지 확인해보기`(CHECK)를 만들고,
`buildConnectionQuestions()`가 상대에게 던지는 질문을 만들었습니다.

**금지어 검사로는 잡히지 않습니다.** 위 문장들에 `다가가`·`고백`·`재회` 같은 어휘가
하나도 없기 때문입니다 — 문제는 *주제*가 아니라 **행동의 대상**이었습니다.

```ts
/** 이 행동·질문이 누구를 향하는가 */
export type DeepAudience = 'outward' | 'self';
```

그래서 대상을 문장에서 추론하지 않고 **생성 시점에 못박습니다.** 테스트는 문장을 읽지 않고
셉니다 — `ended`에서 `outwardActionCount === 0`. 금지어 목록은 버리지 않고 **2차 guard**로
남깁니다.

| | 내용 |
|---|---|
| `ended`·`none`이 받는 것 | 같은 연결·같은 축에서 `REFLECT`(근거를 나란히 놓고 읽어보기) + `NOTICE`(다음 관찰 기록에서 알아두기). **비우지 않습니다** — 유료 리포트가 결론 없이 끝나면 안 되니까요 |
| `ended`·`none`이 받지 않는 것 | 상대에게 던지는 연결 질문(**빈 배열**). 회고 질문으로 채우지도 않습니다 — 무료 화면이 이미 주고 있어서 중복이고, 회고는 한 번 정리하고 닫습니다 |
| 섹션 제목 | 무료 화면과 **같은 문구**(`STAGE_JOB_COPY[job].nowWhatTitle`)를 씁니다. 새 카피를 만들지 않았습니다 |
| 게이트 | `buildRelationshipDeepReport({ lifecycle })`가 **필수 파라미터**입니다. v1.40에서는 optional + 기본 허용이었고, 값을 넘기지 않은 호출부가 하필 리포트 본문을 여는 유일한 경로였습니다 — **안전 게이트에 permissive default를 두지 않습니다** |

`test:lifecycle`이 84 → **144건**으로 늘었고, `ended`(outward 0)와
`dating`/`long_term`(outward 유지)을 **양방향으로** 고정합니다 — 하나를 고치다 전부
없애는 과필터도 실패로 잡습니다.

상세는 `기능명세_현행.md` §1.7 · `기능명세서.md` §37(v1.40) · **§38(v1.40.1)**.

### 관계 단계는 evidence를 결정하지 않습니다 (v1.41)

v1.40이 `연애 중`인 사용자에게 `지금 관계에서 기대를 조율한다`는 답을 주기 시작했는데,
제품이 관계에 대해 묻는 질문은 **`이전 관계에서 …` 하나**였습니다.
`buildMirrorReport(declared, experience)` — 서명이 이미 답을 말하고 있었습니다.

> **제품은 한 번도 물어본 적 없는 관계에 대해 조율을 제안하고 있었습니다.**

시제만 바꾸는 것은 v1.40이 이미 금지했습니다(근거 문장을 현재형으로 고치면 그 근거의
출처가 거짓이 됩니다). 그래서 남은 방법은 **실제로 물어보는 것**이었습니다.

```
RELATIONSHIP STAGE  ≠  RELATIONSHIP EVIDENCE TIMEFRAME
```

| | 무엇을 정하나 | 무엇을 보나 |
|---|---|---|
| `jobInvitesCurrentEvidence(job)` | 화면이 S30을 **권하는가** | `dating` · `long_term`만 true |
| `resolveAxisEvidence(...)` | 근거를 **어떻게 읽는가** | **stage를 보지 않습니다** |

**두 술어가 서로를 참조하지 않습니다.** `talking` 사용자가 어떤 경로로든 답해 두면 그
답은 쓰입니다 — 권하지 않은 것과 무시하는 것은 다릅니다. `logic/relationshipEvidence.ts`는
`RelationshipStage`·`RelationshipJob`·`RelationshipStatus`를 **import하지 않고 타입으로도
받지 않으며**, `test:relationship-evidence`의 R1이 그 격리를 검사합니다 — 주석이 아니라
테스트가 지킵니다.

| 항목 | 내용 |
|---|---|
| 새 화면 | **S30 `/profile/current`** (선택) — 축마다 질문 하나·보기 4개·진행 차단 없음·자유서술 없음 |
| Core Funnel | **변경 0.** 진입은 결과 화면의 한 줄 링크 2개뿐이고, 하나도 답하지 않아도 모든 결과가 그대로 나옵니다. Time-to-Value 불변 |
| Evidence Scope | `current` \| `past` \| `none` — 축마다 근거의 시점을 들고 다닙니다. `legacy`는 **History Snapshot의 필드 부재**로 표현합니다(없는 것을 값으로 채우면 소급 추정입니다) |
| 섞였을 때 | **다수결로 이름 붙이지 않습니다.** 3:2도 섞였으면 `dominant = null`이고, 화면이 `항목마다 근거 시점이 달라 (지금 2 · 이전 1)`로 먼저 말합니다 |
| 불변 | 동기화율 · `comparedCount` · good/friction 신호 수 · MBTI · History 변화 판정 · Premium eligibility · ₩1,900 |
| Analytics | **새 이벤트 0.** 기존 `compatibility_result_view`에 `evidence_scope` 4종 enum 하나만. 축별 답변·개수·고른 보기는 **보내지 않습니다** |
| AI | **Job을 프롬프트에 넣지 않았습니다** — 단계를 알려주는 것은 모델에게 단계에 맞는 내용을 지어내라고 초대하는 것입니다. 대신 모델이 받는 **값**이 시제까지 정확해졌습니다(`limitation`은 v1.27 규칙대로 화면과 같은 문자열) |
| 함께 닫은 것 | v1.40.1이 남긴 `ended` 시제 4곳 + **목록에 없던 2곳**(`limitationFor` · 연결 카드 source 칩). 후자는 브라우저 실측에서만 보였습니다 — fixture가 훑는 배열에 그 자리가 없었기 때문입니다 |

**한 줄 교훈** — 안전 검증의 목록을 사람이 훑어서 만들면 목록에 없는 자리에서 샙니다.
해법은 목록을 늘리는 것이 아니라 **화면이 실제로 렌더하는 값 전부를 그 배열에 넣는
것**입니다.

상세는 `기능명세_현행.md` §1.8 · `기능명세서.md` **§39** · 기획서 **§5.32**.

---

### AI는 관계 단계를 판정 근거로 쓰지 않습니다 (v1.42)

v1.41은 위 원칙을 결정론 경로에서 **구조적으로** 지켰습니다(R1이 강제합니다).
그런데 v1.41 이후 Audit에서 **정확히 한 곳**이 예외로 남아 있는 것이 나왔습니다.

```
relationshipEvidence.ts   stage import 0건 · 테스트로 강제     ✅
mirror.ts                 status 읽지 않음                      ✅
deep-report-narrative     tense만 받음                          ✅
relationship-insight      status enum 원문 6종 · 계약 0건       ❌
```

**같은 원칙을 지키는 곳이 여럿이고 안 지키는 곳이 하나였습니다.** 그 하나가 하필
문장 생성기(AI)이고, 하필 무료 화면(`/mirror`)입니다.

> **AI는 관계 단계를 판정 근거로 쓰지 않습니다.
> 문장을 현재형으로 쓸지 과거형으로 쓸지만 압니다.**

```
BEFORE   RAW STATUS ────────────────────────────────► AI
AFTER    RELATIONSHIP JOB → RELATIONSHIP TENSE ─────► AI
```

| 결함 | 무엇이었나 |
|---|---|
| **Narrative Cache** (사용자 가시) | 지문에 `currentRelationship`이 없어서 `/mirror` → S30 → `/mirror`에서 **행은 `지금 관계에서 "…"라고 답함`인데 AI 설명은 이전 관계 근거를 설명하던 문장**이 남았습니다. `pickFocus`가 `MIRROR_AXES` 순서의 첫 매치를 고르므로 앞선 축이 이미 GAP이면 뒤쪽 축을 답해도 `focusAxis`가 안 바뀝니다 — 희귀 조건이 아니라 흔한 경로입니다 |
| **Raw Status Leak** | context에 `status`가 enum 원문으로 들어가고 **프롬프트는 그 필드를 한 번도 언급하지 않았습니다.** 증거: v1.41 E2E가 이 자리에 `status: 'ex'`(존재하지 않는 값)를 보내고도 PASS였습니다 |
| **AI Tense Safety 부재** | `safety.ts`에 시제 검사기가 **0건**이었습니다. Ended Safety는 결정론 게이트와 fixture 문자열 검사로만 성립했고, **AI 출력 경로에는 방어가 없었습니다** |

| 조치 | 내용 |
|---|---|
| Context | `status`(6종) → **`tense`(2종)** · **필수 파라미터**(optional 기본값 금지 — v1.40.1 §38.2와 같은 이유). 라우트도 없으면 **400** |
| Prompt | `[시제]` 블록 + **`former`에서 이별 원인·재회 추론 명시 금지**. `PROMPT_VERSIONS.relationship` v2 → **v3-tense** |
| Safety | `scanRelationshipTense` 3패턴. `question`·`limitations`까지 스캔합니다 — `narrative.question`은 **실제로 렌더**되므로 |
| Fingerprint | `current` **추가**(`MIRROR_AXES` 순서로 정규화 · `askedAt` 제외 · `unsure`와 미답변 구분) · `status` **제거** |
| Cache Key | `task::fingerprint` → **`task::promptVersion::fingerprint`**. v1.27이 적어둔 리스크를 닫았습니다 |

**`status`를 지문에서 뺀 부수 효과가 의도입니다.**

```
crush → dating    근거·시제 같음  →  같은 지문    같은 설명을 두 번 만들지 않습니다
dating → ended    시제 다름       →  다른 지문    현재형 캐시를 받지 않습니다
```

즉 `stage ≠ evidence`가 **캐시 층에서도** 성립합니다.

⚠️ **`current`에 대칭 검사를 넣지 않은 것도 판단입니다.** 진행 중인 관계도 축의 절반이
`scope: 'past'`인 것이 정상이고(S30은 선택 입력) 그 축의 근거 문장은 `이전 관계에서 …`
입니다. 과거 어휘를 금지하면 **근거를 인용할수록 문장이 사라집니다.** 두 방향의 실패
비용도 다릅니다 — `former`에서 현재형은 끝난 관계를 진행 중이라고 말하는 것이고,
`current`에서 과거 어휘는 대개 과거 근거를 정확히 인용한 것입니다.

| 검증 | 결과 |
|---|---|
| `test:relationship-evidence` | 80 → **115건** (A0~A15 · **R2**가 R1과 같은 형태로 `contextBuilders.ts`의 stage 0건을 강제) |
| `test:ai` | 143 → **176건** (시제 fixture 3종) |
| `test:ai:e2e` | **PASS 6 · SKIPPED 0 · FAIL 0** — Persona A `current` · B `former`, 호출 수는 v1.41과 동일 |
| 브라우저 J1~J5 | stale 재현 후 AI 요청 **2회**(캐시 미스) · `ended`에서 AI 5블록 전부 과거형 · 금지 어휘 0건 · legacy 정상 · console error 0건 |
| 과필터 | dev 로그 `[ai] relationship filter` — 실제 호출 **7건 전부 `parsed=N safe=N`**(드롭 0) |

**한 줄 교훈** — 원칙을 다섯 곳에서 지키고 한 곳에서 안 지키면 **그 한 곳이 원칙의 실제
값**입니다. 새 원칙을 세우는 것보다 이미 세운 원칙에 예외가 없게 만드는 것이 먼저이고,
예외를 없애는 방법은 주석이 아니라 R1·R2 같은 **구조 검사**입니다.

상세는 `기능명세_현행.md` **§8.11** · `기능명세서.md` **§40** · 기획서 **§5.32.6**.

---

### 근거의 출처와 질문의 대상 (v1.42 Blocker Closure)

§8.11이 닫은 것은 **시제**였습니다. Remaining Risks Audit에서 그 경계의 완성 조건을 깨는
P0 2건이 나왔습니다.

**① AI가 S30 근거를 인용할 수 없었습니다.** `EvidenceRef`에는 v1.41부터
`current_relationship`이 있는데 파서의 허용 목록(`EVIDENCE_SOURCES`)에는 없었습니다 —
그 목록 **바로 위 주석**이 "이 목록은 `EvidenceRef` 타입과 항상 같이 움직여야 한다"고
적어둔 규칙이 깨진 자리입니다.

```
결정론 엔진   { source: 'current_relationship', field: axis }   만든다
AI 파서       oneOf(source, EVIDENCE_SOURCES) → null            버린다
파싱          근거 0개 → 항목 제거 (위반 라벨 0건)               조용히 사라진다
```

전수 audit 결과 **10종 중 빠진 것은 하나뿐**이었습니다(단순 누락). 파서와 두 Task
프롬프트 enum에 등록했고 `AI_OUTPUT ⊆ DETERMINISTIC_EVIDENCE`는 그대로입니다 — 허용한
것은 '이미 만들어진 ref를 정확히 되짚는 것'뿐입니다.

**함께 발견한 것**: resolver가 시제를 몰라 `지금 관계에서`를 하드코딩하고 있었고, 그
문자열은 Premium 연결 카드의 `근거 N개 보기`에서 **v1.41부터 이미 새고 있었습니다** —
fixture가 훑는 배열에 그 자리가 없었기 때문입니다(§39.9와 같은 실패 형태).

**② AI 질문이 Job 게이트를 받지 않았습니다.**

```
연락이 줄었을 때 서로 어떤 기준이 있었는지 이야기해볼 수 있을까?
```

현재형 호칭이 **하나도 없어서** 시제 스캐너를 통과합니다. 그런데 관계가 끝난 사용자에게
상대와 이야기해보라고 제안하는 문장입니다.

> **TENSE SAFETY ≠ JOB SAFETY.**
> `현재형이 아니다`와 `Ended 사용자에게 해도 되는 질문이다`는 다른 명제입니다.

금지할 단어가 없으므로 **검사가 아니라 게이트**가 필요했습니다. `applyOutwardQuestionGate`가
응답 후처리에서 `ended`·`none`의 질문을 지웁니다 — **AI에게 Job을 주지 않는다는 결정은
그대로**이고, 값은 결정론 질문과 **같은 술어**(`jobAllowsOutwardQuestions`)에서 나옵니다.

⚠️ **게이트를 안전 검사 앞에 뒀습니다.** 뒤에 두면 질문 하나가 위반일 때 설명까지 항목째로
사라집니다 — `ended`에서 질문은 어차피 화면에 가지 않으므로 그건 순수한 과필터입니다.

| 검증 | 결과 |
|---|---|
| `test:ai` | 176 → **290건** (CA0~CA4 · AQ0~AQ6) |
| `test:relationship-evidence` | 115 → **135건** (CA4b · AQ-D) |
| `test:ai:e2e` | PASS 6 · SKIPPED 0 · FAIL 0 — Persona B(former)에서 **`questionsStripped=1` · `narratives: 1`**. 모델이 실제로 질문을 만들었고, 게이트가 그것만 지웠고, 설명은 살아남았습니다 |
| 브라우저 | `ended` AI 질문 **0** / `dating` 같은 자리에 AI 질문 유지 / Premium 근거 목록 `그때 이 관계` |

**한 줄 교훈** — 주석은 규칙을 **선언**하지만 **강제**하지 않습니다. `EVIDENCE_SOURCES`는
"타입과 함께 움직여야 한다"는 문장을 자기 바로 위에 갖고 있었고 어긋났습니다. 그리고
**안전 검사를 하나 만들 때마다 그 검사가 답하지 못하는 질문이 새로 생깁니다** — 검사를
늘리는 것이 안전을 늘리는 것과 같지 않습니다.

상세는 `기능명세_현행.md` **§8.12** · `기능명세서.md` **§41**.

---

### 질문 게이트와 캐시 identity (v1.42 Final Cache Safety)

Blocker Closure 보고를 검토하다 마지막 결함이 나왔습니다. 그때 이렇게 적었습니다.

> `allowsOutwardQuestions`는 지문에 넣지 않았습니다 — 응답 내용을 정하지 않으므로.

**그 판단이 틀렸습니다.**

```ts
// aiClient.callAiTask
cache.set(key, json.data);     // provider raw가 아니라 게이트·안전검사까지 끝난 최종 응답
```

그리고 `useNarrativeTask`는 요청을 보내기 **전에** 캐시를 읽습니다 — **캐시 히트에는
게이트가 돌 기회가 없습니다.** "서버가 매번 다시 적용한다"는 방어는 히트에서 성립하지
않습니다(히트의 정의가 '서버에 가지 않는 것'이니까요).

지문에는 `status`도 `target`도 없는데 `allowsOutwardQuestions`는 그 둘에서 파생됩니다.

```
① dating + 상대 3축        job dating   allow true    fp X
② 새로운 사람과 궁합 보기    job unknown  allow true    fp X
③ S05에서 '솔로' 선택       job none     allow FALSE   fp X   ← 겹쳤습니다
```

**조치는 boolean 1개**입니다. `job`·`stage`·`status` 문자열은 넣지 않았으므로
`crush`↔`dating`↔`married`는 여전히 같은 지문이고 `none`↔`dating`만 갈립니다.
프롬프트·schema·`promptVersion` 변경은 **0**입니다 — cache identity만 고쳤습니다.

⚠️ **`ended`는 대조군입니다.** tense가 `former`라 이미 분리돼 있었으므로, 결함은
`ended`가 아니라 **같은 시제 · 다른 정책**에서만 났습니다.

| 검증 | 결과 |
|---|---|
| `test:relationship-evidence` | 135 → **154건** |
| Journey A (dating → none) | 질문 **1 → 0** · 두 지문 모두 `REAL`(캐시 미스) · 서버 로그 `outwardQ=off questionsStripped=1` · AI 블록 5개 유지 |
| Journey B (none → dating) | 질문 **복원** · **서버 요청 증가 0**(캐시 히트) — 과도 무효화가 아닙니다 |

**한 줄 교훈** — **캐시가 무엇을 저장하는지 모르면 캐시 키를 정할 수 없습니다.** "이 값은
응답 내용을 정하지 않는다"가 참인지는 캐시가 raw를 저장하는지 최종 응답을 저장하는지에
달려 있었고, 저는 그것을 확인하지 않고 판단했습니다.

상세는 `기능명세_현행.md` **§8.13** · `기능명세서.md` **§42**.

---

### 같은 약속을 모든 AI 경로에 (v1.43 AI Task Contract Uniformity)

v1.42 보고를 검토하며 물어본 것은 "이 계약이 지켜지는가"가 아니라 **"이 계약이 어디에
있는가"**였습니다. 답은 `relationship-insight` **한 Task**였고, 같은 세션에서 이렇게
나왔습니다.

```
status = ended · 상대 4축 입력  →  job = ended · allowsOutwardQuestions = false

/mirror         AI 질문 0    ← 게이트 있음
/compatibility  AI 질문 2    ← 게이트 없음
   '서로의 개인 시간에 대한 생각은 어떤지 이야기해볼까?'
   '갈등 상황에서 어떻게 대처하는 것이 좋을지 이야기해볼까?'
```

관계가 끝났다고 답한 사람에게 **한 화면에서는 "이제 내가 말할 자리가 아닌 것 같아"라고
하고, 다른 화면에서는 "상대와 이야기해볼까?"라고 물었습니다.**

원인이 두 겹이었습니다.

| 층 | 상태 |
|---|---|
| 서버 | `runCompatibilityTask`에 `applyOutwardQuestionGate`가 없었습니다 |
| 화면 | 질문 섹션은 게이트를 지켰는데, GOOD/FRICTION 카드 footer의 `CompatibilityAxisNarrative`가 **그 분기 밖**에서 `conversationQuestion`을 그렸습니다 |

두 번째가 v1.42가 세운 **`UI 분기 금지 — 서버 경계에서 한 번만`** 규칙이 왜 필요한지
보여줍니다. 화면에 게이트를 두면 **게이트를 통과하지 않는 렌더 지점**이 남고, 그 지점은
사람이 목록을 훑어야 찾습니다.

#### 왜 fixture가 잡지 못했나

```
v1.42 test:ai   290건 PASS
그 안에 compatibility 시제 fixture 0건 · 질문 게이트 fixture 0건 · 근거 귀속 fixture 0건
```

> **없는 fixture는 실패하지 않습니다.**

그래서 v1.43은 fixture를 늘리는 것과 **별도로**, `TASK_CONTRACT`(Task 5종 × 차원 7개)를
선언하고 **빈칸을 구조 검사가 세게** 했습니다(TC0~TC6). `'not-applicable'`도 값으로
적습니다 — 그 구분이 없으면 **'여기엔 필요 없다'와 '아직 안 했다'가 같은 빈칸**으로 보입니다.

⚠️ 이 선언은 문서가 아닙니다. `aiClient.cacheKey`가 `TASK_CONTRACT[task].promptVersion`을
읽습니다(v1.42의 중복 표를 지웠습니다) — **선언만 하고 아무도 안 쓰는 계약은 언젠가 사실이
아니게 됩니다.**

#### 근거 귀속을 항목 단위로 좁혔습니다

v1.27이 deep-report에 세운 `AI_OUTPUT ⊆ DETERMINISTIC_EVIDENCE`가 나머지 3개 Task에는
없었습니다. 그리고 Task 전체 집합으로는 부족합니다.

```
contact narrative가 conflict의 ref를 인용한다
  → Task 전체 집합에는 둘 다 있으므로 통과
  → 화면에는 '연락' 설명 아래 '갈등 해결' 근거가 붙는다
```

이것이 오래된 비대칭 세 개를 **AI 경로에서** 닫았습니다.

| 사용자 답 | v1.42까지 |
|---|---|
| `hardest = value_gap`(돈·미래) | 결정론 엔진은 어느 축에도 그 ref를 만들지 않는데, AI가 붙이면 resolver가 **정상 문장**을 돌려줘 화면에 도달했습니다 |
| Mirror 축이 아닌 PastFactor 7개 | ref 문장에 축 정보가 없어 어느 축에 붙여도 사실이고, 화면에서 오귀속을 확인할 방법이 없었습니다 |
| `selfGap` | 축 판정에 들어가지 않는 값인데 축 근거로 붙을 수 있었습니다 |

⚠️ **`value_gap`을 매핑하지 않는 결정은 그대로입니다.** 돈·미래를 갈등 해결 근거로 바꿔
쓰는 건 비대칭을 없애는 게 아니라 근거를 왜곡하는 것입니다. 고친 것은 **그 결정이 AI
경로에서만 무효였던 것**이고, 그건 판정 규칙의 문제가 아니라 계약의 문제였습니다.

#### enforcement보다 로그를 먼저 넣었습니다

v1.42가 `relationship`을 v3 → v6까지 올리며 배운 것을 순서로 만들었습니다.

```
① logAiFilter를 4개 Task에 넣는다   (compatibility·history에는 아예 없었습니다)
② 실제 Provider로 BEFORE를 기록한다
③ 허용집합을 계산해 rejectedRefs를 관측한다
④ 거부가 정당한지 확인한다          ← 판단이 필요한 지점
⑤ enforcement를 켠다
```

④에서 실제로 판단이 필요했습니다. `/mirror`에서 1건이 거부됐고, 그 축이 `hobby`이며 그
축의 결정론 신호가 `이전 관계에서 취미 공유를 특별히 중요한 요소로 꼽지는 않았어`인 것을
확인한 뒤에야 "정당한 거부"라고 말할 수 있었습니다 — 모델이 붙인 근거
(`실제 관계에서 중요했던 것으로 대화 · 연락 · 갈등 해결 · 개인 시간을 골랐어`)에는
**취미가 없었습니다.** 개수만 보면 **과필터와 오귀속 차단을 구분할 수 없습니다.**

#### History — 허용했지만 만들 수 없던 계약

프롬프트는 `history` 근거 source를 허용했고, 파서는 `{entryId, axis}`를 요구했고,
context는 **`entryId`를 보내지 않았습니다.** 세 조각이 서로 다른 것을 전제했고 결과는
조용했습니다 — 실측에서 History AI 근거는 **0개**였고(uncertainty로만 생존) fixture는
전부 PASS였습니다(개수만 셌으니까요).

> **'허용한다'와 '만들 수 있다'는 다른 명제입니다.**

`comparedEntries`로 계약을 성립시켰습니다. 렌더링(`resolveHistory` ·
`HistoryAxisNarrative`)은 **v1.26부터 준비돼 있었고 입력만 빠져 있었습니다.**

| 검증 | 결과 |
|---|---|
| `test:ai` | 290 → **508건** |
| `test:relationship-evidence` | 154 → **259건** |
| lifecycle · history · observed | 144 · 100 · 10 **전부 유지** |
| 실제 Provider E2E | **6/6 PASS · SKIPPED 0 · FAIL 0** (4개 Task 새 promptVersion) |
| 브라우저 `ended` `/compatibility` | AI 질문 **2 → 0** · 본문 2개 유지 · `questionsStripped=4` |
| 브라우저 `dating` `/compatibility` | 같은 근거에서 질문 **2개 유지** (과필터 아님) |
| 브라우저 History | 근거 chip **0 → 3** · 실제 `history` ref 6건 |
| Production 가드 | dev 라우트 3종 404 · **관측 로그 0건** · 새 필수 파라미터 누락 시 400 (6종) |

**사용자가 보는 것 중 달라지는 것은 하나뿐입니다** — 관계가 끝났다고 답한 사람이 궁합
화면에서 더 이상 상대에게 물어볼 질문을 받지 않습니다.

**한 줄 교훈** — **한 경로에만 있는 안전 규칙은 사용자에게 안전 규칙이 없는 것과 같습니다.**
오히려 더 나쁩니다: 한 번 맞는 말을 듣고 나면 다음 말도 믿기 때문입니다.

#### Final Closure — 사용자가 고친 것을 두 줄 아래에서 반박하지 않습니다

Audit이 남긴 Remaining Risk 12건 중 **지금 사용자에게 모순된 화면을 보여주는 것 하나**를
닫았습니다. 실측 재현:

```
사용자가 고친 문장   "연락 자체가 아니라 혼자 있는 시간이 줄어드는 게 힘들었어."
바로 아래 AI         "연락은 중요하지 않다고 느꼈지만, 실제로는 연락 감소가
                      힘들었던 경험이 있었어."
```

`core.summary`는 독립된 관찰이 아니라 **AI가 만든 `core.headline`을 설명하는 문장**입니다.
headline이 사용자 문장으로 교체되면 그 summary는 **화면에 없는 문장을 설명하는 문장**이
됩니다.

세 가지 선택지 중 **렌더 경로 단일 게이트**를 골랐습니다.

| | 왜 아닌가 / 왜 맞나 |
|---|---|
| A · correction을 AI에 보내 다시 쓰게 한다 | 한 문장을 주고 설명하라고 하면 모델은 그 문장 **밖으로** 나갑니다 — 사용자 입력을 근거 삼아 없던 해석을 만드는 것이고, v1.43이 닫은 경계가 반대 방향으로 뚫립니다 |
| C · 서버가 응답에서 `core`를 지운다 | History `coreInsightOriginal`이 결정론 headline으로 떨어져 **사용자가 실제로 거부한 문장이 기록에서 사라집니다** |
| **B · 렌더 경로에서 막는다** | **채택.** 게이트를 페이지가 아니라 `coreNarrativeForRender` 한 곳에 둡니다 — v1.43이 방금 진단한 "게이트를 통과하지 않는 렌더 지점" 형태를 반복하지 않기 위해서입니다 |

⚠️ **지문에는 넣지 않았습니다.** 응답을 바꾸지 않으므로 대상이 아니고, 넣으면
`원래 관찰로 되돌리기`가 **다른 문장**을 가져옵니다. 실측(J3)에서 복원된 문장이
correction 이전과 글자 하나 같았습니다. 커플링은 구조 검사 CC4가 강제합니다 —
누군가 나중에 correction을 AI context에 넣으면 그때 실패합니다.

| 검증 | 결과 |
|---|---|
| `test:relationship-evidence` | 259 → **280건** (CC0~CC7) |
| J1 correction 추가 | Core AI 설명 **있음 → 없음** · 축별 설명 유지 · **AI 요청 증가 0** |
| J2 correction 변경 | 계속 없음 · **AI 요청 증가 0** |
| J3 correction 제거 | **원문 그대로 복원** · **AI 요청 증가 0** |
| Core Fallback | Core 섹션 · 사용자 문장 · 결정론 행 · 근거 목록 · 축별 AI 설명 **전부 잔존** |

**한 줄 교훈** — **고칠 수 있게 해놓고 고친 것을 무시하면, 그 입력창은 의견을 듣는 자리가
아니라 의견을 흘려보내는 자리입니다.**

상세는 `기능명세_현행.md` **§8.14 · §8.15** · `기능명세서.md` **§43 · §44** ·
기획서 **§5.32.7**.

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
| **Relationship History** | 저장된 과거 Snapshot(현재 세션과 별개 저장소). 커플 기록은 Mirror Snapshot, Solo 기록은 Self Signal Snapshot | F1~F3 · S-FC |

```
CURRENT   = 지금의 기준          매번 다시 계산한다
HISTORY   = 당시의 frozen observation   그때의 값을 그대로 얼려둔다
CHANGE    = 두 snapshot의 비교
```

> **Retention Principle** — 러비는 한 번의 결과를 기억하는 게 아니라,
> 시간이 지나며 달라지는 기준을 관찰한다.
>
> 그래서 History는 **상대의 lifecycle에 묶이지 않습니다.** 새 상대를 시작해도
> (`resetTargetContext()`) 기록은 남습니다 — 기록의 주어가 상대가 아니라 나이기
> 때문입니다. 기록이 지워지는 경로는 사용자가 명시적으로 고른 두 곳뿐입니다.
>
> 그리고 **매일 오게 만드는 앱이 아닙니다.** `streak`·`연속 기록` 어휘를 쓰지 않고,
> 반복 어휘는 관찰 3회부터 씁니다 — 2시점은 반복의 증거가 아닙니다.

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

> ⚠️ **v1.22 — demo 모드는 사진 관찰을 만들지 않습니다.** 예전에는 `AI_MODE≠real`일 때
> 고정 관찰 목록(`ob1~ob4`: "영화관·상영 시간표가 담긴 사진이 반복적으로 관찰됐어" 등)을
> 돌려줬습니다. 그래서 Provider가 붙지 않은 배포에서 **음식 사진만 올린 사용자에게도 영화
> 관찰이 자기 결과로 보였습니다.** 이제 사진 내용을 읽지 못하면 trait을 **0개** 반환하고,
> 화면이 지금 상태(`demo` / `provider_failed`)를 사실대로 말합니다.
>
> 고정 문장은 `buildSampleObservedResult()` 한 곳에만 남아 있습니다. 그 함수는
> `createSampleAnswers()`(샘플 세션)만 타며, **사진을 업로드한 사용자의 결과 경로와는
> 완전히 분리돼 있습니다.** 진입점은 dev 전용 PrototypePanel과, S06 `/profile/intro`의
> '샘플 답변으로 결과부터 볼게'(Production 노출 · 사용자가 직접 선택) 두 곳입니다.
>
> **배포 환경 체크리스트** — 실제 사진 분석을 쓰려면 서버에 아래 3개가 있어야 합니다.
> 없으면 앱은 정상 동작하지만 사진 관찰은 비어 있습니다.
> ⚠️ 실제 Key 값은 이 저장소에 적지 않습니다 — `.env.local`(gitignore)이나 배포 플랫폼의
> 환경변수 설정에만 넣습니다.
>
> | 변수 | 값 | 범위 |
> |---|---|---|
> | `AI_MODE` | `real` | 서버 전용 (`NEXT_PUBLIC_` 금지) |
> | `AI_API_KEY` | Provider Key | 서버 전용 |
> | `NEXT_PUBLIC_AI_MODE` | `real` | 첫 호출 이전 배지 힌트용 |
>
> ⚠️ **`NEXT_PUBLIC_AI_MODE`만 `real`로 두면 아무것도 real이 되지 않습니다.** Provider
> 선택은 `serverEnv.ts`의 server-only 값(`AI_MODE` + `AI_API_KEY`)만 봅니다. 이 변수는
> 사진을 고르는 시점(아직 응답이 없는 시점)의 안내 문구를 고르는 **표시용 힌트**이고,
> 결과의 진짜 모드는 응답 `meta.mode`가 말합니다. 전체 표: `기능명세_현행.md` §8.4.
>
> **Production 현재 상태 (2026-09-07 실측 · v1.40.1)** — Production은 **`real`** 입니다.
>
> ```bash
> curl -sX POST https://loveyouloveme.vercel.app/api/ai/observed-profile \
>   -H 'Content-Type: application/json' -d '{"inputFingerprint":"probe","images":[]}'
> # → {"ok":false,"reason":"NO_USABLE_IMAGE","requestId":"…"}
> ```
>
> 사진을 한 장도 보내지 않는 이 probe는 **비용이 들지 않으면서** 두 가지를 함께
> 증명합니다. `handlers.ts`의 분기 순서가
>
> ```
> provider = resolveProvider(true)
> if (!provider) → mode==='real' ? CONFIG_ERROR : demo 결과(ok:true)
> if (photoCount === 0) → NO_USABLE_IMAGE      ← 여기 도달했습니다
> ```
>
> 이고, Production은 `NODE_ENV=production`이라 `mock`이 강제로 `demo`로 내려갑니다
> (`serverEnv.ts`). 따라서 provider가 살아 있다는 것은 **`AI_MODE=real` AND `AI_API_KEY`
> 존재**를 동시에 뜻합니다 — v1.39에서 "Key 유무는 이 응답으로 판별할 수 없다"고 남겨둔
> 항목이 이 한 번의 probe로 함께 확정됐습니다.
>
> **클라이언트 힌트도 일치합니다.** Production `/profile/photos`가 real 문구
> (`선택한 사진은 AI 분석을 위해 서버로 전송될 수 있어. …`)를 렌더하고 데모 문구
> (`지금은 데모 모드라 사진을 전송하지 않아`)는 **0건**입니다 → `NEXT_PUBLIC_AI_MODE`도
> real입니다. 위에서 경고한 **'서버는 real인데 안내 문구만 demo'(= 개인정보 문구가 거짓이
> 되는 상태)는 아닙니다.**
>
> **여기까지가 VERIFIED이고, 아래는 NOT VERIFIED입니다** — 구분해서 씁니다.
>
> | | 항목 |
> |---|---|
> | **VERIFIED** | Production runtime의 real 분기 도달 · Provider 설정(`AI_MODE` + Key) 존재 · 클라이언트 힌트 일치 |
> | **NOT VERIFIED** | **실제 사용자 사진의 내용 인식 품질** (저장소에 사진 asset이 없고 검증 브라우저가 파일 업로드를 못 합니다) · Production 화면에서 `AI OBSERVATION` 배지 육안 확인 · Key의 **유효성**(만료·quota — 위 probe는 Provider 호출 **전** 분기라 '설정돼 있음'까지만 증명합니다) |
>
> v1.39는 같은 endpoint에서 `meta.mode: "demo"`를 실측했고 **그 시점에는 사실이었습니다.**
> 그 뒤 환경변수가 설정됐고, v1.40.1에서 문서를 사실에 맞췄습니다.

**Observed(사진) 파이프라인** — 사진을 한 번에 전체 보내지 않고 **1장씩** Vision
Provider에 보내 관찰만 받고, "몇 장에서 반복됐는지"는 애플리케이션 코드가 집계합니다
(`lib/logic/observedSignals.ts`) — Provider가 반복 여부를 스스로 주장하지 못하게 하기
위해서입니다. 상세는 기능명세서 §6.9.5.

**2026-09-07(v1.39)에 실제 `AI_API_KEY`로 `npm run test:ai:e2e`를 재실행해 6 Task 전부
`mode: real`로 PASS(6/6 · SKIPPED 0 · FAIL 0)를 확인했습니다** — 최초 확인은
2026-09-04(v1.17)이었습니다. 둘 다 **"이 실행 기준"** VERIFIED이고, 상시 CI로 매 배포마다
검증하는 것은 아닙니다. 자세한 구분은 기능명세서 §12.1·§8.5·§14.1·§36.10.

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
남고 외부로는 나가지 않습니다.

**Analytics 식별자 경계 (v1.19 Release Gate).** 두 종류의 식별자를 **절대 섞지 않습니다.**

| | `analysisId` (내부) | `funnel_analysis_id` (외부) |
|---|---|---|
| 값 | 답변을 이어붙인/해시한 지문 — `solo_exp` `2` `now` `5` … 를 `\|`로 연결한 문자열 | opaque random UUID |
| 만드는 곳 | `analysisFingerprint()` · `compatibilityNarrativeFingerprint()` | `crypto.randomUUID()` |
| 쓰는 곳 | History 키 · AI 캐시 키 · UT 응답 로컬 저장 키 | **Analytics 전용** |
| GA4 전송 | ❌ **안 합니다** | ✅ 이것만 보냅니다 |

v1.19 게이트 이전에는 `deep_report_view` 등이 `ep.analysis_id=solo_exp|2|now|5|a2|h3|…`를
GA4로 보내고 있었습니다. 문자열 자체가 관계 상태·연락 중요도·갈등 스타일·개인 시간·애정
표현·가장 힘들었던 순간 같은 **응답 프로필 전체를 복원**할 수 있어 전부 제거했습니다(11개
이벤트). 재발은 `src/lib/analytics.ts`의 `sanitizeForExternal()`이 막습니다 — 외부로 나가는
payload에서 금지 키와 지문 모양 값을 걸러내고, 개발 중에는 `console.error`로 알립니다.
로컬 store에는 원본이 그대로 남습니다(기기 밖으로 나가지 않고 UT 회수·디버깅에 필요).

**v1.19 — 실제 전송을 실측했습니다(부분 VERIFIED).** production 빌드(`npm run build && npm run start`)에서
Consent를 `granted`로 두고 Premium Funnel을 실제로 밟았을 때, 브라우저가
`https://www.google-analytics.com/g/collect?v=2&tid=G-BP36BVESJ0`으로 **HTTP POST를 보내고
GA4가 `204`로 응답하는 것**을 확인했습니다. POST 본문에 이벤트명과 parameter가 실려 있습니다:

```
en=premium_entry_click&ep.source=compatibility&epn.price=1900
  &ep.hook_variant=friction_why&ep.funnel_analysis_id=0b7318a3-…
en=premium_paywall_view&…
en=deep_report_value_rating&epn.score=5&ep.funnel_analysis_id=…
en=deep_report_wtp_after_view&epn.price=1900&ep.choice=maybe&…
```

확인된 이벤트: `premium_entry_view` · `premium_entry_click` · `premium_paywall_view` ·
`premium_purchase_intent` · `premium_fake_door_reveal` · `premium_dismiss` ·
`deep_report_complete` · `deep_report_value_rating` · `deep_report_wtp_after_view`.

> ⚠️ **여기까지가 확인한 사실입니다.** 확인한 것은 "브라우저가 올바른 payload를 GA4로 보냈고
> GA4 수집 엔드포인트가 204로 받았다"이고, **GA4 Realtime / DebugView 대시보드에 실제로
> 표시되는 것까지는 확인하지 않았습니다** — 그 화면은 계정 소유자만 볼 수 있습니다.
> 대시보드 확인은 남은 항목입니다.
>
> ⚠️ 위 실측은 `localhost`에서 **실제 Measurement ID로** 이뤄졌으므로, 그 테스트 이벤트가
> 실 GA4 속성에 들어가 있습니다. GA4 Admin → Data Streams → Configure tag settings →
> **Define internal traffic**에 localhost를 등록하고 `internal` 트래픽을 제외하면 이후
> 개발 트래픽이 리포트를 오염시키지 않습니다.
>
> ⚠️ Event parameter로 **보내는 것**과 GA4 리포트에서 **바로 분석할 수 있는 것**은 다릅니다.
> `hook_variant` · `source` · `price` · `choice` · `score`는 GA4 Admin에서 **Custom
> Dimension으로 등록해야** 보고서에 나옵니다. `funnel_analysis_id`는 고카디널리티라
> 등록하지 않는 쪽을 권장합니다(`docs/기능명세서.md` §6.8.10-L).

> 개발 모드에서는 React StrictMode가 effect를 두 번 실행하므로 화면 노출 계열 이벤트가 2로 보일 수 있습니다. 프로덕션 빌드에서는 1회만 발생합니다.

---

## 러비(Lovy)

- 최종 캐릭터 에셋 14종(`public/lovy/*.png`)만 사용합니다. 새 캐릭터를 만들지 않습니다.
- 역할은 **관찰자**입니다. 상담가·점쟁이·절대적 AI가 아닙니다.
  관찰 → 이상한 점 발견 → 질문 → 근거 제시 → 사용자 확인 → 학습
- 크게 쓰는 곳: Splash · Onboarding · AI Loading · 중요한 Insight · Mirror Teaser · Empty/Error
  일반 입력 화면에서는 38~46px 아바타 + 말풍선으로만 등장합니다.

### 두 개의 루프 — 4단계와 5단계는 다른 것입니다 (v1.39)

```
ANALYSIS SEQUENCE (한 번의 분석 안에서)
OBSERVE → COLLECT → CONNECT → REPORT                     4단계 · loading 연출

PRODUCT LEARNING LOOP (분석과 분석 사이, 시간축에서)
OBSERVE → COLLECT → CONNECT → REPORT → REMEMBER          5단계 · 세계관
```

`REMEMBER`는 **다섯 번째 애니메이션 단계가 아닙니다.** History 저장 · Snapshot 동결 ·
Change Moment · 과거/현재 비교 = 분석이 끝난 **뒤** 시간축에서 일어나는 제품 행동이고,
담당 화면은 S27R 저장 → F3 → F1 → F1-a → F2입니다.

`LovyObservation`(S08 · S20)의 loading 단계는 **4단계로 고정**합니다. 여기에 REMEMBER를
얹으면 v1.38이 6.1초 → 2.6초로 줄인 Time-to-Value가 다시 늘어나고, 아직 저장하지도 않은
행동을 진행 중이라고 말하게 됩니다. 자세히: `기능명세_현행.md` §1.6 · §4.7.

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
- **실제 AI Provider end-to-end는 2026-09-04(v1.17) · 2026-09-07(v1.39) · 2026-09-08(v1.41 · v1.42 · v1.43)에 실제 Key로 6/6 PASS를 확인했습니다.** 상시 CI 검증은 아니라 "이 실행 기준"입니다 — API Key 없이도 스키마/안전 검증(`test:ai`)은 항상 실측합니다.
- **v1.43에서 그 조치가 실제로 작동했습니다.** 하네스를 새 계약(필수 파라미터 4종)으로
  고치기 **전** 실행에서 5개 Task가 라우트의 400을 받았고, reporter는 그것을 **FAIL 5**로
  보고했습니다 — SKIPPED로 숨기지 않았습니다. v1.42가 고친 것이 v1.43에서 검증된 셈입니다.
- **v1.42에서 이 검증 도구 자체의 결함을 고쳤습니다.** `run-provider-e2e.mjs`가 `mode !== 'real'`인 응답을 전부 `SKIPPED — KEY NOT AVAILABLE`로 보고하고 있어서, 라우트가 400을 돌려줘도 "키가 없어 건너뜀"으로 찍혔습니다(v1.42 작업 중 실제로 발생 — 같은 키로 다른 4개 Task는 PASS였습니다). 이제 `CONFIG_ERROR`/demo만 SKIPPED이고 나머지 `ok:false`는 **FAIL**입니다. **검증 도구가 실패를 부재로 보고하면 통과 자체가 증거가 되지 않습니다.**
- **Production의 실제 사진 분석은 아직 켜지지 않았습니다(v1.39 실측).** Production 응답이 `meta.mode: "demo"`라서, 배포된 앱에서 사진을 올리면 관찰이 **0개**로 정직하게 비어 있습니다(거짓 관찰을 만들지는 않습니다 — 이 점은 Production에서 직접 확인했습니다). 코드는 정상이고 남은 것은 Vercel Production 환경변수 설정 + Redeploy입니다(USER ACTION REQUIRED · `기능명세서.md` §36.9).
- **사주 명식 계산 엔진 미연결.** 절입 시각·진태양시 등 정밀 계산이 필요해 `NEXT_PUBLIC_SAJU_ENGINE_READY=false`로 정직하게 "준비 중" 상태를 보여줍니다.
- **GA4는 실제 전송까지 실측했고, 대시보드 수신은 미확인.** v1.19에서 production 빌드 + Consent granted 상태로 `google-analytics.com/g/collect`에 올바른 payload가 POST되고 GA4가 `204`로 응답하는 것을 확인했습니다. 다만 **GA4 Realtime/DebugView 화면에 뜨는 것까지는 확인하지 않았습니다**(계정 소유자만 볼 수 있음). 또한 `hook_variant`/`source`/`price`/`choice`/`score`는 GA4 Admin에서 Custom Dimension 등록을 해야 리포트에 나옵니다.
- **Rate Limit은 여전히 인스턴스 메모리 기반.** `RateLimitStore` 인터페이스로 경계는 분리했지만(v1.12), 연결할 공유 저장소(Redis 등) credential이 없어 `SharedRateLimitStore`는 구현하지 않았습니다 — 서버리스 다중 인스턴스에서 정확하지 않습니다(distributed rate limiting NOT VERIFIED).
- 실제 사용자 매칭 · 실제 결제(PG)는 포함하지 않습니다.
- **관계 단계별 생활 데이터(가사·재정·주거·양육)는 받지 않습니다(v1.40).** 그래서 `long_term`
  해석은 4축의 **반복성**만 다루고, 생활 문제를 추론하지 않습니다 — 없는 데이터로 개인화하지
  않는다는 원칙의 결과입니다.
