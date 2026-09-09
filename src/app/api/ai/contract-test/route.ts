import {
  aggregatePhotoObservations,
  groupDuplicateLikePhotos,
  repeatedSignals,
} from '@/lib/logic/observedSignals';
import { sanitizePhotoObservation } from '@/services/ai/handlers';
import { PROMPT_VERSIONS } from '@/services/ai/promptVersions';
import {
  applyOutwardQuestionGate,
  filterSafeItems,
  isRedundantNarrative,
  scanCompatibilityNarrative,
  scanDeepNarrativeWithTense,
  scanHistoryNarrative,
  scanRelationshipNarrative,
} from '@/services/ai/safety';
/** v1.43 §46 — 네 Task가 공유하는 근거 귀속 술어 */
import { refsWithinAllowed, rejectedRefSources } from '@/lib/logic/allowedEvidence';
import {
  applyObservedBusinessRules,
  attachRuleStates,
  parseCompatibilityResponse,
  parseDeepReportResponse,
  parseHistoryResponse,
  parseObservedResponse,
  parsePhotoObservationResponse,
  parseRelationshipResponse,
} from '@/services/ai/schemas';
import type { EvidenceRef, MirrorAxisKey, MirrorState, PhotoObservation } from '@/types';

/**
 * POST /api/ai/contract-test — **개발 전용** AI Contract Test 실행기 (v1.7 · §55 · §56)
 *
 * Provider Key 없이도 검증 로직의 회귀를 잡기 위한 장치다.
 * `tests/fixtures/ai/*.json`의 응답을 **실제 파싱·Business Validation·Safety Scan에**
 * 그대로 통과시키고 결과를 돌려준다 — 검증 로직을 테스트용으로 복제하지 않는다.
 * (검증 로직을 두 벌 만들면 테스트가 실제 동작을 보증하지 못한다.)
 *
 * ⚠️ Production에서는 404다. Provider를 호출하지 않고 Key도 읽지 않는다.
 */
export const runtime = 'nodejs';

interface ContractRequest {
  task?: unknown;
  raw?: unknown;
  allowedImageIds?: unknown;
  allowed?: unknown;
  judgements?: unknown;
  focusAxis?: unknown;
  /** v1.10 — 사진 1장 관찰 fixture용 */
  photoId?: unknown;
  /** v1.10 — Cross-photo Aggregation fixture용 (Provider 없이 규칙만 검증한다) */
  observations?: unknown;
  /** v1.42 — relationship 시제 fixture용. 없으면 `'current'` (§40.16) */
  tense?: unknown;
  /** v1.42 §41.11 — Ended Job Safety fixture용. 없으면 `true`(기존 fixture 호환) */
  allowsOutwardQuestions?: unknown;
  /**
   * v1.43 §46 — 근거 귀속 fixture용. `{ [axis|dimensionKey|insightId]: EvidenceRef[] }`.
   *
   * ⚠️ **없으면 그 검사를 건너뛴다**(응답의 `evidenceContract: 'skipped'`). 실서비스
   * 라우트는 없으면 400이고, 이건 v1.42까지의 fixture 30여 개를 그대로 돌리기 위한
   * dev 검증기 전용 호환 경로다.
   */
  allowedEvidenceRefs?: unknown;
}

