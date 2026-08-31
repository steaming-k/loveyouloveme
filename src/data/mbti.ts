/**
 * X1-a MBTI Lens — Add-on / Entertainment
 *
 * 기획서 §5.7 Phase 3 후보: "자기탐색·대화용 Lens로 활용하되 객관적 관계 성공 예측으로
 * 사용하지 않음". 그래서 이 데이터는 궁합 점수·Compatibility 계산에 관여하지 않고,
 * /lens/mbti 화면에서만 참고용 한 줄 관찰로 보여준다.
 */

import type { MbtiType } from '@/types';

export const MBTI_TYPES: readonly MbtiType[] = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
];

interface MbtiNote {
  /** 연애 맥락에서 흔히 이야기되는 성향 한 줄. 단정이 아니라 '대화 소재'로 제공한다. */
  trait: string;
  /** 상대와 나눠볼 만한 질문 */
  question: string;
}

export const MBTI_NOTES: Record<MbtiType, MbtiNote> = {
  INTJ: { trait: '관계에서도 방향과 목적을 먼저 그려보는 편이라고 이야기돼.', question: '연애에서 그리는 장기적인 그림이 있어?' },
  INTP: { trait: '관계를 분석하다가도 정작 감정 표현은 아낀다는 이야기가 많아.', question: '마음을 표현하는 나만의 방식이 있어?' },
  ENTJ: { trait: '관계를 이끌어가는 걸 편하게 느낀다는 이야기가 흔해.', question: '누가 먼저 다가가는 쪽이야?' },
  ENTP: { trait: '새로운 대화·논쟁을 관계의 활력으로 느낀다는 이야기가 많아.', question: '갈등이 생겼을 때 토론하듯 풀고 싶어, 아니면 멈추고 싶어?' },
  INFJ: { trait: '겉으로 드러내는 것보다 속으로 훨씬 깊게 생각한다는 이야기가 많아.', question: '말하지 않고 넘어간 서운함, 있어?' },
  INFP: { trait: '관계의 의미와 진정성을 특히 중요하게 본다는 이야기가 흔해.', question: '이 관계에서 가장 중요한 가치가 뭐야?' },
  ENFJ: { trait: '상대를 챙기는 데 에너지를 많이 쓴다는 이야기가 많아.', question: '너를 챙기는 것도 상대에게 기대해?' },
  ENFP: { trait: '관계의 설렘과 즉흥성을 좋아한다는 이야기가 흔해.', question: '루틴이 반복되는 관계, 편해 아니면 지루해?' },
  ISTJ: { trait: '말보다 꾸준한 행동으로 애정을 보여준다는 이야기가 많아.', question: '너의 애정은 어떤 행동에서 가장 잘 드러나?' },
  ISFJ: { trait: '상대의 필요를 먼저 알아채고 챙긴다는 이야기가 흔해.', question: '네가 챙김을 받고 싶을 땐 어떻게 표현해?' },
  ESTJ: { trait: '관계에서도 정리된 계획과 역할 분담을 편하게 느낀다는 이야기가 많아.', question: '갈등이 생기면 바로 논의하고 싶은 편이야?' },
  ESFJ: { trait: '관계의 분위기와 조화를 세심하게 신경 쓴다는 이야기가 흔해.', question: '둘 사이 어색한 기류, 얼마나 빨리 못 견뎌?' },
  ISTP: { trait: '문제가 생기면 말보다 행동으로 해결하려 한다는 이야기가 많아.', question: '혼자 정리할 시간이 필요할 때, 어떻게 알려주고 싶어?' },
  ISFP: { trait: '조용히 자기 방식으로 애정을 표현한다는 이야기가 흔해.', question: '너의 애정 표현, 상대가 알아차리기 쉬운 편이야?' },
  ESTP: { trait: '관계에서도 즉각적이고 현실적인 반응을 선호한다는 이야기가 많아.', question: '갈등이 길게 이어지는 거, 얼마나 힘들어?' },
  ESFP: { trait: '함께하는 순간의 즐거움을 관계의 중심에 둔다는 이야기가 흔해.', question: '관계에서 재미가 사라지면 어떤 기분이 들어?' },
};
