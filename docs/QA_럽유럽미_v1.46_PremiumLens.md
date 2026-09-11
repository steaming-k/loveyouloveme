# QA — 럽유럽미 v1.46 Candidate · Premium Lens 보강

> **상태: READY FOR USER REVIEW** · 커밋 0건 · push 0건 · deploy 0건 · Frozen Snapshot 0건
>
> 이 문서는 §59가 요구한 35개 항목을 그 순서대로 적는다.
> 이전 사이클 보고서는 [`QA_럽유럽미_v1.46_Candidate.md`](./QA_럽유럽미_v1.46_Candidate.md)다.

---

## 1. Git state

```text
branch            main
HEAD              8446f0171fa10f4d6ee24f280e5ee363ba55b090
origin/main       8446f0171fa10f4d6ee24f280e5ee363ba55b090
HEAD...origin/main  0 / 0
commit            0건
working tree      수정 41 · 신규 14 (문서 2건 포함)
```

`git reset` · `git stash` · `git checkout -- .` 어느 것도 실행하지 않았다.

## 2. 기존 v1.46 Candidate 보존 여부

**보존됨.** 이전 사이클의 4개 기능은 하나도 되돌리지 않았고, 그 회귀 테스트도 전부
그대로 통과한다(§30 표).

| 이전 사이클 산출물 | 상태 |
|---|---|
| User-reported Relationship Event | 유지 · 이번에 **Premium Lens가 이 사건을 인용한다**(§46) |
| Home Lovy Motion | 유지 · 첫 프레임만 `1.png`(hero) → `chart`로 교체(§24~§26) |
| Onboarding 4장 | 손대지 않음 |
| Global Motion System | 손대지 않음 · 렌즈 아코디언도 기존 토큰만 쓴다 |
| Scroll Reveal Once Guard | 손대지 않음 |
| Reduced Motion 대응 | 유지 · Preparing 상수만 변경(§23) |
| Premium Deep Report / Self-only / demo_unlock | 유지 |

⚠️ **의도적으로 건드리지 않은 것**: `NEXT_PUBLIC_SAJU_ENGINE_READY` ·
`services/sajuService.ts` · `services/ai/promptVersions.ts` — `git diff`로 무변경 확인.

## 3. Premium Bundle Before / After

| | Before (v1.45) | After (v1.46) |
|---|---|---|
| 상품 수 | 4개가 따로 (`relationship_deep_report` · `mbti_detail` · `astrology_detail` · `saju_detail`) | **1개 묶음** |
| 렌즈 진입 시 보이는 가격 | MBTI ₩1,900 / 별자리 ₩1,900 / 사주 '준비 중' | **₩1,900 한 번** |
| unlock 1회로 열리는 것 | 정밀 관찰 리포트만 | **정밀 관찰 리포트 + 렌즈 3종 + Cross-Lens** |
| 사주 | 계산 엔진 없음 → 영구 `unavailable` | **일주(日柱) 실계산** → pair/self 결과 |

## 4. Entitlement 구조

```text
FEATURE_BY_SOURCE
  compatibility · mirror · history · first_contact ┐
  mbti · astrology · saju                          ┴→ relationship_deep_report
```

세 렌즈 source가 전부 같은 flagship을 가리킨다. **`source` key는 그대로 뒀다** —
상품은 하나가 됐지만 '어디서 지불 의향이 생겼는가'는 여전히 구분해야 하고
(`premium_entry_click.source`), 그래서 Home의 렌즈 버튼 3개에 새 이벤트를 만들지 않았다.

접근 권한은 기존 경로를 그대로 쓴다 — `demo_unlock`(Production CTA) ·
`hasPreviewUnlock(feature, funnelAnalysisId)`. 향후 실제 PG가 붙으면 `payment` mode가
같은 entitlement를 준다. **새 저장소도 새 플래그도 만들지 않았다.**

`LENS-01` / `LENS-01b`가 소스 스캔으로 고정한다(개별 렌즈 상세를 파는 진입점 0개).

## 5. Home Premium 발견성 Before / After

| | Before | After |
|---|---|---|
| Home에서 MBTI/사주/별자리 진입 | **없음** (궁합 결과 안쪽 '다른 렌즈' 허브 하나뿐) | Home 하단 Premium Bundle 영역 |
| 진입 요소 | 0개 | **3개 + 전체 보기 1개** (1열 compact row) |
| 위치 | — | History · 프로필 다음, `새로운 사람과 궁합 보기` **앞** |

⚠️ `MBTI · 사주 · 별자리 포함` 같은 텍스트 한 줄로 끝내지 않았다(§33). 실측 텍스트:

```text
PREMIUM BUNDLE
정밀 관찰 리포트 + 관계 렌즈 3종
내 답과 관계 기록을 연결해 보고, MBTI · 사주 · 별자리로도 다른 관점에서 볼 수 있어.
₩1,900 · 현재 테스트 무료
한 번 열면 아래 전부 볼 수 있어
  MBTI 관계 분석    열기 →
  사주 관계 분석    열기 →
  별자리 관계 분석  열기 →
따로 파는 게 아니라 정밀 관찰 리포트와 같이 열려.
[전체 상세 분석 보기 →]
```

⚠️ Home의 primary CTA를 이기지 않는다 — Button이 아니라 테두리 카드이고 브랜드 색은
CTA 텍스트 한 줄에만 쓴다(v1.5 `PremiumEntryRow` Guardrail과 같은 규칙).
⚠️ 리포트를 만들 근거가 없으면 이 블록은 **통째로 숨는다** — Home은 허브이고, 아직 살
수 없는 상품의 안내 카드가 상시로 붙어 있으면 그건 광고 자리가 된다.

## 6. Home 가격 표시

**₩1,900 · 1회.** 브라우저 실측(393px): `document.body.innerText`에서 `₩1,900` 매치
**1건**. 스크린리더용 `(1,900원)`은 `.sr-only`(position absolute · width 1px)로 확인.

렌즈 버튼 3개에는 **가격 문자열이 들어갈 자리 자체가 마크업에 없다.**
`LENS-02`가 `formatPrice(` 호출 수 = 1을 고정하고, `LENS-02b`가 렌즈 결과 섹션에
`formatPrice`/`₩`/`resolvePrice`가 0건임을 고정한다.

## 7. MBTI Target O 실제 결과 예시

fixture: 나 `INFP` × 상대 `ENFP`

