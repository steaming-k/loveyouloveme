'use client';

import { useEffect } from 'react';

import {
  SCREEN_SCROLL_ATTR,
  readScrollPosition,
  writeScrollPosition,
} from '@/lib/scrollRestore';

/** 복원 시도 횟수 — 결과 섹션이 다 그려질 때까지 몇 프레임 기다린다 */
const RESTORE_ATTEMPTS = 20;

/**
 * 하위 화면을 보고 Back으로 돌아왔을 때 읽던 위치로 되돌린다 (v1.22 §12)
 *
 * 왜 직접 구현하는가: 스크롤 주체가 document가 아니라 `ScreenLayout` 내부 컨테이너다.
 * 브라우저·Next.js의 native scroll restoration은 document 스크롤만 되돌리므로 이 앱에서는
 * 아무 일도 하지 않는다 — 결과 화면에서 Lens 상세를 보고 돌아오면 항상 맨 위였던 이유다.
 *
 * 동작:
 *   1. `key`가 null이거나 `enabled=false`면 아무 것도 하지 않는다.
 *   2. **URL에 hash가 있으면 복원하지 않는다** — `#approach` 같은 Deep Link·Legacy
 *      Redirect로 들어온 것이므로 `useAnchorScroll`의 앵커 이동이 이긴다. 그 경우에도
 *      저장은 계속하므로, 그 화면에서 다시 하위로 들어갔다 오면 정상 복원된다.
 *   3. 저장값이 있으면 **먼저 즉시** 되돌리고, 아직 내용이 덜 그려져 높이가 모자라면
 *      충분해질 때까지 몇 프레임 재시도한다(Report 섹션·AI Narrative가 늦게 채워진다).
 *      ⚠️ 첫 시도를 rAF에 맡기지 않는 이유: 탭이 가려져 있으면 rAF가 실행되지 않는다.
 *   4. 위치는 스크롤 이벤트에서 **동기 변수에 기록**하고, sessionStorage 쓰기만 rAF로 묶는다.
 *
 * ⚠️ 언마운트 시 컨테이너의 `scrollTop`을 다시 읽지 않는다. 라우트 전환 시점에는 그 노드가
 * 이미 분리돼 있어서 0으로 읽히고, 그러면 저장값을 0으로 덮어써 복원이 깨진다(실측 확인).
 * 그래서 마지막으로 관측한 값(`latest`)을 그대로 저장한다.
 *
 * 하지 않는 것:
 *   - 포커스를 옮기지 않는다(§27). 위치만 되돌리고 읽던 흐름을 방해하지 않는다.
 *   - `smooth` 애니메이션을 쓰지 않는다 — 돌아오는 순간 화면이 흐르면 오히려 혼란스럽고,
 *     reduced-motion 사용자에게도 불필요한 움직임이다.
 */
export function useScrollRestore(key: string | null, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !key) return;
    if (typeof window === 'undefined') return;

    const container = document.querySelector<HTMLElement>(`[${SCREEN_SCROLL_ATTR}]`);
    if (!container) return;

    const saved = readScrollPosition(key);
    const hasHash = window.location.hash.length > 1;
    let cancelled = false;
    /** 마지막으로 관측한 위치. 언마운트 시 이 값을 저장한다 */
    let latest = container.scrollTop;

    if (saved !== null && !hasHash) {
      let attempts = 0;
      /** @returns 목표 위치까지 되돌렸는지 */
      const tryRestore = (): boolean => {
        const max = container.scrollHeight - container.clientHeight;
        const next = Math.min(saved, Math.max(0, max));
        container.scrollTop = next;
        latest = next;
        return max >= saved;
      };

      const retry = () => {
        if (cancelled) return;
        attempts += 1;
        if (tryRestore() || attempts >= RESTORE_ATTEMPTS) return;
        window.requestAnimationFrame(retry);
      };

      if (!tryRestore()) window.requestAnimationFrame(retry);
    }

    let frame: number | null = null;
    const onScroll = () => {
      latest = container.scrollTop;
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        writeScrollPosition(key, latest);
      });
    };

    /** 스크롤 이벤트 없이 화면을 떠나는 경우(탭 전환·뒤로 가기)에도 남긴다 */
    const flush = () => writeScrollPosition(key, latest);

    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);

    return () => {
      cancelled = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
      flush();
    };
  }, [key, enabled]);
}
