import { RELATIONSHIP_EVENT_LABEL } from '@/data/relationshipEvents';
import type {
  MirrorAxisKey,
  RelationshipEvent,
  RelationshipEventType,
  RelationshipTense,
} from '@/types';

/**
 * Event Relevance Layer — **어떤 장면이 이 이야기와 관련 있는가** (v1.46.4 · §8 · §9 · §10)
 *
 * ══ 왜 이 파일이 필요해졌나 ═══════════════════════════════════════════════
 *
 * v1.46까지 사건은 3개였다. 3개면 고를 필요가 없다 — 전부 보여주고 전부(정확히는
 * 렌즈별 2개씩) 보내면 됐다. v1.46.4가 상한을 없애면서 그 전제가 깨졌다:
 *
 * ```
 * 사건 20개 × 무선별 전송 = Provider input 선형 폭증        (§10)
 * 사건 20개 × 전부 나열   = 리포트가 길어지고 정확해지지 않음  (최종 제품 원칙)
 * ```
 *
 * 그래서 저장과 사용을 갈랐다(§7):
 *
 * ```
 * 저장    사용자가 알려준 장면 **전부**. 원문 그대로, 로컬에만
 * 사용    이야기 하나마다 관련성 높은 **2~4개**만
 * ```
 *
 * ══ 이 파일이 하지 않는 것 ════════════════════════════════════════════════
 *
 * ⚠️ **본문을 읽지 않는다.** 점수는 전부 metadata(종류·순서·id)로만 계산한다. 자유
 * 입력을 읽어 의미를 추정하기 시작하면 그 순간 서비스가 사용자의 기억을 재분류하는
 * 것이고, §8이 금지한 것이 정확히 그것이다("AI가 Event category를 임의 재분류하지
 * 않는다"). 본문이 이 파일을 통과해 나가는 유일한 경로는 **잘리지 않은 원문**이다.
 *
 * ⚠️ **판정을 만들지 않는다.** 여기서 나오는 값은 순서와 선택뿐이다. 동기화율·
 * Mirror state·History·Premium eligibility는 이 파일을 import하지 않는다 —
 * `lib/logic/relationshipEvents.ts` 상단이 세운 경계 그대로다.
 *
 * ⚠️ **관련 없는 장면을 억지로 붙이지 않는다.** 점수가 0이면 목록에서 빠진다. 2개를
 * 채우려고 무관한 장면을 끌어오면 '네가 알려준 장면과 이어진다'는 말 자체가 거짓이 된다.
 */

/* ═══════════════════════════════════════════ 종류 → 축 (결정론 표) */

/**
 * §9-1 — 사건 종류가 **어느 축의 이야기와 겹치는가.**
 *
 * ⚠️ 이 표는 판정이 아니라 **어휘의 중첩**이다. `contact_change`(연락의 변화)가
 * `contact` 축과 겹치는 것은 해석이 아니라 같은 것을 가리키는 두 이름이기 때문이다.
 * 그래서 이 표를 늘려도 새로운 심리 해석이 생기지 않는다.
 *
 * ⚠️ `other`는 **어느 축에도 넣지 않는다.** 사용자가 '분류하기 애매하다'고 말한
 * 장면을 서비스가 특정 축의 근거로 쓰면, 고르지 않은 것을 고른 것처럼 만든다
 * (`contextBuilders.ts`의 `LENS_EVENT_TYPES`가 같은 이유로 `other`를 뺐다).
 * 대신 아래 `BASE_SCORE`에서 '이야기 전반의 맥락'으로만 남는다.
 */
const EVENT_AXIS: Record<RelationshipEventType, readonly MirrorAxisKey[]> = {
  affection_felt: ['affection'],
  conflict: ['conflict'],
  contact_change: ['contact'],
  closer: ['alone', 'hobby'],
  distance: ['alone', 'contact'],
  care_received: ['affection'],
  meeting: ['hobby', 'contact'],
  other: [],
};

