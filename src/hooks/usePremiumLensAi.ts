'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { crossLensFingerprint, premiumLensFingerprint } from '@/lib/aiFingerprint';
import { aiModeOf } from '@/lib/aiMeta';
import { clearAiCacheEntry, getCachedAiResult } from '@/services/ai/aiClient';
import type { RelationshipTense } from '@/lib/logic/relationshipEvidence';
import {
  lensEventSignature,
  requestCrossLensNarrative,
  requestPremiumLensNarrative,
} from '@/services/aiService';
import type {
  AiNarrativeState,
  AiTask,
  CrossLensNarrativeBundle,
  DeclaredPreference,
  PremiumLensBundle,
  PremiumLensKind,
  PremiumLensNarrativeBundle,
  PremiumLensReport,
  RelationshipEvent,
} from '@/types';

/**
 * Premium Lens AI 오케스트레이션 (v1.46 AI Lens · §4 · §5 · §13~§16 · §29)
 *
 * ══ 왜 `useNarrativeTask` 4개가 아닌가 ═══════════════════════════════════
 *
 * §4가 요구하는 실행 순서가 이 훅의 존재 이유다.
 *
 * ```
 *              ┌→ MBTI AI   ─┐
 * deterministic├→ 사주 AI    ├→ Cross-Lens AI
 * Lens 결과     └→ 별자리 AI  ┘
 * ```
 *
 * 훅 4개를 나란히 두면 React는 **순서를 보장하지 않는다** — 각 훅의 effect가 독립이라
 * Cross-Lens가 렌즈 결과를 기다린다는 보장이 없고, "기다리게" 하려면 훅끼리 상태를
 * 주고받아야 한다. 그러면 배선이 훅 4개에 흩어지고, §5(부분 실패)와 §29(재진입 시
 * 재호출 금지)를 **네 곳에서** 지켜야 한다.
 *
 * 그래서 순서가 있는 한 덩어리는 한 곳에서 관리한다. 대신 **캐시·중복 제거·stale
 * 폐기는 새로 만들지 않고** 기존 `aiClient`가 그대로 한다(§29의 실체가 그것이다).
 *
 * ══ 이 훅이 하지 않는 것 ═════════════════════════════════════════════════
 *
 * ⚠️ **결정론 결과를 건드리지 않는다.** `bundle`은 읽기만 하고, AI가 실패하면 아무것도
 * 바뀌지 않는다 — 화면은 `bundle` 하나로 이미 완결돼 있다(§32).
 *
 * ⚠️ **판정을 만들지 않는다.** mode(pair/self)도 렌즈 가용 여부도 여기서 다시 정하지
 * 않고 `bundle.lenses`가 말하는 그대로다.
 */

const LENS_TASK: Record<PremiumLensKind, AiTask> = {
  mbti: 'premium-mbti-lens',
  saju: 'premium-saju-lens',
  zodiac: 'premium-zodiac-lens',
};

export interface PremiumLensAi {
  /** 렌즈마다 독립 상태. 하나가 실패해도 나머지는 그대로다(§5 · §13) */
  byLens: Partial<Record<PremiumLensKind, AiNarrativeState<PremiumLensNarrativeBundle>>>;
  /** Cross-Lens. 실패해도 위 셋은 유지된다(§14) */
  cross: AiNarrativeState<CrossLensNarrativeBundle> | null;
}

type LensState = AiNarrativeState<PremiumLensNarrativeBundle>;
type CrossState = AiNarrativeState<CrossLensNarrativeBundle>;

const NOOP = () => {};

function idle<T>(): AiNarrativeState<T> {
  return { status: 'idle', data: null, reason: null, mode: null, retry: NOOP };
}

/** 문장이 하나도 없으면 'ready'가 아니다 — 빈 블록을 그리지 않는다 */
function lensHasItems(data: PremiumLensNarrativeBundle): boolean {
  const narrative = data.narrative;
  return Boolean(narrative && (narrative.summary.length > 0 || narrative.units.length > 0));
}

function crossHasItems(data: CrossLensNarrativeBundle): boolean {
  const narrative = data.narrative;
  return Boolean(
    narrative &&
      (narrative.repeatedThemes.length > 0 ||
        narrative.differences.length > 0 ||
        narrative.verificationQuestions.length > 0),
  );
}

