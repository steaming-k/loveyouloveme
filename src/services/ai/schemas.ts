import { AXIS_DEFINITIONS } from '@/data/axes';
import { MIRROR_AXES } from '@/data/axes';
import { clampNarrativeText } from './safety';
import type {
  AiObservedTrait,
  CompatibilityNarrative,
  Confidence,
  CoreInsightNarrative,
  EvidenceRef,
  HistoryNarrative,
  ImageEvidence,
  MirrorAxisKey,
  MirrorState,
  ObservedCategory,
  RelationshipNarrative,
  TargetAxisKey,
} from '@/types';

/**
 * AI 응답 검증 (§37 · §38)
 *
 * 파이프라인: Provider → **Schema Parse** → **Business Validation** → UI
 *
 * 프로젝트에 zod 같은 런타임 validation 라이브러리가 없고(의존성 0을 유지해 왔다),
 * 기존 코드도 `historyRepository.isEntry()` · `validateBirthDate()`처럼 손으로 검증한다.
 * 같은 방식을 따른다.
 *
 * ⚠️ Schema만 통과했다고 쓰지 않는다. '스키마는 맞지만 제품 규칙을 위반한' 응답을
 * Business Validation에서 버린다 — 예: confidence=high인데 evidence가 비어 있음.
 */

/* ------------------------------------------------------------- 원시 검증 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, maxLength = 400): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

const CONFIDENCES: readonly Confidence[] = ['low', 'medium', 'high'];
const CATEGORIES: readonly ObservedCategory[] = ['interest', 'activity', 'social', 'lifestyle'];
const EVIDENCE_SOURCES = [
  'declared',
  'relationship',
  'adaptive',
  'observed',
  'history',
  'target',
  'deep_followup',
] as const;

const MIRROR_AXIS_KEYS: readonly MirrorAxisKey[] = MIRROR_AXES.map((axis) => axis.key);
const TARGET_AXIS_KEYS: readonly TargetAxisKey[] = AXIS_DEFINITIONS.map((axis) => axis.key);

/** trait 최대 개수 — 개수를 채우려고 약한 관찰을 만들지 못하게 상한만 둔다(§61) */
export const MAX_OBSERVED_TRAITS = 6;

/**
 * 화면별 표시 길이 상한 (v1.7 · §37)
 *
 * ⚠️ 스키마 파싱 상한(`str()`의 maxLength)과 **다른 목적**이다.
 * 파싱 상한은 '이건 응답이 아니다' 수준의 거부선이고, 이 값은 '화면에 이 정도만 보여준다'는
 * 표시 상한이다. 길다는 이유로 근거 있는 설명을 버리지 않고 `clampNarrativeText`로 줄인다.
 */
export const NARRATIVE_LIMITS = {
  compatibilityExplanation: 180,
  compatibilityScenario: 180,
  compatibilityQuestion: 120,
  /** S27은 Mirror Map이 주인공이다 — 축마다 긴 에세이를 붙이지 않는다(§21) */
  relationshipExplanation: 120,
  relationshipHeadline: 80,
  relationshipQuestion: 120,
  coreHeadline: 60,
  coreSummary: 240,
  historySummary: 220,
  uncertainty: 140,
  /** v1.9 — Deep Report Cross-source Insight 카드 */
  deepHeadline: 70,
  deepInterpretation: 260,
  deepSituation: 220,
  deepQuestion: 140,
} as const;

/* ------------------------------------------------------ EvidenceRef */

function parseEvidenceRef(raw: unknown): EvidenceRef | null {
  if (!isObject(raw)) return null;
  const source = oneOf(raw.source, EVIDENCE_SOURCES);
  if (!source) return null;

  if (source === 'observed') {
    const traitId = str(raw.traitId ?? raw.field, 80);
    return traitId ? { source, traitId } : null;
  }
  if (source === 'history') {
    const entryId = str(raw.entryId ?? raw.field, 80);
    const axis = str(raw.axis, 40);
    return entryId && axis ? { source, entryId, axis } : null;
  }
  if (source === 'deep_followup') {
    const questionId = str(raw.questionId ?? raw.field, 80);
    return questionId ? { source, questionId } : null;
  }
  const field = str(raw.field, 80);
  return field ? { source, field } : null;
}

