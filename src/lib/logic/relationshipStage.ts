import type {
  RelationshipActionKind,
  RelationshipJob,
  RelationshipStage,
  RelationshipStatus,
  SessionAnswers,
  SoloMode,
  TargetProfile,
} from '@/types';

import { STAGE_JOB_COPY } from '@/data/stageCopy';

import type { RelationshipTense } from './relationshipEvidence';
import { soloModeOfTarget } from './soloMode';

/**
 * Relationship Lifecycle — Stage · Sufficiency · Job (v1.40 · §37)
 *
 * ══ 이 파일이 하는 일과 하지 않는 일 ══════════════════════════════════════════
 *
 * **하는 일:** 지금 이 사용자가 관계의 어느 지점에 있는지(STAGE)와 상대를 얼마나
 * 알려줬는지(SUFFICIENCY)를 읽어, **지금 필요한 일**(JOB)을 고른다. JOB은 화면이
 * 같은 사실을 어떤 문장으로 감싸고 어떤 행동을 제안할지 결정한다.
 *
 * **하지 않는 일:** 판정을 만들지 않는다. 동기화율·`comparedCount`·Mirror
 * MATCH/GAP/CHANGE·History STABLE/SHIFT/NEW·MBTI·Premium eligibility 어디에도
 * 이 파일의 값이 들어가지 않는다.
 *
 * ```
 * DETERMINISTIC FACT      관계 단계가 달라도 불변
 * CONTEXTUAL JOB          관계 단계에 따라 달라진다
 * ```
 *
 * 같은 CONTACT GAP이라도 썸이면 '무엇을 확인할까', 연애 중이면 '기대를 어떻게
 * 조율할까', 관계가 끝났으면 '이 차이가 내 기준에 무엇을 남겼나'다. **사실을
 * 바꾸는 게 아니라 사실의 사용법을 바꾼다.**
 *
 * ══ 왜 두 축인가 ═══════════════════════════════════════════════════════════
 *
 * v1.39까지 이 제품에는 두 개의 서로 다른 축이 이미 있었지만 한 번도 나란히
 * 놓이지 않았다.
 *
 * | 축 | 값 | 누가 정하나 | 뜻 |
 * |---|---|---|---|
 * | **STAGE** | `RelationshipStage` 5종 | 사용자가 S05에서 **선택** | 나는 지금 관계의 어디에 있나 |
 * | **SUFFICIENCY** | `SoloMode` 3종 | 상대 입력에서 **도출** | 비교할 만큼 상대를 알려줬나 |
 *
 * 이 둘을 하나의 enum으로 관리하면 분기가 반드시 꼬인다 — `dating`인데 상대 정보를
 * 아직 안 넣은 사용자와 `crush`인데 4축을 다 넣은 사용자는 **다른 사람**이다.
 * 그래서 `unknown`은 STAGE가 아니라 **JOB**이다: "관계 단계와 무관하게, 지금은
 * 비교할 근거가 모자라다"는 상태이므로 단계 목록에 끼워 넣지 않는다.
 *
 * ⚠️ **새 저장 필드를 만들지 않았다.** STAGE는 이미 저장되고 있는
 * `answers.status`(v1.0부터 존재)에서 도출하고, SUFFICIENCY는 이미 있는
 * `soloModeOfTarget()`을 그대로 부른다. 그래서 v1.39 이전 세션도 **마이그레이션
 * 없이** 그대로 읽힌다(§37.4).
 */

/* ─────────────────────────────────────────────── STAGE (사용자가 선택한 단계) */

/**
 * `answers.status`(사용자 선택) → STAGE.
 *
 * `status`를 그대로 쓰지 않고 한 겹 두는 이유: `solo_none`/`solo_exp`는 **연애 경험
 * 유무**라는 다른 정보를 함께 담고 있어서(Mirror 가용성 판정에 쓰인다) 단계로는
 * 둘 다 `none`이다. 경험 유무는 `answers.experience`가 이미 따로 말한다.
 *
 * `null`(아직 고르지 않음)도 `none`이다 — 없는 상대를 전제하지 않는다.
 */
const STAGE_OF_STATUS: Record<RelationshipStatus, RelationshipStage> = {
  solo_none: 'none',
  solo_exp: 'none',
  crush: 'talking',
  dating: 'dating',
  married: 'long_term',
  ended: 'ended',
};

