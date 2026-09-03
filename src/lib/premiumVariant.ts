import { PREMIUM_TEST_PRICE_ENV, PREMIUM_VARIANT_ENV } from '@/lib/env';
import type { PremiumPriceVariant } from '@/types';

/**
 * 가격 실험 variant 고정
 *
 * ⚠️ **같은 세션에서 가격이 바뀌면 안 된다.** 첫 노출 시 sessionStorage에 고정하고, 이후
 * 새로고침·재진입에도 같은 값을 쓴다. 가격이 흔들리면 사용자를 속이는 것이고, 분석도 못 한다.
 *
 * v1.15 — 3,900/4,900원 A/B 실험을 종료하고 **MVP 단일 가격 ₩1,900**으로 바꿨다.
 * HYPOTHESIS: 지금 무료 결과 대비 Premium(Deep Report)의 체감 차이를 고려하면, 1,900원이
 * 첫 실제 WTP 검증 가격으로 더 적절할 수 있다. NOT VALIDATED: 실제 결제 전환 데이터 없음.
 * A/B variant 골격(`resolvePriceVariant`/`resolvePrice`)은 나중에 가격 실험을 다시 하기
 * 위해 그대로 남겨뒀지만, 지금은 두 variant 모두 같은 값을 가리켜서 사용자가 실제로
 * 다른 가격을 보는 일은 없다.
 */

const STORAGE_KEY = 'lym.premium.variant';

export const PREMIUM_PRICE: Record<PremiumPriceVariant, number> = {
  A: 1900,
  B: 1900,
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

/** `₩1,900` */
export function formatPrice(price: number): string {
  return `₩${price.toLocaleString('ko-KR')}`;
}

/** 스크린리더용 — 기호 대신 읽히도록 (§38) */
export function priceForScreenReader(price: number): string {
  return `${price.toLocaleString('ko-KR')}원`;
}
