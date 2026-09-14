/**
 * v1.47 Integration — **Deep Report Real Provider Smoke ×1** (유료 · 승인된 1회)
 *
 * ```
 * 확인   resolved model = gpt-5.4 (env AI_MODEL_DEEP_REPORT · dev override 없이)
 *        실제 Provider 호출 = 1
 *        캐시 저장 키 모델 = gpt-5.4
 *        generationRequestId가 응답에 그대로 돌아온다(서버 requestId와 별개)
 *        결과가 화면과 같은 함수로 정상 조립된다(Top 3 순서 불변)
 * ```
 *
 * ⚠️ ALLOW_REAL_AI_TESTS=1 없이는 요청 전에 종료한다. 이 스크립트는 Provider를 **한 번만** 부른다.
 *
 * 실행: 터미널 A `npm run dev`(.env.local AI_MODE=real · AI_MODEL_DEEP_REPORT=gpt-5.4)
 *       터미널 B `ALLOW_REAL_AI_TESTS=1 npm run test:ai:deep-report-smoke`
 */

import { assertRealAiTestAllowed } from './_aiTestGuard.mjs';
import { randomUUID } from 'node:crypto';

import { SEM_B } from './fixtures-v1464.mjs';

assertRealAiTestAllowed('Deep Report Real Smoke');

const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';
const EXPECTED_MODEL = 'gpt-5.4';
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

async function post(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}

async function guard() {
  return (await (await fetch(`${BASE_URL}/api/dev/ai-guard`)).json());
}

console.log('\nDeep Report Real Provider Smoke ×1 — v1.47 Integration\n');

const before = await guard();
if (before.envMode !== 'real') {
  console.error(`⛔ BLOCKED — 서버 AI_MODE가 real이 아니다(${before.envMode}). 호출하지 않는다.`);
  process.exit(2);
}

const prep = await post('/api/dev/premium-test?withAiContext=1', SEM_B);
const request = prep.json?.aiRequest;
if (!request || request.context.insights.length === 0) {
  console.error('⛔ BLOCKED — aiRequest가 없거나 보낼 Insight가 0이다. 호출하지 않는다.');
  process.exit(2);
}
const topBefore = prep.json.semanticTopCandidateIds;

const generationRequestId = randomUUID();
const inputFingerprint = `smoke_${Date.now()}`;
const started = Date.now();
/* ⚠️ devModelOverride를 보내지 않는다 — env 라우팅 자체를 확인한다 */
const call = await post('/api/ai/deep-report-narrative', { inputFingerprint, ...request, generationRequestId, devCapture: true });
const latencyMs = Date.now() - started;
const after = await guard();

const data = call.json?.data;
const dev = call.json?.dev;
check('HTTP 200 · ok', call.status === 200 && call.json?.ok === true, { status: call.status, reason: call.json?.reason });
check('mode = real', data?.meta?.mode === 'real', data?.meta?.mode);
check(`resolved model = ${EXPECTED_MODEL} (dev override 없음)`, dev?.model === EXPECTED_MODEL && data?.meta?.model === EXPECTED_MODEL, {
  dev: dev?.model,
  meta: data?.meta?.model,
});
check('actual provider call = 1', after.realProviderCalls - before.realProviderCalls === 1, {
  before: before.realProviderCalls,
  after: after.realProviderCalls,
});
check(
  'generationRequestId — 응답에 그대로 · 서버 requestId와 다르다',
  data?.generationRequestId === generationRequestId && call.json?.requestId !== generationRequestId,
  { echoed: data?.generationRequestId, requestId: call.json?.requestId },
);

const probe = await post('/api/dev/model-routing-test', {
  probe: { task: 'deep-report-narrative', fingerprint: inputFingerprint, response: data },
});
check(`cache key model = ${EXPECTED_MODEL}`, probe.json?.probeKey?.includes(`::model=${EXPECTED_MODEL}::`), probe.json);

const rendered = await post('/api/dev/premium-test', {
  ...SEM_B,
  narratives: data?.narratives ?? [],
  candidateSemantics: data?.candidateSemantics ?? [],
  actionPlan: data?.actionPlan ?? null,
});
const report = rendered.json?.report;
const top = report?.candidates?.slice(0, 3) ?? [];
check(
  'result renders normally — 리포트 조립 · Top 3 순서 불변',
  rendered.status === 200 && report?.available === true && top.length > 0 && JSON.stringify(top.map((card) => card.id)) === JSON.stringify(topBefore),
  { status: rendered.status, top: top.map((card) => card.id), topBefore },
);

console.log(
  `\n  ℹ️  ${JSON.stringify({
    latencyMs,
    semanticAiTop3: top.filter((card) => card.soWhatSource === 'semantic_ai').length,
    actionPlan: report?.actionPlan ? { mode: report.actionPlan.mode, source: report.actionPlan.source } : null,
    stages: dev?.stages,
    violations: dev?.violations,
    usage: dev?.usage,
  })}`,
);

console.log(`\n${'─'.repeat(72)}`);
if (failures.length > 0) {
  console.log(`❌ Deep Report Smoke — ${passed} passed · ${failures.length} failed · 실제 호출 ${after.realProviderCalls - before.realProviderCalls}`);
  process.exit(1);
}
console.log(`✅ Deep Report Smoke — ${passed} checks passed · 실제 호출 ${after.realProviderCalls - before.realProviderCalls}`);
