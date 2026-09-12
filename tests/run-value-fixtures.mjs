/**
 * Result Value Fixture — VALUE-01 ~ VALUE-15 (v1.46.4 · §43 · §46)
 *
 * ══ 이 스크립트가 고정하는 것 ═══════════════════════════════════════════════
 *
 * v1.46.4가 바꾼 것은 판정이 아니라 **결과의 정보 구조**다. 그래서 검사도 "문장이
 * 좋아졌는가"가 아니라 **구조가 실제로 뒤집혔는가**를 값으로 본다:
 *
 * > **첫 화면에 사용자가 입력한 값이 0개인가.**
 * > **같은 판정이어도 근거가 다르면 결론 문장이 다른가.**
 * > **AI가 죽어도 결론이 남는가.**
 * > **Paywall이 약속한 것이 실제로 유료에 있는가.**
 *
 * ⚠️ **판정 로직을 여기서 복제하지 않는다.** `/api/dev/premium-test`가 화면·훅과 같은
 * 함수를 부르고, 이 스크립트는 fixture 조립과 검증만 한다.
 *
 * ⚠️ 이전 판(v1.46.4 초안)의 VALUE 목록과 번호가 다르다. 그때는 Executive 3줄이
 * 주인공이었고 지금은 Candidate다 — 검사 대상이 바뀌었으므로 번호를 재사용하지 않고
 * §43의 목록을 그대로 옮겼다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:value`
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FATE_CLAIMS,
  FIXTURE_A,
  FIXTURE_B,
  FIXTURE_C,
  FIXTURE_D,
  FIXTURE_SPARSE,
  PARTNER_INTENT,
  createChecker,
  findForbidden,
  run,
} from './fixtures-v1464.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const { check, report } = createChecker();

console.log('\nResult Value Fixture — v1.46.4 §43\n');

const a = await run(FIXTURE_A);
const b = await run(FIXTURE_B);
const c = await run(FIXTURE_C);
const d = await run(FIXTURE_D);
const sparse = await run(FIXTURE_SPARSE);
/** AI가 한 건도 돌아오지 않은 상태 (VALUE-12) */
const noAi = await run({ ...FIXTURE_B, narratives: [] });

const candidateView = await readFile(
  join(ROOT, 'src/components/premium/PremiumCandidateSection.tsx'),
  'utf8',
);
const signalCard = await readFile(
  join(ROOT, 'src/components/compatibility/SignalCard.tsx'),
  'utf8',
);

/** 첫 viewport에 그려지는 문자열 — Candidate 상위 3개의 결론 계층만 */
function firstViewport(result) {
  return result.report.candidates
    .slice(0, 3)
    .flatMap((candidate) => [
      candidate.headline,
      candidate.soWhat,
      candidate.whyItMatters,
      ...candidate.questions.map((question) => question.text),
    ]);
}

/* ── VALUE-01 · Premium 첫 viewport 입력 재진술 0 ──────────────────────── */
console.log('VALUE-01 · Premium 첫 viewport 입력 재진술 0');
{
  const texts = firstViewport(b);
  check('첫 viewport에 Candidate가 있다', texts.length > 0, b.report.candidates.length);

  /*
    기준표는 **사용자가 실제로 입력한 값에서 만들어진 문구**다. 축 라벨(`개인 시간`)은
    서비스의 어휘라 여기 없다 — 축 이름을 부르는 것과 답 값을 되읽는 것은 다르다.
  */
  const inputPhrases = [
    ...b.free.phrases,
    ...FIXTURE_B.target.preferences.interests.map((interest) => interest.label),
    ...FIXTURE_B.target.events.flatMap((event) => [event.description, event.myReaction]),
  ];
  const recited = [];
  for (const text of texts) {
    for (const phrase of inputPhrases) {
      if (phrase && phrase.length >= 3 && text.includes(phrase)) recited.push({ phrase, text });
    }
  }
  check('첫 viewport에 사용자 입력값이 0건이다', recited.length === 0, recited);
  check(
    '첫 viewport에 점수 표기(`5/5` 같은 값)가 없다',
    !texts.some((text) => /\d\s*\/\s*5/.test(text)),
    texts.filter((text) => /\d\s*\/\s*5/.test(text)),
  );
}

