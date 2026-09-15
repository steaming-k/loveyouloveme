# 1차 UT 전체 Backlog Closure Matrix (09/11 · 09/14 · 09/15)

> 이 문서는 **1차 UT를 닫는 문서**다. 09/11 · 09/14 · 09/15 세 차례 UT 원본 녹취와
> 운영자 메모에서 나온 모든 항목을 현재 코드와 대조해 상태를 고정한다.
>
> 기준 브랜치: `feat/v147-supabase-persistence-clean` (직전 HEAD `6158d3a`)
>
> 기준 자료
> - `260911/0911 UT-1-텍스트변환1·2` · `UT-1. 메모`
> - `260914/0914-UT 텍스트변환1·2` · `260914 UT 메모`
> - `260915/0915-UT-1` · `0915-UT-2` · `260915 UT 메모-1·2`
>
> 상태 정의
>
> | 상태 | 뜻 |
> |---|---|
> | DONE | 현재 코드에서 확인됨 |
> | PARTIAL | 일부만 반영 · 남은 범위를 명시 |
> | NOT DONE | 반영 안 됨 |
> | HYPOTHESIS | 검증 전 가설 · 지금 구현하지 않는다 |
> | CLOSED | 더 이상 작업 대상 아님 |

---

## 1. Closure Matrix

### P0 — Premium 노출 · 상품 구조 · Target · 결과 순서

| # | UT | 관찰 / 발화 | 현재 코드 | 상태 | 근거 | 이번 수정 |
|---|---|---|---|---|---|---|
| 1 | 0911 §9·§10 | "상대가 없을 때도 프리미엄 버튼이 보여야 하는데 안 보임" · "프리미엄 선택 버튼 활성화가 안 됨" | UT 모드는 env flag와 무관하게 surface를 연다 | DONE | `lib/premiumAccess.ts` `resolvePremiumAccess` | – |
| 2 | 0911 §9 | 같은 문제의 **남은 경로** — E3(확신 낮음) 결과 화면에는 Premium 진입 행이 처음부터 없었다 | `LowConfidenceView`에 본문과 같은 `premiumFeatureState` 기반 진입 행 추가 | NOT DONE → DONE | `app/compatibility/page.tsx` `LowConfidenceView` | ✅ |
| 3 | 0911 §23 | "한번 결제하면 그 결제된 분석 결과는 다시 결제 안 되게. 다른 사람과 관계 보기면 추가 결제" | unlock 키가 `feature:funnelAnalysisId` — 새 상대는 새 funnel | DONE | `lib/premiumAccess.ts` `entryKey` · `SessionProvider.resetTargetContext` | – |
| 4 | 0911 (녹취2) | "사주랑 별자리랑 묶어서 간다고 하면 결제를 할 수도 있을 것 같아" — 번들이 WTP 동인 | 세 렌즈가 같은 flagship `relationship_deep_report`를 가리킨다 | DONE | `app/premium/page.tsx` `FEATURE_BY_SOURCE` | – |
| 5 | 0911 (파생) | 그런데 **렌즈 화면 3곳에 ₩1,900이 각각 찍혀** `₩1,900 × 3`으로 읽혔다. Home·Paywall만 '따로 파는 게 아니다'를 말했고, 두 화면은 렌즈를 둘러보는 동선에 없다 | 렌즈 화면이 **자기 가격 줄을 갖는 진입 행을 버리고** Home의 Bundle 카드를 공용으로 쓴다 — 가격 1개 + 포함 항목 3개 | PARTIAL → DONE | `components/premium/PremiumBundleCard.tsx` · `app/lens/{saju,mbti,astrology}/page.tsx` | ✅ |
| 6 | 0911 §10 | unlock 이후 렌즈가 또 결제처럼 보이면 안 된다 | unlock 후 렌즈 섹션에 가격·결제 CTA 0 | DONE | `components/premium/PremiumLensSection.tsx` | – |
| 7 | 0911 §13 | "상대 입력 내용 동기화 안 됨" | target source-of-truth가 `SessionProvider` 하나 · 결과/입력 route에 별도 저장소 0 | DONE | `state/SessionProvider.tsx` | – |
| 8 | 0914 §11 | "입력은 쭉 받고 결과는 궁합 점수부터" | 결과 첫 블록이 `SyncScore` → FirstSurprise → 상세 근거 → Premium | DONE | `app/compatibility/page.tsx` | – |

### P1 — 입력 흐름 · 용어 · 질문 · 진입점

