/**
 * Semantic Decomposition — **Real Provider QA** (v1.46.4 SEMANTIC DECOMPOSITION · A13 ~ A16)
 *
 * ══ 이 하네스가 보는 것 ════════════════════════════════════════════════════
 *
 * 직전 하네스(insight 단위 semantic)와 A/B 하네스 둘을 **이 파일 하나로 대체했다.** 둘 다
 * 모델이 Insight에 쓴 문장을 세었고, 그 문장이 첫 화면 카드에 오르는지는 별도 스크립트로
 * 다시 넣어봐야 알 수 있었다 — 그 틈이 A0 감사의 loss point였다.
 *
 * 이 하네스는 **사용자가 보는 Top 3를 직접 잰다**:
 *
 * ```
 * ① /api/dev/premium-test?withAiContext=1  → 제품과 같은 요청 본문(aiRequest) + AI 전 Top 3 id
 * ② /api/ai/deep-report-narrative          → 실제 Provider (dev 전용 모델 override · 계측)
 * ③ /api/dev/premium-test                  → ②의 응답을 넣어 화면과 같은 함수로 Top 3 조립
 * ```
 *
 * ⚠️ 게이트를 여기서 다시 돌리지 않는다. ②가 제품 핸들러이고, ③이 제품 조립 함수다.
 * ⚠️ 품질 점수(rubric · '돈값' Q1~Q5)는 사람이 기록을 읽고 매긴다. 자동 검사는 안전·형식·
 *    배선(Top 3 반영 · 순서 불변)까지다.
 * ⚠️ 앱 rate limiter(60초당 12회)를 풀지 않는다. 호출 간격(LYM_QA_PACE_MS)으로 맞춘다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B
 *   LYM_QA_MODEL=gpt-5.4 node tests/run-semantic-provider-qa.mjs
 *
 * 옵션: LYM_QA_MODEL(기본 gpt-5.4) · LYM_QA_DIR(기본 /tmp/qa) · LYM_QA_PACE_MS(기본 6000)
 *       LYM_QA_ONLY=R2:1,R5 · LYM_QA_SUFFIX=rerun
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

import { SEMANTIC_QA_SCENARIOS } from './fixtures-v1464.mjs';

const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';
const MODEL = process.env.LYM_QA_MODEL ?? 'gpt-5.4';
const OUT_DIR = process.env.LYM_QA_DIR ?? '/tmp/qa';
const PACE_MS = Number(process.env.LYM_QA_PACE_MS ?? 6000);
const SUFFIX = process.env.LYM_QA_SUFFIX ? `-${process.env.LYM_QA_SUFFIX}` : '';

/** A14 — R2 · R3 · R5 중점. 모델 A/B와 같은 반복 수(비교 가능하게) */
const REPEAT = { R1: 1, R2: 3, R3a: 3, R3b: 3, R4: 1, R5: 2, R6: 1 };
const ONLY = process.env.LYM_QA_ONLY
  ? Object.fromEntries(
      process.env.LYM_QA_ONLY.split(',').map((item) => {
        const [id, count] = item.split(':');
        return [id.trim(), Number(count ?? REPEAT[id.trim()] ?? 1)];
      }),
    )
  : null;

