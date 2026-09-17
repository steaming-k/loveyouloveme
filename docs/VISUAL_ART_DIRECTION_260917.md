# Visual Art Direction Polish — LOVY FIELD NOTES (v1.48)

작업일 : 2026-09-17
브랜치 : `feat/v147-supabase-persistence-clean`
기준 HEAD : `a1f3cc1` (= `a07c6c3` + 화면별 기능명세 docs 커밋)

성격 : **VISUAL ONLY.** 계산 · 판정 · 자격 · 가격 · AI Prompt · Route · Analytics ·
Persistence · 카피 의미는 한 줄도 바꾸지 않았다. 바뀐 것은 표면 · 타이포 · 배치 ·
간격 · 장식용 SVG 뿐이다.

------------------------------------------------------------------------

## 1. 무엇이 문제였나 (Before Audit · 393×852)

각 화면을 DOM에서 실측했다. 기준:
`cards` = radius ≥ 10px이고 배경 또는 테두리가 있으며 200×40px보다 큰 표면.
`pills` = radius ≥ 4px이고 높이 ≤ 34px인 텍스트 알약.

| 화면 | cards | pills | 10px/600 tiny uppercase |
|---|---|---|---|
| Splash | 0 | 0 | 1 |
| Compatibility | 15 | 6 | 5 |
| Relationship Mirror | 19 | 7 | 11 |
| Premium (paywall) | 16 | 3 | 2 |
| Premium (unlocked) | 21 | 4 | **27** |
| Home | 12 | 7 | 9 |
| Lens · MBTI | 10 | 8 | **25** |
| Lens · 사주 | 11 | 2 | 7 |

발견한 'AI-generated UI' 패턴:

- **A. rounded rectangle overuse** — 한 화면에서 radius가 8/10/12/13/14/15/18px까지
  동시에 쓰였고(Mirror 10종), 그 값들이 역할과 무관하게 섞였다
- **B. 같은 카드의 세로 반복** — Mirror의 축 행 4개, Home의 최근 관찰 3개,
  Premium의 후보 장 3개가 모두 같은 규격의 흰 카드였다
- **C. tiny uppercase eyebrow 남발** — Premium 리포트에 10px semibold 라벨이 **27개**.
  모든 섹션이 `tiny uppercase → 19px 제목 → 캡션` 3단으로 반복됐다
- **D. 상태를 색 tag 하나가 짊어짐** — Mirror의 `GAP`/`MATCH`/`CHANGE`가 오른쪽 위
  알약 색으로만 갈렸다. 네 개의 똑같은 카드 + 색 tag 하나
- **E. pastel SaaS feel** — `pastel background + white rounded card + purple CTA`의 반복

그리고 가장 중요한 진단: **러비와 카피를 지우면 어느 화면도 다른 AI 앱과 구분되지 않았다.**
Splash는 캐릭터를 정중앙에 놓고 이름을 밑에 붙인 **캐릭터 앱의 기본형**이었고,
Premium이 파는 '연결'은 회색 상자 안 작은 메타 라벨이었다.

------------------------------------------------------------------------

## 2. Art Direction

`LOVY FIELD NOTES` = Editorial Field Notes × Alien Observation Lab.
정의와 규칙은 `docs/design-guide.md` §13에 들어갔다.

핵심 한 줄 : **브랜드 차별화는 장식이 아니라 관찰 흔적의 시각화에서 만든다.**

⚠️ Alien Observation Lab은 SF 장식이 아니다. 우주 · 별 · 행성 · 네온 · HUD를
추가하지 않았다.

------------------------------------------------------------------------

## 3. Phase A — Visual Foundation

`src/styles/globals.css`

- **토큰** — rule 3단계(`--color-rule-hair/mid/ink`) · marker 2종
  (`--color-marker-observe/connect`) · highlight field 2종 · radius 역할 4종
  (`control 15 / note 14 / evidence 3 / editorial 0`) · editorial type 3종
  (`--text-figure 64px` · `--text-feature 21px` · `--text-annotation`)
  ⚠️ **새 색을 만들지 않았다.** Purple(분석) / Mint(러비) / Neutral의 역할 구분은
  §4 그대로다.
- **Surface System** — `.surf-observation` / `.surf-evidence` / `.surf-insight` ·
  `.field-rule(-mid/-open)` · `.obs-dot` · `.obs-index` · `.evidence-source` ·
  `.mark-brand` / `.mark-mint`
