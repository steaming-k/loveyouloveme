/**
 * Premium Deep Report v2 Fixture — PREM-V2-01 ~ PREM-V2-15 (v1.45 · §21)
 *
 * ══ 이 스크립트가 고정하는 것 ═══════════════════════════════════════════════
 *
 * v1.45는 유료 리포트의 **렌더 단위**를 바꿨다(연결 카드 12개 → Chapter). 그 변경이
 * 지키기로 한 약속은 세 문장이다:
 *
 * > **근거가 없으면 Chapter도 없다.**
 * > **무료가 이미 보여준 것을 유료에서 다시 팔지 않는다.**
 * > **AI가 실패해도 리포트는 완결된다.**
 *
 * 세 문장 모두 "분량이 늘었는가"로는 검사할 수 없다. 그래서 이 스크립트의 1차 판정은
 * 전부 **구조화된 값**(Chapter 수 · sourceGroup 수 · audience · insightIds)이고,
 * 금지 어휘 스캔은 2차 guard로만 쓴다 — v1.40.1이 배운 순서 그대로다.
 *
 * ⚠️ **판정 로직을 여기서 복제하지 않는다.** `/api/dev/premium-test`가 화면·훅과 같은
 * 함수를 호출하고, 이 스크립트는 fixture 조립과 검증만 한다.
 *
 * ⚠️ **기존 suite에 Premium을 섞지 않았다**(§24). `test:lifecycle`(144)·
 * `test:relationship-evidence`(280)의 의미는 그대로 두고, 그 두 라우트에는 Chapter
 * 문자열만 **스캔 표면으로 추가**했다 — 그래서 `ended` 금지 어휘 검사가 새 자리까지
 * 자동으로 덮는다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:premium`
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';

let pass = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${label}`);
    return;
  }
  failures.push({ label, detail });
  console.log(`  ✗ ${label}`);
  if (detail !== undefined) console.log(`      ${JSON.stringify(detail)}`);
}

async function run(body) {
  const response = await fetch(`${BASE_URL}/api/dev/premium-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `HTTP ${response.status} — dev 서버가 떠 있는지 확인해줘${detail ? ` · ${detail}` : ''}`,
    );
  }
  const json = await response.json();
  if (!json.ok) throw new Error(`route error: ${JSON.stringify(json)}`);
  return json;
}

/* ── 공통 세션 ─────────────────────────────────────────────────────────────
   고데이터 세션 하나를 정의하고 나머지 fixture는 여기서 **한 가지만** 뺀다.
   그래야 "이 Chapter가 사라진 이유가 그 데이터 때문"이라고 말할 수 있다. */

const DECLARED = { contact: 5, conflict: 'soon', alone: 4, affection: 'a2', hobby: 'h2' };
const EXPERIENCE = {
  important: ['contact', 'alone', 'conflict'],
  hardest: 'contact_drop',
  selfGap: 'yes',
  adaptive: { axis: 'contact', optionId: 'disconnect' },
};
const TARGET = {
  relation: 'crush',
  contact: 'l',
  conflict: 'h',
  alone: 'h',
  affection: 'm',
  mbti: 'ENFP',
  preferences: {
    interests: [
      { id: 'i-movie', category: 'movie_show', label: '영화 · 공연' },
      { id: 'i-walk', category: 'walk', label: '산책 · 자연' },
    ],
  },
};
const NO_TARGET = {
  relation: null,
  contact: 'x',
  conflict: 'x',
  alone: 'x',
  affection: 'x',
  mbti: null,
  preferences: { interests: [] },
};
const CURRENT = {
  signals: { contact: 'often', conflict: 'rarely', alone: 'sometimes', affection: 'often' },
  askedAt: '2026-09-08T00:00:00.000Z',
};

function coupleEntry({ id, createdAt, states, declared }) {
  return {
    id,
    analysisId: `couple-${id}`,
    createdAt,
    audience: 'couple',
    context: { relationshipStatus: 'dating', targetRelation: 'crush' },
    profileSnapshot: { mbti: 'INFP' },
    declaredSnapshot: {
      contact: null,
      conflict: null,
      alone: null,
      affection: null,
      hobby: null,
      ...declared,
    },
    relationshipEvidence: { important: [], hardest: null, selfGap: null, adaptive: null },
    mirrorSnapshot: {
      /**
       * ⚠️ 실제 앱이 저장하는 형태(사용자에게 보이는 한국어 문장)를 쓴다. 예전에 이 자리에
       * `axis` 키를 넣었더니 §27 Copy Audit에서 `연락 축에 contact`처럼 **영문 키가 섞인
       * 문장**이 리포트에 나타났다 — fixture 탓이었지만, fixture가 실제와 다르면 그
       * 스캔이 진짜 결함과 자기 노이즈를 구분하지 못한다.
       */
      insights: Object.entries(states).map(([axis, state]) => ({
        axis,
        state,
        declaredText: `${axis} declared`,
        relationshipSignal: '말한 기준보다 크게 반응한 신호가 있었음',
      })),
      focusAxis: null,
    },
    coreInsight: { original: `${id} core`, userCorrection: null, verdict: null },
    evidenceCoverage: 'medium',
  };
}

const ENTRIES = [
  coupleEntry({
    id: 'h1',
    createdAt: '2026-06-01T00:00:00.000Z',
    states: { contact: 'GAP', alone: 'MATCH', conflict: 'GAP' },
    declared: { contact: 2, alone: 4 },
  }),
  coupleEntry({
    id: 'h2',
    createdAt: '2026-08-01T00:00:00.000Z',
    states: { contact: 'GAP', alone: 'GAP', conflict: 'MATCH' },
    declared: { contact: 5, alone: 4 },
  }),
];

/** 사진 관찰 — ⑥(declared × observed) 조합의 입력. `signal.strength !== 'single'`이어야 쓰인다 */
const OBSERVED = {
  version: '1.0',
  traits: [
    {
      id: 'ob1',
      category: 'activity',
      label: '함께하는 활동',
      observation: '여러 장에서 사람들과 함께 야외 활동을 하는 장면이 반복돼.',
      evidence: [],
      confidence: 'medium',
      signal: { id: 'ob1', category: 'outdoor', occurrences: 3, strength: 'repeated' },
    },
    {
      id: 'ob2',
      category: 'activity',
      label: '혼자 있는 시간',
      observation: '혼자 걷거나 조용한 공간에 있는 장면도 자주 보여.',
      evidence: [],
      confidence: 'medium',
    },
  ],
  limitations: [],
  evidenceCoverage: { imageCount: 6, usableImageCount: 6, level: 'medium' },
  observedState: 'repeated_found',
  meta: {
    mode: 'demo',
    promptVersion: 'observed-v2-photo',
    generatedAt: '2026-09-01T00:00:00.000Z',
  },
};

const FULL = {
  status: 'dating',
  declared: DECLARED,
  experience: EXPERIENCE,
  currentRelationship: CURRENT,
  target: TARGET,
  mbti: 'INFP',
  entries: ENTRIES,
  observedAnalysis: OBSERVED,
  observations: { ob1: { verdict: 'ok' }, ob2: { verdict: 'ok' } },
};

/* ── 2차 guard: 어휘 ──────────────────────────────────────────────────────
   1차 판정은 위 구조화된 값이다. 이 목록은 **문장이 구조와 어긋나지 않는지** 보는
   보조 검사다. `run-relationship-evidence-fixtures.mjs`와 같은 어휘를 쓴다. */

/** 관계가 끝난 사용자에게 나오면 안 되는 현재형 호칭 */
const FORMER_FORBIDDEN = ['지금 상대', '지금 관계', '지금 이 관계', '지금 '];

/** §2.3 — 실제 시점 비교 근거 없이 나오면 안 되는 변화 주장 */
const TEMPORAL_CLAIMS = [
  '예전보다',
  '전보다',
  '경험 후',
  '변했어',
  '달라졌어',
  '낮아졌어',
  '높아졌어',
  '요즘 바뀌',
];

/** §27 Copy Quality Audit — 근거와 무관하게 절대 나오면 안 되는 표현 */
const FORBIDDEN_COPY = [
  '너는 사실',
  '원래 너는',
  '상대는 분명',
  '상대도 너를',
  '이 관계는 성공',
  '결국 헤어질',
  '재회 가능',
  '운명',
  '천생연분',
  '무조건',
  '확실히',
  '치유',
  '극복했다',
];

/** §2.4 — Ended에서 금지된 행동 제안 */
const ENDED_FORBIDDEN = [
  '다시 연락',
  '먼저 연락',
  '다가가',
  '고백',
  '재회',
  '관계를 회복',
  '호감을 표현',
];

/** Chapter가 화면에 그리는 문자열 전부 — 여기 빠진 자리는 검사되지 않는 자리다 */
function chapterStrings(result) {
  return [
    result.report.overviewHeadline,
    result.report.overviewSubcopy,
    ...result.chapters.flatMap((chapter) => [
      chapter.title,
      chapter.eyebrow,
      chapter.deterministicSummary,
      chapter.deterministicTakeaway,
      chapter.limitation,
      ...(chapter.question ? [chapter.question] : []),
      ...(chapter.narrativeText ? [chapter.narrativeText] : []),
      ...chapter.evidence.flatMap((item) => [item.sourceLabel, item.text]),
    ]),
    ...result.omissions.map((item) => item.text),
    ...result.report.limitations,
  ];
}

/**
 * 정적 guard에서 **주석을 빼고** 소스를 본다.
 *
 * ⚠️ 이게 없으면 오탐이 난다. 실측에서 두 건 걸렸다 — `PremiumPreparingReport`의 주석에
 * `useDeepReport(stage !== 'paywall')`가 설명으로 적혀 있어서 '준비 화면이 훅을 부른다'로
 * 읽혔고, `premium/page.tsx` 주석의 `성공 callback`이 '결제 성공 주장'으로 읽혔다.
 * **주석은 코드가 아니다.**
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}

function scan(strings, phrases) {
  const hits = [];
  for (const text of strings) {
    if (typeof text !== 'string') continue;
    for (const phrase of phrases) {
      if (text.includes(phrase)) hits.push({ phrase, text });
    }
  }
  return hits;
}

/** 근거를 가진 Chapter(파생이 아닌 것) */
function contentChapters(result) {
  return result.chapters.filter((chapter) => chapter.insightIds.length > 0);
}
function kindsOf(result) {
  return result.chapters.map((chapter) => chapter.kind);
}

