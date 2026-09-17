import { MAX_PAST_OTHER_LENGTH, pastFactorLabels } from '@/data/labels';
import {
  MAX_DEEP_INPUTS,
  deepConditionForAxis,
  selectDeepInputQuestions,
} from '@/data/relationshipDeepInput';
import { COMPATIBILITY_COPY } from '@/data/copy';
import { allowedRelationshipRefs } from '@/lib/logic/allowedEvidence';
import {
  isAcceptedObservation,
  isUserRefusedObservation,
} from '@/lib/logic/observationStatus';
import { aggregatePhotoObservations } from '@/lib/logic/observedSignals';
import { sanitizeSelfProfile } from '@/lib/persistence/mappers';
import { analysisReadyObservations, toValidatedObservations } from '@/services/aiService';
import { createEmptyAnswers } from '@/state/defaultAnswers';
import type {
  MirrorInsight,
  ObservationFeedback,
  ObservedProfileResult,
  PhotoObservation,
  RelationshipExperience,
  SessionAnswers,
  ValidatedObservation,
} from '@/types';

/**
 * POST /api/dev/ut15-test — **개발 전용** 260915 UT 후속 Fixture 실행기
 *
 * `tests/run-ut15-followup-fixtures.mjs`가 부른다.
 *
 * ⚠️ **판정 로직을 여기서 복제하지 않는다.** 화면·분석이 쓰는 함수를 그대로 부르고
 * 결과만 돌려준다(`nav-test` · `lifecycle-test`와 같은 원칙). 여기서 규칙을 다시 쓰면
 * 테스트는 통과하는데 제품은 틀린 상태가 만들어진다.
 *
 * ⚠️ Provider를 부르지 않는다. 전부 결정론 함수다.
 */

const EMPTY_EXPERIENCE: RelationshipExperience = {
  important: [],
  importantOther: '',
  hardest: null,
  selfGap: null,
  note: '',
  skipped: false,
  adaptive: null,
};

/** 스티치 인형을 고양이로 읽은 UT 사진 — 같은 사진에 '인형'이 함께 보인다 */
const DOLL_PHOTO: PhotoObservation = {
  photoId: 'p1',
  scenes: [{ label: '실내', confidence: 0.9 }],
  activities: [],
  objects: [
    { label: '고양이', confidence: 0.4 },
    { label: '인형', confidence: 0.6 },
  ],
  environment: [{ label: '실내', confidence: 0.9 }],
  evidenceSummary: '실내에서 찍은 사진',
  usable: true,
};

/** 소품 라벨이 없어도 **사물 칸에만** 있는 동물은 생활 맥락이 되지 않는다 */
const OBJECT_ONLY_PHOTO: PhotoObservation = {
  ...DOLL_PHOTO,
  photoId: 'p2',
  objects: [{ label: '고양이', confidence: 0.95 }],
};

/** 진짜 반려동물 사진 — 행위 칸에 높은 확신도로 나온다 */
const REAL_PET_PHOTO: PhotoObservation = {
  photoId: 'p3',
  scenes: [{ label: '거실', confidence: 0.9 }],
  /*
    ⚠️ '산책'을 쓰지 않는다 — `CATEGORY_RULES`는 **위에서부터 처음 걸리는 규칙**을 쓰고
    outdoor가 pet보다 위라 '반려동물과 산책'은 outdoor로 간다. 그건 이번 변경과 무관한
    기존 동작이고, 여기서 검증하려는 것은 '행위 칸에서 온 pet은 살아남는가'다.
  */
  activities: [{ label: '고양이와 놀기', confidence: 0.9 }],
  objects: [{ label: '강아지', confidence: 0.9 }],
  environment: [],
  evidenceSummary: '반려동물과 함께 있는 사진',
  usable: true,
};

const ANALYSIS: ObservedProfileResult = {
  version: '1.0',
  traits: [
    {
      id: 't_ok',
      category: 'lifestyle',
      label: '카페',
      observation: '카페에서 찍은 사진이 있어',
      evidence: [{ imageId: 'p9', description: '카페 실내' }],
      confidence: 'medium',
    },
    {
      id: 't_no',
      category: 'lifestyle',
      label: '반려동물',
      observation: '고양이로 보이는 것이 있어',
      evidence: [{ imageId: 'p1', description: '고양이' }],
      confidence: 'low',
    },
  ],
  limitations: [],
  evidenceCoverage: { imageCount: 2, usableImageCount: 2, level: 'medium' },
  meta: {
    mode: 'mock',
    analysisVersion: '1.0',
    promptVersion: 'observed-v2-photo',
    generatedAt: '2026-09-15T00:00:00.000Z',
    inputFingerprint: 'fixture',
  },
};

const REJECTED: ObservationFeedback = { verdict: 'no' };

const CONTACT_INSIGHT = { key: 'contact', label: '연락', state: 'GAP' } as unknown as MirrorInsight;
const ALONE_INSIGHT = { key: 'alone', label: '개인 시간', state: 'GAP' } as unknown as MirrorInsight;

