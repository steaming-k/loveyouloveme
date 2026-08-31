import { AFFECTION_VALUE, CONFLICT_VALUE, HOBBY_VALUE, TARGET_LEVEL_VALUE } from '@/data/labels';
import type {
  DeclaredPreference,
  MbtiType,
  MirrorAxisKey,
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
 *
 * 4개 축(contact/conflict/alone/affection)만 다룬다. talk(대화 방식)/rhythm(생활 리듬)은
 * 예전에 '나의 값'을 사진 관찰 고정값(4, 3)으로 하드코딩했었는데, 사용자가 실제로 준 데이터가
 * 아니라서 축 자체를 뺐다 — 수집하지 않은 데이터를 사용자의 특성처럼 계산하지 않는다.
 */

/** 나의 값 — Declared 답변에서만 가져온다 */
export function toMineValues(declared: DeclaredPreference): Record<TargetAxisKey, number | null> {
  return {
    alone: declared.alone,
    affection: declared.affection === null ? null : AFFECTION_VALUE[declared.affection],
    conflict: declared.conflict === null ? null : CONFLICT_VALUE[declared.conflict],
    contact: declared.contact,
  };
}

/** 상대의 값 — 'x'(모름)는 null 로 두어 비교에서 제외한다 */
export function toTargetValues(target: TargetProfile): Record<TargetAxisKey, number | null> {
  return {
    alone: TARGET_LEVEL_VALUE[target.alone],
    affection: TARGET_LEVEL_VALUE[target.affection],
    conflict: TARGET_LEVEL_VALUE[target.conflict],
    contact: TARGET_LEVEL_VALUE[target.contact],
  };
}

/** Declared Me — Relationship Mirror 축 기준. 이 값은 실제로 1~5 척도로 수집된 값이다. */
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

/** Declared 축 중 사용자가 실제로 1~5 슬라이더로 답한 축인지 (나머지는 3지선다를 내부적으로 스케일화한 것) */
export const DECLARED_HAS_NATIVE_SCALE: Record<MirrorAxisKey, boolean> = {
  alone: true,
  contact: true,
  hobby: false,
  conflict: false,
  affection: false,
};

/** 두 값의 정렬도 0~1. 1이면 완전히 같고, 0이면 완전히 반대(1~5 척도 기준 최대 차이 4). */
export function similarityOf(mine: number | null, theirs: number | null): number | null {
  if (mine === null || theirs === null) return null;
  return Math.max(0, 1 - Math.abs(mine - theirs) / 4);
}

/**
 * MBTI 4글자(E/I·S/N·T/F·J/P) 중 같은 자리가 몇 개인지 비율로 본다.
 * ⚠️ 이건 성향 상성 이론이나 심리 검사가 아니다 — 입력한 4글자가 얼마나 겹치는지만 보는
 * 단순 규칙이다. 궁합 점수와 같은 원칙(수집한 값만, 인위적 하한선 없이)을 따른다.
 */
export function mbtiMatchCount(mine: MbtiType, theirs: MbtiType): number {
  return [0, 1, 2, 3].filter((i) => mine[i] === theirs[i]).length;
}

export function mbtiSimilarity(mine: MbtiType, theirs: MbtiType): number {
  return mbtiMatchCount(mine, theirs) / 4;
}
