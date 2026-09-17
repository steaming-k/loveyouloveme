/**
 * P0 Real AI Guard Fixture — 일반 테스트는 어떤 env에서도 실제 Provider를 부르지 않는다
 *
 * ```
 * GUARD-01  모든 tests/run-*.mjs가 _aiTestGuard.mjs를 import한다
 * GUARD-02  유료 스크립트(provider-e2e · semantic-provider-qa)는 요청 전에 opt-in을 확인한다
 * GUARD-03  실제 Provider를 부를 수 있는 /api/ai 라우트가 전부 요청 정책으로 감싸져 있다
 * GUARD-04  Provider fetch 직전에 두 번째 방어선 + 호출 카운터
 * GUARD-05  정책 계산 — 테스트 헤더만 있으면 real → mock, opt-in 헤더면 env 그대로 (Provider 0회)
 * GUARD-06  AI_MODE=real 서버에서 테스트 요청(observed-profile)이 mock으로 응답 · 카운터 불변
 * GUARD-07  opt-in 없이 유료 스크립트를 실행하면 exit 2 · 카운터 불변
 * ```
 *
 * 사용법: npm run dev → node tests/run-ai-guard-fixtures.mjs
 */

import './_aiTestGuard.mjs';

import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';

const failures = [];
let passed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
    return;
  }
  const suffix = detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 400)}`;
  failures.push(`${label}${suffix}`);
  console.log(`  ✗ ${label}${suffix}`);
}

function codeOnly(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

async function callCount() {
  const response = await fetch(`${BASE_URL}/api/dev/ai-guard`);
  if (!response.ok) throw new Error(`ai-guard ${response.status} — dev 서버가 떠 있는지 확인할 것`);
  return response.json();
}

console.log(`Real AI Guard — ${BASE_URL}`);

/* ── GUARD-01 · 02 ─────────────────────────────────────────────────────── */
console.log('\n■ GUARD-01 · 02 테스트 스크립트');
const testFiles = (await readdir(join(ROOT, 'tests'))).filter((name) => /^run-.*\.mjs$/.test(name)).sort();
const unguarded = [];
for (const name of testFiles) {
  const text = await readFile(join(ROOT, 'tests', name), 'utf8');
  if (!/^import (\{ assertRealAiTestAllowed \} from )?'\.\/_aiTestGuard\.mjs';$/m.test(text)) unguarded.push(name);
}
check(`GUARD-01 · tests/run-*.mjs ${testFiles.length}개 전부 guard import`, unguarded.length === 0, unguarded);

for (const [name, label] of [
  ['run-provider-e2e.mjs', 'Real Provider E2E'],
  ['run-semantic-provider-qa.mjs', 'Semantic Provider QA'],
  ['run-deep-report-smoke.mjs', 'Deep Report Real Smoke'],
]) {
  const code = codeOnly(await readFile(join(ROOT, 'tests', name), 'utf8'));
  const assertAt = code.indexOf(`assertRealAiTestAllowed('${label}')`);
  const firstRequest = Math.min(
    ...['fetch(', 'await post(', 'await callTask('].map((token) => {
      const at = code.indexOf(token, code.indexOf('assertRealAiTestAllowed') + 1);
      return at < 0 ? Number.POSITIVE_INFINITY : at;
    }),
  );
  check(`GUARD-02 · ${name} — 요청보다 먼저 opt-in 확인`, assertAt > 0 && assertAt < firstRequest, { assertAt, firstRequest });
}

/* ── GUARD-03 · 04 ─────────────────────────────────────────────────────── */
console.log('\n■ GUARD-03 · 04 서버 경로');
const aiRoutes = (await readdir(join(ROOT, 'src', 'app', 'api', 'ai'), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name !== 'contract-test')
  .map((entry) => entry.name)
  .sort();
const unwrapped = [];
for (const name of aiRoutes) {
  const code = codeOnly(await readFile(join(ROOT, 'src', 'app', 'api', 'ai', name, 'route.ts'), 'utf8'));
  const post = code.slice(code.indexOf('export async function POST'));
  if (!/^export async function POST\(request: Request\): Promise<Response> \{\s*return withAiRequestPolicy\(request, \(\) => handlePost\(request\)\);/.test(post)) {
    unwrapped.push(name);
  }
}
check(`GUARD-03 · 실제 Provider 경로 /api/ai 라우트 ${aiRoutes.length}개 전부 정책으로 감쌈`, aiRoutes.length >= 9 && unwrapped.length === 0, unwrapped);
const contractTest = codeOnly(await readFile(join(ROOT, 'src', 'app', 'api', 'ai', 'contract-test', 'route.ts'), 'utf8'));
check('GUARD-03 · contract-test는 Provider를 만들지 않는다', !/resolveProvider\(|chat\/completions/.test(contractTest));

const provider = codeOnly(await readFile(join(ROOT, 'src', 'services', 'ai', 'provider.ts'), 'utf8'));
const fetchAt = provider.indexOf('/chat/completions');
check(
  'GUARD-04 · Provider fetch 직전에 차단 확인 → 카운터 → fetch',
  provider.lastIndexOf('isRealProviderBlocked()', fetchAt) > 0 &&
    provider.lastIndexOf('recordRealProviderCall()', fetchAt) > provider.lastIndexOf('isRealProviderBlocked()', fetchAt),
);
check('GUARD-04 · 실제 Provider fetch 지점은 한 곳', (provider.match(/\/chat\/completions/g) ?? []).length === 1);

/* ── GUARD-05 · 06 · 07 (서버) ─────────────────────────────────────────── */
console.log('\n■ GUARD-05 · 06 · 07 실행');
const before = await callCount();
console.log(`  env AI_MODE → ${before.envMode} · 실제 Provider 누적 ${before.realProviderCalls}`);

const probeTest = await (await fetch(`${BASE_URL}/api/dev/ai-guard`, { method: 'POST' })).json();
check('GUARD-05 · 테스트 요청은 차단 정책', probeTest.policy?.blockRealProvider === true, probeTest);
check(
  'GUARD-05 · 차단 정책에서 real은 mock으로 풀린다(real이 아닌 env는 그대로)',
  probeTest.resolvedMode === (probeTest.envMode === 'real' ? 'mock' : probeTest.envMode),
  probeTest,
);

const observed = await (
  await fetch(`${BASE_URL}/api/ai/observed-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-lym-session': `guard-${Date.now()}` },
    body: JSON.stringify({
      inputFingerprint: 'guard-probe',
      images: [
        {
          imageId: 'guard-1',
          dataUrl:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        },
      ],
    }),
  })
).json();
check('GUARD-06 · 테스트 요청 observed-profile 응답 mode가 real이 아니다', observed.ok === true && observed.data?.meta?.mode !== 'real', observed.data?.meta ?? observed);

