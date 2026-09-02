'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  compatibilityNarrativeFingerprint,
  deepReportFingerprint,
  historyNarrativeFingerprint,
  relationshipNarrativeFingerprint,
} from '@/lib/aiFingerprint';
import type { EvidenceResolverContext } from '@/lib/aiEvidenceResolver';
import { buildCrossSourceInsights } from '@/lib/logic/crossSourceInsights';
import { getCachedAiResult } from '@/services/ai/aiClient';
import {
  requestCompatibilityNarrative,
  requestDeepReportNarrative,
  requestHistoryNarrative,
  requestRelationshipNarrative,
  toValidatedObservations,
} from '@/services/aiService';
import { useHistory } from '@/state/HistoryProvider';
import { useSession } from '@/state/SessionProvider';
import {
  useCompatibility,
  useHistoryReport,
  useMirror,
  useRepeatedSignals,
} from '@/hooks/useAnalysis';
import type {
  AiFailureReason,
  AiMode,
  AiNarrativeState,
  AiTask,
  CompatibilityNarrativeBundle,
  CrossSourceInsight,
  DeepNarrativeBundle,
  HistoryNarrativeBundle,
  RelationshipNarrativeBundle,
  ValidatedObservation,
} from '@/types';

/**
 * AI Narrative 훅 (v1.7 · §39 · §40 · §41 · §42)
 *
 * 이 훅들이 지키는 것:
 *   - **Core Result를 막지 않는다.** 실패·지연 시 `unavailable`을 돌려주고, 화면은 기존
 *     deterministic 콘텐츠를 그대로 렌더한다(§15/§84).
 *   - 같은 지문으로 다시 들어오면 재호출하지 않는다 — 캐시 + in-flight dedup + ref 가드(§40).
 *   - 지문이 바뀐 뒤 늦게 온 응답은 버린다(§41).
 *   - Prefetch로 미리 만들어두고, 뒤 화면은 캐시를 읽는다(§61/§62/§63).
 */

/** 표시할 항목이 하나도 없으면 'ready'가 아니다 — 빈 카드를 그리지 않는다 */
type HasItems<T> = (data: T) => boolean;

function idleState<T>(): AiNarrativeState<T> {
  return { status: 'idle', data: null, reason: null, mode: null };
}

function useNarrativeTask<T extends { meta: { mode: AiMode } }>(input: {
  task: AiTask;
  fingerprint: string | null;
  enabled: boolean;
  hasItems: HasItems<T>;
  run: () => Promise<{ ok: true; data: T } | { ok: false; reason: AiFailureReason }>;
}): AiNarrativeState<T> {
  const { task, fingerprint, enabled, hasItems, run } = input;

  const [state, settle] = useState<AiNarrativeState<T>>(idleState<T>);

  /** 이미 요청을 시작한 지문. StrictMode 이중 실행·리렌더·back navigation을 함께 막는다 */
  const requestedRef = useRef<string | null>(null);
  /** 현재 유효한 지문. 응답이 돌아왔을 때 이 값과 다르면 stale이므로 버린다 */
  const activeRef = useRef<string | null>(null);
  /** run은 매 렌더 새 함수라 effect 의존성에 넣을 수 없다 — 최신 참조만 들고 있는다 */
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!enabled || !fingerprint) return;

    activeRef.current = fingerprint;

    // 이전 화면(또는 prefetch)에서 이미 만들어둔 결과가 있으면 즉시 쓴다.
    const cached = getCachedAiResult<T>(task, fingerprint);
    if (cached) {
      settle({
        status: hasItems(cached) ? 'ready' : 'unavailable',
        data: cached,
        reason: null,
        mode: cached.meta.mode,
      });
      return;
    }

    if (requestedRef.current === fingerprint) return;
    requestedRef.current = fingerprint;

    settle({ status: 'loading', data: null, reason: null, mode: null });

    void runRef.current().then((result) => {
      // §41 — 입력이 바뀐 뒤 늦게 온 응답이 새 결과를 덮지 않게 한다.
      if (activeRef.current !== fingerprint) return;

      if (!result.ok) {
        settle({ status: 'unavailable', data: null, reason: result.reason, mode: null });
        return;
      }
      settle({
        status: hasItems(result.data) ? 'ready' : 'unavailable',
        data: result.data,
        reason: null,
        mode: result.data.meta.mode,
      });
    });
  }, [enabled, fingerprint, task, hasItems]);

  return state;
}

