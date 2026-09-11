# QA 보고서 — 럽유럽미 v1.46 Candidate

> **상태: READY FOR USER REVIEW**
> commit · push · deploy · Frozen Snapshot **하지 않았다.**

| 항목 | 내용 |
|---|---|
| 사이클 | v1.46 Candidate (관계 사건 · 러비 Motion · Onboarding · Motion System) |
| 기준 커밋 | `8446f01` (v1.45 Production) |
| 작성 | 2026-09-11 |
| 실행 환경 | Next.js dev(`localhost:3000`) · Browser pane 375~1280px · Real Provider E2E |
| 상태 표기 | **VERIFIED**(실측) · **FIXTURE**(자동 검사) · **NOT VALIDATED**(사용자 가치 미검증) |

---

## 1. Git state

시작 시점 — 인수인계 §1의 기대와 **정확히 일치**했다.

```
branch          main
HEAD            8446f0171fa10f4d6ee24f280e5ee363ba55b090
origin/main     8446f0171fa10f4d6ee24f280e5ee363ba55b090
ahead / behind  0 / 0
working tree    clean
```

현재 — **커밋 0건.** 워킹트리에 수정 31개 · 신규 6개(§19).
`docs/versions/기능명세_현행_v1.45.md` 동결본은 blob 대조로 **무결 확인**했다.

```bash
git show d4d8a5f:docs/versions/기능명세_현행_v1.45.md | diff - docs/versions/기능명세_현행_v1.45.md
# 출력 없음 = 무결
```

---

## 2. Target Event 설계

**정의** — 사용자가 상대와의 관계에서 **직접 기억해서 입력한 장면.** 상대의 의도·감정·
호감 확률이 아니다.

```ts
type RelationshipEventType =
  | 'affection_felt' | 'conflict' | 'contact_change' | 'closer'
  | 'distance' | 'care_received' | 'meeting' | 'other';

interface RelationshipEvent {
  id: string;
  type: RelationshipEventType;
  description: string;   // 80자 · 자유 입력
  myReaction?: string;   // 60자 · 선택
}

interface TargetProfile { /* … */ events: RelationshipEvent[] }
```

| 결정 | 값 | 왜 |
|---|---|---|
| 저장 위치 | `TargetProfile.events` | New Target 초기화가 `createEmptyTargetProfile()` 하나로 끝난다 — 별도 초기화 코드를 만들면 언젠가 빠뜨린다 |
| 최대 개수 | 3 | 입력 피로 · 가장 기억나는 장면 집중 · CRM화 방지 |
| 날짜·장소·이름 | **받지 않는다** | 그 셋이 들어오면 History가 관계 일지가 된다(§8·§9) |
| 종류 라벨 | `호감이 느껴졌던 순간` 형 | 주어가 항상 사용자다. `상대가 나를 좋아한다` 같은 **결론 선택지를 만들지 않는다**(§7) |
| History 저장 | **안 한다** | `RelationshipHistoryEntry`에 필드 자체가 없다(FIXTURE EVT-14) |

---

## 3. Event Evidence Contract

```
FACT            사용자가 '답장 간격이 길어졌다'고 입력함
INTERPRETATION  사용자는 그 변화를 관계의 중요한 신호로 기억하고 있음
NOT FACT        상대가 마음이 식었다 / 밀당했다 / 호감을 숨겼다
```

새 source `user_reported_event`를 **명시적으로** 만들었다(§10).

| 계층 | 상태 |
|---|---|
| `EvidenceRef` 타입 | `{ source: 'user_reported_event'; eventId: string }` |
| AI 파서 `EVIDENCE_SOURCES` | 있음 — 타입과 항상 같이 움직인다(구조 테스트 TC5가 강제) |
| Resolver 라벨 | `내가 알려준 장면` — `상대에 대해 입력한 내용`(4축 선택지)과 **다른 라벨**이다. 같은 이름이면 근거 목록의 `자료 N종`이 거짓이 된다 |
| **ref 생성자** | **없다.** 사건은 아직 어떤 Insight의 근거도 아니다 |
| 어떤 Task의 허용집합 | **없다.** 모델이 지어내도 `refsWithinAllowed`가 항목째 버린다 |

