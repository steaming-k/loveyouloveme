import { UT_MODE } from '@/lib/env';

/**
 * UT Mode — **단일 source-of-truth** (v1.47 Premium UT Visibility)
 *
 * ```
 * env    NEXT_PUBLIC_UT_MODE=true          UT 전용 배포
 * query  ?mode=ut                          참가자 링크 — 한 번 들어오면 이 탭에 기억한다
 * tab    sessionStorage lym.ut-mode.v1     새로고침 · 뒤로가기 · 쿼리 없는 이동에서도 유지
 * ```
 *
 * ⚠️ 예전에는 `searchParams.get('mode') === 'ut'`를 화면마다 따로 읽었다. Premium 진입 행이
 * `/premium`으로 보낼 때 쿼리를 붙이지 않아서 **이동하는 순간 UT가 풀렸다.** 이제 화면은
 * 쿼리를 직접 읽지 않고 `useUtMode()`(→ 이 파일)만 쓴다.
 *
 * ⚠️ localStorage가 아니라 sessionStorage다 — 탭을 닫으면 끝난다. 일반 사용자는 이 링크로
 * 들어오지 않는 한 켜지지 않는다(PROD-PREM-02).
 *
 * ⚠️ 결제·자격 기록이 아니다. Premium 콘텐츠를 **볼 수 있게** 할 뿐, 결제 완료로 표시하지
 * 않는다(`premiumAccess.ts`의 `resolvePremiumAccess`).
 */
/**
 * UT 운영자 도구(`/ut` — Health Check · 결과 내보내기 · 참가자 초기화)를 열 수 있는 배포인가.
 *
 * ⚠️ **쿼리로는 열리지 않는다.** 개발 서버 또는 `NEXT_PUBLIC_UT_MODE=true` 배포에서만 열린다 —
 * 일반 Production 사용자가 `?mode=ut`를 붙여도 운영자 화면은 404다.
 */
export const UT_OPERATOR_TOOLS_ENABLED = process.env.NODE_ENV !== 'production' || UT_MODE;

/** UT 전용 배포(`NEXT_PUBLIC_UT_MODE=true`)인가 — 새 탭에서도 UT가 유지되는지 운영자 점검에 쓴다 */
export const UT_MODE_DEPLOYMENT = UT_MODE;

export const UT_MODE_QUERY = 'mode';
export const UT_MODE_QUERY_VALUE = 'ut';
const STORAGE_KEY = 'lym.ut-mode.v1';

/** 순수 판정 — fixture가 값으로 고정한다(UT-PREM-12 · 13 · PROD-PREM-02) */
export function resolveUtMode(input: {
  envFlag: boolean;
  queryMode: string | null;
  stored: string | null;
}): boolean {
  return input.envFlag || input.queryMode === UT_MODE_QUERY_VALUE || input.stored === '1';
}

function readStored(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function readQuery(): string | null {
  try {
    return new URLSearchParams(window.location.search).get(UT_MODE_QUERY);
  } catch {
    return null;
  }
}

/**
 * 지금 탭이 UT인가. 쿼리로 들어왔으면 탭에 기억한다(같은 값을 다시 쓰는 것뿐이라 몇 번 불러도 같다).
 * 저장이 막힌 브라우저에서도 쿼리가 있는 화면에서는 UT로 동작한다.
 */
export function readUtMode(): boolean {
  if (typeof window === 'undefined') return UT_MODE;
  const queryMode = readQuery();
  if (queryMode === UT_MODE_QUERY_VALUE && readStored() !== '1') {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // 저장 실패 — 이 화면에서는 쿼리로 UT가 유지된다
    }
  }
  return resolveUtMode({ envFlag: UT_MODE, queryMode, stored: readStored() });
}

export function subscribeUtMode(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('popstate', onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener('storage', onChange);
  };
}
