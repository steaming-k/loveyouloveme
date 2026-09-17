/**
 * v1.48.1 — Visual QA Cleanup Guard
 *
 * ```
 * VISUAL-QA-01  Mirror가 pseudo-coordinate SVG/chart를 그리지 않는다
 * VISUAL-QA-02  참가자 route에 UT 평가 widget(1~5 척도)이 없다
 * VISUAL-QA-03  참가자 route에 'UT' 연구 배지가 없다
 * VISUAL-QA-04  Mirror가 Declared + Relationship 근거를 여전히 그린다
 * VISUAL-QA-05  GAP/MATCH/CHANGE 판정이 가짜 정밀도 없이 계속 보인다
 * VISUAL-QA-06  회수한 문항은 운영자 화면(/ut)에 같은 이벤트 이름으로 남아 있다
 * ```
 *
 * ══ 왜 이 파일이 생겼나 ═══════════════════════════════════════════════════════
 *
 * v1.48 Visual Polish가 Mirror에 `MirrorLink`(곡선)와 1점짜리 트랙을 그렸다. 실제
 * 렌더에서 그 그림은 **데이터에 없는 정밀도**를 만들었고(도착점이 좌표처럼 보였다),
 * 읽는 방법을 알려주는 범례까지 필요했다. 되살아나기 쉬운 종류의 결함이라 구조
 * invariant로 못 박는다.
 *
 * 같은 라운드에서 참가자 화면에 남아 있던 UT 평가 UI도 전부 회수했다. 이건 한 번
 * 지우면 끝나는 일이 아니다 — 다음 UT 라운드에 "이번만" 하고 다시 붙기 쉽다.
 *
 * ⚠️ **exact copy snapshot을 쓰지 않는다.** 문구가 아니라 구조를 본다.
 * ⚠️ 정적 검사만 한다. 서버 · Provider 호출 없음.
 * 실행: `npm run test:visual-qa`
 */

import './_aiTestGuard.mjs';
import { readdir, readFile } from 'node:fs/promises';
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
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** 주석을 지운 소스 — 주석에 적힌 '무엇을 제거했다'는 설명이 검사를 깨뜨리지 않게 한다 */
async function code(rel) {
  return stripComments(await readFile(join(ROOT, rel), 'utf8'));
}

/**
 * 참가자에게 보이는 route/컴포넌트.
 *
 * ⚠️ 운영자 도구(`src/app/ut`, `src/components/ut`)와 개발 전용 route(`src/app/dev`,
 * `src/app/api`)는 제외한다. 그건 참가자 화면이 아니고, 회수한 문항이 **가야 할 곳**이다.
 */
const OPERATOR_ONLY = [/^src[\\/]app[\\/]ut[\\/]/, /^src[\\/]components[\\/]ut[\\/]/];
const NOT_PARTICIPANT = [
  ...OPERATOR_ONLY,
  /^src[\\/]app[\\/]dev[\\/]/,
  /^src[\\/]app[\\/]api[\\/]/,
  /^src[\\/]components[\\/]ai[\\/]AiDebugPanel\.tsx$/,
  /^src[\\/]components[\\/]shell[\\/]PrototypePanel\.tsx$/,
];

const allFiles = (await walk(join(ROOT, 'src'))).map((file) => relative(ROOT, file));
const participantFiles = allFiles.filter(
  (file) => !NOT_PARTICIPANT.some((pattern) => pattern.test(file)),
);

/* ══════════════════════════════════════════════════ PART A — Mirror */

console.log('\nVISUAL-QA — Mirror pseudo-chart 제거');

const mirrorRow = await code('src/components/mirror/MirrorComparisonRow.tsx');
const mirrorPage = await code('src/app/mirror/page.tsx');

