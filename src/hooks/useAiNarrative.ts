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
import {
  jobAllowsOutwardQuestions,
  relationshipTenseOf,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
import { clearAiCacheEntry, getCachedAiResult } from '@/services/ai/aiClient';
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
  useComparedHistoryEntries,
  useCompatibility,
  useHistoryReport,
  useMbtiBridge,
  useMbtiLens,
  useMbtiSelfLens,
  useMirror,
  useRepeatedSignals,
  useSoloHistoryReport,
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

function idleState<T>(retry: () => void): AiNarrativeState<T> {
  return { status: 'idle', data: null, reason: null, mode: null, retry };
}

function useNarrativeTask<T extends { meta: { mode: AiMode } }>(input: {
  task: AiTask;
  fingerprint: string | null;
  enabled: boolean;
  hasItems: HasItems<T>;
  run: () => Promise<{ ok: true; data: T } | { ok: false; reason: AiFailureReason }>;
}): AiNarrativeState<T> {
  const { task, fingerprint, enabled, hasItems, run } = input;

  const noop = () => {};
  const [state, settle] = useState<AiNarrativeState<T>>(() => idleState<T>(noop));

  /** 이미 요청을 시작한 지문. StrictMode 이중 실행·리렌더·back navigation을 함께 막는다 */
  const requestedRef = useRef<string | null>(null);
  /** 현재 유효한 지문. 응답이 돌아왔을 때 이 값과 다르면 stale이므로 버린다 */
  const activeRef = useRef<string | null>(null);
  /** run은 매 렌더 새 함수라 effect 의존성에 넣을 수 없다 — 최신 참조만 들고 있는다 */
  const runRef = useRef(run);
  runRef.current = run;
  /** 재시도 신호 — 값 자체는 의미 없고 effect를 다시 돌리는 용도뿐이다 */
  const [retryTick, setRetryTick] = useState(0);

  const retry = () => {
    if (!fingerprint) return;
    // 실패로 끝난 캐시/진행 중 요청만 지운다 — 성공 캐시가 있으면 애초에 이 버튼이 안 보인다.
    clearAiCacheEntry(task, fingerprint);
    requestedRef.current = null;
    setRetryTick((tick) => tick + 1);
  };

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
        retry,
      });
      return;
    }

    if (requestedRef.current === fingerprint) return;
    requestedRef.current = fingerprint;

    settle({ status: 'loading', data: null, reason: null, mode: null, retry });

    void runRef.current().then((result) => {
      // §41 — 입력이 바뀐 뒤 늦게 온 응답이 새 결과를 덮지 않게 한다.
      if (activeRef.current !== fingerprint) return;

      if (!result.ok) {
        settle({ status: 'unavailable', data: null, reason: result.reason, mode: null, retry });
        return;
      }
      settle({
        status: hasItems(result.data) ? 'ready' : 'unavailable',
        data: result.data,
        reason: null,
        mode: result.data.meta.mode,
        retry,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fingerprint, task, hasItems, retryTick]);

  return state;
}

/* -------------------------------------------------- 검증된 관찰 */

/**
 * 사용자 확인·수정을 반영한 관찰 목록. Narrative Context와 Evidence Resolver가 함께 쓴다.
 *
 * v1.16 — 사진이 하나도 없으면(전체 삭제) 예전 `observedAnalysis`가 남아 있어도 근거로
 * 삼지 않는다(Photo Revisit §4-D, `useRelationshipProfile`와 같은 원칙). 이 훅이 유일한
 * 소스라 여기서 한 번 막으면 Deep Report Cross-source Insight의 관측 근거 승격
 * (`crossSourceInsights.findCorroboratingObservedTrait`)과 그 지문(`deepReportFingerprint`/
 * `relationshipNarrativeFingerprint`)까지 함께 무효화된다 — Compatibility Score·Mirror
 * classification·History는 이 값을 아예 쓰지 않으므로 영향이 없다.
 */
export function useValidatedObservations(): ValidatedObservation[] {
  const { answers } = useSession();
  const hasPhotos = answers.photos.length > 0;
  return useMemo(
    () => (hasPhotos ? toValidatedObservations(answers.observedAnalysis, answers.observations) : []),
    [hasPhotos, answers.observedAnalysis, answers.observations],
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
  /**
   * v1.26 P3-3 — 새 근거 source(`compatibility` · `mbti_lens`)를 resolver가 풀 수 있게
   * 이미 계산된 결과를 함께 넘긴다. **여기서 다시 계산하지 않는다** — 두 훅 모두
   * 기존 selector를 그대로 부르는 순수 파생값이다.
   */
  const compatibility = useCompatibility();
  const mbtiLens = useMbtiLens();
  /** v1.32 P4-D — 상대가 없어도 성향 렌즈 근거가 풀리게 한다(자기 MBTI만으로 만든다) */
  const mbtiSelfLens = useMbtiSelfLens();
  /**
   * v1.42 §41.4 — 지금 관계 근거를 부르는 시제. memo 밖에서 계산한다(`useMirror`와 같은
   * 이유). 이 값이 없어서 `ended` 사용자의 근거 문장·칩에 현재형이 남아 있었다.
   */
  const tense = relationshipTenseOf(resolveRelationshipContext(answers).job);

  return useMemo(
    () => ({
      answers,
      validated,
      historyEntries: entries,
      deepAnswers: answers.deepAnswers,
      compatibility,
      mbtiLens,
      mbtiSelfLens,
      tense,
    }),
    [answers, validated, entries, compatibility, mbtiLens, mbtiSelfLens, tense],
  );
}

/**
 * v1.9 — Cross-source Insight 목록. Mirror/History/Compatibility가 이미 계산한 결과를
 * 서로 연결하기만 한다(판정을 새로 만들지 않는다) — `crossSourceInsights.ts` 참고.
 */
export function useCrossSourceInsights(): CrossSourceInsight[] {
  const { answers } = useSession();
  const mirror = useMirror();
  const validated = useValidatedObservations();
  const report = useHistoryReport();
  const repeatedSignals = useRepeatedSignals();
  /**
   * v1.35 §10 — **비교에 참여한 기록을 근거로 건다.**
   *
   * 예전에는 `useHistory().latest`/`previous`(전체 History의 마지막 두 항목)를 썼다.
   * 그런데 `report.changes`는 **커플 기록만** 비교하므로, Solo 관찰이 마지막에 저장돼
   * 있으면 ③ History 연결의 근거가 비교에 참여하지 않은 기록을 가리켰다 —
   * Solo 기록에는 Mirror 판정이 없어서 그 근거는 화면에서 조용히 사라진다.
   */
  const { latest, previous } = useComparedHistoryEntries();
  /** v1.35 §19 — ⑧(Solo History × 지금 답)의 입력. 이미 계산된 비교를 **읽기만** 한다 */
  const soloHistory = useSoloHistoryReport();
  /**
   * v1.26 P3-3 — ④ Compatibility 연결과 ⑤ MBTI Bridge 연결의 입력.
   * 둘 다 이미 계산이 끝난 결과이고, Engine은 이 값을 **읽기만** 한다.
   */
  const compatibility = useCompatibility();
  const mbtiBridge = useMbtiBridge();
  /** v1.32 P4-D — ⑦(declared × MBTI self)의 입력. 상대가 없어도 값이 있다 */
  const crossMbtiSelfLens = useMbtiSelfLens();
  /** v1.41 — memo 밖에서 계산한다(deps 정확도 · `useMirror`와 같은 이유) */
  const tense = relationshipTenseOf(resolveRelationshipContext(answers).job);

  return useMemo(
    () =>
      buildCrossSourceInsights({
        declared: answers.declared,
        experience: answers.experience,
        // v1.41 §39.18 — ⑨(지금 관계 × 이전 관계)의 입력. 비어 있으면 ⑨는 만들어지지 않는다
        current: answers.currentRelationship,
        // v1.41 §39.13 — ruleSummary 호칭 전용. 판정·근거에는 들어가지 않는다
        tense,
        target: answers.target,
        mirror,
        validated,
        historyChanges: report.changes,
        repeatedSignals,
        latestHistoryEntry: latest,
        previousHistoryEntry: previous,
        deepAnswers: answers.deepAnswers,
        compatibility,
        mbtiBridge,
        // v1.32 P4-D — 상대 없이 열리는 ⑦ 조합의 입력. 새 계산이 아니다
        mbtiSelfLens: crossMbtiSelfLens,
        // v1.35 §19 — 상대·사진·MBTI 없이 열리는 ⑧ 조합의 입력
        soloHistory,
      }),
    [
      answers.declared,
      answers.experience,
      // v1.41 — ⑨의 입력과 시제. 근거가 바뀌면 연결 목록도 다시 만들어야 한다
      answers.currentRelationship,
      tense,
      answers.target,
      mirror,
      validated,
      report.changes,
      repeatedSignals,
      latest,
      previous,
      answers.deepAnswers,
      compatibility,
      mbtiBridge,
      crossMbtiSelfLens,
      soloHistory,
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

  /**
   * 비교 가능한 축이 없으면 설명할 것도 없다 — 호출하지 않는다.
   *
   * v1.30 — `score !== null`을 함께 본다. E3(관측 정보 부족)에서는 화면이
   * `LowConfidenceView`로 빠져서 **narrative를 그릴 자리가 아예 없는데**, 아는 축이
   * 하나라도 있으면 `hasSignals`가 참이라 실제 Provider 호출이 나가고 있었다(실측).
   * 쓸 수 없는 응답에 요청·비용·지연을 쓰지 않는다.
   */
  const hasSignals =
    result.score !== null &&
    (result.goodSignals.length > 0 || result.frictionSignals.length > 0);

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
  /**
   * v1.42 §40.6 — memo 밖에서 계산한다. `useMirror`·`useCrossSourceInsights`와 같은
   * 이유다: memo 안에서 `resolveRelationshipContext(answers)`를 부르면 memo가 `answers`
   * 전체에 의존하는데 deps에는 일부 필드만 적히므로 값이 낡을 수 있다. `tense`는 두
   * 값짜리 문자열이라 deps로 써도 참조 비교 문제가 없다.
   */
  const { job } = resolveRelationshipContext(answers);
  const tense = relationshipTenseOf(job);
  /**
   * v1.42 §41.8 — AI가 만든 질문에도 결정론 질문과 **같은 Job 경계**를 적용한다.
   * 프롬프트에 들어가지 않고 서버 후처리에만 쓰인다.
   *
   * ⚠️ **지문에도 들어간다**(§42). Blocker Closure 시점에는 "응답 내용을 정하지 않으므로
   * 지문에서 뺀다"고 판단했는데 **그 판단이 틀렸다.** 클라이언트 캐시가 저장하는 것은
   * provider raw가 아니라 **게이트가 적용된 최종 응답**이므로, 이 boolean이 다르면
   * 재사용해도 되는 응답이 아니다. `solo_exp` + New Target reset에서 실제로 같은 지문에
   * 허용/금지가 겹쳤다(실측).
   */
  const allowsOutwardQuestions = jobAllowsOutwardQuestions(job);

  /**
   * v1.42 §40.3 · §42 — 지문은 **같은 최종 응답을 재사용해도 되는 입력 집합**이다.
   *
   * `currentRelationship`·`tense`가 없던 것이 stale narrative 결함이었고(§40.3),
   * `allowsOutwardQuestions`가 없던 것이 stale question 결함이었다(§42).
   * `answers.status`는 빠져 있다 — AI가 받지 않고 응답을 바꾸지도 않는다.
   */
  const fingerprint = useMemo(
    () =>
      relationshipNarrativeFingerprint({
        tense,
        allowsOutwardQuestions,
        declared: answers.declared,
        experience: answers.experience,
        current: answers.currentRelationship,
        focusAxis,
        validated,
      }),
    [
      tense,
      allowsOutwardQuestions,
      answers.declared,
      answers.experience,
      answers.currentRelationship,
      focusAxis,
      validated,
    ],
  );

  const run = () =>
    requestRelationshipNarrative({
      answers,
      mirror,
      validated,
      tense,
      allowsOutwardQuestions,
      fingerprint,
    });

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

  const deepTense = relationshipTenseOf(resolveRelationshipContext(answers).job);
  const run = () => requestDeepReportNarrative(insights, resolverContext, fingerprint, deepTense);

  return useNarrativeTask<DeepNarrativeBundle>({
    task: 'deep-report-narrative',
    fingerprint,
    enabled: enabled && insights.length > 0,
    hasItems: deepReportHasItems,
    run,
  });
}
