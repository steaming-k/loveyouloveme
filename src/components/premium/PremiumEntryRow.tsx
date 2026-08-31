'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { SectionLabel } from '@/components/common/primitives';
import { PREMIUM_COPY } from '@/data/premium';
import { PREMIUM_FAKE_DOOR } from '@/lib/env';
import { trackEvent } from '@/lib/analytics';
import { formatPrice, priceForScreenReader, resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { ROUTES } from '@/lib/routes';
import type { PremiumFeature } from '@/types';

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
export function PremiumEntryRow({ feature }: { feature: PremiumFeature }) {
  const router = useRouter();
  const [variant] = useState(() => resolvePriceVariant());

  const price = feature.price ?? resolvePrice(variant);
  const isFakeDoor = feature.status === 'fake-door';

  /** Premium CTR의 **분모**다. StrictMode 이중 호출·리렌더로 중복되면 지표가 망가진다. */
  const viewSent = useRef<string | null>(null);

  useEffect(() => {
    if (!PREMIUM_FAKE_DOOR || !isFakeDoor) return;
    if (viewSent.current === feature.id) return;
    viewSent.current = feature.id;
    trackEvent('premium_entry_view', {
      feature: feature.id,
      source: feature.source,
      price,
      variant,
    });
  }, [feature.id, feature.source, price, variant, isFakeDoor]);

  if (!PREMIUM_FAKE_DOOR) return null;

  // 상세를 만들 근거가 없는 기능은 유료 CTA 없이 사실만 알린다.
  if (feature.status === 'unavailable') {
    return (
      <section className="flex flex-col gap-2">
        <SectionLabel>{PREMIUM_COPY.entryLabel}</SectionLabel>
        <div className="rounded-row border border-dashed border-line-strong bg-sunken px-4 py-3.5">
          <p className="text-[12.5px] font-medium">{PREMIUM_COPY.unavailableTitle}</p>
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
      <SectionLabel>{PREMIUM_COPY.entryLabel}</SectionLabel>
      <button
        type="button"
        onClick={() => {
          trackEvent('premium_entry_click', {
            feature: feature.id,
            source: feature.source,
            price,
            variant,
          });
          router.push(ROUTES.premium(feature.source));
        }}
        className="flex w-full items-center justify-between gap-3 rounded-row border border-line bg-surface px-4 py-3.5 text-left active:bg-sunken"
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] font-medium">{feature.title}</span>
          <span className="text-[11.5px] keep-all leading-relaxed text-ink-sub">
            {feature.description}
          </span>
        </span>
        <span className="flex flex-none flex-col items-end gap-1">
          <span className="text-[12px] font-semibold tnum text-brand-pressed">
            {formatPrice(price)}
            <span className="sr-only"> ({priceForScreenReader(price)})</span>
          </span>
          <span className="text-[11px] text-ink-muted">{PREMIUM_COPY.entryCta} →</span>
        </span>
      </button>
    </section>
  );
}