function parseEvidenceRefs(raw: unknown): EvidenceRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseEvidenceRef).filter((ref): ref is EvidenceRef => ref !== null);
}

/* --------------------------------------------------- Observed Profile */

export interface ParsedObservedResponse {
  traits: Omit<AiObservedTrait, 'id'>[];
  usableImageCount: number;
  limitations: string[];
}

/**
 * @param allowedImageIds 입력으로 보낸 imageId만 허용한다 — AI가 id를 만들어내면 버린다.
 */
export function parseObservedResponse(
  raw: unknown,
  allowedImageIds: readonly string[],
): ParsedObservedResponse | null {
  if (!isObject(raw) || !Array.isArray(raw.traits)) return null;

  const allowed = new Set(allowedImageIds);
  const traits: Omit<AiObservedTrait, 'id'>[] = [];

  for (const item of raw.traits) {
    if (!isObject(item)) continue;

    const category = oneOf(item.category, CATEGORIES);
    const label = str(item.label, 40);
    const observation = str(item.observation, 300);
    const confidence = oneOf(item.confidence, CONFIDENCES);
    if (!category || !label || !observation || !confidence) continue;

    const evidence: ImageEvidence[] = [];
    if (Array.isArray(item.evidence)) {
      for (const entry of item.evidence) {
        if (!isObject(entry)) continue;
        const imageId = str(entry.imageId, 80);
        const description = str(entry.description, 300);
        // 존재하지 않는 imageId를 참조하는 evidence는 버린다.
        if (!imageId || !description || !allowed.has(imageId)) continue;
        evidence.push({ imageId, description });
      }
    }

    // §10 — Evidence 없는 Trait은 노출하지 않는다. real 모드에서는 여기서 탈락.
    if (evidence.length === 0) continue;

    traits.push({ category, label, observation, evidence, confidence });
  }

  const usableRaw = Number(raw.usableImageCount);
  const usableImageCount = Number.isFinite(usableRaw)
    ? Math.max(0, Math.min(allowedImageIds.length, Math.floor(usableRaw)))
    : 0;

  const limitations = Array.isArray(raw.limitations)
    ? raw.limitations.map((item) => str(item, 300)).filter((item): item is string => item !== null)
    : [];

  return { traits: traits.slice(0, MAX_OBSERVED_TRAITS), usableImageCount, limitations };
}

/**
 * Business Validation (§38) — 스키마는 맞지만 제품 규칙을 위반한 응답을 정리한다.
 * 버리지 않고 **강등**시키는 게 맞는 경우는 강등한다(예: 근거 1개인데 high).
 */
export function applyObservedBusinessRules(
  parsed: ParsedObservedResponse,
): ParsedObservedResponse {
  const traits = parsed.traits.map((trait) => {
    // 근거 1개짜리 강한 결론을 허용하지 않는다 — 사진 1장으로 단정 금지(§7).
    if (trait.confidence === 'high' && trait.evidence.length < 2) {
      return { ...trait, confidence: 'medium' as Confidence };
    }
    return trait;
  });

  // 사용 가능 이미지가 evidence로 실제 참조된 수보다 적다고 주장하면 실측치로 보정한다.
  const referenced = new Set(traits.flatMap((t) => t.evidence.map((e) => e.imageId)));
  const usableImageCount = Math.max(parsed.usableImageCount, referenced.size);

  return { ...parsed, traits, usableImageCount };
}

/* ------------------------------------------------- Relationship / Core */

export interface ParsedRelationshipResponse {
  narratives: Array<Omit<RelationshipNarrative, 'state'> & { axis: MirrorAxisKey }>;
  core: Omit<CoreInsightNarrative, 'axis'> | null;
}

/**
 * @param allowedAxes 규칙이 판정한 축만 허용한다.
 *   AI가 판정되지 않은 축을 추가하거나 state를 바꿔 보내면 버린다(§18).
 */
