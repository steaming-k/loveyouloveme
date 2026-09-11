/**
 * Relationship Evidence Fixture — E0~E17 (v1.41 · §39.22)
 *
 * ══ 이 스크립트가 고정하는 것 ═══════════════════════════════════════════════
 *
 * v1.41의 주장은 한 줄이다: **RELATIONSHIP STAGE ≠ RELATIONSHIP EVIDENCE TIMEFRAME.**
 * 그 주장이 코드에서 참인지 두 방향으로 검사한다.
 *
 * ```
 * ① stage → evidence 로 새지 않는가   dating인데 근거를 안 넣으면 current가 0이어야 한다
 * ② evidence → stage 로 눌리지 않는가 talking인데 근거를 넣으면 current가 쓰여야 한다
 * ```
 *
 * 그리고 v1.41이 **바꾸지 않기로 한 것**을 함께 고정한다(E0). 현재 근거가 없는 세션의
 * 동기화율·comparedCount·Mirror 판정·focus 축·근거 문장·Premium 게이트는 v1.40.1과
 * 글자 하나 달라지면 안 된다 — 그게 이 버전이 안전한 이유의 전부다.
 *
 * ⚠️ **판정 로직을 여기서 복제하지 않는다.** `/api/dev/lifecycle-test`가 화면과 같은
 * 함수(`resolveAxisEvidence`·`buildMirrorReport`·`buildCrossSourceInsights`·
 * `buildRelationshipDeepReport`·`buildHistoryEntry`)를 호출하고, 이 스크립트는 fixture
 * 조립과 검증만 한다. `run-lifecycle-fixtures.mjs`와 같은 방식이다.
 *
 * ⚠️ **문장을 파싱해 시점을 추측하지 않는다.** 1차 판정은 라우트가 낸 구조화된
 * `scope` 값이고, 문자열 검사는 2차 guard로만 쓴다 — v1.40.1이 배운 순서 그대로다
 * (금지어는 주제를 막고 대상·시점은 막지 못한다).
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:relationship-evidence`
 */

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
  const response = await fetch(`${BASE_URL}/api/dev/lifecycle-test`, {
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

async function runExpectingRejection(body) {
  const response = await fetch(`${BASE_URL}/api/dev/lifecycle-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

/* ── 공통 세션 ─────────────────────────────────────────────────────────────
   `run-lifecycle-fixtures.mjs`와 **같은 값**을 쓴다. 두 fixture가 다른 세션을 쓰면
   "v1.40.1과 같다"는 E0의 비교가 성립하지 않는다. */

const DECLARED = { contact: 5, conflict: 'soon', alone: 4, affection: 'a2', hobby: 'h2' };
const EXPERIENCE = {
  important: ['contact', 'alone'],
  hardest: 'contact_drop',
  selfGap: 'yes',
};
const TARGET = {
  relation: 'talking',
  contact: 'l',
  conflict: 'h',
  alone: 'h',
  affection: 'm',
  preferences: {
    interests: [
      { id: 'i-movie', category: 'movie_show', label: '영화 · 공연' },
      { id: 'i-walk', category: 'walk', label: '산책 · 자연' },
    ],
  },
};
const SESSION = { declared: DECLARED, experience: EXPERIENCE, target: TARGET };

/** 연애 경험 없음(E4 경로) — 과거 근거가 구조적으로 없는 세션 */
const NO_PAST_SESSION = {
  declared: DECLARED,
  experience: { important: [], hardest: null, selfGap: null, skipped: true },
  target: TARGET,
};

/* ── 현재 근거 조합 ────────────────────────────────────────────────────────
   축을 **일부러 과거 근거와 겹치게/안 겹치게** 나눠 둔다.
     contact  과거 hardest 있음  → 두 시점이 겹친다 (⑨ 후보)
     conflict 과거 근거 없음     → 현재만 있는 축
     alone    과거 important 있음
*/

/** 지금 관계에서 연락은 뚜렷하고, 갈등은 거의 드러나지 않는다고 답한 상태 */
const CURRENT_MIXED = {
  signals: { contact: 'often', conflict: 'rarely' },
  askedAt: '2026-09-08T00:00:00.000Z',
};

/** 다섯 축 전부 답한 상태 — 섞임(mixed)이 사라져야 한다 */
const CURRENT_ALL = {
  signals: {
    contact: 'sometimes',
    conflict: 'often',
    alone: 'rarely',
    affection: 'often',
    hobby: 'sometimes',
  },
  askedAt: '2026-09-08T00:00:00.000Z',
};

/** 물어봤지만 전부 '아직 그런 상황이 없었어' — 답은 있고 근거는 없다 */
const CURRENT_UNSURE = {
  signals: { contact: 'unsure', conflict: 'unsure' },
  askedAt: '2026-09-08T00:00:00.000Z',
};

/** contact만 과거보다 약하게 — ⑨가 '지금은 덜 드러난다' 방향으로 생겨야 한다 */
const CURRENT_WEAKER_CONTACT = {
  signals: { contact: 'sometimes' },
  askedAt: '2026-09-08T00:00:00.000Z',
};

/* ── 2차 guard: 시점 어휘 ─────────────────────────────────────────────────
   1차 판정은 구조화된 scope다. 이 목록은 **문장이 구조와 어긋나지 않는지** 보는
   보조 검사다 — 이것만으로 판정하지 않는다. */

/** 관계가 끝난 사용자에게 나오면 안 되는 현재형 호칭 */
/**
 * ⚠️ `지금 관계`를 **조사 없이** 넣는다. 처음에는 `지금 관계에서`만 넣었는데, 연결
 * 카드의 source 라벨 칩이 정확히 `지금 관계`(조사 없음)라서 실측(J7)에서 새고 있는
 * 것을 fixture가 잡지 못했다 — 2차 guard의 어휘는 늘 **실제 렌더 문자열**에 맞춘다.
 *
 * ⚠️ **그리고 `지금 `(단독)까지 넣었다.** 두 번째 실측(J7 재검증)에서 Mirror 헤더
 * 캡션이 `항목마다 근거 시점이 달라 (지금 2 · 이전 1)`로 새어 나갔는데, 위 세 어휘
 * 어디에도 걸리지 않았다 — 새어 나간 문자열이 `지금 2`였기 때문이다. **같은 실패가
 * 세 번째로 반복된 지점**이고, 그래서 어휘를 늘리는 대신 두 가지를 함께 했다:
 * ① 캡션 생성을 `scopeCaptionOf()`로 옮겨 이 fixture가 볼 수 있게 하고
 * ② guard 어휘를 조사·숫자와 무관하게 `지금 `으로 넓혔다.
 *
 * `지금`을 넓게 막아도 오탐이 없는 이유: `ended`의 렌더 문자열에서 관계를 `지금`으로
 * 부르는 것은 **어떤 경우에도 사실이 아니다.** 시간 표현이 필요하면 `그때`·`당시`를
 * 쓴다. 단 Job framing(`scoreUse`의 `지금 실제로 어디에서…`)은 `ended` copy에 없다.
 */
const FORMER_FORBIDDEN_PHRASES = ['지금 상대', '지금 관계', '지금 이 관계', '지금 '];

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

function axis(result, key) {
  return result.evidence.axes.find((item) => item.axis === key) ?? null;
}

/**
 * ⚠️ `insightId()`가 `cs_` 접두사를 붙인다(`cs_curpast_contact`). 접두사를 빼고
 * 찾으면 **항상 0건**이 나오고, 그러면 "⑨가 생기지 않는다"는 검사가 거짓으로 통과한다
 * — 처음 이 fixture를 돌릴 때 실제로 그렇게 실패했다.
 */
function connection(result, kind) {
  return result.evidence.connections.filter((item) => item.id.startsWith(`cs_${kind}`));
}

async function main() {
  console.log('Relationship Evidence Fixture (v1.41 · §39) —', BASE_URL);

  /* ═══ E0 · Legacy — 현재 근거가 없으면 v1.40.1과 완전히 같다 ═══════════════ */
  console.log('\nE0 — legacy 세션 (현재 근거 필드 자체가 없다)');
  const e0 = await run({ status: 'dating', ...SESSION });
  const e0Explicit = await run({
    status: 'dating',
    ...SESSION,
    currentRelationship: { signals: {}, askedAt: null },
  });
  {
    check(
      'E0 — 필드가 없어도 죽지 않는다 (마이그레이션 없음)',
      e0.ok === true && e0.evidence.mirrorAvailable === true,
      e0.evidence?.mirrorAvailable,
    );
    check(
      'E0 — 모든 축의 scope가 past 또는 none이다 (current 0)',
      e0.evidence.scopeSummary.currentCount === 0,
      e0.evidence.scopeSummary,
    );
    check(
      'E0 — 빈 객체를 명시적으로 넘긴 것과 완전히 같다',
      JSON.stringify(e0.evidence.axes) === JSON.stringify(e0Explicit.evidence.axes),
      { implicit: e0.evidence.axes, explicit: e0Explicit.evidence.axes },
    );
    check(
      'E0 — 근거 문장이 전부 이전 관계 어휘다 (v1.40.1 문장 그대로)',
      e0.evidence.axes.every((item) => item.signal.startsWith('이전 관계에서')),
      e0.evidence.axes.map((item) => item.signal),
    );
    check(
      'E0 — ⑨(Current × Past)이 생기지 않는다',
      connection(e0, 'curpast').length === 0,
      connection(e0, 'curpast'),
    );
    check(
      'E0 — Snapshot에 scope가 얼려지지만 전부 past/none이다',
      e0.evidence.snapshot !== null &&
        e0.evidence.snapshot.every((item) => item.scope === 'past' || item.scope === 'none'),
      e0.evidence.snapshot,
    );
  }

  /* ═══ E1~E3 · 근거를 권하지 않는 단계 ═════════════════════════════════════ */
  console.log('\nE1~E3 — none / no past / talking');
  const e1 = await run({ status: 'solo_none', declared: DECLARED, experience: {}, target: {} });
  const e2 = await run({ status: 'solo_exp', declared: DECLARED, experience: EXPERIENCE, target: {} });
  const e3 = await run({ status: 'crush', ...SESSION });
  {
    check('E1 — job=none', e1.resolution.job === 'none', e1.resolution);
    check(
      'E1 — S30을 권하지 않는다 (부를 관계가 없다)',
      e1.context.invitesCurrentEvidence === false,
      e1.context.invitesCurrentEvidence,
    );
    check(
      'E2 — 과거 근거만으로 Mirror가 성립한다',
      e2.evidence.mirrorAvailable === true && e2.evidence.scopeSummary.pastCount > 0,
      e2.evidence.scopeSummary,
    );
    check('E3 — job=talking', e3.resolution.job === 'talking', e3.resolution);
    check(
      'E3 — talking에게도 S30을 권하지 않는다 (관계를 확정하지 않는다)',
      e3.context.invitesCurrentEvidence === false,
      e3.context.invitesCurrentEvidence,
    );
  }

  /* ═══ E4 · dating인데 현재 근거가 없다 — 가장 중요한 케이스 ════════════════ */
  console.log('\nE4 — dating / no current (stage가 evidence를 만들지 않는다)');
  {
    check('E4 — job=dating (전제)', e0.resolution.job === 'dating', e0.resolution);
    check(
      'E4 — **dating이라는 이유만으로 current 근거가 생기지 않는다**',
      e0.evidence.scopeSummary.currentCount === 0,
      e0.evidence.scopeSummary,
    );
    check(
      'E4 — 그런데 S30은 권한다 (Job이 그것을 필요로 하므로)',
      e0.context.invitesCurrentEvidence === true,
      e0.context.invitesCurrentEvidence,
    );
    check(
      'E4 — 근거 문장이 지금 관계라고 말하지 않는다',
      scan(
        e0.evidence.axes.map((item) => item.signal),
        ['지금 관계에서'],
      ).length === 0,
      e0.evidence.axes.map((item) => item.signal),
    );
  }

  /* ═══ E5~E6 · dating + current ════════════════════════════════════════════ */
  console.log('\nE5~E6 — dating / current · current+past');
  const e5 = await run({ status: 'dating', ...SESSION, currentRelationship: CURRENT_MIXED });
  const e6 = await run({ status: 'dating', ...SESSION, currentRelationship: CURRENT_ALL });
  {
    check(
      'E5 — 답한 축은 current로 판정된다',
      axis(e5, 'contact')?.scope === 'current',
      axis(e5, 'contact'),
    );
    check(
      'E5 — 답하지 않은 축은 과거 근거를 그대로 쓴다',
      axis(e5, 'alone')?.scope === 'past',
      axis(e5, 'alone'),
    );
    check(
      'E5 — 동기화율·comparedCount는 불변 (근거가 점수에 들어가지 않는다)',
      e5.invariant.score === e0.invariant.score &&
        e5.invariant.comparedCount === e0.invariant.comparedCount,
      { withCurrent: e5.invariant.score, without: e0.invariant.score },
    );
    check(
      'E5 — good/friction 신호 수도 불변',
      e5.invariant.goodCount === e0.invariant.goodCount &&
        e5.invariant.frictionCount === e0.invariant.frictionCount,
      { e5: e5.invariant, e0: e0.invariant },
    );
    check(
      'E5 — current 근거 문장이 사용자가 고른 보기를 인용한다',
      axis(e5, 'contact')?.signal.includes('바로 알아차리고 마음이 쓰여'),
      axis(e5, 'contact')?.signal,
    );
    /**
     * ⚠️ 이 검사가 v1.41에서 **판정 규칙을 한 줄 넓힌 이유**다.
     *
     * 처음 돌렸을 때 `conflict` 축이 결과에 **아예 없었다.** `rarely` → strength
     * `absent`이고 declared가 보통이면 v1.40의 `stateFor`가 `UNKNOWN`을 주는데,
     * UNKNOWN 축은 `insights`에 들어가지 않기 때문이다. 즉 **사용자가 답한 축이
     * 화면에서 사라졌다.** 그건 '판정하지 않는다'가 아니라 '근거가 없다'고 말하는
     * 것이므로 고쳤다(`mirror.ts` `stateFor` 주석 참고).
     */
    check(
      'E5 — `rarely`도 근거다 (scope=current · strength=absent)',
      axis(e5, 'conflict')?.scope === 'current' && axis(e5, 'conflict')?.strength === 'absent',
      axis(e5, 'conflict'),
    );
    check(
      'E5 — 답한 축은 사라지지 않는다 (직접 답한 부재는 판정할 수 있다)',
      axis(e5, 'conflict') !== null && axis(e5, 'conflict')?.state === 'MATCH',
      axis(e5, 'conflict'),
    );
    check(
      'E5 — 그 MATCH 문구가 `꾸준히 중요했어`라고 말하지 않는다',
      !axis(e5, 'conflict')?.signal.includes('꾸준히 중요'),
      axis(e5, 'conflict')?.signal,
    );
    check(
      'E6 — 다섯 축 전부 답하면 섞임이 사라진다',
      e6.evidence.scopeSummary.mixed === false &&
        e6.evidence.scopeSummary.dominant === 'current',
      e6.evidence.scopeSummary,
    );
  }

  /* ═══ E7 · long_term ══════════════════════════════════════════════════════ */
  console.log('\nE7 — long_term / current');
  const e7 = await run({ status: 'married', ...SESSION, currentRelationship: CURRENT_MIXED });
  {
    check('E7 — job=long_term', e7.resolution.job === 'long_term', e7.resolution);
    check(
      'E7 — S30을 권한다',
      e7.context.invitesCurrentEvidence === true,
      e7.context.invitesCurrentEvidence,
    );
    check(
      'E7 — 같은 근거면 dating과 축별 scope가 동일하다 (stage가 scope를 바꾸지 않는다)',
      JSON.stringify(e7.evidence.axes.map((a) => [a.axis, a.scope])) ===
        JSON.stringify(e5.evidence.axes.map((a) => [a.axis, a.scope])),
      { long_term: e7.evidence.axes, dating: e5.evidence.axes },
    );
    check(
      'E7 — 반복 어휘를 stage만으로 쓰지 않는다 (History 근거 없음)',
      scan(e7.context.renderedStrings, ['반복해서 나온', '반복되는 기록']).length === 0,
      scan(e7.context.renderedStrings, ['반복해서 나온', '반복되는 기록']),
    );
  }

  /* ═══ E8~E10 · ended ══════════════════════════════════════════════════════ */
  console.log('\nE8~E10 — dating→ended 유지 · ended past only · former-current');
  const e9 = await run({ status: 'ended', ...SESSION });
  const e10 = await run({ status: 'ended', ...SESSION, currentRelationship: CURRENT_MIXED });
  {
    check(
      'E8 — ended에서도 넘긴 현재 근거가 살아 있다 (회고의 재료를 지우지 않는다)',
      axis(e10, 'contact')?.scope === 'current',
      axis(e10, 'contact'),
    );
    check('E9 — job=ended', e9.resolution.job === 'ended', e9.resolution);
    check(
      'E9 — ended / 과거 근거만: 시제가 전부 이전 관계다',
      e9.evidence.axes.every((item) => item.signal.startsWith('이전 관계에서')),
      e9.evidence.axes.map((item) => item.signal),
    );
    check(
      'E10 — former-current는 `그때 이 관계에서`로 불린다',
      axis(e10, 'contact')?.signal.startsWith('그때 이 관계에서'),
      axis(e10, 'contact')?.signal,
    );
    check(
      'E10 — tense가 former다',
      e10.evidence.tense === 'former',
      e10.evidence.tense,
    );
    /* §38.11 항목 ①②③④ — v1.40.1이 남긴 시제 잔여분 */
    check(
      'E10 §38.11① — 무료 화면 문자열에 `지금 상대` 0건',
      scan(e10.context.renderedStrings, ['지금 상대']).length === 0,
      scan(e10.context.renderedStrings, ['지금 상대']),
    );
    check(
      'E10 §38.11①~③ — 유료 본문에 현재형 호칭 0건',
      scan(e10.deepReport.renderedStrings, FORMER_FORBIDDEN_PHRASES).length === 0,
      scan(e10.deepReport.renderedStrings, FORMER_FORBIDDEN_PHRASES),
    );
    check(
      'E10 §38.11③ — 러비 철학 질문이 상대를 향하지 않는다',
      scan(e10.deepReport.renderedStrings, ['상대에게 미리 말해주는']).length === 0,
      scan(e10.deepReport.renderedStrings, ['상대에게 미리 말해주는']),
    );
    check(
      'E10 §38.11④ — Deep Question이 현재 상대에게 설명하라고 하지 않는다',
      scan(e10.evidence.deepQuestionPrompts, ['상대에게 어떻게 설명하는 편이야']).length === 0,
      e10.evidence.deepQuestionPrompts,
    );
    check(
      'E10 — Mirror 헤더 캡션이 현재형으로 부르지 않는다 (J7에서 새던 자리)',
      scan([e10.evidence.scopeCaption], FORMER_FORBIDDEN_PHRASES).length === 0,
      e10.evidence.scopeCaption,
    );
    check(
      'E10 — 그 캡션이 `그때`로 부른다 (비워서 통과시키지 않는다)',
      typeof e10.evidence.scopeCaption === 'string' &&
        e10.evidence.scopeCaption.includes('그때'),
      e10.evidence.scopeCaption,
    );
    check(
      'E10 — 연결 ruleSummary에도 현재형 호칭 0건',
      scan(
        e10.evidence.connections.map((item) => item.ruleSummary),
        FORMER_FORBIDDEN_PHRASES,
      ).length === 0,
      scan(
        e10.evidence.connections.map((item) => item.ruleSummary),
        FORMER_FORBIDDEN_PHRASES,
      ),
    );
    /* v1.40.1 structural safety가 유지되는가 */
    check(
      'E10 — Ended Premium safety 유지: outward action 0',
      e10.deepReport.outwardActionCount === 0,
      e10.deepReport,
    );
    check(
      'E10 — Ended Premium safety 유지: outward question 0',
      e10.deepReport.outwardQuestionCount === 0,
      e10.deepReport,
    );
    check(
      'E10 — Ended Premium safety 유지: Approach Insight 없음',
      e10.deepReport.hasApproachInsight === false,
      e10.deepReport,
    );
  }

  /* ═══ E11 · 현재 근거를 되돌리면 과거로 돌아간다 ═══════════════════════════ */
  console.log('\nE11 — current 제거 / unsure');
  const e11 = await run({ status: 'dating', ...SESSION, currentRelationship: CURRENT_UNSURE });
  {
    check(
      'E11 — `unsure`는 근거가 아니다 → 과거로 넘어간다',
      axis(e11, 'contact')?.scope === 'past',
      axis(e11, 'contact'),
    );
    check(
      'E11 — unsure만 있는 세션의 축별 판정이 E0(legacy)와 동일하다',
      JSON.stringify(e11.evidence.axes) === JSON.stringify(e0.evidence.axes),
      { unsure: e11.evidence.axes, legacy: e0.evidence.axes },
    );
    check(
      'E11 — 답을 지운 축은 그 축만 과거로 돌아간다 (전체 초기화가 아니다)',
      axis(e5, 'contact')?.scope === 'current' && axis(e11, 'contact')?.scope === 'past',
      { withAnswer: axis(e5, 'contact'), unsure: axis(e11, 'contact') },
    );
  }

  /* ═══ E12 · 과거가 없고 현재만 있는 사용자 ════════════════════════════════ */
  console.log('\nE12 — no past + current (E4 경로 뒤 연애 시작)');
  const e12NoCurrent = await run({ status: 'dating', ...NO_PAST_SESSION });
  const e12 = await run({
    status: 'dating',
    ...NO_PAST_SESSION,
    currentRelationship: CURRENT_ALL,
  });
  {
    check(
      'E12 — 과거도 현재도 없으면 Mirror는 v1.40처럼 닫힌다',
      e12NoCurrent.evidence.mirrorAvailable === false,
      e12NoCurrent.evidence.mirrorAvailable,
    );
    check(
      'E12 — 현재 근거가 있으면 Mirror가 열린다 (없는 근거를 만든 게 아니다)',
      e12.evidence.mirrorAvailable === true && e12.evidence.scopeSummary.currentCount > 0,
      e12.evidence.scopeSummary,
    );
    check(
      'E12 — 과거 근거가 없으므로 past 축이 0이다',
      e12.evidence.scopeSummary.pastCount === 0,
      e12.evidence.scopeSummary,
    );
    check(
      'E12 — ⑨(Current × Past)은 과거가 없으므로 생기지 않는다',
      connection(e12, 'curpast').length === 0,
      connection(e12, 'curpast'),
    );
  }

  /* ═══ E13 · History Snapshot에 시점이 얼려진다 ════════════════════════════ */
  console.log('\nE13 — History Snapshot frozen scope');
  {
    const snapshot = e5.evidence.snapshot ?? [];
    const contactSnap = snapshot.find((item) => item.axis === 'contact');
    check(
      'E13 — Snapshot에 축별 scope가 함께 얼려진다',
      contactSnap?.scope === 'current',
      snapshot,
    );
    check(
      'E13 — 답하지 않은 축의 scope는 past로 얼려진다',
      snapshot.find((item) => item.axis === 'alone')?.scope === 'past',
      snapshot,
    );
    check(
      'E13 — scope는 변화 판정에 쓰이지 않는다 (Mirror state는 근거 강도만 따른다)',
      snapshot.every((item) => ['MATCH', 'GAP', 'CHANGE'].includes(item.state)),
      snapshot,
    );
  }

  /* ═══ E14 · Mixed scope를 한 시점의 이름으로 부르지 않는다 ════════════════ */
  console.log('\nE14 — mixed scopes');
  {
    check(
      'E14 — 섞였으면 mixed=true',
      e5.evidence.scopeSummary.mixed === true,
      e5.evidence.scopeSummary,
    );
    check(
      'E14 — 섞였으면 dominant가 null이다 (다수결로 이름 붙이지 않는다)',
      e5.evidence.scopeSummary.dominant === null,
      e5.evidence.scopeSummary,
    );
    check(
      'E14 — dating의 mixed 캡션은 `지금`으로 부른다 (과필터 방지)',
      e5.evidence.scopeCaption.includes('지금 2') && e5.evidence.scopeCaption.includes('이전 1'),
      e5.evidence.scopeCaption,
    );
    check(
      'E14 — 한 시점만 있으면 캡션이 시점 이름을 쓴다',
      e6.evidence.scopeCaption.includes('지금 관계에서 답한 내용 기준'),
      e6.evidence.scopeCaption,
    );
    check(
      'E14 — 한 시점만 있으면 그 시점이 dominant다',
      e0.evidence.scopeSummary.dominant === 'past' &&
        e6.evidence.scopeSummary.dominant === 'current',
      { legacy: e0.evidence.scopeSummary, all: e6.evidence.scopeSummary },
    );
  }

  /* ═══ E15 · Premium — Current × Past 연결 ═════════════════════════════════ */
  console.log('\nE15 — Premium Current × Past');
  const e15 = await run({
    status: 'dating',
    ...SESSION,
    currentRelationship: CURRENT_WEAKER_CONTACT,
  });
  {
    const curpast = connection(e15, 'curpast');
    check(
      'E15 — 두 시점의 강도가 다르면 ⑨가 생긴다',
      curpast.length > 0,
      e15.evidence.connections.map((item) => item.id),
    );
    check(
      'E15 — ⑨의 source가 두 종류다 (지금 관계 · 관계 경험)',
      curpast[0]?.sources.includes('current_relationship') &&
        curpast[0]?.sources.includes('relationship'),
      curpast[0]?.sources,
    );
    check(
      'E15 — ⑨의 근거 ref도 두 시점을 가리킨다',
      curpast[0]?.refSources.includes('current_relationship') &&
        curpast[0]?.refSources.includes('relationship'),
      curpast[0]?.refSources,
    );
    check(
      'E15 — ⑨는 어느 쪽이 진짜인지 정하지 않는다',
      curpast[0]?.ruleSummary.includes('정하지 않을게'),
      curpast[0]?.ruleSummary,
    );
    check(
      'E15 — 두 시점의 강도가 같으면 만들지 않는다 (무료 MATCH의 반복 금지)',
      connection(
        await run({
          status: 'dating',
          ...SESSION,
          // contact: 과거 hardest ↔ 현재 often → 같은 강도
          currentRelationship: { signals: { contact: 'often' }, askedAt: null },
        }),
        'curpast',
      ).length === 0,
    );
    check(
      'E15 — 현재 근거가 있어도 동기화율은 불변',
      e15.invariant.score === e0.invariant.score,
      { e15: e15.invariant.score, e0: e0.invariant.score },
    );
  }

  /* ═══ E16 · Ended Premium safety (v1.40.1 회귀) ═══════════════════════════ */
  console.log('\nE16 — Ended Premium structural safety (v1.40.1 회귀)');
  {
    check(
      'E16 — 현재 근거가 있는 ended도 outward 0을 유지한다',
      e10.deepReport.outwardActionCount === 0 && e10.deepReport.outwardQuestionCount === 0,
      e10.deepReport,
    );
    check(
      'E16 — 과필터가 아니다: dating은 outward 행동을 받는다',
      e5.deepReport.outwardActionCount > 0,
      e5.deepReport,
    );
    check(
      'E16 — 과필터가 아니다: dating은 Approach Insight를 받는다',
      e5.deepReport.hasApproachInsight === true,
      e5.deepReport,
    );
    check(
      'E16 — ended 섹션 제목이 회고다',
      e10.deepReport.actionSectionTitle === '그래서 뭐가 남았을까',
      e10.deepReport.actionSectionTitle,
    );
    check(
      'E16 — Premium eligibility가 현재 근거로 열리거나 닫히지 않는다',
      e5.invariant.premiumDeepConnection === e0.invariant.premiumDeepConnection,
      { withCurrent: e5.invariant.premiumDeepConnection, without: e0.invariant.premiumDeepConnection },
    );
  }

  /* ═══ E17 · Enum Guard — fixture 자체의 무결성 (v1.40.1 §38.5) ════════════ */
  console.log('\nE17 — Enum Guard (잘못된 fixture가 조용히 통과하지 않는다)');
  {
    const badValue = await runExpectingRejection({
      status: 'dating',
      ...SESSION,
      currentRelationship: { signals: { contact: 'very_often' } },
    });
    check(
      'E17 — 알 수 없는 답변 값은 400 INVALID_ENUM으로 거절된다',
      badValue.status === 400 && badValue.json?.reason === 'INVALID_ENUM',
      badValue,
    );
    const badAxis = await runExpectingRejection({
      status: 'dating',
      ...SESSION,
      currentRelationship: { signals: { contct: 'often' } },
    });
    check(
      'E17 — 오타 축 키도 거절된다 (조용히 무시되면 근거 없이 통과한다)',
      badAxis.status === 400 && badAxis.json?.reason === 'INVALID_ENUM',
      badAxis,
    );
    const badShape = await runExpectingRejection({
      status: 'dating',
      ...SESSION,
      currentRelationship: { signals: ['contact'] },
    });
    check(
      'E17 — signals가 객체가 아니면 거절된다',
      badShape.status === 400 && badShape.json?.reason === 'INVALID_ENUM',
      badShape,
    );
    for (const value of ['often', 'sometimes', 'rarely', 'unsure']) {
      const ok = await run({
        status: 'dating',
        ...SESSION,
        currentRelationship: { signals: { affection: value } },
      });
      check(
        `E17 — 유효값 '${value}'가 실제로 실행된다`,
        ok.ok === true,
        value,
      );
    }
  }

  /* ═══ R1 · Resolver가 stage를 읽지 않는다 (구조 검사) ══════════════════════ */
  console.log('\nR1 — Resolver 격리 (stage import 0건)');
  {
    const { readFileSync } = await import('node:fs');
    const raw = readFileSync('src/lib/logic/relationshipEvidence.ts', 'utf-8');
    /**
     * ⚠️ **주석을 지우고 본다.** 이 파일의 상단 주석은 stage별 정책 표를 설명하므로
     * `RelationshipStage`·`RelationshipJob`이라는 **단어**가 당연히 들어 있다.
     * 원문을 그대로 grep하면 항상 실패하고, 그러면 이 검사는 유용하지 않다 — 처음
     * 돌릴 때 실제로 그렇게 실패했다. 검사하려는 것은 **코드가 그 타입을 받는가**다.
     */
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    /**
     * ⚠️ 주석이 아니라 테스트가 지킨다. `relationshipEvidence.ts`는 stage/job/status를
     * **타입으로도 받지 않는다** — 받을 수 있게 두면 언젠가 누군가 여기에
     * `if (stage === 'dating')`을 쓰고, 그 순간 v1.41이 고친 결함이 되살아난다.
     */
    check(
      'R1 — Resolver가 relationshipStage를 import하지 않는다',
      !source.includes("from './relationshipStage'"),
      'relationshipEvidence.ts가 relationshipStage를 import하고 있다',
    );
    for (const forbidden of ['RelationshipStage', 'RelationshipJob', 'RelationshipStatus']) {
      check(
        `R1 — Resolver가 \`${forbidden}\` 타입을 받지 않는다`,
        !source.includes(forbidden),
        forbidden,
      );
    }
  }

  /* ═══ A0~A14 · AI Relationship Boundary (v1.42 · §40.18) ═══════════════════

     ══ 이 절이 고정하는 것 ═══════════════════════════════════════════════════

     v1.41은 `stage ≠ evidence`를 **결정론 경로에서** 증명했다(위 E0~E17 · R1).
     v1.42는 같은 주장을 **AI 경계에서** 증명한다 — v1.41 Audit에서 그 경계만 원칙을
     지키지 않고 있었다.

     ```
     ① 지문이 근거를 본다      S30이 바뀌면 AI를 다시 부른다        A2 · A3 · A4 · A13
     ② 지문이 stage를 안 본다  근거·시제가 같으면 같은 지문         A5 · A6
     ③ 시제도 근거다           tense가 바뀌면 반드시 다른 지문      A7
     ④ AI는 stage를 못 받는다  context에 raw status 0건             A0 · A8 · A9 · R2
     ```

     ⚠️ **여기서도 판정을 만들지 않는다.** 라우트가 화면과 같은 함수
     (`relationshipNarrativeFingerprint` · `buildRelationshipContext`)를 부르고, 이
     스크립트는 지문 문자열을 **서로 비교만** 한다. 지문은 해시라 내용이 보이지 않으므로
     `같은가 다른가`만 검사할 수 있고, 그게 캐시가 실제로 하는 판단과 정확히 같다.

     ⚠️ AI **출력**의 시제 검사(A10~A12)는 여기가 아니라 `tests/fixtures/ai/*.json` +
     `npm run test:ai`다. Provider 응답을 흉내낸 fixture를 실제 파싱·안전 검사에 통과
     시켜야 하므로 그 도구(`/api/ai/contract-test`)를 쓴다. */

  console.log('\nA0~A14 — AI Relationship Boundary (v1.42)');
  {
    /** 위 E 계열과 **같은 세션**을 쓴다 — 두 절이 다른 세션을 쓰면 비교가 성립하지 않는다 */
    const AI_BASE = { ...SESSION, status: 'dating' };

    /* ── A0 · legacy 세션 (currentRelationship 키가 아예 없다) ──────────── */
    const a0 = await run(AI_BASE);
    check(
      'A0 — legacy 세션에서 AI context에 raw status가 0건',
      a0.aiBoundary.rawStatusTokens.length === 0,
      a0.aiBoundary.rawStatusTokens,
    );
    check(
      'A0 — AI context 키에 `status`가 없다 (§40.7)',
      !a0.aiBoundary.contextKeys.includes('status'),
      a0.aiBoundary.contextKeys,
    );
    check(
      'A0 — AI context에 `tense`가 있다',
      a0.aiBoundary.contextKeys.includes('tense'),
      a0.aiBoundary.contextKeys,
    );

    /* ── A1 · 현재 근거 없음(빈 객체) → legacy와 같은 지문 ───────────────
       ⚠️ 이게 v1.42가 **불필요한 재호출을 만들지 않았다**는 증거다. 현재 근거가 없는
       세션은 v1.41과 다른 지문 값을 갖지만(입력 구성이 달라졌으니 당연하다), **같은
       세션끼리는 여전히 안정적**이다 — 즉 캐시 동작이 v1.41과 같다. */
    const a1 = await run({ ...AI_BASE, currentRelationship: { signals: {}, askedAt: null } });
    check(
      'A1 — 현재 근거 없음(빈 객체)이 legacy(키 없음)와 같은 지문',
      a1.aiBoundary.fingerprint === a0.aiBoundary.fingerprint,
      { a0: a0.aiBoundary.fingerprint, a1: a1.aiBoundary.fingerprint },
    );

    /* ── A2 · 현재 근거 추가 → 지문이 달라진다 ───────────────────────────── */
    const a2 = await run({ ...AI_BASE, currentRelationship: CURRENT_MIXED });
    check(
      'A2 — 현재 근거를 추가하면 지문이 달라진다',
      a2.aiBoundary.fingerprint !== a1.aiBoundary.fingerprint,
      { a1: a1.aiBoundary.fingerprint, a2: a2.aiBoundary.fingerprint },
    );

    /* ── A2b · Canonicalization (F2 · §40.4) ─────────────────────────────
       ⚠️ **같은 답이면 같은 지문이어야 한다** — 무엇을 먼저 답했는지, 언제 답했는지와
       무관하게. `signals`는 객체라서 키 순서가 **사용자가 S30에서 답한 순서**이고,
       `Object.entries`로 지문을 만들면 연락→갈등 순으로 답한 사용자와 갈등→연락 순으로
       답한 사용자가 **같은 답으로 다른 지문**을 받는다. 그러면 같은 근거에 대해 AI를
       두 번 부른다. `askedAt`이 지문에서 빠져 있는 것도 같은 이유다 — 같은 답을 다시
       저장하면 timestamp만 달라지는데, 그걸로 AI를 다시 부르지 않는다. */
    const a2Reordered = await run({
      ...AI_BASE,
      currentRelationship: {
        // CURRENT_MIXED와 **같은 답 · 반대 삽입 순서 · 다른 timestamp**
        signals: { conflict: 'rarely', contact: 'often' },
        askedAt: '2099-01-01T00:00:00.000Z',
      },
    });
    check(
      'A2b — 답이 같으면 삽입 순서·askedAt이 달라도 같은 지문 (F2 · §40.4)',
      a2Reordered.aiBoundary.fingerprint === a2.aiBoundary.fingerprint,
      { a2: a2.aiBoundary.fingerprint, reordered: a2Reordered.aiBoundary.fingerprint },
    );

    /* ── A3 · 현재 근거 1개 변경 → 지문이 달라진다 (F3) ─────────────────── */
    const a3 = await run({
      ...AI_BASE,
      currentRelationship: {
        // contact만 often → sometimes. conflict는 그대로다.
        signals: { contact: 'sometimes', conflict: 'rarely' },
        askedAt: CURRENT_MIXED.askedAt,
      },
    });
    check(
      'A3 — 현재 근거 축 하나만 바꿔도 지문이 달라진다 (F3)',
      a3.aiBoundary.fingerprint !== a2.aiBoundary.fingerprint,
      { a2: a2.aiBoundary.fingerprint, a3: a3.aiBoundary.fingerprint },
    );

    /* ── A4 · 현재 근거 제거 → 근거 없음 상태로 되돌아온다 (F4) ─────────── */
    check(
      'A4 — 현재 근거를 지우면 지문이 근거 없음 상태로 되돌아온다 (F4)',
      a1.aiBoundary.fingerprint === a0.aiBoundary.fingerprint &&
        a1.aiBoundary.fingerprint !== a2.aiBoundary.fingerprint,
      {
        none: a0.aiBoundary.fingerprint,
        empty: a1.aiBoundary.fingerprint,
        withEvidence: a2.aiBoundary.fingerprint,
      },
    );

    /**
     * `unsure`(아직 그런 상황이 없었어)는 **답하지 않은 것과 다르다.** 근거는 만들지
     * 않지만(`resolveAxisEvidence`가 과거로 넘긴다) 사용자가 실제로 고른 보기이므로,
     * 지문에서 두 상태를 같은 값으로 뭉개면 `unsure`로 바꾼 것이 캐시에 보이지 않는다.
     */
    const a4Unsure = await run({
      ...AI_BASE,
      currentRelationship: { signals: { contact: 'unsure' }, askedAt: null },
    });
    check(
      'A4 — `unsure`는 답하지 않은 것과 다른 지문이다',
      a4Unsure.aiBoundary.fingerprint !== a1.aiBoundary.fingerprint,
      { unsure: a4Unsure.aiBoundary.fingerprint, unanswered: a1.aiBoundary.fingerprint },
    );

    /* ── A5 · A6 · A7 · stage를 바꿔도 / 시제를 바꾸면 (F5) ───────────────
       v1.41의 주장이 캐시 층에서도 성립하는가. 세 요청의 **근거는 완전히 같다** —
       달라지는 것은 S05 답변뿐이다. */
    const a5 = await run({ ...SESSION, status: 'crush', currentRelationship: CURRENT_MIXED });
    const a6 = await run({ ...SESSION, status: 'dating', currentRelationship: CURRENT_MIXED });
    const a7 = await run({ ...SESSION, status: 'ended', currentRelationship: CURRENT_MIXED });

    check('A5 — talking(crush)의 시제는 current', a5.aiBoundary.tense === 'current', a5.aiBoundary.tense);
    check('A6 — dating의 시제는 current', a6.aiBoundary.tense === 'current', a6.aiBoundary.tense);
    check('A7 — ended의 시제는 former', a7.aiBoundary.tense === 'former', a7.aiBoundary.tense);

    /**
     * ⚠️ **이 한 줄이 §40.5의 전부다.** `crush` → `dating`은 stage가 달라졌지만 근거도
     * 시제도 같다. 지문이 같아야 한다 — 같은 근거·같은 시제에 대해 AI에게 같은 것을 두
     * 번 물어보지 않는다. v1.41까지는 raw status가 지문에 있었으므로 이 두 요청이
     * **다른 지문**이었다(= 같은 설명을 두 번 만들었다).
     */
    check(
      'A6 — 근거·시제가 같으면 stage가 달라도 같은 지문 (F5 · stage ≠ cache key)',
      a6.aiBoundary.fingerprint === a5.aiBoundary.fingerprint,
      { crush: a5.aiBoundary.fingerprint, dating: a6.aiBoundary.fingerprint },
    );
    /**
     * ⚠️ 그리고 이 한 줄이 그 반대다. `dating` → `ended`는 시제가 바뀌므로 **반드시**
     * 지문이 달라져야 한다. 안 달라지면 관계가 끝난 사용자가 현재형으로 쓰인 캐시
     * 문장을 받는다 — stage를 지문에서 빼면서 이 경우를 놓치면 결함이 형태만 바뀐다.
     */
    check(
      'A7 — 시제가 바뀌면 반드시 다른 지문 (ended가 현재형 캐시를 받지 않는다)',
      a7.aiBoundary.fingerprint !== a6.aiBoundary.fingerprint,
      { dating: a6.aiBoundary.fingerprint, ended: a7.aiBoundary.fingerprint },
    );

    /* ── A8 · current tense context ──────────────────────────────────────── */
    check(
      'A8 — dating의 AI context.tense가 current이고 raw status가 0건',
      a6.aiBoundary.contextTense === 'current' && a6.aiBoundary.rawStatusTokens.length === 0,
      { tense: a6.aiBoundary.contextTense, raw: a6.aiBoundary.rawStatusTokens },
    );
    check(
      'A8 — context.tense와 relationshipTenseOf(job)이 같은 값 (§40.10 단일 source)',
      a6.aiBoundary.contextTense === a6.aiBoundary.tense,
      { context: a6.aiBoundary.contextTense, resolved: a6.aiBoundary.tense },
    );

    /* ── A9 · former tense context ────────────────────────────────────────
       ⚠️ **AI가 받는 factual input의 시제**를 검사한다. 프롬프트 계약(§40.11)은 모델에게
       'former로 써라'라고 말하지만, 모델이 인용할 근거 문장 자체가 현재형이면 계약과
       입력이 서로 모순된다 — v1.41 §39.13이 결정론 경로에서 고친 것이 이것이고, AI
       경계에도 같은 값이 흘러가는지 여기서 본다. */
    check(
      'A9 — ended의 AI context.tense가 former이고 raw status가 0건',
      a7.aiBoundary.contextTense === 'former' && a7.aiBoundary.rawStatusTokens.length === 0,
      { tense: a7.aiBoundary.contextTense, raw: a7.aiBoundary.rawStatusTokens },
    );
    {
      const signals = a7.aiBoundary.ruleJudgements.map((item) => item.relationshipSignal);
      const hits = scan(signals, FORMER_FORBIDDEN_PHRASES);
      check('A9 — ended가 AI에게 보내는 근거 문장에 현재형 호칭 0건', hits.length === 0, hits);
    }
    {
      // 반대 방향 — dating에게는 `지금 관계에서`가 정상이므로 지워져 있으면 안 된다.
      const signals = a6.aiBoundary.ruleJudgements.map((item) => item.relationshipSignal);
      check(
        'A9 — dating이 AI에게 보내는 근거 문장은 현재형을 유지한다 (과필터 방지)',
        signals.some((text) => typeof text === 'string' && text.includes('지금 관계')),
        signals,
      );
    }

    /* ── A13 · stale narrative 재현 (v1.41 결함) ══════════════════════════

       ══ 왜 이 조합인가 ═══════════════════════════════════════════════════

       v1.41의 지문 입력은 `status` · `declared` · `experience` · `focusAxis` ·
       `validated` 다섯 개였다. 그래서 **그 다섯 개가 전부 그대로인데 판정 근거가
       달라지는 조합**이 있으면 stale 캐시가 난다. 아래 두 요청이 정확히 그 조합이다.

       ```
       같은 것   status(dating) · declared · experience · validated(없음)
       같은 것   focusAxis = alone         ← 이것이 핵심이다
       같은 것   mirrorStates              alone MATCH · contact MATCH
       다른 것   contact의 근거 시점        past → current
       다른 것   contact의 근거 문장        이전 관계에서 … → 지금 관계에서 "…"라고 답함
       ```

       `focusAxis`가 안 바뀌는 이유는 `pickFocus`가 `MIRROR_AXES` 순서(alone → contact →
       hobby → conflict → affection)의 첫 매치를 고르기 때문이다. `alone`이 이미 첫
       항목이므로 **뒤쪽 축에 무엇을 답해도 focus는 그대로**다. 즉 이건 희귀한 경계
       조건이 아니라 **S30을 답하는 흔한 경로**다.

       v1.41에서는 두 요청의 지문이 같았으므로, 화면은 `지금 관계에서 "…"라고 답함`을
       그리면서 그 아래 AI 설명은 **이전 관계 근거를 설명하던 문장**을 그대로 보여줬다. */
    {
      const before = await run(AI_BASE);
      const after = await run({
        ...AI_BASE,
        currentRelationship: { signals: { contact: 'often' }, askedAt: '2026-09-08T00:00:00.000Z' },
      });

      // ① v1.41 지문 입력이 전부 그대로라는 것을 먼저 고정한다.
      check(
        'A13 — focusAxis가 바뀌지 않는다 (v1.41 지문이 눈치채지 못했던 이유)',
        before.invariant.mirrorFocusAxis === after.invariant.mirrorFocusAxis,
        { before: before.invariant.mirrorFocusAxis, after: after.invariant.mirrorFocusAxis },
      );
      check(
        'A13 — Mirror 판정(state)도 바뀌지 않는다',
        JSON.stringify(before.invariant.mirrorStates) ===
          JSON.stringify(after.invariant.mirrorStates),
        { before: before.invariant.mirrorStates, after: after.invariant.mirrorStates },
      );

      // ② 그런데 근거의 시점과 문장은 실제로 달라진다.
      check(
        'A13 — contact의 근거 시점이 past → current로 바뀐다',
        axis(before, 'contact')?.scope === 'past' && axis(after, 'contact')?.scope === 'current',
        { before: axis(before, 'contact')?.scope, after: axis(after, 'contact')?.scope },
      );
      check(
        'A13 — contact의 근거 문장이 실제로 달라진다',
        axis(before, 'contact')?.signal !== axis(after, 'contact')?.signal,
        { before: axis(before, 'contact')?.signal, after: axis(after, 'contact')?.signal },
      );

      // ③ 그러므로 지문이 달라져야 한다. **이 한 줄이 v1.42가 닫는 결함이다.**
      check(
        'A13 — 판정·focus가 그대로여도 근거 시점이 바뀌면 지문이 달라진다 (stale 회귀)',
        before.aiBoundary.fingerprint !== after.aiBoundary.fingerprint,
        { before: before.aiBoundary.fingerprint, after: after.aiBoundary.fingerprint },
      );
    }

    /* ── A15 · AI가 없어도 결정론 결과는 완결된다 (§40.23) ═══════════════
       시제 검사를 새로 넣었으므로 **과잉 거부의 최악 경우**를 고정해야 한다: AI 항목이
       전부 떨어져도 화면이 비면 안 된다. AI는 augmentation이고, 판정·근거·문장은 규칙이
       이미 완결시켜 둔다(§27).

       ⚠️ 이 라우트는 **항상 `narratives: []`로** Deep Report를 조립한다(Provider Key
       없이 돌아야 하므로). 즉 위 E0~E17 · A0~A14 전부가 이미 'AI 0건' 조건에서 통과한
       것이고, 이 블록은 그 사실을 **이름 붙여 명시**한다 — 암묵적 보장은 다음 버전에서
       조용히 깨진다. */
    {
      const noAi = await run({ ...AI_BASE, currentRelationship: CURRENT_MIXED });
      check(
        'A15 — AI 문장 0건에서도 Mirror가 열린다',
        noAi.evidence.mirrorAvailable === true,
        noAi.evidence.mirrorAvailable,
      );
      check(
        'A15 — AI 문장 0건에서도 축별 판정·근거 문장이 전부 있다',
        noAi.evidence.axes.length > 0 &&
          noAi.evidence.axes.every(
            (item) =>
              Boolean(item.state) && typeof item.signal === 'string' && item.signal.length > 0,
          ),
        noAi.evidence.axes,
      );
      check(
        'A15 — AI 문장 0건에서도 Premium 본문이 규칙 문장으로 완결된다',
        noAi.deepReport.renderedStrings.every(
          (text) => typeof text === 'string' && text.length > 0,
        ),
        noAi.deepReport.renderedStrings.filter((text) => !text),
      );
    }

    /* ── A14 · 캐시 키 배선 구조 검사 ═════════════════════════════════════

       지문이 달라진다는 것(A13)과 **캐시가 그걸 본다는 것**은 다른 명제다. 캐시 키는
       클라이언트(`aiClient.cacheKey`)에 있고 이 라우트는 그것을 볼 수 없으므로, R1과
       같은 방식으로 **소스를 읽어** 배선을 고정한다. 실제 캐시 히트/미스는 J1 브라우저
       실측이 확인한다(§40.20). */
    {
      const { readFileSync } = await import('node:fs');
      const stripComments = (raw) =>
        raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

      const hook = stripComments(readFileSync('src/hooks/useAiNarrative.ts', 'utf-8'));
      /**
       * ⚠️ 지문 함수에 인자를 넘기는 것과 **memo deps에 넣는 것**은 둘 다 필요하다.
       * deps에 없으면 `answers.currentRelationship`이 바뀌어도 memo가 이전 지문을 그대로
       * 돌려주고, 그러면 라우트가 옳은 지문을 계산할 수 있어도 화면은 낡은 지문으로
       * 캐시를 조회한다 — A13이 통과하면서 결함이 남는 유일한 경로다.
       */
      check(
        'A14 — useRelationshipNarrative가 지문에 currentRelationship을 넘긴다',
        /relationshipNarrativeFingerprint\(\{[\s\S]*?current:\s*answers\.currentRelationship/.test(
          hook,
        ),
        'useAiNarrative.ts의 지문 호출에 current가 없다',
      );
      check(
        'A14 — 그 지문 memo의 deps에 currentRelationship이 있다',
        /\[\s*tense,[\s\S]*?answers\.currentRelationship,[\s\S]*?\]/.test(hook),
        'deps에 answers.currentRelationship이 없다',
      );
      check(
        'A14 — 지문에 raw status를 넘기지 않는다 (§40.5)',
        !/relationshipNarrativeFingerprint\(\{[\s\S]*?status:/.test(hook),
        'useAiNarrative.ts의 지문 호출에 status가 남아 있다',
      );

      const client = stripComments(readFileSync('src/services/ai/aiClient.ts', 'utf-8'));
      /**
       * ⚠️ v1.42는 `relationship` 프롬프트를 v2 → v3으로 올린다. 캐시 키에
       * promptVersion이 없으면 같은 dev 세션(HMR)에서 **v2 프롬프트가 만든 문장이 v3
       * 계약의 결과인 것처럼** 나온다. v1.27이 적어 둔 리스크를 여기서 닫는다.
       */
      /**
       * ⚠️ v1.43 — 캐시 키가 읽는 표가 `TASK_PROMPT_VERSION`(aiClient 로컬)에서
       * `TASK_CONTRACT`(계약 선언)로 바뀌었다. 값은 그대로 `PROMPT_VERSIONS`에서 오고,
       * 달라진 것은 **표가 하나가 됐다는 것**이다 — 두 벌이면 갈리고, 갈리면 캐시 키가
       * 실제로 쓰인 프롬프트와 다른 버전을 담는다(v1.42가 이 키를 만든 이유 그대로).
       *
       * 부수 효과가 의도한 것이다: `TASK_CONTRACT`가 선언만 하고 아무도 안 쓰는
       * 문서가 아니라 **캐시 키를 만드는 실제 코드 경로**가 된다(TC0이 그 표를 검사한다).
       */
      check(
        'A14 — cacheKey가 promptVersion을 포함한다 (§40.12 · v1.43 계약에서 읽는다)',
        /function cacheKey[\s\S]*?promptVersionOf\(task\)/.test(client) &&
          /TASK_CONTRACT\[task\]\.promptVersion/.test(client),
        'aiClient.cacheKey가 promptVersion을 TASK_CONTRACT에서 읽지 않는다',
      );
    }

    /* ── R2 · Context Builder가 stage를 읽지 않는다 (구조 검사) ═══════════
       R1이 Resolver를 지키는 방식 그대로 **AI Context Builder**에도 같은 검사를 둔다.
       v1.41 Audit이 찾은 결함이 정확히 "Resolver는 테스트로 막혀 있는데 AI context는
       안 막혀 있었다"였으므로, 같은 형태의 재발을 같은 형태의 검사로 막는다. */
    {
      const { readFileSync } = await import('node:fs');
      const raw = readFileSync('src/services/ai/contextBuilders.ts', 'utf-8');
      // R1과 같은 이유로 주석을 지우고 본다 — 상단 주석이 왜 status를 뺐는지 설명한다.
      const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      check(
        'R2 — AI Context Builder가 `RelationshipStatus`를 받지 않는다',
        !source.includes('RelationshipStatus'),
        'contextBuilders.ts에 RelationshipStatus가 남아 있다',
      );
      check(
        'R2 — AI Context Builder가 `answers.status`를 읽지 않는다',
        !source.includes('answers.status'),
        'contextBuilders.ts가 answers.status를 읽고 있다',
      );
      for (const forbidden of ['RelationshipStage', 'RelationshipJob']) {
        check(
          `R2 — AI Context Builder가 \`${forbidden}\` 타입을 받지 않는다`,
          !source.includes(forbidden),
          forbidden,
        );
      }
    }
    /* ── CA4b · SOURCE PROVENANCE ≠ NARRATIVE TENSE (v1.42 · §41.5) ══════

       CA0~CA4는 `test:ai`가 **파서 계약**을 본다(어떤 source가 살아남는가). 여기서는
       같은 근거의 **해석 결과**를 본다 — resolver가 그 ref를 어떤 라벨·문장으로 푸는가.

       ```
       source   current_relationship   근거의 정체성   ended에서도 그대로
       key      current_relationship:contact           그대로 (React key · 중복 제거)
       label    지금 관계 → 그때 이 관계               시제를 따른다
       text     지금 관계에서 … → 그때 이 관계에서 …   시제를 따른다
       ```

       ⚠️ v1.41까지 `resolveCurrentRelationship`이 `지금 관계에서`를 **하드코딩**했고
       `sourceLabel`도 `'지금 관계'` 고정이었다. 그래서 `ended` 사용자의 Premium 연결
       카드 근거 목록(`근거 N개 보기`)에 현재형이 남았는데, 그 문자열은 fixture가 훑는
       `renderedStrings`에 **없던 자리**라 통과했다 — §39.9와 정확히 같은 실패 형태다.
       v1.42에서 문자열을 `currentEvidencePrefix`/`currentEvidenceLabel`로 옮기고,
       `renderedStrings`에 `evidence[].sourceLabel`·`text`를 더했다. */
    console.log('\nCA4b — Source Provenance ≠ Narrative Tense (v1.42)');
    {
      const dating = await run({ ...SESSION, status: 'dating', currentRelationship: CURRENT_MIXED });
      const ended = await run({ ...SESSION, status: 'ended', currentRelationship: CURRENT_MIXED });

      const pick = (result) =>
        result.aiBoundary.resolvedEvidence.filter((item) => item.scope === 'current');

      const datingCurrent = pick(dating);
      const endedCurrent = pick(ended);

      check(
        'CA4b — 두 세션의 current 근거 축이 같다 (비교 전제)',
        datingCurrent.length > 0 &&
          JSON.stringify(datingCurrent.map((item) => item.axis)) ===
            JSON.stringify(endedCurrent.map((item) => item.axis)),
        { dating: datingCurrent.map((i) => i.axis), ended: endedCurrent.map((i) => i.axis) },
      );

      // ① PROVENANCE — source와 key는 시제와 무관하게 동일하다.
      check(
        'CA4b — source가 ended에서도 current_relationship으로 유지된다',
        endedCurrent.every((item) => item.source === 'current_relationship'),
        endedCurrent.map((item) => item.source),
      );
      check(
        'CA4b — 근거 key가 시제 때문에 달라지지 않는다',
        JSON.stringify(datingCurrent.map((item) => item.key)) ===
          JSON.stringify(endedCurrent.map((item) => item.key)),
        { dating: datingCurrent.map((i) => i.key), ended: endedCurrent.map((i) => i.key) },
      );

      // ② TENSE — 라벨과 문장은 시제를 따른다.
      check(
        'CA4b — dating의 근거 라벨은 `지금 관계`',
        datingCurrent.every((item) => item.sourceLabel === '지금 관계'),
        datingCurrent.map((item) => item.sourceLabel),
      );
      check(
        'CA4b — ended의 근거 라벨은 `그때 이 관계`',
        endedCurrent.every((item) => item.sourceLabel === '그때 이 관계'),
        endedCurrent.map((item) => item.sourceLabel),
      );
      check(
        'CA4b — ended의 근거 문장에 현재형 호칭 0건',
        scan(
          endedCurrent.flatMap((item) => [item.sourceLabel, item.text]),
          FORMER_FORBIDDEN_PHRASES,
        ).length === 0,
        scan(
          endedCurrent.flatMap((item) => [item.sourceLabel, item.text]),
          FORMER_FORBIDDEN_PHRASES,
        ),
      );
      check(
        'CA4b — dating의 근거 문장은 현재형을 유지한다 (과필터 방지)',
        datingCurrent.every(
          (item) => typeof item.text === 'string' && item.text.includes('지금 관계에서'),
        ),
        datingCurrent.map((item) => item.text),
      );

      /**
       * ③ **검사 배열 자체가 넓어졌는지** 확인한다. 문구를 고치는 것과 그 문구가
       * 검사되는 자리에 있는 것은 다른 명제다 — v1.41이 J7에서 배운 것이다.
       */
      check(
        'CA4b — 연결 카드 근거 문장이 renderedStrings에 포함된다 (검사 사각 제거)',
        ended.deepReport.renderedStrings.some(
          (text) => typeof text === 'string' && text.includes('그때 이 관계'),
        ),
        '유료 본문 문자열 배열에 근거 목록이 빠져 있다',
      );
      check(
        'CA4b — ended 유료 본문 전체에 현재형 호칭 0건',
        scan(ended.deepReport.renderedStrings, FORMER_FORBIDDEN_PHRASES).length === 0,
        scan(ended.deepReport.renderedStrings, FORMER_FORBIDDEN_PHRASES),
      );
    }

    /* ── AQ-D · 결정론 질문 게이트와 AI 게이트가 같은 술어를 쓴다 (§41.10) ═══
       AQ0~AQ6은 `test:ai`가 **AI 응답 후처리**를 본다. 여기서는 그 게이트가 읽는
       boolean이 결정론 질문을 막는 것과 **같은 술어**에서 나오는지 본다 —
       두 값이 갈리면 같은 사용자가 결정론 질문은 못 받고 AI 질문은 받는다. */
    console.log('\nAQ-D — Job Question Gate 단일 source (v1.42)');
    {
      const cases = [
        { status: 'ended', label: 'ended', expected: false },
        { status: 'solo_none', label: 'none', expected: false },
        { status: 'crush', label: 'talking', expected: true },
        { status: 'dating', label: 'dating', expected: true },
        { status: 'married', label: 'long_term', expected: true },
      ];
      for (const item of cases) {
        // `solo_none`은 상대 정보를 비워야 job이 `none`이 된다(있으면 talking으로 읽는다)
        const session =
          item.label === 'none'
            ? { declared: DECLARED, experience: EXPERIENCE, target: {}, status: item.status }
            : { ...SESSION, status: item.status };
        const result = await run(session);
        check(
          `AQ-D — job=${result.resolution.job}(${item.label})의 allowsOutwardQuestions=${item.expected}`,
          result.context.allowsOutwardQuestions === item.expected,
          { job: result.resolution.job, actual: result.context.allowsOutwardQuestions },
        );
      }

      /**
       * ⚠️ **`jobAllowsOutwardQuestions`를 재구현하지 않았는지** 구조로 검사한다.
       * 이 게이트의 값이 다른 곳에서 `status === 'ended'`로 다시 계산되면, 두 판정이
       * 갈리는 순간 AI 질문만 새어 나간다.
       */
      const { readFileSync } = await import('node:fs');
      const stripComments = (raw) =>
        raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

      const hook = stripComments(readFileSync('src/hooks/useAiNarrative.ts', 'utf-8'));
      check(
        'AQ-D — 훅이 jobAllowsOutwardQuestions(job)에서 값을 얻는다',
        /allowsOutwardQuestions\s*=\s*jobAllowsOutwardQuestions\(job\)/.test(hook),
        '훅이 다른 방법으로 게이트 값을 만들고 있다',
      );
      check(
        'AQ-D — 훅에 status 기반 분기를 새로 만들지 않았다',
        !/status\s*===\s*'ended'/.test(hook),
        "useAiNarrative.ts에 status === 'ended' 분기가 있다",
      );

      const handlers = stripComments(readFileSync('src/services/ai/handlers.ts', 'utf-8'));
      /**
       * ⚠️ v1.43 — 게이트 호출 형태가 두 군데 달라졌고, **둘 다 계약의 일부다.**
       *
       * ```
       * v1.42  applyOutwardQuestionGate(withStates, allows)
       * v1.43  applyOutwardQuestionGate(refChecked, allows, 'question')
       *                                  ↑ 근거 검사 뒤     ↑ 필드 이름 명시
       * ```
       *
       * `refChecked`: 버릴 항목의 질문을 먼저 지우는 것은 낭비이고, `questionsStripped`가
       * '살아남은 항목 중 질문이 지워진 수'를 세게 된다 — 그게 관측하고 싶은 숫자다.
       *
       * `'question'`: Task마다 필드 이름이 다르다(`question` vs `conversationQuestion`).
       * 기본값을 두면 compatibility 호출부가 값을 빼먹었을 때 **아무것도 지우지 않고
       * 조용히 통과한다** — v1.40.1 §38.2가 닫은 permissive-default 실패 형태다.
       */
      check(
        'AQ-D — 핸들러가 공용 게이트 함수를 쓴다 (로직 복제 0)',
        /applyOutwardQuestionGate\(refChecked, request\.allowsOutwardQuestions, 'question'\)/.test(
          handlers,
        ),
        '핸들러가 게이트를 인라인으로 재구현하고 있다',
      );
      check(
        'AQ-D — 핸들러에 status/job 기반 분기가 없다',
        !/RelationshipJob|RelationshipStage|status\s*===\s*'ended'/.test(handlers),
        'handlers.ts가 stage/job을 직접 보고 있다',
      );

      const contextBuilders = stripComments(
        readFileSync('src/services/ai/contextBuilders.ts', 'utf-8'),
      );
      check(
        'AQ-D — allowsOutwardQuestions가 AI context에 들어가지 않는다 (§41.7)',
        !contextBuilders.includes('allowsOutwardQuestions'),
        'contextBuilders.ts가 allowsOutwardQuestions를 프롬프트로 보내고 있다',
      );

      const prompts = stripComments(readFileSync('src/services/ai/promptTemplates.ts', 'utf-8'));
      check(
        'AQ-D — 프롬프트에 allowsOutwardQuestions·job·stage가 없다',
        !prompts.includes('allowsOutwardQuestions') &&
          !prompts.includes('relationshipJob') &&
          !prompts.includes('RelationshipStage'),
        '프롬프트가 Job 정보를 받고 있다',
      );
    }

    /* ── CF0~CF6 · Question Gate × Cache Identity (v1.42 · §42) ══════════

       ══ 무엇이 문제였나 ═══════════════════════════════════════════════════

       §41.8은 `allowsOutwardQuestions`를 프롬프트에 넣지 않기로 했고, 그건 맞다.
       그런데 **지문에도 넣지 않기로** 한 판단은 틀렸다.

       ```
       aiClient.callAiTask   cache.set(key, json.data)      ← provider raw가 아니다
       json.data             applyOutwardQuestionGate 적용 후 최종 응답
       cacheKey              task::promptVersion::fingerprint
       ```

       캐시가 저장하는 것이 **게이트가 적용된 최종 응답**이므로, 그 게이트의 입력이
       다르면 재사용해도 되는 응답이 아니다.

       ══ 실제로 겹치는 조합 (실측) ═════════════════════════════════════════

       `target`과 `status`는 **둘 다** 이 지문에 없다(`target`은 v1.0부터, `status`는
       §40.5에서 뺐다). 그래서 그 두 값만 달라지는 세션들이 같은 지문을 갖는데 job은
       갈린다 — `allow`는 job에서 나온다.

       ```
       dating + 상대 3축        job dating   allow true    fp X
       새로운 사람과 궁합 보기   job unknown  allow true    fp X   (target은 지문에 없다)
       S05에서 '솔로' 선택      job none     allow FALSE   fp X   ← 겹쳤다
       ```

       세 줄 모두 tense가 `current`이고 declared·experience·current·focusAxis·validated가
       전부 같다. 그러면 캐시 히트로 **질문이 붙은 이전 응답이 job=none 사용자에게
       그대로 나온다.**

       ⚠️ **S30에 답한 세션에서는 이 경로가 성립하지 않는다.** 처음에는 `solo_exp` +
       S30 근거로 재현했다고 적었는데, 브라우저 실측에서 `resetTargetContext()`가
       §39.20에 따라 **`currentRelationship`도 비우는 것**을 확인했다 — 그러면 지문이
       `current` 때문에 이미 달라지므로 겹치지 않는다. 결함은 **S30을 답하지 않은
       세션**에서만 도달 가능하고, S30이 선택 입력이므로 그쪽이 다수다.

       ⚠️ 아래 fixture는 `CURRENT_MIXED`(S30 있음)로 **정책 분리 자체**를 검사한다 —
       도달 경로와 무관하게 '같은 지문 입력 + 다른 정책'이 갈리는지가 고정할 불변식이다.
       도달 경로는 CF-R이 따로 본다.

       ══ 고친 방법 ═════════════════════════════════════════════════════════

       boolean 하나만 지문에 넣었다. `job`·`stage`·`status` 문자열을 넣으면 §40.5가 뺀
       것을 되돌리는 셈이다 — boolean 1개면 필요한 만큼만 나뉜다(CF3·CF4가 그것을 고정). */
    console.log('\nCF0~CF6 — Question Gate × Cache Identity (v1.42 §42)');
    {
      const CF_SESSION = { declared: DECLARED, experience: EXPERIENCE };
      const fpOf = (result) => result.aiBoundary.fingerprint;

      /** 같은 근거·같은 시제에서 job만 갈라놓는다 — target 유무가 유일한 차이다 */
      const withTarget = (status) =>
        run({ ...CF_SESSION, status, target: TARGET, currentRelationship: CURRENT_MIXED });
      const withoutTarget = (status) =>
        run({ ...CF_SESSION, status, target: {}, currentRelationship: CURRENT_MIXED });

      /* CF0 · allow=true에서 지문이 안정적이다 */
      const allowA = await withTarget('dating');
      const allowB = await withTarget('dating');
      check(
        'CF0 — 같은 근거 + current + allow=true → 같은 지문 (안정)',
        fpOf(allowA) === fpOf(allowB) && allowA.aiBoundary.allowsOutwardQuestions === true,
        { a: fpOf(allowA), b: fpOf(allowB), allow: allowA.aiBoundary.allowsOutwardQuestions },
      );

      /* CF1 · allow=false에서도 지문이 안정적이다 */
      const denyA = await withoutTarget('solo_exp');
      const denyB = await withoutTarget('solo_exp');
      check(
        'CF1 — 같은 근거 + current + allow=false → 같은 지문 (안정)',
        fpOf(denyA) === fpOf(denyB) && denyA.aiBoundary.allowsOutwardQuestions === false,
        { a: fpOf(denyA), b: fpOf(denyB), allow: denyA.aiBoundary.allowsOutwardQuestions },
      );

      /* CF2 · **이 줄이 §42가 닫는 결함이다** */
      check(
        'CF2 — tense가 같아도 allow가 다르면 지문이 다르다 (stale question 회귀)',
        fpOf(allowA) !== fpOf(denyA),
        { allowTrue: fpOf(allowA), allowFalse: fpOf(denyA) },
      );
      check(
        'CF2 — 그 두 요청의 tense는 실제로 같다 (문제가 시제가 아님을 고정)',
        allowA.aiBoundary.tense === 'current' && denyA.aiBoundary.tense === 'current',
        { a: allowA.aiBoundary.tense, b: denyA.aiBoundary.tense },
      );

      /* CF3·CF4 · stage isolation은 그대로다 — boolean만 넣었으므로 */
      const crush = await withTarget('crush');
      const dating = await withTarget('dating');
      const married = await withTarget('married');
      check(
        'CF3 — crush(talking) vs dating: 같은 tense·같은 allow → 같은 지문 (F5 유지)',
        fpOf(crush) === fpOf(dating),
        { crush: fpOf(crush), dating: fpOf(dating) },
      );
      check(
        'CF4 — dating vs married(long_term): 같은 지문 (F5 유지)',
        fpOf(dating) === fpOf(married),
        { dating: fpOf(dating), married: fpOf(married) },
      );
      check(
        'CF3·CF4 — 세 job 모두 allow=true다 (같은 지문의 근거)',
        [crush, dating, married].every((r) => r.aiBoundary.allowsOutwardQuestions === true),
        [crush, dating, married].map((r) => [
          r.resolution.job,
          r.aiBoundary.allowsOutwardQuestions,
        ]),
      );

      /* CF5 · none vs dating — 같은 tense, 금지↔허용 */
      const none = await withoutTarget('solo_none');
      check(
        'CF5 — none vs dating: 같은 tense · allow false/true → 다른 지문',
        fpOf(none) !== fpOf(dating) && none.aiBoundary.tense === dating.aiBoundary.tense,
        {
          none: [none.resolution.job, none.aiBoundary.allowsOutwardQuestions, fpOf(none)],
          dating: [dating.resolution.job, dating.aiBoundary.allowsOutwardQuestions, fpOf(dating)],
        },
      );

      /* CF6 · ended 대조군 — 이건 tense가 이미 나눈다 */
      const ended = await withTarget('ended');
      check(
        'CF6 — dating vs ended: tense가 current/former로 달라 이미 분리돼 있었다',
        fpOf(ended) !== fpOf(dating) && ended.aiBoundary.tense === 'former',
        { dating: fpOf(dating), ended: fpOf(ended), endedTense: ended.aiBoundary.tense },
      );
      /**
       * ⚠️ **CF6이 대조군인 이유.** `ended`는 tense가 `former`라 §40.5의 지문이 이미
       * 갈라놨다. 그래서 이번 결함은 `ended`에서 나지 않았고, **같은 tense + 다른 정책**
       * (`none` vs `talking`/`dating`)에서만 났다. 이 줄이 그 범위를 고정한다.
       */
      check(
        'CF6 — 결함 범위: ended가 아니라 same-tense/different-policy였다',
        ended.aiBoundary.allowsOutwardQuestions === false &&
          none.aiBoundary.allowsOutwardQuestions === false &&
          fpOf(ended) !== fpOf(none),
        {
          ended: [ended.aiBoundary.tense, fpOf(ended)],
          none: [none.aiBoundary.tense, fpOf(none)],
        },
      );

      /* CF-R · 실제 도달 경로 재현 (S30 미답 세션) ─────────────────────
         브라우저에서 확인한 3단계를 그대로 태운다. `current`가 처음부터 비어 있으므로
         New Target reset이 그것을 비워도 지문이 달라지지 않는다 — 그래서 이 경로에서만
         정책이 겹쳤다. */
      const NO_CURRENT = { signals: {}, askedAt: null };
      const rDating = await run({
        ...CF_SESSION,
        status: 'dating',
        target: TARGET,
        currentRelationship: NO_CURRENT,
      });
      const rReset = await run({
        ...CF_SESSION,
        status: 'dating',
        target: {},
        currentRelationship: NO_CURRENT,
      });
      const rSolo = await run({
        ...CF_SESSION,
        status: 'solo_exp',
        target: {},
        currentRelationship: NO_CURRENT,
      });

      check(
        'CF-R — New Target reset만으로는 정책이 안 바뀐다 (job dating → unknown · 둘 다 허용)',
        rDating.aiBoundary.allowsOutwardQuestions === true &&
          rReset.aiBoundary.allowsOutwardQuestions === true &&
          fpOf(rDating) === fpOf(rReset),
        {
          dating: [rDating.resolution.job, fpOf(rDating)],
          reset: [rReset.resolution.job, fpOf(rReset)],
        },
      );
      check(
        'CF-R — S05에서 솔로를 고르면 job=none이 되고 정책이 뒤집힌다',
        rSolo.resolution.job === 'none' &&
          rSolo.aiBoundary.allowsOutwardQuestions === false &&
          rSolo.aiBoundary.tense === 'current',
        {
          job: rSolo.resolution.job,
          allow: rSolo.aiBoundary.allowsOutwardQuestions,
          tense: rSolo.aiBoundary.tense,
        },
      );
      check(
        'CF-R — 그 전환에서 지문이 갈린다 (v1.42 이전에는 같았다)',
        fpOf(rDating) !== fpOf(rSolo),
        { before: fpOf(rDating), after: fpOf(rSolo) },
      );
      check(
        'CF-R — 갈린 이유가 tense가 아니다 (둘 다 current)',
        rDating.aiBoundary.tense === rSolo.aiBoundary.tense,
        { a: rDating.aiBoundary.tense, b: rSolo.aiBoundary.tense },
      );

      /* 구조 검사 — 지문 배선과 단일 source */
      const { readFileSync } = await import('node:fs');
      const stripComments = (raw) =>
        raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

      const hook = stripComments(readFileSync('src/hooks/useAiNarrative.ts', 'utf-8'));
      check(
        'CF — 훅이 지문에 allowsOutwardQuestions를 넘긴다',
        /relationshipNarrativeFingerprint\(\{[\s\S]*?allowsOutwardQuestions,/.test(hook),
        '지문 호출에 allowsOutwardQuestions가 없다',
      );
      check(
        'CF — 그 지문 memo deps에도 들어 있다',
        /\[\s*tense,\s*allowsOutwardQuestions,/.test(hook),
        'deps에 allowsOutwardQuestions가 없다',
      );
      check(
        'CF — 지문에 job/stage/status 문자열을 넣지 않았다 (§40.5 유지)',
        !/relationshipNarrativeFingerprint\(\{[\s\S]*?(job|stage|status):/.test(hook),
        '지문에 stage 계열 문자열이 들어갔다',
      );

      const fp = stripComments(readFileSync('src/lib/aiFingerprint.ts', 'utf-8'));
      check(
        'CF — 지문 함수가 boolean을 canonical 문자열로 고정한다',
        /allowsOutwardQuestions \? 'q:on' : 'q:off'/.test(fp),
        'boolean이 digest에 그대로 들어가고 있다',
      );
      check(
        'CF — 지문 함수가 RelationshipStatus를 받지 않는다',
        !/RelationshipStatus/.test(fp),
        'aiFingerprint.ts가 RelationshipStatus를 다시 받고 있다',
      );
    }

  }


  /* ═══════════════════════════════════════════════════════════════════════
     C4 ~ C5 · CMP-CTX — Compatibility Cache Identity & Context (v1.43 · §47.4)

     ══ 왜 relationship과 따로 검사하는가 ═════════════════════════════════

     v1.42 §8.13이 relationship 지문에서 닫은 결함이 compatibility 지문에는 그대로
     남아 있었다. 캐시가 저장하는 것은 provider raw가 아니라 **게이트가 적용된 최종
     응답**이고(`aiClient`의 `cache.set(key, json.data)`), **캐시 히트에는 응답이 없다** —
     히트의 정의가 '서버에 가지 않는 것'이다. 그래서 게이트 입력이 다르면 재사용해도
     되는 응답이 아니다.

     그리고 반대 방향의 문제도 있었다: `target.relation`이 지문에 있었는데 AI context에는
     **항상 null**로 나갔다(§47.6). v1.42 §40.5가 `status`를 뺀 근거를 그대로 적용한다 —
     AI가 받지 않는 값은 캐시 키도 아니다.
     ═══════════════════════════════════════════════════════════════════════ */
  console.log('\nC4~C5 · CMP-CTX — Compatibility Cache Identity (v1.43 §47.4)');
  {
    const cmpFp = (result) => result.compatibilityBoundary.fingerprint;

    /**
     * 같은 근거·같은 상대 정보로 **status만** 바꾼다. 상대 4축을 전부 채워 SUFFICIENCY를
     * `couple`로 고정하므로, 달라지는 것은 STAGE → JOB → (tense · allow)뿐이다.
     */
    const TARGET_KNOWN = { relation: 'crush', contact: 'h', conflict: 'l', alone: 'h', affection: 'm' };
    const base = { declared: DECLARED, experience: EXPERIENCE, target: TARGET_KNOWN };

    const dating = await run({ ...base, status: 'dating' });
    const married = await run({ ...base, status: 'married' });
    const ended = await run({ ...base, status: 'ended' });
    const soloExp = await run({ ...base, status: 'solo_exp' });

    /* 전제 — 네 세션의 Job이 실제로 기대한 값인가. 이게 틀리면 아래가 전부 무의미하다 */
    check('C4 — 전제: dating→job=dating · ended→job=ended', dating.resolution.job === 'dating' && ended.resolution.job === 'ended', {
      dating: dating.resolution.job,
      ended: ended.resolution.job,
    });
    check(
      'C4 — 전제: solo_exp + 상대 4축 → job=talking (② 데이터 우선)',
      soloExp.resolution.job === 'talking',
      soloExp.resolution.job,
    );

    /* ── C4 · tense가 다르면 지문이 다르다 ─────────────────────────────── */
    check(
      'C4 — dating(current) ↔ ended(former) → 지문이 다르다',
      cmpFp(dating) !== cmpFp(ended),
      { dating: cmpFp(dating), ended: cmpFp(ended) },
    );
    check(
      'C4 — 그 두 세션의 tense가 실제로 갈렸다',
      dating.compatibilityBoundary.tense === 'current' &&
        ended.compatibilityBoundary.tense === 'former',
      { dating: dating.compatibilityBoundary.tense, ended: ended.compatibilityBoundary.tense },
    );
    check(
      'C4 — ended에서 질문 정책이 금지다',
      ended.compatibilityBoundary.allowsOutwardQuestions === false,
      ended.compatibilityBoundary.allowsOutwardQuestions,
    );

    /* ── C5 · tense·정책이 같으면 지문도 같다 (과도 무효화 아님) ────────── */
    check(
      'C5 — dating ↔ married: tense·정책이 같으므로 같은 지문 (재사용이 정당하다)',
      cmpFp(dating) === cmpFp(married),
      { dating: cmpFp(dating), married: cmpFp(married) },
    );
    check(
      'C5 — dating ↔ solo_exp(job=talking): 같은 지문',
      cmpFp(dating) === cmpFp(soloExp),
      { dating: cmpFp(dating), soloExp: cmpFp(soloExp) },
    );
    /**
     * ⚠️ **§47.6의 실제 검증.** `relation`만 다른 두 세션이 같은 지문이어야 한다 —
     * 그 값은 모델에게 가지 않고(항상 null이었다) 최종 응답도 바꾸지 않는다.
     * SUFFICIENCY는 4축이 이미 `couple`로 만들었으므로 JOB도 그대로다.
     */
    const relationFriend = await run({
      ...base,
      status: 'dating',
      target: { ...TARGET_KNOWN, relation: 'friend' },
    });
    check(
      'C5 — target.relation만 다르면 같은 지문 (§47.6 — AI가 받지 않는 값)',
      cmpFp(dating) === cmpFp(relationFriend),
      { crush: cmpFp(dating), friend: cmpFp(relationFriend) },
    );

    /* ── CMP-CTX · AI context 계약 ─────────────────────────────────────── */
    check(
      'CMP-CTX — context에 raw RelationshipStatus enum이 0건이다',
      ended.compatibilityBoundary.rawStatusTokens.length === 0,
      ended.compatibilityBoundary.rawStatusTokens,
    );
    check(
      'CMP-CTX — context의 tense가 relationshipTenseOf(job)와 같다',
      ended.compatibilityBoundary.contextTense === ended.compatibilityBoundary.tense,
      {
        context: ended.compatibilityBoundary.contextTense,
        job: ended.compatibilityBoundary.tense,
      },
    );
    check(
      'CMP-CTX — context 키에 targetRelation 죽은 필드가 없다 (§47.6)',
      !ended.compatibilityBoundary.contextKeys.includes('targetRelation'),
      ended.compatibilityBoundary.contextKeys,
    );
    check(
      'CMP-CTX — context 키에 tense가 있다',
      ended.compatibilityBoundary.contextKeys.includes('tense'),
      ended.compatibilityBoundary.contextKeys,
    );
    /**
     * ⚠️ **허용집합이 축을 넘지 않는다.** 각 dimension의 허용 목록에 그 축의 세 출처만
     * 있고 다른 축은 없어야 한다 — 이게 C8이 fixture로 보는 것의 데이터 쪽 근거다.
     */
    for (const [dimension, refs] of Object.entries(
      dating.compatibilityBoundary.allowedRefsByDimension,
    )) {
      const foreign = refs.filter((ref) => !ref.endsWith(`:${dimension}`));
      check(
        `CMP-CTX — ${dimension} 허용집합에 다른 축의 근거가 없다`,
        foreign.length === 0,
        foreign,
      );
      check(
        `CMP-CTX — ${dimension} 허용집합이 compatibility·declared·target 3종이다`,
        refs.length === 3,
        refs,
      );
    }

    /* ── D-CACHE · Deep Report 지문에 tense가 들어갔다 (§47.5) ──────────── */
    check(
      'D-CACHE — dating(current) ↔ ended(former) → deep-report 지문이 다르다',
      dating.deepReportBoundary.fingerprint !== ended.deepReportBoundary.fingerprint,
      {
        dating: dating.deepReportBoundary.fingerprint,
        ended: ended.deepReportBoundary.fingerprint,
      },
    );
    check(
      'D-CACHE — dating ↔ married: 같은 tense이므로 같은 지문',
      dating.deepReportBoundary.fingerprint === married.deepReportBoundary.fingerprint,
      {
        dating: dating.deepReportBoundary.fingerprint,
        married: married.deepReportBoundary.fingerprint,
      },
    );
  }


  /* ═══════════════════════════════════════════════════════════════════════
     CC0 ~ CC7 — USER CORRECTION TRUST BOUNDARY (v1.43 · §48)

     ══ 무엇을 고정하는가 ═════════════════════════════════════════════════

     사용자가 Core 판정을 직접 고치면 화면 headline이 그 문장으로 교체된다. v1.42까지
     바로 아래 `CoreInsightNarrativeView`가 `core.summary`를 **그대로** 그렸고, 실측에서
     이런 화면이 나왔다(§48.2):

     ```
     headline (사용자)  "연락 자체가 아니라 혼자 있는 시간이 줄어드는 게 힘들었어."
     AI summary         "연락은 중요하지 않다고 느꼈지만, 실제로는 연락 감소가
                         힘들었던 경험이 있었어."
     ```

     사용자가 **명시적으로 부정한 판정**을 AI가 두 줄 아래에서 다시 주장한다.

     ══ 왜 fixture가 아니라 구조 검사인가 ═════════════════════════════════

     이 게이트는 **렌더 경로**에 있고 Provider 응답을 바꾸지 않는다. `contract-test`
     라우트는 응답 파이프라인만 돌리므로 이 규칙을 볼 수 없다. 그래서 v1.43 §8.14가
     TC0~TC6에서 쓴 방식 그대로 **소스를 읽어** 배선을 고정한다 — 실제 화면 동작은
     브라우저 J1~J3이 확인한다(§48.9).
     ═══════════════════════════════════════════════════════════════════════ */
  console.log('\nCC0~CC7 — User Correction Trust Boundary (v1.43 §48)');
  {
    const { readFileSync } = await import('node:fs');
    const stripComments = (raw) =>
      raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    const resolver = stripComments(readFileSync('src/lib/aiEvidenceResolver.ts', 'utf-8'));
    const views = stripComments(readFileSync('src/components/ai/NarrativeViews.tsx', 'utf-8'));
    const mirrorPage = stripComments(readFileSync('src/app/mirror/page.tsx', 'utf-8'));
    const contextBuilders = stripComments(
      readFileSync('src/services/ai/contextBuilders.ts', 'utf-8'),
    );
    const fingerprint = stripComments(readFileSync('src/lib/aiFingerprint.ts', 'utf-8'));
    const handlers = stripComments(readFileSync('src/services/ai/handlers.ts', 'utf-8'));

    const countOf = (source, pattern) => (source.match(pattern) ?? []).length;

    /* ── CC0 · correction이 없으면 기존 동작이 그대로다 ─────────────────── */
    /**
     * 게이트의 **유일한** 조건이 correction의 존재다. 다른 조건이 섞이면
     * `correction 없음`에서도 무언가 달라질 수 있고, 그건 v1.42 동작 변경이다.
     */
    check(
      'CC0 — 게이트 조건이 coreCorrection 하나뿐이다 (correction 없으면 v1.42와 동일)',
      /return answers\.coreCorrection\.trim\(\)\.length > 0 \? null : core;/.test(resolver),
      '게이트 조건에 다른 값이 섞였다',
    );
    check(
      'CC0 — 게이트가 core를 그대로 돌려준다 (내용을 고치지 않는다)',
      !/coreNarrativeForRender[\s\S]{0,600}?\.\.\.core/.test(resolver),
      '게이트가 core 객체를 변형하고 있다',
    );

    /* ── CC1 · correction이 있으면 stale core summary가 화면에 없다 ────── */
    check(
      'CC1 — 게이트가 correction 존재 시 null을 돌려준다',
      /export function coreNarrativeForRender[\s\S]*?\?\s*null\s*:\s*core;/.test(resolver),
      'coreNarrativeForRender가 null을 돌려주지 않는다',
    );
    check(
      'CC1 — 렌더러가 게이트를 통과한 값만 쓴다',
      /const core = coreNarrativeForRender\(rawCore, context\.answers\);/.test(views),
      'CoreInsightNarrativeView가 게이트를 부르지 않는다',
    );
    /**
     * ⚠️ prop 이름을 `rawCore`로 바꾼 것이 계약의 일부다. 컴포넌트 안에서 `core`가
     * **게이트를 통과한 값**만 가리키므로, 아래 `core.summary`가 원본을 참조할 수 없다.
     */
    check(
      'CC1 — 게이트 이전 값(rawCore)이 렌더에 직접 쓰이지 않는다',
      !/rawCore\.(summary|limitations|evidenceRefs|headline)/.test(views),
      'rawCore가 렌더에 직접 쓰이고 있다',
    );

    /* ── CC2 · correction을 바꿔도 이전 correction용 summary가 없다 ────── */
    /**
     * 게이트는 correction의 **내용**을 보지 않고 **존재**만 본다. 그래서 A → B로 바꿔도
     * 억제 상태가 유지되고, '이전 correction용 AI summary'라는 것이 애초에 존재할 수 없다.
     * 내용을 비교하는 구조면 A→B에서 한쪽이 통과할 수 있으므로 그 형태를 금지한다.
     */
    check(
      'CC2 — 게이트가 correction 내용을 비교하지 않는다 (존재만 본다)',
      !/coreCorrection[\s\S]{0,120}(===|includes|startsWith|indexOf)/.test(resolver),
      '게이트가 correction 문자열을 비교하고 있다',
    );

    /* ── CC3 · correction을 제거하면 정상 복원된다 ──────────────────────── */
    /**
     * ⚠️ **캐시를 무효화하지 않는 것이 여기서 중요하다.** correction을 지우면 사용자는
     * `원래 관찰로 되돌리기`를 누른 것이고, 돌아와야 하는 것은 **그가 원래 봤던 그 문장**이다.
     * 지문에 correction을 넣어 재생성하면 **다른 관찰**이 돌아온다 — 되돌리기가 아니다.
     */
    check(
      'CC3 — 게이트가 렌더 시점에 판정한다 (state를 저장하지 않는다)',
      !/useState|useRef|useMemo/.test(
        /export function coreNarrativeForRender[\s\S]*?\n\}/.exec(resolver)?.[0] ?? '',
      ),
      '게이트가 상태를 들고 있다 — 복원이 보장되지 않는다',
    );

    /* ── CC4 · 같은 correction에서 캐시가 안정적이다 ─────────────────────── */
    /**
     * correction은 **최종 응답을 바꾸지 않는다**(게이트가 렌더 경로에 있다). 그래서
     * v1.43 §8.14.8의 `cacheIdentity` 정의(`최종 응답을 바꾸는 policy input`)에 따라
     * 지문에 들어가지 않는다.
     *
     * ⚠️ **이 결정은 비용 절감이 아니라 정확성이다.** 지문에 넣으면
     *   ① context에 correction이 없으므로 **입력이 같은** 요청이 한 번 더 나가고
     *   ② 모델은 같은 종류의 core summary를 다시 만들고, 우리는 그것을 또 억제하고
     *   ③ `원래 관찰로 되돌리기`가 **다른 문장**을 가져온다 (CC3 참고)
     */
    check(
      'CC4 — 지문에 coreCorrection이 들어가지 않는다 (§48.7)',
      !/coreCorrection|coreVerdict/.test(fingerprint),
      'aiFingerprint.ts가 correction을 해싱하고 있다',
    );
    /**
     * ⚠️ **커플링을 테스트가 지킨다.** 지금은 correction이 AI context에 없으므로 지문에도
     * 없는 것이 맞다. 누군가 나중에 context에 넣으면(선택지 A) **그 순간 지문에도 들어가야
     * 한다** — 그때 이 검사가 실패해서 알려준다. v1.43 §8.14가 `EVIDENCE_SOURCES` 주석을
     * TC5로 바꾼 것과 같은 방식이다.
     */
    const correctionInContext = /coreCorrection|coreVerdict/.test(contextBuilders);
    const correctionInFingerprint = /coreCorrection|coreVerdict/.test(fingerprint);
    check(
      'CC4 — AI context에 correction이 들어가면 지문에도 들어간다 (커플링 강제)',
      !correctionInContext || correctionInFingerprint,
      `context=${correctionInContext} fingerprint=${correctionInFingerprint} — context에 넣었으면 지문에도 넣어야 한다`,
    );

    /* ── CC5 · USER CORRECTION > AI NARRATIVE ───────────────────────────── */
    check(
      'CC5 — headline이 correction을 가장 먼저 본다',
      /const headline = answers\.coreCorrection\.trim\(\) \|\| aiHeadline \|\| mirror\.core\.headline;/.test(
        mirrorPage,
      ),
      'headline 우선순위가 바뀌었다',
    );
    /**
     * ⚠️ **free text를 Provider로 보내지 않는다**(§48.4). correction은 자유서술이고
     * 근거가 아니라 **판정에 대한 반론**이므로 기존 자유서술 예외 3종에 해당하지 않는다.
     * 그리고 더 중요한 이유: 한 문장을 주고 설명하라고 하면 모델은 그 문장 밖으로 나간다 —
     * 사용자 입력을 근거 삼아 없던 해석을 만드는 것이다.
     */
    check(
      'CC5 — AI context에 correction free text가 들어가지 않는다',
      !correctionInContext,
      'contextBuilders.ts가 correction을 Provider로 보내고 있다',
    );
    check(
      'CC5 — 서버가 core를 지우지 않는다 (History 기록 충실성 · §48.5)',
      !/core:\s*null[\s\S]{0,200}coreCorrection/.test(handlers) &&
        !/coreCorrection|coreVerdict/.test(handlers),
      'handlers.ts가 correction을 보고 응답을 바꾸고 있다',
    );
    /**
     * 서버가 `core`를 지우면 `aiHeadline`이 null이 되고 History의 `coreInsightOriginal`이
     * **결정론 headline으로 떨어진다** — 사용자가 실제로 거부한 문장이 기록에서 사라진다.
     */
    check(
      'CC5 — History가 AI 원본 headline을 그대로 기록한다',
      /coreInsightOriginal: aiHeadline \?\? mirror\.core\?\.headline/.test(mirrorPage),
      'History provenance 배선이 바뀌었다',
    );

    /* ── CC6 · correction 때문에 축별 narrative가 전멸하지 않는다 ────────── */
    /**
     * 사용자가 부정한 것은 **Core 판정 하나**다. 축별 설명은 각자의 결정론 판정을
     * 설명하므로 함께 지우면 과필터다(§27 AI는 augmentation).
     */
    /**
     * ⚠️ **함수 본문으로 한정해서 본다.** 처음에는
     * `/export function MirrorAxisNarrative[\s\S]*?coreNarrativeForRender/`로 썼는데
     * `MirrorAxisNarrative`가 파일에서 **먼저** 정의되므로 그 정규식이 뒤쪽
     * `CoreInsightNarrativeView`의 호출까지 집어삼켜 거짓 실패했다(첫 실행에서 실측).
     * 함수 경계를 넘는 `[\s\S]*?`는 이 파일 구조에서 신뢰할 수 없다.
     */
    const axisViewBody =
      /export function MirrorAxisNarrative\([\s\S]*?\n\}/.exec(views)?.[0] ?? '';
    check(
      'CC6 — MirrorAxisNarrative가 게이트를 부르지 않는다 (축별 설명 유지)',
      axisViewBody.length > 0 && !axisViewBody.includes('coreNarrativeForRender'),
      '축별 narrative가 correction 게이트를 받고 있다',
    );
    check(
      'CC6 — 게이트 호출이 Core 렌더러 한 곳뿐이다',
      countOf(views, /coreNarrativeForRender\(/g) === 1,
      `게이트 호출 ${countOf(views, /coreNarrativeForRender\(/g)}건 (기대 1)`,
    );

    /* ── CC7 · 게이트를 우회하는 렌더 경로가 없다 + raw stage 재유입 0 ───── */
    /**
     * ⚠️ **v1.43 §8.14가 배운 것을 여기에 적용한다.** 페이지에 `if (correction) hide`를
     * 두면 게이트를 통과하지 않는 렌더 지점이 남고, 그게 compatibility 질문 누출의
     * 형태였다. 그래서 `core.summary`가 **게이트를 거친 뒤에만** 화면에 닿는지 검사한다.
     */
    const { readdirSync, statSync } = await import('node:fs');
    const walk = (dir) =>
      readdirSync(dir).flatMap((name) => {
        const path = `${dir}/${name}`;
        return statSync(path).isDirectory()
          ? walk(path)
          : /\.(tsx?)$/.test(name)
            ? [path]
            : [];
      });
    /** 화면 계층 전체 — API 라우트는 렌더가 아니므로 제외한다 */
    const renderFiles = ['src/app', 'src/components', 'src/hooks']
      .flatMap(walk)
      .filter((path) => !path.startsWith('src/app/api/'));

    /**
     * ⚠️ 판별 기준은 **AI Core narrative 타입을 다루는가**다. `mirror.core.summary`는
     * 결정론 값이라 이 게이트의 대상이 아니고(홈·First Contact가 정상적으로 쓴다),
     * 두 개를 문자열로 구분하려 하면 판정이 취약해진다. 타입 이름은 명확하다.
     */
    const offenders = renderFiles.filter((path) => {
      if (path === 'src/components/ai/NarrativeViews.tsx') return false;
      const source = stripComments(readFileSync(path, 'utf-8'));
      return source.includes('CoreInsightNarrative') && !source.includes('CoreInsightNarrativeView');
    });
    check(
      'CC7 — AI Core narrative를 게이트 밖에서 다루는 화면이 0건이다',
      offenders.length === 0,
      offenders,
    );
    /**
     * ⚠️ v1.44 R-12 — **패턴을 넓혔다. 불변식은 그대로다.**
     *
     * 이 검사가 지키는 것은 `narrative.data.core`를 렌더 컴포넌트로 넘기는 자리가
     * **하나뿐**이라는 것이다(게이트가 한 지점에 있어야 화면과 기록이 갈리지 않는다).
     *
     * v1.43은 그것을 리터럴 `core={narrative.data?.core}`로 고정했는데, R-12에서 그 자리에
     * **소비 게이트가 붙었다**:
     *
     * ```
     * core={canUseAiAxisNarrative(focusInsight) ? narrative.data?.core : undefined}
     * ```
     *
     * 리터럴은 깨지고 불변식은 유지된다 — 여전히 넘기는 자리는 한 곳이다. 그래서
     * `core=` prop 안에서 `narrative.data?.core`를 넘기는 횟수를 센다(게이트 래퍼 허용).
     * 게이트 자체는 `test:trust` TEMP-AI-AXIS-06이 별도로 고정한다.
     */
    const corePropCount = countOf(mirrorPage, /core=\{[^}]*narrative\.data\?\.core/g);
    check(
      'CC7 — narrative.data.core를 렌더 컴포넌트로 넘기는 곳이 Core 렌더러 하나뿐이다',
      corePropCount === 1,
      `${corePropCount}건`,
    );
    /** §7 — raw stage/job/status가 이 작업으로 재유입되지 않았다 */
    for (const [label, source] of [
      ['aiEvidenceResolver', resolver],
      ['NarrativeViews', views],
      ['contextBuilders', contextBuilders],
      ['aiFingerprint', fingerprint],
    ]) {
      const hits = ['RelationshipStatus', 'RelationshipStage', 'RelationshipJob'].filter((token) =>
        source.includes(token),
      );
      check(`CC7 — ${label}에 raw stage/job/status 0건`, hits.length === 0, hits);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     TC0 ~ TC6 — AI TASK CONTRACT (v1.43 · §43)

     ══ 왜 구조 검사여야 하는가 ═══════════════════════════════════════════

     v1.42는 AI 경계 계약 5개를 `relationship` **한 Task에만** 세웠고, 나머지 4개
     Task에 같은 계약이 있는지 확인하는 장치가 없었다. 그 결과가 v1.43 Audit에서
     실측으로 재현됐다:

     ```
     status=ended · target 4축 → job=ended · allowsOutwardQuestions=false
       /mirror         AI 질문 0     relationship Task: 게이트 있음
       /compatibility  AI 질문 2     compatibility Task: 게이트 없음
     ```

     fixture로는 이걸 잡을 수 없었다. compatibility fixture가 없었기 때문이고,
     **없는 fixture는 실패하지 않는다.** 그래서 v1.43은 fixture를 늘리는 것과 별도로
     **"모든 Task가 모든 차원에 대해 값을 갖는가"를 구조로 강제**한다 — R1이 Resolver를,
     R2가 Context Builder를 지키는 방식 그대로다.
     ═══════════════════════════════════════════════════════════════════════ */
  console.log('\nTC0~TC6 — AI Task Contract 구조 검사 (v1.43)');
  {
    const { readFileSync } = await import('node:fs');
    const stripComments = (raw) =>
      raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    const contract = stripComments(readFileSync('src/services/ai/taskContract.ts', 'utf-8'));
    const handlers = stripComments(readFileSync('src/services/ai/handlers.ts', 'utf-8'));
    const service = stripComments(readFileSync('src/services/aiService.ts', 'utf-8'));
    const hook = stripComments(readFileSync('src/hooks/useAiNarrative.ts', 'utf-8'));
    const fingerprint = stripComments(readFileSync('src/lib/aiFingerprint.ts', 'utf-8'));
    const prompts = stripComments(readFileSync('src/services/ai/promptTemplates.ts', 'utf-8'));
    const schemas = stripComments(readFileSync('src/services/ai/schemas.ts', 'utf-8'));
    const safety = stripComments(readFileSync('src/services/ai/safety.ts', 'utf-8'));
    const contextBuilders = stripComments(
      readFileSync('src/services/ai/contextBuilders.ts', 'utf-8'),
    );
    /**
     * ⚠️ **주석을 지우고 본다.** `EvidenceRef` 정의의 doc comment가
     * `{source:'relationship', field:'hardest'}` 같은 **예시 ref**를 그대로 적고 있어서,
     * 지우지 않으면 그 예시가 source 하나로 더 세어진다(첫 실행에서 실제로 11종이 나왔다).
     * R1·R2가 같은 이유로 같은 처리를 한다.
     */
    const types = stripComments(readFileSync('src/types/index.ts', 'utf-8'));

    const countOf = (source, pattern) => (source.match(pattern) ?? []).length;

    /* ── TC0 · 모든 Task가 계약에 등장하고, 모든 차원에 값이 있다 ───────── */
    const TASKS = [
      'relationship-insight',
      'compatibility-narrative',
      'history-insight',
      'deep-report-narrative',
      'observed-profile',
      /**
       * v1.46 AI Lens §3 — 렌즈 4종. `Record<AiTask, …>`가 누락을 이미 막지만,
       * 이 목록에 적어야 **차원 개수 검사**(아래 DIMENSIONS 루프)가 9개 Task를 센다.
       * 그게 렌즈 계약을 생성기로 만들지 않고 세 번 적어 둔 이유다(taskContract.ts).
       */
      'premium-mbti-lens',
      'premium-saju-lens',
      'premium-zodiac-lens',
      'premium-cross-lens',
    ];
    const DIMENSIONS = [
      'promptVersion',
      'tense',
      'outwardQuestions',
      'identifier',
      'evidence',
      'cacheIdentity',
      'observability',
    ];

    for (const task of TASKS) {
      check(`TC0 — ${task}가 TASK_CONTRACT에 등장한다`, contract.includes(`'${task}'`), task);
    }

    /**
     * ⚠️ `Record<AiTask, …>`가 Task 누락을 막고 `AiTaskContract`가 필드 누락을 막지만,
     * 그건 **그 두 타입이 그 모양으로 남아 있는 동안만** 참이다. 누군가 필드를 `?:`로
     * 바꾸면 `tsc`는 통과하고 계약은 사라진다 — 그 구조 자체를 고정한다.
     */
    const contractInterface = /interface AiTaskContract \{[\s\S]*?\n\}/.exec(contract)?.[0] ?? '';
    check(
      'TC0 — AiTaskContract의 차원이 전부 필수다 (optional 0건)',
      contractInterface.length > 0 && !contractInterface.includes('?:'),
      'AiTaskContract에 optional 필드가 있다',
    );
    check(
      'TC0 — TASK_CONTRACT가 Record<AiTask, …>다 (새 Task를 tsc가 막는다)',
      /TASK_CONTRACT:\s*Record<AiTask,\s*AiTaskContract>/.test(contract),
      'TASK_CONTRACT의 타입이 Record<AiTask, …>가 아니다',
    );
    for (const dimension of DIMENSIONS) {
      const occurrences = countOf(contract, new RegExp(`\\n\\s+${dimension}:`, 'g'));
      check(
        `TC0 — ${dimension} 차원이 ${TASKS.length}개 Task 전부에 있다 (발견 ${occurrences})`,
        occurrences >= TASKS.length,
        `${dimension}: ${occurrences}건`,
      );
    }
    /** '미적용'을 빈칸이 아니라 값으로 적는다 — 그 구분이 없던 상태가 v1.42다 */
    check(
      'TC0 — 미적용을 not-applicable로 명시한다',
      contract.includes("'not-applicable'"),
      'not-applicable 표기가 없다',
    );

    /* ── TC1 · tense source는 relationshipTenseOf 하나 ───────────────────── */
    const tenseCalls = countOf(hook, /relationshipTenseOf\(/g);
    check(
      `TC1 — tense를 쓰는 3개 Task가 모두 relationshipTenseOf에서 받는다 (호출 ${tenseCalls})`,
      tenseCalls >= 3,
      `useAiNarrative.ts의 relationshipTenseOf 호출 ${tenseCalls}건`,
    );
    /**
     * ⚠️ 이게 핵심이다. 어느 Task든 status를 직접 판정하면 판정이 두 벌이 되고,
     * 두 벌이 갈리는 순간 화면과 AI가 다른 시제를 쓴다(v1.42 §40.10).
     */
    for (const [label, source] of [
      ['useAiNarrative', hook],
      ['aiService', service],
      ['handlers', handlers],
    ]) {
      check(
        `TC1 — ${label}이 status를 직접 판정하지 않는다`,
        !/status\s*===\s*'ended'/.test(source),
        `${label}에 status 직접 분기가 있다`,
      );
    }
    /**
     * 시제 프롬프트 문구의 단일 source — 복사본이 갈라지지 않게 한다(§47.2)
     *
     * ⚠️ v1.46 AI Lens — **3 → 5.** 삽입 지점이 두 개 늘었다:
     *
     * ```
     * relationship · compatibility · deep-report   3   (v1.43)
     * lensSystemPrompt(kind)                       1   ← 세 렌즈 Task가 공유한다
     * PREMIUM_CROSS_LENS_SYSTEM_PROMPT             1
     * ```
     *
     * 렌즈 세 개가 삽입 1건인 것이 핵심이다 — 프롬프트 본문이 함수 하나에서 나오므로
     * MBTI·사주·별자리가 **구조적으로** 같은 시제 계약을 받는다. 여기 숫자가 7이 되면
     * 누군가 렌즈별로 프롬프트를 복사한 것이고, 그때 이 검사가 알려준다.
     */
    const tenseInserts = countOf(prompts, /\$\{TENSE_CONTRACT\}/g);
    check(
      `TC1 — 시제 프롬프트가 TENSE_CONTRACT 상수 하나에서 나온다 (삽입 ${tenseInserts})`,
      /const TENSE_CONTRACT = `/.test(prompts) && tenseInserts === 5,
      `TENSE_CONTRACT 삽입 ${tenseInserts}건 (기대 5)`,
    );
    check(
      'TC1 — 시제 블록 원문이 프롬프트에 한 번만 있다 (복사본 0)',
      countOf(prompts, /\[시제\]/g) === 1,
      '시제 블록이 복사됐다',
    );

    /* ── TC2 · question gate source는 jobAllowsOutwardQuestions 하나 ─────── */
    const gateSources = countOf(hook, /jobAllowsOutwardQuestions\(/g);
    check(
      `TC2 — 게이트를 쓰는 2개 Task가 모두 jobAllowsOutwardQuestions에서 받는다 (${gateSources})`,
      gateSources >= 2,
      `${gateSources}건`,
    );
    const gateCalls = countOf(handlers, /applyOutwardQuestionGate\(/g);
    check(
      `TC2 — 서버 게이트가 applyOutwardQuestionGate 하나다 (호출 ${gateCalls})`,
      gateCalls === 2,
      `handlers.ts의 게이트 호출 ${gateCalls}건 (기대 2 — relationship · compatibility)`,
    );
    /**
     * ⚠️ v1.43 — 게이트가 **필드 이름을 명시**한다. 기본값 `'question'`을 두면
     * compatibility 호출부가 값을 빼먹었을 때 아무것도 지우지 않고 조용히 통과한다.
     */
    check(
      'TC2 — 게이트가 questionKey를 필수로 받는다 (기본값 없음)',
      /questionKey: K,/.test(safety) && !/questionKey\s*=/.test(safety),
      'applyOutwardQuestionGate의 questionKey에 기본값이 있다',
    );
    /** 순서가 정책이다 — 게이트가 스캔 뒤로 가면 질문 하나 때문에 설명이 사라진다 */
    for (const [label, needle] of [
      ['relationship', "applyOutwardQuestionGate(refChecked, request.allowsOutwardQuestions, 'question')"],
      [
        'compatibility',
        "applyOutwardQuestionGate(refChecked, request.allowsOutwardQuestions, 'conversationQuestion')",
      ],
    ]) {
      const gateAt = handlers.indexOf(needle);
      const scanAt = handlers.indexOf('const scan = filterSafeItems(', gateAt);
      check(
        `TC2 — ${label} 게이트가 안전 검사 앞에 있다 (순서가 정책)`,
        gateAt > 0 && scanAt > gateAt,
        `${label}: gate=${gateAt} scan=${scanAt}`,
      );
    }
    /** UI에 `if (ended) hide` 분기를 새로 만들지 않는다 — 서버 경계 한 곳(§47.2) */
    const axisNarratives = stripComments(
      readFileSync('src/components/ai/NarrativeViews.tsx', 'utf-8'),
    );
    check(
      'TC2 — 축별 AI 블록에 job/tense UI 분기가 없다',
      !/jobAllows|relationshipTenseOf|=== 'ended'/.test(axisNarratives),
      'NarrativeViews.tsx에 안전 분기가 생겼다 (서버 경계에서만 해야 한다)',
    );

    /* ── TC3 · raw stage/job/status가 AI context에 들어가지 않는다 ────────── */
    for (const forbidden of [
      'RelationshipStatus',
      'RelationshipStage',
      'RelationshipJob',
      'answers.status',
    ]) {
      check(
        `TC3 — Context Builder가 ${forbidden}을 쓰지 않는다`,
        !contextBuilders.includes(forbidden),
        forbidden,
      );
    }
    /**
     * ⚠️ v1.43 — R2를 **compatibility·deep-report까지** 넓힌 것이 이 검사다. v1.42의 R2는
     * 파일 단위였고 그때는 relationship만 tense를 받았으므로 사실상 한 Task를 지켰다.
     * 이제 3개 Task가 tense를 받으므로 같은 파일에서 3개 모두를 확인한다.
     */
    check(
      'TC3 — Compatibility context가 tense를 받는다 (raw stage 대신)',
      /buildCompatibilityContext\(input: \{[\s\S]*?tense: RelationshipTense;/.test(contextBuilders),
      'buildCompatibilityContext가 tense를 받지 않는다',
    );
    check(
      'TC3 — Deep Report context가 tense를 실어 보낸다',
      /return \{ tense, insights: built \};/.test(contextBuilders),
      'buildDeepReportContext가 tense를 context에 넣지 않는다',
    );
    /** 죽은 필드를 남겨두면 "이 값이 AI에 영향을 준다"는 잘못된 신호가 된다(§47.6) */
    check(
      'TC3 — Compatibility context에 targetRelation 죽은 필드가 없다',
      !contextBuilders.includes('targetRelation'),
      'targetRelation이 남아 있다',
    );

    /* ── TC4 · canonical axis enum이 프롬프트와 파서에서 갈리지 않는다 ───── */
    check(
      'TC4 — 프롬프트의 Mirror 축 목록이 MIRROR_AXES에서 파생된다',
      /const MIRROR_AXIS_ENUM = MIRROR_AXES\.map/.test(prompts),
      'promptTemplates.ts가 축 목록을 하드코딩하고 있다',
    );
    check(
      'TC4 — 프롬프트의 Compatibility 축 목록이 AXIS_DEFINITIONS에서 파생된다',
      /const COMPATIBILITY_AXIS_ENUM = AXIS_DEFINITIONS\.map/.test(prompts),
      'promptTemplates.ts가 dimension 목록을 하드코딩하고 있다',
    );
    check(
      'TC4 — 파서도 같은 상수에서 축 목록을 만든다',
      /MIRROR_AXIS_KEYS[\s\S]{0,120}MIRROR_AXES\.map/.test(schemas) &&
        /TARGET_AXIS_KEYS[\s\S]{0,120}AXIS_DEFINITIONS\.map/.test(schemas),
      'schemas.ts의 축 목록이 별도 하드코딩이다',
    );
    /** v1.42가 v6에서 고친 모호한 문구가 다른 Task에 남아 있지 않은지 */
    check(
      'TC4 — 모호 문구(주어진 axis 그대로)가 남아 있지 않다 (v1.42 v6 재발 방지)',
      !prompts.includes('주어진 axis 그대로'),
      'history 프롬프트에 v1.42가 고친 문구가 그대로 있다',
    );
    const axisBlocks = countOf(prompts, /\[축 식별자\]/g);
    check(
      `TC4 — 축 식별자 블록이 3개 Task에 있다 (발견 ${axisBlocks})`,
      axisBlocks === 3,
      `축 식별자 블록 ${axisBlocks}건 (기대 3 — relationship · compatibility · history)`,
    );

    /* ── TC5 · EVIDENCE_SOURCES와 EvidenceRef가 어긋나지 않는다 ─────────── */
    {
      const sourcesBlock =
        /const EVIDENCE_SOURCES = \[([\s\S]*?)\] as const;/.exec(schemas)?.[1] ?? '';
      /** ⚠️ 중복 제거한다 — 같은 source가 두 번 적혀도 '종'의 수는 하나다 */
      const parserSources = [
        ...new Set([...sourcesBlock.matchAll(/'([a-z_]+)'/g)].map((match) => match[1])),
      ];
      const typeBlock = /export type EvidenceRef =([\s\S]*?);\n/.exec(types)?.[1] ?? '';
      const typeSources = [
        ...new Set([...typeBlock.matchAll(/source:\s*'([a-z_]+)'/g)].map((match) => match[1])),
      ];

      check(
        `TC5 — 파서 source ${parserSources.length}종 · 타입 source ${typeSources.length}종이 같은 개수다`,
        parserSources.length === typeSources.length && parserSources.length > 0,
        `parser=[${parserSources.join('|')}] type=[${typeSources.join('|')}]`,
      );
      for (const source of typeSources) {
        check(
          `TC5 — ${source}가 EVIDENCE_SOURCES에 있다`,
          parserSources.includes(source),
          `EvidenceRef에는 있는데 파서 목록에 없다: ${source}`,
        );
      }
      for (const source of parserSources) {
        check(
          `TC5 — ${source}가 EvidenceRef에 있다`,
          typeSources.includes(source),
          `파서 목록에는 있는데 타입에 없다: ${source}`,
        );
      }
    }
    /** 네 Task가 같은 술어로 근거를 검사한다 — 별칭을 아는 Task와 모르는 Task가 갈리면 안 된다 */
    const refChecks = countOf(handlers, /refsWithinAllowed\(/g);
    check(
      `TC5 — 근거 귀속 검사가 refsWithinAllowed 하나다 (호출 ${refChecks})`,
      refChecks === 4,
      `handlers.ts의 검사 호출 ${refChecks}건 (기대 4 — 4개 Narrative Task)`,
    );
    check(
      'TC5 — 이전 술어(evidenceRefsAreSubsetOf)가 남아 있지 않다',
      !/export function evidenceRefsAreSubsetOf/.test(safety),
      'safety.ts에 이전 술어가 남아 있다',
    );
    /** 허용집합은 결정론 판정에서 파생된다 — relationshipRefFor가 두 벌이면 안 된다(§46.1) */
    const crossSource = stripComments(
      readFileSync('src/lib/logic/crossSourceInsights.ts', 'utf-8'),
    );
    const allowed = stripComments(readFileSync('src/lib/logic/allowedEvidence.ts', 'utf-8'));
    check(
      'TC5 — relationshipRefFor 정의가 allowedEvidence.ts 하나다',
      !/function relationshipRefFor\(/.test(crossSource) &&
        /export function relationshipRefFor\(/.test(allowed),
      'relationshipRefFor가 두 곳에 정의돼 있다',
    );
    /** 허용집합에 관대한 기본값이 없다 — 축에 근거가 없으면 빈 집합이다(§46) */
    check(
      'TC5 — 허용집합 모듈이 stage/job/status를 읽지 않는다',
      !/RelationshipStage|RelationshipJob|RelationshipStatus/.test(allowed),
      'allowedEvidence.ts가 stage를 읽고 있다 (R1과 같은 격리)',
    );

    /* ── TC6 · cache identity에 policy input이 빠지지 않는다 ─────────────── */
    /**
     * TASK_CONTRACT의 `cacheIdentity` 선언과 **지문 함수의 실제 입력 키**를 대조한다.
     * 선언만 있고 지문에 없으면 v1.42 §8.13이 닫은 결함이 그대로 재발한다 —
     * 캐시가 저장하는 것은 게이트가 적용된 최종 응답이고, 캐시 히트에는 응답이 없다.
     */
    const CACHE_EXPECTATIONS = [
      ['relationshipNarrativeFingerprint', ['tense', 'allowsOutwardQuestions']],
      ['compatibilityNarrativeFingerprint', ['tense', 'allowsOutwardQuestions']],
      ['deepReportFingerprint', ['tense']],
    ];
    for (const [fn, inputs] of CACHE_EXPECTATIONS) {
      const block = new RegExp(
        `export function ${fn}\\(input: \\{([\\s\\S]*?)\\}\\): string`,
      ).exec(fingerprint)?.[1];
      check(`TC6 — ${fn}이 input 객체를 받는다`, Boolean(block), `${fn} 시그니처를 찾지 못했다`);
      for (const input of inputs) {
        check(
          `TC6 — ${fn}의 지문에 ${input}이 들어간다`,
          Boolean(block && new RegExp(`\\b${input}[:;]`).test(block)),
          `${fn}에 ${input}이 없다`,
        );
      }
    }
    /** 호출부가 실제로 넘기는지 · memo deps에 있는지 — 둘 다 필요하다(A14와 같은 이유) */
    check(
      'TC6 — useCompatibilityNarrative가 지문에 tense·allowsOutwardQuestions를 넘긴다',
      /compatibilityNarrativeFingerprint\(\{[\s\S]*?tense,[\s\S]*?allowsOutwardQuestions,/.test(
        hook,
      ),
      'compatibility 지문 호출에 policy input이 없다',
    );
    check(
      'TC6 — 그 지문 memo deps에도 들어 있다',
      /\[tense, allowsOutwardQuestions, answers\.declared, answers\.target, result\]/.test(hook),
      'compatibility 지문 memo deps에 policy input이 없다',
    );
    check(
      'TC6 — useDeepReportNarrative가 지문에 tense를 넘긴다',
      /deepReportFingerprint\(\{\s*tense: deepTense,/.test(hook),
      'deep-report 지문에 tense가 없다',
    );
    check(
      'TC6 — 그 지문 memo deps에 deepTense가 있다',
      /\[deepTense, insights,/.test(hook),
      'deep-report 지문 memo deps에 deepTense가 없다',
    );
    /** AI가 받지 않는 값은 캐시 키도 아니다(v1.42 §40.5 · v1.43 §47.6) */
    const cmpBlock =
      /export function compatibilityNarrativeFingerprint\(input: \{[\s\S]*?\n\}/.exec(
        fingerprint,
      )?.[0] ?? '';
    check(
      'TC6 — compatibility 지문에서 target.relation이 빠졌다 (§47.6)',
      cmpBlock.length > 0 && !cmpBlock.includes('target.relation'),
      'AI가 받지 않는 target.relation이 지문에 남아 있다',
    );
    /** 게이트 boolean은 프롬프트에 들어가지 않는다 — AI에게 Job을 주지 않는다 */
    check(
      'TC6 — allowsOutwardQuestions가 AI context에 들어가지 않는다',
      !contextBuilders.includes('allowsOutwardQuestions'),
      'contextBuilders.ts에 게이트 boolean이 들어갔다',
    );
    /**
     * ⚠️ v1.43 §45.3 — **history 허용집합이 `report.compared`에서 나온다.**
     *
     * `entries.slice(-2)`로 다시 고르면 v1.35 P4-B가 실측한 Mixed History 버그가
     * 재현된다: `buildHistoryReport`는 커플 기록만 비교하므로 전체 목록의 마지막 두
     * 개와 다를 수 있고, 그러면 **AI에게 인용을 허용한 기록이 화면이 비교한 기록과
     * 달라진다.** `comparable`과 `compared`는 같은 분기에서 함께 정해지므로
     * (`buildHistoryReport`) 둘이 어긋날 수는 없다 — 읽는 쪽만 고정하면 된다.
     */
    check(
      'TC6 — history 허용집합이 report.compared에서 파생된다 (v1.35 버그 재발 방지)',
      /const \{ previousId, latestId \} = report\.compared;/.test(hook) &&
        !/entries\.slice\(-2\)/.test(hook),
      'useHistoryNarrative가 비교 기록을 따로 고르고 있다',
    );

    /**
     * observability: enforcement보다 로그가 먼저다(§19 rollout)
     *
     * ⚠️ v1.46 AI Lens — **4 → 8.** Task가 늘어난 만큼이 아니라 그보다 많다:
     *
     * ```
     * relationship · compatibility · history · deep-report   4   (v1.43 · Task당 1)
     * runPremiumLensTask                                     2   (parse 실패 · 정상)
     * runCrossLensTask                                       2   (parse 실패 · 정상)
     * ```
     *
     * 렌즈 핸들러가 2건인 이유: `parsed=null`로 빠지는 조기 return 경로에도 로그를
     * 남긴다. 그 경로에 로그가 없으면 "AI 블록이 안 보인다"를 봤을 때 **모델이 안
     * 만든 것인지 파서가 버린 것인지** 구분할 수 없다 — v1.42 §41.14가 정확히
     * 그 상태에서 원인을 못 찾았다.
     */
    const logCalls = countOf(handlers, /logAiFilter\(\{/g);
    check(
      `TC6 — 8개 Narrative 경로 전부 logAiFilter로 관측된다 (호출 ${logCalls})`,
      logCalls === 8,
      `logAiFilter 호출 ${logCalls}건 (기대 8)`,
    );
    check(
      'TC6 — 관측 로그가 production에서 아무것도 남기지 않는다',
      /if \(process\.env\.NODE_ENV === 'production'\) return;/.test(
        stripComments(readFileSync('src/services/ai/observability.ts', 'utf-8')),
      ),
      'observability.ts에 production 가드가 없다',
    );
    /** 로그에 사용자 데이터를 넣지 않는다(§44 Privacy) */
    const observability = readFileSync('src/services/ai/observability.ts', 'utf-8');
    for (const forbidden of ['traitId', 'entryId', 'explanation', 'headline']) {
      const inCode = stripComments(observability).includes(forbidden);
      check(
        `TC6 — 관측 로그가 ${forbidden}을 찍지 않는다`,
        !inCode,
        `observability.ts 코드가 ${forbidden}을 읽고 있다`,
      );
    }
  }


  /* ── 결과 ─────────────────────────────────────────────────────────────── */
  console.log('');
  if (failures.length > 0) {
    console.log(`실패 ${failures.length}건 · 통과 ${pass}건`);
    for (const failure of failures) console.log(`  - ${failure.label}`);
    process.exit(1);
  }
  console.log(`통과 ${pass}건`);
  console.log('ALL PASS');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
