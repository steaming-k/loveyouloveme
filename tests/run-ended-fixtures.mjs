/**
 * Ended Safety Fixture — 끝난 관계 전수 감사 (v1.46.4 HARDENING PHASE 4)
 *
 * ══ 왜 별도 스크립트인가 ═══════════════════════════════════════════════════
 *
 * `ended` 안전성은 지금까지 여러 스크립트에 흩어져 있었다 — lifecycle fixture,
 * premium fixture의 LOVY-09, question fixture의 QUESTION-FIT-04. 각자 자기 화면만
 * 봤고, **화면 사이의 틈**은 아무도 보지 않았다.
 *
 * 실측에서 새어 나온 문장이 정확히 그 틈에 있었다(사주 렌즈 AI):
 *
 * ```
 * 한쪽이 더 가까이 다가가고 싶을 때 …
 * ```
 *
 * `지금 관계`도 `현재 상대`도 없어서 시제 스캐너를 통과했고, 질문 필드가 아니라
 * **본문**이라 outward question 게이트도 닿지 않았다. 두 게이트 사이의 구멍이다.
 *
 * ══ 3단 방어를 전부 검사한다 (PHASE 4-2) ══════════════════════════════════
 *
 * ```
 * ① Generation     프롬프트가 former에서 행동 제안을 금지한다
 * ② Sanitization   스캐너가 실제 누출 문장을 잡는다 (probe로 **동작**을 본다)
 * ③ Fixture        ended 세션의 렌더 문자열 전체에 outward 표현이 0이다
 * ```
 *
 * ⚠️ **단어 regex만으로 끝내지 않는다**(PHASE 4-1). ③은 실제 결과 문자열을 전부
 * 모아서 본다 — Candidate · 무료 Insight · 질문 · 체크포인트 · 장면 블록 · 렌즈 ·
 * Cross-Lens · 한계 문장까지.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:ended`
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FIXTURE_B, FIXTURE_D, createChecker, findForbidden, run } from './fixtures-v1464.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';
const { check, report } = createChecker();

console.log('\nEnded Safety Fixture — v1.46.4 HARDENING PHASE 4\n');

/* ── ended fixture 3종 (PHASE 4-1) ─────────────────────────────────────── */

/** Event 0 */
const ENDED_NO_EVENT = { ...FIXTURE_D, target: { ...FIXTURE_D.target, events: [] } };
/** Event 5 */
const ENDED_EVENTS = FIXTURE_D;
/** Lens full — MBTI + 양쪽 생년월일까지 있는 세션 */
const ENDED_LENS_FULL = {
  ...FIXTURE_D,
  mbti: 'INFP',
  birthProfile: { date: '1996-04-12', time: '10:30', calendarType: 'solar' },
  target: {
    ...FIXTURE_D.target,
    mbti: 'ENFP',
    birthProfile: { date: '1995-08-20', time: null, calendarType: 'solar' },
  },
};

const noEvent = await run(ENDED_NO_EVENT);
const withEvents = await run(ENDED_EVENTS);
const lensFull = await run(ENDED_LENS_FULL);
/** 대조군 — 진행 중인 관계. 같은 표현이 여기서는 **허용**이어야 한다 */
const current = await run(FIXTURE_B);

/**
 * 이 결과가 화면에 그리는 **모든 문자열.**
 *
 * ⚠️ 목록을 좁히지 않는다. 한 곳이라도 빠지면 그 자리가 다음 누출 지점이 된다 —
 * 이번 결함이 정확히 "아무도 보지 않던 필드"에서 나왔다.
 */
