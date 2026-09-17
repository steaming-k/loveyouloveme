# 럽유럽미(Love U Love Me) 디자인 가이드

> 이 문서는 원본 프로토타입 제작 지시문에서 화면별 와이어프레임 스펙(스크린 01~29 및 공유/퓨처
> 컨셉 화면), 타깃 페르소나·포지셔닝 같은 제품 리서치 맥락, Prototype Flow, Output 구성,
> Final Self Review 체크리스트를 제외하고, 반복적으로 재사용할 '어떻게 그릴지'에 해당하는
> 규칙만 추출해 재구성한 것이다. 화면 단위 작업 지시가 아니라 디자인 시스템 확장이나
> 신규 화면 추가 시 계속 참조할 기준 문서로 쓴다.

------------------------------------------------------------------------

## 1. 브랜드 세계관 : 러비(Lovy)

세계관 한 줄 : '인간의 감정을 습득하기 위해 지구에 내려온 외계인이 제3자의 시선으로 인간의
관계를 관찰하고 분석한다.'

러비의 역할 : 연애 전문가 X, 상담가 X, 점쟁이 X, 제3자 관찰자 O

러비의 사고방식 루프 : 관찰 → 이상한 점 발견 → 질문 → 근거 제시 → 사용자 확인 → 학습

성격 :

- 인간 감정을 완벽하게 이해하지 못한다
- 인간 행동에 호기심이 많다
- 조금 시니컬하고 엉뚱하다
- 관찰력이 좋다
- 사용자의 말과 경험 사이 모순을 잘 발견한다
- 무조건적으로 위로하지 않는다
- 사용자를 심판하지 않는다
- 자신이 틀릴 수 있다는 사실을 인정한다

대표 UX Writing :

- '잠깐. 아까 말한 너랑 지금 말한 너가 조금 다른데?'
- '이 신호... 처음 보는 게 아닌데.'
- '난 네가 알려준 이야기만 볼 수 있어. 네 마음을 읽을 수 있는 건 아니야.'
- '안 맞는다고 결론 내리긴 일러. 대신 충돌 신호가 몇 개 보여.'
- '내가 너를 잘못 이해했나 봐. 틀린 부분을 알려줘.'

------------------------------------------------------------------------

## 2. 캐릭터 사용 규칙

적극 사용하는 위치 : Splash, Onboarding, AI 분석 Loading, 중요한 Insight 발견,
Relationship Mirror 전환, Empty State, Error State, AI가 불확실성을 설명할 때

제한적으로 사용하는 위치 : 일반적인 입력·설정 화면에서는 작은 Avatar, 작은 말풍선,
Icon-like Character 정도로 축소한다.

핵심 원칙 : '귀여운 외계인 앱'이 아니라 'Relationship Intelligence 서비스에 기억나는
캐릭터 IP가 붙어 있는 구조'로 보여야 한다. 캐릭터가 서비스를 지배해서는 안 된다.

------------------------------------------------------------------------

## 3. 비주얼 디렉션

전체 무드 : Cute Alien × Editorial Relationship Intelligence × Modern Consumer AI

키워드 : clean, sophisticated, playful but mature, warm, insightful, editorial,
slightly quirky, premium consumer app

기준 : 20대 후반~30대 초반 사용자가 부담 없이 쓸 수 있는 톤을 유지한다.

피해야 할 것 :

- Tinder clone / Dating App swipe card
- Pink · Red 중심 데이팅 UI, 하트 장식 남발
- 유아용 캐릭터 앱, 게임 UI
- MBTI 테스트 사이트, 사주 서비스, ChatGPT clone
- SaaS Dashboard, Glassmorphism, Neon, Strong gradient
- 지나친 우주·SF 장식, 별·행성 decorative element 남발
- 모든 내용을 카드로 감싸는 UI

------------------------------------------------------------------------

## 4. 컬러 시스템

**Brand Primary : #8F74F0**
역할 : Primary CTA, Selected State, Active State, Main Interaction, Compatibility,
Core Insight, Relationship Mirror, 중요한 Highlight
의미 : '분석 / Relationship Intelligence / Insight'

