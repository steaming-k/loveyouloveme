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