```text
HEADLINE
  INFP × ENFP — 정보를 받아들이는 방식 · 결정할 때 먼저 보는 기준 · 계획과 유연함
  사이는 같은 쪽이고, 에너지를 회복하는 방식은 다른 쪽으로 분류됐어.

섹션 4개
  ① 함께 지내는 리듬        (E/I × J/P)
  ② 대화가 엇갈리는 자리     (S/N × T/F) + 네가 알려준 장면
  ③ 닮은 축 · 갈리는 축
  ④ 오해가 생기기 쉬운 지점

② 본문
  둘 다 의미와 가능성을 먼저 보는 쪽이야. 이야기가 깊어지기는 쉬운 대신, 실제로
  무슨 일이 있었는지가 흐려질 수 있어.
  둘 다 결정할 때 감정적 맥락을 먼저 보는 쪽이야. 서로의 상태는 잘 챙겨지는 대신,
  정해야 할 것이 정해지지 않은 채 넘어갈 수 있어.
  ▸ 네가 알려준 장면 · 연락의 변화 — '답장 간격이 하루 정도 길어졌어'
    (그때 나는 '괜히 내가 뭘 잘못했나 생각했어') — 이 장면에서는 위의 차이가 더
    크게 느껴졌을 가능성을 확인해볼 수 있어. 상대가 그때 무슨 마음이었는지는 이
    렌즈로 알 수 없어.

③ 본문
  설명 없이 통할 수 있는 자리 — 정보를 받아들이는 방식 · 결정할 때 먼저 보는 기준 ·
  계획과 유연함 사이. 여기서는 서로 왜 그러는지 묻지 않아도 넘어가게 돼. 편한 만큼
  확인이 생략되는 자리이기도 해.
  설명이 필요한 자리 — 에너지를 회복하는 방식. 여기서는 같은 상황을 서로 다른
  언어로 옮겨 적게 돼. 어렵다는 뜻이 아니라, 말하지 않으면 안 넘어간다는 뜻이야.

CHECKPOINT
  혼자 있고 싶은 날 그걸 어떻게 알릴지 신호를 하나 정해봐. 침묵을 서로 다르게
  읽지 않게.

왜 이렇게 봤어?
  나 INFP · 상대 ENFP
  같은 축 정보를 받아들이는 방식 · 결정할 때 먼저 보는 기준 · 계획과 유연함 사이
  다른 축 에너지를 회복하는 방식
```

무료 `/lens/mbti`가 이미 주는 것(4축 비교표 · 조합 패턴 · 질문 1개 · 관계 신호 비교)과
**겹치지 않는다** — 유료는 축을 `리듬(E/I·J/P)`과 `이해(S/N·T/F)`로 **묶어서** 읽는다.

## 8. MBTI Target X 실제 결과 예시

```text
HEADLINE  INFP — MBTI로 보는 관계 속의 나.

섹션 5개
  ① 관계에서 에너지를 쓰는 방식
  ② 관계 신호를 받아들이는 방식
  ③ 갈등에서 먼저 보는 것
  ④ 약속과 일상의 리듬
  ⑤ 이 렌즈와 네가 직접 답한 기준          ← 불확실성/검증 섹션

⑤ 본문 (declared.alone = 4)
  너는 개인 시간이 꽤 필요하다고 답했어. MBTI 분류도 혼자 있는 시간으로 회복하는
  쪽이라 두 관점이 같은 방향을 가리켰어. 같은 방향이라고 같은 이유인지는 아직
  모르겠지만.

CHECKPOINT
  위 네 줄 중에 "이건 나랑 다른데" 싶은 게 있으면 그 줄을 기억해둬. 다음에 실제로
  그 상황이 왔을 때 어느 쪽이 맞았는지 확인해보는 게 이 렌즈를 쓰는 방법이야.
```

⚠️ **MBTI ↔ 사용자 답 비교는 `E/I ↔ 개인 시간` 하나뿐이다.**
`logic/mbtiBridge.ts`가 v1.24 P3-1에서 나머지 셋(S/N · T/F · J/P)을 근거 없는
대응이라고 **명시적으로 기각**했고 그 판단을 뒤집지 않았다 — 축을 늘리면
'T라서 공감 못 함' 류의 stereotype이 유료 리포트에서 되살아난다.
어긋날 때 문장의 주어는 **항상 사용자의 답**이다('맞는 쪽은 네가 직접 답한 쪽이야').

## 9. 사주 Target O 실제 결과 예시

fixture: 나 `1995-08-12` × 상대 `1990-05-15` (둘 다 양력)

```text
HEADLINE  을해일 × 경진일 — 목과 금이 만나는 자리야.

섹션 4개
  ① 두 사람의 일주
     너는 을해(乙亥)일, 상대는 경진(庚辰)일에 태어났어.
     너는 일간 을(목 · 음), 상대는 일간 경(금 · 양). 명리에서 일간은 '나 자신'을
     가리키는 자리라, 이 렌즈는 그 한 글자를 기준으로 봐.
  ② 일간으로 본 각자
     너 — 뻗어나가는 기운으로 이야기돼. … 표현이 안에서 한 번 정리된 뒤에 나가는 쪽.
     상대 — 정리하는 기운으로 이야기돼. … 표현이 밖으로 먼저 나가는 쪽.
     표현이 나가는 방향이 서로 다르게 분류됐어. 한쪽이 먼저 꺼낼 때 다른 쪽은 아직
     정리 중일 수 있다는 뜻으로 읽혀.
  ③ 둘을 같이 놓았을 때  (+ 네가 알려준 장면)
     상대 일간이 네 일간을 극(剋)하는 자리야. 여기서도 극은 나쁨이 아니라 기준이
     상대 쪽에 놓인 것으로 읽힌다는 뜻이야 — 네가 상대의 기준에 맞춰보게 되는
     흐름이야.
     어긋나기 쉽다고 이야기되는 지점 — 맞추는 게 익숙해지면 네 기준을 말하지 않게
     되는 지점.
  ④ 이 프레임만으로는 알 수 없는 것
     사주 네 기둥 중 일주(日柱) 하나만 계산했어. 연주는 입춘 시각, 월주는 절기,
     시주는 진태양시가 필요해서 이 렌즈에서는 세우지 않아.
     그래서 여기서 나온 건 두 사람의 일간 사이의 방향 하나뿐이야. 관계가 어떻게
     될지, 서로에게 맞는 사람인지는 이 한 글자로 알 수 없어.

CHECKPOINT
  상대 방식에 맞춰본 뒤에, 네가 원래 원했던 걸 말한 적이 있어? 이 렌즈에서는 그렇게
  보이지만, 실제로 그런지는 네가 알려준 장면과 앞으로의 대화로 확인해봐.

왜 이렇게 봤어?
  내 일주 을해(乙亥) · 일간 목
  상대 일주 경진(庚辰) · 일간 금
  두 일간의 관계 목 → 금 · 전통 용어로 관성
  계산한 기둥 일주 1개 (연주·월주·시주 미계산)
```

