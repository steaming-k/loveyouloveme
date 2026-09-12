/**
 * Event Fixture — EVENT-LIMIT-01 ~ 11 (v1.46.4 · §41)
 *
 * ══ 이 스크립트가 고정하는 것 ═══════════════════════════════════════════════
 *
 * v1.46.4가 사건의 **성격**을 바꿨다:
 *
 * ```
 * 예전   3개까지 · 80자까지   제품이 정한 상한
 * 지금   사실상 제한 없음      대신 저장/전송에 기술 예산이 있다
 * ```
 *
 * 그래서 검사도 "몇 개까지 되는가"가 아니라 **세 가지 불변식**을 본다:
 *
 * > **전부 저장되는가.**
 * > **AI에는 일부만 나가는가.**
 * > **원문이 Analytics로 나가지 않는가.**
 *
 * ⚠️ 20개는 **제품 max가 아니라 stress fixture**다(§41 마지막 줄). 이 숫자가
 * 상한처럼 코드에 박히면 안 된다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:event`
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FIXTURE_A,
  FIXTURE_B,
  createChecker,
  run,
  stressEvents,
  stripComments,
} from './fixtures-v1464.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const { check, report } = createChecker();

console.log('\nEvent Fixture — v1.46.4 §41\n');

const eventData = await readFile(join(ROOT, 'src/data/relationshipEvents.ts'), 'utf8');
const eventLogic = await readFile(join(ROOT, 'src/lib/logic/relationshipEvents.ts'), 'utf8');
const section = await readFile(
  join(ROOT, 'src/components/profile/RelationshipEventSection.tsx'),
  'utf8',
);
const provider = await readFile(join(ROOT, 'src/state/SessionProvider.tsx'), 'utf8');

/**
 * ⚠️ 카피 검사는 **주석을 걷어낸 소스**를 본다. 이 저장소는 "예전에는 `3개까지만
 * 받을게`였다"처럼 바뀐 이유를 주석으로 남기는데, 그 설명문을 화면 카피로 세면
 * 고쳐놓고도 실패한다(처음 EVENT-LIMIT-01이 정확히 그렇게 실패했다).
 */
const sectionCopy = stripComments(section);
const eventDataCode = stripComments(eventData);

const a = await run(FIXTURE_A);
const b = await run(FIXTURE_B);
const ten = await run({ ...FIXTURE_B, target: { ...FIXTURE_B.target, events: stressEvents(10) } });
const twenty = await run({
  ...FIXTURE_B,
  target: { ...FIXTURE_B.target, events: stressEvents(20) },
});

/* ── EVENT-LIMIT-01 · 기존 count hard cap 제거 ──────────────────────────── */
console.log('EVENT-LIMIT-01 · 사용자-facing 개수 상한이 없다');
{
  check(
    '`RELATIONSHIP_EVENT_MAX` 상수가 코드에 없다',
    !/RELATIONSHIP_EVENT_MAX/.test(eventDataCode),
    eventDataCode.match(/.{0,40}RELATIONSHIP_EVENT_MAX.{0,20}/g),
  );
  /*
    HARDENING PHASE 1 — 상한의 **세 종류가 이름부터 갈려 있어야** 한다.
    Candidate의 `RELATIONSHIP_EVENT_SAFETY_MAX`는 이름만 SAFETY이고 실질은 제품
    상한이었다(입력 화면·추가 핸들러·복원 파서를 한 상수가 함께 막았다).
  */
  check(
    '제품 상한과 파서 guard가 다른 상수다',
    eventDataCode.includes('RELATIONSHIP_EVENT_PARSER_SAFETY_MAX') &&
      eventDataCode.includes('RELATIONSHIP_EVENT_PARSER_FIELD_SAFETY_MAX'),
  );
  check(
    '저장 예산이 개수가 아니라 바이트다',
    eventDataCode.includes('SESSION_STORAGE_NEAR_LIMIT_BYTES'),
  );
  check(
    'Candidate의 겸용 상수(`RELATIONSHIP_EVENT_SAFETY_MAX`)가 사라졌다',
    !/RELATIONSHIP_EVENT_SAFETY_MAX/.test(stripComments(provider)) &&
      !/RELATIONSHIP_EVENT_SAFETY_MAX/.test(sectionCopy),
  );
  check(
    '추가 핸들러가 개수로 막지 않는다',
    !/events\.length >= RELATIONSHIP_EVENT_\w*MAX/.test(stripComments(provider)),
  );
  check(
    '입력 칸에 maxLength가 없다 (제품 길이 상한 0)',
    !/maxLength=/.test(sectionCopy),
    sectionCopy.match(/.{0,30}maxLength=.{0,30}/g),
  );
  /*
    ⚠️ 화면 카피 검사가 핵심이다. 상수만 바꾸고 "3개까지만 받을게"가 남아 있으면
    사용자에게는 아무것도 바뀌지 않은 것이다.
  */
  check(
    '입력 화면에 `N개까지만` 카피가 없다',
    !/개까지만/.test(sectionCopy),
    sectionCopy.match(/.{0,40}개까지만.{0,40}/g),
  );
  check(
    '입력 화면이 여러 개를 적어도 된다고 말한다',
    section.includes('여러 개 적어도 돼'),
  );
}

