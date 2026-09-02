'use client';

import { useEffect, useRef } from 'react';

import { trackEvent } from '@/lib/analytics';

/**
 * Deep Link Anchor Scroll (v1.11 §7/§35)
 *
 * Legacy Route redirect(`/compatibility/good` → `/compatibility#good`)나 직접 URL의
 * `#good` 같은 해시로 들어왔을 때, 해당 section까지 스크롤하고 포커스를 옮긴다.
 *
 * ⚠️ **Hydration 이전에 스크롤을 시도하지 않는다**(§35). `enabled=false`로 두면(예: 세션
 * 복원이 아직 안 끝난 `HydrationGate` 내부) 아무 일도 하지 않다가, `true`가 된 뒤 실제
 * DOM에 그 id를 가진 섹션이 그려진 다음에야 찾는다. 한 번만 실행한다 — 이후 사용자가
 * 직접 스크롤한 걸 코드가 다시 잡아채지 않는다.
 */
export function useAnchorScroll(enabled: boolean): void {
  const done = useRef(false);

  useEffect(() => {
    if (!enabled || done.current) return;
    if (typeof window === 'undefined') return;

    const hash = window.location.hash.replace('#', '');
    if (!hash) return;

    // 다음 페인트 이후로 미룬다 — 이 렌더에서 막 채워진 section이 아직 layout 전일 수 있다.
    const timer = window.setTimeout(() => {
      const target = document.getElementById(hash);
      if (!target) return;

      done.current = true;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // 스크린리더 사용자에게도 이동을 알린다. 섹션 자체가 포커스 가능한 요소가 아닐 수
      // 있으므로 임시로 tabindex를 주고, 포커스가 떠나면 원래 상태로 되돌린다.
      const hadTabIndex = target.hasAttribute('tabindex');
      if (!hadTabIndex) {
        target.setAttribute('tabindex', '-1');
        target.addEventListener(
          'blur',
          () => target.removeAttribute('tabindex'),
          { once: true },
        );
      }
      target.focus({ preventScroll: true });

      trackEvent('result_anchor_navigation', { section: hash });
    }, 50);

    return () => window.clearTimeout(timer);
  }, [enabled]);
}
