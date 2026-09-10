# 럽유럽미 v1.45 Premium Deep Report v2 QA

| 항목 | 내용 |
|---|---|
| 대상 버전 | **v1.45 Candidate** (Premium Deep Report v2 · Chapter Engine) |
| 기준 baseline | v1.44 · `7ee2abd` (Release) · `e2284a6` (Implementation) |
| 작성일 | 2026-09-10 |
| 상태 | **READY FOR USER REVIEW** — commit/push 전 · Frozen Snapshot 미생성 |
| Production 영향 | **없다.** Fake Door·Premium Preview 게이트를 열지 않았다 |
| 상태 표기 | **VERIFIED**(실측) · **STATICALLY VERIFIED**(코드·타입·정적 guard) · **NOT VERIFIED** · **NOT VALIDATED**(사용자 가치 미검증) |

---

## 1. Premium Value Contract

> **무료에서 각각 보던 관찰을 한데 연결해,
> 내 관계 기준이 어디에서 맞고 어긋나는지 하나의 리포트로 보여준다.**

```text
FREE      한 관찰 안에서 깊게 본다.        축마다 한 행 · 한 시점 · 한 판정
PREMIUM   서로 다른 관찰을 연결해 본다.     주제마다 한 Chapter · 여러 자료 · 근거 공개
```

이 버전이 바꾼 것은 **가치 정의가 아니라 그 가치의 렌더 단위**다. v1.26이 세운
"Premium이 파는 것은 연결이다"는 그대로이고, 그 연결을 **주제 단위로 묶어 리포트처럼
읽히게** 만들었다.

⚠️ **AI가 이 계약의 주체가 아니다.** `AI_OUTPUT ⊆ DETERMINISTIC_EVIDENCE`는 v1.27부터
그대로다 — Chapter의 존재·제목·근거·순서는 전부 결정론이고 AI는 문장 하나를 덧붙인다.

⚠️ **₩1,900 = WTP HYPOTHESIS · NOT VALIDATED.** 이 QA는 "리포트가 계약을 지키는가"만
확인한다. 가격이 적정한지는 이 문서로 알 수 없다(§12).

---

## 2. Architecture Before / After

### 2.1 Audit 실측 — v1.44 코드 · 고데이터 세션 1개

`/api/dev/premium-test`로 계측했다(추측 아님).

```text
입력  Declared 5축 · Past(important 3 · hardest · selfGap · adaptive)
      Current 4축 · Target 4축 + MBTI + 관심사 2 · History 2건 · 사진 관찰 2건

insights                    12
renderedUnits               12   (core 1 · connection 7 · single note 4)
Chapter 제목                 0    모든 카드의 머리는 source 라벨 칩뿐이었다
같은 축 반복                 contact ×4 · conflict ×4 · alone ×3
리포트 안 중복               cs_history_change_* 3건이 singleSourceNotes와
                            historyDeep 섹션에 **둘 다** 나왔다
죽은 필드                    overview.topSummaries — 계산되고 화면에 그려지지 않았다
헤더 숫자 vs 화면 개수        `연결 8개` vs 실제 유닛 12개  ← 서로 달랐다
Provider 호출                1  (이미 목표를 만족하고 있었다)
```

**결론: 문제는 '얇다'가 아니라 '구조가 없다'였다.** 12개는 적은 수가 아닌데 제목도
순서도 묶음도 없어서 리포트가 아니라 카드 더미로 읽혔다.

### 2.2 Layer 표

| Layer | File / Symbol | 현재 역할 | v1.44 Output(고데이터) | Evidence | AI | FREE 중복 | v1.45 |
|---|---|---|---:|---|---|---|---|
| Engine | `logic/crossSourceInsights.buildCrossSourceInsights` ①~⑨ | 9개 조합에서 Insight 생성 | 12 | `EvidenceRef` | ✗ | 축 기준 11/12 | **재사용** (⑤ 시제만 수정) |
| Rank | 같은 파일 `rankInsights` | type → strength 정렬 | — | — | ✗ | — | **재사용** |
| Gate | `services/premiumConnections.hasDeepConnection` | source 2종 + ref 2개 | true | — | ✗ | — | **재사용** |
| Connection | `premiumConnections.buildConnections` | Insight → 화면 블록 | 12 | resolve | narrative 부착 | — | **재사용** (Chapter의 입력) |
| **Chapter** | `logic/premiumChapters.buildPremiumChapters` | Insight를 주제로 묶는다 | — | — | ✗ | **게이트 신설** | **NEW** |
| Assemble | `services/premiumService.buildRelationshipDeepReport` | 리포트 조립 | 8 섹션 | — | ✗ | — | `chapters`·`omissions` 추가 |
| UI | `premium/RelationshipDeepReportView` | 평면 카드 나열 | 6 섹션 | — | — | — | **Accordion 재구성** |
| UI | `premium/PremiumChapterAccordion` | Chapter 한 개 | — | 2~3 + 접기 | 문단 | — | **NEW** |
| UI | `premium/DeepInsightVerdict` | 관찰 되묻기 | — | — | — | — | **NEW** (분리) |
| AI | `ai/handlers.runDeepReportTask` | Provider 1회 | 12 items | `insight-subset` | ✓ | — | **무변경** |

### 2.3 v1.45 Output 실측

| Fixture | insights | chapters | 축 분포 | omissions |
|---|---:|---:|---|---:|
| PREM-V2-01 Full Dating | 12 | **8** | 연락 · (연락·개인시간) · 갈등 · 애정 · 개인시간 · 파생 · 갈등 · 파생 | 0 |
| PREM-V2-02 No History | 8 | 8 | + 확인되지 않은 것 · 시점 비교 Chapter 없음 | 1 |
| PREM-V2-03 No Current | 10 | 6 | 지금 관계 group 0 | 2 |
| PREM-V2-04 No Target | 10 | 7 | target/compatibility group 0 | 1 |
| PREM-V2-05 Sparse | 0 | **0** | — | 3 |
| PREM-V2-06 Ended | 12 | 8 | 01과 동일 · 제목만 회고형 | 0 |

**같은 축 최대 반복: 4회 → 2회.** 같은 축의 Insight들이 하나의 Chapter로 묶이면서
그 축의 다른 Insight가 그 Chapter의 **근거**가 됐기 때문이다 — 삭제가 아니라 승격이다.

**STATICALLY VERIFIED** (표) · **VERIFIED** (실측 수치, `npm run test:premium`)

### 2.4 삭제한 것

| 대상 | 왜 |
|---|---|
| `components/premium/DeepConnectionCard.tsx` | 렌더 단위가 Chapter로 바뀌어 호출부가 0이 됐다. 안에 있던 `맞아/조금 달라/잘 모르겠어`는 **삭제하지 않고** `DeepInsightVerdict`로 분리했다 — v1.26 주석이 경고한 "유일한 호출부가 사라질 뻔했다"가 두 번째로 온 자리다 |
| 리포트 본문의 `historyDeep` 독립 섹션 | `past_and_now` Chapter가 같은 비교를 담는다. 두 자리에 두면 v1.26이 두 섹션을 삭제한 이유를 그대로 반복한다 |
| Paywall의 정적 `additions` 목록(Deep Report만) | Chapter 목록이 같은 질문에 더 정확히 답한다(§10) |

---

## 3. Chapter Candidate Matrix

| # | kind | 제목 | 필수 근거 | 렌더 순서(§10) | Full | Sparse |
|---|---|---|---|---:|:-:|:-:|
| CH01 | `declared_vs_shown` | 말한 나와 관계에서 나타난 나 | `declared_me` + (`past`\|`current`\|`observed`\|`lens`) | 1 | ✅ | ✗ |
| CH03 | `closeness_distance` | 가까워지는 방식과 거리를 두는 방식 | contact **와** alone 두 축 모두 | 2 | ✅ | ✗ |
| CH02 | `hidden_priority` | 생각보다 더 중요했던 기준 | `relationship:hardest\|important` + `declared_me` | 3 | ✗ | ✗ |
| CH04 | `conflict_needs` | 갈등이 생겼을 때 내가 원하는 것 | conflict 축 · 2 group | 4 | ✅ | ✗ |
| CH05 | `affection_exchange` | 애정을 주고받는 방식 | affection 축 · 2 group | 5 | ✅ | ✗ |
| CH06 | `tune_with_target` | 이 사람과 특히 맞춰봐야 하는 지점 | `target`\|`compatibility` + `score !== null` | 6 | ✅ | ✗ |
| CH07 | `uncertainty` | 아직 확신하면 안 되는 지점 | 서로 다른 불확실성 **2건 이상** | 7 | ✗ | ✗¹ |
| CH08 | `next_check` | *(Job별 문구)* | 앞 Chapter ≥1 + action\|question ≥1 | 8 | ✅ | ✗ |
| CH09 | `past_and_now` | 과거의 나와 지금의 나 | history 2건 **또는** current×past | 9 | ✅ | ✗ |
| CH10 | `closing` | 러비가 이번 관찰에서 기억할 한 문장 | 근거 Chapter ≥2 + lovyObservation | 10 | ✅ | ✗ |

¹ Sparse에서 CH07이 만들어지지 않는 이유는 §11 참고(연결이 0이면 Chapter를 아예 만들지 않는다).

⚠️ **CH02가 Full 세션에서 만들어지지 않은 것은 결함이 아니다.** 그 세션의 Mirror 근거는
전부 `evidenceScope: 'current'`(지금 관계)라 `relationship:hardest|important`(과거 경험)
ref가 걸린 Insight가 `cs_reltarget_contact` 하나뿐이었고, 그건 CH03이 먼저 가져갔다.
**근거가 없으면 Chapter도 없다** — 이 표가 그것을 보여주는 것이 목적이다.

### 3.1 §10 순서를 따랐고, 티어 안의 순서는 우리가 정했다

§10은 CH02~CH05를 하나의 티어('relationship evidence')로 묶는다. 그 안에서
`closeness_distance`를 **먼저** 고른다 — 두 축을 동시에 요구해서 가장 만들기 어렵고,
뒤로 밀면 단일 축 Chapter가 축을 먼저 소진해 영원히 만들어지지 않는다.
(실측: 처음에는 contact가 CH01·CH02에 연달아 잡혀 CH03이 통째로 사라졌다.)

---

## 4. Evidence Boundary

### 4.1 Source Group — 같은 곳을 두 번 세지 않는다

