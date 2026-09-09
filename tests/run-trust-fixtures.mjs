/**
 * Trust Boundary Fixture — T1~T14 + TEMP-01~06 + TEMP-DISPLAY-01~06 + TEMP-AI-01~06 + TEMP-AI-AXIS-01~06 (v1.44)
 *
 * ══ 이 스크립트가 고정하는 것 ═══════════════════════════════════════════════
 *
 * v1.44가 닫은 세 결함은 전부 같은 문장의 변형이다:
 *
 * > **입력을 신뢰할 수 없으면, 관찰도 없다.**
 *
 * ```
 * BUG-002  손상 세션의 값이 판정 경로로 흘러 확정형 관찰을 만들었다
 * BUG-003  AI 결과의 meta가 없을 때 소비자가 터졌다
 * NEW-002  입력이 하나도 없는데 Home이 성격을 단정했다
 * ```
 *
 * PostFix QA에서 이 셋은 **Browser 실측만** 있었다. 실측은 그 순간을 증명하지만 다음
 * 버전에서 다시 열리는 것을 막지 못한다 — 특히 NEW-002의 갈등 축처럼 **세 갈래 중
 * 하나만 빠진** 결함은 눈으로 다시 찾기 어렵다. 그래서 자동 회귀로 옮긴다.
 *
 * ⚠️ **판정 로직을 여기서 복제하지 않는다.** `/api/dev/trust-test`가 화면과 같은 함수를
 * 호출하고, 이 스크립트는 fixture 조립과 검증만 한다. `run-lifecycle-fixtures.mjs`와
 * 같은 방식이다 — 새 테스트 프레임워크를 쓰지 않는다.
 *
 * ⚠️ **금지어 목록에 의존하지 않는다.** 라우트가 낸 구조화된 값(강등된 enum·축 state)이
 * 1차 판정이고, 문자열 검사는 2차 guard로만 쓴다. v1.40.1이 배운 순서 그대로다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:trust`
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
  const response = await fetch(`${BASE_URL}/api/dev/trust-test`, {
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

/**
 * 근거 없이 나오면 안 되는 **확정형 문장**들.
 *
 * ⚠️ 이 목록은 2차 guard다. 1차는 강등된 값 자체를 본다 — 금지어는 주제를 막고 대상·시점을
 * 막지 못한다는 것이 v1.40.1의 교훈이고, 여기서도 같다. 목록에 없는 새 문장이 생기면
 * 이 검사는 통과하므로, 값 검사를 함께 둔다.
 */
const ASSERTIVE_PHRASES = [
  // NEW-002 (a) — 삭제된 `HOME_COPY.fallbackProfile`
  '독립적인 시간을 중요하게 여기지만 관계의 연결 신호에는 민감한 편',
  // NEW-002 (b) — 갈등 축 마지막 else가 발명하던 문장
  '잠깐 뒤 대화 선호',
  // BUG-002 — `conflict:99`가 만들던 DECLARED 칩
  '잠깐 뒤 이야기',
];

const NEUTRAL_SUMMARY = '아직 뚜렷한 특징을 관찰하기엔 정보가 조금 더 필요해.';
const NEUTRAL_AXIS = '아직 뚜렷한 신호 없음';

function axisValue(rendered, key) {
  return rendered.highlights.find((item) => item.key === key)?.value;
}

/** 렌더되는 문자열 전체에 확정형 문장이 하나도 없는가 */
function noAssertion(rendered) {
  return rendered.strings.filter((text) =>
    ASSERTIVE_PHRASES.some((phrase) => typeof text === 'string' && text.includes(phrase)),
  );
}

const EMPTY_SESSION = {};