/* ── EVENT-LIMIT-02 / 03 · 10개 · 20개 저장 ────────────────────────────── */
console.log('\nEVENT-LIMIT-02 · 10개 저장 / EVENT-LIMIT-03 · 20개 저장');
{
  check('사건 10개가 전부 저장된다', ten.events.stored === 10, ten.events.stored);
  check('사건 20개가 전부 저장된다', twenty.events.stored === 20, twenty.events.stored);
  check(
    '20개가 전부 리포트 맥락 블록에 실린다 (조용히 잘리지 않는다)',
    (twenty.report.reportedScenes?.scenes.length ?? 0) === 20,
    twenty.report.reportedScenes?.scenes.length,
  );
  check(
    '사건이 많아져도 동기화율 점수는 그대로다 (§11 불변식)',
    a.compatibility.score === twenty.compatibility.score,
    { a: a.compatibility.score, twenty: twenty.compatibility.score },
  );
  check(
    '사건이 많아져도 Mirror 판정은 그대로다 (§12 불변식)',
    JSON.stringify(a.mirrorStates) === JSON.stringify(twenty.mirrorStates),
    { a: a.mirrorStates, twenty: twenty.mirrorStates },
  );
}

/* ── EVENT-LIMIT-04 · 긴 Event 저장 ────────────────────────────────────── */
console.log('\nEVENT-LIMIT-04 · 긴 장면도 잘리지 않는다');
{
  /** 예전 상한(80자)을 훌쩍 넘는 한 문장 */
  const long = '연락이 줄어서 마음이 식은 줄 알았는데 알고 보니 시험기간이었고, 그 사실을 나중에 알고 나서야 내가 얼마나 혼자 생각을 키웠는지 알게 됐어';
  const result = await run({
    ...FIXTURE_B,
    target: {
      ...FIXTURE_B.target,
      events: [{ id: 'ev-long', type: 'contact_change', description: long }],
    },
  });
  const scene = result.report.reportedScenes?.scenes[0];
  check(`긴 본문(${long.length}자)이 저장된다`, Boolean(scene), scene);
  check('본문이 잘리지 않고 그대로다', scene?.fact === long, {
    stored: scene?.fact?.length,
    input: long.length,
  });
  check(
    '입력 칸이 한 줄 input이 아니라 textarea다',
    section.includes('<textarea'),
  );
  check('복원해도 글자가 하나도 사라지지 않는다', result.events.charLoss === 0, result.events);
  check('복원 과정에서 버려진 항목이 없다', result.events.restoreDropped === 0, result.events);

  /*
    HARDENING PHASE 1-1 — **silent truncation 0.** 예전 상한(500자)을 훌쩍 넘는
    입력도 한 글자도 잃지 않아야 한다. 이 검사가 실패한다는 것은 어딘가에 `slice`가
    되살아났다는 뜻이다.
  */
  for (const length of [1000, 5000]) {
    const body = '가'.repeat(length);
    const long = await run({
      ...FIXTURE_B,
      target: {
        ...FIXTURE_B.target,
        events: [{ id: 'ev-vlong', type: 'contact_change', description: body }],
      },
    });
    const stored = long.report.reportedScenes?.scenes[0];
    check(`${length}자 입력이 그대로 저장된다`, stored?.fact === body, {
      stored: stored?.fact?.length,
      input: length,
    });
    check(`${length}자 입력에서 문자 손실 0`, long.events.charLoss === 0, long.events);
  }
}

