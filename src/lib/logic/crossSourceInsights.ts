import { withTopicParticle } from '@/lib/korean';
import { HARDEST_TO_AXIS } from './mirror';
import { toTargetValues } from './values';
import type {
  CrossSourceInsight,
  CrossSourceInsightType,
  DeclaredPreference,
  DeepAnalysisAnswer,
  EvidenceRef,
  HistoryAxisChange,
  InsightStrength,
  MirrorAxisKey,
  MirrorInsight,
  MirrorReport,
  ObservedSignalCategory,
  RelationshipExperience,
  RelationshipHistoryEntry,
  RepeatedRelationshipSignal,
  TargetAxisKey,
  TargetProfile,
  ValidatedObservation,
} from '@/types';

/**
 * Cross-source Insight Engine (v1.9 · Analysis Depth)
 *
 * ⚠️ **이 파일은 판정을 새로 만들지 않는다.** Mirror·History·Compatibility가 이미 계산한
 * 결과를 입력으로 받아 **서로 연결**한다 — 그래서 아래 함수들은 모두 `MirrorReport`,
 * `HistoryAxisChange[]` 같은 이미 계산된 값을 인자로 받고, declared/target 원시값은
 * '두 계산 결과가 없어서 직접 대조해야 하는 조합'(Relationship↔Target)에서만 쓴다.
 *
 * 목적: '사용자가 이미 입력한 내용을 요약한 결과'가 아니라 '따로 존재하던 데이터를 연결했을
 * 때만 보이는 신호'를 만든다. 근거가 부족하면 **아무것도 만들지 않는다** — 개수를 채우지 않는다.
 */

/**
 * Insight id는 **내용에서 결정론적으로 나와야 한다.** 전역 카운터로 매번 새 id를 매기면,
 * 같은 세션에서 이 함수가 여러 화면(Mirror/History/Premium)에서 반복 호출될 때마다 같은
 * 논리적 Insight가 다른 id를 받는다 — 그러면 `DeepAnalysisAnswer.insightId`나
 * `deepInsightFeedback`의 키가 리렌더 후 조용히 아무 Insight와도 매치되지 않게 된다.
 * 각 생성 지점(①~③)은 축(axis)당 최대 1개만 만들기 때문에 `origin:axis`가 항상 고유하다.
 */
function insightId(origin: string, axis: string): string {
  return `cs_${origin}_${axis}`;
}

/**
 * 검증된(제외되지 않은) Observed trait 중, 이 축과 관련 있어 보이는 키워드가 있는지.
 *
 * ⚠️ 알려진 한계 — Observed 관찰은 AI가 쓴 자유 문장이라 통제된 값이 아니다. 여기서는
 * **확인/수정된(confirmed/corrected) 관찰에만** 아주 좁은 키워드로 '보강 신호'만 찾는다.
 * 이 신호만으로 GAP/CONTRADICTION을 새로 만들지 않는다 — 이미 Mirror가 판정한 GAP을
 * **보강(강도를 올리는 근거)**하는 용도로만 쓴다. 매칭이 없으면 조용히 아무 일도 하지 않는다.
 */
const AXIS_KEYWORDS: Partial<Record<MirrorAxisKey, readonly string[]>> = {
  alone: ['혼자', '혼자만의', '단독'],
  hobby: ['함께', '같이', '동행'],
  contact: [],
  conflict: [],
  affection: [],
};

/**
 * v1.10 — 실제 사진 분석이 붙으면서 통제된 값(`ObservedSignal.category`)이 생겼다.
 *
 * ⚠️ **의미적 연결이 명확한 축만 넣는다**(§18 · §19). 사진에서 관계 기준을 직접 만들지
 * 않으므로, 여기 없는 축은 사진 신호로 보강되지 않는다:
 *   - `hobby`(취미를 함께 하는지) ← 반복해서 보인 취미성 활동. 연결이 분명하다.
 *   - `alone`은 넣지 않는다 — 사진만으로 그 활동을 **혼자** 했는지 알 수 없다.
 *     '혼자'라는 말이 들어간 사용자 확인/수정 문장이 있을 때만 위 키워드 경로로 잡힌다.
 *   - `contact` · `conflict` · `affection`은 사진에서 관찰될 수 있는 것이 아니다.
 */
