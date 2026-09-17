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
 *
 * HISTORY-VIS-01  채운 점 / 빈 점이 같은 트랙 primitive에서 top·크기를 받는다
 * HISTORY-VIS-02  트랙 한 칸이 공통 중심선 하나를 갖고, 모든 지름이 홀수다
 * HISTORY-VIS-03  timeline의 세로선과 관찰 점이 레일 칸 하나에서 중심을 공유한다
 * HISTORY-VIS-04  Premium 합류 기하도 중심 하나에서 나온다 (top:50% 0)
 * HISTORY-VIS-05  선·점 primitive에 반픽셀 땜질이 없다
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


/* ══════════════════════════════════ 선·점 정렬 (v1.48.2) */

console.log('\nHISTORY-VIS — 선과 점의 공통 중심축');

const fieldNotes = await code('src/components/common/fieldNotes.tsx');
const historyRow = await code('src/components/history/HistoryChangeRow.tsx');
const historyPage = await code('src/app/history/page.tsx');
const trail = await code('src/components/premium/EvidenceConnectionTrail.tsx');

/**
 * 트랙 기하의 지름은 **전부 홀수**여야 한다.
 *
 * 1px 선은 정수 top에서만 device pixel 한 줄을 채우므로 공통 중심이 반정수가 되고,
 * 그 중심에서 `top = center - 지름/2`가 정수가 되려면 지름이 홀수여야 한다.
 * v1.48.1에서 12px(짝수) 링 하나가 이 규칙을 깨서 점과 0.5px 어긋나 보였다.
 */
const trackBlock = /export const TRACK = \{([\s\S]*?)\} as const;/.exec(fieldNotes)?.[1] ?? '';
const trackSizes = [...trackBlock.matchAll(/^\s*(rail|link|dot|ring):\s*(\d+),/gm)].map((m) => [
  m[1],
  Number(m[2]),
]);
const trackCenter = Number(/center:\s*([\d.]+),/.exec(trackBlock)?.[1] ?? NaN);
const evenSizes = trackSizes.filter(([, size]) => size % 2 === 0);

check(
  'HISTORY-VIS-02 트랙이 공통 중심값 하나를 갖는다 (TRACK.center · trackTop)',
  Number.isFinite(trackCenter) &&
    /export function trackTop\(size: number\): number \{\s*return TRACK\.center - size \/ 2;/.test(
      fieldNotes,
    ),
);
check(
  'HISTORY-VIS-02 모든 트랙 지름이 홀수다 → 공통 중심에서 top이 정수가 된다',
  trackSizes.length >= 4 && evenSizes.length === 0,
  evenSizes,
);
check(
  'HISTORY-VIS-02 트랙 지름이 실제로 정수 top을 만든다',
  trackSizes.every(([, size]) => Number.isInteger(trackCenter - size / 2)),
  trackSizes.map(([name, size]) => `${name}:${trackCenter - size / 2}`),
);

check(
  'HISTORY-VIS-01 채운 점과 빈 점이 같은 공통 primitive에서 top·크기를 받는다',
  (fieldNotes.match(/trackTop\(TRACK\.dot\)/g) ?? []).length >= 2 &&
    /box-border/.test(fieldNotes),
);
check(
  'HISTORY-VIS-01 History PAST/NOW 트랙도 같은 primitive를 쓴다',
  /import \{ TRACK, trackTop \} from '@\/components\/common\/fieldNotes';/.test(historyRow) &&
    /trackTop\(HISTORY_RAIL\)/.test(historyRow) &&
    /trackTop\(HISTORY_DOT\)/.test(historyRow),
);
check(
  'HISTORY-VIS-01 History 트랙의 rail·점 지름도 홀수다',
  /const HISTORY_RAIL = 3;/.test(historyRow) && /const HISTORY_DOT = 9;/.test(historyRow),
);

check(
  'HISTORY-VIS-03 timeline의 세로선과 관찰 점이 레일 칸 하나의 폭에서 중심을 얻는다',
  /const TIMELINE_DOT = 9;/.test(historyPage) &&
    /style=\{\{ width: TIMELINE_DOT \}\}/.test(historyPage) &&
    /left-1\/2 w-px -translate-x-1\/2/.test(historyPage) &&
    /width: TIMELINE_DOT, height: TIMELINE_DOT/.test(historyPage),
);
check(
  'HISTORY-VIS-03 timeline 점이 더 이상 좌표를 직접 적지 않는다 (-left-[22px] 0)',
  !/-left-\[22px\]/.test(historyPage) && !/left-\[5px\]/.test(historyPage),
);

check(
  'HISTORY-VIS-04 Premium 합류 기하도 중심 하나에서 나온다 (top:50% 0)',
  /const TICK_CENTER = 13\.5;/.test(trail) &&
    /const nodeCenter =/.test(trail) &&
    !/top: '50%'/.test(trail),
);

/**
 * 눈으로 맞춘 보정값 금지(§15). 반픽셀 top·margin·1.5px 테두리는 전부
 * '값을 조금씩 밀어 맞춘' 흔적이라, 부모가 소수 좌표에 놓이면 바로 어긋난다.
 */
const HALF_PIXEL = /top-\[\d+\.5px\]|-ml-\[\d+\.5px\]|-mt-\[\d+\.5px\]|border-\[1\.5px\]|translateY\(-0?\.5px\)/;
const smudged = [
  ['fieldNotes', fieldNotes],
  ['HistoryChangeRow', historyRow],
  ['history/page', historyPage],
  ['EvidenceConnectionTrail', trail],
].filter(([, source]) => HALF_PIXEL.test(source));
check(
  'HISTORY-VIS-05 선·점 primitive에 반픽셀 땜질(top-[N.5px] · border-[1.5px] 등) 0',
  smudged.length === 0,
  smudged.map(([name]) => name),
);

console.log(`\n${passed} passed · ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