⚠️ **극(剋)을 '상극'으로 팔지 않는다.** 대중 사주라면 여기에 '상극이라 헤어진다'가
들어가는 자리다. 이 렌즈는 방향만 말하고, 문장이 **극이 나쁨이 아니라는 것을 직접**
말한다. `LENS-15b`가 이 자리를 고정한다.

### 9.1 일주 계산 엔진 — 만세력 대조

```text
index = (JDN + 49) mod 60          index 0 = 갑자(甲子)

날짜          만세력      계산값     결과
1990-05-01   丙寅       丙寅      ✓
1990-05-15   庚辰       庚辰      ✓   (계산 → 조회 순서로 예측 적중)
1995-08-01   甲子       甲子      ✓
1995-08-12   乙亥       乙亥      ✓
2024-01-01   甲子       甲子      ✓
```

34년 떨어진 두 구간이 모두 맞으므로 60주기 offset이 어긋나지 않았다.
`SAJU-CALC-01~04`가 offset 상수와 두 날짜를 고정한다.

**계산하지 않는 것** — 연주(입춘 시각) · 월주(절기) · 시주(진태양시) · 음력 환산.
음력 입력은 `unavailable`로 두고 이유를 적는다(양력처럼 취급해 조용히 틀린 일주를
주지 않는다). 야자시(夜子時) 규칙도 유파에 따라 갈리므로 한쪽을 말없이 적용하지 않고,
23시대 출생은 경계에 있다는 사실을 한계로 알린다.

## 10. 사주 Target X 실제 결과 예시

```text
HEADLINE  을해일 — 사주로 보는 관계 기준의 나.

섹션 4개
  ① 내 일주
  ② 일간으로 본 관계 속의 나
     뻗어나가는 기운으로 이야기돼. 관계에서도 먼저 방향을 그리고 움직여보는 쪽으로
     읽혀. 표현이 안에서 한 번 정리된 뒤에 나가는 쪽으로 분류돼.
  ③ 일지로 본 일상의 리듬
     하루의 리듬은 상황에 맡기는 쪽이 편하다고 이야기돼.
     일간이 관계에서 드러나는 방식이라면 일지는 하루가 굴러가는 방식이야. …
     네 경우엔 서로 다른 오행이야.
  ④ 이 해석만으로는 알 수 없는 것
     … 그리고 이건 "나는 원래 이런 사람"이라는 결론이 아니야. 한 글자로 사람을
     정하지 않아 — 관계에서 나를 다시 생각해보는 각도 하나일 뿐이야.

CHECKPOINT
  위에서 읽은 방향이 최근 관계에서도 그랬는지 하나만 떠올려봐. 맞지 않으면 그
  프레임이 아니라 네 경험이 맞는 거야.
```

⚠️ 일지를 **'배우자궁'으로 부르지 않는다** — 그 순간 이 렌즈가 배우자 운을 말하는
것이 되고, 그건 §47이 금지한 결과다. 일간(관계에서 드러나는 방식)과 일지(하루의 리듬)는
**층위를 다르게** 뒀다(§28 — 둘이 같은 말을 하면 항목만 둘이고 내용은 하나가 된다).

## 11. 별자리 Target O 실제 결과 예시

fixture: 사자자리(불 · 고정) × 황소자리(흙 · 고정)

```text
HEADLINE  사자자리 × 황소자리 — 불과 흙이 만나.

섹션 4개
  ① 두 사람의 관계 스타일
  ② 원소와 양태로 본 공통점 · 차이
     불과 흙으로 원소가 달라. 속도가 다르게 느껴질 수 있어. 결정을 언제 내리고
     싶은지 이야기해봐.
     양태는 고정 × 고정이야. 두 사람의 양태가 같아. 관계를 움직이는 방식이 닮은
     것으로 읽히고, 그래서 둘 다 같은 지점에서 멈출 수도 있다고 이야기돼.
  ③ 가까워질 때 생기는 기대 차이
  ④ 오해가 생기기 쉬운 지점
     별자리에서 말하는 성향은 그 사람이 그렇게 하려고 마음먹었다는 뜻이 아니야.
     표현이 적은 것과 마음이 적은 것은 다른 이야기고, 이 렌즈는 둘을 구분하지 못해.

CHECKPOINT
  표현이 얼마나 자주 오가는지 말고, 상대의 어떤 행동을 애정 표현으로 알아듣는지를
  서로 하나씩 말해봐. 이 렌즈가 가장 자주 어긋나는 자리가 거기야.

왜 이렇게 봤어?
  내 태양궁 사자자리 · 불 · 고정
  상대 태양궁 황소자리 · 흙 · 고정
  계산 범위 태양궁만 (달·상승궁 미계산)
```

**계산 범위** — 태양궁 + 그에서 곧바로 따라오는 4원소·3양태까지다. 양태는 계산이
아니라 전통 점성술의 고정 분류표이므로 §15('계산하지 못하는 것을 만들지 않는다')를
어기지 않는다. 달·상승궁은 만들지 않는다(`LENS-09`).

## 12. 별자리 Target X 실제 결과 예시

```text
HEADLINE  사자자리 — 별자리로 보는 관계 속의 나.

섹션 4개
  ① 관계에서 중요하게 여길 수 있는 것
  ② 가까워지는 방식
     양태는 고정이야. 관계에서도 한번 정한 방식을 유지하는 쪽으로 이야기돼.
     원소가 '무엇을 중요하게 보는가'라면 양태는 '어떻게 움직이는가'야. 둘은 다른
     층이라 같이 읽어야 해.
  ③ 이 렌즈와 네가 직접 답한 기준
     불 원소는 거리나 개인 시간을 직접 말하는 분류가 아니야. 네가 답한 관계 기준과
     나란히 놓을 대응이 없어서 이번엔 비교하지 않았어 — 억지로 이으면 없는 관계를
     만드는 거니까.
  ④ 이 렌즈로는 알 수 없는 것
     태양궁은 태어난 날짜 하나로 정해져. 같은 날 태어난 모든 사람이 같은 칸에
     들어간다는 뜻이라, 네가 실제로 관계에서 어떻게 행동하는지는 이걸로 알 수 없어.

CHECKPOINT
  이 렌즈가 던지는 질문은 이거야 — "애정을 확인받고 싶을 때 어떻게 알려?" 최근에
  그랬던 순간을 하나 떠올려봐. 네 기억과 위 설명이 다르면, 맞는 쪽은 네 기억이야.
```

