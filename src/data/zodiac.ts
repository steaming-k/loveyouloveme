/**
 * Astrology Lens — Entertainment
 *
 * 궁합 점수·Relationship Mirror·History 계산에는 어디에도 관여하지 않는다.
 *
 * v1.4에서 '사용자가 12개 중 직접 고르기' → **생년월일 기반 Simple Sun Sign 계산**으로 바꿨다.
 * Simple Sun Sign은 Month/Day 경계 규칙만 쓴다 — 출생시각·지역·연도에 따른 태양 위치 계산은
 * 하지 않으므로 경계일(cusp)에는 실제와 다를 수 있고, 그 사실을 화면에 명시한다.
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

/**
 * Simple Sun Sign 경계 — `[시작월, 시작일]` 기준으로 그 별자리가 시작된다.
 * 일반적으로 통용되는 Tropical 날짜 범위이며, 연도별 태양 진입 시각(±1일)은 반영하지 않는다.
 */
export const SUN_SIGN_RANGES: readonly { sign: ZodiacSign; from: [number, number] }[] = [
  { sign: 'capricorn', from: [12, 22] },
  { sign: 'sagittarius', from: [11, 22] },
  { sign: 'scorpio', from: [10, 23] },
  { sign: 'libra', from: [9, 23] },
  { sign: 'virgo', from: [8, 23] },
  { sign: 'leo', from: [7, 23] },
  { sign: 'cancer', from: [6, 21] },
  { sign: 'gemini', from: [5, 21] },
  { sign: 'taurus', from: [4, 20] },
  { sign: 'aries', from: [3, 21] },
  { sign: 'pisces', from: [2, 19] },
  { sign: 'aquarius', from: [1, 20] },
];

/** 4원소 — '비슷하게/다르게 읽힐 수 있는 부분'을 만드는 근거. 우열이 아니다. */
export type ZodiacElement = 'fire' | 'earth' | 'air' | 'water';

export const ZODIAC_ELEMENT: Record<ZodiacSign, ZodiacElement> = {
  aries: 'fire',
  leo: 'fire',
  sagittarius: 'fire',
  taurus: 'earth',
  virgo: 'earth',
  capricorn: 'earth',
  gemini: 'air',
  libra: 'air',
  aquarius: 'air',
  cancer: 'water',
  scorpio: 'water',
  pisces: 'water',
};

/**
 * 3양태(modality) — v1.46 PremiumLens §16에서 추가.
 *
 * ⚠️ **계산이 아니다.** 태양궁이 정해지면 곧바로 정해지는 전통 점성술의
 * 고정 분류표다 — 출생 시각도 지역도 필요 없다. 그래서 `생년월일만으로
 * 계산하지 못하는 것을 만들지 않는다`(§15)를 어기지 않는다.
 *
 * ⚠️ 달·상승궁(Moon/Rising)은 여전히 만들지 않는다 — 그건 행성 위치 계산이
 * 필요해서 이 표처럼 곧바로 따라오지 않는다.
 */
export type ZodiacModality = 'cardinal' | 'fixed' | 'mutable';

export const ZODIAC_MODALITY: Record<ZodiacSign, ZodiacModality> = {
  aries: 'cardinal',
  cancer: 'cardinal',
  libra: 'cardinal',
  capricorn: 'cardinal',
  taurus: 'fixed',
  leo: 'fixed',
  scorpio: 'fixed',
  aquarius: 'fixed',
  gemini: 'mutable',
  virgo: 'mutable',
  sagittarius: 'mutable',
  pisces: 'mutable',
};

export const ELEMENT_LABEL: Record<ZodiacElement, string> = {
  fire: '불',
  earth: '흙',
  air: '공기',
  water: '물',
};

/** 원소별로 '점성술에서 이야기되는' 관계 태도. 단정하지 않는 톤을 유지한다. */
export const ELEMENT_NOTE: Record<ZodiacElement, string> = {
  fire: '마음이 생기면 빠르게 움직이고 표현하는 쪽으로 이야기되기도 해.',
  earth: '안정과 꾸준함을 먼저 챙기는 쪽으로 이야기되기도 해.',
  air: '대화와 거리 조절을 중요하게 보는 쪽으로 이야기되기도 해.',
  water: '감정의 흐름과 정서적 유대를 먼저 보는 쪽으로 이야기되기도 해.',
};

/**
 * 두 원소가 다를 때 이야기해볼 주제 (양방향 동일하게 쓴다)
 *
 * ⚠️ **key는 알파벳 정렬 순서다** — `air` < `earth` < `fire` < `water`.
 * 호출부가 `[a, b].sort().join('|')`로 key를 만들기 때문이다
 * (`astrologyService.elementPairKey` · `logic/premiumLens.elementPairKey`).
 *
 * v1.46 PremiumLens 실측에서 발견한 결함: 예전 key는 `fire|earth`·`fire|air`·
 * `earth|air`처럼 **정렬되지 않은 순서**였고, 그래서 6쌍 중 3쌍이 조회에 실패해
 * `?? ''`로 떨어졌다. 화면에는 `불과 흙으로 원소가 달라. `처럼 **문장이 끊긴 채**
 * 나갔다(v1.4부터 있던 결함이고, 무료 별자리 렌즈에도 그대로 있었다).
 *
 * 키를 정렬 순서로 맞춰 두 호출부를 함께 고친다 — 조회 함수를 고치는 대신 데이터를
 * 고른 이유는, 새 호출부가 또 `sort()`를 쓸 때 자동으로 맞기 때문이다.
 */
export const ELEMENT_PAIR_TOPIC: Record<string, string> = {
  'earth|fire': '속도가 다르게 느껴질 수 있어. 결정을 언제 내리고 싶은지 이야기해봐.',
  'air|fire': '둘 다 움직임을 좋아하는 쪽으로 이야기되지만, 무엇에 열이 붙는지는 다를 수 있어.',
  'fire|water': '표현의 온도가 다르게 느껴질 수 있어. 서운함을 어떻게 알리는지 이야기해봐.',
  'air|earth': '계획과 즉흥성 사이에서 편한 지점이 다를 수 있어.',
  'earth|water': '둘 다 안정을 중요하게 보는 쪽으로 이야기되지만, 안정의 기준이 다를 수 있어.',
  'air|water': '거리감과 밀착 사이에서 편한 지점이 다를 수 있어.',
};

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
