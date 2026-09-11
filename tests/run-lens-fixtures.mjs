/**
 * Premium Relationship Lens Fixture — LENS-01~20 · VALUE-01~07 · SAJU-CALC (v1.46 PremiumLens)
 *
 * ══ 이 스크립트가 고정하는 것 ═══════════════════════════════════════════════
 *
 * v1.46 PremiumLens가 지키기로 한 약속은 네 문장이다:
 *
 * > **한 번 열면 넷 다 열린다. 가격은 한 번만 보인다.**
 * > **없는 데이터로 렌즈를 만들지 않는다.**
 * > **렌즈는 동기화율·Mirror·History 판정을 건드리지 않는다.**
 * > **운명·상대 속마음·성공 확률을 말하지 않는다.**
 *
 * 넷 다 "분량이 늘었는가"로는 검사할 수 없다. 그래서 1차 판정은 전부 **구조화된 값**
 * (mode · 섹션 수 · 테마 수 · basis 행)이고, 금지 어휘 스캔은 2차 guard로만 쓴다 —
 * v1.40.1이 배운 순서 그대로다.
 *
 * ⚠️ **판정 로직을 여기서 복제하지 않는다.** `/api/dev/premium-test`가 화면·훅과 같은
 * 함수를 호출하고, 이 스크립트는 fixture 조립과 검증만 한다.
 *
 * ⚠️ 일부 검사는 **소스 스캔**이다(LENS-01 · LENS-02 · LENS-11 · LENS-12 · LENS-19).
 * "번들이 하나의 상품인가" · "렌즈가 판정 엔진에 닿지 않는가"는 런타임 출력이 아니라
 * **의존 관계**의 성질이라, 값을 아무리 봐도 증명되지 않는다. `run-relationship-evidence`의
 * TC5(파서 ≡ 타입 parity)와 같은 방식이다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:lens`
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

const src = (relative) => readFile(join(ROOT, relative), 'utf8');

/* ── 공통 세션 ─────────────────────────────────────────────────────────────
   고데이터 세션 하나를 정의하고 나머지 fixture는 여기서 **한 가지만** 뺀다.
   그래야 "이 렌즈가 self로 내려간 이유가 그 데이터 때문"이라고 말할 수 있다. */

const DECLARED = { contact: 5, conflict: 'soon', alone: 4, affection: 'a2', hobby: 'h2' };
const EXPERIENCE = {
  important: ['contact', 'alone', 'conflict'],
  hardest: 'contact_drop',
  selfGap: 'yes',
  adaptive: { axis: 'contact', optionId: 'disconnect' },
};

/**
 * 검증된 생년월일 두 개.
 *
 * ⚠️ 아무 날짜나 쓰지 않았다. 아래 SAJU-CALC가 실제 만세력과 대조한 날짜들이고,
 * 그래서 이 fixture의 일주 값은 **정답을 아는 값**이다.
 *
 * ```
 * 1995-08-12 → 을해(乙亥)   일간 을 = 목
 * 1990-05-15 → 경진(庚辰)   일간 경 = 금
 * ```
 *
 * 목과 금은 금극목 관계라 pair 판정이 `they_control`(내 일간을 상대가 극)로 나온다 —
 * 다섯 관계 중 가장 오독되기 쉬운 자리를 기본 fixture로 삼았다(LENS-15가 여기를 본다).
 */
const SELF_BIRTH = { date: '1995-08-12', calendarType: 'solar', time: null, timeUnknown: false };
const TARGET_BIRTH = { date: '1990-05-15', calendarType: 'solar', time: null, timeUnknown: false };

const TARGET = {
  relation: 'crush',
  contact: 'l',
  conflict: 'h',
  alone: 'h',
  affection: 'm',
  mbti: 'ENFP',
  birthProfile: TARGET_BIRTH,
  preferences: { interests: [] },
};

const NO_TARGET = {
  relation: null,
  contact: 'x',
  conflict: 'x',
  alone: 'x',
  affection: 'x',
  mbti: null,
  birthProfile: { date: null, calendarType: 'solar', time: null, timeUnknown: false },
  preferences: { interests: [] },
};

const EVENTS = [
  {
    id: 'evt-lens-1',
    type: 'contact_change',
    description: '답장 간격이 하루 정도 길어졌어',
    myReaction: '괜히 내가 뭘 잘못했나 생각했어',
  },
];

const BASE = {
  status: 'dating',
  declared: DECLARED,
  experience: EXPERIENCE,
  mbti: 'INFP',
  birthProfile: SELF_BIRTH,
};

const lensOf = (result, kind) => result.report.lensBundle.lenses.find((l) => l.kind === kind);

