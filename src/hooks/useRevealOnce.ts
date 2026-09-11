'use client';

import { useEffect, useRef } from 'react';

import { prefersReducedMotion } from '@/lib/motion';
import { SCREEN_SCROLL_ATTR } from '@/lib/scrollRestore';

/**
 * Scroll Reveal — **한 번만 재생된다** (v1.46 · §27 · §30 · §36)
 *
 * ══ 이 훅이 존재하는 이유는 '연출'이 아니라 '결함' 쪽이다 ══════════════════
 *
 * scroll reveal의 기본형(IntersectionObserver로 들어오면 보이고 나가면 숨김)은
 * viewport 경계에서 이렇게 된다:
 *
 * ```
 * 스크롤을 1px 위아래로 흔든다
 *   intersecting true → false → true → false …
 *   → 같은 요소의 애니메이션이 계속 다시 재생된다 (§27 실패 조건 그대로)
 * ```
 *
 * 그래서 이 훅의 규칙은 하나다:
 *
 * > **한 번 보인 요소는 다시 숨기지 않는다. observer는 그 즉시 끊는다.**
 *
 * ══ 상태는 DOM 한 곳에만 둔다 ══════════════════════════════════════════════
 *
 * `data-reveal` 하나가 전부다. React state도, 별도 Set도 두지 않는다.
 *
 * ```
 * (없음)     아직 아무도 줍지 않았다
 * "pending"  observer가 지켜보는 중 — 화면상으론 '없음'과 같다(둘 다 opacity 0)
 * "in"       등장 완료. 되돌리는 코드는 어디에도 없다
 * ```
 *
 * ⚠️ 예전 구현은 `useRef<WeakSet>`으로 '이미 observe한 요소'를 따로 기억했다. 그게
 * **실측에서 화면을 통째로 투명하게 만들었다**: React Strict Mode(dev)는 mount →
 * unmount → mount를 한 번 더 돌리는데, 그때 observer는 cleanup에서 사라지고 ref의
 * WeakSet은 살아남는다. 두 번째 mount에서 모든 요소가 "이미 observe했다"로 걸러져
 * **아무도 관찰되지 않았고**, `.reveal-once`의 `opacity: 0`만 남았다. 진실의 출처가
 * 둘(observer의 수명 · ref의 기억)이면 언젠가 갈린다 — 그래서 하나로 합쳤다.
 *
 * ══ 훅이 실패해도 본문이 사라지지 않는다 (3중 안전장치) ════════════════════
 *
 * `.reveal-once`의 초기 상태가 `opacity: 0`이므로, 연출이 안 도는 상황에서는
 * **즉시 최종 상태**가 되어야 한다:
 *
 * ```
 * ① prefers-reduced-motion       → 즉시 in (§29 — scroll movement off)
 * ② IntersectionObserver 없음     → 즉시 in
 * ③ 이미 화면 위/안에 있는 요소   → 즉시 in (아래 참고)
 * ```
 *
 * ③이 특히 중요하다. `useScrollRestore`가 Back으로 돌아온 사용자를 페이지 중간으로
 * 되돌리면, **그 위쪽 요소들은 한 번도 교차하지 않는다** — observer만 믿으면 화면
 * 위쪽 절반이 영구히 투명해진다. mount 시점에 `getBoundingClientRect()`로 이미
 * 지나온 요소를 먼저 확정하는 이유다(§36 — 뒤로가기 이상 replay 0).
 *
 * ══ 하지 않는 것 ═══════════════════════════════════════════════════════════
 *
 * ⚠️ **레이아웃을 바꾸지 않는다.** 움직이는 것은 `opacity`와 `transform`뿐이라
 * `scrollHeight`가 변하지 않는다 — 그래서 `useScrollRestore`의 복원 재시도
 * (`max >= saved`)와 경쟁하지 않는다(§30 CLS · scroll jump).
 *
 * ⚠️ **observer를 남기지 않는다.** 요소가 보이면 `unobserve`하고, 화면을 떠나면
 * `disconnect`한다(§30 IntersectionObserver leak).
 */

/** §27 — 경계 1px에서 토글되지 않도록 충분히 들어왔을 때만 센다 */
const THRESHOLD = 0.25;

/**
 * 아래쪽에서 조금 일찍 시작한다. 위쪽은 `0px`이다 — 위로 되돌아가도 다시 판정할 일이
 * 없으므로(한 번 보이면 끝) 여유를 둘 이유가 없다.
 */
const ROOT_MARGIN = '0px 0px -12% 0px';