> **EVIDENCE_SOURCES에 source를 추가하는 것은 AI에게 새 근거를 주는 것이 아니다.**
> 파서 통과와 근거 허용은 다른 층이다 — fixture `relationship_r8_user_event_ref_rejected`가
> 이 계약을 고정한다.

---

## 4. Event UI

S19 상대 정보 입력 안의 **접히는 optional section**(`RelationshipEventSection`).
MBTI·'좋아하는 것'과 같은 Progressive Disclosure 패턴을 재사용했다 — 새 Survey 화면을
만들지 않았다.

```
기억나는 장면이 있었어?                      ← 제목
갈등이나 호감 신호처럼 관계를 이해하는 데      ← 보조
중요한 일이 있었다면 알려줘.
  ↓ 펼치기
어떤 장면이었어?  → 종류 칩 8개
무슨 일이 있었어? → 짧은 자유 입력
+ 그때 내 반응도 적을래 (선택)
[이 장면 추가하기]
  ↓ 1개 이상
목록(종류 라벨 · 원문 · 그때 나는) + [고치기] [×]
러비 체크포인트: "기억해뒀어. 이건 네가 알려준 장면으로만 쓸게 — 상대 마음을 내가 정하진 않아."
```

- **고치기는 id를 유지한다.** '지우고 다시 적기'로 만들면 `eventId`가 새로 발급되어
  리포트의 근거가 조용히 다른 것을 가리키게 된다.
- 배치는 4축 카드 **아래**다. 위로 올리면 `known/4`가 이 화면의 진행 기준이라는 사실이
  흐려지고, 사건이 점수에 들어가는 것처럼 읽힌다.
- **`점수를 정확하게 하려면 적어달라`고 말하지 않는다.** 화면 하단 고지:
  *"적어준 장면은 동기화율 점수에는 들어가지 않고, 리포트에서 네가 무엇을 기억하는지
  보는 데만 써."*

---

## 5. Event → Premium 영향

`RelationshipDeepReport.reportedScenes` — Chapter **앞**에 놓이는 **관계 맥락 블록**이다.

```
네가 알려준 장면
  연락의 변화
  '답장 간격이 이틀 정도 길어졌어'                ← FACT (원문 그대로 인용)
  너는 연락의 변화를 관계의 중요한 신호로 기억하고 있어.   ← INTERPRETATION
  …
  🛸 이 관계에서 기억나는 장면 2개를 받았어. …        ← 러비 체크포인트
  이건 네가 기억하는 장면이야. 상대가 무슨 마음이었는지는 여기서 알 수 없어.  ← 경계(항상)
관계 연결 리포트  전체 5개                          ← Chapter는 그대로
```

| 항목 | 영향 |
|---|---|
| `available` | 없음 — 사건만 있고 근거가 없으면 리포트는 여전히 안 열린다 |
| `chapters` / `omissions` | 없음 — Chapter 수에 세지 않는다(`approachInsight`와 같은 위계) |
| `allowsOutwardAction` | **가리지 않는다.** 사용자가 스스로 알려준 기억은 `ended`에서도 자기 것이다. 시제만 `tense`를 따른다 |
| AI 요청 | 없음 — `itemsSent` · `providerCalls` 불변 |

**§12 우선순위 대응**

| 우선순위 | 대응 |
|---|---|
| ① Premium Deep Report의 관계 맥락 | 위 블록 (결정론) |
| ② Target/relationship interpretation | 장면마다 `INTERPRETATION` 한 줄 (주어=사용자) |
| ③ 러비 체크포인트 | 입력 화면 1곳 + 리포트 블록 1곳 |

---

## 6. Score / Mirror 영향 여부 — **없음**

