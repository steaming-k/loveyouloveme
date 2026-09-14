/**
 * Personalized Question Fixture — QUESTION-FIT-01 ~ 09 (v1.46.4 · §42)
 *
 * ══ 왜 이 스크립트가 따로 생겼나 ═══════════════════════════════════════════
 *
 * UT-1에서 **가장 가치 있다고 평가된 것이 '상대에게 확인할 질문'**이었다. 그런데 그
 * 질문의 개인화는 지금까지 두 번 바뀌었고 두 번 다 검사가 없었다:
 *
 * ```
 * v1.0 ~ P1-B   축당 문자열 1개        모든 사용자에게 같은 4문장
 * P1-B          축당 variant 5~6개     조건이 같으면 여전히 같은 문장
 * v1.46.4       조각 조립              내 기준 절 + 상황 절 + 묻는 절
 * ```
 *
 * 그래서 이 스크립트가 보는 것은 문장의 품질이 아니라 **두 가지 구조적 사실**이다:
 *
 * > **같은 판정인데 입력이 다르면 질문이 다른가.**
 * > **하면 안 되는 질문이 0개인가.**
 *
 * ⚠️ 문체 평가는 사람이 한다. 여기서 하는 것은 **금지 어휘가 0인가**뿐이다 — 좋은
 * 질문인지를 스크립트가 판정하기 시작하면 그 기준이 곧 생성 규칙이 되고, 검사가
 * 생성기를 따라가는 순환이 된다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:question`
 */

import './_aiTestGuard.mjs';
import {
  FIXTURE_A,
  FIXTURE_B,
  FIXTURE_C,
  FIXTURE_D,
  PARTNER_INTENT,
  QUESTION_INTENT_BANNED,
  QUESTION_STYLE_BANNED,
  createChecker,
  findForbidden,
  run,
} from './fixtures-v1464.mjs';

const { check, report } = createChecker();

console.log('\nPersonalized Question Fixture — v1.46.4 §42\n');

const a = await run(FIXTURE_A);
const b = await run(FIXTURE_B);
const c = await run(FIXTURE_C);
const d = await run(FIXTURE_D);

/** 이 결과의 모든 질문 문장 (무료 + 유료) */
function allQuestions(result) {
  return [
    ...result.report.candidates.flatMap((candidate) =>
      candidate.questions.map((question) => question.text),
    ),
    ...result.free.candidates.flatMap((candidate) =>
      candidate.questions.map((question) => question.text),
    ),
    ...result.free.questions,
    ...result.report.connectionQuestions.map((item) => item.text),
  ];
}

function premiumQuestions(result) {
  return result.report.candidates.flatMap((candidate) => candidate.questions);
}

/* ── QUESTION-FIT-01 · 같은 축 + 다른 사건 → 다른 질문 ─────────────────── */
console.log('QUESTION-FIT-01 · 같은 축인데 사건이 다르면 질문이 다르다');
{
  /*
    B와 C는 **Mirror 판정이 완전히 같고 사건 조합만 다르다**(§44 C). 그래서 두 결과의
    질문이 한 글자도 다르지 않다면, 사건은 질문 조립에 닿지 않고 있는 것이다.
  */
  check(
    'B와 C의 Mirror 판정이 같다 (비교의 전제)',
    JSON.stringify(b.mirrorStates) === JSON.stringify(c.mirrorStates),
    { b: b.mirrorStates, c: c.mirrorStates },
  );

  const bSituational = premiumQuestions(b).filter((q) => q.register === 'situational');
  const cSituational = premiumQuestions(c).filter((q) => q.register === 'situational');
  check('B에 상황 기반 질문이 있다', bSituational.length > 0, bSituational);
  check('C에도 상황 기반 질문이 있다', cSituational.length > 0, cSituational);
  check(
    'B와 C의 상황 기반 질문이 서로 다르다',
    bSituational.map((q) => q.text).join('|') !== cSituational.map((q) => q.text).join('|'),
    { b: bSituational.map((q) => q.text), c: cSituational.map((q) => q.text) },
  );

  /*
    A(사건 0)와 B(사건 5)는 사건 말고 전부 같다. A에는 상황 절을 만들 재료가 없으므로
    상황 기반 질문이 **없어야** 하고, 그게 QUESTION-FIT-03과 짝이 된다.
  */
  check(
    'A(사건 0)의 질문 집합이 B(사건 5)와 다르다',
    premiumQuestions(a).map((q) => q.text).join('|') !==
      premiumQuestions(b).map((q) => q.text).join('|'),
    { a: premiumQuestions(a).map((q) => q.text), b: premiumQuestions(b).map((q) => q.text) },
  );
}

