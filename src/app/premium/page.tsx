'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { NoticeBox, PageHeading, SectionLabel, Tag } from '@/components/common/primitives';
import { useToast } from '@/components/common/ToastProvider';
import { Lovy } from '@/components/lovy/Lovy';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { PremiumUnlockSuccess } from '@/components/premium/PremiumUnlockSuccess';
import { RelationshipDeepReportView } from '@/components/premium/RelationshipDeepReportView';
import { ReportHeader } from '@/components/report/ReportShell';
import { DEEP_REPORT_COPY, PREMIUM_COPY, PREMIUM_FEATURES } from '@/data/premium';
import { PREMIUM_FAKE_DOOR, PREMIUM_PREVIEW, UT_MODE } from '@/lib/env';
import { UtRatingCard } from '@/components/ut/UtRatingCard';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { formatEntryDate } from '@/lib/historyFormat';
import { MOTION, prefersReducedMotion } from '@/lib/motion';
import {
  grantPreviewUnlock,
  hasPreviewUnlock,
  type PremiumAccessMode,
} from '@/lib/premiumAccess';
import { hasNotifyIntent, markNotifyIntent, recordPremiumIntent } from '@/lib/premiumIntentStore';
import {
  formatPrice,
  priceForScreenReader,
  resolvePrice,
  resolvePriceVariant,
} from '@/lib/premiumVariant';
import { revisitHref, type RevisitSource } from '@/lib/resultView';
import { ROUTES } from '@/lib/routes';
import { useHistoryReport, useMbtiLens, useMirror } from '@/hooks/useAnalysis';
import { useDeepReport } from '@/hooks/useDeepReport';
import { lensAvailability } from '@/lib/logic/birth';
import { premiumFeatureState } from '@/services/premiumService';
import { useSession } from '@/state/SessionProvider';
import type { PremiumFeatureId, PremiumSource } from '@/types';

/**
 * P1 Premium Paywall — **Fake Door**
 *
 * ⚠️ 실제 결제를 진행하지 않는다. 카드 정보를 받지 않고, 결제가 가능한 것처럼 표시하지 않으며,
 * 결제 완료 화면을 만들지 않는다. `상세 분석 열기`를 누르면 의향만 기록하고 **곧바로**
 * '준비 중'임을 알린다(§2/§13).
 *
 * Flag가 꺼져 있으면 이 화면에 머무르지 않고 결과 화면으로 되돌려보낸다(§36/§37).
 *
 * ── vNext: Paywall → Success → Deep Report 를 **한 Route 안의 stage**로 연결한다 ──
 *
 * 새 Route를 만들지 않았다. Route를 갈면 스크롤·헤더·푸터가 전부 리마운트돼서 "같은 공간에서
 * 이어진다"는 느낌(§5/§6 layout continuity)이 깨지기 때문이다. 대신 이 화면이
 * `paywall → leaving → success → revealing → report` 다섯 stage를 갖는다.
 *
 * ⚠️ **Fake Door 경계(§12).** 위 stage는 `NEXT_PUBLIC_PREMIUM_PREVIEW=true`이고
 * flagship Deep Report일 때만 열린다. 그 밖의 모든 경우(= Production 사용자)는 v1.19와
 * **완전히 같은** 동작을 본다 — 의향만 기록하고 곧바로 '준비 중' BottomSheet가 뜬다.
 * Preview에서도 '결제가 완료됐어'라고 말하지 않는다(`UNLOCK_COPY.preview`).
 *
 * 실제 PG가 붙으면 성공 callback에서 `unlockMode = 'payment'`로 같은 stage를 재사용하면
 * 된다 — 이번 작업에서 PG SDK·결제 서버·webhook·주문 DB는 만들지 않았다(§13).
 */

/**
 * stage 전환 시간. 전부 **presentation layer 전용**이다 — 실제 처리를 늦추지 않는다(§4).
 *   leaving   Paywall 표면이 물러난다
 *   success   Unlock 확인(등장 260ms + 인지 300ms)
 *   revealing Success → Report 전환. 여기가 요청받은 "약 0.3초"다
 */