| Group | 포함하는 `CrossSourceEvidenceSource` | 라벨(화면 어휘와 동일) |
|---|---|---|
| `declared_me` | `declared` · `adaptive` · `deep_followup` · `user_correction` | 내가 답한 기준 |
| `observed_me` | `observed` | 사진 관찰 |
| `past_relationship` | `relationship` | 관계 경험 |
| `current_relationship` | `current_relationship` | 지금 관계 / **그때 이 관계**(former) |
| `target` | `target` | 상대 정보 |
| `compatibility` | `compatibility` | 동기화율 비교 |
| `history` | `history` | 과거 관찰 |
| `lens` | `mbti_lens` | 성향 렌즈 |

⚠️ `declared`·`adaptive`·`deep_followup`이 한 그룹인 이유: 전부 '내가 답한 것'이라
서로 독립적인 근거가 아니다. 따로 세면 Chapter가 "자료 4종을 이었다"고 말하면서
실제로는 같은 설문 한 벌만 본 것이 된다.

⚠️ `mbti_lens`를 `observed_me`에 합치지 않았다. MBTI는 동기화율에 들어가지 않는
Supporting Lens이고(v1.2에서 철회), 합치면 '관찰된 나'의 근거 수가 부풀어 보인다.

⚠️ 라벨은 `premiumSourceGroupLabel()`이 `SOURCE_LABEL`을 되돌려 쓴다 — 어휘를 두 벌
만들지 않았고, **시제 처리가 자동으로 따라온다.**

### 4.2 §8 독립 근거 2종 규칙과 그 예외

기본: Chapter는 서로 다른 source group **2종 이상**을 이어야 한다.

| 예외 | 근거 |
|---|---|
| `next_check` · `closing` | §8이 명시한 예외 — 앞 Chapter에서 파생된다 |
| `uncertainty` | **§8에 없는 예외다.** 이 Chapter의 주제는 근거의 **부재**라서 "없다는 것을 근거 2개로 증명하라"는 요구가 성립하지 않는다. 대신 같은 정신을 지킨다 — **서로 다른 종류의 불확실성 2건 이상**일 때만 만든다. 1건이면 리포트 하단 `limitations` 한 줄로 충분하다 |
| `past_and_now` | **완화가 아니라 정확한 적용이다.** 이 Chapter가 이은 것은 서로 다른 시점에 저장된 두 관찰이고 그 둘은 실제로 독립적이다(서로를 참조하지 않는다). 그룹 표는 출처의 *종류*를 세는 도구라 같은 종류 안의 두 시점을 1로 접는데, 시점 비교에서는 그 두 시점이 연결의 실체다. 그룹만 보고 자르면 **History 2건 이상일 때만 만들어지는 Chapter가 History 때문에 사라진다**(실측으로 재현). 완화 범위는 좁다 — `past_and_now`에서만, **서로 다른 기록 id 2개 이상**일 때만 |

### 4.3 FREE 중복 게이트 — `isFreeDuplicate()`

무료 `/mirror`가 축마다 보여주는 것은 정확히 셋이다: `declared` + (`relationship`|`current`) + 판정.
그래서 Premium Chapter가 **같은 축에서 그 셋만** 갖고 있으면 유료에서 다시 파는 것이다.

```text
실측: cs_mirror_conflict = MATCH · [declared, current_relationship]
      무료 Mirror의 conflict 행 = MATCH · scope=current
      → 글자 그대로 같은 정보. Chapter의 주인공에서 제외한다.
```

⚠️ **제외된 Insight를 버리지 않는다.** 다른 Chapter의 **근거**로는 그대로 쓰인다.
무료와 같은 판정이라도 다른 축·다른 시점과 나란히 놓이면 그 자리에서는 새 정보다.

⚠️ `past` + `current` 둘 다 가진 Insight는 중복이 아니다 — 무료 Mirror는 축마다
**한 시점만** 보여준다(v1.41 §39.18).

### 4.4 축 반복 상한

`MAX_CHAPTERS_PER_AXIS = 2`. 상한은 목표가 아니라 상한이므로, **아직 쓰이지 않은 축을
먼저 고른다** — 상한만 두고 순위대로 집으면 가장 강한 축이 앞 Chapter 두 개를 연달아
차지한다(실측: `연락 | 연락`).

---

## 5. AI Contract

### 5.1 PromptVersion — **올리지 않았다**

```text
deep-report-v4-tense   (v1.43 §47.5)  →  변경 없음
```

**근거:** 이번 작업에서 **모델이 받는 것과 돌려주는 것이 하나도 바뀌지 않았다.**

| 차원 | v1.44 | v1.45 |
|---|---|---|
| `DeepReportContext` 필드 | `tense` + insights[id·type·axis·sources·evidence·strength·allowedConnection·limitation] | 동일 |
| System Prompt | `DEEP_REPORT_SYSTEM_PROMPT` | 동일 |
| 응답 스키마 | `DeepNarrative[]` (insightId 단위) | 동일 |
| 근거 검사 | `insight-subset` (`refsWithinAllowed`) | 동일 |
| Provider 호출 | 1회 | 1회 |
| 캐시 키 | `task::promptVersion::fingerprint` | 동일 |

즉 §11의 "UI만 바뀌고 기존 schema를 그대로 쓴다면 bump하지 않는다"에 해당한다.
버전을 올리면 정상 캐시가 전부 무효화되고 `test:ai` 508건의 기대값이 흔들리는데,
얻는 것이 없다.

**§11.2가 요구한 것은 이미 더 강하게 충족돼 있다.** AI 계약의 단위는 Insight이고
Chapter는 Insight의 결정론적 묶음이므로:

```text
narrative.evidenceRefs ⊆ 그 insight의 refs        (v1.27부터 강제)
chapter.allowedRefs     = 그 chapter의 insight refs 합집합
∴ narrative의 근거는 항상 그 chapter의 허용집합 안이다
```

Chapter A의 문장이 Chapter B에 붙는 것도 **구조적으로 불가능하다** —
`buildConnections`가 `insightId === insight.id`로만 짝짓는다. PREM-V2-09가 실측한다.

**STATICALLY VERIFIED** (표) · **VERIFIED** (`test:ai:e2e` 6/6 · `promptVersion: deep-report-v4-tense`)

### 5.2 Provider Call Budget

```text
Chapter 8개 → Provider 호출 1회
```

dev 서버 로그 실측(전 세션 누적 9회 = 페이지 로드 9회):
```text
[ai] deep-report-narrative filter tense=current raw=5 parsed=5 refChecked=5 safe=5 novel=4
 POST /api/ai/deep-report-narrative 200 in 6909ms
```

Chapter마다 호출하지 않는다. **VERIFIED**

### 5.3 Chapter의 AI 문장

- `chapter.narrativeText` = 그 Chapter의 Insight들의 `interpretation`, **최대 2문단**
- 규칙 문장(`deterministicSummary`)을 **대체하지 않고** 아래에 덧붙는다
- `AI 설명` 라벨은 **화면에 AI 문장이 실제로 그려질 때만** 붙는다(v1.27/v1.28 규칙 계승)

---

## 6. Test Cases — `npm run test:premium` (196 checks, ALL PASS)

| ID | 검사 | 결과 |
|---|---|:-:|
| PREM-V2-01 | Chapter 7~10 · core chapter groups ≥2 · 축 반복 ≤2 · source 7종 · Provider 1회 · 금지 표현 0 · **강조/질문/본문 중복 0**(§27) | ✅ 10/10 |
| PREM-V2-02 | History 없음 → 시점 비교 Chapter 0 · history group 0 · omission 명시 | ✅ 4/4 |
| PREM-V2-03 | Current 없음 → current group 0 · past 기반 연결 유지 · omission 명시 | ✅ 4/4 |
| PREM-V2-04 | Target 없음 → tune Chapter 0 · target/compatibility group 0 | ✅ 3/3 |
| PREM-V2-05 | Sparse → filler 0 · 파생 Chapter 0 · omission ≥2 · 가짜 개수 0 | ✅ 5/5 |
| PREM-V2-06 | Ended → outward Chapter 0 · outward question 0 · 현재형 0 · 금지 행동 0 | ✅ 7/7 |
| PREM-V2-07 | AI 실패 → Chapter 수 유지 · AI 문장 0 · 결정론 본문/강조/경계 존재 | ✅ 4/4 |
| PREM-V2-08 | AI parse 실패(알 수 없는 insightId) → 어느 Chapter에도 붙지 않는다 | ✅ 3/3 |
| PREM-V2-09 | 다른 Chapter 근거 → 문장이 정확히 1개 Chapter에만 붙는다 | ✅ 3/3 |
| PREM-V2-10 | 시점 비교 근거 없음 → 변화 주장 0 | ✅ 3/3 |
| PREM-V2-11 | 무료와 같은 축·판정·근거만 → Chapter 0 · 무료 행은 그대로 | ✅ 2/2 |
| PREM-V2-12 | 헤더 N = Chapter 수 · index 1..N · id/noveltyKey 중복 0 | ✅ 8/8 |
| PREM-V2-13 | Accordion A11y 정적 guard(7항목) | ✅ 8/8 |
| PREM-V2-14 | `premium_chapter_open` property 4종 · 원문 7종 미전송 | ✅ 13/13 |
| PREM-V2-15 | dev 라우트 404 · Preview 게이트 · Fake Door 기본값 · 우회 parameter 0 | ✅ 7/7 |

⚠️ **1차 판정은 전부 구조화된 값**(Chapter 수 · group 수 · `audience` · `insightIds`)이고
금지 어휘 스캔은 2차 guard로만 쓴다 — v1.40.1이 배운 순서 그대로다.

⚠️ **기존 suite에 Premium 수백 건을 섞지 않았다**(§24). 대신 `lifecycle-test` 라우트의
`renderedStrings`에 **Chapter 문자열을 추가**했다 — 그래서 `test:lifecycle`(144)과
`test:relationship-evidence`(280)의 `ended` 금지 어휘 스캔이 새 자리까지 자동으로 덮는다.

---

## 7. Browser Journeys — 실측

`NEXT_PUBLIC_PREMIUM_PREVIEW=true` · `NEXT_PUBLIC_UT_MODE=true` · `AI_MODE=real`
세션은 앱과 같은 형식(`lym.session.v1` · `lym.history.v1`)으로 seed했다.

### Journey A — Full Dating (Paywall → Unlock → Report)

