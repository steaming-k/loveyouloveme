/**
 * 260915 UT 후속 — 사진 근거 / Navigation / 점수 설명 / 심화 입력 / 공유
 *
 * ```
 * P0-1 사진 오인이 관계 맥락으로 확장되지 않는다
 *   UT15-P0-01  사용자가 거절한 관찰은 downstream 어디에도 가지 않는다
 *   UT15-P0-02  사물 라벨 하나가 '반려동물과 함께'를 만들지 않는다 (소품 차단 · 근거 칸)
 *   UT15-P0-03  사진 근거 provenance(어느 사진 · 무슨 라벨)가 남는다
 *
 * P0-2 분석 Navigation / 수정 경로
 *   UT15-P0-04  결과 화면 Back은 진입 경로를 따른다 (정적 push 아님)
 *   UT15-P0-05  결과 화면에 하단 Nav가 **항상** 있다 (revisit 조건 없음) · 입력 화면에는 없다
 *   UT15-P0-06  수정 진입점이 결과 화면 3곳에서 열리고 목적지가 전부 기존 Route다
 *   UT15-P0-07  중복 '나' 진입점 정리 후에도 프로필 접근 경로가 남는다
 *
 * P0-3 점수 설명
 *   UT15-P0-08  점수 설명에 '연애 성공확률' 0
 *   UT15-P0-09  점수 설명이 관계 상태를 언급하지 않는다 (연인 · 배우자 · 이전 관계 공용)
 *
 * P1-1 선택형 심화 입력
 *   UT15-P1-01  선택이다 — 기본 흐름에 없고, 나가는 길이 항상 있고, 최대 2개다
 *   UT15-P1-02  건너뛰면 기존 결과가 그대로다 (점수 · Mirror 판정 동일)
 *   UT15-P1-03  답하면 그 축의 근거만 늘고 **점수는 그대로다**
 *   UT15-P1-06  AI에게 '적힌 범위 밖으로 나가지 말라'가 명시돼 있다
 *
 * P1-2 '기타' 자유 입력
 *   UT15-P1-04  300자 상한이 저장 단계에서 걸린다 · 비워두면 넘어가지 않는다
 *   UT15-P1-05  provenance 보존 — 저장/복원 후에도 값과 키 순서가 같다
 *   UT15-P1-07  '기타' 세 글자가 근거 문장으로 새지 않는다
 *
 * P1-3 · P2 Lovy · 공유
 *   UT15-P1-08  Lovy checkpoint가 결과 단계에 있다 (도배 아님)
 *   UT15-P2-01  공유 진입점이 결과를 다 읽은 자리에도 있다
 *   UT15-P2-02  공유 라벨이 **실제 동작**을 넘어 약속하지 않는다
 * ```
 *
 * ⚠️ Provider를 부르지 않는다. 앞뒤로 실제 호출 카운터를 읽어 0 증가를 확인한다.
 * ⚠️ 순수 함수 판정은 `/api/dev/ut15-test`가 **제품과 같은 함수**를 불러 돌려준다 —
 *    테스트가 규칙을 다시 구현하지 않는다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:ut15`
 */

import './_aiTestGuard.mjs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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

const src = async (file) => stripComments(await readFile(join(ROOT, file), 'utf8'));
const raw = async (file) => readFile(join(ROOT, file), 'utf8');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const before = await guardCount();

const fixtureResponse = await fetch(`${BASE_URL}/api/dev/ut15-test`, { method: 'POST' });
if (!fixtureResponse.ok) {
  throw new Error(`ut15-test ${fixtureResponse.status} — dev 서버가 떠 있는지 확인해줘`);
}
const fx = await fixtureResponse.json();

/* ═══════════════════════════════ P0-1 사진 근거 */

console.log('\nUT15-P0-1 — 사진 오인이 관계 맥락으로 확장되지 않는다');

check(
  "UT15-P0-02 인형이 함께 보이는 사진은 'pet'을 만들지 않는다 (소품 차단)",
  !fx.photo.dollCategories.includes('pet'),
  fx.photo.dollCategories,
);
check(
  "UT15-P0-02 사물 칸에만 있는 동물 라벨은 'pet'을 만들지 않는다 (확신도가 높아도)",
  !fx.photo.objectOnlyCategories.includes('pet'),
  fx.photo.objectOnlyCategories,
);
check(
  "UT15-P0-02 행위로 확인된 반려동물은 그대로 'pet'이 된다 (덜 세기만 하고 막지는 않는다)",
  fx.photo.realPetCategories.includes('pet'),
  fx.photo.realPetCategories,
);
check(
  'UT15-P0-03 사진 근거 provenance — photoIds와 원본 라벨이 남는다',
  fx.photo.petProvenance.length > 0 &&
    fx.photo.petProvenance.every((item) => item.photoIds.length > 0 && item.evidence.length > 0),
  fx.photo.petProvenance,
);

