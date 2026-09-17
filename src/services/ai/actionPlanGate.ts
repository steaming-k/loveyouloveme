import { evaluateActionAlignment, type ActionAlignmentResult } from '@/lib/logic/actionAlignment';
import { refsWithinAllowed } from '@/lib/logic/allowedEvidence';
import type { RelationshipTense } from '@/lib/logic/relationshipEvidence';
import { detectVerificationRole, isSendableQuestion } from '@/lib/logic/userFitQuestions';
import type { ActionPlanAllowance, ActionPlanNarrative, ConditionContext } from '@/types';
import { echoesUserScene, scanDeepNarrativeWithTense, scanVisibleMetaLanguage } from './safety';

/**
 * Quality Gate (H) — **Premium Action Layer** (v1.46.4 Action Layer §2 · §9 · §10 · §13 · §21 · §22)
 *
 * ══ 기존 게이트와의 관계 ══════════════════════════════════════════════════
 *
 * 기존 스캐너(`scanDeepNarrativeWithTense` · `scanVisibleMetaLanguage` · `echoesUserScene`)를
 * **그대로** 먼저 돌린다 — 임계값·패턴을 하나도 완화하지 않는다. 그 위에 행동 문장에만 생기는
 * 위험을 **추가로** 막는다: 시험·조종 행동, 결정 대행, 마음 관찰, 단정된 판단, 끝난 관계의
 * 재접촉 유도.
 *
 * ⚠️ `prediction_likelihood`(가능성이 높/커)는 여기서도 그대로 막힌다. Decision Signal은
 * '~라는 가설을 더 볼 수 있어 / ~인지 더 확인해볼 수 있어' 꼴로 쓰게 프롬프트가 안내한다.
 *
 * ⚠️ 위반이 하나라도 있으면 **plan 전체**를 버린다(부분 통과 없음). 버려지면 화면은 결정론
 * `verify_only`로 남는다. 예외는 verificationQuestion 하나 — 형식 문제라 그 칸만 뺀다(카드
 * VERIFY와 같은 규칙).
 *
 * ══ Action Alignment Final Pass — 안전 다음에 **정렬**을 본다 ═════════════════
 *
 * 안전을 통과한 plan도, 같은 응답에서 카드가 좁힌 조건(narrowedCondition)을 버리고 주제 수준의
 * 일반 조언으로 넓어졌으면 버린다(`evaluateActionAlignment`). 이건 완화가 아니라 추가 검사다.
 */

export interface ParsedActionPlan extends ActionPlanNarrative {
  rejectedEventIds: string[];
  /** §11 — 2개를 넘어 잘린 decisionSignal 수 */
  droppedSignals: number;
}

export interface ActionPlanGateResult {
  kept: ActionPlanNarrative | null;
  /** 위반 라벨. 문장 원문이 아니다(§34 Privacy) */
  violations: string[];
  stages: { parsed: number; grounded: number; safetyPassed: number; aligned: number; accepted: number };
  verificationDropped: boolean;
  /** 정렬 판정. 안전에서 먼저 떨어졌거나 plan이 없으면 null */
  alignment: ActionAlignmentResult | null;
}

/** §22 — 일부러 상황을 만들어 반응을 보는 행동. OBSERVE는 자연 발생 상황만 본다 */
const MANIPULATIVE =
  /일부러|답장을?\s*(늦게|미뤄|천천히)|(연락|답장)(을|도)?\s*(끊어|안\s*해|하지\s*말)|거리를\s*(둬|두어|벌려)\s*봐|질투|시험(해|삼아|하듯|해보)|떠\s*보|떠봐|밀당|반응을\s*(보려고|떠)|모른\s*척/;

/** §2-1 — 결정을 대신하는 말. 판단은 사용자가 한다 */
const DECISION_REPLACEMENT =
  /헤어지(자|는\s*게|길|는\s*편)|헤어져|그만\s*만나|계속\s*만나(도|는\s*게)|(안|잘\s*안)\s*맞는\s*(사람|관계|사이)|맞지\s*않는\s*(사람|관계|사이)|이\s*관계는\s*(끝|안\s*돼)|정리하는\s*게\s*(좋|나)|위험\s*신호|빨간\s*불|레드\s*플래그|회피형|불안형|애착\s*유형/;

