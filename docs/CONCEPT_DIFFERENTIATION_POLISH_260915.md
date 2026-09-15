# Concept & Differentiation Polish (260915)

> 기능을 더 만드는 문서가 아니다. **작동하는 럽유럽미**를 **왜 럽유럽미여야 하는지가
> 느껴지는 럽유럽미**로 바꾸기 위한 표현 구조 변경 기록이다.
>
> 기준 HEAD: `9e24f47` · 환경 `AI_MODE=demo` · `NEXT_PUBLIC_AI_MODE=demo`

---

## 1. UT 근거

| UT | 발화 |
|---|---|
| 0914 | "캐릭터랑 같이 티키타카 하는 것 같았는데 갑자기 사라지고 그냥 글자만 남았다" |
| 0914 | "논문이다" · "축이 너무 반복된다" |
| 0911 | "같은 말이 반복적으로 나오는 것 같음. 정보 피로도가 높아짐" |
| 0911 | "무료만으로는 유료 결제까지 고려하진 않을 것 같음" |
| 0914 | "기껏 별자리를 봐줬는데 갑자기 조별과제가 주어진 느낌" |
| 0915-2 | "컨셉이 좋았음. 좀 더 컨셉츄얼하게 해도 좋을듯" |

## 2. 문제 정의

```
질문 단계  = 러비와 대화하는 서비스
결과 단계  = 일반 AI 관계 보고서
```

그리고 Premium이 **'무료보다 글이 더 많은 리포트'** 로 읽혔다.

## 3. 현재 차별점 (지켜야 하는 것)

```
럽유럽미는 궁합으로 상대만 보는 서비스가 아니라,
관계 속의 '나'를 알아가는 서비스다.

궁합 = Hook
왜 이런 결과인지 = Engagement
Relationship Mirror = Core Value
관계 기록 = Retention
Premium = 여러 근거 사이의 Connection

Lovy = OBSERVE → COLLECT → CONNECT → REPORT → REMEMBER
       (마스코트가 아니라 관찰자)
```

---

## 4. Before Audit (393×852 실제 화면)

| route | 첫 focal | Lovy | 러비 역할 | 문제 |
|---|---|---|---|---|
| Compatibility | `01·SUMMARY` → 동기화율 80 | `LOVY OBSERVATION REPORT` 헤더 · `LOVY OBSERVATION` | 관찰자 ✓ | **같은 축을 4번 말함** |
| Mirror | `RELATIONSHIP MIRROR` → 네가 생각한 너 vs 관계에서 나타난 너 | `러비가 가장 눈여겨본 부분` | 관찰자 ✓ | 근거 provenance는 이미 훌륭(`이렇게 생각한 이유 01·02`) |
| Premium entry | `PRECISION REPORT` | paywall 러비 한마디 | 연결자 ✓ | 카피는 이미 연결 framing |
| Premium report | `이야기 3개를 연결한 관찰 기록` | Chapter별 러비 | 연결자 ✓ | **연결이 가운뎃점 한 줄로만 보임** |
| Lens section | `관계 렌즈` | 렌즈별 러비 | 관점 제공 ✓ | 문제 없음 |
| Action / Question | `04·NOW WHAT` | — | — | `확인해보면 좋은 항목` = 과제처럼 읽힘 |

### 차별점이 가장 약했던 화면

**Premium report.** 이 제품이 파는 것은 '따로 답한 것들 사이의 연결'인데,
그 연결이 접힌 헤더의 작은 메타 라벨 한 줄로만 보였다:

```
네가 말한 기준 · 상대에 대해 적은 내용 · 예전 관계 경험
```

**정확한 사실인데 읽히지 않는다.** 그래서 무료와의 차이가 '글이 길어졌다'로 읽혔다.

### block 분류에서 REPETITION으로 나온 것

Compatibility(잘 맞는 축만 있는 세션) — 같은 축을 네 번:

```
① 핵심 한 문장   애정 표현 · 연락 방식에 대한 기대가 비슷해 보여.
② YOUR SIGNAL   애정 표현에 대해서는 둘이 비슷하게 답했어.   ← ①과 같은 축·같은 뜻
③ 잘 맞는 신호   표현의 양 때문에 서운함이 생길 가능성은 낮은 편이야.
④ LOVY OBSERVATION  표현의 양은 비슷한 편이야. …
```

다가가는 힌트 — 같은 제목 연속 2회:

