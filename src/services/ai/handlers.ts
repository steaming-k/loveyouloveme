import 'server-only';

import {
  buildDemoObservedResult,
  buildEmptyObservedResult,
  buildMeta,
  evidenceCoverageLevel,
} from './fallback';
import { AiProviderError, resolveProvider, type ProviderImage } from './provider';
import {
  COMPATIBILITY_SYSTEM_PROMPT,
  DEEP_REPORT_SYSTEM_PROMPT,
  HISTORY_SYSTEM_PROMPT,
  OBSERVED_SYSTEM_PROMPT,
  PROMPT_VERSIONS,
  RELATIONSHIP_SYSTEM_PROMPT,
} from './promptTemplates';
import {
  evidenceRefsAreSubsetOf,
  filterSafeItems,
  scanCoreNarrative,
  scanDeepNarrative,
  scanHistoryNarrative,
  wrapUserData,
} from './safety';
import {
  applyObservedBusinessRules,
  attachRuleStates,
  parseCompatibilityResponse,
  parseDeepReportResponse,
  parseHistoryResponse,
  parseObservedResponse,
  parseRelationshipResponse,
} from './schemas';
import { readAiConfig } from './serverEnv';
import type {
  AiFailureReason,
  AiMode,
  AiObservedTrait,
  CompatibilityNarrative,
  CompatibilityNarrativeBundle,
  CrossSourceInsight,
  DeepNarrative,
  DeepNarrativeBundle,
  HistoryNarrative,
  HistoryNarrativeBundle,
  MirrorAxisKey,
  MirrorState,
  ObservedProfileResult,
  RelationshipNarrativeBundle,
} from '@/types';

/**
 * 서버 측 AI Task 실행 (§4)
 *
 * 흐름: Route Handler → 이 파일 → Provider → Schema Parse → Business Validation → Safety Scan
 *
 * ⚠️ Provider 원문 에러를 클라이언트로 올리지 않는다. `AiFailureReason`으로만 분류해 전달한다.
 * ⚠️ 실패 시 조용히 AI인 척하지 않는다 — mode를 `fallback`으로 명시해 내려보낸다.
 */

export interface TaskFailure {
  ok: false;
  reason: AiFailureReason;
}

export type TaskResult<T> = { ok: true; data: T } | TaskFailure;

function failureFrom(error: unknown): TaskFailure {
  if (error instanceof AiProviderError) return { ok: false, reason: error.reason };
  return { ok: false, reason: 'SERVER_ERROR' };
}

/* ---------------------------------------------- Observed (사진 분석) */

export interface ObservedRequest {
  inputFingerprint: string;
  images: ProviderImage[];
}

export async function runObservedTask(
  request: ObservedRequest,
): Promise<TaskResult<ObservedProfileResult>> {
  const config = readAiConfig();
  const provider = resolveProvider(true);
  const photoCount = request.images.length;

  // Demo mode — Provider를 부르지 않는다. real인데 키가 없으면 CONFIG_ERROR로 알린다.
  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    return {
      ok: true,
      data: buildDemoObservedResult({
        photoCount,
        inputFingerprint: request.inputFingerprint,
        mode: 'demo',
      }),
    };
  }

  if (photoCount === 0) return { ok: false, reason: 'NO_USABLE_IMAGE' };

  // mock 모드에서는 real이라고 표시하지 않는다 — 결과 meta가 진실이어야 한다(§5).
  const resultMode: AiMode = config.mode === 'mock' ? 'mock' : 'real';

  const imageIds = request.images.map((image) => image.imageId);

  try {
    const raw = await provider.generateStructured({
      task: 'observed-profile',
      systemPrompt: OBSERVED_SYSTEM_PROMPT,
      userPayload: wrapUserData({ imageIds, maxTraits: 6 }),
      images: request.images,
      useVisionModel: true,
    });

    const parsed = parseObservedResponse(raw, imageIds);
    if (!parsed) return { ok: false, reason: 'INVALID_OUTPUT' };

    const validated = applyObservedBusinessRules(parsed);

    // 민감 추론이 섞인 trait은 통째로 버린다 (§89)
    const scan = filterSafeItems(
      validated.traits,
      (trait) => `${trait.label} ${trait.observation} ${trait.evidence.map((e) => e.description).join(' ')}`,
    );

    const traits: AiObservedTrait[] = scan.items.map((trait, index) => ({
      ...trait,
      id: `ai_${index + 1}`,
    }));

    const limitations = [...validated.limitations];
    if (scan.violations.length > 0) {
      // 무엇을 버렸는지 사용자에게 알린다 — 조용히 지우지 않는다.
      limitations.push('사진에서 추론하지 않기로 한 항목이 있어서 일부 관찰은 제외했어.');
    }

    if (traits.length === 0) {
      return {
        ok: true,
        data: buildEmptyObservedResult({
          photoCount,
          usableImageCount: validated.usableImageCount,
          inputFingerprint: request.inputFingerprint,
          mode: resultMode,
          model: provider.model,
          limitations: limitations.length > 0 ? limitations : undefined,
        }),
      };
    }

    return {
      ok: true,
      data: {
        version: '1.0',
        traits,
        limitations,
        evidenceCoverage: {
          imageCount: photoCount,
          usableImageCount: validated.usableImageCount,
          // 커버리지는 코드가 판정한다 — AI 주장에 의존하지 않는다.
          level: evidenceCoverageLevel(validated.usableImageCount, traits.length),
        },
        meta: buildMeta({
          mode: resultMode,
          promptVersion: PROMPT_VERSIONS.observed,
          inputFingerprint: request.inputFingerprint,
          model: provider.model,
        }),
      },
    };
  } catch (error) {
    return failureFrom(error);
  }
}

