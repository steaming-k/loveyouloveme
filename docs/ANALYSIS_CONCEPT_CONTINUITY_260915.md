# Analysis Concept Continuity (260915)

> 분석 **후반부**(Lens · Action · Recommended Question)에서도 러비가
> `관찰 → 연결 → 기록 → 다음 관찰`을 이어가게 만드는 작업.
>
> 기준 HEAD: `510b5be` · `AI_MODE=demo` · `NEXT_PUBLIC_AI_MODE=demo` · Provider 0

---

## 1. 문제

Concept Polish 이후 앞부분은 럽유럽미답게 읽히는데, 뒤로 갈수록 밀도가 떨어졌다.

```
Compatibility   럽유럽미답다
Mirror          럽유럽미답다
Premium         럽유럽미답다
Lens            다시 일반 사주/MBTI/별자리 앱처럼 보일 위험
Action/Question 다시 일반 관계 조언 서비스처럼 보일 위험
```

## 2. 왜 Lens가 약했는가 — 세 렌즈가 서로 다른 문법을 쓰고 있었다

| | 헤더 | 관찰자 framing | 관계로 되돌리는 길 |
|---|---|---|---|
| **MBTI** | `SUPPORTING LENS` + `러비 관찰 기록 · 렌즈` | ✅ | ✅ `03·BUT IN REAL LIFE` + `LENS → CORE` |
| **사주** | `ENTERTAINMENT` | ❌ | ❌ |
| **별자리** | `ENTERTAINMENT` | ❌ | ❌ |

MBTI는 이미 목표 구조를 갖고 있었다. 사주·별자리만 이렇게 시작하고

```
ENTERTAINMENT
사주 렌즈
나의 일주 · 경자(庚子)일 …
```

`notPrediction` 한 줄 뒤 `렌즈 목록으로`로 닫혔다. **앞 화면까지 이어지던 관찰 흐름이
여기서 끊기고, 결과만 놓인 일반 운세 앱 페이지처럼 읽힌다.**

Premium 리포트 안의 렌즈 섹션에는 이미 맞는 문장이 있었는데(`LENS_SECTION_COPY.intro`
— "여기부터는 같은 관계를 다른 프레임으로 다시 본 거야"), **단독 렌즈 화면에만 없었다.**

## 3. 분석 문법 (내부 설계 원칙)

```
Compatibility = FIRST OBSERVATION
Mirror        = RELATIONSHIP MIRROR
Premium       = CONNECT
Lens          = SAME RELATIONSHIP, DIFFERENT VIEW
Action        = OBSERVE NEXT
```

⚠️ **participant UI에 이 영어를 그대로 노출하지 않는다.** 한국어가 자연스럽게 읽히는 게
우선이고, 이 표는 내부 판단 기준이다.

---

## 4. Before → After

### 사주 렌즈

| | |
|---|---|
| **Before** | `ENTERTAINMENT / 사주 렌즈` → 곧바로 `나의 일주`. 끝은 `notPrediction` → `렌즈 목록으로`. 관계로 돌아가는 길 없음 |
| **After** | 상단에 연속성 한 줄 + 하단에 `LENS → CORE` |
| **Why** | 렌즈가 **독립 서비스**가 아니라 **같은 관계를 보는 한 관점**으로 열리고 닫힌다 |

```
지금까지는 네가 답한 관계 신호를 봤어. 이번엔 같은 관계를 사주 렌즈로 한 번 더 볼게.
   …(기존 일주 결과 그대로)…
LENS → CORE
이 렌즈에서는 이렇게 보여. 그런데 실제 관계에서는 어떨까?
[ 실제 관계 신호로 보기 → ]
```

### 별자리 렌즈
사주와 **동일한 구조**를 적용(렌즈 이름만 다름). 기존 태양궁 결과·질문·한계는 그대로.

### MBTI 렌즈
**변경 없음.** 이미 `러비 관찰 기록 · 렌즈` 헤더와 `그런데 실제 관계에서는?` ·
`LENS → CORE`를 갖고 있어, 나머지 둘을 여기에 맞춘 것이다.

### Recommended Question / Action
**이번 라운드 변경 없음.** 직전 Concept Polish에서 이미 정리됐다:
- `확인해보면 좋은 항목` → `가볍게 물어볼 수 있어` (friction은 `차이가 보이는 자리`)
- 힌트 카테고리 라벨 중복 제거
- 닫는 문장 `다 해볼 필요 없어. 위에서 하나만 골라 다음 대화에 가져가봐.`

실측 결과 이미 `그래서 뭘 확인해볼까` · `참고할 것` 계열이라 명령형이 아니었고,
더 손대면 표현 취향 변경이 되므로 **CONCEPT-06 회귀 테스트로 고정만** 했다.

### 분석 ending
`아직 만들지 않은 연결`(Premium) · `다음 관찰 보기`(Compatibility)가 이미 있어
추가 checkpoint를 만들지 않았다. **없는 기능을 약속하지 않는다** — `다음에 자동으로
비교해줄게` 같은 문장은 넣지 않았다.

---

## 5. 변경하지 않은 로직

