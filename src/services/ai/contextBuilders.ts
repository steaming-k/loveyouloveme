import { adaptiveOptionLabel } from '@/data/adaptive';
import { AXIS_DEFINITIONS, MIRROR_AXES } from '@/data/axes';
import {
  AFFECTION_LABEL,
  CONFLICT_LABEL,
  HARDEST_LABEL,
  HOBBY_LABEL,
  PAST_FACTOR_LABEL,
} from '@/data/labels';
import { sanitizeFreeText } from './safety';
import type {
  CompatibilityResult,
  DeclaredPreference,
  HistoryAxisChange,
  MirrorReport,
  RelationshipExperience,
  RelationshipStatus,
  SessionAnswers,
  ValidatedObservation,
} from '@/types';

/**
 * Task별 Context Builder (§25 · §26)
 *
 * 원시 세션을 `JSON.stringify` 해서 LLM에 던지지 않는다. Task가 **실제로 필요한 최소 데이터**만
 * 만들어 보낸다.
 *
 * ⚠️ 전송하지 않는 것:
 *   - Birth Profile (사주·별자리는 별도 Lens · §27)
 *   - Premium 클릭 여부 / 가격 variant (결제 의향이 분석에 영향 금지 · §28)
 *   - 사진 원본 (Observed task 외 · §26)
 *   - 상대 이름 등 식별정보 — 애초에 저장하지 않는다 (§29)
 *   - MBTI / Zodiac (Core 분석과 분리)
 */

/* ------------------------------------------------ Observed (사진 분석) */

export interface ObservedContext {
  imageIds: string[];
  /** 사진 외 다른 개인 정보를 함께 보내지 않는다 */
  guidance: { maxTraits: number; minEvidencePerTrait: number };
}

export function buildObservedContext(imageIds: readonly string[]): ObservedContext {
  return {
    imageIds: [...imageIds],
    guidance: { maxTraits: 6, minEvidencePerTrait: 1 },
  };
}

/* ------------------------------------------------------ Relationship */

export interface RelationshipContext {
  status: RelationshipStatus | null;
  declared: Record<string, string | number | null>;
  relationship: {
    importantFactors: string[];
    hardestMoment: string | null;
    selfGap: string | null;
    /** 사용자 자유서술 — 데이터 영역으로 감싸서 보낸다 */
    note: string | null;
  };
  adaptive: { axis: string; reason: string } | null;
  /** 사용자가 확인·수정한 관찰만. 제외한 항목은 보내지 않는다(§14) */
  observedValidated: Array<{ traitId: string; text: string; source: 'user' | 'ai' }>;
  /** 규칙이 이미 판정한 결과 — AI는 이걸 설명만 한다 */
  ruleJudgements: Array<{
    axis: string;
    label: string;
    state: string;
    declaredPhrase: string;
    relationshipSignal: string;
    isFocus: boolean;
  }>;
  pastObservations: Array<{ axis: string; entryId: string; note: string }>;
}

const SELF_GAP_LABEL: Record<string, string> = {
  yes: '연애 전 생각한 나와 실제 연애 속 내가 달랐다',
  some: '조금 달랐다',
  no: '거의 같았다',
};

function declaredForContext(declared: DeclaredPreference): Record<string, string | number | null> {
  return {
    contactImportance: declared.contact,
    conflictStyle: declared.conflict ? CONFLICT_LABEL[declared.conflict] : null,
    aloneNeed: declared.alone,
    affectionStyle: declared.affection ? AFFECTION_LABEL[declared.affection] : null,
    hobbySharing: declared.hobby ? HOBBY_LABEL[declared.hobby] : null,
  };
}

/**
 * 사용자 검증 우선순위(§14): USER CORRECTION > CONFIRMED AI > UNVERIFIED AI, excluded는 제거.
 * AI에게도 '무엇이 사용자 말이고 무엇이 AI 추측인지' 구분해 알려준다.
 */
export function validatedObservationsForContext(
  observations: readonly ValidatedObservation[],
): RelationshipContext['observedValidated'] {
  const ranked = observations
    .filter((item) => item.status !== 'excluded')
    .sort((a, b) => rankStatus(b.status) - rankStatus(a.status));

  return ranked.map((item) => {
    const correction = sanitizeFreeText(item.userCorrection, 120);
    return correction
      ? { traitId: item.original.id, text: correction, source: 'user' as const }
      : { traitId: item.original.id, text: item.original.observation, source: 'ai' as const };
  });
}

