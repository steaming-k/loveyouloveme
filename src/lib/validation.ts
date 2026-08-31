import { DECLARED_STEPS, type DeclaredStep } from '@/data/declaredQuestions';
import { PHOTO_MIN_COUNT } from '@/data/samplePhotos';
import { TARGET_FIELDS, TARGET_MIN_KNOWN } from '@/data/targetFields';
import type { DeclaredPreference, RelationshipExperience, SessionAnswers, TargetProfile } from '@/types';

/** 각 Declared 스텝에서 반드시 채워야 하는 필드 */
const DECLARED_STEP_FIELDS: Record<DeclaredStep, (keyof DeclaredPreference)[]> = {
  1: ['contact'],
  2: ['conflict'],
  3: ['alone'],
  4: ['affection', 'hobby'],
};

export function isDeclaredStepComplete(declared: DeclaredPreference, step: DeclaredStep): boolean {
  return DECLARED_STEP_FIELDS[step].every((field) => declared[field] !== null);
}

export function declaredStepMissingFields(
  declared: DeclaredPreference,
  step: DeclaredStep,
): (keyof DeclaredPreference)[] {
  return DECLARED_STEP_FIELDS[step].filter((field) => declared[field] === null);
}

export function isDeclaredComplete(declared: DeclaredPreference): boolean {
  return DECLARED_STEPS.every((step) => isDeclaredStepComplete(declared, step));
}

export function firstIncompleteDeclaredStep(declared: DeclaredPreference): DeclaredStep | null {
  return DECLARED_STEPS.find((step) => !isDeclaredStepComplete(declared, step)) ?? null;
}

export function isPhotoSelectionValid(answers: SessionAnswers): boolean {
  return answers.photos.length >= PHOTO_MIN_COUNT;
}

export function isObservedReviewComplete(answers: SessionAnswers): boolean {
  // 최소 1개 항목에 대해 확인 또는 수정을 남겨야 다음으로 넘어간다.
  return Object.values(answers.observations).some(
    (feedback) => feedback.verdict !== null || feedback.excluded,
  );
}

export function isExperienceComplete(experience: RelationshipExperience): boolean {
  if (experience.skipped) return true;
  return experience.important.length > 0 && experience.hardest !== null && experience.selfGap !== null;
}

export function targetKnownCount(target: TargetProfile): number {
  return TARGET_FIELDS.filter((field) => target[field.key] !== 'x').length;
}

export function isTargetComparable(target: TargetProfile): boolean {
  return targetKnownCount(target) >= TARGET_MIN_KNOWN;
}

/** 프로필(S18)을 만들 수 있는 상태인지 */
export function canBuildProfile(answers: SessionAnswers): boolean {
  return isDeclaredComplete(answers.declared) && isExperienceComplete(answers.experience);
}

/** 관측 기록이 얇아 결론을 내리기 어려운 상태 (E1) */
export function isLowData(answers: SessionAnswers): boolean {
  const thinPhotos = answers.photos.length < PHOTO_MIN_COUNT;
  const thinExperience = !answers.experience.skipped && answers.experience.important.length === 0;
  return thinPhotos || thinExperience || !isDeclaredComplete(answers.declared);
}
