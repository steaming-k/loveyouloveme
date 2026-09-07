/**
 * History Fixture Test (v1.35 · P4-B §9 · §39)
 *
 * H0 ~ H10을 **실제 판정 함수 그대로** 통과시킨다. 계산은 전부
 * `/api/dev/history-test`(개발 전용 라우트)가 화면과 같은 함수로 수행하고,
 * 이 스크립트는 fixture를 만들고 결과를 검증만 한다 — 판정 로직을 복제하지 않는다.
 *
 * 사용법:
 *   1) npm run dev
 *   2) node tests/run-history-fixtures.mjs
 *
 * ⚠️ 새 테스트 프레임워크를 도입하지 않는다. `test:ai` / `test:observed`와 같은 방식이다.
 */

const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';

const failures = [];
let passed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
    return;
  }
  const suffix = detail === undefined ? '' : ` — ${JSON.stringify(detail)}`;
  failures.push(`${label}${suffix}`);
  console.log(`  ✗ ${label}${suffix}`);
}

async function run(body) {
  const response = await fetch(`${BASE_URL}/api/dev/history-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`history-test ${response.status} — dev 서버가 떠 있는지 확인할 것`);
  }
  return response.json();
}

/* ------------------------------------------------------------ fixture 조립 */

const DAY_1 = '2026-08-01T09:00:00.000Z';
const DAY_2 = '2026-09-01T09:00:00.000Z';

/** 관계 기준 5개 — First Contact Report가 만들어지는 최소 조건(내 기준 3개 이상)을 넘긴다 */
const DECLARED_A = { contact: 5, conflict: 'now', alone: 5, affection: 'a3', hobby: 'h3' };
const DECLARED_B = { contact: 2, conflict: 'space', alone: 2, affection: 'a1', hobby: 'h1' };

/** DECLARED_A/B가 만드는 단계 키 — snapshot에 얼려두는 값과 같은 어휘다 */
const LEVELS_A = {
  contact: 'high',
  conflict: 'high',
  alone: 'high',
  affection: 'high',
  hobby: 'high',
};
const LEVELS_B = {
  contact: 'low',
  conflict: 'low',
  alone: 'low',
  affection: 'low',
  hobby: 'low',
};

function soloEntry({ id, createdAt, levels, observed, pairIds = [], sources = ['declared'] }) {
  return {
    id,
    analysisId: `solo-${id}`,
    createdAt,
    audience: 'solo',
    context: { relationshipStatus: null, targetRelation: null },
    profileSnapshot: { mbti: null },
    declaredSnapshot: { contact: null, conflict: null, alone: null, affection: null, hobby: null },
    relationshipEvidence: { important: [], hardest: null, selfGap: null, adaptive: null },
    mirrorSnapshot: { insights: [], focusAxis: null },
    coreInsight: { original: `${id} headline`, userCorrection: null, verdict: null },
    evidenceCoverage: 'medium',
    soloSnapshot: {
      signals: Object.entries(levels).map(([axis, level]) => ({ axis, level })),
      headline: `${id} headline`,
      pairIds,
      sources,
      ...(observed === undefined ? {} : { observed }),
    },
  };
}

/** 커플 기록. `audience`를 **일부러 넣지 않는다** — legacy 경로(§28)를 같은 fixture로 검증한다 */
function coupleEntry({ id, createdAt, states, declared, withAudience = false }) {
  return {
    id,
    analysisId: `couple-${id}`,
    createdAt,
    ...(withAudience ? { audience: 'couple' } : {}),
    context: { relationshipStatus: 'single', targetRelation: 'friend' },
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
      insights: Object.entries(states).map(([axis, state]) => ({
        axis,
        state,
        declaredText: `${axis} declared`,
        relationshipSignal: `${axis} 신호`,
      })),
      focusAxis: null,
    },
    coreInsight: { original: `${id} core`, userCorrection: null, verdict: null },
    evidenceCoverage: 'medium',
  };
}

/* -------------------------------------------------------------- H0 ~ H10 */

console.log('\nH0 — History 없음');
{
  const r = await run({ entries: [], declared: DECLARED_A });
  check('현재 리포트는 만들어진다 (기록 유무와 무관)', r.currentAvailable === true);
  check('커플 비교 불가', r.couple.comparable === false && r.couple.entryCount === 0);
  check('Solo 비교 불가', r.solo.comparable === false && r.solo.entryCount === 0);
  check('반복 신호 0건', r.repeated.length === 0);
  check(
    '비교한 기록이 없다고 보고한다',
    r.couple.compared.previousId === null && r.couple.compared.latestId === null,
  );
  check('Observed 비교 불가 (스냅샷 0)', r.observed.comparable === false && r.observed.snapshotCount === 0);
}

console.log('\nH1 — Solo History 1건');
{
  const entries = [soloEntry({ id: 's1', createdAt: DAY_1, levels: LEVELS_A })];
  const r = await run({ entries, declared: DECLARED_A });
  check('Solo 기록 1건으로 집계', r.solo.entryCount === 1 && r.soloEntryCount === 1);
  check('1건이어도 지금 답과는 비교된다', r.solo.comparable === true);
  check('커플 리포트는 이 기록을 보지 않는다 (audience filter)', r.couple.entryCount === 0);
  check('baseline은 그 기록이다', r.solo.baselineEntryId === 's1');
  check(
    '반복 어휘 없음 — 관찰 2회는 반복의 증거가 아니다',
    r.solo.changes.every((change) => change.repeatable === false),
    r.solo.changes.map((c) => [c.axis, c.observationCount, c.repeatable]),
  );
}

console.log('\nH2 — Solo History 2건 동일');
{
  const entries = [
    soloEntry({ id: 's1', createdAt: DAY_1, levels: LEVELS_A }),
    soloEntry({ id: 's2', createdAt: DAY_2, levels: LEVELS_A }),
  ];
  const r = await run({ entries, declared: DECLARED_A });
  check(
    '전부 STABLE',
    r.solo.changes.every((change) => change.state === 'STABLE'),
    r.solo.changes.map((c) => c.state),
  );
  check(
    '관찰 3회 → 반복 어휘 허용',
    r.solo.changes.every((change) => change.observationCount === 3 && change.repeatable === true),
  );
  check('headline이 유지를 말한다', r.solo.headline === '지난 관찰과 같은 방향으로 답했어.', r.solo.headline);
}

console.log('\nH3 — Solo History 2건 다름');
{
  const entries = [
    soloEntry({ id: 's1', createdAt: DAY_1, levels: LEVELS_B }),
    soloEntry({ id: 's2', createdAt: DAY_2, levels: LEVELS_B }),
  ];
  const r = await run({ entries, declared: DECLARED_A });
  check(
    '전부 CHANGE',
    r.solo.changes.every((change) => change.state === 'CHANGE'),
    r.solo.changes.map((c) => c.state),
  );
  check(
    'CHANGE에는 반복 어휘를 쓰지 않는다 (값이 바뀐 것은 반복이 아니다)',
    r.solo.changes.every((change) => change.observationCount === 1 && change.repeatable === false),
  );
  check(
    '과거 문장이 그때의 값으로 복원된다',
    r.solo.changes.every((change) => typeof change.previousText === 'string' && change.previousText.length > 0),
  );
  check('headline이 "달라졌다"까지만 말한다', /다르게 답했어\.$/.test(r.solo.headline ?? ''), r.solo.headline);
  check(
    'headline에 성향/변화 판정 어휘가 없다',
    !/변했|성격|성향|바뀌었/.test(r.solo.headline ?? ''),
    r.solo.headline,
  );
}

console.log('\nH4 — 같은 날짜 / 같은 값 (근거 묶음 §13)');
{
  const entries = [
    coupleEntry({ id: 'c1', createdAt: DAY_1, states: { contact: 'GAP' } }),
    coupleEntry({ id: 'c2', createdAt: DAY_1, states: { contact: 'GAP' } }),
  ];
  const refs = [
    { source: 'history', entryId: 'c1', axis: 'contact' },
    { source: 'history', entryId: 'c2', axis: 'contact' },
  ];
  const r = await run({ entries, declared: DECLARED_A, evidenceRefs: refs });
  check('같은 문장 2줄이 1줄로 묶인다', r.evidence.length === 1, r.evidence);
  check('개수 정보가 남는다', /\(관찰 2회\)$/.test(r.evidence[0]?.text ?? ''), r.evidence[0]?.text);
  check(
    '반복 신호는 2회로 집계된다',
    r.repeated.some((s) => s.axis === 'contact' && s.occurrences === 2),
    r.repeated,
  );
}

console.log('\nH5 — 같은 날짜 / 다른 값');
{
  const entries = [
    coupleEntry({ id: 'c1', createdAt: DAY_1, states: { contact: 'GAP' } }),
    coupleEntry({ id: 'c2', createdAt: DAY_1, states: { contact: 'CHANGE' } }),
  ];
  const refs = [
    { source: 'history', entryId: 'c1', axis: 'contact' },
    { source: 'history', entryId: 'c2', axis: 'contact' },
  ];
  const r = await run({ entries, declared: DECLARED_A, evidenceRefs: refs });
  check('날짜가 같아도 값이 다르면 묶지 않는다', r.evidence.length === 2, r.evidence.map((e) => e.text));
  check('묶이지 않은 줄에는 개수 표기가 없다', r.evidence.every((e) => !/\(관찰 \d+회\)/.test(e.text)));
  check('상태 전이는 SHIFT로 판정된다', r.couple.states.includes('contact:SHIFT'), r.couple.states);
}

console.log('\nH6 — 3회 STABLE');
{
  const entries = [
    soloEntry({ id: 's1', createdAt: DAY_1, levels: LEVELS_A }),
    soloEntry({ id: 's2', createdAt: DAY_1, levels: LEVELS_A }),
    soloEntry({ id: 's3', createdAt: DAY_2, levels: LEVELS_A }),
  ];
  const r = await run({ entries, declared: DECLARED_A });
  check('관찰 4회로 집계', r.solo.changes.every((change) => change.observationCount === 4));
  check('반복 어휘 허용', r.solo.changes.every((change) => change.repeatable === true));
}

console.log('\nH7 — 2회 STABLE + 지금 값이 달라짐');
{
  const entries = [
    soloEntry({ id: 's1', createdAt: DAY_1, levels: LEVELS_A }),
    soloEntry({ id: 's2', createdAt: DAY_2, levels: LEVELS_A }),
  ];
  const r = await run({ entries, declared: DECLARED_B });
  check('전부 CHANGE', r.solo.changes.every((change) => change.state === 'CHANGE'));
  check(
    '과거에 두 번 같았어도 지금 달라졌으면 반복이라고 하지 않는다',
    r.solo.changes.every((change) => change.repeatable === false && change.observationCount === 1),
  );
}

console.log('\nH8 — legacy Couple entry (audience 필드 없음)');
{
  const entries = [
    coupleEntry({
      id: 'c1',
      createdAt: DAY_1,
      states: { contact: 'MATCH', alone: 'GAP' },
      declared: { contact: 2, alone: 4 },
    }),
    coupleEntry({
      id: 'c2',
      createdAt: DAY_2,
      states: { contact: 'MATCH', alone: 'GAP' },
      declared: { contact: 4, alone: 4 },
    }),
  ];
  const r = await run({ entries, declared: DECLARED_A });
  check('audience가 없으면 couple로 읽는다', r.audiences.every((audience) => audience === 'couple'), r.audiences);
  check('커플 비교가 정상 동작한다', r.couple.comparable === true && r.couple.entryCount === 2);
  check('Declared 값이 실제로 달라진 축은 SHIFT', r.couple.states.includes('contact:SHIFT'), r.couple.states);
  check('달라지지 않은 축은 STABLE', r.couple.states.includes('alone:STABLE'), r.couple.states);
  check('Solo 비교는 이 기록을 보지 않는다', r.solo.comparable === false && r.solo.entryCount === 0);
  check(
    'legacy 기록에 soloSnapshot이 없어도 Observed 비교가 터지지 않는다',
    r.observed.snapshotCount === 0 && r.observed.comparable === false,
  );
}

console.log('\nH9 — Solo + Couple mixed');
{
  const entries = [
    coupleEntry({ id: 'c1', createdAt: DAY_1, states: { contact: 'GAP' }, declared: { contact: 2 } }),
    coupleEntry({ id: 'c2', createdAt: DAY_1, states: { contact: 'MATCH' }, declared: { contact: 4 } }),
    // ⚠️ Solo 관찰이 **마지막에** 저장된 상태. 예전 화면은 이 기록의 날짜로 캡션을 만들었다.
    soloEntry({ id: 's1', createdAt: DAY_2, levels: LEVELS_B }),
  ];
  const r = await run({ entries, declared: DECLARED_A });
  check('audience별 개수가 맞다', r.coupleEntryCount === 2 && r.soloEntryCount === 1);
  check('커플 비교는 커플 기록 2건만 본다', r.couple.entryCount === 2 && r.couple.comparable === true);
  check(
    '비교에 참여한 기록이 커플 기록이다 (마지막 Solo 기록이 아니다)',
    r.couple.compared.previousId === 'c1' && r.couple.compared.latestId === 'c2',
    r.couple.compared,
  );
  check('Solo 비교는 Solo 기록만 본다', r.solo.entryCount === 1 && r.solo.baselineEntryId === 's1');
  check(
    '두 비교가 서로를 오염시키지 않는다',
    r.solo.changes.every((c) => c.state === 'CHANGE') && r.couple.states.includes('contact:SHIFT'),
  );
}

console.log('\nH10 — 기록 1건 삭제 후 재계산');
{
  const s1 = soloEntry({ id: 's1', createdAt: DAY_1, levels: LEVELS_A });
  const s2 = soloEntry({ id: 's2', createdAt: DAY_2, levels: LEVELS_B });

  const before = await run({ entries: [s1, s2], declared: DECLARED_B });
  check(
    '삭제 전 — 최신(s2)이 baseline이고 값이 같아 STABLE',
    before.solo.baselineEntryId === 's2' && before.solo.changes.every((c) => c.state === 'STABLE'),
  );

  const after = await run({ entries: [s1], declared: DECLARED_B });
  check('s2를 지우면 baseline이 s1로 재계산된다', after.solo.baselineEntryId === 's1', after.solo.baselineEntryId);
  check(
    '판정도 즉시 다시 계산된다 (STABLE → CHANGE)',
    after.solo.changes.every((c) => c.state === 'CHANGE'),
    after.solo.changes.map((c) => c.state),
  );
  check('관찰 횟수에 삭제한 snapshot 흔적이 남지 않는다', after.solo.changes.every((c) => c.observationCount === 1));

  const refsAfter = await run({
    entries: [s1],
    declared: DECLARED_B,
    evidenceRefs: [{ source: 'history', entryId: 's2', axis: 'contact' }],
  });
  check('삭제된 기록을 가리키는 근거는 화면에 도달하지 않는다', refsAfter.evidence.length === 0, refsAfter.evidence);
}

/* --------------------------------------------- Observed 시간축 비교 (§5 ~ §8) */

console.log('\nOBS — Observed 시간축 비교');
{
  const past = [{ category: 'cafe', occurrences: 2, strength: 'repeated' }];
  const entries = [soloEntry({ id: 's1', createdAt: DAY_1, levels: LEVELS_A, observed: past })];

  const absent = await run({ entries, declared: DECLARED_A, observedCategories: [] });
  check(
    '지난 관찰에 있던 장면이 이번에 없으면 ABSENT',
    absent.observed.changes.some((c) => c.category === 'cafe' && c.state === 'ABSENT'),
  );
  check(
    'ABSENT 문구는 보이지 않았어까지다 (사라졌다고 과장하지 않는다)',
    absent.observed.changes.every((c) => c.state !== 'ABSENT' || /이번 관찰에서는 보이지 않았어\.$/.test(c.note)),
    absent.observed.changes,
  );
  check(
    '취향/성격 판정 어휘가 없다',
    absent.observed.changes.every((c) => !/취향|좋아|싫어|성향|성격/.test(c.note)),
    absent.observed.changes.map((c) => c.note),
  );

  const fresh = await run({ entries, declared: DECLARED_A, observedCategories: ['outdoor'] });
  check(
    '새로 나타난 장면은 NEW',
    fresh.observed.changes.some((c) => c.category === 'outdoor' && c.state === 'NEW'),
  );
  check('NEW에는 반복 어휘를 쓰지 않는다', fresh.observed.changes.every((c) => c.state !== 'NEW' || c.repeatable === false));

  const stable = await run({ entries, declared: DECLARED_A, observedCategories: ['cafe'] });
  check(
    '이어진 장면은 STABLE',
    stable.observed.changes.some((c) => c.category === 'cafe' && c.state === 'STABLE'),
  );
  check(
    '관찰 2회에서는 반복 어휘를 쓰지 않는다 (§8 · 임계값 3)',
    stable.observed.changes.every((c) => c.repeatable === false),
    stable.observed.changes,
  );
  check(
    '2회 STABLE 문구에 반복 어휘가 없다',
    stable.observed.changes.every((c) => !/반복|계속|꾸준|자주/.test(c.note)),
    stable.observed.changes.map((c) => c.note),
  );

  const threeEntries = [
    soloEntry({ id: 's1', createdAt: DAY_1, levels: LEVELS_A, observed: past }),
    soloEntry({ id: 's2', createdAt: DAY_2, levels: LEVELS_A, observed: past }),
  ];
  const repeated = await run({ entries: threeEntries, declared: DECLARED_A, observedCategories: ['cafe'] });
  check(
    '관찰 3회부터 반복 판정',
    repeated.observed.changes.some((c) => c.category === 'cafe' && c.repeatable === true && c.observationCount === 3),
  );

  const noPhotos = await run({ entries, declared: DECLARED_A, observedCategories: null });
  check(
    '사진이 없으면 ABSENT가 아니라 비교 불가다 (§29 — 사진은 입장권이 아니다)',
    noPhotos.observed.comparable === false && noPhotos.observed.changes.length === 0,
    noPhotos.observed,
  );
  check('사진이 없어도 Solo 비교는 그대로 동작한다', noPhotos.solo.comparable === true);

  const legacySnapshot = [soloEntry({ id: 's1', createdAt: DAY_1, levels: LEVELS_A })];
  const legacy = await run({ entries: legacySnapshot, declared: DECLARED_A, observedCategories: ['cafe'] });
  check(
    'observed를 저장하지 않은 기록은 비교에서 조용히 빠진다 (undefined 와 [] 는 다르다)',
    legacy.observed.snapshotCount === 0 && legacy.observed.comparable === false,
    legacy.observed,
  );
}

/* ---------------------------------- 근거 묶음 — 다른 날짜 / 같은 값 (§13) */

console.log('\nEV — 다른 날짜 / 같은 값');
{
  const entries = [
    coupleEntry({ id: 'c1', createdAt: DAY_1, states: { contact: 'GAP' } }),
    coupleEntry({ id: 'c2', createdAt: DAY_2, states: { contact: 'GAP' } }),
  ];
  const r = await run({
    entries,
    declared: DECLARED_A,
    evidenceRefs: [
      { source: 'history', entryId: 'c1', axis: 'contact' },
      { source: 'history', entryId: 'c2', axis: 'contact' },
    ],
  });
  check('날짜가 다르면 서로 다른 관찰로 남는다', r.evidence.length === 2, r.evidence.map((e) => e.text));
  check(
    '각 줄이 자기 날짜를 갖는다',
    r.evidence.some((e) => e.text.includes('2026.08.01')) &&
      r.evidence.some((e) => e.text.includes('2026.09.01')),
  );
}

console.log('\nEV — Solo 기록의 근거 (§19)');
{
  const entries = [soloEntry({ id: 's1', createdAt: DAY_1, levels: LEVELS_A })];
  const r = await run({
    entries,
    declared: DECLARED_B,
    evidenceRefs: [{ source: 'history', entryId: 's1', axis: 'alone' }],
  });
  check('Solo 기록도 근거로 풀린다 (Mirror 판정이 없어도)', r.evidence.length === 1, r.evidence);
  check(
    '그때 얼려둔 값이 문장으로 복원된다',
    (r.evidence[0]?.text ?? '').startsWith('2026.08.01 기록에서는 '),
    r.evidence[0]?.text,
  );
  check('출처 라벨은 기존 어휘를 쓴다', r.evidence[0]?.sourceLabel === '과거 관찰');
}

/* -------------------------------- ⑧ Solo History Premium 연결 (§19 · §22) */

console.log('\nP8 — Solo History가 Premium source가 되는 조건');
{
  const oneAxisDifferent = { ...LEVELS_A, alone: 'low' };
  const r1 = await run({
    entries: [soloEntry({ id: 's1', createdAt: DAY_1, levels: oneAxisDifferent })],
    declared: DECLARED_A,
  });
  check(
    '한 축만 달라졌으면 연결을 만들지 않는다 (무료 문장 반복 금지 · §22)',
    !r1.insights.some((i) => i.id === 'cs_solohistory_change'),
    r1.insights.map((i) => i.id),
  );

  const r2 = await run({
    entries: [soloEntry({ id: 's1', createdAt: DAY_1, levels: LEVELS_B })],
    declared: DECLARED_A,
  });
  const conn = r2.insights.find((i) => i.id === 'cs_solohistory_change');
  check('두 축 이상 함께 달라지면 연결이 생긴다', Boolean(conn), r2.insights.map((i) => i.id));
  check(
    'source 2종 (history + declared)',
    conn?.sources.length === 2 && conn.sources.includes('history') && conn.sources.includes('declared'),
    conn?.sources,
  );
  check('화면에 도달하는 근거가 2개 이상', (conn?.resolvedEvidenceCount ?? 0) >= 2, conn?.resolvedEvidenceCount);
  check('Premium 게이트가 열린다', r2.deepReportAvailable === true);
  check('인과를 말하지 않는다 (§20)', !/때문에|원인|덕분에/.test(conn?.ruleSummary ?? ''), conn?.ruleSummary);
  check(
    '한계 문장이 과거→현재 인과를 명시적으로 막는다',
    (conn?.limitation ?? '').includes('과거가 지금의 원인이라고는 말할 수 없어'),
    conn?.limitation,
  );
  check('MBTI를 근거로 끌어오지 않는다', !conn?.sources.includes('mbti_lens'), conn?.sources);

  const r3 = await run({ entries: [], declared: DECLARED_A });
  check(
    '기록이 없으면 이 연결로 Premium이 열리지 않는다',
    !r3.insights.some((i) => i.id === 'cs_solohistory_change'),
    r3.insights.map((i) => i.id),
  );
}

/* ------------------- '네가 말한 너' 문구 무결성 (v1.36 Release Gate) ------------------- */

console.log('\nDP — 네가 말한 너 문구가 실제 답을 따라간다');
{
  const HIGH = { contact: 5, conflict: 'now', alone: 5, affection: 'a3', hobby: 'h3' };
  const LOW = { contact: 1, conflict: 'space', alone: 1, affection: 'a1', hobby: 'h1' };
  const MID = { contact: 3, conflict: 'pause', alone: 3, affection: 'a2', hobby: 'h2' };

  const high = await run({ entries: [], declared: HIGH });
  const low = await run({ entries: [], declared: LOW });
  const mid = await run({ entries: [], declared: MID });

  const phraseOf = (r, axis) => r.declaredPhrases.find((p) => p.axis === axis)?.phrase;
  const AXES = ['alone', 'contact', 'hobby', 'conflict', 'affection'];

  check(
    '모든 축에 문구가 있다',
    AXES.every((a) => typeof phraseOf(high, a) === 'string'),
    high.declaredPhrases,
  );
  check(
    '답이 달라지면 문구도 반드시 달라진다 (고정값이 아니다)',
    AXES.every((a) => phraseOf(high, a) !== phraseOf(low, a)),
    AXES.map((a) => [a, phraseOf(high, a), phraseOf(low, a)]),
  );
  check(
    '세 단계가 서로 다른 문구를 갖는다',
    AXES.every((a) => new Set([phraseOf(high, a), phraseOf(mid, a), phraseOf(low, a)]).size === 3),
    AXES.map((a) => [a, phraseOf(high, a), phraseOf(mid, a), phraseOf(low, a)]),
  );
  check(
    '연락 5/5에 "별로 중요하지 않"이 붙지 않는다',
    !/별로 중요하지 않/.test(phraseOf(high, 'contact') ?? ''),
    phraseOf(high, 'contact'),
  );
  check(
    '연락 1/5에 "중요하게 생각"이 붙지 않는다',
    !/중요하게 생각/.test(phraseOf(low, 'contact') ?? ''),
    phraseOf(low, 'contact'),
  );
  check(
    '단계 판정이 First Contact와 같은 함수를 쓴다 (level이 채워진다)',
    AXES.every((a) => ['low', 'mid', 'high'].includes(high.declaredPhrases.find((p) => p.axis === a)?.level)),
    high.declaredPhrases.map((p) => [p.axis, p.level]),
  );

  // Mirror insight / teaser가 같은 문구를 쓴다
  const withExp = await run({
    entries: [],
    declared: HIGH,
    experience: { important: ['contact_drop'], hardest: 'contact_drop', selfGap: 'yes', skipped: false },
  });
  check(
    'Mirror 축 행의 문구가 답과 일치한다',
    withExp.mirrorInsights.every((i) => i.declaredPhrase === phraseOf(high, i.axis)),
    withExp.mirrorInsights.map((i) => [i.axis, i.declaredPhrase]),
  );
  check(
    'Teaser의 관계 문구가 판정이 쓴 근거와 같다 (고정 문장이 아니다)',
    withExp.mirrorTeaser === null ||
      withExp.mirrorInsights.some(
        (i) => i.axis === withExp.mirrorTeaser.axis && i.relationshipSignal === withExp.mirrorTeaser.relationshipPhrase,
      ),
    withExp.mirrorTeaser,
  );
}

console.log('\nPS — Relationship Profile 요약 문법');
{
  const cases = [
    { alone: 5, contact: 3, conflict: 'pause', affection: 'a2', hobby: 'h2' },
    { alone: 3, contact: 5, conflict: 'pause', affection: 'a2', hobby: 'h2' },
    { alone: 3, contact: 3, conflict: 'now', affection: 'a2', hobby: 'h2' },
    { alone: 3, contact: 3, conflict: 'pause', affection: 'a3', hobby: 'h2' },
    { alone: 3, contact: 3, conflict: 'pause', affection: 'a2', hobby: 'h3' },
    { alone: 1, contact: 1, conflict: 'space', affection: 'a1', hobby: 'h1' },
  ];
  const summaries = [];
  for (const declared of cases) {
    const r = await run({ entries: [], declared, experience: { skipped: true } });
    summaries.push(r.profileSummary);
  }
  check(
    '경험 없음일 때 "-고 모습이 보여" 같은 깨진 어미가 없다',
    summaries.every((s) => !/(하고|여기고|좋아하고|느끼고|필요하고) 모습이 보여/.test(s)),
    summaries,
  );
  check('모든 요약이 마침표로 끝난다', summaries.every((s) => /\.$/.test(s)), summaries);
  check(
    '관형형 어미로 이어진다',
    summaries.every((s) => !/모습이 보여/.test(s) || /(는|은|한) 모습이 보여\.$/.test(s)),
    summaries,
  );
}

/* --------------- SO — 샘플 세션 근거 · S07 게이트 (v1.37 Release Gate) --------------- */

console.log('\nSO — 샘플 세션 근거가 샘플 타일과 맞는다');
{
  const r = await run({ entries: [] });
  const { demoTileCount, traits } = r.samplePhotos;

  /**
   * 고정 더미 문장은 어떤 사진을 골라도 같은 말을 한다. 그래서 '반복'·'집계'를 주장하는
   * 순간 그 문장은 근거 없이 판정하는 문장이 된다(§1.5-1 · §8.5).
   */
  const AGGREGATE_CLAIM = /(반복적으로|여러 장|절반 이상|대부분|자주|많은 편|계속)/;
  check(
    '근거 문장이 반복·집계를 주장하지 않는다',
    traits.every((t) => !AGGREGATE_CLAIM.test(t.evidence)),
    traits.filter((t) => AGGREGATE_CLAIM.test(t.evidence)).map((t) => [t.id, t.evidence]),
  );
  check(
    '관찰 라벨도 집계를 주장하지 않는다',
    traits.every((t) => !AGGREGATE_CLAIM.test(t.text)),
    traits.map((t) => [t.id, t.text]),
  );

  /** 근거가 말하는 장수는 샘플 타일 수를 넘을 수 없다 */
  const statedCounts = traits.flatMap((t) =>
    [...t.evidence.matchAll(/(\d+)장/g)].map((m) => ({ id: t.id, n: Number(m[1]) })),
  );
  check(
    '근거가 장수를 말한다 (세지 않고 단정하지 않는다)',
    statedCounts.length > 0,
    traits.map((t) => t.evidence),
  );
  check(
    `말한 장수가 샘플 타일 ${demoTileCount}장을 넘지 않는다`,
    statedCounts.every((c) => c.n >= 1 && c.n <= demoTileCount),
    statedCounts,
  );

  /** 영화관 타일은 p2 하나뿐이다 — v1.36까지 '반복적으로 관찰됐어'라고 말하던 자리 */
  const movie = traits.find((t) => /영화관/.test(t.evidence));
  check('영화관 근거가 1장이라고 말한다', /1장/.test(movie?.evidence ?? ''), movie);
  check('한 장짜리 근거에 high confidence를 붙이지 않는다', movie?.confidence !== 'high', movie);
}

console.log('\nSO — S07이 샘플 타일로 분석을 열지 않는다');
{
  const r = await run({ entries: [] });
  const at = (uploads, samples) =>
    r.photoGate.find((c) => c.uploads === uploads && c.samples === samples);

  check('사진 0장이면 분석이 열리지 않는다', at(0, 0).canAnalyze === false, at(0, 0));
  check(
    '샘플 타일 6장만으로는 분석이 열리지 않는다 (NO_USABLE_IMAGE 경로 차단)',
    at(0, 6).canAnalyze === false && at(0, 6).selected === 6 && at(0, 6).usable === 0,
    at(0, 6),
  );
  check(
    '샘플 타일이 부족한 업로드 수를 대신 채우지 못한다',
    at(2, 4).canAnalyze === false && at(2, 4).selected === 6 && at(2, 4).usable === 2,
    at(2, 4),
  );
  check('업로드 3장이면 분석이 열린다', at(3, 0).canAnalyze === true, at(3, 0));
  check(
    '업로드 3장은 샘플 타일이 섞여 있어도 열린다',
    at(3, 3).canAnalyze === true && at(3, 3).usable === 3,
    at(3, 3),
  );
}

/* ------------- OB — 관찰 시퀀스는 결과를 기다리게 하지 않는다 (v1.38) ------------- */

console.log('\nOB — 궁합 관찰이 사용자를 붙잡아 두지 않는다');
{
  const r = await run({ entries: [] });
  const o = r.observation;

  /**
   * 궁합은 Provider를 기다리는 화면이 아니라 deterministic 계산이다. 그래서 이 시간은
   * 그대로 사용자 대기가 된다 — v1.37까지 1400 x 4 + 500 = 6.1초였고 실측도 6,158ms였다.
   * 3초를 넘기면 '전환'이 아니라 다시 '기다리는 화면'이 된다(기획서 §5.28).
   */
  check('첫 관찰이 3초를 넘지 않는다', o.firstMs <= 3000, o);
  check('첫 관찰이 1.5초보다는 길다 (단계가 순서대로 읽힌다)', o.firstMs >= 1500, o);
  check('재관찰이 첫 관찰보다 짧다', o.revisitMs < o.firstMs, o);
  check('재관찰도 1초 이상은 유지한다', o.revisitMs >= 1000, o);
  check(
    'reduced-motion이 가장 짧다 (단계 대기 없음)',
    o.reducedMs < o.revisitMs && o.reducedMs <= 1000,
    o,
  );

  /**
   * ⚠️ 이 상한은 `ObservationField`의 SVG 연출 예산이다.
   * globals.css `.obs-path`(380ms) + JS stagger(3 x 45 = 135ms) = 515ms 가 한 단계 안에
   * 끝나야 CONNECT 선이 목적지에 닿는다. stageMs를 이 아래로 내리면 선이 잘린다.
   */
  check('한 단계가 CONNECT 연출 예산(515ms) 이상이다', o.stageMs >= 515, o);
  check('총 길이 = stage x 4 + tail', o.firstMs === o.stageMs * 4 + o.tailMs, o);
}

console.log(`\n통과 ${passed}건`);
if (failures.length > 0) {
  console.error(`\n실패 ${failures.length}건:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('ALL PASS');
