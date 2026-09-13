/**
 * v1.46.4 Fixture 세트 — A / B / C / D (§44)
 *
 * ══ 왜 파일을 따로 뺐나 ═══════════════════════════════════════════════════
 *
 * 이번 버전의 검사 세 갈래(VALUE · EVENT-LIMIT · QUESTION-FIT)가 **같은 세션**을
 * 봐야 한다. 각 스크립트가 자기 fixture를 들고 있으면 "VALUE는 통과하는데
 * QUESTION-FIT은 실패"의 원인이 데이터인지 구조인지 구분되지 않는다 — v1.46.4 이전
 * `run-value-fixtures.mjs`가 `run-premium-fixtures.mjs`의 세션을 그대로 복사해
 * 쓴 것도 같은 이유였고, 이제 복사 대신 공유한다.
 *
 * ⚠️ **A와 B는 사건 말고 전부 같다.** 그래야 "사건이 결과를 바꿨는가"를 두 결과의
 * 차이로만 말할 수 있다. C는 B와 **사건 조합만** 다르다(§44 C의 목적 그대로).
 */

/* ── 공통 SELF ───────────────────────────────────────────────────────────── */

export const DECLARED = {
  contact: 5,
  conflict: 'soon',
  alone: 4,
  affection: 'a2',
  hobby: 'h2',
};

export const EXPERIENCE = {
  important: ['contact', 'alone', 'conflict'],
  hardest: 'contact_drop',
  selfGap: 'yes',
  adaptive: { axis: 'contact', optionId: 'disconnect' },
};

export const CURRENT = {
  signals: { contact: 'often', conflict: 'rarely', alone: 'sometimes', affection: 'often' },
  askedAt: '2026-09-08T00:00:00.000Z',
};

const TARGET_BASE = {
  relation: 'crush',
  contact: 'l',
  conflict: 'h',
  alone: 'h',
  affection: 'm',
  mbti: 'ENFP',
  preferences: {
    interests: [
      { id: 'i-movie', category: 'movie_show', label: '영화 · 공연' },
      { id: 'i-walk', category: 'walk', label: '산책 · 자연' },
    ],
  },
};

function coupleEntry({ id, createdAt, states, declared }) {
  return {
    id,
    analysisId: `couple-${id}`,
    createdAt,
    audience: 'couple',
    context: { relationshipStatus: 'dating', targetRelation: 'crush' },
    profileSnapshot: { mbti: 'INFP' },
    declaredSnapshot: {
      contact: null,
      conflict: null,
      alone: null,
      affection: null,
      hobby: null,
      ...declared,
    },
    relationshipEvidence: { important: [], hardest: null, selfGap: null, adaptive: null },
    mirrorSnapshot: {
      insights: Object.entries(states).map(([axis, state]) => ({
        axis,
        state,
        declaredText: `${axis} declared`,
        relationshipSignal: '말한 기준보다 크게 반응한 신호가 있었음',
      })),
      focusAxis: null,
    },
    coreInsight: { original: `${id} core`, userCorrection: null, verdict: null },
    evidenceCoverage: 'medium',
  };
}

export const ENTRIES = [
  coupleEntry({
    id: 'h1',
    createdAt: '2026-06-01T00:00:00.000Z',
    states: { contact: 'GAP', alone: 'MATCH', conflict: 'GAP' },
    declared: { contact: 2, alone: 4 },
  }),
  coupleEntry({
    id: 'h2',
    createdAt: '2026-08-01T00:00:00.000Z',
    states: { contact: 'GAP', alone: 'GAP', conflict: 'MATCH' },
    declared: { contact: 5, alone: 4 },
  }),
];

/* ── 사건 세트 ──────────────────────────────────────────────────────────── */

/**
 * B의 사건 5건. **연락·갈등 계열이 많다** — 이 세션의 GAP 축(contact)과 겹치게 만들어
 * 관련성 레이어가 실제로 그 축을 고르는지 볼 수 있게 한다.
 *
 * ⚠️ 본문에 상대의 의도를 넣지 않았다(§17). 전부 사용자가 관찰한 것까지다.
 */