export function usePremiumLensAi(input: {
  bundle: PremiumLensBundle;
  declared: DeclaredPreference;
  events: readonly RelationshipEvent[];
  tense: RelationshipTense;
  allowsOutwardQuestions: boolean;
  enabled: boolean;
  /**
   * v1.46.1 §6 — 상대라는 대상이 있는지. **렌즈 mode와 별개의 값이다**: 상대가
   * 있어도 세 렌즈가 전부 `self`일 수 있다(상대 MBTI·생일을 모르는 경우). 이 값을
   * 주지 않으면 모델이 그 사용자에게 `상대가 아직 없으니`라고 쓴다.
   */
  targetExists: boolean;
}): PremiumLensAi {
  const { bundle, declared, events, tense, allowsOutwardQuestions, enabled, targetExists } = input;

  /** 결과가 만들어진 렌즈만. `unavailable`은 AI를 부르지 않는다(§34 · AI-LENS-07) */
  const reports = useMemo(
    () => bundle.lenses.filter((lens): lens is PremiumLensReport => lens.mode !== 'unavailable'),
    [bundle.lenses],
  );

  const eventSignature = useMemo(() => lensEventSignature(events), [events]);

  const fingerprints = useMemo(
    () =>
      reports.map((report) =>
        premiumLensFingerprint({
          kind: report.kind,
          mode: report.mode,
          tense,
          allowsOutwardQuestions,
          basis: report.basis,
          themes: report.themes,
          declared,
          eventSignature,
        }),
      ),
    [reports, tense, allowsOutwardQuestions, declared, eventSignature],
  );

  const [byLens, setByLens] = useState<PremiumLensAi['byLens']>({});
  const [cross, setCross] = useState<CrossState | null>(null);

  /** 재시도 신호 — 값 자체는 의미 없고 effect를 다시 돌리는 용도뿐이다 */
  const [tick, setTick] = useState(0);
  /** 이미 시작한 조합. StrictMode 이중 실행·리렌더·back navigation을 함께 막는다(§29) */
  const startedRef = useRef<string | null>(null);
  /** 지금 유효한 조합. 늦게 온 응답이 새 결과를 덮지 않게 한다 */
  const activeRef = useRef<string | null>(null);

  const runKey = `${enabled ? '1' : '0'}#${tick}#${fingerprints.join('|')}`;

  useEffect(() => {
    if (!enabled || reports.length === 0) return;
    if (startedRef.current === runKey) return;

    startedRef.current = runKey;
    activeRef.current = runKey;

    const retryFor = (kind: PremiumLensKind, fingerprint: string) => () => {
      clearAiCacheEntry(LENS_TASK[kind], fingerprint);
      startedRef.current = null;
      setTick((value) => value + 1);
    };

    /**
     * 캐시에 이미 있으면 즉시 쓴다 — 새로고침·뒤로가기 후 재진입에서 네 호출을
     * 다시 부르지 않는다(§29). `callAiTask`도 같은 캐시를 보므로 아래 요청 경로로
     * 가더라도 네트워크는 타지 않지만, 여기서 먼저 읽어야 **loading 깜빡임**이 없다.
     */
    const initial: PremiumLensAi['byLens'] = {};
    reports.forEach((report, index) => {
      const fingerprint = fingerprints[index]!;
      const cached = getCachedAiResult<PremiumLensNarrativeBundle>(
        LENS_TASK[report.kind],
        fingerprint,
      );
      initial[report.kind] = cached
        ? {
            status: lensHasItems(cached) ? 'ready' : 'unavailable',
            data: cached,
            reason: null,
            mode: aiModeOf(cached),
            retry: retryFor(report.kind, fingerprint),
          }
        : {
            status: 'loading',
            data: null,
            reason: null,
            mode: null,
            retry: retryFor(report.kind, fingerprint),
          };
    });
    setByLens(initial);

    void (async () => {
      /**
       * §4 · §15 — 세 렌즈는 서로 독립이므로 **병렬**로 시작한다.
       * §5 · §13 — `allSettled`라 하나가 실패해도 나머지 결과를 그대로 받는다.
       */
      const settled = await Promise.allSettled(
        reports.map((report, index) =>
          requestPremiumLensNarrative({
            report,
            declared,
            events,
            tense,
            allowsOutwardQuestions,
            fingerprint: fingerprints[index]!,
            targetExists,
          }),
        ),
      );

      if (activeRef.current !== runKey) return;

      const next: PremiumLensAi['byLens'] = {};
      const aiThemes: Partial<Record<PremiumLensKind, string | null>> = {};

      settled.forEach((outcome, index) => {
        const report = reports[index]!;
        const retry = retryFor(report.kind, fingerprints[index]!);

        if (outcome.status === 'rejected') {
          next[report.kind] = {
            status: 'unavailable',
            data: null,
            reason: 'SERVER_ERROR',
            mode: null,
            retry,
          };
          aiThemes[report.kind] = null;
          return;
        }
        if (!outcome.value.ok) {
          next[report.kind] = {
            status: 'unavailable',
            data: null,
            reason: outcome.value.reason,
            mode: null,
            retry,
          };
          aiThemes[report.kind] = null;
          return;
        }

        const data = outcome.value.data;
        next[report.kind] = {
          status: lensHasItems(data) ? 'ready' : 'unavailable',
          data,
          reason: null,
          mode: aiModeOf(data),
          retry,
        };
        aiThemes[report.kind] = data.narrative?.crossTheme ?? null;
      });

      setByLens(next);

      /**
       * §18~§19 — Cross-Lens는 렌즈가 2개 이상일 때만. 결정론 Cross-Lens와 **같은
       * 조건**이다(`buildCrossLens`가 2개 미만이면 null을 돌려준다) — 화면에 결정론
       * 카드가 없는데 AI 문단만 떠 있는 상태를 만들지 않는다.
       */
      if (reports.length < 2) {
        setCross(null);
        return;
      }

      const crossFingerprint = crossLensFingerprint({
        tense,
        allowsOutwardQuestions,
        lensFingerprints: fingerprints,
        aiThemes: reports.map((report) => aiThemes[report.kind] ?? null),
      });

      const crossRetry = () => {
        clearAiCacheEntry('premium-cross-lens', crossFingerprint);
        startedRef.current = null;
        setTick((value) => value + 1);
      };

      const cachedCross = getCachedAiResult<CrossLensNarrativeBundle>(
        'premium-cross-lens',
        crossFingerprint,
      );
      if (cachedCross) {
        setCross({
          status: crossHasItems(cachedCross) ? 'ready' : 'unavailable',
          data: cachedCross,
          reason: null,
          mode: aiModeOf(cachedCross),
          retry: crossRetry,
        });
        return;
      }

      setCross({ status: 'loading', data: null, reason: null, mode: null, retry: crossRetry });

      /**
       * §21 · §16 — **렌즈 3개가 끝난 뒤에** 부른다. 그리고 성공한 렌즈의 테마만
       * 넘긴다(§5) — 실패한 렌즈는 `aiTheme: null`로 자리만 지키고 결정론 테마는
       * 그대로 들어간다.
       */
      const result = await requestCrossLensNarrative({
        reports,
        aiThemes,
        declared,
        events,
        tense,
        allowsOutwardQuestions,
        fingerprint: crossFingerprint,
        deterministic: bundle.crossLens,
        targetExists,
      });

      if (activeRef.current !== runKey) return;

      /** §14 — Cross-Lens가 실패해도 위에서 세운 렌즈 상태는 건드리지 않는다 */
      if (!result.ok) {
        setCross({
          status: 'unavailable',
          data: null,
          reason: result.reason,
          mode: null,
          retry: crossRetry,
        });
        return;
      }

      setCross({
        status: crossHasItems(result.data) ? 'ready' : 'unavailable',
        data: result.data,
        reason: null,
        mode: aiModeOf(result.data),
        retry: crossRetry,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  return { byLens, cross };
}

/** 렌즈 AI를 아직 요청하지 않은 화면(개발용 Preview 등)이 쓰는 빈 상태 */
export const EMPTY_PREMIUM_LENS_AI: PremiumLensAi = { byLens: {}, cross: null };

export type { LensState as PremiumLensAiState };

/** 상태가 없을 때 화면이 쓰는 기본값 — `idle`은 아무것도 그리지 않는다 */
export function lensAiStateOf(
  ai: PremiumLensAi | undefined,
  kind: PremiumLensKind,
): LensState {
  return ai?.byLens[kind] ?? idle<PremiumLensNarrativeBundle>();
}
