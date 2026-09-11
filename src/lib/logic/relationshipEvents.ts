import {
  RELATIONSHIP_EVENT_DESCRIPTION_MAX_LENGTH,
  RELATIONSHIP_EVENT_LABEL,
  RELATIONSHIP_EVENT_MAX,
  RELATIONSHIP_EVENT_REACTION_MAX_LENGTH,
} from '@/data/relationshipEvents';
import type {
  DeepReportedScene,
  DeepReportedScenes,
  RelationshipEvent,
  RelationshipEventType,
  RelationshipTense,
} from '@/types';

/**
 * User-reported Relationship Event — 판정·문장 계층 (v1.46 · §5 · §10 · §11 · §12)
 *
 * ══ 이 기능이 만드는 것과 만들지 않는 것 ════════════════════════════════════
 *
 * ```
 * 만드는 것    사용자가 기억해서 알려준 장면을, 그 문장 그대로 리포트 맥락에 되짚는다
 * 만들지 않는 것  상대의 의도 · 상대의 감정 · 호감 확률 · 관계 예측 · 점수 변화
 * ```
 *
 * ══ Score 영향 금지 (§11) ═══════════════════════════════════════════════════
 *
 * ⚠️ **이 파일은 어떤 점수도 계산하지 않고, 어떤 판정도 바꾸지 않는다.**
 *
 * 그래서 `logic/compatibility.ts`·`logic/mirror.ts`·`logic/history.ts`는 이 파일을
 * import하지 않는다. 그 세 곳에 `events`가 닿는 경로가 하나도 없다는 것이 이 기능의
 * 안전 근거이고, 반대로 그 중 한 곳이 이 파일을 부르기 시작하면 `Event는 qualitative
 * context다`라는 약속이 깨진다 — v1.13이 `preferences`에 세운 경계와 같다.
 *
 * ══ 자유 입력이 갈 수 있는 곳 (Privacy) ═════════════════════════════════════
 *
 * `description`·`myReaction`은 사용자가 직접 쓴 문장이다. 갈 수 있는 곳은 두 곳뿐이다:
 *
 * ```
 * 화면                      Target 입력 화면 · Premium Deep Report 맥락 블록
 * localStorage(lym.session) 세션 복원용. 사용자 기기 안에만 있다
 * ```
 *
 * 나가지 않는 곳:
 *
 * ```
 * 외부 Analytics   `trackEvent`에는 종류(categorical)와 개수만 보낸다 — 원문 금지
 * History Snapshot 저장하지 않는다 — 기록을 관계 일지/CRM으로 만들지 않는다(§8 · §9)
 * ```
 *
 * ══ v1.46 AI Lens §19 — **AI Provider 경계가 옮겨졌다** ═════════════════════
 *
 * ⚠️ 이 블록은 v1.46 PremiumLens까지 `AI Provider — v1.46에서는 보내지 않는다`라고
 * 적혀 있었다. v1.46 AI Lens에서 **제품 결정으로 바뀌었다.** 문서와 코드가 다른
 * 상태로 두지 않기 위해 여기 그대로 고쳐 적는다.
 *
 * ```
 * 나간다      premium-mbti-lens · premium-saju-lens · premium-zodiac-lens
 *             premium-cross-lens  (services/ai/contextBuilders.ts · eventsForLens)
 * 나가지 않는다 observed · relationship-insight · compatibility-narrative
 *             history-insight · deep-report-narrative  ← 아래 결론이 그대로 유효하다
 * ```
 *
 * 무엇이 어떻게 제한되는가:
 *
 * ```
 * 관련 종류만   렌즈마다 정해진 RelationshipEventType만 (LENS_EVENT_TYPES)
 * 최대 2건      호출당 상한. 3건 전부를 세 렌즈에 반복 전송하지 않는다
 * 한 번 더 자름  sanitizeFreeText(description, 120) · (myReaction, 80)
 * 귀속 유지     프롬프트가 `상대가 일부러 ~했다`를 금지하고, scanLensNarrative의
 *              mind_reading · intent_claim 패턴이 출력에서 다시 막는다(§20)
 * ```
 *
 * ══ Core Task가 사건을 받지 않는 이유는 그대로다 (§13 '필요 여부 판단'의 결론) ════
 *
 * deep-report Task의 근거 계약은 **Insight 단위**다(`evidence: 'insight-subset'`).
 * 모델에게 보내는 것은 Insight마다의 `evidence[]`이고, 허용집합은 그 Insight의
 * `evidenceRefs`다. 사건은 어떤 Insight에도 속하지 않으므로 보내려면 둘 중 하나다:
 *
 * ```
 * (A) 기존 Insight의 evidenceRefs에 사건 ref를 덧붙인다
 *     → sources · strength · eligibleForNarrative(근거 2개 게이트) · Chapter 매칭 ·
 *       available 이 함께 움직인다. §12가 금지한 것이 정확히 이것이다
 *       ("새 Event가 있다고 기존 Mirror state를 바꾸지 않는다")
 * (B) Insight에 속하지 않는 새 자유 서술 채널을 프롬프트에 만든다
 *     → 근거 귀속의 단위가 Task로 되돌아간다. v1.43 §46이 닫은 결함의 재현이고,
 *       동시에 §35가 금지한 주장(`상대는 마음이 식었어`)이 들어올 가장 넓은 문이다
 * ```
 *
 * 둘 다 이번 사이클의 원칙과 충돌한다. 그리고 §12가 요구한 우선순위 1(Premium 관계
 * 맥락)과 3(러비 체크포인트)은 **AI 없이 결정론으로 전달된다** — 아래 `buildReportedScenes`.
 * 그래서 v1.46은 `PROMPT_VERSIONS`·지문·캐시를 **한 글자도 건드리지 않는다**: 사건이
 * 있는 세션과 없는 세션이 같은 AI 요청을 만들고, 기존 캐시와 contract mismatch가
 * 발생할 자리가 아예 없다.
 *
 * 사건을 **Core Task**에 넣는 것은 **Insight 생성기 쪽 결정**(사건을 근거로 삼는 새
 * cross-source 조합을 만들 것인가)이 먼저 있어야 하는 별도 작업이고, UT 결과를 보고
 * 판단한다.
 *
 * ⚠️ 렌즈 Task에는 위 (A)(B) 어느 쪽도 해당하지 않는다. 렌즈 Task의 근거 계약은
 * `evidence: 'no-evidence-refs'`라 Insight도 evidenceRefs도 없고, 사건을 넣어도
 * 기존 Insight의 `sources`·`strength`·`eligibleForNarrative`·Chapter 매칭이 움직일
 * 경로가 **구조적으로 존재하지 않는다.** 렌즈가 Core 판정에 들어가지 않는다는 §45가
 * 그대로 유지되는 이유다.
 */