check(
  "UT15-P0-01 '아니야'만 누른 관찰은 받아들이지 않는다 (고쳐 쓰면 받아들인다)",
  fx.reject.acceptedWhenRejected === false &&
    fx.reject.acceptedWhenCorrected === true &&
    fx.reject.acceptedWhenExcluded === false &&
    fx.reject.acceptedWhenUntouched === true,
  fx.reject,
);
check(
  "UT15-P0-01 거절한 관찰의 status가 'rejected'다 ('unverified'와 구분된다)",
  same(fx.reject.statuses, [
    ['t_ok', 'unverified'],
    ['t_no', 'rejected'],
  ]),
  fx.reject.statuses,
);
check(
  'UT15-P0-01 거절한 관찰이 분석 대상에서 빠진다',
  same(fx.reject.analysisReadyIds, ['t_ok']),
  fx.reject.analysisReadyIds,
);
check(
  "UT15-P0-01 'rejected'와 'excluded'를 같은 규칙으로 막는다",
  fx.reject.refusedRejected &&
    fx.reject.refusedExcluded &&
    !fx.reject.refusedUnverified &&
    !fx.reject.refusedConfirmed,
  fx.reject,
);
check(
  'UT15-P0-01 AI 인용 허용 목록에도 거절한 관찰이 없다',
  same(fx.reject.allowedObservedTraitIds, ['t_ok']),
  fx.reject.allowedObservedTraitIds,
);

/* ═══════════════════════════════ P0-2 Navigation */

console.log('\nUT15-P0-2 — 분석 Navigation / 수정 경로');

const compat = await src('src/app/compatibility/page.tsx');
const mirror = await src('src/app/mirror/page.tsx');
const profileResult = await src('src/app/profile/result/page.tsx');
const editSheet = await src('src/components/result/ResultEditSheet.tsx');
const screenHeader = await src('src/components/common/ScreenHeader.tsx');
const home = await src('src/app/home/page.tsx');
const bottomNav = await src('src/components/common/BottomNavigation.tsx');
const pastStep = await src('src/app/profile/past/[step]/PastStepView.tsx');
const targetPage = await src('src/app/target/page.tsx');

