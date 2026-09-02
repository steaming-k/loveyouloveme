/**
 * Analytics Adapter 경계 (v1.10 · §26~§29)
 *
 * `analytics.ts`의 localStorage 기반 저장은 계속 그 파일이 직접 맡는다 — `trackOnce`
 * dedup·`getEventCount`·`getPrimaryKpi`가 그 저장소를 직접 읽어야 해서, 여기서 추상화하면
 * 오히려 두 곳에서 같은 저장소를 다르게 다루게 된다. 이 파일은 **외부(GA4 등) 전송만**
 * 담당하는 선택적 레이어다 — 있으면 같은 이벤트를 추가로 보내고, 없으면 아무 일도 없다.
 *
 * ⚠️ Analytics 전송 실패가 Product UX를 막으면 안 된다(§29) — `track()` 내부에서 무엇이
 * 터지든 호출부(`analytics.ts`)가 try/catch로 감싼다.
 */

export interface AnalyticsProperties {
  [key: string]: string | number | boolean | null | undefined;
}

export interface AnalyticsAdapter {
  track(eventName: string, properties?: AnalyticsProperties): void;
}

/** 아무 것도 하지 않는다 — GA4 Measurement ID가 없을 때의 기본값 */
export const NoopAnalyticsAdapter: AnalyticsAdapter = {
  track() {
    // no-op
  },
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/**
 * GA4 어댑터. `NEXT_PUBLIC_GA_MEASUREMENT_ID`가 있을 때만 만들어진다(§28) —
 * Key 없이 앱을 실행해도 이 어댑터는 아예 존재하지 않는다.
 *
 * gtag.js 스크립트 로딩은 이 파일의 책임이 아니다 — Measurement ID가 실제로 쓰이게 되면
 * `app/layout.tsx`에 `<Script>`로 붙이고, 그전까지는 `window.gtag`가 없으므로 조용히 넘어간다.
 */
export function createGa4Adapter(measurementId: string): AnalyticsAdapter {
  return {
    track(eventName, properties) {
      if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
      window.gtag('event', eventName, { ...properties, send_to: measurementId });
    },
  };
}