- **Motion** — `connect-draw` · `marker-in` · `overlap-split` 3개만 추가.
  기존 duration/easing 값은 하나도 바꾸지 않았다.

`src/components/common/fieldNotes.tsx` (신규) — `FieldRule` · `ScreenMarker` ·
`LovyMark` · `ObservationIndex` · `ObservationNote` · `EvidenceNote` ·
`InsightFeature` · `SignalTrack` · `SignalTrackLegend`.
이 파일의 모든 컴포넌트는 **계산하지 않고, 판정하지 않고, 문구를 짓지 않는다.**

------------------------------------------------------------------------

## 4. Phase B — Signature Screens

### Splash (`src/app/page.tsx`)

정중앙 stack → **editorial cover**. 상단 편집 marker(rule + 넓은 자간) · 러비를
오른쪽으로 비대칭 배치 · 왼쪽에 관찰 marker 1개 + 연결선 1개 · 서비스명을 좌측 정렬
40px bold로 화면의 focal point로 · 하단 서명 줄.
`LovySequence` 애니메이션과 화면 전체 tap, 라우팅 조건은 그대로다. **새 애니메이션 0.**

### Compatibility (`SyncScore` · `SignalStructure` 신규)

`큰 숫자 하나 + 회색 알약 고지` → **수치와 신호 구조가 하나의 composition**.

```
SYNC RATE · 동기화율
55 │ 관계의 결과를 예측하는 점수는 아니야
────────────────────────────────
개인 시간   ────────◉────    일치
갈등 해결   ──●───────○──    차이 4
```

`result.dimensions`의 `mineValue` / `theirsValue`만 읽는다. radar chart 없음,
채워지는 막대 없음, 한쪽 값이 없으면 점선으로 '비교 전'. 알약 1개 제거.
`<SyncScore score={result.score} />` 호출 한 줄은 UT fixture가 문자열로 찾으므로
그대로 두고, `<SignalStructure>`를 그 뒤에 더했다.

### Relationship Mirror (`MirrorComparisonRow` · `mirror/page.tsx`) — 최우선

1. **핵심 관찰** : `rounded-card bg-brand-tint` → **Insight Surface**
   (굵은 ink rule + 23px 활자 + 배경 없음). 이 페이지에 이런 면은 하나뿐이다.
2. **축 행** : 카드 제거 → 편집 행. 그리고 `MirrorLink` — 판정이 **형태**가 된다.

```
말한 나     ────────○              말한 나    ────────○
                    ╲   GAP                          │   MATCH
관계에서   ───────────●             관계에서  ────────●
```

시작점만 정확하다(직접 답한 1~5). 도착점은 위치가 아니라 **방향**이다 —
Relationship Me는 척도로 수집된 값이 아니므로 좌표처럼 찍으면 거짓이 된다.
UNKNOWN은 점선이고 도중에 끊긴다.
3. 헤더 알약 2개(`차이 N개`/`일치 N개`) → 점 마커 집계 한 줄.
4. 상태 배지는 남기되 알약에서 **각진 evidence 표식**(radius 3px)으로.

### Premium (`EvidenceConnectionTrail` · `PremiumCandidateSection`)

회색 상자 안 세로 목록 → **연결 밴드**. 모서리가 없고 위아래 rule로 열고 닫으며,
여러 갈래가 **한 점으로 모이고** 그 점에서 아래로 내려가 도착지에 닿는다.

```
 ⋎ 러비가 이어본 것
        네가 말한 기준  ──┐
   상대에 대해 적은 내용  ──◉
        예전 관계 경험  ──┘  │
 ─────────────────────────┘
 ↳ 갈등 해결 에서 만났어
```

그리고 후보 장(章) 3개의 `rounded-card border bg-surface`를 걷어내
무료 결과의 `ReportSection`과 **같은 문법**(rule + 큰 번호)으로 만들었다.
→ 유료는 '다른 화면'이 아니라 **같은 보고서가 더 깊어진 것**으로 읽히고,
무료에 없는 형태는 Evidence Connection 밴드 하나로 남는다.

------------------------------------------------------------------------

## 5. Phase C — System Propagation

