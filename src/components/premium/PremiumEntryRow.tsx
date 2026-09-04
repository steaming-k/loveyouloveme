'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { SectionLabel } from '@/components/common/primitives';
import { DEEP_REPORT_COPY, PREMIUM_COPY } from '@/data/premium';
import { PREMIUM_FAKE_DOOR } from '@/lib/env';
import { trackEvent } from '@/lib/analytics';
import { formatPrice, priceForScreenReader, resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { isRevisit, revisitSource } from '@/lib/resultView';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';
import type { PremiumFeature, PremiumSource } from '@/types';

/**
 * Premium 진입점 — **항상 Secondary**
 *
 * Guardrail(§33): 이 행은 화면의 Primary CTA보다 강해지지 않는다. 궁합 → Mirror로 이어지는
 * 핵심 Funnel을 가로막지 않도록 본문 맨 아래, 점선 카드로만 둔다.
 * Flag가 꺼져 있으면 아무것도 렌더하지 않는다 — v1.4와 동일한 화면이 된다.
 *
 * `unavailable` 상태에서는 **가격도 CTA도 붙이지 않는다**(§40) — 돈을 내면 나올 것처럼
 * 보이면 안 되는 기능이 있다(예: 사주 엔진 미연결).
 */
export function PremiumEntryRow({
  feature,
  source,
  hook,
}: {
  feature: PremiumFeature;
  /**
   * v1.9 — 여러 화면(궁합/Mirror/History)이 같은 `relationship_deep_report`로 모이면서,
   * '어느 화면에서 들어왔는지'와 '카탈로그에 적힌 대표 source'가 달라질 수 있다.
   * 뒤로가기가 원래 화면으로 돌아가야 하므로, 호출부가 자기 화면의 source를 명시할 수 있게 한다.
   * 넘기지 않으면 기존처럼 `feature.source`를 그대로 쓴다(mbti/astrology 등).
   */
  source?: PremiumSource;
  /**
   * v1.15 — Contextual Premium Hook(§4). '궁금증이 생기는 순간'에 실제 데이터로 개인화한
   * 제목·설명·CTA를 보여주고, 어느 Hook이 Intent를 만드는지 구분할 수 있게 hook_variant를
   * 함께 남긴다. 넘기지 않으면 기존처럼 `feature.title`/`feature.description`/일반 CTA를 쓴다
   * — 이 컴포넌트가 하나뿐이라는 사실도, `unavailable` 처리·Fake Door 가드도 그대로 재사용된다.
   */
  hook?: { variant: string; title: string; description: string; cta: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { answers, hydrated } = useSession();
  const [variant] = useState(() => resolvePriceVariant());

  /**
   * v1.19 §29 — 지금 화면이 Revisit(v1.18 Bottom Navigation이 붙는 상태)이면 그 사실을
   * Paywall까지 들고 간다. 그래야 '지금은 괜찮아'로 닫았을 때 하단 메뉴가 있는 화면으로
   * 정확히 돌아온다. Revisit이 아니면 아무 것도 붙이지 않는다(기존 동작 그대로).
   */
  const returnTo = isRevisit(searchParams) ? revisitSource(searchParams) : undefined;

  /**
   * v1.19 §3 — Hook Attribution의 키. 같은 탭에서 두 번째 상대를 분석하면 새로 발급되므로
   * (`SessionProvider`), 첫 상대에서 본 Hook과 두 번째 상대의 Intent가 섞이지 않는다.
   * 여기서 URL로 넘기지 않고 Paywall도 같은 세션 값을 직접 읽는다 — 사용자가 주소창을
   * 편집해서 attribution을 바꿀 수 없고, URL에 분석 식별자가 노출되지도 않는다.
   * 아직 값이 없으면(hydration 이전 등) property 자체를 붙이지 않는다.
   */
  const funnelAnalysisId = answers.currentAnalysisMeta?.funnelAnalysisId ?? null;

  const price = feature.price ?? resolvePrice(variant);
  const isFakeDoor = feature.status === 'fake-door';
  const entrySource = source ?? feature.source;
  const isDeepReport = feature.id === 'relationship_deep_report';
  const copy = isDeepReport ? DEEP_REPORT_COPY : PREMIUM_COPY;

  /** Premium CTR의 **분모**다. StrictMode 이중 호출·리렌더로 중복되면 지표가 망가진다. */
  const viewSent = useRef<string | null>(null);

  useEffect(() => {
    if (!PREMIUM_FAKE_DOOR || !isFakeDoor) return;
    /**
     * v1.19 §3 + Release Gate — **`funnel_analysis_id`가 실제로 생긴 뒤에** 보낸다.
     *
     * 이 행(궁합/Mirror/History)은 Paywall과 달리 `HydrationGate` 안에 있지 않다. 그래서
     * 첫 렌더(빈 세션)에서 이벤트가 나가고 아래 ref 가드에 막혀 **`funnel_analysis_id`가
     * 영영 붙지 않는** 문제가 있었다 — Hook CTR의 분모가 통째로 빈다.
     *
     * `hydrated`만 기다리는 것으로는 부족했다(Release Gate 실측에서 재현): React는 자식
     * effect를 부모보다 **먼저** 실행하므로, hydration이 끝난 그 커밋에서 이 effect가
     * `SessionProvider`의 id 발급 effect보다 앞서 돌아 값이 아직 없는 상태로 나갔다.
     * 세션에 id가 처음 생기는 사용자(= 진짜 신규 사용자)의 **첫 Hook 노출**이 정확히 이
     * 경우다. `SessionProvider`가 hydration 직후 반드시 발급하므로(§20), 그 값을 기다린다.
     */
    if (!hydrated || !funnelAnalysisId) return;
    if (viewSent.current === feature.id) return;
    viewSent.current = feature.id;
    trackEvent('premium_entry_view', {
      feature: feature.id,
      source: entrySource,
      price,
      variant,
      ...(hook ? { hook_variant: hook.variant } : {}),
      funnel_analysis_id: funnelAnalysisId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature.id, entrySource, price, variant, isFakeDoor, hook?.variant, funnelAnalysisId, hydrated]);

  if (!PREMIUM_FAKE_DOOR) return null;

  // 상세를 만들 근거가 없는 기능은 유료 CTA 없이 사실만 알린다.
  if (feature.status === 'unavailable') {
    return (
      <section className="flex flex-col gap-2">
        <SectionLabel>{copy.entryLabel}</SectionLabel>
        <div className="rounded-row border border-dashed border-line-strong bg-sunken px-4 py-3.5">
          <p className="text-[12.5px] font-medium">{copy.unavailableTitle}</p>
          {feature.unavailableReason ? (
            <p className="mt-1 text-[11.5px] keep-all leading-relaxed text-ink-sub">
              {feature.unavailableReason}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>{copy.entryLabel}</SectionLabel>
      <button
        type="button"
        onClick={() => {
          trackEvent('premium_entry_click', {
            feature: feature.id,
            source: entrySource,
            price,
            variant,
            ...(hook ? { hook_variant: hook.variant } : {}),
            ...(funnelAnalysisId ? { funnel_analysis_id: funnelAnalysisId } : {}),
          });
          router.push(ROUTES.premium(entrySource, hook?.variant, returnTo));
        }}
        className="flex w-full flex-col gap-3 rounded-row border border-line bg-surface px-4 py-3.5 text-left active:bg-sunken"
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] font-medium">{hook?.title ?? feature.title}</span>
          <span className="text-[11.5px] keep-all leading-relaxed text-ink-sub">
            {hook?.description ?? feature.description}
          </span>
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold tnum text-brand-pressed">
            {formatPrice(price)}
            <span className="sr-only"> ({priceForScreenReader(price)})</span>
          </span>
          <span className="text-[11px] text-ink-muted">{hook?.cta ?? copy.entryCta} →</span>
        </span>
      </button>
    </section>
  );
}
