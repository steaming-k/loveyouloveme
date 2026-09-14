'use client';

import { semanticTopCandidates } from '@/lib/logic/insightCandidates';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { NoticeBox, PageHeading, Tag } from '@/components/common/primitives';
import { useNarrativeViewEvent } from '@/components/ai/AiModeNotice';
import { PremiumDetailView } from '@/components/premium/PremiumDetailView';
import { RelationshipDeepReportView } from '@/components/premium/RelationshipDeepReportView';
import { DeepReportSnapshotSaver } from '@/components/account/DeepReportSnapshotSaver';
import { Lovy } from '@/components/lovy/Lovy';
import { PREMIUM_FEATURES } from '@/data/premium';
import { usePremiumAccess } from '@/hooks/useUtMode';
import { trackEvent } from '@/lib/analytics';
import { lensAvailability } from '@/lib/logic/birth';
import { analysisFingerprint } from '@/lib/logic/history';
import {
  deepReportJobContext,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
import { ROUTES } from '@/lib/routes';
import {
  buildAstrologyDetail,
  buildCompatibilityDetail,
  buildHistoryDetail,
  buildMbtiDetail,
  buildMirrorDetail,
  buildRelationshipDeepReport,
} from '@/services/premiumService';
import { buildAstrologyCompatibility } from '@/services/astrologyService';
import {
  useCompatibility,
  useConversationQuestions,
  useHistoryReport,
  useMbtiLens,
  useMirror,
  usePastObservation,
  useRepeatedSignals,
} from '@/hooks/useAnalysis';
import {
  useCrossSourceInsights,
  useDeepReportNarrative,
  useEvidenceContext,
} from '@/hooks/useAiNarrative';
import { useSession } from '@/state/SessionProvider';
import type { PremiumFeatureId } from '@/types';
import { useNavReplace } from '@/hooks/useContextualBack';

/**
 * 개발·UT용 Premium Detail 미리보기
 *
 * `NEXT_PUBLIC_PREMIUM_PREVIEW=true`일 때만 열린다. 일반 사용자는 Fake Door에서 이 화면에
 * 도달하지 못한다 — 상세 화면 자체를 검토·UT하기 위한 통로다(§15/§37).
 */
export default function PremiumPreviewPage() {
  return (
    <HydrationGate>
      <Suspense fallback={null}>
        <PremiumPreviewView />
      </Suspense>
    </HydrationGate>
  );
}

const VALID: readonly PremiumFeatureId[] = [
  'compatibility_detail',
  'mirror_detail',
  'history_detail',
  'mbti_detail',
  'astrology_detail',
  'relationship_deep_report',
];

function PremiumPreviewView() {
  const router = useRouter();
  const navReplace = useNavReplace();
  const params = useParams<{ feature: string }>();
  const { answers } = useSession();
  const [today] = useState(() => new Date());

  const raw = typeof params.feature === 'string' ? params.feature : '';
  const featureId = VALID.includes(raw as PremiumFeatureId) ? (raw as PremiumFeatureId) : null;

  /**
   * v1.10 §38/§72/§73 — UT 참여자는 Beta UT 체험이다.
   * v1.47 — 쿼리를 화면에서 직접 읽지 않는다. UT는 `lib/utMode.ts` 하나가 정하고(env · `?mode=ut` · 탭 기억),
   * UT에서는 `NEXT_PUBLIC_PREMIUM_PREVIEW`가 꺼져 있어도 이 화면이 열린다(`resolvePremiumAccess`).
   * 일반 사용자에게는 여전히 preview flag 게이트다.
   */
  const access = usePremiumAccess();
  const isBetaUt = access.utMode;
  const accessMode: 'preview' | 'beta_ut' = isBetaUt ? 'beta_ut' : 'preview';
  const analysisId = useMemo(
    () => analysisFingerprint(answers.status, answers.declared, answers.experience),
    [answers.status, answers.declared, answers.experience],
  );

  const compatibility = useCompatibility();
  const questions = useConversationQuestions();
  const mirror = useMirror();
  const historyReport = useHistoryReport();
  const repeated = useRepeatedSignals();
  const mbtiLens = useMbtiLens();
  const frictionPast = usePastObservation(compatibility.frictionSignals[0]?.key ?? null);
  const mirrorPast = usePastObservation(mirror.teaser?.axisKey ?? null);

  // v1.9 — Relationship Deep Report 전용. 다른 feature일 때도 훅은 항상 호출한다(조건 없이).
  const crossSourceInsights = useCrossSourceInsights();
  const resolverContext = useEvidenceContext();
  useEffect(() => {
    if (access.previewRouteOpen && featureId) trackEvent('premium_preview_view', { feature: featureId });
  }, [access.previewRouteOpen, featureId]);

  /**
   * v1.40.1 §38.2 — **이 화면이 v1.40 Ended Safety의 구멍이었다.**
   *
   * `/premium`의 리포트 본문은 `PREMIUM_PREVIEW` 뒤에 있어서, Deep Report 본문을 실제로
   * 여는 경로는 v1.40 시점에 이 화면뿐이었다. 그런데 여기서 `buildRelationshipDeepReport`를
   * 부를 때 Job 문맥을 **하나도 넘기지 않았고**, 그 파라미터는 optional + 기본 허용이었다.
   * 결과: `ended` 세션으로 이 화면을 열면 `먼저 연락해봐` 계열이 그대로 나왔다.
   *
   * 이제 문맥은 필수 파라미터이므로 `tsc`가 이 자리를 강제한다. 화면이 술어를 직접
   * 조합하지 않고 `deepReportJobContext()` 하나만 부른다 — 무료 화면·훅·이 화면이
   * 같은 함수를 쓴다.
   */
  const lifecycle = useMemo(
    () => deepReportJobContext(resolveRelationshipContext(answers).job),
    [answers],
  );

  /**
   * SEMANTIC DECOMPOSITION A1 — **Top 3는 AI 호출 전에 확정된다.** `useDeepReport`와 같은
   * 순서다: 결정론 리포트의 첫 화면 카드 셋을 먼저 고르고, 그 셋을 AI에게 넘긴다.
   *
   * ⚠️ 그래서 AI 훅이 `lifecycle` 아래로 내려왔다(결정론 리포트가 Job 문맥을 필수로 받는다).
   */
  const deepTopCandidates = useMemo(
    () =>
      featureId === 'relationship_deep_report'
        ? semanticTopCandidates(
            buildRelationshipDeepReport({
              insights: crossSourceInsights,
              narratives: [],
              candidateSemantics: [],
              actionPlan: null,
              resolverContext,
              compatibility,
              historyReport,
              repeatedSignals: repeated,
              target: answers.target,
              mirror,
              lifecycle,
              today: new Date(),
            }).candidates,
          )
        : [],
    [featureId, crossSourceInsights, resolverContext, compatibility, historyReport, repeated, answers.target, mirror, lifecycle],
  );
  const deepNarrative = useDeepReportNarrative(
    crossSourceInsights,
    featureId === 'relationship_deep_report',
    deepTopCandidates,
  );

  // v1.17 §10 — 무료 화면(S22/S27/F2)과 같은 방식으로 '실제로 보였다'를 1회 기록한다.
  useNarrativeViewEvent({
    task: 'deep-report-narrative',
    source: 'deep_report',
    status: deepNarrative.status,
    mode: deepNarrative.mode,
    itemCount: deepNarrative.data?.narratives.length ?? 0,
  });


  const report = useMemo(() => {
    if (!featureId) return null;

    switch (featureId) {
      case 'compatibility_detail':
        return buildCompatibilityDetail({
          result: compatibility,
          questions,
          pastObservations: frictionPast
            ? [
                {
                  label: compatibility.frictionSignals[0]?.label ?? '관찰 필요 신호',
                  text: frictionPast.text,
                },
              ]
            : [],
        });
      case 'mirror_detail':
        return buildMirrorDetail({
          mirror,
          adaptiveNote: null,
          pastObservations: mirrorPast
            ? [{ label: mirror.teaser?.axisLabel ?? '핵심 축', text: mirrorPast.text }]
            : [],
        });
      case 'history_detail':
        return buildHistoryDetail({
          report: historyReport,
          repeated,
          // v1.40.1 — `다음 관계에서 …`를 진행 중인 관계에 쓰지 않는다.
          hasCurrentRelationship: lifecycle.allowsOutwardAction,
        });
      case 'mbti_detail':
        return buildMbtiDetail(mbtiLens);
      case 'astrology_detail':
        return buildAstrologyDetail(
          buildAstrologyCompatibility(answers.birthProfile, answers.target.birthProfile, today),
        );
      case 'relationship_deep_report':
        return buildRelationshipDeepReport({
          insights: crossSourceInsights,
          narratives: deepNarrative.data?.narratives ?? [],
          candidateSemantics: deepNarrative.data?.candidateSemantics ?? [],
          actionPlan: deepNarrative.data?.actionPlan ?? null,
          resolverContext,
          compatibility,
          historyReport,
          repeatedSignals: repeated,
          target: answers.target,
          // v1.45 — Chapter Engine의 FREE 중복 게이트. 이 화면은 이미 `mirror`를 갖고 있다
          mirror,
          lifecycle,
          // v1.46 PremiumLens — 렌즈 생년월일 유효성 판정용
          today: new Date(),
        });
    }
  }, [
    featureId,
    lifecycle,
    compatibility,
    questions,
    frictionPast,
    mirror,
    mirrorPast,
    historyReport,
    repeated,
    mbtiLens,
    answers.birthProfile,
    answers.target,
    today,
    crossSourceInsights,
    deepNarrative.data,
    resolverContext,
  ]);

  // Flag OFF 또는 알 수 없는 feature — 일반 사용자에게 열어주지 않는다.
  if (!access.previewRouteOpen || !featureId || !report) {
    return (
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.home} title="상세 리포트" />}
        footer={<Button onClick={() => navReplace(ROUTES.home)}>홈으로</Button>}
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <Lovy pose="laptop" size={110} decorative />
          <p className="text-sub keep-all text-ink-sub">
            {access.previewRouteOpen ? '알 수 없는 상세 항목이야.' : '이 화면은 지금 열려 있지 않아.'}
          </p>
        </div>
      </ScreenLayout>
    );
  }

  // 출생정보 없이 Astrology 상세를 보려는 경우 등 — 근거가 없으면 만들지 않는다.
  const birth = lensAvailability(answers.birthProfile, answers.target.birthProfile, today);

  return (
    <ScreenLayout
      header={
        <ScreenHeader
          backHref={ROUTES.home}
          action={isBetaUt ? <Tag tone="neutral">BETA TEST</Tag> : undefined}
        />
      }
      footer={
        <div className="flex flex-col gap-2">
          {featureId === 'relationship_deep_report' ? (
            <Button
              onClick={() =>
                router.push(ROUTES.deepQuestions)
              }
            >
              추가 질문에 답하기
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => navReplace(ROUTES.home)}>
            홈으로
          </Button>
        </div>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-5">
        {isBetaUt ? (
          <NoticeBox>
            결제 없이 먼저 보는 리포트야. 실제 결제 화면으로 이어지지 않아 — 정밀 리포트를 경험해보고
            마지막에 몇 가지만 물어볼게.
          </NoticeBox>
        ) : null}
        <PageHeading
          lines={[PREMIUM_FEATURES[featureId].title]}
          caption={PREMIUM_FEATURES[featureId].description}
        />
        {featureId === 'astrology_detail' && !birth.couple ? null : null}
        {'overview' in report ? (
          <>
          <RelationshipDeepReportView
            report={report}
            analysisId={analysisId}
            funnelAnalysisId={answers.currentAnalysisMeta?.funnelAnalysisId ?? null}
            accessMode={accessMode}
            aiNarrative={{
              status: deepNarrative.status,
              reason: deepNarrative.reason,
              mode: deepNarrative.mode,
              retry: deepNarrative.retry,
            }}
          />
          {/* v1.47 Integration — 렌더된 뒤 저장한 관계에만 snapshot(조건은 lib/persistence/deepReportSnapshot) */}
          <DeepReportSnapshotSaver report={report} narrative={deepNarrative} />
          </>
        ) : (
          <PremiumDetailView report={report} />
        )}
      </div>
    </ScreenLayout>
  );
}
