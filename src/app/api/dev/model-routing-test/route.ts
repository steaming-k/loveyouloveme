import { deepReportFingerprint } from '@/lib/aiFingerprint';
import {
  SHARED_MODEL_SEGMENT,
  aiCacheKey,
  createModelRegistry,
  initialModelOf,
} from '@/services/ai/aiCacheKey';
import { DEEP_REPORT_MODEL_ROUTE, deepReportModelFor, plannedTextModelFor } from '@/services/ai/modelRouting';
import { PROMPT_VERSIONS } from '@/services/ai/promptVersions';
import { readAiConfig } from '@/services/ai/serverEnv';
import { createEmptyAnswers } from '@/state/defaultAnswers';
import type { AiTask } from '@/types';

/**
 * POST /api/dev/model-routing-test — **개발 전용** v1.47 Model-Aware Cache · Deep Report Routing Fixture
 *
 * `tests/run-model-routing-fixtures.mjs`가 부른다. 제품 함수(`aiCacheKey` · `createModelRegistry` ·
 * `deepReportFingerprint` · `plannedTextModelFor`)를 **그대로** 부르고 판정만 돌려준다.
 *
 * ⚠️ Provider를 부르지 않는다. 모델 이름을 계산할 뿐이다.
 * ⚠️ Production에서는 404.
 */
export const runtime = 'nodejs';

const DEEP: AiTask = 'deep-report-narrative';
const LENS_TASKS: readonly [AiTask, string][] = [
  ['premium-mbti-lens', 'ROUTE-02 · MBTI Lens'],
  ['premium-saju-lens', 'ROUTE-03 · Saju Lens'],
  ['premium-zodiac-lens', 'ROUTE-04 · Zodiac Lens'],
  ['premium-cross-lens', 'ROUTE-05 · Cross-Lens'],
];
const OTHER_TASKS: readonly AiTask[] = ['relationship-insight', 'compatibility-narrative', 'history-insight'];

