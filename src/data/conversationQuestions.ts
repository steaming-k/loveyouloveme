import type { SelfLevel } from '@/data/firstContact';
import type {
  RelationshipEventType,
  RelationshipJob,
  TargetAxisKey,
  TargetLevel,
} from '@/types';

/**
 * 대화 질문 Variant Bank (UT-1 P1-B · §3 · §4)
 *
 * ══ 왜 바꿨나 ═══════════════════════════════════════════════════════════════
 *
 * UT-1에서 **가장 가치 있다고 평가된 것이 '상대에게 확인할 질문'**이었다. 그런데 그
 * 질문은 `QUESTION_BY_AXIS` — 축마다 **문자열 하나씩, 총 4개**였다. 누가 어떤 관계
 * 단계에 있든, 상대를 얼마나 알든, 무엇을 답했든 **똑같은 네 문장**이 나왔다.
 *
 * 그래서 같은 사용자가 두 번째 상대를 분석해도 질문이 한 글자도 달라지지 않았고,
 * 회고 중인 사용자와 막 알아가는 사용자가 같은 문장을 받았다.
 *
 * ⚠️ **개수를 늘리는 것이 목적이 아니다**(§3). 화면에 나가는 질문 수는 그대로
 * (`CONVERSATION_QUESTION_COUNT` 3 + MBTI 보조)이고, 늘어나는 것은 **같은 자리에
 * 들어갈 수 있는 후보의 다양성**이다.
 *
 * ══ 이 파일이 하지 않는 것 ═════════════════════════════════════════════════
 *
 * ⚠️ **판정을 만들지 않는다.** 여기 있는 것은 문장과 '언제 이 문장이 맞는가'라는
 * 조건뿐이다. 조건에 쓰는 값(`job` · `TargetLevel` · `SelfLevel` · 사건 종류)은 전부
 * 이미 다른 곳에서 계산된 것을 읽기만 한다. 동기화율·Mirror·History는 이 파일을
 * 알지 못한다.
 *
 * ⚠️ **상대의 의도·마음을 묻지 않는다.** 모든 문장은 상대에게 **직접 물어보는 말**이지
 * 상대가 속으로 어떤지 추정하는 말이 아니다. `상대가 왜 그랬을까?` 같은 문장은 없고
 * 앞으로도 만들지 않는다(Safety: partner intent 추정 금지).
 *
 * ⚠️ **성공 확률·해야 할 일을 말하지 않는다.** `이렇게 물어보면 좋아질 거야`는 없다.
 *
 * ⚠️ **`ended`·`none`은 여기 없다.** 그 두 Job에서는 상대에게 던지는 질문 자체를
 * 만들지 않는다(`jobAllowsOutwardQuestions`). 회고 질문은
 * `REFLECTION_QUESTIONS`(`data/stageCopy.ts`)가 담당하고, 이 파일은 그 경계를
 * 넘지 않는다 — `jobs`에 `ended`/`none`을 적은 variant가 하나도 없고,
 * `buildConversationQuestions`도 그 Job에서는 빈 배열을 돌려준다.
 */

/**
 * variant가 언제 맞는가. **전부 optional**이고, 비어 있으면 '언제나 맞는다'는 뜻이다.
 *
 * 조건이 많을수록 더 구체적인 상황을 가리키므로 선택에서 우선한다
 * (`pickQuestionVariant`의 specificity).
 */
export interface QuestionCondition {
  /** 관계 Job. 비어 있으면 outward 질문이 허용되는 모든 Job */
  jobs?: readonly RelationshipJob[];
  /** 이 축에 대해 사용자가 답한 단계 */
  declared?: readonly SelfLevel[];
  /**
   * 이 축에 대해 사용자가 **상대에 대해** 알려준 값.
   * `'x'`(모름)를 넣은 variant는 '상대를 아직 모를 때' 쓰는 질문이다 — target availability.
   */
  targetLevel?: readonly TargetLevel[];
  /** 지금 관계 근거(S30)를 이 축에 답했는가 — current/past evidence scope */
  hasCurrentSignal?: boolean;
  /**
   * 사용자가 직접 적어준 사건 종류가 있는가.
   *
   * ⚠️ 사건 **본문을 읽지 않는다.** 종류만 본다 — 자유 입력이 문장 생성에 흘러가지
   * 않게 하는 기존 경계(`lib/logic/relationshipEvents.ts`)를 그대로 지킨다.
   */
  eventTypes?: readonly RelationshipEventType[];
}