③이 이 렌즈의 정직함을 그대로 보여준다 — **거리를 실제로 말하는 원소(`공기`·`물`)에서만**
`declared.alone`과 나란히 놓고, `불`·`흙`에서는 대응이 없다고 적는다.
`mbtiBridge`가 축 3개를 기각한 것과 같은 규칙이다.

## 13. Cross-Lens 실제 결과 예시

```text
세 렌즈를 겹쳐보면 · 러비가 서로 다른 관점을 같이 놓아봤어.  (lensCount 3)

반복해서 나온 테마
  '계획과 즉흥 사이' — MBTI · 사주 · 별자리 3개 렌즈에서 나왔어.
  '기준을 누가 정하는가' — 사주 · 별자리 2개 렌즈에서 나왔어.
  '움직이는 속도' — 사주 · 별자리 2개 렌즈에서 나왔어.

렌즈마다 다르게 말하는 부분
  '혼자 정리하는 시간'은 MBTI 관계 렌즈에서만 나왔어. 다른 렌즈는 이 주제를 보지
  않는다는 뜻이지, 중요하지 않다는 뜻은 아니야.
  '마음을 표현하는 방식'은 MBTI 관계 렌즈에서만 나왔어. …

실제 관계에서 확인할 것
  1  다음 약속을 언제까지 정해두면 편한지, 당일에 정하면 불편한지 각자 기준을
     숫자로 맞춰봐.
  2  최근에 둘이 정한 것 하나를 골라, 그걸 누가 먼저 제안했고 상대는 언제
     동의했는지 되짚어봐.
  3  무언가를 정해야 할 때, 둘 중 누가 먼저 말을 꺼내고 누가 며칠 두고 보는 편인지
     최근 일로 맞춰봐.

세 관점은 서로 독립적인 증거가 아니야. 다른 해석 프레임에서 비슷한 테마가 반복됐다는
뜻이고, 실제로 그런지는 네 경험으로 확인해야 해.
```

**작동 방식** — 각 렌즈가 닫힌 테마 목록(`pace` · `alone_time` · `expression` ·
`planning` · `closeness` · `standard`) 중 **자기 데이터가 실제로 말하는 것만** 내고,
Cross-Lens가 그것을 센다. 매핑표는 각 렌즈의 문장에서 그대로 읽어낸 것이고 새 해석이
아니다(`logic/premiumLens.ts` 상단 표 참고).

⚠️ 마지막 문장(`note`)은 **데이터의 필수 필드**다 — 화면 문구로만 두면 다음 화면이
빼먹을 수 있고, 그 순간 렌즈가 근거로 승격된다. 반복 테마가 하나도 없을 때는
`noRepeatNote`로 갈린다('세 관점이 서로 다른 곳을 보고 있다는 뜻이야').

## 14. 각 Lens paid value 1문장

> **MBTI paid value** — 무료가 주는 4축 비교표를 `함께 지내는 리듬(E/I·J/P)`과
> `대화가 엇갈리는 자리(S/N·T/F)`로 **묶어서** 읽어, 네 글자가 아니라 *두 사람이
> 어디서부터 다르게 보기 시작하는지*를 보여준다.

> **사주 paid value** — 생년월일에서 실제로 일주를 세워, 두 일간 사이에 힘이 어느
> 방향으로 흐르는 것으로 읽히는지(누가 먼저 내어주고 누가 기준을 잡는지)를
> 좋고 나쁨 없이 보여준다.

> **별자리 paid value** — 태양궁 한 줄 해석에서 멈추지 않고 원소(무엇을 중요하게
> 보는가)와 양태(어떻게 움직이는가)를 **다른 층으로 분리해** 관계 기대의 차이가
> 어디서 생기는지 짚어준다.

> **Cross-Lens paid value** — 세 프레임에서 반복된 테마와 한 렌즈에서만 나온 테마를
> 갈라서, 렌즈 일반론이 아니라 **네 관계에서 실제로 확인할 질문 3개**로 바꿔준다.

## 15. Generic Copy / Duplicate Audit

| 검사 | 결과 |
|---|---|
| §27 금칙 문장 4종 (`서로 대화를 많이 해보는 게 좋아` 등) | **0건** (`VALUE-05`) |
| 같은 렌즈 안 섹션 제목 중복 | **0건** · pair/self 6개 렌즈 전부 (`VALUE-01`) |
| 같은 렌즈 안 섹션 id 중복 | **0건** (`VALUE-01b`) |
| 세 렌즈 사이 동일 body 문단 | **0건** (`VALUE-02`) |
| 세 렌즈 headline / overview 동일 | **0건** (`VALUE-02b/02c`) |
| checkpoint에 실행 동사 | 6/6 렌즈 + Cross-Lens 질문 전부 (`VALUE-06/06b`) |
| disclaimer 길이 | 3개 모두 60자 이하 — 경고문 블록으로 키우지 않았다 (`VALUE-07c`) |

**밀도** — Target O: 렌즈당 substantive section 4개 + headline + overview + checkpoint.
Target X: 4~5개(자기 3+ / 불확실성·검증 1+) + checkpoint. **filler는 만들지 않았다** —
데이터가 없으면 `unavailable`로 두고 무엇이 있으면 보이는지 적는다.

## 16. AI Contract — ⚠️ **렌즈에 AI를 얹지 않았다**

이것이 §21~§26에 대한 **의도적 이탈**이고, 가장 먼저 검토받아야 할 판단이다.

**한 것** — 렌즈 전체를 결정론 엔진으로 만들었다(`lib/logic/premiumLens.ts`).
새 AI Task 0개 · 새 promptVersion 0개 · 새 provider call 0개.

