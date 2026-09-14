# 럽유럽미 — Relationship Language System

> 사용자-facing 관계 용어의 기준 문서다. 화면 문구를 새로 쓰거나 고칠 때 이 표를 먼저 본다.
> 작성 2026-09-15 · 기준 브랜치 `feat/v147-supabase-persistence-clean` · 근거 260914 UT 후속.

---

## 0. 한 줄 원칙

**내부 데이터 이름과 화면 이름은 다르다.** `pastRelationship` · `experience` · `ex` · `ended` 같은 내부 키는
그대로 두고, 사용자에게 보이는 이름만 이 문서 기준으로 쓴다. 반대로 **분석이 과거/현재를 구분하는 자리의 시제는
넓히지 않는다** — 넓힌 순간 근거 문장이 거짓이 된다.

---

## 1. 서비스 범위와 용어가 풀어야 할 문제

사용자는 연애 경험 없음 · 관심 있는 사람 · 썸/알아가는 중 · 연인/커플 · 배우자 · 이전 관계 · 끝난 관계를
모두 포함한다. 그래서 **상위 기능 이름으로 '이전 관계'를 쓰면** 현재 연인·배우자 사용자에게 "과거 연애 전용"으로
읽힌다.

하지만 제품 안에는 **실제로 과거만을 뜻하는 데이터**도 있다:

| 데이터 | 화면 | 분석에서의 시점 |
|---|---|---|
| `answers.experience` (S15~S17) | 과거 관계 질문 3개 | `evidenceScope: 'past'` — `이전 관계에서 …으로 선택` |
| `answers.currentRelationship` (S30) | 결과 안 '지금 관계 속의 나' | `evidenceScope: 'current'` — `지금 관계에서 …` |
| `target.relation === 'ex'` | '이 사람과 나는' → 이전 관계 | STAGE `ended` · 과거형(`former`) 문장 |

그래서 해법은 "이전 관계"를 지우는 것이 아니라 **역할을 나누는 것**이다.

---

## 2. 상위 용어 결정

### 2.1 후보 비교

| 후보 | 현재 관계에 자연스러운가 | 끝난 관계 | 좋은 기억만 암시하지 않는가 | 갈등 관계 | 모쏠 압박 없음 | 러비 톤 | 짧게 쓸 수 있나 | S15~17 과거 시점 근거와 충돌하지 않는가 |
|---|---|---|---|---|---|---|---|---|
| 돌아보고 싶은 관계 | ○ | ○ | △ ('싶은') | ○ | △ | ○ | △ | ✗ 지금 연인·배우자를 과거 근거 칸으로 부른다 |
| 떠올려볼 관계 | ○ | ○ | ○ | ○ | △ | ○ | ○ | ✗ 같은 문제 |
| 기억하고 싶은 관계 | △ | △ | ✗ 좋은 기억 암시 | ✗ | △ | ○ | △ | ✗ |
| 기록하고 싶은 관계 | ○ | ○ | ○ | ○ | △ | △ 과제 느낌 | △ | ✗ |
| 관찰하고 싶은 관계 | ○ | △ | ○ | ○ | △ | ○ | △ | ✗ (궁합 대상과 혼동) |
| 나를 돌아보게 한 관계 | △ | ○ | ○ | ○ | ✗ 경험 전제 | ○ | ✗ 김 | △ |
| **관계 경험** | ○ ('관계 경험'은 시점을 말하지 않는다) | ○ | ○ | ○ | ○ (건너뛰기와 함께) | ○ | ○ | ○ 질문 문장이 시점을 따로 말한다 |

### 2.2 결정

| 역할 | 최종 표현 |
|---|---|
| 기능 · 섹션 이름 | **관계 경험** |
| 러비 도입 | `이제 관계 경험을 짧게 돌아볼게.` |
| CTA · 수정 | `관계 경험 알려주기` · `관계 경험 답변 고치기` |
| 실제 질문 문장 | `이전 관계에서 생각보다 중요했던 건 뭐였어?` — **과거 시점 그대로** |
| 지금 연인 · 배우자 안내 | `지금 만나는 사람 이야기는 결과 화면의 '지금 관계 속의 나'에서 따로 알려줄 수 있어.` (status dating · married일 때만) |
| 건너뛰기 | `이전 연애가 없어 · 건너뛰기` — 모쏠과 첫 연애 중인 커플/배우자 모두에게 맞는 말 |

⚠️ 디렉팅 기본안(`돌아보고 싶은 관계`)을 채택하지 않은 이유: S15~S17 답은 분석에서 **과거 시점 근거**로 고정돼 있다.
기능 이름이 현재 관계까지 부르면, 배우자를 떠올리고 답한 사용자에게 결과가 `이전 관계에서 …으로 선택`이라고 말한다.
현재 관계는 이미 S30이 **별도 source**로 받는다(v1.41 §39). 그래서 넓히는 곳은 이름이고, 시제는 질문 문장이 지킨다.

---

## 3. 용어 사전