/* ══════════════════════════════════════════════════════════════════════════
   T1~T6 · BUG-002 — 손상 세션은 추정하지 않고 미입력으로 강등한다
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nT1 — invalid status');
{
  const { session } = await run({ session: { status: 'NOT_A_STATUS' } });
  check('status가 null로 강등된다', session.sanitized.status === null, session.sanitized.status);
  check('크래시 없이 렌더 문자열이 나온다', Array.isArray(session.rendered.strings));
  check('확정형 관찰 0', noAssertion(session.rendered).length === 0, noAssertion(session.rendered));
}

console.log('\nT2 — invalid declared scalar / enum');
{
  const { session } = await run({
    session: {
      declared: { contact: 'abc', conflict: 99, alone: 7, affection: 'a9', hobby: 2.5 },
    },
  });
  const d = session.sanitized.declared;
  check("contact:'abc' → null", d.contact === null, d.contact);
  check('conflict:99 → null', d.conflict === null, d.conflict);
  check('alone:7(범위 밖) → null', d.alone === null, d.alone);
  check("affection:'a9' → null", d.affection === null, d.affection);
  check('hobby:2.5 → null', d.hobby === null, d.hobby);
  check('DECLARED 칩이 0개다 — 답하지 않은 것을 답한 것처럼 그리지 않는다',
    session.rendered.declaredChips.length === 0, session.rendered.declaredChips);
  check("갈등 축이 '잠깐 뒤 대화 선호'가 아니다 (BUG-002 관측 문장)",
    axisValue(session.rendered, '갈등') === NEUTRAL_AXIS, axisValue(session.rendered, '갈등'));
  check('확정형 관찰 0', noAssertion(session.rendered).length === 0, noAssertion(session.rendered));
}

console.log('\nT3 — invalid experience collection / enum');
{
  const { session } = await run({
    session: {
      experience: {
        important: 'notanarray',
        hardest: 'NOT_A_MOMENT',
        selfGap: 42,
        note: { nope: true },
      },
    },
  });
  const e = session.sanitized.experience;
  check("important:'notanarray' → [] (문자열 .length가 11로 읽히던 자리)",
    Array.isArray(e.important) && e.important.length === 0, e.important);
  check('hardest invalid → null', e.hardest === null, e.hardest);
  check('selfGap:42 → null', e.selfGap === null, e.selfGap);
  check('note가 객체면 빈 문자열', e.note === '', e.note);
  check('RELATIONSHIP 칩이 0개다', session.rendered.relationshipChips.length === 0,
    session.rendered.relationshipChips);
  check('확정형 관찰 0', noAssertion(session.rendered).length === 0, noAssertion(session.rendered));
}

console.log('\nT4 — invalid target relation · 4축 · 지금 관계 근거');
{
  const { session } = await run({
    session: {
      target: { relation: 'NOT_A_RELATION', contact: 'z', conflict: 'h', alone: 3, affection: 'm' },
      currentRelationship: {
        signals: { conflict: 'BOGUS', notanaxis: 'often', contact: 'sometimes' },
        askedAt: 123,
      },
    },
  });
  const t = session.sanitized.target;
  check('relation invalid → null', t.relation === null, t.relation);
  check("4축 invalid → 'x'(모름)", t.contact === 'x' && t.alone === 'x' && t.affection === 'm', t);
  check("유효한 4축 값('h')은 보존", t.conflict === 'h', t.conflict);
  const signals = session.sanitized.currentRelationship.signals;
  check("알 수 없는 답('BOGUS')은 버린다", signals.conflict === undefined, signals);
  check("알 수 없는 축('notanaxis')은 버린다", signals.notanaxis === undefined, signals);
  check("유효한 답('sometimes')은 보존", signals.contact === 'sometimes', signals);
  check('askedAt이 숫자면 null', session.sanitized.currentRelationship.askedAt === null,
    session.sanitized.currentRelationship.askedAt);
  check('확정형 관찰 0', noAssertion(session.rendered).length === 0, noAssertion(session.rendered));
}

console.log('\nT5 — valid + invalid 혼합: 유효한 값만 살아남는다');
{
  const { session } = await run({
    session: {
      status: 'dating',
      declared: { contact: 4, conflict: 'NOPE', alone: 'abc', affection: 'a3', hobby: 'h9' },
      experience: {
        important: ['contact', 'NOT_A_FACTOR', 'contact', 'alone'],
        hardest: 'contact_drop',
      },
    },
  });
  const d = session.sanitized.declared;
  const e = session.sanitized.experience;
  check("status 'dating' 보존", session.sanitized.status === 'dating', session.sanitized.status);
  check('contact:4 보존', d.contact === 4, d.contact);
  check("affection:'a3' 보존", d.affection === 'a3', d.affection);
  check('invalid conflict/alone/hobby만 강등', d.conflict === null && d.alone === null && d.hobby === null, d);
  check('유효한 factor만 남고 중복도 제거된다',
    e.important.length === 2 &&
      e.important.includes('contact') &&
      e.important.includes('alone') &&
      !e.important.includes('NOT_A_FACTOR'),
    e.important);
  check("hardest 'contact_drop' 보존", e.hardest === 'contact_drop', e.hardest);
  check('보존된 답은 DECLARED 칩으로 그려진다',
    session.rendered.declaredChips.includes('연락 4/5') &&
      session.rendered.declaredChips.includes('자주 표현'),
    session.rendered.declaredChips);
  check('강등된 갈등은 중립 문구', axisValue(session.rendered, '갈등') === NEUTRAL_AXIS,
    axisValue(session.rendered, '갈등'));
  check('확정형 관찰 0', noAssertion(session.rendered).length === 0, noAssertion(session.rendered));
}

console.log('\nT6 — valid legacy fixture: 정상 세션은 글자 하나 달라지지 않는다');
{
  const { session } = await run({
    session: {
      status: 'dating',
      declared: { contact: 2, conflict: 'now', alone: 5, affection: 'a1', hobby: 'h1' },
      experience: {
        important: ['contact', 'alone', 'conflict'],
        hardest: 'contact_drop',
        selfGap: 'yes',
        note: '메모',
      },
    },
  });
  const d = session.sanitized.declared;
  check('모든 유효 값이 그대로 보존된다',
    d.contact === 2 && d.conflict === 'now' && d.alone === 5 && d.affection === 'a1' && d.hobby === 'h1', d);
  check("갈등 'now' → '빠른 해결 선호' 유지", axisValue(session.rendered, '갈등') === '빠른 해결 선호',
    axisValue(session.rendered, '갈등'));
  check('Mirror가 열린다', session.rendered.mirror.available === true);
  check('Mirror 판정이 실제로 생성된다', session.rendered.mirror.insightCount > 0,
    session.rendered.mirror.states);
  check('프로필 요약이 중립 문구가 아니다 — 근거가 있으면 관찰이 있다',
    session.rendered.profileSummary !== NEUTRAL_SUMMARY, session.rendered.profileSummary);
}

/* ══════════════════════════════════════════════════════════════════════════
   T7~T9 · BUG-003 — meta가 없어도 터지지 않고, 모르는 것은 모른다고 둔다
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nT7 — meta=null');
{
  const { ai } = await run({
    ai: {
      data: { meta: null, items: [] },
      prev: { meta: null },
      next: { meta: null },
    },
  });
  check("mode가 null로 떨어진다 (unhandled rejection 자리)", ai.mode === null, ai.mode);
  check('지문을 못 읽으면 같은 분석으로 오판하지 않는다', ai.sameFingerprint === false,
    ai.sameFingerprint);
}

console.log('\nT8 — meta missing');
{
  const { ai } = await run({ ai: { data: { items: [] }, prev: {}, next: {} } });
  check('mode가 null로 떨어진다', ai.mode === null, ai.mode);
  check('둘 다 meta가 없어도 sameFingerprint는 false', ai.sameFingerprint === false,
    ai.sameFingerprint);
}
{
  const { ai } = await run({ ai: { data: null, prev: null, next: null } });
  check('data 자체가 null이어도 터지지 않는다', ai.mode === null, ai.mode);
  check('prev/next가 null이면 sameFingerprint false', ai.sameFingerprint === false,
    ai.sameFingerprint);
}
{
  const { ai } = await run({
    ai: { data: { meta: { mode: 42 } }, prev: { meta: { inputFingerprint: 7 } }, next: { meta: { inputFingerprint: 7 } } },
  });
  check('mode가 문자열이 아니면 null', ai.mode === null, ai.mode);
  check('지문이 문자열이 아니면 같다고 하지 않는다', ai.sameFingerprint === false,
    ai.sameFingerprint);
}

console.log('\nT9 — meta normal: 정상 동작이 그대로다');
{
  const { ai } = await run({
    ai: {
      data: { meta: { mode: 'real' } },
      prev: { meta: { inputFingerprint: 'fp-a' } },
      next: { meta: { inputFingerprint: 'fp-a' } },
    },
  });
  check("정상 meta의 mode를 그대로 읽는다", ai.mode === 'real', ai.mode);
  check('같은 지문이면 같은 분석이다 — 피드백을 유지한다', ai.sameFingerprint === true,
    ai.sameFingerprint);
}
{
  const { ai } = await run({
    ai: {
      data: { meta: { mode: 'mock' } },
      prev: { meta: { inputFingerprint: 'fp-a' } },
      next: { meta: { inputFingerprint: 'fp-b' } },
    },
  });
  check("mode 'mock'을 그대로 읽는다", ai.mode === 'mock', ai.mode);
  check('지문이 다르면 다른 분석이다 — 피드백을 비운다', ai.sameFingerprint === false,
    ai.sameFingerprint);
}

/* ══════════════════════════════════════════════════════════════════════════
   T10~T14 · NEW-002 — 입력이 없으면 성격을 단정하지 않는다
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nT10 · HOME-EMPTY-01 — 완전히 빈 세션');
{
  const { session } = await run({ session: EMPTY_SESSION });
  const r = session.rendered;
  check('Hero(프로필 미완료)가 중립 문구', r.hero.incomplete === NEUTRAL_SUMMARY, r.hero.incomplete);
  check('Hero(프로필 완료·근거 없음)도 중립 문구', r.hero.completed === NEUTRAL_SUMMARY, r.hero.completed);
  check("연락 축 → 중립", axisValue(r, '연락') === NEUTRAL_AXIS, axisValue(r, '연락'));
  check("갈등 축 → 중립 (v1.43은 '잠깐 뒤 대화 선호'였다)", axisValue(r, '갈등') === NEUTRAL_AXIS,
    axisValue(r, '갈등'));
  check("취미 축 → 중립", axisValue(r, '취미') === NEUTRAL_AXIS, axisValue(r, '취미'));
  check('세 축이 모두 같은 중립 문구다 — 한 축만 빠지는 것이 NEW-002였다',
    new Set(r.highlights.map((item) => item.value)).size === 1, r.highlights);
  check('확정형 관찰 0', noAssertion(r).length === 0, noAssertion(r));
}

console.log('\nT11 · HOME-PARTIAL-01 — contact만 입력');
{
  const { session } = await run({ session: { declared: { contact: 5 } } });
  const r = session.rendered;
  check('contact는 실제 입력 기반으로 그려진다', r.declaredChips.includes('연락 5/5'), r.declaredChips);
  check('갈등 축은 채워지지 않는다', axisValue(r, '갈등') === NEUTRAL_AXIS, axisValue(r, '갈등'));
  check('취미 축은 채워지지 않는다', axisValue(r, '취미') === NEUTRAL_AXIS, axisValue(r, '취미'));
  check('확정형 관찰 0', noAssertion(r).length === 0, noAssertion(r));
}

console.log("\nT12 · HOME-CONFLICT-NOW-01 / SPACE-01 / SOON-01 — 유효 입력의 문구는 그대로");
{
  const now = await run({ session: { declared: { conflict: 'now' } } });
  check("conflict='now' → '빠른 해결 선호'", axisValue(now.session.rendered, '갈등') === '빠른 해결 선호',
    axisValue(now.session.rendered, '갈등'));

  const space = await run({ session: { declared: { conflict: 'space' } } });
  check("conflict='space' → '혼자 정리할 시간 필요'",
    axisValue(space.session.rendered, '갈등') === '혼자 정리할 시간 필요',
    axisValue(space.session.rendered, '갈등'));

  /**
   * ⚠️ **이 케이스가 NEW-002의 핵심이다.** `soon`은 `now`·`space`와 똑같이 유효한 답인데
   * 예전 코드에서 이름이 적힌 적이 없다 — 미입력과 함께 마지막 `else`에 얹혀 있었다.
   * 그래서 `soon` 사용자의 문구를 지키는 것과 미입력에 말을 붙이지 않는 것이 **같은
   * 분기에 묶여** 하나를 고치면 다른 하나가 깨지는 상태였다. 둘을 함께 고정한다.
   */
  const soon = await run({ session: { declared: { conflict: 'soon' } } });
  check("conflict='soon' → '잠깐 뒤 대화 선호' 유지 (유효 입력이므로 문구가 남는다)",
    axisValue(soon.session.rendered, '갈등') === '잠깐 뒤 대화 선호',
    axisValue(soon.session.rendered, '갈등'));
  check("conflict='soon'의 DECLARED 칩도 그대로",
    soon.session.rendered.declaredChips.includes('잠깐 뒤 이야기'),
    soon.session.rendered.declaredChips);
}

