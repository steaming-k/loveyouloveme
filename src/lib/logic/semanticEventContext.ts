import { RELATIONSHIP_EVENT_LABEL } from '@/data/relationshipEvents';
import { sanitizeFreeText } from '@/services/ai/safety';
import type { MirrorAxisKey, RelationshipEvent, SelectedEventContext } from '@/types';

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
 * A2 — **카드 한 장에 붙는 장면 수.**
 *
 * v1.46.4 SEMANTIC까지 이 상한은 Insight 단위였다(`PER_INSIGHT_LIMIT`). 그런데 장면을
 * 받은 Insight가 화면 카드가 된다는 보장이 없었다 — A0 감사에서 장면 전부가
 * `cs_reltarget_contact`로 갔고, 그 Insight의 Chapter는 dedup에서 접혀 화면에 오르지
 * 않았다. 이제 받는 쪽이 **이미 확정된 Top 3 카드**다.
 *
 * 2인 이유는 그대로다: SO WHAT은 두 문장 안에서 끝나야 하고, 장면 3개의 의미를 그 안에
 * 넣으면 나열이 된다.
 */
const PER_CANDIDATE_LIMIT = 2;

/**
 * §5 — **Deep Report 한 호출 전체의 장면 수.** 사건이 20개여도 4건이다(§42).
 *
 * ⚠️ 이 숫자를 올리기 전에 `run-semantic-fixtures`의 예산 측정(SEM-BUDGET)을 먼저 본다.
 */
const TOTAL_LIMIT = 4;

/* ═══════════════════════════════════════════════════════════════ 배분 */

export interface CandidateSceneAllocationInput {
  /**
   * **이미 확정된 Top 3, 표시 순서 그대로.** `relevantEventIds`는 Candidate 엔진이
   * `selectRelevantEvents`(metadata만 보는 계층)로 이미 관련성 순으로 고른 값이다.
   */
  candidates: readonly {
    id: string;
    primaryAxis: MirrorAxisKey | null;
    relevantEventIds: readonly string[];
  }[];
  events: readonly RelationshipEvent[];
  perCandidate?: number;
  total?: number;
}

/**
 * A2 · §28 — Top 3 카드마다 해석할 장면. **전체 예산 안에서, 장면은 한 카드에만.**
 *
 * ⚠️ **다시 고르지 않는다.** 관련성 판정은 Candidate 엔진이 이미 했고(근거 토글이 같은
 * 목록을 보여준다), 여기서 하는 일은 그 목록을 앞 카드부터 **나눠 담고 자르는 것**뿐이다.
 * 점수를 다시 매기면 '토글에 보이는 장면'과 '모델이 읽은 장면'이 갈라질 수 있다.
 *
 * ⚠️ 같은 장면을 두 카드에 주지 않는다(§28). 모델은 같은 장면을 두 번 받지 않으므로 세
 * 카드의 SO WHAT에 같은 장면을 반복 인용할 수 없다 — 출력 비교보다 입력 차단이 튼튼하다.
 * 근거 토글에서는 여전히 재사용된다(`candidate.relevantEventIds`).
 */
export function allocateCandidateScenes(
  input: CandidateSceneAllocationInput,
): Map<string, SelectedEventContext[]> {
  const { candidates, events } = input;
  const perCandidate = input.perCandidate ?? PER_CANDIDATE_LIMIT;
  const total = input.total ?? TOTAL_LIMIT;

  const byCandidate = new Map<string, SelectedEventContext[]>();
  if (events.length === 0 || total <= 0) return byCandidate;

  const taken = new Set<string>();
  let budget = total;

  for (const candidate of candidates) {
    if (budget <= 0) break;
    const selected: SelectedEventContext[] = [];

    for (const eventId of candidate.relevantEventIds) {
      if (selected.length >= perCandidate || budget <= 0) break;
      /* 앞 카드가 가져간 장면은 건너뛰고 다음 관련 장면을 본다 — 자리를 비우지 않는다 */
      if (taken.has(eventId)) continue;
      const event = events.find((item) => item.id === eventId);
      if (!event) continue;

      /*
        §6 · §34 — 자유 입력은 **경계에서 한 번 더 자르고 정규화한다.** 렌즈 Task와 같은
        상한(120/80)이다. 두 Task가 다른 상한을 쓰면 되풀이 검사의 기준이 흔들린다.
      */
      const description = sanitizeFreeText(event.description, 120);
      if (!description) continue;

      selected.push({
        eventId: event.id,
        typeLabel: RELATIONSHIP_EVENT_LABEL[event.type],
        description,
        myReaction: sanitizeFreeText(event.myReaction, 80),
        linkedAxis: candidate.primaryAxis,
        relevanceReasons: [],
        source: 'user_reported_event',
      });
      taken.add(event.id);
      budget -= 1;
    }

    if (selected.length > 0) byCandidate.set(candidate.id, selected);
  }

  return byCandidate;
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