const AXIS_SIGNAL_CATEGORIES: Partial<Record<MirrorAxisKey, readonly ObservedSignalCategory[]>> = {
  hobby: ['sports', 'outdoor', 'travel', 'culture', 'reading'],
};

/**
 * @returns 이 축을 보강하는 관찰. 없으면 null — 없으면 조용히 아무 일도 하지 않는다.
 *
 * ⚠️ 사진 신호는 **단독으로 GAP/CONTRADICTION을 만들지 못한다.** 이미 Mirror가 판정한
 * GAP의 근거를 하나 더하는 용도로만 쓰인다(§19: 사진에서 관계 기준을 직접 만들지 않는다).
 * 그리고 **반복 신호만** 본다 — 사진 한 장짜리 단일 관찰로 관계 해석을 보강하지 않는다(§5).
 */
function findCorroboratingObservedTrait(
  axis: MirrorAxisKey,
  validated: readonly ValidatedObservation[],
): ValidatedObservation | null {
  // 사용자가 확인·수정한 관찰만 쓴다 — AI 원문보다 사용자 검증을 우선한다(§16).
  const confirmed = validated.filter(
    (item) => item.status === 'confirmed' || item.status === 'corrected',
  );

  const categories = AXIS_SIGNAL_CATEGORIES[axis];
  if (categories) {
    const bySignal = confirmed.find((item) => {
      const signal = item.original.signal;
      return (
        signal !== undefined &&
        signal.strength !== 'single' &&
        categories.includes(signal.category)
      );
    });
    if (bySignal) return bySignal;
  }

  const keywords = AXIS_KEYWORDS[axis];
  if (!keywords || keywords.length === 0) return null;

  return (
    confirmed.find((item) => {
      const text = item.userCorrection?.trim() || item.original.observation;
      return keywords.some((word) => text.includes(word));
    }) ?? null
  );
}

function strengthOf(sourceCount: number, hasHardestEvidence: boolean): InsightStrength {
  if (sourceCount >= 3 || (sourceCount === 2 && hasHardestEvidence)) return 'strong';
  if (sourceCount === 2) return 'medium';
  return 'weak';
}

/* ------------------------------------------- ① Declared ↔ Relationship */

/**
 * 이 axis의 relationshipSignal이 실제로 어떤 필드에서 나왔는지(§ mirror.ts `evidenceStrengthOf`).
 * ⚠️ 'hardest'를 모든 축에 고정으로 붙이면 안 된다 — 예를 들어 갈등 해결 축의 MATCH가
 * '연락 감소가 가장 힘들었음'을 근거로 보여주는 것처럼 틀린 근거가 붙는다. 'absent'(=CHANGE)는
 * 애초에 관계 경험 근거가 없다는 뜻이라 evidenceRef를 만들지 않는다 — 근거를 지어내지 않는다.
 */
function relationshipRefFor(insight: MirrorInsight): EvidenceRef | null {
  if (insight.evidenceStrength === 'hardest') return { source: 'relationship', field: 'hardest' };
  if (insight.evidenceStrength === 'important') return { source: 'relationship', field: 'important' };
  return null;
}

/**
 * Mirror가 이미 판정한 MATCH/GAP/CHANGE를 Cross-source Insight로 재표현한다.
 * Observed 보강 신호가 같은 방향으로 겹치면 GAP을 CONTRADICTION으로 승격한다(§4) —
 * 단 Adaptive Follow-up으로 이미 설명된 축은 승격하지 않는다(§45 Scenario C).
 */