| 대상 | 변경 |
|---|---|
| `ReportShell` | 섹션 머리를 `큰 번호 + 제목 + 작은 code` 한 덩어리로. tiny uppercase 3단 반복 해소 |
| `ReportHeader` | 보고서 라벨을 Splash와 같은 편집 marker로 |
| `primitives` EvidenceRow/List | 카드 3개 → 좌측 rule + 번호 인용문 (evidence trail) |
| `ResultSectionNav` | 알약 5개 → 밑줄 목차 링크. **히트 영역 44px 유지** |
| `FirstSurprise` | mint 카드 → Observation Surface |
| `SignalCard` primary | 카드 + 내부 mint 상자 → editorial feature block (축 색 rule + 18px 제목 + 15.5px 본문) |
| `History` | 타임라인 카드 → **관찰 기록 archive**(관찰 번호 + 날짜 + 문장 + hairline). 최근 관찰은 Insight Surface |
| `PastObservationNote` | 카드 + 회색 알약 목록 → **관찰 대장**(점선 leader) / Evidence Surface |
| `Home` | Hero 카드 → Insight Surface. 알약 3개 → 점 마커 집계 줄. 최근 관찰 카드 3개 → 대장 행 |
| `Lens` 5화면 + `Premium` 헤더 | 헤더 `Tag` → 공용 `ScreenMarker`. 렌즈마다 새 테마색 만들지 않음 |
| `SelectableRow` · `ChoiceChip` | 선택 **전**은 테두리 없음, 선택된 것만 테두리+배경+굵기+인디케이터. 테두리 두께 유지 → CLS 0 |
| `Button` | `ghost`가 `secondary`와 구분되도록 테두리 제거 + 옅은 면. 4단 위계 확립 |
| `AppShell` desktop | `#F1F1F1` 회색 벽 + `#1A1A1A` 기기 베젤 + shadow → **따뜻한 지면 + 얇은 rule 한 겹 + 브랜드 marker**. generic 목업 템플릿 제거 |

------------------------------------------------------------------------

## 6. After Audit (393×852 · 같은 측정 스크립트)

| 화면 | cards | pills |
|---|---|---|
| Splash | 0 → 0 | 0 → 0 |
| Compatibility | 15 → **12** | 6 → **4** |
| Relationship Mirror | 19 → **9** | 7 → **1** |
| Premium (unlocked) | 21 → **13** | 4 → **3** |
| Home | 12 → **8** | 7 → **4** |
| Lens · MBTI | 10 → 10 | 8 → **1** |
| Lens · 사주 | 11 → 11 | 2 → **1** |
| History (기록 3건) | **1** (하단 CTA 버튼 하나) | 0 |

⚠️ Lens · MBTI의 `pills 8 → 1`은 **알약을 지운 것이 아니라 형태 역할을 바꾼 것**이다.
축별 같음/다름 표식은 그대로 있고, radius가 5px → 3px(evidence)로 내려가 위 측정의
알약 기준(radius ≥ 4px) 밖으로 나갔다. Mirror의 상태 배지와 같은 판단이다 —
판정 표식은 알약이 아니라 각진 근거 표식이다.

⚠️ `borders` 수치는 before/after 비교에 쓰지 않는다 — 이 측정은 **컨테이너 테두리와
편집 rule(`border-t` 1줄)을 구분하지 않기** 때문에, 카드를 rule로 바꾸면 숫자가
오히려 올라간다. 줄어든 것은 '담는 면'이고 늘어난 것은 '나누는 선'이다.

**Viewport QA** — 393 / 375 / 1100·1280 desktop에서 viewport를 넘는 요소 0,
가로 스크롤 0(실측: `getBoundingClientRect().right > vw` 해당 요소 없음).

------------------------------------------------------------------------

## 7. Regression

기능 diff 0 — 계산 · 판정 · 자격 · 가격 · Prompt · Route · Analytics · Persistence
파일을 하나도 건드리지 않았다(변경 파일 전부 화면/컴포넌트/토큰).

| 항목 | 결과 |
|---|---|
| typecheck (`tsc --noEmit`) | PASS |
| eslint (`npx eslint src tests`) | PASS · exit 0 |
| build (`npm run build`) | PASS |
| ai 585 · history 100 · lifecycle 166 · relationship-evidence 288 | ALL PASS |
| trust 205 · premium 285 · lens 206 · nav 55 · value 92 · event 91 | ALL PASS |
| question 53 · ended 58 · semantic 194 · action 102 | ALL PASS |
| ai-guard 15 · model-routing 30 · persistence 323 | ALL PASS |
| ui-assets 8 · meta-copy 10 · ut-stability 31 · ut-followup 52 · ut15 45 · ut-phase1 84 | ALL PASS |
| **실제 Provider 호출** | 0 증가 |