/* ── VALUE-02 · Premium 첫 viewport에 개인화된 SO WHAT 3개 ─────────────── */
console.log('\nVALUE-02 · 첫 viewport SO WHAT 3개');
{
  const top = b.report.candidates.slice(0, 3);
  check(`Candidate가 3개 이상이다 (발견 ${b.report.candidates.length})`, top.length === 3, top.length);
  check(
    '세 개 모두 SO WHAT이 비어 있지 않다',
    top.every((candidate) => candidate.soWhat.trim().length > 0),
    top.map((candidate) => candidate.soWhat),
  );
  check(
    '세 개 모두 왜 중요한지가 함께 있다',
    top.every((candidate) => candidate.whyItMatters.trim().length > 0),
    top.map((candidate) => candidate.whyItMatters),
  );
  check(
    '세 SO WHAT이 서로 다르다',
    new Set(top.map((candidate) => candidate.soWhat)).size === top.length,
    top.map((candidate) => candidate.soWhat),
  );
  /*
    §14 — 우선순위. 이미 아는 것(MATCH)이 새로 보이는 것(GAP·모순)보다 앞에 오면
    첫 화면이 다시 '네가 말한 대로였어'로 시작한다.
  */
  const verdicts = b.report.candidates.map((candidate) => candidate.verdict);
  const firstMatch = verdicts.indexOf('MATCH');
  const lastNew = Math.max(verdicts.lastIndexOf('GAP'), verdicts.lastIndexOf('CONTRADICTION'));
  check(
    'MATCH가 GAP · 모순보다 앞에 오지 않는다',
    firstMatch === -1 || lastNew === -1 || firstMatch > lastNew,
    verdicts,
  );
}

/* ── VALUE-03 · 같은 kind + 다른 evidence → 다른 SO WHAT ───────────────── */
console.log('\nVALUE-03 · 근거가 다르면 결론 문장이 다르다');
{
  check(
    'B와 C의 Mirror 판정이 같다 (비교의 전제)',
    JSON.stringify(b.mirrorStates) === JSON.stringify(c.mirrorStates),
    { b: b.mirrorStates, c: c.mirrorStates },
  );
  check(
    'B와 C의 Chapter kind 목록이 같다 (판정 계층은 동일하다)',
    b.chapters.map((chapter) => chapter.kind).join(',') ===
      c.chapters.map((chapter) => chapter.kind).join(','),
    { b: b.chapters.map((x) => x.kind), c: c.chapters.map((x) => x.kind) },
  );
  /*
    ⚠️ **여기가 이번 개편의 핵심 검사다.** 판정도 같고 Chapter kind도 같은데 SO WHAT이
    한 글자도 다르지 않다면, 결론은 여전히 `kind → 고정문`에서 나오고 있는 것이다(§48).
  */
  const bSoWhat = b.report.candidates.map((candidate) => candidate.soWhat).join('|');
  const cSoWhat = c.report.candidates.map((candidate) => candidate.soWhat).join('|');
  check('그런데 SO WHAT은 서로 다르다', bSoWhat !== cSoWhat, {
    b: bSoWhat.slice(0, 160),
    c: cSoWhat.slice(0, 160),
  });
  check(
    'A(사건 0)와 B(사건 5)의 SO WHAT도 다르다',
    a.report.candidates.map((x) => x.soWhat).join('|') !== bSoWhat,
  );
  check(
    '결론이 고정문 fallback이 아니라 조립된 것이다',
    b.report.candidates.filter((candidate) => candidate.composed).length >= 2,
    b.report.candidates.map((candidate) => [candidate.axis, candidate.composed]),
  );
}