export const EVENTS_B = [
  {
    id: 'ev-b1',
    type: 'contact_change',
    description: '답장 간격이 며칠 사이에 눈에 띄게 길어졌어',
    myReaction: '먼저 묻지는 않았어',
  },
  {
    id: 'ev-b2',
    type: 'conflict',
    description: '약속 시간에 늦었는데 연락이 없어서 서운했어',
    myReaction: '말 안 하고 넘어감',
  },
  {
    id: 'ev-b3',
    type: 'distance',
    description: '주말 약속을 두 번 미루게 됐어',
  },
  {
    id: 'ev-b4',
    type: 'care_received',
    description: '감기 걸렸을 때 약을 사다 줬어',
    myReaction: '고맙다고 짧게 말했어',
  },
  {
    id: 'ev-b5',
    type: 'contact_change',
    description: '늦게까지 답이 없다가 다음 날 아침에 길게 답이 왔어',
  },
];

/**
 * C의 사건 5건. **B와 개수는 같고 종류 조합이 다르다** — 호감·가까워짐 계열이다.
 *
 * 목적(§44 C): Mirror 판정이 B와 완전히 같은데도 SO WHAT과 질문이 달라지는지.
 * 같으면 개인화가 구현되지 않은 것이다.
 */
export const EVENTS_C = [
  {
    id: 'ev-c1',
    type: 'affection_felt',
    description: '먼저 안부를 물어봐 줬어',
  },
  {
    id: 'ev-c2',
    type: 'closer',
    description: '처음으로 두 시간 넘게 통화했어',
    myReaction: '끊고 나서 기분이 좋았어',
  },
  {
    id: 'ev-c3',
    type: 'meeting',
    description: '먼저 주말에 만나자고 제안했어',
  },
  {
    id: 'ev-c4',
    type: 'care_received',
    description: '늦은 밤에 집까지 데려다줬어',
  },
  {
    id: 'ev-c5',
    type: 'closer',
    description: '가족 얘기를 먼저 꺼냈어',
  },
];

/** §41 EVENT-LIMIT-03 · 12 — 회귀 stress용. **제품 max가 아니다** */
export function stressEvents(count) {
  const types = [
    'contact_change',
    'conflict',
    'distance',
    'closer',
    'care_received',
    'affection_felt',
    'meeting',
    'other',
  ];
  return Array.from({ length: count }, (_, index) => ({
    id: `ev-s${index + 1}`,
    type: types[index % types.length],
    description: `기억나는 장면 ${index + 1} — 그날 있었던 일을 짧게 적어둔 것`,
    ...(index % 3 === 0 ? { myReaction: `그때 나는 ${index + 1}번처럼 반응했어` } : {}),
  }));
}

/* ── Fixture A / B / C / D ──────────────────────────────────────────────── */

const FULL_BASE = {
  status: 'dating',
  declared: DECLARED,
  experience: EXPERIENCE,
  currentRelationship: CURRENT,
  mbti: 'INFP',
  entries: ENTRIES,
};

/** A — Target O · high-data · **사건 0** */
export const FIXTURE_A = {
  ...FULL_BASE,
  target: { ...TARGET_BASE, events: [] },
};

/** B — A와 모든 것이 같고 **사건 5건**만 추가 */
export const FIXTURE_B = {
  ...FULL_BASE,
  target: { ...TARGET_BASE, events: EVENTS_B },
};

/** C — B와 Mirror 판정이 같고 **사건 조합만** 다르다 */
export const FIXTURE_C = {
  ...FULL_BASE,
  target: { ...TARGET_BASE, events: EVENTS_C },
};

/** D — **끝난 관계** · 사건 5건. outward question 0이어야 한다 */
export const FIXTURE_D = {
  ...FULL_BASE,
  status: 'ended',
  target: { ...TARGET_BASE, relation: 'ex', events: EVENTS_B },
};