```
관계 속도를 맞출 때 참고할 것   연락은 편하게 이어가도 괜찮아
관계 속도를 맞출 때 참고할 것   표현 방식을 조금씩 맞춰봐
```

---

## 5. 변경 원칙

```
전체 카피 재작성 ❌
새 데이터 모델 ❌
새 분석 로직 ❌
presentation-only 변경 ✅
이미 있는 provenance를 구조로 보여주기 ✅
```

---

## 6. 수정한 것 (4건)

### ① Premium: Evidence → Connection 시각화 ★ 핵심

새 컴포넌트 `EvidenceConnectionTrail` (presentation-only).

**Before** — 접힌 헤더의 한 줄뿐:
```
네가 말한 기준 · 상대에 대해 적은 내용 · 예전 관계 경험
```

**After** — 결론 바로 아래에 구조로 한 번 더:
```
러비가 이어본 것
 ├ 네가 말한 기준
 ├ 상대에 대해 적은 내용
 └ 예전 관계 경험
 ↳ 연락 에서 만났어
```

- 입력은 `chapter.sourceGroups` **하나뿐**. 새 데이터도, fetch도, 난수도 없다.
- 라벨·순서를 자체 생성하지 않고 헤더와 **같은 함수**(`chapterSourceLabels`)를 쓴다.
  (처음엔 각자 정렬해서 같은 근거가 다른 순서로 나왔다 — 두 목록처럼 보였다)
- **source가 2종 미만이면 통째로 렌더하지 않는다.** 파생 Chapter(`next_check`·`closing`)에는
  나오지 않는다 — 실측에서 3개 Chapter 중 1개에만 나왔다.

### ② Compatibility: YOUR SIGNAL이 새 축을 말한다

`selectFirstSurprise`의 축 선택이 `frictionSignals[0] ?? goodSignals[0]`이라,
바로 위 핵심 한 문장이 방금 부른 축을 그대로 다시 불렀다.

**After**: 핵심 한 문장이 **아직 부르지 않은 축**을 고른다(`headlineLabelsOf`).

```
before  애정 표현 · 연락 방식에 대한 기대가 비슷해 보여.
        애정 표현에 대해서는 둘이 비슷하게 답했어.        ← 같은 축

after   애정 표현 · 연락 방식에 대한 기대가 비슷해 보여.
        개인 시간은 아주 다르지도, 아주 비슷하지도 않게 나왔어.  ← 새 축
```

⚠️ fallback으로 이미 부른 축을 다시 집지 않는다. 남은 축이 없으면 한 줄이 사라진다
(`signalLineOf(undefined) === null`) — 없는 근거를 만들지 않는 기존 규칙과 같은 동작.

### ③ 다가가는 힌트 라벨 중복 제거

`affection`이 `pace`와 같은 문자열이었다 → `표현 방식을 맞출 때 참고할 것`.
**`kind`도 판정도 건드리지 않았다.** 라벨 문자열 하나.

### ④ 추천 질문 framing

```
before  연락 방식 · 확인해보면 좋은 항목      ← 해야 할 목록의 한 줄처럼 읽힘
after   연락 방식 · 가볍게 물어볼 수 있어
        (friction) 차이가 보이는 자리
```

**질문 문장 자체는 건드리지 않았다.** 이미 1차 UT 후속에서 한 차례 부드럽게 고쳤고,
이번에 바꾼 것은 질문이 **놓이는 맥락**뿐이다.

---

## 7. 변경하지 않은 것

| 항목 | 이유 |
|---|---|
| Compatibility score / axis | 계산 불변 — score-first Hook 유지 |
| Mirror axis / state | 이미 `평소의 나 vs 관계 속의 나`로 읽힌다(감사에서 확인) |
| Premium eligibility · 가격 · unlock scope | 계약 유지 |
| Photo evidence contract | optional 유지 |
| Lens 계산 · 사주/MBTI/Zodiac 로직 | 손대지 않음 |
| Premium entry 카피 | 이미 연결 framing(`이 신호들이 따로 있는 게 아니라 서로 연결돼 있다면?`) |
| Lovy 등장 횟수 | **늘리지 않았다.** 도배 금지 — 역할만 명확히 |
| 질문 문장 · 질문 수 | 이전 라운드에서 이미 보정 |
| 관계 상태 구조 · schema · persistence | 범위 밖 |

---

## 8. 설계 계약 (회귀 방지)

