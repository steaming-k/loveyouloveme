/**
 * 260914 UT 후속 — P0 Core Flow / Premium Boundary / Saju Regression
 *
 * ```
 * P0-01  실제 일주 경로 → DEMO 라벨 0 · 스텁 서비스 미사용 · 계산값이 만세력과 일치
 * P0-02  FREE 결과는 점수부터 (점수 → 결과 한 문장 → 접힌 근거)
 * P0-03  FREE에 첫 Insight가 있다 (결과 한 문장 · FIRST SURPRISE · LOVY OBSERVATION)
 * P0-04  FREE 화면에 Premium Action 블록이 없다
 * P0-05  FREE 화면에 Lens 번들 전체가 없다 (사주 화면은 일주 + 한 줄 + 질문 하나)
 * P0-06  UT에서 Premium CTA 유지 (궁합 · 사주)
 * P0-07  UT에서 Premium route 직접 진입 200
 * P0-08  입력 완료가 궁합 결과보다 앞선다 (S18 결과 화면이 입력 사이에 끼지 않음)
 * P0-09  Premium hook = 방금 본 축의 열린 질문 + 연결 약속 (ended는 행동 약속 없음)
 * ```
 *
 * ⚠️ Provider를 부르지 않는다. 앞뒤로 실제 호출 카운터를 읽어 0 증가를 확인한다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:ut-followup`
 */

import './_aiTestGuard.mjs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run, stripComments } from './fixtures-v1464.mjs';

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

const src = async (file) => stripComments(await readFile(join(ROOT, file), 'utf8'));

const before = await guardCount();

const saju = await src('src/app/lens/saju/page.tsx');
const compat = await src('src/app/compatibility/page.tsx');
const astrology = await src('src/app/lens/astrology/page.tsx');
const mbti = await src('src/app/lens/mbti/page.tsx');
const pastStep = await src('src/app/profile/past/[step]/PastStepView.tsx');
const pastNone = await src('src/app/profile/past/none/page.tsx');
const target = await src('src/app/target/page.tsx');
const entryRow = await src('src/components/premium/PremiumEntryRow.tsx');

console.log('\nP0 — Saju DEMO 회귀');

/* 같은 엔진이 Premium 번들에서 만든 값 — 화면이 쓰는 함수와 같다(readSajuDay) */
const SELF_BIRTH = { date: '1995-08-12', calendarType: 'solar', time: null, timeUnknown: false };
const TARGET_BIRTH = { date: '1990-05-15', calendarType: 'solar', time: null, timeUnknown: false };
const report = await run({
  status: 'dating',
  declared: { contact: 5, conflict: 'soon', alone: 4, affection: 'a2', hobby: 'h2' },
  experience: { important: ['contact'], hardest: 'contact_drop', selfGap: 'yes', adaptive: null },
  mbti: 'INFP',
  birthProfile: SELF_BIRTH,
  target: {
    relation: 'crush',
    contact: 'l',
    conflict: 'h',
    alone: 'h',
    affection: 'm',
    mbti: 'ENFP',
    birthProfile: TARGET_BIRTH,
    preferences: { interests: [] },
    events: [],
  },
});
const sajuLens = report.report.lensBundle.lenses.find((lens) => lens.kind === 'saju');
const pillarRows = (sajuLens?.basis ?? []).map((row) => row.value).join(' | ');

check(
  'P0-01 사주 화면 — DEMO · 엔진 미연결 문구 0 · sajuService 스텁 미사용 · readSajuDay 사용 · 계산값 을해/경진',
  !/DEMO|엔진 미연결|engineOff|sajuEngineAvailable/.test(saju) &&
    !/from '@\/services\/sajuService'/.test(saju) &&
    /readSajuDay\(mine, today\)/.test(saju) &&
    /readSajuDay\(theirs, today\)/.test(saju) &&
    sajuLens?.mode === 'pair' &&
    pillarRows.includes('을해(乙亥)') &&
    pillarRows.includes('경진(庚辰)'),
  { pillarRows },
);
check(
  'P0-01b 음력 입력은 계산하지 않고 이유를 말한다 (가짜 일주 0)',
  /isLunarBlocked\(mine, today\)/.test(saju) && /LENS_UNAVAILABLE_REASON\.sajuLunar/.test(saju),
);

console.log('\nP0 — FREE 결과 순서 · 경계');

