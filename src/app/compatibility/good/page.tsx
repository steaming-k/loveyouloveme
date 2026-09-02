import { redirect } from 'next/navigation';

import { RESULT_ANCHORS, ROUTES } from '@/lib/routes';

/**
 * v1.11 Route 호환 — `/compatibility/good` → `/compatibility#good`
 *
 * S23 잘 맞는 신호는 `/compatibility` Compatibility Result 안의 한 section이 됐다
 * (Result Experience Consolidation). 기존 링크·북마크·프로토타입 패널 참조가 깨지지
 * 않도록 이 경로는 남겨두고 리다이렉트만 한다.
 */
export default function GoodSignalRedirect() {
  redirect(`${ROUTES.compatibility}#${RESULT_ANCHORS.compatibilityGood}`);
}