function categoriesOf(observations: PhotoObservation[]): string[] {
  return aggregatePhotoObservations(observations).map((signal) => signal.category);
}

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, error: 'dev only' }, { status: 404 });
  }

  /* ── P0-1 사진 근거 ─────────────────────────────────────────── */

  const petSignals = aggregatePhotoObservations([REAL_PET_PHOTO]);

  const validated: ValidatedObservation[] = toValidatedObservations(ANALYSIS, { t_no: REJECTED });
  const refsWithRejected = allowedRelationshipRefs({
    insight: CONTACT_INSIGHT,
    experience: EMPTY_EXPERIENCE,
    validated,
    pastObservations: [],
  });

  /* ── P1-1 선택형 심화 입력 ───────────────────────────────────── */

  const baseAnswers: SessionAnswers = {
    ...createEmptyAnswers(),
    declared: { contact: 5, conflict: 'now', alone: 4, affection: 'a2', hobby: 'h2' },
    experience: {
      ...EMPTY_EXPERIENCE,
      important: ['contact', 'conflict'],
      hardest: 'contact_drop',
      selfGap: 'yes',
    },
  };
  const offered = selectDeepInputQuestions(baseAnswers);
  const offeredAgain = selectDeepInputQuestions(baseAnswers);
  const afterAnswering = offered[0]
    ? selectDeepInputQuestions({
        ...baseAnswers,
        deepInputs: [
          { axis: offered[0].axis, questionId: offered[0].id, optionId: offered[0].options[0]!.id },
        ],
      })
    : [];

  const deepInputs = [
    { axis: 'contact' as const, questionId: 'contact_reply_gap', optionId: 'interval' },
  ];
  const refsWithDeep = allowedRelationshipRefs({
    insight: CONTACT_INSIGHT,
    experience: EMPTY_EXPERIENCE,
    deepInputs,
    validated: [],
    pastObservations: [],
  });
  const refsOtherAxis = allowedRelationshipRefs({
    insight: ALONE_INSIGHT,
    experience: EMPTY_EXPERIENCE,
    deepInputs,
    validated: [],
    pastObservations: [],
  });

  /* ── P1-2 '기타' 자유 입력 ───────────────────────────────────── */

  const roundTripped = sanitizeSelfProfile({
    status: 'dating',
    declared: { contact: 4, conflict: 'now', alone: 3, affection: 'a2', hobby: 'h2' },
    experience: {
      ...EMPTY_EXPERIENCE,
      important: ['other'],
      importantOther: '답장이 늦으면 서운했어',
    },
    mbti: null,
    birthProfile: {},
  });

  return Response.json({
    ok: true,
    photo: {
      dollCategories: categoriesOf([DOLL_PHOTO]),
      objectOnlyCategories: categoriesOf([OBJECT_ONLY_PHOTO]),
      realPetCategories: categoriesOf([REAL_PET_PHOTO]),
      /** provenance — 어느 사진에서 무슨 라벨을 보고 만들었는지 */
      petProvenance: petSignals.map((signal) => ({
        category: signal.category,
        photoIds: signal.photoIds,
        evidence: signal.evidence,
      })),
    },
    reject: {
      acceptedWhenRejected: isAcceptedObservation(REJECTED),
      acceptedWhenCorrected: isAcceptedObservation({ verdict: 'no', correctedText: '사실은 인형이야' }),
      acceptedWhenExcluded: isAcceptedObservation({ verdict: 'ok', excluded: true }),
      acceptedWhenUntouched: isAcceptedObservation(undefined),
      statuses: validated.map((item) => [item.original.id, item.status]),
      analysisReadyIds: analysisReadyObservations(validated).map((item) => item.original.id),
      refusedRejected: isUserRefusedObservation('rejected'),
      refusedExcluded: isUserRefusedObservation('excluded'),
      refusedUnverified: isUserRefusedObservation('unverified'),
      refusedConfirmed: isUserRefusedObservation('confirmed'),
      allowedObservedTraitIds: refsWithRejected
        .filter((ref) => ref.source === 'observed')
        .map((ref) => ref.traitId),
    },
    score: { notice: COMPATIBILITY_COPY.notice },
    deepInput: {
      max: MAX_DEEP_INPUTS,
      offeredIds: offered.map((question) => question.id),
      offeredAxes: offered.map((question) => question.axis),
      stableIds: offeredAgain.map((question) => question.id),
      afterAnsweringIds: afterAnswering.map((question) => question.id),
      unsureCondition: deepConditionForAxis(
        [{ axis: 'contact', questionId: 'contact_reply_gap', optionId: 'unsure' }],
        'contact',
      ),
      answeredCondition: deepConditionForAxis(deepInputs, 'contact'),
      answeredAxisHasDeepRef: refsWithDeep.some((ref) => ref.source === 'deep'),
      otherAxisHasDeepRef: refsOtherAxis.some((ref) => ref.source === 'deep'),
    },
    freeText: {
      max: MAX_PAST_OTHER_LENGTH,
      roundTrippedOther: roundTripped.experience.importantOther,
      roundTrippedImportant: roundTripped.experience.important,
      experienceKeyOrder: Object.keys(roundTripped.experience),
      labelsWithText: pastFactorLabels({
        important: ['contact', 'other'],
        importantOther: '답장이 늦으면 서운했어',
      }),
      labelsWithBlank: pastFactorLabels({ important: ['contact', 'other'], importantOther: '   ' }),
      longLabelLength: pastFactorLabels({
        important: ['other'],
        importantOther: 'ㄱ'.repeat(400),
      })[0]?.length,
    },
  });
}
