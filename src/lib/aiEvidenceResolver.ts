import { adaptiveOptionLabel } from '@/data/adaptive';
import { MIRROR_AXES } from '@/data/axes';
import {
  AFFECTION_LABEL,
  CONFLICT_LABEL,
  HARDEST_LABEL,
  HOBBY_LABEL,
  PAST_FACTOR_LABEL,
  SELF_GAP_LABEL,
} from '@/data/labels';
import { withObjectParticle } from '@/lib/korean';
import type {
  EvidenceRef,
  RelationshipHistoryEntry,
  SessionAnswers,
  ValidatedObservation,
} from '@/types';

/**
 * EvidenceRef Resolver (v1.7 · §34 · §35 · §73 · §74 · §75)
 *
 * AI가 근거 문장을 **직접 써서 보여주게 하지 않는다.** AI는 '어디를 봤는지'(`EvidenceRef`)만
 * 지목하고, 화면에 보이는 근거 텍스트는 이 함수가 **실제 세션 데이터에서** 만든다.
 * 그래서 AI가 근거를 그럴듯하게 지어내도 UI에 도달할 수 없다.
 *
 * ⚠️ 신뢰 우선순위(§74) — 이 순서는 뒤집히지 않는다:
 *   USER DIRECT INPUT > USER CORRECTION > RELATIONSHIP EXPERIENCE
 *     > AI OBSERVATION > PAST AI OBSERVATION
 *
 * ⚠️ 현재 세션에 존재하지 않는 ref는 **렌더하지 않는다**(§35).
 *   유효한 근거가 하나도 남지 않으면 호출자가 Narrative 자체를 fallback으로 내린다.
 */

/** 사용자에게 보여주는 근거 출처 라벨 (§73) */
export type EvidenceSourceLabel =
  | '내가 답한 내용'
  | '관계 경험'
  | '추가 질문'
  | '사진에서 관찰'
  | '사용자 수정'
  | '과거 관찰';

export interface ResolvedEvidence {
  key: string;
  sourceLabel: EvidenceSourceLabel;
  text: string;
}

export interface EvidenceResolverContext {
  answers: SessionAnswers;
  validated: readonly ValidatedObservation[];
  historyEntries?: readonly RelationshipHistoryEntry[];
}

const MIRROR_AXIS_LABEL = new Map(MIRROR_AXES.map((axis) => [axis.key as string, axis.label]));

/**
 * 선택지를 따옴표로 감싸고 목적격 조사를 붙인다.
 *
 * 라벨에 '적당히 주고받기'(받침 없음)와 '오늘 안에 이야기'(받침 없음), '담백한 편'(받침 있음)이
 * 섞여 있어서 '을'을 하드코딩하면 "'적당히 주고받기'을 골랐어"가 된다.
 * 조사는 따옴표가 아니라 **마지막 글자**를 기준으로 정해져야 하므로 라벨로 판정한다.
 */
function quoted(label: string): string {
  return `'${label}'${withObjectParticle(label).slice(label.length)}`;
}

/* --------------------------------------------------------- declared */

function resolveDeclared(field: string, answers: SessionAnswers): string | null {
  const { declared } = answers;

  switch (field) {
    case 'contact':
    case 'contactImportance':
      return declared.contact === null ? null : `연락 중요도를 5점 중 ${declared.contact}로 답했어`;
    case 'alone':
    case 'aloneNeed':
      return declared.alone === null
        ? null
        : `혼자 있는 시간의 필요를 5점 중 ${declared.alone}로 답했어`;
    case 'conflict':
    case 'conflictStyle':
      return declared.conflict ? `갈등이 생기면 ${quoted(CONFLICT_LABEL[declared.conflict])} 골랐어` : null;
    case 'affection':
    case 'affectionStyle':
      return declared.affection
        ? `애정 표현은 ${quoted(AFFECTION_LABEL[declared.affection])} 골랐어`
        : null;
    case 'hobby':
    case 'hobbySharing':
      return declared.hobby ? `취미는 ${quoted(HOBBY_LABEL[declared.hobby])} 골랐어` : null;
    default:
      return null;
  }
}

/* ----------------------------------------------------- relationship */

function resolveRelationship(field: string, answers: SessionAnswers): string | null {
  const { experience } = answers;

  switch (field) {
    case 'important':
    case 'importantFactors': {
      if (experience.important.length === 0) return null;
      const labels = experience.important.map((factor) => PAST_FACTOR_LABEL[factor]).join(' · ');
      return `실제 관계에서 중요했던 것으로 ${withObjectParticle(labels)} 골랐어`;
    }
    case 'hardest':
    case 'hardestMoment':
      return experience.hardest ? HARDEST_LABEL[experience.hardest] : null;
    case 'selfGap':
      return experience.selfGap
        ? `연애 전 생각한 나와 실제 연애 속 나에 대해 ${quoted(SELF_GAP_LABEL[experience.selfGap])} 골랐어`
        : null;
    case 'note':
      // 자유서술 원문은 근거 목록에 그대로 펼치지 않는다 — 사용자가 적었다는 사실만 말한다.
      return experience.note.trim().length > 0 ? '직접 적어준 관계 경험 메모가 있어' : null;
    default:
      return null;
  }
}