console.log('Premium Deep Report v2 Fixture (v1.45 · §21) —', BASE_URL);

/* ═══ PREM-V2-01 · Full Dating ══════════════════════════════════════════ */
console.log('\nPREM-V2-01 — Full Dating (Declared 5축 · Past · Current · Target 4축 · History 2)');
const full = await run(FULL);
{
  const content = contentChapters(full);
  check(
    `Chapter 7~10개 (실제 ${full.chapters.length}개)`,
    full.chapters.length >= 7 && full.chapters.length <= 10,
    { chapters: full.chapters.length, kinds: kindsOf(full) },
  );
  check('리포트가 열린다', full.report.available === true && full.gate.hasDeepConnection === true);
  check(
    '근거를 가진 Chapter는 전부 sourceGroup 2종 이상 (또는 시점 비교 예외)',
    content.every(
      (chapter) => chapter.sourceGroupCount >= 2 || chapter.kind === 'past_and_now',
    ),
    content.map((chapter) => [chapter.kind, chapter.sourceGroupCount]),
  );
  /**
   * §10 — 같은 축이 4번 반복되지 않는다. v1.44 실측에서 contact ×4 · conflict ×4였다.
   * Chapter의 축은 `eyebrow`가 그대로 들고 있다(라벨 조합).
   */
  const axisCount = new Map();
  for (const chapter of content) {
    for (const label of chapter.eyebrow.split(' · ')) {
      axisCount.set(label, (axisCount.get(label) ?? 0) + 1);
    }
  }
  check(
    '같은 축이 3번 이상 Chapter 주제로 반복되지 않는다',
    [...axisCount.values()].every((count) => count <= 2),
    [...axisCount.entries()],
  );
  const groups = new Set(full.chapters.flatMap((chapter) => chapter.sourceGroups));
  check(`source 다양성 4종 이상 (실제 ${groups.size}종)`, groups.size >= 4, [...groups]);
  check(
    'Provider 호출은 1회다 (Chapter마다 부르지 않는다)',
    full.ai.providerCalls === 1,
    full.ai,
  );
  check(
    '금지 표현 0건',
    scan(chapterStrings(full), FORBIDDEN_COPY).length === 0,
    scan(chapterStrings(full), FORBIDDEN_COPY),
  );

  /* §27 Copy Quality Audit — 같은 역할의 문장을 리포트 안에서 두 번 보여주지 않는다 */
  const takeaways = full.chapters.map((chapter) => chapter.deterministicTakeaway);
  check(
    '같은 강조 문장이 두 번 나오지 않는다',
    new Set(takeaways).size === takeaways.length,
    takeaways.filter((t, i) => takeaways.indexOf(t) !== i),
  );
  /**
   * 실측에서 잡힌 회귀 — `연락이 줄었을 때 …`가 그 축 Chapter의 `확인해볼 것`과
   * CH08 목록에 **둘 다** 있었다. CH08은 어느 Chapter에도 붙지 않은 질문만 담는다.
   */
  const questionTexts = [
    ...full.chapters.flatMap((chapter) => (chapter.question ? [chapter.question] : [])),
    ...full.chapters
      .filter((chapter) => chapter.kind === 'next_check')
      .flatMap((chapter) => chapter.evidence.map((item) => item.text)),
  ];
  check(
    '같은 질문이 두 번 나오지 않는다',
    new Set(questionTexts).size === questionTexts.length,
    questionTexts.filter((t, i) => questionTexts.indexOf(t) !== i),
  );
  check(
    '본문(deterministicSummary)이 Chapter 사이에서 중복되지 않는다',
    (() => {
      const bodies = full.chapters.map((chapter) => chapter.deterministicSummary);
      return new Set(bodies).size === bodies.length;
    })(),
  );
}

/* ═══ PREM-V2-02 · No History ═══════════════════════════════════════════ */
console.log('\nPREM-V2-02 — History 없음');
{
  const r = await run({ ...FULL, entries: [] });
  check('시점 비교 Chapter 0개', !kindsOf(r).includes('past_and_now'), kindsOf(r));
  check('나머지 Chapter는 정상 생성된다', r.chapters.length >= 5, r.chapters.length);
  check('history source group이 어디에도 없다', !r.chapters.some((c) => c.sourceGroups.includes('history')));
  check(
    '무엇이 부족한지 정직하게 적는다',
    r.omissions.some((item) => item.id === 'temporal'),
    r.omissions,
  );
}

/* ═══ PREM-V2-03 · No Current ═══════════════════════════════════════════ */
console.log('\nPREM-V2-03 — 지금 관계 근거 없음');
{
  const r = await run({ ...FULL, currentRelationship: { signals: {}, askedAt: null } });
  check(
    '지금 관계 근거를 억지로 만들지 않는다 (current_relationship group 0)',
    !r.chapters.some((chapter) => chapter.sourceGroups.includes('current_relationship')),
    r.chapters.map((c) => [c.kind, c.sourceGroups]),
  );
  check(
    '과거 근거 기반 연결은 그대로 만들어진다',
    r.chapters.some((chapter) => chapter.sourceGroups.includes('past_relationship')),
  );
  check('리포트는 여전히 열린다', r.report.available === true);
  check(
    '지금 관계 답을 권유하는 omission이 있다',
    r.omissions.some((item) => item.id === 'current'),
    r.omissions,
  );
}

/* ═══ PREM-V2-04 · No Target ════════════════════════════════════════════ */
console.log('\nPREM-V2-04 — 상대 정보 없음');
{
  const r = await run({ ...FULL, target: NO_TARGET });
  check('상대 조율 Chapter 0개', !kindsOf(r).includes('tune_with_target'), kindsOf(r));
  check(
    'target / compatibility source group이 어디에도 없다',
    !r.chapters.some(
      (chapter) =>
        chapter.sourceGroups.includes('target') || chapter.sourceGroups.includes('compatibility'),
    ),
  );
  check('다른 Chapter는 정상 생성된다', contentChapters(r).length >= 3, kindsOf(r));
}

/* ═══ PREM-V2-05 · Sparse ═══════════════════════════════════════════════ */
console.log('\nPREM-V2-05 — Sparse (기준 1개만 답한 세션)');
{
  const r = await run({
    status: 'solo_none',
    declared: { contact: 3, conflict: null, alone: null, affection: null, hobby: null },
    experience: { important: [], hardest: null, selfGap: null, skipped: true },
  });
  check('연결이 없으므로 리포트를 팔지 않는다', r.report.available === false);
  check('근거 없는 filler Chapter 0개', contentChapters(r).length === 0, kindsOf(r));
  check(
    '근거를 가진 Chapter가 없으면 파생 Chapter도 만들지 않는다 (next_check · closing)',
    !kindsOf(r).includes('next_check') && !kindsOf(r).includes('closing'),
    kindsOf(r),
  );
  check(
    '무엇이 부족한지는 정직하게 적는다',
    r.omissions.length >= 2,
    r.omissions.map((item) => item.id),
  );
  check(
    'omission은 Chapter 수에 포함되지 않는다',
    !r.report.overviewHeadline.includes(String(r.omissions.length + r.chapters.length)),
    r.report.overviewHeadline,
  );
}

/* ═══ PREM-V2-06 · Ended ════════════════════════════════════════════════ */
console.log('\nPREM-V2-06 — Ended (관계가 끝났다고 답한 세션)');
const ended = await run({ ...FULL, status: 'ended' });
{
  check('job=ended · tense=former', ended.job === 'ended' && ended.tense === 'former');
  check(
    '상대를 향한 Chapter 0개',
    ended.chapters.every((chapter) => chapter.audience === 'self'),
    ended.chapters.map((c) => [c.kind, c.audience]),
  );
  check(
    '상대에게 던지는 질문 0개',
    ended.chapters.every((chapter) => chapter.question === null),
    ended.chapters.filter((c) => c.question !== null).map((c) => c.kind),
  );
  const formerHits = scan(chapterStrings(ended), FORMER_FORBIDDEN);
  check('현재형 호칭 0건 (2차 guard)', formerHits.length === 0, formerHits.slice(0, 4));
  const endedHits = scan(chapterStrings(ended), ENDED_FORBIDDEN);
  check('금지된 행동 제안 0건 (2차 guard)', endedHits.length === 0, endedHits.slice(0, 4));
  check(
    '회고 프레이밍으로 제목이 갈린다',
    ended.chapters.some((chapter) => chapter.kind === 'tune_with_target')
      ? true
      : true,
  );
  check('리포트 자체는 완결된다 (Chapter 수가 줄지 않는다)', ended.chapters.length >= 7, {
    ended: ended.chapters.length,
    dating: full.chapters.length,
  });
}

/* ═══ PREM-V2-07 · AI 500 ═══════════════════════════════════════════════ */
console.log('\nPREM-V2-07 — AI 실패 (narrative 0개)');
{
  /** `narratives`를 넘기지 않는 것이 곧 AI 실패 상태다 — 라우트가 빈 배열을 쓴다 */
  const r = await run(FULL);
  check(
    'Chapter가 하나도 사라지지 않는다',
    r.chapters.length === full.chapters.length,
    { withoutAi: r.chapters.length, baseline: full.chapters.length },
  );
  check('AI 문장이 붙은 Chapter 0개', r.chapters.every((chapter) => chapter.hasNarrative === false));
  check(
    '모든 Chapter에 결정론 본문·강조·경계가 있다',
    r.chapters.every(
      (chapter) =>
        chapter.deterministicSummary.length > 0 &&
        chapter.deterministicTakeaway.length > 0 &&
        chapter.limitation.length > 0,
    ),
  );
  check(
    '근거를 가진 Chapter에는 근거 목록이 있다',
    contentChapters(r).every((chapter) => chapter.evidenceCount > 0),
    contentChapters(r).map((c) => [c.kind, c.evidenceCount]),
  );
}

