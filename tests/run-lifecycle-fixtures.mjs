/**
 * Relationship Lifecycle Fixture — L0~L12 (v1.40 · §37.19)
 *
 * 두 가지를 고정한다.
 *  ① **불변** — `status`만 바꿔도 동기화율·comparedCount·Mirror 판정·Premium 게이트가
 *    같은 값이어야 한다. 관계 단계는 판정을 바꾸지 않는다.
 *  ② **문맥** — Job·허용 action kind·문구는 단계에 맞게 달라져야 한다. 전부 같으면
 *    contextualization이 실패한 것이다.
 *
 * ⚠️ 판정 로직을 여기서 복제하지 않는다. `/api/dev/lifecycle-test`가 **화면과 같은
 * 함수**를 호출하고, 이 스크립트는 fixture 조립과 검증만 한다.
 * ⚠️ 새 테스트 프레임워크를 쓰지 않는다 — `run-history-fixtures.mjs`와 같은 방식이다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:lifecycle`
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
    /**
     * v1.40.1 — 400 본문을 읽어서 이유를 그대로 보여준다. `INVALID_ENUM`이 여기로
     * 온다 — 잘못된 fixture 값이 조용히 통과하지 않게 하는 것이 목적이므로, 메시지가
     * 무엇이 틀렸는지 말해야 한다.
     */
    const detail = await response.text().catch(() => '');
    throw new Error(
      `HTTP ${response.status} — dev 서버가 떠 있는지 확인해줘${detail ? ` · ${detail}` : ''}`,
    );
  }
  const json = await response.json();
  if (!json.ok) throw new Error(`route error: ${JSON.stringify(json)}`);
  return json;
}

