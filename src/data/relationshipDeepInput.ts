import type { DeepInputAnswer, MirrorAxisKey, SessionAnswers } from '@/types';

/**
 * Optional Deep Input — **선택형 심화 질문** (260915 UT P1-1)
 *
 * ══ 왜 만들었나 ═══════════════════════════════════════════════════════════
 *
 * UT 신호는 '입력이 많다'가 아니라 그 반대였다:
 *
 * ```
 * "질문이 너무 얕았음. 이걸로 뭘 알겠어?"
 * "세부 질문이 부족했던 것 같다"
 * "질문이 벌써 끝났어?"
 * ```
 *
 * 원인을 넷으로 나눠보면(A 질문 수 · B 질문 해상도 · C 답변 방식 · D 결과 연결),
 * 이 제품의 문제는 **B와 C**다. `연락이 얼마나 중요해? 1~5`는 숫자 하나를 얻지만
 * **어떤 조건에서 그런지**를 하나도 모른다. 그래서 결과도 "연락을 중요하게 생각해"
 * 이상으로 나아가지 못하고, 사용자는 그걸 '얕다'고 느낀다.
 *
 * 그래서 **질문 개수를 늘리는 대신 해상도를 올린다.**
 *
 * ══ 원칙 ═════════════════════════════════════════════════════════════════
 *
 * ```
 * 선택        기본 흐름은 그대로. 열지 않으면 존재하지 않는다
 * 최대 2개    '질문이 또 늘었네'가 되는 순간 이 기능은 실패다
 * curated    AI가 질문을 생성하지 않는다. 축별 고정 pool에서 규칙으로 고른다
 * 조건만      '무엇이 중요한가'가 아니라 **'어떤 조건에서 그런가'** 를 묻는다
 * 점수 불변   동기화율 · Mirror 판정 공식은 이 답을 읽지 않는다
 * ```
 *
 * ⚠️ **점수를 바꾸지 않는 것이 이 기능의 핵심 제약이다.** 심화 입력이 점수를 움직이면
 * '더 많이 답한 사람이 더 높은 점수'가 되고, 그건 관찰이 아니라 설문 보상이다.
 * 이 답이 바꾸는 것은 **해석의 구체성**뿐이다.
 *
 * ══ 이름이 비슷한 다른 것들 ═══════════════════════════════════════════════
 *
 * ```
 * DEEP_QUESTION_BANK (data/deepQuestions.ts)  결제한 사용자에게 Premium 리포트가 묻는 질문
 * ADAPTIVE_FOLLOWUP  (data/adaptive.ts)       모순 후보 축에서 시스템이 먼저 묻는 1개
 * 이 파일                                      사용자가 직접 열어서 답하는 최대 2개
 * ```
 *
 * 셋 다 'AI가 생성하지 않고 미리 검토한 pool에서 고른다'는 규칙을 공유한다.
 */

export interface DeepInputOption {
  id: string;
  label: string;
  /**
   * 이 답이 좁혀주는 **조건**. 결과 문장이 그대로 쓴다.
   *
   * ⚠️ 감정·원인·성향이 아니라 **상황**이다. '불안한 편'(❌) / '답장 간격이 길어질 때'(⭕)
   * ⚠️ 문장에 끼워 넣는 조각이라 조사 없이 끝낸다.
   * ⚠️ 빈 문자열은 '근거가 되지 않는 답'(잘 모르겠어)이라는 뜻이다.
   */
  condition: string;
}

export interface DeepInputQuestion {
  id: string;
  axis: MirrorAxisKey;
  question: string;
  /** 왜 이걸 묻는지 — 한 줄. 사용자가 '또 질문이네'로 읽지 않게 한다 */
  caption: string;
  options: readonly DeepInputOption[];
}

/** 어떤 축에서도 마지막 보기는 같다 — 모른다고 답할 수 있어야 선택형이다 */
const UNSURE: DeepInputOption = { id: 'unsure', label: '잘 모르겠어', condition: '' };

