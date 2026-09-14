/**
 * v1.46.4 Premium Action Layer Fixture — Insight → Verify → Next Move → Observe → Decision Signal
 *
 * ```
 * ACT-SEL     결정론 Action 후보 선택 · Top 3 rank 불변 · AI 없이 행동 문장을 지어내지 않는다
 * ACT-01~05   연락 · 갈등 · 개인 시간 · 근거 부족 · ended
 * ACT-GATE    조종 · 결정 대행 · 마음 관찰 · 단정 · 예측 · 초과 · 대상 불일치 · ended outward
 * ACT-RENDER  AI plan이 선택된 카드에만 붙는다 · VERIFY 재사용 · 카드 문장 불변
 * ACT-FREE    무료에는 Action Layer가 없다
 * ACT-CALLS   Provider 호출 수 불변(같은 Deep Report 응답의 필드)
 * ```
 *
 * ⚠️ 문장 **품질**(Next Move Specificity · Observe Clarity · Decision Signal rubric)은 사람이
 *    Real Provider QA 기록을 읽고 매긴다. 여기서는 계약 · 안전 · 배선을 값으로 고정한다.
 *
 * 실행: 터미널 A `npm run dev` → 터미널 B `npm run test:action`
 */

import './_aiTestGuard.mjs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FIXTURE_SPARSE, SEM_B, SEM_C, createChecker, run, stripComments } from './fixtures-v1464.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const BASE_URL = process.env.LYM_BASE_URL ?? 'http://localhost:3000';
const { check, report } = createChecker();

console.log('\nPremium Action Layer Fixture — v1.46.4\n');

