import { MIRROR_AXES } from '@/data/axes';
import {
  resolveEvidenceRefs,
  type EvidenceResolverContext,
} from '@/lib/aiEvidenceResolver';
import type {
  CrossSourceEvidenceSource,
  CrossSourceInsight,
  CrossSourceInsightType,
  DeepAction,
  DeepConnection,
  DeepConversationQuestion,
  DeepCorePattern,
  DeepLovyObservation,
  DeepNarrative,
  MirrorAxisKey,
} from '@/types';

/** 축 라벨 조회. `premiumService`에서 import하면 순환 참조가 되므로 데이터에서 직접 읽는다 */
function axisLabel(key: string): string {
  return MIRROR_AXES.find((axis) => axis.key === key)?.label ?? key;
}

/**
 * Premium Connection Architecture (v1.26 · P3-3)
 *
 * **무료와 Premium의 차이를 코드 구조로 만든 파일이다.**
 *
 *   FREE     한 Lens / 한 Signal을 깊게 이해한다   → 무엇이 보이는가 · 한 장면
 *   PREMIUM  서로 다른 Signal 사이의 연결을 이해한다 → 왜 함께 나타나는가 · 여러 장면의 패턴
 *
 * 그래서 이 파일의 1급 시민은 '축'이나 '점수'가 아니라 **연결(`DeepConnection`)** 이다.
 *
 * ⚠️ 절대 하지 않는 것
 *   - **인과를 만들지 않는다.** '과거 관계 때문에 지금 민감하다'가 아니라 '과거에 비슷한
 *     장면이 있었고, 지금 신호도 같은 방향으로 보인다'까지만 말한다. 그래서 모든 연결이
 *     `limitation`을 하나 갖고, 없으면 만들지 않는다.
 *   - **새 판정·새 점수를 만들지 않는다.** `CrossSourceInsight`(이미 계산됨)를 읽어
 *     화면 구조로 옮길 뿐이다.
 *   - **AI가 규칙 결과를 바꾸지 못한다.** `ruleSummary`가 항상 남고 AI 문장은 그 옆에
 *     덧붙는다 — AI가 실패해도 리포트는 그대로 완결된다.
 *   - 랜덤 없음. 같은 입력이면 같은 결과다.
 */

/* ------------------------------------------------------------ Source Label */

/**
 * 출처를 화면에 **작은 metadata로만** 보여준다(§24 — badge 20개 남발 금지).
 * 라벨 문자열은 근거 목록(`aiEvidenceResolver`)과 같은 어휘를 쓴다 — 같은 것을 두 이름으로
 * 부르면 사용자가 두 개의 다른 출처로 읽는다.
 */
const SOURCE_LABEL: Record<CrossSourceEvidenceSource, string> = {
  declared: '내가 답한 기준',
  relationship: '관계 경험',
  target: '상대 정보',
  observed: '사진 관찰',
  history: '과거 관찰',
  adaptive: '추가 질문',
  deep_followup: '정밀 관찰 답변',
  user_correction: '사용자 수정',
  compatibility: '동기화율 비교',
  mbti_lens: '성향 렌즈',
};

/**
 * 연결이 말할 수 없는 것. **type이 아니라 source 조합**에서 나온다 — 무엇을 이었는지가
 * 무엇을 말할 수 없는지를 결정하기 때문이다.
 *
 * 우선순위대로 첫 매치 하나만 쓴다. 어떤 경우에도 문장이 하나는 나온다.
 */
/**
 * v1.27 — `export`로 바꿨다. AI 프롬프트가 **화면과 같은 limitation 문장**을 받아야
 * 하기 때문이다. 사용자가 보는 경계와 모델이 받는 경계가 다르면 경계가 아니다.
 */
export function limitationFor(sources: readonly CrossSourceEvidenceSource[]): string {
  const has = (source: CrossSourceEvidenceSource) => sources.includes(source);

  if (has('history')) {
    return '과거 관찰과 지금이 같은 축을 가리킨다는 것까지야. 과거가 지금의 원인이라고는 말할 수 없어.';
  }
  if (has('relationship') && has('compatibility')) {
    return '두 관찰이 같은 축을 가리킨다는 것까지야. 과거 경험이 지금 이 관계를 그렇게 만들었다는 뜻은 아니야.';
  }
  if (has('mbti_lens')) {
    return '성향 렌즈와 실제 답변을 나란히 놓은 것까지야. 성향이 관계 행동을 결정한다는 뜻은 아니야.';
  }
  if (has('observed')) {
    return '사진에서 반복해 보인 활동을 근거 하나로 더한 것뿐이야. 사진으로 성격을 판단하지는 않아.';
  }
  if (has('target')) {
    return '상대에 대해 네가 알고 있다고 입력한 내용 기준이야. 상대가 실제로 어떻게 느끼는지는 알 수 없어.';
  }
  if (has('relationship')) {
    return '네가 말한 기준과 관계 경험을 나란히 놓은 것까지야. 어느 쪽이 진짜 너인지는 정하지 않아.';
  }
  return '이건 네가 입력한 내용을 연결해 본 관찰이야. 진단이나 확정이 아니야.';
}