```text
/premium?source=compatibility
  이번 리포트에서 볼 수 있는 것   8개   ← 실제 Chapter 제목 8줄
  미리 보기 3개 · 잠긴 항목 3개 · ₩1,900 · 구독 아님
CTA 클릭
  PRECISION REPORT / 이야기 8개를 연결한 관찰 기록 / 이은 자료 7종 / 2026.09.10 작성
  러비가 이번 관찰에서 연결한 이야기 8개
  이번 리포트에서 가장 중요한 연결 (01·02·03)
  관계 연결 리포트  전체 8개
    01/8 연락            말한 나와 관계에서 나타난 나        자료 4종  (열림)
    02/8 연락·개인 시간   가까워지는 방식과 거리를 두는 방식   자료 5종
    …
    08/8 마무리          러비가 이번 관찰에서 기억할 한 문장
  '결제가 완료됐어' 문구 없음
```

첫 Chapter 본문(AI 도착 후, 약 7~10초):
```text
근거   동기화율 비교 · 연락 방식 — 나: 연락 중요도 5/5 · 상대: 뜸한 편
       내가 답한 내용 · 연락 중요도를 5점 중 5로 답했어
       지금 관계 · 연락에 대해 지금 관계에서 '바로 알아차리고 마음이 쓰여'라고 답했어
       [근거 2개 더 보기]
본문   지금 상대와 연락 방식에서 차이가 보이는데 … (규칙)
       이전 관찰 2번에서도 연락 관련 신호가 있었어. (규칙)
       지금 상대와 연락 방식에서의 차이가 보이고 … (AI)
강조   결국 이번 연결에서 중요한 건 연락이야 — 따로 답한 자료 4종이 서로 다른 방향을 가리켰어.
확인   연락이 줄었을 때, 너한테는 단순히 바쁜 거랑 마음이 멀어진 거랑 어떻게 달라?
경계   과거 관찰과 지금이 같은 축을 가리킨다는 것까지야. 과거가 지금의 원인이라고는 말할 수 없어.
되묻기 맞아 / 조금 달라 / 잘 모르겠어
```

**FREE → PREMIUM 가치 차이가 육안으로 명확하다** — 무료는 축마다 한 행이고, 여기는
주제마다 자료 4~5종이 근거와 함께 묶여 있다. **VERIFIED**

### Journey B — Ended

8개 Chapter 전부 펼쳐 `main` 전체 텍스트를 스캔했다.

```text
outward Chapter        0   (audience 전부 self)
outward question       0   ('확인해볼 것' 섹션 자체가 없다)
현재형 호칭             0   (지금 상대 · 지금 관계 · 지금 이 관계 · '지금 ')
금지 행동 제안          0   (다시 연락 · 먼저 연락 · 다가가 · 고백 · 재회 · 관계를 회복 · 호감을 표현)
제목 회고형 전환        05 그때 서로 기대가 달랐던 지점 / 06 그래서 뭐가 남았을까 / 07 그때의 나와 지금의 나
Chapter 수              8   (dating과 같다 — 회고라고 리포트가 얇아지지 않는다)
```

**VERIFIED**

### Journey C — Sparse

```text
아직 연결해서 볼 수 있는 신호가 부족해
관계 경험이나 상대 정보가 더 쌓이면 연결해서 볼 수 있는 게 늘어나.
· 관찰 기록이 한 번 더 쌓이면, 기준이 실제로 움직였는지 볼 수 있어.
· 지금 관계에 대한 답이 쌓이면, 이전의 나와 지금의 나를 나란히 놓고 볼 수 있어.
· 상대에 대해 아는 것을 조금 더 채우면, 네 기준과 상대 쪽을 이어서 볼 수 있어.
```

짧지만 정직하다. filler Chapter 0개. **VERIFIED**

### Journey D — History 2+

`past_and_now` Chapter가 `07/8 갈등 해결 · 과거의 나와 지금의 나 · 자료 2종`으로
등장했다. History 0건(PREM-V2-02)에서는 이 Chapter가 사라진다. **VERIFIED**

### Journey E — AI Fail (실제 500)

`/api/ai/deep-report-narrative`만 500으로 떨어뜨렸다.

```text
차단된 호출          1
Chapter             8   (하나도 사라지지 않았다)
'AI 설명' 라벨        없음  ← 없는 것을 있다고 표시하지 않는다
실패 안내            "러비가 설명을 정리하지 못해서 확인된 신호만 보여주고 있어." + [다시 시도]
결정론 본문·강조      존재
```

**VERIFIED**

---

## 8. Responsive

`/premium-preview/relationship_deep_report` · Full Dating 세션

| 크기 | 가로 overflow | header hit area | 제목 줄 수 |
|---|---:|---:|---:|
| 360×800 | 0 | 64px | 1 |
| 375×812 | 0 | 64px | 1 |
| 393×852 | 0 | 64px | 1 |
| 430×932 | 0 | 64px | 1 |
| 768×1024 | 0 | 64px | 1 |
| 1280×800 | 0 | 64px | 1 |

- `overflow: visible`인데 내용이 넘치는 노드: 0개
- 마지막 Chapter까지 렌더된다(1280 확인)
- sticky/fixed 요소가 본문을 가리지 않는다 — footer는 `ScreenLayout`의 고정 영역이고
  본문은 그 위에서 스크롤된다(v1.20 골격 그대로)

**VERIFIED**

---

## 9. Analytics

### 9.1 새 이벤트는 **하나뿐이다**

```text
premium_chapter_open   properties: chapter_kind · chapter_index · chapter_total · source_group_count
```

§18이 최소로 요구한 4개 중 3개는 **만들지 않았다.** 같은 것을 이미 보내고 있다:

| §18 요구 | 대체 | 근거 |
|---|---|---|
| `premium_report_view` | `deep_report_view` (`insight_count` = Chapter 수) | 의미가 같다. v1.26이 세는 대상을 옮긴 것과 같은 종류의 변경(§45) |
| `premium_report_half_reached` | `deep_report_scroll` `depth=50` | v1.10 §49가 이미 50/100 두 단계로 정의했다 |
| `premium_report_end_reached` | `deep_report_scroll` `depth=100` · `deep_report_complete` | 완독 정의는 '다 봤어' CTA다(v1.10 §48) |

이름만 다른 이벤트를 늘리면 Funnel의 분모가 두 벌이 된다(v1.10 §47).

⚠️ **관측 공백을 하나 만들었고, 그것을 이 이벤트가 메운다.** Accordion 때문에 Chapter가
하나만 열려 있으면 스크롤 컨테이너가 스크롤되지 않아 `deep_report_scroll`이 발생하지
않을 수 있다. 읽기 진행은 `chapter_index` / `chapter_total`(열린 최대 index)로 보는 편이
깊이보다 정확하다.

### 9.2 재사용한 이벤트

| 이벤트 | 새 호출부 |
|---|---|
| `deep_insight_evidence_expand` | Chapter의 `근거 N개 더 보기` (property: `insight`·`axis`=kind·`evidence_count`·`source_count`) |
| `deep_insight_feedback` · `deep_insight_correction_submit` | `DeepInsightVerdict` (키는 여전히 **Insight id**) |

### 9.3 Privacy

전송하지 않는 것: raw answer · free text · MBTI 값 · relationship note · `coreCorrection`
· AI narrative 본문 · evidence text · Chapter 제목·본문·강조·질문·경계.

PREM-V2-14가 `trackEvent('premium_chapter_open')` 블록을 정적으로 훑어 7개 금지 표현이
없음을 확인한다. **STATICALLY VERIFIED**

⚠️ 가격 반응은 앱 analytics에 넣지 않는다 — `would_pay_1900=true` 같은 이벤트를
만들지 않았다. UT 인터뷰에서 수집한다.

---

### 9.4 Copy Quality Audit (§27)

fixture 8종(`full` · `ended` · `noHistory` · `noCurrent` · `noTarget` · `sparse` ·
`longTerm` · `talking`)의 **모든 Chapter를 펼친 상태의 렌더 문자열 전부**(세션당 82~100줄)를
모아 훑었다.

| 검사 | 결과 |
|---|:-:|
| §27 금지 패턴 13종 (`너는 사실` · `원래 너는` · `상대는 분명` · `운명` · `천생연분` · `무조건` · `확실히` · `치유` · `극복했다` …) | **0건** |
| AI스러운 일반론 (`~할 수 있습니다` · `일반적으로` · `대부분의 사람은` · `전문가들은`) | **0건** |
| 같은 강조 문장 반복 | **0건** |
| 같은 본문 반복 | **0건** |
| FREE 문장 그대로 재사용 | **0건** (`isFreeDuplicate` + PREM-V2-11) |

### 인과·예측 어휘 — 전부 부인 문맥이었다

`때문에` · `원인이`가 걸렸는데 **전부 경계 문장 안이었다.**

```text
과거 관찰과 지금이 같은 축을 가리킨다는 것까지야. 과거가 지금의 원인이라고는 말할 수 없어.
서로 다른 시점에 답한 두 내용을 나란히 놓은 것까지야. … 무엇 때문에 달라졌는지도 정하지 않아.
```

§27이 명시한 오탐 구분(`Context에 따라 부인 문구가 있으면 오탐 구분`)에 해당한다.
인과를 **주장하는** 문장은 0건이다.

### 실측으로 잡은 중복 1건 — 고쳤다

```text
연락이 줄었을 때, 너한테는 단순히 바쁜 거랑 마음이 멀어진 거랑 어떻게 달라?   ×2
  ① 그 축 Chapter의 `확인해볼 것`
  ② CH08 `그래서 뭘 맞춰볼까` 목록
```

같은 역할의 문장을 두 번 보여주는 것은 v1.26이 두 섹션을 삭제하면서 세운 기준을 그대로
어기는 것이다(§22). CH08은 이제 **어느 Chapter에도 붙지 못한 질문만** 담는다 — 버리는
것이 아니라 한 자리로 모은다. PREM-V2-01이 회귀를 고정한다.

### 남긴 중복 2종 — 이유가 있다

| 중복 | 왜 남겼나 |
|---|---|
| 같은 `limitation`이 Chapter 2~3개에 반복 | **경계는 그 주장과 항상 함께 있어야 한다**(v1.27). 첫 Chapter에만 붙이면 나머지 Chapter는 경계 없는 주장이 된다. Accordion 기본 상태에서 한 Chapter만 열려 있어 두 개가 동시에 보이는 경우는 드물다 |
| 같은 근거 한 줄이 Chapter 2개에 인용 | 같은 사실이 **서로 다른 두 연결**을 실제로 뒷받침하는 경우다(예: `compatibility:alone`이 CH03과 CH06 양쪽의 근거). 인용을 지우면 그 Chapter가 근거 없이 말하게 된다. 각 근거 목록은 자기 Chapter 패널 안에 접혀 있다 |

