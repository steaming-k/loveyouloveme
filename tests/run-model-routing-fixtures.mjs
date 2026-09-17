/**
 * v1.47 — Model-Aware Cache · Env-based Deep Report Routing Fixture
 *
 * ```
 * CACHE-01~05     캐시 키 = promptVersion · 실제 모델 · bundle signature   (/api/dev/model-routing-test)
 * ROUTE-ENV-01~07 Deep Report 모델은 env(AI_MODEL_DEEP_REPORT) · 없으면 공용 AI_MODEL · 렌즈는 공용
 * ROUTE-06        Provider 호출 수 불변 (Deep Report 1 · 렌즈 3 · Cross-Lens 1 = 5)  (/api/dev/premium-test)
 * 정적            코드에 모델 id가 박혀 있지 않은가 · aiClient 조회/저장 키 · 모델 인자 받는 호출 1곳
 * ```
 *
 * ⚠️ 이 스크립트는 **Provider를 부르지 않는다.** 앞뒤로 실제 호출 카운터를 읽어 0 증가를 확인한다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:model-routing`
 */

import './_aiTestGuard.mjs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SEM_B, run, stressEvents, stripComments } from './fixtures-v1464.mjs';

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
  const suffix = detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 600)}`;
  failures.push(`${label}${suffix}`);
  console.log(`  ✗ ${label}${suffix}`);
}

async function guardCount() {
  const response = await fetch(`${BASE_URL}/api/dev/ai-guard`);
  if (!response.ok) throw new Error(`ai-guard ${response.status} — dev 서버 확인`);
  return (await response.json()).realProviderCalls;
}

console.log('\nModel-Aware Cache · Env Routing Fixture — v1.47\n');
const before = await guardCount();

console.log('■ CACHE · ROUTE-ENV (제품 함수 그대로)');
{
  const response = await fetch(`${BASE_URL}/api/dev/model-routing-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) throw new Error(`model-routing-test ${response.status} — dev 서버 확인`);
  const json = await response.json();
  check('model-routing-test — 라우트 응답', json.ok === true && Array.isArray(json.checks) && json.checks.length > 0, json);
  for (const item of json.checks ?? []) check(item.label, item.pass, item.detail);
  if (json.info) console.log(`  ℹ️  ${JSON.stringify(json.info)}`);
}

console.log('\n■ ROUTE-06 · Provider 호출 수 불변');
{
  const lensReady = (body) => ({
    ...body,
    mbti: 'INFP',
    birthProfile: { date: '1996-04-12', time: '10:30', calendarType: 'solar' },
    target: { ...body.target, mbti: 'ENFP', birthProfile: { date: '1995-08-20', time: null, calendarType: 'solar' } },
  });
  const flows = [
    ['사건 2', lensReady(SEM_B)],
    ['사건 20', lensReady({ ...SEM_B, target: { ...SEM_B.target, events: stressEvents(20) } })],
  ];
  for (const [name, body] of flows) {
    const flow = await run(body);
    const counts = Object.fromEntries(flow.ai.calls.map((call) => [call.task, call.count]));
    check(
      `ROUTE-06 · ${name} — 전체 5회(Deep Report 1 · Task마다 최대 1)`,
      flow.ai.totalCalls === 5 && counts['deep-report'] === 1 && Object.values(counts).every((count) => count <= 1),
      { total: flow.ai.totalCalls, counts },
    );
  }
}

console.log('\n■ 정적 — 모델 하드코딩 · 캐시 키 · 라우팅 배선');
{
  const src = async (path) => stripComments((await readFile(join(ROOT, path), 'utf8')).replace(/\r\n/g, '\n'));
  const routing = await src('src/services/ai/modelRouting.ts');
  const keySrc = await src('src/services/ai/aiCacheKey.ts');
  check(
    'P0 · 제품 라우팅 · 캐시 키 코드에 구체 모델 id가 없다(env로만 결정)',
    !/['"`]gpt-[0-9]/.test(routing) && !/['"`]gpt-[0-9]/.test(keySrc) && !/DEEP_REPORT_MODEL_ROUTE/.test(routing + keySrc),
  );
  check(
    'P0 · Deep Report 모델 = dev override → AI_MODEL_DEEP_REPORT → 공용 textModel',
    /isPlausibleModelId\(fromEnv\)\) return fromEnv;\s*return input\.textModel;/.test(routing),
  );
  const client = await src('src/services/ai/aiClient.ts');
  check(
    'aiClient — 조회 키 = aiCacheKey(task, models.expected(task), fingerprint)',
    /return aiCacheKey\(task, models\.expected\(task\), fingerprint\)/.test(client),
  );
  check(
    'aiClient — 저장 키 = 응답 모델(models.settle)',
    /const model = models\.settle\(task, data\);\s*cache\.set\(aiCacheKey\(task, model, fingerprint\), data\)/.test(client),
  );
  check('aiClient — 조회 키로 저장하던 cache.set(key, …) 경로가 없다', !/cache\.set\(key,/.test(client));
  check(
    'aiCacheKey — promptVersion · model · bundle signature를 모두 담는다',
    /`\$\{task\}::\$\{promptVersion\}::model=\$\{model\}::\$\{fingerprint\}`/.test(keySrc),
  );
  check('deepReportFingerprint — 모델을 넣지 않는다(입력만)', !/semanticModelId|modelRouting/.test(await src('src/lib/aiFingerprint.ts')));
  const handlers = await src('src/services/ai/handlers.ts');
  check(
    'handlers — 모델 인자를 받는 resolveProvider는 Deep Report 1곳 · 나머지 5곳은 공용 모델',
    (handlers.match(/resolveProvider\(false,\s*\w+\)/g) ?? []).length === 1 &&
      /resolveProvider\(false, deepModel\)/.test(handlers) &&
      (handlers.match(/resolveProvider\(false\)/g) ?? []).length === 5,
  );
  const envExample = await readFile(join(ROOT, '.env.example'), 'utf8');
  check(
    '.env.example — local/dev AI_MODEL_DEEP_REPORT=gpt-5.4 · 공용 AI_MODEL=gpt-4o-mini · production은 명시 설정',
    /^AI_MODEL_DEEP_REPORT=gpt-5\.4\r?$/m.test(envExample) &&
      /^AI_MODEL=gpt-4o-mini\r?$/m.test(envExample) &&
      /production/.test(envExample.slice(Math.max(0, envExample.search(/^AI_MODEL_DEEP_REPORT=/m) - 600), envExample.search(/^AI_MODEL_DEEP_REPORT=/m))),
  );
}

const after = await guardCount();
console.log('\n■ AI 비용 안전장치');
check('실제 Provider 호출 0 (전후 카운터 동일)', before === after, { before, after });

console.log(`\n${'─'.repeat(72)}`);
if (failures.length > 0) {
  console.log(`❌ Model Routing Fixture — ${passed} passed · ${failures.length} failed`);
  process.exit(1);
}
console.log(`✅ Model Routing Fixture — ${passed} checks passed · 실제 Provider 누적 ${after}`);