/* ── EVENT-LIMIT-05 / 06 · edit · delete ───────────────────────────────── */
console.log('\nEVENT-LIMIT-05 · 수정 / EVENT-LIMIT-06 · 삭제');
{
  check('수정 핸들러가 있다', provider.includes('const updateRelationshipEvent'));
  check('삭제 핸들러가 있다', provider.includes('const removeRelationshipEvent'));
  check('화면에 수정 버튼이 있다', section.includes('고치기'));
  check('화면에 삭제 버튼이 있다', section.includes('삭제'));
  /*
    §11 — 잘못 적은 장면이 Insight에 계속 영향을 주면 신뢰가 깨진다. 삭제하면
    그 장면을 근거로 삼던 Candidate가 **실제로 달라져야** 한다.
  */
  /*
    ⚠️ **문장 비교로 검사하지 않는다.** 처음에는 "하나 지우면 SO WHAT이 달라진다"로
    썼는데, B의 `contact_change` 장면이 둘이라 하나를 지워도 **종류 라벨이 같아서**
    문장이 그대로였다 — 그리고 그건 옳은 동작이다. 결론 문장은 장면 **종류**를
    말하지 본문을 인용하지 않기 때문이다(§17).

    검사해야 하는 것은 문장이 아니라 **근거에서 사라졌는가**다.
  */
  const removed = await run({
    ...FIXTURE_B,
    target: { ...FIXTURE_B.target, events: FIXTURE_B.target.events.slice(1) },
  });
  check(
    '지워진 장면 id가 어떤 Candidate의 근거에도 남지 않는다',
    !removed.report.candidates.some((candidate) =>
      candidate.relevantEventIds.includes(FIXTURE_B.target.events[0].id),
    ),
    removed.report.candidates.map((candidate) => candidate.relevantEventIds),
  );
  check(
    '지워진 장면이 리포트 맥락 블록에서도 사라진다',
    !(removed.report.reportedScenes?.scenes ?? []).some(
      (scene) => scene.id === FIXTURE_B.target.events[0].id,
    ),
    removed.report.reportedScenes?.scenes.map((scene) => scene.id),
  );

  /*
    그 종류의 **마지막** 장면을 지우면 결론 문장이 실제로 달라진다 — 장면 연결절이
    사라지기 때문이다. 위 검사와 이 검사가 함께 있어야 "근거는 반영되는데 문장은
    안정적"이라는 성질이 값으로 고정된다.
  */
  const noContactEvents = await run({
    ...FIXTURE_B,
    target: {
      ...FIXTURE_B.target,
      events: FIXTURE_B.target.events.filter((event) => event.type !== 'contact_change'),
    },
  });
  const withContact = b.report.candidates.map((candidate) => candidate.soWhat).join('|');
  const withoutContact = noContactEvents.report.candidates
    .map((candidate) => candidate.soWhat)
    .join('|');
  check(
    '그 종류의 마지막 장면을 지우면 결론 문장이 달라진다',
    withContact !== withoutContact,
    { withContact: withContact.slice(0, 100), withoutContact: withoutContact.slice(0, 100) },
  );
}

/* ── EVENT-LIMIT-07 · target isolation ─────────────────────────────────── */
console.log('\nEVENT-LIMIT-07 · 상대가 바뀌면 장면도 함께 비워진다');
{
  /*
    사건은 `answers.target` 안에 있고, `resetTargetContext()`가 target을 통째로
    새로 만든다 — 그래서 다른 상대의 장면이 넘어올 **경로가 구조적으로 없다**.
    별도 `targetAnalysisId` 필드를 만들지 않은 이유이고, 그 구조를 소스로 고정한다.
  */
  check(
    '사건이 target 안에 있다 (상대 종속 데이터)',
    provider.includes('target: { ...prev.target, events }'),
  );
  check(
    '`resetTargetContext`가 target을 새로 만든다 (사건이 함께 비워진다)',
    /resetTargetContext[\s\S]{0,800}createEmptyTargetProfile/.test(provider),
  );
  const emptyTarget = await run({
    ...FIXTURE_B,
    target: { relation: null, contact: 'x', conflict: 'x', alone: 'x', affection: 'x', events: [] },
  });
  check('새 상대 세션의 장면 수가 0이다', emptyTarget.events.stored === 0, emptyTarget.events.stored);
}

