/**
 * Semantic Event Personalization Fixture — SEM-01 ~ SEM-15 (v1.46.4 · §48)
 *
 * ══ 이 스크립트가 고정하는 한 문장 ═════════════════════════════════════════
 *
 * > **Event의 개수는 개인화가 아니다. Event의 의미가 결과를 바꿀 때 개인화다.**
 *
 * v1.46.4 HARDENING까지의 fixture(`run-event-fixtures`·`run-value-fixtures`)는
 * **종류 기반** 개인화를 고정했다 — 사건 종류가 다르면 결과가 달라진다. 그건 이미
 * 통과했고, 그래서 그 검사만으로는 §17의 FAIL 기준을 잡을 수 없다:
 *
 * ```
 * 같은 종류(contact_change) · 다른 본문  →  결과가 같으면 FAIL
 * ```
 *
 * 이 스크립트의 A/B/C/D fixture는 **종류가 전부 같다.** 다른 것은 사용자가 적은
 * 문장의 의미뿐이다(`fixtures-v1464.mjs` · `SEM_A` ~ `SEM_D`).
 *
 * ══ 두 계층을 각자의 라우트로 검사한다 ═════════════════════════════════════
 *
 * ```
 * /api/dev/premium-test   Candidate 계층 — 화면이 실제로 그리는 값
 * /api/ai/contract-test   파서·게이트 계층 — 실제 parse/scan 함수를 그대로 통과시킨다
 * ```
 *
 * ⚠️ **판정 로직을 여기서 복제하지 않는다.** 두 라우트 모두 제품과 같은 함수를 부르고,
 * 이 스크립트는 fixture 조립과 검증만 한다.
 *
 * ⚠️ 이 스크립트는 **Provider를 부르지 않는다.** AI 성공 상태는 `narratives`를 직접
 * 넘겨 시뮬레이션한다 — 그래서 실패와 성공을 같은 라우트에서 비교할 수 있다. 실제
 * Provider 품질은 사람이 읽는 QA(§31 ~ §34)의 몫이고 이 파일이 대체하지 않는다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:semantic`
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EVENTS_SEM_B,
  FIXTURE_SPARSE,
  SEM_A,
  SEM_B,
  SEM_C,
  SEM_D,
  createChecker,
  findForbidden,
  run,
  stressEvents,
  stripComments,
} from './fixtures-v1464.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';
const { check, report } = createChecker();

console.log('\nSemantic Event Personalization Fixture — v1.46.4 §48\n');

/** `/api/ai/contract-test`에 deep-report 응답을 통과시킨다 */
async function contract(body) {
  const response = await fetch(`${BASE_URL}/api/ai/contract-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'deep-report-narrative', ...body }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} — dev 서버 확인`);
  const json = await response.json();
  if (!json.ok) throw new Error(`route error: ${JSON.stringify(json)}`);
  return json;
}

/**
 * 계약 검사용 최소 응답 한 벌.
 *
 * ⚠️ `headline`/`interpretation`은 **semantic과 무관한 기존 계약**이다. 여기 값이
 * 규칙 문장을 되풀이하면 (F) 게이트에서 narrative 전체가 떨어지고, 그러면 semantic
 * 검사가 시작되기도 전에 0건이 된다 — 그래서 일부러 새로운 문장을 쓴다.
 */
function narrativeWith(semantic, overrides = {}) {
  return {
    narratives: [
      {
        insightId: 'ins-1',
        headline: '연락 리듬이 달라지는 순간에 반응이 커질 수 있어',
        interpretation:
          '답이 늦어진 날과 먼저 묻지 못한 날이 나란히 있어서, 기다리는 시간 자체가 부담이 되는 모양일 수 있어. 왜 그랬는지는 이 자료만으로 알 수 없어.',
        evidenceRefs: [{ source: 'declared', field: 'contact' }],
        ...(semantic ? { semantic } : {}),
        ...overrides,
      },
    ],
  };
}

/**
 * ⚠️ **`ruleSummary`를 넣지 않는다.** 넣으면 Quality Gate (F)(규칙 문장 되풀이)가
 * narrative를 먼저 버리고, semantic 게이트는 시작조차 하지 않는다 — 실측에서
 * `redundantCount: 1`로 확인했다. 이 파일이 검사하는 것은 **semantic 계층**이므로
 * 앞 단계 게이트를 꺼서 격리한다(라우트가 `ruleSummary`를 optional로 둔 이유다).
 *
 * (F) 게이트 자체의 회귀는 `run-ai-contract.mjs`가 이미 고정하고 있다.
 */
const ALLOWED_INSIGHT = [{ id: 'ins-1', evidenceRefs: [{ source: 'declared', field: 'contact' }] }];

/**
 * §8 — 이 Candidate의 semantic을 **실제로 받게 될** Insight id.
 *
 * ══ 왜 helper가 필요한가 ══════════════════════════════════════════════════
 *
 * 첫 판에는 `insights.find((i) => i.eligibleForNarrative).id`를 썼고 SEM-08·14·15가
 * 전부 떨어졌다. 그 첫 Insight(`cs_reltarget_contact`)는 `ch_closeness_distance`에
 * 속하는데, 그 Chapter의 Candidate는 **`dedupeByConclusion`에서 접혔다**(contact:GAP을
 * 앞 Candidate가 이미 가져갔다 · §31). 화면에 없는 Candidate의 Insight에 semantic을
 * 붙이면 당연히 아무것도 쓰이지 않는다 — 코드가 아니라 fixture가 틀렸던 것이다.
 *
 * Candidate는 자기 Chapter가 품은 Insight 중 **축·판정을 정한 것**의 narrative를
 * 집어 온다. 그래서 여기서도 같은 규칙으로 고른다.
 */
