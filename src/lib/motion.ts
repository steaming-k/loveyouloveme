/**
 * Motion 공통 값 (vNext)
 *
 * CSS 쪽 토큰(`--motion-fast/normal/slow`, `--ease-observe`)과 **같은 값**을 JS에서도
 * 쓰기 위한 한 곳이다. 화면마다 setTimeout에 매직 넘버를 흩뿌리지 않는다.
 *
 * ⚠️ 여기 있는 값은 **presentation layer 전용**이다. 분석·결제 같은 실제 처리를 이 시간만큼
 * 늦추는 데 쓰지 않는다 — 이미 확정된 상태 변화를 사용자가 인지하게 만드는 용도다.
 */
export const MOTION = {
  /** 버튼 press 등 즉각 피드백 */
  fast: 150,
  /** 화면 안 상태 전환 */
  normal: 300,
  /** 큰 표면(Report 등) 등장 */
  slow: 400,
} as const;

/**
 * `prefers-reduced-motion: reduce` 여부.
 *
 * ⚠️ **렌더 분기에 직접 쓰지 않는다.** 서버 렌더 결과와 첫 클라이언트 렌더가 달라져
 * hydration이 깨진다. 클라이언트 전용 지점(effect · 이벤트 핸들러)에서만 호출한다.
 * SSR에서는 항상 false를 돌려준다.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
