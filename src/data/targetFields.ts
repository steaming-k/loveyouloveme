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
];

/**
 * '이 사람과 나는' 선택지. 순서 = 관계가 가까운 쪽 → 맥락만 있는 쪽 → 지난 관계 → 모름.
 *
 * ⚠️ 이 값은 **판정**(동기화율·Mirror·History)에 쓰지 않는다. 새 옵션을 추가해도
 * 그 세 곳에는 분기를 만들지 않는다.
 *
 * ⚠️ UT-1 P1-A §4 — **`ex`는 lifecycle에 연결돼 있다.** 옵션만 늘리면 헤어진 상대를
 * 고른 사용자가 `talking`/`dating` Job을 받아 "먼저 연락해봐"를 본다. STAGE 도출은
 * `resolveRelationshipStageOf()` 한 곳에 있고, 거기서 `ex`를 `ended`로 읽는다 —
 * 화면마다 `relation === 'ex'`를 다시 쓰지 않는다.
 *
 * ⚠️ 라벨 문자열은 `TARGET_RELATION_LABEL`(`data/labels.ts`)과 **같아야 한다** —
 * 복원 sanitizer가 그 Record로 값을 검사한다.
 */
export const TARGET_RELATION_OPTIONS: readonly { value: TargetRelation; label: string }[] = [
  { value: 'crush', label: '알아가는 중' },
  { value: 'talking', label: '썸 타는 중' },
  { value: 'friend', label: '친구' },
  { value: 'work', label: '같이 일하는 사람' },
  { value: 'intro', label: '소개로 만남' },
  { value: 'ex', label: '이전 관계' },
  { value: 'unsure', label: '잘 모름' },
];

/** 동기화율을 계산하기 위한 최소 비교 항목 수. 미달이면 확신 낮음 화면(E3)으로 간다. */
export const TARGET_MIN_KNOWN = 3;