**왜** — §24가 요구한 핵심(`AI_OUTPUT.basisRefs ⊆ allowedEvidence`) · §26(AI 실패
fallback) · §29(밀도 기준) · §49(VALUE 테스트)는 전부 **결정론일 때만 증명 가능**하다.
AI를 얹으면 그 네 가지가 확률이 된다.

그리고 §21이 지시한 대로 기존 task 재사용을 먼저 검토했는데, deep-report의 근거
계약이 **Insight 단위**(`evidence: 'insight-subset'`)라 렌즈 재료를 넣으려면 기존
Insight의 `evidenceRefs`를 건드려야 하고, 그러면 `sources` · `strength` ·
`eligibleForNarrative` · Chapter 매칭 · `available`이 함께 움직인다 — §45가 금지한
것이다. 이전 사이클이 '사건을 AI에 보내지 않는다'로 결론 낸 것과 **같은 구조적 이유**다.

**대가** — 렌즈 문장은 템플릿 조합이므로 같은 입력이면 같은 문장이다. MBTI 조합이
같은 두 사용자는 리듬 섹션 문장이 같다. 이것은 §33 NOT VALIDATED에 적었다.

## 17. allowedEvidence / basisRefs

AI가 없으므로 `basisRefs`를 검증할 대상이 없다 — **AI hallucinated evidence는 0이
아니라 구조적으로 불가능하다.** 대신 두 경계를 지켰다:

① **사용자 보고 사건** — 렌즈가 사건을 인용할 때 항상 실제 `RelationshipEvent.id`를
참조하고(`LENS-13b`), 문장은 `relationshipEventEvidenceText` 하나가 만들며 반드시
`네가 알려준 장면`으로 시작한다(`LENS-13c`). 사건이 없으면 참조 0건(`LENS-13e`).

② **basis(왜 이렇게 봤어?)** — 실제 계산 결과만 사람이 읽는 라벨·값으로 노출한다.
raw debug JSON은 0건(`LENS-18b`). MBTI는 입력값 `INFP`/`ENFP`를 그대로 보여주고
(`VALUE-07`), 별자리는 원소·양태까지 보여준다(`VALUE-07b`).

이전 사이클이 만들어 둔 `user_reported_event` EvidenceRef와 그것을 AI가 인용하면
거부되는 fixture(`relationship_r8_user_event_ref_rejected.json`)는 그대로 유효하다.

## 18. PromptVersion

**변경 0건.** `git diff --quiet HEAD -- src/services/ai/promptVersions.ts` → 무변경 확인.

새 task가 없으므로 새 promptVersion도 없고, 기존 task contract를 건드리지 않았으므로
version bump도 필요 없다. **old cache와 새 schema가 섞일 경로 자체가 없다.**

## 19. Provider Call 실측

```text
                        Deep Report   Lens Bundle   합계
Premium initial render        1            0          1
refresh                       0*           0          0
re-entry (같은 분석)           0*           0          0
```

`*` 기존 AI 캐시 히트(v1.42 §8.13 캐시 identity). 렌즈는 캐시 대상 자체가 아니다.

§50의 목표(`Premium initial render 신규 provider call ≤ 2`)를 **1로** 만족한다.
소스 검증: `premiumLens.ts` · `sajuPillars.ts` · `data/saju.ts` · `data/premiumLens.ts` ·
`PremiumLensSection.tsx`에서 `aiClient|requestAi|services/ai` 매치 **0건**
(`LENS-19b`). 재실행 동일성도 고정했다 — 같은 입력 → `JSON.stringify` 완전 일치
(`LENS-20`).

## 20. AI Failure

`test:lens`의 모든 fixture는 `narratives`를 넘기지 않는다 — **즉 전부 AI 실패
상태에서 돌린다.** 그 상태에서 렌즈 3종이 전부 결과를 만든다(`LENS-19`,
`availableCount === 3`).

Deep Report의 AI narrative가 실패해도 렌즈는 영향받지 않고, 반대도 마찬가지다.
한 렌즈가 `unavailable`이어도 다른 렌즈는 숨지 않는다(`LENS-05c` · `LENS-10b/10d`).

## 21. Trust / Forbidden Claims

3개 세션(pair · self · ended) × 렌즈 전체 문자열(label · headline · overview ·
섹션 제목/본문 · 사건 인용 · basis · 한계 · disclaimer · Cross-Lens 전부)을 스캔.

```text
운명 · 천생연분 · 상극이라 · 결혼운 · 결혼할 사람 · 배우자 운 · 연애운 · 재회운
바람기 · 외도 · 성공 확률 · 헤어질 가능성 · 궁합 점수
상대가 너를 좋아해 · 마음이 식었 · 밀당 · 일부러 연락을 줄였 · 회피형이
```

→ **전 세션 0건** (`LENS-15`)

상대 의도·감정 단정(`상대가 원하` · `상대가 느끼` · `상대의 진심` 등) → **0건**
(`LENS-14`). 극(剋)을 좋고 나쁨으로 말하지 않음 → 확인(`LENS-15b`).

## 22. Core Score / Mirror 영향 0 검증

**두 층으로 검증했다.**

① **의존 관계** (이게 증명이다) — 판정 엔진 5개 파일이 렌즈 모듈을 import하지 않는다:

```text
logic/compatibility.ts        premiumLens · sajuPillars · data/saju · data/premiumLens → 0건
logic/mirror.ts               → 0건
logic/history.ts              → 0건
logic/crossSourceInsights.ts  → 0건
logic/premiumChapters.ts      → 0건
```

② **실측 대조** — 렌즈 3종이 전부 `unavailable`이 되도록 MBTI·생년월일을 모두 비운
세션과, 전부 `pair`인 세션을 비교:

```text
동기화율 dimension 수   같음   (LENS-11b)
무료 Mirror 단위 수      같음   (LENS-12)
report.available        같음   (LENS-12b)
```

`RelationshipDeepReport.lensBundle`은 `available` · `chapters` · `omissions`에
들어가지 않는다 — MBTI만 있고 연결이 하나도 없는 세션이 렌즈 때문에 열리면, 사용자는
정밀 관찰 리포트를 사고 렌즈만 받는다.

## 23. Preparing Before / After 실측 시간

| | Before | After (실측) | 목표 |
|---|---|---|---|
| standard | 약 1.96초 | **2430ms** | 2.2~2.5초 ✓ |
| reduced-motion | 약 1.10초 | **1572ms** | 1.4~1.6초 ✓ |

