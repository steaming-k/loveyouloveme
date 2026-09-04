'use client';

import { useMemo } from 'react';

import {
  useCrossSourceInsights,
  useDeepReportNarrative,
  useEvidenceContext,
} from '@/hooks/useAiNarrative';
import {
  useCompatibility,
  useConversationQuestions,
  useHistoryReport,
  usePastObservation,
  useRepeatedSignals,
} from '@/hooks/useAnalysis';
import { analysisFingerprint } from '@/lib/logic/history';
import { buildRelationshipDeepReport } from '@/services/premiumService';
import { useSession } from '@/state/SessionProvider';

/**
 * Relationship Deep Report 조립 (vNext)
 *
 * `/premium`(Unlock 이후)과 `/premium-preview/[feature]`가 같은 리포트를 보여줘야 하는데,
 * 필요한 입력(궁합·질문·History·반복 신호·과거 관찰·Cross-source Insight·Evidence Context·
 * AI Narrative)이 여덟 갈래라 화면마다 배선을 다시 쓰면 두 화면이 조용히 어긋난다.
 *
 * ⚠️ **계산을 새로 하지 않는다.** 기존 selector 훅과 `buildRelationshipDeepReport`를 그대로
 * 부르는 배선 전용 훅이다 — Compatibility/Mirror/History/Lens 로직은 건드리지 않는다.
 *
 * `enabled`는 **AI Narrative 요청**만 제어한다. Paywall에 머무는 동안에는 false로 두어
 * 결제(또는 Unlock) 이전에 AI를 호출하지 않고, 규칙 기반 리포트 자체는 항상 준비돼 있다.
 */
export function useDeepReport(enabled: boolean) {
  const { answers } = useSession();

  const compatibility = useCompatibility();
  const questions = useConversationQuestions();
  const historyReport = useHistoryReport();
  const repeated = useRepeatedSignals();
  const frictionPast = usePastObservation(compatibility.frictionSignals[0]?.key ?? null);

  const insights = useCrossSourceInsights();
  const resolverContext = useEvidenceContext();
  const narrative = useDeepReportNarrative(insights, enabled);

  const analysisId = useMemo(
    () => analysisFingerprint(answers.status, answers.declared, answers.experience),
    [answers.status, answers.declared, answers.experience],
  );

  const report = useMemo(
    () =>
      buildRelationshipDeepReport({
        insights,
        narratives: narrative.data?.narratives ?? [],
        resolverContext,
        compatibility,
        compatibilityQuestions: questions,
        compatibilityPastObservations: frictionPast
          ? [
              {
                label: compatibility.frictionSignals[0]?.label ?? '관찰 필요 신호',
                text: frictionPast.text,
              },
            ]
          : [],
        historyReport,
        repeatedSignals: repeated,
        target: answers.target,
      }),
    [
      insights,
      narrative.data,
      resolverContext,
      compatibility,
      questions,
      frictionPast,
      historyReport,
      repeated,
      answers.target,
    ],
  );

  return { report, insights, resolverContext, analysisId, narrative };
}