console.log('\nT13 · HOME-VALID-PROFILE-01 / HOME-CORRECTION-01 — Hero 우선순위');
{
  const { hero } = await run({
    hero: { coreCorrection: '', profileCompleted: true, mirrorSummary: '실제 Mirror 요약이야.' },
  });
  check('프로필 완료 + Mirror 요약 → 그 요약을 쓴다', hero.summary === '실제 Mirror 요약이야.',
    hero.summary);
}
{
  const { hero } = await run({
    hero: { coreCorrection: '   ', profileCompleted: false, mirrorSummary: '실제 Mirror 요약이야.' },
  });
  check('프로필 미완료면 Mirror 요약을 앞당겨 쓰지 않는다 (v1.43과 같다)',
    hero.summary === NEUTRAL_SUMMARY, hero.summary);
}
{
  const { hero } = await run({
    hero: { coreCorrection: '  내가 고친 문장이야.  ', profileCompleted: true, mirrorSummary: '실제 Mirror 요약이야.' },
  });
  check('coreCorrection이 있으면 언제나 이긴다 (BUG-001과 같은 우선순위)',
    hero.summary === '내가 고친 문장이야.', hero.summary);
}
{
  const { hero } = await run({
    hero: { coreCorrection: '', profileCompleted: true, mirrorSummary: '   ' },
  });
  check("Mirror 요약이 공백뿐이면 중립 문구 — '?? fallback'은 ''를 통과시켰다",
    hero.summary === NEUTRAL_SUMMARY, hero.summary);
}

/* ══════════════════════════════════════════════════════════════════════════
   T14 · 정적 배선 guard
   ══════════════════════════════════════════════════════════════════════════

   위 T1~T5는 **강등 규칙**(`@/lib/sessionSanitize`)을 화면과 같은 코드로 검사한다.
   그 규칙이 실제 복원 경로에 배선돼 있는지는 런타임으로 못 본다 —
   `SessionProvider.deserialize()`는 `'use client'` 모듈의 지역 함수이고, 테스트를 위해
   export하지 않는다는 것이 v1.44의 방침이다. 대신 배선을 소스에서 직접 확인한다.

   ⚠️ 이것은 정적 검사다. '강등이 일어난다'는 증거가 아니라 '강등 함수가 그 자리에서
   불린다'는 증거다. 두 검사를 함께 두어야 의미가 있다.
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nT14 — deserialize()가 강등 함수를 실제로 부른다 (정적)');
{
  /**
   * ⚠️ **주석을 코드로 세지 않는다.** v1.44의 주석들은 고쳐진 옛 코드를 그대로 인용한다
   * (`...parsed.declared`로 펼쳤다 · `fallbackProfile`은 없앴다). 소스 전체를
   * `includes()`로 훑으면 그 인용문이 '아직 그 코드가 있다'로 읽힌다 — 실제로 이
   * fixture를 처음 돌렸을 때 그렇게 실패했다. 줄 단위 주석을 먼저 지운다.
   */
  const codeOnly = (text) =>
    text
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        return !trimmed.startsWith('*') && !trimmed.startsWith('/*') && !trimmed.startsWith('//');
      })
      .join('\n');

  const source = codeOnly(
    await readFile(join(ROOT, 'src', 'state', 'SessionProvider.tsx'), 'utf8'),
  );
  const required = [
    'sanitizeStatus(parsed.status)',
    'sanitizeScale(parsed.declared?.contact)',
    'sanitizeConflict(parsed.declared?.conflict)',
    'sanitizeScale(parsed.declared?.alone)',
    'sanitizeAffection(parsed.declared?.affection)',
    'sanitizeHobby(parsed.declared?.hobby)',
    'sanitizePastFactors(parsed.experience?.important)',
    'sanitizeHardest(parsed.experience?.hardest)',
    'sanitizeSelfGap(parsed.experience?.selfGap)',
    'sanitizeCurrentSignals(parsed.currentRelationship?.signals)',
    'sanitizeTargetRelation(parsed.target?.relation)',
    'sanitizeTargetLevels(',
  ];
  for (const call of required) {
    check(`deserialize()가 ${call}를 부른다`, source.includes(call));
  }
  check('declared를 검증 없이 펼치지 않는다', !source.includes('...parsed.declared'));
  check('sameAnalysisFingerprint()로 지문을 비교한다',
    source.includes('sameAnalysisFingerprint(prev.observedAnalysis, result)'));

  const home = codeOnly(await readFile(join(ROOT, 'src', 'app', 'home', 'page.tsx'), 'utf8'));
  check('Home Hero가 homeHeroSummary()를 쓴다', home.includes('homeHeroSummary({'));
  check('삭제된 HOME_COPY.fallbackProfile을 아무도 참조하지 않는다',
    !home.includes('fallbackProfile'));

  const copy = codeOnly(await readFile(join(ROOT, 'src', 'data', 'copy.ts'), 'utf8'));
  check('copy.ts에 fallbackProfile이 남아 있지 않다', !copy.includes('fallbackProfile'));
  check('중립 문구는 NO_EVIDENCE_COPY 한 곳에서만 정의된다',
    copy.includes('export const NO_EVIDENCE_COPY'));
}

/* ══════════════════════════════════════════════════════════════════════════
   TEMP-01~06 · NEW-003 — 시간적 변화 주장에는 시간 비교 근거가 필요하다
   ══════════════════════════════════════════════════════════════════════════

   > TEMPORAL CHANGE CLAIM → TEMPORAL COMPARISON EVIDENCE REQUIRED

   `stateFor`는 `declared >= 4` + 근거 없음을 CHANGE로 판정한다(v1.0부터, 계산은 그대로).
   v1.41은 CHANGE 문장 계열을 `scope === 'current'`로 갈랐는데, 그 **else 쪽에 `'none'`이
   함께 있었다** — 관계 신호를 확인한 적이 없는 축에도 `경험 후 …` 문장이 나갔다.

   ⚠️ **금지어 목록만으로 검사하지 않는다.** 1차는 라우트가 낸 구조화된 값
   (`evidenceScope` × `state`)이고, 문자열은 2차 guard다. 목록에 없는 새 시제 문장이
   생기면 문자열 검사는 통과하므로 두 검사를 함께 둔다.
   ══════════════════════════════════════════════════════════════════════════ */

/** Before/After를 주장하는 어휘. 근거 없이 나오면 안 된다 */
const TEMPORAL_PHRASES = [
  '경험 후',
  '경험 전후',
  '예전보다',
  '이전보다',
  '낮아짐',
  '낮아졌',
  '높아짐',
  '높아졌',
  '달라졌',
  '옮겨간',
  '옮겨짐',
  '옮겨졌',
  '중요해졌',
  '연애 전에는',
];

/** 렌더되는 문자열 전체에서 시제 주장 문구를 찾는다 */
function temporalClaims(rendered) {
  return rendered.strings.filter(
    (text) =>
      typeof text === 'string' && TEMPORAL_PHRASES.some((phrase) => text.includes(phrase)),
  );
}

/** scope별 insight 묶음 */
function scopesOf(rendered) {
  return rendered.mirror.states.map((s) => `${s.key}:${s.state}:${s.evidenceScope}`);
}

console.log('\nTEMP-01 — 관계 경험 없음 + contact=5 → 시간 변화 문구 0');
{
  const { session } = await run({ session: { declared: { contact: 5 } } });
  const r = session.rendered;
  check(
    "contact 축이 CHANGE인데 scope는 'none'이다 (판정은 v1.43과 같다)",
    scopesOf(r).includes('contact:CHANGE:none'),
    scopesOf(r),
  );
  check('시간 변화 문구 0', temporalClaims(r).length === 0, temporalClaims(r));
  check(
    "연락 칩이 '경험 후 기준이 낮아짐'이 아니다 (NEW-003 관측 문장)",
    axisValue(r, '연락') === NEUTRAL_AXIS,
    axisValue(r, '연락'),
  );
  check(
    'Core summary가 반응이 있었다고 말하지 않는다',
    r.mirror.coreSummary === NEUTRAL_SUMMARY,
    r.mirror.coreSummary,
  );
  check(
    'Core headline이 답한 사실만 말한다',
    r.mirror.coreHeadline.includes('중요하게 여긴다고 답했어') &&
      r.mirror.coreHeadline.includes('비교할 근거가 없어'),
    r.mirror.coreHeadline,
  );
  /**
   * ⚠️ **이것이 NEW-003의 가장 나쁜 결과였다.** `mirror.core`가 non-null이 되면서
   * NEW-002가 세운 Home Hero의 neutral 상태를 **우회**했다 — 관계 경험을 하나도 답하지
   * 않은 사용자의 Hero에 근거 없는 비교 서술이 다시 떴다.
   */
  check(
    'Home Hero가 NEW-002 neutral 상태로 돌아온다',
    r.hero.completed === NEUTRAL_SUMMARY,
    r.hero.completed,
  );
  check(
    '근거 칸과 노트가 같은 말을 한다 — 한 행이 서로 반대되는 말을 하지 않는다',
    r.mirror.states[0].relationshipSignal.includes('꼽지는 않았어') &&
      r.mirror.states[0].note.includes('아직 확인하지 못했으니'),
    r.mirror.states[0],
  );
}

