/**
 * Real Provider E2E Harness (v1.10 · §4~§10)
 *
 * 진짜 프로덕션 Route(`/api/ai/{task}`)를 호출한다 — `contract-test`(스키마/검증만 재현)와는
 * 다르다. 서버의 `AI_MODE`/`AI_API_KEY`가 이 스크립트의 결과를 결정한다:
 *   - Key가 없으면 서버가 demo/mock으로 응답한다 → 이 스크립트는 그 사실을 있는 그대로
 *     보고한다(`SKIPPED — KEY NOT AVAILABLE`). "검증 완료"라고 절대 쓰지 않는다.
 *   - Key가 있고 `AI_MODE=real`이면 실제 Provider가 응답한다 → `meta.mode === 'real'`을
 *     확인한 뒤에만 PASS/FAIL을 매긴다.
 *
 * ⚠️ Raw Prompt·User Data 원문을 출력하지 않는다(§10). 여기 찍히는 건 구조·개수·소요시간뿐이다.
 *
 * 사용법:
 *   1) npm run dev  (서버가 AI_MODE=real이고 AI_API_KEY가 있으면 실제 호출)
 *   2) node tests/run-provider-e2e.mjs
 */

const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';

/** 1x1 PNG(비민감·synthetic) — 실제 사진을 쓰지 않는다(§8) */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function syntheticImage(imageId) {
  return { imageId, dataUrl: `data:image/png;base64,${TINY_PNG_BASE64}` };
}

/** Persona A — Declared와 Relationship이 일치 */
const PERSONA_A = {
  label: 'Persona A (MATCH 중심)',
  declared: { contact: 4, conflict: 'talk_soon', alone: 3, affection: 'balanced', hobby: 'often' },
  experience: {
    important: ['contact', 'conflict'],
    hardest: 'contact_drop',
    selfGap: 'no',
    note: '',
    adaptive: null,
  },
};

/** Persona B — Declared와 Relationship GAP */
const PERSONA_B = {
  label: 'Persona B (GAP/CONTRADICTION 중심)',
  declared: { contact: 2, conflict: 'talk_soon', alone: 5, affection: 'light', hobby: 'rarely' },
  experience: {
    important: ['contact'],
    hardest: 'contact_drop',
    selfGap: 'some',
    note: '연락이 줄면 유독 신경 쓰였다',
    adaptive: null,
  },
};

const PERSONAS = [PERSONA_A, PERSONA_B];

let passed = 0;
let failed = 0;
let skipped = 0;
const lines = [];

function log(line) {
  lines.push(line);
  console.log(line);
}

function verdict(taskLabel, result) {
  if (result === 'PASS') passed += 1;
  else if (result.startsWith('SKIPPED')) skipped += 1;
  else failed += 1;
  log(`${taskLabel}\n  ${result}`);
}

async function callTask(task, body) {
  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}/api/ai/${task}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const durationMs = Date.now() - startedAt;
  const json = await response.json().catch(() => null);
  return { status: response.status, json, durationMs };
}

function reportRealMode({ task, json, durationMs, extra = '' }) {
  const mode = json?.data?.meta?.mode;
  if (mode !== 'real') {
    log(`  duration: ${durationMs}ms · reported mode: ${mode ?? 'n/a'} (ok=${json?.ok})`);
    verdict(task, 'SKIPPED — KEY NOT AVAILABLE');
    return;
  }
  log(`  duration: ${durationMs}ms · mode: real · promptVersion: ${json.data.meta.promptVersion} ${extra}`);
  verdict(task, 'PASS');
}

/* ------------------------------------------------------- observed-profile */
async function testObservedProfile() {
  const { json, durationMs } = await callTask('observed-profile', {
    inputFingerprint: 'e2e_observed_1',
    images: [syntheticImage('e2e_1'), syntheticImage('e2e_2')],
  });
  if (!json?.ok) {
    reportRealMode({ task: 'observed-profile', json, durationMs });
    return;
  }
  const traits = json.data.traits ?? [];
  const noEvidence = traits.filter((t) => (t.evidence?.length ?? 0) === 0);
  reportRealMode({
    task: 'observed-profile',
    json,
    durationMs,
    extra: `· traits: ${traits.length} · evidence-less: ${noEvidence.length}`,
  });
}

/* -------------------------------------------------- relationship-insight */
async function testRelationshipInsight(persona) {
  const judgements = [{ axis: 'contact', state: 'GAP' }];
  const { json, durationMs } = await callTask('relationship-insight', {
    inputFingerprint: `e2e_relationship_${persona.label}`,
    context: {
      status: 'ex',
      declared: persona.declared,
      relationship: {
        importantFactors: persona.experience.important,
        hardestMoment: persona.experience.hardest,
        selfGap: persona.experience.selfGap,
        note: persona.experience.note || null,
      },
      adaptive: null,
      observedValidated: [],
      ruleJudgements: judgements.map((j) => ({
        axis: j.axis,
        label: '연락',
        state: j.state,
        declaredPhrase: '연락 중요도 낮음',
        relationshipSignal: '연락 감소가 가장 힘들었음',
        isFocus: true,
      })),
      pastObservations: [],
    },
    judgements,
    focusAxis: 'contact',
  });
  if (!json?.ok) {
    reportRealMode({ task: `relationship-insight (${persona.label})`, json, durationMs });
    return;
  }
  const narratives = json.data.narratives ?? [];
  const overridden = narratives.filter((n) => n.state !== 'GAP');
  reportRealMode({
    task: `relationship-insight (${persona.label})`,
    json,
    durationMs,
    extra: `· narratives: ${narratives.length} · state-override: ${overridden.length}`,
  });
}