/**
 * §9-3 — 이 판정과 **같은 방향을 보는** 종류.
 *
 * 어긋남(GAP·CONTRADICTION)을 말하는 자리에서는 어긋남으로 기억된 장면이, 일치
 * (MATCH)를 말하는 자리에서는 통했다고 기억된 장면이 더 관련 있다.
 *
 * ⚠️ **여기서 사건의 의미를 뒤집지 않는다.** `conflict` 장면이 MATCH 이야기에서
 * 점수를 못 받는 것은 '갈등이 없었다'는 뜻이 아니라 '이 이야기에서 꺼낼 장면이
 * 아니다'라는 뜻뿐이다.
 */
const VERDICT_AFFINITY: Record<'divergent' | 'convergent', readonly RelationshipEventType[]> = {
  divergent: ['conflict', 'distance', 'contact_change'],
  convergent: ['closer', 'care_received', 'affection_felt', 'meeting'],
};

function opposite(direction: 'divergent' | 'convergent'): 'divergent' | 'convergent' {
  return direction === 'divergent' ? 'convergent' : 'divergent';
}

/** §9-4 — 끝난 관계에서 회고로 더 자주 꺼내지는 종류 */
const FORMER_AFFINITY: readonly RelationshipEventType[] = ['conflict', 'distance', 'contact_change'];

/* ══════════════════════════════════════════════════════ 관련성 계산 */

/**
 * 무엇에 대해 관련성을 묻는가. **이미 계산된 값만 담는다** — 이 구조체를 만들려고
 * 새로 판정하는 곳이 있으면 그건 이 계층의 경계를 넘은 것이다.
 */
export interface EventRelevanceQuery {
  /** 이 이야기의 축. 축이 없는 이야기(self-only 등)에서는 null */
  axis: MirrorAxisKey | null;
  /**
   * 이 이야기가 어긋남을 말하는가 일치를 말하는가. 판정 이름을 그대로 쓰지 않고
   * 두 방향으로 좁히는 이유: `GAP`·`CONTRADICTION`·`CHANGE`가 전부 '어긋남 계열'이고,
   * 판정 enum이 늘어날 때마다 이 표를 고치지 않아도 되게 하기 위해서다.
   */
  direction: 'divergent' | 'convergent' | 'unknown';
  tense: RelationshipTense;
  /** 이 이야기가 아직 결론나지 않은 자리인가(§9-6) */
  unresolved: boolean;
}

export interface EventRelevance {
  eventId: string;
  score: number;
  /** 왜 골랐는지. 사용자에게 노출하지 않는다 — fixture·QA가 값으로 검사한다 */
  reasons: string[];
}

/**
 * §9 — 사건 하나가 이 이야기와 얼마나 관련 있는가.
 *
 * ⚠️ 점수의 절대값에 의미를 두지 않는다. 쓰이는 곳은 **정렬과 0 여부**뿐이다.
 * 0이면 '이 이야기와 이어 말할 근거가 없다'는 뜻이고, 그때 그 장면은 빠진다.
 */