/**
 * 축별 심화 질문 pool.
 *
 * ⚠️ 축마다 **2개까지만** 둔다. 늘리고 싶으면 먼저 '이 질문이 결과의 어느 문장을
 * 더 구체적으로 만드는가'에 답할 수 있어야 한다 — 답할 수 없으면 그 질문은 없어도 된다.
 */
export const DEEP_INPUT_QUESTIONS: Record<MirrorAxisKey, readonly DeepInputQuestion[]> = {
  contact: [
    {
      id: 'contact_reply_gap',
      axis: 'contact',
      question: '답장이 늦어질 때, 가장 먼저 신경 쓰이는 건 뭐야?',
      caption: '연락을 중요하게 답했어. 어떤 순간에 그런지까지 알면 결과가 달라져.',
      options: [
        { id: 'interval', label: '답장 간격이 길어지는 것', condition: '답장 간격이 길어질 때' },
        { id: 'no_reason', label: '이유를 모르는 채로 기다리는 것', condition: '이유를 모른 채 기다릴 때' },
        { id: 'pattern_change', label: '평소와 리듬이 달라지는 것', condition: '평소 연락 리듬이 달라질 때' },
        { id: 'read_unanswered', label: '읽고 답이 없는 것', condition: '읽고 답이 없을 때' },
        UNSURE,
      ],
    },
    {
      id: 'contact_drop_reaction',
      axis: 'contact',
      question: '연락이 줄었을 때, 너는 보통 어떻게 하는 편이야?',
      caption: '반응 방식까지 알면 확인할 지점이 구체적으로 나와.',
      options: [
        { id: 'ask', label: '먼저 물어봐', condition: '연락이 줄었을 때 먼저 물어보는 편' },
        { id: 'wait', label: '기다려', condition: '연락이 줄었을 때 기다리는 편' },
        { id: 'match', label: '나도 줄여', condition: '연락이 줄었을 때 나도 줄이는 편' },
        { id: 'overthink', label: '혼자 이유를 찾아', condition: '연락이 줄었을 때 혼자 이유를 찾는 편' },
        UNSURE,
      ],
    },
  ],
  conflict: [
    {
      id: 'conflict_timing',
      axis: 'conflict',
      question: '서운한 일이 생기면, 먼저 정리할 시간이 필요한 편이야?',
      caption: '언제 이야기하고 싶은지가 갈등에서 가장 자주 갈리는 지점이야.',
      options: [
        { id: 'right_away', label: '바로 말해야 편해', condition: '서운한 일을 바로 말할 때' },
        { id: 'few_hours', label: '몇 시간은 필요해', condition: '몇 시간 정리한 뒤에 말할 때' },
        { id: 'a_day', label: '하루는 있어야 해', condition: '하루 정도 정리한 뒤에 말할 때' },
        { id: 'depends', label: '일에 따라 달라', condition: '사안에 따라 말하는 시점이 달라질 때' },
        UNSURE,
      ],
    },
    {
      id: 'conflict_hard_to_say',
      axis: 'conflict',
      question: '바로 이야기하지 못할 때, 어떤 이유가 가장 커?',
      caption: '말하지 못한 이유는 상대에게 침묵으로만 전달돼.',
      options: [
        { id: 'not_sorted', label: '내 생각이 아직 정리가 안 돼서', condition: '생각이 정리되기 전에는' },
        { id: 'fear_bigger', label: '말하면 더 커질까 봐', condition: '이야기가 더 커질까 걱정될 때' },
        { id: 'trivial', label: '별일 아닌 것 같아서', condition: '별일 아니라고 넘길 때' },
        { id: 'no_timing', label: '말할 타이밍을 못 찾아서', condition: '말할 타이밍을 찾지 못할 때' },
        UNSURE,
      ],
    },
  ],
  alone: [
    {
      id: 'alone_support',
      axis: 'alone',
      question: '혼자 있고 싶은 순간에, 상대가 어떻게 해주면 가장 편해?',
      caption: '혼자 있고 싶다는 말은 상대에게 거리두기로 읽히기 쉬워.',
      options: [
        { id: 'say_it', label: '미리 말해두는 게 편해', condition: '혼자 있는 시간을 미리 말해둘 때' },
        { id: 'leave_alone', label: '그냥 두는 게 편해', condition: '혼자 있는 동안 연락이 없을 때' },
        { id: 'short_check', label: '짧게 한 번 확인해주면 좋아', condition: '혼자 있는 동안 짧은 연락이 있을 때' },
        { id: 'together_quiet', label: '같이 있되 각자 하는 게 좋아', condition: '같이 있으면서 각자 시간을 보낼 때' },
        UNSURE,
      ],
    },
    {
      id: 'alone_trigger',
      axis: 'alone',
      question: '혼자 있는 시간이 특히 필요해지는 건 언제야?',
      caption: '언제 필요한지를 알면 상대도 이유를 오해하지 않아.',
      options: [
        { id: 'after_work', label: '일이 몰렸을 때', condition: '일이 몰린 시기에' },
        { id: 'after_people', label: '사람을 많이 만난 뒤', condition: '사람을 많이 만난 뒤에' },
        { id: 'after_conflict', label: '갈등이 있었을 때', condition: '갈등이 있었던 직후에' },
        { id: 'routine', label: '특별한 이유 없이 규칙적으로', condition: '특별한 계기 없이 규칙적으로' },
        UNSURE,
      ],
    },
  ],
  affection: [
    {
      id: 'affection_missing',
      axis: 'affection',
      question: '애정이 부족하다고 느낄 때, 가장 먼저 비는 건 뭐야?',
      caption: '애정 표현은 같은 말을 서로 다르게 번역하기 쉬운 항목이야.',
      options: [
        { id: 'words', label: '말로 하는 표현', condition: '말로 하는 표현이 줄어들 때' },
        { id: 'touch', label: '스킨십', condition: '스킨십이 줄어들 때' },
        { id: 'time', label: '같이 보내는 시간', condition: '같이 보내는 시간이 줄어들 때' },
        { id: 'attention', label: '작은 것을 알아봐 주는 것', condition: '작은 변화를 알아봐 주지 않을 때' },
        UNSURE,
      ],
    },
    {
      id: 'affection_express',
      axis: 'affection',
      question: '너는 애정을 주로 어떤 방식으로 표현해?',
      caption: '주는 방식과 받고 싶은 방식이 다른 경우가 많아.',
      options: [
        { id: 'words', label: '말로', condition: '말로 표현하는 편' },
        { id: 'act', label: '챙기는 행동으로', condition: '챙기는 행동으로 표현하는 편' },
        { id: 'touch', label: '스킨십으로', condition: '스킨십으로 표현하는 편' },
        { id: 'time', label: '시간을 내는 걸로', condition: '시간을 내는 것으로 표현하는 편' },
        UNSURE,
      ],
    },
  ],
  hobby: [
    {
      id: 'hobby_together',
      axis: 'hobby',
      question: '같이 하는 시간과 각자 하는 시간, 어디서 어긋나기 쉬워?',
      caption: '취미는 양보다 어느 쪽을 같이 할지에서 갈려.',
      options: [
        { id: 'weekend', label: '주말을 어떻게 쓸지', condition: '주말 시간을 정할 때' },
        { id: 'new_try', label: '새로운 걸 같이 해보자고 할 때', condition: '새로운 것을 같이 해보자고 할 때' },
        { id: 'my_world', label: '내 취미에 관심이 없을 때', condition: '내 취미에 관심이 없을 때' },
        { id: 'pace', label: '한쪽만 계속 맞출 때', condition: '한쪽이 계속 맞추기만 할 때' },
        UNSURE,
      ],
    },
  ],
};

