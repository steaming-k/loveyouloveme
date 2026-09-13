import { RELATIONSHIP_EVENT_LABEL } from '@/data/relationshipEvents';
import { sanitizeFreeText } from '@/services/ai/safety';
import type {
  CrossSourceInsight,
  MirrorAxisKey,
  RelationshipEvent,
  RelationshipTense,
  SelectedEventContext,
} from '@/types';
import { selectRelevantEvents } from './eventRelevance';

/**
 * Semantic Event Context Layer — **어떤 장면의 의미를 Provider에 보내는가** (v1.46.4 · §4 ~ §6)
 *
 * ══ 이 계층이 생긴 이유 ═══════════════════════════════════════════════════
 *
 * v1.46.4 HARDENING까지 사건은 **종류와 개수**만 결과에 반영됐다. 자유서술은 두
 * 곳에만 닿았다:
 *
 * ```
 * 화면    근거 토글 안의 원문 인용 (DeepReportedScene.fact)
 * 렌즈 AI  premium-*-lens 4 Task (contextBuilders.eventsForLens)
 * ```
 *
 * 그래서 같은 contact GAP 사용자 넷이 서로 **완전히 다른 장면**을 적어도, 첫 화면의
 * SO WHAT은 `연락에서는 … 자리가 있어` + `네가 알려준 연락의 변화 장면도 같은 자리에
 * 있어`로 수렴했다 — 종류가 같으니 문장이 같다. 최종 제품 원칙이 말하는 실패 형태
 * 그대로다:
 *
 * > **Event의 개수는 개인화가 아니다. Event의 의미가 결과를 바꿀 때 개인화다.**
 *
 * 이 파일은 그 의미를 **Core Task(deep-report)까지** 나르는 경계를 만든다.
 *
 * ══ 무엇을 하지 않는가 ════════════════════════════════════════════════════
 *
 * ⚠️ **본문을 읽어 점수를 매기지 않는다.** 선별은 전부 `eventRelevance`(metadata만
 * 보는 계층)에 위임한다. 이 파일이 본문에 하는 일은 **자르고 라벨을 붙여 내보내는
 * 것**뿐이다 — 그게 §5가 요구한 "AI에게 20개를 다 던지고 고르라고 시키지 않는다"의
 * 코드 표현이다.
 *
 * ⚠️ **판정을 만들지 않는다.** 입력의 `verdict`·`axis`는 이미 계산된 값이고, 여기서
 * 파생되는 것은 선택과 순서뿐이다. 동기화율·Mirror·History·Premium eligibility는
 * 이 파일을 import하지 않는다(§2-2).
 *
 * ⚠️ **AI가 종류를 다시 분류하지 않는다.** `typeLabel`은 사용자가 고른 값의 라벨이고,
 * 모델 출력에 종류를 쓰게 하는 필드는 계약에 없다(§4 마지막 줄).
 */

/* ═══════════════════════════════════════════════════════ 예산 (§5 · §42) */

/**
 * §5 — **한 이야기에 붙는 장면 수.**
 *
 * §5의 권장 범위는 `candidate당 1~3`이고 그 중 2를 쓴다. 3이 아니라 2인 이유는
 * 토큰이 아니라 **문장**이다: 한 카드의 SO WHAT은 두 문장 안에서 끝나야 하고
 * (§13 copy contract), 장면 3개의 의미를 그 안에 넣으면 나열이 된다 — §16의 기대
 * 문장들이 전부 '장면 하나의 의미'를 말하는 형태인 것과 같은 이유다.
 */
const PER_INSIGHT_LIMIT = 2;

/**
 * §5 — **Deep Report 한 호출 전체의 장면 수.**
 *
 * §5의 권장 범위는 `3~6`이고 그 중 4를 쓴다. 상한이 있는 이유는 §42다:
 *
 * ```
 * 사건 3개  → 최대 4건 전송
 * 사건 20개 → 최대 4건 전송   ← 같다. 이 상수가 하는 일이 이것이다
 * ```
 *
 * ⚠️ 이 숫자를 올리기 전에 `run-semantic-fixtures`의 예산 측정(SEM-BUDGET)을 먼저
 * 본다. 임의로 정하지 않기로 한 자리다(§5 마지막 줄).
 */
const TOTAL_LIMIT = 4;

/* ══════════════════════════════════════════════ 판정 → 방향 (읽기 전용) */

/**
 * ⚠️ `insightCandidates.ts`의 `TYPE_TO_VERDICT`·`directionOf`와 **같은 표를 두 벌
 * 만들지 않는다.** 그래서 여기서는 `CrossSourceInsight.type`에서 방향만 바로 읽는다 —
 * Candidate 계층의 표현 어휘(`InsightVerdict`)를 이 파일이 알 필요가 없다.
 *
 * 방향이 하는 일은 하나다: 어긋남을 말하는 자리에는 어긋남으로 기억된 장면이, 일치를
 * 말하는 자리에는 통했다고 기억된 장면이 더 관련 있다(§9-3).
 */
