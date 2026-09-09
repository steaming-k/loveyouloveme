import { MIRROR_AXES } from '@/data/axes';
import { soloModeOfTarget } from './soloMode';
import type { SoloAxisChange, SoloHistoryReport } from './soloHistory';
import { withTopicParticle } from '@/lib/korean';
/**
 * v1.43 — `relationshipRefFor`의 **단일 source**. 이 파일에 있던 private 함수를
 * 옮긴 것이고 동작은 같다(§46.1).
 */
import { relationshipRefFor } from './allowedEvidence';
// v1.41 — 순환 import를 피해 표 자체를 별도 모듈에서 읽는다(mirror.ts도 re-export한다).
import { HARDEST_TO_AXIS } from './mirrorAxisMap';
import {
  NO_CURRENT_RELATIONSHIP,
  resolveAxisEvidence,
  type RelationshipTense,
} from './relationshipEvidence';
import { toTargetValues } from './values';
import type {
  CrossSourceEvidenceSource,
  CurrentRelationshipEvidence,
  EvidenceStrength,
  CompatibilityDimension,
  CompatibilityResult,
  CrossSourceInsight,
  CrossSourceInsightType,
  DeclaredPreference,
  DeepAnalysisAnswer,
  EvidenceRef,
  HistoryAxisChange,
  InsightStrength,
  MirrorAxisKey,
  MbtiAxisBridge,
  MbtiBridgeReport,
  MbtiSelfLens,
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
 * ⚠️ v1.43 — `relationshipRefFor`가 **`logic/allowedEvidence.ts`로 옮겨갔다.**
 *
 * 한 글자도 바뀌지 않았고 이 파일은 그것을 import해서 쓴다. 옮긴 이유는 v1.43이
 * AI에게 허용할 근거 집합(`allowedRelationshipRefs`)을 이 판정에서 파생시키기
 * 때문이다 — 같은 판정을 두 벌 두면 **Premium 연결이 만드는 ref**와 **AI에게 허용하는
 * ref**가 서로 다른 집합이 되고, 그 순간 결정론이 만든 정상 근거가 AI 검사에서
 * 거부되거나 그 반대가 된다(§46.1 판정 source 단일화).
 */

/** 이 근거가 `sources`에서 어느 종류로 세어지는가 — ref와 **같은 판정**을 쓴다 */
function relationshipSourceOf(insight: MirrorInsight): CrossSourceEvidenceSource {
  return insight.evidenceScope === 'current' ? 'current_relationship' : 'relationship';
}

/**
 * v1.41 — `ruleSummary`가 근거를 부를 때 쓰는 시점 표현.
 *
 * ⚠️ **판정을 바꾸지 않는다.** 같은 MATCH를 `실제 관계에서`라고 부르던 자리에
 * `지금 관계에서` / `이전 관계에서`를 넣는 것뿐이다. v1.40까지의 문장은
 * `실제 관계에서`로 **시점을 말하지 않았고**, 그래서 과거 근거를 현재로도 읽을 수
 * 있었다 — 이 함수가 그 모호함을 없앤다.
 */
function scopePhrase(insight: MirrorInsight, tense: RelationshipTense): string {
  if (insight.evidenceScope === 'current') {
    return tense === 'former' ? '그때 이 관계에서' : '지금 관계에서';
  }
  return '이전 관계에서';
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
    tense: RelationshipTense;
  },
): CrossSourceInsight | null {
  const { experience, validated, tense } = input;
  if (insight.state === 'UNKNOWN') return null;

  const declaredRef: EvidenceRef = { source: 'declared', field: insight.key };
  const relationshipRef = relationshipRefFor(insight);
  const relationshipSource = relationshipSourceOf(insight);
  const alreadyExplained = experience.adaptive?.axis === insight.key;
  const when = scopePhrase(insight, tense);

  if (insight.state === 'MATCH') {
    /**
     * 과거 근거의 MATCH는 항상 `hardest`|`important`다(mirror.ts `stateFor`) — null이면
     * Mirror 판정과 이 함수의 가정이 어긋난 것이니 억지로 만들지 않는다.
     *
     * ⚠️ v1.41 — **현재 근거의 MATCH는 `absent`일 수 있다**(`rarely` + declared 낮음 =
     * 두 답이 같은 방향). 그 경우에도 `relationshipRefFor`가 ref를 만들어 주므로 이
     * 가드는 그대로 통과한다 — scope가 `'none'`인 경우만 null이다.
     */
    if (!relationshipRef) return null;

    const strength: InsightStrength = insight.evidenceStrength === 'hardest' ? 'strong' : 'medium';
    return {
      id: insightId('mirror', insight.key),
      type: 'MATCH',
      axis: insight.key,
      sources: ['declared', relationshipSource],
      evidenceRefs: [declaredRef, relationshipRef],
      strength,
      confidenceReason: `mirror:${insight.evidenceStrength}:${insight.evidenceScope}`,
      // v1.41 — `실제 관계에서`(시점 없음) → 근거의 실제 시점을 말한다.
      ruleSummary: `${insight.label}에 대해 네가 말한 기준과 ${when} 나타난 신호가 같은 방향이었어.`,
      eligibleForNarrative: true,
    };
  }

  if (insight.state === 'CHANGE') {
    /**
     * v1.41 §39.11 — CHANGE는 **두 가지 서로 다른 상태**를 가리킨다.
     *
     * ```
     * scope none      관계 근거가 아예 없다        → declared 하나. 예전 그대로
     * scope current   지금은 안 드러난다고 답했다  → 근거가 둘이다 (declared + 지금 관계)
     * ```
     *
     * v1.40까지는 전자만 존재했으므로 `sources: ['declared']`가 사실이었다. 후자에서
     * 같은 코드를 쓰면 **사용자가 실제로 답한 근거를 리포트에서 지우는 것**이 된다.
     *
     * ⚠️ 문장도 갈랐다. `경험 후 우선순위가 옮겨간`은 **시간적 변화를 주장**하는데,
     * `rarely`를 고른 사용자에게 확인된 것은 동시점의 불일치뿐이다 — 우리가 관찰하지
     * 않은 변화를 말하지 않는다(§39.11 Audit · `mirror.ts` `noteFor`와 같은 판단).
     */
    const fromCurrent = insight.evidenceScope === 'current' && relationshipRef !== null;
    return {
      id: insightId('mirror', insight.key),
      type: 'CHANGE',
      axis: insight.key,
      sources: fromCurrent ? ['declared', relationshipSource] : ['declared'],
      evidenceRefs: fromCurrent ? [declaredRef, relationshipRef!] : [declaredRef],
      strength: fromCurrent ? 'medium' : 'weak',
      confidenceReason: `mirror:absent:${insight.evidenceScope}`,
      ruleSummary: fromCurrent
        ? `${withTopicParticle(insight.label)} 중요하다고 말했는데, ${when}는 그 장면이 크게 드러나지 않는다고 답했어.`
        : `${withTopicParticle(insight.label)} 중요하다고 말했지만 경험 후 우선순위가 옮겨간 축이야.`,
      eligibleForNarrative: true,
    };
  }

  // GAP — evidenceStrength가 항상 'hardest'|'important'다.
  if (!relationshipRef) return null;

  const corroborating = findCorroboratingObservedTrait(insight.key, validated);
  const escalateToContradiction = Boolean(corroborating) && !alreadyExplained;

  const sources: CrossSourceInsight['sources'] = escalateToContradiction
    ? ['declared', relationshipSource, 'observed']
    : ['declared', relationshipSource];

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
      ? `${insight.label}에서 네가 말한 기준, ${when} 나타난 신호, 그리고 사진에서 반복해서 보인 활동까지 서로 다른 방향을 가리키고 있어.`
      : `${withTopicParticle(insight.label)} 말한 기준보다 ${when} 더 크게 반응한 축이야.`;

  return {
    id: insightId('mirror', insight.key),
    type,
    axis: insight.key,
    sources,
    evidenceRefs,
    strength,
    confidenceReason: `mirror:${insight.evidenceStrength}:${insight.evidenceScope}${escalateToContradiction ? '+observed' : ''}`,
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
  tense: RelationshipTense;
}): CrossSourceInsight | null {
  const { experience, target, tense } = input;
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
    /**
     * v1.41 §39.13 — `ended`에서 `지금 상대`라고 부르지 않는다.
     *
     * ⚠️ **근거는 그대로다.** 사용자가 S19에 입력한 값이고, 관계가 끝났다는 사실이
     * 그 입력을 없던 일로 만들지 않는다 — 회고에 그 맥락이 필요해서 v1.40이
     * `dating → ended`에서 target을 자동 삭제하지 않기로 정했다. 바뀌는 것은 호칭뿐.
     */
    ruleSummary:
      tense === 'former'
        ? `과거 관계에서 가장 힘들었던 지점과, 그 상대에 대해 네가 알고 있다고 입력한 특성이 같은 축을 가리키고 있어.`
        : `과거 관계에서 가장 힘들었던 지점과, 지금 상대에 대해 네가 이미 알고 있다고 입력한 특성이 같은 축을 가리키고 있어.`,
    eligibleForNarrative: true,
  };
}

