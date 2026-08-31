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
  HISTORY_SYSTEM_PROMPT,
  OBSERVED_SYSTEM_PROMPT,
  PROMPT_VERSIONS,
  RELATIONSHIP_SYSTEM_PROMPT,
} from './promptTemplates';
import { filterSafeItems, wrapUserData } from './safety';
import {
  applyObservedBusinessRules,
  attachRuleStates,
  parseCompatibilityResponse,
  parseHistoryResponse,
  parseObservedResponse,
  parseRelationshipResponse,
} from './schemas';
import { readAiConfig } from './serverEnv';
import type {
  AiFailureReason,
  AiObservedTrait,
  CompatibilityNarrative,
  CoreInsightNarrative,
  HistoryNarrative,
  MirrorAxisKey,
  MirrorState,
  ObservedProfileResult,
  RelationshipNarrative,
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

  const imageIds = request.images.map((image) => image.imageId);

  try {
    const raw = await provider.generateStructured({
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
          mode: 'real',
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
          mode: 'real',
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

export interface RelationshipTaskData {
  narratives: RelationshipNarrative[];
  core: CoreInsightNarrative | null;
  model?: string;
}

export async function runRelationshipTask(
  request: RelationshipRequest,
): Promise<TaskResult<RelationshipTaskData>> {
  const config = readAiConfig();
  const provider = resolveProvider(false);

  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    // Demo에서는 AI Narrative를 만들지 않는다 — 화면이 기존 템플릿을 쓴다.
    return { ok: true, data: { narratives: [], core: null } };
  }

  const allowedAxes = request.judgements.map((item) => item.axis);
  const stateByAxis = new Map(request.judgements.map((item) => [item.axis, item.state]));

  try {
    const raw = await provider.generateStructured({
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

    const scan = filterSafeItems(
      withStates,
      (item) => `${item.headline} ${item.explanation} ${item.question ?? ''}`,
    );

    let core = parsed.core;
    if (core) {
      const coreScan = filterSafeItems([core], (item) => `${item.headline} ${item.summary}`);
      // Core Insight가 안전 검사에 걸리면 버린다 — 화면은 규칙 템플릿으로 되돌아간다.
      core = coreScan.items[0] ?? null;
    }

    return {
      ok: true,
      data: {
        narratives: scan.items,
        // focusAxis는 규칙이 고른 값을 붙인다 — AI가 고르지 않는다(§19).
        core: core && request.focusAxis ? { ...core, axis: request.focusAxis } : null,
        model: provider.model,
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
): Promise<TaskResult<{ narratives: CompatibilityNarrative[]; model?: string }>> {
  const config = readAiConfig();
  const provider = resolveProvider(false);

  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    return { ok: true, data: { narratives: [] } };
  }

  try {
    const raw = await provider.generateStructured({
      systemPrompt: COMPATIBILITY_SYSTEM_PROMPT,
      userPayload: wrapUserData({ context: request.context, allowed: request.allowed }),
    });

    const parsed = parseCompatibilityResponse(raw, request.allowed);
    const scan = filterSafeItems(parsed, (item) => `${item.explanation} ${item.scenario}`);

    return { ok: true, data: { narratives: scan.items, model: provider.model } };
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
): Promise<TaskResult<{ narratives: HistoryNarrative[]; model?: string }>> {
  const config = readAiConfig();
  const provider = resolveProvider(false);

  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    return { ok: true, data: { narratives: [] } };
  }

  try {
    const raw = await provider.generateStructured({
      systemPrompt: HISTORY_SYSTEM_PROMPT,
      userPayload: wrapUserData({ context: request.context, allowed: request.allowed }),
    });

    const parsed = parseHistoryResponse(raw, request.allowed);
    const scan = filterSafeItems(parsed, (item) => item.explanation);

    return { ok: true, data: { narratives: scan.items, model: provider.model } };
  } catch (error) {
    return failureFrom(error);
  }
}