CTA click → success visible → preparing visible → report first visible 을 브라우저에서
폴링 계측했다. `PREPARING_MS` 900 → 1300, `PREPARING_REDUCED_MS` 600 → 1000.
**기존 transition component를 그대로 쓰고 상수만 바꿨다.** 3초를 넘지 않고, 고정
타이머이므로 AI 처리 시간을 위장하지 않는다.

⚠️ 계측 환경 한계: Browser pane은 문서를 `visibilityState: 'hidden'`으로 유지하고
타이머를 throttle한다. 두 값 모두 이론값(2360ms / 1500ms)보다 약 70ms 큰데, 그 차이는
polling 간격과 throttle에서 온다.

## 24. Home `1.png` 제거

`hero.png`가 `docs/캐릭터/1.png`와 **SHA-256 동일**임을 먼저 확인했다
(`c20135a04992d640…`). `LOVY_HOME_SEQUENCE`에서 그 프레임을 제거했다.

브라우저 실측(`/`): 렌더된 `<img>` 4개 중 `hero.png` **0건**.
⚠️ **파일 자체는 지우지 않았다**(§42) — Splash와 Onboarding이 쓴다.

## 25. 새 Home Lovy asset

**`chart.png`** (`러비가 관찰 기록 차트를 보고 있는 모습`).

`docs/캐릭터`와 `public/lovy`의 이미지를 실제로 열어 보고 골랐다. 선정 근거:

| §43 조건 | chart.png |
|---|---|
| idle / observe 성격 | 차트를 보며 턱을 괸 모습 — **이미 관찰 중**이다 |
| 발견→돋보기→기록과 자연스러운 연결 | 보다가 알아채는 다음 장으로 이어진다 |
| 강한 감정 없음 | ✓ |
| 하트/축하/울음/잠 아님 | ✓ |

**탈락** — `question`(전구 프레임과 '생각' 상태가 겹침) · `laptop`(작업 중으로 읽히고
393px에서 소품이 무겁다) · `crystal`/`wand`(점술 도구 — `design-guide.md §2` 위반).
**새 이미지는 만들지 않았고 `docs/캐릭터`에서 추가로 복사한 파일도 없다.**

## 26. Home Sequence Before / After

```text
Before  hero(기본 서있기) → notice(발견) → observe(돋보기) → record(기록)
After   chart(관찰 idle)  → notice(발견) → observe(돋보기) → record(기록)
```

3.2초 주기 · crossfade · reduced-motion 정적 1장 · hidden tab 정지 **전부 그대로**.
실측: reduced-motion에서 opacity `[1, 0, 0, 0]` — 첫 프레임만 보인다. 고정 박스는
네 프레임의 최대값을 쓴다(실측 chart 221×226 · notice 202×202 · observe 208×213 ·
record 208×213) → CLS 0.

⚠️ **3.2초 순환은 이 환경에서 계측할 수 없었다.** Browser pane이 문서를
`visibilityState: 'hidden'`으로 유지하고, `LovySequence`는 §19에 따라 **가려지면
의도적으로 멈춘다**. 즉 멈춤 동작 자체는 검증됐지만 순환 주기는 소스(3200ms 무변경)와
이전 사이클 실측에 의존한다. **사용자 화면 검토에서 직접 봐주셔야 하는 항목이다.**

## 27. Browser QA

| Case | 상태 | 결과 |
|---|---|---|
| A | Target O + MBTI/사주/별자리 충분 | 렌즈 3종 전부 pair · Cross-Lens 3렌즈 |
| B/F | Target X + self 데이터 | 렌즈 3종 전부 self · Cross-Lens 3렌즈 |
| C | Target O + 상대 MBTI 없음 | **MBTI만 self** · 사주·별자리 pair 유지 |
| D | 사주 데이터 부족(음력) | **사주만 unavailable** + 음력 사유 · 나머지 유지 |
| E | 별자리 계산 불가(생일 없음) | 사주·별자리 unavailable · MBTI pair 유지 |
| G | Current relationship + Event | MBTI-03 · 사주-03에 `네가 알려준 장면` 인용 |
| H | Ended + Event | 금지 주장 0건 · 사건은 시제 유지 |
| I | AI failure | 렌즈 3종 정상 (모든 fixture가 이 상태) |
| J | Premium unavailable | 가격·CTA 없이 사유만 · **Home 번들도 숨음** |

§52 체크리스트:

```text
Home Premium 발견 가능      ✓  (3버튼 + 전체 보기)
가격 1회                    ✓  (innerText 매치 1건)
3개 Lens 버튼 보임           ✓
unlock 1회                  ✓  (source=mbti → 같은 flagship)
Deep Report 접근            ✓
MBTI / 사주 / 별자리 접근     ✓  (#lens-* anchor 3개 전부 존재)
Cross-Lens 접근             ✓
Target X 빈 영역 0           ✓
unsupported data fabrication 0 ✓ (시주·달·상승궁 생성 0)
```

**§34 deep-link 실측** — `#lens-mbti` / `#lens-saju` 모두 리포트 렌더 후 해당 섹션이
viewport 안(top 116px)으로 이동. 새 훅·새 이벤트를 만들지 않고 기존 `useAnchorScroll`과
`result_anchor_navigation`을 재사용했다.

**§34 paywall 명시성** — Home에서 'MBTI 관계 분석'을 눌러 온 사용자가 MBTI를 한
글자도 못 보던 문제를 실측으로 발견해 고쳤다. Paywall이 이제 `같이 열리는 관계 렌즈`
목록을 **실제 `report.lensBundle`로** 그린다(문구가 아니라 데이터 — 가짜 teaser가
구조적으로 불가능하다).

## 28. Responsive

| viewport | page overflow | 렌즈 섹션 내부 overflow |
|---|---|---|
| 360×800 | 없음 | 0건 |
| 375×812 | 없음 | 0건 |
| 393×852 | 없음 | 0건 |
| 430×932 | 없음 | 0건 |
| 768×1024 | 없음 | 0건 |
| 1280×800 | 없음 | 0건 |

렌즈 아코디언 3개를 모두 펼친 상태(가장 콘텐츠가 많은 Case A)에서 각 뷰포트마다
`scrollWidth > clientWidth`를 요소 단위로 검사했다. 앱 셸이 430px에서 상한이므로
768/1280에서는 모바일 컬럼이 그대로 렌더된다(기존 설계).

