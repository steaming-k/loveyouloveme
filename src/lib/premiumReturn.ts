import { ROUTES } from '@/lib/routes';

/**
 * Premium 자동 복귀 (v1.47 UT-2 Stability)
 *
 * Premium 근거가 부족한 화면에서 '정보 채우기'를 누르면 **돌아올 Premium 주소**를 이 탭에 기억한다.
 * 입력을 마치고 결과 화면(체크포인트)에 도착했을 때 근거가 채워졌으면 그 주소로 되돌린다
 * (`PremiumReturnWatcher`).
 *
 * ⚠️ `/premium` · `/premium-preview/` 내부 경로만 받는다 — 임의 URL로 보내는 통로가 되지 않는다.
 * ⚠️ 2시간이 지나면 버린다. 탭을 닫으면 사라진다(sessionStorage).
 * ⚠️ 체크포인트는 **이미 `useCrossSourceInsights`를 부르는 화면만** 둔다 — 복귀 판정 때문에 AI 호출이 새로 생기지 않는다.
 */
const STORAGE_KEY = 'lym.premium-return.v1';
export const PREMIUM_RETURN_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export const PREMIUM_RETURN_CHECKPOINTS: readonly string[] = [
  ROUTES.compatibility,
  ROUTES.mirror,
  ROUTES.firstContact,
  ROUTES.home,
];

export function isPremiumReturnHref(href: unknown): href is string {
  return (
    typeof href === 'string' &&
    !href.startsWith('//') &&
    (href === ROUTES.premiumBase || href.startsWith(`${ROUTES.premiumBase}?`) || href.startsWith('/premium#') || href.startsWith('/premium-preview/'))
  );
}

/** 순수 판정 — fixture가 값으로 고정한다 */
export function parsePremiumReturn(raw: string | null, now: number): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { href?: unknown; at?: unknown };
    if (!isPremiumReturnHref(parsed.href) || typeof parsed.at !== 'number') return null;
    if (now - parsed.at > PREMIUM_RETURN_MAX_AGE_MS || parsed.at > now + 60_000) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function rememberPremiumReturn(href: string): void {
  if (typeof window === 'undefined' || !isPremiumReturnHref(href)) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ href, at: Date.now() }));
  } catch {
    // 저장 실패 — 자동 복귀만 빠진다. 입력 화면으로 가는 흐름은 막지 않는다
  }
}

export function readPremiumReturn(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return parsePremiumReturn(window.sessionStorage.getItem(STORAGE_KEY), Date.now());
  } catch {
    return null;
  }
}

export function clearPremiumReturn(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}

export function isPremiumReturnCheckpoint(pathname: string | null): boolean {
  return pathname !== null && PREMIUM_RETURN_CHECKPOINTS.includes(pathname);
}
