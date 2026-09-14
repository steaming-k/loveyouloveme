/**
 * v1.47 — UT-2 Stability Fixture (UT-STABLE-01~24 · UT Health)
 *
 * 판정은 제품 함수로 계산한다:
 *   /api/dev/ut-stability-test   resolveUtMode · resolvePremiumAccess · parsePremiumReturn · participantKeysToClear · evaluateUtHealth
 *   /api/dev/premium-test        근거 부족 사유(resolvePremiumEvidenceState) · 리포트 가용성 · UT 판정(utMode 옵션)
 * 화면 배선(어느 분기가 무엇을 그리는가)은 정적 검사로, 실제 이동 · 새로고침 · 연타 · 초기화는 Browser QA로 확인한다.
 *
 * ⚠️ Provider를 부르지 않는다. 앞뒤로 실제 호출 카운터를 읽어 0 증가를 확인한다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:ut-stability`
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
  const suffix = detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 700)}`;
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
const raws = new Map();
const code = new Map();
for (const file of await walk(join(ROOT, 'src'))) {
  const raw = await readFile(file, 'utf8');
  raws.set(rel(file), raw);
  code.set(rel(file), stripComments(raw));
}
const src = (file) => {
  const text = code.get(file);
  if (text === undefined) throw new Error(`파일 없음: ${file}`);
  return text;
};

/** `if (조건) {`로 시작하는 블록 본문 — 분기가 무엇을 그리는지 본다 */
function blockAfter(text, marker) {
  const start = text.indexOf(marker);
  if (start < 0) return null;
  let depth = 0;
  for (let index = text.indexOf('{', start + marker.length - 1); index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

const before = await guardCount();

const stability = await (await fetch(`${BASE_URL}/api/dev/ut-stability-test`, { method: 'POST' })).json();
if (!stability.ok) throw new Error(`ut-stability-test 실패 — ${JSON.stringify(stability)}`);
const { utMode: ut, access, premiumReturn: ret, resetKeys, health } = stability;

/** 근거 부족 사용자 — 아무것도 답하지 않은 세션 */
const sparse = await run({ utMode: true });
const sparseEvidence = findKey(sparse, 'premiumEvidence');
const sparseGate = findKey(sparse, 'gate');
const sparseChapters = findKey(sparse, 'chapters');
/** 근거 충분 사용자 */
const full = await run({ ...SEM_B, utMode: true });
const fullEvidence = findKey(full, 'premiumEvidence');

const paywall = src('src/app/premium/page.tsx');
const preview = src('src/app/premium-preview/[feature]/page.tsx');
const entryRow = src('src/components/premium/PremiumEntryRow.tsx');
const bundle = src('src/components/premium/HomePremiumBundle.tsx');
const watcher = src('src/components/premium/PremiumReturnWatcher.tsx');
const shell = src('src/components/premium/PremiumEvidenceShell.tsx');
const utModeLib = src('src/lib/utMode.ts');
const notice = src('src/components/ai/AiModeNotice.tsx');
const reportView = src('src/components/premium/RelationshipDeepReportView.tsx');
const consoleSrc = src('src/components/ut/UtOperatorConsole.tsx');

console.log('\nUT-STABLE — 환경 · 저장소');

check('UT-STABLE-01 UT Preview 배포(env) → 새 탭 · 쿼리 없음 · 탭 기억 없음에도 UT', ut.deploymentNewTab === true, ut);
check(
  'UT-STABLE-02 쿼리 없는 UT Preview → Premium 표면 · 통로 열림',
  ut.deploymentNewTab === true && access.utFlagsOff.surfaceEnabled && access.utFlagsOff.previewRouteOpen,
);
check(
  'UT-STABLE-03 fresh browser → Premium 진입이 근거 상태와 무관하게 보임 (진입 행 · Home Bundle UT 분기)',
  /if \(feature\.status === 'unavailable' && !access\.utMode\) \{/.test(entryRow) &&
    /if \(feature\.status === 'unavailable' && !access\.utMode\) return null;/.test(bundle),
);
const compatibilityPage = src('src/app/compatibility/page.tsx');
const mirrorPage = src('src/app/mirror/page.tsx');
check(
  'UT-STABLE-03b 데이터 조건으로 숨던 진입점 — 궁합(Friction 0) · Mirror(GAP 0)에서도 UT면 Premium 진입 · 차이 약속 문구는 차이가 있을 때만',
  /\) : utMode \? \(\s*<div className="mt-6">\s*<PremiumEntryRow feature=\{premiumFeature\} source="compatibility" \/>/.test(compatibilityPage) &&
    /\{gapInsights\.length > 0 \|\| utMode \? \(/.test(mirrorPage) &&
    /hook=\{\s*gapInsights\.length > 0\s*\?/.test(mirrorPage),
);
check('UT-STABLE-04 localStorage 비어 있음 → UT 판정이 localStorage를 읽지 않음', !/localStorage/.test(utModeLib) && ut.deploymentNewTab);
check('UT-STABLE-05 sessionStorage 비어 있음 → env 배포는 탭 기억 없이 UT', ut.deploymentNewTab === true);
check('UT-STABLE-06 feature flag OFF → Premium visible', access.utFlagsOff.surfaceEnabled && access.utFlagsOff.previewRouteOpen);
check(
  'UT-STABLE-07 entitlement(탭 unlock) 없음 → Paywall · CTA 그대로 (unlock 기록은 복원에만)',
  /if \(!hasPreviewUnlock\(featureId, funnelAnalysisId\)\) return;/.test(paywall) && !/hasPreviewUnlock[^\n]*return null/.test(paywall),
);
check(
  'UT-STABLE-08 결제 미구현 → 콘텐츠 열림 · mode beta_ut · 결제 실행 false',
  access.utFlagsOff.mode === 'beta_ut' && access.utFlagsOff.paymentExecuted === false,
);

console.log('\nUT-STABLE — 근거 부족 · 입력 보완');

const paywallShell = blockAfter(paywall, "if (feature.status === 'unavailable' && access.utMode && isDeepReport) {");
const previewShell = blockAfter(preview, "if (isBetaUt && featureId === 'relationship_deep_report' && 'overview' in report && !report.available) {");
check(
  'UT-STABLE-09 근거 부족 → Premium shell (Paywall · Deep Report 통로 모두) · 채울 입력 ≥ 1',
  sparseEvidence?.state !== 'ready' &&
    (sparseEvidence?.fills?.length ?? 0) >= 1 &&
    fullEvidence?.state === 'ready' &&
    Boolean(paywallShell?.includes('<PremiumEvidenceShell')) &&
    Boolean(previewShell?.includes('<PremiumEvidenceShell')),
  { sparseEvidence, fullEvidence: fullEvidence?.state },
);
check(
  'UT-STABLE-10 근거 부족 → 가짜 리포트 0 (리포트 unavailable · Chapter 0 · shell 분기에 리포트 · unlock · 가격 없음)',
  sparseGate?.reportAvailable === false &&
    sparseGate?.eligible === false &&
    Array.isArray(sparseChapters) &&
    sparseChapters.length === 0 &&
    [paywallShell, previewShell].every(
      (block) => block && !/RelationshipDeepReportView|grantPreviewUnlock|setStage|formatPrice|handlePurchaseIntent/.test(block),
    ),
  { sparseGate, chapterCount: sparseChapters?.length },
);
check(
  'UT-STABLE-11 입력 보완 → Premium 자동 복귀 (주소 기억 · 체크포인트 · Paywall과 같은 판정 · 내부 경로만 · 만료)',
  /rememberPremiumReturn\(/.test(shell) &&
    /hasPremiumEvidence\(/.test(watcher) &&
    /navReplace\(href\)/.test(watcher) &&
    /<PremiumReturnWatcher \/>/.test(src('src/components/shell/AppShell.tsx')) &&
    ret.paywall === '/premium?source=compatibility&hook=friction_why#lens-saju' &&
    ret.previewRoute === '/premium-preview/relationship_deep_report' &&
    [ret.external, ret.protocolRelative, ret.nonPremium, ret.lookalike, ret.expired, ret.future, ret.garbage, ret.empty].every((value) => value === null),
  ret,
);

console.log('\nUT-STABLE — 이동 · 새로고침 · 새 탭');

check(
  'UT-STABLE-12 Premium 새로고침 → 리포트 복원 · UT 유지(탭 기억)',
  /hasPreviewUnlock\(featureId, funnelAnalysisId\)[\s\S]{0,200}setStage\('report'\)/.test(paywall) && /sessionStorage/.test(utModeLib),
);
const directRoutes = ['/premium?source=compatibility', '/premium?source=saju', '/premium-preview/relationship_deep_report', '/lens/mbti', '/lens/saju', '/lens/astrology'];
const directStatus = {};
for (const route of directRoutes) directStatus[route] = (await fetch(`${BASE_URL}${route}`, { redirect: 'manual' })).status;
check(
  'UT-STABLE-13 direct URL → 200 · redirect 없음 · 근거 부족이면 shell 분기',
  Object.values(directStatus).every((status) => status === 200) && Boolean(paywallShell) && Boolean(previewShell),
  directStatus,
);
const queryReaders = [...code.keys()].filter((file) => file !== 'src/lib/utMode.ts' && /get\((['"])mode\1\)|mode=ut/.test(src(file)));
check(
  'UT-STABLE-14 back/forward → popstate 구독 · 화면이 쿼리를 직접 읽지 않음',
  /addEventListener\('popstate'/.test(utModeLib) && queryReaders.length === 0,
  { queryReaders },
);
check(
  'UT-STABLE-15 새 탭 — UT Preview 배포에서 유지 / 쿼리만 쓴 배포는 새 탭에서 풀림(운영 문서 · Health가 경고)',
  ut.deploymentNewTab === true && ut.queryOnlyNewTab === false && health.queryOnly.items.find((item) => item.id === 'ut_mode')?.status === 'warn',
);
const session = src('src/state/SessionProvider.tsx');
check(
  'UT-STABLE-16 오래된 · 깨진 로컬 상태 → 안전 복구 (세션 try/catch · 필드별 강등 · 기록 스키마 필터 · 복귀 주소 무시)',
  /function deserialize\(raw: string\)[\s\S]{0,120}try \{/.test(session) &&
    /sanitizeScale\(parsed\.declared\?\.contact\)/.test(session) &&
    /parsed\.filter\(isEntry\)/.test(src('src/lib/historyRepository.ts')) &&
    ret.garbage === null,
);

console.log('\nUT-STABLE — 초기화 · 참가자 격리');

check(
  'UT-STABLE-17 Reset → 저장값 비우고 새로고침으로 온보딩 (메모리 상태까지 초기화)',
  /clearParticipantStorage\(\);\s*window\.location\.replace\(ROUTES\.onboarding\);/.test(consoleSrc),
);
const expectedCleared = [
  'lym.session.v1',
  'lym.history.v1',
  'lym.targets.v1',
  'lym.premium-preview-unlock.v1',
  'lym.premium-intent.v1',
  'lym.premium-return.v1',
  'lym.ut.deep.v1',
  'lym.ai.session',
  'lym.scroll.v1:premium:compatibility:abc',
  'lym.consent.v1',
];
const storageLiterals = [...new Set([...raws.values()].flatMap((text) => [...text.matchAll(/['"`](lym[.:_-][A-Za-z0-9._:-]*)['"`]/g)].map((match) => match[1])))];
const outsidePrefix = storageLiterals.filter((key) => !key.startsWith('lym.'));
check(
  `UT-STABLE-18 참가자 A → Reset → B: 참가자 키 전부 지움 · UT 탭 기억 · Supabase 링크 · 다른 앱 키 보존 · 코드의 저장 키 ${storageLiterals.length}개 모두 lym. 접두사`,
  JSON.stringify([...resetKeys].sort()) === JSON.stringify([...expectedCleared].sort()) && outsidePrefix.length === 0,
  { resetKeys, outsidePrefix },
);

console.log('\nUT-STABLE — 로딩 · 중복 · 실패');

check(
  'UT-STABLE-19 AI 대기 중 로딩 문구 (진행률 위조 없음 · Deep Report만)',
  /if \(status === 'loading' && loadingCopy\)/.test(notice) &&
    /loadingCopy=\{DEEP_REPORT_NARRATIVE_LOADING\}/.test(reportView) &&
    !/%|진행률|\d+\s*\/\s*\d+/.test((await readFile(join(ROOT, 'src/data/premium.ts'), 'utf8')).match(/DEEP_REPORT_NARRATIVE_LOADING = '([^']*)'/)?.[1] ?? '%'),
);
check(
  'UT-STABLE-20 CTA 연타 → 두 번째 클릭 무시 · 같은 요청은 in-flight 공유 · logical run id 재사용',
  /const handlePurchaseIntent = \(\) => \{\s*if \(stage !== 'paywall'\) return;/.test(paywall) &&
    /inFlight\.get\(key\)/.test(src('src/services/ai/aiClient.ts')) &&
    /deepReportRuns\.begin\(fingerprint\)/.test(src('src/hooks/useAiNarrative.ts')),
);
check(
  'UT-STABLE-21 AI 실패 → 다시 시도 버튼 (재시도 가능한 사유만) · Deep Report가 retry를 넘김',
  /다시 시도/.test(notice) && /onRetry=\{aiNarrative\.retry\}/.test(reportView),
);

console.log('\nUT-STABLE — 메타 문구 · 결제 · 일반 사용자');

const META_FILES = [...code.keys()].filter(
  (file) => file.startsWith('src/components/premium/') || file.startsWith('src/app/premium') || file === 'src/data/premium.ts' || file === 'src/data/premiumLens.ts',
);
const meta = [];
for (const file of META_FILES) {
  // 배지형 대문자 리터럴은 대소문자 구분('preview' 같은 식별자 · access mode 값은 사용자 문구가 아니다)
  for (const match of src(file).matchAll(/['"`>]\s*(BETA TEST|PREVIEW|TEST|MOCK)\s*['"`<]/g)) meta.push(`${file}: ${match[0]}`);
  for (const match of src(file).matchAll(/테스트용|개발용|demo unlock|fake door/gi)) meta.push(`${file}: ${match[0]}`);
}
const betaUt = (await readFile(join(ROOT, 'src/data/premium.ts'), 'utf8')).match(/betaUt: \{[^}]*\}/s)?.[0] ?? '';
check(
  'UT-STABLE-22 Premium 참가자 화면 메타 배지 · 문구 0 (BETA TEST · PREVIEW · 테스트용 · 개발용) · UT unlock 문구에 결제 반복 없음 · Bundle 테스트 문구 UT 분기',
  meta.length === 0 &&
    !/결제|테스트/.test(betaUt) &&
    /access\.utMode \? null : \(/.test(bundle) &&
    !/BETA TEST|결제 없이 먼저 보는/.test(preview),
  { meta, betaUt },
);
// dev fixture 라우트(production 404)는 '결제 가능 상태'를 일부러 만들어 Health 판정을 검사한다 — 제품 경로가 아니다
const paymentWriters = [...code.keys()].filter(
  (file) => file !== 'src/lib/premiumAccess.ts' && !file.startsWith('src/app/api/dev/') && /(mode|Mode)\s*[:=]\s*'payment'/.test(src(file)),
);
check(
  'UT-STABLE-23 UT 실제 결제 경로 없음 (훅 paymentConfirmed false · payment mode 작성 0 · Health가 결제 가능 상태를 BLOCKED)',
  src('src/hooks/useUtMode.ts').includes('paymentConfirmed: false') && paymentWriters.length === 0 && health.paymentPossible.ready === false,
  { paymentWriters },
);
check(
  'UT-STABLE-24 일반 Production 사용자 정책 불변 (demo_unlock · preview 통로 닫힘 · 운영자 화면은 dev 또는 UT 배포만)',
  access.prodDefault.mode === 'demo_unlock' &&
    access.prodDefault.surfaceEnabled === true &&
    access.prodDefault.previewRouteOpen === false &&
    /UT_OPERATOR_TOOLS_ENABLED = process\.env\.NODE_ENV !== 'production' \|\| UT_MODE;/.test(utModeLib) &&
    /if \(!UT_OPERATOR_TOOLS_ENABLED\) notFound\(\);/.test(src('src/app/ut/page.tsx')) &&
    !/\/ut['"`]/.test([...code.entries()].filter(([file]) => !file.startsWith('src/app/ut/') && !file.startsWith('src/components/ut/')).map(([, text]) => text).join('\n')),
);

console.log('\nUT-HEALTH — 운영자 점검 판정');

const statusOf = (result, id) => result.items.find((item) => item.id === id)?.status;
check('UT-HEALTH-01 모두 정상 → UT READY', health.allGood.ready === true && health.allGood.items.every((item) => item.status === 'pass'), health.allGood);
check('UT-HEALTH-02 UT 꺼짐 → UT BLOCKED (UT mode · Premium 표면 · 통로 fail)', health.utOff.ready === false && statusOf(health.utOff, 'ut_mode') === 'fail' && statusOf(health.utOff, 'premium_surface') === 'fail');
check('UT-HEALTH-03 Deep Report 통로 404 → UT BLOCKED', health.routeDown.ready === false && statusOf(health.routeDown, 'routes') === 'fail');
check('UT-HEALTH-04 결제 가능 상태 → UT BLOCKED', health.paymentPossible.ready === false && statusOf(health.paymentPossible, 'payment') === 'fail');
check(
  'UT-HEALTH-05 쿼리 전용 UT · demo AI · AI Debug 노출 · 깨진 세션 → READY지만 경고',
  [health.queryOnly, health.demoAi, health.aiDebugVisible, health.brokenSession].every((result) => result.ready === true) &&
    statusOf(health.queryOnly, 'ut_mode') === 'warn' &&
    statusOf(health.demoAi, 'ai_mode') === 'warn' &&
    statusOf(health.aiDebugVisible, 'participant_meta') === 'warn' &&
    statusOf(health.brokenSession, 'local_state') === 'warn',
);

const after = await guardCount();
check(`실제 Provider 호출 0 증가 (${before} → ${after})`, after === before);

console.log(`\n${failures.length === 0 ? '✅' : '❌'} UT Stability Fixture — ${passed} passed · ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