/* ------------------------------------------------ compatibility-narrative */
async function testCompatibilityNarrative() {
  const allowed = [{ key: 'contact', kind: 'friction' }];
  const { json, durationMs } = await callTask('compatibility-narrative', {
    inputFingerprint: 'e2e_compatibility_1',
    context: {
      computedScore: 55,
      comparedCount: 4,
      dimensions: [
        { key: 'contact', label: '연락', kind: 'friction', minePhrase: '연락 중요도 2/5', theirsPhrase: '자주' },
      ],
      targetRelation: null,
    },
    allowed,
  });
  if (!json?.ok) {
    reportRealMode({ task: 'compatibility-narrative', json, durationMs });
    return;
  }
  const narratives = json.data.narratives ?? [];
  const scoreLeak = narratives.some((n) => /\d{2,3}\s*점/.test(n.explanation ?? ''));
  reportRealMode({
    task: 'compatibility-narrative',
    json,
    durationMs,
    extra: `· narratives: ${narratives.length} · score-leak: ${scoreLeak}`,
  });
}

/* ----------------------------------------------------- history-insight */
async function testHistoryInsight() {
  const allowed = [{ axis: 'contact', state: 'SHIFT' }];
  const { json, durationMs } = await callTask('history-insight', {
    inputFingerprint: 'e2e_history_1',
    context: {
      changes: [
        {
          axis: 'contact',
          label: '연락',
          state: 'SHIFT',
          previousText: '연락 감소가 힘들었음',
          currentText: '연락 중요도 2/5',
          declaredDelta: { past: 4, now: 2 },
        },
      ],
    },
    allowed,
  });
  if (!json?.ok) {
    reportRealMode({ task: 'history-insight', json, durationMs });
    return;
  }
  const narratives = json.data.narratives ?? [];
  reportRealMode({ task: 'history-insight', json, durationMs, extra: `· narratives: ${narratives.length}` });
}

/* -------------------------------------------------- deep-report-narrative */
async function testDeepReportNarrative() {
  const insight = {
    id: 'e2e_cs_mirror_contact',
    evidenceRefs: [
      { source: 'declared', field: 'contact' },
      { source: 'relationship', field: 'hardest' },
    ],
  };
  const { json, durationMs } = await callTask('deep-report-narrative', {
    inputFingerprint: 'e2e_deep_report_1',
    context: {
      insights: [
        {
          id: insight.id,
          type: 'GAP',
          axis: 'contact',
          sources: ['declared', 'relationship'],
          evidence: [
            { ref: insight.evidenceRefs[0], text: '연락 중요도를 5점 중 2로 답했어' },
            { ref: insight.evidenceRefs[1], text: '연락 감소가 가장 힘들었음' },
          ],
          strength: 'strong',
        },
      ],
    },
    insights: [insight],
  });
  if (!json?.ok) {
    reportRealMode({ task: 'deep-report-narrative', json, durationMs });
    return;
  }
  const narratives = json.data.narratives ?? [];
  const evidenceOk = narratives.every((n) => (n.evidenceRefs?.length ?? 0) >= 1);
  reportRealMode({
    task: 'deep-report-narrative',
    json,
    durationMs,
    extra: `· narratives: ${narratives.length} · evidence-subset-ok: ${evidenceOk}`,
  });
}

async function main() {
  log(`Real Provider E2E — ${BASE_URL}\n`);

  try {
    await testObservedProfile();
    for (const persona of PERSONAS) await testRelationshipInsight(persona);
    await testCompatibilityNarrative();
    await testHistoryInsight();
    await testDeepReportNarrative();
  } catch (error) {
    log(`\n서버에 연결할 수 없음: ${error.message}`);
    log('npm run dev로 서버를 먼저 띄운 뒤 다시 실행하세요.');
    process.exit(1);
  }

  log(`\nPASS ${passed} · SKIPPED ${skipped} · FAIL ${failed}`);
  log(
    skipped > 0
      ? '\n⚠️ Real Provider E2E = NOT VERIFIED (일부/전체 SKIPPED — Key 미존재 또는 AI_MODE≠real)'
      : failed > 0
        ? '\n⚠️ Real Provider E2E = FAILED'
        : '\n✅ Real Provider E2E = VERIFIED (이 실행 기준)',
  );

  if (failed > 0) process.exit(1);
}

await main();
