import { pickQuestionVariant } from '@/data/conversationQuestions';
import type {
  CompatibilityResult,
  ConversationQuestion,
  CurrentRelationshipEvidence,
  DeclaredPreference,
  RelationshipJob,
  TargetAxisKey,
  TargetProfile,
} from '@/types';
import { selfLevelOf } from './firstContact';
import { jobAllowsOutwardQuestions } from './relationshipStage';

/**
 * 대화 질문 조립 (S25)
 *
 * ⚠️ **`logic/compatibility.ts`에서 분리했다 (UT-1 P1-B §3).**
 *
 * 질문 variant 선택은 사용자가 적어준 **관계 사건의 종류**를 읽는다. 그런데
 * 그 파일은 동기화율 **점수 계층**이고, v1.46 §11은 점수 계층이 사건을 한 글자도
 * 읽지 않는다는 것을 **소스 스캔으로** 고정해두었다(EVT-13). 그 불변식을 느슨하게
 * 만들지 않기 위해 질문 조립만 이 파일로 옮겼다 — 경계를 물리적으로 나눠둔다.
 *
 * ⚠️ 이 파일은 **점수를 계산하지 않는다.** 이미 계산된 `CompatibilityResult`를
 * 읽기만 하고, 사건은 **종류만** 본다(본문은 읽지 않는다).
 */

/**
 * 대화 질문 (S25)
 * 차이가 보이는 항목을 먼저 넣고, 부족하면 관계에서 자주 부딪히는 축으로 채운다.
 */
const QUESTION_FALLBACK_ORDER: TargetAxisKey[] = ['contact', 'conflict', 'alone'];
export const CONVERSATION_QUESTION_COUNT = 3;

/**
 * UT-1 P1-B §3 — 질문 선택에 필요한 맥락.
 *
 * ⚠️ **새 판정을 만들지 않는다.** 다섯 값 전부 다른 곳에서 이미 계산된 것을 그대로
 * 받는다(`resolveRelationshipContext`의 job · `answers.declared` · `answers.target` ·
 * `answers.currentRelationship`). 이 함수는 그 값으로 **문장만** 고른다.
 */
export interface ConversationQuestionContext {
  job: RelationshipJob;
  declared: DeclaredPreference;
  target: TargetProfile;
  currentSignals: CurrentRelationshipEvidence;
}

export function buildConversationQuestions(
  result: CompatibilityResult,
  context: ConversationQuestionContext,
): ConversationQuestion[] {
  /**
   * ⚠️ **Safety — `ended`·`none`에서는 상대에게 던지는 질문을 만들지 않는다.**
   *
   * 지금까지 이 게이트는 **화면에만** 있었다(`/compatibility`가
   * `jobAllowsOutwardQuestions(job)`로 갈랐다). 그건 v1.43 §43이 AI Task에서 닫은
   * 것과 같은 형태의 구멍이다 — 같은 종류의 출력을 만드는 경로가 늘어나면 한 곳이
   * 빠진다. 생성기 자체가 빈 배열을 돌려주면 새 화면이 생겨도 샐 곳이 없다.
   *
   * ⚠️ 회고 질문으로 대신 채우지 않는다 — 그건 `REFLECTION_QUESTIONS`의 몫이고,
   * 두 곳이 같은 역할의 블록을 만들면 §22가 금지한 중복이 된다.
   */
  if (!jobAllowsOutwardQuestions(context.job)) return [];

  const frictionKeys = result.frictionSignals.map((f) => f.key);
  const keys: TargetAxisKey[] = [...frictionKeys];

  for (const key of QUESTION_FALLBACK_ORDER) {
    if (!keys.includes(key)) keys.push(key);
  }

  const eventTypes = (context.target.events ?? []).map((event) => event.type);

  return keys.slice(0, CONVERSATION_QUESTION_COUNT).map((key) => {
    const dimension = result.dimensions.find((d) => d.key === key);
    const label = dimension?.label ?? key;
    const fromFriction = frictionKeys.includes(key);

    /**
     * UT-1 P1-B §3 — 축 하나에 문장 하나가 아니라 **맥락에 맞는 variant**를 고른다.
     * 랜덤이 없으므로 같은 세션에서는 같은 문장이 나온다(`pickQuestionVariant`).
     */
    const variant = pickQuestionVariant(key, {
      job: context.job,
      declared: selfLevelOf(key, context.declared),
      targetLevel: context.target[key],
      hasCurrentSignal: context.currentSignals.signals[key] !== undefined,
      eventTypes,
    });

    return {
      id: key,
      tag: `${label} · ${fromFriction ? '차이가 보이는 항목' : '확인해보면 좋은 항목'}`,
      text: variant.text,
      fromFriction,
    };
  });
}