/* ── QUESTION-FIT-02 · 같은 판정 + 다른 lifecycle → 다른 질문 ──────────── */
console.log('\nQUESTION-FIT-02 · lifecycle이 다르면 질문이 다르다');
{
  check(
    'B(진행 중)에는 상대에게 던지는 질문이 있다',
    premiumQuestions(b).length > 0,
    premiumQuestions(b).length,
  );
  check(
    'D(끝난 관계)에는 상대에게 던지는 질문이 없다',
    premiumQuestions(d).length === 0,
    premiumQuestions(d).map((q) => q.text),
  );
  check(
    '같은 사건을 갖고도 두 결과의 질문 집합이 다르다',
    premiumQuestions(b).length !== premiumQuestions(d).length,
    { b: premiumQuestions(b).length, d: premiumQuestions(d).length },
  );
}

/* ── QUESTION-FIT-03 · event 없음 → safe deterministic fallback ────────── */
console.log('\nQUESTION-FIT-03 · 사건이 없어도 질문이 사라지지 않는다');
{
  const questions = premiumQuestions(a);
  check('A(사건 0)에도 질문이 있다', questions.length > 0, questions.length);
  check(
    'A에는 상황 기반 질문이 없다 (없는 장면으로 상황을 만들지 않는다)',
    !questions.some((q) => q.register === 'situational'),
    questions.map((q) => q.register),
  );
  check(
    'A의 질문이 전부 빈 문장이 아니다',
    questions.every((q) => q.text.trim().length > 0),
    questions,
  );
  check(
    '무료 화면에도 질문이 하나 이상 있다',
    a.free.candidates.some((candidate) => candidate.questions.length > 0),
    a.free.candidates.map((candidate) => candidate.questions.length),
  );
}

/* ── QUESTION-FIT-04 · ended → outward question 0 ─────────────────────── */
console.log('\nQUESTION-FIT-04 · 끝난 관계에서 상대를 향한 질문 0');
{
  check('D의 시제가 former다', d.tense === 'former', d.tense);
  check(
    'D의 lifecycle이 outward 질문을 허용하지 않는다',
    d.lifecycle.allowsOutwardQuestions === false,
    d.lifecycle,
  );
  check('D의 Candidate 질문이 0개다', premiumQuestions(d).length === 0);
  check('D의 무료 Candidate 질문도 0개다', d.free.candidates.every((x) => x.questions.length === 0));
  check('D의 무료 대화 질문도 0개다', d.free.questions.length === 0, d.free.questions);
  check(
    'D의 연결 질문도 0개다',
    d.report.connectionQuestions.length === 0,
    d.report.connectionQuestions,
  );
  /*
    §19 — 열린 질문은 **주어가 '나'라서** 끝난 관계에서도 안전하다. 그래서 이것만은
    있어야 한다 — 없으면 ended 사용자에게 마지막 한 줄이 통째로 사라진다.
  */
  check('D에도 열린 질문(주어가 나)은 남는다', Boolean(d.free.openQuestion), d.free.openQuestion);
  check(
    'D의 열린 질문이 상대에게 묻는 말이 아니다',
    !/너는|상대에게|물어봐/.test(d.free.openQuestion ?? ''),
    d.free.openQuestion,
  );
}

/* ── QUESTION-FIT-05 · repeated question 0 ────────────────────────────── */
console.log('\nQUESTION-FIT-05 · 같은 질문이 두 번 나오지 않는다');
{
  for (const [name, result] of [
    ['A', a],
    ['B', b],
    ['C', c],
  ]) {
    const texts = allQuestions(result).filter(Boolean);
    const duplicates = texts.filter((text, index) => texts.indexOf(text) !== index);
    check(`${name} — 글자 그대로 같은 질문이 없다`, duplicates.length === 0, duplicates);

    /*
      §31 — **paraphrase도 막는다.** 글자가 달라도 같은 것을 묻는 두 질문은 한 질문이다.
      fingerprint(`축:의도`)가 그 판정을 값으로 들고 있다.
    */
    const fingerprints = [
      ...result.report.candidates.flatMap((candidate) =>
        candidate.questions.map((question) => question.fingerprint),
      ),
      ...result.free.candidates.flatMap((candidate) =>
        candidate.questions.map((question) => question.fingerprint),
      ),
    ];
    const dupFingerprints = fingerprints.filter(
      (item, index) => fingerprints.indexOf(item) !== index,
    );
    check(`${name} — 같은 의도의 질문이 두 번 나오지 않는다`, dupFingerprints.length === 0, {
      fingerprints,
      dupFingerprints,
    });
  }
}