check(
  'UT15-P0-04 결과 화면 Back은 진입 경로를 따른다 (ScreenHeader가 useContextualBack · backHref는 직접 진입 fallback)',
  /useContextualBack\(backHref \?\? ROUTES\.home\)/.test(screenHeader) &&
    !/router\.push\(backHref/.test(screenHeader),
);

const navAlways = (text) => /nav=\{<BottomNavigation \/>\}/.test(text);
const navGated = (text) => /nav=\{revisit \? <BottomNavigation/.test(text);
check(
  'UT15-P0-05 결과 화면 3곳에 하단 Nav가 항상 있다 (revisit 조건 제거)',
  [compat, mirror, profileResult].every((text) => navAlways(text) && !navGated(text)),
  {
    compat: navAlways(compat),
    mirror: navAlways(mirror),
    profileResult: navAlways(profileResult),
  },
);
check(
  'UT15-P0-05 입력 화면에는 하단 Nav를 붙이지 않는다 (퍼널 중간 이탈 방지)',
  !/BottomNavigation/.test(pastStep) && !/BottomNavigation/.test(targetPage),
);

check(
  'UT15-P0-06 수정 허브가 결과 화면 3곳에서 열린다',
  [compat, mirror, profileResult].every((text) => /<ResultEditSheet/.test(text)),
);
check(
  'UT15-P0-06 수정 목적지가 전부 기존 Route다 (새 Route를 만들지 않았다)',
  [
    'ROUTES.target',
    'ROUTES.declared(1)',
    'ROUTES.past(1)',
    'ROUTES.photos',
    'ROUTES.observed',
    'ROUTES.lensBirth',
  ].every((route) => editSheet.includes(route)),
);

check(
  'UT15-P0-07 Home 헤더 아바타 제거 후에도 프로필 접근 경로가 남는다 (하단 나 탭 · 수정 허브)',
  !/aria-label="내 프로필 보기"/.test(home) &&
    /<BottomNavigation/.test(home) &&
    /ROUTES\.profileResult/.test(bottomNav),
);

/* ═══════════════════════════════ P0-3 점수 설명 */

console.log('\nUT15-P0-3 — 점수 설명');

const copyData = await raw('src/data/copy.ts');
const shareCompat = await src('src/app/share/compatibility/page.tsx');

check(
  'UT15-P0-08 점수 설명에 "연애 성공확률" 0 (공유 화면 포함)',
  !/notice: '[^']*연애 성공확률/.test(copyData) && !/연애 성공확률/.test(shareCompat),
);

/** 관계 상태를 가리키는 말이 들어가면 상태에 따라 문장이 거짓이 된다 */
const RELATION_WORDS = ['연애', '연인', '커플', '부부', '배우자', '썸', '이전 관계'];
check(
  'UT15-P0-09 점수 설명이 관계 상태를 언급하지 않는다 (모든 상태에서 같은 뜻)',
  RELATION_WORDS.every((word) => !fx.score.notice.includes(word)),
  fx.score.notice,
);

/* ═══════════════════════════════ P1-1 선택형 심화 입력 */

console.log('\nUT15-P1-1 — 선택형 심화 입력');

const deepView = await src('src/app/profile/deep/DeepInputView.tsx');

check(
  'UT15-P1-01 심화 입력은 선택이다 — 진입은 text 버튼, 화면에 나가는 길이 있다',
  /\+ 더 자세히 알려주기 \(선택\)/.test(pastStep) && /이만 됐어/.test(deepView),
);
check(
  'UT15-P1-01 질문을 AI가 만들지 않는다 (고정 pool에서 규칙으로 고른다)',
  /selectDeepInputQuestions/.test(deepView) && !/fetch\(/.test(deepView),
);
check(
  `UT15-P1-01 한 번에 최대 ${fx.deepInput.max}개만 묻는다`,
  fx.deepInput.offeredIds.length > 0 && fx.deepInput.offeredIds.length <= fx.deepInput.max,
  fx.deepInput.offeredIds,
);
check(
  'UT15-P1-01 같은 입력이면 같은 질문이 나온다 (무작위 아님)',
  same(fx.deepInput.offeredIds, fx.deepInput.stableIds),
  { offered: fx.deepInput.offeredIds, again: fx.deepInput.stableIds },
);
check(
  'UT15-P1-01 가장 힘들었던 축을 먼저 묻는다',
  fx.deepInput.offeredAxes[0] === 'contact',
  fx.deepInput.offeredAxes,
);
check(
  'UT15-P1-01 이미 답한 질문은 다시 묻지 않는다',
  !fx.deepInput.afterAnsweringIds.includes(fx.deepInput.offeredIds[0]),
  { first: fx.deepInput.offeredIds[0], next: fx.deepInput.afterAnsweringIds },
);
check(
  "UT15-P1-03 '잘 모르겠어'는 근거가 되지 않는다",
  fx.deepInput.unsureCondition === null &&
    fx.deepInput.answeredCondition === '답장 간격이 길어질 때',
  fx.deepInput,
);
check(
  'UT15-P1-03 답한 축에만 근거가 늘어난다 (다른 축으로 옮겨 붙이지 않는다)',
  fx.deepInput.answeredAxisHasDeepRef === true && fx.deepInput.otherAxisHasDeepRef === false,
  fx.deepInput,
);

/* 점수 불변 — 같은 입력에 심화 답만 더한다 */
const plain = await run(SEM_B);
const deep = await run({
  ...SEM_B,
  deepInputs: [{ axis: 'contact', questionId: 'contact_reply_gap', optionId: 'interval' }],
});
check(
  'UT15-P1-02 · P1-03 심화 답을 더해도 동기화율 점수가 같다',
  plain.compatibility.score === deep.compatibility.score,
  { plain: plain.compatibility.score, deep: deep.compatibility.score },
);
check(
  'UT15-P1-02 심화 답을 더해도 Mirror 축 판정이 같다',
  same(plain.mirrorStates, deep.mirrorStates),
  { plain: plain.mirrorStates, deep: deep.mirrorStates },
);
check(
  'UT15-P1-02 심화 답을 더해도 Premium 근거 · Top 3 선정이 같다 (구체성만 달라진다)',
  same(plain.semanticTopCandidateIds, deep.semanticTopCandidateIds) &&
    same(plain.premiumStates, deep.premiumStates),
);

/*
  결정론 경로 — AI가 없어도 심화 답이 화면에 드러나야 한다.
  AI 설명은 demo · 실패 · Quality Gate 어디서든 사라질 수 있어서, 그것만으로는
  '답한 만큼 결과가 달라진다'를 보장할 수 없다(브라우저 실측에서 확인했다).
*/
const signalCard = await src('src/components/compatibility/SignalCard.tsx');
check(
  'UT15-P1-03 심화 답이 AI 없이도 화면에 드러난다 (축 카드의 조건 한 줄)',
  /userCondition/.test(signalCard) &&
    /네가 알려준 조건/.test(signalCard) &&
    /userCondition=\{conditionFor\(/.test(compat),
);
check(
  'UT15-P1-03 조건 줄은 답한 축에만 붙는다 (null이면 아무것도 그리지 않는다)',
  /userCondition \? \(/.test(signalCard),
);

const prompts = await src('src/services/ai/promptTemplates.ts');
check(
  'UT15-P1-06 AI에게 자유서술·심화 답을 확장하지 말라고 명시한다',
  /적힌 범위까지만/.test(prompts) && /애착이 불안정하다/.test(prompts),
);

/* ═══════════════════════════════ P1-2 '기타' 자유 입력 */

console.log("\nUT15-P1-2 — '기타' 자유 입력");

check(`UT15-P1-04 자유 입력 상한이 ${fx.freeText.max}자다`, fx.freeText.max === 300);
check(
  'UT15-P1-04 상한을 화면이 아니라 저장 단계에서 자른다',
  /value\.slice\(0, MAX_PAST_OTHER_LENGTH\)/.test(await src('src/state/SessionProvider.tsx')),
);
check(
  "UT15-P1-04 '기타'를 고르고 비워두면 다음으로 넘어가지 않는다",
  /‘기타’를 골랐으면 어떤 거였는지 한 줄만 적어줘/.test(pastStep),
);
check(
  'UT15-P1-05 provenance 보존 — 저장/복원 후에도 적어준 문장이 그대로다',
  fx.freeText.roundTrippedOther === '답장이 늦으면 서운했어' &&
    fx.freeText.roundTrippedImportant.includes('other'),
  fx.freeText,
);
check(
  'UT15-P1-05 저장 키 순서가 타입 선언과 같다 (클라우드 왕복 parity가 깨지지 않는다)',
  same(fx.freeText.experienceKeyOrder, [
    'important',
    'importantOther',
    'hardest',
    'selfGap',
    'note',
    'skipped',
    'adaptive',
  ]),
  fx.freeText.experienceKeyOrder,
);
check(
  "UT15-P1-07 '기타' 세 글자가 근거 문장으로 새지 않는다 (적어준 문장으로 바뀐다)",
  same(fx.freeText.labelsWithText, ['연락', '답장이 늦으면 서운했어']),
  fx.freeText.labelsWithText,
);
check(
  "UT15-P1-07 비워둔 '기타'는 근거 목록에서 빠진다",
  same(fx.freeText.labelsWithBlank, ['연락']),
  fx.freeText.labelsWithBlank,
);
check(
  'UT15-P1-07 긴 자유 입력은 목록에서만 줄여 보여준다',
  fx.freeText.longLabelLength <= 25,
  fx.freeText.longLabelLength,
);

/* ═══════════════════════════════ P1-3 · P2 */

console.log('\nUT15-P1-3 · P2 — Lovy 연속성 · 공유');

const deepReport = await src('src/components/premium/RelationshipDeepReportView.tsx');
check(
  'UT15-P1-08 Lovy checkpoint가 결과 단계에 있다 (Compatibility · Mirror · Deep Report)',
  /LovyMessage/.test(compat) &&
    /LOVY_LINES\.mirrorCoreNote/.test(mirror) &&
    /<Lovy\b/.test(deepReport),
);
check(
  'UT15-P1-08 도배하지 않는다 — Mirror 러비 한 줄은 사용자가 고친 뒤에는 빠진다',
  /edited \?[\s\S]{0,500}LOVY_LINES\.mirrorCoreNote/.test(mirror),
);
check(
  'UT15-P2-01 공유 진입점이 결과를 다 읽은 자리에도 있다',
  /share_entry_click/.test(compat) && /이 결과를 친구에게 보내기/.test(compat),
);
check(
  'UT15-P2-02 공유 라벨이 실제 동작을 넘어 약속하지 않는다 (상대 답 수집 기능은 없다)',
  !/상대의 답도 받|상대가 입력하면|같이 해보기/.test(compat) &&
    /결과 카드 이미지나 요약 문구/.test(compat),
);
check(
  'UT15-P2-02 공유 목적지가 기존 Route다 (새 기능 아님)',
  /ROUTES\.shareCompatibility/.test(compat),
);

/* ═══════════════════════════════ Provider */

const after = await guardCount();
check(`실제 Provider 호출 0 증가 (${before} → ${after})`, after === before);

console.log(
  failures.length === 0
    ? `\n✅ 260915 UT Follow-up Fixture — ${passed} passed · 0 failed`
    : `\n❌ ${failures.length} failed / ${passed} passed`,
);
for (const failure of failures) console.log(`  · ${failure}`);
process.exit(failures.length === 0 ? 0 : 1);