const iScore = compat.indexOf('<SyncScore score={result.score} />');
const iHeadline = compat.indexOf('{resultHeadline}');
const iWhy = compat.indexOf('id={RESULT_ANCHORS.compatibilityWhy}');
const iSurprise = compat.indexOf('<FirstSurprise');
const iGood = compat.indexOf('id={RESULT_ANCHORS.compatibilityGood}');
check(
  'P0-02 FREE 점수 먼저 — SyncScore → 결과 한 문장 → 점수 근거(기본 접힘) → FIRST SURPRISE → 신호',
  iScore > 0 && iScore < iHeadline && iHeadline < iWhy && iWhy < iSurprise && iSurprise < iGood &&
    /const \[showScoreBasis, setShowScoreBasis\] = useState\(false\);/.test(compat) &&
    /\{showScoreBasis \? \(\s*<ReportEvidenceBlock>/.test(compat),
  { iScore, iHeadline, iWhy, iSurprise, iGood },
);
check(
  'P0-03 FREE 첫 Insight — 결과 한 문장 · FIRST SURPRISE · LOVY OBSERVATION이 조건 없이(데이터만으로) 렌더',
  /selectResultHeadline\(result\)/.test(compat) &&
    /selectFirstSurprise\(result\)/.test(compat) &&
    /label="LOVY OBSERVATION"/.test(compat),
);

const FREE_SCREENS = { compat, saju, astrology, mbti };
const actionLeaks = Object.entries(FREE_SCREENS)
  .filter(([, text]) => /actionPriority|buildPremiumActionPlan|PremiumActionPlan|RelationshipDeepReportView/.test(text))
  .map(([name]) => name);
check('P0-04 FREE 화면(궁합 · 렌즈 3종)에 Premium Action 블록 0', actionLeaks.length === 0, actionLeaks);

const bundleLeaks = Object.entries(FREE_SCREENS)
  .filter(([, text]) => /buildPremiumLensBundle|PremiumLensSection|crossLens/.test(text))
  .map(([name]) => name);
check(
  'P0-05 FREE 화면에 Lens 번들 0 · 사주 화면은 한 줄 해석 + 질문 하나만 (어긋나는 지점 · 음양 비교 없음)',
  bundleLeaks.length === 0 &&
    /relationNote\.reading/.test(saju) &&
    /relationNote\.question/.test(saju) &&
    !/watchFor|POLARITY_SELF|DAY_BRANCH_ELEMENT_SELF/.test(saju),
  bundleLeaks,
);

console.log('\nP0 — UT Premium visibility');

check(
  'P0-06 UT Premium CTA — 궁합: Friction 없어도 utMode 진입 · 사주: 진입 행 · 진입 행은 UT에서 unavailable 카드로 바꾸지 않음',
  /\) : utMode \? \(\s*<div className="mt-6">\s*<PremiumEntryRow feature=\{premiumFeature\} source="compatibility" \/>/.test(compat) &&
    /source="saju"/.test(saju) &&
    /utMode,/.test(saju) &&
    /if \(feature\.status === 'unavailable' && !access\.utMode\)/.test(entryRow),
);

const routes = ['/premium?source=saju&mode=ut', '/premium?source=compatibility&mode=ut', '/lens/saju', '/compatibility'];
const routeStatus = {};
for (const route of routes) {
  routeStatus[route] = (await fetch(`${BASE_URL}${route}`, { redirect: 'manual' })).status;
}
check('P0-07 Premium · 사주 · 궁합 route 직접 진입 → 200', Object.values(routeStatus).every((s) => s === 200), routeStatus);

console.log('\nP0 — 입력 → 결과 흐름');

check(
  'P0-08 입력 완료 → 상대 입력 / First Contact (S18 결과 화면이 입력 사이에 없음) · 프로필 완료는 입력 시점 · 수정 복귀는 유지',
  !/ROUTES\.profileResult/.test(pastStep) &&
    /soloStatus \? ROUTES\.firstContact : ROUTES\.target/.test(pastStep) &&
    /resolveReturnDestination\(searchParams,/.test(pastStep) &&
    /markComplete\('profile'\)/.test(pastStep) &&
    !/ROUTES\.profileResult/.test(pastNone) &&
    /soloStatus \? ROUTES\.firstContact : ROUTES\.target/.test(pastNone) &&
    !/backHref=\{ROUTES\.profileResult\}/.test(target) &&
    /router\.push\(ROUTES\.compatibilityAnalyzing\)/.test(target),
);

check(
  'P0-09 Premium hook — 제목이 방금 본 Friction 축에서 만들어짐 · 연결 약속 · ended는 확인 행동 약속 없음 · hook key 유지',
  /title: `\$\{topFriction\.label\}, 실제로는 어떤 순간에 어긋날까\?`/.test(compat) &&
    /variant: 'friction_why'/.test(compat) &&
    /job === 'ended'\s*\?\s*`[^`]*`/.test(compat) &&
    !/job === 'ended'\s*\?\s*`[^`]*확인할 것[^`]*`/.test(compat),
);

const after = await guardCount();
check(`실제 Provider 호출 0 증가 (${before} → ${after})`, after === before);

console.log(`\n${failures.length === 0 ? '✅' : '❌'} UT Follow-up P0 Fixture — ${passed} passed · ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