/** 라우트가 **거절해야 하는** 요청. 거절 이유까지 확인한다 */
async function runExpectingRejection(body) {
  const response = await fetch(`${BASE_URL}/api/dev/lifecycle-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

/* ── 공통 세션 ──────────────────────────────────────────────────────────────
   같은 declared/experience/target을 모든 단계에 그대로 쓴다. 그래야 "단계만
   바꿨다"는 조건이 성립한다. */

/**
 * ⚠️ `conflict`/`affection`/`hobby`는 숫자가 아니라 enum이다
 * (`ConflictStyle` `'now'|'soon'|'space'` · `AffectionStyle` `'a1'|'a2'|'a3'`).
 * 숫자를 넣으면 similarity가 NaN이 되고, JSON에서 `score: null`로 보인다 —
 * "점수가 null이 아니다" 검사가 이걸 잡는다.
 */
const DECLARED = { contact: 5, conflict: 'soon', alone: 4, affection: 'a2', hobby: 'h2' };
/**
 * ⚠️ v1.40.1 — `selfGap`이 v1.40에서 `'more_expressive'`였다. **그건 enum에 없는
 * 값이다** (`SelfGapAnswer = 'yes'|'some'|'no'`). `.mjs`는 `tsc`를 받지 않고, 라우트가
 * partial을 그냥 펴 넣었고, `selfGap`은 Mirror 판정에 안 쓰이므로 **아무 검사도
 * 실패하지 않았다** — L0~L12 전부가 `selfGap`을 유효값으로 한 번도 실행하지 않았다.
 *
 * 이제 유효값을 쓰고, 라우트가 `INVALID_ENUM`으로 시끄럽게 거절한다(§38.5).
 * 세 값 전부를 아래 `Fixture Enum Guard` 절에서 한 번씩 실제로 실행한다.
 */
const EXPERIENCE = {
  important: ['contact', 'alone'],
  hardest: 'contact_drop',
  selfGap: 'yes',
};
const TARGET = {
  relation: 'talking',
  // TARGET_FIELDS의 실제 옵션 값은 l/m/h다 ('x' = 모름).
  contact: 'l',
  conflict: 'h',
  alone: 'h',
  affection: 'm',
  /**
   * v1.40.1 — **관심사를 넣었다.** v1.40 fixture에는 없었고, 그래서
   * `approachInsightFor()`가 첫 줄(`interests[0]`이 없으면 null)에서 항상 빠져나갔다.
   * 즉 `ended`에서 `approachInsight`가 없다는 것을 확인해도, **애초에 아무 단계에서도
   * 생성되지 않는 값을 확인한 것**이라 게이트를 검증하지 못했다. 이제 dating/long_term에서
   * 실제로 생성되므로 `ended`의 0이 의미를 갖는다(L13의 `hasApproachInsight === false`).
   *
   * ⚠️ `TargetInterest`는 문자열이 아니라 `{ id, category, label }`이다. 문자열을 넣으면
   * `withObjectParticle(primary.label)`이 `undefined`를 받아 화면이 죽는다 —
   * 실제로 이 fixture를 만들다 브라우저에서 그렇게 죽였다.
   */
  preferences: {
    interests: [
      { id: 'i-movie', category: 'movie_show', label: '영화 · 공연' },
      { id: 'i-walk', category: 'walk', label: '산책 · 자연' },
    ],
  },
};

const SESSION = { declared: DECLARED, experience: EXPERIENCE, target: TARGET };

/** 상대 정보를 하나도 주지 않은 세션 — sufficiency가 no_target이 된다 */
const NO_TARGET_SESSION = { declared: DECLARED, experience: EXPERIENCE, target: {} };

/** 관계 이름만 있고 4축은 모르는 세션 — unknown_target */
const THIN_TARGET_SESSION = {
  declared: DECLARED,
  experience: EXPERIENCE,
  target: { relation: 'unsure' },
};

/* ── 금지 어휘 (Safety) ────────────────────────────────────────────────────── */

const ENDED_FORBIDDEN = [
  '다가가',
  '호감',
  '고백',
  '성공 확률',
  '성공확률',
  '상대의 마음',
  '다시 연락',
  '재회',
  '되돌',
  '치유',
  '극복',
];

const DATING_FORBIDDEN = ['새로운 사람', '호감을 높', '고백', '다음 관계'];

/**
 * v1.40.1 — **2차 guard 전용.** (§38.2)
 *
 * v1.40의 `ENDED_FORBIDDEN`은 `다가가`·`고백`·`재회` 같은 **주제어**만 막았다. 실제로
 * 새어 나간 유료 본문 문장들은 그런 단어를 하나도 쓰지 않았다:
 *
 * ```
 * 서로 원하는 기준을 한 번 이야기해보기
 * 각자 어떤 의미로 받아들이는지 확인해보기
 * ```
 *
 * 그래서 여기에는 **상대가 있어야 성립하는 어투**를 담는다. 하지만 이것도 완전하지
 * 않다 — `너한테는 … 어떻게 달라?`처럼 대명사만으로 상대를 가리키는 문장은 여전히
 * 못 잡는다. **그래서 1차 판정은 이 목록이 아니라 `audience` 카운트다.** 이 목록은
 * 구조 검사를 통과한 뒤 남은 문장을 한 번 더 훑는 보조 장치일 뿐이다.
 *
 * ⚠️ **일부러 넣지 않은 것이 있다 — 숨기지 않고 적어둔다.** `상대에게`(조사만) 를
 * 넣으면 `ended` 리포트의 러비 철학 질문(`미리 알 수 없는 걸 상대에게 미리 말해주는
 * 방법은 있을까?` · `DEEP_OBSERVATION.GAP`)이 걸린다. 그 문장은 **행동 제안이 아니라
 * 관찰자의 혼잣말**이고 사용자에게 무엇도 요구하지 않으므로 v1.40.1의 대상이 아니다.
 * 다만 `ended`에게 어울리는 시제인지는 별개 문제라 **잔여 리스크로 기록했다**(§38.2).
 * 목록을 그 문장에 맞춰 느슨하게 만든 것이 아니라, 그 문장을 이번 범위에서 제외한
 * 것이다 — 그 판단이 틀렸다면 고칠 곳은 이 목록이 아니라 `DEEP_OBSERVATION`이다.
 */
const ENDED_OUTWARD_PHRASES = ['서로 원하는', '각자 어떤', '같이 해보', '함께 해보', '상대에게 물어'];

/** Paywall `additions`에서 상대를 향한 약속을 가리키는 문구 (`OUTWARD_ADDITION_ITEMS`와 짝) */
const OUTWARD_ADDITION_MARKERS = ['다가가는 힌트', '상대에게 확인해볼 질문'];

const LONG_TERM_FORBIDDEN = ['가사', '재정', '생활비', '육아', '양육', '주거', '성생활'];

function findForbidden(strings, words) {
  const hits = [];
  for (const text of strings) {
    if (typeof text !== 'string') continue;
    for (const word of words) {
      if (text.includes(word)) hits.push({ word, text });
    }
  }
  return hits;
}

/* ──────────────────────────────────────────────────────────────────────────── */

async function main() {
  console.log(`Relationship Lifecycle Fixture — ${BASE_URL}\n`);

  /* ═══ L0 · v1.39 legacy 세션 ═══════════════════════════════════════════ */
  console.log('L0 — v1.39 legacy 세션이 그대로 읽힌다');
  {
    // v1.39까지 저장될 수 있었던 값 전부 + 아직 고르지 않은 상태 + 알 수 없는 값
    const legacyValues = [null, 'solo_none', 'solo_exp', 'crush', 'dating', 'married', 'ended'];
    for (const value of legacyValues) {
      const result = await run({ rawStatus: value, ...SESSION });
      check(
        `legacy status=${String(value)} → stage=${result.resolution.stage} (에러 없음)`,
        typeof result.resolution.stage === 'string' && typeof result.resolution.job === 'string',
        result.resolution,
      );
    }
    const unknown = await run({ rawStatus: 'legacy_unknown_value', ...SESSION });
    check(
      '알 수 없는 legacy 값을 다른 단계로 추측하지 않는다 (stage=none)',
      unknown.resolution.stage === 'none',
      unknown.resolution,
    );
    const unknownNoTarget = await run({ rawStatus: 'legacy_unknown_value', ...NO_TARGET_SESSION });
    check(
      '알 수 없는 legacy 값 + 상대 정보 없음 → job=none (없는 상대를 전제하지 않는다)',
      unknownNoTarget.resolution.job === 'none',
      unknownNoTarget.resolution,
    );
  }

  /* ═══ L1~L6 · 단계별 Job ═══════════════════════════════════════════════ */
  console.log('\nL1~L6 — 단계가 Job으로 이어진다');
  const byStatus = {};
  for (const status of ['solo_exp', 'crush', 'dating', 'married', 'ended']) {
    byStatus[status] = await run({ status, ...SESSION });
  }
  const noneResult = await run({ status: 'solo_exp', ...NO_TARGET_SESSION });
  const thinResult = await run({ status: 'crush', ...THIN_TARGET_SESSION });

  check('L1 none — 상대가 없으면 job=none', noneResult.resolution.job === 'none', noneResult.resolution);
  check(
    'L1-a 솔로라고 답했지만 상대 4축을 넣었으면 job=talking (샘플 세션 조합 · 자기 모순 방지)',
    byStatus.solo_exp.resolution.stage === 'none' &&
      byStatus.solo_exp.resolution.sufficiency === 'couple' &&
      byStatus.solo_exp.resolution.job === 'talking',
    byStatus.solo_exp.resolution,
  );
  check(
    'L1-b 연애 중이라고 답했지만 상대를 안 알려줬으면 job=unknown (none이 아니다)',
    (await run({ status: 'dating', ...NO_TARGET_SESSION })).resolution.job === 'unknown',
  );
  check(
    'L2 unknown — 사람은 있는데 아는 게 적으면 job=unknown (단계가 아니라 데이터 상태)',
    thinResult.resolution.job === 'unknown' &&
      thinResult.resolution.stage === 'talking' &&
      thinResult.resolution.sufficiency === 'unknown_target',
    thinResult.resolution,
  );
  check('L3 talking', byStatus.crush.resolution.job === 'talking', byStatus.crush.resolution);
  check('L4 dating', byStatus.dating.resolution.job === 'dating', byStatus.dating.resolution);
  check(
    'L5 married → long_term (별도 Job을 만들지 않는다)',
    byStatus.married.resolution.stage === 'long_term' &&
      byStatus.married.resolution.job === 'long_term',
    byStatus.married.resolution,
  );
  check('L6 ended', byStatus.ended.resolution.job === 'ended', byStatus.ended.resolution);
  check(
    'ended는 상대 정보가 적어도 ended다 (회고의 주어는 나다)',
    (await run({ status: 'ended', ...NO_TARGET_SESSION })).resolution.job === 'ended',
  );
  check(
    '다섯 상태 전부 STATUS_SUPPORTED=true (준비 중 라벨이 사라졌다)',
    ['solo_exp', 'crush', 'dating', 'married', 'ended'].every(
      (status) => byStatus[status].resolution.statusSupported === true,
    ),
  );

  /* ═══ 불변 Matrix ══════════════════════════════════════════════════════ */
  console.log('\nInvariance — 같은 입력에서 단계만 바꿨을 때');
  {
    const statuses = ['crush', 'dating', 'married', 'ended'];
    const first = byStatus[statuses[0]].invariant;
    for (const status of statuses.slice(1)) {
      const current = byStatus[status].invariant;
      check(
        `${status} — 동기화율 동일 (${current.score})`,
        current.score === first.score,
        { first: first.score, current: current.score },
      );
      check(`${status} — comparedCount 동일 (${current.comparedCount})`, current.comparedCount === first.comparedCount);
      check(`${status} — 신호 수 동일 (good ${current.goodCount} / friction ${current.frictionCount})`,
        current.goodCount === first.goodCount && current.frictionCount === first.frictionCount);
      check(
        `${status} — Mirror 판정 동일`,
        JSON.stringify(current.mirrorStates) === JSON.stringify(first.mirrorStates),
        { first: first.mirrorStates, current: current.mirrorStates },
      );
      check(`${status} — Mirror focus 축 동일`, current.mirrorFocusAxis === first.mirrorFocusAxis);
      check(
        `${status} — Premium 게이트 동일 (${current.premiumDeepConnection})`,
        current.premiumDeepConnection === first.premiumDeepConnection,
      );
      check(`${status} — cross-source 개수 동일 (${current.crossSourceCount})`,
        current.crossSourceCount === first.crossSourceCount);
    }
    check(
      '점수가 null이 아니다 (불변 검사가 빈 값끼리 비교한 게 아니다)',
      typeof first.score === 'number',
      first,
    );
    check(
      'Mirror 판정이 하나 이상 있다 (빈 배열끼리 비교한 게 아니다)',
      Array.isArray(first.mirrorStates) && first.mirrorStates.length > 0,
      first.mirrorStates,
    );
  }

  /* ═══ 문맥이 실제로 달라지는가 ═════════════════════════════════════════ */
  console.log('\nContext — 단계별로 다음 행동이 달라진다');
  {
    const verbs = new Set(
      ['crush', 'dating', 'married', 'ended'].map((status) => byStatus[status].context.copy.frictionVerb),
    );
    check(
      '확인이 필요한 신호의 사용법이 단계마다 같지 않다 (확인/조율/회고)',
      verbs.size >= 3,
      [...verbs],
    );
    const titles = new Set(
      ['crush', 'dating', 'married', 'ended'].map((status) => byStatus[status].context.copy.nowWhatTitle),
    );
    check('NOW WHAT 제목이 단계마다 다르다', titles.size === 4, [...titles]);
    check(
      'ended의 action kind에 ask/try/align이 없다 (상대를 향한 행동을 제안하지 않는다)',
      ['ask', 'try', 'align'].every((kind) => !byStatus.ended.context.actionKinds.includes(kind)),
      byStatus.ended.context.actionKinds,
    );
    check(
      'dating의 action kind에 align이 있다 (조율이 Job이다)',
      byStatus.dating.context.actionKinds.includes('align'),
      byStatus.dating.context.actionKinds,
    );
    /**
     * v1.40.1 §38.4 — **기대값이 뒤집혔다.** v1.40에서는 `ask`가 없다고 검사했는데,
     * 그러면 화면이 `한 번쯤 같이 이야기해볼 질문`이라는 라벨 아래에 주어가 나인
     * `REFLECTION_QUESTIONS.none`을 그린다(실측). `align`('이미 아는 차이를 맞춘다')이
     * 허용되는데 `ask`('물어본다')가 금지되는 것은 **더 깊은 관여만 허용하고 가벼운
     * 관여를 막은** 상태였다. 정책을 Job 정의에 맞춰 고쳤다(라벨을 바꾸지 않았다).
     */
    check(
      'long_term의 action kind에 ask가 있다 (align은 대화 없이 성립하지 않는다 · §38.4)',
      byStatus.married.context.actionKinds.includes('ask'),
      byStatus.married.context.actionKinds,
    );
    check(
      'long_term은 상대에게 물어볼 질문을 받는다 (라벨이 말하는 것과 내용이 같다)',
      byStatus.married.context.allowsOutwardQuestions === true &&
        byStatus.married.context.copy.questionLabel.includes('같이 이야기해볼'),
      byStatus.married.context.copy.questionLabel,
    );
    check(
      'ask가 없는 Job은 ended·none 둘뿐이다 (outward action 게이트와 같은 집합)',
      byStatus.ended.context.allowsOutwardQuestions === false &&
        noneResult.context.allowsOutwardQuestions === false &&
        [byStatus.crush, byStatus.dating, byStatus.married, thinResult].every(
          (result) => result.context.allowsOutwardQuestions === true,
        ),
      {
        ended: byStatus.ended.context.allowsOutwardQuestions,
        none: noneResult.context.allowsOutwardQuestions,
        long_term: byStatus.married.context.allowsOutwardQuestions,
      },
    );
    check(
      'unknown의 action kind는 ask/notice뿐이다',
      JSON.stringify(thinResult.context.actionKinds) === JSON.stringify(['ask', 'notice']),
      thinResult.context.actionKinds,
    );
  }

  /* ═══ L6 Safety · Ended ════════════════════════════════════════════════ */
  console.log('\nEnded Safety — 자동 권유 0');
  {
    for (const session of [SESSION, NO_TARGET_SESSION, THIN_TARGET_SESSION]) {
      const result = await run({ status: 'ended', ...session });
      const hits = findForbidden(result.context.renderedStrings, ENDED_FORBIDDEN);
      check(`ended 노출 문자열에 금지 어휘 0건 (${result.resolution.sufficiency})`, hits.length === 0, hits);
      // Release Gate 실측에서 잡힌 결함(§37.9) — 유료 목록도 같은 규칙을 받는다.
      const premiumHits = findForbidden(result.context.premiumAdditions, ENDED_FORBIDDEN);
      check(
        `ended Premium 목록에 상대를 향한 약속 0건 (${result.resolution.sufficiency})`,
        premiumHits.length === 0,
        premiumHits,
      );
      check(
        `ended는 상대를 향한 행동을 만들지 않는다 (${result.resolution.sufficiency})`,
        result.context.allowsOutwardAction === false && result.context.outwardHintCount === 0,
        result.context,
      );
      check(
        `ended는 상대에게 물어볼 질문을 추천하지 않는다 (${result.resolution.sufficiency})`,
        result.context.allowsOutwardQuestions === false,
      );
      check(
        `ended 질문의 주어가 나다 (${result.resolution.sufficiency})`,
        result.context.copy.questionLabel.includes('나에게'),
        result.context.copy.questionLabel,
      );
    }
    const ended = byStatus.ended;
    check(
      'ended의 점수 설명이 이별의 원인을 설명하지 않는다고 말한다',
      ended.context.copy.scoreUse.includes('설명하지 않'),
      ended.context.copy.scoreUse,
    );
  }

  /* ═══ Dating Safety ════════════════════════════════════════════════════ */
  console.log('\nDating Safety');
  {
    for (const status of ['dating', 'married']) {
      const hits = findForbidden(byStatus[status].context.renderedStrings, DATING_FORBIDDEN);
      check(`${status} 노출 문자열에 '새로운 사람'·'고백'·'다음 관계' 0건`, hits.length === 0, hits);
      check(
        `${status} Premium 목록은 상대를 향한 약속을 유지한다 (관계가 진행 중이므로 지울 이유가 없다)`,
        byStatus[status].context.premiumAdditions.some((item) => item.includes('다가가는 힌트')),
        byStatus[status].context.premiumAdditions,
      );
      check(
        `${status}는 상대를 향한 행동을 만들 수 있다 (관계가 진행 중이다)`,
        byStatus[status].context.allowsOutwardAction === true,
      );
    }
  }

  /* ═══ Long-term Safety ═════════════════════════════════════════════════ */
  console.log('\nLong-term Safety — 없는 데이터를 만들지 않는다');
  {
    const hits = findForbidden(byStatus.married.context.renderedStrings, LONG_TERM_FORBIDDEN);
    check('가사·재정·육아·주거·성생활 추론 0건', hits.length === 0, hits);
    /**
     * v1.40.1 — `ask` 허용으로 long_term이 실제 대화 질문을 받게 됐으므로, 그 질문
     * 문장들이 이 단계의 진짜 금지선(없는 생활 데이터)을 넘지 않는지 확인한다.
     */
    const questionHits = findForbidden(
      byStatus.married.context.renderedStrings,
      LONG_TERM_FORBIDDEN,
    );
    check(
      'ask 허용 후에도 없는 생활 데이터를 만들지 않는다 (질문 문장 포함)',
      questionHits.length === 0 && byStatus.married.context.questionCount > 0,
      { hits: questionHits, questionCount: byStatus.married.context.questionCount },
    );
  }

  /* ═══ L13~L16 · Premium Deep Report 구조적 안전 (v1.40.1 · §38.2) ══════

     v1.40 fixture는 무료 화면 문구 + Paywall `additions`만 훑었다. 유료 **본문**은
     한 번도 보지 않았고, 그래서 Release Gate가 아래 결함들을 통과시켰다:

       buildActions()            ended에도 TRY/CHECK 생성
       buildConnectionQuestions() ended에도 상대에게 던지는 질문 생성
       섹션 제목               ended에도 '그래서 무엇을 확인할까'
       premium-preview 화면     게이트를 아예 넘기지 않음 (기본값 허용)

     ⚠️ **1차 판정은 구조다.** `audience`를 세고, 문장은 2차 guard로만 훑는다 —
     새어 나간 문장들에는 금지 어휘가 하나도 없었기 때문이다. */

  /**
   * 반복 신호(=`historyDeep.prompts`)를 만들려면 커플 기록 2개에 같은 축의 GAP/CHANGE가
   * 있어야 한다(`findRepeatedRelationshipSignals`). `다음 관계에서 …` 프롬프트가 어느
   * 단계에서 나오는지 보려면 그 자리를 실제로 켜야 한다.
   */
  const mirrorInsight = (axis, state) => ({
    axis,
    state,
    declaredText: `${axis} 스냅샷`,
    relationshipSignal: `${axis} 관계 신호`,
  });
  const historyEntry = (id, createdAt) => ({
    id,
    analysisId: `fixture|${id}`,
    createdAt,
    audience: 'couple',
    context: { relationshipStatus: 'dating', targetRelation: 'talking' },
    profileSnapshot: { mbti: null },
    declaredSnapshot: { contact: 2, conflict: 'soon', alone: 4, affection: 'a2', hobby: 'h2' },
    relationshipEvidence: { important: ['contact'], hardest: 'contact_drop', selfGap: 'some', adaptive: null },
    mirrorSnapshot: { insights: [mirrorInsight('contact', 'GAP')], focusAxis: 'contact' },
    coreInsight: { original: '연락 축 관찰', userCorrection: null, verdict: null },
    evidenceCoverage: 'medium',
  });
  const REPEATED_ENTRIES = [
    historyEntry('h-1', '2026-07-01T00:00:00.000Z'),
    historyEntry('h-2', '2026-08-01T00:00:00.000Z'),
  ];

  console.log('\nL13~L16 — Premium Deep Report 본문 (유료도 같은 안전 규칙)');
  const deepByStatus = {};
  for (const status of ['solo_exp', 'crush', 'dating', 'married', 'ended']) {
    deepByStatus[status] = await run({ status, ...SESSION, entries: REPEATED_ENTRIES });
  }
  const deepNone = await run({ status: 'solo_none', ...NO_TARGET_SESSION, entries: REPEATED_ENTRIES });

  {
    /* ── 전제: 리포트가 실제로 만들어졌는가 ────────────────────────────────
       이걸 먼저 확인하지 않으면 아래 '0건'들이 **빈 리포트를 세고 있는 것**과
       구분되지 않는다. v1.40이 놓친 종류의 착오를 여기서 막는다. */
    check(
      '전제 — Deep Report가 실제로 열린다 (빈 리포트를 검사하는 게 아니다)',
      deepByStatus.dating.deepReport.available === true,
      deepByStatus.dating.deepReport,
    );
    check(
      '전제 — dating 리포트에 상대를 향한 행동이 실제로 있다',
      deepByStatus.dating.deepReport.outwardActionCount > 0,
      deepByStatus.dating.deepReport.actions,
    );
    check(
      '전제 — dating 리포트에 상대에게 던지는 질문이 실제로 있다',
      deepByStatus.dating.deepReport.outwardQuestionCount > 0,
      deepByStatus.dating.deepReport.questions,
    );
    check(
      '전제 — 반복 신호가 켜져서 History Deep 프롬프트 자리가 살아 있다',
      deepByStatus.dating.deepReport.historyDeepAvailable === true,
      deepByStatus.dating.deepReport.historyDeepAvailable,
    );
    check(
      '전제 — dating 리포트에 Approach Insight가 실제로 생성된다 (ended의 0이 의미를 갖는다)',
      deepByStatus.dating.deepReport.hasApproachInsight === true,
      deepByStatus.dating.deepReport.hasApproachInsight,
    );
  }

  /* ── L13 Ended — 구조적으로 0이어야 한다 ──────────────────────────────── */
  {
    for (const session of [SESSION, NO_TARGET_SESSION, THIN_TARGET_SESSION]) {
      const result = await run({ status: 'ended', ...session, entries: REPEATED_ENTRIES });
      const deep = result.deepReport;
      const where = result.resolution.sufficiency;

      check(
        `L13 ended 유료 본문 — 상대를 향한 행동 0건 (${where})`,
        deep.outwardActionCount === 0,
        deep.actions,
      );
      check(
        `L13 ended 유료 본문 — 상대에게 던지는 질문 0건 (${where})`,
        deep.outwardQuestionCount === 0 && deep.questions.length === 0,
        deep.questions,
      );
      check(
        `L13 ended 유료 본문 — action kind가 REFLECT/NOTICE뿐이다 (${where})`,
        deep.actions.length > 0 &&
          deep.actions.every((action) => ['REFLECT', 'NOTICE'].includes(action.kind)),
        deep.actions,
      );
      check(
        `L13 ended 유료 본문 — 행동 섹션이 비어 있지 않다 (${where})`,
        deep.actions.length > 0,
        deep.actions,
      );
      check(
        `L13 ended 유료 본문 — Approach Insight 없음 (${where})`,
        deep.hasApproachInsight === false,
      );
      check(
        `L13 ended 유료 본문 — 섹션 제목이 회고다 (${where})`,
        deep.actionSectionTitle === '그래서 뭐가 남았을까',
        deep.actionSectionTitle,
      );
      /* 2차 guard — 문장 스캔. 1차(구조)가 통과한 뒤에만 의미가 있다 */
      const hits = findForbidden(deep.renderedStrings, ENDED_FORBIDDEN);
      check(`L13 ended 유료 본문 — 금지 어휘 0건 (2차 guard · ${where})`, hits.length === 0, hits);
      const outwardHits = findForbidden(deep.renderedStrings, ENDED_OUTWARD_PHRASES);
      check(
        `L13 ended 유료 본문 — 상대를 향한 어투 0건 (2차 guard · ${where})`,
        outwardHits.length === 0,
        outwardHits,
      );
    }
  }

  /* ── L14 none — 상대가 없는 사용자도 같은 규칙 ────────────────────────── */
  {
    const deep = deepNone.deepReport;
    check('L14 none — job=none이다 (전제)', deepNone.resolution.job === 'none', deepNone.resolution);
    check(
      'L14 none 유료 본문 — 상대를 향한 행동·질문 0건 (없는 상대에게 제안하지 않는다)',
      deep.outwardActionCount === 0 && deep.outwardQuestionCount === 0,
      { actions: deep.actions, questions: deep.questions },
    );
    check(
      'L14 none 유료 본문 — 섹션 제목이 none Job의 것이다',
      deep.actionSectionTitle === '그래서 뭘 알아둘까',
      deep.actionSectionTitle,
    );
  }

  /* ── L15 Paywall ↔ 본문 대칭 ──────────────────────────────────────────── */
  {
    for (const status of ['ended', 'dating', 'married', 'crush']) {
      const result = deepByStatus[status];
      const promisesOutward = result.context.premiumAdditions.some((item) =>
        OUTWARD_ADDITION_MARKERS.some((marker) => item.includes(marker)),
      );
      const deliversOutward =
        result.deepReport.outwardActionCount > 0 ||
        result.deepReport.outwardQuestionCount > 0 ||
        result.deepReport.hasApproachInsight;
      check(
        `L15 ${status} — Paywall이 약속한 것과 리포트가 주는 것이 같다 (약속 ${promisesOutward} / 제공 ${deliversOutward})`,
        promisesOutward === deliversOutward,
        { additions: result.context.premiumAdditions, deep: result.deepReport },
      );
    }
  }

  /* ── L16 과필터 방지 (양방향) ─────────────────────────────────────────── */
  {
    for (const status of ['crush', 'dating', 'married']) {
      const deep = deepByStatus[status].deepReport;
      check(
        `L16 ${status} 유료 본문 — 상대를 향한 행동이 유지된다 (ended를 고치다 전부 없애지 않았다)`,
        deep.outwardActionCount > 0,
        deep.actions,
      );
      check(
        `L16 ${status} 유료 본문 — 상대에게 던지는 질문이 유지된다`,
        deep.outwardQuestionCount > 0,
        deep.questions,
      );
      check(
        `L16 ${status} 유료 본문 — 섹션 제목이 그 Job의 것이다`,
        deep.actionSectionTitle === deepByStatus[status].context.copy.nowWhatTitle,
        { title: deep.actionSectionTitle, expected: deepByStatus[status].context.copy.nowWhatTitle },
      );
      /**
       * v1.40.1 — `historyDeep.prompts`가 v1.40에서 항상 `다음 관계에서 …`였다.
       * 진행 중인 관계에 그 말을 쓰는 것은 `DATING_FORBIDDEN`이 금지한 표현이고,
       * Ended Safety와 **같은 종류의 결함(방향만 반대)**이다.
       */
      const hits = findForbidden(deep.renderedStrings, DATING_FORBIDDEN);
      check(
        `L16 ${status} 유료 본문 — '다음 관계'·'고백'·'새로운 사람' 0건 (2차 guard)`,
        hits.length === 0,
        hits,
      );
    }
    check(
      'L16 ended는 반대로 다음 기준을 말할 수 있다 (과필터 아님)',
      deepByStatus.ended.deepReport.renderedStrings.some((text) =>
        typeof text === 'string' && text.includes('다음 관계'),
      ),
      deepByStatus.ended.deepReport.renderedStrings.filter(
        (text) => typeof text === 'string' && text.includes('관계'),
      ),
    );
    check(
      'L16 long_term 유료 본문에 없는 생활 데이터 0건',
      findForbidden(deepByStatus.married.deepReport.renderedStrings, LONG_TERM_FORBIDDEN).length === 0,
    );
  }

  /* ═══ Fixture Enum Guard (v1.40.1 · §38.5) ════════════════════════════ */
  console.log('\nFixture Enum Guard — 잘못된 enum이 조용히 통과하지 않는다');
  {
    const invalid = await runExpectingRejection({
      status: 'dating',
      ...SESSION,
      // v1.40 fixture에 실제로 들어 있던 값. 이제 거절돼야 한다.
      experience: { ...EXPERIENCE, selfGap: 'more_expressive' },
    });
    check(
      "enum에 없는 selfGap('more_expressive')을 400 INVALID_ENUM으로 거절한다",
      invalid.status === 400 && invalid.json?.reason === 'INVALID_ENUM',
      invalid,
    );
    const invalidHardest = await runExpectingRejection({
      status: 'dating',
      ...SESSION,
      experience: { ...EXPERIENCE, hardest: 'ghosting' },
    });
    check(
      'enum에 없는 hardest도 거절한다',
      invalidHardest.status === 400 && invalidHardest.json?.reason === 'INVALID_ENUM',
      invalidHardest,
    );
    const invalidFactor = await runExpectingRejection({
      status: 'dating',
      ...SESSION,
      experience: { ...EXPERIENCE, important: ['contact', 'not_a_factor'] },
    });
    check(
      'enum에 없는 important 항목도 거절한다',
      invalidFactor.status === 400 && invalidFactor.json?.reason === 'INVALID_ENUM',
      invalidFactor,
    );
    /**
     * v1.40.1 — `selfGap` 세 값을 **전부 실제로 실행한다.** v1.40에서는 한 번도
     * 유효값으로 실행되지 않았다. 판정에 쓰이지 않는 값이라도, 실행되지 않는 값은
     * '통과한다'고 말할 수 없다.
     */
    for (const selfGap of ['yes', 'some', 'no']) {
      const result = await run({
        status: 'dating',
        ...SESSION,
        experience: { ...EXPERIENCE, selfGap },
      });
      check(
        `selfGap='${selfGap}'로 실제 실행된다 (Mirror 판정은 그대로)`,
        result.ok === true &&
          JSON.stringify(result.invariant.mirrorStates) ===
            JSON.stringify(byStatus.dating.invariant.mirrorStates),
        { selfGap, mirrorStates: result.invariant.mirrorStates },
      );
    }
    // L0의 legacy 경로는 막지 않는다 — 알 수 없는 값을 일부러 넣는 테스트가 살아 있어야 한다.
    check(
      'rawStatus로 보낸 알 수 없는 값은 여전히 통과한다 (L0 legacy 테스트 보존)',
      (await run({ rawStatus: 'legacy_unknown_value', ...SESSION })).resolution.stage === 'none',
    );
  }

  /* ═══ L7 talking → dating (같은 사람) ═══════════════════════════════════ */
  console.log('\nL7 — talking → dating (새 상대가 아니다)');
  {
    const before = byStatus.crush;
    const after = byStatus.dating;
    check('target 데이터가 그대로다 (comparedCount 동일)', before.invariant.comparedCount === after.invariant.comparedCount);
    check('동기화율이 그대로다', before.invariant.score === after.invariant.score);
    check('Mirror 판정이 그대로다',
      JSON.stringify(before.invariant.mirrorStates) === JSON.stringify(after.invariant.mirrorStates));
    check('Job만 달라진다', before.resolution.job !== after.resolution.job, {
      before: before.resolution.job,
      after: after.resolution.job,
    });
    check('다음 행동의 성격이 달라진다 (확인 → 조율)',
      before.context.copy.frictionVerb !== after.context.copy.frictionVerb, {
        before: before.context.copy.frictionVerb,
        after: after.context.copy.frictionVerb,
      });
  }

  /* ═══ L8 dating → ended ════════════════════════════════════════════════ */
  console.log('\nL8 — dating → ended');
  {
    const before = byStatus.dating;
    const after = byStatus.ended;
    check('target 원본 데이터가 자동 삭제되지 않는다 (comparedCount 유지)',
      after.invariant.comparedCount === before.invariant.comparedCount, {
        before: before.invariant.comparedCount,
        after: after.invariant.comparedCount,
      });
    check('동기화율 판정 자체는 유지된다 (사실은 사라지지 않는다)',
      after.invariant.score === before.invariant.score);
    check('상대를 향한 행동만 꺼진다',
      before.context.allowsOutwardAction === true && after.context.allowsOutwardAction === false);
  }

  /* ═══ L9 ended → new target ════════════════════════════════════════════ */
  console.log('\nL9 — ended 상태에서 새 상대를 넣으면');
  {
    // 새 상대 = target 초기화 후 새 값. status는 사용자가 다시 고른다.
    const endedNewTarget = await run({ status: 'ended', ...SESSION });
    const talkingNewTarget = await run({ status: 'crush', ...SESSION });
    check(
      '단계를 다시 고르지 않으면 ended Job이 유지된다 (자동으로 talking으로 바꾸지 않는다)',
      endedNewTarget.resolution.job === 'ended',
      endedNewTarget.resolution,
    );
    check(
      '사용자가 단계를 다시 고르면 그때 Job이 바뀐다',
      talkingNewTarget.resolution.job === 'talking',
    );
  }

  /* ═══ L10 stage change + History ═══════════════════════════════════════ */
  console.log('\nL10~L12 — stage 변경이 History·질문·Premium을 깨지 않는다');
  {
    const entry = {
      id: 'h-legacy-1',
      analysisId: 'legacy|1',
      createdAt: '2026-08-01T00:00:00.000Z',
      audience: 'couple',
      context: { relationshipStatus: 'crush', targetRelation: 'talking' },
      profileSnapshot: { mbti: null },
      declaredSnapshot: { contact: 2, conflict: 2, alone: 4, affection: 3 },
      relationshipEvidence: { important: ['alone'], hardest: null, selfGap: null, adaptive: null },
      mirrorSnapshot: { insights: [], focusAxis: null },
      coreInsight: { original: '', corrected: null },
    };
    const withHistory = await run({ status: 'dating', ...SESSION, entries: [entry] });
    check(
      'L10 — 과거 snapshot의 relationshipStatus를 현재 단계로 덮어쓰지 않는다',
      withHistory.ok === true,
      withHistory.resolution,
    );
    check(
      'L11 — 단계가 바뀌어도 질문 생성 자체는 유지된다 (저장한 질문을 지우지 않는다)',
      withHistory.context.questionCount > 0,
      withHistory.context.questionCount,
    );
    check(
      'L12 — Premium 게이트가 단계만으로 열리지 않는다',
      byStatus.ended.invariant.premiumDeepConnection ===
        byStatus.crush.invariant.premiumDeepConnection,
      {
        ended: byStatus.ended.invariant.premiumDeepConnection,
        crush: byStatus.crush.invariant.premiumDeepConnection,
      },
    );
  }

  /* ═══ IA-04 · IA-05 — '이전 관계' 상대는 ENDED lifecycle을 그대로 받는다 ════

     UT-1 P1-A §4가 `이 사람과 나는`에 `이전 관계`를 더했다. 위험은 옵션이 아니라
     **연결**에 있다: 라벨만 늘리고 lifecycle을 연결하지 않으면, 헤어진 상대를 고른
     사용자가 `dating` Job을 받아 `먼저 연락해봐`·`같이 해보자`를 본다.

     그래서 여기서 검사하는 것은 문구가 아니라 **동치**다 —
     `status: dating` + `relation: 'ex'`가 `status: 'ended'`와 **같은 Job·같은 금지**를
     받는가. 새 규칙을 만들지 않았다는 사실을 값으로 고정한다. */
  console.log('\nIA-04 · IA-05 — 이전 관계(ex) = ENDED lifecycle');
  {
    const EX_TARGET = { ...TARGET, relation: 'ex' };
    /** ⚠️ status는 일부러 `dating`이다 — 상대 쪽 답이 더 구체적인 사실이다 */
    const ex = await run({ status: 'dating', declared: DECLARED, experience: EXPERIENCE, target: EX_TARGET });
    const ended = await run({ status: 'ended', ...SESSION });

    check('IA-04 이전 관계를 고르면 JOB이 ended다 (status가 dating이어도)', ex.resolution.job === 'ended', ex.resolution);
    /* STAGE 자체가 내려갔는지 — JOB만 보면 sufficiency로 우연히 맞을 수도 있다 */
    check('IA-04 STAGE가 ended로 내려간다 (JOB이 아니라 STAGE에서 갈린다)', ex.resolution.stage === 'ended', ex.resolution);
    check(
      'IA-04 같은 상대 정보를 줘도 sufficiency는 그대로다 (판정은 건드리지 않는다)',
      ex.resolution.sufficiency === 'couple',
      ex.resolution,
    );
    check(
      'IA-04 ended와 같은 Job 문맥을 받는다 (새 분기를 만들지 않았다)',
      ex.context.actionSectionTitle === ended.context.actionSectionTitle &&
        JSON.stringify(ex.context.actionKinds) === JSON.stringify(ended.context.actionKinds),
      { ex: ex.context.actionSectionTitle, ended: ended.context.actionSectionTitle },
    );

    /* IA-05 — 재회 유도 · 상대를 향한 행동 · 상대에게 던지는 질문 전부 0 */
    const hits = findForbidden(ex.context.renderedStrings, ENDED_FORBIDDEN);
    check('IA-05 이전 관계 노출 문자열에 금지 어휘 0건', hits.length === 0, hits);
    const premiumHits = findForbidden(ex.context.premiumAdditions, ENDED_FORBIDDEN);
    check('IA-05 이전 관계 Premium 목록에 상대를 향한 약속 0건', premiumHits.length === 0, premiumHits);
    check(
      'IA-05 이전 관계에는 상대를 향한 행동을 만들지 않는다',
      ex.context.allowsOutwardAction === false && ex.context.outwardHintCount === 0,
      ex.context,
    );
    check(
      'IA-05 이전 관계에는 상대에게 물어볼 질문을 추천하지 않는다',
      ex.context.allowsOutwardQuestions === false,
    );
    const deepHits = findForbidden(ex.deepReport.renderedStrings, ENDED_FORBIDDEN);
    check('IA-05 유료 리포트 본문에도 금지 어휘 0건', deepHits.length === 0, deepHits);
    check(
      'IA-05 유료 리포트의 outward action·question 0',
      ex.deepReport.outwardActionCount === 0 && ex.deepReport.outwardQuestionCount === 0,
      { a: ex.deepReport.outwardActionCount, q: ex.deepReport.outwardQuestionCount },
    );

    /* ⚠️ 안전 규칙은 **내리기만** 한다 — 다른 답변으로 해제되지 않는다 */
    const endedButCrush = await run({
      status: 'ended',
      declared: DECLARED,
      experience: EXPERIENCE,
      target: { ...TARGET, relation: 'crush' },
    });
    check(
      'IA-05 status=ended는 상대를 crush로 골라도 ended로 남는다 (해제 불가)',
      endedButCrush.resolution.job === 'ended' && endedButCrush.context.allowsOutwardAction === false,
      endedButCrush.resolution,
    );
  }

  /* ═══ QUESTION-01~ · 질문이 맥락을 따라간다 (UT-1 P1-B §3 · §4) ═════════

     UT-1에서 **가장 가치 있다고 평가된 것**이 '상대에게 확인할 질문'이었다. 그런데
     그 질문은 축마다 문자열 하나씩(총 4개)이라, 누가 어떤 관계 단계에 있든 무엇을
     답했든 똑같은 네 문장이 나왔다.

     ⚠️ 여기서 검사하는 것은 **문장의 좋음**이 아니라 셀 수 있는 세 가지다:
     ① 맥락이 다르면 문장이 달라지는가 ② 같은 맥락이면 항상 같은 문장인가(결정론)
     ③ 안전 경계를 넘지 않는가. */
  console.log('\nQUESTION — 축 × 관계 단계 × 상대 정보 × 사건');
  {
    const textOf = (result, axis) =>
      result.context.questions.find((question) => question.id === axis)?.text ?? null;

    /** 상대를 아는 세션(couple) · 알아가는 중 */
    const talking = await run({ status: 'crush', ...SESSION });
    /** 같은 축인데 상대를 하나도 모르는 세션 — target availability */
    const unknownTarget = await run({ status: 'crush', ...THIN_TARGET_SESSION });
    /** 같은 축인데 오래된 관계 — lifecycle */
    const longTerm = await run({ status: 'married', ...SESSION });
    /** 같은 축인데 사용자가 갈등 장면을 적어준 세션 — user-reported event */
    const withEvent = await run({
      status: 'crush',
      declared: DECLARED,
      experience: EXPERIENCE,
      target: {
        ...TARGET,
        events: [{ id: 'ev-1', type: 'conflict', description: '약속 시간 얘기로 다퉜어' }],
      },
    });

    check(
      'QUESTION-01 · 상대를 모르면 다른 질문이 나온다 (target availability)',
      textOf(talking, 'conflict') !== null &&
        textOf(unknownTarget, 'conflict') !== null &&
        textOf(talking, 'conflict') !== textOf(unknownTarget, 'conflict'),
      { couple: textOf(talking, 'conflict'), unknown: textOf(unknownTarget, 'conflict') },
    );
    check(
      'QUESTION-02 · 관계 단계가 다르면 다른 질문이 나온다 (lifecycle)',
      textOf(talking, 'conflict') !== textOf(longTerm, 'conflict'),
      { talking: textOf(talking, 'conflict'), long_term: textOf(longTerm, 'conflict') },
    );
    check(
      'QUESTION-03 · 사용자가 적어준 사건이 있으면 다른 질문이 나온다 (user-reported event)',
      textOf(withEvent, 'conflict') !== textOf(talking, 'conflict'),
      { event: textOf(withEvent, 'conflict'), none: textOf(talking, 'conflict') },
    );
    check(
      'QUESTION-04 · 같은 입력에는 항상 같은 질문이 나온다 (결정론 · 랜덤 없음)',
      textOf(await run({ status: 'crush', ...SESSION }), 'conflict') ===
        textOf(talking, 'conflict'),
    );

    /* §4 — 교체 대상 두 문장이 **어느 조합에서도** 다시 나오지 않는다 */
    const RETIRED = [
      '싸웠을 때 어느 정도 시간이 필요해?',
      '혼자 있고 싶을 때 상대에게 어떻게 알려주는 게 편해?',
    ];
    const allTexts = [talking, unknownTarget, longTerm, withEvent].flatMap((result) =>
      result.context.questions.map((question) => question.text),
    );
    check(
      'QUESTION-05 · UT-1이 지목한 옛 문장이 남아 있지 않다',
      RETIRED.every((text) => !allTexts.includes(text)),
      allTexts.filter((text) => RETIRED.includes(text)),
    );

    /* Safety — 상대의 의도·마음을 묻는 질문은 만들지 않는다 */
    const INTENT_WORDS = ['무슨 생각', '왜 그랬', '마음이 어떤', '어떻게 생각하는지 알'];
    check(
      'QUESTION-06 · 상대의 의도를 추정하는 질문이 0건이다 (Safety)',
      allTexts.every((text) => !INTENT_WORDS.some((word) => text.includes(word))),
      allTexts.filter((text) => INTENT_WORDS.some((word) => text.includes(word))),
    );

    /* QUESTION-ENDED — 생성기 자체가 빈 배열을 돌려준다(화면 게이트와 이중 방어) */
    for (const [label, session] of [
      ['couple', SESSION],
      ['no_target', NO_TARGET_SESSION],
      ['unknown_target', THIN_TARGET_SESSION],
    ]) {
      const ended = await run({ status: 'ended', ...session });
      check(
        `QUESTION-ENDED · ended에서 상대에게 던지는 질문이 0개다 (${label})`,
        ended.context.questions.length === 0,
        ended.context.questions,
      );
    }
    const none = await run({ status: 'solo_none', ...NO_TARGET_SESSION });
    check(
      'QUESTION-ENDED · none에서도 0개다 (없는 상대에게 물어볼 것을 만들지 않는다)',
      none.context.questions.length === 0,
      none.context.questions,
    );

    /* AI가 실패해도 결정론 질문은 그대로다 — 이 라우트는 Provider를 부르지 않는다 */
    check(
      'QUESTION-07 · AI 없이도 질문이 만들어진다 (결정론 경로만으로 완결)',
      talking.context.questions.length > 0 &&
        talking.context.questions.every((question) => question.text.trim().length > 0),
      talking.context.questions,
    );
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