/* ---------------------------------------------------------------- ③ History */

/**
 * History Engine의 SHIFT/NEW를 CHANGE로 재표현한다.
 *
 * ⚠️ v1.26 History 실측에서 **근거를 고쳤다.**
 *
 * 예전에는 두 번째 ref로 `{ source: 'declared' }`(= 지금 세션의 답)를 걸었다. 그런데
 * `buildHistoryReport`는 **저장된 마지막 두 기록**(entries[n-2] vs entries[n-1])을
 * 비교하므로, 현재 분석이 아직 저장되지 않은 상태에서는 note와 근거가 서로 다른 시점을
 * 가리킨다. 실측에서 note는 "(2/5 → 3/5)"인데 근거는 "연락 중요도를 5점 중 5로 답했어"
 * (현재값)로 나와 **화면 위에서 모순**이 됐다.
 *
 * 지금은 비교에 실제로 참여한 **두 기록**을 근거로 건다. 그래서 source는 `history`
 * 하나뿐이고(기록 내부 비교이므로 cross-source가 아니다), 연결 섹션이 아니라
 * '아직 다른 자료와 이어지지 않은 관찰'로 내려간다 — 그게 사실에 맞는 위계다.
 */
function fromHistoryChange(change: HistoryAxisChange): CrossSourceInsight | null {
  if (change.state !== 'SHIFT' && change.state !== 'NEW') return null;

  return {
    id: insightId('history_change', change.axis),
    type: 'CHANGE',
    axis: change.axis,
    sources: ['history'],
    evidenceRefs: [
      { source: 'history', entryId: 'previous', axis: change.axis },
      { source: 'history', entryId: 'latest', axis: change.axis },
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

/* ------------------------- ④ Compatibility ↔ Relationship / Mirror / History */

/**
 * **v1.26 P3-3에서 새로 만든 조합. 이 파일에서 가장 중요한 추가다.**
 *
 * Audit에서 발견한 것: v1.25까지 이 Engine은 `CompatibilityResult`를 **입력으로 받지도
 * 않았다.** 그래서 사용자가 무료 결과에서 방금 읽은 '차이가 보이는 신호'가 Premium의 어떤
 * 연결에도 등장하지 않았고, Premium은 Mirror·History·Target만 이어 붙였다 — 정작 사용자가
 * 걱정하는 축과 이어지지 않은 것이다.
 *
 * 여기서 만드는 연결은 이것뿐이다:
 *   "지금 상대와 차이가 보이는 이 축이, 네 관계 경험(또는 과거 관찰)에서도 같은 축을
 *    가리키고 있다."
 *
 * ⚠️ 두 판정은 **서로 독립적으로** 계산됐다. `buildCompatibility`는 관계 경험을 읽지 않고,
 * `buildMirrorReport`는 상대 정보를 읽지 않는다. 그래서 같은 축을 가리키는 것이 우연이
 * 아닌 정보가 된다 — 하지만 **인과는 아니다**. 문장은 항상 '같은 축을 가리킨다'까지만
 * 말하고 '과거 경험 때문에 지금 민감하다'로 넘어가지 않는다.
 *
 * ⚠️ 새 점수·새 판정을 만들지 않는다. `dimension.tone`(이미 계산됨)과
 * `MirrorInsight.state`(이미 계산됨), `HistoryAxisChange.state`(이미 계산됨)만 읽는다.
 */
const COMPATIBILITY_LINKABLE_AXES: readonly TargetAxisKey[] = [
  'contact',
  'conflict',
  'alone',
  'affection',
];

function fromCompatibilityLink(input: {
  dimension: CompatibilityDimension;
  mirror: MirrorReport;
  historyChanges: readonly HistoryAxisChange[];
  repeatedSignals: readonly RepeatedRelationshipSignal[];
  latestHistoryEntryId: string | null;
  tense: RelationshipTense;
}): CrossSourceInsight | null {
  const { dimension, mirror, historyChanges, repeatedSignals, latestHistoryEntryId, tense } =
    input;

  // 비교 자체가 없었던 축('모름')은 연결하지 않는다 — 없는 판정을 이어 붙이지 않는다.
  if (dimension.alignment === null || dimension.tone === 'unknown') return null;
  // 뚜렷하지 않은 축(neutral)은 연결의 재료로 쓰지 않는다. 억지 개수 채우기 금지.
  if (dimension.tone === 'neutral') return null;
  if (!COMPATIBILITY_LINKABLE_AXES.includes(dimension.key)) return null;

  const axis = dimension.key as MirrorAxisKey;

  /** 같은 축에서 Mirror가 이미 판정한 것 (관계 경험 근거가 있는 것만) */
  const mirrorInsight = mirror.available
    ? mirror.insights.find(
        (item) =>
          item.key === axis && item.state !== 'UNKNOWN' && item.evidenceStrength !== 'absent',
      )
    : undefined;

  /** 같은 축에서 History가 이미 판정한 변화 */
  const historyChange = historyChanges.find(
    (change) => change.axis === axis && (change.state === 'SHIFT' || change.state === 'NEW'),
  );
  const repeated = repeatedSignals.find((signal) => signal.axis === axis);

  // 연결할 상대가 하나도 없으면 만들지 않는다 — single-source는 Premium의 재료가 아니다.
  if (!mirrorInsight && !historyChange && !repeated) return null;

  const evidenceRefs: EvidenceRef[] = [{ source: 'compatibility', field: dimension.key }];
  const sources: CrossSourceInsight['sources'] = ['compatibility'];

  if (mirrorInsight) {
    const relationshipRef = relationshipRefFor(mirrorInsight);
    if (relationshipRef) {
      evidenceRefs.push({ source: 'declared', field: axis }, relationshipRef);
      // v1.41 — 근거가 현재 관계에서 왔으면 source도 그렇게 센다(ref와 같은 판정).
      sources.push('declared', relationshipSourceOf(mirrorInsight));
    }
  }
  if (repeated && latestHistoryEntryId) {
    /**
     * ⚠️ v1.26 실측에서 고쳤다 — 예전에는 `entryIds[0]` **하나만** 근거로 걸었다.
     * 그런데 이 연결의 문장은 "이전 관찰에서도 **반복해서** 나온 축"이라고 말한다.
     * 2회 이상을 주장하면서 근거를 1건만 보여주면 사용자가 확인할 수 없다.
     * 반복 판정에 실제로 쓰인 기록 전부를 근거로 건다.
     */
    for (const entryId of repeated.entryIds) {
      evidenceRefs.push({ source: 'history', entryId, axis });
    }
    sources.push('history');
  } else if (historyChange && latestHistoryEntryId) {
    evidenceRefs.push({ source: 'history', entryId: latestHistoryEntryId, axis });
    sources.push('history');
  }

  // compatibility 하나만 남았다면 연결이 아니다.
  if (sources.length < 2) return null;

  const differs = dimension.tone === 'watch';
  const hasHardest = mirrorInsight?.evidenceStrength === 'hardest';

  /**
   * 문장은 **연결의 사실**까지만 말한다. '왜'는 AI Narrative가 맥락을 붙이고,
   * 그것도 인과가 아니라 '같은 방향으로 보인다'까지다.
   */
  /**
   * v1.41 §39.13 — **§38.11이 남긴 시제 항목 ①이 여기다.**
   *
   * v1.40.1의 Remaining Risk 첫 줄은 `ended` 리포트에 남은 `지금 상대와 연락 방식에서
   * 차이가 보이는데…`였다. 그 문장은 행동 제안이 아니라 사실 서술이라 `audience`
   * 게이트에 걸리지 않았고, 고치려면 이 `ruleSummary` 생성 규칙을 건드려야 했다.
   *
   * 두 곳을 갈랐다.
   *
   * | 무엇 | v1.40.1 | v1.41 |
   * |---|---|---|
   * | 상대 호칭 | `지금 상대와` (ended에도) | `tense === 'former'`면 `그때 상대와` |
   * | 관계 근거 시점 | `네 관계 경험에서` (시점 없음) | 근거의 실제 scope를 말한다 |
   *
   * ⚠️ **판정(`type`)·강도·근거 목록·개수는 하나도 바뀌지 않는다.** `tone`은 이미
   * 계산된 값이고 이 함수는 그것을 Cross-source 어휘로 옮기기만 한다(v1.26 원칙).
   */
  const ruleSummary = ((): string => {
    const parts: string[] = [];
    if (mirrorInsight) {
      parts.push(
        mirrorInsight.evidenceScope === 'current'
          ? `${tense === 'former' ? '그때 이 관계에서' : '지금 관계에서'} 신호가 있는 축`
          : '네 관계 경험에서 신호가 있었던 축',
      );
    }
    if (repeated) parts.push('이전 관찰에서도 반복해서 나온 축');
    else if (historyChange) parts.push('저장된 관찰과 비교해 달라진 축');

    const other = parts.join('이고, ');
    const partner = tense === 'former' ? '그때 상대와' : '지금 상대와';
    return differs
      ? `${partner} ${dimension.label}에서 차이가 보이는데, 이 축은 ${other}이야. 서로 다른 관찰이 같은 축을 가리키고 있어.`
      : `${partner} ${dimension.label}에 대한 기대는 비슷한데, 이 축은 ${other}이야. 비슷하게 답한 축이라도 네게는 계속 신호가 있던 자리야.`;
  })();

  return {
    id: insightId('compat_link', axis),
    // 차이가 보이는 축이 다른 관찰과 겹치면 GAP, 비슷한 축이면 MATCH로 둔다.
    // ⚠️ 새 판정이 아니다 — 이미 계산된 tone을 Cross-source 타입 어휘로 옮긴 것뿐이다.
    type: differs ? 'GAP' : 'MATCH',
    axis,
    sources,
    evidenceRefs,
    strength: strengthOf(sources.length, hasHardest),
    confidenceReason: `compat:${dimension.tone}${mirrorInsight ? '+mirror' : ''}${repeated ? '+repeated' : historyChange ? '+history' : ''}`,
    ruleSummary,
    eligibleForNarrative: true,
    ...(repeated ? { relatedHistoryIds: repeated.entryIds } : {}),
  };
}

/* ------------------------------------------- ⑤ MBTI Lens ↔ Relationship Signal */

/**
 * v1.26 P3-3 — 무료 MBTI가 v1.25에서 깊어졌으므로 **Premium에서 4축 설명을 다시
 * 출력하지 않는다.** Premium이 쓰는 것은 v1.24 Bridge가 이미 만든 판정 하나다:
 * '성향 렌즈와 실제 관계 답변이 다른 방향을 가리키는 축'.
 *
 * 그리고 그 축을 **관계 경험과 한 번 더 겹쳐본다** — 그래야 무료 Bridge의 반복이 아니라
 * Cross-source가 된다. 겹칠 것이 없으면 만들지 않는다.
 */
function fromMbtiBridge(input: {
  bridge: MbtiBridgeReport;
  mirror: MirrorReport;
}): CrossSourceInsight | null {
  const { bridge, mirror } = input;
  if (!bridge.available) return null;

  // 무료에서 이미 '같은 방향'이라고 본 축은 Premium에서 다시 말할 가치가 없다.
  const differing: MbtiAxisBridge | undefined = bridge.axisBridges.find(
    (item) => item.state === 'differs',
  );
  if (!differing) return null;

  const axis = differing.signalAxisKey as MirrorAxisKey;
  const mirrorInsight = mirror.available
    ? mirror.insights.find(
        (item) =>
          item.key === axis && item.state !== 'UNKNOWN' && item.evidenceStrength !== 'absent',
      )
    : undefined;
  const relationshipRef = mirrorInsight ? relationshipRefFor(mirrorInsight) : null;

  // 관계 경험과 겹치지 않으면 무료 Bridge와 같은 이야기다 — Premium에 넣지 않는다.
  if (!relationshipRef) return null;

  return {
    id: insightId('mbti_link', axis),
    type: 'GAP',
    axis,
    // v1.41 — 근거가 현재 관계에서 왔으면 source도 그렇게 센다.
    sources: ['mbti_lens', 'compatibility', relationshipSourceOf(mirrorInsight!)],
    evidenceRefs: [
      { source: 'mbti_lens', field: differing.mbtiAxisKey },
      { source: 'compatibility', field: differing.signalAxisKey },
      relationshipRef,
    ],
    strength: strengthOf(3, mirrorInsight?.evidenceStrength === 'hardest'),
    confidenceReason: 'mbti_bridge:differs+relationship',
    ruleSummary:
      mirrorInsight!.evidenceScope === 'current'
        ? `성향 렌즈와 실제 답변이 다른 방향을 가리킨 ${differing.signalAxisLabel}은, 지금 관계에서도 신호가 있는 축이야. 성향으로 설명되지 않는 자리에 네 답이 놓여 있어.`
        : `성향 렌즈와 실제 답변이 다른 방향을 가리킨 ${differing.signalAxisLabel}은, 네 관계 경험에서도 신호가 있던 축이야. 성향으로 설명되지 않는 자리에 네 경험이 놓여 있어.`,
    eligibleForNarrative: true,
  };
}

/* ------------------------------------------- ⑨ Current × Past Relationship */

/**
 * ⑨ **지금 관계 × 이전 관계** — v1.41이 추가한 유일한 연결 (§39.18)
 *
 * ══ 왜 이것이 Premium이고 무료의 반복이 아닌가 ═══════════════════════════
 *
 * 무료 Mirror는 축마다 **한 시점만** 보여준다. `resolveAxisEvidence`가 현재 근거를
 * 먼저 쓰기 때문에, 두 시점 모두 답한 사용자에게도 화면에는 현재 것만 보인다
 * (과거 근거는 버려지지 않고 여기 온다 — Resolver 주석 참고).
 *
 * ```
 * FREE     이 축에서 지금 나는 어떤가                (한 시점)
 * PREMIUM  같은 축에서 지금의 나와 이전의 나가 다르다  (두 시점)
 * ```
 *
 * 두 source는 **실제로 독립적이다.** 서로 다른 질문이고(S15~S17 vs S30), 서로 다른
 * 시점에 입력됐고, 어느 쪽도 다른 쪽을 참조하지 않는다. v1.35의 ⑧(Solo History ×
 * Declared)과 같은 종류의 독립성이다.
 *
 * ⚠️ **두 시점이 다를 때만 만든다.** 같은 강도로 나온 축은 `이전에도 지금도 비슷하다`는
 * 관찰인데, 그건 무료 Mirror의 MATCH가 이미 말하는 것과 사용자에게 같은 정보다
 * (§22 같은 역할을 두 번 보여주지 않는다). 다를 때만 무료가 구조적으로 보여줄 수
 * 없는 것이 된다.
 *
 * ⚠️ **인과를 만들지 않는다.** `과거에 힘들었기 때문에 지금 민감하다`로 넘어가지
 * 않는다 — `limitationFor`의 `current_relationship + relationship` 분기가 그 경계를
 * 항상 붙인다. 문장은 `두 시점의 답이 다른 방향을 가리킨다`까지다.
 *
 * ⚠️ **어느 쪽이 진짜 너인지 정하지 않는다.** 이건 v1.0부터 Mirror가 지켜 온 규칙이고,
 * 시점이 둘이 되어도 달라지지 않는다.
 */
function fromCurrentVsPast(input: {
  axis: MirrorAxisKey;
  label: string;
  experience: RelationshipExperience;
  current: CurrentRelationshipEvidence;
  tense: RelationshipTense;
}): CrossSourceInsight | null {
  const { axis, label, experience, current, tense } = input;

  // 지금 관계 근거가 실제로 있어야 한다 (`unsure`는 근거가 아니다 — Resolver가 판정한다)
  const currentResolution = resolveAxisEvidence({ axis, experience, current });
  if (currentResolution.scope !== 'current') return null;

  /**
   * 과거 근거를 **Resolver와 같은 규칙으로** 다시 읽는다. 현재 근거를 지운 상태로
   * 같은 함수를 부르면 그 축의 과거 강도가 나온다 — 여기서 과거 판정 규칙을
   * 복제하지 않기 위한 방법이다(판정은 한 벌만 존재해야 한다).
   */
  const pastResolution = resolveAxisEvidence({
    axis,
    experience,
    current: NO_CURRENT_RELATIONSHIP,
  });
  if (pastResolution.scope !== 'past') return null;

  // 두 시점이 같은 강도면 무료 MATCH가 이미 말한 것과 같다 — 만들지 않는다.
  if (pastResolution.strength === currentResolution.strength) return null;

  const currentPhrase = tense === 'former' ? '그때 이 관계에서' : '지금 관계에서';
  const strongerNow =
    STRENGTH_ORDER[currentResolution.strength] > STRENGTH_ORDER[pastResolution.strength];

  return {
    id: insightId('curpast', axis),
    /**
     * ⚠️ `CHANGE`로 둔다. 두 **시점**의 답이 다르다는 관찰이고, 그게 이 타입이
     * 뜻하는 것이다. `GAP`(말한 기준 vs 실제)이나 `CONTRADICTION`(세 근거가 어긋남)은
     * 다른 판정이므로 빌려 쓰지 않는다.
     */
    type: 'CHANGE',
    axis,
    sources: ['current_relationship', 'relationship'],
    evidenceRefs: [
      { source: 'current_relationship', field: axis },
      pastResolution.strength === 'hardest'
        ? { source: 'relationship', field: 'hardest' }
        : { source: 'relationship', field: 'important' },
    ],
    /**
     * ⚠️ `strong`을 주지 않는다. 두 시점의 답이 다르다는 관찰이고 **왜인지는 이
     * 데이터로 알 수 없다** — 강도를 올리면 시간축 비교가 판정처럼 읽힌다(v1.35 ⑧과
     * 같은 판단).
     */
    strength: 'medium',
    confidenceReason: `curpast:${pastResolution.strength}->${currentResolution.strength}`,
    ruleSummary: strongerNow
      ? `${withTopicParticle(label)} 이전 관계보다 ${currentPhrase} 더 크게 드러난다고 답했어. 두 시점의 답이 다른 방향을 가리키고 있어 — 어느 쪽이 진짜 너인지는 정하지 않을게.`
      : `${withTopicParticle(label)} 이전 관계에서는 신호가 있던 축인데, ${currentPhrase}는 그만큼 드러나지 않는다고 답했어. 어느 쪽이 진짜 너인지는 정하지 않을게.`,
    eligibleForNarrative: true,
  };
}

/** 강도 비교 전용 순서. **점수가 아니다** — `>` 비교 한 곳에서만 쓴다 */
const STRENGTH_ORDER: Record<EvidenceStrength, number> = {
  absent: 0,
  important: 1,
  hardest: 2,
};

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
  /**
   * v1.41 §39.4 — 지금 관계 근거. **필수다.**
   *
   * 갖고 있지 않은 호출부는 `NO_CURRENT_RELATIONSHIP`을 명시적으로 넘긴다 —
   * optional로 두면 새 호출부가 조용히 빼먹고, 그러면 같은 세션인데 화면과 리포트가
   * 서로 다른 근거로 판정한다. v1.40.1 §38.2가 닫은 실패 형태를 되풀이하지 않는다.
   */
  current: CurrentRelationshipEvidence;
  /**
   * v1.41 §39.13 — 관계를 **부르는 이름**(`ended`면 `'former'`).
   *
   * ⚠️ evidence가 아니다. 이 값은 어떤 연결이 만들어지는지·근거가 몇 개인지·강도가
   * 무엇인지 **하나도 바꾸지 않는다.** `ruleSummary` 문장의 호칭만 바꾼다.
   */
  tense: RelationshipTense;
  target: TargetProfile;
  mirror: MirrorReport;
  validated: readonly ValidatedObservation[];
  historyChanges: readonly HistoryAxisChange[];
  repeatedSignals: readonly RepeatedRelationshipSignal[];
  /** History가 있으면 마지막 Entry id — evidenceRef 표시용 */
  latestHistoryEntry: RelationshipHistoryEntry | null;
  /**
   * v1.26 — 변화 비교에 실제로 참여한 **이전** 기록. `buildHistoryReport`가 비교하는
   * 두 기록(entries[n-2] vs entries[n-1])을 근거로 그대로 보여주기 위해 필요하다.
   */
  previousHistoryEntry?: RelationshipHistoryEntry | null;
  /** v1.9 §11 — 이 Insight에서 나온 Deep Question에 답했으면 새 근거로 덧붙인다(§40) */
  deepAnswers?: readonly DeepAnalysisAnswer[];
  /**
   * v1.26 P3-3 — 이미 계산된 동기화율 결과. **읽기만** 한다.
   * 없으면(또는 score가 null이면) ④ 조합을 만들지 않는다.
   */
  compatibility?: CompatibilityResult;
  /** v1.26 P3-3 — 이미 계산된 MBTI Bridge(v1.24). 없으면 ⑤ 조합을 만들지 않는다 */
  mbtiBridge?: MbtiBridgeReport | null;
  /**
   * v1.32 P4-D — 자기 MBTI만으로 만든 Self Lens. 없으면 ⑦ 조합을 만들지 않는다.
   *
   * `mbtiBridge`(⑤)는 `MbtiLensReport`를 요구하는데 그건 **양쪽 MBTI**가 있어야
   * 만들어진다. Solo에게 열리는 건 이쪽뿐이다.
   */
  mbtiSelfLens?: MbtiSelfLens | null;
  /**
   * v1.35 §19 — 이미 계산된 **Solo** 시간축 비교(`buildSoloHistoryReport`). 없으면
   * ⑧ 조합을 만들지 않는다.
   *
   * ⚠️ 여기서 Solo 비교를 다시 계산하지 않는다 — 이 파일은 판정을 만들지 않는다.
   *   `historyChanges`  커플 기록끼리의 비교 (`buildHistoryReport`)
   *   `soloHistory`     저장된 Solo snapshot vs **지금 답** (`buildSoloHistoryReport`)
   * 둘은 주어도 시점도 다르므로 섞지 않는다.
   */
  soloHistory?: SoloHistoryReport | null;
}

/**
 * ⑥ Declared ↔ Observed — **상대가 없어도 이어지는 유일한 조합** (v1.29 P4 §39)
 *
 * P4 Audit에서 드러난 문제: `hasDeepConnection`은 **서로 다른 source 2종 이상**을
 * 요구하는데, Solo 사용자가 만들 수 있는 조합이 하나도 없었다.
 *
 *   ① declared+relationship  관계 경험이 없으면 Mirror 자체가 비어 있다
 *   ② relationship+target    둘 다 필요하다
 *   ④ compatibility+…        동기화율을 계산할 수 없다
 *   ⑤ mbti_lens+compatibility+relationship  같은 이유로 불가
 *
 * 그래서 `solo_none` 사용자에게 Premium은 **구조적으로 영구히 unavailable**이었다.
 * 카피로 가릴 문제가 아니라 연결이 실제로 없던 것이다.
 *
 * 이 조합은 두 source가 진짜로 독립적이다 — `declared`는 사용자가 답한 기준이고,
 * `observed`는 사진에서 **반복해서** 나타난 활동이다(`strength !== single`).
 * 서로를 참조하지 않고 만들어진 두 관찰이 같은 축을 가리키는 것이 정보값이다.
 *
 * ⚠️ **사진으로 성격을 판단하지 않는다**(§36). `ruleSummary`는 "같은 축을 가리킨다"까지고,
 * `limitationFor`의 `observed` 분기가 "사진으로 성격을 판단하지는 않아"를 항상 붙인다.
 * 사용자가 확인·수정한 관찰만 쓴다(`findCorroboratingObservedTrait`가 이미 그렇게 한다).
 */
function fromDeclaredVsObserved(input: {
  axis: MirrorAxisKey;
  label: string;
  validated: readonly ValidatedObservation[];
}): CrossSourceInsight | null {
  const { axis, label, validated } = input;

  const corroborating = findCorroboratingObservedTrait(axis, validated);
  if (!corroborating) return null;

  const signal = corroborating.original.signal;
  const repeated = signal !== undefined && signal.strength !== 'single';

  return {
    id: insightId('selfobserved', axis),
    type: 'MATCH',
    axis,
    sources: ['declared', 'observed'],
    evidenceRefs: [
      { source: 'declared', field: axis },
      { source: 'observed', traitId: corroborating.original.id },
    ],
    /**
     * ⚠️ `strong`을 주지 않는다. 사진 관찰은 보조 근거이고, 두 관찰이 같은 축을
     * 가리킨다는 것만 확인됐다 — 강도를 올리면 사진이 판정 근거처럼 읽힌다.
     *
     * 그리고 **사진 한 장짜리 관찰과 반복 관찰을 같은 강도로 세지 않는다**(§5 · §36).
     * `findCorroboratingObservedTrait`는 두 경로를 갖는데, 카테고리 경로는 반복
     * (`strength !== single`)을 요구하지만 키워드 경로는 그렇지 않다. 그래서 여기서
     * 한 번 더 구분한다 — 반복이 확인되지 않은 근거로 연결의 강도를 올리지 않는다.
     */
    strength: repeated ? 'medium' : 'weak',
    confidenceReason: repeated ? 'self:declared+observed:repeated' : 'self:declared+observed:single',
    /**
     * ⚠️ v1.35 §8 — **반복 어휘는 실제 반복 근거가 있을 때만 쓴다.**
     *
     * 예전 문장은 강도와 무관하게 "사진 기록에서 **반복해서** 보인 활동"이었다. 그런데
     * `findCorroboratingObservedTrait`의 키워드 경로는 `strength`를 요구하지 않아서
     * **사진 한 장짜리 단일 관찰에도** 같은 문장이 붙었다(실측). 그리고 `strength`가
     * `repeated`(서로 다른 장면 2개)인 경우도 `describeSignal`이 이미
     * "반복인지는 아직 조심스러워"라고 말하는 구간이다 — 같은 데이터에 대해 화면과
     * 리포트가 서로 다른 말을 하게 된다.
     *
     * 그래서 반복 임계값을 **`SOLO_REPEAT_MIN_OBSERVATIONS`와 하나로 맞춘다**:
     * 서로 다른 장면 3개 이상(`strong_repeated`)일 때만 '반복해서'라고 쓴다.
     */
    ruleSummary:
      signal?.strength === 'strong_repeated'
        ? `${label}에 대해 네가 답한 기준과, 사진 기록에서 반복해서 보인 활동이 같은 축을 가리키고 있어.`
        : `${label}에 대해 네가 답한 기준과, 사진에서 보인 활동이 같은 축을 가리키고 있어.`,
    eligibleForNarrative: true,
  };
}

/**
 * ⑧ Solo History ↔ Current Declared — **상대도 사진도 MBTI도 없이 열리는 연결** (v1.35 · §19 ~ §22)
 *
 * P4-B Audit에서 확인한 것: Solo History는 저장되고 화면에 비교까지 보이는데,
 * **Premium 엔진은 그 기록을 입력으로 받지도 않았다.** `historyChanges`는
 * `buildHistoryReport`의 결과이고 그건 커플 기록만 본다 — 즉 Solo 사용자가 관찰을
 * 몇 번 쌓아도 Deep Report의 source는 늘지 않았다.
 *
 * 두 source는 실제로 독립적이다. `history`는 **그때 저장해 얼려둔 값**이고
 * `declared`는 **지금 답한 값**이다. 서로를 참조하지 않고 서로 다른 시점에 입력됐다.
 *
 * ⚠️ **기록이 한 건 있다는 이유만으로 만들지 않는다**(§22). 만드는 조건은
 * **두 축 이상이 함께 움직였는가**다:
 *
 *   FREE     축별로 '지난 관찰과 다르게 답했어' — 이미 무료가 다 보여준다(§17)
 *   PREMIUM  그 변화들이 **같은 시점에 함께** 나타났다는 관찰 (§18)
 *
 * 한 축만 달라진 경우는 무료 비교 문장을 반복하는 것뿐이라 아무것도 만들지 않는다 —
 * 억지 generator를 만들지 않는다(§21 · §23 Duplication Matrix).
 *
 * ⚠️ **과거 → 현재 인과를 만들지 않는다**(§20). `limitationFor`의 `history` 분기가
 * "과거가 지금의 원인이라고는 말할 수 없어"를 항상 붙인다. `ruleSummary`도
 * '다른 방향을 가리키고 있어'까지고 '왜'는 말하지 않는다.
 *
 * ⚠️ MBTI를 원인으로 끌어오지 않는다 — 이 조합에는 `mbti_lens`가 아예 없다(§21).
 */
function fromSoloHistoryChanges(input: {
  changes: readonly SoloAxisChange[];
  baselineEntryId: string | null;
}): CrossSourceInsight | null {
  const { changes, baselineEntryId } = input;
  if (!baselineEntryId) return null;

  const moved = changes.filter((change) => change.state === 'CHANGE');
  // 한 축만 달라진 것은 무료가 이미 말한 사실이다 — 같은 문장을 유료에서 반복하지 않는다.
  if (moved.length < 2) return null;

  /**
   * 축 이름을 다 나열하지 않는다 — 5축이 모두 움직인 세션에서 한 문장이 목록처럼
   * 읽혔다(실측). 앞의 세 개까지 부르고 나머지는 개수로 말한다. 축별 상세는
   * 무료 비교 목록에 전부 있으므로 정보가 사라지지 않는다.
   */
  const MAX_LABELS = 3;
  const allLabels = moved.map((change) => change.label);
  const shown = allLabels.slice(0, MAX_LABELS).join(' · ');
  const rest = allLabels.length - MAX_LABELS;
  const labelPhrase = rest > 0 ? `${shown} 외 ${rest}개` : shown;

  return {
    /** 축 하나에 매달린 관찰이 아니다 — 대표 축만 붙이고 id는 조합 전체를 가리킨다 */
    id: insightId('solohistory', 'change'),
    type: 'CHANGE',
    axis: moved[0]!.axis,
    sources: ['history', 'declared'],
    evidenceRefs: [
      ...moved.map((change) => ({
        source: 'history' as const,
        entryId: baselineEntryId,
        axis: change.axis,
      })),
      ...moved.map((change) => ({ source: 'declared' as const, field: change.axis })),
    ],
    /**
     * ⚠️ `strong`을 주지 않는다. 두 축이 함께 달라졌다는 관찰이고, 그게 왜인지는
     * 이 데이터로 알 수 없다 — 강도를 올리면 시간축 비교가 판정처럼 읽힌다.
     */
    strength: 'medium',
    confidenceReason: `solo_history:changed:${moved.length}`,
    ruleSummary: `${labelPhrase} — ${allLabels.length}개 기준이 지난 관찰과 지금 사이에서 함께 다른 방향을 가리키고 있어. 어느 쪽이 맞다고 정하지는 않을게.`,
    eligibleForNarrative: true,
    relatedHistoryIds: [baselineEntryId],
  };
}
/**
 * ⑦ Declared ↔ MBTI Self Lens — **사진 없이도 열리는 Solo 연결** (v1.32 P4-D)
 *
 * v1.29의 ⑥(declared × observed)만으로는 Solo Premium이 사실상 **사진 필수**였다.
 * "나에 대해 꽤 많은 걸 입력했는데 사진이 없다는 이유로 Deep Report는 못 본다"가
 * 되면 그건 근거의 문제가 아니라 입장권의 문제다.
 *
 * 두 source는 실제로 독립적이다 — MBTI는 사용자가 **자기를 설명한 유형**이고,
 * declared는 **관계에서 무엇이 중요한지 답한 값**이다. 서로를 참조하지 않고 입력됐다.
 *
 * ⚠️ **축을 새로 매핑하지 않는다.** v1.24가 4축 중 의미가 실제로 겹치는 **하나만**
 * (`energy ↔ alone`) 연결하고 T/F↔갈등 해결 등은 stereotype 위험으로 **의도적으로
 * 기각**했다. 여기서 그 결정을 뒤집지 않는다 — Premium이라고 더 많이 연결하지 않는다.
 *
 * ⚠️ **`I라서 혼자 있는 시간이 필요하다`고 말하지 않는다.** 두 답이 같은 방향으로
 * 나타났다는 관찰까지다. `limitationFor`의 `mbti_lens` 분기가 "성향이 관계 행동을
 * 결정한다는 뜻은 아니야"를 항상 붙인다.
 *
 * ⚠️ 개인 시간이 보통(3)이면 방향을 말할 수 없으므로 **만들지 않는다.**
 */
function fromDeclaredVsMbtiSelf(input: {
  declared: DeclaredPreference;
  selfLens: MbtiSelfLens;
}): CrossSourceInsight | null {
  const { declared, selfLens } = input;

  const energy = selfLens.axes.find((axis) => axis.key === 'energy');
  if (!energy) return null;

  const alone = declared.alone;
  if (alone === null || alone === 3) return null;

  const inward = energy.letter === 'I';
  const needsAlone = alone >= 4;
  const aligns = inward === needsAlone;

  const lensPhrase = inward ? '내향(I) 쪽' : '외향(E) 쪽';
  const answerPhrase = needsAlone ? '혼자 있는 시간을 중요하게' : '혼자 있는 시간은 크게 필요하지 않다고';

  return {
    id: insightId('selfmbti', 'alone'),
    type: aligns ? 'MATCH' : 'GAP',
    axis: 'alone',
    sources: ['declared', 'mbti_lens'],
    evidenceRefs: [
      { source: 'declared', field: 'alone' },
      { source: 'mbti_lens', field: 'energy' },
    ],
    /**
     * ⚠️ `strong`을 주지 않는다. MBTI는 Supporting Lens이고 동기화율·Mirror 판정에
     * 들어가지 않는다 — 강도를 올리면 유형이 판정 근거처럼 읽힌다.
     */
    strength: 'medium',
    confidenceReason: aligns ? 'self:mbti+declared:aligns' : 'self:mbti+declared:differs',
    ruleSummary: aligns
      ? `성향 렌즈에서는 ${lensPhrase}이고, 실제로 답한 개인 시간 기준도 ${answerPhrase} 답했어. 두 답이 같은 방향으로 나타났어.`
      : `성향 렌즈에서는 ${lensPhrase}인데, 실제로 답한 개인 시간 기준은 ${answerPhrase} 답했어. 두 답이 다른 방향을 가리키고 있어.`,
    eligibleForNarrative: true,
  };
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
  const {
    declared,
    experience,
    current,
    tense,
    target,
    mirror,
    validated,
    historyChanges,
    repeatedSignals,
  } = input;

  /**
   * 이 리포트를 누구를 위해 만드는가 (v1.33).
   *
   * 화면이 쓰는 것과 **같은 함수**다(`soloModeOfTarget`). 새 boolean을 만들어
   * 여기저기 퍼뜨리지 않는다 — 판정이 갈라지는 순간 화면과 엔진이 어긋난다.
   */
  const audience: 'solo' | 'couple' = soloModeOfTarget(target) === 'couple' ? 'couple' : 'solo';

  const insights: CrossSourceInsight[] = [];
  /** ①에서 축 중복을 판단하려면 ④보다 먼저 필요하다 */
  const compatibilityInput = input.compatibility;

  /**
   * ① Declared ↔ Relationship (+ Observed 보강) — 관계 경험이 없으면 Mirror 자체가 비어 있다.
   *
   * ⚠️ v1.26 — ④가 같은 축에서 연결을 만들면 여기서는 만들지 않는다. ④는 ①의 두 근거
   * (declared + relationship)를 **그대로 포함하고** 동기화율까지 한 겹 더 이은 것이라,
   * 둘을 함께 내보내면 같은 축 이야기가 리포트에 두 번 나온다(실측 확인 —
   * "연락 방식에서 차이가 보이는데…"와 "연락에 대해 네가 말한 기준과…"가 나란히 나왔다).
   * 단 CONTRADICTION은 ④가 담지 못하는 판정(사진 보강)이라 예외로 남긴다.
   */
  const supersededAxes = new Set<MirrorAxisKey>();
  if (compatibilityInput && compatibilityInput.score !== null && mirror.available) {
    for (const dimension of compatibilityInput.dimensions) {
      const built = fromCompatibilityLink({
        dimension,
        mirror,
        historyChanges,
        repeatedSignals,
        latestHistoryEntryId: input.latestHistoryEntry?.id ?? null,
        tense,
      });
      // v1.41 — 관계 근거는 두 source 중 하나로 셀 수 있다. 둘 다 확인한다.
      if (
        built &&
        (built.sources.includes('relationship') ||
          built.sources.includes('current_relationship'))
      ) {
        supersededAxes.add(dimension.key as MirrorAxisKey);
      }
    }
  }

  if (mirror.available) {
    for (const insight of mirror.insights) {
      const built = fromMirrorInsight(insight, { experience, validated, tense });
      if (!built) continue;
      if (built.type !== 'CONTRADICTION' && supersededAxes.has(insight.key)) continue;
      insights.push(built);
    }
  }

  // ② Relationship ↔ Target — 관계 경험 + 상대 정보가 둘 다 있어야 한다.
  const relVsTarget = fromRelationshipVsTarget({ experience, target, tense });
  if (relVsTarget) insights.push(relVsTarget);

  // ③ Current ↔ History
  for (const change of historyChanges) {
    const built = fromHistoryChange(change);
    if (built) {
      // latest entry id를 실제 값으로 채운다 (fromHistoryChange는 placeholder를 쓴다)
      // placeholder(previous/latest)를 실제 기록 id로 채운다. 하나라도 없으면 그 ref는
      // resolver에서 조용히 빠지므로 없는 근거를 만들지 않는다.
      const latestId = input.latestHistoryEntry?.id;
      const previousId = input.previousHistoryEntry?.id;
      built.evidenceRefs = built.evidenceRefs.map((ref) => {
        if (ref.source !== 'history') return ref;
        if (ref.entryId === 'previous') return previousId ? { ...ref, entryId: previousId } : ref;
        if (ref.entryId === 'latest') return latestId ? { ...ref, entryId: latestId } : ref;
        return ref;
      });
      insights.push(built);
    }
  }
  for (const signal of repeatedSignals) {
    insights.push(fromRepeatedSignal(signal));
  }

  // ④ Compatibility ↔ Relationship / Mirror / History (v1.26)
  //    동기화율을 계산할 수 없는 상태(score === null)에서는 연결하지 않는다.
  if (compatibilityInput && compatibilityInput.score !== null) {
    for (const dimension of compatibilityInput.dimensions) {
      const built = fromCompatibilityLink({
        dimension,
        mirror,
        historyChanges,
        repeatedSignals,
        latestHistoryEntryId: input.latestHistoryEntry?.id ?? null,
        tense,
      });
      if (built) insights.push(built);
    }
  }

  // ⑤ MBTI Lens ↔ Relationship Signal (v1.26)
  if (input.mbtiBridge) {
    const built = fromMbtiBridge({ bridge: input.mbtiBridge, mirror });
    if (built) insights.push(built);
  }

  /**
   * ⑧ Solo History ↔ Current Declared — **Solo 전용** (v1.35 §19 ~ §22)
   *
   * ⚠️ 커플 리포트에는 넣지 않는다. 커플의 시간축 비교는 ③(`historyChanges`)이 담당하고,
   * 그건 저장된 기록끼리의 비교다 — 두 비교를 한 리포트에 함께 내보내면 같은 '변화'
   * 이야기가 서로 다른 시점 기준으로 두 번 나온다.
   */
  if (audience === 'solo' && input.soloHistory?.comparable) {
    const built = fromSoloHistoryChanges({
      changes: input.soloHistory.changes,
      baselineEntryId: input.soloHistory.baselineEntryId,
    });
    if (built) insights.push(built);
  }

  /**
   * ⑦ Declared ↔ MBTI Self Lens — **Solo 전용** (v1.32 P4-D · v1.33 명시적 격리)
   *
   * ⚠️ v1.32까지 이 조합은 `covered.has('alone')`로만 억제됐다. 실측에서 커플 결과가
   * 바뀌지는 않았지만 **그건 우연이었다** — 커플 세션은 대개 Mirror가 `alone` 축
   * insight를 만들어 covered였을 뿐이고, Mirror가 그 축을 UNKNOWN으로 두면 커플
   * 리포트에도 ⑦이 들어갈 수 있었다. 정책은 "Solo 전용"인데 구현은 "대개 안 걸린다"였다.
   *
   * 이제 **audience로 명시적으로 판정한다.** 커플에서 MBTI를 잇는 것은 ⑤
   * (P3-1 MBTI ↔ Relationship Bridge)의 몫이고, 이 조합은 상대가 없을 때만 쓴다.
   *
   * ⚠️ 새 입력을 만들지 않았다 — 이미 받고 있는 `target`으로 화면과 **같은 함수**
   * (`soloModeOfTarget`)를 써서 판정한다. 판정 기준이 두 벌이 되면 화면과 엔진이
   * 서로 다른 사용자로 취급하게 된다.
   */
  if (audience === 'solo' && input.mbtiSelfLens) {
    /**
     * 여기서 `covered`는 **audience 판정이 아니라 축 중복 회피**다.
     * solo_exp는 Mirror가 살아 있어 ①이 `alone` 축을 이미 다뤘을 수 있는데,
     * 그때 ⑦까지 내보내면 같은 축 이야기가 리포트에 두 번 나온다.
     */
    const covered = new Set(
      insights.map((insight) => insight.axis).filter((axis): axis is MirrorAxisKey => Boolean(axis)),
    );
    if (!covered.has('alone')) {
      const built = fromDeclaredVsMbtiSelf({ declared, selfLens: input.mbtiSelfLens });
      if (built) insights.push(built);
    }
  }

  /**
   * ⑨ Current × Past Relationship (v1.41 §39.18)
   *
   * ⚠️ **⑥·⑦의 `covered` 게이트보다 앞에서 만든다.** 이 연결은 두 시점을 나란히
   * 놓는 것이라 그 축의 '주인'에 가깝고, 뒤에 오는 두 조합은 '비어 있던 자리만'
   * 채우는 성격이다(각 함수 주석). 순서를 뒤집으면 ⑥이 먼저 축을 덮어 ⑨가
   * 사라질 수 있다.
   *
   * ⚠️ ①(declared × 지금 관계)과 **같은 축에 함께 나올 수 있다.** 중복이 아니다 —
   * ①은 `말한 기준 vs 지금`이고 ⑨는 `이전 vs 지금`이다. 비교 쌍이 다르고 근거
   * 목록도 다르다. 무료 화면이 보여주는 것은 ① 쪽이고, ⑨는 무료가 구조적으로
   * 보여줄 수 없는 두 번째 쌍이다.
   */
  for (const axis of MIRROR_AXES) {
    const built = fromCurrentVsPast({
      axis: axis.key,
      label: axis.label,
      experience,
      current,
      tense,
    });
    if (built) insights.push(built);
  }

  /**
   * ⑥ Declared ↔ Observed (v1.29 P4)
   *
   * ⚠️ **이미 다른 조합이 덮은 축에는 만들지 않는다.** ①의 CONTRADICTION 승격이
   * 이미 같은 observed 근거를 쓰고 있어서(`findCorroboratingObservedTrait`), 둘을 함께
   * 내보내면 같은 사진 관찰이 리포트에 두 번 나온다. 커플 사용자의 리포트를 바꾸지
   * 않는 것이 이 게이트의 목적이다 — ⑥은 **비어 있던 자리만** 채운다.
   */
  const coveredAxes = new Set(
    insights.map((insight) => insight.axis).filter((axis): axis is MirrorAxisKey => Boolean(axis)),
  );
  for (const axis of MIRROR_AXES) {
    if (coveredAxes.has(axis.key)) continue;
    const built = fromDeclaredVsObserved({ axis: axis.key, label: axis.label, validated });
    if (built) insights.push(built);
  }

  const withDeepAnswers = attachDeepAnswers(insights, input.deepAnswers ?? []);
  return rankInsights(withDeepAnswers);
}
