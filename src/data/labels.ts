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
  // v1.40 — 결혼 여부를 별도 Job으로 만들지 않는다(가사·재정 데이터를 받지 않으므로).
  // 그래서 선택지도 '결혼'만이 아니라 오래 함께하는 관계를 함께 담는 라벨로 둔다(§37.3).
  married: '기혼 / 오래 함께하는 중',
  ended: '최근 관계가 끝남',
};

/**
 * 그 상태에 **실제로 맞는 리포트가 있는가.**
 *
 * '상태에 따라 질문이 달라진다'고 말해놓고 실제로는 그대로인 거짓 약속을 하지 않기 위해
 * 명시한다. 그래서 이 값이 false면 상태 화면이 '준비 중'이라고 정직하게 말한다.
 *
 * v1.29 P4 — `solo_none`을 true로 올렸다. **약속이 실제로 지켜지게 됐기 때문이다.**
 * v1.28까지는 연애 경험이 없는 사용자에게 문 앞에서 '준비 중'이라고 말하고도 같은
 * 퍼널로 밀어넣었고, 그 사용자는 동기화율 `?`와 "Mirror를 만들 수 없어"를 지나
 * 홈으로 돌아갔다(P4 Audit 실측). 이제 First Contact Report가 그 자리를 받는다.
 *
 * v1.40 — `dating`/`married`/`ended`를 true로 올렸다. **약속이 실제로 지켜지게 됐기
 * 때문이다.** v1.39까지 이 세 상태는 `준비 중` 라벨을 달고도 같은 흐름으로 들어가
 * `crush`와 **똑같은 결과·똑같은 다음 행동**을 받았다. v1.40에서 각 단계에 실제 Job이
 * 생겼다 — 판정은 그대로 두고(§37.7) 그 판정을 무엇에 쓸지가 달라진다: `dating`은 조율,
 * `long_term`은 반복되는 지점, `ended`는 회고다(`STAGE_JOB_COPY`).
 *
 * ⚠️ 이 값을 true로 올린 근거는 카피가 아니라 **행동이 실제로 달라지는가**다. Job이
 * 없는 상태를 라벨만 고쳐서 true로 만들면 v1.28이 했던 거짓 약속으로 돌아간다.
 */
export const STATUS_SUPPORTED: Record<RelationshipStatus, boolean> = {
  solo_none: true,
  solo_exp: true,
  crush: true,
  dating: true,
  married: true,
  ended: true,
};

export const TARGET_RELATION_LABEL: Record<TargetRelation, string> = {
  crush: '알아가는 중',
  talking: '썸 타는 중',
  friend: '친구',
  work: '같이 일하는 사람',
  intro: '소개로 만남',
  ex: '이전 관계',
  unsure: '잘 모름',
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

/**
 * '이전 관계에서 생각보다 중요했던 것' 최대 선택 수.
 *
 * ⚠️ UT-1 P2 §1 — **4 → 5.** 참가자들이 4개에서 막혔다고 답했고, 구조적으로도
 * 4는 어긋난 값이었다: Relationship Mirror는 축이 **5개**(`MIRROR_AXES`)인데
 * 상한이 4라 **어떤 사용자도 5축 전부를 중요하다고 표시할 수 없었다.**
 *
 * ⚠️ **점수 공식은 한 줄도 바뀌지 않는다.** 동기화율은 이 값을 읽지 않고
 * (`declared` × `target`만 본다), Mirror는 이 목록을 **개수가 아니라 포함 여부**로
 * 읽는다(`relationshipEvidence`의 `includes(axis)`). 그래서 상한이 올라가면
 * 달라지는 것은 '사용자가 더 많이 알려줄 수 있다'는 것뿐이고, 판정 규칙은 그대로다.
 *
 * ⚠️ 기존 저장 데이터(4개 이하)는 그대로 유효하다 — 상한을 올리는 변경은 저장된
 * 값을 무효화하지 않는다. 반대 방향(줄이기)이었다면 migration이 필요했을 것이다.
 */
export const MAX_PAST_FACTORS = 5;