check(
  'VISUAL-QA-01 Mirror 행이 좌표 기반 그림을 그리지 않는다 — svg · path · 곡선 · valueToPercent 0',
  !/<svg|<path|viewBox|MirrorLink|valueToPercent/.test(mirrorRow),
);
check(
  'VISUAL-QA-01 Mirror 행에 절대 위치 점(`left: …%`)이 없다',
  !/style=\{\{\s*left:/.test(mirrorRow),
);
check(
  'VISUAL-QA-01 그래프 사용 설명 범례가 없다 — MirrorLegend · 정확한 위치 · (방향) 0',
  !/MirrorLegend/.test(mirrorRow) &&
    !/MirrorLegend/.test(mirrorPage) &&
    !/정확한 위치/.test(mirrorRow) &&
    !/신호\(방향\)/.test(mirrorRow),
);
check(
  'VISUAL-QA-04 Declared + Relationship 두 근거가 모두 남아 있다',
  /declaredPhrase/.test(mirrorRow) &&
    /relationshipSignal/.test(mirrorRow) &&
    /ScaleHearts value=\{insight\.declared\}/.test(mirrorRow) &&
    /\{insight\.note\}/.test(mirrorRow),
);
check(
  'VISUAL-QA-05 판정은 표시 상태(displayStateOf)로만 보이고, 배지 · 문구 · 방향 아이콘이 남아 있다',
  /displayStateOf\(insight\.state, insight\.evidenceScope\)/.test(mirrorRow) &&
    /STATE_TAG\[shownState\]/.test(mirrorRow) &&
    /stateTextOf\(insight\)/.test(mirrorRow) &&
    /STATE_DOT\[shownState\]/.test(mirrorRow),
);
check(
  'VISUAL-QA-05 판정을 퍼센트 · 막대 · 거리로 말하지 않는다',
  !/progress|%\s*\}|width:\s*`\$\{|bar-width/.test(mirrorRow),
);
check(
  '항목별 대조 섹션 제목은 남아 있다 — heading 순서(H1→H2→H3)를 지킨다',
  /<SectionLabel>항목별 대조<\/SectionLabel>/.test(mirrorPage),
);

/* ══════════════════════════════════════════════ PART B — UT 계측 제거 */

console.log('\nVISUAL-QA — 참가자 화면의 연구 계측 제거');

/** 1~5 척도 widget의 구조적 지문 */
const SCALE_LITERAL = /\[\s*1,\s*2,\s*3,\s*4,\s*5\s*\]\s*as const/;

const scaleHosts = [];
const utBadgeHosts = [];
const ratingImportHosts = [];
for (const file of participantFiles) {
  const source = await code(file);
  if (SCALE_LITERAL.test(source)) scaleHosts.push(file);
  /* JSX 텍스트 노드로 찍히는 `UT` 배지. 식별자(UT_MODE 등)는 걸리지 않는다 */
  if (/>\s*UT\s*</.test(source)) utBadgeHosts.push(file);
  if (/UtRatingCard|UtSummaryCard|DeepReportUtFlow|DeepReportValueCheck/.test(source))
    ratingImportHosts.push(file);
}

check('VISUAL-QA-02 참가자 route에 1~5 척도 widget 0', scaleHosts.length === 0, scaleHosts);
check('VISUAL-QA-03 참가자 route에 `UT` 연구 배지 0', utBadgeHosts.length === 0, utBadgeHosts);
check(
  'VISUAL-QA-02 참가자 route가 평가 컴포넌트를 참조하지 않는다',
  ratingImportHosts.length === 0,
  ratingImportHosts,
);

/** 삭제된 평가 컴포넌트가 되살아나지 않았는지 */
const revived = allFiles.filter((file) =>
  /(UtSummaryCard|DeepReportUtFlow|DeepReportValueCheck)\.tsx$/.test(file),
);
check('VISUAL-QA-02 참가자용 설문 컴포넌트 파일이 되살아나지 않았다', revived.length === 0, revived);

/* ══════════════════════════════════════ 회수한 문항이 운영자 화면에 있다 */

console.log('\nVISUAL-QA — 운영자 화면 격리 · 지표 연속성');

const consoleSrc = await code('src/components/ut/UtOperatorConsole.tsx');
const utRatingCard = await code('src/components/ut/UtRatingCard.tsx');

/**
 * 참가자 화면에서 회수한 문항의 이벤트. **같은 이름으로** 운영자 화면에 있어야 한다 —
 * 화면에서 뺐다고 지표를 끊지 않는다.
 */
const RELOCATED_EVENTS = [
  'ut_analysis_similarity_rate',
  'ut_evidence_clarity_rate',
  'ut_premium_value_diff_rate',
  'ut_premium_price_wtp',
  'ut_new_insight_rate',
  'ut_genericness_rate',
  'ut_cross_source_value_rate',
  'deep_report_value_rating',
  'deep_report_wtp_after_view',
  'ut_deep_report_wtp',
  'ut_self_understanding_helpfulness',
  'ut_photo_value_rate',
];
const missing = RELOCATED_EVENTS.filter((event) => !consoleSrc.includes(event));
check(
  'VISUAL-QA-06 회수한 문항 전부가 /ut 콘솔에 같은 이벤트 이름으로 있다',
  missing.length === 0,
  missing,
);
check(
  'VISUAL-QA-06 평가 카드는 UT Mode가 아니면 렌더하지 않는다 (운영자 화면에서도 같은 가드)',
  /if \(!utMode\) return null;/.test(utRatingCard),
);
check(
  'VISUAL-QA-06 /ut은 production에서 404다 — 참가자에게 도달하지 않는다',
  /notFound\(\)|NOT_FOUND|return null/.test(await code('src/app/ut/page.tsx')),
);

/* 제품 기능은 그대로 — 평가와 함께 지우지 않았다 */
console.log('\nVISUAL-QA — 제품 기능 유지');

check(
  '사용자 수정/거절 기능이 남아 있다 — Mirror 검증 버튼 · 관찰 수정 시트',
  /setCoreVerdict/.test(mirrorPage) && /ResultEditSheet/.test(mirrorPage),
);
check(
  'Deep Report 완독 신호는 제품 지표라 남아 있다',
  /deep_report_complete/.test(await code('src/components/premium/RelationshipDeepReportView.tsx')),
);

console.log(`\n${passed} passed · ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