async function post(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} — dev 서버 확인`);
  const json = await response.json();
  if (!json.ok) throw new Error(`route error: ${JSON.stringify(json)}`);
  return json;
}
const withRequest = (body) => post('/api/dev/premium-test?withAiContext=1', body);
const contract = (body) => post('/api/ai/contract-test', { task: 'deep-report-narrative', ...body });

const ENDED = { ...SEM_B, status: 'ended', target: { ...SEM_B.target, relation: 'ex' } };
const CONFLICT_EVENT = {
  ...SEM_B,
  target: {
    ...SEM_B.target,
    events: [
      {
        id: 'ev-cf1',
        type: 'conflict',
        description: '말다툼 뒤에 바로 풀고 싶었는데 그날은 말이 안 나왔어',
        myReaction: '결국 하루 지나서 얘기했어',
      },
    ],
  },
};

const META = /동기화율|자료\s*\d+\s*종|근거\s*\d+\s*(개|종)|판정|(^|[^가-힣])축(?![하적구소제])|score|priority/i;
const planTexts = (plan) =>
  plan
    ? [
        plan.title,
        plan.priorityReason ?? '',
        plan.nextMove ?? '',
        plan.verificationQuestion ?? '',
        plan.observeSignal ?? '',
        ...plan.decisionSignals.flatMap((signal) => [signal.ifObserved, signal.interpretation]),
        plan.unresolved ?? '',
      ].filter(Boolean)
    : [];

/* ═══════════════════════════════════════════════════════════════════════════
   ACT-SEL — 결정론 선택
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('ACT-SEL · Action 후보는 결정론이 고르고, Top 3 순위는 그대로다');
{
  const r2 = await withRequest(SEM_B);
  const target = r2.aiRequest.context.actionTarget;
  check('ACT-SEL · AI 요청에 Action 카드가 실린다', Boolean(target), target);
  check(
    'ACT-SEL · 요청의 Action 카드와 화면 Action 블록이 같은 카드다',
    r2.actionTargetId === r2.report.actionPlan?.sourceCandidateId,
    { request: r2.actionTargetId, rendered: r2.report.actionPlan?.sourceCandidateId },
  );
  check(
    'ACT-SEL · Action 카드는 Top 3 안에 있다',
    r2.semanticTopCandidateIds.includes(r2.actionTargetId),
    { top: r2.semanticTopCandidateIds, target: r2.actionTargetId },
  );
  check(
    'ACT-SEL · Top 3 rank는 Action Layer와 무관하게 그대로다',
    JSON.stringify(r2.report.candidates.slice(0, 3).map((card) => card.id)) === JSON.stringify(r2.semanticTopCandidateIds),
  );
  check(
    'ACT-SEL · 허용집합은 Action 카드의 카드 허용집합과 같다(새 근거 없음)',
    JSON.stringify(r2.aiRequest.actionAllowance.evidenceRefs) ===
      JSON.stringify(r2.aiRequest.candidates.find((card) => card.candidateId === r2.actionTargetId)?.evidenceRefs),
  );
  check(
    'ACT-SEL · AI 없이는 행동 문장을 지어내지 않는다 (nextMove · observe · signal 없음)',
    r2.report.actionPlan && r2.report.actionPlan.source === 'deterministic' &&
      r2.report.actionPlan.nextMove === null && r2.report.actionPlan.observeSignal === null &&
      r2.report.actionPlan.decisionSignals.length === 0,
    r2.report.actionPlan,
  );
  check(
    'ACT-SEL · §17 모델 요청 · 화면 블록에 내부 점수가 없다',
    !('score' in target) && !('priorityScore' in target) && !('score' in (r2.report.actionPlan ?? {})),
    Object.keys(target ?? {}),
  );
  check(
    'ACT-SEL · 사용자-facing 문구에 메타·점수 어휘 0',
    planTexts(r2.report.actionPlan).every((text) => !META.test(text) && !/\d+\s*점/.test(text)),
    planTexts(r2.report.actionPlan),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACT-01 ~ 05
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nACT-01 · 연락 — 불편 장면이 붙은 연락 카드가 먼저다');
const act01 = await withRequest(SEM_C);
{
  const selected = act01.report.candidates.find((card) => card.id === act01.actionTargetId);
  const priority = act01.actionPriorities.find((item) => item.candidateId === act01.actionTargetId);
  check('ACT-01 · 선택 카드 주제가 연락이다', selected?.axis === 'contact', selected?.axis);
  check('ACT-01 · 불편 장면이 선택 이유에 들어간다', priority?.signals.includes('discomfort_event'), priority?.signals);
  check(
    'ACT-01 · 왜 먼저인지 한 줄이 있다(사용자 언어)',
    typeof act01.report.actionPlan?.priorityReason === 'string' && act01.report.actionPlan.priorityReason.length > 0,
  );
}

console.log('\nACT-02 · 갈등 — 갈등 장면이 있으면 #2 카드가 Action 대상이 된다(rank는 그대로)');
{
  const r = await withRequest(CONFLICT_EVENT);
  const selected = r.report.candidates.find((card) => card.id === r.actionTargetId);
  check('ACT-02 · 선택 카드 주제가 갈등 해결이다', selected?.axis === 'conflict', selected?.axis);
  check('ACT-02 · 선택 카드가 Top 3 첫 카드가 아니어도 된다(별도 actionPriority)', r.semanticTopCandidateIds[0] !== r.actionTargetId, r.semanticTopCandidateIds);
  check(
    'ACT-02 · 그래도 Top 3 순서는 그대로다',
    JSON.stringify(r.report.candidates.slice(0, 3).map((card) => card.id)) === JSON.stringify(r.semanticTopCandidateIds),
  );
}

console.log('\nACT-04 · 근거 부족 — 억지 action plan을 만들지 않는다');
{
  const r = await withRequest(FIXTURE_SPARSE);
  check('ACT-04 · Action 카드가 요청에 실리지 않는다', !r.aiRequest.context.actionTarget && r.aiRequest.actionAllowance === null);
  check(
    'ACT-04 · 화면에 행동 계획이 없다 (블록 없음 또는 unresolved)',
    r.report.actionPlan === null || (r.report.actionPlan.mode === 'unresolved' && r.report.actionPlan.nextMove === null),
    r.report.actionPlan,
  );
}

console.log('\nACT-05 · ended — 현재 상대를 향한 행동 0, 다음 관계의 확인 기준으로 전환');
const ended = await withRequest(ENDED);
{
  const target = ended.aiRequest.context.actionTarget;
  check('ACT-05 · lifecycle=former', target?.lifecycle === 'former', target);
  check('ACT-05 · 서버 허용집합의 canAskPartner=false', ended.aiRequest.actionAllowance?.canAskPartner === false, ended.aiRequest.actionAllowance?.canAskPartner);
  check('§41.7 · Job 게이트 값은 모델 context에 없다', target && !('canAskPartner' in target) && !JSON.stringify(ended.aiRequest.context).includes('allowsOutwardQuestions'), Object.keys(target ?? {}));
  check(
    'ACT-05 · 결정론 블록에 상대에게 묻는 질문이 없다',
    !ended.report.actionPlan?.verificationQuestion || !/너는|너한테|해줄\s*수\s*있어\?/.test(ended.report.actionPlan.verificationQuestion),
    ended.report.actionPlan?.verificationQuestion,
  );
  check(
    'ACT-05 · 결정론 블록 문구에 현재형 호칭(지금 ) 0',
    planTexts(ended.report.actionPlan).every((text) => !text.includes('지금 ')),
    planTexts(ended.report.actionPlan),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACT-GATE — Quality Gate (H)
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nACT-GATE · 행동 게이트 — 조종 · 결정 대행 · 마음 관찰 · 단정 · ended outward');

const CARD_REF = { source: 'declared', field: 'contact' };
const CUR_REF = { source: 'current_relationship', field: 'contact' };
const BASE_RAW = {
  narratives: [
    {
      insightId: 'ins-1',
      headline: '연락 리듬이 달라지는 순간에 반응이 커질 수 있어',
      interpretation:
        '답이 늦어진 날과 먼저 묻지 못한 날이 나란히 있어서, 기다리는 시간 자체가 부담이 되는 모양일 수 있어. 왜 그랬는지는 이 자료만으로 알 수 없어.',
      evidenceRefs: [CARD_REF],
    },
  ],
};
const ALLOWED_INSIGHT = [{ id: 'ins-1', evidenceRefs: [CARD_REF] }];

function allowanceFor(candidateId, overrides = {}) {
  return {
    candidateId,
    evidenceRefs: [CARD_REF, CUR_REF],
    eventIds: ['ev-1'],
    sceneTexts: ['연락이 갑자기 줄었을 때 마음이 식은 줄 알았어', '이유를 몰라서 며칠 동안 계속 불안했어'],
    canAskPartner: true,
    unresolvedPoints: [],
    ...overrides,
  };
}
/*
  Action Alignment 이후 — 기본 allowance의 장면(갑작스러운 변화 · 이유 모름)을 행동이 실제로 싣는다.
  예전 문장('연락이 늦어지는 날엔 어느 정도 알려주면')은 이제 주제 수준 조언으로 거부된다(ALIGN).
*/
const GOOD_CONTACT = {
  sourceCandidateId: 'cand-1',
  nextMove: '평소와 달라지는 날엔 이유를 짧게라도 알려주는 방식이 편한지 한 번 맞춰봐',
  verificationQuestion: null,
  observeSignal: '답 자체보다, 둘이 정한 방식이 평소와 달라진 날에도 실제로 지켜지는지 봐',
  decisionSignals: [
    {
      ifObserved: '달라진 날에도 이유를 짧게 알려줘',
      interpretation: '연락 횟수보다 이유를 알 수 있는지가 더 중요했다는 가설을 더 볼 수 있어',
    },
    {
      ifObserved: '방식을 정해도 같은 순간마다 불편이 되풀이돼',
      interpretation: '연락량보다 흐름을 예측할 수 있는지에 대한 기대 차이가 실제로 걸리는 지점인지 더 확인해볼 수 있어',
    },
  ],
  unresolved: null,
  usedEvidenceRefs: [CARD_REF, CUR_REF],
  usedEventIds: ['ev-1'],
};

async function gate(plan, { allowance = allowanceFor('cand-1'), tense = 'current', narrowedCondition = null } = {}) {
  const result = await contract({
    raw: { ...BASE_RAW, actionPlan: plan },
    allowed: ALLOWED_INSIGHT,
    candidates: [],
    actionAllowance: allowance,
    actionNarrowedCondition: narrowedCondition,
    tense,
  });
  return result.action;
}

{
  const good = await gate(GOOD_CONTACT);
  check('ACT-01 · 좁혀진 조건(설명 방식)을 다루는 연락 plan은 통과한다', good.kept, good.violations);
  check('ACT-01 · Next Move가 연락량 늘리기가 아니다', !/연락을?\s*(더\s*)?(늘려|자주\s*해)/.test(good.plan?.nextMove ?? ''), good.plan?.nextMove);
  check('§11 · 통과한 plan의 decisionSignal은 2개 이하다', good.signalCount <= 2, good.signalCount);

  const conflictGood = await gate(
    {
      ...GOOD_CONTACT,
      nextMove: '갈등이 생겼을 때 바로 풀지, 잠깐 시간을 둘지 미리 이야기해봐',
      observeSignal: '시간을 두기로 했다면, 나중에 그 이야기가 실제로 다시 이어지는지 봐',
      decisionSignals: [
        { ifObserved: '시간을 둔 뒤에 이야기가 다시 이어져', interpretation: '바로 푸는 것보다 다시 이어질 거라는 믿음이 더 필요했다는 가설을 더 볼 수 있어' },
        { ifObserved: '시간을 둔 뒤에도 이야기가 다시 나오지 않아', interpretation: '시간 자체보다 다시 꺼내는 시점을 정하지 않은 게 걸리는 건지 더 확인해볼 수 있어' },
      ],
      usedEventIds: [],
    },
    { allowance: allowanceFor('cand-1', { eventIds: [], sceneTexts: [] }) },
  );
  check('ACT-02 · 대화 재개 타이밍을 맞추는 갈등 plan은 통과한다(회피 단정 없음)', conflictGood.kept, conflictGood.violations);

  const aloneGood = await gate(
    {
      ...GOOD_CONTACT,
      sourceCandidateId: 'cand-alone',
      nextMove: '바쁜 주에 혼자 쓰는 시간을 언제 얼마나 챙길지 먼저 정해봐',
      observeSignal: '정한 뒤에 실제 바쁜 주 일정에서도 그 시간이 확보되는지 봐',
      decisionSignals: [
        { ifObserved: '바쁜 주에도 정한 시간이 지켜져', interpretation: '혼자 시간의 양보다 미리 정해두는지가 더 중요했다는 가설을 더 볼 수 있어' },
      ],
      usedEventIds: [],
    },
    { allowance: allowanceFor('cand-alone', { eventIds: [], sceneTexts: [] }) },
  );
  check('ACT-03 · 바쁜 주 혼자 시간 확보를 확인하는 plan은 통과한다', aloneGood.kept, aloneGood.violations);

  const cases = [
    ['§22 · 일부러 답장을 늦추는 시험 행동은 버린다', { ...GOOD_CONTACT, nextMove: '일부러 답장을 늦게 해보고 반응을 봐' }, 'action_manipulative'],
    ['§22 · 일부러 거리를 두는 행동은 버린다', { ...GOOD_CONTACT, sourceCandidateId: 'cand-alone', nextMove: '며칠 일부러 거리를 둬봐', usedEventIds: [] }, 'action_manipulative', allowanceFor('cand-alone', { eventIds: [], sceneTexts: [] })],
    ['§22 · 질투 유발은 버린다', { ...GOOD_CONTACT, nextMove: '다른 친구 얘기를 해서 질투가 나는지 봐' }, 'action_manipulative'],
    ['§2-1 · 결정 대행(안 맞는 관계)은 버린다', { ...GOOD_CONTACT, decisionSignals: [{ ifObserved: '같은 불편이 반복돼', interpretation: '이 관계는 안 돼서 정리하는 게 좋다는 가설을 더 볼 수 있어' }] }, 'action_decision_replacement'],
    ['§2-1 · 성격 진단(회피형)은 버린다', { ...GOOD_CONTACT, decisionSignals: [{ ifObserved: '대화가 이어지지 않아', interpretation: '상대가 회피형이라는 가설을 더 볼 수 있어' }] }, 'action_decision_replacement'],
    ['§9 · 속마음을 관찰하라는 말은 버린다', { ...GOOD_CONTACT, observeSignal: '상대가 진심인지 봐' }, 'action_observe_inner_state'],
    ['§10 · 단정된 판단은 버린다', { ...GOOD_CONTACT, decisionSignals: [{ ifObserved: '정한 방식이 지켜져', interpretation: '확실히 연락 방식이 문제였던 거야' }] }, 'action_signal_certain'],
    ['§10 · 가설 꼴이 아닌 판단은 버린다', { ...GOOD_CONTACT, decisionSignals: [{ ifObserved: '정한 방식이 지켜져', interpretation: '연락 방식이 문제였던 거야' }] }, 'action_signal_unhedged'],
    ['기존 예측 금지는 완화되지 않는다(가능성이 커져)', { ...GOOD_CONTACT, decisionSignals: [{ ifObserved: '정한 방식이 지켜져', interpretation: '흐름이 중요했을 가능성이 커져' }] }, 'prediction_likelihood'],
    ['§7 · 추상 행동은 버린다', { ...GOOD_CONTACT, nextMove: '서로의 소통 방식을 맞춰봐' }, 'action_next_move_abstract'],
    ['§15 · 다른 카드 id는 버린다(모델이 대상을 고르지 못한다)', { ...GOOD_CONTACT, sourceCandidateId: 'cand-other' }, 'action_candidate_mismatch'],
    ['§15 · 보내지 않은 장면 id는 버린다', { ...GOOD_CONTACT, usedEventIds: ['ev-zz'] }, 'action_event_outside_allowed'],
    ['§15 · 보내지 않은 근거는 버린다', { ...GOOD_CONTACT, usedEvidenceRefs: [{ source: 'target', field: 'contact' }] }, 'action_evidence_ref_outside_allowed'],
    ['§12 · 행동만 있고 관찰·판단이 없으면 버린다', { ...GOOD_CONTACT, observeSignal: null, decisionSignals: [] }, 'action_incomplete'],
    ['§21 · 상대 의도 추정은 버린다', { ...GOOD_CONTACT, decisionSignals: [{ ifObserved: '답이 늦어져', interpretation: '상대가 원하는 건 거리라는 가설을 더 볼 수 있어' }] }, 'intent_claim'],
  ];
  for (const [label, plan, expected, allowance] of cases) {
    const result = await gate(plan, allowance ? { allowance } : {});
    check(`ACT-GATE · ${label}`, !result.kept && result.violations.includes(expected), result.violations);
  }

  const noTarget = await gate(GOOD_CONTACT, { allowance: null });
  check('ACT-04 · Action 카드가 없는 호출의 plan은 버린다', !noTarget.kept && noTarget.violations.includes('action_no_target'), noTarget.violations);

  const unresolvedOnly = await gate({
    ...GOOD_CONTACT,
    nextMove: null,
    observeSignal: null,
    decisionSignals: [],
    unresolved: '지금 정보만으로는 연락 빈도 자체가 걸리는지, 설명 없는 변화가 걸리는지 아직 구분하기 어려워.',
  });
  check('ACT-04 · unresolved만 있는 plan은 통과한다(억지 행동 없음)', unresolvedOnly.kept && unresolvedOnly.plan?.nextMove === null, unresolvedOnly.violations);

  const three = await gate({
    ...GOOD_CONTACT,
    decisionSignals: [...GOOD_CONTACT.decisionSignals, { ifObserved: '둘 다 잘 모르겠어', interpretation: '조금 더 지켜보면 구분되는지 더 확인해볼 수 있어' }],
  });
  check('§11 · decisionSignal 3개면 앞 2개만 남긴다', three.signalCount === 2 && three.droppedSignals === 1 && three.violations.includes('action_signal_over_limit'), three);

  const selfAsk = await gate({ ...GOOD_CONTACT, verificationQuestion: '그때 내가 더 답답했을까?' });
  check('§8 · current의 질문 칸이 자기 질문이면 그 칸만 뺀다', selfAsk.kept && selfAsk.verificationDropped && selfAsk.plan?.verificationQuestion === null, selfAsk);

  const noPartner = await gate(GOOD_CONTACT, { allowance: allowanceFor('cand-1', { canAskPartner: false }) });
  check('canAskPartner=false면 상대와 맞추는 행동은 버린다', !noPartner.kept && noPartner.violations.includes('action_no_partner_outward'), noPartner.violations);

  const endedAllowance = allowanceFor('cand-1', { canAskPartner: false });
  const endedOutward = await gate(
    { ...GOOD_CONTACT, nextMove: '그 사람에게 다시 연락해서 그때 왜 그랬는지 물어봐' },
    { allowance: endedAllowance, tense: 'former' },
  );
  check('ACT-05 · ended에서 재접촉 행동은 버린다', !endedOutward.kept && endedOutward.violations.some((label) => label.startsWith('former_') || label === 'action_former_outward'), endedOutward.violations);

  const endedGood = await gate(
    {
      ...GOOD_CONTACT,
      /* ⚠️ '서로 … 확인해봐'는 기존 former 스캐너(former_verify_with_partner)가 상대에게 확인하라는 말로 읽는다 */
      nextMove: '다음엔 연락 횟수보다, 흐름이 달라질 때 설명이 있는지를 먼저 확인해봐',
      observeSignal: '비슷한 상황이 오면 내가 어느 순간부터 크게 불편해지는지 봐',
      decisionSignals: [
        { ifObserved: '설명이 있을 때는 연락이 줄어도 괜찮아', interpretation: '횟수보다 설명이 있는지가 네 기준에 더 가까울 수 있어' },
      ],
      verificationQuestion: '그때 가장 힘들었던 건 연락이 줄어든 것 자체였을까, 이유를 모른 채 기다린 시간이었을까?',
    },
    { allowance: endedAllowance, tense: 'former' },
  );
  check('ACT-05 · 다음 관계의 확인 기준으로 쓴 ended plan은 통과한다', endedGood.kept && !endedGood.verificationDropped, endedGood.violations);
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACT-RENDER — AI plan이 선택된 카드에만 붙는다
   ═══════════════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════════
   ALIGN-01 ~ 05 — Action은 axis가 아니라 좁혀진 condition을 따라간다
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nALIGN · narrowedCondition이 Next Move · Observe · Decision Signal까지 살아 있어야 한다');
{
  const hedge = (text) => `${text}라는 가설을 더 볼 수 있어`;

  /* ALIGN-01 — 갈등 뒤 대화 중단 + 재개 시점 불명 (R3 D 성격) */
  const scenesD = ['얘기가 엇갈린 다음에 아무 답이 없던 날이 힘들었어', '일이 바쁠 때 연락이 줄어드는 건 이해가 됐어'];
  const allowanceD = allowanceFor('cand-1', { sceneTexts: scenesD });
  const narrowedD = '연락 횟수 자체보다, 흐름이 끊겼는데 이유를 모르는 채 멈춰 있는 순간';
  const passD = await gate(
    {
      ...GOOD_CONTACT,
      nextMove: '말이 엇갈렸을 때 잠깐 시간을 둘지, 언제 다시 이야기할지도 같이 맞춰봐',
      observeSignal: '시간을 두기로 한 뒤 실제로 대화가 다시 이어지는지 봐',
      decisionSignals: [
        { ifObserved: '시간을 둔 뒤 대화가 다시 이어져', interpretation: hedge('잠깐 멈추는 것보다 언제 다시 이어질지 모르는 상태가 더 걸렸다') },
      ],
    },
    { allowance: allowanceD, narrowedCondition: narrowedD },
  );
  check('ALIGN-01 · 재개 시점을 맞추고 대화가 다시 이어지는지 보는 plan은 통과한다', passD.kept && passD.alignment?.reason === 'NARROWED_CONDITION_REFLECTED', passD);

  /* 실측 R3 D 1회차 plan — 조건을 버리고 '알려주면 편한지'로 넓어진 문장 */
  const genericD = await gate(
    {
      ...GOOD_CONTACT,
      nextMove: '연락이 늦어지는 날엔 어느 정도 알려주면 서로 편한지 한 번 가볍게 맞춰봐',
      observeSignal: '답이 빠른지보다, 흐름이 달라지는 날에 미리 말해주는 방식이 실제로 이어지는지 봐',
      decisionSignals: [
        { ifObserved: '흐름이 달라지는 날에도 짧게라도 먼저 알려줘', interpretation: hedge('연락 횟수보다 멈춘 이유를 알 수 있는지가 더 중요한 조건이었다') },
      ],
    },
    { allowance: allowanceD, narrowedCondition: narrowedD },
  );
  check('ALIGN-01 · 조건 없이 넓어진 Next Move(실측 R3 D)는 버린다', !genericD.kept && genericD.violations.some((label) => label.startsWith('action_alignment_')), genericD.violations);

  const frequencyD = await gate(
    { ...GOOD_CONTACT, nextMove: '연락을 얼마나 자주 할지 빈도를 맞춰봐', observeSignal: '연락이 얼마나 자주 오는지 봐' },
    { allowance: allowanceD, narrowedCondition: narrowedD },
  );
  check('ALIGN-01 · 빈도 맞추기는 AXIS_ONLY로 버린다', !frequencyD.kept && frequencyD.violations.includes('action_alignment_axis_only'), frequencyD.violations);

  /* ALIGN-02 — 약속 있는 순간 + 흐름 끊김 + 이유 모름 (R3 C 성격) */
  const passC = await gate(
    {
      ...GOOD_CONTACT,
      nextMove: '약속이 있는 날 답이 늦어질 땐 한마디 먼저 알려주는 방식을 맞춰봐',
      observeSignal: '약속 있는 날에도 그 한마디가 실제로 오가는지 봐',
      decisionSignals: [
        { ifObserved: '약속 있는 날에도 한마디가 오가', interpretation: hedge('기다리는 순간에 흐름을 알 수 있는지가 더 중요했다') },
      ],
    },
    {
      allowance: allowanceFor('cand-1', { sceneTexts: ['만나기로 한 날 직전에 연락이 끊겼을 때는 유독 불편했어'] }),
      narrowedCondition: '연락량 자체보다, 만나기로 한 흐름이 있는데 이유 없이 끊기는 순간',
    },
  );
  check('ALIGN-02 · 약속 있는 날의 한마디 방식을 맞추는 plan은 통과한다', passC.kept && passC.alignment?.reason === 'NARROWED_CONDITION_REFLECTED', passC);

  /* ALIGN-03 — 평소와 다른 변화 + 이유 모름 (R2 성격) */
  const narrowedB = '연락 횟수 자체보다, 평소와 달라졌는데 이유를 모르는 순간';
  const passB = await gate(
    { ...GOOD_CONTACT, nextMove: '연락량 말고, 평소와 달라지는 날엔 이유를 짧게 알려주는 방식을 맞춰봐' },
    { narrowedCondition: narrowedB },
  );
  check('ALIGN-03 · 변화가 생길 때 알려주는 방식을 맞추는 plan은 통과한다', passB.kept, passB.violations);
  const failB = await gate(
    { ...GOOD_CONTACT, nextMove: '연락을 더 자주 해달라고 맞춰봐', observeSignal: '연락이 얼마나 자주 오는지 봐' },
    { narrowedCondition: narrowedB },
  );
  check('ALIGN-03 · 연락량 늘리기는 버린다', !failB.kept && failB.violations.includes('action_alignment_axis_only'), failB.violations);

  const offSignal = await gate(
    { ...GOOD_CONTACT, decisionSignals: [{ ifObserved: '연락이 잘 돼', interpretation: '괜찮은 관계일 수 있어' }] },
    { narrowedCondition: narrowedB },
  );
  check('§14 · 조건 밖 Decision Signal은 버린다', !offSignal.kept && offSignal.violations.includes('action_alignment_signal_off_condition'), offSignal.violations);

  /* ALIGN-04 — 기준 조건이 전부 없으면 기존 axis/verdict fallback 허용 */
  const noCondition = await gate(
    {
      ...GOOD_CONTACT,
      nextMove: '답이 늦어도 괜찮은 정도를 한 번 맞춰봐',
      observeSignal: '정한 뒤에 실제로 불편이 줄어드는지 봐',
      decisionSignals: [{ ifObserved: '불편이 줄어', interpretation: hedge('정해두는 것 자체가 도움이 되는 편이었다') }],
      usedEventIds: [],
    },
    { allowance: allowanceFor('cand-1', { eventIds: [], sceneTexts: [], unresolvedPoints: [] }) },
  );
  check('ALIGN-04 · narrowedCondition·장면·미확인 조건이 없으면 기존 plan을 허용한다', noCondition.kept && noCondition.alignment?.reason === 'NO_CONDITION', noCondition);

  /* ALIGN-05 — ended: 같은 조건을 다음 관계의 확인 기준으로 */
  const endedAllowanceD = allowanceFor('cand-1', { sceneTexts: scenesD, canAskPartner: false });
  const endedPass = await gate(
    {
      ...GOOD_CONTACT,
      nextMove: '다음엔 말이 엇갈린 뒤 대화가 멈추면, 언제 다시 이야기할지 모르는 게 더 힘든지 먼저 알아차려봐',
      observeSignal: '비슷한 상황이 오면 대화가 다시 이어질 때까지 내가 어느 순간부터 불편해지는지 봐',
      decisionSignals: [
        { ifObserved: '다시 이어질 때를 알면 덜 불편해', interpretation: hedge('멈춤 자체보다 재개 시점을 모르는 상태가 네 기준에 더 가까웠다') },
      ],
    },
    { allowance: endedAllowanceD, tense: 'former', narrowedCondition: narrowedD },
  );
  check('ALIGN-05 · ended에서 같은 조건을 다음 관계 기준으로 옮긴 plan은 통과한다', endedPass.kept, endedPass.violations);
  const endedOutward = await gate(
    { ...GOOD_CONTACT, nextMove: '그 사람에게 다시 연락해서 언제 이야기할지 물어봐', observeSignal: '대화가 다시 이어지는지 봐' },
    { allowance: endedAllowanceD, tense: 'former', narrowedCondition: narrowedD },
  );
  check('ALIGN-05 · 조건이 맞아도 ended 재접촉 행동은 버린다', !endedOutward.kept, endedOutward.violations);

  /* §12 — 하드코딩 금지 · 핸들러가 실제 카드 조건을 기준으로 쓴다 */
  const alignmentSrc = stripComments(await readFile(join(ROOT, 'src/lib/logic/actionAlignment.ts'), 'utf8'));
  check('§12 · 정렬 검사에 시나리오 · candidateId · fixture 문장 분기가 없다', !/R3|R2|cand_|SEM_|말이\s*엇갈린|scenario/.test(alignmentSrc));
  const handlersSrc = stripComments(await readFile(join(ROOT, 'src/services/ai/handlers.ts'), 'utf8'));
  check(
    '§5 · 핸들러가 같은 응답에서 통과한 카드 semantic의 narrowedCondition을 기준으로 넘긴다',
    /const actionSemantic = semanticGate\.kept\.find\(\(item\) => item\.candidateId === actionAllowance\?\.candidateId\)/.test(handlersSrc) &&
      /narrowedCondition: actionSemantic\?\.narrowedCondition \?\? null/.test(handlersSrc) &&
      /conditionContext: actionSemantic\?\.conditionContext \?\? null/.test(handlersSrc),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CTX-01 ~ 05 — conditionContext grounding · narrowedCondition consistency · Action alignment
   ⚠️ 카드 semantic과 actionPlan을 **같은 응답**에 넣어 핸들러와 같은 경로(통과한 카드의 context가
      Action 기준)로 본다. override를 쓰지 않는다.
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nCTX · trigger / state / uncertainty가 근거에서 나오고 Action까지 살아 있어야 한다');
{
  const OPERATORS = ['CONDITION_NARROWING', 'DECLARED_VS_REACTION', 'CURRENT_VS_PAST', 'CONTEXT_DEPENDENT', 'SELF_VS_TARGET', 'UNRESOLVED_CORE'];
  const hedge = (text) => `${text}라는 가설을 더 볼 수 있어`;

  async function ctxCall({ scenes, evidenceTexts = [], context, narrowed, soWhat, why, plan, tense = 'current' }) {
    const semantic = {
      candidateId: 'cand-1',
      operator: 'DECLARED_VS_REACTION',
      connection: '말한 기준과 지금 관계에서 답한 것을 장면과 나란히 봤다',
      narrowedCondition: narrowed,
      soWhat,
      whyItMatters: why,
      usedEvidenceRefs: [CARD_REF, CUR_REF],
      usedEventIds: ['ev-1'],
      ...(context === undefined ? {} : { conditionContext: context }),
    };
    const result = await contract({
      raw: { ...BASE_RAW, candidateSemantics: [semantic], ...(plan ? { actionPlan: plan } : {}) },
      allowed: ALLOWED_INSIGHT,
      candidates: [
        {
          candidateId: 'cand-1',
          evidenceRefs: [CARD_REF, CUR_REF],
          eventIds: ['ev-1'],
          sceneTexts: scenes,
          evidenceTexts,
          eligibleOperators: OPERATORS,
          knownSelfStatement: null,
          unresolvedPoints: [],
        },
      ],
      actionAllowance: allowanceFor('cand-1', { sceneTexts: scenes, canAskPartner: tense === 'current' }),
      tense,
    });
    return { card: result.semantic.items[0] ?? null, violations: result.semantic.violations, action: result.action };
  }

  /* CTX-01 — 갈등 뒤 대화 중단 + 재개 시점 모름 */
  const scenes1 = ['얘기가 엇갈린 다음에 아무 답이 없던 날이 힘들었어', '대화가 멈춘 게 제일 답답했어'];
  const card1 = {
    scenes: scenes1,
    context: { trigger: '말이 엇갈린 뒤', state: '대화가 멈춤', uncertainty: '언제 다시 이야기할지 모름' },
    narrowed: '말이 엇갈린 뒤 대화가 멈춘 채, 언제 다시 이어질지 모르는 순간',
    soWhat: '연락이 적은지보다, 말이 엇갈린 뒤 대화가 멈춘 채 다음 흐름이 안 보이는 순간을 따로 봐야 할 수 있어.',
    why: '평소엔 기다릴 수 있어도, 이야기가 끊긴 채 다음이 안 보이면 같은 몇 시간도 길게 느껴질 수 있어.',
  };
  const pass1 = await ctxCall({
    ...card1,
    plan: {
      ...GOOD_CONTACT,
      nextMove: '시간을 둘 거면 언제 다시 이야기할지도 같이 맞춰봐',
      observeSignal: '시간을 둔 뒤 실제로 대화가 다시 이어지는지 봐',
      decisionSignals: [{ ifObserved: '정한 때에 대화가 다시 이어져', interpretation: hedge('잠깐 멈추는 것보다 재개 시점을 모르는 상태가 더 걸렸다') }],
    },
  });
  check('CTX-01 · 카드 문장이 통과하고 세 칸이 근거로 확인돼 남는다', pass1.card && pass1.card.conditionContext?.trigger && pass1.card.conditionContext?.state && pass1.card.conditionContext?.uncertainty, pass1);
  check('CTX-01 · narrowedCondition이 context 요약과 어긋나지 않는다', !pass1.violations.includes('context_narrowed_inconsistent'), pass1.violations);
  check('CTX-01 · 재개 시점을 맞추고 다시 이어지는지 보는 plan은 CONDITION_CONTEXT_REFLECTED', pass1.action.kept && pass1.action.alignment?.reason === 'CONDITION_CONTEXT_REFLECTED', pass1.action);

  const lost1 = await ctxCall({
    ...card1,
    plan: {
      ...GOOD_CONTACT,
      nextMove: '연락 흐름이 평소와 달라지는 날엔 짧게라도 미리 알려달라고 맞춰봐',
      observeSignal: '평소와 달라진 날에 한마디가 실제로 오가는지 봐',
      decisionSignals: [{ ifObserved: '달라진 날에도 한마디가 와', interpretation: hedge('흐름을 미리 알 수 있는지가 더 중요했다') }],
    },
  });
  check('CTX-01 · context를 잃고 넓어진 plan(실측 R3 D 유형)은 CONTEXT_LOSS', !lost1.action.kept && lost1.action.violations.includes('action_alignment_context_loss'), lost1.action.violations);
  const freq1 = await ctxCall({ ...card1, plan: { ...GOOD_CONTACT, nextMove: '연락 빈도를 어느 정도로 할지 맞춰봐', observeSignal: '연락이 얼마나 자주 오는지 봐' } });
  check('§22 · 같은 context에서 빈도 맞추기는 AXIS_ONLY', !freq1.action.kept && freq1.action.violations.includes('action_alignment_axis_only'), freq1.action.violations);
  const talk1 = await ctxCall({ ...card1, plan: { ...GOOD_CONTACT, nextMove: '서로 소통하는 방식을 이야기해봐', observeSignal: '이야기한 뒤 달라지는 게 있는지 봐' } });
  check('§22 · 같은 context에서 소통 방식 이야기는 TOO_GENERIC', !talk1.action.kept && talk1.action.violations.includes('action_alignment_too_generic'), talk1.action.violations);

  /* CTX-02 — 약속 순간 + 연락 흐름 중단 + 이유 모름 */
  const pass2 = await ctxCall({
    scenes: ['만나기로 한 날 직전에 연락이 끊겼을 때는 유독 불편했어', '기다리는 동안 아무것도 못 했어'],
    context: { trigger: '만나기로 한 날 직전', state: '연락이 끊김', uncertainty: '왜 끊겼는지 이유를 모름' },
    narrowed: '약속이 있는 날 직전에 연락이 끊기고 이유를 모르는 순간',
    soWhat: '연락이 적은지보다, 약속이 걸린 날 흐름이 끊기는 순간을 평소와 따로 봐야 할 수 있어.',
    why: '평소엔 괜찮아도 시간이 묶인 날엔 짧은 공백도 오래 기다리는 느낌으로 남을 수 있어.',
    plan: {
      ...GOOD_CONTACT,
      nextMove: '약속 있는 날 늦어질 것 같으면 이유를 짧게라도 먼저 알려주는 방식을 맞춰봐',
      observeSignal: '약속 있는 날에 그 한마디가 실제로 오가는지 봐',
      decisionSignals: [{ ifObserved: '약속 있는 날 이유가 먼저 와', interpretation: hedge('약속이 걸린 순간에 이유를 알 수 있는지가 더 중요했다') }],
    },
  });
  check('CTX-02 · 약속 순간 context가 근거로 확인된다', Boolean(pass2.card?.conditionContext?.trigger && pass2.card?.conditionContext?.uncertainty), pass2);
  check('CTX-02 · 약속 순간 · 이유를 다루는 plan은 통과한다', pass2.action.kept && pass2.action.alignment?.reason === 'CONDITION_CONTEXT_REFLECTED', pass2.action);

  /* CTX-03 — 평소와 다른 변화 + 이유 모름 */
  const pass3 = await ctxCall({
    scenes: ['연락이 갑자기 줄었을 때 이유를 몰라서 불안했어', '평소랑 다르게 답이 짧아진 날이 있었어'],
    context: { trigger: '평소와 다른 변화', state: '답이 짧아짐', uncertainty: '이유를 모름' },
    narrowed: '평소와 달라졌는데 이유를 모르는 순간',
    soWhat: '연락이 적은지보다, 평소와 달라진 날에 이유를 모른 채 남는 순간을 따로 봐야 할 수 있어.',
    why: '같은 뜸함이어도 이유를 아는 날과 모르는 날은 기다리는 시간이 다르게 느껴질 수 있어.',
    plan: { ...GOOD_CONTACT, nextMove: '연락량 말고, 평소와 달라지는 날엔 이유를 짧게 알려주는 방식을 맞춰봐' },
  });
  check('CTX-03 · 짧아진 답(개념 밖 표현)도 장면 글자로 근거가 확인된다', pass3.card?.conditionContext?.state === '답이 짧아짐', pass3);
  check('CTX-03 · 변화 · 이유를 다루는 plan은 통과한다', pass3.action.kept, pass3.action.violations);

  /* CTX-04 — 바쁜 시기 + 개인 시간 미확보 */
  const pass4 = await ctxCall({
    scenes: ['일이 몰린 주에 혼자 쉬는 시간을 전혀 못 챙겼어', '주말에 만나서도 계속 피곤하고 예민했어'],
    context: { trigger: '일이 몰린 바쁜 주', state: '혼자 쉬는 시간이 사라짐', uncertainty: '어느 정도 혼자 시간을 챙겨야 편한지 모름' },
    narrowed: '바쁜 주에 혼자 쉬는 시간이 사라지고 어느 정도가 필요한지 모르는 순간',
    soWhat: '혼자 시간이 필요한지보다, 바쁜 주에 그 시간이 먼저 밀려나는 순간을 따로 봐야 할 수 있어.',
    why: '평소엔 괜찮아도 일이 몰린 주엔 쉬는 틈이 없어서 만나는 날까지 여유가 줄어들 수 있어.',
    plan: {
      ...GOOD_CONTACT,
      nextMove: '바쁜 주에는 언제 혼자 쉴지 미리 정해봐',
      /* ⚠️ 장면 문장('…혼자 쉬는 시간을 …')을 되풀이하면 기존 복창 스캐너가 버린다 — 게이트를 완화하지 않고 문장을 바꾼다 */
      observeSignal: '정한 뒤 바쁜 주에도 그 휴식이 실제로 지켜지는지 봐',
      decisionSignals: [{ ifObserved: '바쁜 주에도 정해둔 휴식이 지켜져', interpretation: hedge('휴식의 양보다 미리 정해두는지가 더 중요했다') }],
    },
  });
  check('CTX-04 · 바쁜 시기 · 개인 시간 context가 근거로 확인된다', Boolean(pass4.card?.conditionContext?.trigger && pass4.card?.conditionContext?.state), pass4);
  check('CTX-04 · 바쁜 주의 혼자 시간을 정하는 plan은 통과한다', pass4.action.kept && pass4.action.alignment?.reason === 'CONDITION_CONTEXT_REFLECTED', pass4.action);

  /* CTX-05 — 근거 부족 · 위험 · 형식 오류 → partial/null · 카드 문장은 유지 */
  const unsafe5 = await ctxCall({ ...card1, context: { trigger: '말이 엇갈린 뒤', state: '상대가 일부러 피함', uncertainty: '마음이 식었는지 모름' } });
  check('CTX-05 · 상대 의도·감정이 든 context는 전체를 버리고, 카드 문장은 남는다', pass1.card && unsafe5.card && !unsafe5.card.conditionContext && unsafe5.violations.includes('context_unsafe'), unsafe5);
  const invented5 = await ctxCall({ ...card1, context: { trigger: '여행 중 공항에서', state: '대화가 멈춤', uncertainty: '이유' } });
  check(
    'CTX-05 · 근거 없는 trigger와 모름이 아닌 uncertainty는 그 칸만 지운다(partial)',
    invented5.card?.conditionContext?.trigger === null &&
      invented5.card?.conditionContext?.state === '대화가 멈춤' &&
      invented5.card?.conditionContext?.uncertainty === null &&
      invented5.violations.includes('context_ungrounded_trigger') &&
      invented5.violations.includes('context_uncertainty_not_unknown'),
    invented5,
  );
  const none5 = await ctxCall({ ...card1, context: undefined });
  check('CTX-05 · context가 없으면 null이고 카드 문장은 그대로다', none5.card && none5.card.conditionContext === null, none5);
  const inconsistent5 = await ctxCall({ ...card1, narrowed: '바쁜 주에 혼자 쉬는 시간이 밀리는 순간' });
  check('§24 · narrowedCondition이 context와 다른 조건이면 기록한다', inconsistent5.violations.includes('context_narrowed_inconsistent'), inconsistent5.violations);

  const partialFallback = await ctxCall({
    ...card1,
    context: { trigger: '여행 중 공항에서', state: '대화가 멈춤', uncertainty: '이유' },
    plan: {
      ...GOOD_CONTACT,
      nextMove: '시간을 둘 거면 언제 다시 이야기할지도 같이 맞춰봐',
      observeSignal: '시간을 둔 뒤 실제로 대화가 다시 이어지는지 봐',
      decisionSignals: [{ ifObserved: '대화가 다시 이어져', interpretation: hedge('재개 시점을 아는 게 더 중요했다') }],
    },
  });
  check('§23 · 칸이 1개만 남으면 context 규칙 대신 기존 narrowedCondition 규칙으로 판정한다', partialFallback.action.kept && partialFallback.action.alignment?.reason === 'NARROWED_CONDITION_REFLECTED', partialFallback.action);

  const ctxSrc = stripComments(await readFile(join(ROOT, 'src/services/ai/conditionContextGate.ts'), 'utf8'));
  check('§12 · context 검증에 시나리오 · fixture 문장 분기가 없다', !/R3|R2|cand_|SEM_|엇갈린|scenario/.test(ctxSrc));
}

console.log('\nACT-RENDER · AI plan은 선택된 카드에만 · VERIFY는 카드 것을 먼저 쓴다 · 카드 문장 불변');
{
  const base = await run(SEM_B);
  const targetId = base.actionTargetId;
  const plan = { ...GOOD_CONTACT, sourceCandidateId: targetId, verificationQuestion: '연락이 뜸해질 때 한마디 알려주는 게 너한테도 괜찮아?', usedEvidenceRefs: [], usedEventIds: [] };
  const withPlan = await run({ ...SEM_B, actionPlan: plan });
  const rendered = withPlan.report.actionPlan;
  check('ACT-RENDER · 선택된 카드의 AI plan은 mode=plan · source=semantic_ai', rendered?.mode === 'plan' && rendered.source === 'semantic_ai', rendered);
  check(
    'ACT-RENDER · §8 카드에 쓸 수 있는 VERIFY가 있으면 그것을 재사용한다',
    rendered?.verificationQuestion === base.report.actionPlan?.verificationQuestion,
    { base: base.report.actionPlan?.verificationQuestion, rendered: rendered?.verificationQuestion },
  );
  check(
    '§31 · 카드 VERIFY를 재사용하면 verificationFrom=card · sourceRank가 선택 카드 순위다',
    rendered?.verificationFrom === 'card' &&
      rendered.sourceRank === base.semanticTopCandidateIds.indexOf(targetId) + 1,
    { from: rendered?.verificationFrom, rank: rendered?.sourceRank },
  );
  const sectionSrc = stripComments(await readFile(join(ROOT, 'src/components/premium/PremiumActionPlanSection.tsx'), 'utf8'));
  check(
    '§31 · 화면은 카드에서 온 질문 원문을 다시 그리지 않는다',
    /verificationFrom === 'card'[\s\S]{0,400}카드의 질문으로 시작하면 돼/.test(sectionSrc),
  );
  check(
    'ACT-RENDER · Action plan은 Top 3 순서 · 카드 문장을 바꾸지 않는다',
    JSON.stringify(withPlan.report.candidates.map((card) => [card.id, card.soWhat, card.whyItMatters])) ===
      JSON.stringify(base.report.candidates.map((card) => [card.id, card.soWhat, card.whyItMatters])),
  );
  const otherId = base.semanticTopCandidateIds.find((id) => id !== targetId);
  const misplaced = await run({ ...SEM_B, actionPlan: { ...plan, sourceCandidateId: otherId } });
  check('ACT-RENDER · 다른 카드에 대해 쓴 plan은 화면에 붙지 않는다', misplaced.report.actionPlan?.source === 'deterministic', misplaced.report.actionPlan);

  const endedPlan = await run({
    ...ENDED,
    actionPlan: { ...plan, sourceCandidateId: ended.actionTargetId, verificationQuestion: null },
  });
  check('ACT-05 · ended 화면 블록 lifecycle=former', endedPlan.report.actionPlan?.lifecycle === 'former', endedPlan.report.actionPlan?.lifecycle);
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACT-FREE · ACT-UI · ACT-CALLS — 정적
   ═══════════════════════════════════════════════════════════════════════════ */
console.log('\nACT-FREE · ACT-UI · ACT-CALLS');
{
  const r = await run(SEM_B);
  check('ACT-FREE · 무료 Candidate에는 Action 필드가 없다', r.free.candidates.every((card) => !('actionPlan' in card) && !('nextMove' in card)));

  const view = stripComments(await readFile(join(ROOT, 'src/components/premium/RelationshipDeepReportView.tsx'), 'utf8'));
  const cardSection = stripComments(await readFile(join(ROOT, 'src/components/premium/PremiumCandidateSection.tsx'), 'utf8'));
  check('§19 · Action 블록은 리포트에 한 번만 그린다', (view.match(/<PremiumActionPlanSection/g) ?? []).length === 1);
  check('§19 · Top 3 카드 컴포넌트는 Action을 모른다(카드마다 붙지 않는다)', !/actionPlan|nextMove|decisionSignals/.test(cardSection));
  const firstScreen = stripComments(await readFile(join(ROOT, 'src/components/premium/FreeInsightSection.tsx'), 'utf8').catch(() => ''));
  check('§20 · 무료 Insight 화면이 Action Layer를 쓰지 않는다', !/PremiumActionPlanSection|actionPlan/.test(firstScreen));

  const aiService = stripComments(await readFile(join(ROOT, 'src/services/aiService.ts'), 'utf8'));
  check('§27 · Deep Report 요청은 여전히 1곳이다', (aiService.match(/requestNarrative<DeepNarrativeBundle>\(/g) ?? []).length === 1);
  check('§27 · actionAllowance는 같은 요청 본문에 실린다', /candidates: deepReportAllowancesOf\(context\),\s*actionAllowance: deepReportActionAllowanceOf\(context, action\.canAskPartner\)/.test(aiService));
  const aiRoutes = await readdir(join(ROOT, 'src/app/api/ai'));
  check('§27 · Action 전용 AI 라우트가 없다', !aiRoutes.some((name) => /action/i.test(name)), aiRoutes);
  const handlers = stripComments(await readFile(join(ROOT, 'src/services/ai/handlers.ts'), 'utf8'));
  check('§14 · actionPlan은 Deep Report 응답(raw)에서 파싱된다', /parseActionPlan\(raw, actionAllowance\)/.test(handlers));
  const gateSrc = stripComments(await readFile(join(ROOT, 'src/services/ai/actionPlanGate.ts'), 'utf8'));
  check('§21 · Action 게이트가 기존 안전 스캐너를 그대로 먼저 돈다', /scanDeepNarrativeWithTense\(joined, tense\)/.test(gateSrc) && /scanVisibleMetaLanguage\(joined\)/.test(gateSrc));
}

report('Premium Action Layer Fixture');
