import type { MirrorAxisKey } from '@/types';

/**
 * Adaptive Follow-up (Progressive Profiling)
 *
 * 모든 사용자에게 질문을 늘리지 않는다. Declared Me와 Relationship Me 사이에
 * 모순 후보(GAP)가 발견된 축에 대해서만, 왜 그 축이 관계에서 크게 반응했는지
 * 이유 하나를 더 물어본다. 답은 선택이고, 건너뛰어도 흐름은 끊기지 않는다.
 *
 * 이 응답은 숫자로 환산하지 않는다 — Core Insight의 근거 문장으로만 쓰인다.
 */

export interface AdaptiveOption {
  id: string;
  label: string;
}

export interface AdaptiveQuestion {
  axis: MirrorAxisKey;
  question: string;
  options: readonly AdaptiveOption[];
}

const SKIP_OPTION: AdaptiveOption = { id: 'unsure', label: '잘 모르겠어' };

export const ADAPTIVE_FOLLOWUP: Record<MirrorAxisKey, AdaptiveQuestion> = {
  contact: {
    axis: 'contact',
    question: '연락이 줄어서 힘들었던 건 어떤 이유에 가까웠어?',
    options: [
      { id: 'frequency', label: '연락 횟수 자체가 줄어서' },
      { id: 'interest', label: '관심이 줄어든 것처럼 느껴져서' },
      { id: 'disconnect', label: '관계가 끊어진 느낌이 들어서' },
      { id: 'anxious', label: '이유를 몰라서 불안해서' },
      SKIP_OPTION,
    ],
  },
  conflict: {
    axis: 'conflict',
    question: '갈등이 해결 안 되고 남아있을 때 어떤 게 가장 힘들었어?',
    options: [
      { id: 'silence', label: '대화가 끊긴 것 자체가' },
      { id: 'misunderstood', label: '내 마음을 모르는 것 같아서' },
      { id: 'distance', label: '관계가 서먹해질까 봐' },
      { id: 'hard_to_reopen', label: '다시 꺼내기 어려워서' },
      SKIP_OPTION,
    ],
  },
  alone: {
    axis: 'alone',
    question: '개인 시간이 줄었을 때 어떤 게 가장 힘들었어?',
    options: [
      { id: 'no_recovery', label: '혼자만의 회복 시간이 없어서' },
      { id: 'own_tasks', label: '내 할 일을 못 챙겨서' },
      { id: 'no_breathing_room', label: '숨 쉴 틈이 없다고 느껴서' },
      { id: 'always_adjusting', label: '상대에게 맞추기만 하는 것 같아서' },
      SKIP_OPTION,
    ],
  },
  affection: {
    axis: 'affection',
    question: '애정 표현이 줄었을 때 어떤 게 가장 신경 쓰였어?',
    options: [
      { id: 'cooling_down', label: '마음이 식은 건가 싶어서' },
      { id: 'less_important', label: '내가 덜 중요해진 것 같아서' },
      { id: 'numbness', label: '관계가 무덤덤해질까 봐' },
      { id: 'just_style', label: '표현 방식 차이일 뿐인 것 같아서' },
      SKIP_OPTION,
    ],
  },
  hobby: {
    axis: 'hobby',
    question: '취미를 같이 안 하게 됐을 때 어떤 느낌이었어?',
    options: [
      { id: 'less_time_together', label: '같이 보내는 시간이 준 것 같아서' },
      { id: 'own_time_comfortable', label: '각자 시간이 더 편해서' },
      { id: 'priority_shift', label: '자연스럽게 우선순위가 바뀐 것 같아서' },
      { id: 'never_mattered_much', label: '원래 큰 의미는 아니었어서' },
      SKIP_OPTION,
    ],
  },
};

export function adaptiveOptionLabel(axis: MirrorAxisKey, optionId: string): string {
  return (
    ADAPTIVE_FOLLOWUP[axis].options.find((option) => option.id === optionId)?.label ?? optionId
  );
}
