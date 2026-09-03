import { SAMPLE_PHOTOS } from '@/data/samplePhotos';
import { createEmptyBirthProfile } from '@/lib/logic/birth';
import { buildDemoObservedResult } from '@/services/ai/fallback';
import type { SessionAnswers, TargetProfile } from '@/types';

/**
 * 상대(Target)에 종속된 데이터의 기본값 — Main Funnel 최초 진입과 v1.11.1
 * `resetTargetContext()`(새로운 사람과 궁합 보기)가 공용으로 쓴다.
 * Home에서 직접 빈 객체를 새로 만들지 않는다(§7).
 */
export function createEmptyTargetProfile(): TargetProfile {
  return {
    relation: null,
    contact: 'x',
    conflict: 'x',
    alone: 'x',
    affection: 'x',
    mbti: null,
    birthProfile: createEmptyBirthProfile(),
    preferences: { interests: [] },
  };
}

/** 빈 세션 — 모든 질문은 미응답으로 시작한다. Validation이 실제로 동작해야 하기 때문이다. */
export function createEmptyAnswers(): SessionAnswers {
  return {
    status: null,
    photos: [],
    observations: {},
    observedAnalysis: null,
    declared: { contact: null, conflict: null, alone: null, affection: null, hobby: null },
    experience: {
      important: [],
      hardest: null,
      selfGap: null,
      note: '',
      skipped: false,
      adaptive: null,
    },
    target: createEmptyTargetProfile(),
    savedQuestions: [],
    coreVerdict: null,
    coreCorrection: '',
    mbti: null,
    birthProfile: createEmptyBirthProfile(),
    legacyZodiac: null,
    share: { includeTargetInfo: false, includeDimensionScores: true },
    deepAnswers: [],
    deepInsightFeedback: {},
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
 * 데모용 대표 사용자 — 한사랑(29세, 현재 솔로, 이전 연애 경험 있음)
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
    /**
     * v1.16 — Profile Result(S18)의 OBSERVED ME 칩이 이제 `observedAnalysis.traits`를 근거로
     * 삼는다(profile.ts `observedItems` 참고). 이 값이 없으면(예전엔 없어도 되던 필드) 데모
     * 세션에서 그 칩이 비어 보인다 — 아래 `observations`(ob1~ob4)와 짝이 맞는 데모 분석
     * 결과를 함께 채워둔다.
     */
    observedAnalysis: buildDemoObservedResult({
      photoCount: 6,
      inputFingerprint: 'sample',
      mode: 'demo',
    }),
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
      // MBTI·출생정보는 비워둔다 — 동기화율 데모 시나리오 숫자를 그대로 유지하고,
      // Entertainment Lens는 사용자가 직접 입력했을 때만 켜지는 걸 보여주기 위해서다.
      mbti: null,
      birthProfile: createEmptyBirthProfile(),
      preferences: { interests: [] },
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
