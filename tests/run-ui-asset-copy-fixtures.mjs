/**
 * v1.47 — UI Asset · Production Copy Guard
 *
 * ```
 * ASSET-01  러비 레지스트리(src/data/lovy.ts)의 파일이 public/에 있고 PNG 헤더 크기가 레지스트리 값과 같다
 * ASSET-02  src에 Windows 절대경로 · docs/ 에셋 경로가 없다
 * ASSET-03  캐릭터 에셋이 data:image · base64가 아니다 (정적 /lovy/*.png만)
 * ASSET-04  코드의 pose 리터럴 · /lovy/ 경로 · <img>가 전부 실제 에셋(또는 사용자 사진 blob)을 가리킨다
 * COPY-01   production 사용자 화면 '개발용 미리보기' = 0
 * COPY-02   production 사용자 화면 '개발용' · '테스트용' = 0 (예외 없음)
 * COPY-03   예외로 뺀 dev 전용 화면이 실제로 production에서 막혀 있고, 사용자 화면이 /dev 경로를 참조하지 않는다
 * COPY-04   '미리보기' · '샘플' · '데모' = 0 (UT-2 RC — allowlist 비움)
 * ```
 *
 * ⚠️ 정적 검사만 한다. 서버 · Provider 호출 없음.
 * 실행: `npm run test:ui-assets`
 */

import './_aiTestGuard.mjs';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
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
  const suffix = detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 600)}`;
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

const rel = (file) => relative(ROOT, file).split('\\').join('/');
const srcFiles = await walk(join(ROOT, 'src'));
const sources = new Map();
for (const file of srcFiles) {
  const raw = await readFile(file, 'utf8');
  sources.set(rel(file), { raw, code: stripComments(raw) });
}

/* ───────────────────────────── ASSET */

console.log('\nASSET — 캐릭터 정적 에셋');

const lovyData = sources.get('src/data/lovy.ts').code;
const dims = {};
for (const [, name, w, h] of lovyData.matchAll(/const (\w+) = \{ width: (\d+), height: (\d+) \}/g)) {
  dims[name] = { width: Number(w), height: Number(h) };
}
const registry = [];
for (const match of lovyData.matchAll(
  /(\w+): \{\s*src: '([^']+)',\s*(?:\.\.\.(\w+)|width: (\d+), height: (\d+))/g,
)) {
  const [, pose, src, spread, w, h] = match;
  registry.push({ pose, src, ...(spread ? dims[spread] : { width: Number(w), height: Number(h) }) });
}
const poses = new Set(registry.map((entry) => entry.pose));

async function pngSize(path) {
  const header = (await readFile(path)).subarray(0, 24);
  const signature = header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return signature ? { width: header.readUInt32BE(16), height: header.readUInt32BE(20) } : null;
}

const assetProblems = [];
for (const entry of registry) {
  const file = join(ROOT, 'public', ...entry.src.split('/').filter(Boolean));
  if (!existsSync(file)) {
    assetProblems.push(`${entry.pose}: 파일 없음 ${entry.src}`);
    continue;
  }
  const size = await pngSize(file);
  if (!size) assetProblems.push(`${entry.pose}: PNG 아님`);
  else if (size.width !== entry.width || size.height !== entry.height)
    assetProblems.push(`${entry.pose}: 레지스트리 ${entry.width}×${entry.height} ≠ 파일 ${size.width}×${size.height}`);
}
check(
  `ASSET-01 러비 에셋 ${registry.length}개 — public/에 존재 · PNG · 레지스트리 크기 일치 (왜곡 방지)`,
  registry.length >= 19 && assetProblems.length === 0,
  assetProblems,
);

const pathLeaks = [];
for (const [file, { code }] of sources) {
  if (/[A-Za-z]:\\\\|[A-Za-z]:\/Users\//.test(code) || /docs\/캐릭터|['"`]\/?docs\//.test(code)) pathLeaks.push(file);
}
check('ASSET-02 src — Windows 절대경로 · docs/ 에셋 경로 0', pathLeaks.length === 0, pathLeaks);

