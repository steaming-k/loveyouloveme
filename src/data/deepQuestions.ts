import type { DeepAnswerType, DeepQuestionOption, MirrorAxisKey } from '@/types';

/**
 * Premium Adaptive Deep Question 후보 은행 (v1.9 · §9~§10)
 *
 * ⚠️ AI가 질문을 즉석에서 만들지 않는다. 축·인사이트 타입별로 미리 검토한 질문 후보를
 * 두고, `crossSourceInsights`가 고른 Top Insight의 axis로 후보를 뽑는다 — 기존
 * `ADAPTIVE_FOLLOWUP`(S16a)과 같은 방식이다. 그래서 질문 생성에 AI 호출이 필요 없고,
 * "답을 유도하지 않는 질문"인지 미리 사람이 검토할 수 있다.
 *
 * 모든 질문은 **선택지 + 직접 입력**(`allowCustomText`) 구조를 기본으로 둔다(§9).
 */

interface DeepQuestionTemplate {
  id: string;
  axis: MirrorAxisKey;
  prompt: string;
  reason: string;
  answerType: DeepAnswerType;
  options?: readonly DeepQuestionOption[];
  allowCustomText?: boolean;
}

const CUSTOM_TEXT_OPTION: DeepQuestionOption = { id: 'custom', label: '직접 입력' };

export const DEEP_QUESTION_BANK: Record<MirrorAxisKey, readonly DeepQuestionTemplate[]> = {
  contact: [
    {
      id: 'contact_first_thought',
      axis: 'contact',
      prompt: '연락이 줄었을 때 가장 먼저 들었던 생각은 뭐였어?',
      reason: '아까 네가 말한 연락 기준과 실제 경험에서 조금 다른 신호가 보여서 물어볼게.',
      answerType: 'single',
      options: [
        { id: 'busy_ok', label: '바쁜가 보다, 괜찮다' },
        { id: 'worried', label: '무슨 일 있나 걱정됐다' },
        { id: 'lonely', label: '연결감이 줄어든 것 같아 서운했다' },
        CUSTOM_TEXT_OPTION,
      ],
      allowCustomText: true,
    },
    {
      id: 'contact_signal_need',
      axis: 'contact',
      prompt: '연락 횟수 자체보다 "관계가 괜찮다는 신호"가 더 필요한 쪽에 가까웠어?',
      reason: '연락 중요도는 낮게 답했는데, 관계 경험에서는 연락 감소가 힘든 순간으로 나온 이유를 좀 더 보고 싶어서.',
      answerType: 'single',
      options: [
        { id: 'signal', label: '맞아, 신호가 더 중요했어' },
        { id: 'frequency', label: '아니, 횟수 자체가 문제였어' },
        { id: 'both', label: '둘 다 조금씩' },
        CUSTOM_TEXT_OPTION,
      ],
      allowCustomText: true,
    },
    {
      id: 'contact_initiate_ok',
      axis: 'contact',
      prompt: '상대가 먼저 연락하지 않아도 내가 먼저 연락하는 건 괜찮았어?',
      reason: '연락에 대한 기준을 조금 더 구체적으로 보고 싶어서.',
      answerType: 'single',
      options: [
        { id: 'fine', label: '괜찮았어' },
        { id: 'uneven', label: '나만 하는 것 같아 신경 쓰였어' },
        CUSTOM_TEXT_OPTION,
      ],
      allowCustomText: true,
    },
  ],
  alone: [
    {
      id: 'alone_explain',
      axis: 'alone',
      prompt: '혼자 있는 시간이 필요할 때 상대에게 어떻게 설명하는 편이야?',
      reason: '개인 시간 기준과 실제 경험 사이에 연결해볼 지점이 보여서.',
      answerType: 'text',
      allowCustomText: true,
    },
    {
      id: 'alone_mutual',
      axis: 'alone',
      prompt: '내가 혼자 있고 싶은 것과 상대가 혼자 있고 싶어 하는 건 비슷하게 받아들여졌어?',
      reason: '개인 시간에 대한 기준이 서로 어떻게 다뤄졌는지 보고 싶어서.',
      answerType: 'single',
      options: [
        { id: 'same', label: '비슷하게 받아들여졌어' },
        { id: 'different', label: '나는 괜찮은데 상대 쪽은 다르게 느꼈던 것 같아' },
        { id: 'unsure', label: '잘 모르겠어' },
        CUSTOM_TEXT_OPTION,
      ],
      allowCustomText: true,
    },
  ],
  conflict: [
    {
      id: 'conflict_reason',
      axis: 'conflict',
      prompt:
        '갈등이 생겼을 때 바로 이야기하고 싶었던 건 문제를 빨리 해결하고 싶어서였어, 관계가 멀어질까 불안해서였어?',
      reason: '갈등 해결 방식에 대한 기준이 왜 그렇게 나왔는지 조금 더 보고 싶어서.',
      answerType: 'single',
      options: [
        { id: 'resolve', label: '문제를 빨리 해결하고 싶어서' },
        { id: 'anxious', label: '관계가 멀어질까 불안해서' },
        { id: 'both', label: '둘 다' },
        CUSTOM_TEXT_OPTION,
      ],
      allowCustomText: true,
    },
  ],
  affection: [
    {
      id: 'affection_cooling',
      axis: 'affection',
      prompt: '애정 표현이 줄었을 때 어떤 게 가장 신경 쓰였어?',
      reason: '애정 표현에 대한 기준과 실제 경험을 좀 더 연결해서 보고 싶어서.',
      answerType: 'single',
      options: [
        { id: 'cooling_down', label: '마음이 식은 건가 싶었다' },
        { id: 'less_important', label: '내가 덜 중요해진 것 같았다' },
        { id: 'style', label: '표현 방식 차이일 뿐인 것 같았다' },
        CUSTOM_TEXT_OPTION,
      ],
      allowCustomText: true,
    },
  ],
  hobby: [
    {
      id: 'hobby_priority_shift',
      axis: 'hobby',
      prompt: '취미를 같이 안 하게 됐을 때 어떤 느낌이었어?',
      reason: '취미 공유 기준이 실제로 어떻게 느껴졌는지 조금 더 보고 싶어서.',
      answerType: 'single',
      options: [
        { id: 'less_time', label: '같이 보내는 시간이 준 것 같았다' },
        { id: 'own_time', label: '각자 시간이 더 편했다' },
        { id: 'no_big_deal', label: '크게 신경 쓰이지 않았다' },
        CUSTOM_TEXT_OPTION,
      ],
      allowCustomText: true,
    },
  ],
};

/**
 * 우선순위 Insight 1~2개의 axis로 후보를 뽑는다. 한 축에 질문을 몰아넣지 않는다(§10) —
 * 축마다 최대 2개, 전체 최대 5개.
 */
export function selectDeepQuestions(
  focusAxes: readonly MirrorAxisKey[],
): DeepQuestionTemplate[] {
  const MAX_PER_AXIS = 2;
  const MAX_TOTAL = 5;

  const selected: DeepQuestionTemplate[] = [];
  for (const axis of focusAxes) {
    const bank = DEEP_QUESTION_BANK[axis] ?? [];
    selected.push(...bank.slice(0, MAX_PER_AXIS));
    if (selected.length >= MAX_TOTAL) break;
  }

  return selected.slice(0, MAX_TOTAL);
}

export type { DeepQuestionTemplate };
