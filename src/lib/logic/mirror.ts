import {
  DECLARED_PHRASE,
  MIRROR_AXES,
  MIRROR_NOTE,
  RELATIONSHIP_PHRASE,
} from '@/data/axes';
import { adaptiveOptionLabel } from '@/data/adaptive';
import { HARDEST_LABEL, PAST_FACTOR_LABEL } from '@/data/labels';
import { withObjectParticle } from '@/lib/korean';
import type {
  CoreInsight,
  DeclaredPreference,
  EvidenceItem,
  EvidenceStrength,
  MirrorAxisKey,
  MirrorInsight,
  MirrorReport,
  MirrorState,
  MirrorTeaser,
  PastFactor,
  RelationshipExperience,
} from '@/types';
import { DECLARED_HAS_NATIVE_SCALE, toDeclaredMirrorValues } from './values';

/**
 * Relationship Mirror — Declared Me vs Relationship Me
 *
 * ⚠️ Prototype Demo Logic
 * MATCH / GAP / CHANGE는 두 숫자를 빼서 나온 값이 아니다. Relationship Me는
 * 1~5 척도로 직접 수집된 적이 없으므로(과거 관계 질문은 선택형이다), 여기서 가짜 숫자를
 * 만들지 않는다. 대신 '이 축에 대한 관계 경험 근거가 있는가'를 기준으로 판정한다.
 *
 *   hardest 근거(가장 힘들었던 순간)로 뒷받침 + 말한 기준이 낮음  → GAP
 *   hardest 근거로 뒷받침 + 말한 기준이 높음                    → MATCH
 *   important 근거(중요했던 요소로 선택) + 말한 기준이 낮음       → GAP
 *   important 근거 + 말한 기준이 보통·높음                       → MATCH
 *   근거 없음 + 말한 기준이 높음                                 → CHANGE (선언은 높지만 근거가 안 보임)
 *   근거 없음 + 말한 기준이 보통·낮음                            → UNKNOWN (판정하지 않는다)
 *
 * UNKNOWN 축은 insights 배열에 아예 넣지 않는다 — 근거가 없는 축을 억지로 MATCH로
 * 채우지 않기 위해서다 (Missing data ≠ neutral).
 */

/** v1.9 crossSourceInsights.ts에서도 쓴다 — Relationship↔Target 비교의 축 매핑 기준. */
export const HARDEST_TO_AXIS: Partial<Record<string, MirrorAxisKey>> = {
  contact_drop: 'contact',
  fight_silence: 'conflict',
  no_time: 'alone',
};

/** 1~5 값을 트랙 위 퍼센트 위치로 (양 끝이 잘리지 않도록 4%~96%) */
export function valueToPercent(value: number): string {
  return `${4 + ((value - 1) / 4) * 92}%`;
}

function evidenceStrengthOf(
  axis: MirrorAxisKey,
  experience: RelationshipExperience,
): EvidenceStrength {
  if (experience.hardest && HARDEST_TO_AXIS[experience.hardest] === axis) return 'hardest';
  if (experience.important.includes(axis as PastFactor)) return 'important';
  return 'absent';
}

function stateFor(declaredValue: number, strength: EvidenceStrength): MirrorState {
  const declaredHigh = declaredValue >= 4;
  const declaredLow = declaredValue <= 2;

  if (strength === 'hardest') {
    if (declaredHigh) return 'MATCH';
    return 'GAP';
  }
  if (strength === 'important') {
    if (declaredLow) return 'GAP';
    return 'MATCH';
  }
  // strength === 'absent'
  return declaredHigh ? 'CHANGE' : 'UNKNOWN';
}

function relationshipSignalText(
  axis: MirrorAxisKey,
  label: string,
  strength: EvidenceStrength,
  experience: RelationshipExperience,
): string {
  if (strength === 'hardest' && experience.hardest) {
    return `이전 관계에서 ${HARDEST_LABEL[experience.hardest]}으로 선택`;
  }
  if (strength === 'important') {
    return `이전 관계에서 ${withObjectParticle(PAST_FACTOR_LABEL[axis as PastFactor])} 중요했던 요소로 선택`;
  }
  return `이전 관계에서 ${withObjectParticle(label)} 특별히 중요한 요소로 꼽지는 않았어`;
}

function buildInsights(
  declared: DeclaredPreference,
  experience: RelationshipExperience,
): MirrorInsight[] {
  const declaredValues = toDeclaredMirrorValues(declared);
  const insights: MirrorInsight[] = [];

  for (const { key, label } of MIRROR_AXES) {
    const declaredValue = declaredValues[key];
    // Declared Me는 S13까지 전부 필수라 실제로는 항상 값이 있지만, 방어적으로 없으면 건너뛴다.
    if (declaredValue === null) continue;

    const strength = evidenceStrengthOf(key, experience);
    const state = stateFor(declaredValue, strength);
    if (state === 'UNKNOWN') continue;

    insights.push({
      key,
      label,
      declared: declaredValue,
      declaredHasScale: DECLARED_HAS_NATIVE_SCALE[key],
      declaredPhrase: DECLARED_PHRASE[key],
      relationshipSignal: relationshipSignalText(key, label, strength, experience),
      evidenceStrength: strength,
      state,
      note: MIRROR_NOTE[key][state],
    });
  }

  return insights;
}