export function resolveRelationshipStage(status: RelationshipStatus | null): RelationshipStage {
  if (status === null) return 'none';
  // 레거시 세션에 알 수 없는 값이 들어 있어도 죽지 않는다 — 모르면 추측하지 않고 none이다.
  return STAGE_OF_STATUS[status] ?? 'none';
}

/**
 * UT-1 P1-A §4 — **지금 보고 있는 상대가 '이전 관계'면 STAGE는 `ended`다.**
 *
 * S05(`answers.status`)는 *내 연애 상태*를 묻고, S19의 `이 사람과 나는`은 *이 상대와의
 * 관계*를 묻는다. 두 답이 갈릴 수 있다 — 새 연애 중(`dating`)이면서 예전 사람을 한 번
 * 돌아보는 사용자가 그렇다. 그때 STAGE를 `status`만으로 읽으면 **헤어진 상대에게
 * `먼저 연락해봐`를 제안**하게 된다(`jobAllowsOutwardAction('dating') === true`).
 *
 * ⚠️ **새 규칙이 아니라 §37의 ②를 그대로 적용한 것이다** — "사용자가 고른 단계보다
 * 실제로 넣은 데이터를 더 신뢰한다". `none` + `couple`을 `talking`으로 올리는 줄과
 * 같은 근거이고, 방향만 반대다(더 안전한 쪽으로 내린다).
 *
 * ⚠️ **`ended`로 내리기만 한다.** `status: 'ended'`인 사용자가 상대를 `crush`로
 * 고른다고 해서 `talking`으로 올리지 않는다 — 안전 규칙을 사용자의 다른 답변으로
 * 해제하지 않는다.
 *
 * ⚠️ 판정(동기화율·Mirror·History)은 이 값을 읽지 않는다(이 파일 상단 주석).
 */
export function resolveRelationshipStageOf(answers: SessionAnswers): RelationshipStage {
  if (answers.target.relation === 'ex') return 'ended';
  return resolveRelationshipStage(answers.status);
}

/* ────────────────────────────────────── SUFFICIENCY (상대 정보가 충분한가) */

/**
 * 상대 데이터 충분도. **이미 있는 판정을 그대로 쓴다** — 두 벌 만들지 않는다.
 *
 * `couple` 비교 가능 · `unknown_target` 사람은 있는데 아는 게 적다 ·
 * `no_target` 지금 특정 상대가 없다.
 */
export function resolveTargetSufficiency(target: TargetProfile): SoloMode {
  return soloModeOfTarget(target);
}

/* ──────────────────────────────────────────────────────── JOB (지금 필요한 일) */

/**
 * (STAGE × SUFFICIENCY) → JOB.
 *
 * 규칙은 두 개다.
 *  ① **비교할 근거가 없으면 비교를 Job으로 주지 않는다.**
 *  ② **사용자가 고른 단계보다 실제로 넣은 데이터를 더 신뢰한다.**
 *
 * | STAGE | SUFFICIENCY | JOB | 왜 |
 * |---|---|---|---|
 * | ended | 무엇이든 | `ended` | 회고의 주어는 나다 — 상대 정보가 적어도 성립한다 |
 * | none | `no_target` | `none` | 상대 신호가 하나도 없다 — 내 기준을 본다 |
 * | none | `unknown_target` | `unknown` | 사람은 있는데 아는 게 적다 |
 * | none | `couple` | **`talking`** | ② — 아래 참고 |
 * | talking/dating/long_term | `couple` | 그 단계 그대로 | 비교할 수 있다 |
 * | talking/dating/long_term | `unknown_target`·`no_target` | `unknown` | 아직 비교할 근거가 모자라다 |
 *
 * ⚠️ **`none` + `couple`을 `none`으로 두면 안 된다.** S05에서 `솔로 · 연애 경험 있음`을
 * 고른 사용자도 S19에서 상대 4축을 넣을 수 있고(v1.29부터 정상 경로다), 실제로 **샘플
 * 세션이 정확히 이 조합**이다(`status: 'solo_exp'` + target 4축 전부). 그 사용자에게
 * "지금은 비교할 상대가 없으니"라고 말하면서 동기화율을 보여주면 화면이 자기 모순에
 * 빠진다. 그래서 **비교할 근거가 실제로 있으면 알아가는 중으로 본다** — 사용자가 고른
 * 라벨보다 사용자가 넣은 데이터가 더 최신 사실이다.
 *
 * ⚠️ 반대로 `dating` + `no_target`을 `none`으로 떨어뜨려도 안 된다. 연애 중이라고 답한
 * 사용자에게 "상대가 없다"고 말하는 셈이다 — 그건 상대가 없는 게 아니라 **아직 알려주지
 * 않은** 것이므로 `unknown`이다.
 */