| # | UT | 관찰 / 발화 | 현재 코드 | 상태 | 근거 | 이번 수정 |
|---|---|---|---|---|---|---|
| 9 | 0914 §1 | "'이번엔 네 기억을 조금 빌릴게' 화면이 헷갈림 · 느닷없음 · 붕 뜸" | 별도 화면 제거 · 첫 질문으로 흡수, Route는 redirect로만 남김 | DONE | `app/profile/past/intro/page.tsx` · `PastStepView` | – |
| 10 | 0914 §4 | "'펼치기'가 잘 안 보임. 안 펼치면 입력 안 한 채로 넘어갈 것 같음" | `OptionalDisclosureButton`(열면 무엇이 달라지는지 명시)이 상대 입력·사건·현재 관계에 적용 | DONE | `components/common/OptionalDisclosureButton.tsx` | – |
| 11 | 0914 §5·§6 | "'기억나는 장면' → '기억나는 사건'", "'이 장면 추가하기' → '이 사건 추가하기'" | 입력 UI 전부 `사건` | DONE | `components/profile/RelationshipEventSection.tsx` | – |
| 12 | 0914 §5 (파생) | 렌즈 회고 문구에 `장면`이 하나 남아 용어 계약과 충돌 | `기억에 남은 순간`으로 통일(형제 문장과 동일) | PARTIAL → DONE | `data/premiumLens.ts` `LENS_THEME_QUESTION_FORMER.pace` | ✅ |
| 13 | 0911 §6 | "호감 신호 / 갈등 / 기타 선택하게 했으면" | 사건 유형 선택 + '기타' 자유 입력(300자) | DONE | `data/relationshipEvents.ts` · `RelationshipEventSection` | – |
| 14 | 0911 §7·§8 | "'싸웠을 때 어느 정도 시간이 필요해?' 너무 노골적" · "'혼자 있고 싶을 때…' 교체 필요" | 두 문장 모두 폐기 · 전제를 깔지 않는 문장으로 교체 | DONE | `data/conversationQuestions.ts` · `lib/logic/userFitQuestions.ts` | – |
| 15 | 0911 §3 / 0914 §3 | "'이 사람과 나는'에 '이전 관계' 추가" · "'배우자','커플' 선택지가 없음" | `연인 · 배우자` · `이전 관계` · `잘 모름` · `알아가는 중` 포함 8종 | DONE | `data/targetFields.ts` `TARGET_RELATION_OPTIONS` | – |
| 16 | 0911 §21·§25 / 0915-1 §4 | "홈의 프로필 없애도 될 듯" · "'내 관계 프로필 보기' 삭제" | Home 본문 중복 진입 제거 · 접근 경로는 하단 `나` 탭에 유지(dead-end 아님) | DONE | `app/home/page.tsx` · `BottomNavigation` | – |
| 17 | 0911 §15 / 0914 §9 | "같은 말이 반복" · "텍스트가 너무 많아 안 읽힘 · 논문 같다" | 중복 축 병합 · 근거 기본 닫힘 · 무료/유료 주인공 분리가 VALUE-01~15로 고정 | PARTIAL | `tests/run-value-fixtures.mjs` | 이번 라운드 추가 축소 없음(결과 재작성 금지) |
| 18 | 0914 §9 / 0915-2 §6 | "캐릭터랑 티키타카 하다가 갑자기 글자만 남음" · "좀 더 컨셉츄얼하게" | 궁합 · Mirror · Premium 리포트 · 렌즈 전부에 Lovy checkpoint 존재(도배 아님) | DONE | 각 결과 route | – |
| 19 | 0915-1 §2·§3 | "분석에 네비게이션 바 보이게" · "뒤로가기가 헷갈림" | 결과 화면 하단 Nav 상시 · Contextual Back | DONE | `UT15-P0-04·05` | – |
| 20 | 0915-2 §3 | "'연애 성공확률이 아니야'가 커플/부부에겐 안 맞음" | 관계 상태를 언급하지 않는 문장으로 교체 | DONE | `data/copy.ts` | – |
| 21 | 0915-2 §1 | "인형이 왜 '반려동물과 함께'에 포함되는 거임?" | 소품 차단 · 거절한 관찰 downstream 전파 차단 | DONE | `UT15-P0-01·02·03` | – |
| 22 | 0915-2 §2 | "이전 관계 선택지에 '기타'가 있어서 입력(300자)" | 구현됨 | DONE | `UT15-P1-04` | – |
| 23 | 0915-2 §5·§7 / 0911 §16 | "세부 질문이 부족" · "질문이 너무 얕았음" · "추천 질문 강화 필요" | 선택형 심화 입력(최대 2개, 점수 불변)으로 대응 | PARTIAL | `UT15-P1-01·02·03` | 필수 질문 대폭 증가·AI 자유 질문 생성은 금지 범위 |
| 24 | 0911 §11 | "출생시간 ':' 생략 가능하게" | 생년월일/시간 입력 정규화 | DONE | `lib/logic/birth.ts` · `BirthProfileForm` | – |
| 25 | 0911 §12 | "'돌아가기' 버튼 없앰(좌상단과 동일 기능)" | 중복 제거 · Contextual Back으로 통일 | DONE | `hooks/useContextualBack.ts` | – |
| 25b | 0911 §4 | "홈에서 '새로운 사람과 궁합보기'를 '관계 궁합 보기'로 문구 변경" | **조건부로** 구현 — 상대 문맥이 없으면 `관계 궁합 보기`, 이미 상대가 있으면 `새로운 사람과 궁합 보기`(버튼이 실제로 하는 일이 다르다) | DONE | `app/home/page.tsx:551` | – |
| 26 | 0915-1 §5 / 0911 (녹취2) | "친구랑도 써보고 싶음" · 공유 진입점이 안 보임 | 공유 진입점을 결과를 다 읽은 자리에도 노출 | DONE | `UT15-P2-01·02` | – |

