import type {
  RelationshipActionKind,
  RelationshipJob,
  RelationshipStage,
  RelationshipStatus,
  SessionAnswers,
  SoloMode,
  TargetProfile,
} from '@/types';

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
  const stage = resolveRelationshipStage(answers.status);
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
  long_term: ['align', 'try', 'notice'],
  ended: ['reflect', 'notice'],
};

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