/* ─────────────────────────────────────────── 정규화 · 세션 복원 */

/**
 * 자유 입력 한 줄을 저장 가능한 형태로. 상한을 넘으면 **자른다**(거부하지 않는다) —
 * 사용자가 방금 쓴 문장을 통째로 버리는 것보다 낫고, 입력 필드에도 같은 `maxLength`가
 * 걸려 있으므로 여기까지 오는 초과분은 붙여넣기·복원 경로뿐이다.
 */
function normalizeLine(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function eventTypeOf(value: unknown): RelationshipEventType | null {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(RELATIONSHIP_EVENT_LABEL, value)
    ? (value as RelationshipEventType)
    : null;
}

/**
 * 저장된 세션의 `target.events` 복원 (v1.44 BUG-002가 세운 규칙 그대로)
 *
 * ⚠️ **추정하지 않는다.** 종류가 유효하지 않거나 `description`이 비어 있으면 그 항목은
 * '무엇을 알려줬는지 알 수 없다'는 뜻이고, 그 상태를 그대로 표현하는 값은 이미
 * 있다 — 목록에서 빠지는 것이다. `other`로 강등하면 사용자가 고르지 않은 종류를
 * 고른 것처럼 만든다.
 *
 * ⚠️ 상한(`RELATIONSHIP_EVENT_MAX`)도 여기서 적용한다. 손상된 세션이 4개를 들고 와도
 * 화면·리포트는 3개만 본다.
 */
export function sanitizeRelationshipEvents(raw: unknown): RelationshipEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: RelationshipEvent[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (events.length >= RELATIONSHIP_EVENT_MAX) break;
    if (typeof item !== 'object' || item === null) continue;

    const candidate = item as Record<string, unknown>;
    const type = eventTypeOf(candidate.type);
    const description = normalizeLine(
      candidate.description,
      RELATIONSHIP_EVENT_DESCRIPTION_MAX_LENGTH,
    );
    const id = typeof candidate.id === 'string' ? candidate.id.slice(0, 80) : '';
    if (!type || !description || !id || seen.has(id)) continue;
    seen.add(id);

    const myReaction = normalizeLine(candidate.myReaction, RELATIONSHIP_EVENT_REACTION_MAX_LENGTH);
    events.push(myReaction ? { id, type, description, myReaction } : { id, type, description });
  }

  return events;
}

