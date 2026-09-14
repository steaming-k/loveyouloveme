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

/* ═════════════════════════════ P1 Final — S09 UT 평가 제거 */

console.log('\nP1F — 사진 관찰 단계에서 UT 평가 제거');

const photosPage = await src('src/app/profile/photos/page.tsx');
const utConsole = await src('src/components/ut/UtOperatorConsole.tsx');
const utRatingCard = await src('src/components/ut/UtRatingCard.tsx');

check(
  'P1F-01 참가자 S09 — UT 유사도 평가 카드 · 문항 · 이벤트 0',
  !/UtRatingCard|ut_analysis_similarity_rate|얼마나 비슷해/.test(observedPage),
);
check(
  'P1F-02 S09 관찰 확인 → 바로 다음 질문(Declared 1)',
  /<Button onClick=\{handleNext\}>확인했어 · 질문으로 계속<\/Button>/.test(observedPage) &&
    /router\.push\(resolveReturnDestination\(searchParams, ROUTES\.declared\(1\)\)\);/.test(observedPage),
);
check(
  'P1F-03 사진 없음 → 질문으로 (사진 입력 건너뛰기 · 관찰 0개 primary)',
  /const handleSkip = \(\) => \{[\s\S]{0,200}router\.push\(resolveReturnDestination\(searchParams, ROUTES\.declared\(1\)\)\);/.test(photosPage) &&
    emptyFooter.indexOf('질문으로 계속하기') < emptyFooter.indexOf('사진 더 고르기'),
);
check(
  'P1F-04 운영자 경로에 평가 도구 유지 — /ut 콘솔에 같은 이벤트 문항',
  /<UtRatingCard[\s\S]{0,200}event="ut_analysis_similarity_rate"/.test(utConsole),
);
const participantRatingHosts = [];
for (const file of ['src/app/profile/observed/page.tsx', 'src/app/profile/photos/page.tsx', 'src/app/profile/analyzing/page.tsx', 'src/app/profile/past/[step]/PastStepView.tsx', 'src/app/target/page.tsx', 'src/app/profile/declared/[step]/DeclaredStepView.tsx']) {
  if (/UtRatingCard/.test(await src(file))) participantRatingHosts.push(file);
}
check(
  'P1F-05 참가자 입력 경로에 평가 메타 UI 0 · 평가 카드는 UT가 아니면 렌더하지 않음 · /ut Production 404 유지',
  participantRatingHosts.length === 0 && /if \(!utMode\) return null;/.test(utRatingCard),
  participantRatingHosts,
);

/* ═════════════════════════════ P2 — Result Value-Density */

console.log('\nP2 — 결과 알맹이 밀도 · 러비 · 시각화');

const compatP2 = await src('src/app/compatibility/page.tsx');
const mirrorP2 = await src('src/app/mirror/page.tsx');
const lensBlocks = await src('src/components/lens/LensStateBlocks.tsx');
const scaleHearts = await src('src/components/common/ScaleHearts.tsx');
const comparisonRow = await src('src/components/mirror/MirrorComparisonRow.tsx');
const historyRow = await src('src/components/history/HistoryChangeRow.tsx');
const hintsLogic = await src('src/lib/logic/approachHints.ts');
const actionPlanSection = await readFile(join(ROOT, 'src/components/premium/PremiumActionPlanSection.tsx'), 'utf8').catch(() => '');
const metaCopy = await src('src/lib/premiumMetaCopy.ts');
const candidateSection = await src('src/components/premium/PremiumCandidateSection.tsx');
const reportedLogic = await src('src/lib/logic/relationshipEvents.ts');
const resolver = await src('src/lib/aiEvidenceResolver.ts');
const onboardingVisual = await src('src/components/onboarding/OnboardingVisual.tsx');

const idx = (text, needle) => text.indexOf(needle);
check(
  'P2-01 궁합 점수가 긴 텍스트보다 먼저 — SyncScore가 첫 ReportSection · 신호 카드보다 앞',
  idx(compatP2, '<SyncScore score={result.score} />') > 0 &&
    /* `<ReportSectionEyebrow`(점수 위 번호 표식)가 아니라 번호 붙은 섹션 본체 */
    idx(compatP2, '<SyncScore score={result.score} />') < compatP2.search(/<ReportSection\s/),
);
check(
  'P2-02 첫 takeaway — 궁합: 점수 바로 다음 결과 한 문장 / Mirror: 핵심 문장이 비교 행보다 먼저',
  idx(compatP2, '{resultHeadline}') < idx(compatP2, 'id={RESULT_ANCHORS.compatibilityWhy}') &&
    idx(mirrorP2, 'id={RESULT_ANCHORS.mirrorCoreInsight}') < idx(mirrorP2, '<FreeInsightSection') &&
    idx(mirrorP2, 'id={RESULT_ANCHORS.mirrorCoreInsight}') < idx(mirrorP2, '<MirrorComparisonRow'),
);
check(
  'P2-03 기본 노출 블록의 입력 재진술 축소 — 헤더 meta에 신호 개수 0 · 점수 사용법은 접힌 근거 안(ended만 노출)',
  !/관찰한 신호 \$\{/.test(compatP2) &&
    !/비교한 신호 \$\{/.test(compatP2) &&
    /\{job !== 'ended' \? ` \$\{jobCopy\.scoreUse\}` : ''\}/.test(compatP2) &&
    /\{job === 'ended' \? \(\s*<p[^>]*>\s*\{jobCopy\.scoreUse\}/.test(compatP2),
);
check(
  'P2-04 같은 결론 반복 없음 — Mirror 핵심 문장 블록 1개 · 점프 칩(ResultSectionNav) 제거',
  (mirrorP2.match(/id=\{RESULT_ANCHORS\.mirrorCoreInsight\}/g) ?? []).length === 1 &&
    !/ResultSectionNav/.test(mirrorP2) &&
    (mirrorP2.match(/\{headline\}/g) ?? []).length === 1,
);
check(
  'P2-05 접힌 근거는 계속 열 수 있다 — 점수 근거 토글 · 신호 근거(details) · Mirror MATCH 자세히',
  /aria-expanded=\{showScoreBasis\}/.test(compatP2) &&
    /<details/.test(await src('src/components/compatibility/SignalCard.tsx')) &&
    /aria-expanded=\{open\}/.test(comparisonRow),
);
check(
  'P2-06 러비 checkpoint — 점수 직후(FIRST SURPRISE) · FREE→Premium · Next Move 뒤 · Mirror 핵심 · 렌즈 질문',
  /<Lovy pose="question"/.test(await src('src/components/compatibility/FirstSurprise.tsx')) &&
    /premiumAccess\.surfaceEnabled \? \(\s*<LovyMessage/.test(compatP2) &&
    /showOutwardQuestions \? \(\s*<LovyMessage/.test(compatP2) &&
    /<Lovy pose="note" size=\{28\} decorative \/>\s*러비가 가장 눈여겨본 부분/.test(mirrorP2) &&
    /<Lovy pose="question" size=\{28\} decorative \/>\s*러비의 한 가지 질문/.test(lensBlocks),
);
check(
  'P2-07 숫자 척도 = 하트 수 — 숫자 유지(`{value}/{max}`) · 채운 하트 = value · 하트는 aria-hidden · Mirror · History 적용',
  /\{value\}\/\{max\}/.test(scaleHearts) &&
    /index < filled/.test(scaleHearts) &&
    /const filled = Math\.max\(0, Math\.min\(max, value\)\);/.test(scaleHearts) &&
    /aria-hidden/.test(scaleHearts) &&
    /<ScaleHearts value=\{insight\.declared\} \/>/.test(comparisonRow) &&
    /<ScaleHearts value=\{value\}/.test(historyRow),
);
check(
  "P2-08 렌즈 질문 — 가벼운 코너('러비의 한 가지 질문') · 첫 질문 1개 + 나머지 펼치기 · 저장 이벤트 유지 · '이야기해볼 주제' 0",
  /prompts\.slice\(0, 1\)/.test(lensBlocks) &&
    /aria-expanded=\{showAll\}/.test(lensBlocks) &&
    /lens_conversation_question_save/.test(lensBlocks) &&
    !/이야기해볼 주제/.test(lensBlocks),
);
check(
  "P2-09 generic 추천이 핵심처럼 안 보임 — activity · conversation 힌트는 첫 카드가 되지 않고 '가벼운 아이디어'로 표시",
  /const GENERIC_HINT_KINDS: ReadonlySet<ApproachHint\['kind'\]> = new Set\(\['activity', 'conversation'\]\);/.test(compatP2) &&
    /density=\{index === 0 && !GENERIC_HINT_KINDS\.has\(hint\.kind\) \? 'primary' : 'compact'\}/.test(compatP2) &&
    /activity: '가벼운 아이디어 · 같이 해볼 것',/.test(hintsLogic),
);
check(
  'P2-10 Core Action Layer 무변경 — 궁합/Mirror FREE 화면에 Action 블록 0 · Action 섹션 파일 존재',
  !/PremiumActionPlanSection|buildPremiumActionPlan/.test(compatP2 + mirrorP2) && actionPlanSection.length > 0,
);
check(
  "P2-11 '사건' 용어 — 사용자 입력을 가리키는 화면 라벨(리포트 헤더 · 사건 블록 · 카드 라벨 · 근거 칩 · 온보딩)",
  /parts\.push\('기억나는 사건'\)/.test(metaCopy) &&
    /네가 알려준 사건 · \{scene\.typeLabel\}/.test(candidateSection) &&
    /title: '네가 알려준 사건',/.test(reportedLogic) &&
    /sourceLabel: '내가 알려준 사건',/.test(resolver) &&
    /label: '내가 알려준 사건'/.test(onboardingVisual) &&
    !/이 장면/.test(reportedLogic),
);
check(
  'P2-12 UT Premium visibility 유지 — 궁합 Friction 0 UT 진입 · 진입 행 UT 분기 그대로',
  /\) : utMode \? \(\s*<div className="mt-6">\s*<PremiumEntryRow feature=\{premiumFeature\} source="compatibility" \/>/.test(compatP2) &&
    /\{gapInsights\.length > 0 \|\| utMode \? \(/.test(mirrorP2),
);

/* ═════════════════════════════ Relationship Language (P3) */

console.log('\nREL-LANG — 관계 언어 체계');

const langFiles = {
  pastStep: await src('src/app/profile/past/[step]/PastStepView.tsx'),
  profileResult: await src('src/app/profile/result/page.tsx'),
  historyReport: await src('src/app/history/report/page.tsx'),
  historyPage: await src('src/app/history/page.tsx'),
  home: await src('src/app/home/page.tsx'),
  bottomNav: await src('src/components/common/BottomNavigation.tsx'),
  premiumData: await src('src/data/premium.ts'),
  evidenceState: await src('src/lib/logic/premiumEvidenceState.ts'),
  profileLogic: await src('src/lib/logic/profile.ts'),
  copyData: await src('src/data/copy.ts'),
  firstContactData: await src('src/data/firstContact.ts'),
  savedLib: await src('src/lib/persistence/savedRelationships.ts'),
  savedSection: await src('src/components/account/SavedRelationshipsSection.tsx'),
  analyticsLib: await src('src/lib/analytics.ts'),
  routesLib: await src('src/lib/routes.ts'),
};
const featureLabelHits = Object.entries(langFiles)
  .filter(([, text]) => /이전 관계 경험 (알려주기|고치기)|이전 관계와 비교|caption: '이전 관계'|이전 관계에서 실제로 나타난 너|이제 이전 관계를 짧게/.test(text))
  .map(([name]) => name);
check(
  "REL-LANG-01 상위 기능 이름에 '이전 관계' 0 — 도입 · 수정 허브 · Premium 보완 CTA · 레이어 caption · History 비교 문구",
  featureLabelHits.length === 0 &&
    /이제 관계 경험을 짧게 돌아볼게/.test(langFiles.pastStep) &&
    /label="관계 경험 답변 고치기"/.test(langFiles.profileResult) &&
    /experience: '관계 경험 알려주기',/.test(langFiles.premiumData) &&
    /label: '관계 경험 알려주기',/.test(langFiles.evidenceState) &&
    /이전 관찰 기록과 비교하면/.test(langFiles.historyReport),
  featureLabelHits,
);
check(
  "REL-LANG-02 관계 선택의 '이전 관계'(status)는 유지 — 칩 · 복원 라벨 · STAGE ended",
  /\{ value: 'ex', label: '이전 관계' \}/.test(relationOptions) &&
    /ex: '이전 관계',/.test(relationLabels) &&
    /answers\.target\.relation === 'ex'\) return 'ended'/.test(stageLogic),
);
check(
  'REL-LANG-03 연인 · 배우자 선택 유지',
  /\{ value: 'partner', label: '연인 · 배우자' \}/.test(relationOptions) && /partner: '연인 · 배우자',/.test(relationLabels),
);
check(
  'REL-LANG-04 내부 이름 무변경 — TargetRelation ex · tense current/former · route /profile/past · analytics key · Supabase relation_status',
  /\| 'ex'/.test(relationTypes) &&
    /export type RelationshipTense = 'current' \| 'former';/.test(relationTypes) &&
    /pastIntro: '\/profile\/past\/intro'/.test(langFiles.routesLib) &&
    /past: \(step: number\) => `\/profile\/past\/\$\{step\}`/.test(langFiles.routesLib) &&
    /'relationship_experience_skip'/.test(langFiles.analyticsLib) &&
    /'relationship_experience_complete'/.test(langFiles.analyticsLib) &&
    /relation_status text/.test(await readFile(join(ROOT, 'supabase/migrations/20260914000000_v147_persistence_foundation.sql'), 'utf8')),
);

const endedRun = await run({ ...SEM_B, status: 'ended', target: { ...SEM_B.target, relation: 'ex' } });
const currentRun = await run({ ...SEM_B, status: 'dating' });
check(
  "REL-LANG-05 끝난 관계 과거형 유지 — 사건 블록 '그 관계에서' · 한계 '그때' · 지금 관계 0",
  endedRun.report.reportedScenes?.lovyNote?.startsWith('그 관계에서') &&
    endedRun.report.reportedScenes?.limitation?.includes('그때') &&
    !(endedRun.headerLine ?? '').includes('지금 관계'),
  { lovyNote: endedRun.report.reportedScenes?.lovyNote, header: endedRun.headerLine },
);
check(
  "REL-LANG-06 지금 관계 현재형 유지 — 사건 블록 '이 관계에서' · '그때' 0",
  currentRun.report.reportedScenes?.lovyNote?.startsWith('이 관계에서') &&
    !currentRun.report.reportedScenes?.limitation?.includes('그때'),
  { lovyNote: currentRun.report.reportedScenes?.lovyNote },
);
check(
  "REL-LANG-07 연애 경험 없음 — 건너뛰기 '이전 연애가 없어' · 결핍 프레이밍('없네' · '아직 없어') 0",
  /이전 연애가 없어 · 건너뛰기/.test(langFiles.pastStep) &&
    !/아직 관계 기록은 없네/.test(langFiles.copyData) &&
    !/확인할 기록은 아직 없어/.test(langFiles.firstContactData),
);
check(
  "REL-LANG-08 저장한 관계 — 과거/현재 중립 이름 · '이전 관계' 0",
  /label: '저장한 관계'/.test(langFiles.savedLib) && !/이전 관계/.test(langFiles.savedSection + langFiles.savedLib),
);
check(
  "REL-LANG-09 Home · History · 하단 탭 — '관찰 기록' 계열 · '이전 관계' · '관계 히스토리' 0",
  /<SectionLabel>관찰 기록<\/SectionLabel>/.test(langFiles.historyPage) &&
    /label: '관찰기록'/.test(langFiles.bottomNav) &&
    !/이전 관계|관계 히스토리/.test(langFiles.home + langFiles.historyPage + langFiles.bottomNav),
);
check(
  "REL-LANG-10 온보딩 · 프로필 — Relationship Me = '관계 경험' (S06 소개 · 프로필 레이어 caption)",
  /caption: '관계 경험에서 실제로 나타난 너'/.test(langFiles.copyData) && /caption: '관계 경험',/.test(langFiles.profileLogic),
);
const currentTexts = [currentRun.headerLine ?? '', ...(currentRun.report.candidates ?? []).flatMap((c) => [c.soWhat, c.limitation ?? '']), currentRun.report.reportedScenes?.limitation ?? ''];
const endedTexts = [endedRun.headerLine ?? '', ...(endedRun.report.candidates ?? []).flatMap((c) => [c.soWhat, c.limitation ?? '']), endedRun.report.reportedScenes?.limitation ?? ''];
check(
  "REL-LANG-11 Premium/Deep Report 시점 — 지금 관계를 '그때 이 관계'로 · 끝난 관계를 '지금 관계'로 부르지 않음",
  !currentTexts.some((t) => t.includes('그때 이 관계')) && !endedTexts.some((t) => t.includes('지금 관계에서')),
  { currentHits: currentTexts.filter((t) => t.includes('그때 이 관계')), endedHits: endedTexts.filter((t) => t.includes('지금 관계에서')) },
);
const hypothesesDoc = await readFile(join(ROOT, 'docs/UT2_followup_hypotheses.md'), 'utf8').catch(() => '');
const languageDoc = await readFile(join(ROOT, 'docs/RELATIONSHIP_LANGUAGE.md'), 'utf8').catch(() => '');
check(
  'REL-LANG-12 P3 문서 — UT2-H1~H5 · 관계 언어 사전(필수 용어 9개 · internal/UI 분리)',
  ['UT2-H1', 'UT2-H2', 'UT2-H3', 'UT2-H4', 'UT2-H5'].every((h) => hypothesesDoc.includes(`## ${h}`)) &&
    ['관계 경험', '이전 관계', '지금 관계', '끝난 관계', '관찰 기록', '저장한 관계', '사건', '장면', '연인 · 배우자'].every((term) => languageDoc.includes(term)) &&
    languageDoc.includes('rename 금지'),
);

const after = await guardCount();
check(`실제 Provider 호출 0 증가 (${before} → ${after})`, after === before);

console.log(`\n${failures.length === 0 ? '✅' : '❌'} UT Follow-up P0 Fixture — ${passed} passed · ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