export function resolveRelationshipJob(input: {
  stage: RelationshipStage;
  sufficiency: SoloMode;
}): RelationshipJob {
  const { stage, sufficiency } = input;
  if (stage === 'ended') return 'ended';

  if (stage === 'none') {
    if (sufficiency === 'couple') return 'talking';
    return sufficiency === 'unknown_target' ? 'unknown' : 'none';
  }

  return sufficiency === 'couple' ? stage : 'unknown';
}

/** 세션 하나에서 세 값을 함께 읽는다 — 화면이 조합 규칙을 다시 쓰지 않게 한다 */
export interface RelationshipContextResolution {
  stage: RelationshipStage;
  sufficiency: SoloMode;
  job: RelationshipJob;
}

export function resolveRelationshipContext(
  answers: SessionAnswers,
): RelationshipContextResolution {
  const stage = resolveRelationshipStageOf(answers);
  const sufficiency = resolveTargetSufficiency(answers.target);
  return { stage, sufficiency, job: resolveRelationshipJob({ stage, sufficiency }) };
}

/* ──────────────────────────────────────────────────── JOB별 허용 ACTION KIND */

/**
 * JOB이 허용하는 행동의 종류.
 *
 * ```
 * ASK      물어본다        상대에게 확인할 것
 * TRY      해본다          같이 해볼 것
 * NOTICE   알아둔다        판단하지 않고 관찰만
 * ALIGN    맞춘다          이미 아는 차이를 조율
 * REFLECT  돌아본다        주어가 나인 행동
 * ```
 *
 * ⚠️ **가장 중요한 줄은 `ended`다.** `ASK`·`TRY`·`ALIGN`이 전부 빠져 있다 —
 * 관계가 끝난 사용자에게 상대에게 물어보라거나 같이 해보라고 제안하지 않는다.
 * 이 배열이 그 금지를 코드로 강제한다(§37.9).
 *
 * ⚠️ `none`에도 `ASK`가 없다. 없는 상대에게 물어볼 것을 만들지 않는다.
 */
export const JOB_ACTION_KINDS: Record<RelationshipJob, readonly RelationshipActionKind[]> = {
  none: ['notice', 'reflect'],
  unknown: ['ask', 'notice'],
  talking: ['ask', 'try', 'notice'],
  dating: ['ask', 'align', 'try'],
  // v1.40.1 — `ask` 추가. 이유는 아래 참고
  long_term: ['ask', 'align', 'try', 'notice'],
  ended: ['reflect', 'notice'],
};