/** Teaser·Core Insight에 쓸 축: hardest 근거의 GAP 우선 → 그 외 GAP → CHANGE → 첫 번째 */
function pickFocus(insights: MirrorInsight[]): MirrorInsight | null {
  if (insights.length === 0) return null;
  return (
    insights.find((i) => i.state === 'GAP' && i.evidenceStrength === 'hardest') ??
    insights.find((i) => i.state === 'GAP') ??
    insights.find((i) => i.state === 'CHANGE') ??
    insights[0]!
  );
}

function buildHeadline(focus: MirrorInsight): string {
  if (focus.key === 'contact' && focus.state === 'GAP') {
    return '너는 연락 자체보다 "관계가 계속 연결되어 있다는 느낌"을 중요하게 보는 사람일지도 몰라.';
  }
  if (focus.state === 'GAP') {
    return `너는 ${focus.label}에서 말한 기준보다 실제 관계에서 더 크게 반응하는 사람일지도 몰라.`;
  }
  if (focus.state === 'CHANGE') {
    return `너는 ${withObjectParticle(focus.label)} 중요하게 여긴다고 말했지만, 경험 후에는 우선순위가 옮겨간 사람일지도 몰라.`;
  }
  return `너는 ${focus.label}에 대해 말한 기준과 관계에서의 반응이 꽤 겹치는 사람일지도 몰라.`;
}

function buildSummary(focus: MirrorInsight): string {
  if (focus.key === 'contact' && focus.state === 'GAP') {
    return '혼자 있는 시간을 좋아하지만, 관계에서 연결이 끊기는 신호에는 생각보다 민감한 편일 수 있어.';
  }
  if (focus.state === 'MATCH') {
    return `${focus.label}에 대해 말한 기준이 실제 관계에서도 비슷하게 나타났어.`;
  }
  return `${focus.label}에 대해 말한 기준과 실제 관계에서의 반응이 조금 달랐어.`;
}

export function buildCoreEvidence(
  focus: MirrorInsight,
  experience: RelationshipExperience,
): EvidenceItem[] {
  const items: EvidenceItem[] = [
    {
      n: '01',
      text: focus.declaredHasScale
        ? `${focus.label} 중요도를 ${focus.declared}/5로 답함`
        : `${focus.label}에 대해 "${focus.declaredPhrase}"라고 답함`,
    },
    { n: '02', text: focus.relationshipSignal },
  ];

  // Adaptive Follow-up — 모순 후보 축에 대해서만 물어본 추가 질문. 답했을 때만 근거로 쓴다.
  if (experience.adaptive && experience.adaptive.axis === focus.key) {
    items.push({
      n: '03',
      text: `추가로 "${adaptiveOptionLabel(focus.key, experience.adaptive.optionId)}"를 이유로 선택`,
    });
  }

  return items;
}

export function buildMirrorReport(
  declared: DeclaredPreference,
  experience: RelationshipExperience,
): MirrorReport {
  // 관계 경험이 없는 사용자에게 가짜 Relationship Me를 만들지 않는다.
  if (experience.skipped) {
    return {
      available: false,
      insights: [],
      totalAxisCount: MIRROR_AXES.length,
      teaser: null,
      core: null,
      gapCount: 0,
    };
  }

  const insights = buildInsights(declared, experience);
  const focus = pickFocus(insights);

  const teaser: MirrorTeaser | null = focus
    ? {
        axisKey: focus.key,
        axisLabel: focus.label,
        declaredPhrase: DECLARED_PHRASE[focus.key],
        relationshipPhrase: RELATIONSHIP_PHRASE[focus.key],
      }
    : null;

  const core: CoreInsight | null = focus
    ? {
        headline: buildHeadline(focus),
        evidence: buildCoreEvidence(focus, experience),
        summary: buildSummary(focus),
      }
    : null;

  return {
    available: true,
    insights,
    totalAxisCount: MIRROR_AXES.length,
    teaser,
    core,
    gapCount: insights.filter((insight) => insight.state === 'GAP').length,
  };
}

/** 이 축이 GAP이면 Adaptive Follow-up을 물어볼 대상이 된다 (S16→S17 사이) */
export function pickAdaptiveTriggerAxis(
  declared: DeclaredPreference,
  experience: RelationshipExperience,
): MirrorAxisKey | null {
  if (experience.skipped) return null;
  const insights = buildInsights(declared, experience);
  const focus = pickFocus(insights);
  return focus && focus.state === 'GAP' ? focus.key : null;
}