export function parseRelationshipResponse(
  raw: unknown,
  allowedAxes: readonly MirrorAxisKey[],
): ParsedRelationshipResponse | null {
  if (!isObject(raw)) return null;

  const allowed = new Set(allowedAxes);
  const narratives: ParsedRelationshipResponse['narratives'] = [];

  if (Array.isArray(raw.narratives)) {
    for (const item of raw.narratives) {
      if (!isObject(item)) continue;
      const axis = oneOf(item.axis, MIRROR_AXIS_KEYS);
      const headline = str(item.headline, 200);
      const explanation = str(item.explanation, 600);
      if (!axis || !allowed.has(axis) || !headline || !explanation) continue;

      const evidenceRefs = parseEvidenceRefs(item.evidenceRefs);
      const uncertainty = str(item.uncertainty, 300) ?? undefined;

      // §91 — 강한 결론 + 근거 없음은 버린다. uncertainty를 밝힌 경우만 통과.
      if (evidenceRefs.length === 0 && !uncertainty) continue;

      const question = str(item.question, 200);

      narratives.push({
        axis,
        headline: clampNarrativeText(headline, NARRATIVE_LIMITS.relationshipHeadline),
        explanation: clampNarrativeText(explanation, NARRATIVE_LIMITS.relationshipExplanation),
        evidenceRefs,
        question: question
          ? clampNarrativeText(question, NARRATIVE_LIMITS.relationshipQuestion)
          : undefined,
        uncertainty: uncertainty
          ? clampNarrativeText(uncertainty, NARRATIVE_LIMITS.uncertainty)
          : undefined,
      });
    }
  }

  let core: ParsedRelationshipResponse['core'] = null;
  if (isObject(raw.core)) {
    const headline = str(raw.core.headline, 240);
    const summary = str(raw.core.summary, 400);
    const evidenceRefs = parseEvidenceRefs(raw.core.evidenceRefs);
    if (headline && summary && evidenceRefs.length > 0) {
      core = {
        headline: clampNarrativeText(headline, NARRATIVE_LIMITS.coreHeadline),
        summary: clampNarrativeText(summary, NARRATIVE_LIMITS.coreSummary),
        evidenceRefs,
        limitations: Array.isArray(raw.core.limitations)
          ? raw.core.limitations
              .map((item) => str(item, 300))
              .filter((item): item is string => item !== null)
          : [],
      };
    }
  }

  return { narratives, core };
}

/* --------------------------------------------------- Compatibility */

export function parseCompatibilityResponse(
  raw: unknown,
  allowed: readonly { key: TargetAxisKey; kind: 'good' | 'friction' }[],
): CompatibilityNarrative[] {
  if (!isObject(raw) || !Array.isArray(raw.narratives)) return [];

  const allowedMap = new Map(allowed.map((item) => [item.key, item.kind]));
  const result: CompatibilityNarrative[] = [];

  for (const item of raw.narratives) {
    if (!isObject(item)) continue;
    const dimensionKey = oneOf(item.dimensionKey, TARGET_AXIS_KEYS);
    const explanation = str(item.explanation, 600);
    const scenario = str(item.scenario, 600);
    if (!dimensionKey || !explanation || !scenario) continue;

    // 현재 궁합 결과에 없는 축은 버린다(§38 예시).
    const expectedKind = allowedMap.get(dimensionKey);
    if (!expectedKind) continue;

    const question = str(item.conversationQuestion, 200);
    const evidenceRefs = parseEvidenceRefs(item.evidenceRefs);
    const uncertainty = str(item.uncertainty, 300);

    // §13 — AI 문장은 Evidence 또는 uncertainty 중 하나를 반드시 동반한다.
    if (evidenceRefs.length === 0 && !uncertainty) continue;

    result.push({
      dimensionKey,
      // kind도 규칙이 정한 값을 쓴다 — AI가 good/friction을 뒤집지 못한다.
      kind: expectedKind,
      explanation: clampNarrativeText(explanation, NARRATIVE_LIMITS.compatibilityExplanation),
      scenario: clampNarrativeText(scenario, NARRATIVE_LIMITS.compatibilityScenario),
      conversationQuestion: question
        ? clampNarrativeText(question, NARRATIVE_LIMITS.compatibilityQuestion)
        : undefined,
      evidenceRefs,
      uncertainty: uncertainty
        ? clampNarrativeText(uncertainty, NARRATIVE_LIMITS.uncertainty)
        : undefined,
    });
  }

  return result;
}

/* -------------------------------------------------------- History */