/**
 * v1.40.1 — **`long_term`에 `ask`를 넣었다** (§38.4)
 *
 * v1.40에서는 `['align','try','notice']`였다. 그런데 `jobAllowsOutwardQuestions()`가
 * 이 배열의 `ask`를 보므로, 화면은 `한 번쯤 같이 이야기해볼 질문`이라는 라벨 아래에
 * **주어가 나인 `REFLECTION_QUESTIONS.none` 3개**를 그렸다(실측). 라벨과 내용이 어긋났다.
 *
 * 두 방향이 가능했다.
 *
 * | | 무엇을 바꾸나 | 왜 아닌가 / 왜 맞나 |
 * |---|---|---|
 * | A | `ask`를 허용한다 | **채택** |
 * | B | 라벨을 자기회고로 바꾼다 | 아래 세 가지와 충돌한다 |
 *
 * **A를 고른 이유는 구현 편의가 아니라 Job 정의 자체다.**
 *
 *  ① **`align`은 `ask` 없이 성립하지 않는다.** `long_term`의 PRIMARY JOB은 `반복되는
 *    기대 차이를 조율한다`이고 `align`은 '이미 아는 차이를 맞춘다'다. 상대와 한마디도
 *    하지 않고 맞추는 방법은 없다. 물어보기를 막으면서 같이 해보기(`try`)와
 *    맞추기(`align`)를 허용하는 것은 **더 깊이 관여하는 행동만 남기고 가벼운 행동을
 *    금지한** 셈이다 — 안전 방향이 거꾸로다.
 *  ② **SECONDARY JOB이 `장기적 대화 방식`이다.** 질문을 만들 수 없는 '대화 방식' Job은
 *    자기 모순이다.
 *  ③ **`long_term`의 실제 금지선은 질문이 아니다.** `AVOID`는 `없는 생활 문제 생성`이고,
 *    fixture의 `LONG_TERM_FORBIDDEN`도 가사·재정·양육·주거·성생활이다. 우리가 받지 않은
 *    데이터를 말하지 않는 것이 이 단계의 제약이고, 상대에게 말을 거는 것은 아니다.
 *  ④ `jobAllowsOutwardAction('long_term')`은 v1.40부터 이미 `true`였다 — 즉 제품은
 *    이 단계를 **진행 중인 관계**로 이미 취급하고 상대를 향한 Approach Hint를 주고 있었다.
 *    질문 채널만 반대였다.
 *
 * 결과적으로 `ask`가 없는 Job은 `ended`(상대가 없다)와 `none`(상대가 아직 없다) 둘뿐이고,
 * 그 둘이 정확히 `jobAllowsOutwardAction()`이 false인 집합이다. **두 술어가 이제 같은
 * 집합을 가리킨다** — 서로 다른 질문이므로 함수는 둘 다 유지하지만, 답이 갈리는 Job이
 * 생기면 그건 정책 변경이지 버그가 아니다.
 *
 * ⚠️ 이 변경으로 `long_term` 사용자는 `buildConversationQuestions()`의 결정론적 질문
 * (`연락이 줄어들면 어떤 의미로 받아들이는 편이야?` 등 4축)을 받는다. 그 문장들에는
 * `LONG_TERM_FORBIDDEN` 어휘가 하나도 없다(fixture가 확인한다). **판정·점수는 하나도
 * 바뀌지 않는다** — 질문 생성은 v1.0부터 `compatibility` 결과만 읽는다.
 */

export function jobAllowsAction(job: RelationshipJob, kind: RelationshipActionKind): boolean {
  return JOB_ACTION_KINDS[job].includes(kind);
}

/**
 * 이 JOB에서 **상대를 향한 행동**을 제안해도 되는가.
 *
 * `ended`와 `none`이 false다. 화면은 이 값 하나만 보고 Approach Hint 블록 자체를
 * 그릴지 결정한다 — 카드마다 조건을 흩뿌리면 한 곳을 빼먹는다.
 */
export function jobAllowsOutwardAction(job: RelationshipJob): boolean {
  return job !== 'ended' && job !== 'none';
}

/**
 * 이 JOB에서 **상대에게 물어볼 질문**을 추천해도 되는가.
 *
 * `ended`는 false다. 대신 주어가 나인 회고 질문을 받는다(§37.12).
 */
export function jobAllowsOutwardQuestions(job: RelationshipJob): boolean {
  return jobAllowsAction(job, 'ask');
}

/* ─────────────────────────────────── Deep Report에 넘길 Job 문맥 (v1.40.1) */

/**
 * Premium Deep Report가 Job에서 읽어야 하는 값 **전부**. (v1.40.1 · §38.2)
 *
 * ══ 왜 이 함수가 있어야 하는가 ═══════════════════════════════════════════
 *
 * v1.40의 결함은 `ended` 판정이 틀린 게 아니었다. **판정을 읽는 곳이 두 군데였고 한
 * 곳이 빠졌다.**
 *
 * ```
 * hooks/useDeepReport.ts                    allowsOutwardAction 전달  ✅
 * app/premium-preview/[feature]/page.tsx    아무것도 전달 안 함        ❌  ← 기본값 true
 * ```
 *
 * 그리고 하필 후자가 **Deep Report 본문을 실제로 여는 유일한 경로**였다
 * (`/premium`의 본문은 `PREMIUM_PREVIEW && …` 뒤에 있다). 즉 게이트를 optional로 두고
 * 기본값을 허용으로 잡은 결정이, 게이트가 가장 필요한 화면에서 게이트를 껐다.
 *
 * 그래서 v1.40.1은 값을 하나 더 넘기는 대신 **문맥 객체 하나를 필수로** 만든다.
 * 새 호출부가 이걸 빼먹으면 `tsc`가 막는다 — 사람의 기억이 아니라 타입이 지킨다.
 *
 * ⚠️ **여기서 판정을 만들지 않는다.** 세 값 전부 이미 있는 것을 조합할 뿐이다:
 * 두 개는 기존 술어(`jobAllowsOutwardAction`/`jobAllowsOutwardQuestions`), 하나는
 * 기존 문구(`STAGE_JOB_COPY[job].nowWhatTitle`). **§37의 원칙 그대로 — stage는
 * evidence가 아니고, 여기 있는 것도 전부 framing과 안전 게이트다.**
 */