function allText(result) {
  return [
    /* Premium Candidate */
    ...result.report.candidates.flatMap((candidate) => [
      candidate.headline,
      candidate.soWhat,
      candidate.whyItMatters,
      candidate.limitation,
      ...candidate.questions.flatMap((question) => [question.text, question.basis]),
    ]),
    /* 무료 */
    ...result.free.candidates.flatMap((candidate) => [
      candidate.soWhat,
      candidate.whyItMatters,
      ...candidate.questions.map((question) => question.text),
    ]),
    ...result.free.questions,
    result.free.openQuestion ?? '',
    result.free.surpriseSignal ?? '',
    ...result.free.scenes.map((scene) => scene.scene ?? ''),
    /* Paywall */
    result.report.paywallTease ?? '',
    result.report.overviewHeadline,
    result.report.overviewSubcopy,
    ...result.report.topSummaries,
    /* Chapter — 규칙 문장 · 러비 체크포인트 · 연결 이유 */
    ...result.chapters.flatMap((chapter) => [
      chapter.title,
      chapter.eyebrow,
      chapter.deterministicSummary,
      chapter.deterministicTakeaway,
      chapter.question ?? '',
      chapter.limitation,
      chapter.lovyCheckpoint ?? '',
      chapter.lovyConnectionReason ?? '',
      chapter.soWhat?.soWhat ?? '',
      chapter.soWhat?.whyItMatters ?? '',
    ]),
    /* 행동 · 질문 · 러비 관찰 */
    ...result.report.actions.map((action) => action.text),
    ...result.report.connectionQuestions.map((item) => item.text),
    result.report.lovyObservation?.observation ?? '',
    result.report.lovyObservation?.question ?? '',
    ...result.report.limitations,
    ...(result.omissions ?? []).map((omission) => omission.text),
    /* 사용자가 알려준 장면 블록 */
    result.report.reportedScenes?.lovyNote ?? '',
    result.report.reportedScenes?.limitation ?? '',
    ...(result.report.reportedScenes?.scenes ?? []).map((scene) => scene.interpretation),
    /* 관계 렌즈 3종 + Cross-Lens — 결정론 부분 전체 */
    ...result.report.lensBundle.lenses.flatMap((lens) =>
      lens.mode === 'unavailable'
        ? [lens.reason]
        : [
            lens.headline,
            lens.soWhat ?? '',
            lens.overview,
            lens.checkpoint,
            lens.disclaimer,
            ...lens.sections.flatMap((section) => [section.title, section.body]),
            ...lens.limitations,
          ],
    ),
    ...(result.report.lensBundle.crossLens
      ? [
          ...result.report.lensBundle.crossLens.repeatedThemes,
          ...result.report.lensBundle.crossLens.differences,
          ...result.report.lensBundle.crossLens.tensions,
          ...result.report.lensBundle.crossLens.verificationQuestions,
          result.report.lensBundle.crossLens.note ?? '',
        ]
      : []),
  ].filter((text) => typeof text === 'string' && text.length > 0);
}

/**
 * `ended`에서 금지되는 표현. **행동 제안과 현재형 호칭 둘 다.**
 *
 * ⚠️ 회고 표현은 여기 없다 — `돌아보면` · `그때` · `다음 관계에서`는 v1.40.1이
 * 명시적으로 허용한 것이고, 막으면 ended 사용자에게 할 말이 사라진다.
 */
/**
 * ⚠️ **`확인해봐` · `맞춰봐`는 여기 없다.** 그 둘은 혼자서도 할 수 있는 동사라
 * 단어만으로는 대상을 알 수 없다 — 실제로 끝난 관계의 정상 회고 문장이 전부 그
 * 어휘를 쓴다(`무엇이 달랐는지 확인해봐`). 대상이 상대인 경우는 아래
 * `OUTWARD_WITH_TARGET`가 따로 본다.
 */
const ENDED_FORBIDDEN = [
  '지금 이 관계',
  '지금 상대',
  '현재 상대',
  '앞으로 둘이',
  '다가가',
  '먼저 연락',
  '연락해 봐',
  '연락해보',
  '물어봐',
  '물어보자',
  '표현해봐',
  '표현해보자',
  '제안해봐',
  '다음 만남',
  '다시 만나',
  '거리를 좁히',
];