| 대상 | 검증 |
|---|---|
| 동기화율(score · comparedCount · confidence · 축별 alignment) | FIXTURE **EVT-06** — 사건 3개 세션과 0개 세션의 값이 JSON 수준에서 동일 |
| Mirror MATCH/GAP/CHANGE | FIXTURE **EVT-07** — 축별 판정 동일 |
| Chapter 구성(kind · 순서 · 근거 수) | FIXTURE **EVT-08** — 동일 |
| AI 요청 항목 수 | FIXTURE **EVT-09** — 동일 |
| **구조 보증** | FIXTURE **EVT-13** — `logic/compatibility·mirror·history·crossSourceInsights`가 `relationshipEvents`를 import하지 않고 `target.events`를 읽지 않는다 (정적 스캔) |

> 값 비교만으로는 "이번 fixture에서 우연히 같았다"밖에 못 말한다. EVT-13이 **경로 자체가
> 없다**를 검사하므로, 나중에 누가 판정층에서 사건을 읽으면 그 순간 빨개진다.

**GAP/MATCH/CHANGE 판정 로직은 한 줄도 바꾸지 않았다.**

---

## 7. Home Lovy Motion

```
기본 관찰(hero) → 발견(notice) → 돋보기(observe) → 기록(record) → 반복
```

- **새 이미지 0장.** 네 장 전부 이미 runtime에 있던 에셋이다.
- 전환: `opacity` crossfade + `scale 0.98→1` + `translateY 3px→0` (400ms · ease-observe)
- 상태 주기 **3.2초**

| 검증 | 결과 |
|---|---|
| 시퀀스 진행 | **VERIFIED** — 인라인 opacity 샘플링에서 `hero→notice→observe→record→hero` 순환 확인 |
| CLS | **VERIFIED** — 박스 208×228 **불변**(프레임 4장 렌더 크기의 최대값으로 고정) |
| hidden tab pause | **VERIFIED** — `visibilityState='hidden'` 후 7초간 프레임 불변 |
| reduced-motion | **VERIFIED** — 타이머 미시작 · 정적 `hero` 1장 · 작대기 미렌더 |
| 발견 blink | **VERIFIED** — 발견 프레임에서만 mount, 2회 재생 후 정지(`infinite` 아님) |

⚠️ Browser pane이 `prefers-reduced-motion: reduce`를 강제하고 있어서, **애니메이션 경로는
`matchMedia`를 패치하고 실제 remount를 일으켜 따로 검증**했다. 두 경로 모두 실측했다.

---

## 8. Onboarding Before / After

| | v1.45 (3장) | v1.46 (4장) |
|---|---|---|
| ① | 이 사람이랑 나, 잘 맞을까? | **이 사람이 궁금해서 왔어도 괜찮아.** |
| ② | 근데 잠깐. 너는 연애할 때 어떤 사람이야? | **러비는 네 답이랑 실제로 있었던 일을 같이 봐.** |
| ③ | 상대를 보다 보면 의외로 네가 더 잘 보일지도 몰라. | 상대를 보다 보면 의외로 네가 더 잘 보여. |
| ④ | — | **기록이 쌓이면 내 기준이 어떻게 움직였는지도 보여.** |
| 캐릭터 | 3장에 `crystal` 하나뿐 | **네 장 전부** |

**왜 3장 → 4장인가.** §21은 "3장으로 압축 가능하면 3장 우선"이라고 했고 기존이 이미
3장이었으므로, 늘리려면 이유가 있어야 한다. 실제로 하나 있었다:

- 기존 ②와 ③이 **둘 다 Mirror**를 말하고 있었다(같은 것을 두 번).
- Relationship History(Retention)는 온보딩에 **한 글자도 없었다** — 제품 흐름 다섯 칸 중
  네 번째가 통째로 빠져 있었다.

겹친 둘을 쪼개고 빠진 하나를 채운 결과가 4장이다. 늘린 게 아니다.

**그 밖의 판단**

- ①의 제목을 `잘 맞을까?`에서 바꿨다. 질문 형태였지만 아래 비교 그림과 붙으면
  **답을 준다는 약속**으로 읽혔다(§21 — 관계 성공 확률 서비스처럼 보이면 안 됨).
