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

import { SEM_B, run, stripComments } from './fixtures-v1464.mjs';

/** P1-05 · P1-09 — 같은 세션에서 '이 사람과 나는'만 바꾼다 */
const SEM_B_WITH_RELATION = (relation) => ({ ...SEM_B, target: { ...SEM_B.target, relation } });

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

/* ═════════════════════════════ P1 — Input Flow Compression / Progressive Disclosure */

console.log('\nP1 — 입력 흐름 압축 · 선택 입력 · 결과 accordion');

const lensTest = await readFile(join(ROOT, 'tests/run-lens-fixtures.mjs'), 'utf8');
const cacheKeySrc = await src('src/services/ai/aiCacheKey.ts');
const pastIntro = await src('src/app/profile/past/intro/page.tsx');
const declaredStep = await src('src/app/profile/declared/[step]/DeclaredStepView.tsx');
const disclosure = await src('src/components/common/OptionalDisclosureButton.tsx');
const eventSection = await src('src/components/profile/RelationshipEventSection.tsx');
const inline = await src('src/components/profile/CurrentRelationshipInline.tsx');
const mirrorPage = await src('src/app/mirror/page.tsx');
const currentPage = await src('src/app/profile/current/page.tsx');
const observedPage = await src('src/app/profile/observed/page.tsx');
const relationTypes = await src('src/types/index.ts');
const relationOptions = await src('src/data/targetFields.ts');
const relationLabels = await src('src/data/labels.ts');
const stageLogic = await src('src/lib/logic/relationshipStage.ts');

check(
  'P1-01 AI-LENS-18 — 옛 인라인 키 대신 aiCacheKey source of truth를 본다 (task · promptVersion · model · fingerprint)',
  !lensTest.includes("client.includes('${task}::${promptVersionOf(task)}::${fingerprint}')") &&
    lensTest.includes('src/services/ai/aiCacheKey.ts') &&
    cacheKeySrc.includes('`${task}::${promptVersion}::model=${model}::${fingerprint}`'),
);

check(
  'P1-02 S14 인트로 화면 제거 — Route는 첫 질문으로 replace(from 유지) · Declared 완료 → 과거 Q1 · 안내 문장은 Q1에 흡수',
  /navReplace\(withReturnTo\(ROUTES\.past\(1\), searchParams\)\)/.test(pastIntro) &&
    !/<Button|LovyMessage/.test(pastIntro) &&
    /resolveReturnDestination\(searchParams, ROUTES\.past\(1\)\)/.test(declaredStep) &&
    /누구와 만났는지는 묻지 않아/.test(pastStep) &&
    /step === 1\s*\?\s*ROUTES\.declared\(4\)/.test(pastStep),
);

check(
  'P1-03 이전 관계 있음 — Q1 → Q2 → (adaptive) → Q3 → 상대/First Contact · 건너뛰었다 돌아오면 resume',
  /if \(step === 1 && experience\.skipped\) resumeExperience\(\);/.test(pastStep) &&
    /router\.push\(resolveReturnDestination\(searchParams, afterProfileInput\)\);\s*return;/.test(pastStep) &&
    /const afterProfileInput = soloStatus \? ROUTES\.firstContact : ROUTES\.target;/.test(pastStep),
);

