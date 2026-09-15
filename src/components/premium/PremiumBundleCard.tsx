'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { SectionLabel } from '@/components/common/primitives';
import { LENS_ANCHOR, LENS_SHORT_LABEL, PREMIUM_BUNDLE_COPY } from '@/data/premiumLens';
import { trackEvent } from '@/lib/analytics';
import { usePremiumAccess } from '@/hooks/useUtMode';
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
 * Premium Bundle 카드 — Home · 렌즈 3화면 공용 (v1.46 PremiumLens · §32~§35)
 *
 * ══ 1차 UT 전체 Backlog P0-2 — 왜 Home 전용에서 공용이 됐나 ═══════════════
 *
 * v1.46 §35가 세 렌즈의 **결제 대상**을 하나로 모았는데(`relationship_deep_report`),
 * 렌즈 화면에는 여전히 `PremiumEntryRow`가 하나씩 있었다. 그 행은 **자기 가격 줄을
 * 갖는다.** 그래서 렌즈를 셋 다 둘러본 사용자에게는 ₩1,900이 세 번 찍혔다:
 *
 * ```
 * /lens/saju       … ₩1,900
 * /lens/mbti       … ₩1,900      ← 세 개의 상품으로 읽힌다
 * /lens/astrology  … ₩1,900
 * ```
 *
 * 문구를 한 줄 덧붙여 푸는 문제가 아니다 — **정보 구조가 상품 3개**였다. 그래서
 * 렌즈 화면도 이 카드를 쓴다. 이 카드의 구조가 곧 상품 구조이기 때문이다:
 * 가격은 헤더에 하나, 그 아래는 그 가격에 포함된 항목들이다.
 *
 * ⚠️ **새 컴포넌트를 만들지 않았다.** Home이 이미 옳은 구조를 갖고 있었으므로
 * 그것을 공용으로 올린다 — 두 개를 만들면 §35를 지키는 곳과 어기는 곳이 다시 갈린다.
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