/** §9 — 관찰할 수 없는 속마음을 보라는 말 */
const INNER_STATE =
  /진심인지|진심이\s*(있|없)|노력하는지|얼마나\s*(좋아|사랑|아끼)|(좋아|사랑)하는지|마음이\s*(있는지|식었는지|변했는지)|관심이\s*(있는지|없는지)|속마음/;

/** §7 — 누구에게나 붙는 추상 행동 */
const ABSTRACT_MOVE =
  /^(서로의?\s*)?(소통|대화)\s*방식을\s*(맞춰|점검)|관계를\s*(점검|돌아봐)|더\s*노력해\s*봐|솔직하게\s*(이야기|대화)해\s*봐\.?$|잘\s*(이야기|대화)해\s*봐\.?$/;

/** §13 — 끝난 관계에서 그 사람에게 다시 향하는 행동 */
const FORMER_OUTWARD =
  /(그|전)\s*(사람|상대|애인)(에게|한테|과|와|이랑|랑)|다시\s*(연락|만나|시작)|재회|연락해\s*봐|물어봐|물어볼\s*수/;

/** canAskPartner=false인 current(상대 없음 등)에서 상대를 향하는 행동 */
const PARTNER_OUTWARD = /상대(에게|한테|와|과|랑)|서로|둘이서?|같이\s*정해|물어봐/;

/** §10 — 판단은 가설이다. 단정 어휘 금지 + 가설 꼴 필수 */
const SIGNAL_CERTAIN = /확실(히|하)|분명(히|하)?|틀림없|결론(은|이야)|정답|반드시|무조건/;
const SIGNAL_HEDGE = /가설|더\s*확인|더\s*가까울|가까울\s*수|볼\s*수\s*있어|수\s*있어|인지|쪽일/;

