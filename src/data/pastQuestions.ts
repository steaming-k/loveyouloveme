import type { HardestMoment, SelfGapAnswer } from '@/types';

/** Relationship Me — 과거 관계 질문 (S15~S17). 긴 에세이 폼 대신 구조화 입력 우선. */

export type PastStep = 1 | 2 | 3;
export const PAST_STEPS: PastStep[] = [1, 2, 3];
export const PAST_TOTAL = 3;

/** 각 스텝의 상단 진행률 (%) — 와이어프레임 헤더 bar 값 */
export const PAST_PROGRESS: Record<PastStep, number> = { 1: 66, 2: 72, 3: 78 };

export const HARDEST_OPTIONS: readonly {
  value: HardestMoment;
  label: string;
  description: string;
}[] = [
  {
    value: 'contact_drop',
    label: '연락이 줄어들 때',
    description: '답이 늦어지거나 대화가 짧아지는 상황',
  },
  {
    value: 'fight_silence',
    label: '싸운 뒤 이야기가 멈출 때',
    description: '해결되지 않은 채로 시간이 지나는 상황',
  },
  {
    value: 'no_time',
    label: '내 시간이 없어질 때',
    description: '생활이 상대 중심으로 맞춰지는 상황',
  },
  {
    value: 'value_gap',
    label: '기준이 다르다고 느낄 때',
    description: '돈·미래·생활 방식에 대한 차이',
  },
];

export const SELF_GAP_OPTIONS: readonly { value: SelfGapAnswer; label: string }[] = [
  { value: 'yes', label: '꽤 달랐어' },
  { value: 'some', label: '조금 달랐어' },
  { value: 'no', label: '거의 비슷했어' },
];

export const PAST_NOTE_PLACEHOLDER =
  '예) 처음엔 연락에 무던하다고 생각했는데, 답이 늦어지면 계속 신경이 쓰였어.';

export const PAST_NOTE_MAX = 300;