function fromMirrorInsight(
  insight: MirrorInsight,
  input: {
    experience: RelationshipExperience;
    validated: readonly ValidatedObservation[];
  },
): CrossSourceInsight | null {
  const { experience, validated } = input;
  if (insight.state === 'UNKNOWN') return null;

  const declaredRef: EvidenceRef = { source: 'declared', field: insight.key };
  const relationshipRef = relationshipRefFor(insight);
  const alreadyExplained = experience.adaptive?.axis === insight.key;

  if (insight.state === 'MATCH') {
    // MATCH는 항상 evidenceStrength가 'hardest'|'important'다(mirror.ts stateFor) — null이면
    // Mirror 판정과 이 함수의 가정이 어긋난 것이니 억지로 만들지 않는다.
    if (!relationshipRef) return null;

    const strength: InsightStrength = insight.evidenceStrength === 'hardest' ? 'strong' : 'medium';
    return {
      id: insightId('mirror', insight.key),
      type: 'MATCH',
      axis: insight.key,
      sources: ['declared', 'relationship'],
      evidenceRefs: [declaredRef, relationshipRef],
      strength,
      confidenceReason: `mirror:${insight.evidenceStrength}`,
      ruleSummary: `${insight.label}에 대해 네가 말한 기준과 실제 관계에서 나타난 신호가 같은 방향이었어.`,
      eligibleForNarrative: true,
    };
  }

  if (insight.state === 'CHANGE') {
    // CHANGE는 evidenceStrength가 항상 'absent'다 — 관계 경험 근거가 원래 없다는 뜻이라
    // relationshipRef를 만들지 않는다. declared 하나로만 남는 게 사실에 더 가깝다.
    return {
      id: insightId('mirror', insight.key),
      type: 'CHANGE',
      axis: insight.key,
      sources: ['declared'],
      evidenceRefs: [declaredRef],
      strength: 'weak',
      confidenceReason: 'mirror:absent',
      ruleSummary: `${withTopicParticle(insight.label)} 중요하다고 말했지만 경험 후 우선순위가 옮겨간 축이야.`,
      eligibleForNarrative: true,
    };
  }

  // GAP — evidenceStrength가 항상 'hardest'|'important'다.
  if (!relationshipRef) return null;

  const corroborating = findCorroboratingObservedTrait(insight.key, validated);
  const escalateToContradiction = Boolean(corroborating) && !alreadyExplained;

  const sources: CrossSourceInsight['sources'] = escalateToContradiction
    ? ['declared', 'relationship', 'observed']
    : ['declared', 'relationship'];

  const evidenceRefs: EvidenceRef[] = [declaredRef, relationshipRef];
  if (escalateToContradiction && corroborating) {
    evidenceRefs.push({ source: 'observed', traitId: corroborating.original.id });
  }
  if (alreadyExplained) evidenceRefs.push({ source: 'adaptive', field: insight.key });

  const type: CrossSourceInsightType = escalateToContradiction ? 'CONTRADICTION' : 'GAP';
  const strength = strengthOf(evidenceRefs.length, insight.evidenceStrength === 'hardest');

  const ruleSummary =
    type === 'CONTRADICTION'
      // §6 — '생활 패턴'이라고 부르지 않는다. 사진에서 확인한 것은 반복해서 보인 활동까지다.
      ? `${insight.label}에서 네가 말한 기준, 실제 관계 경험, 그리고 사진에서 반복해서 보인 활동까지 서로 다른 방향을 가리키고 있어.`
      : `${withTopicParticle(insight.label)} 말한 기준보다 실제 관계에서 더 크게 반응한 축이야.`;

  return {
    id: insightId('mirror', insight.key),
    type,
    axis: insight.key,
    sources,
    evidenceRefs,
    strength,
    confidenceReason: `mirror:${insight.evidenceStrength}${escalateToContradiction ? '+observed' : ''}`,
    ruleSummary,
    eligibleForNarrative: true,
  };
}

/* ------------------------------------------------- ② Relationship ↔ Target */

const TARGET_SHARED_AXES: readonly MirrorAxisKey[] = ['contact', 'conflict', 'alone', 'affection'];

/**
 * 사용자의 과거 통증 지점(hardest)이 **상대방의 이미 알고 있는 특성**과 겹치는지 본다.
 * 예: 연락 감소가 가장 힘들었는데(hardest=contact_drop), 상대는 연락이 적은 편으로 입력됨(target.contact='l')
 * → 아무도 계산해준 적 없는, 두 소스를 직접 이어야만 보이는 신호다.
 */