export async function POST(): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, reason: 'NOT_FOUND' }, { status: 404 });
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
  check(
    'CACHE-02 · 같은 입력 + 다른 모델 → 다른 키',
    aiCacheKey(DEEP, 'gpt-5.4', bundle) !== aiCacheKey(DEEP, 'gpt-4o-mini', bundle),
  );
  check(
    'CACHE-02 · 모델은 지문(bundle signature)이 아니라 키에서 갈린다 — 지문은 입력만',
    bundle === bundleOf(['sig-a']) && aiCacheKey(DEEP, 'gpt-5.4', bundle).endsWith(`::${bundle}`),
  );
  const currentKey = aiCacheKey(DEEP, 'gpt-5.4', bundle);
  check(
    'CACHE-03 · 기본 promptVersion = PROMPT_VERSIONS.deepReport',
    currentKey.startsWith(`${DEEP}::${PROMPT_VERSIONS.deepReport}::model=gpt-5.4::`),
    currentKey,
  );
  check(
    'CACHE-03 · prompt version 변경 → 다른 키',
    currentKey !== aiCacheKey(DEEP, 'gpt-5.4', bundle, `${PROMPT_VERSIONS.deepReport}-next`),
  );
  check(
    'CACHE-04 · bundle signature 변경 → 다른 키',
    bundleOf(['sig-a']) !== bundleOf(['sig-b']) &&
      aiCacheKey(DEEP, 'gpt-5.4', bundleOf(['sig-a'])) !== aiCacheKey(DEEP, 'gpt-5.4', bundleOf(['sig-b'])),
  );

  const registry = createModelRegistry();
  check(
    'CACHE-05 · 첫 조회 모델 — Deep Report는 라우팅 표, 나머지 Task는 shared',
    registry.expected(DEEP) === DEEP_REPORT_MODEL_ROUTE &&
      LENS_TASKS.every(([task]) => registry.expected(task) === SHARED_MODEL_SEGMENT && initialModelOf(task) === SHARED_MODEL_SEGMENT),
  );
  const lensSettled = registry.settle('premium-mbti-lens', { meta: { model: 'gpt-4o-mini' } });
  check(
    'CACHE-05 · shared fallback — 공용 모델 응답이 오면 그 모델 키로 확정(다른 렌즈는 영향 없음)',
    lensSettled === 'gpt-4o-mini' &&
      registry.expected('premium-mbti-lens') === 'gpt-4o-mini' &&
      registry.expected('premium-saju-lens') === SHARED_MODEL_SEGMENT,
  );
  check(
    'CACHE-05 · 모델이 없는 응답(demo)은 지금 키를 유지',
    registry.settle('premium-zodiac-lens', { meta: { mode: 'demo' } }) === SHARED_MODEL_SEGMENT,
  );
  const deepFallback = registry.settle(DEEP, { meta: { model: 'gpt-4o-mini' } });
  check(
    'CACHE-05 · 서버가 Deep Report를 공용 모델로 돌리면 그 모델 키에 저장 · 조회 — gpt-5.4 키를 재사용하지 않는다',
    deepFallback === 'gpt-4o-mini' &&
      aiCacheKey(DEEP, registry.expected(DEEP), bundle) !== aiCacheKey(DEEP, 'gpt-5.4', bundle),
  );
  registry.settle(DEEP, { meta: { model: 'gpt-5.4' } });
  check('CACHE-05 · 다시 gpt-5.4로 응답하면 gpt-5.4 키로 돌아온다', registry.expected(DEEP) === 'gpt-5.4');
  check(
    'CACHE-05 · 구분자 · 공백이 섞인 모델 값은 키로 쓰지 않는다',
    registry.settle(DEEP, { meta: { model: 'gpt 5.4::x' } }) === 'gpt-5.4',
  );
  registry.reset();
  check('CACHE-05 · reset 뒤 첫 추정치로 돌아간다', registry.expected(DEEP) === DEEP_REPORT_MODEL_ROUTE);

  /* ─────────────────────────────────────────────────────── ROUTE */
  const config = readAiConfig();
  const env = {
    textModel: config.textModel,
    envOverride: process.env.AI_MODEL_DEEP_REPORT,
    nodeEnv: process.env.NODE_ENV,
  };
  const sharedModel = process.env.AI_MODEL?.trim() || 'gpt-4o-mini';
  const planned = Object.fromEntries(
    [DEEP, ...LENS_TASKS.map(([task]) => task), ...OTHER_TASKS].map((task) => [task, plannedTextModelFor(task, env)]),
  ) as Record<AiTask, string>;

  check('ROUTE-01 · Deep Report → gpt-5.4 (이 서버 env)', planned[DEEP] === 'gpt-5.4', planned);
  check(
    'ROUTE-01 · env가 없어도 제품 라우팅 표가 gpt-5.4',
    plannedTextModelFor(DEEP, { textModel: 'gpt-4o-mini', envOverride: undefined, nodeEnv: 'production' }) === 'gpt-5.4',
  );
  check(
    'ROUTE-01 · 형식이 이상한 env 값은 무시하고 라우팅 표로',
    plannedTextModelFor(DEEP, { textModel: 'gpt-4o-mini', envOverride: 'gpt 5.4; ignore', nodeEnv: 'production' }) === 'gpt-5.4',
  );
  check(
    'ROUTE-01 · production은 dev override를 무시',
    deepReportModelFor({ textModel: 'gpt-4o-mini', envOverride: undefined, devOverride: 'gpt-4.1', nodeEnv: 'production' }) === 'gpt-5.4',
  );
  for (const [task, label] of LENS_TASKS) {
    check(`${label} → 기존 모델(공용 AI_MODEL)`, planned[task] === sharedModel && planned[task] === config.textModel, planned[task]);
  }
  check(
    'ROUTE-05+ · relationship · compatibility · history도 기존 모델',
    OTHER_TASKS.every((task) => planned[task] === sharedModel),
    OTHER_TASKS.map((task) => planned[task]),
  );
  check('ROUTE-05+ · 공용 AI_MODEL은 gpt-5.4로 바뀌지 않았다', sharedModel !== 'gpt-5.4', sharedModel);

  return Response.json({
    ok: true,
    checks,
    info: {
      planned,
      sharedModel,
      deepReportEnvSet: Boolean(process.env.AI_MODEL_DEEP_REPORT?.trim()),
      route: DEEP_REPORT_MODEL_ROUTE,
    },
  });
}