```
Lens 계산 · 사주 engine · MBTI logic · Zodiac logic
추천 질문 선정 로직 · 질문 수
Compatibility score · Mirror · Premium eligibility · pricing · bundle
EvidenceConnectionTrail 로직 · AI inference 범위
schema · persistence · share · history
```

이번 diff는 **presentation / framing 전용**이다. 두 컴포넌트(`LensObservationIntro`
신규, `LensCoreBridge` 재사용)와 게이트 조건뿐이다.

---

## 6. ⚠️ 없는 결과를 봤다고 말하지 않는다

첫 구현에서 실제로 잡은 결함: 출생정보가 없는 세션에서

```
이번엔 같은 관계를 별자리 렌즈로 한 번 더 볼게.
두 지구인의 출생정보부터 알려줘.        ← 볼 게 없는데 보겠다고 함
…
LENS → CORE
이 렌즈에서는 이렇게 보여.              ← 아무것도 안 보여줬는데 봤다고 함
```

→ 인트로와 bridge를 **렌즈 계산 여부로 게이트**했다(사주 `mineSaju`, 별자리
`availability.self`). 지금은 둘 다 사라지고 출생정보 입력 경로만 남는다.
Premium Bundle 카드는 그대로 보인다 — 렌즈 하나가 없다고 번들이 막히지 않는다.

---

## 7. Browser QA (393×852 · demo · Provider 0)

| Case | 결과 |
|---|---|
| A 사진 없음 + 충분한 evidence | ✅ 사주/별자리 인트로·bridge 정상 · Premium 정상 |
| B 사진 있음 | ✅ 동일 |
| C Premium unlocked | ✅ 번들 카드 `보기 →` · 가격 0 · `지금 보는 중` 유지 |
| D 일부 Lens 입력 없음 | ✅ 인트로·bridge 숨김 · 입력 경로만 · 번들 유지 |

- 러비 인트로는 40px 한 줄 — 렌즈 결과보다 크지 않다(스크린샷 확인)
- 렌즈가 진단처럼 보이지 않음(`~라는 이야기가 흔해` 등 기존 헤지 유지)
- 렌즈별 가격 CTA 0

---

## 8. Known risks

| risk | 판단 |
|---|---|
| 사주·별자리가 여전히 개인 결과(`나의 일주`/`나의 태양궁`)로 시작한다 | 블록 순서 변경은 구조 변경이라 이번 범위 밖. 인트로가 관계 맥락을 먼저 세우는 것으로 완화 |
| `ENTERTAINMENT` 배지 유지 | MBTI(`SUPPORTING LENS`)와의 구분은 **의도된 positioning**이라 평탄화하지 않았다 |
| 사주·별자리에는 MBTI의 `그런데 실제 관계에서는?` 대비 블록이 없다 | 그건 새 해석 생성이라 금지 범위. bridge로 관계 복귀 경로만 제공 |

---

## 9. UT2 추가 가설

### H17. Lens continuity
질문: **"사주·MBTI·별자리를 볼 때 새로운 서비스로 넘어간 느낌이었나요, 같은 관계를
다른 관점으로 보는 느낌이었나요?"**
- 성공: `같은 관계` · `다른 관점` · `여러 렌즈`
- 실패: `사주 앱으로 넘어간 것 같다` · `별개 기능`
- 관찰: 렌즈 간 이동 시 번들 카드를 쓰는가 · `실제 관계 신호로 보기`를 누르는가

### H18. Action framing
질문: **"마지막 질문이나 제안은 해야 할 일처럼 느껴졌나요, 필요할 때 써볼 수 있는
힌트처럼 느껴졌나요?"**
- **유도 없이 먼저 행동을 관찰한다** — 질문을 저장하는가 · 건너뛰는가 · 부담스러워하는가
- 성공: `골라서 쓰면 되는` · `참고`
- 실패: `다 해야 할 것 같다` · `숙제`

기존 H14(Lovy 역할) · H16(경험 연속성)은 그대로 유지한다.

---

## 10. Gate

| 항목 | 결과 |
|---|---|
| `test:ut-phase1` | ✅ 73/73 (CONCEPT-05 · 06 포함) |
| regression 21종 | ✅ 21/21 |
| tsc · eslint · build | ✅ |
| Provider delta | ✅ **0** |
| AI_MODE | ✅ `demo` 유지 |

---

## 11.1 후속 (260916)

이 문서가 만든 **공통 문법**(관찰 맥락 → Lens → 실제 관계 복귀)은 순서까지는 고정하지
않아서, 사주 · 별자리 본문이 여전히 `나의 일주` · `나의 태양궁`부터 시작했다.
그 **정보 위계**를 재정렬한 기록은 `LENS_INFORMATION_HIERARCHY_260916.md`에 있다.

---

## 11. Freeze

**분석 표현층을 여기서 freeze한다.** 추가 Concept Polish를 반복하지 않는다.
2차 UT 전까지는 `UT2_RC_260915.md` §7의 blocker(A~E)에 해당하는 실제 기능 오류만
고치고, 표현 취향 변경은 H14 · H16 · H17 · H18 결과를 보고 판단한다.