/* ──────────────────────────────────────────────────── EvidenceRef */

/**
 * ⚠️ **v1.46에는 `{source:'user_reported_event'}` ref를 만드는 코드가 없다.**
 *
 * 일부러 그렇다. 사건은 아직 어떤 Insight의 근거도 아니므로(위 §11 참고) ref를
 * 만드는 곳이 있으면 그건 판정에 끼어드는 경로가 된다. 대신 **계약만 세워둔다**:
 *
 * ```
 * types/index.ts          EvidenceRef에 variant 존재
 * services/ai/schemas.ts  파서가 그 모양을 안다 (TC5가 타입과의 일치를 강제한다)
 * aiEvidenceResolver.ts   ref → 화면 문장 (아래 `relationshipEventEvidenceText`)
 * ```
 *
 * 이 상태의 의미는 명확하다 — **AI가 이 ref를 지어내도 어떤 Task의 허용집합에도
 * 없어서 항목째로 버려진다**(`refsWithinAllowed`). 그리고 사건을 근거로 삼는 연결이
 * 생기는 날, 그 생성기가 ref를 만들면 화면·프롬프트·근거 목록이 이미 준비돼 있다.
 * v1.26이 타입에만 source를 추가하고 파서에 넣지 않아 만든 결함의 반대 방향이다.
 */

/**
 * 근거 목록에 보이는 문장. `aiEvidenceResolver`가 이 함수를 부른다.
 *
 * ⚠️ **`네가 알려준 …`으로 시작한다.** 주어가 사용자라는 사실이 문장 안에 남아야
 * 한다 — `연락이 줄었어`만 남으면 서비스가 관찰한 사실처럼 읽힌다(§10 · §35).
 */
export function relationshipEventEvidenceText(event: RelationshipEvent): string {
  const label = RELATIONSHIP_EVENT_LABEL[event.type];
  const base = `네가 알려준 장면 · ${label} — '${event.description}'`;
  return event.myReaction ? `${base} (그때 나는 '${event.myReaction}')` : base;
}

/* ─────────────────────────────── Premium 관계 맥락 블록 (§12) */

/**
 * 이 장면에 대해 **말할 수 있는 것까지**.
 *
 * ⚠️ 종류마다 다른 문장을 쓰지만 구조는 하나다: `너는 … 기억하고 있어`. 주어가 항상
 * 사용자이므로, 종류를 늘려도 상대의 의도로 넘어갈 자리가 생기지 않는다.
 *
 * ⚠️ **`~였을 거야` · `~라는 뜻이야` 같은 확정·추정형을 쓰지 않는다.** 이 문장이
 * 하는 일은 사용자가 그 장면을 *중요하게 기억한다*는 사실을 말하는 것뿐이다.
 */
const INTERPRETATION: Record<RelationshipEventType, string> = {
  affection_felt: '너는 이 장면을 호감의 신호로 기억하고 있어.',
  conflict: '너는 이 장면에서 서운함이 남았다고 기억하고 있어.',
  contact_change: '너는 연락의 변화를 관계의 중요한 신호로 기억하고 있어.',
  closer: '너는 이 장면에서 거리가 좁혀졌다고 기억하고 있어.',
  distance: '너는 이 장면에서 거리가 느껴졌다고 기억하고 있어.',
  care_received: '너는 이 장면을 배려받은 순간으로 기억하고 있어.',
  meeting: '너는 약속과 만남에 관한 이 장면을 중요하게 기억하고 있어.',
  other: '너는 이 장면을 관계에서 기억할 만한 일로 남겨줬어.',
};

