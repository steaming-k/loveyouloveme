'use client';

import { useSyncExternalStore } from 'react';

import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  subscribeAnalyticsConsent,
  type AnalyticsConsentState,
} from '@/lib/analyticsConsent';

/** 서버 렌더에는 localStorage가 없다 — 항상 'unknown'으로 시작해 hydration 불일치를 막는다 */
function getServerSnapshot(): AnalyticsConsentState {
  return 'unknown';
}

/**
 * Consent 배너와 `/privacy` 화면이 같은 값을 공유한다 — 한쪽에서 바꾸면 다른 쪽도
 * `subscribeAnalyticsConsent`를 통해 즉시 리렌더된다.
 */
export function useAnalyticsConsent(): [AnalyticsConsentState, (state: 'granted' | 'denied') => void] {
  const state = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, getServerSnapshot);
  return [state, setAnalyticsConsent];
}
