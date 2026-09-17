/**
 * v1.46.4 Action Alignment — **Action은 axis가 아니라 좁혀진 condition을 따라간다**
 *
 * ══ 왜 필요한가 ════════════════════════════════════════════════════════════
 *
 * 카드 semantic이 '흐름이 끊겼는데 이유를 모르는 순간'처럼 조건을 좁혀도, 같은 응답의
 * actionPlan이 '연락이 늦어지는 날엔 어느 정도 알려주면 편한지 맞춰봐'처럼 **주제(연락)만 남기고
 * 조건을 버리는** 경우가 실측에서 나왔다. 안전 게이트는 이걸 막지 못한다 — 위험한 문장이
 * 아니라 **개인화가 희석된** 문장이기 때문이다.
 *
 * ══ 어떻게 비교하는가 — 문자열이 아니라 조건 개념 서명 ═══════════════════════
 *
 * 카드 조건과 행동 문장을 같은 함수(`conditionSignatureOf`)로 **관계 조건 개념 집합**으로 옮기고
 * 집합이 겹치는지 본다. 개념 표는 특정 시나리오가 아니라 관계 답변·장면 전반에 나오는 조건
 * 종류다(변화 · 이유 · 대화 흐름 · 갈등 뒤 · 약속 · 바쁜 시기 · 기다림 · 혼자 시간 · 이야기 시점 · 표현).
 * '빈도'는 주제 수준의 말이라 서명에서 뺀다 — 빈도만 남은 행동이 AXIS_ONLY다.
 *
 * ⚠️ 한국어 paraphrase를 전부 잡지 못한다. 놓치면 **거부 쪽**으로 기운다(plan은 버려지고 화면은
 *    verify_only로 남는다). 일반 조언이 노출되는 쪽보다 안전하다(§13).
 * ⚠️ 시나리오 · candidateId · fixture 문장으로 분기하지 않는다(§12).
 */

export type ConditionConcept =
  | 'CHANGE_FROM_USUAL'
  | 'UNKNOWN_REASON'
  | 'CONVERSATION_FLOW'
  | 'AFTER_CONFLICT'
  | 'SCHEDULED_MOMENT'
  | 'BUSY_PERIOD'
  | 'WAITING'
  | 'TIME_ALONE'
  | 'TIMING_OF_TALK'
  | 'EXPRESSION';

const CONCEPT_PATTERNS: ReadonlyArray<readonly [ConditionConcept, RegExp]> = [
  ['CHANGE_FROM_USUAL', /평소(와|랑|보다|하고)?\s*(다르|달라)|흐름이?\s*(달라|바뀌|변하|변해)|갑자기|달라진|달라지|달라졌|변화/],
  ['UNKNOWN_REASON', /이유|설명|맥락|사정|왜\s*그런지/],
  /* 멈춤과 재개는 같은 개념이다 — '멈춰 있는 순간'을 다루는 행동은 '다시 이어지는 때'를 정한다 */
  /* ⚠️ 명사형(멈춤 · 끊김 · 중단)도 넣는다 — conditionContext 칸은 '대화가 멈춤'처럼 명사형으로 끝난다 */
  ['CONVERSATION_FLOW', /멈추|멈춘|멈춰|멈췄|멈춤|끊기|끊긴|끊겨|끊겼|끊김|끊어지|중단|답이?\s*없|아무\s*답|침묵|공백|다시\s*(이야기|얘기|꺼내|이어|대화|말)|재개|이어지|이어질|이어져/],
  ['AFTER_CONFLICT', /엇갈|말다툼|다툼|다투|갈등|싸우|싸운|싸움|서운|부딪/],
  ['SCHEDULED_MOMENT', /약속|만나기로|일정이?\s*(잡힌|잡혀|있는)|만나는\s*날/],
  ['BUSY_PERIOD', /바쁜|바쁠|바빠|일이?\s*몰|야근|정신없/],
  ['WAITING', /기다리|기다림|기다린|기다려/],
  ['TIME_ALONE', /혼자|개인\s*시간|쉬는\s*시간|쉴\s*틈/],
  ['TIMING_OF_TALK', /바로\s*(말|풀|이야기|얘기)|시간을\s*(두|둘|갖|가지)|좀\s*지나|나중에/],
  ['EXPRESSION', /표현|애정|고마움|칭찬|스킨십/],
];

/** 주제 수준(빈도) — 서명에는 넣지 않고, AXIS_ONLY 판정에만 쓴다 */
const FREQUENCY_ONLY = /횟수|빈도|자주|연락량|얼마나\s*(자주|많이)|연락을?\s*(더\s*)?(늘|많이)/;

