import {
  DECLARED_PHRASE,
  MIRROR_AXES,
  MIRROR_NOTE,
  RELATIONSHIP_PHRASE,
} from '@/data/axes';
import { HARDEST_LABEL, PAST_FACTOR_LABEL } from '@/data/labels';
import type {
  CoreInsight,
  DeclaredPreference,
  EvidenceItem,
  MirrorInsight,
  MirrorReport,
  MirrorState,
  MirrorTeaser,
  RelationshipExperience,
} from '@/types';
import { toDeclaredMirrorValues, toRelationshipMirrorValues } from './values';

/**
 * Relationship Mirror — Declared Me vs Relationship Me
 *
 * ⚠️ Prototype Demo Logic
 * MATCH / GAP / CHANGE 는 심리 진단이 아니라 두 답변의 차이를 읽는 규칙이다.
 *   |차이| <= 1            → MATCH   말한 기준과 관계에서의 반응이 비슷
 *   관계 - 말한 값 >= 2     → GAP     중요하지 않다고 했지만 관계에서 더 크게 반응
 *   말한 값 - 관계 >= 2     → CHANGE  중요하다고 했지만 경험 후 우선순위가 내려감
 */

export const RADAR_CENTER = 100;
export const RADAR_RADIUS = 76;
export const RADAR_VIEWBOX = 200;

function stateOf(diff: number): MirrorState {
  if (Math.abs(diff) <= 1) return 'MATCH';
  return diff >= 2 ? 'GAP' : 'CHANGE';
}

/** 1~5 값을 트랙 위 퍼센트 위치로 (양 끝이 잘리지 않도록 4%~96%) */
export function valueToPercent(value: number): string {
  return `${4 + ((value - 1) / 4) * 92}%`;
}

export function radarPoints(values: readonly number[]): string {
  return values
    .map((value, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / values.length;
      const r = (RADAR_RADIUS * value) / 5;
      const x = RADAR_CENTER + r * Math.cos(angle);
      const y = RADAR_CENTER + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** 레이더 축 라벨 좌표 (viewBox 기준, 라벨은 축보다 살짝 바깥) */
export function radarLabelPositions(count: number, radius = RADAR_RADIUS + 20) {
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    return {
      x: RADAR_CENTER + radius * Math.cos(angle),
      y: RADAR_CENTER + radius * Math.sin(angle),
    };
  });
}

/** 배경 그리드 폴리곤 (0.33 / 0.66 / 1.0 링) */
export function radarGrid(count: number): string[] {
  return [0.33, 0.66, 1].map((ratio) =>
    radarPoints(Array.from({ length: count }, () => ratio * 5)),
  );
}

function buildInsights(
  declared: DeclaredPreference,
  experience: RelationshipExperience,
): MirrorInsight[] {
  const declaredValues = toDeclaredMirrorValues(declared);
  const relationshipValues = toRelationshipMirrorValues(experience);

  return MIRROR_AXES.map(({ key, label }) => {
    // Declared 미응답은 중립값 3으로 두어 Mirror가 비어 보이지 않게 한다.
    const declaredValue = declaredValues[key] ?? 3;
    const relationshipValue = relationshipValues[key];
    const diff = relationshipValue - declaredValue;
    const state = stateOf(diff);

    return {
      key,
      label,
      declared: declaredValue,
      relationship: relationshipValue,
      state,
      note: MIRROR_NOTE[key][state],
      declaredPhrase: DECLARED_PHRASE[key],
      relationshipPhrase: RELATIONSHIP_PHRASE[key],
      diff,
    };
  });
}

/** Teaser(S26)에 쓸 축: GAP이 있으면 첫 GAP, 없으면 차이가 가장 큰 축 */
function pickTeaser(insights: MirrorInsight[]): MirrorInsight {
  const gap = insights.find((insight) => insight.state === 'GAP');
  if (gap) return gap;

  const sorted = [...insights].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  // MIRROR_AXES가 비어 있지 않으므로 항상 존재한다.
  return sorted[0] ?? insights[0]!;
}

function buildHeadline(focus: MirrorInsight): string {
  if (focus.key === 'contact' && focus.state === 'GAP') {
    return '너는 연락 자체보다 "관계가 계속 연결되어 있다는 느낌"을 중요하게 보는 사람일지도 몰라.';
  }
  if (focus.state === 'GAP') {
    return `너는 ${focus.label}에서 말한 기준보다 실제 관계에서 더 크게 반응하는 사람일지도 몰라.`;
  }
  if (focus.state === 'CHANGE') {
    return `너는 ${focus.label}을 중요하게 여긴다고 말했지만, 경험 후에는 우선순위가 옮겨간 사람일지도 몰라.`;
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
  const importantText = experience.important.length
    ? `중요했던 요소로 ${experience.important.map((f) => PAST_FACTOR_LABEL[f]).join(' · ')} 선택`
    : '중요했던 요소를 아직 선택하지 않음';

  return [
    { n: '01', text: `${focus.label} 중요도를 ${focus.declared}/5로 선택` },
    {
      n: '02',
      text: experience.hardest
        ? `이전 관계에서 ${HARDEST_LABEL[experience.hardest]}으로 선택`
        : '이전 관계에서 어려웠던 순간을 아직 선택하지 않음',
    },
    { n: '03', text: importantText },
  ];
}

export function buildMirrorReport(
  declared: DeclaredPreference,
  experience: RelationshipExperience,
): MirrorReport {
  const insights = buildInsights(declared, experience);
  const focus = pickTeaser(insights);

  const teaser: MirrorTeaser = {
    axisKey: focus.key,
    axisLabel: focus.label,
    declaredPhrase: focus.declaredPhrase,
    relationshipPhrase: focus.relationshipPhrase,
  };

  const core: CoreInsight = {
    headline: buildHeadline(focus),
    evidence: buildCoreEvidence(focus, experience),
    summary: buildSummary(focus),
  };

  return {
    insights,
    teaser,
    core,
    gapCount: insights.filter((insight) => insight.state === 'GAP').length,
    declaredPoints: radarPoints(insights.map((insight) => insight.declared)),
    relationshipPoints: radarPoints(insights.map((insight) => insight.relationship)),
  };
}
