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

/**
 * v1.42 §40.21 — **두 persona가 서로 다른 시제를 실제 Provider로 통과한다.**
 *
 * 호출 수를 늘리지 않았다(여전히 2건). Persona A는 진행 중인 관계, Persona B는 끝난
 * 관계로 두면 `current`·`former` 프롬프트 계약이 둘 다 실제 모델을 한 번씩 지나간다 —
 * 비용은 그대로이고 검증 범위는 두 배다.
 */
const PERSONA_TENSE = { [PERSONA_A.label]: 'current', [PERSONA_B.label]: 'former' };

/**
 * v1.42 §41.12 — **Job Safety도 실제 Provider로 확인한다.**
 *
 * Persona B는 끝난 관계(`former`)이므로 상대를 향한 질문을 만들 수 없다. 프롬프트는
 * 이 값을 **받지 않는다**(AI에게 Job을 알려주지 않는다) — 서버가 응답을 받은 뒤
 * `question`을 지운다. 그래서 이 검사는 '모델이 질문을 안 만들었는가'가 아니라
 * **'게이트가 실제로 작동했는가'**를 본다.
 */
const PERSONA_ALLOWS_QUESTIONS = { [PERSONA_A.label]: true, [PERSONA_B.label]: false };

const PERSONAS = [PERSONA_A, PERSONA_B];

/**
 * `tense: 'former'`에서 나오면 안 되는 현재형 호칭.
 *
 * ⚠️ `services/ai/safety.ts`의 `FORMER_TENSE_PATTERNS`와 **같은 것을 노린다.** 목록을
 * 두 벌 두는 것이 이상적이지 않지만, 이 스크립트는 서버 코드를 import하지 않는 순수
 * fetch 클라이언트다(다른 tests/*.mjs와 같은 방식). 스캐너 자체의 동작은
 * `tests/fixtures/ai/relationship_former_*.json` + `npm run test:ai`가 검사하고, 여기서
 * 보는 것은 **실제 모델 응답이 계약을 지키는가**다.
 */
const FORMER_FORBIDDEN = ['지금 이 관계', '지금 관계', '지금 상대', '현재 이 관계', '앞으로 둘이'];

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

/**
 * v1.42 §40.22 — **Key 없음과 요청 실패를 구분한다.**
 *
 * v1.41까지 `mode !== 'real'`이면 무조건 `SKIPPED — KEY NOT AVAILABLE`이었다. 그래서
 * 라우트가 400을 돌려줘도 "키가 없어서 건너뛰었다"로 보고됐다 — v1.42에서 실제로 그
 * 일이 났다(`tense`를 안 보내서 400인데 SKIPPED로 찍혔고, 같은 키로 다른 4개 Task는
 * PASS였다). **검증 도구가 실패를 부재로 보고하면 Release Gate가 무의미해진다.**
 *
 * 구분 규칙은 서버 분기 그대로다.
 *
 * ```
 * ok:false + CONFIG_ERROR   AI_MODE=real인데 Key가 없다        → SKIPPED (사실)
 * ok:true  + mode demo/mock Key 없이 데모로 응답했다            → SKIPPED (사실)
 * ok:false + 그 외 reason   요청/응답이 실제로 실패했다         → FAIL   (사실)
 * ```
 */
const KEY_ABSENT_REASONS = new Set(['CONFIG_ERROR']);

