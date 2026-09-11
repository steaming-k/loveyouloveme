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
      photoId: fixture.photoId,
      observations: fixture.observations,
      // v1.42 §40.16 — relationship 시제 fixture. 없으면 라우트가 'current'로 본다
      tense: fixture.tense,
      // v1.42 §41.11 — Ended Job Safety fixture. 없으면 라우트가 true로 본다
      allowsOutwardQuestions: fixture.allowsOutwardQuestions,
      /**
       * v1.43 §46 — 근거 귀속 fixture. **없으면 dev 라우트가 그 검사를 건너뛴다**
       * (`evidenceContract: 'skipped'`). v1.42까지의 fixture 30여 개는 이 값을 갖고
       * 있지 않고 그것들이 검증하는 것은 시제·게이트·스키마다.
       */
      allowedEvidenceRefs: fixture.allowedEvidenceRefs,
      // v1.46 AI Lens — 렌즈 fixture. 없으면 라우트가 'pair' / 되풀이 검사 건너뜀
      mode: fixture.mode,
      deterministicText: fixture.deterministicText,
      // v1.46.1 §4 — 상대가 있는지. 없으면 라우트가 false로 본다('상대가 없어서'가 정상)
      targetExists: fixture.targetExists,
    }),
  });

  if (!response.ok) {
    failures.push(`${fixture.name}: HTTP ${response.status}`);
    return;
  }

  const result = await response.json();
  const expect = fixture.expect ?? {};
  const name = fixture.name;

  /* ------------------- 사진 1장 관찰 (v1.10 · §3 · §9 · §10) */
  if (fixture.task === 'observed-photo-analysis') {
    for (const field of ['scenes', 'activities', 'objects', 'environment']) {
      if (!expect[field]) continue;
      check(name, `${field} = [${expect[field].join(',')}]`, eq(result[field] ?? [], expect[field]),
        `실제 [${(result[field] ?? []).join(',')}]`);
    }
    if (expect.usable !== undefined) {
      check(name, `usable ${expect.usable}`, result.usable === expect.usable,
        `실제 ${result.usable}`);
    }
    if (expect.violations) {
      const actual = result.violations ?? [];
      for (const label of expect.violations) {
        check(name, `위반 라벨 '${label}' 감지`, actual.includes(label),
          `실제 [${actual.join(',')}]`);
      }
      if (expect.violations.length === 0) {
        check(name, '위반 없음', actual.length === 0, `실제 [${actual.join(',')}]`);
      }
    }
  }

  /* ------------- Cross-photo Aggregation (v1.10 · §4 · §5) */
  if (fixture.task === 'observed-photo-aggregation') {
    const signals = result.signals ?? [];

    if (expect.signalCount !== undefined) {
      check(name, `신호 개수 ${expect.signalCount}`, signals.length === expect.signalCount,
        `실제 ${signals.length}`);
    }
    if (expect.repeatedSignalCount !== undefined) {
      check(name, `반복 신호 ${expect.repeatedSignalCount}개`,
        result.repeatedSignalCount === expect.repeatedSignalCount,
        `실제 ${result.repeatedSignalCount}`);
    }
    if (expect.duplicateLikeGroups !== undefined) {
      check(name, `중복 묶기 후 장면 그룹 ${expect.duplicateLikeGroups}개`,
        result.duplicateLikeGroups === expect.duplicateLikeGroups,
        `실제 ${result.duplicateLikeGroups}`);
    }
    if (expect.allStrengths) {
      check(name, `모든 신호 strength=${expect.allStrengths}`,
        signals.every((s) => s.strength === expect.allStrengths),
        `실제 [${signals.map((s) => s.strength).join(',')}]`);
    }
    for (const wanted of expect.signals ?? []) {
      const actual = signals.find((s) => s.category === wanted.category);
      if (!actual) {
        check(name, `${wanted.category} 신호 존재`, false,
          `실제 [${signals.map((s) => s.category).join(',')}]`);
        continue;
      }
      for (const [field, value] of Object.entries(wanted)) {
        if (field === 'category') continue;
        check(name, `${wanted.category}.${field} = ${value}`, actual[field] === value,
          `실제 ${actual[field]}`);
      }
    }
  }

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

    /* v1.42 §40.19 — 시제 계약. 라우트가 fixture의 tense로 실제 실행됐는지를 먼저 본다 —
       기본값이 조용히 다른 값으로 떨어지면 A10~A12가 전부 거짓 통과하기 때문이다. */
    if (fixture.tense !== undefined) {
      check(name, `tense ${fixture.tense}로 실행됨`, result.tense === fixture.tense,
        `실제 ${result.tense}`);
    }
    if (expect.violations) {
      const actual = result.violations ?? [];
      for (const label of expect.violations) {
        check(name, `위반 라벨 '${label}' 감지`, actual.includes(label),
          `실제 [${actual.join(',')}]`);
      }
      if (expect.violations.length === 0) {
        check(name, '위반 없음', actual.length === 0, `실제 [${actual.join(',')}]`);
      }
    }

    /* ── v1.42 §41.5 SOURCE PROVENANCE ─────────────────────────────────
       근거의 **정체성**을 검사한다. 개수(evidenceCount)만 보면 current_relationship이
       버려지고 relationship으로 귀속된 상태를 구분할 수 없다 — v1.41의 결함이 정확히
       그 형태였고, 그래서 위반 라벨도 없이 조용히 지나갔다. */
    if (expect.evidenceSources) {
      check(name, `근거 source ${JSON.stringify(expect.evidenceSources)}`,
        eq(narratives.map((n) => n.evidenceSources ?? []), expect.evidenceSources),
        `실제 ${JSON.stringify(narratives.map((n) => n.evidenceSources ?? []))}`);
    }

    /* ── v1.42 §41.11 JOB SAFETY ────────────────────────────────────────
       문자열 blacklist가 아니라 **질문의 존재 여부**를 검사한다. 시제 중립적인
       partner-directed question은 어떤 어휘 목록으로도 잡을 수 없다(AQ5). */
    if (expect.questionCount !== undefined) {
      check(name, `AI question ${expect.questionCount}개`,
        result.questionCount === expect.questionCount, `실제 ${result.questionCount}`);
    }
    if (expect.hasQuestion) {
      check(name, `축별 question 유무 [${expect.hasQuestion.join(',')}]`,
        eq(narratives.map((n) => n.hasQuestion === true), expect.hasQuestion),
        `실제 [${narratives.map((n) => n.hasQuestion === true).join(',')}]`);
    }
    if (fixture.allowsOutwardQuestions !== undefined) {
      check(name, `allowsOutwardQuestions=${fixture.allowsOutwardQuestions}로 실행됨`,
        result.allowsOutwardQuestions === fixture.allowsOutwardQuestions,
        `실제 ${result.allowsOutwardQuestions}`);
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

    /* ── v1.43 §47 — relationship과 **같은 계약**을 같은 방식으로 검사한다 ────
       v1.42까지 compatibility fixture에는 시제도 질문도 근거 귀속도 없었다. 없는
       fixture는 실패하지 않으므로, `ended` 사용자에게 AI 질문 2개가 나가는 상태가
       290건 PASS 안에서 조용히 유지됐다. */
    if (fixture.tense !== undefined) {
      check(name, `tense ${fixture.tense}로 실행됨`, result.tense === fixture.tense,
        `실제 ${result.tense}`);
    }
    if (fixture.allowsOutwardQuestions !== undefined) {
      check(name, `allowsOutwardQuestions=${fixture.allowsOutwardQuestions}로 실행됨`,
        result.allowsOutwardQuestions === fixture.allowsOutwardQuestions,
        `실제 ${result.allowsOutwardQuestions}`);
    }
    if (expect.questionCount !== undefined) {
      check(name, `AI question ${expect.questionCount}개`,
        result.questionCount === expect.questionCount, `실제 ${result.questionCount}`);
    }
    if (expect.hasQuestion) {
      check(name, `축별 question 유무 [${expect.hasQuestion.join(',')}]`,
        eq(narratives.map((n) => n.hasQuestion === true), expect.hasQuestion),
        `실제 [${narratives.map((n) => n.hasQuestion === true).join(',')}]`);
    }
    if (expect.evidenceSources) {
      check(name, `근거 source ${JSON.stringify(expect.evidenceSources)}`,
        eq(narratives.map((n) => n.evidenceSources ?? []), expect.evidenceSources),
        `실제 ${JSON.stringify(narratives.map((n) => n.evidenceSources ?? []))}`);
    }
    if (expect.violations) {
      const actual = result.violations ?? [];
      for (const label of expect.violations) {
        check(name, `위반 라벨 '${label}' 감지`, actual.includes(label),
          `실제 [${actual.join(',')}]`);
      }
      if (expect.violations.length === 0) {
        check(name, '위반 없음', actual.length === 0, `실제 [${actual.join(',')}]`);
      }
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
    /**
     * v1.43 §45.3 — **`history` source가 실제로 살아남는지 본다.**
     *
     * v1.42까지 이 Task의 근거는 실측에서 0개였다 — `history` ref는 `entryId`가 없어
     * 항상 null로 떨어졌고, 그래도 `uncertainty`가 있으면 narrative는 통과했으므로
     * fixture는 전부 PASS였다. 개수만 세면 이 상태를 구분할 수 없다.
     */
    if (expect.evidenceSources) {
      check(name, `근거 source ${JSON.stringify(expect.evidenceSources)}`,
        eq(narratives.map((n) => n.evidenceSources ?? []), expect.evidenceSources),
        `실제 ${JSON.stringify(narratives.map((n) => n.evidenceSources ?? []))}`);
    }
    if (expect.violations) {
      const actual = result.violations ?? [];
      for (const label of expect.violations) {
        check(name, `위반 라벨 '${label}' 감지`, actual.includes(label),
          `실제 [${actual.join(',')}]`);
      }
      if (expect.violations.length === 0) {
        check(name, '위반 없음', actual.length === 0, `실제 [${actual.join(',')}]`);
      }
    }
  }

  /* -------------------------------------------- Deep Report (v1.9) */
  if (fixture.task === 'deep-report-narrative') {
    const narratives = result.narratives ?? [];
    if (expect.narrativeCount !== undefined) {
      check(name, `narrative 개수 ${expect.narrativeCount}`,
        narratives.length === expect.narrativeCount, `실제 ${narratives.length}`);
    }
    if (expect.redundantCount !== undefined) {
      // 안전 검사에서 버려진 것과 '규칙 문장 되풀이'로 버려진 것을 구분해서 본다
      check(name, `중복으로 버린 개수 ${expect.redundantCount}`,
        (result.redundantCount ?? 0) === expect.redundantCount,
        `실제 ${result.redundantCount ?? 0}`);
    }
    if (expect.insightIds) {
      check(name, `insightId ${expect.insightIds.join(',')}`,
        eq(narratives.map((n) => n.insightId), expect.insightIds),
        `실제 ${narratives.map((n) => n.insightId).join(',')}`);
    }
    /* v1.43 §47.5 — 시제 계약. relationship과 같은 방식으로 먼저 실행 값을 본다 */
    if (fixture.tense !== undefined) {
      check(name, `tense ${fixture.tense}로 실행됨`, result.tense === fixture.tense,
        `실제 ${result.tense}`);
    }
    if (expect.violations) {
      const actual = result.violations ?? [];
      for (const label of expect.violations) {
        check(name, `위반 라벨 '${label}' 감지`, actual.includes(label),
          `실제 [${actual.join(',')}]`);
      }
      if (expect.violations.length === 0) {
        check(name, '위반 없음', actual.length === 0, `실제 [${actual.join(',')}]`);
      }
    }
    for (const item of narratives) {
      check(name, `headline ≤ 70 (${item.insightId})`, item.headlineLength <= 70,
        `실제 ${item.headlineLength}`);
      check(name, `interpretation ≤ 260 (${item.insightId})`, item.interpretationLength <= 260,
        `실제 ${item.interpretationLength}`);
      check(name, `근거 또는 한계 동반 (${item.insightId})`,
        item.evidenceCount > 0 || item.hasUncertainty);
    }
  }

  /* ------------------------- Premium Lens AI · Cross-Lens (v1.46 AI Lens)

     ⚠️ 이 블록만 **화면 문자열 자체**를 본다. 다른 Task는 길이·개수·라벨로
     검사하는데, 내부 enum 노출은 그렇게 잡히지 않는다 — `planning`이 그대로 나간
     응답도 unit 개수와 길이는 정상이었다(브라우저 실측 P1). 문자열을 보지 않으면
     그 상태가 PASS 안에 남는다. */
  if (fixture.task.startsWith('premium-')) {
    const screenText = [
      result.summary ?? '',
      ...(result.units ?? []).map((unit) => unit.body ?? ''),
      result.checkpoint ?? '',
      result.crossTheme ?? '',
      ...(result.repeatedThemes ?? []),
      ...(result.differences ?? []),
      ...(result.verificationQuestions ?? []),
      result.closing ?? '',
    ].join(' ');

    if (expect.rejected !== undefined) {
      check(name, `응답 폐기 ${expect.rejected}`, (result.rejected ?? null) === expect.rejected,
        `실제 ${result.rejected ?? null}`);
    }
    /** 내부 코드가 **한 글자도** 남지 않아야 한다 */
    for (const code of expect.forbiddenText ?? []) {
      check(name, `'${code}' 사용자 노출 0`, !screenText.includes(code), '화면 문자열에 남았다');
    }
    /** 코드가 사라진 자리에 **사람이 읽는 라벨**이 있는지 — 지우기만 하면 문장이 깨진다 */
    for (const label of expect.containsText ?? []) {
      check(name, `'${label}' 라벨로 치환됨`, screenText.includes(label), '라벨이 없다');
    }
    if (expect.unitIds) {
      check(name, `unit ${expect.unitIds.join(',')}`,
        eq((result.units ?? []).map((unit) => unit.id), expect.unitIds),
        `실제 ${(result.units ?? []).map((unit) => unit.id).join(',')}`);
    }
    if (expect.repeatCount !== undefined) {
      check(name, `반복으로 버린 개수 ${expect.repeatCount}`,
        (result.repeatCount ?? 0) === expect.repeatCount, `실제 ${result.repeatCount ?? 0}`);
    }
    if (expect.crossCounts) {
      const actual = [
        (result.repeatedThemes ?? []).length,
        (result.differences ?? []).length,
        (result.verificationQuestions ?? []).length,
      ];
      check(name, `Cross 블록 개수 [${expect.crossCounts.join(',')}]`, eq(actual, expect.crossCounts),
        `실제 [${actual.join(',')}]`);
    }
    if (expect.summaryEmpty !== undefined) {
      check(name, `summary ${expect.summaryEmpty ? '비었다' : '남았다'}`,
        (result.summary === '') === expect.summaryEmpty, `실제 '${result.summary}'`);
    }
    if (fixture.tense !== undefined) {
      check(name, `tense ${fixture.tense}로 실행됨`, result.tense === fixture.tense,
        `실제 ${result.tense}`);
    }
    if (expect.violations) {
      const actual = result.violations ?? [];
      for (const label of expect.violations) {
        check(name, `위반 라벨 '${label}' 감지`, actual.includes(label), `실제 [${actual.join(',')}]`);
      }
      if (expect.violations.length === 0) {
        check(name, '위반 없음', actual.length === 0, `실제 [${actual.join(',')}]`);
      }
    }
  }

  /* ─────────────── 공통: 근거 귀속 계약 (v1.43 · §46) ─────────────────
     ⚠️ **`evidenceContract`를 먼저 본다.** fixture가 `allowedEvidenceRefs`를 빼먹으면
     라우트는 검사를 건너뛰고, 그러면 `rejectedCount: 2`를 기대한 fixture가 **0을 받고도
     조용히 통과**할 수 있다 — v1.42가 tense fixture에서 같은 이유로 `result.tense`를
     먼저 확인하기로 정한 것과 같은 규칙이다(기본값이 조용히 다르면 나머지가 거짓 통과). */
  if (fixture.allowedEvidenceRefs !== undefined) {
    check(name, '근거 귀속 검사가 실제로 돌았다', result.evidenceContract !== 'skipped',
      `실제 ${result.evidenceContract}`);
  }
  if (expect.refChecked !== undefined) {
    check(name, `근거 검사 통과 ${expect.refChecked}개`, result.refChecked === expect.refChecked,
      `실제 ${result.refChecked}`);
  }
  if (expect.rejectedRefSources) {
    check(name, `거부된 근거 source [${expect.rejectedRefSources.join(',')}]`,
      eq((result.rejectedRefSources ?? []).slice().sort(), expect.rejectedRefSources.slice().sort()),
      `실제 [${(result.rejectedRefSources ?? []).join(',')}]`);
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