### CLOSED / HYPOTHESIS / OUT OF SCOPE

| # | UT | 항목 | 상태 | 이유 |
|---|---|---|---|---|
| 27 | 0911 §24 | 효과음 전체 제거 | **CLOSED** | 0914 UT에서 참가자가 "소리 아무것도 안 나"로 직접 확인. 코드 audit 결과 참가자 UI에 오디오 재생 소스 0. `UT-ALL-CLOSED-01`로 회귀 고정. **새 효과음 추가 금지.** |
| 28 | 0911 §18 | "당신과 같은 성향은 전국의 X%" | **HYPOTHESIS / DATA NOT AVAILABLE** | 실제 모집단 데이터가 없다. 지어낸 percentile·sample size는 기능이 아니라 거짓이다. `UT-ALL-CLOSED-02`가 가짜 통계 유입을 막는다. 실제 수집 데이터가 쌓인 뒤 재검토. |
| 29 | 0911 §14 / 0915-2 | 이전 대상 여러 명 저장 후 선택해서 다시 보기 | **OUT OF CURRENT SCOPE** | 실제 Supabase persistence 검증(RLS·auth)과 엮여 있다. 이번 라운드는 **same-session target consistency**까지만 P0로 닫았다. cloud persistence는 별도 scope. |
| 30 | 0911 §5 / §1 | 중요 항목 최대 4 → 5 · 취미 선택 제한 완화 | **HYPOTHESIS** | 한 명의 취향으로 즉시 바꾸지 않는다. 현재 상한이 분석 로직에 필요한 근거인지 먼저 확인이 필요하다. 이번 라운드 변경 없음. |
| 31 | 0914 §14 | '지금 관계 속의 나'를 아코디언으로 | **HYPOTHESIS / IA candidate** | 전체 IA 변경이다. 현재 화면이 dead-end나 flow blocker가 아니므로 이번 P0/P1 범위에서 보류. |
| 32 | 0914 §8 | "별자리 조별과제 같다 · 배너 느낌이면" | **HYPOTHESIS** | 렌즈 질문 톤은 `fix: lighten lens reflection prompts`에서 한 차례 완화했다. 추가 톤 변경은 2차 UT에서 재확인. |
| 33 | 0911 §22 | 서비스 링크가 크롬이 아니라 엣지로 열림 | **INVALID / 제품 밖** | 참가자 OS 기본 브라우저 설정. 제품 코드가 제어하지 않는다. |
| 34 | 0914 §13 | "'같이 해볼 것'이 교과서적" | **PARTIAL** | Action Layer는 근거가 있을 때만 만들어지고 `ended`에서는 만들지 않는다. 체감 톤은 2차 UT 검증 대상. |
| 35 | 0914 §15 | "일회성 사용자에겐 번거로움" | **HYPOTHESIS** | Retention 기능 신규 개발은 이번 금지 범위. |

---

## 2. 집계

| 상태 | 수 |
|---|---|
| DONE | 21 |
| PARTIAL | 4 |
| NOT DONE → DONE (이번 수정) | 1 |
| HYPOTHESIS | 5 |
| CLOSED / INVALID / OUT OF SCOPE | 4 |

이번 라운드 수정 대상으로 선정한 항목: **#2(P0-1) · #5(P0-2) · #12(P1-3)**