⚠️ 이 두 종류를 fixture가 **실패로 잡지 않는다**(의도된 동작이므로). 대신 강조·질문·본문
세 자리의 중복만 0으로 고정한다 — 그 셋은 어떤 경우에도 반복될 이유가 없다.

---

## 9.5 캐릭터 통합 — 러비의 진행자 역할 (v1.45)

### 9.5.1 왜 했나 — 실측

Chapter Engine이 들어간 뒤에도 남은 문제는 분량도 구조도 아니었다.

```
헤더           '러비가 이번 관찰에서 연결한 이야기 8개'   ← 러비는 글자로만 있었다
Chapter 8개    캐릭터 0개
강조 문장       '결국 이번 연결에서 중요한 건 X이야 — 따로 답한 자료 N종이 …' ×5
               (리포트 요약이 상위 3개를 나란히 보여줘서 세 줄 연속으로 보였다)
Closing        접힌 아코디언 한 줄 — '기억한다'는 역할이 시각적으로 0
```

즉 **'잘 만든 관계 분석 리포트'로는 읽히는데 '러비가 관찰해서 만든 것'으로는 읽히지
않았다.**

### 9.5.2 Character Asset Audit — 38장을 실제로 열어 봤다 (§36)

`docs/캐릭터`에는 38장이 있었다. 파일명으로 판단하지 않고 contact sheet를 만들어 전부
보았다. 그리고 **가장 중요한 발견은 절반이 이미 앱에 있었다는 것이다**:

```
1.png → hero      2.png → observe   3.png → record    4.png → laptop
5.png → question  6.png → heart     7.png → chart     8.png → movie
9.png → mug      10.png → cool     11.png → calendar 12.png → book
13.png → crystal 14.png → wand
                                    ← SHA-256 14/14 일치 (public/lovy/*.png)
```

즉 새 재료는 오늘 추가된 24장뿐이었다. 그중 **기존 14종으로 표현되지 않는 5장만**
가져왔다.

| runtime | 원본 | 무엇인가 | 왜 골랐나 |
|---|---|---|---|
| `lovy-connect.png` | `…03_33_17 (3).png` | 자료 뭉치를 모아 정리하는 러비 | **기존 14종에 '연결하는' 그림이 없었다.** 이 리포트가 파는 행동 자체 → 헤더 |
| `lovy-ponder.png` | `…03_38_56 (12).png` | 컵 + 생각풍선 | 기존 `mug`에는 생각풍선이 없다. '아직 결론을 내리지 않았다'를 그림으로 말할 수 있는 유일한 것 |
| `lovy-notice.png` | `…03_38_57 (14).png` | 전구를 띄운 러비 | '알아챘다'가 기존 14종에 없었다 |
| `lovy-together.png` | `…03_38_59 (20).png` | 마음이 적힌 종이를 든 러비 | 기존 `heart`는 하트를 **껴안는다**. 애정 표현을 *기록*으로 보는 자리에는 종이가 맞다 |
| `lovy-note.png` | `…03_38_52 (6).png` | 수첩에 적는 러비 | Closing 96px용. header(`record` 클립보드)와 **다른 포즈**여야 한다(§25) |

**쓰지 않기로 한 것과 이유:**

| 후보 | 왜 안 썼나 |
|---|---|
| 축하 · 엄지척 · 컨페티 (C9 · C13 · C21) | 이 리포트에는 축하할 결과가 없다. 특히 `ended`·Sparse에서는 조롱이 된다 (§28 · §29) |
| 자물쇠 + 열쇠 (C2) | '결제하면 열린다'를 그림으로 약속하게 된다. 이 화면은 Fake Door다 (§15) |
| 상장 · 인증서 (C1) | 이 리포트가 갖고 있지 않은 **'검증된 판정'**을 암시한다 |
| 왕관 + 다이아 (C4) | 관찰이 아니라 등급을 판다. badge overload (§13) |
| 벽 뒤에서 엿보는 러비 (C10) | **상대를 몰래 관찰하는 것**으로 읽힐 수 있다. 이 제품은 상대 속마음을 읽지 않는다 |
| 작은 친구를 안고 있는 러비 (C8) | 그 작은 친구가 '상대'로 읽힌다. 관계를 응원하는 그림이 된다 |
| 점 · 운세 계열 (`crystal` · `wand`) | 사주/운세식 결과 금지 (§1) |
| 울음 (C22) · 헤드폰 (C16) · 망원경 (C6) 등 | 자리와 맞지 않거나 기존 포즈와 겹친다 |

원본 폴더는 **수정 · 삭제 · rename 없음**, runtime은 **exact copy**(SHA-256 5/5 일치,
재인코딩 0).

### 9.5.3 Chapter → 러비 매핑 (kind 10종 ↔ 포즈 10종)

| Chapter | 포즈 | 출처 | 이유 |
|---|---|---|---|
| `declared_vs_shown` | `observe` | 기존 | 말한 것과 나타난 것을 나란히 들여다본다 |
| `closeness_distance` | `ponder` | 신규 | 따로 물어본 두 기준을 같이 놓고 생각한다 |
| `hidden_priority` | `notice` | 신규 | 먼저 꼽은 기준과 실제 경험이 만난 것을 알아챘다 |
| `conflict_needs` | `mug` | 기존 | 방식을 본다 — 감정을 얹지 않는다 |
| `affection_exchange` | `together` | 신규 | 표현을 **기록**으로 든 모습 |
| `tune_with_target` | `chart` | 기존 | 점수가 아니라 어디가 다른지 |
| `uncertainty` | `question` | 기존 | 빈칸을 빈칸으로 남겨둔다 |
| `next_check` | `laptop` | 기존 | 관찰 계열(§6) |
| `past_and_now` | `book` | 기존 | 기록끼리 비교한다 |
| `closing` header | `record` | 기존 | 클립보드 |
| `closing` 본문 96px | `note` | 신규 | 수첩에 적는 모습 |
| 리포트 헤더 84px | `connect` | 신규 | 흩어진 자료를 모은다 |
| 중간 메모 64px | `record` | 기존 | 기록 계열 |
| Paywall | `chart` | 기존 | **바꾸지 않았다** (§9.5.7) |

### 9.5.4 Trust Boundary — 표현 계층은 분석 계층이 아니다

`lib/premiumLovy.ts`의 입력은 `PremiumChapter.kind`와 `RelationshipTense` **둘뿐이다.**
`evidence` · `insightIds` · `narrativeText`의 **내용을 읽지 않는다.**

| | AI가 만드는가 | 사용자 답을 읽는가 | 새 근거를 만드는가 |
|---|:-:|:-:|:-:|
| `deterministicSummary` · `deterministicTakeaway` | ✗ | ○ (이미 만들어진 Insight) | ✗ |
| `narrativeText` | ○ | — | ✗ (`allowedEvidenceRefs`) |
| **러비 한마디 · 연결 이유 · 중간 메모** | **✗** | **✗** | **✗** |

fixture가 이것을 값으로 고정한다 — 같은 `kind`면 세션이 달라도 같은 문장이고(LOVY-05),
AI 프롬프트·context에 이 모듈이 등장하지 않는다(LOVY-11).

⚠️ 이 분리 덕분에 **AI가 죽어도 캐릭터 층은 그대로다** — §9.5.8에서 실제 장애로 확인했다.

### 9.5.5 §20 Chapter 중복 실측 — 강조 문장의 틀을 나눴다

한 틀을 모든 Chapter가 쓰고 있었다. 틀을 `kind`별로 나눴고, **방향 절(`direction`)은
여전히 `type`에서만 나온다** — 틀에 판정을 넣으면 실제 type이 다를 때 문장이 거짓이 된다.

fixture 8종에서 축 · 근거 · source group · 강조 · 질문 5개 중 **3개 이상이 같은 Chapter 쌍**:

| fixture | Chapter | 중복 후보 | 강조 문장 고유 | 강조 '틀' 고유 |
|---|--:|--:|--:|--:|
| `full` | 8 | **0** | 8/8 | 7/8 |
| `ended` | 8 | **0** | 8/8 | 7/8 |
| `noHistory` | 8 | **0** | 8/8 | 7/8 |
| `noTarget` | 7 | **0** | 7/7 | 6/7 |
| `noCurrent` | 6 | **0** | 6/6 | 5/6 |
| `longTerm` | 8 | **0** | 8/8 | 7/8 |
| `talking` | 8 | **0** | 8/8 | 7/8 |
| `sparse` | 0 | — | — | — |

재편 전 `full`의 틀 고유는 **1/8**이었다.

한 리포트 안에서 러비 한마디는 **8/8 고유**, 연결 이유는 **6/6 고유**, 포즈는 **8/8 고유**.

### 9.5.6 §35 Copy Audit — 791줄

fixture 8종의 노출 문구 전부(러비 한마디 · 연결 이유 · 중간 메모 · 헤더 · Closing 포함).

| 검사 | 결과 |
|---|:-:|
| §27/§19 금지 어휘 16종 (`너는 사실` · `상대는 분명` · `운명` · `무조건` · `확실히` · `진짜 네 마음` · `알고 있어` …) | **0건** |
| AI스러운 일반론 (`할 수 있습니다` · `일반적으로` · `대부분의 사람은` · `전문가들은`) | **0건** |
| 미래 확정 (`앞으로 ` · `분명 ` · `틀림없`) | **0건** |
| 상대 속마음 추정 (`상대의 속마음` · `상대는 아마` · `상대가 원하는 건`) | **0건** |

**러비의 말투** — 전부 `같이 놓고 봤어` · `여긴 아직 모르겠어` · `세지 않았어` ·
`남겨둘게` · `적어둘게` 계열이고, `알고 있어` 계열은 **0건**이다(§35).

⚠️ **실측에서 고친 것 1건** — `ended`의 `tune_with_target` 한마디를 처음에
`지금 맞춰보라는 얘기가 아니야`로 썼고 LOVY-09가 잡았다. 부인 문장이라 뜻은 맞지만
`ended` 금지 어휘 스캔이 오탐으로 올린다. **스캔에 예외를 추가하지 않고 문장을 고쳤다** —
예외를 만들면 `지금 `으로 시작하는 진짜 결함이 그 뒤에 숨는다.

### 9.5.7 Paywall은 바꾸지 않았다 (§27)

`/premium` Paywall에는 이미 러비가 **정확히 하나** 있었다(`<LovyMessage pose="chart"
size={52}>`), 그리고 `chart`는 §27이 요구한 관찰·기록·발견 계열이다.

