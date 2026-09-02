import { PROMPT_VERSIONS } from '@/services/ai/promptVersions';
import {
  evidenceRefsAreSubsetOf,
  filterSafeItems,
  scanCoreNarrative,
  scanDeepNarrative,
  scanHistoryNarrative,
} from '@/services/ai/safety';
import {
  applyObservedBusinessRules,
  attachRuleStates,
  parseCompatibilityResponse,
  parseDeepReportResponse,
  parseHistoryResponse,
  parseObservedResponse,
  parseRelationshipResponse,
} from '@/services/ai/schemas';
import type { EvidenceRef, MirrorAxisKey, MirrorState } from '@/types';

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

    const withStates = attachRuleStates(parsed.narratives, stateByAxis);
    const scan = filterSafeItems(
      withStates,
      (item) => `${item.headline} ${item.explanation} ${item.question ?? ''}`,
      scanCoreNarrative,
    );

    let core = parsed.core;
    if (core) {
      const coreScan = filterSafeItems(
        [core],
        (item) => `${item.headline} ${item.summary}`,
        scanCoreNarrative,
      );
      core = coreScan.items[0] ?? null;
    }

    return Response.json({
      ok: true,
      promptVersion: PROMPT_VERSIONS.relationship,
      narratives: scan.items.map((item) => ({
        axis: item.axis,
        state: item.state,
        headlineLength: item.headline.length,
        explanationLength: item.explanation.length,
        evidenceCount: item.evidenceRefs.length,
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

    const parsed = parseCompatibilityResponse(raw, allowed);
    const scan = filterSafeItems(
      parsed,
      (item) => `${item.explanation} ${item.scenario} ${item.conversationQuestion ?? ''}`,
      scanCoreNarrative,
    );

    return Response.json({
      ok: true,
      promptVersion: PROMPT_VERSIONS.compatibility,
      narratives: scan.items.map((item) => ({
        key: item.dimensionKey,
        kind: item.kind,
        explanationLength: item.explanation.length,
        scenarioLength: item.scenario.length,
        evidenceCount: item.evidenceRefs.length,
        hasUncertainty: Boolean(item.uncertainty),
      })),
      violations: scan.violations,
    });
  }

  if (task === 'history-insight') {
    const allowed = (Array.isArray(body.allowed) ? body.allowed : []) as never;

    const parsed = parseHistoryResponse(raw, allowed);
    const scan = filterSafeItems(
      parsed,
      (item) => `${item.explanation} ${item.uncertainty ?? ''}`,
      scanHistoryNarrative,
    );

    return Response.json({
      ok: true,
      promptVersion: PROMPT_VERSIONS.history,
      narratives: scan.items.map((item) => ({
        axis: item.axis,
        state: item.state,
        explanationLength: item.explanation.length,
        evidenceCount: item.evidenceRefs.length,
        hasUncertainty: Boolean(item.uncertainty),
      })),
      violations: scan.violations,
    });
  }

  if (task === 'deep-report-narrative') {
    const insights = (Array.isArray(body.allowed) ? body.allowed : []) as Array<{
      id: string;
      evidenceRefs: EvidenceRef[];
    }>;
    const allowedIds = insights.map((item) => item.id);
    const evidenceByInsight = new Map(insights.map((item) => [item.id, item.evidenceRefs]));

    const parsed = parseDeepReportResponse(raw, allowedIds);
    // §26(E) — 원래 Insight에 없던 evidenceRef를 들고 오면 그 항목 전체를 버린다.
    const refChecked = parsed.filter((item) =>
      evidenceRefsAreSubsetOf(item.evidenceRefs, evidenceByInsight.get(item.insightId) ?? []),
    );
    const scan = filterSafeItems(
      refChecked,
      (item) =>
        `${item.headline} ${item.interpretation} ${item.situation ?? ''} ${item.conversationQuestion ?? ''}`,
      scanDeepNarrative,
    );

    return Response.json({
      ok: true,
      promptVersion: PROMPT_VERSIONS.deepReport,
      narratives: scan.items.map((item) => ({
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