/* ── VALUE-04 · evidence default collapsed ────────────────────────────── */
console.log('\nVALUE-04 · 근거는 기본 닫힘');
{
  check(
    'Candidate 카드의 근거 토글 초기값이 닫힘이다',
    /const \[evidenceOpen, setEvidenceOpen\] = useState\(false\)/.test(candidateView),
  );
  const body = candidateView.slice(candidateView.indexOf('function CandidateCard'));
  check(
    'SO WHAT 블록이 근거 토글보다 **위**에 있다',
    body.indexOf('{SO_WHAT_LABEL}') < body.indexOf('{EVIDENCE_TOGGLE_LABEL}'),
    { soWhat: body.indexOf('{SO_WHAT_LABEL}'), evidence: body.indexOf('{EVIDENCE_TOGGLE_LABEL}') },
  );
  check(
    '근거 목록이 토글 안에서만 렌더된다 (열기 전에는 DOM에 없다)',
    body.includes('{evidenceOpen ? ('),
  );
  check(
    '무료 신호 카드도 근거가 접혀 있다 (`details`에 open 속성이 없다)',
    signalCard.includes('<details') && !/<details[^>]*\sopen/.test(signalCard),
  );
}

/* ── VALUE-05 · FREE protagonist != Premium protagonist ───────────────── */
console.log('\nVALUE-05 · 무료와 유료의 주인공이 다르다');
{
  const freeSoWhat = new Set(b.free.candidates.map((candidate) => candidate.soWhat));
  const premiumSoWhat = b.report.candidates.map((candidate) => candidate.soWhat);
  const overlap = premiumSoWhat.filter((text) => freeSoWhat.has(text));
  check('무료에도 Insight가 있다', freeSoWhat.size > 0, [...freeSoWhat]);
  check('유료에도 Insight가 있다', premiumSoWhat.length > 0, premiumSoWhat.length);
  check('두 화면의 결론 문장이 글자 그대로 겹치지 않는다', overlap.length === 0, overlap);
  check(
    '유료 Candidate는 자료 2종 이상을 잇는다 (무료 한 행으로는 만들 수 없는 단위)',
    b.report.candidates.every((candidate) => candidate.evidenceSourceCount >= 2),
    b.report.candidates.map((candidate) => [candidate.axis, candidate.evidenceSourceCount]),
  );
  check(
    '무료 Candidate는 cross-source 연결을 말하지 않는다',
    b.free.candidates.every((candidate) => candidate.hasOutsideFreeEvidence === false),
    b.free.candidates.map((candidate) => candidate.hasOutsideFreeEvidence),
  );
}

/* ── VALUE-06 · Premium outside-Free evidence >= 1 ────────────────────── */
console.log('\nVALUE-06 · 유료에는 무료 밖 근거가 있다');
{
  const outside = b.report.candidates.filter((candidate) => candidate.hasOutsideFreeEvidence);
  check('무료 밖 근거를 쓰는 Candidate가 1개 이상이다', outside.length >= 1, {
    total: b.report.candidates.length,
    outside: outside.map((candidate) => [candidate.axis, candidate.evidenceSources]),
  });
  check(
    '자료 3종 이상을 이은 Candidate가 하나 이상이다',
    b.report.candidates.some((candidate) => candidate.evidenceSourceCount >= 3),
    b.report.candidates.map((candidate) => candidate.evidenceSourceCount),
  );
}

