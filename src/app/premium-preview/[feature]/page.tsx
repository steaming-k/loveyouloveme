'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { NoticeBox, PageHeading, Tag } from '@/components/common/primitives';
import { useNarrativeViewEvent } from '@/components/ai/AiModeNotice';
import { PremiumDetailView } from '@/components/premium/PremiumDetailView';
import { RelationshipDeepReportView } from '@/components/premium/RelationshipDeepReportView';
import { Lovy } from '@/components/lovy/Lovy';
import { PREMIUM_FEATURES } from '@/data/premium';
import { PREMIUM_PREVIEW } from '@/lib/env';
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
  const params = useParams<{ feature: string }>();
  const searchParams = useSearchParams();
  const { answers } = useSession();
  const [today] = useState(() => new Date());

  const raw = typeof params.feature === 'string' ? params.feature : '';
  const featureId = VALID.includes(raw as PremiumFeatureId) ? (raw as PremiumFeatureId) : null;

  /**
   * v1.10 §38/§72/§73 — `?mode=ut`이면 Beta UT 체험이다. 별도 Flag/Route 트리를 새로
   * 만들지 않고 기존 PREMIUM_PREVIEW 게이트에 쿼리로만 구분을 얹었다 — 두 대상(개발 QA ·
   * UT 참여자) 모두 '일반 프로덕션 사용자에게는 안 보인다'는 같은 게이트를 쓰기 때문이다.
   */
  const isBetaUt = searchParams.get('mode') === 'ut';
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
  const deepNarrative = useDeepReportNarrative(crossSourceInsights, featureId === 'relationship_deep_report');

  // v1.17 §10 — 무료 화면(S22/S27/F2)과 같은 방식으로 '실제로 보였다'를 1회 기록한다.
  useNarrativeViewEvent({
    task: 'deep-report-narrative',
    source: 'deep_report',
    status: deepNarrative.status,
    mode: deepNarrative.mode,
    itemCount: deepNarrative.data?.narratives.length ?? 0,
  });

  useEffect(() => {
    if (PREMIUM_PREVIEW && featureId) trackEvent('premium_preview_view', { feature: featureId });
  }, [featureId]);

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
  if (!PREMIUM_PREVIEW || !featureId || !report) {
    return (
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.home} title="상세 미리보기" />}
        footer={<Button onClick={() => router.replace(ROUTES.home)}>홈으로</Button>}
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <Lovy pose="laptop" size={110} decorative />
          <p className="text-sub keep-all text-ink-sub">
            {PREMIUM_PREVIEW
              ? '알 수 없는 상세 항목이야.'
              : '이 미리보기는 개발용이라 지금은 열려 있지 않아.'}
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
          action={<Tag tone="neutral">{isBetaUt ? 'BETA TEST' : 'PREVIEW'}</Tag>}
        />
      }
      footer={
        <div className="flex flex-col gap-2">
          {featureId === 'relationship_deep_report' ? (
            <Button
              onClick={() =>
                router.push(isBetaUt ? `${ROUTES.deepQuestions}?mode=ut` : ROUTES.deepQuestions)
              }
            >
              추가 질문에 답하기
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => router.replace(ROUTES.home)}>
            홈으로
          </Button>
        </div>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-5">
        {isBetaUt ? (
          <NoticeBox>
            테스트용 체험이야. 실제 결제 화면으로 이어지지 않아 — 정밀 리포트를 미리 경험해보고
            마지막에 몇 가지만 물어볼게.
          </NoticeBox>
        ) : null}
        <PageHeading
          lines={[PREMIUM_FEATURES[featureId].title]}
          caption={`개발용 미리보기 · ${PREMIUM_FEATURES[featureId].description}`}
        />
        {featureId === 'astrology_detail' && !birth.couple ? null : null}
        {'overview' in report ? (
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
        ) : (
          <PremiumDetailView report={report} />
        )}
      </div>
    </ScreenLayout>
  );
}