function governingInsightId(result, candidateIndex = 0) {
  const candidate = result.report.candidates[candidateIndex];
  if (!candidate) return null;
  const chapter = result.chapters.find((item) => item.id === candidate.chapterId);
  const ids = chapter?.insightIds ?? [];
  const TYPE_TO_VERDICT = {
    CONTRADICTION: 'CONTRADICTION',
    GAP: 'GAP',
    CHANGE: 'CHANGE',
    MATCH: 'MATCH',
    REPEATED_SIGNAL: 'MATCH',
    UNKNOWN: 'UNRESOLVED',
  };
  return (
    ids
      .map((id) => result.insights.find((insight) => insight.id === id))
      .find(
        (insight) =>
          insight &&
          (insight.axis ?? null) === candidate.axis &&
          TYPE_TO_VERDICT[insight.type] === candidate.verdict,
      )?.id ?? null
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-01 — 같은 판정 + 다른 Event 본문 → 다른 Provider context
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('SEM-01 · 같은 판정인데 사건 본문이 다르면 Provider context가 다르다');
{
  const [a, b, c, d] = await Promise.all([run(SEM_A), run(SEM_B), run(SEM_C), run(SEM_D)]);

  /*
    ⚠️ **먼저 판정이 같다는 것을 고정한다.** 이 줄이 없으면 아래 차이가 '사건의 의미
    때문'인지 '판정이 달라져서'인지 구분할 수 없고, 그러면 §2-2(점수·판정 불변)가
    깨진 것을 개인화 성공으로 오독한다.
  */
  const states = [a, b, c, d].map((r) => JSON.stringify(r.mirrorStates));
  check('네 fixture의 Mirror 판정이 완전히 같다 (§2-2 — 사건은 판정을 바꾸지 않는다)',
    new Set(states).size === 1, states);
  const scores = [a, b, c, d].map((r) => r.compatibility?.score ?? null);
  check('네 fixture의 동기화율 점수가 같다', new Set(scores).size === 1, scores);

  const deepCall = (r) => r.ai.calls.find((call) => call.task === 'deep-report');
  const digests = [b, c, d].map((r) => deepCall(r).eventDigest);
  check(
    'SEM-01 · B·C·D의 Deep Report 장면 지문이 서로 다르다',
    new Set(digests).size === 3,
    digests,
  );
  check(
    'SEM-01 · 사건 없는 A는 장면을 싣지 않는다',
    deepCall(a).eventCount === 0,
    deepCall(a).eventCount,
  );
  check(
    'SEM-01 · B·C·D는 장면을 실제로 싣는다',
    [b, c, d].every((r) => deepCall(r).eventCount > 0),
    [b, c, d].map((r) => deepCall(r).eventCount),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-02 · SEM-03 — usedEventIds · evidenceRefs 부분집합 (§9)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-02 · SEM-03 — 부분집합 검증 (파서·게이트 계층)');
{
  const SEMANTIC_OK = {
    soWhat: '연락 횟수보다, 달라진 이유를 모르는 상태에 더 크게 반응할 수 있어.',
    /*
      ⚠️ 첫 판에는 `상대의 사정과 네 불편이 섞여`라고 썼고 게이트가 버렸다 —
      `scene_other_side`가 잡았고 **그게 맞는 동작**이다(§10 — 상대 입장을 대신
      설명하지 않는다). 통과해야 하는 fixture이므로 주어를 사용자 쪽으로 돌린다.
    */
    whyItMatters: '답이 늦어지는 날마다 이유를 찾게 되면, 기다리는 시간이 그대로 불편으로 남아.',
    verification: '답이 늦어지는 날에 네가 먼저 묻는 게 편한지 한번 봐.',
    usedEventIds: ['ev-sb1'],
  };

  /* ── 정상 경로 ─────────────────────────────────────────────────────── */
  const ok = await contract({
    raw: narrativeWith(SEMANTIC_OK),
    allowed: ALLOWED_INSIGHT,
    allowedSceneIds: { 'ins-1': ['ev-sb1', 'ev-sb2'] },
    sceneTexts: { 'ins-1': [EVENTS_SEM_B[0].description, EVENTS_SEM_B[0].myReaction] },
  });
  check('허용집합 안의 장면만 인용한 semantic은 통과한다', ok.semantic.kept === 1, ok.semantic);
  check(
    '통과한 semantic의 usedEventIds가 그대로 남는다',
    JSON.stringify(ok.semantic.items[0]?.usedEventIds) === JSON.stringify(['ev-sb1']),
    ok.semantic.items,
  );

  /* ── SEM-02 — 허용집합 밖의 장면 id ────────────────────────────────── */
  const foreign = await contract({
    raw: narrativeWith({ ...SEMANTIC_OK, usedEventIds: ['ev-sb1', 'ev-XXXX'] }),
    allowed: ALLOWED_INSIGHT,
    allowedSceneIds: { 'ins-1': ['ev-sb1', 'ev-sb2'] },
  });
  check(
    'SEM-02 · 허용집합 밖 장면 id를 들고 오면 semantic이 버려진다',
    foreign.semantic.kept === 0 && foreign.semantic.rejected === 1,
    foreign.semantic,
  );
  check(
    'SEM-02 · 위반 라벨이 남는다 (무엇이 막혔는지 관측 가능하다)',
    foreign.semantic.violations.includes('semantic_event_id_outside_allowed'),
    foreign.semantic.violations,
  );
  check(
    'SEM-02 · 그래도 narrative 본체(headline·interpretation)는 살아 있다',
    foreign.narratives.length === 1,
    foreign.narratives,
  );

  /* ── 장면을 보내지 않은 호출에서 장면을 인용하면 ───────────────────── */
  const noScenes = await contract({
    raw: narrativeWith(SEMANTIC_OK),
    allowed: ALLOWED_INSIGHT,
  });
  check(
    'SEM-02 · 장면을 보내지 않은 호출의 장면 인용은 전부 거부된다 (기본값이 안전한 쪽)',
    noScenes.semantic.kept === 0,
    noScenes.semantic,
  );

  /* ── SEM-03 — evidenceRefs 부분집합은 기존 (E) 게이트가 막는다 ──────── */
  const badRef = await contract({
    raw: narrativeWith(SEMANTIC_OK, {
      evidenceRefs: [{ source: 'observed', traitId: 'made-up-trait' }],
    }),
    allowed: ALLOWED_INSIGHT,
    allowedSceneIds: { 'ins-1': ['ev-sb1'] },
  });
  check(
    'SEM-03 · 허용집합 밖 evidenceRef는 narrative 전체를 버린다 (semantic도 함께)',
    badRef.narratives.length === 0 && badRef.semantic.kept === 0,
    { narratives: badRef.narratives.length, semantic: badRef.semantic },
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-04 · SEM-05 — Event 수정 · 삭제 (§43 · §44)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-04 · SEM-05 — 수정·삭제가 캐시와 의존성에 반영된다');
{
  const fingerprintSrc = stripComments(await readFile(join(ROOT, 'src/lib/aiFingerprint.ts'), 'utf8'));
  const semanticSrc = stripComments(
    await readFile(join(ROOT, 'src/lib/logic/semanticEventContext.ts'), 'utf8'),
  );
  const hookSrc = stripComments(await readFile(join(ROOT, 'src/hooks/useAiNarrative.ts'), 'utf8'));

  check(
    'SEM-04 · deepReportFingerprint가 사건 서명을 받는다',
    /eventSignature\?: readonly string\[\]/.test(fingerprintSrc) &&
      /\.\.\.eventSignature/.test(fingerprintSrc),
  );
  check(
    'SEM-04 · 장면 배분 서명도 받는다 (사건 추가로 선택이 뒤바뀌는 경우)',
    /selectionSignature\?: readonly string\[\]/.test(fingerprintSrc) &&
      /\.\.\.selectionSignature/.test(fingerprintSrc),
  );
  /*
    ⚠️ **여기가 §43의 핵심이다.** 렌즈 쪽 서명(`lensEventSignature`)은
    `type:description.length`라 **같은 길이로 고친 수정을 감지하지 못한다.** 새 서명은
    본문 해시를 쓴다 — 길이가 아니라 내용이다.
  */
  check(
    'SEM-04 · 서명이 길이가 아니라 본문 해시를 쓴다 (같은 길이 수정도 감지한다)',
    /textHash\(event\.description\)/.test(semanticSrc) &&
      /textHash\(event\.myReaction\)/.test(semanticSrc),
  );
  check(
    'SEM-04 · myReaction도 서명에 들어간다 (반응만 고친 경우)',
    /textHash\(event\.myReaction\)/.test(semanticSrc),
  );
  check(
    'SEM-04 · 서명 문자열에 원문이 남지 않는다 (해시만)',
    !/\$\{event\.description\}/.test(semanticSrc) && !/\$\{event\.myReaction\}/.test(semanticSrc),
  );
  check(
    'SEM-04 · 훅이 두 서명을 지문에 넘긴다',
    /eventSignature,/.test(hookSrc) && /selectionSignature,/.test(hookSrc),
  );

  /* 실제 서명 값이 본문 수정에 반응하는지 — 라우트 지문으로 확인한다 */
  const edited = {
    ...SEM_B,
    target: {
      ...SEM_B.target,
      events: [
        /* 같은 id · 같은 종류 · **같은 길이**로 뜻만 반대로 고친다 */
        { ...EVENTS_SEM_B[0], description: '연락이 갑자기 줄었을 때 그냥 바쁜 줄 알았어' },
        EVENTS_SEM_B[1],
      ],
    },
  };
  const [before, after] = await Promise.all([run(SEM_B), run(edited)]);
  const digest = (r) => r.ai.calls.find((call) => call.task === 'deep-report').eventDigest;
  check(
    'SEM-04 · 본문을 같은 길이로 고쳐도 payload 지문이 달라진다',
    digest(before) !== digest(after),
    { before: digest(before), after: digest(after) },
  );

  /* ── SEM-05 — 삭제 ─────────────────────────────────────────────────── */
  const deleted = { ...SEM_B, target: { ...SEM_B.target, events: [EVENTS_SEM_B[1]] } };
  const afterDelete = await run(deleted);
  const sentIds = afterDelete.ai.calls.flatMap((call) => call.eventIds ?? []);
  check(
    'SEM-05 · 삭제한 장면이 Provider payload에 없다',
    !sentIds.includes('ev-sb1'),
    sentIds,
  );
  const citedIds = afterDelete.report.candidates.flatMap((candidate) => candidate.relevantEventIds);
  check(
    'SEM-05 · 삭제한 장면이 근거 토글 목록에도 없다',
    !citedIds.includes('ev-sb1'),
    citedIds,
  );
  const semanticIds = afterDelete.report.candidates.flatMap(
    (candidate) => candidate.semanticEventIds,
  );
  check(
    'SEM-05 · semantic 의존성에도 남지 않는다',
    !semanticIds.includes('ev-sb1'),
    semanticIds,
  );
  /*
    Candidate 계층의 부분집합 확인 — 삭제된 장면을 인용한 narrative가 들어와도
    화면이 그 문장을 쓰지 않는다(`insightCandidates`의 두 번째 검증).
  */
  const stale = await run({
    ...deleted,
    narratives: [
      {
        insightId: 'ins-current-declared-contact',
        headline: '테스트',
        interpretation: '테스트 문장',
        evidenceRefs: [],
        semantic: {
          soWhat: '삭제된 장면을 근거로 삼은 문장',
          whyItMatters: '이 문장은 화면에 나오면 안 된다',
          usedEventIds: ['ev-sb1'],
        },
      },
    ],
  });
  check(
    'SEM-05 · 삭제된 장면을 인용한 semantic은 화면에 쓰이지 않는다',
    stale.report.candidates.every((candidate) => candidate.soWhatSource !== 'semantic_ai'),
    stale.report.candidates.map((candidate) => [candidate.id, candidate.soWhatSource]),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-06 — Event raw text가 Analytics로 나가지 않는다 (§29)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-06 · 자유 입력이 Analytics·로그로 나가지 않는다');
{
  const analytics = stripComments(await readFile(join(ROOT, 'src/lib/analytics.ts'), 'utf8'));
  const handlers = stripComments(await readFile(join(ROOT, 'src/services/ai/handlers.ts'), 'utf8'));
  const devRoute = stripComments(
    await readFile(join(ROOT, 'src/app/api/dev/premium-test/route.ts'), 'utf8'),
  );

  check(
    'SEM-06 · analytics.ts에 사건 본문 필드가 없다',
    !/description|myReaction/.test(analytics),
  );
  /*
    ⚠️ AI 필터 로그에도 본문이 남지 않아야 한다. semantic 게이트가 새로 위반을
    기록하는데, 그때 문장을 함께 남기면 자유 입력이 dev 로그에 쌓인다(§34 Privacy).
  */
  check(
    'SEM-06 · semantic 게이트가 위반 라벨만 남긴다 (문장 원문 금지)',
    /semanticViolations\.push\(\.\.\.scan\.violations\)/.test(handlers) &&
      !/semanticViolations\.push\((item|scan)\.semantic/.test(handlers),
  );
  check(
    'SEM-06 · dev 라우트가 장면 본문 대신 해시를 낸다',
    /eventDigest: digestOf\(/.test(devRoute),
  );
  /*
    ══ 실측 — **어느 필드에 본문이 있어도 되는가** ════════════════════════════

    ⚠️ 이 검사를 "응답 전체에 본문 0"으로 쓰면 **틀린다.** 본문을 그대로 들고 있어야
    하는 자리가 두 곳 있고, 둘 다 설계다:

    ```
    report.reportedScenes    근거 토글의 장면 인용 — §36 "원문 그대로, 요약하지 않는다"
    report.lensBundle        렌즈 카드의 `reportedEventLine` — v1.46 §19의 화면 카피
    ```

    여기서 검사하는 것은 **이번 Pass가 새로 만든 필드**가 본문을 흘리지 않는가다.
    로그로 남는 자리(예산·지문·계측)와 결론 문장(candidate)이 그 대상이다.
  */
  const body = await run(SEM_B);
  const RAW = [
    ...EVENTS_SEM_B.map((event) => event.description),
    ...EVENTS_SEM_B.map((event) => event.myReaction),
  ].filter(Boolean);
  const leakedIn = (value) => RAW.filter((text) => JSON.stringify(value).includes(text));

  check('SEM-06 · ai 예산 블록에 본문이 없다 (해시·길이만)', leakedIn(body.ai).length === 0, leakedIn(body.ai));
  check('SEM-06 · events 계측 블록에 본문이 없다', leakedIn(body.events).length === 0, leakedIn(body.events));
  /*
    ⚠️ **여기가 §36의 결론 계층 검사다.** 첫 화면 결론 문장에 사용자가 쓴 문장이
    글자 그대로 들어가면, 유료 결과의 첫 문장이 사용자가 5분 전에 적은 것이 된다.
  */
  check(
    'SEM-06 · 첫 화면 결론 문장에 본문이 글자 그대로 들어가지 않는다',
    leakedIn(body.report.candidates).length === 0,
    leakedIn(body.report.candidates),
  );
  check(
    'SEM-06 · 근거 블록에는 원문이 그대로 있다 (§36 — 요약하지 않는다)',
    leakedIn(body.report.reportedScenes).length > 0,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-07 — 첫 화면 메타 언어 0 (§12 · §35 · §37)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-07 · 첫 화면에 분석 메타 언어가 0개다');
{
  const META = [
    '동기화율',
    '자료 2종',
    '자료 3종',
    '자료 4종',
    '자료 5종',
    '같은 자리를 가리',
    '같은 축을 가리',
    '판정',
    'MATCH',
    'GAP',
    'CHANGE',
    'evidence',
    'candidate',
    '분석 결과상',
  ];

  const visible = (result) =>
    result.report.candidates.slice(0, 3).flatMap((candidate) => [
      candidate.headline,
      candidate.soWhat,
      candidate.whyItMatters,
      candidate.verification ?? '',
      ...candidate.questions.map((question) => question.text),
    ]);

  for (const [name, result] of [
    ['A(사건 0)', await run(SEM_A)],
    ['B', await run(SEM_B)],
    ['C', await run(SEM_C)],
    ['D', await run(SEM_D)],
  ]) {
    const hits = findForbidden(visible(result), META);
    check(`SEM-07 · ${name} 첫 viewport 메타 언어 0건`, hits.length === 0, hits);
    /* §37 — '축'이라는 낱말 자체도 첫 화면에 없다 */
    const axisHits = visible(result).filter((text) => /(^|[^가-힣])축(?![하적구소제])/.test(text));
    check(`SEM-07 · ${name} 첫 viewport에 '축' 낱말 0건`, axisHits.length === 0, axisHits);
  }

  /* 무료 핵심 본문도 같은 금지 목록을 받는다(§12 첫 줄) */
  const free = await run(SEM_B);
  const freeTexts = free.free.candidates.flatMap((candidate) => [
    candidate.soWhat,
    candidate.whyItMatters,
  ]);
  check('SEM-07 · FREE 핵심 본문 메타 언어 0건', findForbidden(freeTexts, META).length === 0, freeTexts);

  /* Executive 3줄도 첫 viewport다 */
  const execTexts = (free.report.executive?.rows ?? []).flatMap((row) =>
    [row.label, row.text, row.watch, row.soWhat].filter(Boolean),
  );
  check(
    'SEM-07 · Executive 3줄 메타 언어 0건',
    findForbidden(execTexts, META).length === 0,
    execTexts,
  );

  /* ── 게이트가 실제로 막는지 (파서 계층) ────────────────────────────── */
  const metaSemantic = await contract({
    raw: narrativeWith({
      soWhat: '동기화율에서 갈린 축이야. 자료 3종이 같은 자리를 가리켜.',
      whyItMatters: '판정이 GAP으로 나온 자리라서 확인이 필요해.',
      usedEventIds: [],
    }),
    allowed: ALLOWED_INSIGHT,
    allowedSceneIds: { 'ins-1': ['ev-sb1'] },
  });
  check(
    'SEM-07 · 메타 언어가 든 semantic은 게이트가 버린다',
    metaSemantic.semantic.kept === 0,
    metaSemantic.semantic,
  );
  check(
    'SEM-07 · 위반 라벨이 어느 어휘인지 말해준다',
    metaSemantic.semantic.violations.some((label) => label.startsWith('meta_')),
    metaSemantic.semantic.violations,
  );

  /* 오검출 확인 — '축하'·'압축'은 막히지 않는다 */
  const benign = await contract({
    raw: narrativeWith({
      soWhat: '서로 축하할 일이 생겼을 때 표현하는 방식이 다를 수 있어.',
      whyItMatters: '기쁜 일을 나누는 방식이 다르면 반응이 작게 느껴질 수 있어.',
      usedEventIds: [],
    }),
    allowed: ALLOWED_INSIGHT,
  });
  check(
    "SEM-07 · '축하' 같은 정상 어휘는 막히지 않는다 (과필터 아님)",
    benign.semantic.kept === 1,
    benign.semantic,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-08 · SEM-09 — fallback 사용률 (§19)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-08 · SEM-09 — fallback 사용률 계측');
{
  const high = await run(SEM_B);
  const sources = high.report.candidates.map((candidate) => candidate.soWhatSource);
  check(
    'SEM-08 · high-data에서 static_fallback이 0이다',
    !sources.includes('static_fallback'),
    sources,
  );
  /*
    ⚠️ 이 라우트는 Provider를 부르지 않으므로 `semantic_ai`가 나올 수 없다 — fixture가
    `narratives`를 넘기지 않았기 때문이다. 그래서 여기서 검사하는 것은 "AI가 없을 때
    결정론 조립문이 주인공인가"이고, `semantic_ai > 0`은 실제 Provider QA(§19)의 몫이다.
  */
  check(
    'SEM-08 · AI가 없으면 전부 deterministic_composed다',
    sources.every((source) => source === 'deterministic_composed'),
    sources,
  );

  /* semantic을 넘기면 실제로 쓰이는가 — 계층이 배선돼 있는지 확인 */
  const withAi = await run({
    ...SEM_B,
    narratives: [
      {
        insightId: governingInsightId(high),
        headline: '연락 리듬이 달라지는 순간',
        interpretation: '답이 늦어진 날과 먼저 묻지 못한 날이 나란히 있어.',
        evidenceRefs: [],
        semantic: {
          soWhat: '연락 횟수보다, 달라진 이유를 모르는 상태에 더 크게 반응할 수 있어.',
          whyItMatters: '이유를 모르면 기다리는 시간이 그대로 불편으로 남아.',
          verification: '답이 늦어지는 날에 먼저 한마디 묻는 게 편한지 봐.',
          usedEventIds: [],
        },
      },
    ],
  });
  check(
    'SEM-08 · semantic이 오면 첫 화면이 그 문장을 쓴다 (계층이 배선돼 있다)',
    withAi.report.candidates.some((candidate) => candidate.soWhatSource === 'semantic_ai'),
    withAi.report.candidates.map((candidate) => [candidate.id, candidate.soWhatSource]),
  );

  /* ── SEM-09 — Provider 실패 ────────────────────────────────────────── */
  const failed = await run({ ...SEM_B, narratives: [] });
  const failedSources = failed.report.candidates.map((candidate) => candidate.soWhatSource);
  check(
    'SEM-09 · Provider 실패에서 semantic_ai가 0이다',
    !failedSources.includes('semantic_ai'),
    failedSources,
  );
  check(
    'SEM-09 · 그래도 모든 카드에 결론 문장이 있다 (AI가 죽어도 결론이 남는다)',
    failed.report.candidates.every((candidate) => candidate.soWhat.length > 0),
    failed.report.candidates.map((candidate) => candidate.soWhat.length),
  );
  check(
    'SEM-09 · 첫 화면 카드 수가 AI 유무에 따라 달라지지 않는다',
    failed.report.candidates.length === high.report.candidates.length,
    { failed: failed.report.candidates.length, high: high.report.candidates.length },
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-10 — ended에서 outward 0 (§41)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-10 · 끝난 관계에서 현재형 행동 제안이 0이다');
{
  const ended = await run({
    ...SEM_B,
    status: 'ended',
    target: { ...SEM_B.target, relation: 'ex' },
  });
  const texts = ended.report.candidates.flatMap((candidate) => [
    candidate.headline,
    candidate.soWhat,
    candidate.whyItMatters,
    candidate.verification ?? '',
    ...candidate.questions.map((question) => question.text),
  ]);
  const OUTWARD = ['다가가', '연락해봐', '먼저 연락', '다음 만남', '재회', '물어봐', '제안해봐'];
  check('SEM-10 · ended 첫 화면 outward 어휘 0건', findForbidden(texts, OUTWARD).length === 0, texts);
  check(
    'SEM-10 · ended에서 상대에게 보내는 질문이 0개다',
    ended.report.candidates.every((candidate) => candidate.questions.length === 0),
    ended.report.candidates.map((candidate) => candidate.questions.length),
  );

  /* 게이트가 실제로 막는지 — former 시제에서 outward semantic을 버린다 */
  const outwardSemantic = await contract({
    tense: 'former',
    raw: narrativeWith({
      soWhat: '다음에 연락해보면 그때 무엇이 걸렸는지 알 수 있어.',
      whyItMatters: '먼저 다가가 보면 기준이 분명해질 수 있어.',
      usedEventIds: [],
    }),
    allowed: ALLOWED_INSIGHT,
  });
  check(
    'SEM-10 · former에서 outward semantic을 게이트가 버린다',
    outwardSemantic.semantic.kept === 0,
    outwardSemantic.semantic,
  );

  /* 회고 표현은 허용이다(§41) — 금지만 하면 쓸 말이 없어진다 */
  const retrospective = await contract({
    tense: 'former',
    raw: narrativeWith({
      soWhat: '연락 횟수보다, 이유를 모른 채 기다린 시간이 더 크게 남았을 수 있어.',
      whyItMatters: '다음 관계에서 같은 장면이 오면 더 일찍 알아차릴 수 있는 신호야.',
      usedEventIds: [],
    }),
    allowed: ALLOWED_INSIGHT,
  });
  check(
    'SEM-10 · 회고 표현은 통과한다 (과필터 아님)',
    retrospective.semantic.kept === 1,
    retrospective.semantic,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-11 — FREE / Premium 핵심 주장 중복 0 (§45)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-11 · FREE와 Premium의 핵심 주장이 겹치지 않는다');
{
  const result = await run(SEM_B);
  const freeSoWhat = result.free.candidates.map((candidate) => candidate.soWhat);
  const premiumSoWhat = result.report.candidates.map((candidate) => candidate.soWhat);
  check(
    'SEM-11 · 글자 그대로 같은 문장이 없다',
    premiumSoWhat.every((text) => !freeSoWhat.includes(text)),
    { free: freeSoWhat, premium: premiumSoWhat },
  );
  /*
    ⚠️ 문장 비교만으로는 부족하다(§45 — paraphrase). Premium 카드 중 최소 하나가
    **무료 밖 근거**를 갖고 있어야 한다. 그게 '유료가 더 주는 것'의 구조적 근거다.
  */
  check(
    'SEM-11 · Premium 카드 중 최소 하나가 무료 밖 근거를 쓴다',
    result.report.candidates.some((candidate) => candidate.hasOutsideFreeEvidence),
    result.report.candidates.map((candidate) => [candidate.id, candidate.hasOutsideFreeEvidence]),
  );
  check(
    'SEM-11 · 무료 Candidate는 무료 밖 근거를 쓰지 않는다',
    result.free.candidates.every((candidate) => candidate.hasOutsideFreeEvidence === false),
    result.free.candidates.map((candidate) => candidate.hasOutsideFreeEvidence),
  );
  check(
    'SEM-11 · 무료에는 semantic 계층이 없다 (§21 깊이 가드)',
    result.free.candidates.every((candidate) => candidate.soWhatSource !== 'semantic_ai'),
    result.free.candidates.map((candidate) => candidate.soWhatSource),
  );
  /* §22 — CTA가 실제 semantic gap을 판다 */
  check(
    'SEM-11 · Paywall tease가 분량이 아니라 내용을 말한다',
    result.report.paywallTease === null ||
      findForbidden([result.report.paywallTease], ['더 자세히', '더 깊은', '더 많은']).length === 0,
    result.report.paywallTease,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-12 — sparse에서 근거 없는 추론 0 (§46)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-12 · 근거가 적으면 짧고 정확하게');
{
  const sparse = await run(FIXTURE_SPARSE);
  check(
    'SEM-12 · sparse에서는 첫 화면 주인공을 만들지 않는다',
    sparse.report.candidates.length === 0 || sparse.report.available === false,
    { count: sparse.report.candidates.length, available: sparse.report.available },
  );
  check(
    'SEM-12 · sparse에서 Deep Report 장면 전송이 0이다',
    sparse.events.sentToDeepReport === 0,
    sparse.events.sentToDeepReport,
  );
  /*
    장면이 하나도 없는데 semantic을 만들어 보내면 — 화면이 쓰지 않아야 한다.
    근거 없는 문장을 AI가 만들었을 때의 마지막 방어선이다.
  */
  const madeUp = await contract({
    raw: narrativeWith({
      soWhat: '너는 관계에서 늘 먼저 다가가는 사람일 수 있어.',
      whyItMatters: '그 성향 때문에 매번 같은 자리에서 지치게 될 거야.',
      usedEventIds: [],
    }),
    allowed: ALLOWED_INSIGHT,
  });
  check(
    'SEM-12 · 진단·예측이 든 semantic은 게이트가 버린다',
    madeUp.semantic.kept === 0,
    madeUp.semantic,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-13 — 같은 종류 + 다른 본문 → 다른 semantic 경로 (§15 · §17)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-13 · 같은 종류인데 본문이 다르면 다른 경로를 탄다');
{
  const [b, c, d] = await Promise.all([run(SEM_B), run(SEM_C), run(SEM_D)]);

  /* 종류가 같다는 것을 먼저 고정한다 — 이게 SEM-13과 기존 검사의 차이다 */
  const types = [b, c, d].map((r) => JSON.stringify(Object.keys(r.events.histogram).sort()));
  check(
    'SEM-13 · 세 fixture의 사건 종류 구성이 같다 (종류 기반 개인화로는 구분되지 않는다)',
    new Set(types).size === 1,
    types,
  );

  const deepCall = (r) => r.ai.calls.find((call) => call.task === 'deep-report');
  check(
    'SEM-13 · 그래도 Provider에 나가는 장면 본문이 서로 다르다',
    new Set([b, c, d].map((r) => deepCall(r).eventDigest)).size === 3,
    [b, c, d].map((r) => deepCall(r).eventDigest),
  );
  /*
    ⚠️ 결정론 계층에서는 세 fixture의 SO WHAT이 **같을 수 있다** — 종류가 같으므로
    조립 재료가 같다. 그게 정확히 §17이 FAIL로 규정한 상태이고, 그 해소가
    `semantic_ai` 계층의 일이다. 그래서 여기서 '문장이 다르다'를 요구하지 않고,
    **의미가 달라질 수 있는 입력이 실제로 전달됐는가**를 요구한다.

    실제 문장 차이는 사람이 읽는 Provider QA(§15 · §16)가 판정한다 — 자동 검사로
    '의미가 다른가'를 판정하려 들면 문자열 비교로 되돌아가고, 그건 paraphrase에
    무력하다.
  */
  check(
    'SEM-13 · 세 fixture가 같은 판정·같은 종류·다른 본문이라는 조건을 만족한다',
    new Set([b, c, d].map((r) => JSON.stringify(r.mirrorStates))).size === 1 &&
      new Set([b, c, d].map((r) => deepCall(r).eventDigest)).size === 3,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-14 · SEM-15 — 질문이 semantic을 쓴다 / 원문을 노출하지 않는다 (§23 ~ §26)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-14 · SEM-15 — 추천 질문');
{
  const base = await run(SEM_B);
  const insightId = governingInsightId(base);
  check('SEM-14 · 첫 Candidate의 판정을 정한 Insight를 찾았다', Boolean(insightId), insightId);

  const withQuestion = await run({
    ...SEM_B,
    narratives: [
      {
        insightId,
        headline: '연락 리듬이 달라지는 순간',
        interpretation: '답이 늦어진 날과 먼저 묻지 못한 날이 나란히 있어.',
        evidenceRefs: [],
        semantic: {
          soWhat: '연락 횟수보다, 달라진 이유를 모르는 상태에 더 크게 반응할 수 있어.',
          whyItMatters: '이유를 모르면 기다리는 시간이 그대로 불편으로 남아.',
          verification: '평소보다 답이 늦어지는 날에는 한마디 알려주는 게 편해?',
          usedEventIds: [],
        },
      },
    ],
  });
  const semanticQuestions = withQuestion.report.candidates.flatMap((candidate) =>
    candidate.questions.filter((question) => question.register === 'semantic'),
  );
  check(
    'SEM-14 · 근거가 지지하면 질문이 semantic을 쓴다',
    semanticQuestions.length > 0,
    withQuestion.report.candidates.map((candidate) =>
      candidate.questions.map((question) => question.register),
    ),
  );
  check(
    'SEM-14 · semantic 질문이 표에서 나온 질문을 밀어내지 않는다 (표 계층이 남는다)',
    withQuestion.report.candidates.some((candidate) =>
      candidate.questions.some((question) => question.register !== 'semantic'),
    ),
    withQuestion.report.candidates.map((candidate) =>
      candidate.questions.map((question) => question.register),
    ),
  );

  /* ── SEM-15 — 원문 복붙 금지 ───────────────────────────────────────── */
  const withRawCopy = await run({
    ...SEM_B,
    narratives: [
      {
        insightId,
        headline: '연락 리듬',
        interpretation: '답이 늦어진 날과 먼저 묻지 못한 날이 나란히 있어.',
        evidenceRefs: [],
        semantic: {
          soWhat: '달라진 이유를 모르는 상태가 더 크게 걸릴 수 있어.',
          whyItMatters: '이유를 모르면 기다리는 시간이 불편으로 남아.',
          /* 사용자가 적은 문장을 거의 그대로 질문으로 되돌려 놓은 것 */
          verification: '연락이 갑자기 줄었을 때 마음이 식은 줄 알았어?',
          usedEventIds: [],
        },
      },
    ],
  });
  const rawCopied = withRawCopy.report.candidates.flatMap((candidate) =>
    candidate.questions.filter((question) =>
      EVENTS_SEM_B.some((event) => question.text.includes(event.description.slice(0, 12))),
    ),
  );
  check('SEM-15 · 장면 원문을 그대로 옮긴 질문이 0개다', rawCopied.length === 0, rawCopied);

  /* 질문 형식 검사 — 서술문은 질문 칸에 오지 않는다 */
  const statement = await run({
    ...SEM_B,
    narratives: [
      {
        insightId,
        headline: '연락 리듬',
        interpretation: '답이 늦어진 날과 먼저 묻지 못한 날이 나란히 있어.',
        evidenceRefs: [],
        semantic: {
          soWhat: '달라진 이유를 모르는 상태가 더 크게 걸릴 수 있어.',
          whyItMatters: '이유를 모르면 기다리는 시간이 불편으로 남아.',
          verification: '이 부분을 한번 확인해보면 좋겠어.',
          usedEventIds: [],
        },
      },
    ],
  });
  check(
    'SEM-15 · 물음표 없는 서술문은 질문이 되지 않는다',
    statement.report.candidates.every((candidate) =>
      candidate.questions.every((question) => question.text.trim().endsWith('?')),
    ),
    statement.report.candidates.flatMap((candidate) =>
      candidate.questions.map((question) => question.text),
    ),
  );
  check(
    'SEM-15 · 그래도 그 문장은 VERIFY 한 줄로 남는다 (정보를 버리지 않는다)',
    statement.report.candidates.some((candidate) => candidate.verification),
    statement.report.candidates.map((candidate) => candidate.verification),
  );

  /* 주어가 상대인 질문은 만들지 않는다(§26 · §29) */
  const thirdPerson = await run({
    ...SEM_B,
    narratives: [
      {
        insightId,
        headline: '연락 리듬',
        interpretation: '답이 늦어진 날과 먼저 묻지 못한 날이 나란히 있어.',
        evidenceRefs: [],
        semantic: {
          soWhat: '달라진 이유를 모르는 상태가 더 크게 걸릴 수 있어.',
          whyItMatters: '이유를 모르면 기다리는 시간이 불편으로 남아.',
          verification: '상대는 왜 답이 늦어졌을까?',
          usedEventIds: [],
        },
      },
    ],
  });
  check(
    'SEM-15 · 주어가 상대인 질문은 만들어지지 않는다',
    thirdPerson.report.candidates.every((candidate) =>
      candidate.questions.every((question) => !/상대(는|가|의)/.test(question.text)),
    ),
    thirdPerson.report.candidates.flatMap((candidate) =>
      candidate.questions.map((question) => question.text),
    ),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-BUDGET — Provider 예산 (§42)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-BUDGET · Provider 호출 수와 토큰 예산');
{
  const lensReady = (body) => ({
    ...body,
    mbti: 'INFP',
    birthProfile: { date: '1996-04-12', time: '10:30', calendarType: 'solar' },
    target: {
      ...body.target,
      mbti: 'ENFP',
      birthProfile: { date: '1995-08-20', time: null, calendarType: 'solar' },
    },
  });

  const none = await run(lensReady(SEM_A));
  const rich = await run(lensReady(SEM_B));
  const stress = await run(
    lensReady({ ...SEM_B, target: { ...SEM_B.target, events: stressEvents(20) } }),
  );

  for (const [name, flow] of [['사건 0', none], ['사건 2', rich], ['사건 20', stress]]) {
    check(`SEM-BUDGET · ${name} — 전체 Provider 호출이 5회다`, flow.ai.totalCalls === 5, {
      total: flow.ai.totalCalls,
      calls: flow.ai.calls.map((call) => [call.task, call.count]),
    });
  }
  check(
    'SEM-BUDGET · 사건 20건에서도 Deep Report 장면이 4건 이하다',
    stress.events.sentToDeepReport <= 4,
    stress.events.sentToDeepReport,
  );
  const charsOf = (flow) =>
    flow.ai.calls.reduce((total, call) => total + (call.count ? call.inputChars : 0), 0);
  const growth = charsOf(stress) / charsOf(none);
  check(
    `SEM-BUDGET · 사건 0 → 20에서 전체 컨텍스트 증가가 1.5배 미만이다 (실측 ${growth.toFixed(2)}배)`,
    growth < 1.5,
    { none: charsOf(none), stress: charsOf(stress) },
  );

  /* 실측값을 그대로 보고한다 — §42가 요구한 표의 원천이다 */
  console.log('\n  ── §42 예산 실측 ──');
  for (const [name, flow] of [['사건 0', none], ['사건 2', rich], ['사건 20', stress]]) {
    for (const call of flow.ai.calls.filter((item) => item.count > 0)) {
      console.log(
        `  ${name.padEnd(7)} ${call.task.padEnd(18)} chars=${String(call.inputChars).padStart(6)}` +
          ` estTokens=${String(call.estTokens).padStart(5)} scenes=${call.eventCount}` +
          ` sceneChars=${call.eventChars}`,
      );
    }
    console.log(`  ${name.padEnd(7)} TOTAL CALLS = ${flow.ai.totalCalls}`);
  }
}

report('Semantic Event Personalization Fixture');