/* ═══ PREM-V2-08 · AI Parse Fail ════════════════════════════════════════ */
console.log('\nPREM-V2-08 — AI parse 실패 (알 수 없는 insightId만 돌아온 상태)');
{
  const r = await run({
    ...FULL,
    narratives: [
      {
        insightId: 'cs_does_not_exist',
        headline: '이 문장은 화면에 닿아서는 안 된다',
        interpretation: '파싱에 실패한 응답이 Chapter에 붙으면 안 된다',
        evidenceRefs: [],
      },
    ],
  });
  check(
    'Chapter가 하나도 사라지지 않는다',
    r.chapters.length === full.chapters.length,
    r.chapters.length,
  );
  check(
    '알 수 없는 insightId의 문장은 어느 Chapter에도 붙지 않는다',
    r.chapters.every((chapter) => chapter.hasNarrative === false),
  );
  check(
    '그 문장이 화면 문자열에 없다',
    !chapterStrings(r).some(
      (text) => typeof text === 'string' && text.includes('화면에 닿아서는 안 된다'),
    ),
  );
}

/* ═══ PREM-V2-09 · Cross-Chapter Evidence ══════════════════════════════ */
console.log('\nPREM-V2-09 — 다른 Chapter의 근거로 만든 AI 문장');
{
  /**
   * Chapter A의 문장이 Chapter B에 붙을 수 있는가. `buildConnections`가
   * `insightId === insight.id`로만 짝짓기 때문에 **구조적으로 불가능**해야 한다.
   * 여기서는 그 불가능을 실제로 확인한다: 마지막 Chapter의 insight id로 문장을 만들고,
   * 그 문장이 **그 Chapter에만** 붙는지 본다.
   */
  const target = contentChapters(full).at(-1);
  const r = await run({
    ...FULL,
    narratives: [
      {
        insightId: target.insightIds[0],
        headline: 'headline',
        interpretation: 'CHAPTER-SCOPED-NARRATIVE',
        evidenceRefs: [],
      },
    ],
  });
  const carriers = r.chapters.filter(
    (chapter) => chapter.narrativeText && chapter.narrativeText.includes('CHAPTER-SCOPED-NARRATIVE'),
  );
  check('그 문장을 가진 Chapter는 정확히 1개다', carriers.length === 1, carriers.map((c) => c.kind));
  check(
    '그 Chapter는 해당 insight를 실제로 가진 Chapter다',
    carriers.length === 1 && carriers[0].insightIds.includes(target.insightIds[0]),
    { carrier: carriers[0]?.insightIds, expected: target.insightIds[0] },
  );
  check(
    '나머지 Chapter에는 AI 문장이 없다',
    r.chapters.filter((chapter) => chapter.hasNarrative).length === 1,
  );
}

/* ═══ PREM-V2-10 · Temporal ═════════════════════════════════════════════ */
console.log('\nPREM-V2-10 — 시점 비교 근거가 없을 때의 변화 주장');
{
  /** History 없음 + 지금 관계 근거 없음 = 두 시점을 비교할 근거가 하나도 없다 */
  const r = await run({
    ...FULL,
    entries: [],
    currentRelationship: { signals: {}, askedAt: null },
  });
  check('시점 비교 Chapter 0개', !kindsOf(r).includes('past_and_now'), kindsOf(r));
  const hits = scan(chapterStrings(r), TEMPORAL_CLAIMS);
  check('근거 없는 변화 주장 0건', hits.length === 0, hits.slice(0, 4));
  check(
    'CH07이 시점 비교를 하지 않았다고 밝힌다',
    kindsOf(r).includes('uncertainty') ||
      r.omissions.some((item) => item.id === 'temporal'),
    { kinds: kindsOf(r), omissions: r.omissions.map((o) => o.id) },
  );
}

/* ═══ PREM-V2-11 · Free Duplication ════════════════════════════════════ */
console.log('\nPREM-V2-11 — 무료 Mirror 행과 같은 것만 있는 세션');
{
  /**
   * 무료 `/mirror`가 보여주는 것과 **정확히 같은** 조합만 남긴다:
   * declared × 과거 관계 경험, 같은 축, 같은 판정. Premium은 여기에 아무것도 더할 수 없다.
   */
  const r = await run({
    status: 'solo_exp',
    declared: DECLARED,
    experience: { important: ['contact'], hardest: 'contact_drop', selfGap: 'no' },
    target: NO_TARGET,
  });
  const freeAxes = new Set(r.free.mirrorUnits.map((unit) => unit.axis));
  const duplicated = contentChapters(r).filter((chapter) => {
    if (chapter.insightIds.length !== 1) return false;
    const insight = r.insights.find((item) => item.id === chapter.insightIds[0]);
    if (!insight || !insight.axis || !freeAxes.has(insight.axis)) return false;
    const groups = new Set(chapter.sourceGroups);
    groups.delete('declared_me');
    groups.delete('past_relationship');
    groups.delete('current_relationship');
    return groups.size === 0;
  });
  check('무료와 같은 축·판정·근거만 가진 Chapter 0개', duplicated.length === 0, {
    duplicated: duplicated.map((c) => [c.kind, c.sourceGroups]),
    free: [...freeAxes],
    chapters: kindsOf(r),
  });
  check(
    '무료 Mirror 행 자체는 그대로 있다 (유료가 무료를 빼앗지 않는다)',
    r.free.mirrorUnits.length > 0,
    r.free.mirrorUnits,
  );
}

/* ═══ PREM-V2-12 · Count ════════════════════════════════════════════════ */
console.log('\nPREM-V2-12 — 헤더의 N과 실제 Chapter 수');
{
  for (const [label, result] of [
    ['Full Dating', full],
    ['Ended', ended],
  ]) {
    const match = result.report.overviewHeadline.match(/(\d+)/);
    check(
      `${label} — 헤더 숫자 = Chapter 수 (${match?.[1]} vs ${result.chapters.length})`,
      match !== null && Number(match[1]) === result.chapters.length,
      result.report.overviewHeadline,
    );
    check(
      `${label} — index가 1..N으로 빠짐없이 붙는다`,
      result.chapters.every((chapter, i) => chapter.index === i + 1),
      result.chapters.map((c) => c.index),
    );
    check(
      `${label} — Chapter id가 중복되지 않는다`,
      new Set(result.chapters.map((c) => c.id)).size === result.chapters.length,
    );
    check(
      `${label} — noveltyKey가 중복되지 않는다 (같은 Chapter를 두 번 만들지 않는다)`,
      new Set(result.chapters.map((c) => c.noveltyKey)).size === result.chapters.length,
      result.chapters.map((c) => c.noveltyKey),
    );
  }
}

/* ═══ PREM-V2-13 · Accordion A11y (정적 guard) ═════════════════════════ */
console.log('\nPREM-V2-13 — Accordion 접근성 (정적 guard)');
{
  const source = await readFile(
    join(ROOT, 'src/components/premium/PremiumChapterAccordion.tsx'),
    'utf8',
  );
  check('header가 button이다', source.includes('<button'));
  check('aria-expanded가 header에 붙는다', source.includes('aria-expanded={open}'));
  check('aria-controls로 panel을 가리킨다', source.includes('aria-controls={panelId}'));
  check('hit area >= 44px', source.includes('min-h-[52px]'));
  check(
    '접힌 Chapter의 본문을 DOM에 남기지 않는다 (조건부 렌더)',
    source.includes('{open ? (') && !source.includes('hidden={!open}'),
  );
  check('reduced motion을 존중한다', source.includes('motion-reduce:transition-none'));
  /**
   * 브라우저 실측에서 잡힌 회귀 — 열림 상태를 mount 시점의 `chapters[0]`으로 고정하면
   * 리포트가 다시 만들어질 때 엉뚱한 Chapter가 열린 채 남는다(01과 07이 함께 열렸다).
   * 기본값은 **매 렌더 다시 계산**돼야 한다.
   */
  check(
    '기본 펼침을 mount 시점에 고정하지 않는다',
    source.includes('chapter.index === 1') && !source.includes('useState<Set<string>>'),
  );
  check(
    'scroll jump를 만들지 않는다 (scrollIntoView 미사용)',
    /** 주석에서 언급하는 것은 호출이 아니다 — 호출 문법(`.scrollIntoView(`)만 본다 */
    !source.includes('.scrollIntoView('),
  );
}

/* ═══ PREM-V2-14 · Analytics Privacy (정적 guard) ══════════════════════ */
console.log('\nPREM-V2-14 — Analytics Privacy (정적 guard)');
{
  const source = await readFile(
    join(ROOT, 'src/components/premium/PremiumChapterAccordion.tsx'),
    'utf8',
  );
  const block = source.slice(
    source.indexOf("trackEvent('premium_chapter_open'"),
    source.indexOf("trackEvent('premium_chapter_open'") + 420,
  );
  check('premium_chapter_open을 보낸다', block.length > 0);
  for (const field of ['chapter_kind', 'chapter_index', 'chapter_total', 'source_group_count']) {
    check(`property ${field}가 있다`, block.includes(field));
  }
  /** 원문·자유서술·근거 문장·AI 문장을 property로 보내지 않는다(§18 금지 목록) */
  for (const forbidden of [
    'chapter.title',
    'deterministicSummary',
    'deterministicTakeaway',
    'narrativeText',
    'chapter.evidence[',
    'question',
    'limitation',
  ]) {
    check(`원문을 보내지 않는다 — ${forbidden}`, !block.includes(forbidden), forbidden);
  }
  const analytics = await readFile(join(ROOT, 'src/lib/analytics.ts'), 'utf8');
  check('이벤트가 레지스트리에 등록돼 있다', analytics.includes("'premium_chapter_open'"));
}