function rankStatus(status: ValidatedObservation['status']): number {
  if (status === 'corrected') return 3;
  if (status === 'confirmed') return 2;
  return 1;
}

export function buildRelationshipContext(input: {
  answers: SessionAnswers;
  mirror: MirrorReport;
  validated: readonly ValidatedObservation[];
  pastObservations?: readonly { axis: string; entryId: string; note: string }[];
}): RelationshipContext {
  const { answers, mirror, validated, pastObservations = [] } = input;
  const experience: RelationshipExperience = answers.experience;
  const focusAxis = mirror.teaser?.axisKey ?? null;

  return {
    status: answers.status,
    declared: declaredForContext(answers.declared),
    relationship: {
      importantFactors: experience.important.map((factor) => PAST_FACTOR_LABEL[factor]),
      hardestMoment: experience.hardest ? HARDEST_LABEL[experience.hardest] : null,
      selfGap: experience.selfGap ? (SELF_GAP_LABEL[experience.selfGap] ?? null) : null,
      note: sanitizeFreeText(experience.note, 300),
    },
    adaptive: experience.adaptive
      ? {
          axis: experience.adaptive.axis,
          reason: adaptiveOptionLabel(experience.adaptive.axis, experience.adaptive.optionId),
        }
      : null,
    observedValidated: validatedObservationsForContext(validated),
    ruleJudgements: mirror.insights.map((insight) => ({
      axis: insight.key,
      label: insight.label,
      state: insight.state,
      declaredPhrase: insight.declaredPhrase,
      relationshipSignal: insight.relationshipSignal,
      isFocus: insight.key === focusAxis,
    })),
    pastObservations: [...pastObservations],
  };
}

/* ----------------------------------------------------- Compatibility */

export interface CompatibilityContext {
  /** 점수는 참고로만 보낸다 — AI가 새 점수를 만들지 못하게 프롬프트에서 막는다 */
  computedScore: number | null;
  comparedCount: number;
  dimensions: Array<{
    key: string;
    label: string;
    kind: 'good' | 'friction' | 'neutral' | 'unknown';
    minePhrase: string;
    theirsPhrase: string;
  }>;
  targetRelation: string | null;
}

export function buildCompatibilityContext(result: CompatibilityResult): CompatibilityContext {
  const goodKeys = new Set(result.goodSignals.map((signal) => signal.key));
  const frictionKeys = new Set(result.frictionSignals.map((signal) => signal.key));

  return {
    computedScore: result.score,
    comparedCount: result.comparedCount,
    dimensions: result.dimensions
      .filter((dimension) => dimension.alignment !== null)
      .map((dimension) => ({
        key: dimension.key,
        label: dimension.label,
        kind: goodKeys.has(dimension.key)
          ? ('good' as const)
          : frictionKeys.has(dimension.key)
            ? ('friction' as const)
            : ('neutral' as const),
        minePhrase: dimension.minePhrase,
        theirsPhrase: dimension.theirsPhrase,
      })),
    // 상대는 '관계 맥락'만. 이름·출생정보 등은 보내지 않는다.
    targetRelation: null,
  };
}

/** AI가 설명해도 되는 축 목록 — 규칙이 정한 kind를 함께 넘긴다 */
export function compatibilityAllowList(
  result: CompatibilityResult,
): { key: (typeof AXIS_DEFINITIONS)[number]['key']; kind: 'good' | 'friction' }[] {
  return [
    ...result.goodSignals.map((signal) => ({ key: signal.key, kind: 'good' as const })),
    ...result.frictionSignals.map((signal) => ({ key: signal.key, kind: 'friction' as const })),
  ];
}

/* ---------------------------------------------------------- History */

export interface HistoryContext {
  changes: Array<{
    axis: string;
    label: string;
    state: string;
    previousText: string | null;
    currentText: string | null;
    declaredDelta: { past: number; now: number } | null;
  }>;
}

export function buildHistoryContext(changes: readonly HistoryAxisChange[]): HistoryContext {
  return {
    changes: changes
      .filter((change) => change.state !== 'INSUFFICIENT')
      .map((change) => ({
        axis: change.axis,
        label: change.label,
        state: change.state,
        previousText: change.previousText,
        currentText: change.currentText,
        declaredDelta: change.declaredDelta,
      })),
  };
}

/** Mirror 축 라벨 — 화면·프롬프트에서 공통으로 쓴다 */
export const MIRROR_AXIS_LABELS = MIRROR_AXES;