나머지 P0/P1은 09/14 · 09/15 후속 작업에서 이미 닫혀 있었고, 이 문서는 그 사실을
코드 근거와 함께 고정한다 — 다시 작업 대상으로 되살아나지 않게 한다.

---

## 3. Premium 상품 계약 (확정)

```
Premium = 관계 단위 1개 상품

₩1,900  정밀 관찰 리포트
 ├ Saju Lens
 ├ MBTI Lens
 ├ Zodiac Lens
 ├ Relationship Connection (따로 답한 것들의 연결)
 └ Premium Action Layer
```

**Lens별 별도 상품이 아니다.**

| 결제 단위 | 성립 |
|---|---|
| 사주별 결제 | ❌ |
| MBTI별 결제 | ❌ |
| 별자리별 결제 | ❌ |
| 관계 Premium Report별 결제 | ✅ |

### ₩1,900이 노출되는 자리

| 화면 | 형태 | 번들임을 말하는가 |
|---|---|---|
| Home Bundle | 가격 1회 + 렌즈 3종 목록 | ✅ `한 번 열면 아래 전부 볼 수 있어` |
| Paywall(`/premium`) | 가격 섹션 1개 + Chapter 목록 + 렌즈 목록 | ✅ `따로 결제하는 게 아니라 정밀 관찰 리포트와 한 번에 열려` |
| 궁합 결과 · Mirror · History · First Contact | 진입 행(가격은 중립 metadata) | 목적지가 같은 flagship |
| 렌즈 3화면 | **Bundle 카드**(Home과 동일 구조) — 가격 1개 + 렌즈 3행(가격 없음) | ✅ **이번 교체** — 지금 보는 렌즈에 `지금 보는 중` 배지 + `따로 파는 게 아니라 … 같이 열려` |
| unlock 이후 (렌즈 화면 · Home · 리포트 내 렌즈 섹션) | 탐색 전용 | **가격을 아예 그리지 않는다** · CTA는 `열기` → `보기` |

⚠️ 렌즈 화면 Hook은 **어떤 렌즈가 열리는지 약속하지 않는다.** 생년월일이 없으면
사주 렌즈는 만들어지지 않는데, 그 자리는 `lensBundle.availableCount`를 모른다.
말하는 것은 **가격 구조 하나**뿐이고, 그건 입력과 무관하게 항상 참이다.
(`data/premium.ts`의 `additions`가 렌즈 3종을 목록에서 뺀 것과 같은 규칙.)

### 결제 단위와 재열람

| 상황 | 동작 |
|---|---|
| A와의 Premium Report | ₩1,900 |
| A와의 같은 Report 다시 보기 | 재결제 없음 (`feature:funnelAnalysisId` 키가 유지됨) |
| B와의 새 Premium Report | 별도 결제 대상 (새 상대 → 새 `funnelAnalysisId`) |

⚠️ 실제 PG 결제는 아직 없다(`paymentConfirmed`는 항상 false). 위 계약은 현재
unlock/intent state가 지키는 범위이고, 실제 결제 연동 시 이 표를 계약으로 삼는다.

---

## 4. 회귀 고정

새 스크립트: `npm run test:ut-phase1` (`tests/run-ut-phase1-fixtures.mjs`, 42 checks)

소스만 읽는다 — dev 서버도 Provider도 부르지 않는다.

```
UT-ALL-P0-01  E3 포함 결과 화면마다 Premium 진입 행이 있다
UT-ALL-P0-02  렌즈 3화면이 전부 같은 flagship을 가리킨다
UT-ALL-P0-03  UT 모드는 env flag와 무관하게 surface를 연다
UT-ALL-P0-04  렌즈 화면 CTA가 '따로 파는 게 아니다'를 말한다 / 렌즈 3종을 약속하지 않는다
UT-ALL-P0-05  화면에 가격 문자열 하드코딩 0 (formatPrice 단일 출처)
UT-ALL-P0-06  Home Bundle · Paywall이 '한 번에 열린다'를 명시한다
UT-ALL-P0-07  unlock 이후 렌즈 탐색에 결제 CTA 0
UT-ALL-P0-08  target source-of-truth 단일 · route별 별도 저장소 0
UT-ALL-P0-09  새 상대 → 새 funnelAnalysisId
UT-ALL-P0-10  동기화율이 상세 근거·Premium보다 먼저 온다
UT-ALL-P1-01  사건 입력 UI에 '장면' 0 · 렌즈 회고 문구도 동일
UT-ALL-P1-02  선택 입력에 펼치기 affordance
UT-ALL-P1-03  폐기된 공격적 질문 0
UT-ALL-P1-04  Home 중복 진입 제거 + 프로필 경로 유지
UT-ALL-P1-05  관계 상태 보기 존재
UT-ALL-P1-06  결과 단계 Lovy checkpoint
UT-ALL-CLOSED-01  참가자 UI에 효과음 재생 소스 0
UT-ALL-CLOSED-02  가짜 모집단 통계(전국 % · 백분위) 0
```