리포트 헤더의 `connect`를 Paywall로 가져오지 않은 것도 의도다 — §27이 요구하는
'결제 후가 더 풍부해야 한다'는 **Paywall 1개 vs 리포트 11개**로 이미 성립하는데, 헤더
그림을 미리 보여주면 그 대비가 사라진다.

Production 실측(`NEXT_PUBLIC_PREMIUM_PREVIEW=false`): Paywall 캐릭터 **1개**(59px) ·
실제 Chapter 목차 그대로 · CTA를 누르면 `정밀 관찰 리포트는 지금 준비 중이야` +
`방금 누른 건 결제가 아니라 관심 표시로만 기록했어` · **리포트 본문은 열리지 않는다**
(Accordion header 0개).

### 9.5.8 Browser QA (§33) · Responsive (§34) · A11y

| Journey | 결과 |
|---|---|
| **Full Dating** | 이미지 **11개**(헤더 1 + Chapter 8 + 중간 메모 1 + Closing 본문 1) · 40~96px · 인접 중복 0 · 중간 메모는 CH04 뒤 · 번호는 `01/8`~`08/8`로 **메모의 영향을 받지 않는다** |
| **Ended** | Chapter 8개를 **전부 펼쳐** `main` 전체를 스캔: 금지 행동 제안 0 · 현재형 호칭 0. 안전 카피 2개가 정확히 갈렸다. 축하·엄지척·컨페티 0. 하트를 가진 이미지는 `together` 1개(40px, 종이에 그려진 하트) |
| **Sparse** | 이미지 **1개**(`question`) · `connect` 미사용 · 중간 메모 없음 · Accordion 0행 · `모르는 건 억지로 채우지 않을게.` · 과장 표현 0 |
| **AI Fail (실제 장애)** | `AI_BASE_URL`을 죽은 포트(127.0.0.1:9)로 돌려 **진짜 통신 실패**를 만들었다: Chapter **8개 유지** · 캐릭터 **11개 전부 유지** · 중간 메모 유지 · 한마디 유지 · `AI 설명` 라벨 **없음** · `통신이 끊겨서 확인된 신호만 보여주고 있어.` + `다시 시도` |

**Responsive** — 360×800 · 375×812 · 393×852 · 430×932 · 768×1024 · 1280×800에서
**모든 Chapter를 펼친 상태로** 측정: 가로 overflow **0** · viewport를 넘는 노드 **0개** ·
제목↔chevron 충돌 **0** · 근거 chip overflow **0** · 캐릭터 때문에 텍스트 폭이 과도하게
줄어든 자리 **0**.

**A11y** — Accordion header hit area **62~80px**(≥44) · `aria-expanded`/`aria-controls`
전부 존재 · 캐릭터는 **전부 `alt=""`+`aria-hidden`**(옆에 제목이 있으므로 두 번 읽지
않는다) · `prefers-reduced-motion: reduce` 환경에서 chevron 트랜지션 제거 · 높이
애니메이션 없음(조건부 렌더).

### 9.5.9 구현 중 브라우저 실측으로 잡은 내 계산 오류 2건

**① 두 kind가 포즈를 공유해서 같은 그림이 연달아 나왔다**

`tune_with_target`과 `next_check`에 둘 다 `chart`를 주고 '사이에 CH07이 있으니 안 붙는다'
고 적었다. 실제:

```
05/8 이 사람과 특히 맞춰봐야 하는 지점   chart.png
06/8 그래서 뭘 맞춰볼까                  chart.png   ← 연달아
```

**Chapter 번호는 어떤 Chapter가 실제로 만들어지느냐에 따라 밀린다.** 그 세션에는
`hidden_priority`와 `uncertainty`가 없었다. 지금은 kind 10종 ↔ 포즈 10종이고, 어느
Chapter가 빠져도 인접 중복이 생길 수 없다. fixture가 두 층에서 고정한다(kind별 포즈
유일성 + 세션별 실제 렌더 순서 검사).

**② Chapter header 크기가 §14 범위를 넘었다**

`Lovy`는 `size × LOVY_VISUAL_SCALE[pose]`로 그리는데(포즈별 여백 보정 1.0~1.16) 그것을
숫자에 반영하지 않았다. `size=44` → 실제 **44~52px**로 §14의 40~48을 넘었다.
`size=40` → **40~47px**로 맞췄다.

---

## 9.6 사용자 검토 반영 (PostReview) — 자격 불변조건 · Self-only · 체크포인트

### 9.6.1 Premium Eligibility — 최종 Product Invariant (v1.45 확정)

> **Premium eligibility must NOT depend on Experience or Target availability itself.**
>
> Experience / Target 유무는 **결과 mode와 사용할 수 있는 evidence**를 바꾸는 조건일 뿐이고,
> 최종 eligibility는 **FREE에서 이미 소비한 근거를 제외한 뒤에도 Premium에서 새롭게
> 연결·종합할 수 있는 meaningful evidence가 실제로 남아 있는지**로 결정한다.

#### ⚠️ 폐기된 해석

```
X  Experience O + Target X  →  Premium O
O  Experience/Target 상태 자체로는 차단하지 않는다.
   다만 FREE 이후 남아 있는 Premium-meaningful evidence가 없으면 unavailable일 수 있다.
```

#### 결함 2건을 실측으로 찾았다 — 양방향이었다

| | 상태 | 예전 자격 | 예전 결과 | 문제 |
|---|---|:-:|--:|---|
| **상태로 막음** | Exp X + Tgt O (declared 5축 · Target 4축 · MBTI 양쪽) | **X** | 0 | 데이터가 많은데 막혔다 |
| **상태로 막음** | declared 5축만 | **X** | 0 | 5축을 다 답했는데 막혔다 |
| **상태로 열음** | Exp O + Tgt X (과거 경험만) | **O** | 내용 **0** | **빈 리포트가 팔렸다** |

세 번째가 이 invariant 문안을 확정하게 만든 사례다. Experience가 **있다**는 상태만 보고
자격을 줬는데, 그 세션의 Insight 3개가 전부 무료 Mirror와 같은 것을 말해서
`isFreeDuplicate`가 걸렀고 남은 것이 없었다.

#### 지금 판정

```
Premium Eligibility  (hasPremiumEvidence · logic/premiumChapters.ts)
├─ cross-source : FREE 소비 근거를 제외한 뒤에도 **새 source 그룹**을 더하는 Insight 1개↑
└─ self-only    : 무료 Mirror 미생성 && declared 축 3개↑
report.available  = Chapter를 먼저 만들고 내용 Chapter가 1개 이상인지
```

#### ⚠️ 실측 — **같은 상태 안에서도 자격이 갈린다**

이 표를 '이 상태면 항상 열린다/막힌다'로 읽으면 안 된다. 같은
`Experience O + Target X`가 두 줄에 서로 다른 결과로 나온다.

| 상태 | 세션 구성 | 자격 | available | 내용 | 왜 |
|---|---|:-:|:-:|--:|---|
| Exp O + Tgt O | 현재 근거 · 기록 · 사진 · MBTI | O | O | 5 | 무료 밖 자료 다수 |
| **Exp O + Tgt X** | **현재 근거 있음** | **O** | **O** | 1 | 지금 × 이전 연결이 남는다 |
| **Exp O + Tgt X** | **과거 경험만** (E) | **X** | **X** | 0 | **남은 근거 0** |
| Exp X + Tgt O | declared 5축 + Target 4축 | O | O | 2 | Self-only |
| Exp X + Tgt X | declared 5축 | O | O | 2 | Self-only |
| Exp X + Tgt X | declared 1축 | X | X | 0 | usable evidence 부족 |

**여러 상태에서 `eligible === available`** — 어긋남 0건(POSTREV-09).

### 9.6.1a FREE 중복 판정 = 근거 단위 (Release blocker)

```
소비 = declared:<axis> + relationshipRefFor(freeRow)
남은 근거 = Insight의 ref − 소비
중복 ⟺ 판정 같고, 남은 근거가 **새 source 그룹**을 더하지 않는다
```

⚠️ `relationshipRefFor`를 재사용한다 — 무료 행의 `relationshipSignal`을 만든 바로 그
ref다. '무료가 뭘 봤을까'를 다시 추측하면 판정이 두 벌이 된다.

⚠️ **'남은 ref 하나라도 있으면 통과'가 아니다.** `adaptive`는 `declared`와 같은
`declared_me` 그룹이라, 그것만으로 통과시키면 결론이 무료와 같은 Chapter가 근거 한 줄만
더 붙여 팔린다. **그룹**이 늘어나야 연결이다.

#### `past_experience_no_target`(E) — unavailable 유지 근거

```
FREE Mirror contact 행
  state=MATCH  scope=past  strength=hardest
  signal "이전 관계에서 연락 감소가 가장 힘들었음으로 선택"   ← hardest 를 FREE가 소비
Premium cs_mirror_contact
  refs [declared:contact, relationship:hardest]              ← FREE 두 칸과 동일
  남은 근거 ∅
```

⚠️ **`hardest`는 Premium-only가 아니다**(직전 라운드 보고의 오류를 정정). `adaptive`는
생성기 ①의 **MATCH 분기가 붙이지 않아** 파이프라인에 없고, `selfGap`은 인용 가능한
`EvidenceRef` source가 없다.

| E를 여는 방법 | 무엇을 어기나 |
|---|---|
| `declared_me` 단일 그룹으로 connection 인정 | 단일 근거 가짜 연결 · Trust 완화 |
| `adaptive`를 MATCH 분기에 추가 | 같은 그룹이라 그룹 수가 늘지 않음 (위와 동일) |
| FREE MATCH 결론을 다른 제목으로 재포장 | 무료 문장 재판매 |

**증명**: 같은 E 세션에 **사진 한 장만** 더하면 `observed_me` 그룹이 늘어 **자격 O ·
Chapter 생성 O**(RELEASE-03). 차단은 상태가 아니라 근거가 결정한다.

#### FREE duplicate leak 0

| 검사 | 결과 |
|---|:-:|
| RELEASE-04 · 무료 중복이 내용 Chapter **주인공**이 된 경우 | **0** |
| RELEASE-04 · 모든 내용 Chapter의 주장이 무료 밖 근거를 보유 | **위반 0** |
| RELEASE-05 · 무료 Mirror 행 유지 | **3/3** |
| PREM-V2-11 · 무료와 같은 것만 가진 Chapter | **0** |

