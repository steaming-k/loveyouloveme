# Lens Information Hierarchy (260916)

> 사주 · 별자리 렌즈의 **정보 위계**를 '개인 풀이 중심'에서
> '같은 관계를 다른 렌즈로 보는 흐름'으로 재정렬한 작업.
>
> 기준 HEAD: `de1a576` · branch `feat/v147-supabase-persistence-clean`
> `AI_MODE=demo` · `NEXT_PUBLIC_AI_MODE=demo` · Provider 0
>
> 선행 문서: `ANALYSIS_CONCEPT_CONTINUITY_260915.md` (연속성 인트로 · `LENS → CORE` 도입)

---

## 1. 남아 있던 문제

260915 작업으로 세 렌즈가 **같은 문법**(관찰 맥락 → Lens 결과 → 실제 관계 복귀)을
갖게 됐지만, **순서**는 고정되지 않았다. 그래서 사주 · 별자리 화면은 연속성 인트로를
갖고도 본문이 개인 결과부터 시작했다.

393×852 실측(dev, seed 세션: 나 1996-03-05 / 상대 1994-07-21, 궁합 완료):

```text
사주 — BEFORE                             별자리 — BEFORE
 60px  ENTERTAINMENT      (10px)           60px  ENTERTAINMENT      (10px)
106px  사주 렌즈          (23px)          106px  별자리 렌즈        (23px)
146px  caption                             146px  caption
187px  러비 인트로                         187px  러비 인트로
274px  나의 일주                           274px  나의 태양궁
344px  신축(辛丑)일       (21px) ←개인     344px  물고기자리         (21px) ←개인
463px  우리 둘                             442px  상대의 태양궁
617px  관계 해석          (12.5px)         512px  게자리             (21px) ←개인
                                           610px  우리 둘
                                           743px  관계 해석          (12.5px)
```

첫 viewport에서 **가장 큰 활자 두 개가 렌즈 이름과 내 일주/태양궁**이었고, 관계 해석은
각각 617px · 743px 아래에 있었다. 별자리는 첫 화면의 약 3/5이 개인 태양궁 두 장이었다.
럽유럽미의 관계 렌즈가 아니라 **사주 앱 · 별자리 앱의 결과 페이지**로 읽히는 구조다.

## 2. 기준점 — MBTI 렌즈는 이미 옳았다

```text
러비 관찰 기록 · 렌즈        ← 1차: 무엇을 보는 화면인가
성향 렌즈로 본 두 사람  (24px) ← 주어가 '두 사람'
01 나 INFP × 상대 ESTJ        ← 곧바로 두 사람
   성향 렌즈만 보면 …
02 이 조합에서 눈여겨볼 것
03 그런데 실제 관계에서는?
   LENS → CORE
04 4 AXES (근거 · 기본 접힘)   ← 판정 근거는 맨 뒤
```

MBTI에는 **'나의 유형' 단독 카드가 없다.** 근거(4축)는 맨 뒤에 접혀 있다.
사주 · 별자리만 근거를 맨 앞에 Main Result로 놓고 있었다.

## 3. 바꾼 것 — presentation only

| 층위 | Before | After |
|---|---|---|
| 머리말 | 없음 | `러비 관찰 기록 · 렌즈` (MBTI와 **같은 상수**) |
| 제목 | `사주 렌즈` / `별자리 렌즈` | `사주 렌즈로 본 두 사람` / `별자리 렌즈로 본 두 사람` |
| 배지 | 헤더 우상단 `ENTERTAINMENT` | **그대로** (지우지 않고 제목 아래 층위로 강등) |
| 관계 해석 | 개인 결과 **뒤** | 인트로 **바로 뒤** |
| 개인 렌즈 값 | `나의 일주` · `나의 태양궁` Main Result (21px, 흰 카드) | `이 렌즈의 기준` 안의 supporting basis (15px, `bg-canvas-warm`) |
| `LENS → CORE` | Premium Bundle **뒤** | Premium Bundle **앞** (MBTI와 같은 자리) |

제목은 **두 사람의 값이 모두 계산됐을 때만** `두 사람`이라고 말한다
(`relationNote` · `couple.available`). 없는 것을 봤다고 말하지 않는 규칙을 제목까지 확장했다.