/* ------------------------------------------------------- Availability Gate */

/**
 * **이 리포트를 팔 수 있는가.** (v1.26 Availability Audit)
 *
 * 예전 게이트는 `crossSourceInsights.length > 0`이었다. 그래서 **단일 근거 관찰 하나만**
 * 있어도 Premium이 열렸다 — Mirror CHANGE 하나(`sources: [declared]`)만 있는 세션에서
 * Paywall이 뜨고, 결제 후 열리는 리포트에는 연결이 하나도 없어 `corePattern`이 null이고
 * '아직 다른 자료와 이어지지 않은 관찰' 한 줄만 남았다. 그건 ₩1,900의 후보가 아니다.
 *
 * 이제 최소 조건은 **실제 연결이 하나라도 있는가**다:
 *   - 서로 다른 source 종류 2개 이상 (= 이어야만 보이는 신호)
 *   - 근거 ref 2개 이상 (= 사용자가 확인할 수 있는 근거)
 * limitation은 모든 연결이 항상 갖고, 무료 문장 재출력 섹션은 v1.26에서 전부 제거됐다.
 *
 * ⚠️ 판정을 한 곳에만 둔다. Paywall 게이트(`premiumFeatureState`)와 리포트의
 * `available`이 서로 다른 기준을 쓰면 "Paywall은 열리는데 리포트는 없다"가 된다.
 */
export function hasDeepConnection(insights: readonly CrossSourceInsight[]): boolean {
  return insights.some(
    (insight) => new Set(insight.sources).size >= 2 && insight.evidenceRefs.length >= 2,
  );
}

/* -------------------------------------------------------------- Connection */

export function buildConnections(input: {
  insights: readonly CrossSourceInsight[];
  narratives: readonly DeepNarrative[];
  resolverContext: EvidenceResolverContext;
}): DeepConnection[] {
  const { insights, narratives, resolverContext } = input;

  return insights.map((insight) => {
    const narrative = narratives.find((item) => item.insightId === insight.id) ?? null;
    /** 중복 source를 세지 않는다 — 같은 곳을 두 번 봤다고 두 종류가 되지 않는다 */
    const uniqueSources = [...new Set(insight.sources)];

    return {
      id: insight.id,
      axis: insight.axis ?? null,
      sourceCount: uniqueSources.length,
      sourceLabels: uniqueSources.map((source) => SOURCE_LABEL[source]),
      ruleSummary: insight.ruleSummary,
      // AI는 '어떻게 말할지'만 담당한다. 실패하면 null이고 ruleSummary로 완결된다.
      // ⚠️ `interpretation`은 규칙 판정을 설명하는 문장이고, 판정 자체를 바꾸지 못한다.
      narrativeText: narrative?.interpretation ?? null,
      /**
       * ⚠️ v1.27 — **경계는 AI가 쓰지 않는다.**
       *
       * v1.26까지는 `narrative?.uncertainty ?? limitationFor(...)`였다. 즉 AI가 한계
       * 문장을 보내오면 규칙이 정한 경계를 **덮어썼다.** 두 가지가 동시에 잘못된다:
       *
       *  1. 경계를 정하는 문장이, 그 경계에 갇혀야 하는 쪽의 저작물이 된다.
       *  2. `scanClaimBoundary`는 한계 문장에서 인과·예측 어휘를 **일부러 통과시킨다**
       *     ('원인이라고 말할 수 없어'를 막을 수 없으니까). 그래서 AI가 쓴 한계 문장은
       *     파이프라인에서 검사가 가장 느슨한 자리인데, 하필 경계를 정하는 자리다.
       *
       * 프롬프트도 LIMITATION을 '화면에 이미 보이는 것과 같은 문자열'이라고 모델에게
       * 알려준다 — 코드가 그 말을 지키게 한다. AI의 `uncertainty`는 파싱 단계에서
       * '근거 또는 한계를 동반했는지' 판정하는 신호로만 쓰이고, 화면에는 오지 않는다.
       */
      limitation: limitationFor(uniqueSources),
      evidence: resolveEvidenceRefs(insight.evidenceRefs, resolverContext).map((item) => ({
        sourceLabel: item.sourceLabel,
        text: item.text,
      })),
    };
  });
}