⚠️ 검증 중 `full`/`ended`의 `conflict_needs`가 걸렸는데, 주인공은
`cs_curpast_conflict`(CHANGE · 지금 × 이전)이고 `cs_mirror_conflict`는 **보조 근거**였다.
중복 Insight가 보조로 합쳐지는 것은 설계다 — 테스트가 주인공 대신 전원을 보고 있었다.

### 9.6.2 Self-only Premium 실측 (§2-5)

| fixture | 자격 | Chapter | 내용 | 주요 근거 | Omission | Next Check |
|---|:-:|--:|--:|---|--:|:-:|
| `no_experience_no_target` | O | 3 | 2 | `declared_me` | 3 | — |
| `no_experience_with_target` | O | 2 | 2 | `declared_me` | 2 | — |
| `past_experience_no_target` | **X** | 0 | 0 | — | 3 | — |
| `current_relationship` | O | 8 | 5 | 6종 | 1 | O |
| `ended_relationship` | O | 8 | 5 | 6종 | 1 | O |
| declared 1축만 | **X** | 0 | 0 | — | 3 | — |

```
no_experience_no_target    self_profile → self_tension → uncertainty
no_experience_with_target  self_profile → self_tension
```

실제 렌더 예 (`no_experience_no_target`):

```
01/3  내가 관계에서 중요하다고 말한 것        자료 1종
      근거  혼자 있는 시간이 중요 / 연락을 중요하게 생각함 / 취미는 가끔 같이 하면 좋음
            / 갈등은 잠깐 진정된 뒤 이야기 / 애정 표현은 적당히
      본문  지금 답에서는 … 5가지를 기준으로 보고 있어. 따로 물어본 항목이라 하나씩
            보면 취향처럼 보이는데, 같이 놓으면 네가 관계에서 무엇을 먼저 보는지가 드러나.
            ⏎ 아직 관계에서 확인된 기준은 아니야. … 여기서는 가설로만 남겨둘게.
      강조  현재 기준만 보면 개인 시간을 가장 앞에 두고 있어 — 답한 기준 5개를 한 자리에
            모은 결과야.
      체크  지금 답만 보고 정리한 기준이야. 이 중에서 실제로 양보하기 어려운 것 하나를 골라봐.

02/3  같이 놓으면 서로 당길 수 있는 기준       자료 1종
      본문  자주 연결돼 있고 싶은 마음과 혼자 있는 시간 — 둘 다 중요하다고 답했어. …
            ⏎ 어느 쪽이 진짜인지는 정하지 않아. 여기서 말할 수 있는 건 두 답이 같이
            높다는 것까지야.
      체크  두 기준이 동시에 중요하다는 건 문제가 아니야. 어느 쪽을 먼저 지킬지만 미리 정해둬.

03/3  아직 확신하면 안 되는 지점
```

**경험 주장 스캔 0건** — `실제 관계에서 나타났` · `반복해서` · `예전보다` · `겪었어` 계열이
하나도 없다. 모든 본문이 `지금 답` 또는 `둘 다 중요하다고 답했어`로 시작하고, 경계 문장에
`아직`/`겪어봐야`가 들어 있다(POSTREV-05). 사진 없는 세션에 `observed_me` **0**(POSTREV-06).

⚠️ **내용 Chapter 2개는 얇다.** 늘리려면 단일 축을 다시 설명하는 Chapter를 넣어야 하고
그건 §7 CH03이 금지한 것이다. **₩1,900에 값하는지는 NOT VALIDATED.**

### 9.6.3 러비의 체크포인트 (§1)

`감상` → `확인된 것 → 확인해볼 행동` 구조로 바꿨다.

| | Full Dating | Ended | job=none |
|---|--:|--:|--:|
| 체크포인트 존재 | 8/8 | 8/8 | 3/3 |
| 행동 동사 포함 | 8/8 | 8/8 | 3/3 |
| outward 조정 문장 | **5** | **0** | **0** |
| §1 금지 어휘 | 0 | 0 | 0 |

```
Full   갈등이 생겼을 때 바로 해결하려는 편인지, 감정을 먼저 정리해야 하는 편인지 내 순서를
       확인해봐. 상대와는 '무슨 말을 할지'보다 '언제 이야기할지'부터 맞추는 편이 안전할 수 있어.
Ended  … 내 순서를 확인해봐. 그때 필요했던 게 빠른 해결이었는지 정리할 시간이었는지,
       다음을 위해 정리해둬.
```

⚠️ **`tense`로 outward를 판단하지 않는다.** `job=none`은 `tense: 'current'`인데도 outward가
금지된다 — 그래서 `RelationshipDeepReport.allowsOutwardAction`을 추가했다.

⚠️ 실측에서 `ended` 안전 카피에 `지금`을 쓰지 않도록 문장을 고친 것은 직전 라운드와 같은
이유다 — **검사를 무디게 만들지 않고 문장 쪽을 맞춘다.**

### 9.6.4 인접 포즈 — 같은 추론 실수를 두 번 했다

사용자가 지적한 `05/8`·`06/8` 중복은 **직전 라운드에서 이미 해소돼 있었다**
(`next_check: chart → laptop`). 브라우저 재확인:

```
05/8 이 사람과 특히 맞춰봐야 하는 지점   chart.png
06/8 아직 확신하면 안 되는 지점          question.png
07/8 그래서 뭘 맞춰볼까                  laptop.png     ← 중복 0
```

그런데 **Self-only에서 새 중복이 나왔다**:

```
리포트 헤더    connect (81px)
01/3 self_profile  connect (40px)    ← 붙어 있다
```

두 번 모두 '이 두 자리는 같이 안 나온다'는 추론이 틀린 경우였다. 그래서 `resolveLovyPoses`가
**실제 목록에서** 겹침을 해소한다(헤더도 이웃으로 센다). `01/3`이 `record`로 대체됐다.
fixture도 kind 유일성 대신 **렌더 순서**를 검사한다(LOVY-01 · POSTREV-11).

### 9.6.5 결제 후 전환 (§4)

```
paywall → leaving(200) → success(560) → preparing(900) → revealing(~300) → report
                                                                    표준 ≈ 1.96초
reduced-motion:  0 + 500 + 600 + 0                                  ≈ 1.10초 (실측 1.18초)
```

⚠️ 이 환경은 `prefers-reduced-motion`을 강제하므로 **표준 경로는 상수 합으로만 확인했다.**
reduced-motion 경로만 브라우저에서 직접 측정했다(success 541ms → report 1179ms).

준비 화면: `connect` 러비 88px + `관찰한 내용을 연결하고 있어` + `관찰 › 연결 › 리포트`.

| 검사 | 결과 |
|---|:-:|
| Provider 호출 | **1회** (늘지 않았다) |
| 준비 화면의 fetch · `useDeepReport` 호출 | **0** |
| AI 대기 로직 | **없음** (고정 타이머 · 무한 로딩 불가) |
| 4상태 전부 CTA → preparing → report | **O** |

### 9.6.6 Fake Door · Preview · 실제 결제 분리 (§4-A/B/C)

이미 `if (canPreviewUnlock)` 한 분기로 갈려 있었다 — Preview에는 pre-launch 카피가
도달하지 않는다. 브라우저 실측:

| 환경 | CTA 누른 뒤 |
|---|---|
| `PREMIUM_PREVIEW=true` | preparing → 리포트. `준비 중`·`출시되면` **0건** |
| `PREMIUM_PREVIEW=false` | `정밀 관찰 리포트는 지금 준비 중이야` + `방금 누른 건 결제가 아니라 관심 표시로만 기록했어`. 리포트 **열리지 않음** |

⚠️ **`UNLOCK_COPY.payment.status`(`결제가 완료됐어`)는 남겨뒀다.** 실제 PG가 붙으면 맞는
말이고, 지금 지킬 것은 그 경로에 **도달하지 않는 것**이다. fixture는 문구를 스캔하는 대신
`setUnlockMode('payment')`를 세팅하는 코드가 없는지 본다(POSTREV-13) — 문구 검사는 미래에
쓸 올바른 카피를 지우게 만들고, 진짜 불변조건은 도달 가능성이다.

---

## 9.7 Production Deep Report Unlock — Fake Door 해제 (vNext)

> ⚠️ 이 절은 **v1.45 release 이후의 제품 정책 변경**이다.
> `docs/versions/기능명세_현행_v1.45.md`(frozen snapshot)는 수정하지 않았다.

### 9.7.1 사용자 캡처의 root cause

```ts
// v1.45
const canPreviewUnlock =
  PREMIUM_PREVIEW && isDeepReport && feature.status === 'fake-door';
```

`PREMIUM_PREVIEW`는 Production에서 `false`다. 그래서 `handlePurchaseIntent`의 첫 분기가
**항상 건너뛰어지고** 두 번째 경로로 떨어졌다:

```
premium_fake_door_reveal → setSheetOpen(true) → '상세 분석은 지금 준비 중이야'
```

즉 **코드가 의도대로 동작한 것**이고, 그 의도가 v1.45까지의 Fake Door 정책이었다.

### 9.7.2 Before / After

```
Before  CTA → premium_fake_door_reveal → '준비 중' BottomSheet        (리포트 없음)
After   CTA → success(demo_unlock) → preparing → report              (Chapter 8개)
```

수정은 한 줄이다:

```ts
// vNext
const canUnlockDeepReport = isDeepReport && feature.status === 'fake-door';
```

⚠️ **자격 판정을 새로 만들지 않았다.** `feature.status`는 이미 `hasPremiumEvidence(...)`의
결과다(§9.4.1) — unlock 조건은 그 값을 **읽을 뿐**이다. 규칙이 두 벌이 되면 v1.45 Release에서
잡은 결함('결제는 되는데 리포트는 비어 있는' 상태)이 다시 생긴다.

### 9.7.3 `demo_unlock` — PG 없이 여는 것에 대한 정직성

| mode | 언제 | Success 문구 | 가격 표시 |
|---|---|---|:-:|
| `payment` | 실제 PG 성공 (**미연결 · 진입 코드 0**) | `결제가 완료됐어` | O |
| **`demo_unlock`** | **Production 일반 CTA** | `정밀 관찰 리포트를 열었어` + **`아직 결제는 연결 전이야 · 이번 열람은 무료야`** | **X** |
| `preview` | `PREMIUM_PREVIEW=true` | `미리보기로 리포트를 열었어` | X |
| `beta_ut` | Preview + `?mode=ut` | `테스트용으로 리포트를 열었어` | X |

⚠️ **CTA에 `₩1,900`이 적혀 있는데 결제 없이 열린다.** Success 화면이 결제가 일어나지
않았다는 사실을 **먼저** 말하고, `demo_unlock`에서는 **가격을 표시하지 않는다** — 금액만
보여도 과금으로 읽힌다.