/* ── QUESTION-FIT-06 · target partial → known info만 사용 ──────────────── */
console.log('\nQUESTION-FIT-06 · 상대를 모르는 축에서는 규칙을 합의하자고 하지 않는다');
{
  /** 상대 4축을 전부 `x`(모름)로 둔 세션 */
  const unknownTarget = await run({
    ...FIXTURE_B,
    target: { ...FIXTURE_B.target, contact: 'x', conflict: 'x', alone: 'x', affection: 'x' },
  });
  const questions = premiumQuestions(unknownTarget);
  check('상대를 모르는 세션에도 질문은 있다', questions.length > 0, questions.length);
  check(
    '`direct`(두 사람의 규칙을 묻는 질문)가 없다',
    !questions.some((q) => q.register === 'direct'),
    questions.map((q) => [q.register, q.text]),
  );
  check(
    '아는 축이 있는 세션(B)에는 `direct`가 있다 — 검사가 항상 통과하는 게 아니다',
    premiumQuestions(b).some((q) => q.register === 'direct'),
    premiumQuestions(b).map((q) => q.register),
  );
}

/* ── QUESTION-FIT-07 · event attribution 유지 ─────────────────────────── */
console.log('\nQUESTION-FIT-07 · 장면의 주어가 사용자로 남는다');
{
  /*
    §17 — 질문에 사건 **본문**이 인용되면 안 된다. 사용자가 서비스에 한 말과 상대에게
    보내는 말은 다른 발화이고, 본문이 그대로 질문에 들어가면 그 경계가 사라진다.
  */
  const texts = allQuestions(b).filter(Boolean);
  const quoted = [];
  for (const event of FIXTURE_B.target.events) {
    for (const text of texts) {
      if (text.includes(event.description)) quoted.push({ event: event.id, text });
      if (event.myReaction && text.includes(event.myReaction)) {
        quoted.push({ event: event.id, text });
      }
    }
  }
  check('질문에 사건 본문이 인용되지 않았다', quoted.length === 0, quoted);
  check(
    '근거 블록에는 본문이 그대로 남아 있다 (숨긴 게 아니라 자리를 옮긴 것이다)',
    (b.report.reportedScenes?.scenes ?? []).some(
      (scene) => scene.fact === FIXTURE_B.target.events[0].description,
    ),
    b.report.reportedScenes?.scenes.map((scene) => scene.fact),
  );
}

/* ── QUESTION-FIT-08 · partner intent 0 ───────────────────────────────── */
console.log('\nQUESTION-FIT-08 · 상대의 마음을 추정하는 질문 0');
{
  for (const [name, result] of [
    ['A', a],
    ['B', b],
    ['C', c],
    ['D', d],
  ]) {
    const hits = findForbidden(allQuestions(result), PARTNER_INTENT);
    check(`${name} — 상대 의도 추정 표현 0건`, hits.length === 0, hits);
  }
  /*
    주어 검사. `상대는` · `상대가`로 시작하는 질문은 상대를 두고 하는 말이지
    상대에게 하는 말이 아니다 — 그 순간 질문이 추정이 된다(§29).
  */
  const subjectHits = allQuestions(b).filter((text) => /^상대[는가]/.test(text));
  check('상대를 주어로 시작하는 질문이 없다', subjectHits.length === 0, subjectHits);
}

/* ── QUESTION-FIT-09 · manipulatory question 0 ────────────────────────── */
console.log('\nQUESTION-FIT-09 · 시험 · 유도 · 상담사 말투 0');
{
  for (const [name, result] of [
    ['A', a],
    ['B', b],
    ['C', c],
  ]) {
    const texts = allQuestions(result);
    const style = findForbidden(texts, QUESTION_STYLE_BANNED);
    const intent = findForbidden(texts, QUESTION_INTENT_BANNED);
    check(`${name} — 심리검사 · 상담사 말투 0건`, style.length === 0, style);
    check(`${name} — 시험 · 유도 · 죄책감 유도 0건`, intent.length === 0, intent);
  }

  /*
    §28 — UT에서 직접 지적된 두 문장이 되살아나지 않는지. 하나는 전제를 깔고
    (`싸웠을 때`), 하나는 양을 묻는다(`어느 정도 시간`).
  */
  const legacy = ['싸웠을 때 어느 정도 시간이 필요해', '갈등 해결 방식은'];
  const legacyHits = findForbidden(allQuestions(b), legacy);
  check('UT에서 지적된 옛 문장이 없다', legacyHits.length === 0, legacyHits);

  /* 질문은 물음표로 끝난다 — 설명문이 질문 자리에 들어와 있지 않은지 */
  const notQuestions = allQuestions(b).filter((text) => !text.trim().endsWith('?'));
  check('모든 질문이 물음표로 끝난다', notQuestions.length === 0, notQuestions);
}

