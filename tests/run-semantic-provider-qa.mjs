/**
 * Real Provider QA — Semantic Event Personalization (v1.46.4 · §31 ~ §34 · §38)
 *
 * ══ 이 스크립트가 하는 일 ═══════════════════════════════════════════════════
 *
 * **실제 Provider를 부른다.** `run-semantic-fixtures.mjs`는 Provider를 부르지 않고
 * `narratives`를 직접 넘겨 계층 배선만 확인한다 — 그건 "구조가 맞는가"까지이고,
 * §31이 요구한 것은 **사람이 읽고 품질을 판정하는 것**이다:
 *
 * > Mock/fixture만으로 종료 금지.
 *
 * 그래서 이 스크립트는 판정하지 않는다. `/api/ai/deep-report-narrative`(진짜 라우트)를
 * R1~R6 시나리오로 부르고, **모델이 실제로 쓴 문장을 그대로 출력한다.** 점수(§33)는
 * 사람이 매긴다.
 *
 * ══ 무엇을 자동으로 확인하는가 ══════════════════════════════════════════════
 *
 * 사람이 읽기 전에 **값으로 확정할 수 있는 것**만 확인한다:
 *
 * ```
 * meta.mode === 'real'   실제 Provider가 응답했는가 (아니면 QA가 아니다)
 * semantic 존재 여부      게이트를 통과한 건수
 * 메타 언어 0             §35 lint를 출력에 다시 돌린다
 * 장면 복창 0             §36 lint를 출력에 다시 돌린다
 * usedEventIds ⊆ 전송     §9
 * ```
 *
 * Novelty·Specificity·Actionability·Tone은 **자동 판정하지 않는다.** 그건 문장을
 * 읽어야 아는 것이고, 자동 점수를 매기면 점수를 맞추려고 프롬프트를 고치게 된다
 * (§34 마지막 줄 — 점수 맞추기 위해 과장 금지).
 *
 * ⚠️ **비용이 든다.** 시나리오마다 deep-report 1회다(R2·R3은 변동성 확인을 위해 2회).
 * 기본 총 호출 수는 아래 `SCENARIOS`의 `repeat` 합계로 계산되어 실행 전에 출력된다.
 *
 * 사용법:
 *   1) .env.local에 AI_MODE=real · AI_API_KEY
 *   2) npm run dev
 *   3) node tests/run-semantic-provider-qa.mjs
 */

import { writeFile } from 'node:fs/promises';

import {
  EVENTS_SEM_B,
  SEM_A,
  SEM_B,
  SEM_C,
  SEM_D,
  run,
} from './fixtures-v1464.mjs';

const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';
const OUT = process.env.LYM_QA_OUT ?? null;

/* ══════════════════════════════════════════════════════════ 시나리오 (§32) */

/**
 * §32 — 최소 6개.
 *
 * ⚠️ 각 시나리오의 세션은 `/api/dev/premium-test`로 한 번 돌려서 **제품과 같은
 * context**를 뽑는다. 여기서 context를 손으로 조립하면 QA가 검증하는 것이 제품이
 * 아니라 이 스크립트가 된다.
 */
const SCENARIOS = [
  { id: 'R1', label: 'current / 사건 0 / high-data', body: SEM_A, repeat: 1 },
  { id: 'R2', label: 'current / 사건 많음 / contact GAP', body: SEM_B, repeat: 2 },
  { id: 'R3a', label: 'same verdict · 다른 사건 의미 (C)', body: SEM_C, repeat: 2 },
  { id: 'R3b', label: 'same verdict · 다른 사건 의미 (D)', body: SEM_D, repeat: 1 },
  {
    id: 'R4',
    label: 'current / Target 부분정보',
    body: {
      ...SEM_B,
      target: { ...SEM_B.target, conflict: 'x', alone: 'x', affection: 'x', mbti: null },
    },
    repeat: 1,
  },
  {
    id: 'R5',
    label: 'ended / 사건 많음',
    body: { ...SEM_B, status: 'ended', target: { ...SEM_B.target, relation: 'ex' } },
    repeat: 1,
  },
  {
    id: 'R6',
    label: 'sparse / fallback 경계',
    body: {
      ...SEM_B,
      declared: { contact: 3, conflict: null, alone: null, affection: null, hobby: null },
      experience: { important: [], hardest: null, selfGap: null, skipped: true },
      entries: [],
      target: {
        ...SEM_B.target,
        contact: 'x',
        conflict: 'x',
        alone: 'x',
        affection: 'x',
        events: [EVENTS_SEM_B[0]],
      },
    },
    repeat: 1,
  },
];

