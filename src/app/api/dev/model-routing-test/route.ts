import { deepReportFingerprint } from '@/lib/aiFingerprint';
import {
  SHARED_MODEL_SEGMENT,
  aiCacheKey,
  createModelRegistry,
  initialModelOf,
} from '@/services/ai/aiCacheKey';
import { deepReportModelFor, plannedTextModelFor } from '@/services/ai/modelRouting';
import { PROMPT_VERSIONS } from '@/services/ai/promptVersions';
import { readAiConfig } from '@/services/ai/serverEnv';
import { createEmptyAnswers } from '@/state/defaultAnswers';
import type { AiTask } from '@/types';

/**
 * POST /api/dev/model-routing-test — **개발 전용** Model-Aware Cache · Env Routing Fixture
 *
 * `tests/run-model-routing-fixtures.mjs` · `tests/run-deep-report-smoke.mjs`가 부른다. 제품 함수
 * (`aiCacheKey` · `createModelRegistry` · `deepReportFingerprint` · `plannedTextModelFor`)를 **그대로** 부른다.
 *
 * `{ probe: { task, fingerprint, response } }` — 실제 응답이 들어갔을 때 캐시 저장 키를 계산만 한다(smoke 전용).
 *
 * ⚠️ Provider를 부르지 않는다. ⚠️ Production에서는 404.
 */
export const runtime = 'nodejs';