export function PremiumBundleCard({
  feature,
  unlocked,
  source = 'compatibility',
  hookVariant = 'home_bundle',
  returnTo,
  currentLens,
}: {
  /**
   * `premiumFeatureState('relationship_deep_report', …)`의 결과.
   *
   * ⚠️ 여기서 다시 판정하지 않는다 — 호출부가 자기만의 자격 판정을 가지면 결과
   * 화면의 Premium 진입과 조용히 어긋난다(v1.40.1이 닫은 실패 형태).
   */
  feature: PremiumFeature;
  /** 이미 이 분석에 대해 리포트를 연 상태인가 — CTA 문구를 바꾸고 **가격을 숨긴다** */
  unlocked: boolean;
  /**
   * 전체 CTA의 attribution source(§31). 상품은 하나지만 '어디서 지불 의향이
   * 생겼는가'는 구분한다 — 렌즈 화면은 자기 source를 넘긴다.
   */
  source?: PremiumSource;
  /** Hook attribution. Home은 `home_bundle`, 렌즈 화면은 `lens_bundle` */
  hookVariant?: string;
  /**
   * 닫았을 때 돌아갈 곳. **넘기지 않으면** Paywall의 `BACK_BY_SOURCE`가 source별로
   * 정한다 — 렌즈 화면이 그 경우다(닫으면 보던 렌즈로 돌아간다).
   */
  returnTo?: string;
  /**
   * 지금 사용자가 보고 있는 렌즈. 그 행에 표시를 남겨 **'내가 지금 보는 이 렌즈가
   * 이 묶음 안의 한 항목'**이라는 사실을 구조로 보여준다. Home에서는 없다.
   */
  currentLens?: PremiumLensKind;
}) {
  const router = useRouter();
  const { answers, hydrated } = useSession();
  const [variant] = useState(() => resolvePriceVariant());
  /** v1.47 — env flag를 직접 읽지 않는다. UT에서는 flag가 꺼져 있어도 보인다(`resolvePremiumAccess`) */
  const access = usePremiumAccess();

  const price = feature.price ?? resolvePrice(variant);
  const funnelAnalysisId = answers.currentAnalysisMeta?.funnelAnalysisId ?? null;

  /**
   * Premium CTR의 **분모**다. `PremiumEntryRow`와 같은 이유로 StrictMode 이중 호출·
   * 리렌더에서 중복되면 안 되고, `funnel_analysis_id`가 붙은 뒤에 나가야 한다.
   */
  const viewSent = useRef(false);

  useEffect(() => {
    if (!access.surfaceEnabled) return;
    if (!hydrated || !funnelAnalysisId) return;
    if (viewSent.current) return;
    viewSent.current = true;
    trackEvent('premium_entry_view', {
      feature: feature.id,
      source,
      price,
      variant,
      hook_variant: hookVariant,
      funnel_analysis_id: funnelAnalysisId,
    });
  }, [access.surfaceEnabled, feature.id, price, variant, hydrated, funnelAnalysisId, source, hookVariant]);

  if (!access.surfaceEnabled) return null;

  /**
   * ⚠️ `unavailable`이면 이 블록을 통째로 숨긴다.
   *
   * `PremiumEntryRow`는 이럴 때 '아직 준비 중' 카드를 보여주지만, Home에서는
   * 다르다 — Home은 결과 화면이 아니라 허브라, 아직 살 수 없는 상품의 안내
   * 카드가 상시로 붙어 있으면 그건 광고 자리가 된다. 살 수 있게 되면 나타난다.
   */
  // v1.47 UT-2 — UT 참가자에게는 숨기지 않는다. 근거가 부족하면 누른 뒤 `/premium`이 입력 보완 화면을 연다
  if (feature.status === 'unavailable' && !access.utMode) return null;

  const go = (clickSource: PremiumSource, hash?: string) => {
    trackEvent('premium_entry_click', {
      feature: feature.id,
      source: clickSource,
      price,
      variant,
      hook_variant: hookVariant,
      ...(funnelAnalysisId ? { funnel_analysis_id: funnelAnalysisId } : {}),
    });
    /*
      ⚠️ `returnTo`는 Home에서만 넘긴다. 렌즈 화면에서 `home`을 박으면 닫았을 때
      원래 보던 렌즈가 아니라 Home으로 튄다 — Paywall의 `BACK_BY_SOURCE`가 이미
      source별 복귀 지점을 갖고 있으므로 여기서 덮어쓰지 않는다.
    */
    router.push(`${ROUTES.premium(clickSource, hookVariant, returnTo)}${hash ?? ''}`);
  };

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>{PREMIUM_BUNDLE_COPY.eyebrow}</SectionLabel>

      <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-[13.5px] font-semibold keep-all">{PREMIUM_BUNDLE_COPY.title}</p>
          <p className="text-[12px] keep-all leading-relaxed text-ink-sub">
            {currentLens
              ? PREMIUM_BUNDLE_COPY.lensContextDescription
              : PREMIUM_BUNDLE_COPY.description}
          </p>
          {/*
            §35 — **가격이 나오는 유일한 자리.** 그리고 바로 옆에서 지금은 실제
            결제가 아니라는 사실을 말한다. 가격만 있고 이 문구가 없으면 사용자는
            과금된다고 읽는다(`UNLOCK_COPY.demoUnlock`이 세운 규칙과 같다).
          */}
          {/*
            ⚠️ **unlock 이후에는 가격을 그리지 않는다**(1차 UT 전체 Backlog P0-2).
            이미 연 리포트 옆의 가격은 살 것을 가리키지 않는다 — 렌즈를 탐색하는
            동안 ₩1,900이 계속 따라다니면 렌즈마다 또 내야 하는 것으로 읽힌다.
            unlock 이후 이 카드는 **탐색 메뉴**이지 결제 CTA가 아니다.
          */}
          {unlocked ? null : (
            <p className="text-[11px] tnum text-ink-muted">
              {formatPrice(price)}
              <span className="sr-only"> ({priceForScreenReader(price)})</span>
              {/* v1.47 UT-2 — UT 참가자에게는 '테스트' 메타 문구를 붙이지 않는다. 결제 없음 안내는 결제 의향 질문에서 한 번 한다 */}
              {access.utMode ? null : (
                <>
                  <span aria-hidden> · </span>
                  <span className="tabular-nums">{PREMIUM_BUNDLE_COPY.priceSuffix}</span>
                </>
              )}
            </p>
          )}
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
                  <span className="min-w-0 text-[12.5px] keep-all">
                    {LENS_SHORT_LABEL[kind]}
                    {/*
                      지금 보고 있는 렌즈를 표시한다 — '내가 방금까지 본 이 렌즈가
                      이 묶음 안의 한 항목'이라는 사실을 문구가 아니라 **구조로**
                      보여주는 자리다(1차 UT 전체 Backlog P0-2).
                    */}
                    {currentLens === kind ? (
                      <span className="ml-1.5 rounded-tag bg-brand-tint px-1.5 py-0.5 text-[10px] font-semibold text-brand-pressed">
                        {PREMIUM_BUNDLE_COPY.currentLensBadge}
                      </span>
                    ) : null}
                  </span>
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