---

## 5. 2차 UT에서 다시 확인할 가설

1. ₩1,900을 **하나의 관계 분석 가격**으로 이해하는가 — 특히 렌즈를 셋 다 둘러본 뒤에도.
2. 무료 결과만 보고 Premium을 **스스로** 발견하는가.
3. 읽는 양 대비 새로 얻는 것이 충분한가(#17 PARTIAL).
4. 선택형 심화 입력이 "질문이 얕다"를 실제로 해소하는가(#23 PARTIAL).
5. Action Layer가 여전히 교과서적으로 읽히는가(#34).
6. 렌즈 질문 톤이 여전히 '조별과제'로 읽히는가(#32).
7. 전국 성향 % 가설(#28)은 실제 모집단이 생기기 전까지 계속 보류한다.

---

## 6. Browser QA 결과 (393×852 · `AI_MODE=demo` · Provider delta 0)

`.next`를 비우고 dev 서버를 새로 띄운 뒤 실제 모바일 폭에서 확인했다.

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | low-confidence(E3) 결과에서 Premium 발견 | ✅ `관측 정보 부족 · 입력 0/4` 화면 하단에 `PRECISION REPORT · 정밀 관찰 리포트 보기 · ₩1,900`. **수정 전에는 아무것도 없었다.** |
| 2 | 일반 Compatibility 결과에서 Premium 발견 | ✅ `SYNC RATE 55`가 첫 블록(score-first), Premium은 상세 근거 뒤 |
| 3 | 구매 전 ₩1,900이 하나의 번들 가격으로 보임 | ✅ 렌즈 3화면 모두 `PREMIUM BUNDLE / 정밀 관찰 리포트 + 관계 렌즈 3종 / ₩1,900` 1회 + 렌즈 3행(가격 없음) |
| 4 | 사주·MBTI·별자리가 각각 상품처럼 보이지 않음 | ✅ 세 화면의 블록이 **완전히 동일**하고, 지금 보는 렌즈에만 `지금 보는 중` 배지가 붙는다 |
| 5 | unlock 이후 세 Lens 탐색 · 결제 CTA 없음 | ✅ 가격 노출 **0개**, CTA가 `열기 →` → `보기 →`로 바뀜 |
| 6 | target sync (A: INFP / 1994-11-21) | ✅ `/compatibility` → `/mirror` → `/lens/mbti` → `/premium` 전부 같은 target·같은 `funnelAnalysisId`(`56bc4eac…`) |
| 6b | target B 격리 | ✅ 새 상대 진입 시 funnel 재발급(`a875167e…`), A의 mbti·생년월일 유입 0, **A의 unlock도 넘어오지 않음**(가격·`열기` 복귀) |
| 7 | refresh / direct URL | ✅ 모든 이동이 full page load였고 Bundle·상태 유지 |

Provider 실호출: **0회** (`/api/dev/ai-guard` → `realProviderCalls: 0`, `envMode: demo`)

### 실제 렌더 (`/lens/astrology`, 구매 전)

```
PREMIUM BUNDLE
정밀 관찰 리포트 + 관계 렌즈 3종
사주 · MBTI · 별자리 관점까지 한 번에 보는 관계 리포트야. 지금 보고 있는 렌즈도 여기 들어 있어.
₩1,900                                    ← 가격은 여기 하나뿐
한 번 열면 아래 전부 볼 수 있어
  MBTI 관계 분석                 열기 →    ← 가격 없음
  사주 관계 분석                 열기 →    ← 가격 없음
  별자리 관계 분석 [지금 보는 중]  열기 →    ← 가격 없음
따로 파는 게 아니라 정밀 관찰 리포트와 같이 열려.
[ 전체 상세 분석 보기 → ]
```

### unlock 이후 (같은 화면)

```
PREMIUM BUNDLE
정밀 관찰 리포트 + 관계 렌즈 3종
사주 · MBTI · 별자리 관점까지 한 번에 보는 관계 리포트야. 지금 보고 있는 렌즈도 여기 들어 있어.
                                          ← 가격 줄 자체가 사라진다
한 번 열면 아래 전부 볼 수 있어
  MBTI 관계 분석                 보기 →
  사주 관계 분석                 보기 →
  별자리 관계 분석 [지금 보는 중]  보기 →
```