export function parseHistoryResponse(
  raw: unknown,
  allowed: readonly { axis: MirrorAxisKey; state: HistoryNarrative['state'] }[],
): HistoryNarrative[] {
  if (!isObject(raw) || !Array.isArray(raw.narratives)) return [];

  const allowedMap = new Map(allowed.map((item) => [item.axis, item.state]));
  const result: HistoryNarrative[] = [];

  for (const item of raw.narratives) {
    if (!isObject(item)) continue;
    const axis = oneOf(item.axis, MIRROR_AXIS_KEYS);
    const explanation = str(item.explanation, 600);
    if (!axis || !explanation) continue;

    const state = allowedMap.get(axis);
    if (!state) continue;

    const evidenceRefs = parseEvidenceRefs(item.evidenceRefs);
    const uncertainty = str(item.uncertainty, 300);

    // §13 — 근거도 한계도 없는 변화 해석은 버린다. History는 특히 단정하기 쉬운 영역이다.
    if (evidenceRefs.length === 0 && !uncertainty) continue;

    result.push({
      axis,
      state,
      explanation: clampNarrativeText(explanation, NARRATIVE_LIMITS.historySummary),
      evidenceRefs,
      uncertainty: uncertainty
        ? clampNarrativeText(uncertainty, NARRATIVE_LIMITS.uncertainty)
        : undefined,
    });
  }

  return result;
}

/* ------------------------------------------------- Deep Report (v1.9) */

/**
 * @param allowedInsightIds AI가 설명해도 되는 Insight id만 허용한다. 이 Task 하나가
 *   여러 insight의 설명을 한 번에 만든다(§40 Performance — insight마다 별도 요청 안 함).
 */
export function parseDeepReportResponse(
  raw: unknown,
  allowedInsightIds: readonly string[],
): { insightId: string; headline: string; interpretation: string; situation?: string; uncertainty?: string; conversationQuestion?: string; evidenceRefs: EvidenceRef[] }[] {
  if (!isObject(raw) || !Array.isArray(raw.narratives)) return [];

  const allowed = new Set(allowedInsightIds);
  const seen = new Set<string>();
  const result: ReturnType<typeof parseDeepReportResponse> = [];

  for (const item of raw.narratives) {
    if (!isObject(item)) continue;
    const insightId = str(item.insightId, 60);
    // 같은 insight를 두 번 설명하지 않는다 — AI가 만들어낸 id/판정되지 않은 id는 버린다.
    if (!insightId || !allowed.has(insightId) || seen.has(insightId)) continue;

    const headline = str(item.headline, 200);
    const interpretation = str(item.interpretation, 500);
    if (!headline || !interpretation) continue;

    const evidenceRefs = parseEvidenceRefs(item.evidenceRefs);
    const uncertainty = str(item.uncertainty, 300);

    // §13 — 근거도 한계도 없으면 버린다. Cross-source Insight는 특히 근거 2개 이상을 기대한다.
    if (evidenceRefs.length === 0 && !uncertainty) continue;

    seen.add(insightId);
    result.push({
      insightId,
      headline: clampNarrativeText(headline, NARRATIVE_LIMITS.deepHeadline),
      interpretation: clampNarrativeText(interpretation, NARRATIVE_LIMITS.deepInterpretation),
      situation: (() => {
        const s = str(item.situation, 400);
        return s ? clampNarrativeText(s, NARRATIVE_LIMITS.deepSituation) : undefined;
      })(),
      uncertainty: uncertainty
        ? clampNarrativeText(uncertainty, NARRATIVE_LIMITS.uncertainty)
        : undefined,
      conversationQuestion: (() => {
        const q = str(item.conversationQuestion, 200);
        return q ? clampNarrativeText(q, NARRATIVE_LIMITS.deepQuestion) : undefined;
      })(),
      evidenceRefs,
    });
  }

  return result;
}

/** Mirror State는 규칙 값으로 덮어쓴다 — AI 응답의 state를 신뢰하지 않는다(§18) */
export function attachRuleStates(
  narratives: ParsedRelationshipResponse['narratives'],
  stateByAxis: ReadonlyMap<MirrorAxisKey, MirrorState>,
): RelationshipNarrative[] {
  return narratives
    .map((narrative) => {
      const state = stateByAxis.get(narrative.axis);
      return state ? { ...narrative, state } : null;
    })
    .filter((item): item is RelationshipNarrative => item !== null);
}
