import { MIRROR_AXES } from '@/data/axes';
import type { RelationshipTense } from '@/lib/logic/relationshipEvidence';
import { detectVerificationRole, isSendableQuestion } from '@/lib/logic/userFitQuestions';
import type {
  ActionPlanNarrative,
  InsightCandidate,
  PremiumActionPlan,
  RelationshipEvent,
  RelationshipEventType,
  TargetProfile,
} from '@/types';

/**
 * v1.46.4 Premium Action Layer — **무엇을 먼저 확인할지는 결정론이 정한다** (§5 · §6 · §15)
 *
 * ══ 왜 AI에게 고르게 하지 않는가 ══════════════════════════════════════════
 *
 * SEMANTIC DECOMPOSITION A0 감사에서 배운 것 그대로다: 모델이 '어디에 쓸지'를 고르면 화면과
 * 어긋난다. Top 3 순위도, Action 대상도 **AI 호출 전에** 확정하고 모델은 문장만 쓴다.
 *
 * ══ 왜 AI 출력에 따라 바뀌지 않는 값만 쓰는가 ═════════════════════════════
 *
 * 같은 함수가 두 번 불린다 — 요청을 만들 때(`contextBuilders.buildActionTarget`)와 리포트를
 * 조립할 때(`premiumService`). 두 번째에는 AI 문장이 카드에 얹혀 `verification`·`questions`가
 * 달라진다. 그 값으로 점수를 매기면 모델에게 보낸 카드와 화면의 Action 카드가 갈린다. 그래서
 * 점수 재료는 판정 · 장면 · 시제 · Job · 상대 입력 · 신뢰도뿐이다.
 *
 * ⚠️ Top 3 rank는 바꾸지 않는다. 여기서 나오는 것은 별도의 `actionPriority`다.
 */

/** 불편이 기록됐다고 볼 수 있는 장면 종류(§5-5). 호감·배려 장면은 '확인할 불편'이 아니다 */
const DISCOMFORT_EVENTS = new Set<RelationshipEventType>(['contact_change', 'conflict', 'distance']);

/** 상대 입력을 가진 축 — 이 축에서 상대 값이 모름이면 '아직 확인되지 않은 정보'가 있다(§5-2) */
const TARGET_AXES = new Set(['contact', 'conflict', 'alone', 'affection']);

export interface ActionPriority {
  candidateId: string;
  rank: number;
  /** 내부 전용 — 화면에 노출하지 않는다(§17) */
  score: number;
  eligible: boolean;
  /** 점수를 만든 이유 라벨. QA · fixture용 */
  signals: string[];
}

export interface ActionPriorityInput {
  tense: RelationshipTense;
  allowsOutwardQuestions: boolean;
  events: readonly RelationshipEvent[];
  target: TargetProfile | null;
}

export function actionPrioritiesOf(
  top: readonly InsightCandidate[],
  input: ActionPriorityInput,
): ActionPriority[] {
  return top.slice(0, 3).map((candidate, index) => {
    const signals: string[] = [];
    let score = 0;

    const eventTypes = candidate.relevantEventIds
      .map((id) => input.events.find((event) => event.id === id)?.type)
      .filter((type): type is RelationshipEventType => Boolean(type));

    /* §5-1 — 실제 차이가 있는가 */
    if (candidate.verdict === 'GAP' || candidate.verdict === 'CHANGE' || candidate.verdict === 'CONTRADICTION') {
      score += 3;
      signals.push('divergent');
    } else if (candidate.verdict === 'MATCH') {
      score += 1;
      signals.push('match');
    }
    /* §5-5 — 불편을 기록한 장면과 이어지는가 */
    if (eventTypes.some((type) => DISCOMFORT_EVENTS.has(type))) {
      score += 2;
      signals.push('discomfort_event');
    } else if (eventTypes.length > 0) {
      score += 1;
      signals.push('event');
    }
    /* §5-2 — 아직 확인되지 않은 정보가 있는가(상대 쪽 값이 모름) */
    const axis = candidate.primaryAxis;
    if (axis && TARGET_AXES.has(axis) && input.target) {
      const level = input.target[axis as 'contact' | 'conflict' | 'alone' | 'affection'];
      if (!level || level === 'x') {
        score += 1;
        signals.push('unresolved_target');
      }
    }
    /* §5-3 · §5-4 — 실제 행동으로 확인 가능한가 · 현재 관계인가 */
    if (input.tense === 'current') {
      score += 1;
      signals.push('current');
      if (input.allowsOutwardQuestions) {
        score += 1;
        signals.push('checkable_with_partner');
      }
    }
    if (candidate.confidenceLevel === 'limited') {
      score -= 2;
      signals.push('limited');
    }

    /*
      §12 · ACT-04 — **억지 행동을 만들 수 없는 카드는 대상이 아니다.** 주제가 없거나, 판정이
      '아직 모름'이거나, 한 갈래 근거뿐인데 장면도 없으면 행동의 재료가 없다.
    */
    const eligible =
      axis !== null &&
      candidate.verdict !== 'UNRESOLVED' &&
      !(candidate.confidenceLevel === 'limited' && eventTypes.length === 0);

    return { candidateId: candidate.id, rank: index + 1, score, eligible, signals };
  });
}