const DEEP: AiTask = 'deep-report-narrative';
const LENS_TASKS: readonly [AiTask, string][] = [
  ['premium-mbti-lens', 'ROUTE-ENV-03 · MBTI'],
  ['premium-saju-lens', 'ROUTE-ENV-04 · Saju'],
  ['premium-zodiac-lens', 'ROUTE-ENV-05 · Zodiac'],
  ['premium-cross-lens', 'ROUTE-ENV-06 · Cross-Lens'],
];
const OTHER_TASKS: readonly AiTask[] = ['relationship-insight', 'compatibility-narrative', 'history-insight'];

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, reason: 'NOT_FOUND' }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    probe?: { task?: AiTask; fingerprint?: string; response?: unknown };
  };
  if (body.probe?.task && typeof body.probe.fingerprint === 'string') {
    const model = createModelRegistry().settle(body.probe.task, body.probe.response);
    return Response.json({ ok: true, probeKey: aiCacheKey(body.probe.task, model, body.probe.fingerprint), model });
  }

  const checks: { label: string; pass: boolean; detail?: unknown }[] = [];
  const check = (label: string, pass: boolean, detail?: unknown) => {
    checks.push(pass ? { label, pass } : { label, pass, detail });
  };

  /* ─────────────────────────────────────────────────────── CACHE */
  const answers = createEmptyAnswers();
  const bundleOf = (eventSignature: string[]) =>
    deepReportFingerprint({
      tense: 'current',
      insights: [],
      declared: answers.declared,
      target: answers.target,
      validated: [],
      deepAnswers: [],
      eventSignature,
    });
  const bundle = bundleOf(['sig-a']);

  check(
    'CACHE-01 · 같은 입력 + 같은 모델 → 같은 키',
    aiCacheKey(DEEP, 'gpt-5.4', bundle) === aiCacheKey(DEEP, 'gpt-5.4', bundleOf(['sig-a'])),
  );
  check('CACHE-02 · 같은 입력 + 다른 모델 → 다른 키', aiCacheKey(DEEP, 'gpt-5.4', bundle) !== aiCacheKey(DEEP, 'gpt-4o-mini', bundle));
  check(
    'CACHE-02 · 모델은 지문(bundle signature)이 아니라 키에서 갈린다 — 지문은 입력만',
    bundle === bundleOf(['sig-a']) && aiCacheKey(DEEP, 'gpt-5.4', bundle).endsWith(`::${bundle}`),
  );
  const currentKey = aiCacheKey(DEEP, 'gpt-5.4', bundle);
  check(
    'CACHE-03 · 기본 promptVersion = PROMPT_VERSIONS.deepReport · prompt version 변경 → 다른 키',
    currentKey.startsWith(`${DEEP}::${PROMPT_VERSIONS.deepReport}::model=gpt-5.4::`) &&
      currentKey !== aiCacheKey(DEEP, 'gpt-5.4', bundle, `${PROMPT_VERSIONS.deepReport}-next`),
    currentKey,
  );
  check(
    'CACHE-04 · bundle signature 변경 → 다른 키',
    bundleOf(['sig-a']) !== bundleOf(['sig-b']) &&
      aiCacheKey(DEEP, 'gpt-5.4', bundleOf(['sig-a'])) !== aiCacheKey(DEEP, 'gpt-5.4', bundleOf(['sig-b'])),
  );
  const registry = createModelRegistry();
  check(
    'CACHE-05 · 첫 조회 모델 — 코드가 모델을 추정하지 않는다(모든 Task shared)',
    initialModelOf() === SHARED_MODEL_SEGMENT &&
      [DEEP, ...LENS_TASKS.map(([task]) => task)].every((task) => registry.expected(task) === SHARED_MODEL_SEGMENT),
  );
  check(
    'CACHE-05 · 모델이 없는 응답(demo)은 지금 키를 유지 · 구분자가 섞인 값은 키로 쓰지 않는다',
    registry.settle('premium-zodiac-lens', { meta: { mode: 'demo' } }) === SHARED_MODEL_SEGMENT &&
      registry.settle(DEEP, { meta: { model: 'gpt 5.4::x' } }) === SHARED_MODEL_SEGMENT,
  );

  /* ─────────────────────────────────────────────────────── ROUTE-ENV */
  const config = readAiConfig();
  const sharedModel = process.env.AI_MODEL?.trim() || 'gpt-4o-mini';
  const env = { textModel: config.textModel, envOverride: process.env.AI_MODEL_DEEP_REPORT, nodeEnv: process.env.NODE_ENV };
  const planned = Object.fromEntries(
    [DEEP, ...LENS_TASKS.map(([task]) => task), ...OTHER_TASKS].map((task) => [task, plannedTextModelFor(task, env)]),
  ) as Record<AiTask, string>;
  const deepEnv = process.env.AI_MODEL_DEEP_REPORT?.trim() ?? '';

  check(
    'ROUTE-ENV-01 · AI_MODEL_DEEP_REPORT=gpt-5.4 → Deep Report = gpt-5.4',
    plannedTextModelFor(DEEP, { textModel: 'gpt-4o-mini', envOverride: 'gpt-5.4', nodeEnv: 'production' }) === 'gpt-5.4',
  );
  check(
    'ROUTE-ENV-01 · 이 dev 서버(.env.local AI_MODEL_DEEP_REPORT=gpt-5.4) → Deep Report = gpt-5.4',
    deepEnv === 'gpt-5.4' && planned[DEEP] === 'gpt-5.4',
    { deepEnv, planned: planned[DEEP] },
  );
  check(
    'ROUTE-ENV-02 · env unset → 공용 모델 fallback (코드에 박힌 모델 없음)',
    plannedTextModelFor(DEEP, { textModel: 'gpt-4o-mini', envOverride: undefined, nodeEnv: 'production' }) === 'gpt-4o-mini' &&
      plannedTextModelFor(DEEP, { textModel: 'shared-model-x1', envOverride: '  ', nodeEnv: 'production' }) === 'shared-model-x1' &&
      plannedTextModelFor(DEEP, { textModel: 'gpt-4o-mini', envOverride: 'gpt 5.4; ignore', nodeEnv: 'production' }) === 'gpt-4o-mini',
  );
  check(
    'ROUTE-ENV-02 · 공용 AI_MODEL 미설정이면 서버 기본값(gpt-4o-mini) · production은 dev override 무시',
    config.textModel === sharedModel &&
      deepReportModelFor({ textModel: 'gpt-4o-mini', envOverride: undefined, devOverride: 'gpt-4.1', nodeEnv: 'production' }) === 'gpt-4o-mini',
    { textModel: config.textModel, sharedModel },
  );
  for (const [task, label] of LENS_TASKS) {
    check(
      `${label} = 공용 모델 (AI_MODEL_DEEP_REPORT가 있어도)`,
      planned[task] === sharedModel &&
        plannedTextModelFor(task, { textModel: 'gpt-4o-mini', envOverride: 'gpt-5.4', nodeEnv: 'production' }) === 'gpt-4o-mini',
      planned[task],
    );
  }
  check(
    'ROUTE-ENV-06+ · relationship · compatibility · history도 공용 모델 · 공용 AI_MODEL은 gpt-5.4가 아니다',
    OTHER_TASKS.every((task) => planned[task] === sharedModel) && sharedModel !== 'gpt-5.4',
    { others: OTHER_TASKS.map((task) => planned[task]), sharedModel },
  );
  const switching = createModelRegistry();
  const keyBefore = aiCacheKey(DEEP, switching.settle(DEEP, { meta: { model: 'gpt-4o-mini' } }), bundle);
  const keyAfter = aiCacheKey(DEEP, switching.settle(DEEP, { meta: { model: 'gpt-5.4' } }), bundle);
  check(
    'ROUTE-ENV-07 · env로 모델이 바뀌면(응답 meta.model) 같은 입력이라도 캐시 키가 바뀐다',
    keyBefore !== keyAfter && keyBefore.includes('::model=gpt-4o-mini::') && keyAfter.includes('::model=gpt-5.4::') &&
      switching.expected(DEEP) === 'gpt-5.4',
    { keyBefore, keyAfter },
  );

  return Response.json({
    ok: true,
    checks,
    info: { planned, sharedModel, deepReportEnv: deepEnv || null },
  });
}