function fromRelationshipVsTarget(input: {
  experience: RelationshipExperience;
  target: TargetProfile;
}): CrossSourceInsight | null {
  const { experience, target } = input;
  if (!experience.hardest) return null;

  const axis = HARDEST_TO_AXIS[experience.hardest];
  if (!axis || !TARGET_SHARED_AXES.includes(axis)) return null;

  const targetValues = toTargetValues(target);
  const targetLevel = targetValues[axis as TargetAxisKey];
  // 상대 값이 '모름'(null)이거나 낮음(1)이 아니면 — 겹치는 특성이 없다고 본다.
  if (targetLevel === null || targetLevel > 1) return null;

  return {
    id: insightId('reltarget', axis),
    type: 'GAP',
    axis,
    sources: ['relationship', 'target'],
    evidenceRefs: [
      { source: 'relationship', field: 'hardest' },
      { source: 'target', field: axis },
    ],
    strength: 'strong',
    confidenceReason: 'hardest_matches_target_level',
    ruleSummary: `과거 관계에서 가장 힘들었던 지점과, 지금 상대에 대해 네가 이미 알고 있다고 입력한 특성이 같은 축을 가리키고 있어.`,
    eligibleForNarrative: true,
  };
}

/* ---------------------------------------------------------------- ③ History */

/**
 * History Engine의 SHIFT/NEW를 CHANGE로 재표현한다.
 *
 * ⚠️ '지금'과 '과거'를 실제로 이어야 한다 — history ref 하나만으로는 "과거에 이랬다"만
 * 말하는 것이라 §26(A)의 "근거 2개 이상" 기준을 채우지 못한다. 그래서 지금 시점의 declared
 * 값(= declaredDelta.now가 곧 지금 이 축에 답한 값)을 두 번째 evidenceRef로 함께 건다.
 */
function fromHistoryChange(change: HistoryAxisChange): CrossSourceInsight | null {
  if (change.state !== 'SHIFT' && change.state !== 'NEW') return null;

  return {
    id: insightId('history_change', change.axis),
    type: 'CHANGE',
    axis: change.axis,
    sources: ['history', 'declared'],
    evidenceRefs: [
      { source: 'history', entryId: 'latest', axis: change.axis },
      { source: 'declared', field: change.axis },
    ],
    strength: change.state === 'SHIFT' ? 'medium' : 'weak',
    confidenceReason: `history:${change.state}`,
    ruleSummary: change.note,
    eligibleForNarrative: true,
  };
}

function fromRepeatedSignal(signal: RepeatedRelationshipSignal): CrossSourceInsight {
  return {
    id: insightId('history_repeated', signal.axis),
    type: 'REPEATED_SIGNAL',
    axis: signal.axis,
    sources: ['history'],
    evidenceRefs: signal.entryIds.map((entryId) => ({
      source: 'history' as const,
      entryId,
      axis: signal.axis,
    })),
    strength: signal.occurrences >= 3 ? 'strong' : 'medium',
    confidenceReason: `repeated:${signal.occurrences}`,
    ruleSummary:
      signal.occurrences === 1
        ? `이 신호... 처음 보는 게 아닌데. 이전 관찰에서도 ${signal.label} 관련 신호가 한 번 있었어.`
        : `이전 관찰 ${signal.occurrences}번에서도 ${signal.label} 관련 신호가 있었어.`,
    eligibleForNarrative: true,
    relatedHistoryIds: signal.entryIds,
  };
}

/* --------------------------------------------------------- 우선순위 (§6) */

const TYPE_RANK: Record<CrossSourceInsightType, number> = {
  CONTRADICTION: 0,
  GAP: 1,
  REPEATED_SIGNAL: 2,
  CHANGE: 3,
  MATCH: 4,
  UNKNOWN: 5,
};
const STRENGTH_RANK: Record<InsightStrength, number> = { strong: 0, medium: 1, weak: 2 };

/**
 * 1. Strong CONTRADICTION → 2. Strong GAP → 3. REPEATED_SIGNAL → 4. CHANGE →
 * 5. Strong MATCH → 6. Medium GAP → 7. Medium MATCH → (weak는 뒤로)
 */
export function rankInsights(insights: readonly CrossSourceInsight[]): CrossSourceInsight[] {
  return [...insights].sort((a, b) => {
    const typeDiff = TYPE_RANK[a.type] - TYPE_RANK[b.type];
    if (typeDiff !== 0) return typeDiff;
    return STRENGTH_RANK[a.strength] - STRENGTH_RANK[b.strength];
  });
}

/* ------------------------------------------------------------- 진입점 */

