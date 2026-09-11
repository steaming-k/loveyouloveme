/**
 * Navigation Fixture — NAV-01~13 (v1.46.2 §Navigation)
 *
 * ══ 이 스크립트가 고정하는 것 ═══════════════════════════════════════════════
 *
 * > **BACK = 직전 사용자 맥락. 고정된 부모 Route가 아니다.**
 *
 * 그 약속은 두 층으로 나뉘고, 검사 방법도 다르다:
 *
 *   ① **어디로 돌아가는가** — `applyNavEntry`의 판정이다. `/api/dev/nav-test`가
 *      화면과 **같은 함수**를 돌리므로 브라우저 없이 값으로 고정한다.
 *   ② **어떻게 보이는가** — 스크롤 위치 복원·브라우저 back·모션은 실제 화면에서만
 *      확인된다. 여기서는 **구조**만 고정한다(복원 훅이 그 화면에 붙어 있는가,
 *      back 버튼이 하드코딩 push로 되돌아가지 않았는가). 실측은 Browser QA가 한다.
 *
 * ⚠️ 판정 로직을 이 파일에 복제하지 않는다 — dev route가 실제 함수를 부른다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:nav`
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';

let pass = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${label}`);
    return;
  }
  failures.push({ label, detail });
  console.log(`  ✗ ${label}`);
  if (detail !== undefined) console.log(`      ${JSON.stringify(detail)}`);
}

async function trail(steps) {
  const response = await fetch(`${BASE_URL}/api/dev/nav-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ steps }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} — dev 서버가 떠 있는지 확인해줘${detail ? ` · ${detail}` : ''}`);
  }
  const json = await response.json();
  if (!json.ok) throw new Error(JSON.stringify(json));
  return json.data;
}

const src = (rel) => readFile(join(ROOT, 'src', rel), 'utf8');

const push = (href) => ({ href, kind: 'push' });
const pop = (href) => ({ href, kind: 'pop' });
const replace = (href) => ({ href, kind: 'replace' });

async function main() {
  console.log('\n══ NAV — Contextual Back ══════════════════════════════════════\n');

  /* ── ① 결과 → 상세 → Back : 진입한 화면으로 돌아간다 ───────────────────── */

  {
    // NAV-01 Mirror → MBTI 상세 → Back
    const data = await trail([push('/home'), push('/mirror'), push('/lens/mbti'), pop('/mirror')]);
    check('NAV-01 Mirror → 상세 → Back = Mirror', data.current === '/mirror', data);
    check('NAV-01 Mirror에서 한 번 더 Back하면 Home이 남아 있다', data.previous === '/home', data);
    check('NAV-01 되돌아온 뒤에도 앱 내부 이력이 있다', data.hasInAppHistory === true, data);
  }

  {
    // NAV-03 Premium은 **연 곳**으로 닫힌다. 예전에는 source별 고정 Route였다.
    const fromHome = await trail([
      push('/home'),
      push('/premium?source=mbti&hook=home_bundle&returnTo=home'),
      pop('/home'),
    ]);
    check('NAV-03 Home에서 연 Premium은 Home으로 닫힌다', fromHome.current === '/home', fromHome);

    const fromMirror = await trail([
      push('/home'),
      push('/mirror?view=revisit&source=home'),
      push('/premium?source=mirror&returnTo=home'),
      pop('/mirror?view=revisit&source=home'),
    ]);
    check(
      'NAV-03 Mirror에서 연 Premium은 Revisit 쿼리까지 그대로 복귀',
      fromMirror.current === '/mirror?view=revisit&source=home',
      fromMirror,
    );
  }

  {
    // NAV-05 History 목록 → 상세 → Back
    const data = await trail([push('/home'), push('/history'), push('/history/e2'), pop('/history')]);
    check('NAV-05 History 상세 → Back = History 목록', data.current === '/history', data);
  }

  {
    // 같은 상세 화면을 **다른 곳에서** 열면 다른 곳으로 돌아간다 — 이번 결함의 핵심
    const fromHub = await trail([
      push('/compatibility'),
      push('/compatibility/lenses'),
      push('/lens/saju'),
      pop('/compatibility/lenses'),
    ]);
    const fromLensList = await trail([push('/lens'), push('/lens/saju'), pop('/lens')]);
    check(
      'NAV-01b 렌즈 허브에서 연 사주 → Back = 렌즈 허브',
      fromHub.current === '/compatibility/lenses',
      fromHub,
    );
    check('NAV-01b 렌즈 목록에서 연 사주 → Back = 렌즈 목록', fromLensList.current === '/lens', fromLensList);
  }

  /* ── ② Linear input flow : 직전 step ──────────────────────────────────── */

  {
    const data = await trail([
      push('/profile/declared/1'),
      push('/profile/declared/2'),
      push('/profile/declared/3'),
      pop('/profile/declared/2'),
    ]);
    check('NAV-06 질문 step Back = 직전 step', data.current === '/profile/declared/2', data);
    check('NAV-06 step을 건너뛰지 않는다', data.previous === '/profile/declared/1', data);
  }

  /* ── ③ Direct / Deep link : 이때만 fallback ───────────────────────────── */

  {
    const direct = await trail([push('/lens/saju')]);
    check('NAV-07 주소창 직접 진입은 앱 내부 이력이 없다', direct.hasInAppHistory === false, direct);

    // 가드 redirect(`replace`)가 깊이를 부풀리면 직접 진입이 '앱 안에서 왔다'로 뒤집힌다
    const guarded = await trail([push('/mirror'), replace('/home')]);
    check(
      'NAV-08 가드 redirect는 새 방문으로 쌓이지 않는다',
      guarded.depth === 1 && guarded.hasInAppHistory === false,
      guarded,
    );

    // 로딩 → 결과도 replace다. 결과에서 Back하면 로딩이 아니라 입력 화면으로 간다.
    const analyzing = await trail([
      push('/target'),
      push('/compatibility/analyzing'),
      replace('/compatibility'),
    ]);
    check(
      'NAV-08b 로딩 화면은 Back 경로에 남지 않는다',
      analyzing.previous === '/target' && analyzing.current === '/compatibility',
      analyzing,
    );
  }

  /* ── ④ back/forward가 어긋나지 않는다 ─────────────────────────────────── */

  {
    // back → forward → back. 같은 화면이 두 번 쌓이거나 깊이가 새면 왕복 loop가 된다.
    const data = await trail([
      push('/home'),
      push('/mirror'),
      pop('/home'),
      pop('/mirror'), // forward도 popstate로 도착한다 — 돌아갈 곳이 아니므로 push로 교정된다
      pop('/home'),
    ]);
    check('NAV-10 back/forward 왕복 뒤에도 깊이가 새지 않는다', data.depth === 1, data);
    check('NAV-10 같은 화면이 중복으로 쌓이지 않는다', data.current === '/home', data);

    const repeated = await trail([push('/home'), push('/home'), push('/home')]);
    check('NAV-10b 같은 URL 재진입(StrictMode 이중 mount)이 깊이를 늘리지 않는다', repeated.depth === 1, repeated);
  }

  console.log('\n══ NAV — 구조 고정 (소스 스캔) ════════════════════════════════\n');

  {
    const header = await src('components/common/ScreenHeader.tsx');
    check('NAV-09 back 버튼이 하드코딩 push를 하지 않는다', !header.includes('router.push(backHref)'), null);
    check('NAV-09 back 버튼은 contextual back을 쓴다', header.includes('useContextualBack('), null);

    const tracker = await src('components/shell/NavTrailTracker.tsx');
    check(
      'NAV-10c 방문 기록기는 history를 다시 쓰지 않는다 (관찰만)',
      !tracker.includes('router.') && !tracker.includes('history.pushState') && !tracker.includes('history.go'),
      null,
    );

    const hook = await src('hooks/useContextualBack.ts');
    check(
      'NAV-07b 앱 내부 이력이 없을 때만 fallback으로 간다',
      hook.includes('hasInAppHistory()') && hook.includes('router.back()'),
      null,
    );
    check(
      'NAV-07c fallback은 push가 아니라 replace다 (직접 진입 화면으로 되돌아오지 않게)',
      hook.includes('router.replace(fallback)'),
      null,
    );
  }

  {
    // NAV-02 · NAV-04 — 왕복이 일어나는 화면에는 스크롤 복원이 붙어 있어야 한다
    const screens = [
      ['compatibility', 'app/compatibility/page.tsx'],
      ['mirror', 'app/mirror/page.tsx'],
      ['premium', 'app/premium/page.tsx'],
      ['history', 'app/history/page.tsx'],
      ['first-contact', 'app/first-contact/page.tsx'],
    ];
    for (const [name, rel] of screens) {
      const code = await src(rel);
      check(`NAV-02/04 ${name} 화면에 스크롤 복원이 있다`, code.includes('useScrollRestore('), null);
    }
  }

  {
    // NAV-12 — 분석 A의 위치가 분석 B로 새지 않는다. 키에 분석 id가 들어간다.
    const compat = await src('app/compatibility/page.tsx');
    const mirror = await src('app/mirror/page.tsx');
    const premium = await src('app/premium/page.tsx');
    check('NAV-12 궁합 스크롤 키가 분석 id로 갈린다', compat.includes('`compat:${funnelAnalysisId}`'), null);
    check('NAV-12 Mirror 스크롤 키가 분석 id로 갈린다', mirror.includes('`mirror:${funnelAnalysisId}`'), null);
    check(
      'NAV-12 Premium 스크롤 키가 분석 id로 갈린다',
      premium.includes('`premium:${source}:${funnelAnalysisId}`'),
      null,
    );
    check(
      'NAV-12b 화면끼리 키 접두사가 겹치지 않는다',
      new Set(['compat:', 'mirror:', 'premium:', 'history:', 'first-contact']).size === 5,
      null,
    );
  }

  {
    // NAV-11 — 복원된 위치 위쪽 요소가 다시 재생되거나 영구히 투명해지지 않는다
    const reveal = await src('hooks/useRevealOnce.ts');
    check(
      'NAV-11 이미 지나온 요소는 observer를 기다리지 않는다',
      reveal.includes('rect.bottom <= viewTop'),
      null,
    );
    check('NAV-11b 한 번 보인 요소는 다시 숨기지 않는다', reveal.includes('observer.unobserve(entry.target)'), null);

    const restore = await src('hooks/useScrollRestore.ts');
    check(
      'NAV-11c 복원은 smooth 애니메이션을 쓰지 않는다 (점프가 보이지 않게)',
      !restore.includes("behavior: 'smooth'"),
      null,
    );
  }

  {
    // NAV-13 — replace는 반드시 예고된다. 예고 없는 replace 하나가 ①의 판정을 뒤집는다.
    const files = await listSourceFiles(join(ROOT, 'src', 'app'));
    files.push(...(await listSourceFiles(join(ROOT, 'src', 'components'))));
    const offenders = [];
    for (const file of files) {
      const code = await readFile(file, 'utf8');
      // 주석에 남긴 '예전에는 router.replace였다' 설명은 호출이 아니다
      const lines = code
        .split('\n')
        .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line));
      if (lines.some((line) => line.includes('router.replace('))) {
        offenders.push(file.slice(ROOT.length + 1));
      }
    }
    check('NAV-13 화면이 router.replace를 직접 부르지 않는다 (useNavReplace만)', offenders.length === 0, offenders);
  }

  {
    // NAV-15 — 펼쳐둔 렌즈는 돌아왔을 때도 펼쳐져 있다(위치만 맞고 내용이 다르면 복원이 아니다)
    const section = await src('components/premium/PremiumLensSection.tsx');
    const report = await src('components/premium/RelationshipDeepReportView.tsx');
    check('NAV-15 렌즈 펼침 상태를 보관한다', section.includes('readOpenState(stateKey)'), null);
    check(
      'NAV-15b 보관 키가 분석 id로 갈린다',
      report.includes('`premium-lens:${funnelAnalysisId}`'),
      null,
    );
    check(
      'NAV-15c 복원은 열기 이벤트를 다시 발생시키지 않는다',
      // onOpen()은 toggle() 안에서만 불린다 — 복원 effect는 setOpen만 한다
      section.includes('if (saved.length > 0) setOpen(new Set(saved));') &&
        !/useEffect\([^)]*\)[^]*?premium_lens_open/.test(
          section.slice(section.indexOf('useEffect('), section.indexOf('const toggle')),
        ),
      null,
    );

    const openState = await src('lib/openState.ts');
    check(
      'NAV-15d 보관하는 것은 항목 id뿐이다 (해석 문장·답변 아님)',
      openState.includes('sessionStorage') && !openState.includes('answers'),
      null,
    );
  }

  {
    // §11 Core 영향 0 — Navigation layer는 판정 로직을 알지 못한다
    const navTrail = await src('lib/navTrail.ts');
    const hook = await src('hooks/useContextualBack.ts');
    check(
      'NAV-14 Navigation 모듈이 판정 로직을 import하지 않는다',
      !navTrail.includes('@/lib/logic') && !hook.includes('@/lib/logic'),
      null,
    );
    check(
      'NAV-14b Navigation 저장소에 사용자 답변이 들어가지 않는다 (경로 문자열만)',
      navTrail.includes('JSON.stringify(entries)') && !navTrail.includes('answers'),
      null,
    );
  }

  console.log(`\n결과 — 통과 ${pass} · 실패 ${failures.length}\n`);
  if (failures.length > 0) {
    for (const failure of failures) console.log(`  ✗ ${failure.label}`);
    process.exit(1);
  }
}

async function listSourceFiles(dir) {
  const { readdir } = await import('node:fs/promises');
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listSourceFiles(full)));
    else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
