'use client';

import Script from 'next/script';

import { useAnalyticsConsent } from '@/hooks/useAnalyticsConsent';
import { GA_MEASUREMENT_ID } from '@/lib/env';

/**
 * GA4 스크립트 로더 (v1.12 §12~§13)
 *
 * Next.js 권장 방식(`next/script`)으로 gtag.js를 붙인다. 이 컴포넌트가 트리에 딱 한 번만
 * 있으므로 중복 injection 걱정이 없다.
 *
 * 로드 조건 — 전부 만족해야 실제로 스크립트가 붙는다:
 *   1. `NODE_ENV === 'production'` — development에서는 로컬 Analytics Debug만 쓴다(§13)
 *   2. `GA_MEASUREMENT_ID`가 설정돼 있음
 *   3. Consent가 `'granted'`임(§14) — 동의 전에는 gtag.js 자체를 요청하지 않는다
 *      (`window.gtag`가 아예 없으므로 `analytics.ts`의 Noop 판단과도 이중으로 맞는다)
 */
export function GaScriptLoader() {
  const [consent] = useAnalyticsConsent();

  if (process.env.NODE_ENV !== 'production') return null;
  if (!GA_MEASUREMENT_ID) return null;
  if (consent !== 'granted') return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}', { anonymize_ip: true });`}
      </Script>
    </>
  );
}