- ②의 근거 라벨은 리포트 근거 칩과 **같은 이름**을 쓴다(`내가 답한 내용` · `관계 경험` ·
  `내가 알려준 장면`) — 온보딩에서 배운 이름을 리포트에서 다시 배우지 않게.
- ④는 `달라진 지점만 짚어줄게. 좋아졌다·나빠졌다고는 말하지 않아.`로 끝난다 —
  History Task의 안전 규칙을 온보딩이 미리 어기지 않게.

---

## 9. Onboarding Character Mapping

| 장 | 포즈 | 왜 |
|---|---|---|
| ① Hook | `observe` | 돋보기 — 관찰이 시작되는 장면 |
| ② Evidence | `connect` | 흩어진 자료를 모으는 모습 — 이 장이 설명하는 행동 그 자체 |
| ③ Mirror | `ponder` | 아직 결론을 내리지 않고 생각하는 모습 |
| ④ History | `book` | 기록 노트를 펼쳐 든 모습 |

- **새 이미지 0장 · `docs/캐릭터`에서 추가 복사 0건.** 네 포즈 전부 이미 `public/lovy/`에
  있었다.
- **`crystal`(관측 구슬)을 걷어냈다.** 구슬 속 커플 그림은 관찰자가 아니라 **점쟁이의
  도구**로 읽힌다 — `design-guide.md §2`가 그은 선이고, 온보딩 마지막 장은 그 인상이 가장
  오래 남는 자리다. 같은 이유로 새 온보딩에는 `crystal`·`wand`가 없다.
- 캐릭터는 96px `flex-none` — 제목이 쓸 폭을 먼저 가져가지 않는다.

---

## 10. Motion System

```
duration  instant 90 · fast 150 · enter 220 · normal 300 · slow 400
easing    observe(감속 · 등장) · standard(in-out · 상태 변화) · exit(가속 · 사라짐)
```

CSS(`globals.css @theme`)와 JS(`lib/motion.ts MOTION`/`EASE`)가 **같은 값**을 갖는다.

⚠️ **`fast`/`normal`/`slow`의 값은 바꾸지 않았다.** §25의 예시 숫자(140/220/320)로
갈아끼우면 Premium unlock 연출(`stage-exit → unlock-enter → check-draw`)과 관찰 시퀀스의
합이 함께 움직인다 — 그건 '절제된 추가'가 아니라 튜닝된 것을 되돌리는 변경이다. 필요한
두 칸(`instant`·`enter`)만 새로 뒀다.

| 대상 | 모션 |
|---|---|
| Page | opacity 220ms (`.page-enter`) |
| Button · Chip · Row · Segmented | press scale 0.98 + 색 전환 (`.press-scale`) |
| Accordion 본문 | opacity + 6px, 220ms (`.body-enter`) |
| Bottom Sheet | backdrop 220ms → sheet 300ms (토큰 사용) |
| Onboarding | 본문 slide-in · 캐릭터 120ms 지연 |
| Report 섹션 | scroll reveal **1회** (`.reveal-once`) |

**§26에서 의도적으로 다르게 한 두 가지**

1. **Page에 translate/scale을 넣지 않았다** — `transform`은 containing block을 만들어
   `BottomSheet`/`ConfirmModal`의 `absolute inset-0`이 프레임 전체를 못 덮게 된다. 그리고
   `translateY`는 `useScrollRestore`의 복원과 시각적으로 경쟁한다.
2. **Accordion에 height 애니메이션을 넣지 않았다** — 높이 측정이 들어오는 순간
   §30이 금지한 `accordion measurement loop`와 scroll jump의 문이 열린다. 본문만
   opacity+6px로 들어온다.

---

## 11. Scroll Once Guard

```
한 번 보인 요소는 다시 숨기지 않는다. observer는 그 즉시 unobserve한다.
```

- root = 뷰포트가 아니라 **앱의 스크롤 컨테이너**(`[data-screen-scroll]`).
  비워두면 데스크톱에서 프레임 밖 섹션까지 '보인다'고 판정한다.