Home 3버튼은 §33대로 **1열 compact row**다 — 3열 그리드는 393px에서 `별자리 관계
분석`이 두 줄로 접히고 버튼 높이가 달라진다.

## 29. Motion QA

| 항목 | 상태 |
|---|---|
| scroll reveal once | 유지 (이전 사이클 P1 수정분 그대로) |
| reduced motion | 유지 · 렌즈 아코디언은 **높이 애니메이션을 쓰지 않는다** |
| press scale | 유지 · Home 렌즈 버튼에 `press-scale` 적용 |
| page/body enter | 유지 |
| IntersectionObserver loop | 없음 — 렌즈는 IO를 쓰지 않는다 |
| layout thrashing / accordion resize loop | 없음 — 조건부 렌더만 한다 |
| scroll jump | 없음 — 열 때 `scrollIntoView`를 부르지 않는다 |

렌즈 아코디언은 **전부 접힌 채로 시작한다.** Chapter Accordion은 첫 항목을 열지만
여기는 다르다 — 렌즈는 리포트를 다 읽은 뒤의 부록이고, 열려 있으면 Core를 읽던
스크롤이 렌즈 본문으로 이어져 위계가 뒤집힌다(§3 · §36).

## 30. Regression

| suite | v1.46 이전 | 지금 | 판정 |
|---|---|---|---|
| `test:premium` | 225 | **225** | 유지 |
| `test:lens` | — | **111** | 신규 |
| `test:ai` | 515 | **515** | 유지 |
| `test:observed` | 10 | **10** | 유지 |
| `test:history` | 100 | **100** | 유지 |
| `test:lifecycle` | 144 | **144** | 유지 |
| `test:relationship-evidence` | 282 | **282** | 유지 |
| `test:trust` | 205 | **205** | 유지 |
| `test:ai:e2e` | 6/6 | **6/6** | 유지 |
| `tsc` | 0 | **0** | 유지 |
| `eslint` | 0 | **0** | 유지 |
| `build` | 59/59 | **59/59** | 유지 (Route 추가 0) |

**감소 0건.** 새 suite 111개 추가 — LENS-01~20 · VALUE-01~07 · SAJU-CALC-01~04.

## 31. Changed Files

**신규 7개 (코드)**

```text
src/data/saju.ts                              311  천간·지지·오행 원표 + 관계 해석 문장
src/lib/logic/sajuPillars.ts                  227  일주 계산 (이번 사이클 유일한 새 계산 코드)
src/data/premiumLens.ts                       294  렌즈 문구 · 테마 라벨 · 번들 카피
src/lib/logic/premiumLens.ts                  962  렌즈 엔진 + Cross-Lens
src/components/premium/PremiumLensSection.tsx 379  렌즈 아코디언 + Cross-Lens 카드
src/components/premium/HomePremiumBundle.tsx  182  Home 하단 번들 영역
tests/run-lens-fixtures.mjs                   765  LENS/VALUE/SAJU-CALC fixture
```

**수정 17개**

```text
src/types/index.ts                     +280  PremiumLens 계약 + lensBundle 필드
src/data/zodiac.ts                      +45  양태 표 추가 · ELEMENT_PAIR_TOPIC key 수정(P2)
src/lib/korean.ts                       +47  과/와 · 으로/로 · 조사만 반환 헬퍼
src/lib/analytics.ts                    +19  premium_lens_open 1개만 추가
src/data/lovy.ts                        +60  Home sequence 첫 프레임 교체 + 근거 주석
src/components/lovy/LovySequence.tsx      —  주석 갱신만
src/services/premiumService.ts          +51  lensBundle 조립 + today 필수 파라미터
src/components/premium/RelationshipDeepReportView.tsx +75  렌즈 섹션 배치
src/app/premium/page.tsx               +130  FEATURE_BY_SOURCE · 렌즈 목록 · deep-link · solo
src/app/home/page.tsx                   +50  번들 블록 배선
src/app/lens/mbti/page.tsx              +33  개별 상세 → 번들
src/app/lens/astrology/page.tsx         +29  개별 상세 → 번들
src/hooks/useDeepReport.ts               +6  today
src/app/api/dev/premium-test/route.ts   +34  birthProfile 입력 · lensBundle 출력
src/app/api/dev/lifecycle-test/route.ts  +2  today
src/app/premium-preview/[feature]/page.tsx +2 today
package.json                             +1  test:lens
```

**문서** — `docs/기능명세_현행.md` §15.8 신설 + §15.1/§15.9/제목/목차 갱신.
⚠️ `docs/versions/기능명세_현행_v1.45.md` **무변경 확인**(`git diff --quiet`).

## 32. P0 / P1 / P2

**P0 — 0건**

**P1 — 0건**

**P2 — 4건 (전부 수정 완료)**

| # | 결함 | 발견 | 조치 |
|---|---|---|---|
| P2-1 | Paywall이 렌즈를 한 글자도 언급하지 않음 — 'MBTI 관계 분석'을 눌러 온 사용자가 MBTI가 포함된 상품임을 알 수 없었다(§34 위반) | 브라우저 실측 | Paywall에 `같이 열리는 관계 렌즈` 목록 추가. 문구가 아니라 실제 `report.lensBundle`을 그린다 |
| P2-2 | **`ELEMENT_PAIR_TOPIC` 6쌍 중 3쌍이 조회 실패** — key가 정렬되지 않은 순서(`fire\|earth`)인데 호출부가 `sort()`로 key를 만들어(`earth\|fire`) `?? ''`로 떨어졌다. 화면에 `불과 흙으로 원소가 달라. `처럼 **문장이 끊긴 채** 나갔다. **v1.4부터 있던 결함이고 무료 별자리 렌즈에도 그대로 있었다** | 유료 렌즈 실제 출력 확인 | key를 정렬 순서로 맞춰 두 호출부를 함께 수정. `LENS-08b/08c`가 6쌍 완전성을 고정 |
| P2-3 | 한글 조사 하드코딩 5곳 — `계획과 유연함 사이은` · `'혼자 정리하는 시간'는` · `양태는 고정야` · 괄호 뒤 서술격 조사 등 | 브라우저 실측 + 출력 덤프 | `lib/korean.ts`에 `과/와` · `으로/로`(ㄹ 예외 포함) · 조사만 반환하는 헬퍼 추가 후 전면 적용 |
| P2-4 | Paywall이 `solo` 파라미터를 넘기지 않아, 상대가 없는 사용자가 `관계 경험이나 **상대 정보**를 더 채우면 볼 수 있어`를 봤다 — `premiumService` 주석이 명시적으로 금지한 '갈 수 없는 길'. 결과 화면·Home은 이미 넘기고 있었고 **Paywall만 빠져 있었다**(pre-existing) | Case F 실측 | `solo: soloModeOf(answers) === 'no_target'` 추가. **자격 판정은 바꾸지 않고 안내 문구만** 바뀐다 |

