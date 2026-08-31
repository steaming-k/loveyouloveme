# 럽유럽미 (Love U Love Me)

> 상대를 사랑하는 과정에서 나에 대해 더 깊게 이해하고, 나를 사랑하는 방법을 알아가는 서비스

**궁합은 Hook, Relationship Mirror가 Product, Relationship History는 Future Retention.**
이 제품 논리를 Route · State · Component · Copy · Analytics 전체 구조에 반영한 0→1 MVP 구현입니다.

- 기준 문서: [`docs/럽유럽미_기획서_v1.md`](docs/럽유럽미_기획서_v1.md), [`docs/design-guide.md`](docs/design-guide.md)
- Source of Truth: `럽유럽미 와이어프레임.zip` (High-Fidelity Product Wireframe, 29 Core + Edge/Future/Share/Add-on)

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

> ⚠️ `next dev`가 떠 있는 상태에서 `npm run build`를 돌리면 `.next`가 충돌합니다.
> 빌드 전에 dev 서버를 끄거나, 충돌 시 `.next`를 지우고 다시 시작하세요.

### 데스크톱 프로토타입 패널

`lg` 이상에서는 393×852 프레임 옆에 UT·개발용 패널이 함께 뜹니다 (와이어프레임 1a와 동일한 역할).

- 현재 화면 (S번호 · 화면명)
- 실시간 계산값: 동기화율 / 잘 맞는 신호 / 관찰 필요 신호 / 비교한 항목 / Mirror GAP
- Primary KPI: Mirror 진입률
- 전체 화면 점프, 답변 초기화, **김지수 샘플 세션 불러오기**

---

## 스택

React 19 · **Next.js 15 (App Router)** · TypeScript (strict) · **Tailwind CSS v4** · Framer Motion · Lucide React

상태는 React Context + `localStorage` 한 곳(`SessionProvider`)에서만 관리합니다. MVP 규모에서 별도 상태 관리 라이브러리를 넣지 않았습니다.

---

## 화면 ↔ Route 매핑

| WF | 화면 | Route |
|---|---|---|
| S01 | 스플래시 | `/` |
| S02~S04 | 온보딩 3단 | `/onboarding` |
| S05 | 관계 상태 | `/status` |
| S06 | 프로필 빌딩 인트로 | `/profile/intro` |
| S07 | 사진 입력 | `/profile/photos` |
| S08 | 사진 분석 로딩 | `/profile/analyzing` |
| S09 | **Observed Me 결과** | `/profile/observed` |
| S10~S13 | Declared Me 질문 4개 | `/profile/declared/[1-4]` |
| S14 | 과거 관계 인트로 | `/profile/past/intro` |
| S15~S17 | Relationship Me 질문 3개 | `/profile/past/[1-3]` |
| S18 | **Relationship Profile** | `/profile/result` |
| S19 | 상대 정보 입력 | `/target` |
| S20 | 궁합 로딩 | `/compatibility/analyzing` |
| S21 | **Compatibility Hero** | `/compatibility` |
| S22 | **Why (근거)** | `/compatibility/why` |
| S23 | 잘 맞는 신호 | `/compatibility/good` |
| S24 | **관찰이 필요한 신호** | `/compatibility/friction` |
| S25 | 대화 질문 | `/compatibility/questions` |
| S26 | **Mirror Teaser (KPI 전환점)** | `/mirror/teaser` |
| S27 | **Relationship Mirror** | `/mirror` |
| S28 | **Core Insight** | `/mirror/insight` |
| S29 | 분석 후 홈 | `/home` |
| E1 | 데이터 부족 | `/mirror`, `/profile/result` 내 상태 |
| E2 | AI 오류 | `/profile/analyzing?error=1`, `/compatibility/analyzing?error=1` |
| E3 | 확신 낮음 | `/compatibility` 내 상태 (비교 항목 3개 미만) |
| E4 | 연애 경험 없음 | `/profile/past/none` |
| F1 / F2 | Relationship History / 변화 리포트 (Future) | `/history`, `/history/report` |
| SH1 / SH2 | 궁합 / Mirror 공유 카드 | `/share/compatibility`, `/share/mirror` |
| X1 | 러비의 다른 관측 렌즈 (Add-on) | `/lens` |

---

## 디렉터리 구조

