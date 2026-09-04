/**
 * MBTI — Supporting Compatibility Lens
 *
 * 역할: 사용자와 상대가 직접 입력한 MBTI를 관계 행동 데이터와 **별도의** Personality Lens로
 * 비교해, 궁합 결과를 해석할 때 참고할 수 있는 보조 정보.
 *
 * ⚠️ 이 데이터는 동기화율(Main Sync Score) 계산에 들어가지 않는다.
 * 같은 글자가 많을수록 좋은 관계라는 의미가 아니므로, '점수'를 만들지 않고 축별 '대화 포인트'만
 * 만든다. 문장 톤도 반드시 '~할 수 있어 / ~로 이야기되기도 해 / 실제로 그런지는 확인해봐'다.
 */

import type { MbtiAxisKey, MbtiType } from '@/types';

export const MBTI_TYPES: readonly MbtiType[] = [
  'ENTJ',
  'ENTP',
  'ENFJ',
  'ENFP',
  'ESTJ',
  'ESTP',
  'ESFJ',
  'ESFP',
  'INTJ',
  'INTP',
  'INFJ',
  'INFP',
  'ISTJ',
  'ISTP',
  'ISFJ',
  'ISFP',
];

interface MbtiAxisDefinition {
  key: MbtiAxisKey;
  /** MBTI 4글자 중 몇 번째 자리인지 */
  index: 0 | 1 | 2 | 3;
  eyebrow: string;
  label: string;
  /** 두 사람의 글자가 같을 때 — 글자별 문장 */
  same: Record<string, string>;
  /** 두 사람의 글자가 다를 때 */
  different: string;
  /** 글자가 다른 축에 대해 S25에 덧붙일 수 있는 대화 질문 */
  question: string;
}

export const MBTI_AXES: readonly MbtiAxisDefinition[] = [
  {
    key: 'energy',
    index: 0,
    eyebrow: 'ENERGY',
    label: '에너지를 회복하는 방식',
    same: {
      I: '둘 다 혼자 있는 시간으로 에너지를 회복하는 쪽으로 이야기되기도 해.',
      E: '둘 다 함께 활동하면서 에너지를 얻는 쪽으로 이야기되기도 해.',
    },
    different:
      '혼자 회복하는 시간과 함께 활동하면서 에너지를 얻는 방식이 다를 수 있어.',
    question: '각자 혼자 보내는 시간과 함께 보내는 시간은 어느 정도가 편해?',
  },
  {
    key: 'information',
    index: 1,
    eyebrow: 'INFORMATION',
    label: '정보를 받아들이는 방식',
    same: {
      S: '둘 다 지금 눈에 보이는 구체적인 정보를 먼저 보는 쪽으로 이야기되기도 해.',
      N: '큰 그림과 가능성을 보는 방식은 비슷하게 느껴질 수 있어.',
    },
    different:
      '한쪽은 구체적인 현실을, 다른 쪽은 큰 그림과 가능성을 먼저 볼 수 있어.',
    question: '앞일을 이야기할 때 구체적인 계획부터 잡는 게 편해, 가능성부터 넓게 그리는 게 편해?',
  },
  {
    key: 'decision',
    index: 2,
    eyebrow: 'DECISION',
    label: '결정할 때 먼저 보는 기준',
    same: {
      T: '둘 다 결정할 때 해결 논리를 먼저 보는 쪽으로 이야기되기도 해.',
      F: '둘 다 결정할 때 감정적 맥락을 먼저 보는 쪽으로 이야기되기도 해.',
    },
    different:
      '갈등 상황에서 한쪽은 감정적 맥락을, 다른 쪽은 해결 논리를 먼저 볼 수 있어.',
    question: '서운한 일이 있을 때, 어떤 반응을 받으면 마음이 조금 풀리는 편이야?',
  },
  {
    key: 'lifestyle',
    index: 3,
    eyebrow: 'LIFESTYLE',
    label: '계획과 유연함 사이',
    same: {
      J: '둘 다 미리 정해진 계획에서 편안함을 느끼는 쪽으로 이야기되기도 해.',
      P: '둘 다 상황에 맞춰 유연하게 움직이는 쪽으로 이야기되기도 해.',
    },
    different: '계획이나 일정에 대해 편안하게 느끼는 정도가 다를 수 있어.',
    question: '데이트 계획은 미리 정하는 게 좋아, 그날 정하는 게 더 편해?',
  },
];

/**
 * 내 MBTI만 있을 때 보여주는 한 줄. 상대 없이도 '자기탐색' 용도로는 쓸 수 있다.
 * 단정하지 않고 '이야기돼 / 이야기가 많아' 톤을 유지한다.
 */
export const MBTI_SELF_NOTE: Record<MbtiType, string> = {
  ENTJ: '관계를 이끌어가는 걸 편하게 느낀다는 이야기가 흔해.',
  ENTP: '새로운 대화를 관계의 활력으로 느낀다는 이야기가 많아.',
  ENFJ: '상대를 챙기는 데 에너지를 많이 쓴다는 이야기가 많아.',
  ENFP: '관계의 설렘과 즉흥성을 좋아한다는 이야기가 흔해.',
  ESTJ: '관계에서도 정리된 계획을 편하게 느낀다는 이야기가 많아.',
  ESTP: '즉각적이고 현실적인 반응을 선호한다는 이야기가 많아.',
  ESFJ: '관계의 분위기와 조화를 세심하게 신경 쓴다는 이야기가 흔해.',
  ESFP: '함께하는 순간의 즐거움을 중심에 둔다는 이야기가 흔해.',
  INTJ: '관계에서도 방향을 먼저 그려본다는 이야기가 많아.',
  INTP: '관계를 분석하다가도 감정 표현은 아낀다는 이야기가 많아.',
  INFJ: '겉으로 드러내는 것보다 속으로 깊게 생각한다는 이야기가 많아.',
  INFP: '관계의 의미와 진정성을 중요하게 본다는 이야기가 흔해.',
  ISTJ: '말보다 꾸준한 행동으로 애정을 보여준다는 이야기가 많아.',
  ISTP: '문제가 생기면 말보다 행동으로 해결한다는 이야기가 많아.',
  ISFJ: '상대의 필요를 먼저 알아채고 챙긴다는 이야기가 흔해.',
  ISFP: '조용히 자기 방식으로 애정을 표현한다는 이야기가 흔해.',
};