/* ------------------------------------------------------ Relationship */

export interface RelationshipRequest {
  inputFingerprint: string;
  context: unknown;
  /** 규칙이 판정한 축·상태. AI는 이걸 바꿀 수 없다 */
  judgements: Array<{ axis: MirrorAxisKey; state: MirrorState }>;
  focusAxis: MirrorAxisKey | null;
}

export async function runRelationshipTask(
  request: RelationshipRequest,
): Promise<TaskResult<RelationshipNarrativeBundle>> {
  const config = readAiConfig();
  const provider = resolveProvider(false);

  const metaFor = (mode: AiMode, model?: string) =>
    buildMeta({
      mode,
      promptVersion: PROMPT_VERSIONS.relationship,
      inputFingerprint: request.inputFingerprint,
      model,
    });

  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    // Demo에서는 AI Narrative를 만들지 않는다 — 화면이 기존 템플릿을 쓴다.
    return { ok: true, data: { narratives: [], core: null, meta: metaFor('demo') } };
  }

  const allowedAxes = request.judgements.map((item) => item.axis);
  const stateByAxis = new Map(request.judgements.map((item) => [item.axis, item.state]));

  try {
    const raw = await provider.generateStructured({
      task: 'relationship-insight',
      systemPrompt: RELATIONSHIP_SYSTEM_PROMPT,
      userPayload: wrapUserData({
        context: request.context,
        judgements: request.judgements,
        focusAxis: request.focusAxis,
      }),
    });

    const parsed = parseRelationshipResponse(raw, allowedAxes);
    if (!parsed) return { ok: false, reason: 'INVALID_OUTPUT' };

    // state는 규칙 값으로 덮어쓴다 — AI가 판정을 바꿀 수 없다(§18).
    const withStates = attachRuleStates(parsed.narratives, stateByAxis);

    // Core Narrative는 금지 추론 + Lens 누출(MBTI·사주·별자리)을 함께 검사한다(v1.7 §36).
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
      // Core Insight가 안전 검사에 걸리면 버린다 — 화면은 규칙 템플릿으로 되돌아간다.
      core = coreScan.items[0] ?? null;
    }

    return {
      ok: true,
      data: {
        narratives: scan.items,
        // focusAxis는 규칙이 고른 값을 붙인다 — AI가 고르지 않는다(§19).
        core: core && request.focusAxis ? { ...core, axis: request.focusAxis } : null,
        meta: metaFor(config.mode === 'mock' ? 'mock' : 'real', provider.model),
      },
    };
  } catch (error) {
    return failureFrom(error);
  }
}

/* ----------------------------------------------------- Compatibility */

export interface CompatibilityRequest {
  inputFingerprint: string;
  context: unknown;
  allowed: Array<{ key: CompatibilityNarrative['dimensionKey']; kind: 'good' | 'friction' }>;
}

export async function runCompatibilityTask(
  request: CompatibilityRequest,
): Promise<TaskResult<CompatibilityNarrativeBundle>> {
  const config = readAiConfig();
  const provider = resolveProvider(false);

  const metaFor = (mode: AiMode, model?: string) =>
    buildMeta({
      mode,
      promptVersion: PROMPT_VERSIONS.compatibility,
      inputFingerprint: request.inputFingerprint,
      model,
    });

  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    return { ok: true, data: { narratives: [], meta: metaFor('demo') } };
  }

  try {
    const raw = await provider.generateStructured({
      task: 'compatibility-narrative',
      systemPrompt: COMPATIBILITY_SYSTEM_PROMPT,
      userPayload: wrapUserData({ context: request.context, allowed: request.allowed }),
    });

    const parsed = parseCompatibilityResponse(raw, request.allowed);
    const scan = filterSafeItems(
      parsed,
      (item) => `${item.explanation} ${item.scenario} ${item.conversationQuestion ?? ''}`,
      scanCoreNarrative,
    );

    return { ok: true, data: { narratives: scan.items, meta: metaFor(config.mode === 'mock' ? 'mock' : 'real', provider.model) } };
  } catch (error) {
    return failureFrom(error);
  }
}