- `threshold 0.25` · `rootMargin '0px 0px -12% 0px'` — 경계 1px에서 토글되지 않게.
- 상태는 DOM `data-reveal` **한 곳**에만 둔다: `없음 → pending → in`.
- 3중 안전장치(연출이 안 돌면 **즉시 최종 상태**): reduced-motion / IO 없음 /
  이미 화면 위·안에 있는 요소.

**실측**

| 시나리오 | 결과 |
|---|---|
| 최상단 진입 | `pppp` (전부 pending · opacity 0) |
| 아래로 스크롤 | `ippp → iipp → iiip → iiii` (하나씩 1회 등장) |
| 경계 왕복 60회 | 상태 변화 **0건** — flicker/재재생 없음 |
| 맨 위로 되돌림 | `iiii` 유지 — replay 0 |
| Back 복원(중간 위치) | 지나온 3개 즉시 `in`, 남은 1개만 `pending` — **투명 잔존 0** |
| scrollHeight | 4741 **불변** — CLS 0 |

---

## 12. Reduced Motion

Browser pane이 `prefers-reduced-motion: reduce`를 강제하는 환경이라 **기본 상태가 곧
reduced-motion 검증**이었다.

| 대상 | 결과 |
|---|---|
| Home 러비 시퀀스 | 타이머 미시작 · 정적 1장 · 작대기 미렌더 |
| 발견 blink | `display: none` (전역 블록에 명시 추가 — `iteration-count: 1`만으로는 반투명 상태로 굳는다) |
| Scroll reveal | 즉시 `in` (스크롤 이동 연출 off, 정보는 전부 보인다) |
| press-scale · page-enter · body-enter | 전역 `prefers-reduced-motion` 블록이 0.01ms로 만든다 — 실측에서 새 transition의 duration이 `1e-05s`로 확인됐다 |
| 기능적 상태 변화 | 전부 즉시 반영 (정보가 사라지는 모션은 없다) |

---

## 13. Full Browser QA

| 화면 | 결과 |
|---|---|
| `/` 스플래시 | VERIFIED — 시퀀스 4프레임 순환 · CLS 0 |
| `/onboarding` 1~4장 | VERIFIED — 제목·캐릭터·시각요소·dot 4개·마지막 장 CTA 전환 |
| `/status` (Fresh User) | VERIFIED — localStorage 초기화 후 `/` → 온보딩 → `/status` |
| `/target` | VERIFIED — 사건 추가/고치기/삭제/상한/새로고침 복원 |
| `/compatibility` | VERIFIED — 결과 렌더 · AI narrative(real) · scroll reveal |
| `/mirror` | VERIFIED — 렌더 · Premium CTA |
| `/premium` → demo_unlock → 리포트 | VERIFIED — 관계 맥락 블록 + Chapter 5개 |
| `/home` · `/history` · `/profile/intro` | VERIFIED — 렌더 · 에러 0 |
| Console | **에러 0** (경고만: §17) |

---

## 14. Event QA

| 케이스 | 방법 | 결과 |
|---|---|---|
| 사건 0개 | FIXTURE EVT-01 + 브라우저 | 블록 자체가 없다 (빈 상태 카피 없음) |
| 1개 | FIXTURE EVT-02 + 브라우저 | 원문 그대로 · 해석 · 경계 · 체크포인트 |
| 3개 | FIXTURE EVT-03 + 브라우저 | 입력 순서 유지 · `myReaction`은 적은 항목에만 |
| 최대 초과(4개) | FIXTURE EVT-04 | 3개만 리포트에 들어간다 |
| 빈 description · 잘못된 종류 | FIXTURE EVT-05 | 그 항목만 빠진다 (추정하지 않는다) |
| 삭제 | 브라우저 | 3 → 2, 입력 폼 복귀 |
| 수정 | 브라우저 | 본문 갱신 · **id 유지** (`evt-mtvnvqjv-3uq`) |
| 뒤로가기 · 새로고침 | 브라우저 | 2개 복원 · 태그 `2개` |
| session restore | `sanitizeRelationshipEvents` + 브라우저 | 값까지 검사(v1.44 BUG-002 규칙) |
| **New Target** | 브라우저 | **사건 0개로 초기화** · declared(SELF)는 유지 → **누출 없음 (P1 해당 없음)** |