for (const script of ['run-provider-e2e.mjs', 'run-semantic-provider-qa.mjs', 'run-deep-report-smoke.mjs']) {
  const env = { ...process.env };
  delete env.ALLOW_REAL_AI_TESTS;
  const child = spawnSync(process.execPath, [join(ROOT, 'tests', script)], { env, encoding: 'utf8', timeout: 60_000 });
  check(`GUARD-07 · opt-in 없이 ${script} → exit 2(요청 없음)`, child.status === 2 && /ALLOW_REAL_AI_TESTS=1/.test(child.stderr), {
    status: child.status,
    stderr: child.stderr.slice(0, 200),
  });
}

const after = await callCount();
check('GUARD-06 · 07 · 이 fixture 동안 실제 Provider 호출 0', after.realProviderCalls === before.realProviderCalls, { before: before.realProviderCalls, after: after.realProviderCalls });

console.log(`\n${'─'.repeat(72)}`);
if (failures.length === 0) {
  console.log(`✅ Real AI Guard Fixture — ${passed} checks passed · 실제 Provider 누적 ${after.realProviderCalls}`);
  process.exit(0);
}
console.log(`❌ ${failures.length} failed / ${passed} passed`);
for (const failure of failures) console.log(`  · ${failure}`);
process.exit(1);