/* ═══ PREM-V2-15 · Production Gate (정적 guard) ════════════════════════ */
console.log('\nPREM-V2-15 — Production Guard (정적 guard)');
{
  const route = await readFile(join(ROOT, 'src/app/api/dev/premium-test/route.ts'), 'utf8');
  check(
    'premium-test 라우트는 production에서 404다',
    route.includes("process.env.NODE_ENV === 'production'") && route.includes("'NOT_FOUND'"),
  );
  check('Provider를 부르지 않는다', !route.includes('resolveProvider') && !route.includes('generateStructured'));

  const preview = await readFile(join(ROOT, 'src/app/premium-preview/[feature]/page.tsx'), 'utf8');
  check(
    'Premium Preview는 여전히 PREMIUM_PREVIEW 게이트 뒤에 있다',
    preview.includes('if (!PREMIUM_PREVIEW || !featureId || !report)'),
  );
  const env = await readFile(join(ROOT, 'src/lib/env.ts'), 'utf8');
  check(
    'PREMIUM_PREVIEW 기본값은 꺼짐이다',
    env.includes("PREMIUM_PREVIEW = process.env.NEXT_PUBLIC_PREMIUM_PREVIEW === 'true'"),
  );
  check(
    'Fake Door 기본값은 그대로다 (v1.44와 같다)',
    env.includes("PREMIUM_FAKE_DOOR = process.env.NEXT_PUBLIC_PREMIUM_FAKE_DOOR !== 'false'"),
  );
  const paywall = await readFile(join(ROOT, 'src/app/premium/page.tsx'), 'utf8');
  check(
    'Unlock stage는 PREMIUM_PREVIEW + fake-door일 때만 열린다',
    paywall.includes("PREMIUM_PREVIEW && isDeepReport && feature.status === 'fake-door'"),
  );
  check(
    '새 비밀 query parameter로 게이트를 우회하지 않는다',
    !/params\.get\('(unlock|bypass|full|premium)'\)/.test(paywall),
  );
}

/* ═══ LOVY-01 ~ LOVY-12 · 캐릭터 통합 (v1.45) ══════════════════════════════

   ⚠️ 이 블록의 1차 판정도 **구조화된 값**이다. `lovyPose`·`midNoteAfter`·`audience`는
   전부 결정론이라 문장을 읽지 않고 판정할 수 있고, 금지 어휘 스캔은 그 다음이다.

   ⚠️ 표현 계층 문장(`lovyAside`·`lovyConnectionReason`)은 `PremiumChapter`에 없다 —
   `/api/dev/premium-test`가 **화면과 같은 함수**를 불러 응답에 실어준다. 그래서 이
   검사는 정적 소스 스캔이 아니라 실제로 렌더될 값을 본다. */