export function conditionSignatureOf(text: string | null | undefined): Set<ConditionConcept> {
  const signature = new Set<ConditionConcept>();
  if (!text) return signature;
  for (const [concept, pattern] of CONCEPT_PATTERNS) if (pattern.test(text)) signature.add(concept);
  return signature;
}

function intersects(a: ReadonlySet<ConditionConcept>, b: ReadonlySet<ConditionConcept>): boolean {
  for (const item of a) if (b.has(item)) return true;
  return false;
}

/**
 * v1.46.4 Core Value Final Fix — 카드 VERIFY를 거의 그대로 옮긴 행동인가.
 *
 * 글자 bigram(공백 · 문장부호 제외) 겹침을 **짧은 쪽** 기준으로 잰다. 행동은 '~해봐'로, 질문은
 * '~할까?'로 끝나서 길이가 달라도 같은 문장을 옮기면 짧은 쪽이 거의 다 겹친다.
 */
const VERIFY_COPY_OVERLAP = 0.6;

function bigramsOf(text: string): Set<string> {
  const compact = text.replace(/[^가-힣a-zA-Z0-9]/g, '');
  const grams = new Set<string>();
  for (let index = 0; index < compact.length - 1; index += 1) grams.add(compact.slice(index, index + 2));
  return grams;
}