export function gateActionPlan(
  parsed: ParsedActionPlan | null,
  allowance: ActionPlanAllowance | null,
  tense: RelationshipTense,
  /**
   * Action Alignment — 같은 응답에서 **게이트를 통과한** 선택 카드 semantic의 narrowedCondition.
   * 카드 문장이 버려졌거나 좁힐 수 없었으면 null이고, 그때는 unresolvedPoints → 장면 순으로 본다.
   */
  anchor: {
    narrowedCondition: string | null;
    /** Core Value Closure — 같은 카드 semantic의 conditionContext(게이트가 근거를 확인한 칸만) */
    conditionContext?: ConditionContext | null;
    /** Core Value Final Fix — 같은 카드 semantic의 verification(게이트 통과분). VERIFY 복사 판정용 */
    cardVerification?: string | null;
  } = { narrowedCondition: null },
): ActionPlanGateResult {
  const violations: string[] = [];
  const stages = { parsed: parsed ? 1 : 0, grounded: 0, safetyPassed: 0, aligned: 0, accepted: 0 };
  const reject = (label: string): ActionPlanGateResult => {
    violations.push(label);
    return { kept: null, violations, stages, verificationDropped: false, alignment: null };
  };

  if (!parsed) return { kept: null, violations, stages, verificationDropped: false, alignment: null };
  if (!allowance) return reject('action_no_target');

  /* ── §15 · A1 — 모델이 대상을 고르지 못한다 ─────────────────────────── */
  if (parsed.sourceCandidateId !== allowance.candidateId) return reject('action_candidate_mismatch');
  if (parsed.rejectedEventIds.length > 0) return reject('action_event_outside_allowed');
  if (!refsWithinAllowed(parsed.usedEvidenceRefs, allowance.evidenceRefs)) {
    return reject('action_evidence_ref_outside_allowed');
  }
  if (parsed.droppedSignals > 0) violations.push('action_signal_over_limit');

  /* ── §12 — 형태: 연결된 plan이거나, unresolved 하나거나 ─────────────── */
  const hasMove = Boolean(parsed.nextMove);
  if (hasMove && (!parsed.observeSignal || parsed.decisionSignals.length === 0)) {
    return reject('action_incomplete');
  }
  if (!hasMove && !parsed.unresolved) return reject('action_empty');
  stages.grounded = 1;

  /* ── verificationQuestion — 형식 문제면 그 칸만 뺀다 ─────────────────── */
  let verificationQuestion = parsed.verificationQuestion;
  let verificationDropped = false;
  if (verificationQuestion) {
    const invalid =
      tense === 'former'
        ? !verificationQuestion.trim().endsWith('?') || detectVerificationRole(verificationQuestion) === 'TARGET'
        : !allowance.canAskPartner || !isSendableQuestion(verificationQuestion, allowance.sceneTexts);
    if (invalid) {
      violations.push('action_verify_invalid');
      verificationQuestion = null;
      verificationDropped = true;
    }
  }

  /* ── 안전: 기존 스캐너 그대로 + 행동 전용 검사 ──────────────────────── */
  const signalTexts = parsed.decisionSignals.flatMap((signal) => [signal.ifObserved, signal.interpretation]);
  const parts = [
    parsed.nextMove,
    verificationQuestion,
    parsed.observeSignal,
    ...signalTexts,
    parsed.unresolved,
  ].filter((text): text is string => Boolean(text));
  const joined = parts.join(' ');

  const safety: string[] = [];
  safety.push(...scanDeepNarrativeWithTense(joined, tense).violations);
  safety.push(...scanVisibleMetaLanguage(joined).violations);
  if (parts.some((part) => echoesUserScene(part, allowance.sceneTexts))) safety.push('action_scene_recitation');
  if (MANIPULATIVE.test(joined)) safety.push('action_manipulative');
  if (DECISION_REPLACEMENT.test(joined)) safety.push('action_decision_replacement');
  if (INNER_STATE.test(joined)) safety.push('action_observe_inner_state');
  if (parsed.nextMove && ABSTRACT_MOVE.test(parsed.nextMove.trim())) safety.push('action_next_move_abstract');
  if (tense === 'former' && FORMER_OUTWARD.test(joined)) safety.push('action_former_outward');
  if (tense === 'current' && !allowance.canAskPartner && PARTNER_OUTWARD.test(joined)) {
    safety.push('action_no_partner_outward');
  }
  for (const signal of parsed.decisionSignals) {
    if (SIGNAL_CERTAIN.test(signal.interpretation)) safety.push('action_signal_certain');
    else if (!SIGNAL_HEDGE.test(signal.interpretation)) safety.push('action_signal_unhedged');
  }

  if (safety.length > 0) {
    violations.push(...safety);
    return { kept: null, violations, stages, verificationDropped, alignment: null };
  }
  stages.safetyPassed = 1;

  /* ── Action Alignment — 좁혀진 조건이 행동 · 관찰 · 판단까지 살아 있는가 ── */
  const alignment = evaluateActionAlignment({
    conditionContext: anchor.conditionContext ?? null,
    narrowedCondition: anchor.narrowedCondition,
    unresolvedPoints: allowance.unresolvedPoints,
    eventTexts: allowance.sceneTexts,
    nextMove: parsed.nextMove,
    observeSignal: parsed.observeSignal,
    decisionSignals: parsed.decisionSignals,
    cardVerification: anchor.cardVerification ?? null,
  });
  if (!alignment.aligned) {
    violations.push(`action_alignment_${alignment.reason.toLowerCase()}`);
    return { kept: null, violations, stages, verificationDropped, alignment };
  }
  stages.aligned = 1;
  stages.accepted = 1;

  return {
    kept: {
      sourceCandidateId: parsed.sourceCandidateId,
      nextMove: parsed.nextMove,
      verificationQuestion,
      observeSignal: parsed.observeSignal,
      decisionSignals: parsed.decisionSignals,
      unresolved: parsed.unresolved,
      usedEvidenceRefs: parsed.usedEvidenceRefs,
      usedEventIds: parsed.usedEventIds,
    },
    violations,
    stages,
    verificationDropped,
    alignment,
  };
}
