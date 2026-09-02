/**
 * Result Revisit 판정 (v1.11 §11/§19/§25)
 *
 * Compatibility/Mirror/Profile Result는 같은 Route를 쓰되 `?view=revisit`로
 * '다시 보기'인지를 구분한다 — 결과 계산 자체는 동일하고(§11), Route를 늘리지 않는다.
 *
 * ⚠️ 이 값으로 KPI를 오염시키지 않는다. `compatibility_result_view`/
 * `relationship_mirror_entry_click` 같은 Primary KPI 이벤트는 이 값과 무관하게
 * 기존 로직 그대로 발생한다 — Revisit 여부는 별도 이벤트(`*_result_revisit`)로만 기록한다.
 */

export const RESULT_VIEW_PARAM = 'view';
export const RESULT_VIEW_REVISIT = 'revisit';
export const RESULT_SOURCE_PARAM = 'source';

export type RevisitSource = 'home' | 'history' | 'direct' | 'share';

export function isRevisit(searchParams: URLSearchParams | null | undefined): boolean {
  return searchParams?.get(RESULT_VIEW_PARAM) === RESULT_VIEW_REVISIT;
}

export function revisitSource(
  searchParams: URLSearchParams | null | undefined,
): RevisitSource {
  const raw = searchParams?.get(RESULT_SOURCE_PARAM);
  if (raw === 'home' || raw === 'history' || raw === 'share') return raw;
  return 'direct';
}

/** Home/History 등에서 '다시 보기' 링크를 만들 때 쓴다. */
export function revisitHref(base: string, source: RevisitSource): string {
  return `${base}?${RESULT_VIEW_PARAM}=${RESULT_VIEW_REVISIT}&${RESULT_SOURCE_PARAM}=${source}`;
}
