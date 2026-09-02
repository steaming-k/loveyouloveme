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
import { DEEP_REPORT_COPY, PREMIUM_COPY, PREMIUM_FEATURES } from '@/data/premium';
import { PREMIUM_FAKE_DOOR } from '@/lib/env';
import { trackEvent } from '@/lib/analytics';
import { hasNotifyIntent, markNotifyIntent, recordPremiumIntent } from '@/lib/premiumIntentStore';
import {
  formatPrice,
  priceForScreenReader,
  resolvePrice,
  resolvePriceVariant,
} from '@/lib/premiumVariant';
import { ROUTES } from '@/lib/routes';
import { useHistoryReport, useMbtiLens, useMirror } from '@/hooks/useAnalysis';
import { useCrossSourceInsights } from '@/hooks/useAiNarrative';
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
 */
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
  compatibility: ROUTES.compatibilityWhy,
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
  const backHref = BACK_BY_SOURCE[source] ?? ROUTES.compatibilityWhy;

  const [variant] = useState(() => resolvePriceVariant());
  const [today] = useState(() => new Date());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notified, setNotified] = useState(false);

  const isDeepReport = featureId === 'relationship_deep_report';
  const copy = isDeepReport ? DEEP_REPORT_COPY : PREMIUM_COPY;

  // 상세를 만들 근거가 있는지 판정하기 위해 현재 분석 상태를 읽는다(계산은 하지 않는다).
  const mirror = useMirror();
  const historyReport = useHistoryReport();
  const mbtiLens = useMbtiLens();
  const birth = lensAvailability(answers.birthProfile, answers.target.birthProfile, today);
  // Cross-source Insight가 없으면 Deep Report Paywall 자체를 띄우지 않는다(§40).
  const crossSourceInsights = useCrossSourceInsights();

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
    trackEvent('premium_paywall_view', { feature: featureId, source, price, variant });
  }, [featureId, source, price, variant, feature.status]);

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
    trackEvent('premium_purchase_intent', { feature: featureId, source, price, variant });
    recordPremiumIntent({
      feature: featureId,
      source,
      price,
      variant,
      clickedAt: new Date().toISOString(),
      notifyIntent: false,
    });

    // ② 즉시 '준비 중' 공개 — 결제 화면으로 가지 않는다
    trackEvent('premium_fake_door_reveal', { feature: featureId, source });
    setSheetOpen(true);
  };

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
          <div className="flex flex-col gap-2">
            <Button onClick={handlePurchaseIntent}>
              {copy.purchaseCta}
              <span className="sr-only"> — {priceForScreenReader(price)}, 상세 분석 1회</span>
            </Button>
            {/* 닫기 경로를 항상 보이게 둔다 — 숨기면 Dark Pattern이다(§49) */}
            <Button
              variant="text"
              onClick={() => {
                trackEvent('premium_dismiss', { feature: featureId, source, step: 'paywall' });
                router.replace(backHref);
              }}
            >
              {copy.dismissCta}
            </Button>
          </div>
        }
        bodyClassName="pt-1.5 pb-4"
      >
        <div className="flex flex-col gap-5">
          <PageHeading lines={copy.paywallTitle} caption={definition.description} />

          <LovyMessage pose="chart" size={52}>
            {copy.paywallLovy}
          </LovyMessage>

          {/* §37 Premium Preview — 전체를 스포일링하지 않고 3개만 살짝 보여준다 */}
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
              <p className="px-1 text-meta keep-all text-ink-muted">
                {DEEP_REPORT_COPY.previewLocked}
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

          <NoticeBox>
            무료로 본 결과는 그대로 볼 수 있어요. 상세는 같은 데이터를 더 깊게 보는 거예요.
          </NoticeBox>
        </div>
      </ScreenLayout>

      {/* Fake Door reveal — 결제가 진행되지 않았다는 사실을 먼저 말한다 */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          trackEvent('premium_dismiss', { feature: featureId, source, step: 'fake_door' });
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
                trackEvent('premium_notify_intent', { feature: featureId, source });
                markNotifyIntent(featureId);
                setNotified(true);
                showToast('관심 표시를 기록했어요');
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
              trackEvent('premium_dismiss', { feature: featureId, source, step: 'fake_door' });
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