check(
  'P1-04 이전 관계 없음 — Q1의 건너뛰기 → 경험 비움 · 완료 표시 · E4 화면 없이 다음 입력 · 이미 고른 값이 있으면 버튼 숨김',
  /const handleSkip = \(\) => \{\s*skipExperience\(\);\s*markComplete\('experience'\);\s*markComplete\('profile'\);\s*trackEvent\('profile_complete', \{ path: 'no_experience' \}\);\s*router\.push\(resolveReturnDestination\(searchParams, afterProfileInput\)\);/.test(pastStep) &&
    /step === 1 && experience\.important\.length === 0 \? \(\s*<Button variant="text" onClick=\{handleSkip\}>/.test(pastStep),
);

const partnerRun = await run({ ...SEM_B_WITH_RELATION('partner') });
const crushRun = await run({ ...SEM_B_WITH_RELATION('crush') });
check(
  'P1-05 연인 · 배우자 보기 — canonical `partner` 1개 · 라벨 = 복원 Record · STAGE 규칙은 ex만 · 동기화율 불변',
  /\| 'partner'/.test(relationTypes) &&
    /\{ value: 'partner', label: '연인 · 배우자' \}/.test(relationOptions) &&
    /partner: '연인 · 배우자',/.test(relationLabels) &&
    !/partner/.test(stageLogic) &&
    partnerRun.compatibility.score === crushRun.compatibility.score &&
    partnerRun.compatibility.comparedCount === crushRun.compatibility.comparedCount,
  { partner: partnerRun.compatibility.score, crush: crushRun.compatibility.score },
);

const disclosureUsers = [target, eventSection].map((text) => (text.match(/<OptionalDisclosureButton/g) ?? []).length);
check(
  'P1-06 선택 입력 열기 버튼 — `· 선택` 유지 · 닫힘에 이유(benefit) + `+ 더 알려주기` + chevron · 상대 화면 MBTI · 좋아하는 것 · 사건 3곳',
  /\{eyebrow\} · 선택/.test(disclosure) &&
    /'\+ 더 알려주기'/.test(disclosure) &&
    /\{benefit\}/.test(disclosure) &&
    /<ChevronDown/.test(disclosure) &&
    disclosureUsers[0] === 2 &&
    disclosureUsers[1] === 1 &&
    !/'펼치기'/.test(target) &&
    !/'펼치기'/.test(eventSection),
  disclosureUsers,
);
check(
  'P1-07 aria-expanded · aria-controls — 버튼이 둘 다 갖고, 펼쳐진 영역 id가 panelId와 같다',
  /aria-expanded=\{open\}/.test(disclosure) &&
    /aria-controls=\{panelId\}/.test(disclosure) &&
    /panelId="target-mbti-panel"[\s\S]*id="target-mbti-panel"/.test(target) &&
    /panelId="target-interest-panel"[\s\S]*id="target-interest-panel"/.test(target) &&
    /panelId="target-event-panel"[\s\S]*id="target-event-panel"/.test(eventSection) &&
    /id=\{panelId\}/.test(inline),
);

check(
  "P1-08 사건 입력 화면 문구 — '장면' 0 · '이 사건 추가하기' · '기억나는 사건'",
  !/장면/.test(eventSection) && /이 사건 추가하기/.test(eventSection) && /기억나는 사건/.test(eventSection),
  eventSection.match(/[^\n]*장면[^\n]*/g),
);

const restoredEvent = await run({
  ...SEM_B_WITH_RELATION('crush'),
  target: { ...SEM_B_WITH_RELATION('crush').target, events: [{ id: 'ev-old-1', type: 'conflict', description: '약속 얘기로 서운했어' }] },
});
check(
  'P1-09 예전 사건 데이터 — 내부 타입 이름 그대로 · 저장된 사건이 리포트까지 복원',
  /'affection_felt'[\s\S]*'conflict'[\s\S]*'contact_change'[\s\S]*'other'/.test(relationTypes) &&
    restoredEvent.report.reportedScenes?.scenes?.[0]?.typeLabel === '갈등 · 서운했던 일',
  restoredEvent.report.reportedScenes?.scenes?.[0],
);

check(
  "P1-10 '지금 관계 속의 나' — 결과(궁합 · Mirror) 안 accordion · 기본 접힘 · 같은 질문 목록 · 별도 화면 링크 0 · Route 유지",
  /\{invitesCurrent \? <CurrentRelationshipInline className="mt-4" \/> : null\}/.test(compat) &&
    /\{invitesCurrent \? <CurrentRelationshipInline \/> : null\}/.test(mirrorPage) &&
    /const \[open, setOpen\] = useState\(false\);/.test(inline) &&
    /<CurrentSignalQuestionList \/>/.test(currentPage) &&
    !/ROUTES\.currentRelationship\(/.test(compat) &&
    !/ROUTES\.currentRelationship\(/.test(mirrorPage) &&
    (await fetch(`${BASE_URL}/profile/current`, { redirect: 'manual' })).status === 200,
);

const iInline = compat.indexOf('<CurrentRelationshipInline');
check(
  'P1-11 점수가 여전히 첫 결과 — SyncScore → 결과 한 문장 → FIRST SURPRISE → 관계 속의 나(접힘) → 신호',
  compat.indexOf('<SyncScore score={result.score} />') < compat.indexOf('{resultHeadline}') &&
    compat.indexOf('<FirstSurprise') < iInline &&
    iInline < compat.indexOf('id={RESULT_ANCHORS.compatibilityGood}'),
);

const emptyFooter = observedPage.slice(observedPage.indexOf('if (traits.length === 0 || photosGone || photosChanged)'));
check(
  'P1-12 S09가 흐름을 끊지 않는다 — 입력 단계 안내(caption) · 관찰 0개일 때 primary = 질문으로 계속 · 확인 후 Declared 1로',
  /caption="맞는지 하나만 알려주면 바로 다음 질문으로 넘어가\./.test(observedPage) &&
    emptyFooter.indexOf('질문으로 계속하기') < emptyFooter.indexOf('사진 더 고르기') &&
    /router\.push\(resolveReturnDestination\(searchParams, ROUTES\.declared\(1\)\)\);/.test(observedPage),
);

const after = await guardCount();
check(`실제 Provider 호출 0 증가 (${before} → ${after})`, after === before);

console.log(`\n${failures.length === 0 ? '✅' : '❌'} UT Follow-up P0 Fixture — ${passed} passed · ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
