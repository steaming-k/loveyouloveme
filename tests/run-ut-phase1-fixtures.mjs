/**
 * 1차 UT(09/11 · 09/14 · 09/15) 전체 Backlog — 남은 P0 · P1 회귀 고정
 *
 * ```
 * P0-1 Premium 노출 안정성
 *   UT-ALL-P0-01  결과 화면마다 Premium 진입 행이 있다 (E3 확신 낮음 포함)
 *   UT-ALL-P0-02  렌즈 3화면이 전부 같은 flagship을 가리킨다 (다른 상품을 팔지 않는다)
 *   UT-ALL-P0-03  UT 모드에서는 surface가 env flag와 무관하게 열린다
 *
 * P0-2 Premium 상품 구조 — Lens Bundle
 *   UT-ALL-P0-04  렌즈 화면의 가격 CTA가 '따로 파는 게 아니다'를 말한다
 *   UT-ALL-P0-05  가격 문자열은 `formatPrice` 한 곳에서만 나온다 (화면에 하드코딩 0)
 *   UT-ALL-P0-06  Home Bundle · Paywall이 '한 번에 열린다'를 명시한다
 *   UT-ALL-P0-07  unlock 이후 렌즈 탐색 화면에는 결제 CTA가 없다
 *
 * P0-3 · P0-4 Target 동기화 / score-first
 *   UT-ALL-P0-08  같은 세션 target의 source-of-truth가 하나다 (`SessionProvider`)
 *   UT-ALL-P0-09  새 상대로 바꾸면 funnel 단위가 새로 발급된다 (이전 리포트 자격이 안 넘어온다)
 *   UT-ALL-P0-10  궁합 결과의 첫 블록이 동기화율이다 (score-first)
 *
 * P1
 *   UT-ALL-P1-01  사용자가 적는 relationship event UI는 `사건`이다 (`장면` 0)
 *   UT-ALL-P1-02  선택 입력에 펼치기 affordance(`OptionalDisclosureButton`)가 붙어 있다
 *   UT-ALL-P1-03  추천 질문에 폐기된 공격적 문장이 없다
 *   UT-ALL-P1-04  Home 중복 진입점 정리 후에도 프로필 경로가 남는다
 *   UT-ALL-P1-05  관계 상태 보기에 연인·배우자 / 이전 관계 / 잘 모름이 있다
 *   UT-ALL-P1-06  결과 단계에 Lovy checkpoint가 있다 (도배 아님)
 *
 * CLOSED
 *   UT-ALL-CLOSED-01  참가자 UI에 효과음 재생 소스가 없다
 *   UT-ALL-CLOSED-02  가짜 모집단 통계(전국 %)를 만들지 않는다
 * ```
 *
 * ⚠️ 이 스크립트는 **소스만 읽는다.** dev 서버도 Provider도 부르지 않는다 —
 *    판정 대상이 전부 '무엇이 화면에 적혀 있는가'라서 런타임이 필요 없다.
 *
 * 실행: `npm run test:ut-phase1`
 */

import './_aiTestGuard.mjs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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

/** 주석을 지운 소스 — 판정은 **실제로 실행·렌더되는 코드**에서만 한다 */
const src = async (file) => stripComments(await readFile(join(ROOT, file), 'utf8'));
const raw = async (file) => readFile(join(ROOT, file), 'utf8');

const LENS_PAGES = [
  'src/app/lens/saju/page.tsx',
  'src/app/lens/mbti/page.tsx',
  'src/app/lens/astrology/page.tsx',
];

/* ═══════════════════════════ P0-1 Premium 노출 안정성 */

console.log('\nUT-ALL-P0-1 — Premium이 정상 state에서 사라지지 않는다');

const compatibility = await src('src/app/compatibility/page.tsx');