| 사용자-facing 용어 | 뜻 | 쓰는 곳 | 쓰지 않는 곳 | 내부 키 / 매핑 |
|---|---|---|---|---|
| **관계 경험** | 과거·현재를 가리지 않는 상위 기능 이름 | 과거 관계 질문 도입 · 프로필 수정 허브 · Premium 입력 보완 CTA · Relationship Me 레이어 caption · Privacy(`관계 경험은 분석에만 사용해`) · 온보딩 근거 칩 | 분석 근거 문장의 시점 표시 | `answers.experience` · route `/profile/past/*` · `ROUTES.pastIntro` |
| **이전 관계** (status) | '이 사람과 나는'의 답 — 이 상대와의 관계가 이미 지난 것 | 관계 선택 칩 · `TARGET_RELATION_LABEL.ex` | 상위 기능 이름 · CTA · History | `TargetRelation 'ex'` → STAGE `ended` |
| **이전 관계에서 …** (시점) | 근거가 과거 관계 답에서 왔다는 표시 | S15 질문 문장 · Mirror 근거 행 · 근거 시점 라벨(`scopeLabelOf` past) · 지금 관계 속의 나 안내(`지금 해석은 이전 관계에서 답한 내용을 기준으로`) | 기능 이름 | `evidenceScope: 'past'` |
| **지금 관계 / 지금 관계 속의 나** | 지금 만나는 사람과의 관계에서의 나 | 결과 안 accordion · `/profile/current` | ended · none 사용자 화면(권유하지 않는다) | `answers.currentRelationship` · `evidenceScope: 'current'` · `jobInvitesCurrentEvidence` |
| **끝난 관계 / 그때 이 관계** | 이미 끝난 관계를 과거형으로 부를 때 | ended 문장(`그 관계에서` · `그때 이 관계`) | 현재형 문장 | `RelationshipTense 'former'` · STAGE `ended` |
| **연인 · 배우자** | 지금 이 사람과 연인 또는 배우자 사이 | 관계 선택 칩 | STAGE 판정 · 점수 | `TargetRelation 'partner'` (STAGE는 S05 `status`가 정한다) |
| **관찰 기록** | 저장한 self snapshot의 시간순 기록 | 하단 탭(`관찰기록`) · History 목록/상세 · 삭제 문구 | '이전 관계 기록'이라는 이름 — History는 관계를 저장하지 않는다 | `lym.history.v1` · `RelationshipHistoryEntry` |
| **이전 관찰 기록** | History 비교 대상 | History 리포트 · Premium history hook | '이전 관계' (뜻이 다르다) | entries[n-1] |
| **저장한 관계** | 계정에 저장한 상대(과거/현재 중립) | Home 목록 · 저장 동의 | — | `relationship_targets` · `relation_status` |
| **사건** | 사용자가 기억해서 적은 일(호감 · 갈등 등) | 입력 · 리포트 사건 블록 · 근거 칩 · 헤더 · evidenceNote · 동의 문구 | 사진 관찰 | `RelationshipEvent` · `target.events` · `user_reported_event` |
| **장면** (사진 맥락) | 사진에 실제로 찍힌 장면 · 서술적 비유 | 사진 관찰(S09) · Solo History(`카페 장면이 있었어`) · 서술문(`사소한 장면에서`) | 사용자가 적은 사건을 가리킬 때 | `ObservedSignal` · `occurrenceCount` |

---

## 4. 내부 키와 UI 라벨 분리 (rename 금지 목록)

| internal | UI |
|---|---|
| `answers.experience` · `RelationshipExperience` · `markComplete('experience')` | 관계 경험 |
| `ROUTES.pastIntro` · `ROUTES.past(n)` · `/profile/past/*` | 관계 경험 (질문 문장은 '이전 관계에서 …') |
| `evidenceScope: 'past'` | 이전 관계에서 … (근거 시점) |
| `TargetRelation 'ex'` | 이전 관계 (status) |
| `TargetRelation 'partner'` | 연인 · 배우자 |
| `RelationshipStage 'ended'` · `RelationshipTense 'former'` | 끝난 관계 · 그 관계에서 · 그때 이 관계 |
| `answers.currentRelationship` · `/profile/current` | 지금 관계 속의 나 |
| `lym.history.v1` · `/history` | 관찰 기록 |
| `relationship_targets.relation_status` | 저장한 관계 |
| analytics: `relationship_experience_complete` · `relationship_experience_skip` · `profile_complete{path}` | (이름 유지) |

⚠️ 위 internal 이름은 **바꾸지 않는다.** 저장소 · Supabase 컬럼 · analytics key가 이어져 있고, 화면 언어를 바꾸기 위해
데이터를 migration하지 않는다(§31 · §70). 반대로 **화면 문구를 internal 이름으로 되돌리지도 않는다**
(예: 기능 이름을 다시 `이전 관계 경험`으로 쓰는 것). `test:ut-followup` REL-LANG가 이 경계를 고정한다.

---

## 5. 예시

| 상황 | O | X |
|---|---|---|
| 과거 관계 질문 도입 | `이제 관계 경험을 짧게 돌아볼게.` | `이제 이전 관계를 짧게 돌아볼게.` (상위 이름으로 과거만) |
| 배우자 사용자 | `지금 만나는 사람 이야기는 '지금 관계 속의 나'에서 따로 알려줄 수 있어.` | 배우자를 S15 질문으로 부르기 |
| 모쏠 건너뛰기 | `이전 연애가 없어 · 건너뛰기` · `지금의 너부터 관찰해둘게.` | `아직 관계 기록은 없네.` (결핍 프레이밍) |
| History 비교 | `이전 관찰 기록과 비교하면` | `이전 관계와 비교하면` (뜻이 다르다) |
| 끝난 관계 리포트 | `그 관계에서 기억나는 사건 하나를 받았어.` | `이 관계에서 …` (시제 오류) |
| 사진 | `사진에서 이런 장면이 보였어.` | `사진에서 이런 사건이 보였어.` |
| 금지 뉘앙스 | `기억나는 일이 있으면 알려줘. 없으면 넘어가도 돼.` | `과거를 분석해` · `이전 관계를 평가해` · `연애를 진단해` |
