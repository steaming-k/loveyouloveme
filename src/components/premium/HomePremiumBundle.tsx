'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { SectionLabel } from '@/components/common/primitives';
import { LENS_ANCHOR, LENS_SHORT_LABEL, PREMIUM_BUNDLE_COPY } from '@/data/premiumLens';
import { trackEvent } from '@/lib/analytics';
import { PREMIUM_FAKE_DOOR } from '@/lib/env';
import {
  formatPrice,
  priceForScreenReader,
  resolvePrice,
  resolvePriceVariant,
} from '@/lib/premiumVariant';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';
import type { PremiumFeature, PremiumLensKind, PremiumSource } from '@/types';

/**
 * Home 하단 Premium Bundle (v1.46 PremiumLens · §32~§35)
 *
 * ══ 왜 이 블록이 생겼나 ═══════════════════════════════════════════════════
 *
 * MBTI · 사주 · 별자리 분석은 v1.4부터 있었는데 **찾을 수가 없었다.** 진입 경로가
 * 궁합 결과 안쪽의 '다른 렌즈' 허브 하나뿐이라, 결과 화면을 지나친 사용자는
 * 그 기능이 있다는 사실 자체를 몰랐다.
 *
 * ⚠️ **그래서 텍스트 한 줄로 끝내지 않았다**(§33). `MBTI · 사주 · 별자리 포함`
 * 같은 문장은 읽히기는 해도 눌리지 않는다. 눌 수 있는 요소 3개를 실제로 둔다.
 *
 * ══ ⚠️ 가격은 한 번만 (§35) ═══════════════════════════════════════════════
 *
 * 렌즈 버튼 3개에는 **가격을 넣을 자리 자체가 없다.** 값이 비어 있는 게 아니라
 * 마크업에 없다 — 나중에 누가 채워 넣을 수 없게 하려는 것이다. 가격은 이 블록
 * 헤더에 Bundle 기준으로 한 번, 그리고 Paywall에서 한 번 나온다.
 *
 * ══ ⚠️ Home의 위계를 이기지 않는다 ═══════════════════════════════════════
 *
 * `PremiumEntryRow`가 v1.5부터 지켜온 규칙과 같다 — 이 블록은 Home의 primary
 * CTA('새로운 사람과 궁합 보기')보다 강해지지 않는다. 그래서 Button이 아니라
 * 테두리 카드이고, 브랜드 색은 CTA 텍스트 한 줄에만 쓴다.
 */

/** 렌즈 → Paywall attribution source. 상품은 하나지만 진입점은 구분한다(§31) */
const LENS_SOURCE: Record<PremiumLensKind, PremiumSource> = {
  mbti: 'mbti',
  saju: 'saju',
  zodiac: 'astrology',
};

const LENS_ORDER: readonly PremiumLensKind[] = ['mbti', 'saju', 'zodiac'];