/* ── ENDED-01 · 세 fixture 전부 outward 0 ──────────────────────────────── */
console.log('ENDED-01 · ended 렌더 문자열에 outward 표현 0');
{
  for (const [name, result] of [
    ['Event 0', noEvent],
    ['Event 5', withEvents],
    ['Lens full', lensFull],
  ]) {
    check(`${name} — 시제가 former다 (검사의 전제)`, result.tense === 'former', result.tense);
    const texts = allText(result);
    check(`${name} — 검사 대상 문자열이 수집됐다 (${texts.length}개)`, texts.length > 20, texts.length);
    const hits = findForbidden(texts, ENDED_FORBIDDEN);
    check(`${name} — 금지 표현 0건`, hits.length === 0, hits.slice(0, 5));

    /*
      대상이 상대인 확인·조율 제안. 스캐너의 `OUTWARD_TARGET_MARKER`와 같은 규칙이다.

      ⚠️ **조사까지 본다.** `상대`라는 낱말만 찾으면 `'상대의 문제'로만 남기지 말고`
      같은 회고 문장이 걸린다 — 거기서 `상대`는 소유격이고 행위의 대상이 아니다.
    */
    const withTarget = texts.filter(
      (text) =>
        /상대(에게|한테|와|과|랑)|서로|둘이서?/.test(text) &&
        /(확인해|맞춰|정해)\s*(봐|보자|보면)/.test(text),
    );
    check(`${name} — 상대와 맞춰보라는 제안 0건`, withTarget.length === 0, withTarget.slice(0, 3));
  }

  /*
    ⚠️ **대조군이 없으면 이 검사는 무의미하다.** 금지 목록이 너무 좁아서 아무것도
    잡지 못해도 통과하기 때문이다. 진행 중인 관계에서는 같은 어휘가 실제로 나와야 한다.
  */
  const currentHits = findForbidden(allText(current), ENDED_FORBIDDEN);
  check(
    '대조군(진행 중)에서는 같은 어휘가 실제로 나온다 — 검사가 살아 있다',
    currentHits.length > 0,
    currentHits.slice(0, 3).map((hit) => hit.word),
  );
}

/* ── ENDED-02 · outward 질문·행동이 구조적으로 0 ───────────────────────── */
console.log('\nENDED-02 · 상대를 향한 질문 · 행동이 만들어지지 않는다');
{
  for (const [name, result] of [
    ['Event 0', noEvent],
    ['Event 5', withEvents],
    ['Lens full', lensFull],
  ]) {
    check(
      `${name} — lifecycle이 outward 질문을 막는다`,
      result.lifecycle.allowsOutwardQuestions === false,
      result.lifecycle,
    );
    check(
      `${name} — Candidate 질문 0개`,
      result.report.candidates.every((candidate) => candidate.questions.length === 0),
    );
    check(`${name} — 무료 질문 0개`, result.free.questions.length === 0);
    check(`${name} — 연결 질문 0개`, result.report.connectionQuestions.length === 0);
    check(
      `${name} — outward audience Chapter 0개`,
      result.chapters.every((chapter) => chapter.audience !== 'outward'),
      result.chapters.filter((chapter) => chapter.audience === 'outward').map((c) => c.kind),
    );
    check(
      `${name} — outward action 0개`,
      result.report.actions.every((action) => action.audience !== 'outward'),
      result.report.actions,
    );
    check(`${name} — 다가가는 힌트가 없다`, result.report.approachInsight === null);
    /* 회고 한 줄은 남아야 한다 — 주어가 '나'라서 안전하다 */
    check(`${name} — 열린 질문은 남는다`, Boolean(result.free.openQuestion));
  }
}

