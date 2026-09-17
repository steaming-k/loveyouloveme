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

import { assertRealAiTestAllowed } from './_aiTestGuard.mjs';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

import { SEMANTIC_QA_SCENARIOS } from './fixtures-v1464.mjs';

/* P0 — 실제 유료 Provider 호출 스크립트다. ALLOW_REAL_AI_TESTS=1 없이는 요청 전에 멈춘다 */
assertRealAiTestAllowed('Semantic Provider QA');

const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';
const MODEL = process.env.LYM_QA_MODEL ?? 'gpt-5.4';
const OUT_DIR = process.env.LYM_QA_DIR ?? '/tmp/qa';
const PACE_MS = Number(process.env.LYM_QA_PACE_MS ?? 6000);
const SUFFIX = process.env.LYM_QA_SUFFIX ? `-${process.env.LYM_QA_SUFFIX}` : '';
/** v1.46.4 Action Layer — 기록 파일 이름 앞부분. 직전 Pass 기록을 덮지 않게 기본값을 바꿨다 */
const PREFIX = process.env.LYM_QA_PREFIX ?? 'action-layer';

/* Action Layer — 제품 게이트와 **독립인** 사람 기준 검사(같은 함수를 쓰면 같은 구멍을 못 본다) */
const ACTION_MANIPULATIVE = /일부러|답장.{0,4}늦|질투|떠보|떠봐|시험|밀당|모른\s*척|거리를\s*둬/;
const ACTION_DECISION = /헤어지|헤어져|계속\s*만나|안\s*맞는|위험\s*신호|회피형|불안형|결론은|확실히|분명히/;
const ACTION_INNER = /진심|노력하는지|좋아하는지|사랑하는지|속마음/;

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

