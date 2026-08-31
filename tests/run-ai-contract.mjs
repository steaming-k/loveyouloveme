/**
 * AI Contract Test 실행기 (v1.7 · §56)
 *
 * `tests/fixtures/ai/*.json`을 개발 서버의 `/api/ai/contract-test`로 보내
 * **실제 파싱·Business Validation·Safety Scan** 결과를 검증한다.
 *
 * 검증 로직을 이 파일에 복제하지 않는 게 핵심이다 — 복제하면 테스트가
 * 실제 동작을 보증하지 못하고, 두 벌이 어긋나는 순간 조용히 무의미해진다.
 *
 * 사용법:
 *   1) npm run dev
 *   2) node tests/run-ai-contract.mjs
 *
 * Provider Key가 필요 없다. Provider를 호출하지 않는다.
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, 'fixtures', 'ai');
const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';

let passed = 0;
const failures = [];

function check(fixture, label, condition, detail) {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(`${fixture}: ${label}${detail ? ` — ${detail}` : ''}`);
}

function eq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function run(fixture) {
  const response = await fetch(`${BASE_URL}/api/ai/contract-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: fixture.task,
      raw: fixture.raw,
      allowedImageIds: fixture.allowedImageIds,
      allowed: fixture.allowed,
      judgements: fixture.judgements,
      focusAxis: fixture.focusAxis,
    }),
  });

  if (!response.ok) {
    failures.push(`${fixture.name}: HTTP ${response.status}`);
    return;
  }

  const result = await response.json();
  const expect = fixture.expect ?? {};
  const name = fixture.name;

  /* ------------------------------------------------ Observed */
  if (fixture.task === 'observed-profile') {
    const traits = result.traits ?? [];
    if (expect.traitCount !== undefined) {
      check(name, `trait 개수 ${expect.traitCount}`, traits.length === expect.traitCount,
        `실제 ${traits.length}`);
    }
    if (expect.labels) {
      check(name, `남은 trait ${expect.labels.join(',')}`,
        eq(traits.map((t) => t.label), expect.labels),
        `실제 ${traits.map((t) => t.label).join(',')}`);
    }
    if (expect.confidences) {
      check(name, `confidence ${expect.confidences.join(',')}`,
        eq(traits.map((t) => t.confidence), expect.confidences),
        `실제 ${traits.map((t) => t.confidence).join(',')}`);
    }
    if (expect.usableImageCount !== undefined) {
      check(name, `usableImageCount ${expect.usableImageCount}`,
        result.usableImageCount === expect.usableImageCount, `실제 ${result.usableImageCount}`);
    }
  }

  /* -------------------------------------------- Relationship */
  if (fixture.task === 'relationship-insight') {
    const narratives = result.narratives ?? [];
    if (expect.narrativeCount !== undefined) {
      check(name, `narrative 개수 ${expect.narrativeCount}`,
        narratives.length === expect.narrativeCount, `실제 ${narratives.length}`);
    }
    if (expect.states) {
      check(name, `state ${expect.states.join(',')} (규칙 값 강제)`,
        eq(narratives.map((n) => n.state), expect.states),
        `실제 ${narratives.map((n) => n.state).join(',')}`);
    }
    if (expect.coreExists !== undefined) {
      check(name, `core ${expect.coreExists ? '유지' : '폐기'}`,
        Boolean(result.core) === expect.coreExists);
    }
    if (expect.coreAxis) {
      check(name, `core axis ${expect.coreAxis} (규칙 focusAxis)`,
        result.core?.axis === expect.coreAxis, `실제 ${result.core?.axis}`);
    }
    // 길이 상한은 응답 전체에 항상 적용된다.
    for (const item of narratives) {
      check(name, `headline ≤ 80 (${item.axis})`, item.headlineLength <= 80,
        `실제 ${item.headlineLength}`);
      check(name, `explanation ≤ 120 (${item.axis})`, item.explanationLength <= 120,
        `실제 ${item.explanationLength}`);
    }
    if (result.core) {
      check(name, 'core headline ≤ 60', result.core.headlineLength <= 60,
        `실제 ${result.core.headlineLength}`);
      check(name, 'core summary ≤ 240', result.core.summaryLength <= 240,
        `실제 ${result.core.summaryLength}`);
    }
  }

  /* ------------------------------------------ Compatibility */
  if (fixture.task === 'compatibility-narrative') {
    const narratives = result.narratives ?? [];
    if (expect.narrativeCount !== undefined) {
      check(name, `narrative 개수 ${expect.narrativeCount}`,
        narratives.length === expect.narrativeCount, `실제 ${narratives.length}`);
    }
    if (expect.keys) {
      check(name, `축 ${expect.keys.join(',')}`, eq(narratives.map((n) => n.key), expect.keys),
        `실제 ${narratives.map((n) => n.key).join(',')}`);
    }
    if (expect.kinds) {
      check(name, `kind ${expect.kinds.join(',')} (규칙 값 강제)`,
        eq(narratives.map((n) => n.kind), expect.kinds),
        `실제 ${narratives.map((n) => n.kind).join(',')}`);
    }
    for (const item of narratives) {
      check(name, `explanation ≤ 180 (${item.key})`, item.explanationLength <= 180,
        `실제 ${item.explanationLength}`);
      check(name, `scenario ≤ 180 (${item.key})`, item.scenarioLength <= 180,
        `실제 ${item.scenarioLength}`);
      check(name, `근거 또는 한계 동반 (${item.key})`,
        item.evidenceCount > 0 || item.hasUncertainty);
    }
  }

  /* ----------------------------------------------- History */
  if (fixture.task === 'history-insight') {
    const narratives = result.narratives ?? [];
    if (expect.narrativeCount !== undefined) {
      check(name, `narrative 개수 ${expect.narrativeCount}`,
        narratives.length === expect.narrativeCount, `실제 ${narratives.length}`);
    }
    if (expect.axes) {
      check(name, `축 ${expect.axes.join(',')}`, eq(narratives.map((n) => n.axis), expect.axes),
        `실제 ${narratives.map((n) => n.axis).join(',')}`);
    }
    if (expect.states) {
      check(name, `state ${expect.states.join(',')} (규칙 값 강제)`,
        eq(narratives.map((n) => n.state), expect.states),
        `실제 ${narratives.map((n) => n.state).join(',')}`);
    }
    for (const item of narratives) {
      check(name, `explanation ≤ 220 (${item.axis})`, item.explanationLength <= 220,
        `실제 ${item.explanationLength}`);
      check(name, `근거 또는 한계 동반 (${item.axis})`,
        item.evidenceCount > 0 || item.hasUncertainty);
    }
  }

  /* ------------------------------------------- 공통: 위반 라벨 */
  if (expect.violationsInclude) {
    for (const label of expect.violationsInclude) {
      check(name, `위반 라벨 '${label}' 감지`, (result.violations ?? []).includes(label),
        `실제 [${(result.violations ?? []).join(',')}]`);
    }
  }
  if (expect.explanationMaxLength !== undefined) {
    const over = (result.narratives ?? []).filter(
      (n) => n.explanationLength > expect.explanationMaxLength,
    );
    check(name, `explanation 상한 ${expect.explanationMaxLength} 준수`, over.length === 0);
  }
}

const files = (await readdir(FIXTURE_DIR)).filter((file) => file.endsWith('.json')).sort();

console.log(`AI Contract Test — fixture ${files.length}개 · ${BASE_URL}\n`);

for (const file of files) {
  const fixture = JSON.parse(await readFile(join(FIXTURE_DIR, file), 'utf8'));
  try {
    await run(fixture);
    console.log(`  · ${fixture.name} — ${fixture.description}`);
  } catch (error) {
    failures.push(`${fixture.name}: ${error.message}`);
  }
}

console.log(`\n통과 ${passed}건`);

if (failures.length > 0) {
  console.log(`\n실패 ${failures.length}건:`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exit(1);
}

console.log('ALL PASS');