export interface CrossSourceInsightInput {
  declared: DeclaredPreference;
  experience: RelationshipExperience;
  target: TargetProfile;
  mirror: MirrorReport;
  validated: readonly ValidatedObservation[];
  historyChanges: readonly HistoryAxisChange[];
  repeatedSignals: readonly RepeatedRelationshipSignal[];
  /** History가 있으면 마지막 Entry id — evidenceRef 표시용 */
  latestHistoryEntry: RelationshipHistoryEntry | null;
  /** v1.9 §11 — 이 Insight에서 나온 Deep Question에 답했으면 새 근거로 덧붙인다(§40) */
  deepAnswers?: readonly DeepAnalysisAnswer[];
}

/**
 * 답변된 Deep Question을 관련 Insight의 근거로 덧붙인다. id가 이제 결정론적이라
 * `answer.insightId`가 항상 같은 논리적 Insight를 가리킨다는 게 전제다(§40 —
 * User Correction/Deep Answer는 "관련된 Insight만" 갱신해야 하고 전체를 다시 만들지 않는다).
 * 판정(type/strength)은 바꾸지 않는다 — 새 근거를 보여줄 뿐, 새로 결론 내리지 않는다.
 */
function attachDeepAnswers(
  insights: readonly CrossSourceInsight[],
  deepAnswers: readonly DeepAnalysisAnswer[],
): CrossSourceInsight[] {
  if (deepAnswers.length === 0) return insights.slice();

  return insights.map((insight) => {
    const answers = deepAnswers.filter((answer) => answer.insightId === insight.id);
    if (answers.length === 0) return insight;

    const existingQuestionIds = new Set(
      insight.evidenceRefs
        .filter((ref): ref is { source: 'deep_followup'; questionId: string } => ref.source === 'deep_followup')
        .map((ref) => ref.questionId),
    );
    const newRefs = answers
      .filter((answer) => !existingQuestionIds.has(answer.questionId))
      .map((answer): EvidenceRef => ({ source: 'deep_followup', questionId: answer.questionId }));
    if (newRefs.length === 0) return insight;

    return {
      ...insight,
      sources: insight.sources.includes('deep_followup')
        ? insight.sources
        : [...insight.sources, 'deep_followup'],
      evidenceRefs: [...insight.evidenceRefs, ...newRefs],
    };
  });
}

/**
 * 모든 조합을 억지로 생성하지 않는다(§3) — 근거가 있는 조합만 결과에 들어간다.
 * 반환값은 이미 §6 우선순위로 정렬돼 있다.
 */
export function buildCrossSourceInsights(input: CrossSourceInsightInput): CrossSourceInsight[] {
  // declared는 이 함수가 직접 쓰지 않는다 — Mirror(①)가 이미 declared를 소화해 insight로
  // 넘겨준다. 타입에는 남겨둔다: Declared↔Target 같은 조합을 추가할 때 호출부를 바꾸지
  // 않아도 되게 하기 위해서다.
  const { experience, target, mirror, validated, historyChanges, repeatedSignals } = input;

  const insights: CrossSourceInsight[] = [];

  // ① Declared ↔ Relationship (+ Observed 보강) — 관계 경험이 없으면 Mirror 자체가 비어 있다.
  if (mirror.available) {
    for (const insight of mirror.insights) {
      const built = fromMirrorInsight(insight, { experience, validated });
      if (built) insights.push(built);
    }
  }

  // ② Relationship ↔ Target — 관계 경험 + 상대 정보가 둘 다 있어야 한다.
  const relVsTarget = fromRelationshipVsTarget({ experience, target });
  if (relVsTarget) insights.push(relVsTarget);

  // ③ Current ↔ History
  for (const change of historyChanges) {
    const built = fromHistoryChange(change);
    if (built) {
      // latest entry id를 실제 값으로 채운다 (fromHistoryChange는 placeholder를 쓴다)
      const latestId = input.latestHistoryEntry?.id;
      if (latestId) {
        built.evidenceRefs = built.evidenceRefs.map((ref) =>
          ref.source === 'history' ? { ...ref, entryId: latestId } : ref,
        );
      }
      insights.push(built);
    }
  }
  for (const signal of repeatedSignals) {
    insights.push(fromRepeatedSignal(signal));
  }

  const withDeepAnswers = attachDeepAnswers(insights, input.deepAnswers ?? []);
  return rankInsights(withDeepAnswers);
}