/* ── EVENT-LIMIT-08 · refresh persistence ──────────────────────────────── */
console.log('\nEVENT-LIMIT-08 · 새로고침 후에도 남는다');
{
  check(
    '세션이 localStorage에 직렬화된다',
    provider.includes('window.localStorage.setItem(STORAGE_KEY'),
  );
  check(
    '복원 경로에 사건 sanitizer가 걸려 있다',
    provider.includes('sanitizeRelationshipEvents'),
  );
  check(
    '복원 sanitizer가 파서 guard 상수만 쓴다 (제품 상한 아님)',
    eventLogic.includes('RELATIONSHIP_EVENT_PARSER_SAFETY_MAX') &&
      !/RELATIONSHIP_EVENT_SAFETY_MAX/.test(stripComments(eventLogic)),
  );
  /*
    HARDENING PHASE 1-1 — **복원 파서가 자르지 않는다.** 한도를 넘는 값은 자르는 게
    아니라 버리고, 버렸다는 사실을 돌려준다. 자르면 사용자가 쓴 적 없는 문장이
    근거로 인용된다.
  */
  check(
    '복원 파서가 자유 입력을 slice하지 않는다',
    !/\.trim\(\)\.slice\(/.test(stripComments(eventLogic)),
  );
  check('복원 결과가 버린 개수를 함께 돌려준다', eventLogic.includes('dropped'));
  check(
    '화면이 버려진 개수를 사용자에게 말한다',
    sectionCopy.includes('droppedEventCount') || section.includes('droppedEventCount'),
  );
}

/* ── EVENT-LIMIT-09 · localStorage quota safe handling ─────────────────── */
console.log('\nEVENT-LIMIT-09 · 저장 실패를 삼키지 않는다');
{
  check(
    '저장 실패가 빈 catch로 무시되지 않는다',
    !/catch \{\s*\n\s*\/\/ 저장 실패가 흐름을 막지 않는다/.test(provider),
  );
  check('저장 상태가 상태값으로 노출된다', provider.includes('storageStatus'));
  check(
    '세 상태(ok · near · full)가 정의돼 있다',
    provider.includes("'ok' | 'near' | 'full'"),
  );
  check(
    '입력 화면이 `full`일 때 사용자에게 말한다',
    section.includes("storageStatus === 'full'"),
  );
  check(
    '저장 임계가 정의돼 있다',
    eventData.includes('SESSION_STORAGE_NEAR_LIMIT_BYTES'),
  );
  /*
    HARDENING PHASE 1-2 — **quota 초과 시 아무것도 지우지 않는다.** 자동으로 오래된
    사건을 지워 자리를 만드는 코드가 생기면 사용자가 알아차릴 수 없는 데이터 유실이 된다.
  */
  const quotaBlock = /catch \{[\s\S]{0,1600}?setStorageStatus\('full'\);/.exec(provider)?.[0] ?? '';
  check('quota 처리 블록을 찾았다', quotaBlock.length > 0);
  check(
    'quota 초과 시 사건을 지우지 않는다',
    !/events\s*[:=][\s\S]{0,80}(slice|filter|splice)/.test(quotaBlock),
    quotaBlock.slice(0, 200),
  );
  check(
    '바이트 측정이 UTF-16 length가 아니라 UTF-8이다',
    provider.includes('TextEncoder') && provider.includes('serializedByteLength'),
  );
}

/* ── EVENT-LIMIT-12 · 저장 stress (PHASE 1-4) ──────────────────────────── */
console.log('\nEVENT-LIMIT-12 · 20 / 50 / 100 건 저장 stress');
{
  const fifty = await run({
    ...FIXTURE_B,
    target: { ...FIXTURE_B.target, events: stressEvents(50) },
  });
  const hundred = await run({
    ...FIXTURE_B,
    target: { ...FIXTURE_B.target, events: stressEvents(100) },
  });

  for (const [label, result, count] of [
    ['20', twenty, 20],
    ['50', fifty, 50],
    ['100', hundred, 100],
  ]) {
    check(`${label}건 — 전부 저장된다`, result.events.stored === count, result.events.stored);
    check(
      `${label}건 — 복원해도 개수가 같다`,
      result.events.restoredCount === count,
      result.events,
    );
    check(`${label}건 — 버려진 항목 0`, result.events.restoreDropped === 0, result.events);
    check(`${label}건 — 문자 손실 0`, result.events.charLoss === 0, result.events);
    /*
      ⚠️ 바이트가 저장 임계(3MB) 근처에도 가지 않는다는 것이 이 검사의 요점이다.
      '100개까지 지원한다'가 아니라 '100개는 저장 문제가 아니다'를 고정한다.
    */
    check(
      `${label}건 — 세션 바이트가 저장 임계의 10% 미만`,
      result.events.sessionBytes < 300_000,
      result.events.sessionBytes,
    );
  }
  check(
    '100건에서도 AI 전송 건수가 늘지 않는다',
    hundred.events.sentToLenses <= b.events.sentToLenses,
    { five: b.events.sentToLenses, hundred: hundred.events.sentToLenses },
  );
}

/* ── EVENT-LIMIT-10 · AI에는 관련 있는 일부만 ──────────────────────────── */
console.log('\nEVENT-LIMIT-10 · AI 전송이 입력량에 비례하지 않는다');
{
  check(
    '사건 5건 세션에서 렌즈로 나가는 건수가 저장 건수보다 적다',
    b.events.sentToLenses < b.events.stored,
    b.events,
  );
  /*
    ⚠️ **여기가 이 스크립트의 핵심 검사다.** 5건 → 20건으로 4배가 되어도 전송량이
    같아야 한다. 늘어나면 §10이 막으려던 '선형 폭증'이 그대로 살아 있는 것이다.
  */
  check(
    '사건이 5건에서 20건이 되어도 렌즈 전송 건수가 늘지 않는다',
    twenty.events.sentToLenses <= b.events.sentToLenses,
    { five: b.events.sentToLenses, twenty: twenty.events.sentToLenses },
  );
  check(
    'Cross-Lens 전송도 상한 안에 있다 (2건 이하)',
    twenty.events.sentToCrossLens <= 2,
    twenty.events.sentToCrossLens,
  );
  check(
    'Deep Report Core Task에는 사건이 나가지 않는다 (기존 경계 유지)',
    twenty.events.sentToDeepReport === 0,
    twenty.events.sentToDeepReport,
  );
  check(
    'Provider 호출 수가 사건 수에 비례하지 않는다 (§51 — 사건마다 호출 금지)',
    a.ai.providerCalls === twenty.ai.providerCalls,
    { a: a.ai.providerCalls, twenty: twenty.ai.providerCalls },
  );
  check(
    'Candidate가 고른 shortlist가 저장 건수보다 작다',
    twenty.events.shortlisted < twenty.events.stored,
    { shortlisted: twenty.events.shortlisted, stored: twenty.events.stored },
  );
  check(
    '렌즈에 실리는 사건 문자열 길이가 20건에서도 500자 이하다',
    twenty.events.lensEventChars <= 500,
    twenty.events.lensEventChars,
  );
}

/* ── EVENT-AI-01 ~ 04 · FULL FLOW Provider 비용 (HARDENING PHASE 5) ───── */
console.log('\nEVENT-AI · Premium 전체 흐름의 Provider 호출 · 컨텍스트');
{
  /**
   * ⚠️ **Candidate 보고의 `providerCalls: 1`은 Deep Report Task 하나만 센 값이었다.**
   * 필드 이름이 전체 호출처럼 읽혀서 "5-call 구조와 숫자가 맞지 않는다"는 지적이
   * 나왔다. 이제 Task별로 세고, 여기서 그 합을 고정한다.
   */
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

  const flowA = await run(lensReady(FIXTURE_A));
  const flowB = await run(lensReady(FIXTURE_B));
  const flowC = await run(
    lensReady({ ...FIXTURE_B, target: { ...FIXTURE_B.target, events: stressEvents(20) } }),
  );

  /* EVENT-AI-01 — 구조가 문서와 맞는다: Deep 1 + Lens 3 + Cross 1 */
  for (const [name, flow] of [
    ['A(사건 0)', flowA],
    ['B(사건 5)', flowB],
    ['C(사건 20)', flowC],
  ]) {
    check(`${name} — 전체 Provider 호출이 5회다`, flow.ai.totalCalls === 5, {
      total: flow.ai.totalCalls,
      calls: flow.ai.calls.map((call) => [call.task, call.count]),
    });
  }

  /* EVENT-AI-02 — 사건이 늘어도 **호출 수**는 그대로다 */
  check(
    '사건 0 → 20에서 호출 수가 같다',
    flowA.ai.totalCalls === flowC.ai.totalCalls,
    { a: flowA.ai.totalCalls, c: flowC.ai.totalCalls },
  );

  /*
    EVENT-AI-03 — 컨텍스트는 **조금** 늘 수 있다(관련 장면이 실리므로). 다만
    입력량에 비례하면 안 된다. 사건이 4배가 됐는데 컨텍스트가 4배가 되면 실패다.
  */
  const charsOf = (flow) =>
    flow.ai.calls.reduce((total, call) => total + (call.count ? call.inputChars : 0), 0);
  const growth = charsOf(flowC) / charsOf(flowA);
  check(`사건 0 → 20에서 컨텍스트 증가가 1.5배 미만이다 (실측 ${growth.toFixed(2)}배)`, growth < 1.5, {
    a: charsOf(flowA),
    c: charsOf(flowC),
  });
  check(
    '사건 5 → 20에서는 거의 늘지 않는다 (1.1배 미만)',
    charsOf(flowC) / charsOf(flowB) < 1.1,
    { b: charsOf(flowB), c: charsOf(flowC) },
  );
  check(
    'Deep Report 컨텍스트는 사건과 무관하게 동일하다',
    flowA.ai.calls[0].inputChars === flowC.ai.calls[0].inputChars,
    { a: flowA.ai.calls[0].inputChars, c: flowC.ai.calls[0].inputChars },
  );

  /*
    EVENT-AI-04 (§5-1) — **가장 오래된 2개가 고정으로 가지 않는다.**
    이게 이 블록에서 가장 중요한 검사다. v1.46까지의 `slice(0, 2)`는 사건이 많아지면
    사용자가 방금 알려준 장면을 영영 보내지 않았다.
  */
  const sentIds = flowC.ai.calls.flatMap((call) => call.eventIds);
  check('사건 20건에서도 장면이 실제로 전송된다', sentIds.length > 0, sentIds);
  check(
    '가장 오래된 두 장면(ev-s1 · ev-s2)이 고정으로 실리지 않는다',
    !sentIds.includes('ev-s1') && !sentIds.includes('ev-s2'),
    sentIds,
  );
  check(
    '최근 장면이 선택된다 (뒤쪽 절반에서 하나 이상)',
    sentIds.some((id) => Number(id.replace('ev-s', '')) > 10),
    sentIds,
  );
  check(
    '호출 하나에 실리는 장면이 2건을 넘지 않는다',
    flowC.ai.calls.every((call) => call.eventCount <= 2),
    flowC.ai.calls.map((call) => [call.task, call.eventCount]),
  );
}

/* ── EVENT-LIMIT-11 · raw event analytics 전송 0 ───────────────────────── */
console.log('\nEVENT-LIMIT-11 · 자유 입력이 Analytics로 나가지 않는다');
{
  /*
    `trackEvent('target_event_add', …)` 호출부에 `description`/`myReaction`이
    한 번이라도 들어가면 이 검사가 실패한다. 종류·개수·불리언만 허용이다.
  */
  const addBlock = /trackEvent\('target_event_add'[\s\S]{0,400}?\}\);/.exec(provider)?.[0] ?? '';
  check('add 이벤트 payload를 찾았다', addBlock.length > 0);
  check(
    'payload에 `description`이 없다',
    !addBlock.includes('description'),
    addBlock,
  );
  check('payload에 `myReaction`이 없다', !addBlock.includes('myReaction'), addBlock);
  check(
    'payload가 종류 · 개수 · 불리언만 보낸다',
    addBlock.includes('event_type') && addBlock.includes('event_count'),
    addBlock,
  );
  check(
    'remove 이벤트도 본문을 보내지 않는다',
    /trackEvent\('target_event_remove'\)/.test(provider),
  );
  /*
    §36 마지막 줄 — 장면 원문은 사용자에게는 보여주되 Analytics로는 나가지 않는다.
    화면 컴포넌트에서 `trackEvent`를 부르지 않는 것으로 그 경계가 유지된다.
  */
  check('입력 화면이 직접 Analytics를 부르지 않는다', !section.includes('trackEvent'));
}

report('Event Fixture');