function screenScroller(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${SCREEN_SCROLL_ATTR}]`);
}

/**
 * 지금 화면(`ScreenLayout`의 스크롤 컨테이너) 안의 `.reveal-once`를 한 번씩 등장시킨다.
 *
 * ⚠️ ref를 돌려주지 않는다. 화면에 mount된 `ScreenLayout`은 항상 하나이고, 그
 * 컨테이너가 곧 이 연출의 범위다 — 호출부가 wrapper div를 하나 더 만들면 그
 * div가 flex/gap 레이아웃에 끼어든다.
 *
 * @param enabled `false`면 대상들을 즉시 최종 상태로 둔다 — 연출을 끄고 싶은 화면이
 *   클래스를 지우지 않아도 되게 하는 탈출구다.
 */
export function useRevealOnceInScreen(enabled = true): void {
  const observerRef = useRef<IntersectionObserver | null>(null);

  /**
   * ① observer의 수명. **아래 '대상 줍기' effect보다 먼저 선언돼야 한다** — mount
   * 시점에 effect는 선언 순서대로 실행되고, 뒤 effect가 이 observer를 쓴다.
   */
  useEffect(() => {
    if (!enabled) return;
    if (typeof IntersectionObserver !== 'function') return;
    if (prefersReducedMotion()) return;

    /**
     * **root는 브라우저 뷰포트가 아니라 앱의 스크롤 컨테이너다.**
     *
     * 이 앱은 `document`가 아니라 `ScreenLayout` 안쪽을 스크롤한다
     * (`SCREEN_SCROLL_ATTR` · v1.22 §12). 데스크톱에서는 그 컨테이너가 393×852
     * 프레임이고 브라우저 창은 훨씬 크므로, root를 비워두면 **프레임 밖에 있는
     * (사용자에게 안 보이는) 섹션까지 '보인다'고 판정**한다.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = 'in';
          // 재생은 한 번뿐이다 — 다시 판정할 이유가 없으므로 그 자리에서 끊는다.
          observer.unobserve(entry.target);
        }
      },
      { root: screenScroller(), threshold: THRESHOLD, rootMargin: ROOT_MARGIN },
    );
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      observerRef.current = null;
      /**
       * ⚠️ **아직 등장하지 않은 표식을 지운다.** 지우지 않으면 그 요소들은
       * `:not([data-reveal])`에 걸리지 않아 다음 mount에서 영영 주워지지 않는다 —
       * Strict Mode의 double mount에서 정확히 그 상태가 된다.
       *
       * `in`은 건드리지 않는다. 이미 사용자가 본 것이다.
       */
      const scope = screenScroller() ?? document;
      for (const element of scope.querySelectorAll<HTMLElement>('[data-reveal="pending"]')) {
        delete element.dataset.reveal;
      }
    };
  }, [enabled]);

  /**
   * ② 아직 처리하지 않은 대상 줍기. **dependency 배열이 없다 — 매 렌더 후 실행된다.**
   *
   * 결과 화면의 섹션은 한 번에 다 mount되지 않는다 — AI narrative가 늦게 도착하거나
   * 사용자가 무언가를 열면 새 `.reveal-once`가 나중에 나타난다. 한 번만 훑으면
   * **그 뒤에 생긴 섹션은 영구히 투명하다.** 처리한 요소는 `data-reveal`이 붙어
   * 선택자에서 빠지므로, 할 일이 없으면 `querySelectorAll` 한 번으로 끝난다.
   */
  useEffect(() => {
    const root = screenScroller();
    const scope: ParentNode = root ?? document;
    const targets = Array.from(
      scope.querySelectorAll<HTMLElement>('.reveal-once:not([data-reveal])'),
    );
    if (targets.length === 0) return;

    const observer = observerRef.current;

    /** ①② — observer가 없다는 것은 연출이 꺼졌다는 뜻이다. 즉시 최종 상태로 둔다 */
    if (!observer) {
      for (const element of targets) element.dataset.reveal = 'in';
      return;
    }

    const rootRect = root?.getBoundingClientRect();
    const viewTop = rootRect?.top ?? 0;
    const viewHeight =
      rootRect?.height ?? window.innerHeight ?? document.documentElement.clientHeight;

    for (const element of targets) {
      const rect = element.getBoundingClientRect();
      /**
       * ③ 이미 지나왔거나(`bottom <= viewTop`) 충분히 들어와 있는 요소는 observer를
       * 기다리지 않는다. 앞 조건이 빠지면 Back 복원 경로에서 화면 위쪽이 통째로
       * 투명해진다.
       */
      if (rect.bottom <= viewTop || rect.top < viewTop + viewHeight * (1 - THRESHOLD)) {
        element.dataset.reveal = 'in';
      } else {
        element.dataset.reveal = 'pending';
        observer.observe(element);
      }
    }
  });
}
