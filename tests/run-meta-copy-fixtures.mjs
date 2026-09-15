/**
 * v1.47 UT-2 RC — Participant-facing Meta Copy Guard
 *
 * ```
 * META-01  참가자 화면 '개발용' · '개발자용' · '개발 중' = 0
 * META-02  참가자 화면 '테스트용' · '테스트 화면' · 'BETA TEST' = 0
 * META-03  참가자 화면 '데모' · 'DEMO' = 0
 * META-04  참가자 화면 '미리보기' · '미리 보기' · 'PREVIEW' = 0 (Paywall 티저 라벨 1건만 예외)
 * META-05  참가자 화면 'MOCK' · 'debug' · 'fixture' · 'fake door' · '샘플 분석/답변' = 0
 * META-06  Saju · Lens 화면 금지 메타 = 0
 * META-07  Premium · Deep Report 화면 금지 메타 = 0
 * META-08  loading · error · fallback · empty 문구 금지 메타 = 0
 * META-09  dev 전용 화면은 내부 표현을 그대로 써도 된다(production에서 렌더되지 않음)
 * META-10  참가자 화면이 /dev 경로를 참조하지 않는다
 * ```
 *
 * ── 무엇을 보는가 ────────────────────────────────────────────────────────────
 * **렌더되는 텍스트만** 본다. 내부 식별자·상태값은 보지 않는다:
 *   보지 않음   mode === 'mock' · 'demo_unlock' · 'beta_ut' · feature.status === 'fake-door'
 *   봄          '지금은 데모 분석을 사용 중이야' · <Tag>DEMO AI</Tag> · '개발용 미리보기'
 *
 * 그래서 두 가지를 뽑는다.
 *   ① 한글이 들어간 문자열 리터럴 — 사용자에게 읽히는 문장은 전부 여기 있다
 *   ② JSX 텍스트 노드 — `<Tag>DEMO AI</Tag>`처럼 따옴표 없이 렌더되는 배지
 *
 * ⚠️ 정적 검사만 한다. 서버 · Provider 호출 없음.
 * 실행: `npm run test:meta-copy`
 */