/** Sparse — 연결이 만들어지지 않는 세션. 팔 것이 없을 때의 동작을 고정한다 */
export const FIXTURE_SPARSE = {
  status: 'solo_exp',
  declared: { contact: 3, conflict: null, alone: null, affection: null, hobby: null },
  experience: { important: [], hardest: null, selfGap: null, skipped: true },
  currentRelationship: { signals: {}, askedAt: null },
  target: {
    relation: null,
    contact: 'x',
    conflict: 'x',
    alone: 'x',
    affection: 'x',
    mbti: null,
    preferences: { interests: [] },
    events: [],
  },
  mbti: null,
  entries: [],
};

/* ── 금지 어휘 ──────────────────────────────────────────────────────────── */

/* ── §15 · SEM A/B/C/D — 같은 contact GAP · 사건 **의미만** 다르다 ───────── */

/**
 * §15 — 이 네 fixture가 이번 Pass의 **핵심 판정 대상**이다.
 *
 * ══ 기존 B/C와 무엇이 다른가 ═══════════════════════════════════════════════
 *
 * `EVENTS_B`/`EVENTS_C`는 **종류 조합**이 다르다(연락·갈등 계열 vs 호감·가까워짐
 * 계열). 그래서 결과가 달라져도 그건 "종류 기반 개인화가 동작한다"는 뜻이고,
 * v1.46.4 HARDENING에서 이미 통과했던 검사다.
 *
 * 아래 네 개는 **종류가 전부 같다**(`contact_change` 2건). 다른 것은 사용자가 적은
 * 문장의 의미뿐이다:
 *
 * ```
 * A  사건 없음
 * B  갑자기 줄었을 때 마음이 식은 줄 알았다 · 이유를 몰라 불안했다
 * C  평소 적은 건 괜찮았다 · 약속 직전에 끊긴 게 특히 불편했다
 * D  바쁠 때 줄어드는 건 이해했다 · 갈등 후 답이 없던 게 힘들었다
 * ```
 *
 * ⚠️ **Mirror 판정 입력은 네 개가 완전히 같다**(`FULL_BASE` · `TARGET_BASE`). 결과가
 * 달라진다면 그 원인은 사건의 의미밖에 없고, 같다면 §17의 FAIL 기준에 걸린다.
 *
 * ⚠️ 본문에 상대의 의도를 넣지 않았다(§2-1). 전부 **사용자가 관찰한 것과 자기
 * 반응**까지다 — 'B: 마음이 식은 줄 알았다'는 사용자의 추측을 사용자가 기록한
 * 것이고, 그건 상대의 마음이 아니라 사용자의 반응이다.
 */
export const EVENTS_SEM_B = [
  {
    id: 'ev-sb1',
    type: 'contact_change',
    description: '연락이 갑자기 줄었을 때 마음이 식은 줄 알았어',
    myReaction: '이유를 몰라서 며칠 동안 계속 불안했어',
  },
  {
    id: 'ev-sb2',
    type: 'contact_change',
    description: '평소랑 다르게 답이 짧아진 날이 있었어',
    myReaction: '무슨 일인지 묻지도 못하고 혼자 생각만 했어',
  },
];

export const EVENTS_SEM_C = [
  {
    id: 'ev-sc1',
    type: 'contact_change',
    description: '평소에 연락이 적은 건 서로 편해서 괜찮았어',
    myReaction: '그건 신경 안 쓰고 지냈어',
  },
  {
    id: 'ev-sc2',
    type: 'contact_change',
    description: '만나기로 한 날 직전에 연락이 끊겼을 때는 유독 불편했어',
    myReaction: '기다리는 동안 아무것도 못 했어',
  },
];

export const EVENTS_SEM_D = [
  {
    id: 'ev-sd1',
    type: 'contact_change',
    description: '일이 바쁠 때 연락이 줄어드는 건 이해가 됐어',
    myReaction: '그럴 때는 먼저 기다려줬어',
  },
  {
    id: 'ev-sd2',
    type: 'contact_change',
    description: '얘기가 엇갈린 다음에 아무 답이 없던 날이 힘들었어',
    myReaction: '대화가 멈춘 게 제일 답답했어',
  },
];

