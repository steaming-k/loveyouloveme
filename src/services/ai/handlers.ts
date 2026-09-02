import 'server-only';

import {
  buildDemoObservedResult,
  buildEmptyObservedResult,
  buildMeta,
  evidenceCoverageLevel,
} from './fallback';
import { AiProviderError, resolveProvider, type AiProvider, type ProviderImage } from './provider';
import {
  COMPATIBILITY_SYSTEM_PROMPT,
  DEEP_REPORT_SYSTEM_PROMPT,
  HISTORY_SYSTEM_PROMPT,
  PHOTO_OBSERVATION_SYSTEM_PROMPT,
  PROMPT_VERSIONS,
  RELATIONSHIP_SYSTEM_PROMPT,
} from './promptTemplates';
import {
  evidenceRefsAreSubsetOf,
  filterSafeItems,
  scanCoreNarrative,
  scanDeepNarrative,
  scanHistoryNarrative,
  scanPhotoObservation,
  wrapUserData,
} from './safety';
import {
  attachRuleStates,
  parseCompatibilityResponse,
  parseDeepReportResponse,
  parseHistoryResponse,
  parsePhotoObservationResponse,
  parseRelationshipResponse,
} from './schemas';
import { readAiConfig } from './serverEnv';
import {
  aggregatePhotoObservations,
  describeSignal,
  evidenceLabelsInPhoto,
  repeatedSignals,
  strengthToConfidence,
} from '@/lib/logic/observedSignals';
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
  ObservedCategory,
  ObservedLabel,
  ObservedProfileResult,
  ObservedSignalCategory,
  PhotoObservation,
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

/**
 * 동시에 여는 Provider 요청 수.
 * 사진 9장을 한꺼번에 던지면 Rate Limit에 걸리기 쉽고, 1장씩 순차로 돌면 너무 느리다.
 */
const PHOTO_CONCURRENCY = 3;

/** LEVEL 2 활동 범주 → 기존 화면이 쓰는 표시용 분류 */
const DISPLAY_CATEGORY: Record<ObservedSignalCategory, ObservedCategory> = {
  sports: 'activity',
  outdoor: 'activity',
  travel: 'activity',
  culture: 'interest',
  reading: 'interest',
  cafe: 'lifestyle',
  food: 'lifestyle',
  pet: 'lifestyle',
  social: 'social',
  other: 'lifestyle',
};

type PhotoOutcome =
  | { ok: true; observation: PhotoObservation; violations: string[] }
  | { ok: false; reason: AiFailureReason };

/**
 * 민감 추론이 섞인 라벨만 골라 버린다 (§9 · §10).
 *
 * ⚠️ 사진 전체를 버리지 않는다. '카페 테이블'과 '친구들'이 같은 사진에서 나왔다면
 * 앞의 것은 그대로 쓸 수 있는 관찰이다. 걸린 라벨을 **고쳐 쓰지도 않는다** —
 * 고치면 무엇이 AI 관찰이고 무엇이 우리가 만든 문장인지 구분할 수 없게 된다.
 */
export function sanitizePhotoObservation(observation: PhotoObservation): {
  observation: PhotoObservation;
  violations: string[];
} {
  const violations = new Set<string>();

  const clean = (labels: ObservedLabel[]): ObservedLabel[] =>
    labels.filter((entry) => {
      const scan = scanPhotoObservation(entry.label);
      if (!scan.safe) scan.violations.forEach((item) => violations.add(item));
      return scan.safe;
    });

  const summaryScan = scanPhotoObservation(observation.evidenceSummary);
  if (!summaryScan.safe) summaryScan.violations.forEach((item) => violations.add(item));

  return {
    observation: {
      ...observation,
      scenes: clean(observation.scenes),
      activities: clean(observation.activities),
      objects: clean(observation.objects),
      environment: observation.environment ? clean(observation.environment) : [],
      evidenceSummary: summaryScan.safe ? observation.evidenceSummary : '',
    },
    violations: [...violations],
  };
}

/**
 * 사진 **한 장**을 관찰한다 (§4 `analyzePhoto`).
 *
 * ⚠️ 사진을 한 장씩 보내는 게 핵심이다. 전부 한 번에 보내면 Provider가
 * '여러 장에서 반복해서 보인다'를 스스로 주장하게 되고, 그러면 §3·§5의 반복 기준이
 * 우리 코드가 아니라 Provider 손에 넘어간다.
 */
async function analyzePhoto(
  provider: AiProvider,
  image: ProviderImage,
): Promise<PhotoOutcome> {
  try {
    const raw = await provider.generateStructured({
      task: 'observed-photo-analysis',
      systemPrompt: PHOTO_OBSERVATION_SYSTEM_PROMPT,
      // 사진 외 개인 정보를 함께 보내지 않는다(§26). photoId는 세션 내부 id다(§29).
      userPayload: wrapUserData({ photoId: image.imageId }),
      images: [image],
      useVisionModel: true,
    });

    const parsed = parsePhotoObservationResponse(raw, image.imageId);
    if (!parsed) return { ok: false, reason: 'INVALID_OUTPUT' };

    return { ok: true, ...sanitizePhotoObservation(parsed) };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof AiProviderError ? error.reason : 'SERVER_ERROR',
    };
  }
}