**미수정 0건.**

### 오탐으로 확인한 것 1건

`CompatibilityView` hooks-order 에러 + `Cannot read properties of undefined` —
Fast Refresh 잔여물이었다. **새 탭을 열어** `/compatibility`를 로드하면 에러 0건
(Browser pane의 콘솔 버퍼가 누적식이라 `console.clear()`로는 구분되지 않는다).

## 33. NOT VALIDATED

구현으로 검증할 수 없는 것. **VERIFIED로 바꾸지 않는다.**

```text
₩1,900 WTP
MBTI Lens가 실제 결제 가치가 있는지
사주 Lens가 실제 결제 가치가 있는지
별자리 Lens가 실제 결제 가치가 있는지
Cross-Lens가 가치 상승에 기여하는지
Target 없는 사용자가 Self Lens를 가치 있게 느끼는지
Lens 때문에 Core(정밀 관찰 리포트)가 흐려지지 않는지
Home Premium 영역이 상업적으로 과하지 않은지
Preparing 시간이 적절한지
```

**추가 (이번 사이클에서 생긴 것)**

```text
렌즈 문장이 '개인화됐다'고 느껴지는지 — 템플릿 조합이므로 같은 입력이면 같은 문장이다
사주 일주 하나만으로 '사주를 봤다'고 느껴지는지 — 연주·월주·시주가 없다
전통 명리 용어(일간·오행·극)가 일반 사용자에게 읽히는지
Home 3버튼과 '전체 상세 분석 보기' 중 무엇이 눌리는지
```

## 34. Remaining Risks

1. **렌즈 문장의 개인화 상한** — 결정론 템플릿이므로 MBTI 조합·일간·태양궁이 같으면
   문장이 같다. UT에서 '나에 대한 얘기가 아니다'라는 반응이 나오면 AI narrative
   overlay를 별도 사이클로 설계한다(결정론 결과 **위에 얹는** 구조여야 하고,
   대체하는 구조여서는 안 된다 — §16 참고).

2. **사주 렌즈의 범위 기대** — 일주 하나만 세운다. 화면이 그 사실을 네 곳(headline
   아래 overview · 섹션 ④ · basis · 한계)에서 말하지만, '사주'라는 단어에서 사용자가
   기대하는 것은 명식 전체일 수 있다. 월주까지 세우려면 200년치 절기 표가 필요하다.

3. **음력 사용자** — 음양력 환산표가 없어 `unavailable`이다. 한국 사용자 중 음력
   생일을 아는 비율이 높으면 사주 렌즈 도달률이 예상보다 낮을 수 있다.

4. **Cross-Lens 테마 매핑의 자의성** — 오행 5개·원소 4개·양태 3개를 6개 테마로
   보낸 표는 각 렌즈 문장에서 읽어낸 것이지만, 다른 매핑도 가능하다. 반복 테마 수는
   이 표에 의존한다. 표는 `logic/premiumLens.ts` 상단에 근거와 함께 노출해 뒀다.

5. **`ELEMENT_PAIR_TOPIC` 수정의 파급** — 무료 별자리 렌즈(`astrologyService`)도
   이제 3쌍에서 문장이 **새로 나타난다.** 없던 문장이 생기는 것이므로 개선이지만,
   무료 화면의 출력이 바뀌는 변경이라 명시한다.

6. **Lens가 Core를 가리는 위험** — IA로만 막고 있다(리포트 → 렌즈 → Cross-Lens 순서 ·
   전부 접힌 상태 시작 · 32px 아바타 · 가격 미표시). '재미'가 Core보다 오래 기억되는지는
   UT에서만 알 수 있다.

7. **`hero.png` 사용처** — Home sequence에서 뺐지만 Splash·Onboarding이 쓴다.
   나중에 그 두 곳도 바꾸기로 하면 그때 파일 정리를 판단한다.

## 35. READY FOR USER REVIEW

**§61 STOP CONDITION 대조**

| # | 조건 | 상태 |
|---|---|---|
| 1 | Premium 1회 unlock으로 Deep Report + 3 Lens 모두 접근 | ✓ |
| 2 | Home 하단에서 MBTI/사주/별자리 분석을 쉽게 발견 | ✓ |
| 3 | 가격은 Bundle 기준 1회 | ✓ |
| 4 | MBTI Target O/X 모두 의미 있는 결과 | ✓ |
| 5 | 사주 Target O/X 모두 의미 있는 결과 | ✓ (일주 범위) |
| 6 | 별자리 Target O/X 모두 의미 있는 결과 | ✓ |
| 7 | Cross-Lens synthesis 존재 | ✓ |
| 8 | Lens별 내용이 서로 다른 가치 단위 | ✓ (VALUE-01/02) |
| 9 | generic filler 반복 최소화 | ✓ (VALUE-05 0건) |
| 10 | AI hallucinated evidence 0 | ✓ (AI 미사용 — 구조적으로 불가능) |
| 11 | success/운명/상대 속마음 예측 0 | ✓ (LENS-14/15) |
| 12 | Core score/Mirror state 영향 0 | ✓ (LENS-11/12 · import 0건) |
| 13 | Preparing 시간 소폭 증가 | ✓ (2430ms / 1572ms) |
| 14 | Home sequence에서 `1.png` 제거 | ✓ |
| 15 | 기존 v1.46 regression 유지 | ✓ (감소 0건) |
| 16 | P0/P1/P2 = 0 | ✓ (발견 4건 전부 수정 · 미수정 0) |

이후 **새 Premium 기능 추가 · 새 점술 Lens 추가 · 가격 변경 · PG 구현 · Core 로직
변경을 하지 않는다.**

```text
commit 0 · push 0 · deploy 0 · Frozen Snapshot 0
dev 서버 재기동 확인 (localhost:3000 → 200)
docs/versions/기능명세_현행_v1.45.md 동결본 무결
```

**사용자 화면 검토를 기다린다.**