**Secondary Brand : Mint 계열 (#A9E3D0, #BFE9DB, #D7F4EA)**
역할 : Lovy, AI Observation, Supporting Insight, Positive Signal, Friendly Feedback,
Future Relationship History
의미 : '러비 / 관찰 / 친근함 / 관계 경험'

**Neutral**

| 용도 | 색상 |
|---|---|
| Background | #FAFAF7 또는 #FCFBF8 |
| Card | #FFFFFF |
| Main Text | #222222 |
| Secondary Text | #777777 |
| Border | #E7E5E2 |

**Friction Signal** (필요한 경우에만) : Muted Coral 또는 Muted Orange, 예 #F3A79B, #E9A47A

**사용 비율** : Neutral 70~75% / Primary Purple 15~20% / Mint 10~15%

중요 규칙 : Purple → Mint 강한 Gradient를 금지한다. Purple과 Mint를 장식적으로 섞지 말고
각각의 역할을 명확히 구분해서 쓴다.

------------------------------------------------------------------------

## 5. 디자인 우선순위 (정보 위계)

시각적 중요도 순서 :

1. Relationship Mirror
2. Compatibility Reason / Evidence
3. AI Profile Building
4. Compatibility Score
5. Lovy Character

원칙 : 궁합점수 '78'이 서비스에서 가장 강한 화면이 되어서는 안 된다. 가장 강한 UX
Moment는 점수가 아니라 '나는 연락이 중요하지 않다고 생각했는데, 실제 관계에서는
연결감에 민감한 사람이었구나' 같은 자기 발견 순간이어야 한다.

------------------------------------------------------------------------

## 6. 모바일 프레임 기준

Mobile First, 기준 Frame : iPhone 15 Pro 수준, 393 × 852

실제 모바일 서비스 density를 사용한다. 너무 많은 whitespace로 Concept Design처럼
보이지 않게 하고, 한국 Consumer App 수준의 현실적인 information density를 유지한다.

------------------------------------------------------------------------

## 7. 내비게이션 원칙

MVP에서는 Navigation을 최소화한다. 추천 Bottom Navigation : 홈 / 나 / 분석
(또는 제품 흐름 검토 후 더 자연스러운 3-tab 구조 제안 가능)

매칭, 커뮤니티, Relationship History 등 Future Feature는 현재 Main Navigation에
핵심 Tab으로 넣지 않는다.

------------------------------------------------------------------------

## 8. 디자인 시스템 (Reusable Component Set)

필수 컴포넌트 :

Primary Button, Secondary Button, Text Button, Choice Chip, Selectable Row,
Photo Input, Progress Indicator, Lovy Message, Observed Insight, Editable AI Result,
Confidence Label, Evidence Row, Compatibility Gauge, Compatibility Signal,
Good Signal, Friction Signal, Conversation Card, Relationship Mirror Comparison,
Bottom Navigation, Toast, Modal, Loading, Empty State, Error State

각 컴포넌트는 Default / Pressed / Selected / Disabled / Loading / Error 상태를
모두 고려해서 설계한다.

------------------------------------------------------------------------

## 9. 마이크로 인터랙션 원칙

Subtle Motion 중심으로 설계한다.

- AI Analysis : 러비 안테나 살짝 움직임
- Signal 발견 : 작은 ! 또는 pulse
- Compatibility Complete : 두 signal이 잠깐 align
- Evidence : 데이터와 Insight 사이 line 연결
- Relationship Mirror : Declared Me와 Relationship Me가 겹쳐지며 Gap이 시각적으로 표시

기본 Motion : 300~600ms. 과도한 Animation은 금지한다.

------------------------------------------------------------------------

## 10. UX 원칙

1. 궁합점수는 입구이지 결론이 아니다.
2. AI의 결론보다 왜 그렇게 판단했는지가 중요하다.
3. 사용자는 AI 분석 대상이 아니라 AI와 함께 Relationship Profile을 만드는 주체다.
4. 상대 분석에서 시작하지만 자기 발견으로 끝나야 한다.
5. 러비의 귀여움보다 Product Trust가 우선이다.
6. 한 번에 모든 데이터를 요구하지 않는다. Progressive Profiling을 사용한다.
7. 궁합은 운명 또는 성공확률이 아니다.
8. 사용자가 말한 자신과 실제 관계 경험이 충돌하는 순간을 가장 중요한 UX Moment로 다룬다.
9. 결과는 단정하지 않고 Evidence + Interpretation 형태로 제공한다.
10. 모든 Insight는 사용자가 수정하거나 거절할 수 있어야 한다.

------------------------------------------------------------------------

## 11. 프라이버시 UX 원칙

이 서비스는 개인 사진, 연애 경험, 상대 정보, 관계 성향을 다루므로 다음 컨트롤을
자연스럽게 포함한다 : [수정] [삭제] [분석 제외]

컨텍스추얼 카피 예시 :

- '선택한 사진만 분석해요.'
- '상대의 실제 마음을 판정하지 않아요.'
- 'AI 분석은 지금 입력된 정보를 기준으로 한 해석이에요.'

원칙 : Privacy Policy 페이지를 메인 Flow에 과하게 노출시키지 말고, 민감정보를
입력하는 순간에 필요한 만큼만 설명을 보여준다.

------------------------------------------------------------------------

## 12. 제작 완성도 기준

이 서비스의 화면 산출물은 Low-fidelity Box Wireframe이 아니다. 구조를 검증할 수
있으면서 실제 서비스 컨셉까지 보이는 High-Fidelity Product Wireframe을 기준으로 한다.

포함해야 하는 것 : 실제 카피, 실제 Component, 실제 Color System, 실제 Interaction
State, 실제 정보 구조, Lovy Character 반영

주의 : Illustration, Decorative Graphic, Character Animation 때문에 UX 구조가
가려지면 안 된다.


------------------------------------------------------------------------

## 13. LOVY FIELD NOTES (v1.48 Art Direction)

§3의 전체 무드(Cute Alien × Editorial Relationship Intelligence × Modern Consumer AI)는
그대로 유지한다. 이 절은 그 무드를 **화면에서 실제로 만드는 방법**을 정한다.

내부 이름 : `LOVY FIELD NOTES`
정의 : Editorial Field Notes × Alien Observation Lab

**가장 중요한 원칙**

> 브랜드 차별화는 장식이 아니라 **관찰 흔적의 시각화**에서 만든다.

러비를 더 많이 그리는 것이 차별화가 아니다. 러비가 무엇을 보고, 무엇을 근거로 삼고,
무엇과 무엇을 이었는지가 **화면의 형태로 남아 있는 것**이 차별화다.

주의 : `Alien Observation Lab`은 SF 장식을 뜻하지 않는다. 우주 배경 · 별 · 행성 ·
네온 · HUD · SF dashboard를 추가하지 않는다. 핵심은 '관찰의 흔적'이다.

### 13.1 Visual Grammar — 다섯 단계

모든 결과 화면은 이 문법을 따른다. 각 단계는 **서로 다른 형태**를 갖는다.

| 단계 | 무엇인가 | 형태 |
|---|---|---|
| Observation | 러비가 알아챈 것 | 옅은 mint 메모 · 관찰 마크 · radius 14 |
| Evidence | 사용자가 실제로 준 근거 | 좌측 rule · 출처 마커 · 배경 없음 · radius 3 |
| Connection | 따로 있던 것들이 모이는 지점 | 합류선 + 합류점 하나 · 모서리 없는 밴드 |
| Insight | 가장 중요한 발견 | 굵은 ink rule + 넓은 활자 블록 · 배경 없음 · radius 0 |
| Next Observation | 다음에 확인할 것 | 인라인 질문 · 저장 가능한 한 줄 |

이 다섯 단계가 **전부 같은 rounded card**로 그려지면 정보는 정확해도 위계가 사라진다.
그것이 v1.47까지의 결과 화면이 'AI로 빠르게 만든 화면'으로 읽힌 이유다.

### 13.2 Surface System — 화면은 네 종류의 면으로만 이루어진다

카드는 **기본값이 아니다.** 기능적 containment가 필요한 곳에서만 쓴다.

1. **Canvas** — 기본 지면. 제목 · 질문 · 본문은 배경 위에 직접 놓는다
2. **Observation Surface**(`.surf-observation`) — 러비의 짧은 관찰. 작은 마크 + 옅은 mint
3. **Evidence Surface**(`.surf-evidence`) — 사용자가 준 근거. 좌측 rule + 출처 마커.
   ⚠️ 배경을 깔지 않는다 — 깔면 그 순간 카드가 되고, 근거와 해석이 같은 무게가 된다
4. **Insight Surface**(`.surf-insight`) — 가장 중요한 발견. **다른 카드와 같은 크기로
   만들지 않는다.** 굵은 상단 rule + 넓은 typographic block. 화면에 하나뿐이어야 한다

### 13.3 Radius — 값이 아니라 역할로 고른다

| 역할 | 토큰 | 값 | 형태의 뜻 |
|---|---|---|---|
| interactive control | `--radius-control` | 15px | 누를 수 있는 것은 둥글다 |
| observation note | `--radius-note` | 14px | 러비의 메모는 말랑하다 |
| contained evidence | `--radius-evidence` | 3px | 담긴 근거는 종이 조각이다 |
| editorial content | `--radius-editorial` | 0px | 편집면은 모서리를 갖지 않는다 |

같은 화면에서 이 넷이 섞여 있으면 '무엇을 누를 수 있고 무엇이 근거인지'가 색이 아니라
**형태로** 먼저 읽힌다. 기존 `tag/chip/row/btn/card/hero`는 호출부가 쓰고 있으므로 지우지
않되, 새 표면은 위 네 개만 쓴다.

### 13.4 Visual Vocabulary

사용한다 : 관찰 점 · 연결선 · 얇은 rule · 관찰 번호 · 출처 마커 · evidence trail ·
합류점 · 강조 underline(`.mark-brand` / `.mark-mint`) · 점선 leader · 작은 Lovy mark

쓰지 않는다 : glassmorphism · strong gradient · generic dashboard graph · 3D blob ·
floating gradient orb · 과도한 shadow · generic AI sparkle icon · 모든 곳의 rounded card ·
radar chart · fake graph

### 13.5 Typography — 새 폰트를 추가하지 않는다

Pretendard의 body readability를 유지하고, 위계는 **scale 대비**로 만든다. 모든 제목을
19~24px semibold로 반복하지 않는다.

| 역할 | 크기 |
|---|---|
| 수치(동기화율) | `--text-figure` 64px |
| Insight | 21~23px |
| 섹션 제목 | 19px |
| feature 본문 | 15.5~16px |
| 본문 | 13~15px |
| 근거 | 12.5px |
| technical meta | 9.5~10px · tracking 0.18~0.2em |

Technical meta(`SUMMARY` 같은 tiny uppercase)는 **실제로 필요한 곳에만** 둔다. 모든
섹션이 `tiny uppercase → title → caption` 3단으로 반복되면 그건 보고서가 아니라 양식이다.
보고서 섹션은 번호를 큰 활자로 왼쪽에 세우고 technical code를 그 아래 작게 붙인다.

### 13.6 정직성 — 그림이 근거보다 커지지 않는다

Field Notes의 시각 어휘는 모두 **이미 계산된 값**에서만 나온다. 아래는 규칙이 아니라
금지사항이다.

- 두 사람의 신호는 **떨어져 있는 두 점**으로 그린다. 채워지는 막대(성공확률)로 그리지 않고,
  4축 다각형(radar)으로 그리지 않는다 — 없는 정밀도를 만든다
- 한쪽 값이 없으면 선을 그리지 않는다. 모르는 것을 가운데 점으로 찍으면 측정이 아니라 추측이다
- 연결(Connection)은 이을 것이 **둘 이상**일 때만 그린다. 합류점은 하나다
- 색 tag 하나로 상태를 끝내지 않는다. 판정은 composition에도 반영한다 —
  단 composition은 **간격 · 정렬 · rule**이고, 좌표가 아니다(§13.6.1)

#### 13.6.1 Relationship Mirror는 차트가 아니다

> Relationship Mirror는 데이터 시각화 차트가 아니다.
> **데이터가 제공하지 않는 좌표 · 거리 · 정밀도를 시각적으로 생성하지 않는다.**
> 비교는 typography · alignment · spacing · rule을 우선 사용한다.

이 규칙은 실패에서 나왔다. v1.48은 Mirror에 `말한 나`의 값을 트랙 위 점 하나로 찍고,
그 점에서 곡선을 뻗어 기울기로 GAP/MATCH/CHANGE를 표현했다. 실제 화면에서 결과는:

```
① 점과 곡선의 의미를 화면만 보고 알 수 없었다
② 도착점은 '방향'이었는데 그림은 '좌표'로 읽혔다 — 시각적 정밀도 > 데이터 정밀도
③ GAP을 그리려던 곡선이 변화 · 이동 · 시계열 · 거리처럼 보였다
④ 읽는 방법을 알려주는 범례가 필요했다
```

④가 판정 기준이다. **시각화에 사용 설명이 필요하면 그 시각화는 실패한 것이다.**

Mirror가 보여줘야 하는 것은 `내가 생각한 나 ↕ 관계에서 나타난 나`의 대조 하나다.
그 대조는 이렇게 만든다:

| 요소 | 무엇으로 말하는가 |
|---|---|
| 내가 말한 값 | 1~5로 직접 수집했으므로 하트 + 숫자 + 그 보기의 이름(`declaredPhrase`) |
| 관계에서 나타난 나 | 숫자가 아니라 문장이므로 **문장으로만**. 방향은 아이콘 하나 |
| 판정(MATCH/GAP/CHANGE/UNKNOWN) | 배지 + 판정 문구 + 두 블록 사이의 간격·정렬 |

정확한 값은 한쪽에만 있다. **그 비대칭을 화면에서 지우지 않는다** — 양쪽을 같은
모양으로 그리면 없는 쪽에 없는 정밀도가 생긴다.

#### 13.6.2 평가 UI는 제품 UI가 아니다

```
제품을 사용하기 위해 필요한 UI  → 남긴다
제품을 평가하기 위해 붙인 UI    → 사용자 화면에 두지 않는다
```

UT 1~5 척도 · `UT` 배지 · 연구용 설문 · 참가자 안내는 participant-facing 화면에
두지 않는다. 필요하면 운영자 화면(`/ut`)에 두고 진행자가 구두로 묻는다 — 이벤트
이름을 그대로 쓰면 지표는 끊기지 않는다.

⚠️ 사용자가 결과를 고치거나 거절하는 기능(관찰 수정 · Evidence reject · 결과 수정)은
평가 UI가 아니라 **제품 기능**이다. 함께 지우지 않는다.

### 13.7 Desktop

제품은 mobile-first를 유지한다. 데스크톱 전용 앱을 만들지 않는다.

데스크톱에서 모바일 프레임이 보일 때 **'회색 배경 한가운데 아이폰'을 만들지 않는다** —
기기 베젤 · drop shadow · 목업 템플릿 없이, 따뜻한 지면 위에 얇은 rule 한 겹으로 두고
왼쪽 위에 브랜드 marker를 남긴다. 개발용 패널(`PrototypePanel`)은 production에 노출하지 않는다.

### 13.8 Motion

§9의 원칙을 유지하고, 새 duration/easing을 만들지 않는다(`globals.css` Motion System).
추가하는 motion은 **의미가 있는 것만**이다 : connection line draw · mirror overlap reveal ·
observation marker appear.

------------------------------------------------------------------------

## 요약 원칙

궁합은 Hook, Relationship Mirror는 Product, Relationship History는 Future
Retention이다. 이 구조를 모든 화면과 인터랙션에 일관되게 반영한다.