/* ---------------------------------------------------------- History */

export interface HistoryRequest {
  inputFingerprint: string;
  context: unknown;
  allowed: Array<{ axis: MirrorAxisKey; state: HistoryNarrative['state'] }>;
}

export async function runHistoryTask(
  request: HistoryRequest,
): Promise<TaskResult<HistoryNarrativeBundle>> {
  const config = readAiConfig();
  const provider = resolveProvider(false);

  const metaFor = (mode: AiMode, model?: string) =>
    buildMeta({
      mode,
      promptVersion: PROMPT_VERSIONS.history,
      inputFingerprint: request.inputFingerprint,
      model,
    });

  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    return { ok: true, data: { narratives: [], meta: metaFor('demo') } };
  }

  // 기록이 1개면 변화 해석 자체를 만들지 않는다(§79 CASE O) — 비교 대상이 없다.
  if (request.allowed.length === 0) {
    return { ok: true, data: { narratives: [], meta: metaFor(config.mode === 'mock' ? 'mock' : 'real', provider.model) } };
  }

  try {
    const raw = await provider.generateStructured({
      task: 'history-insight',
      systemPrompt: HISTORY_SYSTEM_PROMPT,
      userPayload: wrapUserData({ context: request.context, allowed: request.allowed }),
    });

    const parsed = parseHistoryResponse(raw, request.allowed);
    // History는 성장 서사·가치 판정까지 추가로 막는다(§27).
    const scan = filterSafeItems(
      parsed,
      (item) => `${item.explanation} ${item.uncertainty ?? ''}`,
      scanHistoryNarrative,
    );

    return { ok: true, data: { narratives: scan.items, meta: metaFor(config.mode === 'mock' ? 'mock' : 'real', provider.model) } };
  } catch (error) {
    return failureFrom(error);
  }
}

/* -------------------------------------------------------- Deep Report */

export interface DeepReportRequest {
  inputFingerprint: string;
  context: unknown;
  /** Quality Gate (A)를 통과해 실제로 AI에게 보낸 Insight만 — id 허용목록 + evidenceRef 대조용 */
  insights: readonly Pick<CrossSourceInsight, 'id' | 'evidenceRefs'>[];
}

export async function runDeepReportTask(
  request: DeepReportRequest,
): Promise<TaskResult<DeepNarrativeBundle>> {
  const config = readAiConfig();
  const provider = resolveProvider(false);

  const metaFor = (mode: AiMode, model?: string) =>
    buildMeta({
      mode,
      promptVersion: PROMPT_VERSIONS.deepReport,
      inputFingerprint: request.inputFingerprint,
      model,
    });

  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    // Demo에서는 AI Narrative를 만들지 않는다 — 화면이 각 Insight의 ruleSummary를 쓴다.
    return { ok: true, data: { narratives: [], meta: metaFor('demo') } };
  }

  // 보낼 게 없으면(모든 Insight가 Quality Gate 이전에 이미 걸러짐) AI를 부르지 않는다(§40).
  if (request.insights.length === 0) {
    return {
      ok: true,
      data: { narratives: [], meta: metaFor(config.mode === 'mock' ? 'mock' : 'real', provider.model) },
    };
  }

  const allowedIds = request.insights.map((item) => item.id);
  const evidenceByInsight = new Map(request.insights.map((item) => [item.id, item.evidenceRefs]));

  try {
    const raw = await provider.generateStructured({
      task: 'deep-report-narrative',
      systemPrompt: DEEP_REPORT_SYSTEM_PROMPT,
      userPayload: wrapUserData({ context: request.context }),
    });

    const parsed = parseDeepReportResponse(raw, allowedIds);

    // Quality Gate (E) — 원래 Insight에 없던 evidenceRef를 들고 오면 그 항목 전체를 버린다.
    const refChecked = parsed.filter((item) =>
      evidenceRefsAreSubsetOf(item.evidenceRefs, evidenceByInsight.get(item.insightId) ?? []),
    );

    // Quality Gate (B)(C) — 일반론·근거 없는 확정 표현은 scanDeepNarrative가 걸러낸다.
    const scan = filterSafeItems(
      refChecked,
      (item) =>
        `${item.headline} ${item.interpretation} ${item.situation ?? ''} ${item.conversationQuestion ?? ''}`,
      scanDeepNarrative,
    );

    const narratives: DeepNarrative[] = scan.items.map((item) => ({
      insightId: item.insightId,
      headline: item.headline,
      interpretation: item.interpretation,
      situation: item.situation,
      uncertainty: item.uncertainty,
      conversationQuestion: item.conversationQuestion,
      evidenceRefs: item.evidenceRefs,
    }));

    return {
      ok: true,
      data: { narratives, meta: metaFor(config.mode === 'mock' ? 'mock' : 'real', provider.model) },
    };
  } catch (error) {
    return failureFrom(error);
  }
}
