/**
 * Navigation Trail — **BACK = 직전 사용자 맥락** (v1.46.2 §Navigation)
 *
 * ══ 왜 필요한가 ═══════════════════════════════════════════════════════════
 *
 * 이 앱의 뒤로가기는 오랫동안 `router.push(고정된 부모 Route)`였다. 그건 '돌아가기'가
 * 아니라 **앞으로 한 번 더 가기**다. 그래서 이런 일이 생겼다:
 *
 * ```
 * /compatibility/lenses → /lens/saju → 뒤로
 *   기대: /compatibility/lenses
 *   실제: /lens        (saju 화면이 하드코딩한 부모)
 * ```
 *
 * 그리고 history가 계속 자라서 **앱 back과 브라우저 back의 결과가 달라졌다** —
 * 앱 back을 세 번 눌러도 브라우저 back은 그만큼 되짚어야 앱을 벗어난다.
 *
 * ══ 이 모듈이 하는 일 ═════════════════════════════════════════════════════
 *
 * 이동 자체는 브라우저 history에 맡기고(`router.back()`), 이 모듈은 **"지금 화면이
 * 앱 안에서 열렸는가, 주소창으로 바로 열렸는가"** 하나만 판단한다. 그 한 가지가
 * `router.back()`이 안전한지를 가른다 — 직접 진입에서 back을 부르면 앱 밖으로
 * 나가거나 아무 일도 일어나지 않는다.
 *
 * ⚠️ **history를 다시 쓰지 않는다.** popstate를 가로채 되밀지 않고, 방문을 관찰만
 * 한다. back/forward를 우리가 조작하기 시작하면 무한 loop가 만들어진다(§10 NAV-10).
 *
 * ══ 무엇을 저장하는가 ═════════════════════════════════════════════════════
 *
 * sessionStorage에 **경로 문자열만** 쌓는다(`/premium?source=mirror` 수준).
 *   - 탭을 닫으면 사라지고 다른 탭·기기와 공유되지 않는다
 *   - 답변·상대 이름·생년월일 같은 값은 애초에 URL에 없다(§7 · v1.12 §28과 같은 기준)
 *   - 분석 결과를 담지 않으므로 분석 A의 맥락이 분석 B의 판정으로 새지 않는다.
 *     스크롤 위치처럼 **화면 상태**인 것은 `scrollRestore`가 `funnelAnalysisId`로
 *     범위를 나눈다 — 그쪽이 분석 단위 격리의 담당이다.
 */

export const NAV_TRAIL_KEY = 'lym.nav.v1';

/** 되짚을 일이 없는 오래된 경로까지 들고 있을 이유가 없다 */
const MAX_ENTRIES = 30;

export type NavKind = 'push' | 'replace' | 'pop';

/**
 * 방문 하나를 반영한 결과를 돌려준다. **순수 함수다** — 저장소를 모른다.
 *
 * 그래서 `/api/dev/nav-test`가 같은 함수로 NAV 시나리오를 돌릴 수 있다
 * (`tests/run-nav-fixtures.mjs`). 판정 로직을 테스트가 복제하지 않는다.
 *
 * `pop`은 **자기 교정한다**: 직전 항목이 실제로 돌아갈 곳과 같을 때만 하나를 버리고,
 * 아니면 push로 처리한다. popstate 신호는 놓치거나(해시 이동) 어긋날 수 있으므로
 * 신호를 그대로 믿지 않는다.
 */
export function applyNavEntry(entries: readonly string[], href: string, kind: NavKind): string[] {
  if (kind === 'replace') {
    if (entries.length === 0) return [href];
    return [...entries.slice(0, -1), href];
  }

  if (kind === 'pop' && entries.length >= 2 && entries[entries.length - 2] === href) {
    return entries.slice(0, -1);
  }

  // 같은 URL을 두 번 쌓지 않는다 — StrictMode의 이중 mount가 깊이를 부풀리지 않게.
  if (entries.length > 0 && entries[entries.length - 1] === href) return [...entries];

  return [...entries, href].slice(-MAX_ENTRIES);
}

/** sessionStorage가 막힌 환경(프라이빗 모드·설정)에서도 앱이 죽지 않아야 한다 */
export function readNavTrail(): string[] {
  try {
    const raw = window.sessionStorage.getItem(NAV_TRAIL_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function writeNavTrail(entries: readonly string[]): void {
  try {
    window.sessionStorage.setItem(NAV_TRAIL_KEY, JSON.stringify(entries));
  } catch {
    /* 저장 실패는 기능 실패가 아니다 — fallback back으로 동작이 내려갈 뿐이다 */
  }
}

export function recordNavEntry(href: string, kind: NavKind): void {
  if (typeof window === 'undefined') return;
  writeNavTrail(applyNavEntry(readNavTrail(), href, kind));
}

export function navDepth(): number {
  if (typeof window === 'undefined') return 0;
  return readNavTrail().length;
}

/** 직전 화면의 경로. 지금은 로그·테스트용이고 이동 자체는 history가 한다 */
export function previousNavEntry(): string | null {
  const entries = readNavTrail();
  return entries.length >= 2 ? entries[entries.length - 2]! : null;
}

/**
 * 이 화면이 **앱 안에서** 열렸는가.
 *
 * `false`면 주소창·외부 링크로 바로 들어온 것이다 — 그때만 fallback을 쓴다(§2 C).
 */
export function hasInAppHistory(): boolean {
  return navDepth() > 1;
}

/**
 * `router.replace()`로 이동한다는 예고.
 *
 * 예고가 없으면 replace도 새 방문으로 쌓여서 깊이가 부풀고, **직접 진입한 화면이
 * '앱 안에서 왔다'로 잘못 판정된다**(예: `/mirror` 직접 진입 → 데이터가 없어 `/home`으로
 * replace → 깊이 2). 그 상태에서 back을 부르면 앱 밖으로 나간다.
 *
 * 모듈 변수인 이유: 예고와 소비가 같은 클라이언트 번들 안에서 한 번의 이동으로 이어진다.
 * 저장소에 두면 새로고침 뒤에도 남아 다음 이동을 잘못 삼킨다.
 */
let pendingReplace = false;

export function markNavReplace(): void {
  pendingReplace = true;
}

export function consumeNavReplace(): boolean {
  const value = pendingReplace;
  pendingReplace = false;
  return value;
}

/**
 * back/forward(popstate) 신호.
 *
 * ⚠️ **리스너를 컴포넌트가 아니라 모듈에 둔다.** 처음에는 기록기 컴포넌트의 effect에
 * 달았는데, 그 컴포넌트는 `useSearchParams` 때문에 Suspense 경계 안에 있고 **라우트가
 * 바뀔 때마다 다시 mount된다** — 이벤트가 도착하는 순간에는 리스너가 붙어 있지 않아서
 * 모든 back이 새 방문(push)으로 기록됐다(실측 확인: 뒤로 간 뒤 trail 깊이가 줄지 않았다).
 *
 * 모듈 변수는 컴포넌트의 수명과 무관하다. 리스너는 번들이 로드될 때 한 번만 붙는다.
 */
let pendingPop = false;

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    pendingPop = true;
  });
}

export function consumeNavPop(): boolean {
  const value = pendingPop;
  pendingPop = false;
  return value;
}

export function resetNavTrail(): void {
  try {
    window.sessionStorage.removeItem(NAV_TRAIL_KEY);
  } catch {
    /* noop */
  }
}