export interface QuestionVariant {
  /**
   * 안정 식별자. `savedQuestions`는 축 id로 저장하므로 이 값은 저장에 쓰이지 않지만,
   * fixture가 '어떤 variant가 골라졌는지'를 문장이 아니라 값으로 검사한다.
   */
  id: string;
  text: string;
  when?: QuestionCondition;
}

/**
 * 축별 variant. **첫 항목은 항상 조건 없는 base**다 — 어떤 상황에서도 고를 게 남아 있어야
 * 한다(AI가 실패해도 질문이 사라지지 않는 것과 같은 성질).
 *
 * ⚠️ 순서가 tie-break다. 같은 specificity면 먼저 적힌 것이 이긴다 — 랜덤이 없다.
 */
export const QUESTION_VARIANTS: Record<TargetAxisKey, readonly QuestionVariant[]> = {
  conflict: [
    {
      /**
       * ⚠️ UT-1 §4 교체 대상 — 예전 문장은 `싸웠을 때 어느 정도 시간이 필요해?`였다.
       * `싸웠을 때`는 이미 싸웠다는 전제를 깔고, `어느 정도 시간`은 양을 묻는다.
       * 지금 문장은 전제를 빼고 **두 방식 중 어느 쪽이 편한지**를 고르게 한다.
       */
      id: 'conflict_base',
      text: '서로 예민해졌을 때 바로 이야기하는 편이 편해, 조금 정리한 뒤 이야기하는 편이 편해?',
    },
    {
      id: 'conflict_unknown_target',
      text: '의견이 갈렸을 때 너는 보통 어떻게 푸는 편이야?',
      when: { targetLevel: ['x'] },
    },
    {
      id: 'conflict_gap_now_vs_later',
      text: '나는 그날 안에 이야기하는 게 편한 편인데, 너는 언제 이야기하는 게 가장 편해?',
      when: { declared: ['high'], targetLevel: ['l'] },
    },
    {
      id: 'conflict_gap_later_vs_now',
      text: '나는 조금 정리한 뒤에 이야기하는 게 편한 편인데, 너는 어떤 쪽이 편해?',
      when: { declared: ['low'], targetLevel: ['h'] },
    },
    {
      /** 사용자가 갈등 장면을 직접 적어줬을 때만. **그 장면의 내용은 인용하지 않는다** */
      id: 'conflict_after_event',
      text: '지난번처럼 이야기가 어긋났을 때, 어떤 식으로 말해주면 네가 덜 답답할 것 같아?',
      when: { eventTypes: ['conflict', 'distance'] },
    },
    {
      id: 'conflict_long_term',
      text: '같은 얘기가 반복될 때, 우리가 어떤 식으로 정리하면 서로 덜 지칠 것 같아?',
      when: { jobs: ['long_term'] },
    },
  ],

  alone: [
    {
      /**
       * ⚠️ UT-1 §4 교체 대상 — 예전 문장은
       * `혼자 있고 싶을 때 상대에게 어떻게 알려주는 게 편해?`였다. 주어가 흐려서
       * (누가 누구에게) 읽는 사람마다 다르게 읽혔고, `알려주는 게 편해`는 이미
       * 알려야 한다는 전제를 깐다. 지금 문장은 **둘 다의 방식**을 함께 묻는다.
       */
      id: 'alone_base',
      text: '각자 쉬고 싶은 날에는 서로 어떻게 알려주면 가장 편할 것 같아?',
    },
    {
      id: 'alone_unknown_target',
      text: '혼자 보내는 시간은 보통 어느 정도가 편한 편이야?',
      when: { targetLevel: ['x'] },
    },
    {
      id: 'alone_both_high',
      text: '둘 다 혼자만의 시간이 필요한 편인 것 같은데, 그런 날에 서로 어떻게 지내면 좋을까?',
      when: { declared: ['high'], targetLevel: ['h'] },
    },
    {
      id: 'alone_gap',
      text: '혼자 있고 싶은 날이 서로 다를 때, 어떻게 말해주면 서운하지 않을 것 같아?',
      when: { declared: ['high'], targetLevel: ['l'] },
    },
    {
      id: 'alone_current_signal',
      text: '요즘처럼 각자 바쁠 때, 쉬는 시간을 어떻게 나누면 서로 편할 것 같아?',
      when: { hasCurrentSignal: true, jobs: ['dating', 'long_term'] },
    },
  ],

  contact: [
    {
      id: 'contact_base',
      text: '연락이 뜸해지는 날에는 보통 어떤 상황일 때가 많아?',
    },
    {
      id: 'contact_unknown_target',
      text: '평소에 연락은 어느 정도 주고받는 게 편한 편이야?',
      when: { targetLevel: ['x'] },
    },
    {
      id: 'contact_gap_high_low',
      text: '나는 연락이 자주 오가는 쪽이 편한 편인데, 너는 어느 정도가 편해?',
      when: { declared: ['high'], targetLevel: ['l'] },
    },
    {
      id: 'contact_gap_low_high',
      text: '나는 연락 빈도에 크게 신경 쓰지 않는 편인데, 너는 뜸해지면 어떻게 느껴?',
      when: { declared: ['low'], targetLevel: ['h'] },
    },
    {
      /** 연락의 변화를 직접 적어준 경우 */
      id: 'contact_after_event',
      text: '답장 간격이 달라지는 날에는, 미리 한마디 해주는 게 편해 아니면 그냥 두는 게 편해?',
      when: { eventTypes: ['contact_change'] },
    },
    {
      id: 'contact_talking',
      text: '알아가는 동안에는 연락을 어느 정도로 주고받는 게 서로 부담 없을까?',
      when: { jobs: ['talking', 'unknown'] },
    },
  ],

  affection: [
    {
      id: 'affection_base',
      text: '표현을 받을 때, 말로 듣는 쪽과 행동으로 느끼는 쪽 중 어느 쪽이 더 와닿아?',
    },
    {
      id: 'affection_unknown_target',
      text: '애정 표현은 어느 정도가 편한 편이야?',
      when: { targetLevel: ['x'] },
    },
    {
      id: 'affection_gap_high_low',
      text: '나는 표현을 자주 하는 편인데, 너는 어느 정도가 편하게 느껴져?',
      when: { declared: ['high'], targetLevel: ['l'] },
    },
    {
      id: 'affection_gap_low_high',
      text: '나는 담백한 편인데, 표현이 적으면 너는 어떻게 느껴?',
      when: { declared: ['low'], targetLevel: ['h'] },
    },
    {
      id: 'affection_after_event',
      text: '챙김을 받았다고 느끼는 순간은 보통 어떤 때야?',
      when: { eventTypes: ['care_received', 'affection_felt', 'closer'] },
    },
  ],
};