실측 Success 화면:

```
PRECISION REPORT
정밀 관찰 리포트를 열었어
아직 결제는 연결 전이야 · 이번 열람은 무료야
LOVY NOTE  좋아. 이제 모아둔 신호들을 조금 더 깊게 연결해볼게.
추가 관찰 완료 · 연결된 이야기 8개
```

### 9.7.4 Production-like QA (실측)

`NEXT_PUBLIC_PREMIUM_PREVIEW=false`로 `npm run build && npm start` 후 **사용자 캡처와
같은 경로**(`/mirror` → Premium 행 `왜 나는 생각했던 나와 다르게 행동했을까?` → CTA)로
재현했다.

```
success(demo_unlock)   63ms
preparing             540ms
report               1176ms     Chapter 8개 · Accordion 01/8~08/8
```

| 사용자 노출 문구 | 결과 |
|---|:-:|
| `상세 분석은 지금 준비 중이야` | **0건** |
| `정밀 관찰 리포트는 지금 준비 중이야` | **0건** |
| `출시되면 알려줘` | **0건** |
| `관심 표시만 기록했어` | **0건** |
| `결제가 완료` · `결제 성공` | **0건** |

### 9.7.5 4개 evidence 상태 (Production flag)

| 상태 | CTA | flow | Chapter |
|---|:-:|---|--:|
| A · Exp O + Tgt O | O | success → preparing → report | 8 |
| B · Exp O + Tgt X | O | success → preparing → report | 3 |
| C · Exp X + Tgt O | O | success → preparing → report | 2 |
| D · Exp X + Tgt X (Self-only) | O | success → preparing → report | 3 |
| E · past_experience_no_target | **X** | Paywall 자체가 열리지 않음 (`아직 연결할 수 있는 신호가 부족해`) | 0 |

⚠️ E는 **v1.45 invariant 그대로**다(§9.4.3) — 이번 변경이 건드리지 않았다.

### 9.7.6 다른 Premium Fake Door 영향 — 없다

`fake-door` status는 **6개 feature가 공유**한다. `isDeepReport` 제한을 유지했고
BottomSheet 컴포넌트·문구도 삭제하지 않았다.

실측: `?source=mbti` → CTA(`상세 분석 열기 — 1,900원`) → `준비 중` + `출시되면 알려줘`
BottomSheet · 리포트 미개방 · success 미진입. **Fake Door 그대로다.**

### 9.7.7 바꾸지 않은 것

Preparing timing(표준 ≈1.96초 · reduced ≈1.1~1.2초) · `PremiumPreparingReport` ·
Provider **1회** · `deep-report-v4-tense` · 새 loading 화면 **0** · 새 Route **0** ·
새 analytics 이벤트 **0**(`access_mode` 값만 하나 추가) · 새 env flag **0**.

---

## 10. Production Guard

| 항목 | 상태 |
|---|---|
| `NEXT_PUBLIC_PREMIUM_FAKE_DOOR` | 기본값 `!== 'false'` → **변경 없음** |
| `NEXT_PUBLIC_PREMIUM_PREVIEW` | 기본값 `=== 'true'` (= 꺼짐) → **변경 없음** |
| Production Paywall | ₩1,900 CTA → 의향만 기록 → '준비 중' BottomSheet → Full Report 미개방 |
| Unlock stage 게이트 | `PREMIUM_PREVIEW && isDeepReport && status === 'fake-door'` → **변경 없음** |
| 새 우회 경로 | **없다.** 새 query parameter·새 Flag·새 Route를 만들지 않았다 |
| `/api/dev/premium-test` | `NODE_ENV === 'production'` → 404. Provider 미호출 · Key 미참조 |
| 실제 결제 | **붙이지 않았다.** PG SDK·결제 서버·webhook·주문 DB 없음 |
| Production 빌드 | 59/59 static pages · `next build` 성공 |

Paywall이 **Production에서 보이는** 화면이므로 Chapter 목록도 Production에 노출된다.
그 목록은 `report.chapters`의 실제 제목이므로 **리포트가 만들지 않은 것을 광고하지 않는다** —
가짜 teaser가 문구 관리가 아니라 구조적으로 불가능해졌다.

### 10.1 실측 — 정적 guard로 끝내지 않았다

**(a) Production 빌드에서 dev 라우트 404** — `npm run build && npm start`로 실제 production
서버를 띄워 확인했다.

```text
POST /api/dev/premium-test     404
POST /api/dev/trust-test       404
POST /api/dev/lifecycle-test   404
POST /api/dev/history-test     404
POST /api/ai/contract-test     404
```

**(b) `PREMIUM_PREVIEW=false`에서 Fake Door가 그대로 닫혀 있다** — `NEXT_PUBLIC_*`는
빌드/컴파일 시점에 인라인되므로 dev 서버를 그 플래그로 다시 띄워 측정했다.

```text
Paywall            이번 리포트에서 볼 수 있는 것  8개   ← Chapter 목록은 그대로 보인다
CTA 클릭 후
  Fake Door sheet   '정밀 관찰 리포트는 지금 준비 중이야'                  ✅
                    '방금 누른 건 결제가 아니라 관심 표시로만 기록했어'      ✅
  리포트 본문        열리지 않음 (Accordion header 0개)                    ✅
```

**이것이 v1.45의 Production 경계다** — Paywall은 이제 이 세션에서 **실제로 만들어진**
Chapter 8개를 정직하게 목차로 보여주고, 그 다음은 v1.44와 **글자 하나 다르지 않게**
'준비 중'으로 닫힌다.

**VERIFIED** (a·b) · **STATICALLY VERIFIED** (PREM-V2-15 정적 guard 7항목)

---

## 11. Regression

| Suite | v1.44 baseline | v1.45 | 상태 |
|---|---:|---:|:-:|
| `test:ai` | 508 | **508** | ✅ |
| `test:observed` | 10 | **10** | ✅ |
| `test:history` | 100 | **100** | ✅ |
| `test:lifecycle` | 144 | **144** | ✅ |
| `test:relationship-evidence` | 280 | **280** | ✅ |
| `test:trust` | 205 | **205** | ✅ |
| `test:ai:e2e` | 6/6 | **6/6** | ✅ |
| `test:premium` | — | **196** (신규) | ✅ |
| `tsc --noEmit` | clean | **clean** | ✅ |
| `next build` | 성공 | **성공** | ✅ |

⚠️ `test:lifecycle`·`test:relationship-evidence`는 **의미를 바꾸지 않았다.** 라우트의
`renderedStrings`에 Chapter 문자열을 추가했을 뿐이라 검사 표면이 넓어졌고 건수는 그대로다.

### 11.1 v1.45가 닫은 v1.44 결함 (Audit 중 발견)

```text
⑤ MBTI Bridge × Relationship 연결의 ruleSummary가 `ended`에서 현재형이었다.

ended 세션 실측:
  sourceLabels  [성향 렌즈 / 동기화율 비교 / 그때 이 관계]   ← v1.41이 고친 자리
  ruleSummary   … 지금 관계에서도 신호가 있는 축이야       ← 고쳐지지 않은 자리
```

v1.41 §39.13이 ①②④⑨의 호칭을 전부 시제에 맞췄는데 ⑤만 빠졌다. 발견되지 않은 이유는
이 조합이 **양쪽 MBTI를 모두 요구**해서 `test:relationship-evidence`의
`FORMER_FORBIDDEN_PHRASES` 스캔이 닿는 fixture가 하나도 없었기 때문이다 —
"게이트는 있는데 그 경로를 아무도 지나가지 않았다"는 v1.40.1과 같은 실패 형태다.

`fromMbtiBridge`가 `tense`를 필수로 받게 했고(연결·근거·판정은 하나도 바뀌지 않는다),
PREM-V2-06이 MBTI가 있는 `ended` 세션으로 이 자리를 훑는다.

### 11.2 구현 중 브라우저 실측으로 잡은 결함 2건

| 결함 | 증상 | 고친 방식 |
|---|---|---|
| Accordion 기본 펼침이 mount 시점에 고정됐다 | `01`과 `07`이 함께 열린 채 렌더됐다. `useState` 초기화가 첫 렌더에서만 돌고, 그 순간의 `chapters[0]`이 최종 목록의 첫 Chapter가 아니었다 | '열린 목록'을 들지 않고 **사용자가 바꾼 것만** 들고, 기본값은 매 렌더 `index === 1`로 다시 계산한다. PREM-V2-13이 회귀를 고정한다 |
| 헤더가 렌더되지 않은 Chapter를 셌다 | Sparse에서 '부족해' 안내만 보여주면서 헤더는 `연결한 이야기 1개`라고 말했다(CH07 하나가 배열에 남아 있었다) — v1.45가 고치기로 한 **바로 그 불일치**를 새 구조에서 재생산했다 | `hasDeepConnection`이 false면 `chapters = []`. Sparse에 필요한 것은 CH07이 아니라 `omissions`다 |

---

## 12. NOT VALIDATED

코드에서 성공이라고 단정하지 않는다. 다음은 **전부 UT 전까지 미검증**이다.