```
src/
├─ app/                    Route (App Router) — 화면당 하나
├─ components/
│  ├─ common/              Button, ScreenLayout/Header, SelectableRow, ChoiceChip,
│  │                       ScaleSelector, SegmentedField, Toggle, BottomSheet,
│  │                       ConfirmModal, Toast, BottomNavigation, StateScreens, primitives
│  ├─ lovy/                Lovy, LovyMessage, LovyLoading
│  ├─ onboarding/          OnboardingVisual
│  ├─ profile/             PhotoGrid, ObservationCard, ProfileLayerStack
│  ├─ compatibility/       SyncScore, SignalGauge, DimensionAccordion, SignalCard,
│  │                       ConversationCard
│  ├─ mirror/              MirrorRadar, MirrorComparisonRow, TeaserComparison
│  └─ shell/               AppShell, PrototypePanel, MotionProvider
├─ data/                   질문·라벨·카피·러비 에셋·축 정의 (순수 데이터)
├─ hooks/                  useAnalysis (결과 셀렉터), useAiNarrative (AI 설명), useShare
├─ lib/
│  ├─ logic/               values · compatibility · mirror · profile · observed · history (순수 함수)
│  ├─ aiFingerprint.ts     AI 재호출/무효화 기준 (MBTI·출생정보·Premium 제외)
│  ├─ aiEvidenceResolver.ts EvidenceRef → 실제 세션 데이터 문장
│  ├─ analytics.ts         trackEvent + Primary KPI 스냅샷
│  ├─ validation.ts        입력 검증
│  ├─ routes.ts            Route 상수 + 화면 보드
│  └─ shareCard.ts         Canvas 2D 공유 카드 PNG 저장
├─ app/api/ai/**           AI Route Handler (server-only 경계)
├─ services/ai/            Provider 추상화 · 프롬프트 · 검증 · 안전장치 · 클라이언트
├─ services/aiService.ts   화면이 쓰는 유일한 분석 파사드
├─ state/                  SessionProvider, defaultAnswers
├─ styles/globals.css      Design Token (@theme) + reveal/Lovy 애니메이션
└─ types/                  도메인 타입
```

**UI는 분석 데이터를 직접 import하지 않습니다.** 모든 분석 결과는 `services/aiService.ts`(+ `services/ai/aiClient.ts`)를 통해서만 들어오고, 계산식은 `lib/logic/*` 한 곳에만 존재합니다. 화면은 AI Provider를 알지 못합니다.

---

## 데이터 모델

기획서 §5.2 구조를 그대로 따릅니다.

| 개념 | 의미 | 출처 화면 |
|---|---|---|
| **Observed Me** | 사진에서 관찰된 취향·라이프스타일 | S07~S09 |
| **Declared Me** | 사용자가 직접 답한 관계 기준 | S10~S13 |
| **Relationship Me** | 과거 관계 경험에서 드러난 실제 기준 | S15~S17 |
| **Target Person** | 사용자가 *알고 있는* 상대 정보 | S19 |
| **Compatibility** | 두 사람의 공통점 / 차이 | S21~S25 |
| **Relationship Mirror** | Declared Me vs Relationship Me | S26~S28 |

---

## ⚠️ 판정은 규칙이 한다 (AI가 하지 않는다)

**아래 계산은 심리 검사나 과학적 진단 로직이 아닙니다.** 입력값의 공통점·차이를 사용자가 직관적으로 읽을 수 있게 만든 규칙 기반 로직입니다.

> **v1.6~v1.7 갱신.** 예전에는 이 문단이 '실제 AI 백엔드가 붙으면 `aiService` 구현만 교체하면 된다'고 적혀 있었습니다. AI는 v1.6에서 실제로 붙었고, v1.7에서 Core Experience 전체에 연결됐습니다. **하지만 아래 계산이 AI로 대체된 것은 아닙니다.**
>
> ```
> Evidence → Deterministic Rule → AI Explanation → User Verification
> ```
>
> AI는 동기화율·Mirror 판정(MATCH/GAP/CHANGE)·History 판정(STABLE/SHIFT/NEW)·MBTI·Sun Sign을 **만들거나 바꾸지 못합니다.** 서버가 AI 응답의 판정 필드를 규칙 값으로 덮어쓰고, 근거 문장도 AI가 아니라 코드가 실제 세션 데이터에서 만듭니다.
>
> **AI 모드** — `AI_MODE`(server-only): `demo`(기본·Provider 미호출) / `real`(`AI_API_KEY` 필수) / `mock`(개발 전용). `.env.example` 참고.
> ⚠️ **실제 Provider end-to-end는 아직 검증되지 않았습니다** (API Key 없음). 자세한 구분은 기능명세서 §8.5.
>
> **AI 검증 회귀 테스트**: `npm run dev` 후 `npm run test:ai` (Provider Key 불필요).

### 동기화율 (`lib/logic/compatibility.ts`)

6개 축(대화 방식 · 생활 리듬 · 개인 시간 · 애정 표현 · 갈등 해결 · 연락 방식)을 1~5로 정규화한 뒤

```
축별 alignment = max(0, 5 - |나 - 상대|)
score = 40 + floor(비교가능한 축의 alignment 평균비율 × 52)
```