/** A8 — 첫 화면 금지 어휘 (SEM-07과 같은 목록 + '축' 낱말) */
const META = [
  /동기화율/,
  /자료\s*\d+\s*종/,
  /근거\s*\d+\s*개/,
  /같은 자리를 가리/,
  /같은 축을 가리/,
  /판정/,
  /\b(MATCH|GAP|CHANGE|CONTRADICTION)\b/,
  /evidence|candidate|insight/i,
  /분석 결과상|데이터상/,
  /(^|[^가-힣])축(?![하적구소제])/,
];
/** A11 — ended에서 현재 상대에게 향하는 행동 */
const OUTWARD = ['다가가', '연락해봐', '먼저 연락', '다음 만남', '재회', '물어봐', '물어볼 수', '제안해봐', '말해봐'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const compact = (text) => text.replace(/[^0-9A-Za-z가-힣]/g, '');
function recites(text, scenes) {
  const target = compact(text);
  return scenes.some((scene) => {
    const reference = compact(scene);
    for (let i = 0; i + 12 <= reference.length; i += 1) {
      if (target.includes(reference.slice(i, i + 12))) return true;
    }
    return false;
  });
}
function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

async function post(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}

console.log(`\nSemantic Decomposition Real Provider QA — model ${MODEL}\n`);
await mkdir(OUT_DIR, { recursive: true });

const md = [`# Semantic Decomposition Real Provider QA — ${MODEL}`, ''];
const stats = {
  calls: 0,
  failures: 0,
  stages: { attempted: 0, parsed: 0, survivedBaseGates: 0, grounded: 0, safetyPassed: 0, stylePassed: 0, accepted: 0 },
  violations: {},
  latency: [],
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  reasoningTokens: 0,
  metaLeaks: 0,
  recitationLeaks: 0,
  endedOutwardLeaks: 0,
  endedQuestions: 0,
  verifyNotQuestion: 0,
  orderChanged: 0,
  modes: {},
  modelsSeen: new Set(),
};
const perScenario = {};
const accepted = [];

for (const scenario of SEMANTIC_QA_SCENARIOS) {
  const repeat = ONLY ? (ONLY[scenario.id] ?? 0) : (REPEAT[scenario.id] ?? 1);
  if (repeat === 0) continue;

  const first = await post('/api/dev/premium-test?withAiContext=1', scenario.body);
  const second = await post('/api/dev/premium-test?withAiContext=1', scenario.body);
  const request = first.json?.aiRequest;
  if (!request) {
    console.error(`✗ ${scenario.id} — aiRequest 없음 (dev 라우트 확인)`);
    process.exit(2);
  }
  const inputHash = sha(request);
  if (sha(second.json.aiRequest) !== inputHash) {
    console.error(`✗ ${scenario.id} — 같은 입력의 요청 본문 해시가 다르다. QA 무효로 멈춘다.`);
    process.exit(2);
  }

  const tense = first.json.tense;
  const topIds = first.json.semanticTopCandidateIds;
  const sceneTexts = request.candidates.flatMap((card) => card.sceneTexts);
  perScenario[scenario.id] = { label: scenario.label, tense, top3SemanticAi: [], inputHash };

  md.push(`## ${scenario.id} · ${scenario.label}`, '');
  md.push(
    `- input hash: \`${inputHash}\` · tense: ${tense}`,
    `- AI 전 Top 3: ${JSON.stringify(topIds)}`,
    `- 카드별 장면: ${JSON.stringify(request.candidates.map((card) => [card.candidateId, card.eventIds]))}`,
    '',
    '결정론 첫 화면 (AI 없이):',
    ...first.json.report.candidates
      .slice(0, 3)
      .map((card) => `- [${card.soWhatSource}] ${card.headline} — ${card.soWhat}`),
    '',
  );
  console.log(`  ${scenario.id.padEnd(4)} hash=${inputHash} tense=${tense} top3=${topIds.length} scenes=${sceneTexts.length > 0 ? request.candidates.reduce((n, c) => n + c.eventIds.length, 0) : 0}`);

  if (request.context.insights.length === 0) {
    md.push('- Provider 호출 없음 (보낼 Insight 0 — 제품과 같은 게이트)', '');
    continue;
  }

  for (let attempt = 1; attempt <= repeat; attempt += 1) {
    if (PACE_MS > 0) await sleep(PACE_MS);
    const started = Date.now();
    const call = await post('/api/ai/deep-report-narrative', {
      inputFingerprint: `qa_${MODEL}_${scenario.id}_${attempt}_${Date.now()}`,
      ...request,
      devModelOverride: MODEL,
      devCapture: true,
    });
    const latency = Date.now() - started;
    stats.calls += 1;
    md.push(`### 호출 ${attempt} — HTTP ${call.status} · ${latency}ms`, '');

    if (call.status !== 200 || !call.json?.ok || !call.json.dev) {
      stats.failures += 1;
      md.push(`- 실패: ${JSON.stringify(call.json)?.slice(0, 300)}`, '');
      console.log(`    ✗ ${scenario.id}#${attempt} 실패 HTTP ${call.status}`);
      continue;
    }
    if (call.json.data?.meta?.mode !== 'real') {
      stats.failures += 1;
      md.push(`- BLOCKED: mode=${call.json.data?.meta?.mode}`, '');
      continue;
    }

    const dev = call.json.dev;
    stats.modelsSeen.add(dev.model);
    stats.latency.push(latency);
    for (const [key, value] of Object.entries(dev.stages)) stats.stages[key] += value;
    for (const label of dev.violations) stats.violations[label] = (stats.violations[label] ?? 0) + 1;
    if (dev.usage) {
      stats.inputTokens += dev.usage.inputTokens ?? 0;
      stats.outputTokens += dev.usage.outputTokens ?? 0;
      stats.cachedTokens += dev.usage.cachedTokens ?? 0;
      stats.reasoningTokens += dev.usage.reasoningTokens ?? 0;
    }

    const semantics = call.json.data.candidateSemantics ?? [];
    const rendered = await post('/api/dev/premium-test', {
      ...scenario.body,
      narratives: call.json.data.narratives,
      candidateSemantics: semantics,
    });
    const top = rendered.json.report.candidates.slice(0, 3);
    const aiCount = top.filter((card) => card.soWhatSource === 'semantic_ai').length;
    perScenario[scenario.id].top3SemanticAi.push(aiCount);

    /* A7 — AI 응답이 Top 3 집합·순서를 바꾸지 않는다 */
    if (JSON.stringify(top.map((card) => card.id)) !== JSON.stringify(topIds)) {
      stats.orderChanged += 1;
      md.push('- ✗ AI 응답 뒤 Top 3 순서가 AI 전과 다르다', '');
    }

    md.push(
      `- model: ${dev.model} · stages: ${JSON.stringify(dev.stages)}`,
      `- violations: ${JSON.stringify(dev.violations)}`,
      `- tokens: in ${dev.usage?.inputTokens ?? '-'} / out ${dev.usage?.outputTokens ?? '-'} / cached ${dev.usage?.cachedTokens ?? '-'}`,
      `- **Top 3 semantic_ai ${aiCount}/3**`,
      '',
    );

    for (const [index, card] of top.entries()) {
      md.push(
        `#### ${index + 1}. [${card.soWhatSource}${card.semanticMode ? ` · ${card.semanticMode}` : ''}] ${card.headline}`,
        `- SO WHAT: ${card.soWhat}`,
        `- WHY: ${card.whyItMatters}`,
        `- VERIFY: ${card.verification ?? '(없음)'}`,
        ...card.questions.map((question) => `- Q(${question.register}): ${question.text}`),
        `- usedEventIds: ${JSON.stringify(card.semanticEventIds)} · relevant: ${JSON.stringify(card.relevantEventIds)}`,
        '',
      );
      if (card.soWhatSource === 'semantic_ai') {
        stats.modes[card.semanticMode] = (stats.modes[card.semanticMode] ?? 0) + 1;
        accepted.push({
          scenario: scenario.id,
          attempt,
          rank: index + 1,
          candidateId: card.id,
          semanticMode: card.semanticMode,
          soWhat: card.soWhat,
          whyItMatters: card.whyItMatters,
          verification: card.verification,
          questions: card.questions.map((question) => `${question.register}: ${question.text}`),
          usedEventIds: card.semanticEventIds,
        });
      }

      const visible = [card.headline, card.soWhat, card.whyItMatters, card.verification ?? '', ...card.questions.map((q) => q.text)].filter(Boolean);
      if (visible.some((text) => META.some((pattern) => pattern.test(text)))) {
        stats.metaLeaks += 1;
        md.push(`- ✗ 메타 언어: ${JSON.stringify(visible.filter((text) => META.some((pattern) => pattern.test(text))))}`, '');
      }
      if (card.soWhatSource === 'semantic_ai' && visible.some((text) => recites(text, sceneTexts))) {
        stats.recitationLeaks += 1;
        md.push('- ✗ 장면 복창', '');
      }
      if (tense === 'former') {
        if (visible.some((text) => OUTWARD.some((word) => text.includes(word)))) {
          stats.endedOutwardLeaks += 1;
          md.push('- ✗ ended outward', '');
        }
        stats.endedQuestions += card.questions.length;
      } else if (card.soWhatSource === 'semantic_ai' && card.verification && !card.verification.trim().endsWith('?')) {
        stats.verifyNotQuestion += 1;
      }
    }
    console.log(`    ${scenario.id}#${attempt} Top3 semantic_ai ${aiCount}/3 · ${latency}ms · accepted ${dev.stages.accepted}/${dev.stages.attempted}`);
  }
}

const summary = {
  model: MODEL,
  modelsSeen: [...stats.modelsSeen],
  calls: stats.calls,
  failures: stats.failures,
  stages: stats.stages,
  violations: stats.violations,
  latency: {
    median: percentile(stats.latency, 50),
    p90: percentile(stats.latency, 90),
    max: stats.latency.length ? Math.max(...stats.latency) : null,
  },
  tokens: {
    input: stats.inputTokens,
    output: stats.outputTokens,
    cached: stats.cachedTokens,
    reasoning: stats.reasoningTokens,
  },
  leaks: {
    meta: stats.metaLeaks,
    recitation: stats.recitationLeaks,
    endedOutward: stats.endedOutwardLeaks,
    endedQuestions: stats.endedQuestions,
    verifyNotQuestion: stats.verifyNotQuestion,
  },
  orderChanged: stats.orderChanged,
  modes: stats.modes,
  perScenario,
};

md.push('## 요약', '', '```json', JSON.stringify(summary, null, 2), '```', '');
await writeFile(`${OUT_DIR}/semantic-decomposition-${MODEL}${SUFFIX}.md`, md.join('\n'));
await writeFile(`${OUT_DIR}/semantic-decomposition-${MODEL}${SUFFIX}-accepted.json`, JSON.stringify(accepted, null, 2));
await writeFile(`${OUT_DIR}/semantic-decomposition-${MODEL}${SUFFIX}-summary.json`, JSON.stringify(summary, null, 2));

console.log('\n요약');
console.log(JSON.stringify(summary, null, 2));
console.log(`\n기록: ${OUT_DIR}/semantic-decomposition-${MODEL}${SUFFIX}.md`);