function directionOfType(type: CrossSourceInsight['type']): 'divergent' | 'convergent' | 'unknown' {
  switch (type) {
    case 'CONTRADICTION':
    case 'GAP':
    case 'CHANGE':
      return 'divergent';
    case 'MATCH':
    case 'REPEATED_SIGNAL':
      return 'convergent';
    default:
      return 'unknown';
  }
}

/* ═══════════════════════════════════════════════════════════════ 선별 */

export interface SemanticEventSelectionInput {
  /** **AI에게 실제로 보내는 Insight만.** `buildDeepReportContext`가 이미 걸러낸 목록 */
  insights: readonly { id: string; type: CrossSourceInsight['type']; axis: MirrorAxisKey | null }[];
  events: readonly RelationshipEvent[];
  tense: RelationshipTense;
  perInsight?: number;
  total?: number;
}

/**
 * §5 — Insight마다 붙일 장면. **전체 예산 안에서, 장면은 한 번만 쓰인다.**
 *
 * ══ 같은 장면을 두 Insight에 주지 않는 이유 (§28) ═════════════════════════
 *
 * §28은 "Event 하나가 Top 3 모든 카드에 반복해서 붙지 않게 한다"를 요구한다. 그걸
 * **출력 검사**로 막으려면 모델이 쓴 문장 세 개를 서로 비교해야 하는데, 그건
 * paraphrase에 약하다. 입력에서 막으면 구조적으로 불가능해진다 — 모델은 같은 장면을
 * 두 번 받지 않으므로 두 번 인용할 수 없다.
 *
 * ⚠️ **근거 토글에서는 여전히 재사용된다.** 그쪽이 읽는 것은
 * `candidate.relevantEventIds`(관련 있으면 다 보여준다)이고, 이 함수가 정하는 것은
 * **의미를 말할 자리**뿐이다 — §28 마지막 줄이 허용한 구분 그대로다.
 *
 * ⚠️ 순서를 지킨다. `insights`는 이미 §6 우선순위로 정렬돼 있으므로, 앞의 Insight가
 * 더 관련 있는 장면을 먼저 가져간다. 점수로 다시 고르면 같은 세션을 두 번 열었을 때
 * 배분이 달라 보일 수 있다.
 */
export function buildSemanticEventContexts(
  input: SemanticEventSelectionInput,
): Map<string, SelectedEventContext[]> {
  const { insights, events, tense } = input;
  const perInsight = input.perInsight ?? PER_INSIGHT_LIMIT;
  const total = input.total ?? TOTAL_LIMIT;

  const byInsight = new Map<string, SelectedEventContext[]>();
  if (events.length === 0 || total <= 0) return byInsight;

  /** §28 — 한 번 쓰인 장면은 다른 Insight의 의미 자리에 다시 가지 않는다 */
  const taken = new Set<string>();
  let budget = total;

  for (const insight of insights) {
    if (budget <= 0) break;

    /*
      ⚠️ 후보에서 **이미 쓰인 장면을 먼저 뺀다.** 점수를 매긴 뒤에 빼면, 1위가 빠진
      자리에 2위가 올라오는 대신 그 Insight의 몫이 그냥 줄어든다 — 관련 있는 장면이
      남아 있는데 자리를 비우는 것이고, 그러면 뒤쪽 카드만 계속 장면을 못 받는다.
    */
    const pool = events.filter((event) => !taken.has(event.id));
    if (pool.length === 0) break;

    const ranked = selectRelevantEvents(
      pool,
      {
        axis: insight.axis,
        direction: directionOfType(insight.type),
        tense,
        unresolved: insight.type === 'UNKNOWN',
      },
      Math.min(perInsight, budget),
    );

    const selected: SelectedEventContext[] = [];
    for (const item of ranked) {
      const event = pool.find((candidate) => candidate.id === item.eventId);
      if (!event) continue;

      /*
        §6 · §34 — 자유 입력은 **경계에서 한 번 더 자르고 정규화한다.** 렌즈 Task가
        쓰는 것과 같은 상한(120/80)이다. 두 Task가 다른 상한을 쓰면 같은 장면이
        어디서는 잘리고 어디서는 안 잘려서, 되풀이 검사의 기준이 흔들린다.
      */
      const description = sanitizeFreeText(event.description, 120);
      if (!description) continue;

      selected.push({
        eventId: event.id,
        typeLabel: RELATIONSHIP_EVENT_LABEL[event.type],
        description,
        myReaction: sanitizeFreeText(event.myReaction, 80),
        linkedAxis: insight.axis,
        relevanceReasons: item.reasons,
        source: 'user_reported_event',
      });
      taken.add(event.id);
      budget -= 1;
      if (budget <= 0) break;
    }

    if (selected.length > 0) byInsight.set(insight.id, selected);
  }

  return byInsight;
}