function reportRealMode({ task, json, durationMs, extra = '' }) {
  const mode = json?.data?.meta?.mode;
  if (json?.ok === false && !KEY_ABSENT_REASONS.has(json?.reason)) {
    log(`  duration: ${durationMs}ms · ok=false · reason: ${json?.reason ?? 'n/a'}`);
    verdict(task, `FAIL — 요청이 거절됐다 (${json?.reason ?? 'unknown'})`);
    return;
  }
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
  /**
   * v1.42 §40.21 — `tense`는 **요청 최상위와 context 양쪽**에 들어간다. 라우트가
   * 최상위 값으로 시제 스캐너를 돌리고, 프롬프트는 context의 값을 읽는다.
   *
   * ⚠️ v1.41까지 이 자리는 `status: 'ex'`였다 — `RelationshipStatus`에 **존재하지도
   * 않는 값**이다. 아무도 실패하지 않았다는 것이 raw status가 계약 없이 흘러가고
   * 있었다는 증거다(§40.7). 이제 라우트가 `tense`를 검증하므로 잘못 보내면 400이다.
   */
  const tense = PERSONA_TENSE[persona.label] ?? 'current';
  const allowsOutwardQuestions = PERSONA_ALLOWS_QUESTIONS[persona.label] ?? true;
  const { json, durationMs } = await callTask('relationship-insight', {
    inputFingerprint: `e2e_relationship_${persona.label}`,
    tense,
    // v1.42 §41.8 — 라우트가 boolean이 아니면 400이다. 프롬프트에는 들어가지 않는다.
    allowsOutwardQuestions,
    context: {
      tense,
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
        /**
         * v1.42 §41.13 — **실제 앱이 보내는 형식으로 고쳤다.**
         *
         * v1.41까지 `'연락 감소가 가장 힘들었음'`이었다 — `relationshipSignalTextOf`가
         * 만드는 문장은 `'이전 관계에서 … 으로 선택'`(과거) 또는
         * `'지금 관계에서 "…"라고 답함'`(현재)이고, 접두어가 근거의 **시점**을 말한다.
         * 접두어 없는 문장은 이 제품이 만들지 않는다.
         *
         * 그 차이가 v1.42 §41.6에서 드러났다: 새 [근거 source] 규칙이 접두어를 보는데
         * fixture 문장에는 접두어가 없어서 모델이 source를 못 고르고 refs를 비웠다.
         * **fixture가 실제 요청과 달랐던 것이 프롬프트 결함을 가린 것이 아니라 오히려
         * 드러냈지만**, 검증 도구는 실제로 보내는 것을 보내야 한다(v1.30이 `ref`를
         * 넣기로 한 것과 같은 이유).
         */
        relationshipSignal: '이전 관계에서 연락이 줄어들 때으로 선택',
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

  /**
   * v1.42 §40.21 — **실제 모델 응답이 시제 계약을 지켰는가.**
   *
   * 화면에 그려지는 문자열 전부를 훑는다(`explanation`·`question`·Core). 스캐너가 이미
   * 서버에서 걸러내므로 여기서 걸리는 것은 **스캐너가 뚫렸다는 뜻**이고, 0건이라는 것은
   * 프롬프트와 스캐너가 함께 동작했다는 뜻이다 — 어느 쪽이 막았는지는 구분하지 않는다.
   */
  const rendered = [
    ...narratives.flatMap((item) => [item.headline, item.explanation, item.question]),
    json.data.core?.headline,
    json.data.core?.summary,
    ...(json.data.core?.limitations ?? []),
  ].filter((text) => typeof text === 'string');
  const tenseLeaks =
    tense === 'former'
      ? rendered.filter((text) => FORMER_FORBIDDEN.some((phrase) => text.includes(phrase)))
      : [];

  /**
   * v1.42 §41.12 — **Job Safety 실측.** 허용하지 않는 Job에서 질문이 하나라도 남으면
   * 게이트가 동작하지 않은 것이다. 문장 원문은 찍지 않는다(§10).
   */
  const questionCount = narratives.filter((item) => typeof item.question === 'string').length;
  if (!allowsOutwardQuestions && questionCount > 0) {
    log(`  duration: ${durationMs}ms · tense=${tense} · JOB GATE LEAK question ${questionCount}건`);
    verdict(`relationship-insight (${persona.label})`, 'FAIL — outward 금지 Job에 질문이 남았다');
    return;
  }

  if (tenseLeaks.length > 0) {
    // ⚠️ 문장 원문은 찍지 않는다(§10). 몇 건인지만 낸다.
    log(`  duration: ${durationMs}ms · tense=${tense} · TENSE LEAK ${tenseLeaks.length}건`);
    verdict(`relationship-insight (${persona.label})`, 'FAIL — former 응답에 현재형 호칭');
    return;
  }

  reportRealMode({
    task: `relationship-insight (${persona.label})`,
    json,
    durationMs,
    extra:
      `· tense: ${tense} · outwardQ: ${allowsOutwardQuestions ? 'on' : 'off'} ` +
      `· narratives: ${narratives.length} · state-override: ${overridden.length} ` +
      `· tense-leak: 0 · questions: ${questionCount}`,
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
        /**
         * v1.30 — `ref`가 필수다. 프롬프트가 "이 ref를 그대로 복사하라"로 바뀌었으므로,
         * 이걸 빼고 요청하면 **실제 앱이 보내는 것과 다른 요청**을 검증하게 된다.
         */
        {
          key: 'contact',
          label: '연락',
          kind: 'friction',
          minePhrase: '연락 중요도 2/5',
          theirsPhrase: '자주',
          ref: { source: 'compatibility', field: 'contact' },
        },
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
  /**
   * v1.30 — **근거가 붙어 있는지 반드시 본다.**
   *
   * 예전 프롬프트는 field를 자유 서술로 뒀고 모델이 매번 이름을 지어냈다. 파싱은
   * 통과하지만 resolver가 풀지 못해 화면에서는 한 문장도 안 보였다 — 그런데 이
   * 하네스는 narratives 개수만 세고 있어서 **PASS로 보고했다.** 개수만으로는
   * 그 실패를 잡을 수 없다는 뜻이라, 근거 유무를 함께 센다.
   */
  const withEvidence = narratives.filter((n) => (n.evidenceRefs?.length ?? 0) > 0).length;
  const evidenceNote =
    narratives.length > 0 && withEvidence === 0 ? ' · ⚠️ 근거 0 — 화면에는 안 보인다' : '';
  reportRealMode({
    task: 'compatibility-narrative',
    json,
    durationMs,
    extra: `· narratives: ${narratives.length} · with-evidence: ${withEvidence} · score-leak: ${scoreLeak}${evidenceNote}`,
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
  /**
   * v1.27 — `ruleSummary`가 필수다. 서버의 Quality Gate (F)가 'AI가 이 문장을 그냥 다시
   * 쓴 것인지' 판정하는 기준이라서, 이게 없으면 실제 앱이 보내는 것과 다른 요청이 되고
   * (F)를 통과하는 척하게 된다 — 하네스가 계약을 따라가지 못하면 신호가 거짓이 된다.
   */
  const insight = {
    id: 'e2e_cs_mirror_contact',
    ruleSummary:
      '네가 말한 연락 기준과 실제 관계에서 가장 힘들었던 지점이 같은 축을 가리키고 있어.',
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
          // v1.27 프롬프트가 실제로 읽는 두 칸 — 없으면 모델이 다른 지시를 받는다
          allowedConnection: '네가 말한 연락 기준과 실제 관계에서 가장 힘들었던 지점이 같은 축을 가리키고 있어.',
          limitation: '네가 말한 기준과 관계 경험을 나란히 놓은 것까지야. 어느 쪽이 진짜 너인지는 정하지 않아.',
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
  /**
   * v1.27 — narratives가 0건이어도 실패가 아니다. 안전 검사나 (F) 중복 게이트가
   * 전부 떨어뜨렸을 수 있고, 그건 설계된 결말이다(화면은 규칙 문장으로 완결된다).
   * 다만 **0건이라는 사실은 반드시 보이게** 한다 — 조용히 넘기면 '모델이 안 만든 것'과
   * '게이트가 버린 것'을 구분할 수 없다. 문장 원문은 출력하지 않는다(§10).
   */
  const gateNote = narratives.length === 0 ? ' · ⚠️ 전부 게이트에서 걸러짐' : '';
  reportRealMode({
    task: 'deep-report-narrative',
    json,
    durationMs,
    extra: `· narratives: ${narratives.length} · evidence-subset-ok: ${evidenceOk}${gateNote}`,
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