import './_aiTestGuard.mjs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './fixtures-v1464.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const failures = [];
let passed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
    return;
  }
  const suffix = detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 900)}`;
  failures.push(`${label}${suffix}`);
  console.log(`  ✗ ${label}${suffix}`);
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const rel = (file) => relative(ROOT, file).split(sep).join('/');

/** production 참가자에게 렌더되지 않는 것들 — META-09가 이것들이 실제로 막혀 있는지 본다 */
const DEV_ONLY = (file) =>
  file.startsWith('src/app/dev/') ||
  file.startsWith('src/app/api/') ||
  file === 'src/components/shell/PrototypePanel.tsx' ||
  file === 'src/components/ai/AiDebugPanel.tsx' ||
  file === 'src/app/ut/page.tsx' ||
  file.startsWith('src/components/ut/');

const sources = new Map();
for (const file of await walk(join(ROOT, 'src'))) {
  const raw = await readFile(file, 'utf8');
  sources.set(rel(file), { raw, code: stripComments(raw) });
}

const participantFiles = [...sources.keys()].filter(
  (file) =>
    (file.startsWith('src/app/') || file.startsWith('src/components/') || file.startsWith('src/data/')) &&
    !DEV_ONLY(file),
);

/* ─────────────────────────── 렌더되는 텍스트만 뽑는다 */

const HANGUL = /[가-힣]/;
const SINGLE = /'((?:[^'\\\n]|\\.)*)'/g;
const DOUBLE = /"((?:[^"\\\n]|\\.)*)"/g;
const BACKTICK = new RegExp('`((?:[^`\\\\]|\\\\.)*)`', 'g');

/** ① 한글이 들어간 문자열 리터럴 — 사용자 문장은 전부 여기 있다 */
function koreanLiterals(code) {
  const out = [];
  for (const pattern of [SINGLE, DOUBLE, BACKTICK]) {
    for (const [, body] of code.matchAll(pattern)) if (HANGUL.test(body)) out.push(body);
  }
  return out;
}

/**
 * ② JSX 텍스트 노드 — `<Tag tone="neutral">DEMO AI</Tag>`
 *
 * 여는 태그와 닫는 태그 사이에서 `{...}` 표현식이 없는 순수 텍스트만 본다.
 * 표현식 안(`{PRIVACY.demoAi}`)은 ①이 원본 리터럴에서 이미 잡는다.
 *
 * ⚠️ `>`와 `<`는 JSX 밖에서도 흔하다 — 화살표 함수(`=>`)와 비교 연산자가 짝을 이루면
 * 코드 한 덩어리가 통째로 '텍스트'로 잡힌다(실제로 오탐이 났다). 그래서 코드에만
 * 나타나는 글자가 하나라도 있으면 텍스트로 보지 않는다.
 */
const CODE_CHARS = /[;={}()[\]`$|&]/;

function jsxText(code) {
  const out = [];
  for (const [, body] of code.matchAll(/>([^<>{}]*)</g)) {
    const text = body.replace(/\s+/g, ' ').trim();
    if (text.length > 0 && !CODE_CHARS.test(text)) out.push(text);
  }
  return out;
}

const rendered = new Map();
for (const file of participantFiles) {
  const { code } = sources.get(file);
  rendered.set(file, [...koreanLiterals(code), ...jsxText(code)]);
}

/** META-04가 설명하는 단 하나의 예외 — Paywall 티저 라벨 */
const PAYWALL_TEASER_LABEL = '미리 보기 — 3가지만 살짝';

function scan(files, patterns) {
  const hits = [];
  for (const file of files) {
    for (const text of rendered.get(file) ?? []) {
      if (text === PAYWALL_TEASER_LABEL) continue;
      for (const pattern of patterns) {
        if (pattern.test(text)) hits.push(`${file}: ${text.slice(0, 90)}`);
      }
    }
  }
  return [...new Set(hits)];
}

/* ─────────────────────────── META-01 ~ META-05 */

console.log('\nMETA — 참가자 화면 금지 메타 문구');

const m01 = scan(participantFiles, [/개발용/, /개발자용/, /개발 중/]);
check('META-01 참가자 화면 "개발용" · "개발자용" · "개발 중" = 0', m01.length === 0, m01);

const m02 = scan(participantFiles, [/테스트용/, /테스트 화면/, /BETA TEST/i, /베타 테스트/]);
check('META-02 참가자 화면 "테스트용" · "테스트 화면" · "BETA TEST" = 0', m02.length === 0, m02);

const m03 = scan(participantFiles, [/데모/, /\bDEMO\b/]);
check('META-03 참가자 화면 "데모" · "DEMO" = 0', m03.length === 0, m03);

/**
 * ⚠️ 유일한 명시적 예외 — Paywall 티저 라벨(`PREMIUM_COPY.previewLabel`).
 *
 * `미리 보기 — 3가지만 살짝`은 **유료 리포트 중 3개를 먼저 보여준다**는 상품 설명이다.
 * `무료로 본 내용` · `이번 리포트에서 볼 수 있는 것`과 나란히 놓인 Paywall 구조의 일부이고,
 * 제품이 미완성/임시 빌드라는 뜻이 아니다. UT-2가 관찰하려는 결제 의향 화면 자체라
 * RC 동결 중에 문구를 바꾸지 않는다(§31 — blocker가 아닌 카피 수정 금지).
 *
 * 예외는 이 한 줄뿐이다. 다른 `미리 보기`가 생기면 여기서 걸린다 — 새로 추가하기 전에
 * '상품 설명인가, 빌드 상태 설명인가'를 먼저 판단한다.
 */
const m04 = scan(participantFiles, [/미리보기/, /미리 보기/, /\bPREVIEW\b/]);
check(
  'META-04 참가자 화면 "미리보기" · "미리 보기" · "PREVIEW" = 0 (Paywall 티저 라벨 1건만 예외)',
  m04.length === 0,
  m04,
);
const teaserStillThere = (rendered.get('src/data/premium.ts') ?? []).includes(PAYWALL_TEASER_LABEL);
check('META-04b 예외로 둔 Paywall 티저 라벨이 그대로 있다 (사라지면 예외도 지운다)', teaserStillThere);

const m05 = scan(participantFiles, [
  /\bMOCK\b/,
  /\bdebug\b/i,
  /\bfixture\b/i,
  /fake ?door/i,
  /샘플 분석/,
  /샘플 답변/,
  /가짜 결과/,
  /임시 결과/,
]);
check(
  'META-05 참가자 화면 "MOCK" · "debug" · "fixture" · "fake door" · "샘플 분석/답변" = 0',
  m05.length === 0,
  m05,
);

/* ─────────────────────────── META-06 · META-07 — 회귀가 났던 화면 */

const ALL_META = [
  /미리 보기/,
  /개발용/,
  /개발자용/,
  /개발 중/,
  /테스트용/,
  /테스트 화면/,
  /데모/,
  /\bDEMO\b/,
  /미리보기/,
  /\bPREVIEW\b/,
  /\bMOCK\b/,
  /\bdebug\b/i,
  /\bfixture\b/i,
  /fake ?door/i,
  /BETA TEST/i,
  /샘플 분석/,
  /가짜 결과/,
  /임시 결과/,
];

const lensFiles = participantFiles.filter(
  (file) => file.startsWith('src/app/lens/') || file.startsWith('src/app/compatibility/lenses') || /Lens/.test(file),
);
const m06 = scan(lensFiles, ALL_META);
check(`META-06 Saju · Lens 화면(${lensFiles.length}개) 금지 메타 = 0`, m06.length === 0 && lensFiles.length >= 5, m06);

const premiumFiles = participantFiles.filter(
  (file) =>
    file.startsWith('src/app/premium') ||
    file.startsWith('src/components/premium/') ||
    file === 'src/data/premium.ts',
);
const m07 = scan(premiumFiles, ALL_META);
check(
  `META-07 Premium · Deep Report 화면(${premiumFiles.length}개) 금지 메타 = 0`,
  m07.length === 0 && premiumFiles.length >= 5,
  m07,
);

/* ─────────────────────────── META-08 — 정상 화면만 보지 않는다 */

/**
 * loading · error · fallback · empty 문구가 모여 있는 곳.
 * 위에서 참가자 화면으로 이미 검사됐지만 **회귀가 나기 쉬운 지점이라 따로 이름을 붙여 둔다** —
 * 여기서 깨지면 무엇이 깨졌는지 바로 읽힌다.
 */
const stateFiles = [
  'src/components/ai/AiModeNotice.tsx',
  'src/app/profile/observed/page.tsx',
  'src/app/compatibility/analyzing/page.tsx',
  'src/app/profile/analyzing/page.tsx',
  'src/data/copy.ts',
  'src/data/premium.ts',
].filter((file) => sources.has(file));
const m08 = scan(stateFiles, ALL_META);
check(
  `META-08 loading · error · fallback · empty 문구(${stateFiles.length}개 파일) 금지 메타 = 0`,
  m08.length === 0 && stateFiles.length >= 5,
  m08,
);

/* ─────────────────────────── META-09 — dev 전용은 그대로 둬도 된다 */

const devPages = [...sources.keys()].filter((file) => /^src\/app\/dev\/[^/]+\/page\.tsx$/.test(file));
const ungatedDevPages = devPages.filter(
  (file) => !/process\.env\.NODE_ENV === 'production'\) notFound\(\)/.test(sources.get(file).code),
);
const prototypeGated = /if \(process\.env\.NODE_ENV === 'production'\) return null;/.test(
  sources.get('src/components/shell/PrototypePanel.tsx').code,
);
const mockBlockedInProduction = /requested === 'mock' && process\.env\.NODE_ENV !== 'production'/.test(
  sources.get('src/services/ai/serverEnv.ts').code,
);
check(
  `META-09 dev 전용 예외가 production에서 렌더되지 않음 — /dev 페이지 ${devPages.length}개 404 · PrototypePanel · mock 불가`,
  devPages.length >= 2 && ungatedDevPages.length === 0 && prototypeGated && mockBlockedInProduction,
  { ungatedDevPages, prototypeGated, mockBlockedInProduction },
);

/* ─────────────────────────── META-10 */

const devLinks = participantFiles.filter((file) => /['"`]\/dev\//.test(sources.get(file).code));
check('META-10 참가자 화면의 /dev 경로 참조 0', devLinks.length === 0, devLinks);

console.log(`\n${passed} passed · ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