**기존 실패 2건(이번 작업과 무관 · baseline에서 동일 확인)**

- `test:observed` 3건 — `AI_MODE=demo`에서 상시 실패(Provider 경로를 요구하는 E2E)
- `test:ut-premium` ONB-01~04 — `src/data/copy.ts`의 온보딩 슬라이드를 읽는 검사.
  이번 작업은 `copy.ts`를 건드리지 않았고, `git stash`로 baseline tree를 만들어
  **동일하게 4건 실패**하는 것을 확인했다.

⚠️ 작업 중 `git stash` 왕복 때문에 수정 파일들의 줄바꿈이 CRLF로 바뀌어
`POSTREV-14`(소스 문자열 검사)가 일시 실패했다. 원래 상태인 LF로 되돌려 해소했다 —
이 저장소의 index blob은 전부 LF이므로 내용 diff는 없다.

------------------------------------------------------------------------

## 8. 남긴 것 / 하지 않은 것

- **기능 추가 0.** 포트폴리오를 풍성하게 보이게 하려고 화면이나 데이터를 늘리지 않았다
- **radar chart · fake graph · 진행바 없음.** 모든 픽셀이 실제 입력값에서 나온다
- **새 폰트 없음.** 가짜 손글씨 폰트도 추가하지 않았다(§13이 금지한 것)
- **렌즈별 새 테마색 없음.** 세 렌즈는 같은 visual family를 유지한다
- **Lovy 개수를 늘리지 않았다.** 캐릭터는 중요한 순간에만 남고, 대신 `LovyMark`가
  관찰 시스템의 흔적으로 UI 안에 조용히 들어갔다
- `PrototypePanel`은 `NODE_ENV === 'production'`에서 그대로 차단된다(기존 게이트)

------------------------------------------------------------------------

# 후속 — Visual QA Cleanup (2026-09-17, 같은 날 2차)

기준 HEAD : `d3608bf` (위 Visual Polish 최종)
성격 : 위 작업의 **후속 수정.** 새 Visual Polish를 추가하지 않는다.

위 폴리시를 배포 없이 실제 화면에서 직접 확인한 결과, 방향은 유지하되 두 가지가
명확히 실패했다. 카드/알약 감소 · Insight Surface · Field Notes 문법 · 정보 위계 ·
Lovy observation motif는 **전부 유지**한다.

## A. Mirror pseudo-chart → rejected after visual QA

```
결정 : Mirror의 좌표 기반 시각화(MirrorLink 곡선 + 1점 트랙)를 제거한다
이유 : visual precision exceeded data precision
       and required explanatory legend
```

v1.48이 Mirror 축 행에 그린 것:

```
말한 나   ────────○
                  ╲
관계에서  ──────────●        ← 곡선의 기울기로 GAP/MATCH/CHANGE를 표현
```

실제 렌더에서 네 가지가 동시에 깨졌다.

1. **의미를 직관적으로 알 수 없다.** 회색 점과 보라 점이 무엇인지 화면만 보고
   알 수 없었다.
2. **데이터보다 정밀해 보인다.** 이 화면의 데이터는 `Declared Me vs Relationship Me`
   비교이고 정밀 좌표가 아니다. 도착점은 **방향**이었는데 그림은 **좌표**로 읽혔다.
3. **변화 · 이동 · 시계열 · 거리로 오해된다.** GAP을 그리려던 곡선이 시간축처럼 보였다.
4. **사용 설명서가 필요했다.** `○ 말한 나(정확한 위치)` · `⌃ 관계 경험 신호(방향)`
   범례를 붙여야 읽혔다 — 시각화에 사용법이 필요하면 그 시각화는 실패한 것이다.

그리고 1점짜리 트랙은 애초에 차트가 아니었다. 바로 옆의 하트와 `2/5`가 같은 값을
더 정확하게 말하고 있어서, 트랙은 정보를 더하지 않고 해석 부담만 더했다.

### 제거한 것

```
MirrorLink 곡선 SVG
pseudo-coordinate point (말한 나 트랙의 점 위치)
곡선 기울기 기반 GAP/MATCH/CHANGE 표현
STATE_STROKE (곡선 색 테이블)
MirrorLegend — 그래프 사용법 범례 컴포넌트
'말한 나(정확한 위치)' · '관계 경험 신호(방향)'
MirrorComparisonRow의 valueToPercent 의존
```