export function verificationOverlap(move: string, verification: string): number {
  const a = bigramsOf(move);
  const b = bigramsOf(verification);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

export type ActionAlignmentReason =
  | 'UNCERTAINTY_NOT_ADDRESSED'
  | 'VERIFY_COPY'
  | 'CONDITION_CONTEXT_REFLECTED'
  | 'CONTEXT_LOSS'
  | 'NARROWED_CONDITION_REFLECTED'
  | 'UNRESOLVED_REFLECTED'
  | 'EVENT_CONDITION_REFLECTED'
  | 'NO_CONDITION'
  | 'TOO_GENERIC'
  | 'AXIS_ONLY'
  | 'SIGNAL_OFF_CONDITION';

export interface ActionAlignmentResult {
  aligned: boolean;
  reason: ActionAlignmentReason;
  /** QA 기록용 — 원문이 아니라 개념 이름이다 */
  conditionSignature: ConditionConcept[];
  actionSignature: ConditionConcept[];
}

/**
 * §6 · §10 · §14 — 근거 우선순위 `narrowedCondition → unresolvedPoints → 장면`.
 *
 * ```
 * 통과  ① (nextMove ∪ observe) 서명이 기준 조건 서명과 겹친다
 *      ② nextMove 자체가 조건(또는 장면) 개념을 하나 이상 싣는다 — 관찰에만 조건이 있고 행동은
 *         일반 조언이면 '개인화된 Insight → 일반 Action'이 그대로 남는다
 *      ③ decisionSignal 중 하나 이상이 조건을 유지한다
 * 면제  기준 조건 서명이 전부 비었다(ALIGN-04) · 행동이 없는 unresolved plan
 * ```
 */
export function evaluateActionAlignment(input: {
  /**
   * Core Value Closure §15 · §19 — 가장 먼저 보는 기준. 개념이 잡히는 칸이 **2개 이상**이면 칸 단위로
   * 판정한다: Next Move + Observe + Decision Signal 전체가 서로 다른 칸 2개 이상을 반영하고,
   * Next Move 자체도 한 칸 이상을 싣는다. 칸이 모자라면 아래 기존 규칙으로 간다.
   */
  conditionContext?: { trigger: string | null; state: string | null; uncertainty: string | null } | null;
  narrowedCondition: string | null;
  unresolvedPoints: readonly string[];
  eventTexts: readonly string[];
  nextMove: string | null;
  observeSignal: string | null;
  decisionSignals: ReadonlyArray<{ ifObserved: string; interpretation: string }>;
  /**
   * Core Value Final Fix §20 — 같은 카드의 verification(게이트 통과분). VERIFY는 **대화를 여는 질문**이고
   * Next Move는 **실제 확인 행동**이다. uncertainty를 다루지 않는 VERIFY를 거의 그대로 옮긴 행동은 버린다.
   */
  cardVerification?: string | null;
}): ActionAlignmentResult {
  const narrowed = conditionSignatureOf(input.narrowedCondition);
  const unresolved = conditionSignatureOf(input.unresolvedPoints.join(' '));
  const events = conditionSignatureOf(input.eventTexts.join(' '));
  const move = conditionSignatureOf(input.nextMove);
  const observe = conditionSignatureOf(input.observeSignal);
  const action = new Set([...move, ...observe]);

  /**
   * Core Value Final Fix §17 · §21 — **uncertainty가 있으면 Next Move는 그 모름을 줄이는 행동이다.**
   *
   * ```
   * uncertainty 개념이 잡힌다   Next Move가 그 개념을 하나 이상 싣지 않으면 UNCERTAINTY_NOT_ADDRESSED
   * + VERIFY와 거의 같다        그 VERIFY가 uncertainty를 다루지 않으면 VERIFY_COPY(더 구체적인 이유)
   * uncertainty가 없거나 개념 밖  이 규칙은 적용하지 않는다(기존 규칙만)
   * ```
   *
   * ⚠️ 다른 규칙이 **통과시킨 뒤에** 마지막으로 본다 — 기존 거부 이유(CONTEXT_LOSS · AXIS_ONLY …)는 그대로다.
   */
  const uncertainty = conditionSignatureOf(input.conditionContext?.uncertainty);
  const uncertaintyFailure = (): ActionAlignmentReason | null => {
    if (!input.nextMove || uncertainty.size === 0) return null;
    if (
      input.cardVerification &&
      verificationOverlap(input.nextMove, input.cardVerification) >= VERIFY_COPY_OVERLAP &&
      !intersects(conditionSignatureOf(input.cardVerification), uncertainty)
    ) {
      return 'VERIFY_COPY';
    }
    return intersects(move, uncertainty) ? null : 'UNCERTAINTY_NOT_ADDRESSED';
  };

  const context = input.conditionContext;
  const fieldSignatures = context
    ? [context.trigger, context.state, context.uncertainty]
        .map((field) => conditionSignatureOf(field))
        .filter((signature) => signature.size > 0)
    : [];
  if (input.nextMove && fieldSignatures.length >= 2) {
    const reflected = new Set([
      ...action,
      ...input.decisionSignals.flatMap((signal) => [
        ...conditionSignatureOf(`${signal.ifObserved} ${signal.interpretation}`),
      ]),
    ]);
    const contextConcepts = new Set(fieldSignatures.flatMap((signature) => [...signature]));
    const contextResult = (aligned: boolean, reason: ActionAlignmentReason): ActionAlignmentResult => ({
      aligned,
      reason,
      conditionSignature: [...contextConcepts],
      actionSignature: [...reflected],
    });
    if (!intersects(move, contextConcepts)) {
      if (move.size === 0) {
        return contextResult(false, FREQUENCY_ONLY.test(input.nextMove) ? 'AXIS_ONLY' : 'TOO_GENERIC');
      }
      return contextResult(false, 'CONTEXT_LOSS');
    }
    const matchedFields = fieldSignatures.filter((signature) => intersects(signature, reflected)).length;
    if (matchedFields < 2) return contextResult(false, 'CONTEXT_LOSS');
    const contextUncertainty = uncertaintyFailure();
    if (contextUncertainty) return contextResult(false, contextUncertainty);
    return contextResult(true, 'CONDITION_CONTEXT_REFLECTED');
  }

  const [anchor, anchorReason]: [Set<ConditionConcept>, ActionAlignmentReason] =
    narrowed.size > 0
      ? [narrowed, 'NARROWED_CONDITION_REFLECTED']
      : unresolved.size > 0
        ? [unresolved, 'UNRESOLVED_REFLECTED']
        : [events, 'EVENT_CONDITION_REFLECTED'];

  const result = (aligned: boolean, reason: ActionAlignmentReason): ActionAlignmentResult => ({
    aligned,
    reason,
    conditionSignature: [...anchor],
    actionSignature: [...action],
  });

  if (!input.nextMove) return result(true, 'NO_CONDITION');
  const fallbackUncertainty = uncertaintyFailure();
  if (fallbackUncertainty) return result(false, fallbackUncertainty);
  if (anchor.size === 0) return result(true, 'NO_CONDITION');

  const carriers = new Set([...anchor, ...events]);
  if (!intersects(action, anchor) || !intersects(move, carriers)) {
    const axisOnly = move.size === 0 && FREQUENCY_ONLY.test(input.nextMove);
    return result(false, axisOnly ? 'AXIS_ONLY' : 'TOO_GENERIC');
  }
  if (
    input.decisionSignals.length > 0 &&
    !input.decisionSignals.some((signal) =>
      intersects(conditionSignatureOf(`${signal.ifObserved} ${signal.interpretation}`), carriers),
    )
  ) {
    return result(false, 'SIGNAL_OFF_CONDITION');
  }
  return result(true, anchorReason);
}