export function selectActionCandidate(
  top: readonly InsightCandidate[],
  input: ActionPriorityInput,
): { candidate: InsightCandidate; priority: ActionPriority } | null {
  const best = actionPrioritiesOf(top, input)
    .filter((priority) => priority.eligible)
    /* 점수가 같으면 Top 3 순위가 이긴다 — rank를 뒤집을 이유가 없다 */
    .sort((a, b) => b.score - a.score || a.rank - b.rank)[0];
  if (!best) return null;
  const candidate = top.find((item) => item.id === best.candidateId);
  return candidate ? { candidate, priority: best } : null;
}

/**
 * 요청 쪽(`aiService` · 훅 · dev 라우트)이 context에 넘기는 **선택 결과.**
 *
 * ⚠️ Job 게이트 boolean은 여기서 소비되고 context로 가지 않는다(v1.42 §41.7 — AI에게 Job을 주지
 * 않는다). context가 받는 것은 이미 고른 카드 id와 사용자 언어 이유 한 줄뿐이다.
 */
export function actionSelectionOf(
  top: readonly InsightCandidate[],
  input: ActionPriorityInput,
): { candidateId: string; priorityReason: string } | null {
  const selected = selectActionCandidate(top, input);
  return selected
    ? { candidateId: selected.candidate.id, priorityReason: priorityReasonOf(selected.priority, input.tense) }
    : null;
}

export function actionTopicOf(candidate: InsightCandidate): string | null {
  const axis = candidate.primaryAxis;
  return axis ? (MIRROR_AXES.find((item) => item.key === axis)?.label ?? null) : null;
}

/**
 * §17 — **왜 이걸 먼저 볼까?** 내부 점수를 말하지 않고, 점수를 만든 가장 큰 이유 하나만 말한다.
 */
export function priorityReasonOf(priority: ActionPriority, tense: RelationshipTense): string {
  const former = tense === 'former';
  if (priority.signals.includes('discomfort_event')) {
    return former
      ? '가장 걸렸던 장면과 바로 이어진 이야기라서, 다음을 위해 먼저 정리해볼 만해.'
      : '불편했다고 적은 장면과 바로 이어진 이야기라서, 먼저 확인해볼 만해.';
  }
  if (priority.signals.includes('divergent')) {
    return former
      ? '말한 기준과 그때 반응이 갈린 자리라서, 먼저 정리해두면 다음에 알아차리기 쉬워.'
      : '말한 기준과 실제 반응이 갈린 자리라서, 확인해보면 가장 많이 달라질 수 있어.';
  }
  return former
    ? '비슷하게 답했던 자리도, 다음에는 한 번 짚어두면 어긋날 때 덜 헷갈려.'
    : '비슷하게 답한 자리는 확인을 건너뛰기 쉬워서, 한 번 짚어두면 어긋날 때 덜 헷갈려.';
}

function unresolvedTextOf(candidate: InsightCandidate, tense: RelationshipTense): string {
  const topic = actionTopicOf(candidate) ?? '이 이야기';
  return tense === 'former'
    ? `남은 정보만으로는 그 관계의 ${topic}에서 무엇이 먼저 걸렸는지 아직 구분하기 어려워.`
    : `지금 정보만으로는 ${topic}에서 무엇이 먼저 걸리는지 아직 구분하기 어려워.`;
}

/**
 * §8 — **기존 VERIFY를 먼저 재사용한다.** 새 질문은 쓸 수 있는 VERIFY가 없을 때만.
 *
 * ⚠️ 판정은 카드 VERIFY 칸과 같은 술어다(`isSendableQuestion` · `detectVerificationRole`).
 */
function existingVerificationOf(
  candidate: InsightCandidate,
  tense: RelationshipTense,
  sceneTexts: readonly string[],
): string | null {
  if (tense === 'former') {
    const text = candidate.verification;
    return text && text.trim().endsWith('?') && detectVerificationRole(text) !== 'TARGET' ? text : null;
  }
  if (candidate.verification && isSendableQuestion(candidate.verification, sceneTexts)) {
    return candidate.verification;
  }
  return candidate.questions[0]?.text ?? null;
}