⚠️ `valueToPercent`는 `lib/logic/mirror.ts`에 남긴다 — `HistoryChangeRow`가 계속 쓴다.
그쪽은 PAST/NOW **둘 다 실제로 1~5로 수집한 값**이라 두 점이 모두 실측이고, 가짜
정밀도가 아니다(이번 QA에서 확인).

### 새 구조 — 차트가 아니라 editorial observation

```
연락                                        GAP
  말한 나                          ♥♥♡♡♡ 2/5
  연락은 별로 중요하지 않음
  ──────── 관계에서 더 크게 ────────────────
    관계에서 나타난 나
    ▲ 이전 관계에서 연락 감소가 가장 힘들었음으로 선택
       이전 관계
중요하지 않다고 생각했지만 관계에서는 생각보다 크게 반응했어.
```

- 정확한 값은 `말한 나` 쪽에만 있다. 1~5로 직접 수집한 값이므로 하트와 숫자로 적는다
- `관계에서 나타난 나`는 숫자가 아니라 문장이다. 그래서 문장으로만 말한다 —
  **이 비대칭이 데이터의 비대칭 그대로다**
- 트랙 위의 점을 `declaredPhrase`(사용자가 고른 보기의 이름)가 대신한다

### 상태 표현 — 좌표가 아니라 간격과 정렬

| 상태 | composition | 문구 |
|---|---|---|
| MATCH | 두 블록이 붙고 왼쪽 끝이 맞는다 (정렬 · 가까움) | 말한 기준과 비슷 |
| GAP | 간격이 벌어지고 관계 쪽이 한 칸 들여쓰인다 (분리감) | 관계에서 더 크게 |
| CHANGE | 간격은 벌어지지만 들여쓰지 않는다. 방향은 아이콘이 말한다 | 경험 후 낮아짐 / 지금은 크게 드러나지 않음 |
| UNKNOWN | 강한 표현을 만들지 않는다 | 비교할 관계 근거 없음 / 관측 정보 부족 |

⚠️ 판정 문구는 **새로 지은 카피가 아니다.** v1.41부터 있던 문구이고 예전에는
스크린리더에만 읽혔다(`stateTextOf`). 곡선이 하던 일을 이 문구가 대신한다.
⚠️ 판정 자체(`displayStateOf`)와 Mirror 계산은 한 줄도 바꾸지 않았다.

## B. Participant UI의 UT 전용 요소 전수 제거

원칙:

```
제품을 사용하기 위해 필요한 UI → 남긴다
제품을 평가하기 위해 임시로 붙인 UI → 사용자 화면에서 제거한다
```

### 발견한 참가자 UI 전체 목록

| 위치 | 요소 | 게이트 | 조치 |
|---|---|---|---|
| `/mirror` | `UtRatingCard` — `UT` 배지 + 1~5 `왜 이런 결과가 나왔는지 근거가 이해됐어?` | UT_MODE | 제거 → `/ut` |
| `/premium` (Paywall) | `UtRatingCard` — 무료 대비 가치 1~5 | UT_MODE | 제거 → `/ut` |
| `/premium` (Paywall) | `PremiumWtpQuestion` — `UT` 배지 + 3지선다 결제 의향 | UT_MODE | 제거 → `/ut` |
| `/history/saved` | `UtSummaryCard` — `UT · 연구용 문항` + 1~5 두 개 | UT_MODE | 제거 → `/ut` |
| Deep Report | `DeepReportValueCheck` — 1~5 가치 + 3지선다 지불 의향 | **게이트 없음** | 제거 → `/ut` |
| Deep Report | `DeepReportUtFlow` — BottomSheet 5문항 설문(완독 CTA가 자동 실행) | UT_MODE | 제거 → `/ut` |

가장 심각한 것은 `DeepReportValueCheck`였다. `UT_MODE` 게이트가 **없어서** 일반
사용자에게도 보였고, 리포트를 다 읽은 직후 화면의 마지막 인상이 '평가해 주세요'였다.

삭제한 파일 3개: `UtSummaryCard.tsx` · `DeepReportValueCheck.tsx` · `DeepReportUtFlow.tsx`
(호출부가 사라져 dead가 된 컴포넌트. 함께 죽은 import · local state · 핸들러도 정리)

### 지표는 끊지 않았다 — 문항을 운영자 화면으로 옮겼다