/* -------------------------------------------------- 검증된 관찰 */

/** 사용자 확인·수정을 반영한 관찰 목록. Narrative Context와 Evidence Resolver가 함께 쓴다 */
export function useValidatedObservations(): ValidatedObservation[] {
  const { answers } = useSession();
  return useMemo(
    () => toValidatedObservations(answers.observedAnalysis, answers.observations),
    [answers.observedAnalysis, answers.observations],
  );
}

/**
 * EvidenceRef를 화면 문장으로 바꿀 때 필요한 컨텍스트.
 * AI가 준 근거 텍스트가 아니라 **실제 세션 데이터**를 쓴다(§34).
 */
export function useEvidenceContext(): EvidenceResolverContext {
  const { answers } = useSession();
  const { entries } = useHistory();
  const validated = useValidatedObservations();

  return useMemo(
    () => ({ answers, validated, historyEntries: entries, deepAnswers: answers.deepAnswers }),
    [answers, validated, entries],
  );
}

/**
 * v1.9 — Cross-source Insight 목록. Mirror/History/Compatibility가 이미 계산한 결과를
 * 서로 연결하기만 한다(판정을 새로 만들지 않는다) — `crossSourceInsights.ts` 참고.
 */
export function useCrossSourceInsights(): CrossSourceInsight[] {
  const { answers } = useSession();
  const { latest } = useHistory();
  const mirror = useMirror();
  const validated = useValidatedObservations();
  const report = useHistoryReport();
  const repeatedSignals = useRepeatedSignals();

  return useMemo(
    () =>
      buildCrossSourceInsights({
        declared: answers.declared,
        experience: answers.experience,
        target: answers.target,
        mirror,
        validated,
        historyChanges: report.changes,
        repeatedSignals,
        latestHistoryEntry: latest,
        deepAnswers: answers.deepAnswers,
      }),
    [
      answers.declared,
      answers.experience,
      answers.target,
      mirror,
      validated,
      report.changes,
      repeatedSignals,
      latest,
      answers.deepAnswers,
    ],
  );
}

/* --------------------------------------------- Compatibility (§9) */

const compatibilityHasItems: HasItems<CompatibilityNarrativeBundle> = (data) =>
  data.narratives.length > 0;

/**
 * S22/S23/S24/S25에서 쓴다. **non-blocking** — 점수는 이미 로컬 계산으로 준비돼 있다(§16).
 * S20/S21에서 `prefetch: true`로 먼저 불러두면 S22는 캐시를 읽는다(§62).
 */
export function useCompatibilityNarrative(
  enabled = true,
): AiNarrativeState<CompatibilityNarrativeBundle> {
  const { answers } = useSession();
  const result = useCompatibility();

  const fingerprint = useMemo(
    () => compatibilityNarrativeFingerprint(answers.declared, answers.target, result),
    [answers.declared, answers.target, result],
  );

  // 비교 가능한 축이 없으면 설명할 것도 없다 — 호출하지 않는다.
  const hasSignals = result.goodSignals.length > 0 || result.frictionSignals.length > 0;

  const run = () => requestCompatibilityNarrative(result, fingerprint);

  return useNarrativeTask<CompatibilityNarrativeBundle>({
    task: 'compatibility-narrative',
    fingerprint,
    enabled: enabled && hasSignals,
    hasItems: compatibilityHasItems,
    run,
  });
}

/* --------------------------------------------- Relationship (§17) */