console.log('\nTEMP-02 — 관계 경험 없음 + contact=1 → 시간 변화 문구 0');
{
  const { session } = await run({ session: { declared: { contact: 1 } } });
  const r = session.rendered;
  check('낮은 declared는 애초에 판정되지 않는다 (UNKNOWN)', r.mirror.insightCount === 0, scopesOf(r));
  check('시간 변화 문구 0', temporalClaims(r).length === 0, temporalClaims(r));
  check('세 축 모두 중립', new Set(r.highlights.map((i) => i.value)).size === 1, r.highlights);
}

console.log('\nTEMP-03 — past/current 비교 근거 0 → 시제 어휘 전수 0');
{
  /** declared 5축을 모두 높게 답해도 관계 근거가 없으면 시제 주장은 0이어야 한다 */
  const { session } = await run({
    session: {
      declared: { contact: 5, alone: 5, conflict: 'now', affection: 'a3', hobby: 'h3' },
    },
  });
  const r = session.rendered;
  check(
    "모든 판정의 scope가 'none'이다",
    r.mirror.states.every((s) => s.evidenceScope === 'none'),
    scopesOf(r),
  );
  check('판정 자체는 생성된다 — 지우는 것이 아니다', r.mirror.insightCount > 0, r.mirror.insightCount);
  check('시간 변화 문구 0', temporalClaims(r).length === 0, temporalClaims(r));
  check(
    '모든 노트가 비교 불가를 명시한다',
    r.mirror.states.every((s) => s.note.includes('비교는 하지 않을게')),
    r.mirror.states.map((s) => s.note),
  );
  /**
   * ⚠️ 갈등 칩은 `declared.conflict`를 직접 읽으므로 `now`를 답하면 그 문구가 남는다 —
   * **시제 주장이 아니라 답한 사실**이다. NEW-002가 세운 규칙 그대로다.
   */
  check(
    '연락·취미는 중립이고, 갈등은 답한 사실을 그대로 쓴다',
    axisValue(r, '연락') === NEUTRAL_AXIS &&
      axisValue(r, '취미') === NEUTRAL_AXIS &&
      axisValue(r, '갈등') === '빠른 해결 선호',
    r.highlights,
  );
}

console.log('\nTEMP-04 — 실제 비교 근거 존재 → 기존 시간 변화 표현 유지');
{
  const { session } = await run({
    session: {
      declared: { contact: 2, alone: 5, conflict: 'now' },
      experience: { important: ['contact', 'alone'], hardest: 'contact_drop' },
    },
  });
  const r = session.rendered;
  check(
    "alone은 scope 'past' MATCH다 — 비교할 두 시점이 실제로 있다",
    scopesOf(r).includes('alone:MATCH:past'),
    scopesOf(r),
  );
  /**
   * ⚠️ 이 문장은 v1.0부터 있던 것이고 **한 글자도 바꾸지 않았다.** 근거가 과거 경험인
   * 사용자에게는 `경험 …`이 사실이다. 일괄 삭제하지 않는다는 것이 NEW-003 수정의 절반이다.
   */
  const aloneNote = r.mirror.states.find((s) => s.key === 'alone')?.note;
  check(
    "과거 근거 MATCH 문구가 그대로다 ('실제 관계에서도 꾸준히 중요했어')",
    aloneNote === '혼자 있는 시간은 실제 관계에서도 꾸준히 중요했어.',
    aloneNote,
  );
  const contactNote = r.mirror.states.find((s) => s.key === 'contact')?.note;
  check(
    '과거 근거 GAP 문구가 그대로다',
    contactNote === '중요하지 않다고 생각했지만 관계에서는 생각보다 크게 반응했어.',
    contactNote,
  );
  check("연락 칩이 GAP 문구를 유지한다", axisValue(r, '연락') === '생각보다 중요한 신호', axisValue(r, '연락'));
  check("갈등 칩이 declared 기반 문구를 유지한다", axisValue(r, '갈등') === '빠른 해결 선호', axisValue(r, '갈등'));
  /** 같은 세션 안에서 scope 'none'인 축은 안전한 문구를 쓴다 — 축마다 따로 판단한다 */
  const conflictInsight = r.mirror.states.find((s) => s.key === 'conflict');
  check(
    "같은 세션의 scope 'none' 축만 새 문구를 쓴다",
    conflictInsight?.evidenceScope === 'none' && conflictInsight.note.includes('비교는 하지 않을게'),
    conflictInsight,
  );
}

console.log('\nTEMP-04d — 정당한 시간 비교 표현은 **살아 있어야** 한다');
{
  /**
   * ⚠️ **일괄 삭제가 아니라는 것을 여기서 증명한다.**
   *
   * `이전 관계에서 연락을 중요했던 요소로 꼽음` + `declared.contact = 4`는 서로 다른 두
   * 시점의 실제 근거가 둘 다 있는 유일한 종류의 상태다. 그 사용자에게는
   * `경험 전후가 비슷했어`가 **사실**이므로 v1.0의 문장이 그대로 남아야 한다.
   *
   * 이 검사가 없으면 "시제 어휘 0건"만 보는 fixture를 만족시키는 가장 쉬운 방법이
   * **모든 시제 문장을 지우는 것**이 된다 — 그건 NEW-003 수정이 아니라 기능 삭제다.
   */
  const { session } = await run({
    session: { declared: { contact: 4 }, experience: { important: ['contact'] } },
  });
  const r = session.rendered;
  check("contact가 scope 'past' MATCH다", scopesOf(r).includes('contact:MATCH:past'), scopesOf(r));
  const note = r.mirror.states.find((s) => s.key === 'contact')?.note;
  check(
    "v1.0의 시간 비교 문구가 그대로 살아 있다 ('경험 전후가 비슷했어')",
    note === '연락에 대한 기준은 경험 전후가 비슷했어.',
    note,
  );
  check(
    '근거가 있는 시제 표현은 TEMPORAL_PHRASES에 걸려도 정상이다',
    temporalClaims(r).some((text) => text.includes('경험 전후')),
    temporalClaims(r),
  );
  check(
    '연락 칩도 MATCH 문구를 유지한다',
    axisValue(r, '연락') === '기준이 비슷하게 유지됨',
    axisValue(r, '연락'),
  );
}

console.log("\nTEMP-04b — scope 'current' 근거는 v1.41 문구를 유지한다 (내가 한 번 깨뜨린 자리)");
{
  /**
   * ⚠️ 이 케이스는 **수정 중에 실제로 회귀가 났던 자리**다. `buildSummary`에
   * `hasTemporalComparison`(= `'past'`만)을 쓰면 `지금 관계에서 자주 그런다`고 **직접
   * 답한** 사용자의 GAP 요약까지 `정보가 조금 더 필요해`로 바뀐다. 술어를
   * `hasRelationshipEvidence`로 고쳐서 닫았고, 다시 깨지지 않게 고정한다.
   */
  const { session } = await run({
    session: { declared: { alone: 1 }, currentRelationship: { signals: { alone: 'often' } } },
  });
  const r = session.rendered;
  check("scope가 'current'다", scopesOf(r).includes('alone:GAP:current'), scopesOf(r));
  check(
    '사용자가 직접 답한 근거의 요약은 중립으로 바뀌지 않는다',
    r.mirror.coreSummary === '개인 시간에 대해 말한 기준과 실제 관계에서의 반응이 조금 달랐어.',
    r.mirror.coreSummary,
  );
  check('시간 변화 문구 0', temporalClaims(r).length === 0, temporalClaims(r));
}

