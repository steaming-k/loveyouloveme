/**
 * 선택지 → 한국어 라벨 / 점수 매핑
 * 와이어프레임 스크립트의 LMH · CONF · AFF · HOB · PAST_TXT · HARD_TXT 상수를 그대로 옮긴 것.
 * 이 파일은 순수 데이터만 담고, 계산은 src/lib/logic 에서 한다.
 */

import type {
  AffectionStyle,
  ConflictStyle,
  HardestMoment,
  HobbyStyle,
  PastFactor,
  RelationshipStatus,
  SelfGapAnswer,
  TargetLevel,
  TargetRelation,
} from '@/types';

/** 상대 정보 l / m / h → 1~5 스케일. 'x'(모름)는 비교에서 제외 */
export const TARGET_LEVEL_VALUE: Record<TargetLevel, number | null> = {
  l: 1,
  m: 3,
  h: 5,
  x: null,
};

export const CONFLICT_VALUE: Record<ConflictStyle, number> = { now: 5, soon: 3, space: 1 };
export const AFFECTION_VALUE: Record<AffectionStyle, number> = { a1: 1, a2: 3, a3: 5 };
export const HOBBY_VALUE: Record<HobbyStyle, number> = { h1: 1, h2: 3, h3: 5 };

export const CONFLICT_LABEL: Record<ConflictStyle, string> = {
  now: '오늘 안에 이야기',
  soon: '잠깐 뒤 이야기',
  space: '혼자 정리 후 이야기',
};

export const AFFECTION_LABEL: Record<AffectionStyle, string> = {
  a1: '담백한 편',
  a2: '적당히 주고받기',
  a3: '자주 표현',
};

export const HOBBY_LABEL: Record<HobbyStyle, string> = {
  h1: '각자 해도 괜찮음',
  h2: '가끔 같이',
  h3: '거의 같이',
};

export const PAST_FACTOR_LABEL: Record<PastFactor, string> = {
  talk: '대화',
  contact: '연락',
  conflict: '갈등 해결',
  affection: '애정 표현',
  alone: '개인 시간',
  rhythm: '생활패턴',
  money: '경제관념',
  hobby: '취미',
  touch: '스킨십',
  future: '미래 계획',
  care: '배려',
  stable: '정서적 안정',
};

export const HARDEST_LABEL: Record<HardestMoment, string> = {
  contact_drop: '연락 감소가 가장 힘들었음',
  fight_silence: '싸운 뒤 대화 중단이 가장 힘들었음',
  no_time: '내 시간이 없어지는 게 힘들었음',
  value_gap: '기준 차이가 가장 힘들었음',
};

export const SELF_GAP_LABEL: Record<SelfGapAnswer, string> = {
  yes: '꽤 달랐어',
  some: '조금 달랐어',
  no: '거의 비슷했어',
};

export const STATUS_LABEL: Record<RelationshipStatus, string> = {
  solo_none: '솔로 · 연애 경험 없음',
  solo_exp: '솔로 · 연애 경험 있음',
  crush: '관심 가는 사람이 있음',
  dating: '연애 중',
  married: '기혼 / 동거',
  ended: '최근 관계가 끝남',
};

/**
 * v1은 '솔로 · 연애 경험 있음'과 '관심 가는 사람이 있음' 두 상태에 맞춰져 있다.
 * 나머지 상태를 선택해도 같은 흐름으로 안내하지만, '상태에 따라 질문이 달라진다'고
 * 말해놓고 실제로는 그대로인 거짓 약속을 하지 않기 위해 이렇게 명시한다.
 */
export const STATUS_SUPPORTED: Record<RelationshipStatus, boolean> = {
  solo_none: false,
  solo_exp: true,
  crush: true,
  dating: false,
  married: false,
  ended: false,
};

export const TARGET_RELATION_LABEL: Record<TargetRelation, string> = {
  crush: '알아가는 중',
  friend: '친구',
  work: '같이 일하는 사람',
  intro: '소개로 만남',
};

export const CONFIDENCE_LABEL = {
  high: '높음',
  medium: '중간',
  low: '낮음',
} as const;

/** 관계 경험이 없는 상태(E4)에서도 흐름이 끊기지 않도록 쓰는 라벨 */
export const NO_EXPERIENCE_LABEL = '관계 경험 기록 없음';

export const PAST_FACTOR_ORDER: PastFactor[] = [
  'talk',
  'contact',
  'conflict',
  'affection',
  'alone',
  'rhythm',
  'money',
  'hobby',
  'touch',
  'future',
  'care',
  'stable',
];

export const MAX_PAST_FACTORS = 4;