const PAYWALL_EXIT_MS = 200;
const SUCCESS_HOLD_MS = 560;
const SUCCESS_EXIT_MS = MOTION.normal;
/** prefers-reduced-motion — 전환을 없애고 상태 변화만 짧게 인지시킨다(§11) */
const REDUCED_HOLD_MS = 500;

type UnlockStage = 'paywall' | 'leaving' | 'success' | 'revealing' | 'report';
export default function PremiumPage() {
  return (
    <HydrationGate>
      <Suspense fallback={null}>
        <PremiumView />
      </Suspense>
    </HydrationGate>
  );
}

/**
 * source → 어느 Feature의 상세인지.
 *
 * v1.9 — compatibility/mirror/history 세 진입점을 하나의 flagship
 * `relationship_deep_report`로 합친다(§55: '더 긴 설명'이 아니라 '더 연결해서 보는 것'이
 * Premium의 차이라서, 각각 따로 팔던 상세 3개를 다시 만들지 않고 하나로 모았다).
 * MBTI/Astrology/Saju는 이번 범위 밖이라 그대로 둔다(§44).
 */
const FEATURE_BY_SOURCE: Record<string, PremiumFeatureId> = {
  compatibility: 'relationship_deep_report',
  mirror: 'relationship_deep_report',
  history: 'relationship_deep_report',
  mbti: 'mbti_detail',
  astrology: 'astrology_detail',
  // 직접 URL로 들어오면 unavailable 안내로 이어진다 — 사주 상세는 팔 수 있는 상태가 아니다.
  saju: 'saju_detail',
};

/** source → 닫았을 때 돌아갈 곳 */
const BACK_BY_SOURCE: Record<string, string> = {
  // v1.11 — S22 Detail이 Compatibility Result(`/compatibility`)로 합쳐졌다.
  compatibility: ROUTES.compatibility,
  mirror: ROUTES.mirror,
  history: ROUTES.historyReport,
  mbti: ROUTES.lensMbti,
  astrology: ROUTES.lensAstrology,
  saju: ROUTES.lensSaju,
};

