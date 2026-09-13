/**
 * Semantic Event Personalization Fixture — SEM-01 ~ SEM-15 · SEM-DEC (v1.46.4)
 *
 * ══ 이 스크립트가 고정하는 두 문장 ═════════════════════════════════════════
 *
 * > **Event의 개수는 개인화가 아니다. Event의 의미가 결과를 바꿀 때 개인화다.**
 * > **AI는 무엇을 볼지 고르지 않는다. 제품이 Top 3를 고르고, AI는 그 의미를 좁힌다.**
 *
 * 두 번째 문장이 SEMANTIC DECOMPOSITION에서 추가됐다. 직전 구조에서는 semantic이
 * insightId에 붙었고, 모델이 11개 Insight 중 어디에 쓸지 골랐다. A0 감사에서 그 문장이
 * 첫 화면 Top 3에 거의 오르지 않는 것이 확인됐다(R1~R5 전부) — 장면을 받은 Insight의
 * Chapter는 dedup에서 접혔고, #2·#3 카드를 정하는 Insight에는 모델이 쓰지 않았다.
 * SEM-DEC 블록이 새 계약(candidateId 1:1 · 순서 불변 · 카드 번들)을 값으로 고정한다.
 *
 * ══ 두 계층을 각자의 라우트로 검사한다 ═════════════════════════════════════
 *
 * ```
 * /api/dev/premium-test   Candidate 계층 — 화면이 실제로 그리는 값
 * /api/ai/contract-test   파서·게이트 계층 — 제품과 같은 parse/gate 함수를 그대로 통과시킨다
 * ```
 *
 * ⚠️ **판정 로직을 여기서 복제하지 않는다.** 두 라우트 모두 제품과 같은 함수를 부르고,
 * 이 스크립트는 fixture 조립과 검증만 한다.
 *
 * ⚠️ 이 스크립트는 **Provider를 부르지 않는다.** AI 성공 상태는 `candidateSemantics`를
 * 직접 넘겨 시뮬레이션한다. 실제 Provider 품질은 `run-semantic-provider-qa.mjs`의 기록을
 * 사람이 읽고 판정한다.
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

console.log('\nSemantic Event Personalization Fixture — v1.46.4 · SEMANTIC DECOMPOSITION\n');

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

/** `?withAiContext=1` — 제품과 같은 요청 본문(aiRequest)을 받는다. **본문을 출력하지 않는다** */
async function withRequest(body) {
  const response = await fetch(`${BASE_URL}/api/dev/premium-test?withAiContext=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} — dev 서버 확인`);
  return response.json();
}

const CARD_ID = 'cand-1';
const CARD_REF = { source: 'declared', field: 'contact' };

/**
 * 계약 검사용 최소 응답 한 벌 — 아래쪽 연결 narrative 하나 + 카드 semantic 하나.
 *
 * ⚠️ `headline`/`interpretation`은 카드 semantic과 **독립인** 기존 계약이다. 새 구조에서는
 * narrative가 떨어져도 카드 문장이 함께 사라지지 않는다(SEM-03이 값으로 본다).
 */
function rawWith(semantic, overrides = {}) {
  return {
    narratives: [
      {
        insightId: 'ins-1',
        headline: '연락 리듬이 달라지는 순간에 반응이 커질 수 있어',
        interpretation:
          '답이 늦어진 날과 먼저 묻지 못한 날이 나란히 있어서, 기다리는 시간 자체가 부담이 되는 모양일 수 있어. 왜 그랬는지는 이 자료만으로 알 수 없어.',
        evidenceRefs: [CARD_REF],
        ...overrides,
      },
    ],
    ...(semantic
      ? {
          candidateSemantics: [
            {
              candidateId: CARD_ID,
              operator: 'UNRESOLVED_CORE',
              connection: '말한 기준과 지금 관계에서 답한 것을 나란히 봤다',
              narrowedCondition: null,
              usedEvidenceRefs: [CARD_REF],
              ...semantic,
            },
          ],
        }
      : {}),
  };
}

/**
 * ⚠️ **`ruleSummary`를 넣지 않는다.** 넣으면 Quality Gate (F)가 narrative를 버린다 — 이
 * 파일이 검사하는 것은 카드 semantic 계층이다. (F) 자체는 `run-ai-contract.mjs`가 고정한다.
 */
const ALLOWED_INSIGHT = [{ id: 'ins-1', evidenceRefs: [CARD_REF] }];

/** 카드 허용집합 — 핸들러가 받는 `CandidateSemanticAllowance[]`와 같은 모양 */
const ALL_OPERATORS = [
  'CONDITION_NARROWING',
  'DECLARED_VS_REACTION',
  'CURRENT_VS_PAST',
  'CONTEXT_DEPENDENT',
  'SELF_VS_TARGET',
  'UNRESOLVED_CORE',
];

function cardWith({
  eventIds = [],
  sceneTexts = [],
  evidenceRefs = [CARD_REF],
  eligibleOperators = ALL_OPERATORS,
  knownSelfStatement = null,
} = {}) {
  return [{ candidateId: CARD_ID, evidenceRefs, eventIds, sceneTexts, eligibleOperators, knownSelfStatement }];
}

