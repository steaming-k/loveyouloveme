'use client';

import { useSyncExternalStore } from 'react';

import { PREMIUM_FAKE_DOOR, PREMIUM_PREVIEW, UT_MODE } from '@/lib/env';
import { resolvePremiumAccess, type PremiumAccess } from '@/lib/premiumAccess';
import { readUtMode, subscribeUtMode } from '@/lib/utMode';

/**
 * 화면이 UT Mode를 읽는 **유일한 방법** (`lib/utMode.ts`).
 *
 * `useSyncExternalStore`라 서버 렌더와 첫 hydration은 env 값으로 맞추고, 그 직후 탭 상태로 갱신한다.
 */
export function useUtMode(): boolean {
  return useSyncExternalStore(subscribeUtMode, readUtMode, () => UT_MODE);
}

/**
 * 화면이 Premium 노출을 판정하는 **유일한 방법.** env flag를 화면에서 직접 읽지 않는다.
 *
 * ⚠️ `paymentConfirmed`는 지금 항상 false다 — 실제 PG가 없다. PG가 붙으면 서버 검증 결과가 여기로 들어온다.
 */
export function usePremiumAccess(): PremiumAccess {
  const utMode = useUtMode();
  return resolvePremiumAccess({
    utMode,
    fakeDoorEnabled: PREMIUM_FAKE_DOOR,
    previewEnabled: PREMIUM_PREVIEW,
    paymentConfirmed: false,
  });
}