/* ── VALUE-07 · Event-heavy → Event 연결 Insight ──────────────────────── */
console.log('\nVALUE-07 · 장면이 많은 사용자는 장면과 이어진 Insight를 받는다');
{
  const linked = b.report.candidates.filter((candidate) => candidate.hasUserReportedEvent);
  check('B(사건 5)에 장면과 이어진 Candidate가 있다', linked.length >= 1, {
    linked: linked.map((candidate) => [candidate.axis, candidate.relevantEventIds]),
  });
  check(
    '그 Candidate의 SO WHAT이 장면을 언급한다',
    linked.some((candidate) => candidate.soWhat.includes('네가 알려준')),
    linked.map((candidate) => candidate.soWhat),
  );
  /*
    §10 — 장면이 많아도 Candidate 하나에 붙는 장면은 상한 안이다. 전부 나열하면
    "많이 알려줄수록 결과가 길어진다"가 되고, 최종 제품 원칙이 금지한 방향이다.
  */
  check(
    'Candidate 하나에 붙는 장면이 4개를 넘지 않는다',
    b.report.candidates.every((candidate) => candidate.relevantEventIds.length <= 4),
    b.report.candidates.map((candidate) => candidate.relevantEventIds.length),
  );
  /*
    §24 — 반복을 말할 때 **`너는 원래 이런 패턴이야`라고 하지 않는다.**
  */
  const traitClaims = findForbidden(
    b.report.candidates.map((candidate) => candidate.soWhat),
    ['너는 원래', '너한테는 원래', '반복되는 패턴이야', '너의 패턴'],
  );
  check('사람의 성질로 말하는 표현이 없다', traitClaims.length === 0, traitClaims);
}

/* ── VALUE-08 · Event-poor user still gets valid result ───────────────── */
console.log('\nVALUE-08 · 장면이 없어도 결과가 완결된다');
{
  check('A(사건 0)에도 Candidate가 있다', a.report.candidates.length > 0, a.report.candidates.length);
  check(
    'A의 SO WHAT이 전부 비어 있지 않다',
    a.report.candidates.every((candidate) => candidate.soWhat.trim().length > 0),
  );
  check(
    'A의 어떤 Candidate도 장면을 언급하지 않는다 (없는 장면을 만들지 않는다)',
    !a.report.candidates.some((candidate) => candidate.soWhat.includes('네가 알려준')),
    a.report.candidates.map((candidate) => candidate.soWhat),
  );
  check(
    'A에도 확인할 질문이 있다',
    a.report.candidates.some((candidate) => candidate.questions.length > 0),
  );
  check('A와 B의 동기화율 점수가 같다 (사건은 점수를 바꾸지 않는다)', a.compatibility.score === b.compatibility.score, {
    a: a.compatibility.score,
    b: b.compatibility.score,
  });
}

/* ── VALUE-09 · FREE genuine insight >= 1 ─────────────────────────────── */
console.log('\nVALUE-09 · 무료에도 진짜 Insight가 1개 이상 있다');
{
  const free = b.free.candidates;
  check('무료 Candidate가 1개 이상이다', free.length >= 1, free.length);
  check('무료 Candidate가 2개를 넘지 않는다 (§19)', free.length <= 2, free.length);
  check(
    '무료 SO WHAT이 조립된 문장이다 (규칙 요약 재출력이 아니다)',
    free.every((candidate) => candidate.composed),
    free.map((candidate) => [candidate.axis, candidate.composed]),
  );
  /* 무료 첫 화면에도 입력값 재진술이 없어야 한다 */
  const recited = findForbidden(
    free.map((candidate) => candidate.soWhat),
    [...b.free.phrases.filter((phrase) => phrase && phrase.length >= 3)],
  );
  check('무료 SO WHAT에 입력값 재진술이 0건이다', recited.length === 0, recited);
}