---

## 15. Trust QA

금지 주장(`상대가 너를 좋아해` · `마음이 식었어` · `밀당 중` · `일부러 연락을 줄였어` ·
`회피형`) — **0건.**

가장 어려운 케이스를 fixture로 고정했다(**EVT-12**): 사용자가 결론을 **직접 입력**한 경우.

```
입력   "상대가 일부러 연락을 줄였고 마음이 식었어"

인용   그대로 남는다 (사용자가 알려준 것을 지우지 않는다)
해석   "너는 연락의 변화를 관계의 중요한 신호로 기억하고 있어."   ← 주어가 사용자
경계   "이건 네가 기억하는 장면이야. 상대가 무슨 마음이었는지는 여기서 알 수 없어."
```

서비스가 만든 문장(해석·체크포인트·제목·라벨)에 `일부러`·`마음이 식`·`밀당`·`회피형`·
`상대가`·`상대는` **0건**. 경계 문장은 상대를 언급하지만 그건 주장이 아니라 **주장의
부정**이라 스캔 대상에서 제외하고 별도 검사로 존재를 강제한다.

`ended`(FIXTURE EVT-11 + 브라우저): `그 관계에서` · `그때 상대가` — 현재형 호칭 0건,
금지된 행동 제안 0건. 러비 체크포인트는 애초에 **행동을 지시하지 않는다**.

---

## 16. Responsive

| 폭 | horizontal overflow | 비고 |
|---|---|---|
| 360×800 | **0** | 사건 종류 칩 8개 정상 wrap |
| 375×812 | **0** | |
| **393×852 (최우선)** | **0** | 결과·리포트 전 구간 |
| 430×932 | **0** | |
| 768×1024 | **0** | |
| 1280×800 | **0** | 프레임 중앙 정렬 |

- text clipping 0 · character clipping 0
- motion 후 layout shift 0 (러비 박스 208×228 불변 · 리포트 scrollHeight 4741 불변)
- button hit area — 새로 만든 버튼 전부 `min-h-11`(44px). `press-scale`의 0.98은 **누르는
  동안만** 존재하고 hit test는 이미 끝난 뒤라 타깃을 줄이지 않는다.
- keyboard/input overlap — 사건 입력은 단행 `input`이고 sticky footer 위 본문 영역이다

---

## 17. Performance

| 항목 | 결과 |
|---|---|
| bundle | `/target` 11.4 kB (사건 UI 포함) · `/onboarding` 5.86 kB · First Load JS shared **103 kB**(기준선 유지) |
| 새 런타임 의존성 | **0** — framer-motion·next/image만 쓴다 |
| 이미지 eager load | 시퀀스 4장 중 **첫 장만** `priority`, 나머지는 lazy. 온보딩도 1장만 |
| LCP | 온보딩 1장 캐릭터가 LCP가 되어 Next가 경고 → `priority` 추가 후 **경고 소멸**(§20 P2) |
| CLS | 러비 박스 고정 · reveal은 opacity/transform만 → 0 |
| observer leak | `unobserve` + unmount `disconnect` + `pending` 표식 정리 (코드 보증 · 계측은 미실시 → §21) |

**남아 있는 경고 (전부 v1.46 이전부터 있던 것 · 이번 사이클에서 건드리지 않은 화면)**

```
/history       crystal.png  LCP priority 경고
/profile/intro record.png   LCP priority 경고
/home          heart.png    width/height 한쪽만 수정됨 경고
```

---

## 18. Regression