const relationshipHasItems: HasItems<RelationshipNarrativeBundle> = (data) =>
  data.narratives.length > 0 || data.core !== null;

/**
 * S27/S28에서 쓴다. S26(Mirror Teaser)에서 `enabled=true`로 미리 호출해두면
 * 사용자가 CTA를 누른 뒤에는 캐시를 읽는다(§61) — Core Flow가 빨라진다.
 */
export function useRelationshipNarrative(
  enabled = true,
): AiNarrativeState<RelationshipNarrativeBundle> {
  const { answers } = useSession();
  const mirror = useMirror();
  const validated = useValidatedObservations();

  const focusAxis = mirror.teaser?.axisKey ?? null;

  const fingerprint = useMemo(
    () =>
      relationshipNarrativeFingerprint({
        status: answers.status,
        declared: answers.declared,
        experience: answers.experience,
        focusAxis,
        validated,
      }),
    [answers.status, answers.declared, answers.experience, focusAxis, validated],
  );

  const run = () =>
    requestRelationshipNarrative({ answers, mirror, validated, fingerprint });

  return useNarrativeTask<RelationshipNarrativeBundle>({
    task: 'relationship-insight',
    fingerprint,
    // Mirror를 만들 수 없으면 설명할 판정도 없다.
    enabled: enabled && mirror.available && mirror.insights.length > 0,
    hasItems: relationshipHasItems,
    run,
  });
}

/* -------------------------------------------------- History (§26) */

const historyHasItems: HasItems<HistoryNarrativeBundle> = (data) => data.narratives.length > 0;

/**
 * F2에서 쓴다. 기록이 2개 미만이면 비교 자체가 불가능하므로 호출하지 않는다 —
 * 기록 1개로 변화 해석을 만들지 않는다(§79 CASE O).
 */
export function useHistoryNarrative(enabled = true): AiNarrativeState<HistoryNarrativeBundle> {
  const { entries } = useHistory();
  const report = useHistoryReport();

  const judged = useMemo(
    () => report.changes.filter((change) => change.state !== 'INSUFFICIENT'),
    [report.changes],
  );

  const fingerprint = useMemo(
    () => historyNarrativeFingerprint(entries, report.changes),
    [entries, report.changes],
  );

  const run = () => requestHistoryNarrative(report.changes, fingerprint);

  return useNarrativeTask<HistoryNarrativeBundle>({
    task: 'history-insight',
    fingerprint,
    enabled: enabled && report.comparable && judged.length > 0,
    hasItems: historyHasItems,
    run,
  });
}

/* -------------------------------------------------- Deep Report (v1.9) */

const deepReportHasItems: HasItems<DeepNarrativeBundle> = (data) => data.narratives.length > 0;

/**
 * Relationship Deep Report §24 — Cross-source Insight에 headline/interpretation을 붙인다.
 * `insights`는 이미 Quality Gate 이전 단계(우선순위 정렬)까지 끝난 목록을 넘긴다 —
 * 실제로 AI에게 보낼지는 Context Builder의 Quality Gate (A)가 한 번 더 정한다.
 */
export function useDeepReportNarrative(
  insights: readonly CrossSourceInsight[],
  enabled = true,
): AiNarrativeState<DeepNarrativeBundle> {
  const { answers } = useSession();
  const validated = useValidatedObservations();
  const resolverContext = useEvidenceContext();

  const fingerprint = useMemo(
    () =>
      deepReportFingerprint({
        insights,
        declared: answers.declared,
        target: answers.target,
        validated,
        deepAnswers: answers.deepAnswers,
      }),
    [insights, answers.declared, answers.target, validated, answers.deepAnswers],
  );

  const run = () => requestDeepReportNarrative(insights, resolverContext, fingerprint);

  return useNarrativeTask<DeepNarrativeBundle>({
    task: 'deep-report-narrative',
    fingerprint,
    enabled: enabled && insights.length > 0,
    hasItems: deepReportHasItems,
    run,
  });
}