260914 UT 후속 P1 Final이 S09 유사도 문항에 쓴 방법과 같다: 참가자 화면에서 빼고
`/ut` 콘솔의 `진행자 기록 · 인터뷰 문항`으로 옮긴다. 진행자가 해당 화면을 지난 뒤
구두로 묻고 기록한다. **이벤트 이름을 바꾸지 않았으므로 기존 지표와 그대로 이어진다.**

회수해 `/ut`에 둔 문항 12개 — 진행자가 묻는 순서대로 5개 구간으로 묶었다:

```
S09 사진 관찰 뒤        ut_analysis_similarity_rate                (기존)
Relationship Mirror 뒤  ut_evidence_clarity_rate
Premium Paywall 뒤      ut_premium_value_diff_rate · ut_premium_price_wtp
Deep Report 완독 뒤     ut_new_insight_rate · ut_genericness_rate ·
                        ut_cross_source_value_rate · deep_report_value_rating ·
                        deep_report_wtp_after_view · ut_deep_report_wtp
관찰 기록 저장 뒤        ut_self_understanding_helpfulness · ut_photo_value_rate
```

`ut_photo_value_rate`의 A/B 분리 property(`photo_used` · `photo_count` ·
`usable_evidence_count` · `mode`)는 콘솔이 세션에서 같은 값을 읽어 그대로 보낸다.

**removed UT-only event (회수하지 않음)**

```
ut_deep_report_missing_value   — 자유서술 문항.
                                  자유서술은 Analytics 경로에 관계 민감 정보를 흘릴 수
                                  있어(§24) 화면에 두지 않고 진행자 노트로 남긴다.
```

### 제거하지 않은 것 (제품 기능)

```
Mirror 검증 버튼 (맞는 것 같아 / 조금 달라) + 관찰 문장 수정 시트
사진 관찰 확인 · Evidence reject · 결과 수정(ResultEditSheet)
Deep Report 완독 CTA(`다 봤어`)와 deep_report_complete   ← 제품 지표다
AI 모드/출처 고지(AiModeNotice · AiSourceLabel)          ← 제품 투명성 문구다
resolvePremiumAccess({ utMode })                          ← Premium 자격. 계측이 아니다
```

### 운영자 도구 격리 확인

```
/ut UtOperatorConsole   유지 — production 404. 참가자 화면에 import되지 않는다
AiDebugPanel            유지 — NEXT_PUBLIC_AI_DEBUG && NODE_ENV !== 'production' 이중 게이트.
                        production에서 null을 반환해 DOM에 흔적이 없다
PrototypePanel          유지 — NODE_ENV === 'production'에서 null (기존 게이트)
```

## C. Participant meta-copy 전수 검사 (DOM 기준)

실제 렌더된 DOM의 텍스트 노드를 훑어 금지 토큰을 찾았다(`sr-only` 제외).
검사 토큰: `UT · TEST · DEMO · PREVIEW · DEBUG · MOCK · fixture · FAKE DOOR ·
participant · research · BETA · 개발용 · 테스트용 · 실험용 · 참가자 · 연구용 ·
평가해 · 설문 · 진행자`

| route | meta 토큰 | 1~5 widget | orphan box | orphan title |
|---|---|---|---|---|
| `/compatibility` | 0 | 0 | 0 | 0 |
| `/mirror` | 0 | 0 | 0 | 0 |
| `/premium` (Deep Report unlocked) | 0 | 0 | 0 | 0 |
| `/history` · `/history/saved` | 0 | 0 | 0 | 0 |
| `/home` | 0 | 0 | 0 | 0 |
| `/lens/mbti` · `/lens/saju` · `/lens/astrology` | 0 | 0 | 0 | 0 |
| `/first-contact` · `/profile/result` | 0 | 0 | 0 | 0 |

⚠️ 정상 제품 label은 함께 지우지 않았다 — `ENTERTAINMENT` · `SUPPORTING LENS` ·
`PRECISION REPORT` · `LOVY OBSERVATION REPORT`는 의도된 정보 위계 label이다.
⚠️ `/premium`과 `/profile/result`의 파선 박스 1개씩은 제품 콘텐츠다
(`아직 만들지 않은 연결` · `세 관찰을 합친 결과`) — 설문 제거로 생긴 빈 컨테이너가 아니다.

## D. 함께 고친 것 — `PRECISION REPORT` 중복 marker