export interface DeepReportJobContext {
  /** 상대를 향한 행동(TRY·CHECK·Approach Insight)을 만들어도 되는가 */
  allowsOutwardAction: boolean;
  /** 상대에게 던지는 질문을 만들어도 되는가 */
  allowsOutwardQuestions: boolean;
  /** 행동·질문 섹션 제목. 무료 화면 `04 NOW WHAT`과 **같은 문구**를 쓴다 */
  actionSectionTitle: string;
  /**
   * v1.41 §39.13 — 이 리포트에서 **관계를 어떻게 부르는가**.
   *
   * v1.40.1은 `ended`의 **대상**(누구에게 하는 행동인가)을 닫고 **시제**는 남겼다.
   * 남은 것이 §38.11의 첫 줄이었다: `지금 상대와 …` · `지금 이 관계에서도 …` ·
   * `상대에게 미리 말해주는 방법` · `상대에게 어떻게 설명하는 편이야?`. 넷 다
   * 행동 제안이 아니라 **끝난 관계를 진행 중인 것처럼 부르는 호칭**이었다.
   *
   * ⚠️ 이 값은 evidence를 바꾸지 않는다. 근거의 출처·강도·개수·판정 전부 그대로이고,
   * 바뀌는 것은 그 근거를 문장에서 부르는 이름뿐이다 — 시제를 맞추려고 evidence
   * source를 바꾸는 것이 §37.20이 금지한 바로 그 행위다.
   */
  tense: RelationshipTense;
}

/**
 * Job → 시제. **6종을 2종으로 좁혀서 넘긴다.** (v1.41 §39.13)
 *
 * 좁히는 것이 요점이다. `RelationshipJob`을 그대로 하위 모듈에 흘리면 문장 생성기마다
 * Job별 분기가 자라고, 그러면 '한 곳을 빼먹는' v1.40의 실패 형태가 되돌아온다.
 * 문장 생성기가 알아야 하는 것은 **관계가 진행 중인가 끝났는가** 딱 하나다.
 *
 * ⚠️ `none`(상대가 아직 없다)은 `'current'`다. 부를 관계가 없으므로 시제 자체가
 * 쓰이지 않고, `'former'`로 두면 없던 과거 관계를 전제하게 된다.
 */
export function relationshipTenseOf(job: RelationshipJob): RelationshipTense {
  return job === 'ended' ? 'former' : 'current';
}

export function deepReportJobContext(job: RelationshipJob): DeepReportJobContext {
  return {
    allowsOutwardAction: jobAllowsOutwardAction(job),
    allowsOutwardQuestions: jobAllowsOutwardQuestions(job),
    actionSectionTitle: STAGE_JOB_COPY[job].nowWhatTitle,
    tense: relationshipTenseOf(job),
  };
}

/**
 * v1.41 §39.6 — 이 Job에게 **지금 관계 근거(S30)를 권해도 되는가.**
 *
 * ⚠️ **이 값이 Resolver에 들어가지 않는다.** 여기서 false인 Job의 사용자가 이미
 * 넣어둔 현재 근거는 그대로 쓰인다(`relationshipEvidence.ts` 상단 표). 이 함수가
 * 정하는 것은 **화면이 권유를 띄우는가** 하나뿐이다 — 수집 정책과 해석 정책을
 * 분리하는 것이 §39의 핵심이다.
 *
 * | JOB | 권유 | 왜 |
 * |---|---|---|
 * | `dating` `long_term` | ✅ | Job이 이미 `지금 관계에서 조율`이다. 근거가 없으면 그 Job을 할 수 없다 |
 * | `talking` | ❌ | 아직 관계로 확정되지 않았다. `지금 관계`라고 부르는 것 자체가 관계를 확정하는 셈이다 |
 * | `unknown` `none` | ❌ | 부를 관계가 없다 |
 * | `ended` | ❌ | 끝난 관계에 대해 새 관찰을 시작하게 만들지 않는다(§37.13 반추 루프) |
 */
export function jobInvitesCurrentEvidence(job: RelationshipJob): boolean {
  return job === 'dating' || job === 'long_term';
}
