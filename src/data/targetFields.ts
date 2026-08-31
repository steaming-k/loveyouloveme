import type { TargetAxisKey, TargetRelation } from '@/types';

/** 상대 정보 입력 (S19). 모르는 항목은 '모름'으로 남길 수 있고, 점수에 반영하지 않는다. */

export interface TargetField {
  key: TargetAxisKey;
  label: string;
  options: readonly { value: 'l' | 'm' | 'h'; label: string }[];
}

export const TARGET_FIELDS: readonly TargetField[] = [
  {
    key: 'contact',
    label: '연락 방식',
    options: [
      { value: 'l', label: '뜸한 편' },
      { value: 'm', label: '보통' },
      { value: 'h', label: '자주' },
    ],
  },
  {
    key: 'conflict',
    label: '갈등 방식',
    options: [
      { value: 'l', label: '혼자 생각' },
      { value: 'm', label: '조금 뒤 대화' },
      { value: 'h', label: '바로 대화' },
    ],
  },
  {
    key: 'alone',
    label: '개인 시간',
    options: [
      { value: 'l', label: '거의 안 챙김' },
      { value: 'm', label: '보통' },
      { value: 'h', label: '중요해 보임' },
    ],
  },
  {
    key: 'affection',
    label: '애정 표현',
    options: [
      { value: 'l', label: '담백' },
      { value: 'm', label: '보통' },
      { value: 'h', label: '표현 많음' },
    ],
  },
  {
    key: 'talk',
    label: '대화 방식',
    options: [
      { value: 'l', label: '말수 적음' },
      { value: 'm', label: '보통' },
      { value: 'h', label: '이야기 많음' },
    ],
  },
  {
    key: 'rhythm',
    label: '생활 리듬',
    options: [
      { value: 'l', label: '집에 있는 편' },
      { value: 'm', label: '반반' },
      { value: 'h', label: '밖에 많음' },
    ],
  },
];

export const TARGET_RELATION_OPTIONS: readonly { value: TargetRelation; label: string }[] = [
  { value: 'crush', label: '알아가는 중' },
  { value: 'friend', label: '친구' },
  { value: 'work', label: '같이 일하는 사람' },
  { value: 'intro', label: '소개로 만남' },
];

/** 동기화율을 계산하기 위한 최소 비교 항목 수. 미달이면 확신 낮음 화면(E3)으로 간다. */
export const TARGET_MIN_KNOWN = 3;
