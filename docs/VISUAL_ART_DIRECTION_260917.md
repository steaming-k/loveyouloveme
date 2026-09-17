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