/* ---------------------------------------------------------- adaptive */

function resolveAdaptive(answers: SessionAnswers): string | null {
  const { adaptive } = answers.experience;
  if (!adaptive) return null;
  const axisLabel = MIRROR_AXIS_LABEL.get(adaptive.axis) ?? adaptive.axis;
  return `${axisLabel} 추가 질문에서 ${quoted(adaptiveOptionLabel(adaptive.axis, adaptive.optionId))} 골랐어`;
}

/* ---------------------------------------------------------- observed */

/**
 * §75 — 사용자 수정이 AI 원본을 **이긴다.**
 * 사용자가 '평소에는 집에 있는 걸 좋아한다'고 고쳤으면, 근거로 보여주는 문장도 그 문장이다.
 */
function resolveObserved(
  traitId: string,
  validated: readonly ValidatedObservation[],
): ResolvedEvidence | null {
  const found = validated.find((item) => item.original.id === traitId);
  if (!found) return null;
  // 사용자가 분석에서 제외한 관찰은 근거로 쓰지 않는다(§14).
  if (found.status === 'excluded') return null;

  const correction = found.userCorrection?.trim();
  if (correction) {
    return { key: `observed:${traitId}`, sourceLabel: '사용자 수정', text: correction };
  }
  return {
    key: `observed:${traitId}`,
    sourceLabel: '사진에서 관찰',
    text: found.original.observation,
  };
}

/* ----------------------------------------------------------- history */

function resolveHistory(
  entryId: string,
  axis: string,
  entries: readonly RelationshipHistoryEntry[],
): ResolvedEvidence | null {
  const entry = entries.find((item) => item.id === entryId);
  if (!entry) return null;

  const snapshot = entry.mirrorSnapshot.insights.find((insight) => insight.axis === axis);
  if (!snapshot) return null;

  const axisLabel = MIRROR_AXIS_LABEL.get(axis) ?? axis;
  return {
    key: `history:${entryId}:${axis}`,
    sourceLabel: '과거 관찰',
    text: `이전 기록에서도 ${axisLabel} 축에 ${snapshot.relationshipSignal}`,
  };
}

/* --------------------------------------------------------- resolver */

export function resolveEvidenceRef(
  ref: EvidenceRef,
  context: EvidenceResolverContext,
): ResolvedEvidence | null {
  switch (ref.source) {
    case 'declared': {
      const text = resolveDeclared(ref.field, context.answers);
      return text ? { key: `declared:${ref.field}`, sourceLabel: '내가 답한 내용', text } : null;
    }
    case 'relationship': {
      const text = resolveRelationship(ref.field, context.answers);
      return text ? { key: `relationship:${ref.field}`, sourceLabel: '관계 경험', text } : null;
    }
    case 'adaptive': {
      const text = resolveAdaptive(context.answers);
      return text ? { key: `adaptive:${ref.field}`, sourceLabel: '추가 질문', text } : null;
    }
    case 'observed':
      return resolveObserved(ref.traitId, context.validated);
    case 'history':
      return resolveHistory(ref.entryId, ref.axis, context.historyEntries ?? []);
    default:
      return null;
  }
}

/**
 * 여러 ref를 화면용 근거 목록으로 바꾼다.
 * 해석 불가한 ref는 조용히 빠지고, 같은 근거가 중복되면 하나만 남긴다.
 */
export function resolveEvidenceRefs(
  refs: readonly EvidenceRef[],
  context: EvidenceResolverContext,
): ResolvedEvidence[] {
  const seen = new Set<string>();
  const result: ResolvedEvidence[] = [];

  for (const ref of refs) {
    const resolved = resolveEvidenceRef(ref, context);
    if (!resolved || seen.has(resolved.key)) continue;
    seen.add(resolved.key);
    result.push(resolved);
  }

  return result;
}

/**
 * §35 — 유효한 근거가 하나도 없고 한계 문장도 없으면 그 Narrative를 보여주지 않는다.
 * '근거 없이 말하지 않는다'는 원칙을 화면 직전에 한 번 더 확인하는 지점이다.
 */
export function narrativeIsShowable(
  narrative: { evidenceRefs: readonly EvidenceRef[]; uncertainty?: string },
  context: EvidenceResolverContext,
): boolean {
  if (resolveEvidenceRefs(narrative.evidenceRefs, context).length > 0) return true;
  return Boolean(narrative.uncertainty?.trim());
}
