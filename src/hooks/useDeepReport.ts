'use client';

import { useMemo } from 'react';

import {
  useCrossSourceInsights,
  useDeepReportNarrative,
  useEvidenceContext,
} from '@/hooks/useAiNarrative';
import {
  useCompatibility,
  useHistoryReport,
  useMirror,
  useRepeatedSignals,
} from '@/hooks/useAnalysis';
import { analysisFingerprint } from '@/lib/logic/history';
import {
  deepReportJobContext,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
import { buildRelationshipDeepReport } from '@/services/premiumService';
import { useSession } from '@/state/SessionProvider';

/**
 * Relationship Deep Report 조립 (vNext)
 *
 * `/premium`(Unlock 이후)과 `/premium-preview/[feature]`가 같은 리포트를 보여줘야 하는데,
 * 필요한 입력(궁합·History·반복 신호·Cross-source Insight·Evidence Context·AI Narrative)이
 * 여러 갈래라 화면마다 배선을 다시 쓰면 두 화면이 조용히 어긋난다.
 *
 * ⚠️ **계산을 새로 하지 않는다.** 기존 selector 훅과 `buildRelationshipDeepReport`를 그대로
 * 부르는 배선 전용 훅이다 — Compatibility/Mirror/History/Lens 로직은 건드리지 않는다.
 *
 * v1.26 P3-3 — 무료 대화 질문(`useConversationQuestions`)과 과거 관찰(`usePastObservation`)은
 * 더 이상 넘기지 않는다. Deep Report가 그 둘을 쓰던 자리(`compatibilityDeepDive` ·
 * `conversationQuestions`)가 **무료 문장을 그대로 다시 보여주는 섹션**이었고, v1.26에서
 * 연결(Connection) 구조로 대체됐다.
 *
 * `enabled`는 **AI Narrative 요청**만 제어한다. Paywall에 머무는 동안에는 false로 두어
 * 결제(또는 Unlock) 이전에 AI를 호출하지 않고, 규칙 기반 리포트 자체는 항상 준비돼 있다.
 */
export function useDeepReport(enabled: boolean) {
  const { answers } = useSession();

  const compatibility = useCompatibility();
  const historyReport = useHistoryReport();
  const repeated = useRepeatedSignals();
  /**
   * v1.45 — Chapter Engine의 FREE 중복 게이트·CH07 재료. **새 계산이 아니다** —
   * `useCrossSourceInsights`가 이미 부르는 것과 같은 selector다(같은 memo 결과를 공유한다).
   */
  const mirror = useMirror();

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
        historyReport,
        repeatedSignals: repeated,
        target: answers.target,
        mirror,
        /**
         * v1.40 §37.9 — Ended Safety는 무료/유료 경계와 무관하다. 화면과 **같은 술어**를 쓴다.
         * v1.40.1 §38.2 — 술어 하나가 아니라 문맥 객체 하나를 넘긴다. 넘길 값이
         * 늘어날 때마다 호출부를 고치면 또 한 곳이 빠진다 — 그게 v1.40의 결함이었다.
         */
        lifecycle: deepReportJobContext(resolveRelationshipContext(answers).job),
      }),
    [
      insights,
      narrative.data,
      resolverContext,
      compatibility,
      historyReport,
      repeated,
      mirror,
      answers,
    ],
  );

  return { report, insights, resolverContext, analysisId, narrative };
}
