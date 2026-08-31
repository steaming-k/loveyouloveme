import { PREMIUM_TEST_PRICE_ENV, PREMIUM_VARIANT_ENV } from '@/lib/env';
import type { PremiumPriceVariant } from '@/types';

/**
 * 가격 실험 variant 고정
 *
 * ⚠️ **같은 세션에서 가격이 바뀌면 안 된다.** 첫 노출 시 sessionStorage에 고정하고, 이후
 * 새로고침·재진입에도 같은 값을 쓴다. 가격이 흔들리면 사용자를 속이는 것이고, 분석도 못 한다.
 *
 * 설문에서 4,900원 이하 구간에 응답이 모였지만 **검증된 가격이 아니다** — 두 후보의 의향
 * 차이를 관찰하기 위한 테스트 값이다.
 */

const STORAGE_KEY = 'lym.premium.variant';

export const PREMIUM_PRICE: Record<PremiumPriceVariant, number> = {
  A: 3900,
  B: 4900,
};

/** 이번 세션에 고정된 variant. 없으면 env 기본값으로 고정한 뒤 돌려준다. */
export function resolvePriceVariant(): PremiumPriceVariant {
  if (typeof window === 'undefined') return PREMIUM_VARIANT_ENV;

  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === 'A' || stored === 'B') return stored;

    window.sessionStorage.setItem(STORAGE_KEY, PREMIUM_VARIANT_ENV);
  } catch {
    // sessionStorage를 못 쓰면 env 값을 그대로 쓴다 — 세션 내에서는 어차피 같은 값이다.
  }

  return PREMIUM_VARIANT_ENV;
}

/**
 * 표시할 가격. `NEXT_PUBLIC_PREMIUM_TEST_PRICE`가 있으면 그 값이 variant보다 우선한다
 * (가격을 직접 고정해서 보고 싶을 때).
 */
export function resolvePrice(variant: PremiumPriceVariant): number {
  return PREMIUM_TEST_PRICE_ENV ?? PREMIUM_PRICE[variant];
}

/** `₩3,900` */
export function formatPrice(price: number): string {
  return `₩${price.toLocaleString('ko-KR')}`;
}

/** 스크린리더용 — 기호 대신 읽히도록 (§38) */
export function priceForScreenReader(price: number): string {
  return `${price.toLocaleString('ko-KR')}원`;
}