/**
 * §4 · §12 · §18 — 화면 블록 조립. **AI 문장은 선택된 카드에만** 붙는다.
 *
 * ⚠️ AI가 없거나 거부됐을 때 행동 문장을 결정론으로 지어내지 않는다. 그 문장이 누구에게나
 * 붙는 조언이 되는 순간 Premium의 차별점(§20)이 사라진다 — 대신 확인 질문까지만 준다.
 */
export function buildPremiumActionPlan(input: {
  top: readonly InsightCandidate[];
  semantic: ActionPlanNarrative | null;
  tense: RelationshipTense;
  allowsOutwardQuestions: boolean;
  events: readonly RelationshipEvent[];
  target: TargetProfile | null;
}): PremiumActionPlan | null {
  const { top, tense } = input;
  if (top.length === 0) return null;
  const lifecycle = tense === 'former' ? 'former' : 'current';

  const sceneTextsOf = (candidate: InsightCandidate) =>
    candidate.relevantEventIds.flatMap((id) => {
      const event = input.events.find((item) => item.id === id);
      return event ? [event.description, event.myReaction].filter((text): text is string => Boolean(text)) : [];
    });

  const selected = selectActionCandidate(top, input);

  /* ACT-04 — 대상이 없다: 억지 행동 계획 대신 무엇이 아직 구분되지 않았는지만 */
  if (!selected) {
    const first = top[0]!;
    return {
      sourceCandidateId: first.id,
      title: first.headline,
      topic: actionTopicOf(first),
      mode: 'unresolved',
      source: 'deterministic',
      lifecycle,
      priorityReason: null,
      sourceRank: 1,
      nextMove: null,
      verificationQuestion: existingVerificationOf(first, tense, sceneTextsOf(first)),
      verificationFrom: existingVerificationOf(first, tense, sceneTextsOf(first)) ? 'card' : null,
      observeSignal: null,
      decisionSignals: [],
      unresolved: unresolvedTextOf(first, tense),
      usedEvidenceRefs: [],
      usedEventIds: [],
    };
  }

  const { candidate, priority } = selected;
  const existing = existingVerificationOf(candidate, tense, sceneTextsOf(candidate));
  const base = {
    sourceCandidateId: candidate.id,
    title: candidate.headline,
    topic: actionTopicOf(candidate),
    lifecycle,
    priorityReason: priorityReasonOf(priority, tense),
    sourceRank: priority.rank,
  } as const;

  /* 다른 카드에 대해 쓴 AI 문장은 쓰지 않는다(A1 — 모델이 대상을 고르지 못한다) */
  const semantic = input.semantic && input.semantic.sourceCandidateId === candidate.id ? input.semantic : null;

  if (semantic && semantic.nextMove && semantic.observeSignal && semantic.decisionSignals.length > 0) {
    return {
      ...base,
      mode: 'plan',
      source: 'semantic_ai',
      nextMove: semantic.nextMove,
      verificationQuestion: existing ?? semantic.verificationQuestion,
      verificationFrom: existing ? 'card' : semantic.verificationQuestion ? 'action' : null,
      observeSignal: semantic.observeSignal,
      decisionSignals: semantic.decisionSignals.slice(0, 2),
      unresolved: semantic.unresolved,
      usedEvidenceRefs: semantic.usedEvidenceRefs,
      usedEventIds: semantic.usedEventIds,
    };
  }
  if (semantic && semantic.unresolved) {
    return {
      ...base,
      mode: 'unresolved',
      source: 'semantic_ai',
      nextMove: null,
      verificationQuestion: existing ?? semantic.verificationQuestion,
      verificationFrom: existing ? 'card' : semantic.verificationQuestion ? 'action' : null,
      observeSignal: null,
      decisionSignals: [],
      unresolved: semantic.unresolved,
      usedEvidenceRefs: semantic.usedEvidenceRefs,
      usedEventIds: semantic.usedEventIds,
    };
  }
  return {
    ...base,
    mode: existing ? 'verify_only' : 'unresolved',
    source: 'deterministic',
    nextMove: null,
    verificationQuestion: existing,
    verificationFrom: existing ? 'card' : null,
    observeSignal: null,
    decisionSignals: [],
    unresolved: existing ? null : unresolvedTextOf(candidate, tense),
    usedEvidenceRefs: [],
    usedEventIds: [],
  };
}
