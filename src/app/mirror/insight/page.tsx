import { redirect } from 'next/navigation';

import { RESULT_ANCHORS, ROUTES } from '@/lib/routes';

/**
 * v1.11 Route 호환 — `/mirror/insight` → `/mirror#core-insight`
 *
 * S28 Core Insight는 S27 Mirror Map과 함께 `/mirror` Mirror Result 하나로 합쳐졌다
 * (Result Experience Consolidation) — 둘 다 '나는 관계에서 어떤 사람인가'라는 같은
 * Mental Model이라 Route 이동 비용을 둘 이유가 없다. 기존 링크·북마크·프로토타입 패널
 * 참조가 깨지지 않도록 이 경로는 남겨두고 리다이렉트만 한다.
 */
export default function CoreInsightRedirect() {
  redirect(`${ROUTES.mirror}#${RESULT_ANCHORS.mirrorCoreInsight}`);
}