/** 저장된 값은 id뿐이라 화면·근거는 여기서 다시 읽는다 */
export function deepInputOptionOf(questionId: string, optionId: string): DeepInputOption | null {
  for (const questions of Object.values(DEEP_INPUT_QUESTIONS)) {
    const question = questions.find((item) => item.id === questionId);
    if (!question) continue;
    return question.options.find((option) => option.id === optionId) ?? null;
  }
  return null;
}

export function deepInputQuestionOf(questionId: string): DeepInputQuestion | null {
  for (const questions of Object.values(DEEP_INPUT_QUESTIONS)) {
    const found = questions.find((item) => item.id === questionId);
    if (found) return found;
  }
  return null;
}

/** 심화 질문 최대 노출 수 — '또 질문이 늘었다'가 되지 않게 하는 상한 */
export const MAX_DEEP_INPUTS = 2;

/**
 * **어떤 심화 질문을 보여줄지 규칙으로 고른다** (§20 — AI 생성 금지)
 *
 * 우선순위는 '사용자가 이미 중요하다고 말한 축'이다. 관심 없다고 답한 축을 더 캐묻는 것은
 * 질문을 늘리는 것일 뿐 해상도를 올리는 게 아니다.
 *
 * ```
 * ① 관계 경험에서 '가장 힘들었던 순간'으로 고른 축      (가장 강한 신호)
 * ② 관계 경험에서 '중요했던 요소'로 고른 축
 * ③ Declared에서 극단값(4~5 또는 1~2)으로 답한 축
 * ④ 그 외 답한 축                                      (①~③이 비어도 최소 1개는 나온다)
 * ```
 *
 * 같은 축에서는 pool의 첫 질문부터 쓴다. **무작위가 아니다** — 같은 입력이면 같은 질문이
 * 나와야 사용자가 '아까 그 질문'이라고 알아볼 수 있고, 테스트도 값으로 고정할 수 있다.
 *
 * 이미 답한 질문은 다시 고르지 않는다 — 두 번째로 열면 다음 질문이 나온다.
 */
