import type { MirrorAxisKey, MirrorState, TargetAxisKey, TargetLevel } from '@/types';

/**
 * Compatibility 축 정의 (S22 Detail / S23 Good / S24 Friction)
 * 와이어프레임 스크립트의 AXIS_DEFS 를 옮기되, talk(대화 방식)/rhythm(생활 리듬) 축은 제거했다.
 * 예전에는 이 두 축의 '나의 값'을 사진 관찰 고정값(4, 3)으로 하드코딩했는데,
 * 사용자가 실제로 준 데이터가 아니라서 계산에 넣지 않기로 했다 — 대신 축 자체를 뺐다
 * (v1에서는 질문을 늘리지 않는 쪽을 선택. Option B).
 */
export interface AxisDefinition {
  key: TargetAxisKey;
  label: string;
  theirsPhrase: Record<Exclude<TargetLevel, 'x'>, string>;
  evidence: string;
  /** 실제 관계에서 나타날 수 있는 상황 */
  scene: string;
}

export const AXIS_DEFINITIONS: readonly AxisDefinition[] = [
  {
    key: 'alone',
    label: '개인 시간',
    theirsPhrase: { l: '거의 안 챙김', m: '보통', h: '중요해 보임' },
    evidence: '개인 시간 질문 답변과 상대에 대한 입력이 같은 구간이에요.',
    scene: '각자 시간을 보내는 걸 거절로 받아들일 가능성이 비교적 낮아 보여요.',
  },
  {
    key: 'affection',
    label: '애정 표현',
    theirsPhrase: { l: '담백', m: '보통', h: '표현 많음' },
    evidence: '애정 표현 질문 답변과 상대 입력이 같은 구간이에요.',
    scene: '표현의 양 때문에 서운함이 생길 가능성은 낮은 편이에요.',
  },
  {
    key: 'conflict',
    label: '갈등 해결',
    theirsPhrase: { l: '혼자 생각한 뒤 이야기', m: '조금 뒤 대화', h: '바로 대화' },
    evidence: '너는 갈등 질문에서 빠른 대화를 선택했고, 상대는 시간을 두는 쪽으로 입력됐어요.',
    scene: '한쪽은 대화를 피한다고 느끼고, 다른 쪽은 생각할 시간을 주지 않는다고 느낄 수 있어요.',
  },
  {
    key: 'contact',
    label: '연락 방식',
    theirsPhrase: { l: '뜸한 편', m: '보통', h: '자주' },
    evidence: '연락 중요도는 낮게 답했지만, 이전 관계에서는 연락 감소를 주요 어려움으로 선택했어요.',
    scene: '연락 빈도가 달라지는 시기에 서로 다른 의미로 읽을 수 있어요.',
  },
];

/** 대화 질문 (S25) — 축별로 실제 행동으로 이어지는 질문 */
export const QUESTION_BY_AXIS: Record<TargetAxisKey, string> = {
  conflict: '싸웠을 때 어느 정도 시간이 필요해?',
  contact: '연락이 줄어들면 어떤 의미로 받아들이는 편이야?',
  alone: '혼자 있고 싶을 때 상대에게 어떻게 알려주는 게 편해?',
  affection: '애정 표현은 어떤 방식이 제일 편해?',
};

/* ------------------------------------------------ Relationship Mirror (S27) */

export const MIRROR_AXES: readonly { key: MirrorAxisKey; label: string }[] = [
  { key: 'alone', label: '개인 시간' },
  { key: 'contact', label: '연락' },
  { key: 'hobby', label: '취미 공유' },
  { key: 'conflict', label: '갈등 해결' },
  { key: 'affection', label: '애정 표현' },
];

/** 네가 말한 너 — 한 줄 표현 */
export const DECLARED_PHRASE: Record<MirrorAxisKey, string> = {
  contact: '연락은 별로 중요하지 않음',
  alone: '혼자 있는 시간이 가장 중요',
  hobby: '취미는 같이 하는 게 중요',
  conflict: '싸우면 바로 이야기하고 싶음',
  affection: '애정 표현은 적당히',
};

/** 관계에서 나타난 너 — 한 줄 표현 */
export const RELATIONSHIP_PHRASE: Record<MirrorAxisKey, string> = {
  contact: '연락 감소가 가장 힘들었음',
  alone: '개인 시간이 꾸준히 중요했음',
  hobby: '실제로는 우선순위가 낮았음',
  conflict: '갈등이 멈추는 상황이 가장 힘들었음',
  affection: '표현이 줄면 서운함이 컸음',
};

/**
 * 항목 × 상태별 러비의 해석. 단정하지 않고 관찰로만 말한다.
 * UNKNOWN(근거 없음)은 애초에 화면에 노출하지 않으므로 해석 문장이 필요 없다.
 */
export const MIRROR_NOTE: Record<MirrorAxisKey, Record<Exclude<MirrorState, 'UNKNOWN'>, string>> = {
  alone: {
    MATCH: '혼자 있는 시간은 실제 관계에서도 꾸준히 중요했어.',
    GAP: '생각보다 관계에서 더 강하게 필요했던 항목이야.',
    CHANGE: '경험 후 필요도가 낮아졌어.',
  },
  contact: {
    MATCH: '연락에 대한 기준은 경험 전후가 비슷했어.',
    GAP: '중요하지 않다고 생각했지만 관계에서는 생각보다 크게 반응했어.',
    CHANGE: '연락에 대한 기준이 경험 후 낮아졌어.',
  },
  hobby: {
    MATCH: '취미 공유에 대한 기준은 그대로였어.',
    GAP: '생각보다 함께 하는 시간이 중요했어.',
    CHANGE: '연애 전에는 중요했지만 실제 경험 후 우선순위가 낮아졌어.',
  },
  conflict: {
    MATCH: '빠르게 해결하고 싶은 성향이 경험에서도 그대로 나타났어.',
    GAP: '갈등이 멈추는 상황에 생각보다 크게 반응했어.',
    CHANGE: '경험 후에는 시간을 두는 쪽으로 기준이 옮겨졌어.',
  },
  affection: {
    MATCH: '표현의 양에 대한 기준은 경험 전후가 비슷했어.',
    GAP: '표현이 줄어드는 상황에 생각보다 민감했어.',
    CHANGE: '표현의 양보다 다른 기준이 중요해졌어.',
  },
};
