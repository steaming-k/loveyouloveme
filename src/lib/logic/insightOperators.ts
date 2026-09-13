import type {
  CrossSourceInsight,
  EvidenceRef,
  EvidenceSourceFamily,
  InsightOperator,
  MirrorAxisKey,
} from '@/types';
import { refsWithinAllowed } from './allowedEvidence';

/**
 * Insight Operator 계층 — **근거 조합 → 좁혀진 조건** (v1.46.4 Insight Operator Pass)
 *
 * ══ 왜 이 계층이 생겼나 ═══════════════════════════════════════════════════
 *
 * Semantic Decomposition 이후 Top 3 카드 문장은 카드에 정확히 붙었지만, Value Gate에서
 * Novelty 1.2 · Specificity 1.3으로 떨어졌다. 감사 결과 #2·#3 카드는 **근거가 없어서**
 * 일반론이 된 게 아니었다 — 이미 3~4 출처(말한 기준 · 지금 관계 · 기록 · 상대)가
 * 있었다. 모델이 받은 것이 **평평한 사실 목록**이었고, '사용자가 이미 아는 것'과
 * '무엇을 이어야 하는가'가 없었다. 그래서 `기준을 먼저 좁혀봐야 해`로 수렴했다.
 *
 * 이 파일은 그 두 가지를 **결정론으로** 정한다:
 *
 * ```
 * 출처 family      근거가 어느 종류의 앎인가
 * eligibleOperators 이 카드의 근거 조합이 허용하는 해석 틀
 * operatorSatisfied 모델이 고른 틀을 실제로 쓴 근거가 지지하는가
 * ```
 *
 * ⚠️ **판정을 만들지 않는다.** Score · Mirror verdict · History state · Top 3 순서는 이
 * 파일을 import하지 않는다. 여기서 정하는 것은 '모델이 어떤 틀로 말해도 되는가'뿐이다.
 */

export const INSIGHT_OPERATORS: readonly InsightOperator[] = [
  'CONDITION_NARROWING',
  'DECLARED_VS_REACTION',
  'CURRENT_VS_PAST',
  'CONTEXT_DEPENDENT',
  'SELF_VS_TARGET',
  'UNRESOLVED_CORE',
];

/**
 * 근거 출처 → family.
 *
 * ⚠️ `compatibility`는 TARGET이다 — 그 근거 문장은 '나 vs 상대에 대해 입력한 값'이고, 상대
 * 쪽 값이 있어야 성립한다. 상대 값은 **사용자가 입력한 관찰**이지 상대의 사실이 아니다.
 * ⚠️ `adaptive` · `deep_followup`은 사용자가 자기 기준에 대해 더 답한 것이라 DECLARED_SELF다.
 * ⚠️ `observed`(사진에서 반복해 보인 것)는 실제 모습의 기록이라 EXPERIENCE로 둔다.
 * ⚠️ `mbti_lens`는 LENS — 해석 보조 틀이다. 카드 핵심 문장의 근거가 될 수 없다(§4 · §13).
 */
export function evidenceFamilyOf(source: EvidenceRef['source']): EvidenceSourceFamily {
  switch (source) {
    case 'declared':
    case 'adaptive':
    case 'deep_followup':
      return 'DECLARED_SELF';
    case 'current_relationship':
      return 'CURRENT_RELATIONSHIP';
    case 'target':
    case 'compatibility':
      return 'TARGET';
    case 'relationship':
    case 'observed':
      return 'EXPERIENCE';
    case 'history':
      return 'HISTORY';
    case 'user_reported_event':
      return 'EVENT';
    case 'mbti_lens':
      return 'LENS';
  }
}

/** 사용자가 직접 답한 근거인가(계산된 비교·기록 요약이 아닌가) */
export function isUserReportedSource(source: EvidenceRef['source']): boolean {
  return source !== 'compatibility' && source !== 'history' && source !== 'observed' && source !== 'mbti_lens';
}

/**
 * §5 · §11 — 이 카드가 **해석에 쓸 수 있는 근거.** 카드 자기 근거 + 같은 축의 다른 Insight 근거.
 *
 * ⚠️ 왜 같은 축을 더 보는가: 감사에서 contact 카드는 `relationship:hardest`(이전 관계에서 가장
 * 힘들었던 것)를, conflict 카드는 `relationship:important`를 **갖고 있지 않았다.** 그 근거의
 * Insight가 속한 Chapter가 `dedupeByConclusion`에서 같은 결론으로 접혔기 때문이다. 결론이
 * 같다고 접은 것이므로, 그 근거는 같은 이야기의 재료다.
 *
 * ⚠️ 다른 축 근거는 넣지 않는다 — 카드가 말하는 주제가 흐려진다.
 * ⚠️ LENS는 넣지 않는다 — 핵심 문장의 근거가 될 수 없고, 핵심 스캐너가 렌즈 어휘를 전부 막는다.
 * ⚠️ Top 3 순서·Candidate 근거 목록(근거 토글)은 바꾸지 않는다. 이 목록은 AI 입력과 부분집합 검증용이다.
 */