/* ══════════════════════════════════════════════════ 자동 확인 (§35 · §36 · §9) */

/** §35 — 출력에 남으면 게이트가 새는 것이다. 서버 패턴과 같은 목록을 여기서도 본다 */
const META_PATTERNS = [
  /동기화율|싱크율|매칭\s*점수/,
  /\b(MATCH|GAP|CHANGE|CONTRADICTION|UNRESOLVED|REPEATED_SIGNAL)\b/,
  /(^|[^가-힣])축(?![하적구소제])/,
  /(^|[^가-힣])판정/,
  /자료\s*\d+\s*종|근거\s*\d+\s*(개|종)|\d+\s*가지가\s*같은/,
  /같은\s*자리를\s*가리|같은\s*축을\s*가리|나란히\s*놓[아이여]/,
  /\b(evidence|source|candidate|insight|narrative)\b/i,
  /분석\s*결과(상|에\s*따르면)|데이터상|계산\s*결과/,
];

/** §36 — 장면 원문의 12자 조각이 문장에 들어가면 복창이다 */
function recites(text, sceneTexts) {
  const compact = text.replace(/[^0-9A-Za-z가-힣]/g, '');
  for (const scene of sceneTexts) {
    const s = scene.replace(/[^0-9A-Za-z가-힣]/g, '');
    for (let i = 0; i + 12 <= s.length; i += 1) {
      if (compact.includes(s.slice(i, i + 12))) return true;
    }
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════════════ 실행 */

async function callProvider(context, insights, tense, allowedSceneIds, sceneTexts, tag) {
  const response = await fetch(`${BASE_URL}/api/ai/deep-report-narrative`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputFingerprint: `qa_${tag}_${Date.now()}`,
      context,
      insights,
      tense,
      allowedSceneIds,
      sceneTextsByInsight: sceneTexts,
    }),
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

const lines = [];
const say = (text = '') => {
  console.log(text);
  lines.push(text);
};

say('\n══════════════════════════════════════════════════════════════════');
say(' Real Provider QA — Semantic Event Personalization (v1.46.4 §32)');
say('══════════════════════════════════════════════════════════════════');
const totalCalls = SCENARIOS.reduce((sum, scenario) => sum + scenario.repeat, 0);
say(` 시나리오 ${SCENARIOS.length}개 · deep-report 호출 ${totalCalls}회 예정\n`);

let realCount = 0;
let semanticTotal = 0;
let metaHits = 0;
let recitationHits = 0;
let subsetViolations = 0;

for (const scenario of SCENARIOS) {
  say(`\n──────── ${scenario.id} · ${scenario.label} ────────`);

  /* 제품과 같은 함수로 context·insights·허용집합을 만든다 */
  const session = await run(scenario.body);
  /*
    ⚠️ `tense`는 응답의 **최상위** 키다(`report.tense`가 아니다). 첫 판에서
    `session.report.tense ?? 'current'`로 읽었고, 그래서 R5(ended)가 `current`로
    호출됐다 — §41이 요구한 ended 검증이 실제로는 current를 검증하고 있었다.
    실측 로그의 `tense=current`가 그것을 드러냈다.
  */
  const tense = session.tense;
  if (tense !== 'current' && tense !== 'former') {
    say(`  ✗ tense를 읽지 못했다: ${JSON.stringify(tense)}`);
    continue;
  }
  const deepCall = session.ai.calls.find((call) => call.task === 'deep-report');

  say(`  세션: insight ${session.insights.filter((i) => i.eligibleForNarrative).length}건 ·` +
    ` Candidate ${session.report.candidates.length}개 · 전송 장면 ${deepCall.eventCount}건` +
    ` · tense=${tense}`);
  say(`  결정론 첫 화면 (AI 없이):`);
  for (const candidate of session.report.candidates.slice(0, 3)) {
    say(`    [${candidate.soWhatSource}] ${candidate.headline}`);
    say(`      SO WHAT  ${candidate.soWhat}`);
  }

  if (deepCall.count === 0) {
    say('  ⚠ 보낼 Insight가 없어 Provider를 부르지 않는다 (제품과 같은 게이트)');
    continue;
  }

  /*
    ⚠️ context를 dev 라우트에서 그대로 꺼낼 수 없다 — 그 라우트는 payload 크기만
    낸다(본문을 응답에 싣지 않기 위해서다 · §29). 그래서 여기서 **같은 builder를
    서버에서 한 번 더** 부르게 하는 대신, dev 라우트에 붙어 있는 context 노출
    엔드포인트를 쓴다.
  */
  const ctxResponse = await fetch(`${BASE_URL}/api/dev/premium-test?withAiContext=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario.body),
  });
  const ctxJson = await ctxResponse.json();
  const context = ctxJson.aiContext;
  if (!context) {
    say('  ✗ aiContext를 받지 못했다 — dev 라우트의 withAiContext 파라미터 확인');
    continue;
  }

  const insights = context.insights.map((item) => ({
    id: item.id,
    evidenceRefs: item.evidence.map((entry) => entry.ref),
    ruleSummary: item.allowedConnection,
  }));
  const allowedSceneIds = Object.fromEntries(
    context.insights.map((item) => [item.id, (item.relatedScenes ?? []).map((scene) => scene.id)]),
  );
  const sceneTexts = Object.fromEntries(
    context.insights.map((item) => [
      item.id,
      (item.relatedScenes ?? []).flatMap((scene) =>
        [scene.fact, scene.myReaction].filter(Boolean),
      ),
    ]),
  );
  const allSceneTexts = Object.values(sceneTexts).flat();

  for (let attempt = 1; attempt <= scenario.repeat; attempt += 1) {
    const { status, json } = await callProvider(
      context,
      insights,
      tense,
      allowedSceneIds,
      sceneTexts,
      `${scenario.id}_${attempt}`,
    );

    if (status !== 200 || !json?.ok) {
      say(`  ✗ 호출 ${attempt} 실패 — HTTP ${status} ${JSON.stringify(json)?.slice(0, 200)}`);
      continue;
    }

    const mode = json.data?.meta?.mode;
    say(`\n  · 호출 ${attempt} — mode=${mode} · narrative ${json.data.narratives.length}건`);
    if (mode !== 'real') {
      say('    ⚠ BLOCKED: REAL PROVIDER QA — mode가 real이 아니다. 이 결과로 품질을 말하지 않는다');
      continue;
    }
    realCount += 1;

    const withSemantic = json.data.narratives.filter((item) => item.semantic);
    semanticTotal += withSemantic.length;
    say(`    semantic ${withSemantic.length}/${json.data.narratives.length}건 통과`);

    for (const narrative of json.data.narratives) {
      say(`\n    ── insight ${narrative.insightId}`);
      say(`    HEADLINE  ${narrative.headline}`);
      say(`    INTERP    ${narrative.interpretation}`);
      if (!narrative.semantic) {
        say('    SEMANTIC  (없음 — 모델이 안 만들었거나 게이트가 버렸다 → 조립문 fallback)');
        continue;
      }
      const sem = narrative.semantic;
      say(`    SO WHAT   ${sem.soWhat}`);
      say(`    WHY       ${sem.whyItMatters}`);
      say(`    VERIFY    ${sem.verification ?? '(없음)'}`);
      say(`    usedEventIds  ${JSON.stringify(sem.usedEventIds)}`);

      const texts = [sem.soWhat, sem.whyItMatters, sem.verification ?? ''].filter(Boolean);
      const meta = texts.filter((text) => META_PATTERNS.some((pattern) => pattern.test(text)));
      if (meta.length > 0) {
        metaHits += 1;
        say(`    ✗ 메타 언어 누출: ${JSON.stringify(meta)}`);
      }
      const recited = texts.filter((text) => recites(text, allSceneTexts));
      if (recited.length > 0) {
        recitationHits += 1;
        say(`    ✗ 장면 복창: ${JSON.stringify(recited)}`);
      }
      const allowed = new Set(allowedSceneIds[narrative.insightId] ?? []);
      const outside = sem.usedEventIds.filter((id) => !allowed.has(id));
      if (outside.length > 0) {
        subsetViolations += 1;
        say(`    ✗ 허용집합 밖 장면 인용: ${JSON.stringify(outside)}`);
      }
    }
  }
}

say('\n══════════════════════════════════════════════════════════════════');
say(' 자동 확인 요약 (품질 점수는 사람이 매긴다 · §33)');
say('══════════════════════════════════════════════════════════════════');
say(` 실제 Provider 응답      ${realCount}회`);
say(` semantic 통과 총합      ${semanticTotal}건`);
say(` 메타 언어 누출          ${metaHits}건   (0이어야 한다 · §35)`);
say(` 장면 복창               ${recitationHits}건   (0이어야 한다 · §36)`);
say(` 허용집합 밖 인용        ${subsetViolations}건   (0이어야 한다 · §9)`);
if (realCount === 0) {
  say('\n ⚠ BLOCKED: REAL PROVIDER QA — 실제 Provider 응답이 0회다.');
  say('   release ready라고 말하지 않는다(§31).');
}

if (OUT) {
  await writeFile(OUT, lines.join('\n'), 'utf8');
  say(`\n 기록: ${OUT}`);
}