console.log("\nTEMP-04c — scope 'current' CHANGE 칩은 v1.41 문구를 재사용한다");
{
  const { session } = await run({
    session: { declared: { contact: 5 }, currentRelationship: { signals: { contact: 'rarely' } } },
  });
  const r = session.rendered;
  check("scope가 'current' CHANGE다", scopesOf(r).includes('contact:CHANGE:current'), scopesOf(r));
  check(
    "연락 칩이 '지금은 크게 드러나지 않음'이다 — 새 카피를 만들지 않았다",
    axisValue(r, '연락') === '지금은 크게 드러나지 않음',
    axisValue(r, '연락'),
  );
  check('시간 변화 문구 0', temporalClaims(r).length === 0, temporalClaims(r));
}

console.log('\nTEMP-06 — Fresh Home은 NEW-002 neutral 상태를 유지한다');
{
  const { session } = await run({ session: EMPTY_SESSION });
  const r = session.rendered;
  check('시간 변화 문구 0', temporalClaims(r).length === 0, temporalClaims(r));
  check('확정형 관찰 0', noAssertion(r).length === 0, noAssertion(r));
  check('Hero 중립 유지', r.hero.completed === NEUTRAL_SUMMARY, r.hero.completed);
  check('세 축 중립 유지', new Set(r.highlights.map((i) => i.value)).size === 1, r.highlights);
}