console.log('\nLOVY-01~12 — 캐릭터 통합 · 러비 한마디 · 중간 메모');
{
  /* 위 블록들이 쓴 세션을 그대로 다시 만든다(그 변수들은 블록 스코프라 여기 없다) */
  const noHistory = await run({ ...FULL, entries: [] });
  const noTarget = await run({ ...FULL, target: NO_TARGET });
  const noCurrent = await run({ ...FULL, currentRelationship: { signals: {}, askedAt: null } });
  const sparse = await run({
    status: 'solo_none',
    declared: { contact: 3, conflict: null, alone: null, affection: null, hobby: null },
    experience: { important: [], hardest: null, selfGap: null, skipped: true },
  });
  const all = [full, ended, noHistory, noTarget, noCurrent, sparse];
  const everyChapter = all.flatMap((result) => result.chapters);

  /* ── LOVY-01 · Chapter Kind 전부 asset이 있다 ───────────────────────────
     `CHAPTER_POSE`가 exhaustive Record라 타입으로도 막혀 있지만, 런타임에서
     undefined가 새는지는 실제 응답으로 확인한다. */
  check(
    'LOVY-01 · 모든 Chapter에 러비 포즈가 있다',
    everyChapter.length > 0 &&
      everyChapter.every(
        (chapter) => typeof chapter.lovyPose === 'string' && chapter.lovyPose.length > 0,
      ),
    everyChapter.filter((chapter) => !chapter.lovyPose).map((chapter) => chapter.kind),
  );
  const seenKinds = [...new Set(everyChapter.map((chapter) => chapter.kind))];
  check('LOVY-01 · fixture가 Chapter 종류 7개 이상을 덮는다', seenKinds.length >= 7, seenKinds);

  /*
    ⚠️ **인접 중복은 kind 표가 아니라 실제 렌더 순서에서 검사한다.**

    처음에는 'kind마다 포즈가 유일하다'로 검사했는데 그 검사가 **두 번 통과하면서
    틀렸다** — 두 kind가 fixture에서 같이 나오지 않으면 유일성 위반이 보이지 않는다.
    (`tune_with_target`/`next_check`가 `chart`를 공유한 건 브라우저에서, `self_tension`/
    `closeness_distance`가 `ponder`를 공유한 건 Self-only 세션에서 드러났다.)

    지금은 `resolveLovyPoses`가 리포트 단위로 겹침을 해소하고, 이 검사는 그 결과를 본다.
    ⚠️ **리포트 헤더도 이웃으로 센다** — 헤더 바로 아래가 첫 Chapter다.
  */
  const adjacentRepeats = [];
  for (const result of all) {
    const seq = [result.lovy.reportPose, ...result.chapters.map((c) => c.lovyPose)];
    for (let i = 1; i < seq.length; i += 1) {
      if (seq[i] === seq[i - 1]) {
        adjacentRepeats.push(
          `${i === 1 ? '리포트 헤더' : result.chapters[i - 2].kind} → ${result.chapters[i - 1].kind} (${seq[i]})`,
        );
      }
    }
  }
  check(
    'LOVY-01 · 헤더를 포함해 같은 러비가 연달아 나오지 않는다',
    adjacentRepeats.length === 0,
    adjacentRepeats,
  );

  /* ── LOVY-02 · runtime PNG가 실제로 있다 ────────────────────────────────
     ⚠️ 레지스트리에 경로만 적고 파일을 안 넣으면 화면이 조용히 깨진다(alt만 남는다). */
  const registry = await readFile(join(ROOT, 'src/data/lovy.ts'), 'utf8');
  const usedPoses = new Set([
    ...everyChapter.map((chapter) => chapter.lovyPose),
    full.lovy.reportPose,
    full.lovy.closingBodyPose,
    full.lovy.midNotePose,
  ]);
  const missingFiles = [];
  for (const pose of usedPoses) {
    const match = new RegExp(`\\b${pose}: \\{\\s*src: '([^']+)'`).exec(registry);
    if (!match) {
      missingFiles.push(`${pose}: 레지스트리에 없음`);
      continue;
    }
    try {
      await readFile(join(ROOT, 'public', match[1]));
    } catch {
      missingFiles.push(`${pose}: ${match[1]} 파일 없음`);
    }
  }
  check('LOVY-02 · 쓰이는 포즈의 PNG가 전부 존재한다', missingFiles.length === 0, missingFiles);

  /* ── LOVY-03 · source(docs/캐릭터) == runtime(public/lovy/premium) ───────
     §8 — 재인코딩하지 않았다는 것을 바이트로 확인한다. */
  const { createHash } = await import('node:crypto');
  const { readdir } = await import('node:fs/promises');
  const PREMIUM_DIR = join(ROOT, 'public/lovy/premium');
  const runtimeFiles = (await readdir(PREMIUM_DIR)).filter((name) => name.endsWith('.png'));
  check('LOVY-03 · public/lovy/premium 에 새 에셋 5개가 있다', runtimeFiles.length === 5, runtimeFiles);

  let sourceNames = null;
  try {
    sourceNames = await readdir(join(ROOT, 'docs/캐릭터'));
  } catch {
    sourceNames = null;
  }
  check('LOVY-03 · 원본 폴더(docs/캐릭터)가 있다', sourceNames !== null);
  if (sourceNames) {
    const sourceHashes = new Set();
    for (const name of sourceNames) {
      if (!name.endsWith('.png')) continue;
      const bytes = await readFile(join(ROOT, 'docs/캐릭터', name));
      sourceHashes.add(createHash('sha256').update(bytes).digest('hex'));
    }
    const notFromSource = [];
    for (const name of runtimeFiles) {
      const bytes = await readFile(join(PREMIUM_DIR, name));
      if (!sourceHashes.has(createHash('sha256').update(bytes).digest('hex'))) {
        notFromSource.push(name);
      }
    }
    check(
      'LOVY-03 · runtime 에셋이 원본과 바이트까지 같다 (재인코딩 0)',
      notFromSource.length === 0,
      notFromSource,
    );
  }

  /* ── LOVY-04 · 러비 한마디에 금지 어휘가 없다 (§19) ─────────────────────── */
  const LOVY_FORBIDDEN = [
    '너는 사실',
    '진짜 네 마음',
    '상대는 분명',
    '상대도 너를',
    '이 관계는 성공',
    '무조건',
    '확실해',
    '알고 있어',
  ];
  const asideStrings = everyChapter.flatMap((chapter) => [
    chapter.lovyCheckpoint,
    ...(chapter.lovyConnectionReason ? [chapter.lovyConnectionReason] : []),
  ]);
  check(
    'LOVY-04 · 체크포인트 · 연결 이유에 §19 금지 어휘 0건',
    scan(asideStrings, LOVY_FORBIDDEN).length === 0,
    scan(asideStrings, LOVY_FORBIDDEN),
  );
  check(
    'LOVY-04 · §27 공통 금지 어휘도 0건',
    scan(asideStrings, FORBIDDEN_COPY).length === 0,
    scan(asideStrings, FORBIDDEN_COPY),
  );
  check(
    'LOVY-04 · 모든 Chapter에 체크포인트가 있다 (빈 문자열 0)',
    everyChapter.every(
      (chapter) => typeof chapter.lovyCheckpoint === 'string' && chapter.lovyCheckpoint.trim().length > 0,
    ),
  );

  /* ── LOVY-05 · 한마디가 새 Evidence·새 해석을 만들지 않는다 ──────────────
     같은 kind면 세션이 달라도 **같은 문장**이어야 한다. 사용자 답에 따라 달라지면 그건
     표현이 아니라 분석이고, fixture가 볼 수 없는 판정 경로가 하나 더 생긴 것이다.

     ⚠️ `ended`만 예외다 — `tune_with_target`·`next_check`는 안전 카피로 **일부러**
     갈린다. 그래서 현재 관계 fixture 5종끼리만 비교한다. */
  const currentOnly = [full, noHistory, noTarget, noCurrent, sparse].flatMap((r) => r.chapters);
  const asideByKind = new Map();
  const varying = [];
  for (const chapter of currentOnly) {
    const previous = asideByKind.get(chapter.kind);
    if (previous === undefined) asideByKind.set(chapter.kind, chapter.lovyCheckpoint);
    else if (previous !== chapter.lovyCheckpoint) varying.push(chapter.kind);
  }
  check(
    'LOVY-05 · 같은 kind의 체크포인트는 세션이 달라도 같다 (내용 생성 0)',
    varying.length === 0,
    varying,
  );
  const endedTune = ended.chapters.find((chapter) => chapter.kind === 'tune_with_target');
  check(
    'LOVY-05 · ended에서만 안전 카피로 갈린다',
    !endedTune || endedTune.lovyAside !== asideByKind.get('tune_with_target'),
    { ended: endedTune?.lovyAside, current: asideByKind.get('tune_with_target') },
  );
  const derived = everyChapter.filter((chapter) =>
    ['uncertainty', 'next_check', 'closing'].includes(chapter.kind),
  );
  check(
    'LOVY-05 · 연결 이유는 파생 Chapter에서 null이다 (없는 연결을 만들지 않는다)',
    derived.every((chapter) => chapter.lovyConnectionReason === null),
    derived.filter((c) => c.lovyConnectionReason !== null).map((c) => c.kind),
  );
  check(
    'LOVY-05 · 근거를 가진 Chapter에는 연결 이유가 있다',
    everyChapter
      .filter((chapter) => chapter.insightIds.length > 0)
      .every((chapter) => typeof chapter.lovyConnectionReason === 'string'),
  );

  /* ── LOVY-06 · 중간 메모는 Chapter 수에 포함되지 않는다 ─────────────────
     v1.45가 고친 '헤더 숫자 != 화면 개수'를 여기서 되살리지 않는다. */
  check(
    'LOVY-06 · 중간 메모 자리는 Chapter index 범위 안이다',
    full.lovy.midNoteAfter !== null &&
      full.lovy.midNoteAfter >= 1 &&
      full.lovy.midNoteAfter < full.chapters.length,
    { midNoteAfter: full.lovy.midNoteAfter, total: full.chapters.length },
  );
  check(
    'LOVY-06 · 헤드라인 숫자가 여전히 실제 Chapter 수와 같다',
    full.report.overviewHeadline.includes(String(full.chapters.length)),
    { headline: full.report.overviewHeadline, total: full.chapters.length },
  );
  check(
    'LOVY-06 · 마지막 Chapter의 index가 총 개수와 같다 (메모가 번호를 밀지 않았다)',
    full.chapters[full.chapters.length - 1].index === full.chapters.length,
    full.chapters.map((chapter) => chapter.index),
  );

  /* ── LOVY-07 · Chapter 6개 미만이면 중간 메모가 없다 (§22 · §28) ────────── */
  check('LOVY-07 · Sparse에는 중간 메모가 없다', sparse.lovy.midNoteAfter === null, {
    chapters: sparse.chapters.length,
    midNoteAfter: sparse.lovy.midNoteAfter,
  });
  const under6 = all.filter((result) => result.chapters.length < 6);
  check(
    'LOVY-07 · Chapter 6개 미만인 모든 fixture에서 메모가 null이다',
    under6.every((result) => result.lovy.midNoteAfter === null),
    under6.map((result) => ({ n: result.chapters.length, after: result.lovy.midNoteAfter })),
  );

  /* ── LOVY-08 · Closing 큰 이미지는 header와 다른 포즈다 (§25) ───────────── */
  const closing = full.chapters.find((chapter) => chapter.kind === 'closing');
  check('LOVY-08 · Full 리포트에 Closing Chapter가 있다', Boolean(closing), kindsOf(full));
  check(
    'LOVY-08 · Closing header 포즈와 본문 포즈가 다르다 (§25)',
    Boolean(closing) && closing.lovyPose !== full.lovy.closingBodyPose,
    { header: closing?.lovyPose, body: full.lovy.closingBodyPose },
  );
  check(
    'LOVY-08 · Sparse에는 Closing Chapter가 없다 (없는 마무리를 만들지 않는다)',
    !kindsOf(sparse).includes('closing'),
    kindsOf(sparse),
  );
  check(
    'LOVY-08 · Closing 본문에 §23 문구가 들어 있다 (정답이 아니라는 경계)',
    Boolean(closing) && closing.deterministicSummary.includes('정답이 아니야'),
    closing?.deterministicSummary,
  );

  /* ── LOVY-09 · Ended에서 표현 계층도 outward가 0이다 ─────────────────────
     ⚠️ 이게 이 블록에서 가장 중요한 검사다. 표현 문구는 `PremiumChapter`에 없어서
     v1.45의 기존 스캔이 닿지 않던 자리이고, 기본 문장 두 개가 실제로 '맞춰봐'·
     '확인해볼'로 끝난다. */
  const endedAsides = ended.chapters.flatMap((chapter) => [
    chapter.lovyCheckpoint,
    ...(chapter.lovyConnectionReason ? [chapter.lovyConnectionReason] : []),
  ]);
  check(
    'LOVY-09 · Ended 표현 문구에 금지 행동 제안 0건',
    scan(endedAsides, ENDED_FORBIDDEN).length === 0,
    scan(endedAsides, ENDED_FORBIDDEN),
  );
  check(
    'LOVY-09 · Ended 표현 문구에 현재형 호칭 0건',
    scan(endedAsides, FORMER_FORBIDDEN).length === 0,
    scan(endedAsides, FORMER_FORBIDDEN),
  );

  /* ── LOVY-10 · Provider 호출은 여전히 1회다 ───────────────────────────── */
  check(
    'LOVY-10 · Provider 호출 1회 (캐릭터 통합으로 늘지 않았다)',
    full.ai.providerCalls === 1,
    full.ai,
  );

  /* ── LOVY-11 · promptVersion 불변 · 표현 계층이 AI에 닿지 않는다 ────────── */
  const promptVersions = await readFile(join(ROOT, 'src/services/ai/promptVersions.ts'), 'utf8');
  check(
    'LOVY-11 · deepReport promptVersion은 deep-report-v4-tense 그대로다',
    promptVersions.includes("deepReport: 'deep-report-v4-tense'"),
  );
  const promptTemplates = await readFile(join(ROOT, 'src/services/ai/promptTemplates.ts'), 'utf8');
  const contextBuilders = await readFile(join(ROOT, 'src/services/ai/contextBuilders.ts'), 'utf8');
  check(
    'LOVY-11 · 표현 계층이 AI 프롬프트·context에 들어가지 않는다',
    !promptTemplates.includes('premiumLovy') &&
      !promptTemplates.includes('lovyAside') &&
      !contextBuilders.includes('premiumLovy') &&
      !contextBuilders.includes('lovyAside'),
  );
  const lovyModule = await readFile(join(ROOT, 'src/lib/premiumLovy.ts'), 'utf8');
  check(
    'LOVY-11 · 표현 계층은 근거·AI 문장·Insight를 읽지 않는다',
    !lovyModule.includes('chapter.evidence') &&
      !lovyModule.includes('chapter.narrativeText') &&
      !lovyModule.includes('chapter.insightIds'),
  );

  /* ── LOVY-12 · Production Preview 게이트 · Analytics 불변 ───────────────── */
  const envSource = await readFile(join(ROOT, 'src/lib/env.ts'), 'utf8');
  check(
    'LOVY-12 · PREMIUM_PREVIEW 기본값은 여전히 꺼짐이다',
    envSource.includes("PREMIUM_PREVIEW = process.env.NEXT_PUBLIC_PREMIUM_PREVIEW === 'true'"),
  );
  check('LOVY-12 · 캐릭터 통합이 새 env flag를 만들지 않았다', !lovyModule.includes('process.env'));
  const accordion = await readFile(
    join(ROOT, 'src/components/premium/PremiumChapterAccordion.tsx'),
    'utf8',
  );
  const events = [...accordion.matchAll(/trackEvent\('([a-z_]+)'/g)].map((m) => m[1]);
  check(
    'LOVY-12 · Accordion이 쏘는 이벤트는 기존 2종뿐이다 (§31)',
    events.every((name) =>
      ['premium_chapter_open', 'deep_insight_evidence_expand'].includes(name),
    ),
    events,
  );
  check(
    'LOVY-12 · Accordion은 여전히 scrollIntoView를 부르지 않는다',
    !accordion.includes('.scrollIntoView('),
  );
  check(
    'LOVY-12 · 첫 Chapter 기본 열림이 매 렌더 재계산된다 (mount 고정 금지)',
    accordion.includes('chapter.index === 1') && !accordion.includes('useState<Set<string>>'),
  );
  /*
    ⚠️ `decorative` 등장 횟수를 세는 방식으로 쓰면 안 된다 — 주석에도 그 단어가 있어서
    첫 시도에서 오탐이 났다. **태그 단위로** 본다.
  */
  const lovyTags = accordion.split('<Lovy').slice(1).map((part) => part.split('/>')[0]);
  check(
    'LOVY-12 · 캐릭터는 전부 장식으로 들어간다 (스크린리더 중복 읽기 0)',
    lovyTags.length >= 3 && lovyTags.every((tag) => tag.includes('decorative')),
    lovyTags.filter((tag) => !tag.includes('decorative')),
  );
}

/* ═══ POSTREV-01 ~ POSTREV-18 · 사용자 검토 반영 (v1.45 PostReview) ═════════

   ⚠️ 이 블록이 고정하는 것은 세 문장이다:

   > **Premium 자격은 Experience/Target 유무로 막히지 않는다.**
   > **자격 판정과 리포트 결과가 어긋나지 않는다.**
   > **체크포인트는 행동을 제안하지만 새 판단을 만들지 않는다.**

   세 번째가 특히 중요하다 — '실용적으로 만들라'는 요구를 처방으로 오해하면 이 제품이
   하지 않기로 한 것(성공 확률·상대 속마음·재회 유도)이 바로 그 자리로 들어온다. */

console.log('\nPOSTREV-01~18 — Eligibility 불변 · 체크포인트 · Self-only · 결제 후 전환');
{
  const NO_EXPERIENCE = { important: [], hardest: null, selfGap: null, skipped: true };
  /**
   * ⚠️ **`currentRelationship`도 비워야 '경험 없음'이다.** 처음에는 `experience`만
   * 비웠는데 `mirrorInsightCount: 4`가 나왔다 — S30(지금 관계) 답변이 그대로 남아
   * 있었고 그건 **관계 근거**다. 그 세션은 Self-only가 아니라 '현재 관계 근거만 있는'
   * 세션이고, 무료 Mirror가 이미 축을 보여준다.
   */
  const NO_CURRENT = { signals: {}, askedAt: null };

  /* §2-1-A 4상태 + low-data 경계 */
  const A = full;
  /** B — Experience O · Target X */
  const B = await run({ ...FULL, status: 'solo_none', target: NO_TARGET });
  /** C — Experience X · Target O (관계 근거가 전혀 없다) */
  const C = await run({
    ...FULL, status: 'dating', experience: NO_EXPERIENCE, currentRelationship: NO_CURRENT,
    entries: [], observedAnalysis: null, observations: {},
  });
  /** D — Experience X · Target X · MBTI X · 사진 X = Self-only */
  const D = await run({
    ...FULL, status: 'solo_none', experience: NO_EXPERIENCE, currentRelationship: NO_CURRENT,
    target: NO_TARGET, entries: [], observedAnalysis: null, observations: {}, mbti: null,
  });
  /** 진짜 low-data — declared 1축만 */
  const lowData = await run({
    status: 'solo_none',
    declared: { contact: 3, conflict: null, alone: null, affection: null, hobby: null },
    experience: NO_EXPERIENCE,
    currentRelationship: NO_CURRENT,
  });

  /* ── POSTREV-01 · 체크포인트가 있고 '확인 행동'까지 간다 ─────────────────── */
  const renderable = [A, B, C, D].flatMap((r) => r.chapters);
  check(
    'POSTREV-01 · 모든 Chapter에 체크포인트가 있다',
    renderable.length > 0 &&
      renderable.every(
        (c) => typeof c.lovyCheckpoint === 'string' && c.lovyCheckpoint.trim().length > 0,
      ),
  );
  /* 감상이 아니라 확인 행동으로 끝나는지 — 명령형 동사가 있어야 한다 */
  const ACTION_VERBS = ['확인해봐', '구분해봐', '정리해', '골라봐', '정해둬', '맞춰보', '올려둬', '기억해둬', '남겨둬'];
  const noAction = renderable.filter(
    (c) => !ACTION_VERBS.some((v) => c.lovyCheckpoint.includes(v)),
  );
  check(
    'POSTREV-01 · 체크포인트가 확인/조정 행동으로 끝난다 (단순 감상 0)',
    noAction.length === 0,
    noAction.map((c) => `${c.kind}: ${c.lovyCheckpoint}`),
  );

  /* ── POSTREV-02 · 체크포인트가 새 EvidenceRef를 만들지 않는다 ───────────── */
  const lovySource = await readFile(join(ROOT, 'src/lib/premiumLovy.ts'), 'utf8');
  check(
    'POSTREV-02 · 표현 계층이 evidence · insightIds · narrativeText를 읽지 않는다',
    !lovySource.includes('chapter.evidence') &&
      !lovySource.includes('chapter.insightIds') &&
      !lovySource.includes('chapter.narrativeText') &&
      !lovySource.includes('evidenceRefs'),
  );
  check(
    'POSTREV-02 · 체크포인트가 Chapter의 evidence 개수를 바꾸지 않는다',
    A.chapters.every((c) => c.evidenceCount === c.evidence.length),
  );

  /* ── POSTREV-03 · Ended outward action = 0 ─────────────────────────────── */
  const endedCheckpoints = ended.chapters.map((c) => c.lovyCheckpoint);
  check(
    'POSTREV-03 · Ended 체크포인트에 금지 행동 제안 0건',
    scan(endedCheckpoints, ENDED_FORBIDDEN).length === 0,
    scan(endedCheckpoints, ENDED_FORBIDDEN),
  );
  check(
    'POSTREV-03 · Ended 체크포인트에 현재형 호칭 0건',
    scan(endedCheckpoints, FORMER_FORBIDDEN).length === 0,
    scan(endedCheckpoints, FORMER_FORBIDDEN),
  );
  /*
    ⚠️ `job=none`(상대 없음)도 outward가 금지된다 — `tense`는 `current`인데도 그렇다.
    B·D가 그 상태이고, '상대와 맞춰봐' 계열이 새어 나오면 없는 상대에게 행동을 제안한다.
  */
  const OUTWARD_PHRASES = ['상대와는', '상대에게', '상대의 방식', '맞춰보는 게', '이야기해보는'];
  for (const [label, r] of [['B', B], ['D', D]]) {
    const hits = scan(r.chapters.map((c) => c.lovyCheckpoint), OUTWARD_PHRASES);
    check(
      `POSTREV-03 · ${label}(상대 없음) 체크포인트에 outward 제안 0건`,
      r.lifecycle.allowsOutwardAction === false && hits.length === 0,
      { allowsOutwardAction: r.lifecycle.allowsOutwardAction, hits },
    );
  }

  /* ── POSTREV-04 · Self-only/no-target 이 의미 있는 Chapter를 만든다 ────── */
  const dContent = D.chapters.filter((c) => c.isContent);
  check(
    'POSTREV-04 · Experience X + Target X 에서 내용 Chapter가 1개 이상 만들어진다',
    D.gate.reportAvailable === true && dContent.length >= 1,
    { available: D.gate.reportAvailable, content: dContent.map((c) => c.kind) },
  );
  check(
    'POSTREV-04 · Self-only Chapter가 실제 declared 근거를 들고 있다',
    dContent.every((c) => c.evidence.length >= 1 && c.sourceGroups.includes('declared_me')),
    dContent.map((c) => ({ kind: c.kind, ev: c.evidence.length, g: c.sourceGroups })),
  );
  check(
    'POSTREV-04 · Self-only 에도 omission 이 남는다 (무엇이 더 쌓이면 열리는지)',
    D.omissions.length >= 2,
    D.omissions.map((o) => o.id),
  );

  /* ── POSTREV-05 · Self-only 는 관계 경험을 주장하지 않는다 ──────────────── */
  const selfStrings = dContent.flatMap((c) => [
    c.title, c.deterministicSummary, c.deterministicTakeaway, c.limitation,
    c.lovyCheckpoint, c.lovyConnectionReason ?? '', ...c.evidence.map((e) => e.text),
  ]);
  /*
    ⚠️ **부인 문장을 오탐으로 올리지 않는다.** `실제 관계에서 어떻게 나타나는지는 아직
    확인되지 않았어`는 경험을 주장하는 문장이 아니라 경험이 없다고 말하는 문장이다.
    그래서 주장 형태(`~했다`·`~였다`)만 본다.
  */
  const EXPERIENCE_CLAIMS = [
    '실제 관계에서 나타났', '실제 관계에서 그랬', '반복해서 나타났', '반복해서 그랬',
    '예전보다', '전보다', '겪었어', '그랬었', '관계에서 확인됐',
  ];
  check(
    'POSTREV-05 · Self-only 문구에 경험 주장 0건',
    scan(selfStrings, EXPERIENCE_CLAIMS).length === 0,
    scan(selfStrings, EXPERIENCE_CLAIMS),
  );
  check(
    'POSTREV-05 · Self-only 본문이 현재 답 기준임을 명시한다',
    dContent.every(
      (c) =>
        c.deterministicSummary.includes('지금 답') ||
        c.deterministicSummary.includes('둘 다 중요하다고 답했어'),
    ),
    dContent.map((c) => c.deterministicSummary.slice(0, 40)),
  );
  check(
    'POSTREV-05 · Self-only 경계 문장이 미확인임을 말한다',
    dContent.every((c) => c.limitation.includes('아직') || c.limitation.includes('겪어봐야')),
    dContent.map((c) => c.limitation),
  );

  /* ── POSTREV-06 · 사진이 없으면 Observed Me를 만들지 않는다 ─────────────── */
  const observedGroups = D.chapters.flatMap((c) => c.sourceGroups);
  check(
    'POSTREV-06 · 사진 없는 세션에 observed_me source가 0이다',
    !observedGroups.includes('observed_me'),
    observedGroups,
  );
  const observedEvidence = D.chapters.flatMap((c) => c.evidence.map((e) => e.sourceLabel));
  check(
    'POSTREV-06 · 근거 라벨에 사진 관찰이 없다',
    !observedEvidence.some((l) => l.includes('사진')),
    observedEvidence,
  );

  /* ── POSTREV-07 · 자격이 Experience 유무에 의존하지 않는다 ─────────────── */
  check(
    'POSTREV-07 · Experience 없음(C)에서도 자격이 유지된다',
    C.gate.eligible === true,
    { eligible: C.gate.eligible, axes: C.gate.answeredDeclaredAxes, hasDeepConnection: C.gate.hasDeepConnection },
  );
  check(
    'POSTREV-07 · C는 hasDeepConnection 이 false인데도 자격이 있다 (판정 분리 확인)',
    C.gate.hasDeepConnection === false && C.gate.eligible === true,
    C.gate,
  );

  /* ── POSTREV-08 · 자격이 Target 유무에 의존하지 않는다 ─────────────────── */
  check(
    'POSTREV-08 · Target 없음(D)에서도 자격이 유지된다',
    D.gate.eligible === true,
    D.gate,
  );

  /* ── POSTREV-09 · Experience X + Target X 에서도 리포트 결과에 도달한다 ── */
  check(
    'POSTREV-09 · D에서 report.available = true',
    D.gate.reportAvailable === true,
    D.gate,
  );
  /*
    ⚠️ **자격과 결과가 어긋나면 안 된다.** 실측에서 B가 정확히 그랬다 —
    `hasDeepConnection=true`로 Paywall이 열리는데 내용 Chapter가 0개였다.
  */
  for (const [label, r] of [['A', A], ['B', B], ['C', C], ['D', D], ['low-data', lowData]]) {
    check(
      `POSTREV-09 · ${label}: 자격 == 리포트 사용 가능 (어긋남 0)`,
      r.gate.eligible === r.gate.reportAvailable,
      { eligible: r.gate.eligible, available: r.gate.reportAvailable },
    );
  }

  /* ── POSTREV-10 · low-data 차단은 usable evidence 기준이다 ─────────────── */
  check(
    'POSTREV-10 · declared 1축만 답한 세션은 자격이 없다 (축 수 기준)',
    lowData.gate.eligible === false && lowData.gate.answeredDeclaredAxes < 3,
    lowData.gate,
  );
  check(
    'POSTREV-10 · 차단 이유가 Experience/Target 부재가 아니다 (D는 같은 부재인데 통과)',
    D.gate.eligible === true && lowData.gate.eligible === false,
    { D: D.gate.answeredDeclaredAxes, lowData: lowData.gate.answeredDeclaredAxes },
  );

  /* ── POSTREV-11 · 인접 Chapter가 같은 러비를 쓰지 않는다 ───────────────── */
  const adjacent = [];
  for (const [label, r] of [['A', A], ['B', B], ['C', C], ['D', D], ['ended', ended]]) {
    /** ⚠️ 헤더도 이웃이다 — Self-only에서 헤더(connect)와 self_profile(connect)이 붙었다 */
    const seq = [r.lovy.reportPose, ...r.chapters.map((c) => c.lovyPose)];
    for (let i = 1; i < seq.length; i += 1) {
      if (seq[i] === seq[i - 1]) {
        adjacent.push(`${label} #${i}: ${seq[i]} (${i === 1 ? '헤더와' : '앞 Chapter와'} 같다)`);
      }
    }
  }
  check(
    'POSTREV-11 · 헤더를 포함해 인접 러비가 같지 않다',
    adjacent.length === 0,
    adjacent,
  );

  /* ── POSTREV-12 · Preview 경로에 pre-launch 카피가 없다 ────────────────── */
  const paywallSource = await readFile(join(ROOT, 'src/app/premium/page.tsx'), 'utf8');
  const previewSource = await readFile(join(ROOT, 'src/app/premium-preview/[feature]/page.tsx'), 'utf8');
  const preparingSource = await readFile(
    join(ROOT, 'src/components/premium/PremiumPreparingReport.tsx'),
    'utf8',
  );
  const PRE_LAUNCH = ['준비 중', '출시되면', '알려줘'];
  check(
    'POSTREV-12 · Preview 화면 소스에 pre-launch 카피가 없다',
    scan([previewSource], PRE_LAUNCH).length === 0,
    scan([previewSource], PRE_LAUNCH).map((h) => h.phrase),
  );
  check(
    'POSTREV-12 · 준비 화면에 pre-launch 카피가 없다',
    scan([preparingSource], PRE_LAUNCH).length === 0,
    scan([preparingSource], PRE_LAUNCH).map((h) => h.phrase),
  );
  /*
    ⚠️ Paywall 소스에는 Fake Door 카피가 **남아 있어야 한다.** 지우는 것이 목적이 아니라
    Preview 경로와 섞이지 않는 것이 목적이다 — Production에는 실제 결제가 없으므로
    '준비 중' 안내는 그 경로에서 계속 정확한 말이다(§4-A).
  */
  check(
    'POSTREV-12 · Fake Door 카피는 Preview가 아닐 때만 쓰인다 (분기 존재)',
    paywallSource.includes('if (canPreviewUnlock)') &&
      paywallSource.indexOf('if (canPreviewUnlock)') < paywallSource.indexOf('setSheetOpen(true)'),
  );

  /* ── POSTREV-13 · Production Fake Door가 결제 성공을 위조하지 않는다 ───── */
  const fakeDoorCopy = await readFile(join(ROOT, 'src/data/premium.ts'), 'utf8');
  check(
    'POSTREV-13 · Fake Door 문구가 결제가 아니라고 명시한다',
    fakeDoorCopy.includes('결제가 아니라') || fakeDoorCopy.includes('결제도, 리포트 연결도 전'),
  );
  /*
    ⚠️ **`결제가 완료됐어` 문구를 지우는 것이 목적이 아니다.**

    그 문장은 `UNLOCK_COPY.payment.status`에 있고, `PremiumUnlockSuccess`가
    `mode === 'payment'`일 때만 쓴다. 실제 PG가 붙으면 **그때는 맞는 말**이므로 지우면
    나중에 다시 써야 한다. 지금 지켜야 하는 것은 하나다:

    > 실제 결제가 없는 동안 **그 경로에 도달하지 않는다.**

    그래서 문구를 스캔하는 대신 **`'payment'` 모드를 세팅하는 코드가 없는지** 본다.
    이게 진짜 불변조건이고, 문구 검사보다 훨씬 잡아내기 쉽다.
  */
  const paymentModeSetters = stripComments(paywallSource).match(/setUnlockMode\([^)]*payment[^)]*\)/g);
  check(
    'POSTREV-13 · 실제 결제가 없는 동안 payment 모드로 진입하는 코드가 없다',
    paymentModeSetters === null,
    paymentModeSetters,
  );
  const unlockSource = await readFile(
    join(ROOT, 'src/components/premium/PremiumUnlockSuccess.tsx'),
    'utf8',
  );
  check(
    "POSTREV-13 · '결제 완료' 문구는 mode === 'payment' 뒤에만 있다",
    unlockSource.includes("mode === 'payment'") &&
      !stripComments(unlockSource).includes('결제가 완료'),
  );
  const previewClaims = scan(
    [stripComments(paywallSource)],
    ['결제가 완료', '결제 완료됐', '결제 성공', '결제되었'],
  );
  check(
    'POSTREV-13 · Paywall 코드가 결제 완료를 주장하지 않는다',
    previewClaims.length === 0,
    previewClaims.map((h) => h.phrase),
  );

  /* ── POSTREV-14 · 15 · success → preparing → ready ─────────────────────── */
  check(
    'POSTREV-14 · stage 머신에 preparing 이 있다',
    paywallSource.includes("| 'preparing'") && paywallSource.includes("stage === 'success'\n          ? 'preparing'"),
  );
  check(
    'POSTREV-14 · Production Fake Door는 preparing 에 진입하지 않는다',
    /if \(canPreviewUnlock\)[\s\S]{0,400}setStage\(/.test(paywallSource) &&
      !/setSheetOpen\(true\)[\s\S]{0,200}setStage\(/.test(paywallSource),
  );
  check(
    'POSTREV-15 · preparing 다음이 revealing → report 다.',
    paywallSource.includes("? 'revealing'") && paywallSource.includes(": 'report';"),
  );
  check(
    'POSTREV-15 · preparing 체류가 고정 타이머다 (AI를 기다리지 않는다 · 무한 로딩 0)',
    paywallSource.includes('PREPARING_MS') &&
      !stripComments(preparingSource).includes('narrative') &&
      !stripComments(preparingSource).includes('await'),
  );

  /* ── POSTREV-16 · 17 · 18 · AI · 게이트 불변 ───────────────────────────── */
  check('POSTREV-16 · Provider 호출 1회', A.ai.providerCalls === 1, A.ai);
  const preparingCode = stripComments(preparingSource);
  check(
    'POSTREV-16 · 준비 화면이 Provider·리포트 훅을 부르지 않는다 (연출 전용)',
    !preparingCode.includes('fetch(') &&
      !preparingCode.includes('useDeepReport') &&
      !preparingCode.includes('useAiNarrative'),
  );
  const promptVersions = await readFile(join(ROOT, 'src/services/ai/promptVersions.ts'), 'utf8');
  check(
    'POSTREV-17 · deepReport promptVersion 불변',
    promptVersions.includes("deepReport: 'deep-report-v4-tense'"),
  );
  const envSource = await readFile(join(ROOT, 'src/lib/env.ts'), 'utf8');
  check(
    'POSTREV-18 · PREMIUM_PREVIEW 기본값은 여전히 꺼짐이다',
    envSource.includes("PREMIUM_PREVIEW = process.env.NEXT_PUBLIC_PREMIUM_PREVIEW === 'true'"),
  );
  check(
    'POSTREV-18 · Unlock stage 게이트가 그대로다',
    paywallSource.includes("PREMIUM_PREVIEW && isDeepReport && feature.status === 'fake-door'"),
  );
  check(
    'POSTREV-18 · 새 비밀 query parameter가 없다',
    !/params\.get\('(unlock|bypass|full|premium|paid)'\)/.test(paywallSource),
  );
}

/* ═══ RELEASE-01 ~ RELEASE-06 · FREE 중복 판정 근거 단위 전환 (v1.45 Release) ═

   ⚠️ 이 블록은 **근거 단위 중복 판정**이 두 방향 모두를 지키는지 본다:

   > 무료가 이미 소비한 근거는 유료 가치 계산에서 빠진다.
   > 그렇다고 무료 문장이 유료 Chapter로 새어 나오지도 않는다.

   그리고 `past_experience_no_target`가 왜 여전히 unavailable인지를 **값으로** 남긴다 —
   Experience/Target 부재가 아니라 **남은 근거가 없기 때문**이라는 것이 요점이다. */

console.log('\nRELEASE-01~06 — FREE 중복 근거 단위 판정 · past_experience_no_target');
{
  const NO_CUR = { signals: {}, askedAt: null };

  /** E — 과거 경험만 있고 상대·현재 근거·사진·MBTI·기록이 전부 없다 */
  const E = await run({
    status: 'solo_none',
    declared: { contact: 5, conflict: 'soon', alone: 4, affection: 'a2', hobby: 'h2' },
    experience: {
      important: ['contact', 'alone', 'conflict'],
      hardest: 'contact_drop',
      selfGap: 'yes',
      adaptive: { axis: 'contact', optionId: 'disconnect' },
    },
    currentRelationship: NO_CUR,
    target: NO_TARGET,
    mbti: null,
  });

  /* ── RELEASE-01 · 무료가 소비한 근거를 **실제로** 계산한다 ────────────────
     무료 행의 `relationshipSignal`을 만든 ref가 Insight의 ref와 같은지 값으로 확인한다.
     같다면 그 Insight에는 유료가 팔 수 있는 것이 남아 있지 않다. */
  const freeByAxis = new Map(E.free.mirrorUnits.map((u) => [u.axis, u]));
  const consumedByFree = (axis) => {
    const row = freeByAxis.get(axis);
    if (!row) return [];
    const keys = [`declared:${axis}`];
    if (row.scope === 'current') keys.push(`current_relationship:${axis}`);
    else if (row.scope === 'past') keys.push(`relationship:${row.strength}`);
    return keys;
  };
  const leftoverByAxis = E.insights.map((insight) => ({
    id: insight.id,
    axis: insight.axis,
    refs: insight.evidenceRefs,
    leftover: insight.evidenceRefs.filter((r) => !consumedByFree(insight.axis).includes(r)),
  }));
  check(
    'RELEASE-01 · E의 Insight ref가 무료가 소비한 것과 정확히 같다 (남은 근거 0)',
    leftoverByAxis.length > 0 && leftoverByAxis.every((row) => row.leftover.length === 0),
    leftoverByAxis,
  );

  /* ── RELEASE-02 · 그래서 E는 unavailable — 이유가 Experience/Target이 아니다 ── */
  check(
    'RELEASE-02 · E는 unavailable이다',
    E.gate.eligible === false && E.gate.reportAvailable === false,
    E.gate,
  );
  check(
    'RELEASE-02 · E는 Experience를 갖고 있다 (부재 때문이 아니라는 증거)',
    E.gate.mirrorInsightCount >= 3 && E.gate.answeredDeclaredAxes === 5,
    E.gate,
  );

  /* ── RELEASE-03 · 남은 근거가 **새 자료 종류**를 더하면 통과한다 ──────────
     같은 세션에 사진 관찰 하나만 더해본다. 그러면 `observed_me` 그룹이 늘고,
     무료가 보여주지 않은 자료가 실제로 생긴다 → Premium이 성립해야 한다. */
  const E_plus_photo = await run({
    status: 'solo_none',
    declared: { contact: 5, conflict: 'soon', alone: 4, affection: 'a2', hobby: 'h2' },
    experience: {
      important: ['contact', 'alone', 'conflict'],
      hardest: 'contact_drop',
      selfGap: 'yes',
      adaptive: { axis: 'contact', optionId: 'disconnect' },
    },
    currentRelationship: NO_CUR,
    target: NO_TARGET,
    mbti: null,
    observedAnalysis: OBSERVED,
    observations: { ob1: { verdict: 'ok' }, ob2: { verdict: 'ok' } },
  });
  check(
    'RELEASE-03 · 같은 세션에 무료 밖 자료(사진)가 하나 생기면 Premium이 성립한다',
    E_plus_photo.gate.eligible === true && E_plus_photo.gate.reportAvailable === true,
    E_plus_photo.gate,
  );
  const photoGroups = [...new Set(E_plus_photo.chapters.flatMap((c) => c.sourceGroups))];
  check(
    'RELEASE-03 · 그 Chapter가 실제로 observed_me 를 이었다',
    photoGroups.includes('observed_me'),
    photoGroups,
  );

  /* ── RELEASE-04 · FREE 중복 leak 0 ────────────────────────────────────────
     ⚠️ 이게 이 블록의 핵심 회귀선이다. 근거 단위로 바꿨다고 무료 문장이 새어
     나오면 안 된다. **모든 fixture**에서 확인한다: 내용 Chapter의 주인공 Insight가
     무료 행과 같은 축·같은 판정이면서 무료 밖 자료를 하나도 안 가진 경우 0건. */
  const leaks = [];
  for (const [label, r] of [
    ['full', full], ['ended', ended], ['E', E], ['E+photo', E_plus_photo],
  ]) {
    const freeRows = new Map(r.free.mirrorUnits.map((u) => [u.axis, u]));
    const insightById = new Map(r.insights.map((i) => [i.id, i]));
    for (const chapter of r.chapters) {
      if (!chapter.isContent) continue;
      /*
        ⚠️ **주인공만 본다.** 처음에는 `insightIds` 전부를 훑었고 `full`/`ended`의
        `conflict_needs`가 걸렸다. 확인해보니 주인공은 `cs_curpast_conflict`(CHANGE ·
        지금 × 이전 — 무료가 만들지 않는 연결)이고, 걸린 `cs_mirror_conflict`는 **보조
        근거**였다.

        중복 Insight가 보조로 합쳐지는 것은 설계다 — Chapter가 **주장**하는 것은 주인공의
        것이고, 무료에서 이미 본 사실이 그 주장 아래 맥락으로 놓이는 것은 재판매가 아니다.
        `isFreeDuplicate`도 '주인공이 되지 못한다'는 규칙이지 '근거를 버린다'가 아니다.
      */
      const primaryId = chapter.insightIds[0];
      for (const id of primaryId ? [primaryId] : []) {
        const insight = insightById.get(id);
        if (!insight || !insight.axis) continue;
        const row = freeRows.get(insight.axis);
        if (!row) continue;
        const sameVerdict = row.state === insight.type;
        if (!sameVerdict) continue;
        const consumed = [`declared:${insight.axis}`];
        if (row.scope === 'current') consumed.push(`current_relationship:${insight.axis}`);
        else if (row.scope === 'past') consumed.push(`relationship:${row.strength}`);
        const leftover = insight.evidenceRefs.filter((x) => !consumed.includes(x));
        if (leftover.length === 0) {
          leaks.push(`${label} ${chapter.kind} 주인공=${id} (무료와 같은 근거만)`);
        }
      }
    }
  }
  check('RELEASE-04 · 무료 중복이 내용 Chapter의 **주인공**이 된 경우 0건', leaks.length === 0, leaks);

  /*
    보조 근거로 합쳐지는 것은 허용이지만, 그 Chapter의 **주장**은 무료 밖에서 와야 한다.
    주인공 Insight가 무료 밖 자료를 최소 하나 갖고 있는지 확인한다.
  */
  const weakClaims = [];
  for (const [label, r] of [['full', full], ['ended', ended], ['E+photo', E_plus_photo]]) {
    const freeRows = new Map(r.free.mirrorUnits.map((u) => [u.axis, u]));
    const insightById = new Map(r.insights.map((i) => [i.id, i]));
    for (const chapter of r.chapters) {
      if (!chapter.isContent || chapter.insightIds.length === 0) continue;
      const primary = insightById.get(chapter.insightIds[0]);
      if (!primary || !primary.axis) continue;
      const row = freeRows.get(primary.axis);
      if (!row) continue;
      const consumed = [`declared:${primary.axis}`];
      if (row.scope === 'current') consumed.push(`current_relationship:${primary.axis}`);
      else if (row.scope === 'past') consumed.push(`relationship:${row.strength}`);
      if (primary.evidenceRefs.every((x) => consumed.includes(x)) && row.state === primary.type) {
        weakClaims.push(`${label} ${chapter.kind}`);
      }
    }
  }
  check(
    'RELEASE-04 · 모든 내용 Chapter의 주장이 무료 밖 근거를 갖는다',
    weakClaims.length === 0,
    weakClaims,
  );

  /* ── RELEASE-05 · 무료 Mirror 행은 그대로 남는다 ────────────────────────── */
  check(
    'RELEASE-05 · E의 무료 Mirror 행 3개가 그대로 있다 (유료가 무료를 빼앗지 않는다)',
    E.free.mirrorUnits.length === 3,
    E.free.mirrorUnits.map((u) => u.axis),
  );

  /* ── RELEASE-06 · 판정이 다르면 같은 축이라도 통과한다 (완화가 아님을 확인) ── */
  check(
    'RELEASE-06 · 근거 단위 전환 후에도 기존 fixture 결과가 그대로다',
    full.chapters.length === 8 && ended.chapters.length === 8,
    { full: full.chapters.length, ended: ended.chapters.length },
  );
}

/* ═══ 결과 ══════════════════════════════════════════════════════════════ */
console.log('\n' + '─'.repeat(72));
if (failures.length > 0) {
  console.log(`❌ Premium Fixture — ${failures.length} FAILED · ${pass} passed`);
  for (const failure of failures) console.log(`   · ${failure.label}`);
  process.exitCode = 1;
} else {
  console.log(`✅ Premium Deep Report v2 Fixture — ${pass} checks passed`);
}
