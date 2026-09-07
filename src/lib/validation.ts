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

/**
 * S07 — 사진 분석으로 넘어갈 수 있는가.
 *
 * ⚠️ v1.37 — **업로드한 사진만 센다.** 샘플 타일은 실제 이미지 파일이 아니라 색 타일이라
 * `prepareImagesForAnalysis()`가 전부 걸러내고, 서버는 이미지 0장을 `NO_USABLE_IMAGE`로
 * 돌려준다. 예전에는 여기서 샘플 타일까지 세는 바람에 S07이 '샘플 사진으로 체험해도
 * 괜찮아'라고 안내해놓고 6.1초를 기다리게 한 뒤 실패 화면으로 보냈다 — 화면이 약속한 것을
 * 파이프라인이 할 수 없는 상태였다. 이제 그 약속을 화면에서 하지 않는다.
 *
 * **이 함수는 게이트가 아니다.** 사진이 없어도 S07에서 질문으로 바로 갈 수 있다(§0
 * '사진은 입장권이 아니다'). 이 값이 false면 '분석을 돌릴 수 없다'는 뜻일 뿐,
 * '퍼널을 진행할 수 없다'는 뜻이 아니다.
 */
export function isPhotoSelectionValid(answers: SessionAnswers): boolean {
  return usablePhotoCount(answers) >= PHOTO_MIN_COUNT;
}

/** 실제로 Provider에 전송될 수 있는 사진 수 — 샘플 타일은 세지 않는다 */
export function usablePhotoCount(answers: SessionAnswers): number {
  return answers.photos.filter((photo) => photo.source === 'upload').length;
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

/**
 * 관측 기록이 얇아 결론을 내리기 어려운 상태 (E1) — `/mirror`가 이 값으로 본문을 막는다.
 *
 * ⚠️ v1.37 — **사진 장수를 보지 않는다.** 예전에는 `photos.length < PHOTO_MIN_COUNT`가
 * 조건에 있어서, 사진이 없는 사용자는 Declared 4개와 관계 경험을 다 답해도 Relationship
 * Mirror 본문에 영원히 닿지 못했다(Primary KPI 화면이다). 그런데 `buildMirrorReport()`는
 * `(declared, experience)`만 받는다 — **판정에 쓰지도 않는 데이터로 판정을 막고 있었다**
 * (§1.3 데이터 위계 · §0 '사진은 입장권이 아니다').
 *
 * 근거 부족은 Mirror가 실제로 쓰는 재료로만 판단한다. 사진이 없으면 Observed 섹션이
 * 없을 뿐이고, 그건 이 화면이 막힐 이유가 아니다.
 */
export function isLowData(answers: SessionAnswers): boolean {
  const thinExperience = !answers.experience.skipped && answers.experience.important.length === 0;
  return thinExperience || !isDeclaredComplete(answers.declared);
}