console.log('\nTEMP-05 — 시제 문장은 allowlist(scope past)로만 나간다 (정적)');
{
  /**
   * TEMP-01~04는 **런타임 동작**을 고정한다. 이 절은 **그 동작이 나오는 이유**를 고정한다:
   * scope 분기가 `!== 'current'`(blocklist)가 아니라 `=== 'past'`(allowlist)여야 한다.
   * blocklist로 되돌아가면 다음에 scope가 하나 늘 때 같은 결함이 조용히 재발한다.
   */
  const codeOnly = (text) =>
    text
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('//');
      })
      .join('\n');

  const evidence = codeOnly(
    await readFile(join(ROOT, 'src', 'lib', 'logic', 'relationshipEvidence.ts'), 'utf8'),
  );
  check(
    "hasTemporalComparison이 allowlist('past')로 정의된다",
    /export function hasTemporalComparison[\s\S]{0,120}scope === 'past'/.test(evidence),
  );
  check(
    "hasRelationshipEvidence가 'none'만 제외한다",
    /export function hasRelationshipEvidence[\s\S]{0,120}scope !== 'none'/.test(evidence),
  );

  const mirror = codeOnly(await readFile(join(ROOT, 'src', 'lib', 'logic', 'mirror.ts'), 'utf8'));
  check('noteFor가 MIRROR_NOTE 앞에서 술어를 통과시킨다', mirror.includes('if (!hasTemporalComparison(scope))'));
  check('buildHeadline이 술어로 과거형을 막는다', mirror.includes('!hasTemporalComparison(focus.evidenceScope)'));
  check(
    'buildSummary는 반응의 존재를 묻는 술어를 쓴다',
    mirror.includes('!hasRelationshipEvidence(focus.evidenceScope)'),
  );

  const profile = codeOnly(await readFile(join(ROOT, 'src', 'lib', 'logic', 'profile.ts'), 'utf8'));
  check('Home 칩이 changeChipOf를 통과한다', profile.includes('changeChipOf(contact,') && profile.includes('changeChipOf(hobby,'));
  check(
    'changeChipOf가 세 scope를 모두 다룬다',
    /function changeChipOf[\s\S]{0,400}hasTemporalComparison[\s\S]{0,200}'current'[\s\S]{0,200}NO_EVIDENCE_COPY\.axis/.test(
      profile,
    ),
  );

  const row = codeOnly(
    await readFile(join(ROOT, 'src', 'components', 'mirror', 'MirrorComparisonRow.tsx'), 'utf8'),
  );
  check('스크린리더 문구도 술어를 통과한다', row.includes('!hasTemporalComparison(insight.evidenceScope)'));

  const cross = codeOnly(
    await readFile(join(ROOT, 'src', 'lib', 'logic', 'crossSourceInsights.ts'), 'utf8'),
  );
  check('crossSource ruleSummary가 술어를 통과한다', cross.includes('hasRelationshipEvidence(insight.evidenceScope)'));

  const resolver = codeOnly(await readFile(join(ROOT, 'src', 'lib', 'aiEvidenceResolver.ts'), 'utf8'));
  check(
    'Premium 근거 목록이 History와 같은 어휘를 쓴다 — 한쪽만 고치면 두 화면이 갈린다',
    resolver.includes('historyStatePhraseOf(snapshot)') &&
      resolver.includes("snapshot.evidenceScope === 'none'"),
  );

  const history = codeOnly(await readFile(join(ROOT, 'src', 'lib', 'logic', 'history.ts'), 'utf8'));
  check("History 스냅샷이 'none' 갈래를 갖는다", history.includes("snapshot?.evidenceScope === 'none'"));
  check(
    'legacy 스냅샷(필드 없음)은 기존 문구를 그대로 쓴다 — undefined는 어느 갈래도 잡지 않는다',
    history.includes('return STATE_PHRASE[state];'),
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TEMP-DISPLAY-01~05 · R-9 — 내부 판정과 표시 이름을 분리한다
   ══════════════════════════════════════════════════════════════════════════

   NEW-003은 시제 **문장**을 닫았다. 그런데 화면에는 상태 **이름 자체**가 찍히는 자리가
   있었고, `CHANGE`라는 단어가 그대로 temporal change claim이었다. 실측:

   ```
   연락  [CHANGE]                                       ← 배지
         이전 관계에서 연락을 특별히 중요한 요소로 꼽지는 않았어  ← 근거
         연락: 말한 나 5점. 비교할 관계 근거 없음.               ← 스크린리더
   ```

   > **내부 state는 언제나 CHANGE다. 바뀌는 것은 그것을 부르는 이름뿐이다.**
   ══════════════════════════════════════════════════════════════════════════ */

/** 사용자에게 노출되면 안 되는 변화 주장 토큰 */
const CHANGE_WORDS = ['CHANGE', '변화', '달라진', '달라졌'];

console.log('\nTEMP-DISPLAY-01 — CHANGE + none → visible CHANGE/변화 claim 0');
{
  const { session } = await run({
    session: {
      declared: { contact: 5, alone: 5, conflict: 'now', affection: 'a3', hobby: 'h3' },
    },
  });
  const states = session.rendered.mirror.states;
  check(
    "모든 축이 scope 'none'이다",
    states.every((s) => s.evidenceScope === 'none'),
    states.map((s) => `${s.key}:${s.evidenceScope}`),
  );
  check(
    "표시 이름에 'CHANGE'가 하나도 없다",
    states.every((s) => s.displayState !== 'CHANGE'),
    states.map((s) => `${s.key}:${s.displayState}`),
  );
  check(
    "표시 이름이 기존 멤버 'UNKNOWN'이다 — 새 enum을 만들지 않았다",
    states.every((s) => s.displayState === 'UNKNOWN'),
    states.map((s) => s.displayState),
  );
  /**
   * 2차 guard — 표시 이름과 렌더 문자열 어디에도 변화 주장 어휘가 없어야 한다.
   * 1차는 위의 `displayState` 구조 검사다.
   */
  const shown = [...states.map((s) => s.displayState), ...session.rendered.strings];
  const leaked = shown.filter(
    (text) => typeof text === 'string' && CHANGE_WORDS.some((w) => text.includes(w)),
  );
  check('표시 이름·렌더 문자열에 변화 주장 어휘 0', leaked.length === 0, leaked);
}

console.log('\nTEMP-DISPLAY-02 — CHANGE + past → legitimate temporal wording 유지');
{
  /**
   * ⚠️ `CHANGE × past`는 `stateFor` 구조상 도달 불가다(QA §14.4에서 전수 측정). 그래서
   * 이 케이스는 표시 정책을 **직접** 호출해 고정한다 — 도달 불가라는 이유로 검사를
   * 빼면, 나중에 그 경로가 생겼을 때 조용히 중립화된다.
   */
  const { display } = await run({
    display: [
      { state: 'CHANGE', scope: 'past' },
      { state: 'MATCH', scope: 'past' },
      { state: 'GAP', scope: 'past' },
    ],
  });
  check(
    "CHANGE + past는 'CHANGE'로 남는다 — 비교할 두 시점이 실제로 있다",
    display[0].displayState === 'CHANGE',
    display[0],
  );
  check(
    'past의 MATCH/GAP도 그대로다',
    display[1].displayState === 'MATCH' && display[2].displayState === 'GAP',
    display,
  );

  /** 실제 과거 근거 세션에서도 표시 이름이 판정과 같은지 확인한다 */
  const { session } = await run({
    session: { declared: { contact: 4, alone: 5 }, experience: { important: ['contact', 'alone'] } },
  });
  const past = session.rendered.mirror.states.filter((s) => s.evidenceScope === 'past');
  check('과거 근거 축이 존재한다', past.length > 0, session.rendered.mirror.states);
  check(
    '과거 근거 축은 표시 이름이 판정과 같다',
    past.every((s) => s.displayState === s.state),
    past.map((s) => `${s.key}:${s.state}->${s.displayState}`),
  );
}

console.log("\nTEMP-DISPLAY-03 — CHANGE + current → v1.41 current-safe wording 유지");
{
  const { session } = await run({
    session: { declared: { contact: 5 }, currentRelationship: { signals: { contact: 'rarely' } } },
  });
  const contact = session.rendered.mirror.states.find((s) => s.key === 'contact');
  check("scope가 'current' CHANGE다", contact.evidenceScope === 'current' && contact.state === 'CHANGE', contact);
  /**
   * ⚠️ 정책대로 `'current'`의 표시는 **바꾸지 않는다.** v1.41이 이 scope에 비시간
   * 표현(노트·스크린리더·Home 칩)을 이미 만들어 뒀고, 그것을 유지하는 것이 이번 범위다.
   */
  check(
    "'current'의 표시 이름은 v1.41 상태 그대로 'CHANGE'다 (정책)",
    contact.displayState === 'CHANGE',
    contact.displayState,
  );
  check(
    "노트는 v1.41 비시간 표현을 유지한다",
    contact.note.includes('지금 관계에서는 그 장면이 크게 드러나지 않는다고 답했어'),
    contact.note,
  );
  check(
    "Home 칩도 v1.41 문구를 유지한다",
    axisValue(session.rendered, '연락') === '지금은 크게 드러나지 않음',
    axisValue(session.rendered, '연락'),
  );
}

console.log('\nTEMP-DISPLAY-04 — 내부 state / SavedState는 CHANGE 그대로');
{
  const { session } = await run({ session: { declared: { contact: 5 } } });
  const contact = session.rendered.mirror.states.find((s) => s.key === 'contact');
  /**
   * ⚠️ **이 검사가 R-9의 핵심이다.** 표시만 바꾸고 판정은 그대로여야 한다. 내부 state를
   * 건드리면 History Snapshot의 `SavedState`·비교 판정(`changeStateOf`)이 함께 움직이고
   * **저장된 기록의 의미가 소급해서 달라진다** — v1.41이 이름을 유지한 이유다.
   */
  check("내부 state는 여전히 'CHANGE'다", contact.state === 'CHANGE', contact.state);
  check("표시 이름만 달라진다", contact.displayState === 'UNKNOWN', contact.displayState);
  check(
    '판정 자체는 사라지지 않는다 — 축이 목록에서 빠지지 않았다',
    session.rendered.mirror.insightCount > 0,
    session.rendered.mirror.insightCount,
  );
}

console.log('\nTEMP-DISPLAY-05 — legacy History 스냅샷은 데이터·표시 회귀 0');
{
  /**
   * v1.40 이전 스냅샷에는 `evidenceScope` 필드가 **없다**(`undefined`). 그 기록의 화면이
   * 소급해서 달라지면 안 되므로 표시 정책은 `undefined`를 통과시킨다 —
   * `test:history` 100건이 그대로 회귀 기준으로 남는 근거다.
   */
  const { display } = await run({
    display: [
      { state: 'CHANGE' },
      { state: 'MATCH' },
      { state: 'GAP' },
      { state: 'CHANGE', scope: null },
    ],
  });
  check(
    'legacy 스냅샷(scope 필드 없음)의 CHANGE는 그대로 CHANGE다',
    display[0].displayState === 'CHANGE',
    display[0],
  );
  check(
    'legacy MATCH/GAP도 그대로다',
    display[1].displayState === 'MATCH' && display[2].displayState === 'GAP',
    display,
  );
  check(
    'scope가 null인 경우도 legacy와 같이 다룬다',
    display[3].displayState === 'CHANGE',
    display[3],
  );
}

console.log('\nTEMP-DISPLAY-06 — 표시 정책이 4개 소비처에 배선돼 있다 (정적)');
{
  const codeOnly = (text) =>
    text
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('//');
      })
      .join('\n');

  const mirror = codeOnly(await readFile(join(ROOT, 'src', 'lib', 'logic', 'mirror.ts'), 'utf8'));
  check(
    "displayStateOf가 legacy(undefined)를 먼저 통과시킨다",
    /export function displayStateOf[\s\S]{0,300}scope === undefined\) return state/.test(mirror),
  );
  check(
    "표시 이름은 기존 멤버 'UNKNOWN'을 쓴다 — 새 enum 0",
    /displayStateOf[\s\S]{0,400}'UNKNOWN'/.test(mirror),
  );

  const row = codeOnly(
    await readFile(join(ROOT, 'src', 'components', 'mirror', 'MirrorComparisonRow.tsx'), 'utf8'),
  );
  check('Mirror 행 배지가 표시 이름을 쓴다', row.includes('{shownState}') && row.includes('STATE_TAG[shownState]'));
  check('점·아이콘도 표시 이름을 쓴다', row.includes('STATE_DOT[shownState]') && row.includes("shownState === 'CHANGE'"));
  check('내부 state를 배지에 직접 찍지 않는다', !row.includes('{insight.state}'));

  const home = codeOnly(await readFile(join(ROOT, 'src', 'app', 'home', 'page.tsx'), 'utf8'));
  check('Home 최근 분석 카드가 표시 정책을 통과한다', home.includes('displayStateOf(focus.state, focus.evidenceScope)'));

  const historyPage = codeOnly(
    await readFile(join(ROOT, 'src', 'app', 'history', '[id]', 'page.tsx'), 'utf8'),
  );
  check(
    'History 스냅샷 배지가 표시 정책을 통과한다',
    historyPage.includes('displayStateOf(snapshot.state, snapshot.evidenceScope)'),
  );
  check('History가 내부 state를 배지에 직접 찍지 않는다', !historyPage.includes('{snapshot.state}'));

  const share = codeOnly(
    await readFile(join(ROOT, 'src', 'app', 'share', 'mirror', 'page.tsx'), 'utf8'),
  );
  check(
    '공유 카드 헤드라인이 시제 술어를 통과한다',
    share.includes('hasTemporalComparison(focus.evidenceScope)'),
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TEMP-AI-01~06 · R-11 — AI headline 소비 게이트
   ══════════════════════════════════════════════════════════════════════════

   > **AI_OUTPUT은 deterministic evidence boundary를 넘을 수 없다.**

   NEW-003이 결정론 headline을 닫았지만 `/mirror`의 우선순위는
   `coreCorrection || aiHeadline || core.headline`이라 **AI가 성공하면 그 수정이 가려졌다.**
   실측(`mode: 'real'`): focus 축 `CHANGE`·`scope 'none'`에서 모델이
   `연락의 중요성이 가장 두드러진 변화로 보여`를 냈고, 그 문장이 History
   `coreInsightOriginal`로 저장돼 `/home` 카드에 다시 나왔다.

   ⚠️ **AI 요청·프롬프트·promptVersion·스캐너·캐시는 건드리지 않았다.** 모델은 계속 같은
   답을 만든다 — 바뀐 것은 **소비자가 그 답을 쓸지**뿐이다.
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nTEMP-AI-01 — CHANGE + scope none → aiHeadline 미사용 · temporal claim 0');
{
  const { session } = await run({ session: { declared: { contact: 5 } } });
  const focus = session.rendered.mirror.focus;
  check("focus가 CHANGE + scope 'none'이다", focus.state === 'CHANGE' && focus.evidenceScope === 'none', focus);
  check('AI headline을 소비하지 않는다', focus.canUseAiHeadline === false, focus);
  /**
   * 폴백 대상은 NEW-003에서 안전해진 결정론 headline이다. 그것까지 함께 고정해야
   * '가리지 않는다'는 검사가 의미를 갖는다.
   */
  check(
    '폴백되는 결정론 headline이 시제를 주장하지 않는다',
    session.rendered.mirror.coreHeadline.includes('비교할 근거가 없어'),
    session.rendered.mirror.coreHeadline,
  );
  check('렌더 문자열 전체에 시간 변화 문구 0', temporalClaims(session.rendered).length === 0, temporalClaims(session.rendered));
}

console.log('\nTEMP-AI-02 — CHANGE + valid temporal evidence → aiHeadline 정상 사용 가능');
{
  /**
   * ⚠️ `CHANGE × past`는 `stateFor` 구조상 도달 불가다(QA §14.4 전수 측정). 그래서
   * 술어를 **직접** 고정한다 — 도달 불가라는 이유로 검사를 빼면, 나중에 그 경로가
   * 생겼을 때 정당한 AI 문장이 조용히 버려진다.
   */
  const { display } = await run({ display: [{ state: 'CHANGE', scope: 'past' }] });
  check(
    "CHANGE + past는 표시 이름이 'CHANGE'로 남는다 (같은 근거 판단)",
    display[0].displayState === 'CHANGE',
    display[0],
  );

  /** scope 'current'는 시간 비교 근거가 아니므로 함께 막힌다 */
  const { session } = await run({
    session: { declared: { contact: 5 }, currentRelationship: { signals: { contact: 'rarely' } } },
  });
  const focus = session.rendered.mirror.focus;
  check("focus가 CHANGE + scope 'current'다", focus.state === 'CHANGE' && focus.evidenceScope === 'current', focus);
  check(
    "'current'도 시간 비교 근거가 아니라 소비하지 않는다",
    focus.canUseAiHeadline === false,
    focus,
  );
}

console.log('\nTEMP-AI-03 — 일반 MATCH/GAP → 기존 AI headline 회귀 없음');
{
  /**
   * ⚠️ **이 검사가 R-11 수정의 안전선이다.** 게이트를 상태와 무관하게 걸면
   * MATCH/GAP focus의 AI headline까지 사라진다 — 그건 결함 수정이 아니라 기능 삭제다.
   */
  const gap = await run({
    session: {
      declared: { contact: 2 },
      experience: { important: ['contact'], hardest: 'contact_drop' },
    },
  });
  check("GAP focus다", gap.session.rendered.mirror.focus.state === 'GAP', gap.session.rendered.mirror.focus);
  check(
    'GAP은 AI headline을 그대로 쓸 수 있다',
    gap.session.rendered.mirror.focus.canUseAiHeadline === true,
    gap.session.rendered.mirror.focus,
  );

  const match = await run({
    session: { declared: { alone: 5 }, experience: { important: ['alone'] } },
  });
  check("MATCH focus다", match.session.rendered.mirror.focus.state === 'MATCH', match.session.rendered.mirror.focus);
  check(
    'MATCH도 AI headline을 그대로 쓸 수 있다',
    match.session.rendered.mirror.focus.canUseAiHeadline === true,
    match.session.rendered.mirror.focus,
  );

  const gapCurrent = await run({
    session: { declared: { alone: 1 }, currentRelationship: { signals: { alone: 'often' } } },
  });
  check(
    "scope 'current'의 GAP도 막히지 않는다 — 상태로만 판단한다",
    gapCurrent.session.rendered.mirror.focus.state === 'GAP' &&
      gapCurrent.session.rendered.mirror.focus.canUseAiHeadline === true,
    gapCurrent.session.rendered.mirror.focus,
  );
}

console.log('\nTEMP-AI-04 — coreCorrection은 여전히 최우선');
{
  /**
   * 게이트는 `aiHeadline`만 막는다. 우선순위 자체
   * (`coreCorrection || aiHeadline || core.headline`)는 손대지 않았으므로 사용자가 고친
   * 문장은 두 경우 모두 이긴다.
   */
  const withCorrection = await run({
    hero: { coreCorrection: '내가 고친 문장이야.', profileCompleted: true, mirrorSummary: '실제 요약' },
  });
  check(
    'coreCorrection이 있으면 언제나 이긴다',
    withCorrection.hero.summary === '내가 고친 문장이야.',
    withCorrection.hero.summary,
  );
  const codeOnly = (text) =>
    text
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('//');
      })
      .join('\n');
  const page = codeOnly(await readFile(join(ROOT, 'src', 'app', 'mirror', 'page.tsx'), 'utf8'));
  check(
    'headline 우선순위가 그대로다 — coreCorrection이 첫 번째',
    page.includes('answers.coreCorrection.trim() || aiHeadline || mirror.core.headline'),
  );
}

