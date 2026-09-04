/**
 * Scroll Position 보관소 (v1.22 §12)
 *
 * 이 앱은 `window`가 아니라 `ScreenLayout` 안의 `overflow-y-auto` 컨테이너를 스크롤한다.
 * 그래서 브라우저·Next.js의 기본 scroll restoration이 **원리적으로 동작하지 않는다** —
 * 그건 document 스크롤만 되돌린다. 결과 화면에서 Lens 상세로 들어갔다 Back으로 돌아오면
 * 항상 맨 위였던 이유가 이것이다.
 *
 * 그래서 위치를 직접 보관한다. 저장소는 sessionStorage다:
 *   - 탭을 닫으면 사라진다 (읽던 위치를 영구 보관할 이유가 없다)
 *   - 다른 탭·다른 기기와 공유되지 않는다
 *   - 값은 스크롤 오프셋 숫자뿐이다 — 답변·사진·분석 내용은 담지 않는다
 *
 * ⚠️ 키는 호출부가 준다. Compatibility 결과는 `funnelAnalysisId`를 쓰므로 **새 상대는
 * 새 키**가 되고, 이전 상대의 스크롤 위치를 물려받지 않는다.
 */

const PREFIX = 'lym.scroll.v1:';

/**
 * `ScreenLayout`이 스크롤 컨테이너에 붙이는 표식.
 *
 * 여기(서버·클라이언트 공용 lib)에 두는 이유: `ScreenLayout`은 Client Component가 아니다.
 * 이 상수를 `useScrollRestore`('use client')에서 가져오면 레이아웃 전체가 불필요하게
 * 클라이언트 모듈에 묶인다.
 */
export const SCREEN_SCROLL_ATTR = 'data-screen-scroll';

/** sessionStorage 자체가 막힌 환경(프라이빗 모드·설정)에서도 앱이 죽지 않아야 한다 */
export function readScrollPosition(key: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeScrollPosition(key: string, value: number): void {
  try {
    // 맨 위(0)는 저장할 필요가 없다 — 기본 상태와 같다.
    if (value <= 0) window.sessionStorage.removeItem(PREFIX + key);
    else window.sessionStorage.setItem(PREFIX + key, String(Math.round(value)));
  } catch {
    /* 저장 실패는 기능 실패가 아니다 — 다음 Back에서 맨 위로 갈 뿐이다 */
  }
}

export function clearScrollPosition(key: string): void {
  try {
    window.sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* noop */
  }
}