const lovyFiles = [...sources.keys()].filter(
  (file) => file === 'src/data/lovy.ts' || file.startsWith('src/components/lovy/'),
);
const inlineAssets = lovyFiles.filter((file) => /data:image|;base64,/.test(sources.get(file).code));
check(
  'ASSET-03 캐릭터 에셋 — 전부 /lovy/*.png 정적 경로 · data:image/base64 0',
  registry.every((entry) => /^\/lovy\/[\w/-]+\.png$/.test(entry.src)) && inlineAssets.length === 0,
  inlineAssets,
);

const unknownPoses = [];
const missingPaths = [];
const rawImgs = [];
for (const [file, { raw, code }] of sources) {
  for (const [, pose] of code.matchAll(/\bpose=(?:"|\{')(\w+)/g)) {
    if (!poses.has(pose)) unknownPoses.push(`${file}: ${pose}`);
  }
  if (file.startsWith('src/data/') || file.startsWith('src/lib/')) {
    for (const [, pose] of code.matchAll(/\bpose: '(\w+)'/g)) {
      if (!poses.has(pose)) unknownPoses.push(`${file}: ${pose}`);
    }
  }
  for (const [path] of code.matchAll(/\/lovy\/[\w/-]+\.png/g)) {
    if (!existsSync(join(ROOT, 'public', ...path.split('/').filter(Boolean)))) missingPaths.push(`${file}: ${path}`);
  }
  // raw로 본다 — 주석 제거기가 JSX 속 `//`가 들어간 줄(eslint 지시문 등)과 함께 태그를 지울 수 있다.
  // 주석 속 "`<img>`" 설명은 `<img` 뒤에 공백이 없어서 걸리지 않는다.
  if (/<img\s/.test(raw)) rawImgs.push(file);
}
check(
  'ASSET-04 pose 리터럴 · /lovy/ 경로가 전부 실제 에셋 · <img>는 사용자 사진 blob(PhotoGrid)만',
  unknownPoses.length === 0 &&
    missingPaths.length === 0 &&
    rawImgs.length === 1 &&
    rawImgs[0] === 'src/components/profile/PhotoGrid.tsx',
  { unknownPoses, missingPaths, rawImgs },
);

/* ───────────────────────────── COPY */

console.log('\nCOPY — production 사용자 화면 문구');

/** 진짜 dev 전용 — production에서 렌더되지 않는다(COPY-03이 확인한다) */
const DEV_ONLY = [
  (file) => file.startsWith('src/app/dev/'),
  (file) => file.startsWith('src/app/api/'),
  (file) => file === 'src/components/shell/PrototypePanel.tsx',
  (file) => file === 'src/components/ai/AiDebugPanel.tsx',
];
const userFacing = [...sources.keys()].filter(
  (file) =>
    (file.startsWith('src/app/') || file.startsWith('src/components/') || file.startsWith('src/data/')) &&
    !DEV_ONLY.some((isDev) => isDev(file)),
);

const devPreview = userFacing.filter((file) => /개발용\s*·?\s*미리보기/.test(sources.get(file).code));
check('COPY-01 사용자 화면 "개발용 미리보기" 0', devPreview.length === 0, devPreview);

/**
 * ⚠️ v1.47 UT-2 RC — mock 전용 예외('개발용 MOCK')를 없앴다.
 * mock은 production에서 demo로 내려가므로 렌더될 일이 없었지만, 참가자 화면 파일에 그
 * 문구가 **남아 있다는 것 자체**가 설정 한 줄로 노출될 수 있는 상태였다.
 */
const devWords = [];
for (const file of userFacing) {
  const { code } = sources.get(file);
  for (const match of code.matchAll(/[^\n]{0,16}(개발용|테스트용)[^\n]{0,16}/g)) {
    devWords.push(`${file}: ${match[0].trim()}`);
  }
}
check('COPY-02 사용자 화면 "개발용" · "테스트용" 0 (예외 없음)', devWords.length === 0, devWords);

const devPages = [...sources.keys()].filter((file) => /^src\/app\/dev\/[^/]+\/page\.tsx$/.test(file));
const ungatedDevPages = devPages.filter((file) => {
  const { code } = sources.get(file);
  return !/process\.env\.NODE_ENV === 'production'\) notFound\(\)/.test(code);
});
const prototypeGated = /if \(process\.env\.NODE_ENV === 'production'\) return null;/.test(
  sources.get('src/components/shell/PrototypePanel.tsx').code,
);
const debugPanelHosts = [...sources.keys()].filter((file) => /<AiDebugPanel\b/.test(sources.get(file).code));
const debugGated =
  /\bAI_DEBUG\b/.test(sources.get('src/components/ai/AiDebugPanel.tsx').code) ||
  (debugPanelHosts.length > 0 && debugPanelHosts.every((file) => /\bAI_DEBUG\b/.test(sources.get(file).code)));
const mockBlockedInProduction = /requested === 'mock' && process\.env\.NODE_ENV !== 'production'/.test(
  sources.get('src/services/ai/serverEnv.ts').code,
);
const devLinks = userFacing.filter((file) => /['"`]\/dev\//.test(sources.get(file).code));
check(
  `COPY-03 dev 전용 예외가 production에서 막힘 — /dev 페이지 ${devPages.length}개 404 · PrototypePanel · AI Debug · mock 불가 · 사용자 화면의 /dev 참조 0`,
  devPages.length >= 2 &&
    ungatedDevPages.length === 0 &&
    prototypeGated &&
    debugGated &&
    mockBlockedInProduction &&
    devLinks.length === 0,
  { ungatedDevPages, prototypeGated, debugGated, mockBlockedInProduction, devLinks },
);

/**
 * ⚠️ v1.47 UT-2 RC — **allowlist를 비웠다.**
 *
 * 예전에는 여섯 문구를 '기능상 의미가 있다'는 이유로 통과시켰다:
 *   미리보기로 리포트를 열었어 · 샘플 답변으로 결과부터 볼게 ·
 *   데모 모드라 사진을 전송하지 않아 · 데모 분석을 사용 중이야 ·
 *   데모용 규칙 기반 응답이야 · 규칙 기반 데모 응답이야
 *
 * UT-2에서는 참가자가 제품을 **실제 제품 경험**으로 봐야 한다. 위 문구는 전부 제품을
 * 임시 버전으로 읽히게 하므로 허용하지 않는다. 사실(사진을 전송하지 않는다 · 규칙 기반이다)은
 * 그대로 말하되 내부 모드 이름을 쓰지 않는 문구로 바꿨다.
 *
 * 렌더되는 텍스트 전수 검사는 `run-meta-copy-fixtures.mjs`(META-01~10)가 한다.
 * 여기에 예외를 다시 추가하기 전에 그쪽 기준을 먼저 본다.
 */
const FUNCTIONAL = [];
const metaWords = [];
for (const file of userFacing) {
  const { code } = sources.get(file);
  // 식별자(IS_DEMO_AI · SAMPLE_PHOTOS 등)가 아니라 한글 문구만 본다
  for (const match of code.matchAll(/[^\n'"`]{0,20}(미리보기|샘플|데모)[^\n'"`]{0,20}/g)) {
    if (!FUNCTIONAL.some((pattern) => pattern.test(match[0]))) metaWords.push(`${file}: ${match[0].trim()}`);
  }
}
const previewPage = sources.get('src/app/premium-preview/[feature]/page.tsx').code;
check(
  'COPY-04 "미리보기" · "샘플" · "데모" — 기능 allowlist만 · Deep Report 화면에 PREVIEW 배지 없음',
  metaWords.length === 0 && !/'PREVIEW'/.test(previewPage),
  metaWords,
);

console.log(`\n${passed} passed · ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
