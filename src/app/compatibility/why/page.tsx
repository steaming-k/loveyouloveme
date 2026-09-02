import { redirect } from 'next/navigation';

import { RESULT_ANCHORS, ROUTES } from '@/lib/routes';

/**
 * v1.11 Route 호환 — `/compatibility/why` → `/compatibility#why`
 *
 * S22 Compatibility Detail은 S21/S23/S24/S25와 함께 `/compatibility` 하나로 합쳐졌다
 * (Result Experience Consolidation). 기존 링크·북마크·프로토타입 패널 참조가 깨지지
 * 않도록 이 경로는 남겨두고, 합쳐진 화면의 해당 section으로 리다이렉트만 한다.
 */
export default function CompatibilityWhyRedirect() {
  redirect(`${ROUTES.compatibility}#${RESULT_ANCHORS.compatibilityWhy}`);
}
