/**
 * X1-b Astrology Lens — Add-on / Entertainment
 *
 * MBTI Lens(src/data/mbti.ts)와 같은 원칙: 궁합 점수·Relationship Mirror 계산에는
 * 관여하지 않는다. 생년월일 입력 → 별자리 변환 로직을 새로 만들지 않고, MBTI와 동일하게
 * 사용자가 자기 별자리를 직접 고르게 한다(대부분 이미 알고 있는 정보이기 때문).
 */

import type { ZodiacSign } from '@/types';

export const ZODIAC_SIGNS: readonly ZodiacSign[] = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
];

interface ZodiacNote {
  label: string;
  /** 연애 맥락에서 흔히 이야기되는 성향 한 줄. 단정이 아니라 '대화 소재'로 제공한다. */
  trait: string;
  question: string;
}

export const ZODIAC_NOTES: Record<ZodiacSign, ZodiacNote> = {
  aries: { label: '양자리', trait: '관계에서도 마음이 생기면 바로 움직이는 편이라는 이야기가 많아.', question: '마음이 생기면 얼마나 빨리 표현하는 편이야?' },
  taurus: { label: '황소자리', trait: '한번 쌓은 관계는 안정적으로 오래 유지한다는 이야기가 흔해.', question: '관계에서 변화보다 안정이 더 편해?' },
  gemini: { label: '쌍둥이자리', trait: '대화와 호기심으로 관계의 활력을 유지한다는 이야기가 많아.', question: '대화가 줄어들면 관계도 식는다고 느껴?' },
  cancer: { label: '게자리', trait: '정서적 유대와 안정감을 특히 중요하게 본다는 이야기가 흔해.', question: '너에게 정서적 안정감을 주는 행동은 뭐야?' },
  leo: { label: '사자자리', trait: '관계에서도 인정받고 표현받는 걸 중요하게 여긴다는 이야기가 많아.', question: '애정을 확인받고 싶을 때 어떻게 알려?' },
  virgo: { label: '처녀자리', trait: '말보다 세심한 행동으로 마음을 표현한다는 이야기가 흔해.', question: '상대의 어떤 행동에서 마음을 가장 크게 느껴?' },
  libra: { label: '천칭자리', trait: '관계의 균형과 조화를 중요하게 생각한다는 이야기가 많아.', question: '갈등이 생기면 빨리 조율하고 싶은 편이야?' },
  scorpio: { label: '전갈자리', trait: '한번 깊어진 관계에 강한 몰입을 보인다는 이야기가 흔해.', question: '신뢰가 깨지면 회복하는 데 얼마나 걸려?' },
  sagittarius: { label: '사수자리', trait: '관계에서도 자유와 여유 공간을 중요하게 여긴다는 이야기가 많아.', question: '혼자만의 시간, 관계에서 얼마나 필요해?' },
  capricorn: { label: '염소자리', trait: '관계도 신중하게 단계를 밟아가며 쌓는다는 이야기가 흔해.', question: '관계의 다음 단계를 결정할 때 뭘 가장 먼저 봐?' },
  aquarius: { label: '물병자리', trait: '독립적인 거리감을 유지하면서 관계를 맺는다는 이야기가 많아.', question: '너무 가까워지는 게 부담스러울 때가 있어?' },
  pisces: { label: '물고기자리', trait: '상대의 감정에 깊이 공감하고 몰입한다는 이야기가 흔해.', question: '상대의 기분에 얼마나 영향을 받는 편이야?' },
};