function notFound(): Response {
  return new Response(JSON.stringify({ ok: false, reason: 'NOT_FOUND' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') return notFound();

  const body = (await request.json().catch(() => null)) as ContractRequest | null;
  if (!body || typeof body.task !== 'string') {
    return Response.json({ ok: false, reason: 'INVALID_INPUT' }, { status: 400 });
  }

  const { task, raw } = body;

  /* ---------------------------- v1.10 사진 1장 관찰 (§3 · §9 · §10) */
  if (task === 'observed-photo-analysis') {
    const photoId = typeof body.photoId === 'string' ? body.photoId : 'p1';

    const parsed = parsePhotoObservationResponse(raw, photoId);
    if (!parsed) return Response.json({ ok: true, rejected: 'INVALID_OUTPUT' });

    // 실제 서버 경로와 **같은 함수**를 쓴다 — 검증 로직을 테스트용으로 복제하지 않는다.
    const { observation, violations } = sanitizePhotoObservation(parsed);

    return Response.json({
      ok: true,
      promptVersion: PROMPT_VERSIONS.observed,
      photoId: observation.photoId,
      usable: observation.usable,
      scenes: observation.scenes.map((item) => item.label),
      activities: observation.activities.map((item) => item.label),
      objects: observation.objects.map((item) => item.label),
      environment: (observation.environment ?? []).map((item) => item.label),
      hasEvidenceSummary: observation.evidenceSummary.length > 0,
      violations,
    });
  }

  /* -------------- v1.10 Cross-photo Aggregation (§4 · §5) — 규칙만 돈다 */
  if (task === 'observed-photo-aggregation') {
    const observations = (Array.isArray(body.observations)
      ? body.observations
      : []) as PhotoObservation[];

    const signals = aggregatePhotoObservations(observations);

    return Response.json({
      ok: true,
      signals: signals.map((signal) => ({
        category: signal.category,
        label: signal.label,
        occurrenceCount: signal.occurrenceCount,
        photoCount: signal.photoIds.length,
        strength: signal.strength,
        hasDuplicateLikePhotos: signal.hasDuplicateLikePhotos,
        evidenceCount: signal.evidence.length,
      })),
      repeatedSignalCount: repeatedSignals(signals).length,
      duplicateLikeGroups: groupDuplicateLikePhotos(observations).length,
    });
  }

  if (task === 'observed-profile') {
    const allowedImageIds = Array.isArray(body.allowedImageIds)
      ? (body.allowedImageIds as string[])
      : [];

    const parsed = parseObservedResponse(raw, allowedImageIds);
    if (!parsed) return Response.json({ ok: true, rejected: 'INVALID_OUTPUT', traits: [] });

    const validated = applyObservedBusinessRules(parsed);
    const scan = filterSafeItems(
      validated.traits,
      (trait) =>
        `${trait.label} ${trait.observation} ${trait.evidence.map((e) => e.description).join(' ')}`,
    );

    return Response.json({
      ok: true,
      promptVersion: PROMPT_VERSIONS.observed,
      traits: scan.items.map((trait) => ({
        label: trait.label,
        confidence: trait.confidence,
        evidenceCount: trait.evidence.length,
      })),
      usableImageCount: validated.usableImageCount,
      violations: scan.violations,
    });
  }

  if (task === 'relationship-insight') {
    const judgements = (Array.isArray(body.judgements) ? body.judgements : []) as Array<{
      axis: MirrorAxisKey;
      state: MirrorState;
    }>;
    const allowedAxes = judgements.map((item) => item.axis);
    const stateByAxis = new Map(judgements.map((item) => [item.axis, item.state]));
    const focusAxis = typeof body.focusAxis === 'string' ? (body.focusAxis as MirrorAxisKey) : null;

    const parsed = parseRelationshipResponse(raw, allowedAxes);
    if (!parsed) {
      return Response.json({ ok: true, rejected: 'INVALID_OUTPUT', narratives: [] });
    }

    /**
     * v1.42 §40.16 — fixture가 시제를 지정한다. 없으면 `'current'`다.
     *
     * ⚠️ **여기의 기본값은 실서비스 라우트의 기본값과 다른 성질이다.** 실제
     * `/api/ai/relationship-insight`는 `tense`가 없으면 400이다(§40.8). 이쪽은 Provider를
     * 부르지 않는 **응답 검증기**이고, v1.41 이전에 쓴 기존 fixture 30개가 `tense`를
     * 갖고 있지 않다 — 그것들이 계속 `current` 기준으로 통과해야 회귀 기준이 유지된다.
     * dev 전용(Production 404) 도구의 fixture 호환성이고, 사용자 요청 경로가 아니다.
     */
    const tense = body.tense === 'former' ? 'former' : 'current';
    /**
     * v1.42 §41.11 — 기존 fixture 30여 개가 이 값을 갖고 있지 않으므로 `true`가 기본이다.
     * 실서비스 라우트는 boolean이 아니면 **400**이다(§41.8) — dev 전용 검증기의
     * fixture 호환성이고 사용자 요청 경로가 아니다.
     */
    const allowsOutwardQuestions = body.allowsOutwardQuestions !== false;

    const withStates = attachRuleStates(parsed.narratives, stateByAxis);
    // 실제 핸들러와 **같은 함수**를 쓴다 — 검사 로직을 테스트용으로 복제하지 않는다.
    const scanNarrative = (text: string) => scanRelationshipNarrative(text, tense);

    /**
     * v1.43 §46.2 — **axis별 근거 귀속 검사.** 핸들러와 같은 술어(`refsWithinAllowed`)를
     * 쓴다.
     *
     * ⚠️ fixture가 `allowedEvidenceRefs`를 주지 않으면 **검사를 건너뛴다.** v1.42까지의
     * fixture 30여 개는 이 값을 갖고 있지 않고, 그 fixture들이 검증하는 것은 시제·게이트·
     * 스키마다 — 근거 계약 fixture(R0~R7)만 이 값을 준다. 실서비스 라우트는 없으면
     * **400**이다(§46.2): dev 검증기의 fixture 호환성이고 사용자 요청 경로가 아니다.
     */
    const allowedRefsByAxis = (
      body.allowedEvidenceRefs && typeof body.allowedEvidenceRefs === 'object'
        ? body.allowedEvidenceRefs
        : null
    ) as Record<string, EvidenceRef[]> | null;

    const relRejectedRefs: string[] = [];
    const refChecked = allowedRefsByAxis
      ? withStates.filter((item) => {
          const allowed = allowedRefsByAxis[item.axis] ?? [];
          if (refsWithinAllowed(item.evidenceRefs, allowed)) return true;
          relRejectedRefs.push(...rejectedRefSources(item.evidenceRefs, allowed));
          return false;
        })
      : withStates;

    // 핸들러와 같은 순서 · 같은 함수 — 게이트가 안전 검사 **앞**이다(§41.9)
    const gated = applyOutwardQuestionGate(refChecked, allowsOutwardQuestions, 'question');

    const scan = filterSafeItems(
      gated,
      (item) => `${item.headline} ${item.explanation} ${item.question ?? ''}`,
      scanNarrative,
    );

    let core = parsed.core;
    if (core) {
      const coreScan = filterSafeItems(
        [core],
        (item) => `${item.headline} ${item.summary} ${item.limitations.join(' ')}`,
        scanNarrative,
      );
      core = coreScan.items[0] ?? null;
    }

    return Response.json({
      ok: true,
      promptVersion: PROMPT_VERSIONS.relationship,
      tense,
      allowsOutwardQuestions,
      /** v1.43 §46.2 — 근거 귀속 검사 결과. fixture R0~R7이 이 두 값을 본다 */
      evidenceContract: allowedRefsByAxis ? 'axis-subset' : 'skipped',
      refChecked: refChecked.length,
      rejectedRefSources: relRejectedRefs,
      /** v1.42 §41.11 — 문자열 blacklist가 아니라 **존재 여부**를 검사하게 한다 */
      questionCount: scan.items.filter((item) => item.question !== undefined).length,
      narratives: scan.items.map((item) => ({
        axis: item.axis,
        state: item.state,
        headlineLength: item.headline.length,
        explanationLength: item.explanation.length,
        evidenceCount: item.evidenceRefs.length,
        hasQuestion: item.question !== undefined,
        /** v1.42 §41.5 — SOURCE PROVENANCE. 어떤 source가 살아남았는가 */
        evidenceSources: item.evidenceRefs.map((ref) => ref.source),
      })),
      core: core
        ? {
            axis: focusAxis,
            headlineLength: core.headline.length,
            summaryLength: core.summary.length,
            evidenceCount: core.evidenceRefs.length,
          }
        : null,
      violations: scan.violations,
    });
  }

  if (task === 'compatibility-narrative') {
    const allowed = (Array.isArray(body.allowed) ? body.allowed : []) as never;

    /**
     * v1.43 §47.1 — 기존 fixture는 `tense`를 갖고 있지 않으므로 `'current'`가 기본이다.
     * 실서비스 라우트는 `'current'|'former'`가 아니면 **400**이다.
     */
    const tense = body.tense === 'former' ? 'former' : 'current';
    /** v1.43 §47.2 — 기존 fixture 호환. 실서비스 라우트는 boolean이 아니면 400이다 */
    const allowsOutwardQuestions = body.allowsOutwardQuestions !== false;

    const parsed = parseCompatibilityResponse(raw, allowed);

    /** v1.43 §46.3 — dimension별 근거 귀속 검사. 핸들러와 같은 술어 */
    const allowedRefsByDimension = (
      body.allowedEvidenceRefs && typeof body.allowedEvidenceRefs === 'object'
        ? body.allowedEvidenceRefs
        : null
    ) as Record<string, EvidenceRef[]> | null;

    const cmpRejectedRefs: string[] = [];
    const cmpRefChecked = allowedRefsByDimension
      ? parsed.filter((item) => {
          const allowedRefs = allowedRefsByDimension[item.dimensionKey] ?? [];
          if (refsWithinAllowed(item.evidenceRefs, allowedRefs)) return true;
          cmpRejectedRefs.push(...rejectedRefSources(item.evidenceRefs, allowedRefs));
          return false;
        })
      : parsed;

    // 핸들러와 같은 순서 — 게이트가 안전 검사 **앞**이다(§47.2)
    const gated = applyOutwardQuestionGate(
      cmpRefChecked,
      allowsOutwardQuestions,
      'conversationQuestion',
    );

    const scan = filterSafeItems(
      gated,
      (item) => `${item.explanation} ${item.scenario} ${item.conversationQuestion ?? ''}`,
      (text) => scanCompatibilityNarrative(text, tense),
    );

    return Response.json({
      ok: true,
      promptVersion: PROMPT_VERSIONS.compatibility,
      tense,
      allowsOutwardQuestions,
      evidenceContract: allowedRefsByDimension ? 'dimension-subset' : 'skipped',
      refChecked: cmpRefChecked.length,
      rejectedRefSources: cmpRejectedRefs,
      /** v1.43 §47.2 — 문자열 blacklist가 아니라 **존재 여부**를 검사하게 한다 */
      questionCount: scan.items.filter((item) => item.conversationQuestion !== undefined).length,
      narratives: scan.items.map((item) => ({
        key: item.dimensionKey,
        kind: item.kind,
        explanationLength: item.explanation.length,
        scenarioLength: item.scenario.length,
        evidenceCount: item.evidenceRefs.length,
        evidenceSources: item.evidenceRefs.map((ref) => ref.source),
        hasQuestion: item.conversationQuestion !== undefined,
        hasUncertainty: Boolean(item.uncertainty),
      })),
      violations: scan.violations,
    });
  }

  if (task === 'history-insight') {
    const allowed = (Array.isArray(body.allowed) ? body.allowed : []) as never;

    const parsed = parseHistoryResponse(raw, allowed);

    /** v1.43 §46.4 — axis별 근거 귀속 검사. 핸들러와 같은 술어 */
    const historyAllowedRefs = (
      body.allowedEvidenceRefs && typeof body.allowedEvidenceRefs === 'object'
        ? body.allowedEvidenceRefs
        : null
    ) as Record<string, EvidenceRef[]> | null;

    const hisRejectedRefs: string[] = [];
    const hisRefChecked = historyAllowedRefs
      ? parsed.filter((item) => {
          const allowedRefs = historyAllowedRefs[item.axis] ?? [];
          if (refsWithinAllowed(item.evidenceRefs, allowedRefs)) return true;
          hisRejectedRefs.push(...rejectedRefSources(item.evidenceRefs, allowedRefs));
          return false;
        })
      : parsed;

    const scan = filterSafeItems(
      hisRefChecked,
      (item) => `${item.explanation} ${item.uncertainty ?? ''}`,
      scanHistoryNarrative,
    );

    return Response.json({
      ok: true,
      promptVersion: PROMPT_VERSIONS.history,
      evidenceContract: historyAllowedRefs ? 'axis-subset' : 'skipped',
      refChecked: hisRefChecked.length,
      rejectedRefSources: hisRejectedRefs,
      narratives: scan.items.map((item) => ({
        axis: item.axis,
        state: item.state,
        explanationLength: item.explanation.length,
        evidenceCount: item.evidenceRefs.length,
        evidenceSources: item.evidenceRefs.map((ref) => ref.source),
        hasUncertainty: Boolean(item.uncertainty),
      })),
      violations: scan.violations,
    });
  }

  if (task === 'deep-report-narrative') {
    const insights = (Array.isArray(body.allowed) ? body.allowed : []) as Array<{
      id: string;
      evidenceRefs: EvidenceRef[];
      /** v1.27 — Quality Gate (F) 중복 판정 기준. fixture가 주지 않으면 검사하지 않는다 */
      ruleSummary?: string;
    }>;
    const allowedIds = insights.map((item) => item.id);
    const evidenceByInsight = new Map(insights.map((item) => [item.id, item.evidenceRefs]));

    const parsed = parseDeepReportResponse(raw, allowedIds);
    // §26(E) — 원래 Insight에 없던 evidenceRef를 들고 오면 그 항목 전체를 버린다.
    /** v1.43 §46.1 — 네 Task가 **같은 술어**를 쓴다(`refsWithinAllowed`). 판정은 같다 */
    const refChecked = parsed.filter((item) =>
      refsWithinAllowed(item.evidenceRefs, evidenceByInsight.get(item.insightId) ?? []),
    );
    /** v1.43 §47.5 — 기존 fixture 호환. 실서비스 라우트는 `'current'|'former'`가 아니면 400 */
    const deepTense = body.tense === 'former' ? 'former' : 'current';
    const scan = filterSafeItems(
      refChecked,
      (item) =>
        `${item.headline} ${item.interpretation} ${item.situation ?? ''} ${item.conversationQuestion ?? ''}`,
      (text) => scanDeepNarrativeWithTense(text, deepTense),
    );

    /**
     * Quality Gate (F) — 규칙 문장을 되풀이한 narrative는 버린다(v1.27 · §24).
     * 실제 핸들러와 **같은 함수**를 쓴다 — 판정 로직을 테스트용으로 복제하지 않는다.
     */
    const ruleSummaryById = new Map(insights.map((item) => [item.id, item.ruleSummary ?? '']));
    const novel = scan.items.filter(
      (item) => !isRedundantNarrative(item.interpretation, ruleSummaryById.get(item.insightId) ?? ''),
    );

    return Response.json({
      ok: true,
      promptVersion: PROMPT_VERSIONS.deepReport,
      tense: deepTense,
      redundantCount: scan.items.length - novel.length,
      narratives: novel.map((item) => ({
        insightId: item.insightId,
        headlineLength: item.headline.length,
        interpretationLength: item.interpretation.length,
        evidenceCount: item.evidenceRefs.length,
        hasUncertainty: Boolean(item.uncertainty),
      })),
      violations: scan.violations,
    });
  }

  return Response.json({ ok: false, reason: 'UNKNOWN_TASK' }, { status: 400 });
}