위 Visual Polish에서 Premium 헤더의 `Tag`를 공용 `ScreenMarker`로 바꿨는데,
`ReportHeader`의 eyebrow가 **같은 문자열을 같은 형태로** 한 번 더 찍고 있었다.
예전에는 알약 vs eyebrow로 형태가 달라 티가 나지 않았지만, 둘이 같은 marker가 되자
첫 viewport에 같은 표식이 두 번 보였다(실측).

`ReportHeader`의 `eyebrow`가 `null`을 받으면 그리지 않도록 하고, Deep Report는
`null`을 넘긴다. 라벨의 자리 연속성(Paywall → Unlock → Report)은 화면 헤더의
marker가 이미 맡고 있다. 무료 결과 화면의 eyebrow는 그대로다.

## E. Regression

기능 로직 diff 0 — Compatibility score · Mirror state · Premium eligibility ·
가격/unlock · Photo evidence · Optional Deep Input · Lens · History · Target ·
AI pipeline · Navigation · Persistence 파일을 하나도 건드리지 않았다.

| 항목 | 결과 |
|---|---|
| typecheck | PASS |
| eslint (`npx eslint src tests`) | PASS · exit 0 |
| build | PASS |
| **test:visual-qa (신규)** | **16 passed · 0 failed** |
| ai 585 · history 100 · lifecycle 166 · relationship-evidence 288 | ALL PASS |
| trust 205 · premium 285 · lens 206 · nav 55 · value 92 · event 91 | ALL PASS |
| question 53 · ended 58 · semantic 194 · action 102 | ALL PASS |
| ai-guard 15 · model-routing 30 · persistence 323 | ALL PASS |
| ui-assets 8 · meta-copy 10 · ut-stability 31 · ut-followup 52 · ut15 45 · ut-phase1 84 | ALL PASS |
| 실제 Provider 호출 | 0 증가 |

**고친 기존 assertion 2건** — 둘 다 구조가 바뀌어 리터럴이 안 맞은 것이고, 검사
**의도는 그대로 유지**했다(약화하지 않았다).

```
P1F-04  콘솔 인터뷰 문항이 데이터 배열 + map으로 바뀌어 `<UtRatingCard>`와 이벤트
        이름이 인접하지 않는다 → 카드 렌더 · 인터뷰 섹션 존재 · 같은 이벤트 사용으로 검사
P2-07   Mirror 행이 ScaleHearts에 className을 넘겨 self-closing 리터럴이 아니다
        → `<ScaleHearts value={insight.declared}` 접두 매칭으로 완화
```

**기존 known baseline failure 2건 (이번 작업과 무관)**

```
test:observed    3건 — AI_MODE=demo에서 상시 실패(Provider 경로를 요구하는 E2E)
test:ut-premium  ONB-01~04 — src/data/copy.ts의 온보딩 슬라이드를 읽는 검사.
                 이번에도 copy.ts를 건드리지 않았고, d3608bf 시점에도 동일하게 실패한다
```

## F. 새 presentation invariant — `tests/run-visual-qa-fixtures.mjs`

```
VISUAL-QA-01  Mirror 행에 svg · path · viewBox · valueToPercent · `left: …%` 0
              MirrorLegend · '정확한 위치' · '신호(방향)' 0
VISUAL-QA-02  참가자 route에 1~5 척도 widget 0 · 평가 컴포넌트 참조 0 ·
              삭제한 설문 컴포넌트 파일 부활 0
VISUAL-QA-03  참가자 route에 `UT` 연구 배지 0 (JSX 텍스트 노드 기준)
VISUAL-QA-04  Mirror가 declaredPhrase + relationshipSignal + 하트 + note를 계속 그린다
VISUAL-QA-05  판정이 displayStateOf · 배지 · 문구 · 방향 아이콘으로 남아 있고,
              퍼센트 · 막대 · 거리로 말하지 않는다
VISUAL-QA-06  회수한 문항 12개가 /ut에 같은 이벤트 이름으로 있다 ·
              평가 카드의 utMode 가드 유지 · /ut production 404 유지
```

참가자 route 판정은 파일 경로로 한다 — `src/app/ut` · `src/components/ut` ·
`src/app/dev` · `src/app/api` · `AiDebugPanel` · `PrototypePanel`만 제외하고
나머지 `src/**/*.tsx` 전부를 참가자 화면으로 본다. 그래서 **새 화면을 추가해도
검사에서 빠지지 않는다.**