- `alignment >= 4` → 잘 맞는 신호 / `<= 2` → 관찰이 필요한 신호
- 상대 정보를 **'모름'**으로 남긴 축은 계산에서 제외되고, 비교 가능한 축이 3개 미만이면 점수를 만들지 않고 `?`(E3)로 둡니다
- 하한을 40으로 둔 이유: 일부 축이 다르다고 해서 '0점'처럼 읽히면 사용자가 관계를 단정적으로 해석하게 되기 때문입니다

> 이 값은 **연애 성공 확률이 아닙니다.** 코드와 UI 어디에서도 success / prediction 같은 표현을 쓰지 않습니다.

### Relationship Mirror (`lib/logic/mirror.ts`)

```
|관계 - 말한 값| <= 1   → MATCH    말한 기준과 관계에서의 반응이 비슷
관계 - 말한 값 >= 2     → GAP      중요하지 않다고 했지만 관계에서 더 크게 반응
말한 값 - 관계 >= 2     → CHANGE   중요하다고 했지만 경험 후 우선순위가 내려감
```

Teaser·Core Insight는 GAP이 있으면 첫 GAP 축, 없으면 차이가 가장 큰 축을 잡습니다.

### 검증된 기준 시나리오

김지수(29세, 솔로, 연애 경험 있음) 페르소나로 전체 플로우를 통과하면 기획 기준값이 그대로 재현됩니다.

- 동기화율 **78** / 잘 맞는 신호 **4** / 관찰 필요한 신호 **2**
- Mirror: 개인 시간 `MATCH` · 연락 `GAP` · 취미 공유 `CHANGE`
- Core Insight: *"너는 연락 자체보다 '관계가 계속 연결되어 있다는 느낌'을 중요하게 보는 사람일지도 몰라."*

---

## Analytics & Primary KPI

`lib/analytics.ts`의 `trackEvent(name, properties)` 하나로 통일했습니다. 실제 SDK를 붙일 때 이 함수 내부만 바꾸면 됩니다.

```
Primary KPI = relationship_mirror_entry_click / compatibility_complete
```

= *"궁합 때문에 들어왔지만 결국 나에 대한 분석까지 보게 되는가?"*

`getPrimaryKpi()`로 현재 진입률을 읽을 수 있고, 데스크톱 프로토타입 패널에 실시간 표시됩니다. 전체 이벤트 목록은 `ANALYTICS_EVENTS` 상수를 참고하세요 (온보딩 → 프로필 → 궁합 → Mirror 전 구간 31종).

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

- 사진은 브라우저 안에서만 쓰이고 서버로 보내지 않습니다. 새로고침 시 업로드한 이미지의 blob URL은 만료됩니다(의도된 동작).
- 러비의 관찰은 결론이 아니라 초안입니다. 항목별로 **수정 / 분석 제외 / 되돌리기**가 가능합니다.
- 상대 분석은 *"네가 알고 있는 정보를 기준으로"* 비교하며, 상대의 실제 마음이나 성격을 판정하지 않습니다.
- 공유 카드는 기본적으로 상대 정보를 포함하지 않습니다(토글로 선택).

---

## 접근성

semantic HTML · 실제 `button`/`input[type=radio]`/`checkbox` 사용 · 모든 터치 타깃 44px 이상 · visible focus ring · icon-only 버튼 `aria-label` · 이미지 `alt`(장식은 `aria-hidden`) · `aria-live` 토스트/로딩 · 게이지·상태는 색만으로 구분하지 않고 스크린리더 텍스트를 함께 제공 · `prefers-reduced-motion` 시 애니메이션 정지.

> 첫 화면에 바로 보이는 등장 연출은 JS(Framer Motion) 대신 CSS 애니메이션으로 처리합니다. `useReducedMotion()`으로 `initial` prop을 갈아끼우면 서버 렌더 결과와 첫 클라이언트 렌더가 달라져 hydration이 깨지기 때문입니다.

---

## 현재 범위 밖 (의도적 제외)

- **Supabase 미연동.** 세션은 `localStorage`에만 저장됩니다. `docs/supabase-info.md`의 자격 증명은 아직 쓰지 않습니다. 붙일 때는 `services/aiService.ts`와 `state/SessionProvider.tsx` 두 경계만 건드리면 됩니다.
- **Relationship History**는 Future Concept 화면(F1/F2)으로만 존재합니다. 연애 일기처럼 구현하지 않았습니다.
- **MBTI · 사주 · 점성술**은 Main Flow에 없고 `/lens`의 '준비 중' 렌즈로만 남겨뒀습니다.
- 실제 사용자 매칭 · 결제 · 이미지 비전 분석은 포함하지 않습니다.