function scoreEvent(
  event: RelationshipEvent,
  query: EventRelevanceQuery,
  order: number,
): EventRelevance {
  const reasons: string[] = [];
  let score = 0;

  /*
    ① 축 직접 관련 — 가장 강한 신호다. 같은 것을 가리키는 두 이름이기 때문이다.

    ⚠️ **표를 조회할 때 존재를 확인한다.** 이 함수의 입력이 언제나
    `sanitizeRelationshipEvents`를 거친 값은 아니다 — dev fixture와 손상된 세션이
    유효하지 않은 `type`을 들고 올 수 있고, 그때 `EVENT_AXIS[type]`은 undefined다.
    처음 구현은 그대로 `.includes(...)`를 불러서 **라우트가 500으로 죽었다**
    (`run-premium-fixtures`의 EVT-05 손상 항목 fixture가 잡았다). 모르는 종류는
    '축과 관련 없음'으로 취급하는 것이 맞는 답이다 — 추정해서 어딘가에 넣지 않는다.
  */
  if (query.axis && (EVENT_AXIS[event.type] ?? []).includes(query.axis)) {
    score += 6;
    reasons.push('axis');
  }

  /* ② 사용자가 고른 종류가 있는가(§8 — 우리가 다시 분류하지 않는다) */
  if (event.type !== 'other') {
    score += 1;
    reasons.push('typed');
  }

  /*
    ③ 판정 방향 — 같은 방향이면 더하고, **반대 방향이면 뺀다.**

    ⚠️ 처음에는 '같은 방향이면 +3'만 있었다. 브라우저 실측에서 그 비대칭이 문장을
    이상하게 만들었다:

    ```
    개인 시간은 네가 말한 기준과 같은 방향으로 나왔어.       ← MATCH
    네가 알려준 거리감이 느껴진 순간 장면도 같은 자리에 있어.  ← 어긋남 계열 장면
    ```

    축이 같다는 이유(+6)만으로 붙었는데, '잘 맞았다'는 결론 아래 '거리감이 느껴졌다'는
    장면을 **같은 자리**라고 말하면 두 문장이 서로를 부정한다. 반대 방향 장면은 잘못된
    장면이 아니라 **다른 이야기에 속한 장면**이므로, 여기서는 물러나게 한다.

    ⚠️ 벌점(-4)이 축 가점(+6)을 완전히 지우지는 않는다. 다른 장면이 하나도 없으면
    이 장면이라도 남는 편이 낫고(점수는 여전히 양수다), 경쟁자가 있으면 진다.
  */
  if (query.direction !== 'unknown') {
    if (VERDICT_AFFINITY[query.direction].includes(event.type)) {
      score += 3;
      reasons.push('verdict');
    } else if (VERDICT_AFFINITY[opposite(query.direction)].includes(event.type)) {
      score -= 4;
      reasons.push('verdict-opposed');
    }
  }

  /* ④ 시제 */
  if (query.tense === 'former' && FORMER_AFFINITY.includes(event.type)) {
    score += 1;
    reasons.push('tense');
  }

  /* ⑤ 아직 결론나지 않은 자리 — 사용자가 남긴 장면이 그대로 확인거리가 된다 */
  if (query.unresolved && event.type !== 'other') {
    score += 2;
    reasons.push('unresolved');
  }

  /*
    ⑥ 최근 것이 조금 앞선다. **1 미만의 가중치**다 — 순서가 축·판정을 이기면 안 된다.
    이 항이 없으면 같은 점수의 장면 사이에서 순서가 입력 순(오래된 것 우선)이 되고,
    사용자가 방금 알려준 장면이 리포트에 가장 늦게 반영된다.
  */
  score += Math.min(order, 20) * 0.01;

  return { eventId: event.id, score, reasons };
}

/**
 * §10 — 이 이야기에 붙일 장면 목록. **상한이 있다.**
 *
 * `limit`의 기본값 3은 §10의 `top 2~4`의 중앙값이다. 정확한 숫자를 여기서 고정하지
 * 않고 호출부가 정하는 이유: FREE(1개)와 Premium(3개)이 서로 다른 예산을 쓰고,
 * AI context(2개)는 또 다르다 — 한 숫자로 묶으면 셋 중 하나는 반드시 틀린다.
 *
 * ⚠️ **원문을 자르지 않는다**(§10 마지막 줄). 이 함수가 돌려주는 것은 id 목록이고,
 * 본문은 호출부가 원본 배열에서 그대로 읽는다.
 */
