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

## 요약 원칙

궁합은 Hook, Relationship Mirror는 Product, Relationship History는 Future
Retention이다. 이 구조를 모든 화면과 인터랙션에 일관되게 반영한다.