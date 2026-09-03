/**
 * Analytics Consent (v1.12 §14~§16)
 *
 * GA4를 실제로 연결하면서 생긴 최소한의 동의 상태다. localStorage만 쓰던 시절의 로컬
 * 디버그 로그(`lym.analytics.v1`)와는 별개로, **외부 전송(GA4) 여부**만 이 값이 결정한다
 * (`src/lib/analytics.ts`의 `resolveExternalAdapter` 참고).
 *
 * ⚠️ 실제 법률 자문을 거친 문서가 아니다 — 제품 UX 차원의 최소 Consent Gate다.
 * ⚠️ 동의 여부와 무관하게 제품 사용 자체는 절대 막지 않는다(§15).
 */

export type AnalyticsConsentState = 'unknown' | 'granted' | 'denied';

const STORAGE_KEY = 'lym.consent.v1';

function readRaw(): AnalyticsConsentState {
  if (typeof window === 'undefined') return 'unknown';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'granted' || raw === 'denied') return raw;
  } catch {
    // localStorage를 못 쓰면 'unknown'과 동일하게 취급한다(=GA4로 보내지 않는다).
  }
  return 'unknown';
}

const listeners = new Set<() => void>();

/** 현재 동의 상태를 읽는다. `analytics.ts`가 이벤트마다 직접 부른다. */
export function getAnalyticsConsent(): AnalyticsConsentState {
  return readRaw();
}

/** 동의 상태를 바꾼다 — Consent 배너, `/privacy` 화면 둘 다 이 함수 하나만 쓴다. */
export function setAnalyticsConsent(state: 'granted' | 'denied'): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, state);
  } catch {
    // 저장 실패해도 이번 세션 안에서는 listener들이 최신값으로 리렌더된다.
  }
  listeners.forEach((listener) => listener());
}

/** 같은 값을 쓰는 다른 컴포넌트 인스턴스(배너 · Privacy 화면)를 동기화하기 위한 구독. */
export function subscribeAnalyticsConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