/** A1 — AI 호출 전에 확정한 Top 3의 첫 카드 id */
const topId = (result, index = 0) => result.semanticTopCandidateIds[index] ?? null;

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-01 — 같은 판정 + 다른 Event 본문 → 다른 Provider context
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('SEM-01 · 같은 판정인데 사건 본문이 다르면 Provider context가 다르다');
{
  const [a, b, c, d] = await Promise.all([run(SEM_A), run(SEM_B), run(SEM_C), run(SEM_D)]);

  const states = [a, b, c, d].map((r) => JSON.stringify(r.mirrorStates));
  check('네 fixture의 Mirror 판정이 완전히 같다 (§2-2 — 사건은 판정을 바꾸지 않는다)',
    new Set(states).size === 1, states);
  const scores = [a, b, c, d].map((r) => r.compatibility?.score ?? null);
  check('네 fixture의 동기화율 점수가 같다', new Set(scores).size === 1, scores);

  const deepCall = (r) => r.ai.calls.find((call) => call.task === 'deep-report');
  const digests = [b, c, d].map((r) => deepCall(r).eventDigest);
  check('SEM-01 · B·C·D의 Deep Report 장면 지문이 서로 다르다', new Set(digests).size === 3, digests);
  check('SEM-01 · 사건 없는 A는 장면을 싣지 않는다', deepCall(a).eventCount === 0, deepCall(a).eventCount);
  check(
    'SEM-01 · B·C·D는 장면을 실제로 싣는다',
    [b, c, d].every((r) => deepCall(r).eventCount > 0),
    [b, c, d].map((r) => deepCall(r).eventCount),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-02 · SEM-03 — usedEventIds · usedEvidenceRefs 부분집합 (§9)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-02 · SEM-03 — 부분집합 검증 (파서·게이트 계층)');
{
  const SEMANTIC_OK = {
    soWhat: '연락 횟수보다, 달라진 이유를 모르는 상태에 더 크게 반응할 수 있어.',
    whyItMatters: '답이 늦어지는 날마다 이유를 찾게 되면, 기다리는 시간이 그대로 불편으로 남아.',
    verification: '답이 늦어지는 날에는 한마디라도 알려주는 게 너한테도 괜찮아?',
    usedEventIds: ['ev-sb1'],
  };
  const SCENES = cardWith({
    eventIds: ['ev-sb1', 'ev-sb2'],
    sceneTexts: [EVENTS_SEM_B[0].description, EVENTS_SEM_B[0].myReaction],
  });

  const ok = await contract({ raw: rawWith(SEMANTIC_OK), allowed: ALLOWED_INSIGHT, candidates: SCENES });
  check('허용집합 안의 장면·근거만 인용한 카드 문장은 통과한다', ok.semantic.kept === 1, ok.semantic);
  check(
    '통과한 카드 문장의 usedEventIds가 그대로 남는다',
    JSON.stringify(ok.semantic.items[0]?.usedEventIds) === JSON.stringify(['ev-sb1']),
    ok.semantic.items,
  );

  const foreign = await contract({
    raw: rawWith({ ...SEMANTIC_OK, usedEventIds: ['ev-sb1', 'ev-XXXX'] }),
    allowed: ALLOWED_INSIGHT,
    candidates: SCENES,
  });
  check(
    'SEM-02 · 허용집합 밖 장면 id를 들고 오면 카드 문장이 버려진다',
    foreign.semantic.kept === 0 && foreign.semantic.rejected === 1,
    foreign.semantic,
  );
  check(
    'SEM-02 · 위반 라벨이 남는다 (무엇이 막혔는지 관측 가능하다)',
    foreign.semantic.violations.includes('semantic_event_id_outside_allowed'),
    foreign.semantic.violations,
  );
  check('SEM-02 · 그래도 아래쪽 narrative(headline·interpretation)는 살아 있다', foreign.narratives.length === 1, foreign.narratives);

  const noScenes = await contract({ raw: rawWith(SEMANTIC_OK), allowed: ALLOWED_INSIGHT, candidates: cardWith() });
  check(
    'SEM-02 · 장면을 보내지 않은 카드의 장면 인용은 거부된다 (기본값이 안전한 쪽)',
    noScenes.semantic.kept === 0,
    noScenes.semantic,
  );
  const noCards = await contract({ raw: rawWith(SEMANTIC_OK), allowed: ALLOWED_INSIGHT });
  check('SEM-02 · 카드를 보내지 않은 호출의 카드 문장은 전부 거부된다', noCards.semantic.kept === 0, noCards.semantic);

  const badRef = await contract({
    raw: rawWith({ ...SEMANTIC_OK, usedEvidenceRefs: [{ source: 'observed', traitId: 'made-up-trait' }] }),
    allowed: ALLOWED_INSIGHT,
    candidates: SCENES,
  });
  check(
    'SEM-03 · 카드 허용집합 밖 evidenceRef를 들고 오면 카드 문장이 버려진다',
    badRef.semantic.kept === 0 && badRef.semantic.violations.includes('semantic_evidence_ref_outside_allowed'),
    badRef.semantic,
  );
  const badNarrativeRef = await contract({
    raw: rawWith(SEMANTIC_OK, { evidenceRefs: [{ source: 'observed', traitId: 'made-up-trait' }] }),
    allowed: ALLOWED_INSIGHT,
    candidates: SCENES,
  });
  check(
    'SEM-03 · narrative가 (E)에서 떨어져도 카드 문장은 독립이다 (첫 화면이 함께 비지 않는다)',
    badNarrativeRef.narratives.length === 0 && badNarrativeRef.semantic.kept === 1,
    { narratives: badNarrativeRef.narratives.length, semantic: badNarrativeRef.semantic },
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
    /eventSignature\?: readonly string\[\]/.test(fingerprintSrc) && /\.\.\.eventSignature/.test(fingerprintSrc),
  );
  check(
    'SEM-04 · 카드 배분 서명도 받는다 (사건 추가로 Top 3·장면 배분이 바뀌는 경우)',
    /selectionSignature\?: readonly string\[\]/.test(fingerprintSrc) && /\.\.\.selectionSignature/.test(fingerprintSrc),
  );
  check(
    'SEM-04 · 서명이 길이가 아니라 본문 해시를 쓴다 (같은 길이 수정도 감지한다)',
    /textHash\(event\.description\)/.test(semanticSrc) && /textHash\(event\.myReaction\)/.test(semanticSrc),
  );
  check(
    'SEM-04 · 서명 문자열에 원문이 남지 않는다 (해시만)',
    !/\$\{event\.description\}/.test(semanticSrc) && !/\$\{event\.myReaction\}/.test(semanticSrc),
  );
  check(
    'SEM-04 · 훅이 두 서명을 지문에 넘기고, 선택 서명이 카드 id를 담는다',
    /eventSignature,/.test(hookSrc) &&
      /selectionSignature,/.test(hookSrc) &&
      /`top:\$\{candidate\.id\}`/.test(hookSrc) &&
      /allocateCandidateScenes\(\{ candidates: topCandidates, events \}\)/.test(hookSrc),
  );

  const edited = {
    ...SEM_B,
    target: {
      ...SEM_B.target,
      events: [{ ...EVENTS_SEM_B[0], description: '연락이 갑자기 줄었을 때 그냥 바쁜 줄 알았어' }, EVENTS_SEM_B[1]],
    },
  };
  const [before, after] = await Promise.all([run(SEM_B), run(edited)]);
  const digest = (r) => r.ai.calls.find((call) => call.task === 'deep-report').eventDigest;
  check('SEM-04 · 본문을 같은 길이로 고쳐도 payload 지문이 달라진다', digest(before) !== digest(after), {
    before: digest(before),
    after: digest(after),
  });

  const deleted = { ...SEM_B, target: { ...SEM_B.target, events: [EVENTS_SEM_B[1]] } };
  const afterDelete = await run(deleted);
  const sentIds = afterDelete.ai.calls.flatMap((call) => call.eventIds ?? []);
  check('SEM-05 · 삭제한 장면이 Provider payload에 없다', !sentIds.includes('ev-sb1'), sentIds);
  const citedIds = afterDelete.report.candidates.flatMap((candidate) => candidate.relevantEventIds);
  check('SEM-05 · 삭제한 장면이 근거 토글 목록에도 없다', !citedIds.includes('ev-sb1'), citedIds);

  const stale = await run({
    ...deleted,
    candidateSemantics: [
      {
        candidateId: topId(afterDelete),
        operator: 'UNRESOLVED_CORE', connection: 'fixture', narrowedCondition: null,
        soWhat: '삭제된 장면을 근거로 삼은 문장',
        whyItMatters: '이 문장은 화면에 나오면 안 된다',
        usedEvidenceRefs: [],
        usedEventIds: ['ev-sb1'],
      },
    ],
  });
  check(
    'SEM-05 · 삭제된 장면을 인용한 카드 문장은 화면에 쓰이지 않는다',
    stale.report.candidates.every((candidate) => candidate.soWhatSource !== 'semantic_ai'),
    stale.report.candidates.map((candidate) => [candidate.id, candidate.soWhatSource]),
  );
  check(
    'SEM-05 · semantic 의존성에도 남지 않는다',
    !stale.report.candidates.flatMap((candidate) => candidate.semanticEventIds).includes('ev-sb1'),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-06 — Event raw text가 Analytics로 나가지 않는다 (§29)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-06 · 자유 입력이 Analytics·로그로 나가지 않는다');
{
  const analytics = stripComments(await readFile(join(ROOT, 'src/lib/analytics.ts'), 'utf8'));
  const gateSrc = stripComments(await readFile(join(ROOT, 'src/services/ai/candidateSemanticGate.ts'), 'utf8'));
  const handlers = stripComments(await readFile(join(ROOT, 'src/services/ai/handlers.ts'), 'utf8'));
  const devRoute = stripComments(await readFile(join(ROOT, 'src/app/api/dev/premium-test/route.ts'), 'utf8'));

  check('SEM-06 · analytics.ts에 사건 본문 필드가 없다', !/description|myReaction/.test(analytics));
  check(
    'SEM-06 · 카드 게이트가 위반 라벨만 남긴다 (문장 원문 금지)',
    /violations\.push\(\.\.\.scan\.violations\)/.test(gateSrc) &&
      !/violations\.push\([^)]*(soWhat|whyItMatters|verification)/.test(gateSrc),
  );
  check(
    'SEM-06 · 핸들러 로그가 카드 문장 대신 개수만 남긴다',
    /semanticKept: semanticGate\.kept\.length/.test(handlers) && !/logAiFilter\([\s\S]{0,900}soWhat/.test(handlers),
  );
  check('SEM-06 · dev 라우트가 장면 본문 대신 해시를 낸다', /eventDigest: digestOf\(/.test(devRoute));

  const body = await run(SEM_B);
  const RAW = [...EVENTS_SEM_B.map((event) => event.description), ...EVENTS_SEM_B.map((event) => event.myReaction)].filter(Boolean);
  const leakedIn = (value) => RAW.filter((text) => JSON.stringify(value).includes(text));

  check('SEM-06 · ai 예산 블록에 본문이 없다 (해시·길이만)', leakedIn(body.ai).length === 0, leakedIn(body.ai));
  check('SEM-06 · events 계측 블록에 본문이 없다', leakedIn(body.events).length === 0, leakedIn(body.events));
  check('SEM-06 · 기본 응답에 aiRequest·aiContext가 없다 (명시 요청할 때만)', !('aiRequest' in body) && !('aiContext' in body));
  check(
    'SEM-06 · 첫 화면 결론 문장에 본문이 글자 그대로 들어가지 않는다',
    leakedIn(body.report.candidates).length === 0,
    leakedIn(body.report.candidates),
  );
  check('SEM-06 · 근거 블록에는 원문이 그대로 있다 (§36 — 요약하지 않는다)', leakedIn(body.report.reportedScenes).length > 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-07 — 첫 화면 메타 언어 0 (§12 · §35 · §37)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-07 · 첫 화면에 분석 메타 언어가 0개다');
{
  const META = ['동기화율', '자료 2종', '자료 3종', '자료 4종', '자료 5종', '같은 자리를 가리', '같은 축을 가리', '판정', 'MATCH', 'GAP', 'CHANGE', 'evidence', 'candidate', '분석 결과상'];

  const visible = (result) =>
    result.report.candidates.slice(0, 3).flatMap((candidate) => [
      candidate.headline,
      candidate.soWhat,
      candidate.whyItMatters,
      candidate.verification ?? '',
      ...candidate.questions.map((question) => question.text),
    ]);

  for (const [name, result] of [['A(사건 0)', await run(SEM_A)], ['B', await run(SEM_B)], ['C', await run(SEM_C)], ['D', await run(SEM_D)]]) {
    const hits = findForbidden(visible(result), META);
    check(`SEM-07 · ${name} 첫 viewport 메타 언어 0건`, hits.length === 0, hits);
    const axisHits = visible(result).filter((text) => /(^|[^가-힣])축(?![하적구소제])/.test(text));
    check(`SEM-07 · ${name} 첫 viewport에 '축' 낱말 0건`, axisHits.length === 0, axisHits);
  }

  const free = await run(SEM_B);
  const freeTexts = free.free.candidates.flatMap((candidate) => [candidate.soWhat, candidate.whyItMatters]);
  check('SEM-07 · FREE 핵심 본문 메타 언어 0건', findForbidden(freeTexts, META).length === 0, freeTexts);
  const execTexts = (free.report.executive?.rows ?? []).flatMap((row) => [row.label, row.text, row.watch, row.soWhat].filter(Boolean));
  check('SEM-07 · Executive 3줄 메타 언어 0건', findForbidden(execTexts, META).length === 0, execTexts);

  /* ═════════════════════════════════════════════════════════════════════════
     META-01 ~ 05 — v1.46.4 Premium Meta Copy Minimal Cleanup

     첫 화면(헤더 · Candidate 카드 · 접힌 Chapter 헤더)과 펼친 Chapter에서 **항상 보이는**
     결정론 문장을 본다. AI 문장(headline/SO WHAT/WHY/VERIFY의 semantic)은 이 fixture가
     AI 없이 돌기 때문에 여기 들어오지 않는다.

     ⚠️ 알려진 예외(이번 범위 밖): 근거 토글 안의 `deterministicSummary`(= Insight
     `ruleSummary`)와 과거 기록 근거 문장(`{날짜} 기록에서도 {축} 축에 …`)은 AI 입력
     (`allowedConnection` · 근거 facts)과 중복 게이트의 기준 문장이라 이번 copy-only
     범위에서 바꾸지 않았다. 그래서 아래 스캔 대상에서 명시적으로 뺐다.
     ═════════════════════════════════════════════════════════════════════════ */
  const META_COUNT = /자료\s*\d+\s*종|근거\s*\d+\s*(종|개)|\d+\s*가지가/;
  const META_AXIS = /(^|[^가-힣])축(?![하적구소제])/;
  const USER_SOURCE_LABELS = new Set([
    '네가 말한 기준', '사진에서 보인 것', '예전 관계 경험', '지금 관계에서의 답변', '그때 관계에서의 답변',
    '상대에 대해 적은 내용', '상대와 비교한 답', '예전 기록', '성향 렌즈', '추가 질문에 답한 것',
    '기억나는 장면', '심화 질문에 답한 것',
  ]);
  const alwaysVisible = (result) => [
    result.headerLine ?? '',
    result.report.overviewSubcopy ?? '',
    ...result.chapters.flatMap((chapter) => [
      chapter.title,
      chapter.sourceLine ?? '',
      chapter.deterministicTakeaway,
      chapter.limitation,
      chapter.lovyCheckpoint ?? '',
      chapter.lovyConnectionReason ?? '',
      chapter.soWhat?.soWhat ?? '',
      chapter.soWhat?.whyItMatters ?? '',
    ]),
    ...result.report.candidates.flatMap((candidate) => [
      candidate.headline,
      candidate.soWhat,
      candidate.whyItMatters ?? '',
      candidate.evidenceNote ?? '',
      candidate.limitation ?? '',
      ...candidate.questions.flatMap((question) => [question.text, question.basis ?? '']),
    ]),
  ].filter(Boolean);

  const ONE_RECORD = { ...SEM_B, entries: SEM_B.entries.slice(0, 1) };
  const ENDED = { ...SEM_B, status: 'ended', target: { ...SEM_B.target, relation: 'ex' } };
  const metaRuns = [['A', await run(SEM_A)], ['B', await run(SEM_B)], ['ended', await run(ENDED)], ['기록 1건', await run(ONE_RECORD)], ['sparse', await run(FIXTURE_SPARSE)]];

  const pageSource = stripComments(await readFile(join(ROOT, 'src/app/premium/page.tsx'), 'utf8'));
  const accordionSource = stripComments(await readFile(join(ROOT, 'src/components/premium/PremiumChapterAccordion.tsx'), 'utf8'));
  check("META-01 · 리포트 헤더 코드에 '이은 자료' 0", !/이은\s*자료/.test(pageSource));
  check("META-02 · Chapter 헤더 코드에 '자료 N종' 0", !/자료\s*\{/.test(accordionSource) && !/자료\s*\$\{/.test(pageSource));

  for (const [name, result] of metaRuns) {
    const texts = alwaysVisible(result);
    check(`META-01 · ${name} 헤더 문장에 '자료' 0`, !/자료/.test(result.headerLine ?? ''), result.headerLine);
    const countHits = texts.filter((text) => META_COUNT.test(text));
    check(`META-02 · ${name} '자료 N종' · '근거 N종' · 'N가지가' 0`, countHits.length === 0, countHits);
    const axisHits = texts.filter((text) => META_AXIS.test(text));
    check(`META-03 · ${name} 사용자-facing '축' 0`, axisHits.length === 0, axisHits);
    const sameAxis = texts.filter((text) => /같은\s*(축|자리)를\s*가리/.test(text));
    check(`META-03 · ${name} '같은 축/자리를 가리킨다' 0`, sameAxis.length === 0, sameAxis);

    const labels = [
      ...result.chapters.flatMap((chapter) => (chapter.sourceLine ? chapter.sourceLine.split(' · ') : [])),
      ...result.report.candidates.flatMap((candidate) => (candidate.evidenceNote ? candidate.evidenceNote.split(' · ') : [])),
    ];
    const foreign = labels.filter((label) => !USER_SOURCE_LABELS.has(label));
    check(`META-05 · ${name} Evidence source label은 사용자 언어`, foreign.length === 0, foreign);
    const internal = texts.filter((text) => /EvidenceRef|SourceFamily|Operator|sourceGroup/i.test(text));
    check(`META-05 · ${name} 내부 용어 노출 0`, internal.length === 0, internal);

    /* 헤더는 실제 source만 부른다 */
    const groups = new Set(result.chapters.flatMap((chapter) => chapter.sourceGroups));
    const header = result.headerLine ?? '';
    const falseMention = [
      header.includes('예전 기록') && !groups.has('history'),
      header.includes('기억나는 장면') && !(result.report.reportedScenes?.scenes?.length > 0),
      header.includes('상대에 대해 적은 내용') && !groups.has('target') && !groups.has('compatibility'),
    ].some(Boolean);
    check(`META-05 · ${name} 헤더가 없는 source를 부르지 않는다`, !falseMention, { header, groups: [...groups] });
    if (name === 'ended') {
      check('META-05 · ended 헤더·라벨에 지금 관계 0', !texts.some((text) => text.includes('지금 관계에서의 답변')), result.headerLine);
    }
  }

  {
    const oneRecord = metaRuns.find(([name]) => name === '기록 1건')[1];
    const recordTexts = alwaysVisible(oneRecord).filter((text) => /기록|과거/.test(text));
    const generalized = recordTexts.filter((text) => /반복돼|반복됐|반복해서|계속 그래|늘 그래|원래 그래|항상 그래|패턴이 반복/.test(text));
    check("META-04 · 과거 기록 1건에서 '반복/항상/원래/계속' 일반화 0", generalized.length === 0, generalized);
  }

  const metaSemantic = await contract({
    raw: rawWith({
      soWhat: '동기화율에서 갈린 축이야. 자료 3종이 같은 자리를 가리켜.',
      whyItMatters: '판정이 GAP으로 나온 자리라서 확인이 필요해.',
      usedEventIds: [],
    }),
    allowed: ALLOWED_INSIGHT,
    candidates: cardWith(),
  });
  check('SEM-07 · 메타 언어가 든 카드 문장은 게이트가 버린다', metaSemantic.semantic.kept === 0, metaSemantic.semantic);
  check(
    'SEM-07 · 위반 라벨이 어느 어휘인지 말해준다',
    metaSemantic.semantic.violations.some((label) => label.startsWith('meta_')),
    metaSemantic.semantic.violations,
  );

  const benign = await contract({
    raw: rawWith({
      soWhat: '서로 축하할 일이 생겼을 때 표현하는 방식이 다를 수 있어.',
      whyItMatters: '기쁜 일을 나누는 방식이 다르면 반응이 작게 느껴질 수 있어.',
      usedEventIds: [],
    }),
    allowed: ALLOWED_INSIGHT,
    candidates: cardWith(),
  });
  check("SEM-07 · '축하' 같은 정상 어휘는 막히지 않는다 (과필터 아님)", benign.semantic.kept === 1, benign.semantic);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-08 · SEM-09 — fallback 사용률 (§19)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-08 · SEM-09 — fallback 사용률 계측');
{
  const high = await run(SEM_B);
  const sources = high.report.candidates.map((candidate) => candidate.soWhatSource);
  check('SEM-08 · high-data에서 static_fallback이 0이다', !sources.includes('static_fallback'), sources);
  check('SEM-08 · AI가 없으면 전부 deterministic_composed다', sources.every((source) => source === 'deterministic_composed'), sources);

  const withAi = await run({
    ...SEM_B,
    candidateSemantics: [
      {
        candidateId: topId(high),
        operator: 'UNRESOLVED_CORE', connection: 'fixture', narrowedCondition: null,
        soWhat: '연락 횟수보다, 달라진 이유를 모르는 상태에 더 크게 반응할 수 있어.',
        whyItMatters: '이유를 모르면 기다리는 시간이 그대로 불편으로 남아.',
        verification: '답이 늦어지는 날에는 한마디라도 알려주는 게 너한테도 괜찮아?',
        usedEvidenceRefs: [],
        usedEventIds: [],
      },
    ],
  });
  check(
    'SEM-08 · 카드 문장이 오면 첫 화면이 그 문장을 쓴다 (candidateId로 직접 배선돼 있다)',
    withAi.report.candidates[0]?.soWhatSource === 'semantic_ai' &&
      withAi.report.candidates[0]?.insightOperator === 'UNRESOLVED_CORE',
    withAi.report.candidates.map((candidate) => [candidate.id, candidate.soWhatSource]),
  );

  const failed = await run({ ...SEM_B, candidateSemantics: [] });
  const failedSources = failed.report.candidates.map((candidate) => candidate.soWhatSource);
  check('SEM-09 · Provider 실패에서 semantic_ai가 0이다', !failedSources.includes('semantic_ai'), failedSources);
  check(
    'SEM-09 · 그래도 모든 카드에 결론 문장이 있다 (AI가 죽어도 결론이 남는다)',
    failed.report.candidates.every((candidate) => candidate.soWhat.length > 0),
  );
  check(
    'SEM-09 · 첫 화면 카드 수가 AI 유무에 따라 달라지지 않는다',
    failed.report.candidates.length === high.report.candidates.length,
    { failed: failed.report.candidates.length, high: high.report.candidates.length },
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-10 — ended에서 outward 0 (§41 · A11)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-10 · 끝난 관계에서 현재형 행동 제안이 0이다');
{
  const endedBody = { ...SEM_B, status: 'ended', target: { ...SEM_B.target, relation: 'ex' } };
  const ended = await run(endedBody);
  const texts = ended.report.candidates.flatMap((candidate) => [
    candidate.headline,
    candidate.soWhat,
    candidate.whyItMatters,
    candidate.verification ?? '',
    ...candidate.questions.map((question) => question.text),
  ]);
  const OUTWARD = ['다가가', '연락해봐', '먼저 연락', '다음 만남', '재회', '물어봐', '제안해봐'];
  check('SEM-10 · ended 첫 화면 outward 어휘 0건', findForbidden(texts, OUTWARD).length === 0, texts);
  check('SEM-10 · ended에서 상대에게 보내는 질문이 0개다', ended.report.candidates.every((candidate) => candidate.questions.length === 0));

  const endedWithAi = await run({
    ...endedBody,
    candidateSemantics: [
      {
        candidateId: topId(ended),
        operator: 'UNRESOLVED_CORE', connection: 'fixture', narrowedCondition: null,
        soWhat: '연락 횟수보다, 이유를 모른 채 기다린 시간이 더 크게 남았을 수 있어.',
        whyItMatters: '다음 관계에서 비슷한 침묵이 오면 더 일찍 알아차릴 수 있는 신호야.',
        verification: '그때 가장 힘들었던 건 연락이 줄어든 것 자체였을까, 이유를 모른 채 기다린 시간이었을까?',
        usedEvidenceRefs: [],
        usedEventIds: [],
      },
    ],
  });
  check(
    'SEM-10 · ended에서 회고 VERIFY가 카드에 남아도 상대에게 보내는 질문은 여전히 0개다',
    endedWithAi.report.candidates[0]?.soWhatSource === 'semantic_ai' &&
      endedWithAi.report.candidates.every((candidate) => candidate.questions.length === 0),
    endedWithAi.report.candidates.map((candidate) => [candidate.soWhatSource, candidate.questions.length]),
  );

  const outwardSemantic = await contract({
    tense: 'former',
    raw: rawWith({
      soWhat: '다음에 연락해보면 그때 무엇이 걸렸는지 알 수 있어.',
      whyItMatters: '먼저 다가가 보면 기준이 분명해질 수 있어.',
      usedEventIds: [],
    }),
    allowed: ALLOWED_INSIGHT,
    candidates: cardWith(),
  });
  check('SEM-10 · former에서 outward 카드 문장을 게이트가 버린다', outwardSemantic.semantic.kept === 0, outwardSemantic.semantic);

  const retrospective = await contract({
    tense: 'former',
    raw: rawWith({
      soWhat: '연락 횟수보다, 이유를 모른 채 기다린 시간이 더 크게 남았을 수 있어.',
      whyItMatters: '다음 관계에서 같은 장면이 오면 더 일찍 알아차릴 수 있는 신호야.',
      verification: '다음 관계에서 비슷한 침묵이 오면, 어느 순간부터 불편해지는지 알아차릴 수 있을까?',
      usedEventIds: [],
    }),
    allowed: ALLOWED_INSIGHT,
    candidates: cardWith(),
  });
  check(
    'SEM-10 · 회고 문장과 회고 질문은 통과한다 (과필터 아님)',
    retrospective.semantic.kept === 1 && retrospective.semantic.items[0]?.hasVerification === true,
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
  check('SEM-11 · 글자 그대로 같은 문장이 없다', premiumSoWhat.every((text) => !freeSoWhat.includes(text)), { free: freeSoWhat, premium: premiumSoWhat });
  check('SEM-11 · Premium 카드 중 최소 하나가 무료 밖 근거를 쓴다', result.report.candidates.some((candidate) => candidate.hasOutsideFreeEvidence));
  check('SEM-11 · 무료 Candidate는 무료 밖 근거를 쓰지 않는다', result.free.candidates.every((candidate) => candidate.hasOutsideFreeEvidence === false));
  check('SEM-11 · 무료에는 semantic 계층이 없다 (§21 깊이 가드)', result.free.candidates.every((candidate) => candidate.soWhatSource !== 'semantic_ai'));
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
  check('SEM-12 · sparse에서 Deep Report 장면 전송이 0이다', sparse.events.sentToDeepReport === 0, sparse.events.sentToDeepReport);
  check('SEM-12 · sparse에서 AI에 보낼 Top 3가 0장이다', sparse.semanticTopCandidateIds.length === 0, sparse.semanticTopCandidateIds);

  const madeUp = await contract({
    raw: rawWith({
      soWhat: '너는 관계에서 늘 먼저 다가가는 사람일 수 있어.',
      whyItMatters: '그 성향 때문에 매번 같은 자리에서 지치게 될 거야.',
      usedEventIds: [],
    }),
    allowed: ALLOWED_INSIGHT,
    candidates: cardWith(),
  });
  check('SEM-12 · 진단·예측이 든 카드 문장은 게이트가 버린다', madeUp.semantic.kept === 0, madeUp.semantic);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-13 — 같은 종류 + 다른 본문 → 다른 semantic 경로 (§15 · §17)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-13 · 같은 종류인데 본문이 다르면 다른 경로를 탄다');
{
  const [b, c, d] = await Promise.all([run(SEM_B), run(SEM_C), run(SEM_D)]);
  const types = [b, c, d].map((r) => JSON.stringify(Object.keys(r.events.histogram).sort()));
  check('SEM-13 · 세 fixture의 사건 종류 구성이 같다 (종류 기반 개인화로는 구분되지 않는다)', new Set(types).size === 1, types);
  const deepCall = (r) => r.ai.calls.find((call) => call.task === 'deep-report');
  check(
    'SEM-13 · 그래도 Provider에 나가는 장면 본문이 서로 다르다',
    new Set([b, c, d].map((r) => deepCall(r).eventDigest)).size === 3,
  );
  check(
    'SEM-13 · 세 fixture의 AI 전 Top 3가 같다 (같은 판정 → 같은 카드, 다른 것은 장면 의미뿐)',
    new Set([b, c, d].map((r) => JSON.stringify(r.semanticTopCandidateIds))).size === 1,
    [b, c, d].map((r) => r.semanticTopCandidateIds),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-14 · SEM-15 — 질문이 semantic을 쓴다 / 원문을 노출하지 않는다 (§23 ~ §26 · A12)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-14 · SEM-15 — 추천 질문');
{
  const base = await run(SEM_B);
  const cardId = topId(base);
  check('SEM-14 · AI 전 Top 3의 첫 카드 id가 있다', Boolean(cardId), cardId);

  const withCard = (verification) =>
    run({
      ...SEM_B,
      candidateSemantics: [
        {
          candidateId: cardId,
          operator: 'UNRESOLVED_CORE', connection: 'fixture', narrowedCondition: null,
          soWhat: '달라진 이유를 모르는 상태가 더 크게 걸릴 수 있어.',
          whyItMatters: '이유를 모르면 기다리는 시간이 불편으로 남아.',
          verification,
          usedEvidenceRefs: [],
          usedEventIds: [],
        },
      ],
    });

  const withQuestion = await withCard('평소보다 답이 늦어지는 날에는 한마디 알려주는 게 편해?');
  const first = withQuestion.report.candidates[0];
  check(
    'SEM-14 · A12 — 카드의 첫 질문이 그 카드 semantic의 확인 질문이다 (1:1)',
    first?.questions[0]?.register === 'semantic',
    first?.questions.map((question) => question.register),
  );
  check(
    'SEM-14 · semantic 질문이 표에서 나온 질문을 밀어내지 않는다 (표 계층이 남는다)',
    withQuestion.report.candidates.some((candidate) => candidate.questions.some((question) => question.register !== 'semantic')),
  );
  check(
    'SEM-14 · 다른 카드에는 그 질문이 붙지 않는다 (카드 1:1)',
    withQuestion.report.candidates.slice(1).every((candidate) => candidate.questions.every((question) => question.register !== 'semantic')),
  );

  const withRawCopy = await withCard('연락이 갑자기 줄었을 때 마음이 식은 줄 알았어?');
  const rawCopied = withRawCopy.report.candidates.flatMap((candidate) =>
    candidate.questions.filter((question) => EVENTS_SEM_B.some((event) => question.text.includes(event.description.slice(0, 12)))),
  );
  check('SEM-15 · 장면 원문을 그대로 옮긴 질문이 0개다', rawCopied.length === 0, rawCopied);

  const statement = await withCard('이 부분을 한번 확인해보면 좋겠어.');
  check(
    'SEM-15 · 물음표 없는 서술문은 질문이 되지 않는다',
    statement.report.candidates.every((candidate) => candidate.questions.every((question) => question.text.trim().endsWith('?'))),
  );

  const thirdPerson = await withCard('상대는 왜 답이 늦어졌을까?');
  check(
    'SEM-15 · 주어가 상대인 질문은 만들어지지 않는다',
    thirdPerson.report.candidates.every((candidate) => candidate.questions.every((question) => !/상대(는|가|의)/.test(question.text))),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-DEC — Semantic Task Decomposition (A1 ~ A12)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-DEC · Top 3를 AI 전에 확정하고, AI는 candidateId로 1:1 답한다');
{
  const b = await withRequest(SEM_B);
  const ids = b.semanticTopCandidateIds;

  /* A1 */
  check(
    'SEM-DEC-01 · AI 전 Top 3가 결정론 첫 화면의 앞 3장과 같다',
    ids.length === 3 && JSON.stringify(ids) === JSON.stringify(b.report.candidates.slice(0, 3).map((candidate) => candidate.id)),
    { ids, top: b.report.candidates.slice(0, 3).map((candidate) => candidate.id) },
  );

  /* A7 — 세 카드 전부에 문장을 넣어도 집합·순서가 그대로다 */
  const semanticsFor = (cardIds) =>
    cardIds.map((id, index) => ({
      candidateId: id,
      operator: 'UNRESOLVED_CORE',
      connection: 'fixture',
      narrowedCondition: null,
      soWhat: [
        '연락 횟수보다, 평소와 달라졌는데 이유를 모르는 순간이 더 크게 걸릴 수 있어.',
        '갈등을 푸는 방식보다, 두 시점 중 어느 쪽이 지금 기준인지가 먼저 확인할 자리야.',
        '혼자 있는 시간 자체보다, 그 시간을 미리 말하고 가지는지가 편안함을 가를 수 있어.',
      ][index],
      whyItMatters: [
        '답이 늦어지는 날마다 이유를 찾게 되면, 기다리는 시간이 그대로 불편으로 남아.',
        '예전 방식으로 기대하면, 같은 다툼 뒤에도 서로 다른 속도로 정리하게 돼.',
        '말없이 거리를 두는 날과 미리 알린 날은 같은 하루여도 다르게 지나가.',
      ][index],
      usedEvidenceRefs: [],
      usedEventIds: [],
    }));
  const filled = await run({ ...SEM_B, candidateSemantics: semanticsFor(ids) });
  check(
    'SEM-DEC-02 · AI 문장이 들어와도 Candidate id·순서가 AI 전과 같다 (A7)',
    JSON.stringify(filled.report.candidates.map((candidate) => candidate.id)) ===
      JSON.stringify(b.report.candidates.map((candidate) => candidate.id)),
  );
  check(
    'SEM-DEC-02 · Top 3 세 장 모두 semantic_ai가 된다 (Chapter를 거치지 않는다)',
    filled.report.candidates.slice(0, 3).every((candidate) => candidate.soWhatSource === 'semantic_ai'),
    filled.report.candidates.map((candidate) => candidate.soWhatSource),
  );

  /* A5 — Top 3 밖 · 접힌 Chapter의 id로 온 문장은 쓰지 않는다 */
  const outsideIds = ['cand_ch_closeness_distance', b.report.candidates[3]?.id].filter(Boolean);
  const outside = await run({ ...SEM_B, candidateSemantics: semanticsFor(outsideIds) });
  check(
    'SEM-DEC-03 · Top 3 밖 id(접힌 Chapter · 4번째 카드)의 문장은 어디에도 쓰이지 않는다',
    outside.report.candidates.every((candidate) => candidate.soWhatSource !== 'semantic_ai'),
    outside.report.candidates.map((candidate) => [candidate.id, candidate.soWhatSource]),
  );

  /* A2 · A3 — 요청 본문 구조 */
  const request = b.aiRequest;
  check('SEM-DEC-04 · 요청 본문의 카드가 Top 3와 같은 순서다', JSON.stringify(request.context.candidates.map((card) => card.candidateId)) === JSON.stringify(ids));
  check(
    'SEM-DEC-04 · 장면은 카드에만 실린다 (insights에 relatedScenes 없음)',
    request.context.insights.every((item) => !('relatedScenes' in item)),
  );
  check(
    'SEM-DEC-04 · 사건 의미가 첫 화면 #1 카드에 실린다 (A0 loss point ② 해소)',
    request.context.candidates[0].selectedEvents.length > 0,
    request.context.candidates.map((card) => card.selectedEvents.map((event) => event.eventId)),
  );
  check(
    'SEM-DEC-04 · 장면 필드는 사용자가 적은 상황·반응·종류뿐이다 (A3)',
    request.context.candidates.every((card) =>
      card.selectedEvents.every(
        (event) => JSON.stringify(Object.keys(event).sort()) === JSON.stringify(['eventId', 'myReaction', 'situation', 'source', 'type']),
      ),
    ),
  );
  check(
    'SEM-DEC-04 · 모든 카드에 사실 문장과 아직 모르는 점이 있다',
    request.context.candidates.every((card) => card.evidence.length > 0 && card.unresolvedPoints.length > 0),
    request.context.candidates.map((card) => [card.evidence.length, card.unresolvedPoints.length]),
  );
  check(
    'SEM-DEC-04 · 근거 목록에 장면·렌즈 근거를 넣지 않는다 (장면은 예산 안에서 한 번만 · 렌즈는 핵심 근거 아님)',
    request.context.candidates.every((card) => card.evidence.every((fact) => fact.ref.source !== 'user_reported_event' && fact.family !== 'LENS')),
  );
  check(
    'SEM-DEC-04 · 허용집합이 payload와 같다 (카드 수 · 장면 id)',
    request.candidates.length === request.context.candidates.length &&
      request.candidates.every(
        (allowance, index) =>
          JSON.stringify(allowance.eventIds) ===
          JSON.stringify(request.context.candidates[index].selectedEvents.map((event) => event.eventId)),
      ),
  );
  /*
    Operator Pass §5 — 허용 근거 = 카드 근거 + **같은 축** Insight 근거. 다른 축·렌즈 근거는 없다.
  */
  const refKey = (ref) => JSON.stringify([ref.source, ref.field ?? ref.entryId ?? ref.traitId ?? ref.questionId ?? ref.eventId ?? null, ref.axis ?? null]);
  const cardRefsWithinAxis = request.candidates.every((allowance, index) => {
    const candidate = b.report.candidates[index];
    const sameAxis = new Set(
      b.insights
        .filter((insight) => insight.axis === candidate.axis)
        .flatMap((insight) => insight.evidenceRefs.map((key) => key.split(':')[0])),
    );
    const own = new Set(candidate.evidenceSources);
    return allowance.evidenceRefs.every((ref) => (own.has(ref.source) || sameAxis.has(ref.source)) && ref.source !== 'mbti_lens');
  });
  check('SEM-DEC-04 · 카드 허용 근거가 그 카드 · 같은 축 근거 안에 있다 (다른 축·렌즈 0)', cardRefsWithinAxis);
  check(
    'SEM-DEC-04 · 허용 근거에 같은 ref가 두 번 들어가지 않는다',
    request.candidates.every((allowance) => new Set(allowance.evidenceRefs.map(refKey)).size === allowance.evidenceRefs.length),
  );

  /* A5 · A4 — 파서 계약 */
  const TWO = [...cardWith(), { candidateId: 'cand-2', evidenceRefs: [CARD_REF], eventIds: [], sceneTexts: [], eligibleOperators: ALL_OPERATORS, knownSelfStatement: null }];
  const base = {
    soWhat: '연락이 적은 건 괜찮고, 약속 직전처럼 기다림이 걸린 때 끊기는 게 걸리는 쪽일 수 있어.',
    whyItMatters: '약속한 날에 연락이 멈추면, 기다리는 시간이 그대로 불안으로 남아.',
    usedEvidenceRefs: [CARD_REF],
    usedEventIds: [],
  };
  const parserCase = await contract({
    allowed: ALLOWED_INSIGHT,
    candidates: TWO,
    raw: {
      narratives: [],
      candidateSemantics: [
        { candidateId: CARD_ID, operator: 'INVENTED_OPERATOR', connection: 'fixture', narrowedCondition: null, ...base },
        { candidateId: 'cand-2', operator: 'UNRESOLVED_CORE', connection: 'fixture', narrowedCondition: null, ...base },
        { candidateId: 'cand-2', operator: 'UNRESOLVED_CORE', connection: 'fixture', narrowedCondition: null, ...base, soWhat: '두 번째 문장은 버려져야 한다.' },
        { candidateId: 'cand-XX', operator: 'UNRESOLVED_CORE', connection: 'fixture', narrowedCondition: null, ...base },
        { operator: 'UNRESOLVED_CORE', connection: 'fixture', narrowedCondition: null, ...base },
      ],
    },
  });
  check(
    'SEM-DEC-05 · 모드 발명·중복 카드·없는 카드·id 없는 문장이 전부 버려진다 (카드당 최대 1)',
    parserCase.semantic.parsed === 1 &&
      parserCase.semantic.kept === 1 &&
      parserCase.semantic.items[0]?.candidateId === 'cand-2',
    parserCase.semantic,
  );

  /* A10 · A11 — current VERIFY는 상대에게 보낼 질문 */
  const selfAction = await contract({
    allowed: ALLOWED_INSIGHT,
    candidates: cardWith(),
    raw: rawWith({ ...base, usedEvidenceRefs: [], verification: '연락이 끊겼던 날과 괜찮았던 날을 나눠서 적어봐.' }),
  });
  check(
    'SEM-DEC-06 · current에서 혼자 하는 행동은 VERIFY로 나가지 않는다 (문장은 남는다)',
    selfAction.semantic.kept === 1 &&
      selfAction.semantic.items[0]?.hasVerification === false &&
      selfAction.semantic.violations.includes('semantic_verify_not_question'),
    selfAction.semantic,
  );
  const sendable = await contract({
    allowed: ALLOWED_INSIGHT,
    candidates: cardWith(),
    raw: rawWith({ ...base, usedEvidenceRefs: [], verification: '약속 전에 연락이 끊기면 나는 좀 초조해지는데, 그럴 땐 짧게라도 알려줄 수 있어?' }),
  });
  check(
    'SEM-DEC-06 · current에서 상대에게 보낼 수 있는 질문은 VERIFY로 남는다',
    sendable.semantic.kept === 1 && sendable.semantic.items[0]?.hasVerification === true,
    sendable.semantic,
  );

  /* Final QA — gpt-5.4 실측 결함: 자기 회고 질문이 '상대에게 물을 질문'으로 올라갔다 */
  for (const [label, verification] of [
    ['1인칭 회고', '서운한 일이 지나간 뒤, 나는 말할 타이밍을 놓친 쪽이 더 걸렸을까 아니면 그냥 넘어간 게 편했을까?'],
    ['과거 회고 어미', '혼자 있는 시간을 못 챙긴 날에도 괜찮았을까, 아니면 그게 은근히 계속 남았을까?'],
    ['1인칭 성향', '서운한 일이 지나가면 나는 풀고 싶은 편이야, 그냥 덮고 가는 편이야?'],
  ]) {
    const selfQuestion = await contract({
      allowed: ALLOWED_INSIGHT,
      candidates: cardWith(),
      raw: rawWith({ ...base, usedEvidenceRefs: [], verification }),
    });
    check(
      `SEM-DEC-10 · current에서 ${label} 질문은 VERIFY로 나가지 않는다`,
      selfQuestion.semantic.kept === 1 && selfQuestion.semantic.items[0]?.hasVerification === false,
      selfQuestion.semantic,
    );
  }
  for (const [label, verification] of [
    ['내 기준 + 부탁', '약속 전에 연락이 끊기면 나는 좀 초조해지는데, 그럴 땐 짧게라도 알려줄 수 있어?'],
    ['상대에게 선택지', '서운한 일이 있으면 그날 바로 말하는 게 편해, 아니면 좀 지나고 얘기하는 게 편해?'],
  ]) {
    const partnerQuestion = await contract({
      allowed: ALLOWED_INSIGHT,
      candidates: cardWith(),
      raw: rawWith({ ...base, usedEvidenceRefs: [], verification }),
    });
    check(
      `SEM-DEC-10 · ${label} 질문은 그대로 VERIFY로 남는다 (과필터 아님)`,
      partnerQuestion.semantic.items[0]?.hasVerification === true,
      partnerQuestion.semantic,
    );
  }

  /* A11 — ended 번들 */
  const ended = await withRequest({ ...SEM_B, status: 'ended', target: { ...SEM_B.target, relation: 'ex' } });
  check(
    "SEM-DEC-07 · ended 카드의 '아직 모르는 점'이 과거 시점으로 쓰인다",
    ended.aiRequest.context.tense === 'former' &&
      ended.aiRequest.context.candidates.every((card) => card.unresolvedPoints.every((point) => !/지금 관계/.test(point))),
  );

  /* 사건 0 — 장면 없는 카드 */
  const none = await withRequest(SEM_A);
  check(
    'SEM-DEC-08 · 사건이 없어도 Top 3 카드는 해석 대상이고, 장면 칸은 비어 있다',
    none.aiRequest.context.candidates.length === 3 &&
      none.aiRequest.context.candidates.every((card) => card.selectedEvents.length === 0) &&
      none.aiRequest.context.candidates.every((card) => card.unresolvedPoints.includes('이 이야기와 이어진 장면은 아직 없어')),
  );

  /* A0 — 같은 판정에 사건만 다르면 같은 카드, 다른 장면 */
  const [c, d] = await Promise.all([withRequest(SEM_C), withRequest(SEM_D)]);
  const firstCardEvents = (r) => JSON.stringify(r.aiRequest.context.candidates[0].selectedEvents.map((event) => event.eventId));
  check(
    'SEM-DEC-09 · B·C·D의 #1 카드가 같고, 그 카드에 실린 장면이 서로 다르다',
    new Set([b, c, d].map((r) => r.semanticTopCandidateIds[0])).size === 1 &&
      new Set([b, c, d].map(firstCardEvents)).size === 3,
    [b, c, d].map(firstCardEvents),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-OP — Insight Operator (Operator Pass §8 ~ §20 · §31 OP-01 ~ OP-06)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-OP · 근거 조합이 허용한 틀 안에서만, 실제 인용 근거로 좁힌다');
{
  const DECLARED = { source: 'declared', field: 'contact' };
  const CURRENT = { source: 'current_relationship', field: 'contact' };
  const TARGET = { source: 'target', field: 'contact' };
  const PAST = { source: 'relationship', field: 'hardest' };
  const HISTORY = { source: 'history', entryId: 'h1', axis: 'contact' };
  const KNOWN = '연락 중요도를 5점 중 5로 답했어';

  const card = (overrides) => [
    {
      candidateId: CARD_ID,
      evidenceRefs: [DECLARED, CURRENT, TARGET, PAST, HISTORY],
      eventIds: ['ev-1', 'ev-2'],
      sceneTexts: [],
      eligibleOperators: ALL_OPERATORS,
      knownSelfStatement: KNOWN,
      ...overrides,
    },
  ];
  const narrative = (overrides) => ({
    narratives: [],
    candidateSemantics: [
      {
        candidateId: CARD_ID,
        operator: 'CONDITION_NARROWING',
        connection: '연락이 중요하다는 답과, 이유를 모른 채 달라진 장면에서만 불편했다는 기록을 이었다',
        narrowedCondition: '연락량 → 예상과 다른 변화 + 이유를 모르는 상태',
        soWhat: '연락 횟수 자체보다, 평소와 달라졌는데 이유를 모르는 상태가 더 걸리는 조건일 수 있어.',
        whyItMatters: '답이 늦어진 날마다 이유를 찾게 되면, 기다리는 시간이 그대로 불편으로 남아.',
        usedEvidenceRefs: [DECLARED],
        usedEventIds: ['ev-1'],
        ...overrides,
      },
    ],
  });
  const gate = (raw, candidates, tense = 'current') =>
    contract({ allowed: ALLOWED_INSIGHT, raw, candidates, tense });

  /* OP-01 CONDITION_NARROWING — 말한 기준 + 장면 */
  const op01 = await gate(narrative({}), card({}));
  check('SEM-OP-01 · CONDITION_NARROWING: 말한 기준 + 장면을 이어 좁힌 문장은 통과한다', op01.semantic.kept === 1, op01.semantic);
  check(
    'SEM-OP-01 · 통과한 카드가 operator와 좁혀진 조건을 들고 있다',
    op01.semantic.items[0]?.operator === 'CONDITION_NARROWING' && op01.semantic.items[0]?.hasNarrowedCondition === true,
    op01.semantic.items,
  );

  /* OP-02 DECLARED_VS_REACTION — 말한 기준 + 지금 관계 반응 */
  const op02 = await gate(
    narrative({
      operator: 'DECLARED_VS_REACTION',
      soWhat: "'바로 알고 싶다'와 '실제로 먼저 묻게 된다'는 같은 기준이 아닐 수 있어.",
      usedEvidenceRefs: [DECLARED, CURRENT],
      usedEventIds: [],
    }),
    card({}),
  );
  check('SEM-OP-02 · DECLARED_VS_REACTION: 말한 기준과 지금 관계 답을 이으면 통과한다', op02.semantic.kept === 1, op02.semantic);
  const op02bad = await gate(
    narrative({ operator: 'DECLARED_VS_REACTION', usedEvidenceRefs: [CURRENT, TARGET], usedEventIds: [] }),
    card({}),
  );
  check(
    'SEM-OP-02 · 말한 기준을 인용하지 않은 DECLARED_VS_REACTION은 거부된다 (핵심 family 누락)',
    op02bad.semantic.kept === 0 && op02bad.semantic.violations.includes('semantic_operator_unsupported'),
    op02bad.semantic,
  );

  /* OP-03 CURRENT_VS_PAST — 지금 관계 + 이전 경험, 과장 금지 */
  const op03 = await gate(
    narrative({
      operator: 'CURRENT_VS_PAST',
      soWhat: '예전 관계에서는 연락이 줄어든 것 자체가 힘들었는데, 지금은 이유 없이 달라지는 순간이 더 걸려 보여.',
      usedEvidenceRefs: [CURRENT, PAST],
      usedEventIds: [],
    }),
    card({}),
  );
  check('SEM-OP-03 · CURRENT_VS_PAST: 지금 관계 답 + 이전 경험을 이으면 통과한다', op03.semantic.kept === 1, op03.semantic);
  const op03bad = await gate(
    narrative({
      operator: 'CURRENT_VS_PAST',
      soWhat: '너는 원래 항상 연락이 줄어드는 순간에 무너지는 사람이야.',
      usedEvidenceRefs: [CURRENT, PAST],
      usedEventIds: [],
    }),
    card({}),
  );
  check('SEM-OP-03 · 과거 한 번을 성향·반복으로 단정하면 거부된다', op03bad.semantic.kept === 0, op03bad.semantic);

  /* OP-04 CONTEXT_DEPENDENT — 장면 2개 이상 */
  const op04 = await gate(
    narrative({
      operator: 'CONTEXT_DEPENDENT',
      soWhat: '연락이 적은 날은 괜찮고, 약속한 날 연락이 끊기는 순간에만 크게 걸리는 쪽일 수 있어.',
      usedEvidenceRefs: [DECLARED],
      usedEventIds: ['ev-1', 'ev-2'],
    }),
    card({}),
  );
  check('SEM-OP-04 · CONTEXT_DEPENDENT: 장면 두 개를 이으면 통과한다', op04.semantic.kept === 1, op04.semantic);
  const op04bad = await gate(
    narrative({ operator: 'CONTEXT_DEPENDENT', usedEvidenceRefs: [DECLARED], usedEventIds: ['ev-1'] }),
    card({}),
  );
  check('SEM-OP-04 · 장면 하나로 CONTEXT_DEPENDENT를 말하면 거부된다', op04bad.semantic.kept === 0, op04bad.semantic);

  /* OP-05 SELF_VS_TARGET — 상대 의도 추정 0 */
  const op05 = await gate(
    narrative({
      operator: 'SELF_VS_TARGET',
      soWhat: '너는 연락이 자주 오가야 편한데, 상대는 뜸한 편이라고 적었어. 그 간격을 어디까지 괜찮게 볼지가 확인할 차이야.',
      usedEvidenceRefs: [DECLARED, TARGET],
      usedEventIds: [],
    }),
    card({}),
  );
  check('SEM-OP-05 · SELF_VS_TARGET: 말한 기준 + 상대에 대해 입력한 값을 이으면 통과한다', op05.semantic.kept === 1, op05.semantic);
  const op05bad = await gate(
    narrative({
      operator: 'SELF_VS_TARGET',
      soWhat: '상대는 너한테 마음이 식어서 연락을 일부러 줄이는 거야.',
      usedEvidenceRefs: [DECLARED, TARGET],
      usedEventIds: [],
    }),
    card({}),
  );
  check('SEM-OP-05 · 상대 의도를 추정하면 거부된다', op05bad.semantic.kept === 0, op05bad.semantic);

  /* OP-06 UNRESOLVED_CORE — 근거가 한 출처여도 허용, 멋진 결론 금지 */
  const op06 = await gate(
    narrative({
      operator: 'UNRESOLVED_CORE',
      narrowedCondition: null,
      soWhat: '연락 빈도 자체가 걸리는지, 변화에 설명이 없는 게 걸리는지는 아직 구분하기 어려워.',
      usedEvidenceRefs: [DECLARED],
      usedEventIds: [],
    }),
    card({ eventIds: [], eligibleOperators: ['UNRESOLVED_CORE'] }),
  );
  check('SEM-OP-06 · UNRESOLVED_CORE: 한 출처만으로 아직 구분되지 않은 점을 말하면 통과한다', op06.semantic.kept === 1, op06.semantic);
  const single = await gate(
    narrative({ operator: 'CONDITION_NARROWING', usedEvidenceRefs: [DECLARED], usedEventIds: [] }),
    card({}),
  );
  check(
    'SEM-OP-06 · 한 출처만으로 새 발견(UNRESOLVED 아님)을 만들면 거부된다 (§12)',
    single.semantic.kept === 0 && single.semantic.violations.includes('semantic_operator_unsupported'),
    single.semantic,
  );

  /*
    Operator Pass QA 실측 결함 — **출력 예시가 ref를 문자열로 보여주면 모델이 문자열로 돌려준다.**
    v8 첫 판의 예시가 `["evidence[].ref를 수정 없이 복사"]`였고, 모델은 `"declared:conflict"`
    같은 문자열을 보냈다. 파서는 객체 ref만 받으므로(신뢰 경계를 넓히지 않는다) 인용 근거가
    0개가 되어 39건 중 36건이 `semantic_operator_unsupported`로 떨어졌다. 예시를 객체로 고정한다.
  */
  const promptSrc = await readFile(join(ROOT, 'src/services/ai/promptTemplates.ts'), 'utf8');
  const exampleLine = /"usedEvidenceRefs":\s*(\[[^\n]*\])/.exec(
    promptSrc.slice(promptSrc.indexOf('"candidateSemantics": ['), promptSrc.indexOf('"candidateSemantics": [') + 1500),
  )?.[1];
  check(
    'SEM-OP · 프롬프트 출력 예시의 usedEvidenceRefs가 객체 형태다 (문자열 예시 금지)',
    Boolean(exampleLine) && /^\[\s*\{\s*"source"/.test(exampleLine),
    exampleLine,
  );
  const stringRefs = await gate(narrative({ usedEvidenceRefs: ['declared:contact', 'current_relationship:contact'] }), card({}));
  check(
    'SEM-OP · 문자열 ref는 근거로 인정되지 않는다 (파서 신뢰 경계 유지)',
    stringRefs.semantic.kept === 0,
    stringRefs.semantic,
  );

  /* ══ Final Minimal Fix — VERIFY 답하는 사람(role) · WHY 보고 어미 ══════════════ */
  const UNRESOLVED = {
    operator: 'UNRESOLVED_CORE',
    narrowedCondition: null,
    usedEventIds: [],
    soWhat: '연락 빈도 자체가 걸리는지, 변화에 설명이 없는 게 걸리는지는 아직 구분하기 어려워.',
  };
  for (const [id, verification, keepVerify] of [
    ['VFY-01', '나는 말할 타이밍을 놓친 쪽이 더 걸렸을까?', false],
    ['VFY-02', '다시 꺼낸 일이 더 많았는지 떠오르니?', false],
    ['VFY-03', '내가 그때 왜 더 답답했을까?', false],
    ['VFY-04', '그럴 때 너는 바로 말하는 게 편해?', true],
    ['VFY-05', '나는 초조해지는데, 늦어질 땐 짧게 알려줄 수 있어?', true],
    ['VFY-06', '너무 답답할 때는 어떻게 해?', false],
  ]) {
    const result = await gate(narrative({ ...UNRESOLVED, verification }), card({ eventIds: [] }));
    check(
      `${id} · current "${verification}" → ${keepVerify ? 'TARGET · VERIFY 유지' : 'SELF/AMBIGUOUS · VERIFY 제거 (카드는 유지)'}`,
      result.semantic.kept === 1 && result.semantic.items[0]?.hasVerification === keepVerify,
      result.semantic,
    );
  }
  const FORMER = {
    ...UNRESOLVED,
    soWhat: '연락 빈도 자체가 걸렸는지, 변화에 설명이 없던 게 걸렸는지는 아직 구분하기 어려워.',
    whyItMatters: '다음 관계에서 비슷한 침묵이 오면, 어느 순간부터 불편해지는지 더 일찍 알아차릴 수 있어.',
  };
  const ended01 = await gate(
    narrative({ ...FORMER, verification: '그때 가장 힘들었던 건 연락 양이었을까, 이유를 모른 채 기다린 시간이었을까?' }),
    card({ eventIds: [] }),
    'former',
  );
  check('ENDED-VERIFY-01 · ended 회고 질문(SELF)은 VERIFY로 남는다', ended01.semantic.items[0]?.hasVerification === true, ended01.semantic);
  const ended02 = await gate(narrative({ ...FORMER, verification: '상대에게 다시 물어볼 수 있어?' }), card({ eventIds: [] }), 'former');
  check(
    'ENDED-VERIFY-02 · ended에서 상대가 답하는 질문(TARGET)은 화면에 나가지 않는다',
    !ended02.semantic.items.some((item) => item.hasVerification),
    ended02.semantic,
  );

  for (const [id, whyItMatters] of [
    ['WHY-01', '답답했다고 적었어.'],
    ['WHY-02', '그날 답이 없어서 힘들었다고 했어.'],
    ['WHY-04', '네가 중요하다고 답한 기준이야.'],
  ]) {
    const result = await gate(narrative({ ...UNRESOLVED, whyItMatters }), card({ eventIds: [] }));
    check(
      `${id} · WHY "${whyItMatters}" → 보고 어미로 거부된다`,
      result.semantic.kept === 0 && result.semantic.violations.includes('semantic_why_reporting_back'),
      result.semantic,
    );
  }
  const why03 = await gate(
    narrative({
      ...UNRESOLVED,
      whyItMatters: '평소엔 괜찮아도, 서로 일정이 정해진 순간에는 연락이 끊겼을 때 기다림의 의미가 달라질 수 있어.',
    }),
    card({ eventIds: [] }),
  );
  check('WHY-03 · 조건이 드러나는 상황을 설명한 WHY는 통과한다 (과필터 아님)', why03.semantic.kept === 1, why03.semantic);
  const why05 = await gate(
    narrative({
      operator: 'DECLARED_VS_REACTION',
      narrowedCondition: '시간을 두는 것 ≠ 그냥 지나가게 두는 것',
      soWhat: "'잠깐 뒤에 이야기하고 싶다'와 '실제로는 그냥 넘어간다'는 같은 기준이 아닐 수 있어.",
      whyItMatters: '서운한 일을 그날 넘겨도 며칠 뒤 다시 떠오르면, 시간을 두는 것과 덮는 것이 다르게 드러나.',
      usedEvidenceRefs: [DECLARED, CURRENT],
      usedEventIds: [],
    }),
    card({ eventIds: [] }),
  );
  check('WHY-05 · 장면 없이 누적 근거로 조건을 설명한 WHY는 통과한다', why05.semantic.kept === 1, why05.semantic);
  const feel = await gate(
    narrative({ ...UNRESOLVED, whyItMatters: '연락이 중요하다고 느끼는 순간이 바쁜 날과 약속한 날에 다르게 올 수 있어.' }),
    card({ eventIds: [] }),
  );
  check("WHY · '중요하다고 느끼는' 같은 비보고 인용절은 막히지 않는다 (과필터 아님)", feel.semantic.kept === 1, feel.semantic);

  /* §10 — 목록 밖 틀 */
  const notEligible = await gate(narrative({}), card({ eligibleOperators: ['UNRESOLVED_CORE'] }));
  check(
    'SEM-OP · 허용 목록 밖의 operator는 거부된다',
    notEligible.semantic.kept === 0 && notEligible.semantic.violations.includes('semantic_operator_not_eligible'),
    notEligible.semantic,
  );

  /* §20 — baseline 복창 */
  const restated = await gate(
    narrative({ soWhat: '연락 중요도를 5점 중 5로 답했어. 연락이 중요해.' }),
    card({}),
  );
  check(
    'SEM-OP · SO WHAT이 이미 아는 자기 설명을 다시 말하면 거부된다 (§20)',
    restated.semantic.kept === 0 && restated.semantic.violations.includes('semantic_restates_known_self'),
    restated.semantic,
  );

  /* §19 — '좁혀봐야 해' 선언 */
  const vague = await gate(
    narrative({ operator: 'UNRESOLVED_CORE', soWhat: '갈등이 생기면 지금 기준을 먼저 좁혀봐야 해.', usedEventIds: [] }),
    card({}),
  );
  check(
    "SEM-OP · 무엇으로 좁혀지는지 없는 '좁혀봐야 해'는 거부된다 (§19)",
    vague.semantic.kept === 0 && vague.semantic.violations.includes('semantic_vague_narrowing'),
    vague.semantic,
  );

  /* §29 · §30 — saju_in_core 오탐 */
  const support = await gate(
    narrative({
      operator: 'UNRESOLVED_CORE',
      soWhat: '서로를 지지하는 방식이 연락의 양인지, 필요한 순간의 한마디인지는 아직 구분하기 어려워.',
      usedEventIds: [],
    }),
    card({}),
  );
  check("SEM-OP · '지지하는' 같은 일상어는 사주 어휘로 막히지 않는다 (오탐 수정)", support.semantic.kept === 1, support.semantic);
  const sajuTerm = await gate(
    narrative({
      operator: 'UNRESOLVED_CORE',
      soWhat: '천간과 지지를 보면 연락 방식이 다를 수 있어.',
      usedEventIds: [],
    }),
    card({}),
  );
  check(
    '사주 용어 지지(地支)는 여전히 핵심 문장에서 막힌다',
    sajuTerm.semantic.kept === 0 && sajuTerm.semantic.violations.includes('saju_in_core'),
    sajuTerm.semantic,
  );

  /* §10 — 실제 세션의 결정론 eligibility */
  const r2 = await withRequest(SEM_B);
  const [c1, c2, c3] = r2.aiRequest.context.candidates;
  check(
    'SEM-OP · R2 #1(연락 · 장면 2) — CONDITION_NARROWING · CONTEXT_DEPENDENT · SELF_VS_TARGET이 허용된다',
    ['CONDITION_NARROWING', 'CONTEXT_DEPENDENT', 'SELF_VS_TARGET', 'UNRESOLVED_CORE'].every((op) => c1.eligibleOperators.includes(op)),
    c1.eligibleOperators,
  );
  check(
    'SEM-OP · R2 #2(갈등 · 장면 0) — 장면 없이도 DECLARED_VS_REACTION이 허용되고 CONTEXT_DEPENDENT는 아니다',
    c2.eligibleOperators.includes('DECLARED_VS_REACTION') && !c2.eligibleOperators.includes('CONTEXT_DEPENDENT'),
    c2.eligibleOperators,
  );
  check(
    'SEM-OP · R2 #3(개인 시간) — SELF_VS_TARGET이 허용된다 (상대에 대해 입력한 값이 있다)',
    c3.eligibleOperators.includes('SELF_VS_TARGET'),
    c3.eligibleOperators,
  );
  check(
    'SEM-OP · 모든 카드에 baseline(말한 기준 문장)이 있다',
    [c1, c2, c3].every((bundle) => typeof bundle.knownSelfStatement === 'string' && bundle.knownSelfStatement.length > 0),
    [c1, c2, c3].map((bundle) => bundle.knownSelfStatement),
  );
  check(
    'SEM-OP · #1·#2가 접힌 같은 축 근거(이전 관계 경험)를 받는다 (감사에서 빠져 있던 근거)',
    c1.evidence.some((item) => item.family === 'EXPERIENCE') && c2.evidence.some((item) => item.family === 'EXPERIENCE'),
    [c1, c2].map((bundle) => bundle.sourceFamilies),
  );
  check(
    'SEM-OP · 허용 틀은 결정론이다 (같은 입력 두 번 → 같은 목록)',
    JSON.stringify((await withRequest(SEM_B)).aiRequest.context.candidates.map((bundle) => bundle.eligibleOperators)) ===
      JSON.stringify([c1, c2, c3].map((bundle) => bundle.eligibleOperators)),
  );
  const sparse = await withRequest(FIXTURE_SPARSE);
  check('SEM-OP · sparse에서는 해석할 카드 자체가 없다 (억지 개인화 0)', (sparse.aiRequest.context.candidates ?? []).length === 0);

  /* §25 — 같은 카드 질문 중복 */
  const dup = await run({
    ...SEM_B,
    candidateSemantics: [
      {
        candidateId: topId(r2),
        operator: 'UNRESOLVED_CORE',
        connection: 'fixture',
        narrowedCondition: null,
        soWhat: '연락 빈도 자체가 걸리는지, 변화에 설명이 없는 게 걸리는지는 아직 구분하기 어려워.',
        whyItMatters: '답이 늦어진 날마다 이유를 찾게 되면, 기다리는 시간이 그대로 불편으로 남아.',
        verification: '연락이 평소랑 달라질 땐, 짧게라도 상황을 알려주는 게 너한텐 괜찮아?',
        usedEvidenceRefs: [],
        usedEventIds: [],
      },
    ],
  });
  const registers = dup.report.candidates[0].questions.map((question) => question.register);
  check(
    'SEM-OP · usable한 AI 확인 질문이 있으면 같은 자리의 표 질문(direct · situational)은 빠진다 (§25)',
    registers[0] === 'semantic' && !registers.includes('direct') && !registers.includes('situational'),
    registers,
  );
  const noDup = await run(SEM_B);
  check(
    'SEM-OP · AI 질문이 없으면 표 질문은 그대로다 (fallback 유지)',
    noDup.report.candidates[0].questions.some((question) => question.register === 'direct'),
    noDup.report.candidates[0].questions.map((question) => question.register),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEM-ROUTE — Deep Report 전용 모델 라우팅 (v1.46.4 Model A/B)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nSEM-ROUTE · Deep Report만 모델을 따로 고르고, 캐시가 모델로 갈린다');
{
  const handlersSrc = stripComments(await readFile(join(ROOT, 'src/services/ai/handlers.ts'), 'utf8'));
  const routingSrc = stripComments(await readFile(join(ROOT, 'src/services/ai/modelRouting.ts'), 'utf8'));
  const routeSrc = stripComments(await readFile(join(ROOT, 'src/app/api/ai/deep-report-narrative/route.ts'), 'utf8'));
  const fingerprintSrc = stripComments(await readFile(join(ROOT, 'src/lib/aiFingerprint.ts'), 'utf8'));

  const withModelArg = handlersSrc.match(/resolveProvider\(false,\s*\w+\)/g) ?? [];
  check('SEM-ROUTE · 모델 인자를 넘기는 resolveProvider 호출이 1곳이다', withModelArg.length === 1, withModelArg);
  check(
    'SEM-ROUTE · 그 1곳이 deep-report 핸들러다',
    /deepReportModelFor\(\{[\s\S]{0,300}\}\);\s*const provider = resolveProvider\(false, deepModel\)/.test(handlersSrc),
  );
  check(
    'SEM-ROUTE · 라우팅 함수가 production에서 dev override를 무시한다',
    /nodeEnv !== 'production' && isPlausibleModelId\(input\.devOverride\)/.test(routingSrc),
  );
  check(
    'SEM-ROUTE · 라우트가 dev 필드를 개발 환경에서만 읽는다',
    /const isDev = process\.env\.NODE_ENV !== 'production'/.test(routeSrc) &&
      /isDev && typeof devModelOverride === 'string'/.test(routeSrc) &&
      /isDev && devCapture === true/.test(routeSrc),
  );
  check(
    "SEM-ROUTE · 제품 라우팅이 아직 'inherit'이다 (승인 전 기본 모델 불변)",
    /export const DEEP_REPORT_MODEL_ROUTE: 'inherit' \| string = 'inherit';/.test(routingSrc),
  );
  check(
    'SEM-ROUTE · deepReportFingerprint가 모델 id를 digest에 넣는다',
    /`model:\$\{semanticModelId\}`/.test(fingerprintSrc) && /input\.semanticModelId \?\? DEEP_REPORT_MODEL_ROUTE/.test(fingerprintSrc),
  );
  check('SEM-ROUTE · 라우트가 카드 허용집합을 최대 3장으로 자른다', /\.slice\(0, 3\)/.test(routeSrc) && /candidates: allowancesOf\(candidates\)/.test(routeSrc));
}

console.log('\nSEM-BUDGET · Provider 호출 수와 토큰 예산');
{
  const lensReady = (body) => ({
    ...body,
    mbti: 'INFP',
    birthProfile: { date: '1996-04-12', time: '10:30', calendarType: 'solar' },
    target: { ...body.target, mbti: 'ENFP', birthProfile: { date: '1995-08-20', time: null, calendarType: 'solar' } },
  });

  const none = await run(lensReady(SEM_A));
  const rich = await run(lensReady(SEM_B));
  const stress = await run(lensReady({ ...SEM_B, target: { ...SEM_B.target, events: stressEvents(20) } }));
  const five = await run(lensReady({ ...SEM_B, target: { ...SEM_B.target, events: stressEvents(5) } }));

  for (const [name, flow] of [['사건 0', none], ['사건 2', rich], ['사건 5', five], ['사건 20', stress]]) {
    check(`SEM-BUDGET · ${name} — 전체 Provider 호출이 5회다`, flow.ai.totalCalls === 5, {
      total: flow.ai.totalCalls,
      calls: flow.ai.calls.map((call) => [call.task, call.count]),
    });
  }
  check('SEM-BUDGET · 사건 20건에서도 Deep Report 장면이 4건 이하다', stress.events.sentToDeepReport <= 4, stress.events.sentToDeepReport);
  const charsOf = (flow) => flow.ai.calls.reduce((total, call) => total + (call.count ? call.inputChars : 0), 0);
  const growth = charsOf(stress) / charsOf(none);
  check(`SEM-BUDGET · 사건 0 → 20에서 전체 컨텍스트 증가가 1.5배 미만이다 (실측 ${growth.toFixed(2)}배)`, growth < 1.5, {
    none: charsOf(none),
    stress: charsOf(stress),
  });

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