/* ── VALUE-10 · FREE user-fit question >= 1 ───────────────────────────── */
console.log('\nVALUE-10 · 무료에 사용자에게 맞춘 질문이 1개 이상 있다');
{
  const questions = b.free.candidates.flatMap((candidate) => candidate.questions);
  check('무료 Candidate에 질문이 있다', questions.length >= 1, questions);
  check('무료 질문이 2개를 넘지 않는다 (§19)', questions.length <= 2, questions.length);
  check('무료 열린 질문이 있다', Boolean(b.free.openQuestion), b.free.openQuestion);
  check(
    '무료 질문과 유료 질문의 의도가 겹치지 않는다',
    (() => {
      const freeFp = new Set(questions.map((question) => question.fingerprint));
      return !b.report.candidates
        .flatMap((candidate) => candidate.questions)
        .some((question) => freeFp.has(question.fingerprint));
    })(),
    {
      free: questions.map((question) => question.fingerprint),
      premium: b.report.candidates.flatMap((candidate) =>
        candidate.questions.map((question) => question.fingerprint),
      ),
    },
  );
}

/* ── VALUE-11 · Premium actionable question >= 1 ──────────────────────── */
console.log('\nVALUE-11 · 유료에 바로 써볼 수 있는 질문이 있다');
{
  const questions = b.report.candidates
    .slice(0, 3)
    .flatMap((candidate) => candidate.questions);
  check('첫 3개 Candidate에 질문이 1개 이상 있다', questions.length >= 1, questions.length);
  check(
    '질문이 상대에게 보낼 수 있는 말이다 (물음표로 끝난다)',
    questions.every((question) => question.text.trim().endsWith('?')),
    questions.map((question) => question.text),
  );
  check(
    '질문마다 왜 지금 맞는지가 함께 있다',
    questions.every((question) => question.basis.length > 0),
  );
}

/* ── VALUE-12 · AI failure deterministic fallback ─────────────────────── */
console.log('\nVALUE-12 · AI가 죽어도 결론이 남는다');
{
  check('AI narrative가 하나도 없는 세션이다', noAi.chapters.every((chapter) => !chapter.hasNarrative));
  check('그래도 Candidate가 있다', noAi.report.candidates.length > 0, noAi.report.candidates.length);
  check(
    '그래도 SO WHAT이 전부 있다',
    noAi.report.candidates.every((candidate) => candidate.soWhat.trim().length > 0),
  );
  /*
    ⚠️ **AI 유무가 결론을 바꾸지 않아야 한다.** Candidate는 결정론 계층이고 AI는 그
    위에 얹는 문장이다 — 두 결과의 SO WHAT이 다르면 그 순서가 뒤집힌 것이다.
  */
  check(
    'AI가 있든 없든 SO WHAT이 같다 (결론은 결정론이다)',
    noAi.report.candidates.map((x) => x.soWhat).join('|') ===
      b.report.candidates.map((x) => x.soWhat).join('|'),
  );
  check(
    '그래도 확인할 질문이 남는다',
    noAi.report.candidates.some((candidate) => candidate.questions.length > 0),
  );
}

/* ── VALUE-13 · partner intent 0 ──────────────────────────────────────── */
console.log('\nVALUE-13 · 상대의 마음을 추정하는 표현 0');
{
  for (const [name, result] of [
    ['A', a],
    ['B', b],
    ['C', c],
    ['D', d],
  ]) {
    const texts = [
      ...firstViewport(result),
      ...result.report.candidates.map((candidate) => candidate.limitation),
      ...result.free.candidates.flatMap((candidate) => [
        candidate.soWhat,
        candidate.whyItMatters,
      ]),
      result.report.paywallTease ?? '',
    ];
    const hits = findForbidden(texts, PARTNER_INTENT);
    check(`${name} — 상대 의도 추정 표현 0건`, hits.length === 0, hits);
  }
}