export function HomePremiumBundle({
  feature,
  unlocked,
}: {
  /**
   * `premiumFeatureState('relationship_deep_report', …)`의 결과.
   *
   * ⚠️ 여기서 다시 판정하지 않는다 — Home이 자기만의 자격 판정을 가지면 결과
   * 화면의 Premium 진입과 조용히 어긋난다(v1.40.1이 닫은 실패 형태).
   */
  feature: PremiumFeature;
  /** 이미 이 분석에 대해 리포트를 연 상태인가 — CTA 문구만 바꾼다 */
  unlocked: boolean;
}) {
  const router = useRouter();
  const { answers, hydrated } = useSession();
  const [variant] = useState(() => resolvePriceVariant());

  const price = feature.price ?? resolvePrice(variant);
  const funnelAnalysisId = answers.currentAnalysisMeta?.funnelAnalysisId ?? null;

  /**
   * Premium CTR의 **분모**다. `PremiumEntryRow`와 같은 이유로 StrictMode 이중 호출·
   * 리렌더에서 중복되면 안 되고, `funnel_analysis_id`가 붙은 뒤에 나가야 한다.
   */
  const viewSent = useRef(false);

  useEffect(() => {
    if (!PREMIUM_FAKE_DOOR) return;
    if (!hydrated || !funnelAnalysisId) return;
    if (viewSent.current) return;
    viewSent.current = true;
    trackEvent('premium_entry_view', {
      feature: feature.id,
      source: 'compatibility',
      price,
      variant,
      hook_variant: 'home_bundle',
      funnel_analysis_id: funnelAnalysisId,
    });
  }, [feature.id, price, variant, hydrated, funnelAnalysisId]);

  if (!PREMIUM_FAKE_DOOR) return null;

  /**
   * ⚠️ `unavailable`이면 이 블록을 통째로 숨긴다.
   *
   * `PremiumEntryRow`는 이럴 때 '아직 준비 중' 카드를 보여주지만, Home에서는
   * 다르다 — Home은 결과 화면이 아니라 허브라, 아직 살 수 없는 상품의 안내
   * 카드가 상시로 붙어 있으면 그건 광고 자리가 된다. 살 수 있게 되면 나타난다.
   */
  if (feature.status === 'unavailable') return null;

  const go = (source: PremiumSource, hash?: string) => {
    trackEvent('premium_entry_click', {
      feature: feature.id,
      source,
      price,
      variant,
      hook_variant: 'home_bundle',
      ...(funnelAnalysisId ? { funnel_analysis_id: funnelAnalysisId } : {}),
    });
    router.push(`${ROUTES.premium(source, 'home_bundle', 'home')}${hash ?? ''}`);
  };

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>{PREMIUM_BUNDLE_COPY.eyebrow}</SectionLabel>

      <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-[13.5px] font-semibold keep-all">{PREMIUM_BUNDLE_COPY.title}</p>
          <p className="text-[12px] keep-all leading-relaxed text-ink-sub">
            {PREMIUM_BUNDLE_COPY.description}
          </p>
          {/*
            §35 — **가격이 나오는 유일한 자리.** 그리고 바로 옆에서 지금은 실제
            결제가 아니라는 사실을 말한다. 가격만 있고 이 문구가 없으면 사용자는
            과금된다고 읽는다(`UNLOCK_COPY.demoUnlock`이 세운 규칙과 같다).
          */}
          <p className="text-[11px] tnum text-ink-muted">
            {formatPrice(price)}
            <span className="sr-only"> ({priceForScreenReader(price)})</span>
            <span aria-hidden> · </span>
            <span className="tabular-nums">{PREMIUM_BUNDLE_COPY.priceSuffix}</span>
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold tracking-[0.05em] text-ink-muted">
            {PREMIUM_BUNDLE_COPY.lensListLabel}
          </p>
          {/*
            §33 — 모바일 우선이므로 **1열 compact row**다. 3열 그리드로 만들면
            393px에서 `별자리 관계 분석`이 두 줄로 접히고 버튼마다 높이가 달라진다.
          */}
          <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-row border border-line-soft">
            {LENS_ORDER.map((kind) => (
              <li key={kind}>
                <button
                  type="button"
                  onClick={() => go(LENS_SOURCE[kind], `#${LENS_ANCHOR[kind]}`)}
                  className="press-scale flex min-h-11 w-full items-center justify-between gap-2 bg-surface px-3.5 py-2.5 text-left active:bg-sunken"
                >
                  <span className="min-w-0 text-[12.5px] keep-all">{LENS_SHORT_LABEL[kind]}</span>
                  <span className="flex-none text-[11px] font-semibold text-brand-pressed">
                    {unlocked ? PREMIUM_BUNDLE_COPY.unlockedCta : PREMIUM_BUNDLE_COPY.lockedCta} →
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {/* §34 — 세 버튼이 각각 다른 상품처럼 보이지 않게 하는 한 줄 */}
          <p className="text-[11px] keep-all leading-relaxed text-ink-faint">
            {PREMIUM_BUNDLE_COPY.lockedNote}
          </p>
        </div>

        <button
          type="button"
          onClick={() => go('compatibility')}
          className="press-scale flex min-h-11 items-center justify-center rounded-row border border-line bg-sunken text-[12.5px] font-semibold text-brand-pressed active:bg-canvas-warm"
        >
          {PREMIUM_BUNDLE_COPY.allCta} →
        </button>
      </div>
    </section>
  );
}