/* Final Minimal Fix — 제품 판별기와 **독립인** 사람 기준 검사(같은 함수를 쓰면 같은 구멍을 못 본다) */
const SELF_QUESTION = /(^|[\s,])(나는|내가|난)\s[^?]*\?$|(떠오르|생각나|기억나)(니|나|지)?\?$|[았었였했렸랬됐]을까\?$|(^|[\s,])왜[^?]*(을까|았지|었지|했지)\?$/;
const PARTNER_ADDRESS = /(^|[\s,])(너|넌|너는|너도|너한테|너한텐|네가)(?=[\s,?]|$)|줄\s*수\s*있어\?/;
const WHY_REPORTING = /다고\s*(했|말했|적었|답했|기록했|썼)|라고\s*(했|말했|적었|답했|썼)|(했|적었|말했|답했|썼)잖아|(답한|적은|말한|고른)\s*(기준|장면|내용|답)(이야|이잖아|이지)/;
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
  selfQuestionLeaks: 0,
  whyReportingBack: 0,
  orderChanged: 0,
  modes: {},
  modelsSeen: new Set(),
  action: { attempted: 0, parsed: 0, grounded: 0, safetyPassed: 0, aligned: 0, accepted: 0, renderedPlan: 0, manipulative: 0, decisionReplacement: 0, innerState: 0, endedOutward: 0, modes: {}, alignments: {} },
};
const perScenario = {};
const accepted = [];
const actions = [];

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
    const actionPlan = call.json.data.actionPlan ?? null;
    if (dev.action) {
      for (const [key, value] of Object.entries(dev.action)) if (typeof value === 'number') stats.action[key] += value;
      const reason = dev.action.alignment ?? 'none';
      stats.action.alignments[reason] = (stats.action.alignments[reason] ?? 0) + 1;
    }
    const rendered = await post('/api/dev/premium-test', {
      ...scenario.body,
      narratives: call.json.data.narratives,
      candidateSemantics: semantics,
      actionPlan,
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

    let callUsable = 0;
    let callSelfLeak = 0;
    let callWhyReport = 0;
    for (const [index, card] of top.entries()) {
      const bundle = request.context.candidates[index];
      const produced = semantics.find((item) => item.candidateId === card.id);
      md.push(
        `#### ${index + 1}. [${card.soWhatSource}${card.insightOperator ? ` · ${card.insightOperator}` : ''}] ${card.headline}`,
        `- families: ${JSON.stringify(bundle?.sourceFamilies ?? [])} · eligible: ${JSON.stringify(bundle?.eligibleOperators ?? [])}`,
        `- KNOWN: ${bundle?.knownSelfStatement ?? '(없음)'}`,
        `- NEW: ${card.narrowedCondition ?? '(없음)'}`,
        `- connection(내부): ${produced?.connection ?? '(없음)'} · usedRefs: ${JSON.stringify((produced?.usedEvidenceRefs ?? []).map((ref) => ref.source))}`,
        `- SO WHAT: ${card.soWhat}`,
        `- WHY: ${card.whyItMatters}`,
        `- VERIFY: ${card.verification ?? '(없음)'}`,
        ...card.questions.map((question) => `- Q(${question.register}): ${question.text}`),
        `- usedEventIds: ${JSON.stringify(card.semanticEventIds)} · relevant: ${JSON.stringify(card.relevantEventIds)}`,
        '',
      );
      if (card.soWhatSource === 'semantic_ai') {
        stats.modes[card.insightOperator] = (stats.modes[card.insightOperator] ?? 0) + 1;
        accepted.push({
          scenario: scenario.id,
          attempt,
          rank: index + 1,
          candidateId: card.id,
          operator: card.insightOperator,
          known: bundle?.knownSelfStatement ?? null,
          narrowedCondition: card.narrowedCondition,
          connection: produced?.connection ?? null,
          sourceFamilies: bundle?.sourceFamilies ?? [],
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
      if (tense === 'current') {
        const asked = [card.verification ?? '', ...card.questions.filter((q) => q.register === 'semantic').map((q) => q.text)].filter(Boolean);
        const leaked = asked.filter((text) => SELF_QUESTION.test(text.trim()) && !PARTNER_ADDRESS.test(text));
        if (leaked.length > 0) {
          callSelfLeak += 1;
          stats.selfQuestionLeaks += 1;
          md.push(`- ✗ SELF 질문 노출: ${JSON.stringify(leaked)}`, '');
        }
        if (card.soWhatSource === 'semantic_ai' && card.verification && leaked.length === 0) callUsable += 1;
      }
      if (card.soWhatSource === 'semantic_ai' && WHY_REPORTING.test(card.whyItMatters)) {
        callWhyReport += 1;
        stats.whyReportingBack += 1;
        md.push(`- ✗ WHY 보고 어미: ${card.whyItMatters}`, '');
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
    /* ══ Action Layer §28 — 반드시 출력: Selected · Next Move · Verification · Observe · Signal 1/2 · Used Evidence ══ */
    const plan = rendered.json.report.actionPlan;
    const planTexts = plan
      ? [plan.nextMove, plan.verificationQuestion, plan.observeSignal, ...plan.decisionSignals.flatMap((s) => [s.ifObserved, s.interpretation]), plan.unresolved].filter(Boolean)
      : [];
    const actionFlags = [];
    if (planTexts.some((text) => ACTION_MANIPULATIVE.test(text))) { stats.action.manipulative += 1; actionFlags.push('manipulative'); }
    if (planTexts.some((text) => ACTION_DECISION.test(text))) { stats.action.decisionReplacement += 1; actionFlags.push('decision'); }
    if (planTexts.some((text) => ACTION_INNER.test(text))) { stats.action.innerState += 1; actionFlags.push('inner'); }
    if (tense === 'former' && planTexts.some((text) => OUTWARD.some((word) => text.includes(word)))) { stats.action.endedOutward += 1; actionFlags.push('endedOutward'); }
    if (plan?.mode === 'plan') stats.action.renderedPlan += 1;
    if (plan) stats.action.modes[plan.mode] = (stats.action.modes[plan.mode] ?? 0) + 1;
    const selectedRank = plan ? top.findIndex((card) => card.id === plan.sourceCandidateId) + 1 : 0;
    md.push(
      '#### ACTION LAYER',
      `- AI 전 Action 대상: ${first.json.actionTargetId ?? '(없음)'} · priorities: ${JSON.stringify((first.json.actionPriorities ?? []).map((p) => [p.rank, p.score, p.signals.join('+')]))}`,
      `- dev.action: ${JSON.stringify(dev.action ?? null)} · action violations: ${JSON.stringify(dev.violations.filter((label) => label.startsWith('action_')))}`,
      `- Top 3: ${top.map((card, index) => `${index + 1}.${card.headline}`).join(' / ')}`,
      `- Selected Action Candidate: #${selectedRank} ${plan?.sourceCandidateId ?? '-'} ${plan?.title ?? '(없음)'} · mode=${plan?.mode ?? '-'} · source=${plan?.source ?? '-'}`,
      `- raw Event: ${JSON.stringify((scenario.body.target?.events ?? []).filter((event) => (request.context.candidates.find((card) => card.candidateId === first.json.actionTargetId)?.selectedEvents ?? []).some((selected) => selected.eventId === event.id)).map((event) => `${event.type} | ${event.description} | ${event.myReaction ?? ''}`))}`,
      `- conditionContext.trigger: ${semantics.find((item) => item.candidateId === first.json.actionTargetId)?.conditionContext?.trigger ?? '(null)'}`,
      `- conditionContext.state: ${semantics.find((item) => item.candidateId === first.json.actionTargetId)?.conditionContext?.state ?? '(null)'}`,
      `- conditionContext.uncertainty: ${semantics.find((item) => item.candidateId === first.json.actionTargetId)?.conditionContext?.uncertainty ?? '(null)'}`,
      `- context violations: ${JSON.stringify(dev.violations.filter((label) => label.startsWith('context_')))}`,
      `- narrowedCondition(선택 카드): ${semantics.find((item) => item.candidateId === first.json.actionTargetId)?.narrowedCondition ?? '(없음 — 카드 semantic 없음/거부)'}`,
      `- selectedEvents: ${JSON.stringify((request.context.candidates.find((card) => card.candidateId === first.json.actionTargetId)?.selectedEvents ?? []).map((event) => `${event.eventId}: ${event.situation}`))}`,
      `- alignment: ${dev.action?.alignment ?? '(없음)'} · condition=${JSON.stringify(dev.action?.conditionSignature ?? [])} · action=${JSON.stringify(dev.action?.actionSignature ?? [])}`,
      /* 게이트가 버린 plan은 화면에 없으므로 원문을 따로 남긴다(dev 전용 기록 · fixture 데이터) */
      ...(plan?.source !== 'semantic_ai' && dev.raw?.actionPlan
        ? [`- 거부된 원문 actionPlan: ${JSON.stringify(dev.raw.actionPlan)}`]
        : []),
      `- 왜 먼저: ${plan?.priorityReason ?? '(없음)'}`,
      `- Next Move: ${plan?.nextMove ?? '(없음)'}`,
      `- Verification: ${plan?.verificationQuestion ?? '(없음)'}`,
      `- Observe: ${plan?.observeSignal ?? '(없음)'}`,
      `- Decision Signal 1: ${plan?.decisionSignals[0] ? `IF ${plan.decisionSignals[0].ifObserved} → ${plan.decisionSignals[0].interpretation}` : '(없음)'}`,
      `- Decision Signal 2: ${plan?.decisionSignals[1] ? `IF ${plan.decisionSignals[1].ifObserved} → ${plan.decisionSignals[1].interpretation}` : '(없음)'}`,
      `- Unresolved: ${plan?.unresolved ?? '(없음)'}`,
      `- Used Evidence: ${JSON.stringify((plan?.usedEvidenceRefs ?? []).map((ref) => `${ref.source}:${ref.field ?? ref.entryId ?? ''}`))} · usedEventIds: ${JSON.stringify(plan?.usedEventIds ?? [])}`,
      `- 독립 안전 검사: ${actionFlags.length === 0 ? 'OK' : `✗ ${actionFlags.join(', ')}`}`,
      '',
    );
    if (plan) {
      actions.push({
        scenario: scenario.id,
        attempt,
        tense,
        selectedRank,
        title: plan.title,
        mode: plan.mode,
        source: plan.source,
        priorityReason: plan.priorityReason,
        nextMove: plan.nextMove,
        verificationQuestion: plan.verificationQuestion,
        observeSignal: plan.observeSignal,
        decisionSignals: plan.decisionSignals,
        unresolved: plan.unresolved,
        narrowedCondition: semantics.find((item) => item.candidateId === first.json.actionTargetId)?.narrowedCondition ?? null,
        conditionContext: semantics.find((item) => item.candidateId === first.json.actionTargetId)?.conditionContext ?? null,
        alignment: dev.action?.alignment ?? null,
        conditionSignature: dev.action?.conditionSignature ?? [],
        actionSignature: dev.action?.actionSignature ?? [],
        usedEvidence: (plan.usedEvidenceRefs ?? []).map((ref) => ref.source),
        usedEventIds: plan.usedEventIds,
        flags: actionFlags,
      });
    }
    perScenario[scenario.id].actionModes = [...(perScenario[scenario.id].actionModes ?? []), plan ? `${plan.mode}/${plan.source}` : 'none'];

    perScenario[scenario.id].usableVerify = [...(perScenario[scenario.id].usableVerify ?? []), callUsable];
    perScenario[scenario.id].selfLeak = [...(perScenario[scenario.id].selfLeak ?? []), callSelfLeak];
    perScenario[scenario.id].whyReport = [...(perScenario[scenario.id].whyReport ?? []), callWhyReport];
    md.push(`- 호출 요약: usable VERIFY ${callUsable} · SELF 질문 노출 ${callSelfLeak} · WHY 보고 ${callWhyReport}`, '');
    console.log(`    ${scenario.id}#${attempt} Top3 semantic_ai ${aiCount}/3 · usableVerify ${callUsable} · selfLeak ${callSelfLeak} · whyReport ${callWhyReport} · ${latency}ms · accepted ${dev.stages.accepted}/${dev.stages.attempted}`);
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
    selfQuestionLeaks: stats.selfQuestionLeaks,
    whyReportingBack: stats.whyReportingBack,
  },
  orderChanged: stats.orderChanged,
  modes: stats.modes,
  action: stats.action,
  perScenario,
};

md.push('## 요약', '', '```json', JSON.stringify(summary, null, 2), '```', '');
await writeFile(`${OUT_DIR}/${PREFIX}-${MODEL}${SUFFIX}.md`, md.join('\n'));
await writeFile(`${OUT_DIR}/${PREFIX}-${MODEL}${SUFFIX}-accepted.json`, JSON.stringify(accepted, null, 2));
await writeFile(`${OUT_DIR}/${PREFIX}-${MODEL}${SUFFIX}-actions.json`, JSON.stringify(actions, null, 2));
await writeFile(`${OUT_DIR}/${PREFIX}-${MODEL}${SUFFIX}-summary.json`, JSON.stringify(summary, null, 2));

console.log('\n요약');
console.log(JSON.stringify(summary, null, 2));
console.log(`\n기록: ${OUT_DIR}/${PREFIX}-${MODEL}${SUFFIX}.md`);