| suite | 기준(v1.45) | v1.46 | 판정 |
|---|---|---|---|
| `test:premium` | 196 | **225** | ✅ EVT-01~14 추가 |
| `test:ai` | 508 | **515** | ✅ R8 fixture 추가 |
| `test:observed` | 10 | 10 | ✅ |
| `test:history` | 100 | 100 | ✅ |
| `test:lifecycle` | 144 | 144 | ✅ |
| `test:relationship-evidence` | 280 | **282** | ✅ TC5가 새 source 검사 |
| `test:trust` | 205 | 205 | ✅ |
| `test:ai:e2e` | 6/6 | **6/6** | ✅ Real Provider |
| `tsc` | 0 | **0** | ✅ |
| `eslint` | 0 | **0** | ✅ |
| `build` | 59/59 | **59/59** | ✅ Compiled successfully |

**감소한 숫자 0건.**

---

## 19. Changed Files

**신규 6**

```
src/data/relationshipEvents.ts                     사건 종류·라벨·상한 (순수 데이터)
src/lib/logic/relationshipEvents.ts                정규화 · 근거 문장 · 관계 맥락 블록
src/components/profile/RelationshipEventSection.tsx S19 입력 UI
src/components/lovy/LovySequence.tsx               첫 화면 관찰 시퀀스
src/hooks/useRevealOnce.ts                         scroll reveal (1회 보장)
tests/fixtures/ai/relationship_r8_user_event_ref_rejected.json
```

**수정 31** — 요약

```
타입·상태     types/index.ts · state/{SessionProvider,defaultAnswers}
근거          lib/aiEvidenceResolver.ts · services/ai/schemas.ts · lib/logic/premiumChapters.ts
Premium       services/premiumService.ts · components/premium/{RelationshipDeepReportView,PremiumChapterAccordion}
Motion        styles/globals.css · lib/motion.ts · components/common/{ScreenLayout,Button,ChoiceChip,
              SelectableRow,SegmentedField,BottomSheet} · components/report/ReportShell
캐릭터        data/lovy.ts · components/lovy/Lovy.tsx · app/page.tsx
Onboarding    data/copy.ts · components/onboarding/OnboardingVisual.tsx · app/onboarding/page.tsx
화면 배선     app/target/page.tsx · app/compatibility/page.tsx · app/first-contact/page.tsx · app/lens/mbti/page.tsx
Analytics     lib/analytics.ts
검사           app/api/dev/premium-test/route.ts · tests/run-premium-fixtures.mjs
문서           docs/기능명세_현행.md (§15 Candidate 절 추가)
```

---

## 20. P0 / P1 / P2

**P0 — 0건**

**P1 — 1건 (발견 · 수정 완료)**

> **Scroll reveal이 React Strict Mode에서 리포트 섹션을 영구히 투명하게 만들었다.**
>
> 예전 구현은 `useRef<WeakSet>`으로 '이미 observe한 요소'를 따로 기억했다. Strict Mode의
> double mount에서 **observer는 cleanup으로 사라지고 WeakSet은 ref라 살아남아**, 두 번째
> mount에서 모든 요소가 "이미 처리함"으로 걸러졌다 — 아무도 관찰되지 않았고 `.reveal-once`의
> `opacity: 0`만 남았다. 브라우저에서 `data-reveal`이 끝까지 붙지 않는 것으로 실측했다.
>
> **수정** — 진실의 출처를 DOM `data-reveal` 하나로 합쳤다(`없음 → pending → in`).
> observer 수명과 cleanup(`pending` 표식 제거)을 같은 effect에 묶었다. 재실측: 정상.

**P2 — 2건 (발견 · 수정 완료)**

1. **`.press-scale`이 색 전환을 죽였다.** `transition`이 단축 속성이라 Tailwind
   `transition-colors`와 겹치면 뒤엣것이 transition-property를 통째로 덮어쓴다 —
   실측에서 버튼 색 전환이 0ms였다. → 한 클래스가 transform+색을 함께 선언하도록 고치고
   호출부의 중복 클래스를 걷어냈다.
2. **온보딩 1장 캐릭터가 `priority` 없는 LCP 요소가 됐다.** v1.45까지 온보딩 캐릭터는
   fold 아래 한 장뿐이라 없던 문제다. → 1장만 `priority`. 경고 소멸 확인.

---