export function selectRelevantEvents(
  events: readonly RelationshipEvent[],
  query: EventRelevanceQuery,
  limit = 3,
): EventRelevance[] {
  /*
    ══ 축이 있는 이야기에는 **축이 맞는 장면만** 붙는다 ══════════════════════

    ⚠️ 이건 점수가 아니라 **자격**이다. 처음에는 축을 가점(+6)으로만 두었는데,
    브라우저 실측에서 이런 문장이 나왔다:

    ```
    애정 표현에서 갈리는 건 양이 아니라 방식이야.
    네가 알려준 연락의 변화 장면도 같은 자리에 있어.      ← 다른 축이다
    ```

    `contact_change`는 애정 표현 축과 겹치지 않는데, 판정 방향(어긋남)이 같다는
    이유로 점수를 얻어 1위가 됐다. 문장이 **`같은 자리`라고 단언**하는 이상, 축
    관련성은 가점으로 둘 수 없다 — 없으면 그 말이 거짓이다.

    ⚠️ 종류 표에 축이 **없는** 사건(`other`)은 걸러내지 않는다. 사용자가 '분류하기
    애매하다'고 말한 장면이지 '다른 축'이라고 말한 장면이 아니다 — 다만 가점이 거의
    없어서 경쟁자가 있으면 자연히 밀린다.
  */
  const axisEligible = (event: RelationshipEvent): boolean => {
    if (!query.axis) return true;
    const axes = EVENT_AXIS[event.type] ?? [];
    return axes.length === 0 || axes.includes(query.axis);
  };

  return events
    .filter(axisEligible)
    .map((event, index) => scoreEvent(event, query, index))
    .filter((item) => item.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));
}

/**
 * 여러 이야기에서 **같은 장면이 반복해서 골라졌는가** (§24).
 *
 * ⚠️ 이 함수가 돌려주는 것은 `반복 패턴`이 아니라 **이번 분석 안에서 같은 종류의
 * 장면이 몇 개였는가**다. 그 차이가 §24의 핵심이다:
 *
 * ```
 * O  '이번 관계에서 알려준 장면들에서는 반복해서 나타났어'
 * X  '너는 원래 이런 패턴이 있어'                          ← History 3관찰 규칙의 영역
 * ```
 *
 * 그래서 이름도 `pattern`이 아니라 `repeatedWithinAnalysis`다. History의 시계열
 * stable pattern과 섞이지 않게 어휘 자체를 갈라둔다.
 */
export function repeatedWithinAnalysis(
  events: readonly RelationshipEvent[],
): { type: RelationshipEventType; label: string; count: number; eventIds: string[] } | null {
  const byType = new Map<RelationshipEventType, string[]>();
  for (const event of events) {
    /* ⚠️ 위와 같은 이유 — 알 수 없는 종류는 반복의 재료가 되지 않는다 */
    if (event.type === 'other' || !RELATIONSHIP_EVENT_LABEL[event.type]) continue;
    const list = byType.get(event.type) ?? [];
    list.push(event.id);
    byType.set(event.type, list);
  }

  let best: { type: RelationshipEventType; ids: string[] } | null = null;
  for (const [type, ids] of byType) {
    /* 2개는 '반복'이라고 부르기 어렵다 — 한 번 더 있었다는 뜻일 뿐이다 */
    if (ids.length < 3) continue;
    if (!best || ids.length > best.ids.length) best = { type, ids };
  }
  if (!best) return null;

  return {
    type: best.type,
    label: RELATIONSHIP_EVENT_LABEL[best.type],
    count: best.ids.length,
    eventIds: best.ids,
  };
}

/**
 * §17 — 사건을 문장에 넣을 때의 **귀속 표현.**
 *
 * ```
 * O  네가 연락이 줄었을 때 그렇게 느꼈다고 알려줬어
 * X  상대가 마음이 식어서 연락을 줄였어
 * ```
 *
 * ⚠️ 이 함수를 거치지 않고 `event.description`을 문장에 직접 끼워 넣는 코드를
 * 만들지 않는다. 주어가 문장에서 사라지는 자리가 정확히 그런 곳이다.
 */
export function eventAttributionPhrase(event: RelationshipEvent): string {
  return `네가 알려준 ${RELATIONSHIP_EVENT_LABEL[event.type]} 장면`;
}
