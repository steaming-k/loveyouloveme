import { SAMPLE_PHOTOS } from '@/data/samplePhotos';
import type { SessionAnswers } from '@/types';

/** 빈 세션 — 모든 질문은 미응답으로 시작한다. Validation이 실제로 동작해야 하기 때문이다. */
export function createEmptyAnswers(): SessionAnswers {
  return {
    status: null,
    photos: [],
    observations: {},
    declared: { contact: null, conflict: null, alone: null, affection: null, hobby: null },
    experience: {
      important: [],
      hardest: null,
      selfGap: null,
      note: '',
      skipped: false,
      adaptive: null,
    },
    target: {
      relation: null,
      contact: 'x',
      conflict: 'x',
      alone: 'x',
      affection: 'x',
      mbti: null,
    },
    savedQuestions: [],
    coreVerdict: null,
    coreCorrection: '',
    mbti: null,
    zodiac: null,
    share: { includeTargetInfo: false, includeDimensionScores: true },
    completed: {
      onboarding: false,
      observed: false,
      declared: false,
      experience: false,
      profile: false,
      compatibility: false,
      mirror: false,
    },
  };
}

/**
 * 데모용 대표 사용자 — 김지수(29세, 현재 솔로, 이전 연애 경험 있음)
 * 기획서 §4.4 Persona / 프롬프트 §13 Mock Data 기준.
 *
 * 이 값들은 UT나 포트폴리오 시연에서 '동기화율 78 → 연락 GAP → 연결감 Core Insight'
 * 시나리오를 한 번에 보여주기 위한 것이다. 사용자가 직접 답하면 결과도 함께 달라진다.
 */
export function createSampleAnswers(): SessionAnswers {
  const base = createEmptyAnswers();

  return {
    ...base,
    status: 'solo_exp',
    photos: SAMPLE_PHOTOS.slice(0, 6).map((photo) => ({ ...photo })),
    observations: {
      ob1: { verdict: 'ok' },
      ob2: { verdict: 'ok' },
      ob3: { verdict: 'no' },
      ob4: { verdict: 'ok' },
    },
    declared: { contact: 2, conflict: 'now', alone: 5, affection: 'a2', hobby: 'h3' },
    experience: {
      important: ['talk', 'contact', 'conflict', 'alone'],
      hardest: 'contact_drop',
      selfGap: 'yes',
      note: '',
      skipped: false,
      adaptive: { axis: 'contact', optionId: 'disconnect' },
    },
    target: {
      relation: 'crush',
      contact: 'h',
      conflict: 'l',
      alone: 'h',
      affection: 'm',
      // MBTI는 비워둔다 — 동기화율 78 데모 시나리오 숫자를 그대로 유지하기 위해서다.
      mbti: null,
    },
    completed: {
      onboarding: true,
      observed: true,
      declared: true,
      experience: true,
      profile: true,
      compatibility: false,
      mirror: false,
    },
  };
}