/* ── QUESTION-FIT-10 · 상황 질문 문장 품질 (HARDENING PHASE 6) ─────────── */
console.log('\nQUESTION-FIT-10 · 상황 기반 질문이 실제로 보낼 수 있는 문장인가');
{
  const situational = [b, c].flatMap((result) =>
    premiumQuestions(result).filter((question) => question.register === 'situational'),
  );
  check('상황 기반 질문이 있다', situational.length > 0, situational.length);

  /*
    ⚠️ **상황을 두 번 가리키지 않는다.** 초기 구현은 묻는 절이 `그럴 때 …`로
    시작해서 이런 문장이 나왔다:

    ```
    답장 간격이 평소랑 달라지는 날에는 그럴 때 나한테 어떻게 알려주는 게 …
    ```

    상황 절이 이미 그 때를 가리키는데 묻는 절이 또 가리킨다 — 실제로 보낼 수 없는
    문장이다. 사람이 읽어야만 보이는 종류라 값으로 고정해둔다.
  */
  const doubled = situational.filter((question) => /(때|날|순간)에?는?\s*그럴\s*때/.test(question.text));
  check('상황을 두 번 가리키는 문장 0건', doubled.length === 0, doubled.map((q) => q.text));

  check(
    '모든 상황 질문이 상황 절로 시작한다',
    situational.every((question) => /^(답장|얘기|괜히|오랜만|누가|만나기)/.test(question.text)),
    situational.map((q) => q.text),
  );
  /* 길이 — 실제로 메시지로 보낼 수 있는 길이여야 한다 */
  check(
    '상황 질문이 지나치게 길지 않다 (60자 이하)',
    situational.every((question) => question.text.length <= 60),
    situational.map((q) => [q.text.length, q.text]),
  );
}

/* ── QUESTION-FIT-11 · 상대를 몰라도 질문이 사라지지 않는다 ───────────── */
console.log('\nQUESTION-FIT-11 · 상대를 전혀 몰라도 Premium 질문이 있다');
{
  /**
   * ⚠️ **실측에서 0개였다.** `premiumService`가 동기화율 4축의 지문을 전부 미리
   * 막았는데 무료는 상위 2축만 쓴다 — 나머지 두 축의 `light`가 아무도 안 쓰는데도
   * 막혀 있었고, 상대를 모르면 `direct`도 `situational`도 만들어지지 않아서
   * 결국 유료 첫 화면에 질문이 하나도 남지 않았다(§32 위반).
   */
  const unknown = await run({
    ...FIXTURE_B,
    target: {
      ...FIXTURE_B.target,
      contact: 'x',
      conflict: 'x',
      alone: 'x',
      affection: 'x',
      events: [],
    },
  });
  check(
    '상대를 몰라도 Premium 질문이 1개 이상이다',
    premiumQuestions(unknown).length >= 1,
    unknown.report.candidates.map((candidate) => [candidate.axis, candidate.questions.length]),
  );
  check(
    '무료가 실제로 쓴 지문만 막혔다 (4축 전부 선제 차단 아님)',
    premiumQuestions(unknown).some((question) => question.register === 'light'),
    premiumQuestions(unknown).map((question) => [question.register, question.fingerprint]),
  );
  check(
    '그래도 무료와 의도가 겹치지 않는다',
    (() => {
      const freeFp = new Set(
        unknown.free.candidates.flatMap((candidate) =>
          candidate.questions.map((question) => question.fingerprint),
        ),
      );
      return !premiumQuestions(unknown).some((question) => freeFp.has(question.fingerprint));
    })(),
  );
}

/* ── §32 · Premium에서 질문이 돈값의 일부인가 ─────────────────────────── */
console.log('\n§32 · Premium 첫 화면 Insight 중 최소 1개에 바로 쓸 질문이 있다');
{
  const top = b.report.candidates.slice(0, 3);
  check(
    '첫 3개 Candidate 중 최소 1개에 질문이 있다',
    top.some((candidate) => candidate.questions.length > 0),
    top.map((candidate) => candidate.questions.length),
  );
  check(
    '질문마다 왜 지금 맞는지가 함께 있다',
    premiumQuestions(b).every((q) => typeof q.basis === 'string' && q.basis.length > 0),
    premiumQuestions(b).map((q) => q.basis),
  );
}

report('Personalized Question Fixture');