/** A — 사건 0. 나머지 셋의 기준선 */
export const SEM_A = { ...FULL_BASE, target: { ...TARGET_BASE, events: [] } };
export const SEM_B = { ...FULL_BASE, target: { ...TARGET_BASE, events: EVENTS_SEM_B } };
export const SEM_C = { ...FULL_BASE, target: { ...TARGET_BASE, events: EVENTS_SEM_C } };
export const SEM_D = { ...FULL_BASE, target: { ...TARGET_BASE, events: EVENTS_SEM_D } };

/** 상대의 마음·의도를 추정하는 표현 (VALUE-13 · QUESTION-FIT-08) */
export const PARTNER_INTENT = [
  '상대는 분명',
  '상대도 너를',
  '상대는 너를',
  '상대의 마음은',
  '상대가 원하는 건',
  '상대는 사실',
  '마음이 식어',
  '일부러',
];

/** 운명·성공 확률 주장 (VALUE-14) */
export const FATE_CLAIMS = [
  '이 관계는 성공',
  '결국 헤어질',
  '재회 가능',
  '운명',
  '천생연분',
  '무조건',
  '확실히',
  '잘될 확률',
];

/**
 * §28 · §29 — 질문에서 금지되는 것.
 *
 * ⚠️ 두 갈래다: **문체**(심리검사·상담사 말투)와 **의도**(시험·유도·죄책감).
 * 한 목록에 섞어두면 실패했을 때 무엇을 고쳐야 하는지가 흐려져서 나눠 적는다.
 */
export const QUESTION_STYLE_BANNED = ['인가요', '습니까', '하십니까', '어느 정도 시간이'];
export const QUESTION_INTENT_BANNED = [
  '나 어떻게 생각해',
  '맞지?',
  '나는 계속 기다',
  '고백',
  '다시 만날',
  '왜 그랬을까',
];

/* ── 실행 헬퍼 ──────────────────────────────────────────────────────────── */

const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';

export async function run(body) {
  const response = await fetch(`${BASE_URL}/api/dev/premium-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `HTTP ${response.status} — dev 서버가 떠 있는지 확인해줘${detail ? ` · ${detail}` : ''}`,
    );
  }
  const json = await response.json();
  if (!json.ok) throw new Error(`route error: ${JSON.stringify(json)}`);
  return json;
}

export function createChecker() {
  const state = { pass: 0, failures: [] };

  function check(label, condition, detail) {
    if (condition) {
      state.pass += 1;
      console.log(`  ✓ ${label}`);
      return;
    }
    state.failures.push({ label, detail });
    console.log(`  ✗ ${label}`);
    if (detail !== undefined) console.log(`      ${JSON.stringify(detail)}`);
  }

  function report(title) {
    console.log(`\n${'─'.repeat(64)}`);
    console.log(`${title} — ${state.pass} passed · ${state.failures.length} failed`);
    if (state.failures.length > 0) {
      console.log('\n실패:');
      for (const failure of state.failures) console.log(`  · ${failure.label}`);
      process.exitCode = 1;
      return;
    }
    console.log('전부 통과.');
  }

  return { check, report, state };
}

/**
 * 소스에서 **주석을 걷어낸다.**
 *
 * ⚠️ 이 헬퍼가 없으면 카피 검사가 거짓 실패한다. 이 저장소의 파일들은 "예전에는
 * `3개까지만 받을게`였다"처럼 **바뀐 이유를 주석에 남기는** 규칙을 지키는데, 순진한
 * `includes` 스캔은 그 설명문을 화면 카피로 읽는다. 실제로 EVENT-LIMIT-01이 처음
 * 그렇게 실패했다 — 코드는 맞았고 검사가 틀렸다.
 */
export function stripComments(source) {
  return (
    source
      /* 블록 주석. JSX의 `{/* … *\/}`도 이 패턴 안에 들어간다 */
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      /*
        줄 주석. **`://`를 피한다** — URL이 들어 있는 줄을 통째로 지우면 그 줄의
        코드까지 사라져서 다른 검사가 조용히 통과하게 된다.
      */
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  );
}

/** 문자열 목록에서 금지 어휘를 찾는다 */
export function findForbidden(strings, words) {
  const hits = [];
  for (const text of strings) {
    if (typeof text !== 'string') continue;
    for (const word of words) {
      if (text.includes(word)) hits.push({ word, text });
    }
  }
  return hits;
}