export function supportingRefsFor(
  candidate: { primaryAxis: MirrorAxisKey | null; evidenceRefs: readonly EvidenceRef[] },
  insights: readonly Pick<CrossSourceInsight, 'axis' | 'evidenceRefs'>[],
): EvidenceRef[] {
  const pool = [
    ...candidate.evidenceRefs,
    ...(candidate.primaryAxis
      ? insights
          .filter((insight) => (insight.axis ?? null) === candidate.primaryAxis)
          .flatMap((insight) => insight.evidenceRefs)
      : []),
  ];
  const kept: EvidenceRef[] = [];
  for (const ref of pool) {
    if (evidenceFamilyOf(ref.source) === 'LENS') continue;
    if (refsWithinAllowed([ref], kept)) continue;
    kept.push(ref);
  }
  return kept;
}

export interface OperatorEvidenceShape {
  /** 이 카드에 실린 근거 family (LENS 제외) — EVENT는 장면이 실렸을 때만 */
  families: ReadonlySet<EvidenceSourceFamily>;
  /** 이 카드에 실린 장면 수 */
  eventCount: number;
  /** 사용자가 이미 아는 자기 설명(말한 기준)이 있는가 */
  hasKnownSelf: boolean;
}

const REACTION_FAMILIES: readonly EvidenceSourceFamily[] = ['EVENT', 'EXPERIENCE', 'CURRENT_RELATIONSHIP'];
const PAST_FAMILIES: readonly EvidenceSourceFamily[] = ['EXPERIENCE', 'HISTORY'];
const SELF_FAMILIES: readonly EvidenceSourceFamily[] = ['DECLARED_SELF', 'CURRENT_RELATIONSHIP'];
const CONTEXT_FAMILIES: readonly EvidenceSourceFamily[] = ['EVENT', 'CURRENT_RELATIONSHIP', 'EXPERIENCE', 'HISTORY'];

const hasAny = (set: ReadonlySet<EvidenceSourceFamily>, list: readonly EvidenceSourceFamily[]) =>
  list.some((family) => set.has(family));

/**
 * §10 — **근거 조합이 허용하는 해석 틀.** 모델에는 이 목록만 간다.
 *
 * ⚠️ UNRESOLVED_CORE는 항상 있다. 근거가 얇을 때 멋진 결론을 만들지 않고 '아직 무엇이
 * 구분되지 않았는가'를 말하는 것도 유효한 결과다(§9-6).
 */
export function eligibleOperatorsFor(shape: OperatorEvidenceShape): InsightOperator[] {
  const { families, eventCount, hasKnownSelf } = shape;
  const eligible: InsightOperator[] = [];
  if (hasKnownSelf && hasAny(families, CONTEXT_FAMILIES)) eligible.push('CONDITION_NARROWING');
  if (families.has('DECLARED_SELF') && hasAny(families, REACTION_FAMILIES)) eligible.push('DECLARED_VS_REACTION');
  if (families.has('CURRENT_RELATIONSHIP') && hasAny(families, PAST_FAMILIES)) eligible.push('CURRENT_VS_PAST');
  if (eventCount >= 2) eligible.push('CONTEXT_DEPENDENT');
  if (families.has('TARGET') && hasAny(families, SELF_FAMILIES)) eligible.push('SELF_VS_TARGET');
  eligible.push('UNRESOLVED_CORE');
  return eligible;
}

/**
 * §10 · §12 — 모델이 고른 틀을 **실제로 인용한 근거**가 지지하는가.
 *
 * ⚠️ eligible 목록은 '실린 근거'로 계산하고, 이 검사는 '쓴 근거'로 한다. 둘을 나누지 않으면
 * 모델이 SELF_VS_TARGET을 고르고 상대 근거는 한 줄도 인용하지 않는 문장이 통과한다.
 * ⚠️ UNRESOLVED_CORE를 뺀 틀은 **두 family 이상**을 이어야 한다 — 한 출처만으로 '새 발견'을
 * 만들지 않는다(§12).
 */
export function operatorSatisfied(
  operator: InsightOperator,
  used: { families: ReadonlySet<EvidenceSourceFamily>; eventCount: number },
): boolean {
  const { families, eventCount } = used;
  if (operator === 'UNRESOLVED_CORE') return true;
  if (families.size < 2) return false;
  switch (operator) {
    case 'CONDITION_NARROWING':
      return hasAny(families, CONTEXT_FAMILIES);
    case 'DECLARED_VS_REACTION':
      return families.has('DECLARED_SELF') && hasAny(families, REACTION_FAMILIES);
    case 'CURRENT_VS_PAST':
      return families.has('CURRENT_RELATIONSHIP') && hasAny(families, PAST_FAMILIES);
    case 'CONTEXT_DEPENDENT':
      return eventCount >= 2;
    case 'SELF_VS_TARGET':
      return families.has('TARGET') && hasAny(families, SELF_FAMILIES);
  }
}

/** 인용한 근거·장면의 family 집합 (LENS 제외) */
export function usedFamiliesOf(
  refs: readonly EvidenceRef[],
  eventIds: readonly string[],
): Set<EvidenceSourceFamily> {
  const families = new Set<EvidenceSourceFamily>();
  for (const ref of refs) {
    const family = evidenceFamilyOf(ref.source);
    if (family !== 'LENS') families.add(family);
  }
  if (eventIds.length > 0) families.add('EVENT');
  return families;
}