/* ── ENDED-03 · 스캐너가 실제 누출 문장을 잡는다 (probe · 동작 검증) ───── */
console.log('\nENDED-03 · 스캐너 동작 (소스 스캔이 아니라 실제 판정)');
{
  /** 실측에서 새어 나온 문장과 같은 계열 */
  const LEAKS = [
    '한쪽이 더 가까이 다가가고 싶을 때 어떻게 할지 미리 정해두면 좋아.',
    '연락 방식이 다르면 먼저 연락해 보는 것도 방법이야.',
    '그 부분은 상대에게 물어봐.',
    '표현 방식이 다르니 표현해 보자.',
    '다음 만남에서 확인해보면 좋아.',
    '조금씩 거리를 좁히면 편해져.',
    '지금 이 관계에서는 다르게 보일 수 있어.',
  ];
  /** 끝난 관계에서 **허용**되는 회고 문장. 과필터도 결함이다 */
  const ALLOWED = [
    '그때 무엇이 걸렸는지 돌아보면 남는 게 있어.',
    '다음 관계에서 더 일찍 알아차릴 수 있는 신호로 남길 수 있어.',
    '그 경험에서 남은 기준이 뭔지 정리해두면 좋아.',
    '말한 기준보다 실제 반응이 더 컸던 자리가 있었어.',
    '그때는 서로 연락 리듬이 달랐어.',
    '가까워졌다고 느낀 순간이 있었어.',
  ];

  async function probe(texts, tense) {
    const response = await fetch(`${BASE_URL}/api/ai/contract-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'tense-scan-probe', raw: texts, tense }),
    });
    const json = await response.json();
    if (!json.ok) throw new Error(`probe error: ${JSON.stringify(json)}`);
    return json.results;
  }

  const blocked = await probe(LEAKS, 'former');
  for (const row of blocked) {
    check(`차단 — ${row.text.slice(0, 26)}…`, row.safe === false, row);
  }

  const passed = await probe(ALLOWED, 'former');
  for (const row of passed) {
    check(`통과 — ${row.text.slice(0, 26)}…`, row.safe === true, row);
  }

  /*
    ⚠️ **`current`에서는 같은 문장이 통과해야 한다.** 이 스캐너는 시제 조건부이고,
    진행 중인 관계에 '물어봐'를 막으면 제품이 파는 것(확인할 질문)이 사라진다.
  */
  const currentScan = await probe(LEAKS, 'current');
  check(
    '진행 중인 관계에서는 같은 문장이 통과한다 (과필터 아님)',
    currentScan.every((row) => row.safe === true),
    currentScan.filter((row) => !row.safe),
  );
}

/* ── ENDED-04 · 3단 방어가 전부 자리에 있다 ───────────────────────────── */
console.log('\nENDED-04 · Generation · Sanitization · Fixture 3단');
{
  const prompts = await readFile(join(ROOT, 'src/services/ai/promptTemplates.ts'), 'utf8');
  const safety = await readFile(join(ROOT, 'src/services/ai/safety.ts'), 'utf8');
  const versions = await readFile(join(ROOT, 'src/services/ai/promptVersions.ts'), 'utf8');

  /* ① Generation */
  check(
    '프롬프트가 former에서 행동 제안을 금지한다',
    prompts.includes('상대에게 무엇을 하라고 쓰지 않는다'),
  );
  check(
    '프롬프트가 허용되는 회고 표현을 함께 보여준다 (금지만 적으면 쓸 말이 없어진다)',
    prompts.includes('다음 관계에서 더 일찍 알아차릴 수 있는 신호'),
  );
  check(
    '공유 [시제] 블록에 있다 — Task마다 따로 붙이지 않았다',
    /TENSE_CONTRACT[\s\S]{0,2000}상대에게 무엇을 하라고 쓰지 않는다/.test(prompts),
  );

  /* ② Sanitization */
  check(
    '스캐너에 former 행동 제안 패턴이 있다',
    safety.includes('FORMER_OUTWARD_ACTION_PATTERNS'),
  );
  check(
    '시제 검사 함수가 두 목록을 함께 돌린다 (호출부를 고치지 않아도 적용된다)',
    /FORMER_TENSE_PATTERNS,\s*\.\.\.FORMER_OUTWARD_ACTION_PATTERNS/.test(safety),
  );

  /* 캐시 무효화 — 안 올리면 수정이 캐시된 세션에 적용되지 않는다 */
  check(
    '프롬프트가 바뀐 Task의 버전이 전부 올라갔다',
    /*
      ⚠️ v1.46.4 SEMANTIC — `deep-report`가 v5 → v6이 됐다(§7이 장면·semantic 칸을
      더했다). 이 검사의 뜻은 "PHASE 4의 시제 수정이 캐시된 세션에도 적용되는가"이고,
      그 뜻은 버전이 **v5 이상**이면 성립한다. 다만 느슨하게 쓰지 않고 현재 값으로
      다시 고정한다 — 이 파일이 이 목록을 손으로 관리하는 이유가 그것이다.
    */
    ['relationship-v8', 'compatibility-v6', 'deep-report-v7', 'premium-mbti-v4',
      'premium-saju-v4', 'premium-zodiac-v4', 'premium-cross-lens-v4']
      .every((version) => versions.includes(version)),
  );
  check(
    'TENSE_CONTRACT를 쓰지 않는 Task는 그대로다',
    versions.includes('history-v3-axis') && versions.includes('observed-v2-photo'),
  );
}

report('Ended Safety Fixture');