check(
  'UT-ALL-P0-01 궁합 결과에 Premium 진입 행이 2개 이상 있다 (본문 + E3 확신 낮음)',
  (compatibility.match(/<PremiumEntryRow/g) ?? []).length >= 3,
  (compatibility.match(/<PremiumEntryRow/g) ?? []).length,
);

/*
  0911 UT의 "프리미엄이 안 보임"이 마지막까지 남아 있던 자리다. E3(상대 정보 3개 미만)는
  결과 화면이 맞는데 진입 행이 **한 번도 없었다.** 함수 본문 안에 있는지로 검사한다 —
  파일 어딘가에 있다는 것만으로는 이 화면에 붙었다는 뜻이 아니다.
*/
const lowConfidenceView = compatibility.slice(compatibility.indexOf('function LowConfidenceView'));
check(
  'UT-ALL-P0-01 E3(확신 낮음) 화면에도 Premium 진입 행이 있다',
  lowConfidenceView.includes('<PremiumEntryRow'),
);
check(
  'UT-ALL-P0-01 E3는 본문과 같은 판정을 쓴다 (자격을 우회하지 않는다)',
  lowConfidenceView.includes('premiumFeatureState') &&
    lowConfidenceView.includes('hasPremiumEvidence'),
);

for (const page of LENS_PAGES) {
  const source = await src(page);
  check(
    `UT-ALL-P0-02 ${page.split('/')[3]} 렌즈가 flagship 하나만 가리킨다`,
    /premiumFeatureState\(\s*'relationship_deep_report'/.test(source) &&
      !source.includes("'mbti_detail'") &&
      !source.includes("'astrology_detail'") &&
      !source.includes("'saju_detail'"),
  );
}

const premiumAccess = await src('src/lib/premiumAccess.ts');
check(
  'UT-ALL-P0-03 UT 모드는 env flag와 무관하게 surface를 연다',
  /input\.utMode[\s\S]{0,200}surfaceEnabled:\s*true/.test(premiumAccess),
);

/* ═══════════════════════════ P0-2 Lens Bundle 상품 구조 */

console.log('\nUT-ALL-P0-2 — ₩1,900이 하나의 상품 가격으로 읽힌다');

const premiumLensData = await src('src/data/premiumLens.ts');
const bundleCard = await src('src/components/premium/PremiumBundleCard.tsx');

/*
  ══ 핵심 판정 ═══════════════════════════════════════════════════════════════

  문제는 문구가 아니라 **정보 구조**였다. 렌즈 화면이 `PremiumEntryRow`(자기 가격
  줄을 갖는 행)를 쓰는 한, 보조 문구를 몇 줄 붙여도 화면은 여전히 '이 렌즈의 가격'을
  보여준다. 그래서 검사도 문구가 아니라 **어떤 컴포넌트를 쓰는가**를 본다.
*/
for (const page of LENS_PAGES) {
  const name = page.split('/')[3];
  const source = await src(page);
  check(
    `UT-ALL-P0-04 ${name} 렌즈 화면이 Bundle 카드를 쓴다 (가격 있는 진입 행이 아니다)`,
    source.includes('<PremiumBundleCard'),
  );
  check(
    `UT-ALL-P0-04 ${name} 렌즈 화면이 지금 보는 렌즈를 묶음 안에서 표시한다`,
    /currentLens="(mbti|saju|zodiac)"/.test(source),
  );
  check(
    `UT-ALL-P0-04 ${name} 렌즈 화면의 Bundle attribution이 lens_bundle이다`,
    source.includes('hookVariant="lens_bundle"'),
  );
  /*
    `PremiumEntryRow`는 **`unavailable` 분기에만** 남는다. 그 상태는 가격도 CTA도
    붙이지 않고(§40) 보완 경로 버튼을 주는 자리라 dead-end를 막는 데 필요하다.
    가격이 붙는 정상 상태에서 이 행이 다시 쓰이면 ₩1,900 × 3이 되돌아온다.
  */
  const entryRowUses = source.match(/<PremiumEntryRow/g) ?? [];
  check(
    `UT-ALL-P0-04 ${name} 렌즈 화면의 PremiumEntryRow는 unavailable 분기 하나뿐이다`,
    entryRowUses.length <= 1 &&
      (entryRowUses.length === 0 ||
        /status === 'unavailable'[\s\S]{0,200}<PremiumEntryRow/.test(source)),
    entryRowUses.length,
  );
  /*
    0911 참가자가 실제로 밟은 경로(사주 → MBTI → 별자리)에서 가격이 세 번 보였다.
    화면이 가격 문자열을 직접 적으면 번들 구조와 어긋난 자리가 조용히 생긴다.
  */
  check(
    `UT-ALL-P0-05 ${name} 렌즈 화면에 가격 문자열이 하드코딩돼 있지 않다`,
    !/₩\s?1,?900|1,900원/.test(source),
  );
}

check(
  'UT-ALL-P0-05 가격 표기는 formatPrice 한 곳에서만 만들어진다',
  (await src('src/lib/premiumVariant.ts')).includes('toLocaleString'),
);

/*
  §35 — 렌즈 행에는 **가격을 넣을 자리 자체가 마크업에 없다.** 값이 비어 있는 게
  아니라 없다 — 나중에 누가 채워 넣을 수 없게 하려는 것이다.
*/
const lensRowBlock = bundleCard.slice(
  bundleCard.indexOf('LENS_ORDER.map'),
  bundleCard.indexOf('lockedNote'),
);
check(
  'UT-ALL-P0-05 Bundle 카드의 렌즈 행에 가격을 그리는 코드가 없다',
  !/formatPrice|price/.test(lensRowBlock),
  lensRowBlock.slice(0, 200),
);
check(
  'UT-ALL-P0-05 Bundle 카드에서 가격은 한 번만 그려진다',
  (bundleCard.match(/formatPrice\(/g) ?? []).length === 1,
  (bundleCard.match(/formatPrice\(/g) ?? []).length,
);

check(
  "UT-ALL-P0-06 Home Bundle이 '한 번 열면 전부'를 말한다",
  /lensListLabel:\s*'한 번 열면/.test(premiumLensData) &&
    /lockedNote:\s*'따로 파는 게 아니라/.test(premiumLensData),
);
check(
  "UT-ALL-P0-06 Paywall 렌즈 목록이 '따로 결제하는 게 아니다'를 말한다",
  /LENS_PAYWALL_COPY[\s\S]{0,600}따로 결제하는 게 아니라/.test(premiumLensData),
);
check(
  'UT-ALL-P0-06 렌즈 화면 부제가 세 관점이 한 리포트에 들어 있음을 말한다',
  /lensContextDescription:[\s\S]{0,200}사주 · MBTI · 별자리/.test(premiumLensData),
);

/*
  ⚠️ unlock 이후에는 **가격을 그리지 않는다.** 이미 연 리포트 옆의 가격은 살 것을
  가리키지 않는다 — 렌즈를 탐색하는 동안 ₩1,900이 계속 따라다니면 렌즈마다 또 내야
  하는 것으로 읽힌다.
*/
check(
  'UT-ALL-P0-07 unlock 상태에서는 Bundle 카드가 가격을 그리지 않는다',
  /\{unlocked \? null : \([\s\S]{0,400}formatPrice\(price\)/.test(bundleCard),
);
/*
  unlock 이후 세 렌즈는 **탐색**이지 결제가 아니다.
*/
const lensSection = await src('src/components/premium/PremiumLensSection.tsx');
check(
  'UT-ALL-P0-07 unlock 이후 렌즈 섹션에 가격·결제 CTA가 없다',
  !/formatPrice|₩|결제하기|purchaseCta/.test(lensSection),
);

/* ═══════════════════════════ P0-3 · P0-4 Target / score-first */

console.log('\nUT-ALL-P0-3 — same-session target · score-first');

/*
  0911 "상대 입력 내용 동기화 안 됨"의 구조적 원인은 target 저장소가 여러 개일 때 생긴다.
  진입점이 늘어도 읽는 곳이 하나면 route마다 다른 상대가 보일 수 없다.
*/
const sessionProvider = await src('src/state/SessionProvider.tsx');
const storageWriters = (sessionProvider.match(/localStorage\.setItem/g) ?? []).length;
check(
  'UT-ALL-P0-08 세션 target을 쓰는 저장소가 SessionProvider 한 곳이다',
  storageWriters === 1,
  storageWriters,
);
const strayTargetStores = [];
for (const file of [
  'src/app/target/page.tsx',
  'src/app/compatibility/page.tsx',
  'src/app/home/page.tsx',
  'src/app/mirror/page.tsx',
  ...LENS_PAGES,
]) {
  const source = await src(file);
  if (/localStorage\.setItem|sessionStorage\.setItem/.test(source)) strayTargetStores.push(file);
}
check(
  'UT-ALL-P0-08 결과·입력 route가 자기만의 target 저장소를 두지 않는다',
  strayTargetStores.length === 0,
  strayTargetStores,
);
check(
  'UT-ALL-P0-09 새 상대로 바꾸면 funnelAnalysisId가 새로 발급된다',
  /resetTargetContext[\s\S]{0,2000}funnelAnalysisId:\s*crypto\.randomUUID\(\)/.test(sessionProvider),
);

/*
  score-first 계약: 결과 진입 후 첫 focal point가 동기화율이어야 한다.
  본문 JSX에서 SyncScore가 상세 근거(SignalCard)·Premium보다 먼저 나오는지로 본다.
*/
const syncScoreAt = compatibility.indexOf('<SyncScore');
const firstSignalAt = compatibility.indexOf('<SignalCard');
const firstPremiumAt = compatibility.indexOf('<PremiumEntryRow');
check(
  'UT-ALL-P0-10 궁합 결과에서 동기화율이 상세 근거·Premium보다 먼저 온다',
  syncScoreAt > 0 && syncScoreAt < firstSignalAt && syncScoreAt < firstPremiumAt,
  { syncScoreAt, firstSignalAt, firstPremiumAt },
);

/* ═══════════════════════════ P1 */

console.log('\nUT-ALL-P1 — 용어 · 입력 가시성 · 질문 · 진입점');

/*
  용어 계약: 사용자가 직접 적는 relationship event = `사건`, 사진·서술 scene = `장면`.
  입력 UI에서 두 말이 섞이면 무엇을 적는 칸인지 알 수 없다(260914 UT §5 · §6).
*/
const eventSection = await src('src/components/profile/RelationshipEventSection.tsx');
check(
  'UT-ALL-P1-01 사건 입력 UI에 `장면` 표기가 없다',
  !eventSection.includes('장면'),
  eventSection.match(/.{0,40}장면.{0,40}/g),
);
check(
  'UT-ALL-P1-01 사건 입력 UI가 `사건`으로 묻고 `사건`으로 추가한다',
  eventSection.includes('기억나는 사건이 있었어?') && eventSection.includes('이 사건 추가하기'),
);
check(
  'UT-ALL-P1-01 렌즈 회고 문구도 `장면`을 쓰지 않는다',
  !/LENS_THEME_QUESTION_FORMER[\s\S]{0,1200}장면/.test(premiumLensData),
);

check(
  'UT-ALL-P1-02 선택 입력에 펼치기 affordance가 붙어 있다 (상대 입력 · 사건 · 현재 관계)',
  (await src('src/app/target/page.tsx')).includes('<OptionalDisclosureButton') &&
    eventSection.includes('<OptionalDisclosureButton') &&
    (await src('src/components/profile/CurrentRelationshipInline.tsx')).includes(
      '<OptionalDisclosureButton',
    ),
);

/*
  0911 §7 · §8 — 추천 질문은 심문이 아니라 대화 시작점이다. 전제를 깔거나(`싸웠을 때`)
  양을 묻는(`어느 정도 시간이 필요해`) 문장은 폐기됐다.
*/
const DEPRECATED_QUESTIONS = [
  '싸웠을 때 어느 정도 시간이 필요해',
  '혼자 있고 싶을 때 상대에게 어떻게 알려주는 게 편해',
];
const questionSources = [
  await src('src/data/conversationQuestions.ts'),
  await src('src/lib/logic/userFitQuestions.ts'),
  await src('src/lib/logic/conversationQuestions.ts'),
].join('\n');
for (const phrase of DEPRECATED_QUESTIONS) {
  check(`UT-ALL-P1-03 폐기된 질문이 없다 — "${phrase}"`, !questionSources.includes(phrase));
}

/*
  0911 §21 · §25 — Home의 프로필 진입은 하단 `나`와 겹쳐서 제거됐다. 다만 **접근 경로가
  사라지면 안 된다** — 중복 정리가 dead-end를 만들면 그건 고친 게 아니다.
*/
const home = await src('src/app/home/page.tsx');
check(
  'UT-ALL-P1-04 Home 본문에 중복 프로필 진입 행이 없다',
  !home.includes('내 관계 프로필 보기'),
);
check(
  'UT-ALL-P1-04 프로필 접근 경로는 하단 Nav에 남아 있다',
  (await src('src/components/common/BottomNavigation.tsx')).includes('ROUTES.profileResult') ||
    (await src('src/components/common/BottomNavigation.tsx')).includes('profileResult'),
);

const targetFields = await src('src/data/targetFields.ts');
for (const label of ['연인 · 배우자', '이전 관계', '잘 모름', '알아가는 중']) {
  check(`UT-ALL-P1-05 관계 상태 보기에 '${label}'이 있다`, targetFields.includes(label));
}

/*
  260914 §9 · 0915 — '캐릭터랑 티키타카 하다가 갑자기 글자만 남는다'. 결과 단계에도
  러비가 남아야 한다. 다만 **도배는 금지**다(§33) — 있다/없다만 본다.
*/
for (const [label, file] of [
  ['궁합', 'src/app/compatibility/page.tsx'],
  ['Mirror', 'src/app/mirror/page.tsx'],
  ['Premium 리포트', 'src/components/premium/RelationshipDeepReportView.tsx'],
  ['사주 렌즈', 'src/app/lens/saju/page.tsx'],
]) {
  const source = await src(file);
  check(
    `UT-ALL-P1-06 ${label} 결과에 Lovy checkpoint가 있다`,
    /* `<Lovy>` · `<LovyMessage>` · `<LovyNote>` 전부 센다 — 결과마다 쓰는 형태가 다르다 */
    /<Lovy[A-Za-z]*[\s/>]/.test(source),
  );
}

/* ═══════════════════════════ CLOSED */

console.log('\nUT-ALL-CLOSED — 다시 살아나면 안 되는 것');

/*
  0911 §24에서 제거를 요청했고 260914 UT에서 참가자가 "소리 아무것도 안 나"로 확인했다.
  이 검사는 제거를 다시 하는 게 아니라 **되살아나지 않게 고정**하는 것이다.
*/
const audioHits = [];
for (const file of [
  'src/components/shell/AppShell.tsx',
  'src/components/lovy/Lovy.tsx',
  'src/components/lovy/LovyMessage.tsx',
  'src/components/lovy/LovySequence.tsx',
  'src/app/layout.tsx',
  'src/app/home/page.tsx',
  'src/app/compatibility/page.tsx',
  'src/app/onboarding/page.tsx',
]) {
  const source = await src(file);
  if (/new Audio\(|AudioContext|\.play\(\)|<audio|\.mp3|\.wav|\.ogg/.test(source)) {
    audioHits.push(file);
  }
}
check('UT-ALL-CLOSED-01 참가자 UI에 효과음 재생 소스가 없다', audioHits.length === 0, audioHits);

/*
  0911 §18은 '전국의 X%'를 원했지만 모집단 데이터가 없다. HYPOTHESIS로 남기고,
  **숫자를 지어내지 않는다** — 없는 통계를 만들면 그건 기능이 아니라 거짓말이다.
*/
const populationHits = [];
for (const file of [
  'src/data/copy.ts',
  'src/data/premium.ts',
  'src/data/premiumLens.ts',
  'src/services/premiumService.ts',
]) {
  const source = await raw(file);
  const body = stripComments(source);
  if (/전국(의)?\s*\d|상위\s*\d+\s*%|백분위|percentile/.test(body)) populationHits.push(file);
}
check(
  'UT-ALL-CLOSED-02 가짜 모집단 통계(전국 % · 백분위)를 만들지 않는다',
  populationHits.length === 0,
  populationHits,
);

/* ═══════════════════════════ UT-2 RC */

console.log('\nUT-2 RC — 2차 UT를 막는 회귀');

/*
  RC-01 — **선택형 심화 입력은 새로고침을 견뎌야 한다.**

  `DeepInputView`는 질문 목록을 마운트 시점에 한 번 고정한다(의도된 설계 — 답할 때마다
  다시 고르면 방금 답한 질문이 목록에서 빠진다). 그래서 **복원이 끝난 뒤에** 첫 렌더가
  일어나야 하고, 그걸 보장하는 게 `HydrationGate`다. 게이트가 없으면 새로고침·주소 직접
  진입에서 빈 세션으로 질문을 고르고 그 빈 목록이 그대로 박힌다 — 세션에 답이 다 있는데도
  '더 물어볼 건 관계 이야기가 쌓이면 그때 물어볼게'만 뜨는 dead-end가 된다.

  2차 UT에서 이건 조용한 오염이다: 참가자가 심화 입력을 **안 쓴 것**으로 보이지만
  실제로는 화면이 질문을 준 적이 없다 — H1이 재려는 바로 그 행동이 사라진다.
*/
const deepPage = await src('src/app/profile/deep/page.tsx');
const deepView = await src('src/app/profile/deep/DeepInputView.tsx');
check(
  'RC-01 선택형 심화 입력 화면이 HydrationGate 안에 있다',
  deepPage.includes('<HydrationGate>'),
);
check(
  'RC-01 질문 목록 freeze는 그대로다 (복원 시점만 바뀐다)',
  /useState\(\(\) => selectDeepInputQuestions\(answers\)\)/.test(deepView),
);

/*
  RC-02 — **마운트에 파생값을 얼리는 화면은 반드시 게이트 안에 있어야 한다.**
  같은 결함이 다른 입력 화면에 새로 생기면 똑같이 조용히 사라진다.
*/
const ungated = [];
for (const dir of ['deep', 'past/adaptive', 'declared/[step]', 'past/[step]']) {
  const pageSrc = await src(`src/app/profile/${dir}/page.tsx`);
  let viewSrc = '';
  for (const view of ['DeepInputView.tsx', 'PastStepView.tsx', 'DeclaredStepView.tsx']) {
    try {
      viewSrc += await src(`src/app/profile/${dir}/${view}`);
    } catch {
      /* 그 폴더에 없는 뷰는 건너뛴다 */
    }
  }
  /* `answers`에서 파생된 값을 마운트에 얼리는가 — 단순 초기값(false/null/0 등)은 제외 */
  const freezesDerived = /useState\(\(\) => (?!false|true|null|0\b|new Date|resolvePriceVariant)\w/.test(
    pageSrc + viewSrc,
  );
  if (freezesDerived && !pageSrc.includes('<HydrationGate>')) ungated.push(dir);
}
check(
  'RC-02 마운트에 파생값을 고정하는 입력 화면은 전부 HydrationGate 안에 있다',
  ungated.length === 0,
  ungated,
);

/* ═══════════════════════════ CONCEPT POLISH */

console.log('\nCONCEPT — 차별점이 장식으로 바뀌지 않게');

/*
  CONCEPT-01 / 02 — Evidence → Connection 시각화는 **이미 있는 provenance만** 쓴다.

  이 블록이 위험한 이유: 보기 좋게 만들려고 node를 하나 더 넣거나, source가 하나뿐일 때
  화살표를 그려버리면 그 순간 '근거처럼 보이는 장식'이 된다. 그건 이 제품이 가장 피해야
  하는 종류의 거짓말이고, 화면만 보면 진짜 근거와 구분되지 않는다.

  ⚠️ CONCEPT-03(번들 가격 1회)·CONCEPT-04(score-first)는 **새로 만들지 않았다** —
  UT-ALL-P0-05 · UT-ALL-P0-10이 이미 같은 invariant를 검사한다.
*/
const trail = await src('src/components/premium/EvidenceConnectionTrail.tsx');

check(
  'CONCEPT-01 연결 시각화의 입력은 chapter.sourceGroups 하나뿐이다 (새 데이터 없음)',
  /groups:\s*readonly PremiumSourceGroup\[\]/.test(trail) &&
    !/fetch\(|useState|useEffect|Math\.random/.test(trail),
);
check(
  'CONCEPT-01 라벨·순서를 자체 생성하지 않고 헤더와 같은 함수를 쓴다',
  trail.includes('chapterSourceLabels') && !/GROUP_LABEL|sort\(/.test(trail),
);
check(
  'CONCEPT-02 source가 2종 미만이면 아무것도 그리지 않는다 (가짜 연결 금지)',
  /labels\.length < 2\)?\s*return null/.test(trail),
);
/*
  호출부도 함께 본다 — 컴포넌트가 아무리 안전해도, 호출부가 sourceGroups 대신 다른 값을
  만들어 넣으면 같은 결함이 돌아온다.
*/
const accordion = await src('src/components/premium/PremiumChapterAccordion.tsx');
check(
  'CONCEPT-02 호출부가 chapter.sourceGroups를 그대로 넘긴다',
  /<EvidenceConnectionTrail[\s\S]{0,160}groups=\{chapter\.sourceGroups\}/.test(accordion),
);

/*
  CONCEPT — 같은 의미를 연속으로 두 번 부르지 않는다.
  다가가는 힌트의 카테고리 라벨이 kind마다 구분돼야 한다(같으면 제목이 두 번 보인다).
*/
const hintLabels = await src('src/lib/logic/approachHints.ts');
const labelBlock = hintLabels.slice(
  hintLabels.indexOf('APPROACH_HINT_KIND_LABEL'),
  hintLabels.indexOf('APPROACH_HINT_KIND_LABEL') + 400,
);
const labelValues = [...labelBlock.matchAll(/:\s*'([^']+)'/g)].map((match) => match[1]);
check(
  'CONCEPT 다가가는 힌트 카테고리 라벨이 서로 다르다',
  new Set(labelValues).size === labelValues.length,
  labelValues,
);

/*
  CONCEPT — YOUR SIGNAL은 핵심 한 문장이 이미 부른 축을 다시 부르지 않는다.
  fallback으로 `frictionSignals[0]`를 다시 집으면 중복이 그대로 돌아온다.
*/
const lovyNotes = await src('src/data/lovyNotes.ts');
check(
  'CONCEPT YOUR SIGNAL이 핵심 문장에 없는 축을 고른다',
  lovyNotes.includes('headlineLabelsOf') && /!named\.has\(dimension\.label\)/.test(lovyNotes),
);

/* ═══════════════════════════ 결과 */

console.log(`\n${failures.length === 0 ? '✅' : '❌'} ut-phase1 — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.log(`  · ${failure}`);
  process.exit(1);
}
