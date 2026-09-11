'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { consumeNavPop, consumeNavReplace, recordNavEntry } from '@/lib/navTrail';

/**
 * 방문 기록기 (v1.46.2 §Navigation)
 *
 * 앱의 모든 화면 위에 한 번만 mount되어 **경로 변화를 관찰만** 한다. 이동을 만들지
 * 않고, history를 다시 쓰지 않는다 — 그래서 back/forward loop가 생길 여지가 없다.
 *
 * push / replace / pop을 가르는 방법:
 *   - 직전에 `popstate`가 있었으면 **pop 후보**다. 다만 신호를 그대로 믿지 않는다 —
 *     `applyNavEntry`가 '돌아갈 곳과 실제로 같은가'를 보고 아니면 push로 처리한다
 *     (forward로 도착한 경우가 그렇다).
 *   - `markNavReplace()` 예고가 있으면 replace다(가드 redirect·로딩 화면 전환).
 *   - 나머지는 push다.
 *
 * ⚠️ popstate 리스너는 **이 컴포넌트가 아니라 `navTrail` 모듈**에 있다. 이 컴포넌트는
 * `useSearchParams` 때문에 Suspense 경계 안에 있어 라우트마다 다시 mount되고, 그러면
 * 이벤트가 도착하는 순간 리스너가 없다(그 자리에 있던 버그를 실측으로 잡았다).
 *
 * ⚠️ 경로를 `window.location`에서 읽지 않는다. 검색 파라미터만 바뀌는 이동
 * (`/compatibility` → `/compatibility?view=revisit`)도 하나의 방문이기 때문이다.
 */
export function NavTrailTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams?.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    recordNavEntry(href, consumeNavPop() ? 'pop' : consumeNavReplace() ? 'replace' : 'push');
  }, [pathname, searchParams]);

  return null;
}