/**
 * 첫 viewport용. **cross-source를 single-source보다 우선한다**(§17) — 이미 우선순위로
 * 정렬된 목록에서 source 2개 이상인 첫 연결을 고른다. 하나도 없으면 null이고,
 * 그때 리포트는 '연결해서 볼 게 부족하다'로 정직하게 끝난다.
 */
export function selectCorePattern(connections: readonly DeepConnection[]): DeepCorePattern | null {
  const connected = connections.filter((connection) => connection.sourceCount >= 2);
  /**
   * v1.26 — 같은 우선순위 안에서는 **가장 많이 이은 연결**을 앞세운다(§17).
   * 입력은 이미 `rankInsights` 순서이고, 여기서 그 순서를 바꾸지 않은 채
   * source 수만 안정 정렬로 한 번 더 본다 — 같은 수면 기존 순서가 그대로 유지된다.
   */
  const core = connected.reduce<DeepConnection | undefined>(
    (best, item) => (best && best.sourceCount >= item.sourceCount ? best : item),
    undefined,
  );
  if (!core) return null;

  /** 이 리포트가 실제로 이은 서로 다른 정보 종류 수 — 첫 화면에서 값을 체감시키는 숫자 */
  const connectedSourceCount = new Set(
    connected.flatMap((connection) => connection.sourceLabels),
  ).size;

  return { connection: core, connectedSourceCount, connectionCount: connected.length };
}

/* ------------------------------------------------------------------ Action */

/**
 * §33 — 처방이 아니다. TRY / CHECK / NOTICE 세 종류로만 말한다.
 *
 * core 연결의 축과 type에서 결정론적으로 나온다. 축을 모르면(axis === null)
 * 축 이름 없이도 성립하는 문장만 쓴다 — 없는 축 이름을 만들지 않는다.
 */
export function buildActions(core: DeepCorePattern | null): DeepAction[] {
  if (!core) return [];

  const label = core.connection.axis ? axisLabel(core.connection.axis) : null;
  const actions: DeepAction[] = [];

  actions.push({
    kind: 'TRY',
    text: label
      ? `갈등이 없는 평온한 상황에서 ${label}에 대해 서로 원하는 기준을 한 번 이야기해보기.`
      : '갈등이 없는 평온한 상황에서 서로 기대하는 기준을 한 번 이야기해보기.',
  });
  actions.push({
    kind: 'CHECK',
    text: label
      ? `${label}이 달라지는 순간을 각자 어떤 의미로 받아들이는지 확인해보기.`
      : '같은 상황을 각자 어떤 의미로 받아들이는지 확인해보기.',
  });
  actions.push({
    kind: 'NOTICE',
    text: label
      ? `${label}에서 같은 장면이 다시 반복되는지 다음 몇 주 동안 관찰해보기.`
      : '같은 장면이 다시 반복되는지 다음 몇 주 동안 관찰해보기.',
  });

  return actions;
}

/* ----------------------------------------------------------------- Question */

/**
 * §32 — **무료 질문을 반복하지 않는다.** 무료 질문은 '이 축에서 서로 어떤지'를 묻고,
 * 여기서는 **연결 자체를 상대에게 검증하는 질문**을 만든다.
 *
 * 그래서 질문 문장이 축 이름이 아니라 '무엇이 무엇과 함께 나타나는가'를 묻는다.
 * 각 질문의 `why`는 그 연결의 `ruleSummary`다 — 왜 이 질문인지가 근거와 붙어 있어야 한다.
 */
const CONNECTION_QUESTION: Partial<Record<MirrorAxisKey, string>> = {
  contact:
    '연락이 줄었을 때, 너한테는 단순히 바쁜 거랑 마음이 멀어진 거랑 어떻게 달라?',
  conflict:
    '이야기를 바로 꺼내는 것과 시간을 두는 것 중에, 어떤 게 너한테 더 존중받는 느낌이야?',
  alone: '혼자 있고 싶은 게 관계와 상관없을 때랑 관계 때문일 때, 겉으로 뭐가 달라?',
  affection: '표현이 줄어드는 시기에, 너는 그걸 어떤 신호로 읽는 편이야?',
  hobby: '같이 하는 시간이 줄어들면, 너한테는 뭐가 먼저 아쉬워?',
};