/** 사용자에게 실제로 보이는 문자열 전부. 금지 어휘 스캔의 표면이다 */
function lensStrings(bundle) {
  const out = [];
  for (const lens of bundle.lenses) {
    out.push(lens.label);
    if (lens.mode === 'unavailable') {
      out.push(lens.reason);
      continue;
    }
    out.push(lens.headline, lens.overview, lens.checkpoint, lens.disclaimer);
    for (const section of lens.sections) {
      out.push(section.title, section.body);
      if (section.reportedEventLine) out.push(section.reportedEventLine);
    }
    for (const row of lens.basis) out.push(`${row.label} ${row.value}`);
    out.push(...lens.limitations);
  }
  if (bundle.crossLens) {
    out.push(
      ...bundle.crossLens.repeatedThemes,
      ...bundle.crossLens.differences,
      ...bundle.crossLens.verificationQuestions,
      bundle.crossLens.note,
    );
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════ */

console.log('\n═══ Premium Relationship Lens Fixture (v1.46) ═══\n');

/* ── SAJU-CALC · 일주 계산이 실제 만세력과 맞는가 ────────────────────────
   ⚠️ **이 블록이 사주 렌즈 전체의 신뢰다.** offset이 하루라도 어긋나면 아래 모든
   결과가 조용히 틀린 채로 통과한다. 값은 만세력 실측이다(엔진 파일 상단 참고). */

console.log('SAJU-CALC · 일주 계산 (만세력 대조)');
{
  const engine = await src('src/lib/logic/sajuPillars.ts');
  check(
    'SAJU-CALC-01 60갑자 offset 상수가 검증된 값(+49)이다',
    /const SEXAGENARY_OFFSET = 49;/.test(engine),
    engine.match(/const SEXAGENARY_OFFSET = .*/)?.[0],
  );
  check(
    'SAJU-CALC-02 기준점 검증 근거가 소스에 남아 있다',
    engine.includes('2024-01-01') && engine.includes('1990-05-15'),
  );

  // 라우트를 통해 실제 계산 결과를 확인한다 — 여기서 산술을 복제하지 않는다.
  const r = await run({ ...BASE, target: TARGET });
  const saju = lensOf(r, 'saju');
  const mineRow = saju.basis.find((row) => row.label === '내 일주');
  const theirsRow = saju.basis.find((row) => row.label === '상대 일주');
  check(
    'SAJU-CALC-03 1995-08-12 → 을해(乙亥)',
    mineRow?.value.includes('을해(乙亥)'),
    mineRow?.value,
  );
  check(
    'SAJU-CALC-04 1990-05-15 → 경진(庚辰)',
    theirsRow?.value.includes('경진(庚辰)'),
    theirsRow?.value,
  );
}

/* ── LENS-01 / LENS-02 · Bundle 구조 (소스 스캔) ─────────────────────────── */

console.log('\nLENS-01~02 · Premium Bundle 단일 상품');
{
  const paywall = await src('src/app/premium/page.tsx');
  const featureMap = paywall.slice(
    paywall.indexOf('const FEATURE_BY_SOURCE'),
    paywall.indexOf('const BACK_BY_SOURCE'),
  );
  const lensSources = ['mbti', 'astrology', 'saju'];
  check(
    'LENS-01 mbti·astrology·saju source가 모두 relationship_deep_report를 가리킨다',
    lensSources.every((s) =>
      new RegExp(`^\\s*${s}: 'relationship_deep_report',`, 'm').test(featureMap),
    ),
    lensSources.map((s) => featureMap.match(new RegExp(`^\\s*${s}: '.*'`, 'm'))?.[0]),
  );
  check(
    'LENS-01b 개별 렌즈 상세(mbti_detail/astrology_detail/saju_detail)를 파는 진입점이 0이다',
    !/premiumFeatureState\('(mbti|astrology|saju)_detail'/.test(
      (await src('src/app/lens/mbti/page.tsx')) +
        (await src('src/app/lens/astrology/page.tsx')) +
        (await src('src/app/lens/saju/page.tsx')),
    ),
  );

  const bundle = await src('src/components/premium/HomePremiumBundle.tsx');
  /**
   * LENS-02 — 가격 렌더는 `formatPrice(price)` 한 번뿐이어야 한다.
   * 렌즈 버튼 3개에 가격이 들어가면 여기 개수가 늘어난다.
   */
  const priceRenders = bundle.match(/formatPrice\(/g) ?? [];
  check('LENS-02 Home Bundle에서 가격 렌더가 정확히 1회', priceRenders.length === 1, priceRenders.length);
  const lensSection = await src('src/components/premium/PremiumLensSection.tsx');
  check(
    'LENS-02b Lens 결과 섹션에는 가격이 아예 없다',
    !/formatPrice|₩|resolvePrice/.test(lensSection),
  );
}

/* ── LENS-03~10 · 렌즈별 독립 mode 판정 ─────────────────────────────────── */

console.log('\nLENS-03~10 · 렌즈별 독립 mode 판정');
{
  const full = await run({ ...BASE, target: TARGET });
  check('LENS-03 MBTI Target O → pair', lensOf(full, 'mbti').mode === 'pair');
  check('LENS-06 사주 양쪽 양력 생년월일 → pair', lensOf(full, 'saju').mode === 'pair');
  check('LENS-08 별자리 양쪽 생년월일 → pair', lensOf(full, 'zodiac').mode === 'pair');

  const solo = await run({ ...BASE, target: NO_TARGET });
  check('LENS-04 MBTI Target X → self', lensOf(solo, 'mbti').mode === 'self');
  check('LENS-04b 사주 Target X → self', lensOf(solo, 'saju').mode === 'self');
  check('LENS-04c 별자리 Target X → self', lensOf(solo, 'zodiac').mode === 'self');

  const noSelfMbti = await run({ ...BASE, mbti: null, target: TARGET });
  check('LENS-05 self MBTI 없음 → unavailable', lensOf(noSelfMbti, 'mbti').mode === 'unavailable');
  check(
    'LENS-05b unavailable 사유가 무엇을 하면 되는지 말한다',
    lensOf(noSelfMbti, 'mbti').reason.includes('입력'),
    lensOf(noSelfMbti, 'mbti').reason,
  );
  check(
    'LENS-05c self MBTI가 없어도 사주·별자리는 그대로 pair다 (렌즈 독립 판정)',
    lensOf(noSelfMbti, 'saju').mode === 'pair' && lensOf(noSelfMbti, 'zodiac').mode === 'pair',
  );

  const noSelfBirth = await run({
    ...BASE,
    birthProfile: { date: null, calendarType: 'solar', time: null, timeUnknown: false },
    target: TARGET,
  });
  check(
    'LENS-05d self 생년월일 없음 → 사주·별자리 unavailable',
    lensOf(noSelfBirth, 'saju').mode === 'unavailable' &&
      lensOf(noSelfBirth, 'zodiac').mode === 'unavailable',
  );
  check('LENS-05e 그래도 MBTI는 pair다', lensOf(noSelfBirth, 'mbti').mode === 'pair');

  /**
   * LENS-07 — 출생 시간이 없어도 시간이 필요한 해석을 만들지 않는다.
   *
   * ⚠️ `시주`라는 낱말 자체를 금지할 수는 없다 — 이 렌즈는 **시주를 세우지 않는다는
   * 사실**을 사용자에게 말해야 하고, 그러려면 그 단어를 써야 한다. 그래서 검사는
   * '단어가 있는가'가 아니라 **모든 등장이 부정 문맥 안에 있는가**를 본다.
   */
  const saju = lensOf(full, 'saju');
  const sajuStrings = [
    saju.headline,
    saju.overview,
    saju.checkpoint,
    ...saju.sections.map((s) => s.body),
    ...saju.basis.map((r) => r.value),
    ...saju.limitations,
  ];
  const NEGATED = /(세우지 않|계산하지 않|미계산|필요해서|볼 수 없|영향이 없)/;
  const sajuTimeClaims = sajuStrings
    .flatMap((text) => text.split(/(?<=[.?!])\s+|\n+/))
    .filter((sentence) => sentence.includes('시주') && !NEGATED.test(sentence));
  check('LENS-07 출생 시간 없음 → 시주를 세운 문장이 0', sajuTimeClaims.length === 0, sajuTimeClaims);
  check(
    'LENS-07b 계산 범위(일주 1개)를 basis와 한계에 모두 명시한다',
    saju.basis.some((r) => r.value.includes('일주 1개')) &&
      saju.limitations.some((l) => l.includes('일주(日柱) 하나만')),
  );

  /** LENS-09 — 달·상승궁을 만들지 않는다 */
  const zodiac = lensOf(full, 'zodiac');
  const zodiacText = [zodiac.headline, zodiac.overview, ...zodiac.sections.map((s) => s.body)].join(
    ' ',
  );
  check(
    'LENS-09 Rising/Moon 결과를 만들지 않는다 (계산하지 않는다는 언급만 허용)',
    !/상승궁(?!은|·|\s*미계산)/.test(zodiacText) || zodiacText.includes('계산하지 않'),
  );
  check(
    'LENS-09b 계산 범위(태양궁만)를 basis에 명시한다',
    zodiac.basis.some((r) => r.value.includes('태양궁만')),
  );

  /** LENS-10 — 상대는 있는데 그 렌즈의 상대 데이터만 없을 때 */
  const targetNoMbti = await run({ ...BASE, target: { ...TARGET, mbti: null } });
  check('LENS-10 Target 있음 + 상대 MBTI 없음 → MBTI만 self', lensOf(targetNoMbti, 'mbti').mode === 'self');
  check(
    'LENS-10b 같은 세션에서 사주·별자리는 여전히 pair다',
    lensOf(targetNoMbti, 'saju').mode === 'pair' && lensOf(targetNoMbti, 'zodiac').mode === 'pair',
  );

  const targetNoBirth = await run({
    ...BASE,
    target: {
      ...TARGET,
      birthProfile: { date: null, calendarType: 'solar', time: null, timeUnknown: false },
    },
  });
  check(
    'LENS-10c Target 있음 + 상대 생년월일 없음 → 사주·별자리만 self',
    lensOf(targetNoBirth, 'saju').mode === 'self' && lensOf(targetNoBirth, 'zodiac').mode === 'self',
  );
  check('LENS-10d 그래도 MBTI는 pair다', lensOf(targetNoBirth, 'mbti').mode === 'pair');

  /** 음력 — 환산표가 없으므로 양력처럼 계산하지 않는다 */
  const lunar = await run({
    ...BASE,
    birthProfile: { ...SELF_BIRTH, calendarType: 'lunar' },
    target: TARGET,
  });
  check('LENS-06b 음력 입력 → 사주 unavailable (양력처럼 계산하지 않는다)', lensOf(lunar, 'saju').mode === 'unavailable');
  check(
    'LENS-06c 음력 사유가 이유를 정확히 말한다',
    lensOf(lunar, 'saju').reason.includes('음력'),
    lensOf(lunar, 'saju').reason,
  );
  check(
    'LENS-06d 음력이어도 별자리는 태양궁을 계산한다 (같은 날짜 문자열을 쓰므로)',
    lensOf(lunar, 'zodiac').mode === 'pair',
  );
}

/* ── LENS-08b · 별자리 원소쌍 표가 6쌍 전부를 덮는가 ────────────────────── */

console.log('\nLENS-08b · 별자리 원소쌍 표 완전성');
{
  /**
   * ⚠️ 이 검사가 없어서 v1.4부터 **6쌍 중 3쌍이 조용히 비어 있었다.**
   * `ELEMENT_PAIR_TOPIC`의 key는 정렬되지 않은 순서였고 호출부는 `sort()`로 key를
   * 만들어서, `불 × 흙`이 화면에 `불과 흙으로 원소가 달라. `로 **문장이 끊긴 채** 나갔다
   * (v1.46 브라우저 실측에서 발견). 무료 별자리 렌즈에도 같은 결함이 있었다.
   */
  const zodiacSrc = await src('src/data/zodiac.ts');
  const table = zodiacSrc.slice(
    zodiacSrc.indexOf('ELEMENT_PAIR_TOPIC'),
    zodiacSrc.indexOf('interface ZodiacNote'),
  );
  const elements = ['air', 'earth', 'fire', 'water'];
  const missing = [];
  for (let i = 0; i < elements.length; i += 1) {
    for (let j = i + 1; j < elements.length; j += 1) {
      const key = [elements[i], elements[j]].sort().join('|');
      if (!new RegExp(`'${key}':\s*'[^']+'`).test(table)) missing.push(key);
    }
  }
  check(
    'LENS-08b 원소쌍 6개가 모두 정렬된 key로 존재하고 값이 비어 있지 않다',
    missing.length === 0,
    missing,
  );

  // 실제 렌더 결과에서도 문장이 끊기지 않는지 본다 (사자자리 불 × 황소자리 흙)
  const zr = await run({ ...BASE, target: TARGET });
  const zl = lensOf(zr, 'zodiac');
  const firstPara = zl.sections
    .find((sec) => sec.id === 'zodiac_element_modality')
    .body.split('\n\n')[0];
  check(
    'LENS-08c 원소가 다를 때 본문이 빈 문장으로 끝나지 않는다',
    !/원소가 달라\.\s*$/.test(firstPara),
    firstPara,
  );
}

/* ── LENS-11 / LENS-12 · Core 판정에 영향 0 (소스 스캔) ──────────────────── */

console.log('\nLENS-11~12 · Core 판정 영향 0');
{
  /**
   * ⚠️ 값 비교로는 증명되지 않는다. "렌즈가 점수를 바꾸지 않았다"는 이번 fixture에서
   * 우연히 그런 것일 수 있다. **판정 엔진이 렌즈를 import할 수 없다**는 것이 증명이다.
   */
  const judgementFiles = [
    'src/lib/logic/compatibility.ts',
    'src/lib/logic/mirror.ts',
    'src/lib/logic/history.ts',
    'src/lib/logic/crossSourceInsights.ts',
    'src/lib/logic/premiumChapters.ts',
  ];
  const banned = ['premiumLens', 'sajuPillars', "data/saju", "data/premiumLens"];
  for (const file of judgementFiles) {
    const text = await src(file);
    const hit = banned.filter((token) => text.includes(token));
    check(`LENS-11 ${file.split('/').pop()} 가 렌즈 모듈을 import하지 않는다`, hit.length === 0, hit);
  }

  /** 실측 대조도 함께 한다 — 렌즈가 있을 때와 없을 때 점수·판정이 같아야 한다 */
  const withLens = await run({ ...BASE, target: TARGET });
  const withoutLens = await run({
    ...BASE,
    mbti: null,
    birthProfile: { date: null, calendarType: 'solar', time: null, timeUnknown: false },
    target: { ...TARGET, mbti: null, birthProfile: { date: null, calendarType: 'solar', time: null, timeUnknown: false } },
  });
  check(
    'LENS-11b 렌즈 3종이 전부 unavailable이 되어도 동기화율 dimension 수가 같다',
    withLens.free.axisTotal === withoutLens.free.axisTotal,
  );
  check(
    'LENS-12 렌즈 유무와 무관하게 무료 Mirror 단위 수가 같다',
    withLens.free.mirrorUnits.length === withoutLens.free.mirrorUnits.length,
    [withLens.free.mirrorUnits.length, withoutLens.free.mirrorUnits.length],
  );
  check(
    'LENS-12b 렌즈가 available·chapters를 늘리지 않는다',
    withLens.report.available === withoutLens.report.available,
  );
}

/* ── LENS-13 · user_reported_event attribution ──────────────────────────── */

console.log('\nLENS-13 · 사용자 보고 사건 attribution');
{
  const withEvent = await run({ ...BASE, target: { ...TARGET, events: EVENTS } });
  const bundle = withEvent.report.lensBundle;
  const tied = bundle.lenses
    .filter((l) => l.mode !== 'unavailable')
    .flatMap((l) => l.sections)
    .filter((s) => s.reportedEventId);

  check('LENS-13 사건이 있으면 렌즈 섹션이 그것을 참조한다', tied.length >= 1, tied.length);
  check(
    'LENS-13b 참조한 id가 실제 사건 id다 (지어낸 id 0)',
    tied.every((s) => EVENTS.some((e) => e.id === s.reportedEventId)),
  );
  check(
    'LENS-13c 인용 문장이 항상 `네가 알려준 장면`으로 출처를 남긴다',
    tied.every((s) => s.reportedEventLine?.startsWith('네가 알려준 장면')),
    tied.map((s) => s.reportedEventLine?.slice(0, 20)),
  );
  check(
    'LENS-13d 인용 문장이 상대 의도로 확정하지 않는다',
    tied.every((s) => s.reportedEventLine?.includes('알 수 없어')),
  );

  const noEvent = await run({ ...BASE, target: TARGET });
  const untied = noEvent.report.lensBundle.lenses
    .filter((l) => l.mode !== 'unavailable')
    .flatMap((l) => l.sections)
    .filter((s) => s.reportedEventId);
  check('LENS-13e 사건이 없으면 사건 참조가 0이다', untied.length === 0, untied.length);
}

/* ── LENS-14 / LENS-15 · 금지 주장 ──────────────────────────────────────── */

console.log('\nLENS-14~15 · Trust / 금지 주장');
{
  const sessions = [
    ['pair', await run({ ...BASE, target: { ...TARGET, events: EVENTS } })],
    ['self', await run({ ...BASE, target: NO_TARGET })],
    ['ended', await run({ ...BASE, status: 'ended', target: { ...TARGET, events: EVENTS } })],
  ];

  /** §35 v1.45 Trust 목록 + §47 사주/별자리 위험 문구 */
  const FORBIDDEN = [
    '상대가 너를 좋아해',
    '마음이 식었',
    '밀당',
    '일부러 연락을 줄였',
    '회피형이',
    '운명',
    '천생연분',
    '상극이라',
    '결혼운',
    '결혼할 사람',
    '배우자 운',
    '연애운',
    '재회운',
    '바람기',
    '외도',
    '성공 확률',
    '헤어질 가능성',
    '궁합 점수',
  ];

  for (const [name, result] of sessions) {
    const strings = lensStrings(result.report.lensBundle);
    const hits = [];
    for (const text of strings) {
      for (const word of FORBIDDEN) {
        if (text.includes(word)) hits.push({ word, text: text.slice(0, 60) });
      }
    }
    check(`LENS-15 [${name}] 운명·예측·상대 속마음 주장 0`, hits.length === 0, hits);
  }

  /**
   * LENS-14 — 상대의 **의도**를 주장하지 않는다.
   *
   * ⚠️ `상대가`로 시작하는 문장 자체를 금지할 수는 없다 — 사주 pair 렌즈는
   * `상대 일간이 …로 읽혀`라고 말해야 한다. 금지되는 것은 **의도·감정 동사**다.
   */
  const INTENT = ['상대는 …라고 생각', '상대가 원하', '상대는 원하', '상대가 느끼', '상대는 느끼', '상대의 진심'];
  for (const [name, result] of sessions) {
    const strings = lensStrings(result.report.lensBundle);
    const hits = strings.filter((t) => INTENT.some((w) => t.includes(w)));
    check(`LENS-14 [${name}] 상대 의도·감정 단정 0`, hits.length === 0, hits.map((h) => h.slice(0, 60)));
  }

  /** 극(剋)을 '상극'으로 팔지 않는다 — 이 렌즈에서 가장 오독되기 쉬운 자리 */
  const pair = lensOf(sessions[0][1], 'saju');
  const together = pair.sections.find((s) => s.id === 'saju_together');
  check(
    'LENS-15b 극(剋) 관계를 좋고 나쁨으로 말하지 않는다',
    !together.body.includes('상극') &&
      (!together.body.includes('극(剋)') || together.body.includes('나쁨이 아니라')),
    together.body.slice(0, 120),
  );
}

/* ── LENS-16 / LENS-17 · Cross-Lens ─────────────────────────────────────── */

console.log('\nLENS-16~17 · Cross-Lens');
{
  const three = await run({ ...BASE, target: TARGET });
  check('LENS-16 렌즈 3개 → Cross-Lens 있음', three.report.lensBundle.crossLens !== null);
  check('LENS-16b lensCount가 실제 렌즈 수와 같다', three.report.lensBundle.crossLens.lensCount === 3);

  const two = await run({ ...BASE, mbti: null, target: TARGET });
  check('LENS-16c 렌즈 2개 → Cross-Lens 있음', two.report.lensBundle.crossLens !== null);
  check('LENS-16d lensCount = 2', two.report.lensBundle.crossLens.lensCount === 2);

  const one = await run({
    ...BASE,
    mbti: null,
    birthProfile: { ...SELF_BIRTH, calendarType: 'lunar' },
    target: TARGET,
  });
  check(
    'LENS-16e 렌즈 1개 → Cross-Lens 없음',
    one.report.lensBundle.availableCount === 1 && one.report.lensBundle.crossLens === null,
    one.report.lensBundle.availableCount,
  );

  const cross = three.report.lensBundle.crossLens;
  check(
    'LENS-17 Cross-Lens를 "근거 N개"로 표현하지 않는다',
    ![...cross.repeatedThemes, ...cross.differences, cross.note].some((t) =>
      /근거\s*\d|근거가 일치|증거 \d/.test(t),
    ),
  );
  check(
    'LENS-17b note가 "독립적인 증거가 아니다"를 명시한다 (필수 필드)',
    typeof cross.note === 'string' && cross.note.length > 0 && /증거|확인/.test(cross.note),
    cross.note,
  );
  check(
    'LENS-17c 확인 질문이 2~3개다',
    cross.verificationQuestions.length >= 2 && cross.verificationQuestions.length <= 3,
    cross.verificationQuestions.length,
  );
  check(
    'LENS-17e 고유 테마가 있으면 "다르게 말하는 부분"이 비지 않는다',
    cross.differences.length > 0,
    cross.differences,
  );
  check(
    'LENS-17d 어느 렌즈가 맞는지 판단하지 않는다',
    !cross.differences.some((t) => /맞는 쪽은|더 정확|이 렌즈가 맞/.test(t)),
    cross.differences,
  );
}

/* ── LENS-18 · basis는 실제 계산 결과만 ─────────────────────────────────── */

console.log('\nLENS-18 · basis(왜 이렇게 봤어?)');
{
  const result = await run({ ...BASE, target: { ...TARGET, events: EVENTS } });
  for (const lens of result.report.lensBundle.lenses) {
    if (lens.mode === 'unavailable') continue;
    check(
      `LENS-18 [${lens.kind}] basis가 2행 이상이고 전부 라벨+값을 갖는다`,
      lens.basis.length >= 2 && lens.basis.every((r) => r.label && r.value),
      lens.basis,
    );
    check(
      `LENS-18b [${lens.kind}] basis에 raw debug JSON이 없다`,
      !lens.basis.some((r) => /[{}[\]]|null|undefined/.test(r.value)),
      lens.basis.map((r) => r.value),
    );
  }
}

/* ── LENS-19 / LENS-20 · AI 비의존 · 재진입 ─────────────────────────────── */

console.log('\nLENS-19~20 · AI 실패 내성 · 재진입');
{
  /**
   * LENS-19 — 이 fixture는 `narratives`를 넘기지 않는다. 즉 **AI 실패 상태**다.
   * 그 상태에서 렌즈 3종이 그대로 완결돼야 한다.
   */
  const noAi = await run({ ...BASE, target: TARGET });
  check(
    'LENS-19 AI narrative 없이도 렌즈 3종이 전부 결과를 만든다',
    noAi.report.lensBundle.availableCount === 3,
    noAi.report.lensBundle.availableCount,
  );

  const engine = await src('src/lib/logic/premiumLens.ts');
  check(
    'LENS-19b 렌즈 엔진이 AI를 부르지 않는다 (provider call 0)',
    !/aiClient|requestAi|fetch\(|services\/ai/.test(engine),
  );

  /** 같은 입력이면 같은 결과 — 재진입·새로고침에서 렌즈가 달라지지 않는다 */
  const again = await run({ ...BASE, target: TARGET });
  check(
    'LENS-20 같은 입력 재실행 → 렌즈 결과가 완전히 동일하다',
    JSON.stringify(noAi.report.lensBundle) === JSON.stringify(again.report.lensBundle),
  );
}

/* ── VALUE-01~07 · 결과 밀도와 문장 품질 ────────────────────────────────── */

console.log('\nVALUE-01~07 · 유료 가치 기준');
{
  const pairResult = await run({ ...BASE, target: { ...TARGET, events: EVENTS } });
  const selfResult = await run({ ...BASE, target: NO_TARGET });
  const pairLenses = pairResult.report.lensBundle.lenses.filter((l) => l.mode !== 'unavailable');
  const selfLenses = selfResult.report.lensBundle.lenses.filter((l) => l.mode !== 'unavailable');

  for (const lens of [...pairLenses, ...selfLenses]) {
    const titles = lens.sections.map((s) => s.title);
    check(
      `VALUE-01 [${lens.kind}/${lens.mode}] 섹션 제목 중복 0`,
      new Set(titles).size === titles.length,
      titles,
    );
    const ids = lens.sections.map((s) => s.id);
    check(`VALUE-01b [${lens.kind}/${lens.mode}] 섹션 id 중복 0`, new Set(ids).size === ids.length, ids);
  }

  /** VALUE-02 — 세 렌즈가 같은 body를 반복하지 않는다 */
  const allBodies = pairLenses.flatMap((l) => l.sections.map((s) => s.body));
  check(
    'VALUE-02 렌즈 3종 사이에 동일한 body 문단 0',
    new Set(allBodies).size === allBodies.length,
    allBodies.length - new Set(allBodies).size,
  );
  const headlines = pairLenses.map((l) => l.headline);
  check('VALUE-02b 렌즈 3종의 headline이 서로 다르다', new Set(headlines).size === headlines.length);
  const overviews = pairLenses.map((l) => l.overview);
  check('VALUE-02c 렌즈 3종의 overview가 서로 다르다', new Set(overviews).size === overviews.length);

  /** VALUE-03 / VALUE-04 — 밀도 (§29). filler를 만들지 않으면서 이 수를 넘겨야 한다 */
  for (const lens of pairLenses) {
    check(
      `VALUE-03 [${lens.kind}] Target O · substantive section 4개 이상`,
      lens.sections.length >= 4,
      lens.sections.length,
    );
    check(`VALUE-03b [${lens.kind}] headline·overview·checkpoint가 모두 있다`,
      Boolean(lens.headline && lens.overview && lens.checkpoint));
  }
  for (const lens of selfLenses) {
    check(
      `VALUE-04 [${lens.kind}] Target X · self section 3개 이상 + 불확실성 1개`,
      lens.sections.length >= 4,
      lens.sections.length,
    );
    const hasUncertainty = lens.sections.some((s) => /알 수 없|모르는|확인/.test(s.title + s.body));
    check(`VALUE-04b [${lens.kind}] 불확실성·검증 섹션이 있다`, hasUncertainty);
  }

  /** VALUE-05 — §27이 실패로 규정한 generic filler */
  const GENERIC = [
    '서로 대화를 많이 해보는 게 좋아',
    '서로 이해하는 게 중요해',
    '차이를 존중하면 좋아',
    '솔직한 대화가 필요해',
  ];
  const everyString = [
    ...lensStrings(pairResult.report.lensBundle),
    ...lensStrings(selfResult.report.lensBundle),
  ];
  const genericHits = everyString.filter((t) => GENERIC.some((g) => t.includes(g)));
  check('VALUE-05 generic filler 문장 0', genericHits.length === 0, genericHits);

  /** VALUE-06 — checkpoint는 실제로 해볼 수 있는 동사를 갖는다 */
  const ACTION_VERB = /(확인해봐|맞춰봐|물어봐|말해봐|정해봐|떠올려봐|기억해둬|되짚어봐|골라)/;
  for (const lens of [...pairLenses, ...selfLenses]) {
    check(
      `VALUE-06 [${lens.kind}/${lens.mode}] checkpoint에 실행 동사가 있다`,
      ACTION_VERB.test(lens.checkpoint),
      lens.checkpoint,
    );
  }
  const cross = pairResult.report.lensBundle.crossLens;
  check(
    'VALUE-06b Cross-Lens 확인 질문 전부에 실행 동사가 있다',
    cross.verificationQuestions.every((q) => ACTION_VERB.test(q)),
    cross.verificationQuestions,
  );

  /** VALUE-07 — basis에는 실제 source만 (지어낸 값 0) */
  const mbti = pairLenses.find((l) => l.kind === 'mbti');
  check(
    'VALUE-07 MBTI basis가 실제 입력값(INFP·ENFP)을 그대로 보여준다',
    mbti.basis.some((r) => r.value === 'INFP') && mbti.basis.some((r) => r.value === 'ENFP'),
    mbti.basis,
  );
  const zodiacLens = pairLenses.find((l) => l.kind === 'zodiac');
  check(
    'VALUE-07b 별자리 basis가 원소·양태까지 보여준다',
    zodiacLens.basis.some((r) => /·.*·/.test(r.value)),
    zodiacLens.basis,
  );

  /** §31 — disclaimer는 짧은 한 줄이다. 경고문 블록으로 커지지 않는다 */
  for (const lens of pairLenses) {
    check(
      `VALUE-07c [${lens.kind}] disclaimer가 한 줄(60자 이하)이다`,
      lens.disclaimer.length <= 60,
      lens.disclaimer.length,
    );
  }
}
/* ══════════════════════════════════════════════════════════════════════
   AI-LENS-01 ~ AI-LENS-20 · 렌즈별 AI 해석 (v1.46 AI Lens · §33)

   ══ 왜 이 20개가 대부분 소스 스캔인가 ═══════════════════════════════════

   이 섹션이 고정하려는 것은 **문장의 품질이 아니라 구조**다:

   > 렌즈마다 독립적으로 부른다 · 하나가 실패해도 나머지가 산다 ·
   > Cross-Lens는 렌즈 뒤에 온다 · 안 바뀐 렌즈는 다시 부르지 않는다 ·
   > 없는 데이터를 말하면 버린다 · deep-report 계약은 그대로다

   전부 **호출 그래프와 캐시 키의 성질**이라 출력값을 아무리 봐도 증명되지 않는다.
   같은 판단으로 `run-relationship-evidence`의 TC0~TC6도 소스 스캔이고, 이 파일의
   LENS-01·02·11·12·19도 그렇다.

   ⚠️ **실제 모델이 규칙을 지키는가는 여기서 검사하지 않는다.** 그건
   `npm run test:ai:e2e`가 진짜 Provider로 한다(AI-LENS-08~12의 런타임 근거).
   소스 스캔은 "규칙이 코드에 있는가"까지이고, 그 둘을 섞으면 어느 쪽도 증명되지 않는다.
   ══════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════
   PARTIAL-01 ~ PARTIAL-08 · 상대는 있는데 정보가 부족한 경우 (v1.46.1 §1~§4)

   고정하는 invariant는 한 줄이다:

   > **상대가 있다 ≠ 이 렌즈의 상대 데이터가 있다.**

   두 상태 모두 결과는 Self Lens지만 **할 말이 다르다.** mode만 보면 구분되지
   않으므로 `selfReason`을 함께 보고, 화면 문자열이 실제로 갈리는지까지 본다.
   ══════════════════════════════════════════════════════════════════════ */
console.log('\nPARTIAL-01 ~ PARTIAL-08 — Target 부분정보 (v1.46.1)');
{
  /** 이름(관계)만 아는 상대 — MBTI도 생년월일도 모른다 */
  const NAME_ONLY_TARGET = {
    ...NO_TARGET,
    relation: 'crush',
  };
  /** MBTI만 아는 상대 — 생년월일은 모른다 */
  const MBTI_ONLY_TARGET = {
    ...NO_TARGET,
    relation: 'crush',
    mbti: 'ENFP',
  };

  const nameOnly = await run({ ...BASE, target: NAME_ONLY_TARGET });
  const mbtiOnly = await run({ ...BASE, target: MBTI_ONLY_TARGET });
  const noTarget = await run({ ...BASE, target: NO_TARGET });

  /* ── PARTIAL-01 · 이름만 아는 상대 → 세 렌즈 전부 self + 이유가 붙는다 ── */
  for (const kind of ['mbti', 'saju', 'zodiac']) {
    const lens = lensOf(nameOnly, kind);
    check(
      `PARTIAL-01 [${kind}] 상대 정보가 없어도 Lens를 막지 않는다 (self로 제공)`,
      lens.mode === 'self',
      lens.mode,
    );
    check(
      `PARTIAL-01 [${kind}] self 사유가 'target_data_missing'이다`,
      lens.selfReason === 'target_data_missing',
      lens.selfReason,
    );
  }

  /* ── PARTIAL-02 · 상대가 있는데 '상대가 없어서'라고 말하지 않는다 ─────── */
  const nameOnlyText = lensStrings(nameOnly.report.lensBundle).join(' ');
  check(
    "PARTIAL-02 상대가 있는 사용자에게 '상대가 없어서/상대가 생기면'을 쓰지 않는다",
    !/상대(가|는)?\s*없어서|상대가\s*생기면|대상이\s*없/.test(nameOnlyText),
    nameOnlyText.match(/[^.]*상대(가|는)?\s*없어서[^.]*/)?.[0] ?? 'n/a',
  );
  check(
    'PARTIAL-02 대신 무엇을 모르는지 말한다',
    /아직\s*모르네|몰라서|모르니까/.test(nameOnlyText),
  );

  /* ── PARTIAL-03 · 상대가 없는 사용자는 기존 카피 그대로 ───────────────── */
  const noTargetText = lensStrings(noTarget.report.lensBundle).join(' ');
  check(
    'PARTIAL-03 상대가 없는 사용자에게는 상대가 생기면 볼 수 있다고 말한다',
    /상대가\s*생기면/.test(noTargetText),
  );
  check(
    "PARTIAL-03 두 상태의 카피가 실제로 다르다",
    noTargetText !== nameOnlyText,
  );
  for (const kind of ['mbti', 'saju', 'zodiac']) {
    check(
      `PARTIAL-03 [${kind}] 상대가 없으면 사유가 'no_target'이다`,
      lensOf(noTarget, kind).selfReason === 'no_target',
      lensOf(noTarget, kind).selfReason,
    );
  }

  /* ── PARTIAL-04 · 렌즈마다 독립 판정 (MBTI만 아는 상대) ───────────────── */
  check(
    'PARTIAL-04 상대 MBTI만 알면 MBTI는 pair, 나머지 둘은 self다',
    lensOf(mbtiOnly, 'mbti').mode === 'pair' &&
      lensOf(mbtiOnly, 'saju').mode === 'self' &&
      lensOf(mbtiOnly, 'zodiac').mode === 'self',
    ['mbti', 'saju', 'zodiac'].map((k) => `${k}:${lensOf(mbtiOnly, k).mode}`).join(' '),
  );
  check(
    'PARTIAL-04 pair가 된 렌즈에는 self 사유가 붙지 않는다',
    lensOf(mbtiOnly, 'mbti').selfReason === undefined,
    lensOf(mbtiOnly, 'mbti').selfReason,
  );
  check(
    'PARTIAL-04 self로 남은 두 렌즈는 target_data_missing이다',
    lensOf(mbtiOnly, 'saju').selfReason === 'target_data_missing' &&
      lensOf(mbtiOnly, 'zodiac').selfReason === 'target_data_missing',
  );

  /* ── PARTIAL-05 · 출생시간은 pair 차단 사유가 아니다 (§3) ─────────────── */
  const noTime = await run({
    ...BASE,
    birthProfile: { ...SELF_BIRTH, time: null, timeUnknown: true },
    target: { ...TARGET, birthProfile: { ...TARGET_BIRTH, time: null, timeUnknown: true } },
  });
  check(
    'PARTIAL-05 출생시간을 몰라도 사주·별자리가 pair로 나온다 (엔진이 쓰지 않는 값이다)',
    lensOf(noTime, 'saju').mode === 'pair' && lensOf(noTime, 'zodiac').mode === 'pair',
    `saju:${lensOf(noTime, 'saju').mode} zodiac:${lensOf(noTime, 'zodiac').mode}`,
  );
  check(
    "PARTIAL-05 '출생시간을 몰라서 비교를 못 한다'고 말하지 않는다",
    !/출생\s*시간.{0,20}(몰라|없어서).{0,20}(비교|못)/.test(
      lensStrings(noTime.report.lensBundle).join(' '),
    ),
  );

  /* ── PARTIAL-06 · 판정은 그대로 (Core 영향 0) ─────────────────────────── */
  check(
    'PARTIAL-06 동기화율이 렌즈 사유와 무관하게 그대로다',
    nameOnly.compatibility.score === noTarget.compatibility.score,
    `${nameOnly.compatibility.score} vs ${noTarget.compatibility.score}`,
  );
  check(
    'PARTIAL-06 Mirror 판정도 그대로다',
    JSON.stringify(nameOnly.mirrorStates) === JSON.stringify(noTarget.mirrorStates),
  );

  /* ── PARTIAL-07 · 정보 추가 안내는 한 번만, 부족할 때만 ───────────────── */
  const section = await src('src/components/premium/PremiumLensSection.tsx');
  check(
    'PARTIAL-07 안내 문구가 렌즈 묶음 아래 한 곳에서만 그려진다',
    (section.match(/LENS_TARGET_HINT/g) ?? []).length === 2,
    (section.match(/LENS_TARGET_HINT/g) ?? []).length,
  );
  check(
    'PARTIAL-07 그 안내는 target_data_missing일 때만 나온다',
    /selfReason === 'target_data_missing'/.test(section),
  );

  /* ── PARTIAL-09 · **상대가 없다는 이유로 Premium을 막지 않는다** ──────────
     ⚠️ 이 검사가 가리는 두 상태는 결과가 같아 보여서 자주 뒤섞인다:

       A  상대 없음 + 유료에서 쓸 근거 있음   → 자격 O (Self Lens까지 정상)
       B  상대 없음 + 무료가 이미 그 근거를 씀 → 자격 X (근거 때문이지 상대 때문이 아니다)

     B를 A의 증거로 읽으면 '상대 없으면 못 본다'는 결함이 정상으로 굳는다. */
  const soloEnough = await run({
    status: 'solo_new',
    declared: DECLARED,
    /** 관계 경험을 답하지 않았다 — 무료 Mirror가 아직 아무 축도 소비하지 않은 상태 */
    experience: { important: [], hardest: null, selfGap: null, note: '', skipped: true, adaptive: null },
    mbti: 'INFP',
    birthProfile: SELF_BIRTH,
    target: NO_TARGET,
  });
  check(
    'PARTIAL-09 (A) 상대가 없어도 근거가 있으면 Premium 자격이 선다',
    soloEnough.gate.eligible === true && soloEnough.report.available === true,
    soloEnough.gate,
  );
  check(
    'PARTIAL-09 (A) 그 리포트에 렌즈 3종이 self로 들어 있다',
    ['mbti', 'saju', 'zodiac'].every((kind) => lensOf(soloEnough, kind).mode === 'self'),
    ['mbti', 'saju', 'zodiac'].map((k) => `${k}:${lensOf(soloEnough, k).mode}`).join(' '),
  );

  const soloNotEnough = await run({ ...BASE, target: NO_TARGET });
  check(
    'PARTIAL-09 (B) 막힐 때는 무료가 이미 근거를 소비했기 때문이다 (상대 유무가 아니다)',
    soloNotEnough.gate.eligible === false && soloNotEnough.gate.mirrorInsightCount > 0,
    soloNotEnough.gate,
  );
  /**
   * 두 세션의 **차이는 상대가 아니다** — 둘 다 상대가 없다. 다른 것은 관계 경험뿐이고,
   * 그래서 자격이 갈린 원인이 근거라는 것이 값으로 드러난다.
   */
  check(
    'PARTIAL-09 두 세션 모두 상대가 없는데 자격이 갈린다 (원인은 근거다)',
    lensOf(soloEnough, 'mbti').selfReason === 'no_target' &&
      lensOf(soloNotEnough, 'mbti').selfReason === 'no_target' &&
      soloEnough.gate.eligible !== soloNotEnough.gate.eligible,
  );

  /* ── PARTIAL-10 · 자격 판정이 상대 관련 술어를 읽지 않는다 (소스 스캔) ─── */
  const chapters = await src('src/lib/logic/premiumChapters.ts');
  const gateBlock = chapters.slice(
    chapters.indexOf('export function hasPremiumEvidence'),
    chapters.indexOf('const MAX_CHAPTERS_PER_AXIS'),
  );
  check(
    'PARTIAL-10 hasPremiumEvidence가 hasTarget·targetExists·soloMode를 읽지 않는다',
    !/hasTarget|targetExists|soloMode|target\./.test(gateBlock),
    gateBlock.match(/hasTarget|targetExists|soloMode|target\./)?.[0] ?? 'clean',
  );
  check(
    'PARTIAL-10 자격 판정 파일 전체가 soloMode 판정을 import하지 않는다',
    !/from '@\/lib\/logic\/soloMode'/.test(chapters),
  );

  /* ── PARTIAL-08 · 모르는 값을 지어내지 않는다 ─────────────────────────── */
  check(
    'PARTIAL-08 상대 정보를 모르면 상대 칸에 추정값이 들어가지 않는다',
    ['mbti', 'saju', 'zodiac'].every((kind) => {
      const row = lensOf(nameOnly, kind).basis.find((r) => r.label.startsWith('상대'));
      return row !== undefined && /아직\s*모름/.test(row.value);
    }),
    ['mbti', 'saju', 'zodiac'].map(
      (k) => lensOf(nameOnly, k).basis.find((r) => r.label.startsWith('상대'))?.value,
    ),
  );
}

console.log('\nAI-LENS-01 ~ AI-LENS-20 — 렌즈별 AI 해석 (v1.46 AI Lens)');
{
  const lensAiData = await readFile(join(ROOT, 'src/data/premiumLensAi.ts'), 'utf8');
  const prompts = await readFile(join(ROOT, 'src/services/ai/promptTemplates.ts'), 'utf8');
  const handlers = await readFile(join(ROOT, 'src/services/ai/handlers.ts'), 'utf8');
  const safety = await readFile(join(ROOT, 'src/services/ai/safety.ts'), 'utf8');
  const schemas = await readFile(join(ROOT, 'src/services/ai/schemas.ts'), 'utf8');
  const builders = await readFile(join(ROOT, 'src/services/ai/contextBuilders.ts'), 'utf8');
  const orchestrator = await readFile(join(ROOT, 'src/hooks/usePremiumLensAi.ts'), 'utf8');
  const fingerprints = await readFile(join(ROOT, 'src/lib/aiFingerprint.ts'), 'utf8');
  const versions = await readFile(join(ROOT, 'src/services/ai/promptVersions.ts'), 'utf8');
  const contract = await readFile(join(ROOT, 'src/services/ai/taskContract.ts'), 'utf8');
  const client = await readFile(join(ROOT, 'src/services/ai/aiClient.ts'), 'utf8');

  /* ── AI-LENS-01 ~ 06 · 렌즈 × mode 조합 6개가 전부 정의돼 있다 ────────── */
  const MODE_UNITS = {
    'AI-LENS-01 MBTI pair': ['mbti_pair_rhythm', 'mbti_pair_misread', 'mbti_pair_verify'],
    'AI-LENS-02 MBTI self': ['mbti_self_energy', 'mbti_self_tension', 'mbti_self_verify'],
    'AI-LENS-03 사주 pair': ['saju_pair_mine', 'saju_pair_together', 'saju_pair_verify'],
    'AI-LENS-04 사주 self': ['saju_self_structure', 'saju_self_declared', 'saju_self_verify'],
    'AI-LENS-05 별자리 pair': ['zodiac_pair_style', 'zodiac_pair_misread', 'zodiac_pair_verify'],
    'AI-LENS-06 별자리 self': ['zodiac_self_theme', 'zodiac_self_declared', 'zodiac_self_verify'],
  };
  for (const [label, ids] of Object.entries(MODE_UNITS)) {
    check(
      `${label} unit 목록이 정의돼 있다`,
      ids.every((id) => lensAiData.includes(`'${id}'`)),
      ids.filter((id) => !lensAiData.includes(`'${id}'`)),
    );
  }
  /** 프롬프트와 파서가 **같은 상수에서** 목록을 만든다 — 손으로 다시 적으면 갈라진다 */
  check(
    'AI-LENS-01~06 허용 id가 프롬프트와 파서에서 같은 상수로 온다',
    /lensAiUnitsFor\(kind, mode\)/.test(prompts) && /lensAiUnitsFor\(kind, mode\)/.test(schemas),
    'lensAiUnitsFor를 양쪽에서 쓰지 않는다',
  );
  /** §27 — unit 4~6개. 채우려고 늘리지 않고, 줄이려고 4 밑으로 내리지도 않는다 */
  for (const kind of ['mbti', 'saju', 'zodiac']) {
    const kindBlock = lensAiData.slice(lensAiData.indexOf(`  ${kind}: {`));
    for (const mode of ['pair', 'self']) {
      const at = kindBlock.indexOf(`    ${mode}: [`);
      const block = at >= 0 ? kindBlock.slice(at, kindBlock.indexOf('\n    ],', at)) : '';
      const count = (block.match(/\n        id: '/g) ?? []).length;
      check(
        `AI-LENS-01~06 [${kind}/${mode}] unit이 4~6개다 (§27 · 발견 ${count})`,
        count >= 4 && count <= 6,
        count,
      );
    }
  }

  /* ── AI-LENS-07 · unavailable 렌즈는 call 0 ───────────────────────────── */
  check(
    'AI-LENS-07 unavailable 렌즈는 AI를 부르지 않는다',
    /lens\.mode !== 'unavailable'/.test(orchestrator) &&
      /requestPremiumLensNarrative\(/.test(orchestrator),
    'unavailable 필터가 없다',
  );

  /* ── AI-LENS-08 · 상대 속마음 주장 0 ──────────────────────────────────── */
  check(
    'AI-LENS-08 렌즈 스캐너가 마음 읽기·의도 단정을 거른다',
    /scanForForbiddenInference\(text\)\.violations/.test(safety) &&
      /scanClaimBoundary\(text\)\.violations/.test(safety) &&
      /export function scanLensNarrative\(/.test(safety),
    'scanLensNarrative가 기존 술어를 재사용하지 않는다',
  );
  check(
    'AI-LENS-08 프롬프트가 상대 마음·의도를 금지한다',
    prompts.includes('상대는 너를') && prompts.includes('마음이 식었다'),
  );

  /* ── AI-LENS-09 · 성공/운명 예측 0 ────────────────────────────────────── */
  check(
    'AI-LENS-09 사주 금지 어휘에 운명·궁합 점수가 있다',
    safety.includes('saju_forbidden_fortune') &&
      ['운명', '천생연분', '재회운', '궁합'].every((word) => safety.includes(word)),
  );
  check(
    'AI-LENS-09 별자리 금지 어휘에 운세·성공 확률이 있다',
    safety.includes('zodiac_forbidden_fortune') && safety.includes('성공'),
  );

  /* ── AI-LENS-10 · 지원하지 않는 사주 정보 생성 0 ──────────────────────── */
  check(
    'AI-LENS-10 연주·월주·시주·대운이 스캐너 금지 목록에 있다',
    safety.includes('saju_unsupported_pillar') &&
      ['연주', '월주', '시주', '대운', '용신'].every((word) => safety.includes(word)),
  );
  check(
    'AI-LENS-10 사주 프롬프트가 계산하지 않은 기둥을 명시한다',
    prompts.includes('연주 · 월주 · 시주') && prompts.includes('일주(日柱) 하나'),
  );

  /* ── AI-LENS-11 · Moon/Rising 생성 0 ──────────────────────────────────── */
  check(
    'AI-LENS-11 달·상승궁·하우스가 스캐너 금지 목록에 있다',
    safety.includes('zodiac_unsupported_chart') &&
      ['달자리', '상승궁', '하우스', '어스펙트'].every((word) => safety.includes(word)),
  );
  check(
    'AI-LENS-11 별자리 프롬프트가 계산하지 않은 것을 명시한다',
    prompts.includes('달자리(Moon)') && prompts.includes('상승궁(Rising/Ascendant)'),
  );

  /* ── AI-LENS-12 · Event attribution 유지 ──────────────────────────────── */
  check(
    'AI-LENS-12 프롬프트가 사건을 사용자 관찰로만 쓰게 한다',
    prompts.includes('네가 연락이 줄었다고 느낀 장면을 알려줬어') &&
      prompts.includes('상대가 일부러 연락을 줄였어'),
  );
  check(
    'AI-LENS-12 사건이 렌즈별 종류 필터와 건수 상한을 거친다',
    /const LENS_EVENT_TYPES: Record</.test(builders) &&
      /\.slice\(0, LENS_EVENT_LIMIT\)/.test(builders),
  );

  /* ── AI-LENS-12b · 내부 enum이 모델에게 나가지 않는다 (브라우저 실측 회귀) ── */
  /**
   * ⚠️ 실측에서 Cross-Lens 결과에 `planning · expression · pace` 세 단어가 **영어
   * 그대로** 유료 화면에 나갔다. context가 테마를 enum 코드로 보냈고, 모델은 받은
   * 어휘로 쓴다 — 내부 식별자를 보내면 내부 식별자가 화면에 나온다.
   */
  check(
    'AI-LENS-12b 렌즈 context가 테마를 사람이 읽는 라벨로 보낸다 (enum 코드 금지)',
    (builders.match(/themes: report\.themes\.map\(\(theme\) => LENS_THEME_LABEL\[theme\]\)/g) ?? [])
      .length === 2,
    'contextBuilders가 themes를 raw enum으로 보낸다',
  );
  check(
    'AI-LENS-12b Cross-Lens AI 라벨이 결정론 카드 라벨과 다르다 (§31 중복 방지)',
    lensAiData.includes("crossRepeated: '반복된 테마를 풀어 보면'") &&
      !lensAiData.includes("crossRepeated: '반복해서 나온 테마'"),
  );

  /* ── AI-LENS-13 · Lens 한 개 fail → 나머지 유지 ───────────────────────── */
  check(
    'AI-LENS-13 세 렌즈를 allSettled로 받는다 (하나가 실패해도 나머지 결과를 쓴다)',
    /await Promise\.allSettled\(/.test(orchestrator),
  );
  check(
    'AI-LENS-13 실패한 렌즈만 unavailable이 된다 (전역 실패 상태가 없다)',
    /outcome\.status === 'rejected'/.test(orchestrator) && !/setByLens\(\{\}\)/.test(orchestrator),
  );

  /* ── AI-LENS-14 · Cross-Lens fail → Lens 3개 유지 ─────────────────────── */
  const crossFailAt = orchestrator.indexOf('if (!result.ok) {');
  const crossFailBlock = crossFailAt >= 0 ? orchestrator.slice(crossFailAt, crossFailAt + 400) : '';
  check(
    'AI-LENS-14 Cross-Lens 실패가 렌즈 상태를 건드리지 않는다',
    crossFailBlock.includes('setCross(') && !crossFailBlock.includes('setByLens('),
    crossFailBlock.slice(0, 80),
  );

  /* ── AI-LENS-15 · Lens 3개 병렬 시작 ──────────────────────────────────── */
  check(
    'AI-LENS-15 렌즈 3개가 병렬로 시작한다 (순차 await 아님)',
    /Promise\.allSettled\(\s*reports\.map\(/.test(orchestrator),
  );

  /* ── AI-LENS-16 · Cross-Lens는 Lens 완료 후 ───────────────────────────── */
  const settledAt = orchestrator.indexOf('const settled = await Promise.allSettled(');
  const crossCallAt = orchestrator.indexOf('await requestCrossLensNarrative(');
  check(
    'AI-LENS-16 Cross-Lens 호출이 렌즈 allSettled 뒤에 온다',
    settledAt >= 0 && crossCallAt > settledAt,
    { settledAt, crossCallAt },
  );
  check(
    'AI-LENS-16 Cross-Lens는 렌즈가 2개 이상일 때만 부른다 (결정론 Cross-Lens와 같은 조건)',
    /if \(reports\.length < 2\)/.test(orchestrator),
  );

  /* ── AI-LENS-17 · refresh cache ───────────────────────────────────────── */
  check(
    'AI-LENS-17 재진입 시 캐시를 먼저 읽는다 (loading 깜빡임 없이 재사용)',
    orchestrator.includes('getCachedAiResult<PremiumLensNarrativeBundle>') &&
      orchestrator.includes('getCachedAiResult<CrossLensNarrativeBundle>'),
  );
  check(
    'AI-LENS-17 같은 조합을 두 번 시작하지 않는다 (StrictMode·리렌더 가드)',
    /if \(startedRef\.current === runKey\) return;/.test(orchestrator),
  );

  /* ── AI-LENS-18 · partial 변경 시 관련 Lens만 invalidate ──────────────── */
  check(
    'AI-LENS-18 지문이 렌즈마다 따로 만들어진다',
    /export function premiumLensFingerprint\(/.test(fingerprints) &&
      fingerprints.includes('return `lens_${kind}_${digest(['),
  );
  check(
    'AI-LENS-18 Cross-Lens 지문이 렌즈 지문에서 파생된다 (렌즈가 바뀌면 자동 무효화)',
    /lensFingerprints: readonly string\[\]/.test(fingerprints) &&
      /lensFingerprints: fingerprints/.test(orchestrator),
  );
  check(
    'AI-LENS-18 네 Task가 서로 다른 promptVersion을 갖는다 (캐시 네임스페이스 분리)',
    ['premium-mbti-v3', 'premium-saju-v3', 'premium-zodiac-v3', 'premium-cross-lens-v3'].every(
      (version) => versions.includes(`'${version}'`),
    ),
  );
  check(
    'AI-LENS-18 캐시 키가 task와 promptVersion을 함께 쓴다',
    client.includes('${task}::${promptVersionOf(task)}::${fingerprint}'),
  );

  /* ── AI-LENS-19 · deep-report-v4-tense 불변 ───────────────────────────── */
  check(
    'AI-LENS-19 deep-report promptVersion이 그대로다',
    versions.includes("deepReport: 'deep-report-v4-tense'"),
  );
  check(
    'AI-LENS-19 기존 네 Task의 promptVersion이 전부 그대로다',
    [
      'relationship-v7-evidence',
      'compatibility-v4-tense',
      'history-v3-axis',
      'observed-v2-photo',
    ].every((version) => versions.includes(`'${version}'`)),
  );
  check(
    'AI-LENS-19 deep-report 근거 계약(insight-subset)이 그대로다',
    contract.includes("evidence: 'insight-subset'"),
  );

  /* ── AI-LENS-20 · 총 신규 Lens provider call 최대 4 ───────────────────── */
  const providerCalls = (handlers.match(/provider\.generateStructured\(\{/g) ?? []).length;
  check(
    `AI-LENS-20 핸들러의 provider 호출 지점이 7개다 (기존 5 + 렌즈 1 + Cross 1 · 발견 ${providerCalls})`,
    providerCalls === 7,
    providerCalls,
  );
  /**
   * ⚠️ 렌즈가 **1개 지점**인 것이 핵심이다. `runPremiumLensTask` 하나를 세 Task가
   * 공유하므로 렌즈 호출 수는 `reports.length`(≤3)가 정한다. 지점이 3개가 되면
   * 누군가 렌즈마다 핸들러를 복사한 것이고, 그때 상한이 흔들린다.
   */
  check(
    'AI-LENS-20 렌즈 호출이 한 지점에서만 일어난다 (렌즈마다 복사하지 않았다)',
    (handlers.match(/systemPrompt: LENS_PROMPT\[kind\]/g) ?? []).length === 1,
  );
  check(
    'AI-LENS-20 Cross-Lens는 한 번만 호출된다',
    (orchestrator.match(/requestCrossLensNarrative\(/g) ?? []).length === 1,
  );
  /** 렌즈가 전부 unavailable이면 신규 호출 0 — deep-report 1건만 남는다 */
  check(
    'AI-LENS-20 렌즈가 0개면 신규 호출이 0이다',
    /if \(!enabled \|\| reports\.length === 0\) return;/.test(orchestrator),
  );

  /* ── AI-LENS-ENUM-01~05 · 내부 코드가 화면에 닿지 않는다 ────────────────
     실제 치환 결과는 `tests/fixtures/ai/lens_enum_*.json`이 런타임으로 본다
     (Provider 없이 도는 contract-test 라우트). 여기서 보는 것은 **그 guard가
     붙어 있는 자리**다 — 한 곳만 빠져도 그 필드로 코드가 다시 나간다. */
  check(
    'AI-LENS-ENUM-04 매핑 목록이 LENS_THEME_LABEL에서 파생된다 (손으로 적은 목록이 아니다)',
    /Object\.keys\(LENS_THEME_LABEL\)/.test(safety) &&
      /export function maskInternalCodes\(/.test(safety),
    'guard가 테마 라벨 상수에서 목록을 만들지 않는다',
  );
  check(
    'AI-LENS-ENUM-05 매핑할 수 없는 내부 식별자는 항목을 버린다 (raw code 노출 대신)',
    /INTERNAL_ID_PATTERN\.test\(out\) \? null : out/.test(safety),
    'unknown code fallback이 없다',
  );
  /**
   * 여섯 자리 — summary · unit body · checkpoint · crossTheme · Cross 블록 항목 · closing.
   *
   * ⚠️ `crossTheme`이 이 목록에 있는 것이 중요하다. 그 값은 화면이 아니라 **Cross-Lens
   * 호출의 context**로 들어간다. 화면 앞에서만 걸러내면 내부 코드가 다음 호출의 입력으로
   * 되살아나고, 그게 이 결함이 처음 생긴 경로다.
   */
  const maskedFields = (schemas.match(/maskInternalCodes\(/g) ?? []).length;
  check(
    `AI-LENS-ENUM-01~03 파서가 화면에 나가는 문자열 여섯 자리를 전부 거른다 (발견 ${maskedFields})`,
    maskedFields === 6,
    maskedFields,
  );
  check(
    'AI-LENS-ENUM-01~03 Cross-Lens 항목과 렌즈 body가 같은 guard를 쓴다',
    /const text = maskInternalCodes\(str\(item, 900\)\)/.test(schemas) &&
      /const body = maskInternalCodes\(str\(item\.body, 1200\)\)/.test(schemas),
  );

  /* ── STYLE-01~03 · 반복 · 내부 용어 · 잘못된 상대 상태 (v1.46.1 §19) ──── */
  check(
    'STYLE-01~02 같은 틀의 반복은 두 개까지만 남는다 (금지가 아니라 제한)',
    /const STOCK_PHRASE_LIMIT = 2;/.test(safety) &&
      /export function limitStockPhraseRepeats</.test(safety),
    '반복 제한 함수가 없다',
  );
  check(
    'STYLE-01~02 반복 제한이 렌즈와 Cross-Lens **양쪽** 핸들러에서 돈다',
    (handlers.match(/limitStockPhraseRepeats\(/g) ?? []).length === 2,
    (handlers.match(/limitStockPhraseRepeats\(/g) ?? []).length,
  );
  check(
    'STYLE-03 내부 구조 용어(pair·self·mode)가 스캐너 금지 목록에 있다',
    /internal_jargon/.test(safety) && /pair\|self\|deterministic/.test(safety),
  );
  check(
    'STYLE-05 상대가 있을 때만 "상대가 없어서"를 막는다 (없는 사용자의 정상 문장은 통과)',
    /if \(targetExists\) \{/.test(safety) && /wrong_target_state/.test(safety),
  );
  /**
   * ⚠️ **기본값이 없다는 것**까지 검사한다. `targetExists = true` 같은 기본값을 두면
   * 새 호출부가 조용히 검사를 켜거나 꺼도 아무도 모른다 — v1.42 §40.8이 닫은 형태다.
   */
  check(
    'STYLE-05 라우트가 targetExists를 boolean으로 강제한다 (기본값 없음)',
    /typeof targetExists !== 'boolean'/.test(
      await src('src/app/api/ai/premium-mbti-lens/route.ts'),
    ) &&
      /typeof targetExists !== 'boolean'/.test(
        await src('src/app/api/ai/premium-cross-lens/route.ts'),
      ),
  );
  check(
    'STYLE-05 AI context가 targetExists와 selfReason을 함께 보낸다',
    /targetExists: boolean;/.test(builders) && /selfReason\?: PremiumLensSelfReason;/.test(builders),
  );
  check(
    'STYLE-08 체크포인트만 말하듯 쓰라고 프롬프트가 구분한다 (본문은 차분하게)',
    prompts.includes('여기만 **말하듯** 쓴다'),
  );
  check(
    'STYLE-09 반복 제한 목록이 프롬프트와 스캐너 양쪽에 있다',
    prompts.includes('한 결과 안에서 두 번까지') && /STOCK_PHRASES/.test(safety),
  );
}



/* ══════════════════════════════════════════════════════════════════════ */

console.log(`\n─── 통과 ${pass} · 실패 ${failures.length} ───\n`);
if (failures.length > 0) {
  for (const failure of failures) console.log(`  ✗ ${failure.label}`);
  process.exit(1);
}