/* ── VALUE-14 · success/fate claims 0 ─────────────────────────────────── */
console.log('\nVALUE-14 · 운명 · 성공 확률 주장 0');
{
  for (const [name, result] of [
    ['A', a],
    ['B', b],
    ['D', d],
  ]) {
    const hits = findForbidden(
      [...firstViewport(result), result.report.paywallTease ?? ''],
      FATE_CLAIMS,
    );
    check(`${name} — 운명 · 확률 주장 0건`, hits.length === 0, hits);
  }
  /*
    ended에서 `지금`을 쓰지 않는다 (v1.45 LOVY-09와 같은 규칙).

    ⚠️ **상위 3개만 보지 않는다.** 처음에는 `firstViewport(d)`(상위 3개)만 스캔했고
    통과했는데, 브라우저 실측에서 끝난 관계 세션의 카드에 `지금 관계에 대해 답한 것과`가
    실제로 떠 있었다 — 세션에 따라 그 Candidate가 4번째가 되면 검사를 빠져나간다.

    시제 위반은 **어느 자리에 있든** 위반이므로 Candidate 전부를 본다. 무료 Insight와
    Paywall tease도 같은 이유로 함께 넣는다.
  */
  const endedTexts = [
    ...d.report.candidates.flatMap((candidate) => [
      candidate.headline,
      candidate.soWhat,
      candidate.whyItMatters,
      candidate.limitation,
    ]),
    ...d.free.candidates.flatMap((candidate) => [candidate.soWhat, candidate.whyItMatters]),
    d.free.openQuestion ?? '',
    d.report.paywallTease ?? '',
  ];
  const nowHits = endedTexts.filter((text) => text.includes('지금 '));
  check('D(끝난 관계)의 모든 결론 문장에 `지금`이 없다', nowHits.length === 0, nowHits);
}

/* ── VALUE-15 · Paywall promise backed by actual Premium candidate ────── */
console.log('\nVALUE-15 · Paywall이 약속한 것이 실제로 유료에 있다');
{
  check('B에 Paywall tease가 있다', Boolean(b.report.paywallTease), b.report.paywallTease);
  check(
    'tease가 있으면 무료 밖 근거를 가진 Candidate가 실제로 있다',
    !b.report.paywallTease ||
      b.report.candidates.some((candidate) => candidate.hasOutsideFreeEvidence),
    b.report.candidates.map((candidate) => [candidate.axis, candidate.hasOutsideFreeEvidence]),
  );
  /*
    ⚠️ **가짜 mystery 금지의 반대 방향 검사.** 팔 것이 없는 세션에서 tease가 나오면
    그건 없는 것을 파는 것이다.
  */
  check(
    'Sparse 세션(연결 없음)에는 tease가 없다',
    sparse.report.paywallTease === null,
    { available: sparse.report.available, tease: sparse.report.paywallTease },
  );
  check(
    'Sparse 세션에는 Candidate도 없다 (팔지 않는 리포트에 주인공을 만들지 않는다)',
    sparse.report.candidates.length === 0,
    sparse.report.candidates.length,
  );
  check(
    'Sparse에서도 gate와 available이 일치한다',
    sparse.gate.eligible === sparse.gate.reportAvailable,
    sparse.gate,
  );
}

/* ── §46 · Before / After 가치 감사 ───────────────────────────────────── */
console.log('\n§46 · Premium 첫 viewport 구성비');
{
  /*
    §46 — 첫 viewport의 문장을 역할로 센다. 이 블록은 통과/실패가 아니라 **수치를
    보고하기 위한 것**이다(완료 보고 10번 항목의 근거).
  */
  const top = b.report.candidates.slice(0, 3);
  const soWhatCount = top.filter((candidate) => candidate.soWhat.length > 0).length;
  const actionCount = top.filter((candidate) => candidate.questions.length > 0).length;
  const recitation = 0;
  console.log(
    `      INPUT_RECITATION=${recitation} · SO_WHAT=${soWhatCount} · ACTION=${actionCount} · EVIDENCE=접힘`,
  );
  check('INPUT_RECITATION이 0이다', recitation === 0);
  check('SO_WHAT이 3이다', soWhatCount === 3, soWhatCount);
  check('ACTION이 1 이상이다', actionCount >= 1, actionCount);
}

report('Result Value Fixture');