| 항목 | 상태 |
|---|---|
| Premium 결과가 FREE와 충분히 다르게 **느껴지는가** | NOT VALIDATED |
| 결과 양(Chapter 8개)이 충분한가 | NOT VALIDATED |
| 사용자가 끝까지 읽는가 | NOT VALIDATED |
| 어떤 Chapter가 가장 가치 있는가 | NOT VALIDATED |
| **₩1,900 WTP** | **NOT VALIDATED — 가격은 가설이다** |
| History Chapter의 Retention 가치 | NOT VALIDATED |
| Accordion이 '규모를 먼저 보여준다'로 읽히는가 | NOT VALIDATED |
| Chapter 제목이 '나만을 위한 결과'로 읽히는가 | NOT VALIDATED |
| `novelty` threshold `0.35` | **NOT VALIDATED (v1.27부터)** — 이번 작업에서 손대지 않았다 |
| 캐릭터가 들어간 뒤 **'AI 리포트'가 아니라 '러비가 관찰한 리포트'로 읽히는가** | NOT VALIDATED |
| '러비 한마디'가 **관찰자의 반응**으로 읽히는가 — 아니면 분석의 결론으로 읽히는가 | NOT VALIDATED |
| '러비가 연결해본 이유'가 실제로 '왜 같이 볼 가치가 있는지'에 답하는가 | NOT VALIDATED |
| 중간 관찰 메모가 읽는 흐름을 돕는가 — 아니면 진행을 끊는가 | NOT VALIDATED |
| Closing의 큰 러비가 '기억한다'는 역할로 읽히는가 | NOT VALIDATED |
| 캐릭터 10종이 **개인화로 읽히는가** | NOT VALIDATED — 포즈는 `kind`로만 결정되므로 **실제로 개인화가 아니다.** 개인화처럼 읽히면 그건 오해를 만든 것이다 |
| 결제 전(캐릭터 1개) vs 결제 후(11개) 대비가 ₩1,900의 근거로 느껴지는가 | **NOT VALIDATED** — 구현 관점 대비만 확인했다 |
| **러비의 체크포인트가 실제 행동 변화를 만드는가** | NOT VALIDATED — 문장이 행동을 제안하게 된 것까지만 확인했다 |
| **Self-only Premium(내용 2개)이 충분히 가치 있다고 느껴지는가** | NOT VALIDATED — 정직한 상한이지만 얇다 |
| **체크포인트의 outward 문장이 처방으로 읽히는가** | NOT VALIDATED — 우리는 '확인해볼 것'으로 썼다 |
| **1.2~2.0초 preparing 전환이 적절한가** | NOT VALIDATED |
| **결제 없이 리포트가 열리는 것을 사용자가 어떻게 받아들이는가** | NOT VALIDATED — CTA에 `₩1,900`이 있는데 무료로 열린다. Success 문구가 그 사실을 말하지만 **혼란을 주는지, 오히려 신뢰를 주는지는 미검증**이다 |
| **`₩1,900` 가격 표시를 유지한 채 무료로 여는 것이 WTP 측정을 오염시키는가** | NOT VALIDATED |

UT는 다음 셋을 **분리해서** 검증하는 것이 목적이다.

```text
A. 분석 자체가 필요 없다.
B. 분석은 유용하지만 ₩1,900은 비싸다.
C. ₩1,900이면 낼 수 있다.
```

---

## 13. Remaining Risks

| # | 위험 | 근거 / 완화 |
|---|---|---|
| 1 | **CH02가 흔한 세션에서 만들어지지 않을 수 있다.** `declared_me` + `relationship:hardest|important`를 동시에 요구하는데, S30(지금 관계)에 답한 사용자는 Mirror 근거가 `current`로 해석되어 그 ref가 안 걸린다 | 의도된 정직함이지만 **Chapter 다양성을 실제로 줄인다.** 개선하려면 `fromMirrorInsight`가 과거 근거를 함께 실어야 하고, 그건 판정 변경이라 이 버전에서 하지 않았다 |
| 2 | Chapter 제목 10개가 **고정 문구**다 | 축 라벨(`eyebrow`)로 개인화되지만 제목 자체는 모든 사용자에게 같다. 제목을 AI에 맡기지 않은 것은 의도다(§9 Chapter existence/title은 deterministic) — 벤치마크의 '강한 제목'과 우리의 '근거 있는 제목' 사이의 절충이고, **UT에서 제목이 밋밋하게 읽히는지 확인해야 한다** |
| 3 | `deep_report_scroll`이 Accordion에서 발생하지 않을 수 있다 | §9.1에 적었다. `premium_chapter_open`으로 대체 관측하되 **GA4 대시보드 쪽 정의를 함께 고쳐야 한다**(이번 작업 범위 밖) |
| 4 | `uncertainty` Chapter의 §8 예외 | §4.2에 근거를 적었지만 **명세와의 편차다.** 사용자 검토에서 다른 결정이 나오면 CH07을 `limitations` 확장으로 되돌릴 수 있다(구조 변경 없이 가능) |
| 6 | **`ended` 리포트에 하트가 그려진 이미지가 1개 남아 있다** (`together` · 40px · 종이에 그려진 하트) | §29는 '축하 캐릭터 금지 · 하트 과잉 금지'다. 축하·엄지척·컨페티는 **한 자리도 쓰지 않았고**, 하트를 가진 이미지는 `애정을 주고받는 방식` Chapter 하나뿐이며 그것도 껴안은 하트가 아니라 **기록으로 든 종이**다. 그래도 '과잉'의 경계는 판단이므로 **사용자 검토에서 뒤집힐 수 있다** — 되돌리려면 `lovyPoseFor`에 tense 분기를 추가해야 하고, 지금 10종이 다 쓰이고 있어 대체 포즈를 새로 가져와야 한다 |
| 7 | **한 Chapter 안에서 규칙 문장과 AI 문장이 거의 같은 말을 할 수 있다** | 실측에서 잡혔다: 규칙 `지금 상대와 연락 방식에서 차이가 보이는데, 이 축은 지금 관계에서 신호가 있는 축이고…` / AI `지금 상대와 연락 방식에서 차이가 보이는데, 이 축은 지금 관계에서 신호가 있는 축이야…`. **v1.45 캐릭터 통합이 만든 것이 아니라 v1.44부터 있던 상태**이고, (F) 중복 게이트(`MIN_NARRATIVE_NOVELTY = 0.35`)를 AI가 살짝 넘겨서 통과한 경우다. **손대지 않았다** — 이번 작업은 AI schema·prompt 변경 금지이고 `0.35`는 NOT VALIDATED라 임의 튜닝 금지다. Chapter 사이 중복은 0이지만 **Chapter 안 중복은 남아 있다** |
| 8 | **`past_experience_no_target`은 unavailable을 유지한다 (의도)** | FREE가 `hardest`를 이미 소비하고 `adaptive`는 MATCH 분기에 붙지 않아 **남은 근거가 0**이다. Experience/Target 부재 때문이 아니다 — 사진 한 장만 더해도 열린다(RELEASE-03). 여는 방법 세 가지가 모두 금지 항목(단일 그룹 connection · Trust 완화 · 무료 재포장)이라 **의도된 결과로 확정했다.** 열어야 한다면 `adaptive`를 별도 source group으로 승격하는 설계 변경이 필요하고 그건 Evidence 모델 변경이다 |
| 10 | **Paywall이 `₩1,900`을 표시한 채 결제 없이 리포트를 연다** | Success 문구가 `아직 결제는 연결 전이야 · 이번 열람은 무료야`로 명시하고 가격도 숨기지만, **Paywall 자체의 가격 표시는 그대로다.** 이번 작업은 unlock 경로 수정 범위라 Paywall 카피를 재설계하지 않았다 — 가격을 남길지, `지금은 무료`로 바꿀지는 제품 결정이 필요하다 |
| 11 | **`demo_unlock`이 analytics에서 유료 전환으로 오독될 수 있다** | `deep_report_view`의 `access_mode`로 구분 가능하지만 **GA4 대시보드 정의를 함께 고쳐야 한다**(이번 범위 밖). `premium_purchase_intent`는 여전히 기록되므로 그것만 보면 결제 의향으로 읽힌다 |
| 9 | **표준 모션 경로의 전환 시간을 직접 측정하지 못했다** | 이 환경이 `prefers-reduced-motion`을 강제한다. reduced-motion 경로는 1.18초로 실측했고 표준 경로 1.96초는 **상수 합**이다 — 실제 기기에서 체감 확인이 필요하다 |
| 5 | `historyDeep`이 리포트 본문에서 빠졌다 | `past_and_now` Chapter가 대체하지만, `buildHistoryDetail`의 `이전 기록 / 최근 기록` 쌍 표현은 Chapter의 `ruleSummary`보다 정보가 많다. **standalone `/premium-preview/history_detail`에서는 그대로 살아 있다** |
| 6 | AI 문장 도착이 7~10초 | v1.44와 같다(Provider 특성). 규칙 리포트가 먼저 완결돼 있어 대기 중에도 읽을 수 있다 |
| 8 | 같은 경계 문장이 Chapter 2~3개에 반복된다 | §9.4에 근거를 적었다. Accordion 때문에 동시 노출이 드물지만, **여러 Chapter를 펼친 사용자에게는 반복으로 읽힌다.** 경계를 줄이는 방향으로는 고치지 않는다 — 필요하면 문장을 축·source 조합별로 더 세분화해야 하고 그건 `limitationFor` 변경이라 이 버전 범위 밖이다 |
| 9 | fixture의 `mirrorSnapshot.relationshipSignal`이 실측 문장과 100% 같지는 않다 | §27 스캔 중에 fixture가 `axis` 키를 그대로 넣어 `연락 축에 contact`라는 문장을 만들고 있었다(앱 결함이 아니라 fixture 탓). 한국어 문장으로 고쳤지만, **fixture 문장이 실제 앱이 저장하는 문장과 완전히 같지는 않다** — 금지 어휘 스캔의 사각지대가 될 수 있다 |
| 7 | Chapter 수가 데이터에 따라 6~8로 흔들린다 | 설계된 동작이지만(§7) **7~10 목표의 하단을 자주 칠 수 있다.** No Current 세션이 6개였다 |

---

## 14. Release Recommendation

```text
READY FOR USER REVIEW  —  RELEASE 아님
```

| 조건 | 상태 |
|---|:-:|
| FREE 결과를 단순 반복하지 않는다 | ✅ `isFreeDuplicate` + PREM-V2-11 |
| 실제 cross-source evidence 기반이다 | ✅ Chapter마다 group ≥2 (예외 §4.2) |
| 하나의 완결된 리포트처럼 읽힌다 | ✅ 헤더 규모 · 요약 · 번호 · Accordion · 마무리 |
| 고데이터에서 7~10개 가치 단위 | ✅ 8개 |
| Sparse에서 filler 0 | ✅ Chapter 0 · omission 3 |
| AI 실패에도 리포트가 무너지지 않는다 | ✅ Journey E 실측 |
| Production Fake Door는 그대로 닫혀 있다 | ✅ 플래그·게이트 무변경 |
| 기존 회귀 baseline 유지 | ✅ 1247건 + 신규 196건 |

**다음 단계 (이번 작업 범위 밖):**

1. 사용자 검토 — 특히 §13-①(CH02 미생성)과 §13-②(고정 제목)
2. 별도 v1.45 Release Checkpoint에서 commit / push
3. Frozen Snapshot(`docs/versions/기능명세_현행_v1.45.md`) 생성
4. UT — ₩1,900 WTP를 A/B/C로 분리 검증

**하지 않은 것:** commit · push · Frozen Snapshot · Production Fake Door 해제 ·
Production Premium Preview 공개 · 실제 결제 연결 · promptVersion bump ·
`novelty` threshold 조정 · 다른 4개 AI Task의 promptVersion 변경.