/**
 * 지금 상황에 맞는 variant 하나를 고른다.
 *
 * ⚠️ **랜덤이 없다.** 같은 입력에는 항상 같은 문장이 나온다 — 리포트는 새로고침할
 * 때마다 달라지면 안 된다(v1.20 이후 결정론 원칙). 선택 규칙은 두 줄이다:
 *
 *   ① 조건을 **전부** 만족하는 variant만 후보다
 *   ② 그중 조건을 **더 많이** 건 variant가 이긴다(같으면 먼저 적힌 것)
 *
 * ②는 '더 구체적인 상황을 말하는 문장이 이긴다'는 뜻이다. base(조건 0개)는 언제나
 * 후보지만 언제나 진다 — 즉 마지막 fallback이다.
 */
export function pickQuestionVariant(
  axis: TargetAxisKey,
  context: {
    job: RelationshipJob;
    declared: SelfLevel | null;
    targetLevel: TargetLevel;
    hasCurrentSignal: boolean;
    eventTypes: readonly RelationshipEventType[];
  },
): QuestionVariant {
  const variants = QUESTION_VARIANTS[axis];

  const matches = (when: QuestionCondition | undefined): number | null => {
    if (!when) return 0;
    let score = 0;

    if (when.jobs) {
      if (!when.jobs.includes(context.job)) return null;
      score += 1;
    }
    if (when.declared) {
      if (context.declared === null || !when.declared.includes(context.declared)) return null;
      score += 1;
    }
    if (when.targetLevel) {
      if (!when.targetLevel.includes(context.targetLevel)) return null;
      score += 1;
    }
    if (when.hasCurrentSignal !== undefined) {
      if (when.hasCurrentSignal !== context.hasCurrentSignal) return null;
      score += 1;
    }
    if (when.eventTypes) {
      if (!when.eventTypes.some((type) => context.eventTypes.includes(type))) return null;
      score += 1;
    }

    return score;
  };

  let best = variants[0]!;
  let bestScore = -1;

  for (const variant of variants) {
    const score = matches(variant.when);
    // `>` 이므로 같은 점수면 먼저 적힌 것이 남는다 — tie-break가 선언 순서다
    if (score !== null && score > bestScore) {
      best = variant;
      bestScore = score;
    }
  }

  return best;
}