## 4. AFTER 실측 (393×852)

```text
사주 — AFTER                              별자리 — AFTER
 60px  ENTERTAINMENT      (10px)           60px  ENTERTAINMENT      (10px)
106px  러비 관찰 기록 · 렌즈 (10px)       106px  러비 관찰 기록 · 렌즈 (10px)
129px  사주 렌즈로 본 두 사람 (23px)      129px  별자리 렌즈로 본 두 사람 (23px)
169px  caption                             169px  caption
210px  러비 인트로                         210px  러비 인트로
297px  우리 둘                             297px  우리 둘
361px  신축 × 무신       (15px)           361px  물고기자리 × 게자리 (15px)
452px  관계 해석         (12.5px) ←관계   452px  관계 해석          (12.5px) ←관계
521px  러비 질문                           702px  러비 질문
609px  이 렌즈의 기준                      851px  이 렌즈의 기준
677px  나의 일주 · 신축(辛丑)일 (15px)     919px  나의 태양궁 / 1016px 상대의 태양궁 (15px)
```

관계 해석이 617px → **452px**, 743px → **452px**로 올라왔고,
개인 값은 21px Main Result → 15px supporting basis로 내려갔다.

**H2 순서(두 화면 동일):** `우리 둘` → `이 렌즈의 기준` → `출생정보` → `이 렌즈의 한계`
→ `LENS → CORE` → `PREMIUM BUNDLE`

## 5. 하지 않은 것

```text
❌ 새 관계 해석 생성      ('둘의 사주가 잘 맞는다' 류 0건)
❌ Lens 계산 로직 변경    (readSajuDay · buildAstrologySelfLens 결과 그대로)
❌ 개인 결과 삭제         ('나의 일주' · '나의 태양궁' 라벨과 값 모두 유지)
❌ ENTERTAINMENT 삭제
❌ Premium 가격 · 자격 · 번들 구조 변경
❌ 설명 블록 증가         (별자리는 개인 카드 2장 → 1장, 영문 라벨 2종 제거로 오히려 감소)
```

## 6. 설계 계약 (freeze)

```text
Lens = 별도 분석 서비스가 아니다.

Lens =
  같은 관계를 다른 해석 프레임으로 한번 더 보는 것.

Personal Lens Data (일주 · 태양궁 · MBTI 유형) =
  주인공이 아니라 supporting basis.
  삭제하지 않는다. 다만 관계 해석보다 앞에 두지 않는다.

Core relationship evidence =
  항상 최종 기준. 모든 렌즈는 LENS → CORE로 닫힌다.

ENTERTAINMENT =
  지우지 않는 안전장치. 단, 화면의 1차 정체성이 아니다.
```

## 7. QA

| Case | 확인 | 결과 |
|---|---|---|
| A 사주 available | 첫 viewport 관계 인지 · 기준 강등 · bridge · bundle | ✅ |
| B 별자리 available | 동일 | ✅ |
| C unlocked Premium | 가격 0건 · 결제 CTA 0건 · 위계 동일 | ✅ |
| D unavailable Lens | 인트로 0 · bridge 0 · 기준 블록 0 · 제목 `두 사람` 아님 · 입력 안내 유지 | ✅ |
| E refresh / direct URL | 위계 · availability 동일 | ✅ |
| desktop 1280 | 가로 overflow 0 · 제목 1줄 | ✅ |
| console error | 0 | ✅ |

## 8. Gate

| 항목 | 결과 |
|---|---|
| `test:ut-phase1` | ✅ 84/84 (CONCEPT-07 · 08 · 09 신규 16건 포함) |
| regression 23종 | ✅ 전부 통과 |
| `test:observed` | ⚠️ 3건 실패 — **변경 전 tree에서도 동일**. `AI_MODE=real`을 요구하는 E2E라 demo 환경의 상시 실패다 |
| tsc · eslint · build | ✅ |
| Provider delta | ✅ **0** |

## 9. Freeze

**Lens 정보 위계를 여기서 freeze한다.** 추가 polish를 반복하지 않는다.
다음 판단은 2차 UT **H17**의 결과로만 한다:

```text
새로운 서비스처럼 느껴졌는가
vs
같은 관계를 다른 관점으로 보는 느낌이었는가
```