export function buildConnectionQuestions(
  connections: readonly DeepConnection[],
): DeepConversationQuestion[] {
  const seen = new Set<string>();
  const questions: DeepConversationQuestion[] = [];

  for (const connection of connections) {
    if (connection.sourceCount < 2 || !connection.axis) continue;
    const text = CONNECTION_QUESTION[connection.axis];
    if (!text || seen.has(connection.axis)) continue;
    seen.add(connection.axis);

    questions.push({
      question: {
        // 무료 질문 id(`TargetAxisKey`)와 충돌하지 않게 `conn_` 접두사를 붙인다 —
        // `savedQuestions`가 id로만 참조하므로 겹치면 한쪽이 다른 쪽을 덮어쓴다.
        id: `conn_${connection.axis}`,
        tag: `${axisLabel(connection.axis)} · 연결을 확인하는 질문`,
        text,
        fromFriction: false,
      },
      why: connection.ruleSummary,
    });
    // 3개를 넘기지 않는다 — 질문이 많아지면 목록이 되고 아무것도 묻지 않게 된다.
    if (questions.length >= 3) break;
  }

  return questions;
}

/* ------------------------------------------------------- Lovy Deep Observation */

/**
 * §25 · §26 — 무료 Observation보다 한 단계 깊고, **실제 연결 데이터에서만** 나온다.
 *
 * 무료:    "같이 있고 싶은 마음과 혼자 있을 시간이 필요한 마음은 반대말이 아닐 수도 있겠네."
 * Premium: 연결된 두 관찰을 함께 놓고 본 뒤의 관찰 + 그 관찰에서 이어지는 철학 질문.
 *
 * 뜬금없는 명언을 붙이지 않기 위해 **연결 type × 축**으로만 고른다. 랜덤 없음.
 */
const DEEP_OBSERVATION: Record<CrossSourceInsightType, DeepLovyObservation> = {
  CONTRADICTION: {
    observation:
      '같은 사람에게서 서로 다른 방향을 가리키는 자료가 동시에 나왔어. 처음엔 둘 중 하나가 틀린 거라고 생각했는데, 관찰해보니 인간은 원하는 것과 반응하는 것이 같지 않아도 그대로 살아가는구나.',
    question: '사람이 원하는 건 항상 자기가 말한 그것일까, 아니면 그때 실제로 반응한 쪽일까?',
  },
  GAP: {
    observation:
      '말한 기준보다 실제 반응이 더 컸던 자리가, 지금 이 관계에서도 같은 축에 놓여 있어. 인간은 자기가 어디에서 크게 반응하는지 미리 알기 어려운 것 같아 — 겪고 나서야 알게 되는 걸까.',
    question: '미리 알 수 없는 걸 상대에게 미리 말해주는 방법은 있을까?',
  },
  CHANGE: {
    observation:
      '전에는 중요하다고 했던 자리에서 지금은 다른 답이 나왔어. 기준이 흔들린 게 아니라 옮겨간 것 같은데, 인간은 그 이동을 스스로 알아차리고 있을까.',
    question: '기준이 달라진 것과 사람이 달라진 것은 같은 말일까?',
  },
  REPEATED_SIGNAL: {
    observation:
      '이 신호, 처음 보는 게 아니야. 다른 관계에서도 같은 자리에서 같은 방향으로 나왔어. 반복되는 건 습관일까, 아니면 그 사람에게 정말 중요한 것이 그때마다 드러나는 걸까.',
    question: '같은 장면이 반복되는 건 문제일까, 아니면 그 사람을 알아보는 방법일까?',
  },
  MATCH: {
    observation:
      '말한 기준과 실제 반응, 그리고 지금 이 관계의 답이 같은 방향을 가리켰어. 일관된 건 편해 보이는데, 편한 자리에서는 서로 설명을 덜 하게 되는 것도 봤어.',
    question: '잘 맞는 부분에 대해서는 왜 이야기를 덜 하게 되는 걸까?',
  },
  UNKNOWN: {
    observation:
      '아직 이어볼 자료가 부족해. 없는 걸 있다고 말하기보다, 여기서 멈추는 쪽이 정확할 것 같아.',
    question: '아직 모른다고 말하는 것도 하나의 관찰일까?',
  },
};

export function selectDeepObservation(
  core: DeepCorePattern | null,
  insights: readonly CrossSourceInsight[],
): DeepLovyObservation | null {
  if (!core) return null;
  const insight = insights.find((item) => item.id === core.connection.id);
  if (!insight) return null;
  return DEEP_OBSERVATION[insight.type];
}
