/**
 * v1.47 — Premium UT Visibility · Onboarding Fixture
 *
 * ```
 * UT-PREM-01~15   UT에서 Premium 표면 · CTA · Paywall · Deep Report · 렌즈가 flag · 결제 · 저장소 상태와 무관하게 열린다
 * PROD-PREM-01~03 일반 사용자 정책 · UT override 누수 · /dev 404 유지
 * ONB-01~05       온보딩 4장 = Hook → Differentiation → Core Value → Retention · 금지 표현 0
 * ```
 *
 * 판정은 `/api/dev/ut-premium-test`(resolveUtMode · resolvePremiumAccess)와
 * `/api/dev/premium-test`(`utMode` 옵션 · 화면과 같은 premiumFeatureState · 리포트 빌더)가 제품 함수로 계산한다.
 * 브라우저 상태(새로고침 · 뒤로가기 · 실제 렌더)는 Browser QA로 따로 확인한다.
 *
 * ⚠️ Provider를 부르지 않는다. 앞뒤로 실제 호출 카운터를 읽어 0 증가를 확인한다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:ut-premium`
 */

import './_aiTestGuard.mjs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SEM_B, run, stripComments } from './fixtures-v1464.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';

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

async function guardCount() {
  const response = await fetch(`${BASE_URL}/api/dev/ai-guard`);
  if (!response.ok) throw new Error(`ai-guard ${response.status} — dev 서버 확인`);
  return (await response.json()).realProviderCalls;
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

/** 응답 어디에 있든 key를 찾는다 — 응답 모양이 바뀌어도 검사가 조용히 비지 않게 못 찾으면 undefined */
function findKey(value, key) {
  if (!value || typeof value !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(value, key)) return value[key];
  for (const child of Object.values(value)) {
    const found = findKey(child, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

const rel = (file) => relative(ROOT, file).split('\\').join('/');
const code = new Map();
for (const file of await walk(join(ROOT, 'src'))) {
  code.set(rel(file), stripComments(await readFile(file, 'utf8')));
}
const src = (file) => {
  const text = code.get(file);
  if (text === undefined) throw new Error(`파일 없음: ${file}`);
  return text;
};

const before = await guardCount();

/* ───────────────────────────── 판정 (제품 함수) */

const decision = await (await fetch(`${BASE_URL}/api/dev/ut-premium-test`, { method: 'POST' })).json();
if (!decision.ok) throw new Error(`ut-premium-test 실패 — ${JSON.stringify(decision)}`);
const { utMode: ut, access } = decision;

const utReport = await run({ ...SEM_B, utMode: true });
const normalReport = await run({ ...SEM_B });
const utEntry = findKey(utReport, 'premiumEntry');
const lensBundle = findKey(utReport, 'lensBundle');
const chapters = findKey(utReport, 'chapters');

const PREMIUM_SURFACES = [
  'src/components/premium/PremiumEntryRow.tsx',
  'src/components/premium/HomePremiumBundle.tsx',
  'src/app/premium/page.tsx',
  'src/app/premium-preview/[feature]/page.tsx',
  'src/app/premium-preview/deep-questions/page.tsx',
];

console.log('\nUT-PREM — UT에서 Premium은 반드시 보인다');

check(
  'UT-PREM-01 fresh browser + ?mode=ut → Premium 표면 visible (flag ON/OFF 모두) · 진입 행 · Home Bundle은 access로만 숨는다',
  ut.freshWithQuery === true &&
    access.utFlagsOn.surfaceEnabled === true &&
    access.utFlagsOff.surfaceEnabled === true &&
    /if \(!access\.surfaceEnabled\) return null;/.test(src('src/components/premium/PremiumEntryRow.tsx')) &&
    /if \(!access\.surfaceEnabled\) return null;/.test(src('src/components/premium/HomePremiumBundle.tsx')),
  { ut, utFlagsOff: access.utFlagsOff },
);

const disabledCta = PREMIUM_SURFACES.slice(0, 3).filter((file) => /\bdisabled=\{/.test(src(file)) && file !== 'src/app/premium/page.tsx');
const paywallCta = /<Button className="press-scale" onClick=\{handlePurchaseIntent\}>/.test(src('src/app/premium/page.tsx'));
check(
  'UT-PREM-02 Premium CTA enabled — 진입 행 · Bundle에 disabled 없음 · Paywall CTA 조건 없음 · UT 판정 status = fake-door(unlock 가능)',
  disabledCta.length === 0 &&
    paywallCta &&
    /const canUnlockDeepReport = isDeepReport && feature\.status === 'fake-door';/.test(src('src/app/premium/page.tsx')) &&
    utEntry?.status === 'fake-door',
  { disabledCta, paywallCta, utEntry },
);

const routes = [
  '/premium?source=compatibility&mode=ut',
  '/premium?source=mbti&mode=ut',
  '/premium-preview/relationship_deep_report?mode=ut',
  '/premium-preview/deep-questions?mode=ut',
];
const routeStatus = {};
for (const route of routes) {
  routeStatus[route] = (await fetch(`${BASE_URL}${route}`, { redirect: 'manual' })).status;
}
check(
  'UT-PREM-03 Premium route 직접 진입 + ?mode=ut → 200 · redirect 없음 · preview flag OFF여도 preview 통로 열림',
  Object.values(routeStatus).every((status) => status === 200) &&
    access.utFlagsOff.previewRouteOpen === true &&
    /if \(!access\.previewRouteOpen \|\| !featureId \|\| !report\)/.test(src('src/app/premium-preview/[feature]/page.tsx')) &&
    /if \(!access\.previewRouteOpen\) \{/.test(src('src/app/premium-preview/deep-questions/page.tsx')),
  { routeStatus },
);

check(
  'UT-PREM-04 Deep Report + UT → 실제 콘텐츠 (unlock 가능 · Chapter ≥ 1)',
  utEntry?.status === 'fake-door' && Array.isArray(chapters) && chapters.length > 0,
  { status: utEntry?.status, chapterCount: chapters?.length },
);

const lensKinds = (lensBundle?.lenses ?? []).map((lens) => lens.kind);
const lensSection = src('src/components/premium/RelationshipDeepReportView.tsx');
const lensRendered =
  /<PremiumLensSection\s+bundle=\{report\.lensBundle\}/.test(lensSection) &&
  !/(access|utMode|PREMIUM_|surfaceEnabled)[^\n]*\n?[^\n]*<PremiumLensSection/.test(lensSection);
for (const [id, kind, label] of [
  ['05', 'mbti', 'MBTI'],
  ['06', 'saju', 'Saju'],
  ['07', 'zodiac', 'Zodiac'],
]) {
  check(
    `UT-PREM-${id} ${label} 렌즈 + UT → 번들에 자리 있음 · 리포트가 flag 조건 없이 렌더`,
    lensKinds.includes(kind) && lensRendered,
    { lensKinds, lensRendered },
  );
}
check(
  'UT-PREM-08 Cross-Lens + UT → 번들이 crossLens 자리를 가진다 · 렌즈 섹션이 조건 없이 렌더',
  lensBundle !== undefined && Object.prototype.hasOwnProperty.call(lensBundle, 'crossLens') && lensRendered,
  { crossLens: lensBundle?.crossLens === null ? null : typeof lensBundle?.crossLens },
);

const flagReaders = [...code.keys()].filter(
  (file) =>
    /\b(PREMIUM_FAKE_DOOR|PREMIUM_PREVIEW|UT_MODE)\b/.test(src(file)) &&
    !['src/lib/env.ts', 'src/lib/utMode.ts', 'src/hooks/useUtMode.ts', 'src/services/premiumService.ts'].includes(file),
);
check(
  'UT-PREM-09 feature flag OFF + UT → 표면 · preview 통로 열림 · 화면이 flag를 직접 읽지 않음(env · utMode · hook · service만)',
  access.utFlagsOff.surfaceEnabled && access.utFlagsOff.previewRouteOpen && flagReaders.length === 0 &&
    /resolvePremiumAccess\(\{\s*utMode: context\.utMode,/.test(src('src/services/premiumService.ts')),
  { flagReaders },
);

const paywall = src('src/app/premium/page.tsx');
check(
  'UT-PREM-10 entitlement(탭 unlock) 없음 + UT → Paywall · CTA 그대로 (unlock 기록은 복원에만 쓴다)',
  /if \(!hasPreviewUnlock\(featureId, funnelAnalysisId\)\) return;/.test(paywall) &&
    !/hasPreviewUnlock[^\n]*return null/.test(paywall) &&
    !/(unlock|entitlement)/i.test(JSON.stringify(Object.keys(access.utFlagsOff))),
);

const paymentModeWriters = [...code.keys()].filter(
  // dev fixture 라우트(production 404)는 판정 검사용으로 결제 상태를 일부러 만든다 — 제품 경로가 아니다
  (file) => file !== 'src/lib/premiumAccess.ts' && !file.startsWith('src/app/api/dev/') && /(mode|Mode)\s*[:=]\s*'payment'/.test(src(file)),
);
check(
  'UT-PREM-11 payment 없음 + UT → 콘텐츠 열림 · mode beta_ut · 결제 실행 false (결제 주장이 들어와도 UT는 결제로 표시하지 않음)',
  access.utFlagsOff.mode === 'beta_ut' &&
    access.utFlagsOff.paymentExecuted === false &&
    access.utPaymentClaimed.mode === 'beta_ut' &&
    access.utPaymentClaimed.paymentExecuted === false &&
    paymentModeWriters.length === 0,
  { utPaymentClaimed: access.utPaymentClaimed, paymentModeWriters },
);

check(
  'UT-PREM-12 localStorage 비어 있음 + ?mode=ut → UT (탭 기억은 sessionStorage · localStorage를 읽지 않음)',
  ut.freshWithQuery === true && !/localStorage/.test(src('src/lib/utMode.ts')) && /sessionStorage/.test(src('src/lib/utMode.ts')),
);

check(
  'UT-PREM-13 Premium route 새로고침(쿼리 없음) → 탭 기억으로 UT 유지',
  ut.refreshWithoutQuery === true,
);

const queryReaders = [...code.keys()].filter(
  (file) => file !== 'src/lib/utMode.ts' && /get\((['"])mode\1\)|mode=ut/.test(src(file)),
);
check(
  'UT-PREM-14 back/forward · 쿼리 없는 이동 → UT 유지 (popstate 구독 · 화면이 ?mode를 직접 읽거나 이어 붙이지 않음) · 리포트 복원 유지',
  ut.refreshWithoutQuery === true &&
    /addEventListener\('popstate'/.test(src('src/lib/utMode.ts')) &&
    queryReaders.length === 0 &&
    /setStage\('report'\);/.test(paywall),
  { queryReaders },
);

const COPY_FILES = [
  ...[...code.keys()].filter(
    (file) =>
      file.startsWith('src/components/premium/') ||
      file.startsWith('src/app/premium') ||
      file === 'src/data/premium.ts' ||
      file === 'src/data/premiumLens.ts' ||
      file === 'src/app/onboarding/page.tsx' ||
      file === 'src/components/onboarding/OnboardingVisual.tsx',
  ),
];
const ALLOWED = [/미리보기로 리포트를 열었어/];
const metaCopy = [];
for (const file of COPY_FILES) {
  const text = src(file);
  // 한글 · 문장 메타 표현 — 식별자에는 한글 · 공백이 없으므로 코드 전체에서 찾는다
  for (const match of text.matchAll(/[^'"`<>\n]*(개발용|테스트용|미리보기|fake door)[^'"`<>\n]*/gi)) {
    if (!ALLOWED.some((pattern) => pattern.test(match[0]))) metaCopy.push(`${file}: ${match[0].trim().slice(0, 60)}`);
  }
  // 배지형 대문자 리터럴 — 'preview' 같은 식별자 · 이벤트 이름은 사용자 문구가 아니다(대소문자 구분)
  for (const match of text.matchAll(/['"`>]\s*(PREVIEW|MOCK|DEBUG|FIXTURE|FAKE DOOR)\s*['"`<]/g)) {
    metaCopy.push(`${file}: ${match[0]}`);
  }
}
check('UT-PREM-15 Premium · 온보딩 사용자 문구 — 개발용 · 미리보기 · 테스트 · fake door · PREVIEW 0', metaCopy.length === 0, metaCopy);

console.log('\nPROD-PREM — 일반 사용자 정책 유지');

check(
  'PROD-PREM-01 UT 아님 → 기존 정책 (flag ON = 표면 · demo_unlock / flag OFF = 숨김 / preview flag = preview / 결제 확정만 payment)',
  access.prodDefault.surfaceEnabled === true &&
    access.prodDefault.mode === 'demo_unlock' &&
    access.prodDefault.previewRouteOpen === false &&
    access.prodFlagOff.surfaceEnabled === false &&
    access.prodPreview.mode === 'preview' &&
    access.prodPaid.mode === 'payment' &&
    // 서버 env flag에 따라 일반 사용자는 fake-door 또는 unavailable — UT 판정이 일반 사용자 결과를 덮지 않는다
    ['fake-door', 'unavailable'].includes(findKey(normalReport, 'premiumEntry')?.status),
  { prodDefault: access.prodDefault, prodFlagOff: access.prodFlagOff },
);

check(
  'PROD-PREM-02 UT override 누수 없음 — 쿼리 · 기억 없으면 false · 대소문자 · 비슷한 값 · 다른 저장값 false',
  ut.normalUser === false && ut.otherQuery === false && ut.lookalikeQuery === false && ut.staleStoredValue === false && ut.envOnly === true,
  ut,
);

const devPages = [...code.keys()].filter((file) => /^src\/app\/dev\/[^/]+\/page\.tsx$/.test(file));
check(
  `PROD-PREM-03 /dev 페이지 ${devPages.length}개 · ut-premium-test 라우트 — production 404 가드`,
  devPages.length >= 2 &&
    devPages.every((file) => /process\.env\.NODE_ENV === 'production'\) notFound\(\)/.test(src(file))) &&
    /process\.env\.NODE_ENV === 'production'\) \{\s*return Response\.json\(\{ ok: false, reason: 'NOT_FOUND' \}, \{ status: 404 \}\)/.test(
      src('src/app/api/dev/ut-premium-test/route.ts'),
    ),
);

/* ───────────────────────────── ONBOARDING */

console.log('\nONB — 온보딩 4장');

const copyRaw = await readFile(join(ROOT, 'src', 'data', 'copy.ts'), 'utf8');
const slidesBlock = stripComments(copyRaw.slice(copyRaw.indexOf('export const ONBOARDING_SLIDES'), copyRaw.indexOf('export const ONBOARDING_CTA')));
const slides = slidesBlock
  .split(/\n  \{\n/)
  .slice(1)
  .map((chunk) => ({
    text: [...chunk.matchAll(/'([^']*)'/g)].map((match) => match[1]).join(' '),
    visual: chunk.match(/visual: '(\w+)'/)?.[1],
    pose: chunk.match(/pose: '(\w+)'/)?.[1],
  }));

check('ONB-01 4장 · 그림 순서 signal → evidence → gap → history (배치 · 컴포넌트 유지)', slides.length === 4 && slides.map((slide) => slide.visual).join(',') === 'signal,evidence,gap,history', slides.map((slide) => slide.visual));
check('ONB-02 ① Hook — 궁합 질문으로 들어오되 최종 가치로 말하지 않음', /잘 맞을까/.test(slides[0]?.text) && /시작해도 괜찮아/.test(slides[0]?.text), slides[0]?.text);
check('ONB-03 ② Differentiation — 점수만이 아니라 왜 차이가 생기는지', /점수만/.test(slides[1]?.text) && /왜/.test(slides[1]?.text), slides[1]?.text);
check('ONB-04 ③ Core Value — 반복되는 반응 · 기준 → 다음에 확인할 것 / ④ Retention — 다시 보기 · 새 기록 비교', /반복/.test(slides[2]?.text) && /다음에/.test(slides[2]?.text) && /다시 보/.test(slides[3]?.text) && /비교/.test(slides[3]?.text), [slides[2]?.text, slides[3]?.text]);

const FORBIDDEN = /개발용|테스트용|데모용|fake door|실험용|마음을 알려|예측|정답|치유|보장|클라우드|cloud|서버에 저장|DB/i;
const lovyAssets = await readFile(join(ROOT, 'src', 'data', 'lovy.ts'), 'utf8');
check(
  'ONB-05 금지 표현 0 (메타 · 예측 · 정답 · 치유 · 보장 · 저장 기술 용어) · 캐릭터 에셋 기존 포즈',
  slides.every((slide) => !FORBIDDEN.test(slide.text)) &&
    slides.every((slide) => new RegExp(`\\b${slide.pose}: \\{`).test(lovyAssets)),
  slides.map((slide) => [slide.pose, slide.text.match(FORBIDDEN)?.[0] ?? null]),
);

const after = await guardCount();
check(`실제 Provider 호출 0 증가 (${before} → ${after})`, after === before);

console.log(`\n${failures.length === 0 ? '✅' : '❌'} UT Premium Fixture — ${passed} passed · ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