function PremiumView() {
  const router = useRouter();
  const params = useSearchParams();
  const { showToast } = useToast();
  const { answers } = useSession();

  const source = (params.get('source') ?? 'compatibility') as PremiumSource;
  const featureId = FEATURE_BY_SOURCE[source] ?? 'compatibility_detail';
  /**
   * v1.19 §29 — Post-analysis IA 회귀 방지. Revisit으로 결과를 다시 보던 사용자가 Premium을
   * 닫으면 예전에는 `?view=revisit`이 빠진 맨 Route로 돌아가서 **v1.18 Bottom Navigation이
   * 사라지고** 최초 Funnel 화면(Sticky CTA만 있는)으로 떨어졌다 — 실측으로 확인한 회귀다.
   * `returnTo`가 유효한 `RevisitSource`일 때만 Revisit URL을 복원한다. 임의 URL은 받지
   * 않는다 — 값 하나를 화이트리스트로 검사하고 경로는 여기서 직접 만든다.
   */
  const rawReturnTo = params.get('returnTo');
  const returnTo: RevisitSource | null =
    rawReturnTo === 'home' || rawReturnTo === 'history' || rawReturnTo === 'share' || rawReturnTo === 'direct'
      ? rawReturnTo
      : null;
  const baseBackHref = BACK_BY_SOURCE[source] ?? ROUTES.compatibility;
  const backHref = returnTo ? revisitHref(baseBackHref, returnTo) : baseBackHref;
  // v1.15 §8 — 어느 Contextual Hook에서 들어왔는지. 순수 Analytics 구분용이라 없어도
  // Paywall이 보여줄 Feature 자체(FEATURE_BY_SOURCE)에는 영향을 주지 않는다.
  const hookVariant = params.get('hook') ?? undefined;
  const [wtpChoice, setWtpChoice] = useState<'yes' | 'maybe' | 'no' | null>(null);
  /**
   * v1.19 §3 — Hook Attribution 키. `PremiumEntryRow`와 **같은 세션 값**을 직접 읽는다
   * (URL로 넘기지 않는다) — entry_view → entry_click → paywall_view → purchase_intent가
   * 전부 같은 값을 갖게 되고, 주소창을 편집해도 attribution이 조작되지 않는다.
   */
  const funnelAnalysisId = answers.currentAnalysisMeta?.funnelAnalysisId ?? null;
  const attribution: Record<string, string> = funnelAnalysisId
    ? { funnel_analysis_id: funnelAnalysisId }
    : {};

  const [variant] = useState(() => resolvePriceVariant());
  const [today] = useState(() => new Date());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notified, setNotified] = useState(false);

  const isDeepReport = featureId === 'relationship_deep_report';
  const copy = isDeepReport ? DEEP_REPORT_COPY : PREMIUM_COPY;

  /* ── vNext Unlock stage ──────────────────────────────────────────────────
     `?mode=ut`이면 UT 참여자 체험이다 — `/premium-preview/[feature]?mode=ut`와 같은 규칙을
     쓴다. 새 Flag/Route 트리를 만들지 않고 기존 PREMIUM_PREVIEW 게이트에 쿼리만 얹는다. */
  const isBetaUt = params.get('mode') === 'ut';
  const [stage, setStage] = useState<UnlockStage>('paywall');
  const [unlockMode, setUnlockMode] = useState<PremiumAccessMode | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // 렌더 분기가 아니라 클라이언트 전용 effect에서만 읽는다(hydration 안전).
    setReducedMotion(prefersReducedMotion());
  }, []);

  /**
   * Deep Report 조립. `enabled`는 **AI Narrative 요청만** 켠다 — Paywall에 머무는 동안에는
   * 호출하지 않고(결제/Unlock 이전에 유료 AI를 태우지 않는다), Unlock을 누른 순간부터
   * 전환 애니메이션이 흐르는 동안 미리 받아온다. 규칙 기반 리포트는 항상 준비돼 있다.
   */
  const deep = useDeepReport(isDeepReport && stage !== 'paywall');
  const crossSourceInsights = deep.insights;

  // 상세를 만들 근거가 있는지 판정하기 위해 현재 분석 상태를 읽는다(계산은 하지 않는다).
  const mirror = useMirror();
  const historyReport = useHistoryReport();
  const mbtiLens = useMbtiLens();
  const birth = lensAvailability(answers.birthProfile, answers.target.birthProfile, today);
  const price = resolvePrice(variant);
  const feature = useMemo(
    () =>
      premiumFeatureState(featureId, price, {
        mirrorAvailable: mirror.available,
        historyComparable: historyReport.comparable,
        mbtiAvailable: Boolean(mbtiLens),
        astrologyAvailable: birth.couple,
        deepReportAvailable: crossSourceInsights.length > 0,
      }),
    [
      featureId,
      price,
      mirror.available,
      historyReport.comparable,
      mbtiLens,
      birth.couple,
      crossSourceInsights.length,
    ],
  );

  /**
   * §12 Fake Door 경계 — 이 세 조건이 모두 참일 때만 Unlock stage가 열린다.
   * Production(`PREMIUM_PREVIEW=false`)에서는 항상 false라 기존 Fake Door 그대로다.
   */
  const canPreviewUnlock =
    PREMIUM_PREVIEW && isDeepReport && feature.status === 'fake-door';

  const definition = PREMIUM_FEATURES[featureId];
  // §37 — Paywall 전에 살짝 보여줄 3개 요약. 전체 근거·해석은 잠긴 채로 둔다.
  const previewSummaries = isDeepReport
    ? crossSourceInsights.slice(0, 3).map((insight) => insight.ruleSummary)
    : [];

  // Flag OFF — Paywall에 머무르지 않는다.
  useEffect(() => {
    if (!PREMIUM_FAKE_DOOR) router.replace(backHref);
  }, [router, backHref]);

  useEffect(() => {
    setNotified(hasNotifyIntent(featureId));
  }, [featureId]);

  /**
   * paywall_view는 Paywall Intent Rate의 **분모**다. StrictMode의 이중 호출이나 리렌더로
   * 중복 발생하면 지표가 망가지므로, 이 화면 인스턴스에서 feature당 한 번만 보낸다.
   * (세션 전체 dedup은 쓰지 않는다 — 사용자가 다시 방문한 건 실제로 다시 본 것이다.)
   */
  const paywallViewSent = useRef<string | null>(null);

  useEffect(() => {
    if (!PREMIUM_FAKE_DOOR || feature.status !== 'fake-door') return;
    if (paywallViewSent.current === featureId) return;
    paywallViewSent.current = featureId;
    trackEvent('premium_paywall_view', {
      feature: featureId,
      source,
      price,
      variant,
      ...(hookVariant ? { hook_variant: hookVariant } : {}),
      ...(funnelAnalysisId ? { funnel_analysis_id: funnelAnalysisId } : {}),
    });
  }, [featureId, source, price, variant, feature.status, hookVariant, funnelAnalysisId]);

  /**
   * Preview Unlock이 열려 있는 분석이면(같은 탭에서 새로고침·뒤로가기) Paywall을 다시
   * 보여주지 않고 리포트로 복원한다. 실제 구매 기록이 아니라 **탭 한정 Preview 상태**다
   * (`lib/premiumAccess.ts`) — 탭을 닫거나 새 상대를 분석하면 사라진다.
   */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !canPreviewUnlock) return;
    if (!hasPreviewUnlock(featureId, funnelAnalysisId)) return;
    restoredRef.current = true;
    setUnlockMode(isBetaUt ? 'beta_ut' : 'preview');
    setStage('report');
  }, [canPreviewUnlock, featureId, funnelAnalysisId, isBetaUt]);

  /** stage 타이머. 여기서 하는 일은 화면 전환뿐이다 — 어떤 처리도 지연시키지 않는다. */
  useEffect(() => {
    if (stage === 'paywall' || stage === 'report') return;

    const next: UnlockStage =
      stage === 'leaving' ? 'success' : stage === 'success' ? 'revealing' : 'report';
    const ms =
      stage === 'leaving'
        ? reducedMotion
          ? 0
          : PAYWALL_EXIT_MS
        : stage === 'success'
          ? reducedMotion
            ? REDUCED_HOLD_MS
            : SUCCESS_HOLD_MS
          : reducedMotion
            ? 0
            : SUCCESS_EXIT_MS;

    const timer = setTimeout(() => setStage(next), ms);
    return () => clearTimeout(timer);
  }, [stage, reducedMotion]);

  /**
   * 새 이벤트를 만들지 않는다(§14). 리포트가 실제로 렌더되는 시점에 기존
   * `premium_preview_view`를 그대로 쓴다 — `/premium-preview/[feature]`가 보내던 것과
   * 같은 의미(= Preview 상세를 봤다)이고 property도 같다. `payment_success` 같은 실제
   * 결제 이벤트는 만들지 않는다 — 실제 결제가 아니기 때문이다.
   */
  const previewViewSent = useRef(false);
  useEffect(() => {
    if (stage !== 'report' || previewViewSent.current) return;
    previewViewSent.current = true;
    trackEvent('premium_preview_view', { feature: featureId });
  }, [stage, featureId]);

  if (!PREMIUM_FAKE_DOOR) return null;

  /* 상세를 만들 근거가 없으면 Paywall을 띄우지 않는다 — 가격도 CTA도 보여주지 않는다(§40) */
  if (feature.status === 'unavailable') {
    return (
      <ScreenLayout
        header={<ScreenHeader backHref={backHref} title="상세 분석" />}
        footer={<Button variant="secondary" onClick={() => router.replace(backHref)}>돌아가기</Button>}
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 px-3.5 pb-10 text-center">
          <Lovy pose="mug" size={110} decorative />
          <h2 className="text-section keep-all">{copy.unavailableTitle}</h2>
          <p className="text-sub keep-all leading-relaxed text-ink-sub">
            {feature.unavailableReason}
          </p>
        </div>
      </ScreenLayout>
    );
  }

  const handlePurchaseIntent = () => {
    // ① 의향 기록 (연락처는 받지 않는다)
    trackEvent('premium_purchase_intent', {
      feature: featureId,
      source,
      price,
      variant,
      ...(hookVariant ? { hook_variant: hookVariant } : {}),
      ...attribution,
    });
    recordPremiumIntent({
      feature: featureId,
      source,
      price,
      variant,
      clickedAt: new Date().toISOString(),
      notifyIntent: false,
    });

    // ②-a Preview/UT — '결제 완료 → 리포트 공개' 경험을 검증하는 통로(§12).
    //     Fake Door를 '열었다'고 기록하지 않는다 — 준비 중 안내를 보여주지 않았으므로
    //     `premium_fake_door_reveal`의 의미(= 사용자에게 미출시임을 알림)에 맞지 않는다.
    //     이 분기는 PREMIUM_PREVIEW가 켜진 개발·UT 환경에서만 실행된다.
    if (canPreviewUnlock) {
      grantPreviewUnlock(featureId, funnelAnalysisId);
      setUnlockMode(isBetaUt ? 'beta_ut' : 'preview');
      setStage(reducedMotion ? 'success' : 'leaving');
      return;
    }

    // ②-b 즉시 '준비 중' 공개 — 결제 화면으로 가지 않는다 (v1.19와 동일)
    trackEvent('premium_fake_door_reveal', {
      feature: featureId,
      source,
      ...(hookVariant ? { hook_variant: hookVariant } : {}),
      ...attribution,
    });
    setSheetOpen(true);
  };

  const showSuccess = stage === 'success' || stage === 'revealing';
  const showReport = stage === 'report';
  /** 카드로 실제 보여줄 Insight 개수 — 가짜 숫자를 만들지 않는다(§7) */
  const connectedSignalCount =
    deep.report.crossSourceInsights.length + deep.report.relationshipSelf.length;

  return (
    <>
      <ScreenLayout
        header={
          <ScreenHeader
            backHref={backHref}
            action={<Tag tone="brand">{isDeepReport ? copy.entryLabel : PREMIUM_COPY.badge}</Tag>}
          />
        }
        footer={
          /*
            Success 이후에는 Paywall CTA를 남기지 않는다 — 이미 열린 리포트 아래에 '열기'
            버튼이 남아 있으면 두 번 결제하는 것처럼 보인다. Success와 Report가 같은 footer를
            쓰므로 그 두 stage 사이에는 하단 layout shift가 없다(§16).
          */
          showSuccess || showReport ? (
            <Button
              variant="secondary"
              onClick={() => {
                trackEvent('premium_dismiss', {
                  feature: featureId,
                  source,
                  step: 'report',
                  ...(hookVariant ? { hook_variant: hookVariant } : {}),
                  ...attribution,
                });
                router.replace(backHref);
              }}
            >
              결과로 돌아가기
            </Button>
          ) : (
          <div className="flex flex-col gap-2">
            {/* §5 — CTA press는 scale 1 → 0.97 → 1(150ms). 전역 Button을 바꾸지 않는다 */}
            <Button className="press-scale" onClick={handlePurchaseIntent}>
              {copy.purchaseCta}
              <span className="sr-only"> — {priceForScreenReader(price)}, 상세 분석 1회</span>
            </Button>
            {/* 닫기 경로를 항상 보이게 둔다 — 숨기면 Dark Pattern이다(§49) */}
            <Button
              variant="text"
              onClick={() => {
                trackEvent('premium_dismiss', {
                  feature: featureId,
                  source,
                  step: 'paywall',
                  ...(hookVariant ? { hook_variant: hookVariant } : {}),
      ...attribution,
                });
                router.replace(backHref);
              }}
            >
              {copy.dismissCta}
            </Button>
          </div>
          )
        }
        bodyClassName="pt-1.5 pb-4"
      >
        {/*
          §6 Shared Visual Continuity — 세 stage가 같은 Route·같은 ScreenLayout·같은 헤더를
          쓴다. `PRECISION REPORT` 라벨이 헤더 Tag → Unlock Success eyebrow → Report Header
          eyebrow 로 같은 자리에 남아, 새 transition 라이브러리 없이도 '같은 것이 열린다'는
          연속성이 생긴다.
        */}
        {showReport ? (
          <RelationshipDeepReportView
            report={deep.report}
            resolverContext={deep.resolverContext}
            analysisId={deep.analysisId}
            funnelAnalysisId={funnelAnalysisId}
            accessMode={unlockMode ?? 'preview'}
            reveal={!reducedMotion}
            header={
              <ReportHeader
                eyebrow={DEEP_REPORT_COPY.entryLabel}
                title={`신호 ${connectedSignalCount}개를 연결한 관찰 기록`}
                meta={[
                  `연결한 신호 ${connectedSignalCount}개`,
                  `${formatEntryDate(today.toISOString())} 작성`,
                ]}
              />
            }
            aiNarrative={{
              status: deep.narrative.status,
              reason: deep.narrative.reason,
              mode: deep.narrative.mode,
              retry: deep.narrative.retry,
            }}
          />
        ) : showSuccess ? (
          <PremiumUnlockSuccess
            mode={unlockMode ?? 'preview'}
            price={price}
            connectedSignalCount={connectedSignalCount}
            animate={!reducedMotion}
            leaving={stage === 'revealing'}
          />
        ) : (
        <div className={cn('flex flex-col gap-5', stage === 'leaving' && 'stage-exit')}>
          <PageHeading lines={copy.paywallTitle} caption={definition.description} />

          <LovyMessage pose="chart" size={52}>
            {copy.paywallLovy}
          </LovyMessage>

          {/*
            v1.19 §7 — '무료랑 뭐가 다른가'에 5초 안에 답하게 하는 한 줄짜리 대비.
            아래 freeRecap/additions 목록을 대체하지 않는다 — 그 목록은 '무엇이 들어있나'를,
            이 두 줄은 '왜 다른가'를 말한다. 비교표를 새로 만들지 않는다(§7).
          */}
          {isDeepReport && (
            <section className="flex flex-col gap-2">
              <SectionLabel>{DEEP_REPORT_COPY.contrastLabel}</SectionLabel>
              <dl className="flex flex-col divide-y divide-line-soft rounded-card border border-line bg-surface">
                {[DEEP_REPORT_COPY.contrastFree, DEEP_REPORT_COPY.contrastPremium].map(
                  (row, index) => (
                    <div key={row.tag} className="flex items-baseline gap-3 px-4 py-3">
                      <dt
                        className={cn(
                          'w-[74px] flex-none text-[10.5px] font-semibold tracking-[0.04em]',
                          index === 0 ? 'text-ink-muted' : 'text-brand-pressed',
                        )}
                      >
                        {row.tag}
                      </dt>
                      <dd
                        className={cn(
                          'min-w-0 text-[12.5px] keep-all leading-relaxed',
                          index === 0 ? 'text-ink-sub' : 'font-medium text-ink',
                        )}
                      >
                        {row.text}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            </section>
          )}

          {/*
            §37 Premium Preview — 전체를 스포일링하지 않고 3개만 살짝 보여준다.
            v1.19 §8 — 이 3개는 **현재 사용자의 Cross-source Insight**에서 나온 문장이라
            이미 개인화돼 있다(`ruleSummary`는 판정된 축 라벨을 담는다). 문장을 중간에서
            자르지 않고 완결된 채로 보여주고, 잠긴 것은 아래 목차로 정직하게 알린다.
          */}
          {isDeepReport && previewSummaries.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionLabel>{DEEP_REPORT_COPY.previewLabel}</SectionLabel>
              <ul className="flex flex-col gap-1.5">
                {previewSummaries.map((summary, index) => (
                  <li
                    key={index}
                    className="rounded-card border border-line bg-surface p-3.5 text-[12.5px] keep-all leading-relaxed text-ink-sub"
                  >
                    {summary}
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col gap-1.5 rounded-card border border-dashed border-line-strong bg-sunken p-4">
                {DEEP_REPORT_COPY.previewLockedItems.map((item) => (
                  <li key={item} className="flex gap-2 text-[12px] keep-all text-ink-muted">
                    <span className="flex-none" aria-hidden>
                      🔒
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="px-1 text-meta keep-all text-ink-muted">
                {/* §7 — 실제 계산값만 쓴다. 남은 게 없으면 개수를 말하지 않는다. */}
                {crossSourceInsights.length > previewSummaries.length
                  ? `아직 연결해서 보여주지 않은 신호 ${crossSourceInsights.length - previewSummaries.length}개 · ${DEEP_REPORT_COPY.previewLocked}`
                  : DEEP_REPORT_COPY.previewLocked}
              </p>
            </section>
          )}

          {/* 무료로 이미 본 것 — Premium이 기존 가치를 빼앗은 게 아니라는 걸 명확히 한다 */}
          <section className="flex flex-col gap-2">
            <SectionLabel>{copy.freeRecapLabel}</SectionLabel>
            <ul className="flex flex-col gap-1.5 rounded-card border border-line bg-surface p-4">
              {definition.freeRecap.map((item) => (
                <li key={item} className="flex gap-2 text-[12.5px] keep-all text-ink-sub">
                  <span className="flex-none text-mint-text" aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* 상세에서 추가되는 것 — 무엇을 사는지 모르면 CTA도 의미가 없다 */}
          <section className="flex flex-col gap-2">
            <SectionLabel>{copy.additionsLabel}</SectionLabel>
            <ul className="flex flex-col gap-1.5 rounded-card border border-brand-edge bg-brand-tint p-4">
              {definition.additions.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-[12.5px] keep-all font-medium text-brand-ink"
                >
                  <span className="flex-none text-brand-pressed" aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* 가격 — 1회 결제 후보임을 명확히. 정가/할인/긴급성 표현 없음 */}
          <section className="flex items-baseline justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3.5">
            <span className="text-[10.5px] font-semibold tracking-[0.06em] text-ink-muted">
              {copy.priceNote}
            </span>
            <span className="text-[19px] font-semibold tracking-[-0.4px] tnum">
              {formatPrice(price)}
              <span className="sr-only"> ({priceForScreenReader(price)})</span>
            </span>
          </section>

          {/*
            v1.19 §6 — '내 데이터가 실제로 들어가는가?'에 답한다. 새 데이터를 더 받지 않고,
            **이미 답한 것**을 연결한다는 사실을 개수로 말한다. 개수는 이 세션에서 실제로
            계산된 값이라 사용자마다 다르다 — 마케팅 문구가 아니라 사실이다.
          */}
          {isDeepReport ? (
            <NoticeBox>
              지금 네 답변에서 연결된 신호가 {crossSourceInsights.length}개 나왔어. 새로 물어보는
              건 없고, 무료로 본 결과도 그대로 볼 수 있어.
            </NoticeBox>
          ) : (
            <NoticeBox>
              무료로 본 결과는 그대로 볼 수 있어. 상세는 같은 데이터를 더 깊게 보는 거야.
            </NoticeBox>
          )}

          {/*
            v1.15 §10 — Premium 가격/가치 검증 UT. 질문을 많이 추가하지 않는다(2개 이내).
            이미 있던 DeepReportUtFlow의 WTP 질문(step 4)과는 대상이 다르다 — 그건 전체
            리포트를 다 본 사람에게 "다시 볼 의향"을 묻고, 이건 무료 결과 + 이 Preview만 본
            사람에게 "지금 결제할 의향"을 묻는다. 실제 결제 전까지는 '의향'으로만 기록한다.
          */}
          <UtRatingCard
            question="이 리포트에서 무료 결과와 다른 가치를 느꼈어?"
            event="ut_premium_value_diff_rate"
            properties={{ feature: featureId, source, price, ...attribution }}
            lowLabel="전혀 못 느꼈어"
            highLabel="확실히 다르게 느꼈어"
          />
          <PremiumWtpQuestion
            featureId={featureId}
            source={source}
            price={price}
            attribution={attribution}
            choice={wtpChoice}
            onSelect={setWtpChoice}
          />
        </div>
        )}
      </ScreenLayout>

      {/* Fake Door reveal — 결제가 진행되지 않았다는 사실을 먼저 말한다 */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          trackEvent('premium_dismiss', {
            feature: featureId,
            source,
            step: 'fake_door',
            ...(hookVariant ? { hook_variant: hookVariant } : {}),
      ...attribution,
          });
          setSheetOpen(false);
        }}
        title={copy.fakeDoorTitle}
        description={copy.fakeDoorBody}
      >
        <div className="flex flex-col gap-3">
          {notified ? (
            <div className="flex items-center gap-2 rounded-chip bg-mint-tint px-3.5 py-3">
              <span className="text-mint-text" aria-hidden>
                ✓
              </span>
              <p className="text-caption font-medium text-mint-ink" role="status">
                {copy.notifyDoneLabel}
              </p>
            </div>
          ) : (
            <Button
              onClick={() => {
                trackEvent('premium_notify_intent', { feature: featureId, source, ...attribution });
                markNotifyIntent(featureId);
                setNotified(true);
                showToast('관심 표시를 기록했어');
              }}
            >
              {copy.notifyCta}
            </Button>
          )}

          <p className="px-1 text-meta keep-all leading-relaxed text-ink-muted">
            {copy.notifyNote}
          </p>

          <Button
            variant="secondary"
            onClick={() => {
              trackEvent('premium_dismiss', {
                feature: featureId,
                source,
                step: 'fake_door',
                ...(hookVariant ? { hook_variant: hookVariant } : {}),
      ...attribution,
              });
              setSheetOpen(false);
              router.replace(backHref);
            }}
          >
            {copy.fakeDoorDismiss}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

/**
 * v1.15 §10 Q2 — "1,900원을 내고 전체 리포트를 볼 의향이 있어?" 3지선다.
 * `UtRatingCard`와 같은 lock-after-answer 패턴을 쓰지만 척도가 아니라 선택지라 별도로 둔다.
 * `UT_MODE`가 꺼져 있으면 아무것도 렌더하지 않는다(다른 UT 컴포넌트와 동일한 가드).
 */
function PremiumWtpQuestion({
  featureId,
  source,
  price,
  attribution,
  choice,
  onSelect,
}: {
  featureId: PremiumFeatureId;
  source: PremiumSource;
  price: number;
  /** v1.19 §3 — `funnel_analysis_id`. 없으면 빈 객체라 property가 붙지 않는다 */
  attribution: Record<string, string>;
  choice: 'yes' | 'maybe' | 'no' | null;
  onSelect: (value: 'yes' | 'maybe' | 'no') => void;
}) {
  if (!UT_MODE) return null;

  const options: { value: 'yes' | 'maybe' | 'no'; label: string }[] = [
    { value: 'yes', label: '실제로 결제할 의향이 있다' },
    { value: 'maybe', label: '결과를 더 봐야 판단할 수 있다' },
    { value: 'no', label: '무료 결과로 충분하다' },
  ];

  return (
    <section className="flex flex-col gap-2.5 rounded-card border border-dashed border-line-strong bg-canvas-warm p-4">
      <span className="w-fit rounded-tag bg-chip px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-ink-muted">
        UT
      </span>
      <p className="text-caption keep-all leading-relaxed">
        {formatPrice(price)}을 내고 전체 리포트를 볼 의향이 있어?
      </p>
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="결제 의향">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={choice === option.value}
            disabled={choice !== null}
            onClick={() => {
              trackEvent('ut_premium_price_wtp', {
                feature: featureId,
                source,
                price,
                choice: option.value,
                ...attribution,
              });
              onSelect(option.value);
            }}
            className={cn(
              'min-h-11 rounded-[10px] border px-3.5 py-2.5 text-left text-caption disabled:opacity-60',
              choice === option.value
                ? 'border-brand bg-brand-tint font-semibold text-ink'
                : 'border-line bg-surface active:bg-sunken',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {choice ? (
        <p className="text-[11px] keep-all text-ink-faint">
          기록했어. 실제 결제 전까지는 의향으로만 남겨둘게.
        </p>
      ) : (
        <p className="text-[10.5px] keep-all text-ink-faint">실제 결제가 아니라 의향을 묻는 질문이야.</p>
      )}
    </section>
  );
}
