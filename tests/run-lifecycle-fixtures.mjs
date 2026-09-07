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
  if (!response.ok) throw new Error(`HTTP ${response.status} — dev 서버가 떠 있는지 확인해줘`);
  const json = await response.json();
  if (!json.ok) throw new Error(`route error: ${JSON.stringify(json)}`);
  return json;
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
const EXPERIENCE = {
  important: ['contact', 'alone'],
  hardest: 'contact_drop',
  selfGap: 'more_expressive',
};
const TARGET = {
  relation: 'talking',
  // TARGET_FIELDS의 실제 옵션 값은 l/m/h다 ('x' = 모름).
  contact: 'l',
  conflict: 'h',
  alone: 'h',
  affection: 'm',
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
    check(
      'long_term의 action kind에 ask가 없다 (이미 아는 차이를 다루는 단계다)',
      !byStatus.married.context.actionKinds.includes('ask'),
      byStatus.married.context.actionKinds,
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
