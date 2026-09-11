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
  jobAllowsOutwardQuestions,
  relationshipTenseOf,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
import { usePremiumLensAi } from '@/hooks/usePremiumLensAi';
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
        /**
         * v1.46 PremiumLens — 관계 렌즈의 생년월일 유효성 판정에만 쓴다.
         * 일주·태양궁 계산 결과는 날짜 문자열로만 결정되므로 오늘이 바뀜다고
         * 렌즈 결과가 바뀌지 않는다.
         */
        today: new Date(),
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

  /**
   * v1.46 AI Lens §3~§5 — **리포트가 조립된 뒤에** 렌즈 AI를 부른다.
   *
   * ⚠️ `report`를 바꾸지 않는다. `lensBundle`은 결정론 결과 그대로이고, AI는 화면에서
   * 그 아래에 덧붙는 별도 상태다 — AI가 전부 실패해도 리포트는 지금과 똑같이 완결된다.
   *
   * ⚠️ 시제·질문 게이트는 **여기서 판정하지 않는다.** Core Task 다섯 개가 쓰는 것과
   * 같은 술어(`relationshipTenseOf` · `jobAllowsOutwardQuestions`)를 같은 `job`에
   * 적용한다 — 경로마다 다른 판정이 생기는 것이 v1.43 §43이 닫은 결함이다.
   */
  const job = resolveRelationshipContext(answers).job;
  const lensAi = usePremiumLensAi({
    bundle: report.lensBundle,
    declared: answers.declared,
    events: answers.target.events ?? [],
    tense: relationshipTenseOf(job),
    allowsOutwardQuestions: jobAllowsOutwardQuestions(job),
    enabled,
  });

  return { report, insights, resolverContext, analysisId, narrative, lensAi };
}
