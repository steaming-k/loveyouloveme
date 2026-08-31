import {
  AFFECTION_VALUE,
  CONFLICT_VALUE,
  HOBBY_VALUE,
  TARGET_LEVEL_VALUE,
} from '@/data/labels';
import type {
  DeclaredPreference,
  MirrorAxisKey,
  RelationshipExperience,
  TargetAxisKey,
  TargetProfile,
} from '@/types';

/**
 * 답변 → 1~5 스케일 변환
 *
 * ⚠️ Prototype Demo Logic
 * 아래 매핑과 계산식은 심리 검사나 과학적 진단 로직이 아니다.
 * 입력값의 공통점·차이를 사용자가 직관적으로 읽을 수 있게 만든 규칙 기반 데모 로직이며,
 * 실제 AI 백엔드가 붙으면 aiService 구현체만 교체하면 된다.
 */

/** 나의 값 — 사진 관찰에서 고정된 축(talk/rhythm) + Declared 답변에서 오는 축 */
export function toMineValues(declared: DeclaredPreference): Record<TargetAxisKey, number | null> {
  return {
    talk: 4,
    rhythm: 3,
    alone: declared.alone,
    affection: declared.affection === null ? null : AFFECTION_VALUE[declared.affection],
    conflict: declared.conflict === null ? null : CONFLICT_VALUE[declared.conflict],
    contact: declared.contact,
  };
}

/** 상대의 값 — 'x'(모름)는 null 로 두어 비교에서 제외한다 */
export function toTargetValues(target: TargetProfile): Record<TargetAxisKey, number | null> {
  return {
    talk: TARGET_LEVEL_VALUE[target.talk],
    rhythm: TARGET_LEVEL_VALUE[target.rhythm],
    alone: TARGET_LEVEL_VALUE[target.alone],
    affection: TARGET_LEVEL_VALUE[target.affection],
    conflict: TARGET_LEVEL_VALUE[target.conflict],
    contact: TARGET_LEVEL_VALUE[target.contact],
  };
}

/** Declared Me — Relationship Mirror 축 기준 */
export function toDeclaredMirrorValues(
  declared: DeclaredPreference,
): Record<MirrorAxisKey, number | null> {
  return {
    alone: declared.alone,
    contact: declared.contact,
    hobby: declared.hobby === null ? null : HOBBY_VALUE[declared.hobby],
    conflict: declared.conflict === null ? null : CONFLICT_VALUE[declared.conflict],
    affection: declared.affection === null ? null : AFFECTION_VALUE[declared.affection],
  };
}

/**
 * Relationship Me — 과거 관계 경험에서 역산한 값.
 * '생각보다 중요했던 요소'로 골랐거나 '가장 힘들었던 순간'으로 지목한 항목은
 * 실제 관계에서 더 크게 작동한 것으로 본다.
 */
export function toRelationshipMirrorValues(
  experience: RelationshipExperience,
): Record<MirrorAxisKey, number> {
  const important = experience.important;
  const has = (key: (typeof important)[number]) => important.includes(key);

  return {
    alone: has('alone') ? 5 : 4,
    contact: experience.hardest === 'contact_drop' ? 5 : has('contact') ? 4 : 2,
    hobby: has('hobby') ? 4 : 2,
    conflict: has('conflict') || experience.hardest === 'fight_silence' ? 5 : 3,
    affection: has('affection') ? 4 : 3,
  };
}

/** 두 값의 정렬도 0~5. 값이 같을수록 5에 가깝다. */
export function alignmentOf(mine: number | null, theirs: number | null): number | null {
  if (mine === null || theirs === null) return null;
  return Math.max(0, 5 - Math.abs(mine - theirs));
}