/** 순서를 유지한 채 동시 실행 수만 제한한다 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]!);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * 사진 → 관찰 신호 (v1.10 재작성)
 *
 * 흐름: 사진 1장씩 Vision 관찰 → 민감 라벨 제거 → **규칙 집계**(반복 판정) → 신호
 *
 * ⚠️ 반복 여부·occurrenceCount를 Provider에게 묻지 않는다(§3). Provider는 사진을 한 장씩
 * 보므로 애초에 알 수 없고, 물어보면 지어낸다. 집계는 `aggregatePhotoObservations`가 한다.
 *
 * ⚠️ '분석 실패'와 '반복 없음'을 같은 결과로 만들지 않는다(§8). 전부 실패하면 실패로
 * 올리고, 성공했는데 반복이 없으면 단일 관찰을 그대로 돌려준다 — No Pattern ≠ No Information.
 */
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

  const outcomes = await mapWithConcurrency(request.images, PHOTO_CONCURRENCY, (image) =>
    analyzePhoto(provider, image),
  );

  const observations: PhotoObservation[] = [];
  const failures: AiFailureReason[] = [];
  const violations = new Set<string>();

  for (const outcome of outcomes) {
    if (outcome.ok) {
      observations.push(outcome.observation);
      outcome.violations.forEach((item) => violations.add(item));
    } else {
      failures.push(outcome.reason);
    }
  }

  // 한 장도 못 읽었으면 이건 '반복이 없다'가 아니라 '분석을 못 했다'다(§8-B).
  if (observations.length === 0) return { ok: false, reason: failures[0] ?? 'NO_USABLE_IMAGE' };

  const usableImageCount = observations.filter((item) => item.usable).length;
  const signals = aggregatePhotoObservations(observations);
  const observationById = new Map(observations.map((item) => [item.photoId, item]));

  const traits: AiObservedTrait[] = signals.map((signal) => ({
    id: signal.id,
    category: DISPLAY_CATEGORY[signal.category],
    label: signal.label,
    // 문장은 집계 결과가 만든다 — '몇 장에서 보였는가'는 규칙이 센 값이다(§4).
    observation: describeSignal(signal),
    evidence: signal.photoIds.map((photoId) => {
      const observation = observationById.get(photoId);
      const labels = observation ? evidenceLabelsInPhoto(observation, signal.category) : [];
      return {
        imageId: photoId,
        description: labels.length > 0 ? labels.join(' · ') : (observation?.evidenceSummary ?? ''),
      };
    }),
    confidence: strengthToConfidence(signal.strength),
    signal,
  }));

  const limitations: string[] = [];

  if (config.mode === 'mock') {
    limitations.push('개발용 mock 응답이라 실제 사진 내용을 본 결과가 아니야.');
  }
  if (violations.size > 0) {
    // 무엇을 버렸는지 사용자에게 알린다 — 조용히 지우지 않는다(§9).
    limitations.push('사진에서 추론하지 않기로 한 항목이 있어서 일부 관찰은 제외했어.');
  }
  if (failures.length > 0) {
    limitations.push(`${failures.length}장은 분석을 완료하지 못했어.`);
  }
  const unreadable = observations.length - usableImageCount;
  if (unreadable > 0) {
    limitations.push(`${unreadable}장은 무엇인지 알아볼 수 없어서 관찰을 만들지 못했어.`);
  }
  /**
   * ⚠️ '반복이 없었다'는 여기(limitations)에 넣지 않는다. 그건 한계가 아니라 **결과**이고,
   * 화면이 `observedState === 'single_only'`를 보고 목록 맨 위에 크게 말한다(§7).
   * 양쪽에 다 넣었더니 같은 문장이 화면에 두 번 나왔다.
   */

  if (traits.length === 0) {
    return {
      ok: true,
      data: buildEmptyObservedResult({
        photoCount,
        usableImageCount,
        inputFingerprint: request.inputFingerprint,
        mode: resultMode,
        model: provider.model,
        // 사진이 적어서인지, 사진은 봤는데 잡을 게 없어서인지 구분한다(§8-D).
        observedState: usableImageCount < 3 ? 'insufficient_photos' : 'no_observation',
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
        usableImageCount,
        // 커버리지는 코드가 판정한다 — AI 주장에 의존하지 않는다.
        level: evidenceCoverageLevel(usableImageCount, traits.length),
      },
      observedState: repeatedSignals(signals).length > 0 ? 'repeated_found' : 'single_only',
      meta: buildMeta({
        mode: resultMode,
        promptVersion: PROMPT_VERSIONS.observed,
        inputFingerprint: request.inputFingerprint,
        model: provider.model,
      }),
    },
  };
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