```
Lovy      = 관찰자 / 연결자 / 기록자   (마스코트 아님)
FREE      = 한 관찰의 깊이
Premium   = 여러 관찰의 연결 깊이
시각화     = 실제 evidence를 이해시키는 용도 (장식 아님)
캐릭터     = checkpoint이지 장식이 아님
Result    = 일반 연애 조언 보고서가 아님
```

**시각화의 안전 규칙**
```
node 하나하나에 실제 source가 있어야 한다
source가 2종 미만이면 그리지 않는다
라벨·순서를 시각화 쪽에서 새로 만들지 않는다
개수를 세어 자랑하지 않는다 (`자료 3종` 금지)
```

---

## 9. Browser QA (393×852 · `AI_MODE=demo` · Provider 0)

| Case | 결과 |
|---|---|
| A 사진 없음 · 충분한 evidence | ✅ Premium 진입 · Chapter 3개 · trail 1개(3 source → 연락) |
| B 사진 있음 | ✅ 정상 · trail은 그 Chapter가 실제 이은 source만 표시 |
| C evidence 부족 | ✅ `정보가 더 필요해` 유지 · 가격 0 |

확인 항목:
- 빈 데이터로 시각화가 깨지지 않음 — source < 2면 블록 자체가 없음
- Connection component가 가짜 데이터를 만들지 않음
- Lovy checkpoint 중복 없음 (trail은 Chapter당 최대 1개)
- 텍스트를 가리지 않음 · 393px 가로 overflow 0
- Premium CTA 여전히 보임
- score-first 유지 (동기화율 80이 첫 블록)

---

## 10. Known risks

| risk | 대응 |
|---|---|
| trail이 Chapter마다 나오면 도배가 된다 | source ≥ 2인 Chapter에만 — 실측 3개 중 1개 |
| `사진에서 보인 것`이 trail에 나오는 세션을 아직 눈으로 못 봄 | 라벨은 공용 함수라 구조적으로 보장 · fixture가 photo 경로를 덮음 |
| YOUR SIGNAL이 사라지는 세션이 생길 수 있음 | 의도된 동작(없는 근거를 만들지 않음). H10에서 체감 확인 |

---

## 11. UT2 추가 가설 (H13~H16)

기존 H1~H12는 [UT2_HYPOTHESES_260915.md](UT2_HYPOTHESES_260915.md) 그대로 유지.

### H13. 차별점 인지
질문: **"이 서비스가 다른 궁합·관계 분석 서비스와 가장 다르다고 느껴진 부분은 뭐였나요?"**
- 성공: `관계 속 나` · `근거를 연결해서 보여줌` · `여러 입력을 이어서 봄` · `나와 상대를 같이 봄`
- 실패: `사주 앱` · `MBTI 궁합` · `AI가 연애 조언해주는 서비스`

### H14. Lovy 역할 인지
먼저 행동을 관찰한 뒤: **"러비는 이 서비스에서 어떤 역할을 하는 것처럼 느껴졌나요?"**
- 성공: `관찰한다` · `기록한다` · `연결한다` · `나를 보고 있다`
- 실패: `그냥 캐릭터` · `마스코트` · `장식`

### H15. Premium Connection Value
질문: **"Premium에서 무료 결과와 다르게 새로 생겼다고 느낀 건 뭐였나요?"**
- 성공: `연결` · `이유` · `맥락` · `왜 그런지`
- 실패: `더 길다`
- 관찰: `러비가 이어본 것` 블록에서 멈추는가 · 읽는가

### H16. Result Experience Continuity
질문: **"처음 질문할 때부터 결과까지 같은 서비스 경험이 이어진다고 느꼈나요?"**
- **어느 지점에서 분위기가 바뀌었다고 느끼는지**를 기록한다(그 지점이 데이터다)

---

## 12. Gate

| 항목 | 결과 |
|---|---|
| `test:ut-phase1` | ✅ 61/61 (CONCEPT-01·02 포함) |
| `test:premium` | ✅ 285/285 |
| regression 21종 | ✅ 21/21 |
| tsc · eslint · build | ✅ |
| Provider delta | ✅ **0** |
| AI_MODE | ✅ `demo` (public flag도 `demo`로 정렬) |

---

## 13. Scope Freeze

**Concept Polish는 여기서 끝난다.** 추가 polish를 반복하지 않는다.
2차 UT 전까지는 `UT2_RC_260915.md` §7의 blocker 기준(A~E)에 해당하는
**실제 기능 오류만** 고친다. 표현 취향 변경은 H13~H16 결과를 보고 판단한다.