/* ═══════════════════════════════════════════════════ 캐시 지문 (§43 · §44) */

/**
 * §43 — **본문이 바뀌면 캐시가 반드시 무효화된다.**
 *
 * ══ 왜 기존 서명으로는 부족했나 ═══════════════════════════════════════════
 *
 * 렌즈 Task가 쓰는 `lensEventSignature`는 `type:description.length`다. 길이만 보므로
 * **같은 길이로 고친 수정을 감지하지 못한다**:
 *
 * ```
 * 전  연락이 줄었을 때 마음이 식은 줄 알았다   (24자)
 * 후  연락이 줄었을 때 그냥 바쁜 줄 알았다     (22자)  ← 다른 의미, 길이는 비슷
 * 전  갈등 후 답이 없어서 힘들었다             (19자)
 * 후  갈등 후 답이 없어도 괜찮았다             (19자)  ← 의미가 반대, 길이는 같다
 * ```
 *
 * 두 번째가 실제 실패다. 그리고 `myReaction`은 서명에 아예 없었다 — 반응만 고치면
 * 이전 문장이 캐시에서 그대로 나온다.
 *
 * ⚠️ **원문을 서명에 남기지 않는다**(§29 · §44 Privacy). 문자 단위 해시를 여기서
 * 직접 돌려서, 이 함수가 돌려주는 문자열에는 사용자가 쓴 글자가 한 자도 없다.
 * `aiFingerprint.digest`를 쓰지 않는 이유는 그쪽이 private이고, 이 값이 **그 digest의
 * 입력**으로 들어가기 때문이다(해시의 해시가 아니라 한 겹이면 충분하다).
 */
export function semanticEventSignature(events: readonly RelationshipEvent[]): string[] {
  return events.map(
    (event) => `${event.id}:${event.type}:${textHash(event.description)}:${textHash(event.myReaction)}`,
  );
}

/**
 * §44 — 선택된 장면의 **id 목록**. 지문에 함께 들어간다.
 *
 * ⚠️ 왜 위 서명만으로 부족한가: 사건을 하나 **지우면** 남은 사건의 본문은 그대로이고,
 * 서명 배열만 짧아진다. 그건 감지된다. 그런데 사건을 **추가**하면 선택이 뒤바뀔 수
 * 있는데(관련성이 더 높은 장면이 들어오면 기존 장면이 밀린다) 본문 서명만으로는
 * '무엇이 실제로 전송되는가'가 달라진 것을 알 수 없다 — 그 차이를 이 값이 담는다.
 */
export function semanticSelectionSignature(
  byInsight: ReadonlyMap<string, SelectedEventContext[]>,
): string[] {
  return [...byInsight.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([insightId, scenes]) => `${insightId}>${scenes.map((scene) => scene.eventId).join(',')}`);
}

/** FNV-1a 변형. 암호학적 용도가 아니라 '같은 글자인가'만 판단한다 */
function textHash(value: string | null | undefined): string {
  if (!value) return '-';
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/* ══════════════════════════════════════════════════════════════ 검증 (§9) */

/**
 * §9 — 모델이 돌려준 `usedEventIds`를 **전달한 shortlist로 좁힌다.**
 *
 * ⚠️ 위반을 보고 narrative를 버리는 판정은 호출부(handler)에 있다. 이 함수는
 * '무엇이 허용 범위 밖인가'만 돌려준다 — 판정과 계산을 한 함수에 섞으면 다른
 * 호출부가 생길 때 한쪽만 고쳐진다(`refsWithinAllowed`와 같은 구조).
 */
export function eventIdsOutsideAllowed(
  usedEventIds: readonly string[],
  allowed: readonly SelectedEventContext[],
): string[] {
  const allowedIds = new Set(allowed.map((scene) => scene.eventId));
  return usedEventIds.filter((id) => !allowedIds.has(id));
}

/** 이 호출에서 실제로 나가는 장면 총 건수 — §42 예산 보고용 */
export function semanticSceneCount(byInsight: ReadonlyMap<string, SelectedEventContext[]>): number {
  let count = 0;
  for (const scenes of byInsight.values()) count += scenes.length;
  return count;
}

/** 이 호출에서 나가는 자유 입력 총 길이 — §42 예산 보고용. **본문이 아니라 길이다** */
export function semanticSceneChars(byInsight: ReadonlyMap<string, SelectedEventContext[]>): number {
  let chars = 0;
  for (const scenes of byInsight.values()) {
    for (const scene of scenes) {
      chars += scene.description.length + (scene.myReaction?.length ?? 0);
    }
  }
  return chars;
}