export function selectDeepInputQuestions(answers: SessionAnswers): DeepInputQuestion[] {
  const { experience, declared } = answers;
  const ranked: MirrorAxisKey[] = [];
  const add = (axis: MirrorAxisKey) => {
    if (!ranked.includes(axis)) ranked.push(axis);
  };

  const HARDEST_AXIS: Record<string, MirrorAxisKey> = {
    contact_drop: 'contact',
    fight_silence: 'conflict',
    no_time: 'alone',
    value_gap: 'affection',
  };
  if (experience.hardest) add(HARDEST_AXIS[experience.hardest]!);

  const FACTOR_AXIS: Partial<Record<string, MirrorAxisKey>> = {
    contact: 'contact',
    conflict: 'conflict',
    alone: 'alone',
    affection: 'affection',
    hobby: 'hobby',
    touch: 'affection',
    talk: 'conflict',
  };
  for (const factor of experience.important) {
    const axis = FACTOR_AXIS[factor];
    if (axis) add(axis);
  }

  if (declared.contact !== null && (declared.contact >= 4 || declared.contact <= 2)) add('contact');
  if (declared.alone !== null && (declared.alone >= 4 || declared.alone <= 2)) add('alone');
  if (declared.conflict !== null) add('conflict');
  if (declared.affection !== null) add('affection');
  if (declared.hobby !== null) add('hobby');

  const answeredIds = new Set(answers.deepInputs.map((item) => item.questionId));
  const picked: DeepInputQuestion[] = [];

  for (const axis of ranked) {
    if (picked.length >= MAX_DEEP_INPUTS) break;
    const next = DEEP_INPUT_QUESTIONS[axis].find(
      (question) => !answeredIds.has(question.id) && !picked.some((item) => item.id === question.id),
    );
    if (next) picked.push(next);
  }

  return picked;
}

/**
 * 저장된 심화 답을 **조건 문장 조각**으로 편다.
 *
 * `잘 모르겠어`(condition 빈 문자열)는 빠진다 — 모른다고 답한 것은 근거가 아니다.
 */
export function deepConditionsOf(
  deepInputs: readonly DeepInputAnswer[],
): { axis: MirrorAxisKey; condition: string }[] {
  return deepInputs.flatMap((input) => {
    const option = deepInputOptionOf(input.questionId, input.optionId);
    if (!option || option.condition.length === 0) return [];
    return [{ axis: input.axis, condition: option.condition }];
  });
}

/** 한 축에 대해 사용자가 좁혀준 조건 (없으면 null) */
export function deepConditionForAxis(
  deepInputs: readonly DeepInputAnswer[],
  axis: MirrorAxisKey,
): string | null {
  return deepConditionsOf(deepInputs).find((item) => item.axis === axis)?.condition ?? null;
}