## 21. NOT VALIDATED

| 항목 | 상태 |
|---|---|
| 사건 입력이 관계 분석을 **더 명확하게 느끼게 하는가** | 미검증 — UT 대상 |
| 입력 부담(3개 · 자유 입력 2칸)이 적절한가 | 미검증 — UT 대상 |
| 사용자가 **무슨 사건을 써야 하는지** 이해하는가 | 미검증 — UT 대상 |
| 첫 화면 시퀀스가 '살아 있다'로 읽히는가 / 산만하지 않은가 | 미검증 — UT 대상 |
| 온보딩 4장이 '관계 속 나' 서비스로 이해되게 하는가 | 미검증 — UT 대상 |
| Motion이 완성도 상승으로 느껴지는가 / 느리지 않은가 | 미검증 — UT 대상 |
| 실기기(iOS Safari · Android Chrome) | **미실시** — Browser pane 에뮬레이션만 |
| 메모리·observer leak 계측 | **미실시** — 코드 보증만(unobserve · disconnect · 표식 정리) |
| 장시간 체류 시 시퀀스 타이머 누적 | 미계측 (setTimeout 1개 재귀 · 누적 구조 아님) |

---

## 22. Remaining Risks

1. **사건이 AI에 닿지 않는다 — 의도된 선택이지만 가치의 상한이기도 하다.**
   deep-report의 근거 계약은 Insight 단위라, 사건을 보내려면 기존 Insight의 근거 집합을
   건드리거나(§12 위반) Insight 밖 자유 서술 채널을 만들어야 한다(v1.43 §46 결함 재현).
   그래서 v1.46은 결정론 블록으로만 전달한다. **UT에서 "사건을 적었는데 리포트가 그걸
   깊이 쓰지 않는다"는 반응이 나오면**, 그때 필요한 것은 프롬프트가 아니라 *사건을 근거로
   삼는 새 cross-source 조합*이다 — 별도 사이클이다.

2. **Browser pane이 reduced-motion을 강제한다.** 애니메이션 경로는 `matchMedia` 패치로
   검증했지만, 실기기에서의 체감 속도(3.2초 주기 · 220ms 진입)는 UT에서 처음 확인된다.

3. **`.reveal-once`의 초기 상태가 `opacity: 0`이다.** 3중 안전장치를 뒀지만 구조적으로
   "훅이 안 돌면 안 보인다"는 성질은 남는다. P1이 정확히 그 성질에서 나왔다.

4. **사건 자유 입력이 localStorage에 평문으로 남는다.** 기기 안이고 외부·AI로 나가지
   않지만, 공용 기기에서 '내 관찰 데이터 삭제'를 하지 않으면 남는다(기존 세션 데이터와
   같은 성질 · 새 위험은 아니다).

5. **온보딩 4장은 이탈 지점이 하나 늘어난 것이기도 하다.** `onboarding_complete`의
   `last_step`으로 추적 가능하지만, 3장 대비 완주율 변화는 UT/지표에서 확인해야 한다.

---

## 23. READY FOR USER REVIEW

```
구현     4개 개선 완료 · Feature Freeze
QA       회귀 1,481건 통과(감소 0) · tsc 0 · eslint 0 · build 59/59 · 실기기 미실시
결함     P0 0 · P1 1(수정) · P2 2(수정) · 미수정 0
커밋     0건 — commit · push · deploy · Frozen Snapshot 전부 하지 않음
다음     사용자 화면 검토 → (승인 시) 커밋 → UT 설계/실행
```

**검토해 주셨으면 하는 것 3가지**

1. **온보딩 4장** — 3장으로 압축하라는 원칙과 History가 빠져 있던 사실 사이에서 4장을
   골랐습니다. 이 판단이 맞는지.
2. **사건을 AI에 보내지 않은 것** — §12/§13의 원칙과 충돌하지 않는 선을 이렇게 그었는데,
   기대하신 '관계 맥락 활용'의 깊이에 미치는지.
3. **첫 화면 3.2초 주기** — 직접 보시고 빠른지/느린지.
