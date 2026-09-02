import type { CrossSourceInsight } from '@/types';

/**
 * Cross-source Insight 개발용 진단 (v1.10 · §43~§44)
 *
 * ⚠️ 이 숫자는 **Dev QA 전용**이다. 'Personalization Score 87점' 같은 식으로 사용자에게
 * 노출하지 않는다 — 사용자용 품질 기준은 여전히 Quality Gate(§26)뿐이다. 이 진단은
 * "Cross-source Engine이 실제로 한 Source에만 치우치지 않았는지"를 개발자가 확인하는
 * 용도일 뿐, 새로운 판정 기준을 만들지 않는다.
 */
export interface PersonalizationDiagnostics {
  insightCount: number;
  crossSourceCount: number;
  uniqueEvidenceSources: number;
  genericFallbackCount: number;
  historyInsightCount: number;
  targetInsightCount: number;
  /** §44 — Insight가 실제로 어떤 Source 조합에서 나왔는지 분포 */
  coverage: {
    declaredOnly: number;
    relationshipOnly: number;
    declaredPlusRelationship: number;
    relationshipPlusTarget: number;
    currentPlusHistory: number;
  };
}

const RELATIONSHIP_SELF_SOURCES = new Set(['declared', 'relationship', 'observed', 'adaptive', 'user_correction']);

export function reportPersonalizationDiagnostics(
  insights: readonly CrossSourceInsight[],
): PersonalizationDiagnostics {
  const uniqueEvidenceSources = new Set<string>();
  let genericFallbackCount = 0;
  let historyInsightCount = 0;
  let targetInsightCount = 0;
  let crossSourceCount = 0;

  const coverage = {
    declaredOnly: 0,
    relationshipOnly: 0,
    declaredPlusRelationship: 0,
    relationshipPlusTarget: 0,
    currentPlusHistory: 0,
  };

  for (const insight of insights) {
    for (const source of insight.sources) uniqueEvidenceSources.add(source);

    // AI Narrative가 Quality Gate(A)를 통과할 근거 수(2개)를 못 채우면 ruleSummary만 남는다 —
    // 그게 곧 "이번 v1.10에서 말하는 generic fallback" 후보다.
    if (insight.evidenceRefs.length < 2) genericFallbackCount += 1;

    const isRelationshipSelfOnly = insight.sources.every((source) =>
      RELATIONSHIP_SELF_SOURCES.has(source),
    );
    if (!isRelationshipSelfOnly) crossSourceCount += 1;

    if (insight.sources.includes('history')) historyInsightCount += 1;
    if (insight.sources.includes('target')) targetInsightCount += 1;

    const sourceSet = new Set(insight.sources);
    if (sourceSet.has('history')) coverage.currentPlusHistory += 1;
    else if (sourceSet.has('target')) coverage.relationshipPlusTarget += 1;
    else if (sourceSet.has('declared') && sourceSet.has('relationship')) coverage.declaredPlusRelationship += 1;
    else if (sourceSet.size === 1 && sourceSet.has('relationship')) coverage.relationshipOnly += 1;
    else if (sourceSet.size === 1 && sourceSet.has('declared')) coverage.declaredOnly += 1;
  }

  return {
    insightCount: insights.length,
    crossSourceCount,
    uniqueEvidenceSources: uniqueEvidenceSources.size,
    genericFallbackCount,
    historyInsightCount,
    targetInsightCount,
    coverage,
  };
}