console.log('\nTEMP-AI-05 — History 저장: unsafe AI headline이 original로 저장되지 않는다');
{
  const codeOnly = (text) =>
    text
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('//');
      })
      .join('\n');
  const page = codeOnly(await readFile(join(ROOT, 'src', 'app', 'mirror', 'page.tsx'), 'utf8'));
  /**
   * 저장 경로는 **같은 `aiHeadline` 변수**를 읽는다. 게이트를 그 변수 한 곳에 두었기
   * 때문에 화면과 기록이 갈릴 수 없다 — 두 곳에 각각 두면 언젠가 한쪽만 고쳐진다.
   */
  check(
    'coreInsightOriginal이 게이트된 aiHeadline을 읽고 결정론 headline으로 폴백한다',
    page.includes('coreInsightOriginal: aiHeadline ?? mirror.core?.headline'),
  );
  check(
    'coreInsightAiMeta도 같은 변수에 매여 있다 — headline 없이 meta만 남지 않는다',
    page.includes('aiHeadline && aiMeta'),
  );
  check('게이트가 aiHeadline memo 안에 있다 (단일 지점)', page.includes('if (!canUseAiHeadline(focus)) return null;'));
}

console.log('\nTEMP-AI-06 — 게이트가 AI 계약을 건드리지 않는다 (정적)');
{
  const codeOnly = (text) =>
    text
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('//');
      })
      .join('\n');
  const mirrorLogic = codeOnly(await readFile(join(ROOT, 'src', 'lib', 'logic', 'mirror.ts'), 'utf8'));
  /**
   * ⚠️ R-12에서 이 규칙이 `aiMayClaimChange`로 옮겨졌다(Core headline과 축 서술이 같은
   * 술어를 공유한다). 검사도 규칙을 따라간다 — 인라인 본문을 고정하면 정당한 리팩터에
   * 실패한다. 위임 관계는 TEMP-AI-AXIS-06이 함께 고정한다.
   */
  check(
    '규칙이 상태와 scope만 본다 — 요청·캐시·프롬프트를 모르는 순수 술어다',
    /function aiMayClaimChange[\s\S]{0,220}state !== 'CHANGE' \|\| hasTemporalComparison/.test(mirrorLogic) &&
      /export function canUseAiHeadline[\s\S]{0,80}aiMayClaimChange/.test(mirrorLogic),
  );
  const page = codeOnly(await readFile(join(ROOT, 'src', 'app', 'mirror', 'page.tsx'), 'utf8'));
  check(
    'AI 요청 훅 호출은 그대로다 — 조건부로 만들지 않았다',
    page.includes('const narrative = useRelationshipNarrative();'),
  );
  check(
    '기존 근거 경계 검사(evidenceRefs)도 그대로 남아 있다',
    page.includes('resolveEvidenceRefs(core.evidenceRefs, evidenceContext).length === 0'),
  );

  const versions = await readFile(join(ROOT, 'src', 'services', 'ai', 'promptVersions.ts'), 'utf8');
  check(
    'promptVersion 상수가 v1.43 값 그대로다',
    versions.includes('relationship-v7-evidence'),
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TEMP-AI-AXIS-01~06 · R-12 — 축별 AI 서술 소비 게이트
   ══════════════════════════════════════════════════════════════════════════

   R-9는 배지를, R-11은 Core headline을 닫았다. 같은 행에 하나가 더 남아 있었다:

   ```
   연락  [UNKNOWN]  아직 확인 전                                ← R-9
         연락을 중요하게 여긴다고 답했어. … 비교는 하지 않을게.   ← 결정론(NEW-003)
         러비가 이렇게 봤어
         이 부분에서 변화가 있을 수 있어.                       ← ❌ R-12가 닫는다
   ```

   **한 행이 스스로를 반박했다.** 결정론 노트는 '비교하지 않는다'고 말하고 바로 아래
   AI 문장은 변화가 있을 수 있다고 말했다.

   ⚠️ **결정론 노트는 지우지 않는다.** 사라지는 것은 AI 문장 하나뿐이다.
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nTEMP-AI-AXIS-01 — CHANGE + scope none → AI 축 서술 0 · 결정론 노트 유지');
{
  const { session } = await run({
    session: {
      declared: { contact: 5, alone: 5, conflict: 'now', affection: 'a3', hobby: 'h3' },
    },
  });
  const states = session.rendered.mirror.states;
  check(
    "모든 축이 CHANGE + scope 'none'이다",
    states.every((s) => s.state === 'CHANGE' && s.evidenceScope === 'none'),
    states.map((s) => `${s.key}:${s.state}:${s.evidenceScope}`),
  );
  check(
    'AI 축 서술을 소비하지 않는다',
    states.every((s) => s.canUseAiAxisNarrative === false),
    states.map((s) => `${s.key}:${s.canUseAiAxisNarrative}`),
  );
  /**
   * ⚠️ **이 검사가 R-12의 안전선이다.** 게이트가 결정론 노트까지 지우면 그 행은 '무엇을
   * 답했고 왜 비교할 수 없는지'를 말할 자리를 잃는다 — 결함 수정이 아니라 정보 삭제다.
   */
  check(
    '결정론 노트는 그대로 남는다',
    states.every((s) => s.note.includes('비교는 하지 않을게')),
    states.map((s) => s.note),
  );
  check(
    '표시 이름도 R-9 상태 그대로다 (UNKNOWN)',
    states.every((s) => s.displayState === 'UNKNOWN'),
    states.map((s) => s.displayState),
  );
}

console.log("\nTEMP-AI-AXIS-02 — CHANGE + scope current → 시간 비교 근거 없음 → AI 축 서술 0");
{
  const { session } = await run({
    session: { declared: { contact: 5 }, currentRelationship: { signals: { contact: 'rarely' } } },
  });
  const contact = session.rendered.mirror.states.find((s) => s.key === 'contact');
  check(
    "CHANGE + scope 'current'다",
    contact.state === 'CHANGE' && contact.evidenceScope === 'current',
    contact,
  );
  check(
    "'current'는 시간 비교 근거가 아니라 AI 축 서술을 소비하지 않는다",
    contact.canUseAiAxisNarrative === false,
    contact,
  );
  /** v1.41이 이 scope에 만들어 둔 결정론 문장은 그대로 남는다 */
  check(
    'v1.41 결정론 노트는 유지된다',
    contact.note.includes('지금 관계에서는 그 장면이 크게 드러나지 않는다고 답했어'),
    contact.note,
  );
}

console.log('\nTEMP-AI-AXIS-03 — CHANGE + valid past temporal evidence → AI 축 서술 사용 가능');
{
  /**
   * ⚠️ `CHANGE × past`는 `stateFor` 구조상 도달 불가다(QA §14.4 전수 측정). 술어를
   * **직접** 고정한다 — 도달 불가라는 이유로 검사를 빼면, 나중에 그 경로가 생겼을 때
   * 정당한 AI 문장이 조용히 버려진다.
   */
  const { display } = await run({ display: [{ state: 'CHANGE', scope: 'past' }] });
  check(
    "CHANGE + past는 표시 이름이 'CHANGE'로 남는다 (같은 근거 판단)",
    display[0].displayState === 'CHANGE',
    display[0],
  );
}

console.log('\nTEMP-AI-AXIS-04 — MATCH → 기존 AI 축 서술 유지');
{
  const { session } = await run({
    session: { declared: { alone: 5 }, experience: { important: ['alone'] } },
  });
  const alone = session.rendered.mirror.states.find((s) => s.key === 'alone');
  check('MATCH 축이다', alone.state === 'MATCH', alone);
  check('MATCH는 AI 축 서술을 그대로 쓸 수 있다', alone.canUseAiAxisNarrative === true, alone);

  const current = await run({
    session: { declared: { alone: 1 }, currentRelationship: { signals: { alone: 'rarely' } } },
  });
  const aloneCurrent = current.session.rendered.mirror.states.find((s) => s.key === 'alone');
  check(
    "scope 'current'의 MATCH도 막히지 않는다 — 상태로만 판단한다",
    aloneCurrent.state === 'MATCH' && aloneCurrent.canUseAiAxisNarrative === true,
    aloneCurrent,
  );
}

console.log('\nTEMP-AI-AXIS-05 — GAP → 기존 AI 축 서술 유지');
{
  const { session } = await run({
    session: {
      declared: { contact: 2 },
      experience: { important: ['contact'], hardest: 'contact_drop' },
    },
  });
  const contact = session.rendered.mirror.states.find((s) => s.key === 'contact');
  check('GAP 축이다', contact.state === 'GAP', contact);
  check('GAP은 AI 축 서술을 그대로 쓸 수 있다', contact.canUseAiAxisNarrative === true, contact);

  const current = await run({
    session: { declared: { alone: 1 }, currentRelationship: { signals: { alone: 'often' } } },
  });
  const aloneCurrent = current.session.rendered.mirror.states.find((s) => s.key === 'alone');
  check(
    "scope 'current'의 GAP도 막히지 않는다",
    aloneCurrent.state === 'GAP' && aloneCurrent.canUseAiAxisNarrative === true,
    aloneCurrent,
  );
}

console.log('\nTEMP-AI-AXIS-06 — R-11 Core aiHeadline 게이트는 그대로 유지');
{
  const { session } = await run({ session: { declared: { contact: 5 } } });
  const focus = session.rendered.mirror.focus;
  check(
    'Core headline 게이트가 여전히 동작한다',
    focus.state === 'CHANGE' && focus.evidenceScope === 'none' && focus.canUseAiHeadline === false,
    focus,
  );
  const gap = await run({
    session: {
      declared: { contact: 2 },
      experience: { important: ['contact'], hardest: 'contact_drop' },
    },
  });
  check(
    'GAP focus의 Core headline은 여전히 AI를 쓸 수 있다',
    gap.session.rendered.mirror.focus.canUseAiHeadline === true,
    gap.session.rendered.mirror.focus,
  );

  const codeOnly = (text) =>
    text
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('//');
      })
      .join('\n');

  const logic = codeOnly(await readFile(join(ROOT, 'src', 'lib', 'logic', 'mirror.ts'), 'utf8'));
  /**
   * ⚠️ 두 게이트가 **같은 술어 하나**를 쓴다. 조건을 두 곳에 적으면 언젠가 한쪽만
   * 고쳐지고, 그때 같은 화면이 두 기준으로 판단한다 — v1.44가 반복해서 만난 실패 형태다.
   */
  check(
    '두 게이트가 같은 술어(aiMayClaimChange)에 위임한다',
    /function aiMayClaimChange[\s\S]{0,220}state !== 'CHANGE' \|\| hasTemporalComparison/.test(logic) &&
      /canUseAiHeadline[\s\S]{0,80}aiMayClaimChange\(focus\)/.test(logic) &&
      /canUseAiAxisNarrative[\s\S]{0,80}aiMayClaimChange\(insight\)/.test(logic),
  );

  const page = codeOnly(await readFile(join(ROOT, 'src', 'app', 'mirror', 'page.tsx'), 'utf8'));
  check(
    '축 서술 게이트가 렌더 자리에 배선돼 있다',
    page.includes('canUseAiAxisNarrative(insight) ? ('),
  );
  /**
   * ⚠️ R-11은 `core.headline`만 닫았고 `CoreInsightNarrativeView`가 렌더하는
   * `core.summary`는 **같은 객체의 다른 필드**라 게이트를 받지 않았다. 축 서술을 막은
   * 뒤에도 Core 카드에 시제 문장이 남는 것을 실측으로 잡았다 — 두 자리를 함께 고정한다.
   */
  check(
    'Core AI 서술 본문도 같은 게이트를 통과한다',
    page.includes('canUseAiAxisNarrative(focusInsight) ? narrative.data?.core : undefined'),
  );
  check('Core headline 게이트도 그대로다', page.includes('if (!canUseAiHeadline(focus)) return null;'));
  check(
    '결정론 노트는 게이트 밖이다 — 축 행은 계속 note를 렌더한다',
    codeOnly(
      await readFile(join(ROOT, 'src', 'components', 'mirror', 'MirrorComparisonRow.tsx'), 'utf8'),
    ).includes('{insight.note}'),
  );
  check(
    'AI 요청·프롬프트 버전은 그대로다',
    page.includes('const narrative = useRelationshipNarrative();') &&
      (await readFile(join(ROOT, 'src', 'services', 'ai', 'promptVersions.ts'), 'utf8')).includes(
        'relationship-v7-evidence',
      ),
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

console.log(`\n${'─'.repeat(72)}`);
if (failures.length === 0) {
  console.log(`✅ Trust Boundary Fixture — ${pass} checks passed`);
  process.exit(0);
}
console.log(`❌ ${failures.length} failed / ${pass} passed`);
for (const failure of failures) console.log(`  · ${failure.label}`);
process.exit(1);