/**
 * 이 블록이 말할 수 없는 것. **항상 붙는다.**
 *
 * ⚠️ 시제를 따른다(v1.41 §39.9 · v1.42 §41.4와 같은 규칙). `ended` 사용자에게
 * `지금 이 관계`라고 말하지 않는다.
 */
function limitationFor(tense: RelationshipTense): string {
  return tense === 'former'
    ? '이건 네가 기억하는 장면이야. 그때 상대가 무슨 마음이었는지는 여기서 알 수 없어.'
    : '이건 네가 기억하는 장면이야. 상대가 무슨 마음이었는지는 여기서 알 수 없어.';
}

/**
 * 러비 체크포인트 (§12 우선순위 3).
 *
 * ⚠️ **행동을 지시하지 않는다.** `물어봐` · `확인해봐`는 outward 행동이고, 그건
 * `allowsOutwardAction`을 아는 곳에서만 만들어야 한다(v1.40.1 §38.2). 여기서는
 * 러비가 무엇을 받았는지만 말한다 — 그러면 `ended`·`none`에서도 같은 문장이 안전하다.
 */
function lovyNoteFor(count: number, tense: RelationshipTense): string {
  const when = tense === 'former' ? '그 관계에서' : '이 관계에서';
  return count === 1
    ? `${when} 기억나는 장면 하나를 받았어. 네가 무엇을 크게 기억하는지 같이 봤어.`
    : `${when} 기억나는 장면 ${count}개를 받았어. 네가 무엇을 크게 기억하는지 같이 봤어.`;
}

/**
 * 사건 목록 → 리포트 맥락 블록. 사건이 없으면 **null**이다(빈 상태 카피를 만들지 않는다).
 *
 * ⚠️ 여기서 사건을 고르거나 순위를 매기지 않는다. 사용자가 입력한 순서 그대로다 —
 * 서비스가 '더 중요한 장면'을 판정하기 시작하면 그건 사용자의 기억이 아니다.
 */
export function buildReportedScenes(
  events: readonly RelationshipEvent[],
  tense: RelationshipTense,
): DeepReportedScenes | null {
  /**
   * ⚠️ **여기서도 값을 검사한다.** 세션 복원 경로에는 이미 `sanitizeRelationshipEvents`가
   * 있지만, 이 함수의 입력은 그 경로만이 아니다(dev fixture · 미래의 다른 호출부).
   * 본문이 빈 사건이 통과하면 리포트에 **빈 따옴표**가 그려진다 — 사용자가 알려준 적
   * 없는 것을 알려줬다고 말하는 화면이고, 그게 이 블록에서 가장 하면 안 되는 일이다.
   *
   * ⚠️ 종류도 검사한다. 구버전/손상된 값이면 `INTERPRETATION[type]`이 `undefined`가
   * 되어 해석 문장이 통째로 사라진 카드가 남는다 — 경계 없는 인용만 보이는 상태다.
   */
  const scenes: DeepReportedScene[] = [];
  for (const event of events) {
    if (scenes.length >= RELATIONSHIP_EVENT_MAX) break;
    const fact = typeof event.description === 'string' ? event.description.trim() : '';
    const interpretation = INTERPRETATION[event.type];
    if (!fact || !interpretation) continue;
    const myReaction = event.myReaction?.trim();
    scenes.push({
      id: event.id,
      typeLabel: RELATIONSHIP_EVENT_LABEL[event.type],
      fact,
      myReaction: myReaction ? myReaction : null,
      interpretation,
    });
  }

  if (scenes.length === 0) return null;

  return {
    title: '네가 알려준 장면',
    lovyNote: lovyNoteFor(scenes.length, tense),
    limitation: limitationFor(tense),
    scenes,
  };
}
