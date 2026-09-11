import { MIRROR_AXES } from '@/data/axes';
import { relationshipRefFor } from '@/lib/logic/allowedEvidence';
import { declaredPhraseOf } from '@/lib/logic/mirror';
import { withCopula, withObjectParticle, withTopicParticle } from '@/lib/korean';
import type { RelationshipTense } from '@/lib/logic/relationshipEvidence';
import type {
  CompatibilityResult,
  DeclaredPreference,
  MirrorInsight,
  EvidenceRef,
  CrossSourceEvidenceSource,
  CrossSourceInsight,
  DeepAction,
  DeepConnection,
  DeepConversationQuestion,
  DeepLovyObservation,
  HistoryReport,
  MirrorAxisKey,
  MirrorReport,
  PremiumChapter,
  PremiumChapterEvidence,
  PremiumChapterKind,
  PremiumOmission,
  PremiumSourceGroup,
} from '@/types';

/**
 * Premium Chapter Engine — **결정론** (v1.45 · §6~§10)
 *
 * ══ 왜 이 파일이 생겼는가 ═══════════════════════════════════════════════════
 *
 * v1.44까지 Premium 리포트의 렌더 단위는 **Insight 하나 = 카드 하나**였다. 고데이터
 * 세션을 `/api/dev/premium-test`로 실측한 결과가 이렇다:
 *
 * ```
 * renderedUnits  12  (core 1 · connection 7 · single 4)
 * 제목            0개 — 모든 카드의 머리는 source 라벨 칩뿐이었다
 * 같은 축 반복     contact ×4 · conflict ×4 · alone ×3       ← §10 금지 항목
 * 중복            cs_history_change_* 3개가 singleSourceNotes와 historyDeep에 둘 다 나왔다
 * 미사용          overview.topSummaries는 계산되고 화면에 그려지지 않았다(죽은 필드)
 * ```
 *
 * 즉 문제는 '얇다'가 아니라 **구조가 없다**였다. 12개는 적은 수가 아닌데, 제목도 순서도
 * 묶음도 없어서 리포트가 아니라 카드 더미로 읽혔고, 같은 축 이야기가 네 번 반복됐다.
 *
 * Chapter는 **같은 주제의 Insight를 하나로 묶는다.** 그래서 축 반복이 사라지고
 * (묶인 Insight는 그 챕터의 근거가 된다), 각 묶음에 강한 제목이 붙는다.
 *
 * ══ 이 파일이 절대 하지 않는 것 ═════════════════════════════════════════════
 *
 * ⚠️ **판정을 만들지 않는다.** 새 Insight도, 새 점수도, 새 근거도 만들지 않는다.
 *   이미 `buildCrossSourceInsights`가 만든 것을 **고르고 묶을** 뿐이다.
 *
 * ⚠️ **분량을 위해 Chapter를 만들지 않는다.** 근거가 없으면 그 Chapter는 생성되지
 *   않는다. 10개를 채우는 것이 목표가 아니라 **정직한 수**를 보여주는 것이 목표다.
 *   비어 있는 자리는 `buildOmissions`가 "무엇이 더 쌓이면 열리는지"로 적는다.
 *
 * ⚠️ **AI가 Chapter를 만들지 않는다.** 존재 여부·제목·근거·순서 전부 여기서 결정되고,
 *   AI는 이미 선택된 Insight에 문장 하나를 붙일 뿐이다(`DeepConnection.narrativeText`).
 *
 * ⚠️ **무료가 이미 보여준 것을 다시 팔지 않는다.** `isFreeDuplicate`가 그 게이트다.
 */

/* ────────────────────────────────────────────────────── Source Group */

/**
 * `CrossSourceEvidenceSource`(11종) → 사용자가 구분할 수 있는 묶음.
 *
 * ⚠️ **같은 곳을 두 번 세지 않기 위한 것이다.** `declared`·`adaptive`·`deep_followup`·
 * `user_correction`은 전부 '내가 답한 것'이라 서로 독립적인 근거가 아니다. 이것들을
 * 따로 세면 Chapter가 "자료 4종을 이었다"고 말하면서 실제로는 같은 설문 한 벌만
 * 본 것이 된다 — v1.26이 `hasDeepConnection`에서 `new Set(sources)`를 쓴 이유와 같다.
 */
const SOURCE_GROUP: Record<CrossSourceEvidenceSource, PremiumSourceGroup> = {
  declared: 'declared_me',
  adaptive: 'declared_me',
  deep_followup: 'declared_me',
  user_correction: 'declared_me',
  observed: 'observed_me',
  relationship: 'past_relationship',
  current_relationship: 'current_relationship',
  target: 'target',
  compatibility: 'compatibility',
  history: 'history',
  mbti_lens: 'lens',
};

function groupsOf(insights: readonly CrossSourceInsight[]): PremiumSourceGroup[] {
  const set = new Set<PremiumSourceGroup>();
  for (const insight of insights) {
    for (const source of insight.sources) set.add(SOURCE_GROUP[source]);
  }
  return [...set];
}

function axisLabel(key: MirrorAxisKey): string {
  return MIRROR_AXES.find((axis) => axis.key === key)?.label ?? key;
}

function hasRef(
  insight: CrossSourceInsight,
  source: CrossSourceEvidenceSource,
  field?: string,
): boolean {
  return insight.evidenceRefs.some((ref) => {
    if (ref.source !== source) return false;
    if (field === undefined) return true;
    return 'field' in ref && ref.field === field;
  });
}

/* ─────────────────────────────────────────── FREE Duplicate Gate (§8.2) */

/* ═══════════ FREE 중복 판정 — **근거 단위** (v1.45 Release blocker) ═══════════

   ══ 왜 바꿨나 ═════════════════════════════════════════════════════════════

   예전 판정은 **축 + 판정** 단위였다: "이 Insight의 source 그룹이 전부 무료가 보여줄 수
   있는 것이고, 무료 행과 판정이 같으면 중복". 그 규칙은 Insight가 **무료가 소비하지 않은
   근거를 추가로 들고 있어도** 통째로 버렸다.

   ⚠️ 그리고 예전 규칙에는 '무료가 실제로 무엇을 소비했는가'가 **없었다.** 그룹이 허용
   목록에 있는지만 봤다. 그래서 무료 행이 `current` 근거로 만들어진 축에서 Insight가
   `past` 근거를 이었을 때도 — 즉 **무료가 보여주지 않은 시점**을 이었을 때도 — 중복으로
   읽힐 수 있는 구조였다.

   ══ 지금 판정 ═════════════════════════════════════════════════════════════

   ```
   무료가 이 축에서 소비한 근거 = declared:<axis>              (왼쪽 칸)
                              + relationshipRefFor(freeRow)   (오른쪽 칸 · 없으면 없음)

   남은 근거 = Insight의 ref − 소비된 근거
   중복 ⟺ 판정이 같고, 남은 근거가 **새 source 그룹을 하나도 더하지 않는다**
   ```

   ⚠️ `relationshipRefFor`를 그대로 쓴다 — 그 함수가 무료 행의 `relationshipSignal`을
   만든 **바로 그 ref**를 돌려준다(`logic/allowedEvidence.ts`). 여기서 '무료가 뭘 봤을까'를
   다시 추측하면 판정이 두 벌이 되고, 두 벌이 갈리는 순간 중복 판정이 조용히 틀린다.

   ⚠️ **'남은 ref가 하나라도 있으면 통과'로 두지 않았다.** `adaptive`는 `declared`와 같은
   `declared_me` 그룹이라, 그것만 남은 Insight를 통과시키면 결론은 무료와 똑같은 Chapter가
   근거 한 줄만 더 붙여서 팔린다 — 그게 정확히 '무료 문장 재포장'이다. 그래서 **그룹**이
   늘어나야 한다: 무료가 보여준 두 칸 밖의 자료가 실제로 있어야 연결이라고 부른다.

   ══ 이 판정이 완화가 아니라는 것 ════════════════════════════════════════════

   기존 fixture에서 **결과가 하나도 바뀌지 않는다**(PREM-V2-11 · POSTREV 회귀로 확인).
   달라지는 것은 두 가지뿐이고 둘 다 더 엄격하거나 더 정확한 방향이다:

   ```
   ① 무료가 소비한 ref를 **실제로** 계산한다 (그룹 허용 목록 추측 → 실 소비 ref)
   ② past + current 를 둘 다 가진 Insight의 예외 처리가 **규칙에서 저절로 나온다**
      (예전에는 별도 if 문이 필요했다)
   ```
*/

/** 무료 Mirror 행 하나가 이 축에서 **실제로 소비한** ref 키 */
function freeConsumedRefKeys(freeRow: MirrorInsight): Set<string> {
  const keys = new Set<string>([refKey({ source: 'declared', field: freeRow.key })]);
  const right = relationshipRefFor(freeRow);
  if (right) keys.add(refKey(right));
  return keys;
}

/** ref 하나의 비교용 키. `source:field` 형태로 평탄화한다 */
function refKey(ref: EvidenceRef): string {
  if ('field' in ref) return `${ref.source}:${ref.field}`;
  if ('traitId' in ref) return `${ref.source}:${ref.traitId}`;
  if ('entryId' in ref) return `${ref.source}:${ref.entryId}:${ref.axis}`;
  /**
   * v1.46 — `user_reported_event`가 여기로 온다. Insight의 `evidenceRefs`에는 절대
   * 들어오지 않지만(사건은 판정 근거가 아니다 · §11), 이 함수가 `EvidenceRef`를 받는
   * 이상 union 전체를 다뤄야 한다 — `default`로 뭉개면 새 source가 조용히
   * `undefined` 키를 만들고 FREE 중복 판정이 그 키를 소비하지 않은 것으로 센다.
   */
  if ('eventId' in ref) return `${ref.source}:${ref.eventId}`;
  return `${ref.source}:${ref.questionId}`;
}

/**
 * 이 Insight가 **무료에서 이미 본 것**인가.
 *
 * ⚠️ 중복이어도 Insight가 사라지는 것은 아니다 — Chapter의 **주인공**이 되지 못할 뿐이고
 * 근거로는 합쳐질 수 있다(`supportFor`). 무료에서 본 것을 유료의 제목으로 팔지 않는다는
 * 규칙이지, 근거를 버리는 규칙이 아니다.
 */
export function isFreeDuplicate(insight: CrossSourceInsight, mirror: MirrorReport): boolean {
  if (!insight.axis) return false;

  const freeRow = mirror.insights.find((item) => item.key === insight.axis);
  /** 무료가 그 축을 아예 보여주지 않았으면 중복일 수 없다 */
  if (!freeRow) return false;

  /** 판정이 다르면 같은 축이라도 다른 것을 말한다 */
  const sameVerdict =
    freeRow.state === insight.type || (freeRow.state === 'GAP' && insight.type === 'GAP');
  if (!sameVerdict) return false;

  /** 무료가 보여준 두 칸의 source 그룹 */
  const consumed = freeConsumedRefKeys(freeRow);
  const freeGroups = new Set<PremiumSourceGroup>(['declared_me']);
  const right = relationshipRefFor(freeRow);
  if (right) freeGroups.add(SOURCE_GROUP[right.source as CrossSourceEvidenceSource]);

  /** 무료가 소비하지 않은 근거가 **새 자료 종류**를 더하는가 */
  for (const ref of insight.evidenceRefs) {
    if (consumed.has(refKey(ref))) continue;
    const group = SOURCE_GROUP[ref.source as CrossSourceEvidenceSource];
    if (group && !freeGroups.has(group)) return false;
  }
  return true;
}

/* ─────────────────────────────────────────────────── Chapter 후보 매칭 */

interface ChapterSpec {
  kind: PremiumChapterKind;
  /** §10 렌더 순서 — '재미있는 순서'가 아니라 가치 흐름이다 */
  order: number;
  title: (context: BuildContext) => string;
  /** 이 Insight가 이 Chapter의 **주인공**이 될 수 있는가 */
  matches: (insight: CrossSourceInsight, context: BuildContext) => boolean;
}

interface BuildContext {
  tense: RelationshipTense;
  compatibility: CompatibilityResult;
  historyReport: HistoryReport;
  mirror: MirrorReport;
  actionSectionTitle: string;
}

/**
 * ⚠️ **id 접두사로 매칭하지 않는다.** `cs_compat_link_*` 같은 문자열에 기대면 생성기
 * 이름이 바뀌는 순간 Chapter가 조용히 사라진다. 매칭은 전부 `type`·`axis`·`sources`·
 * `evidenceRefs` — 즉 **의미**로만 한다.
 */
const CHAPTER_SPECS: readonly ChapterSpec[] = [
  {
    kind: 'declared_vs_shown',
    order: 1,
    title: () => '말한 나와 관계에서 나타난 나',
    /**
     * `말한 나`(declared) × `드러난 나` — 뒤쪽은 관계 신호가 기본이지만, 사진 관찰이나
     * 성향 렌즈도 **말한 것과 독립적으로 관찰된 나**다.
     *
     * ⚠️ 뒤쪽에 `observed_me`·`lens`를 넣은 것은 분량 때문이 아니라 **Solo 때문이다.**
     * 상대도 관계 경험도 없는 사용자에게 열리는 조합은 ⑥(declared × observed)과
     * ⑦(declared × MBTI self)뿐인데(v1.29 P4 · v1.32 P4-D), 뒤쪽을 관계 신호로만
     * 좁히면 그 두 연결이 **어느 Chapter에도 들어가지 못하고 사라진다.**
     */
    matches: (insight) => {
      const groups = new Set(groupsOf([insight]));
      return (
        groups.has('declared_me') &&
        (groups.has('past_relationship') ||
          groups.has('current_relationship') ||
          groups.has('observed_me') ||
          groups.has('lens'))
      );
    },
  },
  {
    kind: 'closeness_distance',
    /**
     * ⚠️ **`hidden_priority`보다 먼저 고른다.** §10은 CH02~CH05를 같은 티어
     * ('relationship evidence')로 묶으므로 티어 안의 순서는 우리가 정한다.
     *
     * 두 축을 동시에 요구하는 이 Chapter가 **가장 만들기 어렵다.** 뒤로 밀면 단일 축
     * Chapter들이 축을 먼저 소진해서 영원히 만들어지지 않는다 — 실측에서 실제로
     * 그랬다(contact가 CH01·CH02에 연달아 잡혀 CH03이 통째로 사라졌다).
     */
    order: 2,
    title: () => '가까워지는 방식과 거리를 두는 방식',
    /**
     * ⚠️ **두 축이 필요하다.** 단일 `contact` 결과를 다시 설명하는 것은 금지다(§7 CH03).
     * 그래서 여기 매칭은 후보 자격일 뿐이고, 실제 생성은 아래 루프가 contact·alone
     * 두 축을 모두 찾았을 때만 한다.
     */
    matches: (insight) => insight.axis === 'contact' || insight.axis === 'alone',
  },
  {
    kind: 'hidden_priority',
    order: 3,
    title: () => '생각보다 더 중요했던 기준',
    /**
     * §7 CH02는 `Past important/hardest × Declared`다 — **두 쪽이 다 있어야 한다.**
     *
     * ⚠️ `declared_me`를 빼면 안 된다. 실측에서 그렇게 두었더니 ⑨(지금 관계 × 이전
     * 관계)가 이 Chapter에 잡혔고, `생각보다 더 중요했던 기준`이라는 제목 아래
     * **시점 비교 문장**이 실렸다 — 제목이 내용을 잘못 부르는 상태이고, 동시에
     * CH09가 쓸 재료를 가로챘다. 이 Chapter가 보는 것은 '말한 중요도'와 '실제로
     * 힘들었던 경험'이 같은 곳을 가리키는가 하나뿐이다.
     */
    matches: (insight) =>
      groupsOf([insight]).includes('declared_me') &&
      (hasRef(insight, 'relationship', 'hardest') || hasRef(insight, 'relationship', 'important')),
  },
  {
    kind: 'conflict_needs',
    order: 4,
    title: () => '갈등이 생겼을 때 내가 원하는 것',
    matches: (insight) => insight.axis === 'conflict',
  },
  {
    kind: 'affection_exchange',
    order: 5,
    title: () => '애정을 주고받는 방식',
    matches: (insight) => insight.axis === 'affection',
  },
  {
    kind: 'tune_with_target',
    order: 6,
    /** ⚠️ 끝난 관계에 '맞춰봐야 한다'고 말하지 않는다 — 그건 재회 제안이다(§2.4) */
    title: (context) =>
      context.tense === 'former'
        ? '그때 서로 기대가 달랐던 지점'
        : '이 사람과 특히 맞춰봐야 하는 지점',
    matches: (insight, context) => {
      if (context.compatibility.score === null) return false;
      const groups = new Set(groupsOf([insight]));
      return groups.has('target') || groups.has('compatibility');
    },
  },
  {
    kind: 'past_and_now',
    /** §10 — history는 uncertainty·next check 뒤다 */
    order: 9,
    title: (context) =>
      context.tense === 'former' ? '그때의 나와 지금의 나' : '과거의 나와 지금의 나',
    /**
     * ⚠️ **실제 시점 비교 근거가 있을 때만이다**(§2.3 Temporal Trust).
     * 두 갈래뿐이다: 저장된 기록끼리의 비교(`history` 그룹 + `comparable`)이거나,
     * 지금 관계 × 이전 관계를 나란히 놓은 것(두 그룹 모두 보유).
     */
    matches: (insight, context) => {
      const groups = new Set(groupsOf([insight]));
      if (groups.has('history') && context.historyReport.comparable) return true;
      return groups.has('current_relationship') && groups.has('past_relationship');
    },
  },
];

/* ────────────────────────────────────────────────────────── 문장 생성 */

/**
 * §12.3 highlight — 각 Chapter의 핵심 문장 하나.
 *
 * ⚠️ **새 주장을 만들지 않는다.** 이 문장이 쓸 수 있는 재료는 세 개뿐이다:
 * (a) Chapter 종류 (b) 어떤 축을 봤는가 (c) 서로 다른 자료가 같은 방향인가 다른
 * 방향인가(`type`). 원인·예측·성격 단정은 재료가 없어서 나올 수 없다.
 *
 * ══ v1.45 — **틀을 Chapter별로 나눴다** ═══════════════════════════════════
 *
 * 처음에는 한 문장 틀이었다. 브라우저 실측에서 이렇게 나왔다:
 *
 * ```
 * 결국 이번 연결에서 중요한 건 연락이야 — 따로 답한 자료 4종이 서로 다른 방향을 …
 * 결국 이번 연결에서 중요한 건 연락과 개인 시간이야 — 따로 답한 자료 5종이 서로 …
 * 결국 이번 연결에서 중요한 건 갈등 해결이야 — 따로 답한 자료 3종이 서로 다른 시점…
 * ```
 *
 * 리포트 요약 섹션이 상위 3개를 나란히 보여주기 때문에 **같은 문장이 세 줄 연속으로**
 * 보였다. 그러면 각 Chapter가 다른 가치 단위라는 것이 문장 층에서 지워진다 —
 * §20이 '같은 결론'을 중복 후보로 세는 이유가 정확히 이것이다.
 *
 * ⚠️ **방향 절(`direction`)은 여전히 `type`에서만 나온다.** 틀만 Chapter별로 나눴다 —
 * 틀에 판정을 넣으면(예: `hidden_priority`에 '같은 곳을 가리켰어'를 고정) 실제 type이
 * GAP일 때 문장이 거짓이 된다. 그래서 각 틀은 `direction`을 **받아서** 끼운다.
 */
function directionOf(type: CrossSourceInsight['type']): string {
  return type === 'MATCH'
    ? '같은 방향을 가리켰어'
    : type === 'CHANGE'
      ? '서로 다른 시점에서 다르게 나왔어'
      : type === 'REPEATED_SIGNAL'
        ? '같은 자리에서 되풀이됐어'
        : type === 'UNKNOWN'
          ? '아직 이어볼 자료가 부족해'
          : '서로 다른 방향을 가리켰어';
}

/**
 * Chapter별 강조 문장 틀. 인자는 (축 라벨 · 방향 절 · 자료 종수)뿐이다.
 *
 * ⚠️ 파생 Chapter(`uncertainty`·`next_check`·`closing`)는 여기 없다 — 그 셋은
 * 근거를 가진 연결이 아니라서 강조 문장을 각자 자기 자리에서 직접 만든다.
 */
type TakeawayFrame = (subject: string, direction: string, groupCount: number) => string;

const TAKEAWAY_FRAME: Partial<Record<PremiumChapterKind, TakeawayFrame>> = {
  declared_vs_shown: (subject, direction, n) =>
    `네가 말한 기준과 관계에서 나타난 ${subject}은 ${direction} — 자료 ${n}종을 나란히 놓고 본 결과야.`,
  closeness_distance: (subject, direction, n) =>
    `따로 물어본 두 기준인데 ${direction}. ${subject}을 관계에서의 거리라는 한 축으로 볼 수 있는 자리야(자료 ${n}종).`,
  hidden_priority: (subject, direction, n) =>
    `${withTopicParticle(subject)} 네가 먼저 꼽은 기준이면서 실제로 힘들었다고 적은 자리이기도 해 — 자료 ${n}종이 ${direction}.`,
  conflict_needs: (subject, direction, n) =>
    `갈등에서 갈린 건 누가 맞느냐가 아니라 ${subject}을 다루는 방식이야 — 자료 ${n}종이 ${direction}.`,
  affection_exchange: (subject, direction, n) =>
    `표현이 얼마나 잦았는지가 아니라 방식에서 갈리는 자리야 — ${subject}에 대해 자료 ${n}종이 ${direction}.`,
  tune_with_target: (subject, direction, n) =>
    `동기화율 점수 하나로는 보이지 않던 지점이야 — ${subject}에 대해 자료 ${n}종이 ${direction}.`,
  past_and_now: (subject, direction, n) =>
    `두 시점을 나란히 놓을 수 있어서 비교한 자리야 — ${subject}이 ${direction}(기록 ${n}종).`,
};

function takeawayFor(
  kind: PremiumChapterKind,
  primary: CrossSourceInsight,
  axesLabels: readonly string[],
  groupCount: number,
): string {
  const subject = axesLabels.length > 0 ? axesLabels.join('과 ') : '이번 연결';
  const direction = directionOf(primary.type);
  const frame = TAKEAWAY_FRAME[kind];

  /**
   * ⚠️ fallback을 남겨둔다. 새 Chapter 종류가 위 표에 추가되지 않아도 강조 문장이
   * **사라지지는 않는다** — `PremiumChapter.deterministicTakeaway`는 AI 없이도 항상
   * 존재해야 하는 자리라서, 여기서 undefined가 되면 화면에 빈 강조 박스가 남는다.
   * ⚠️ 조사를 하드코딩하지 않는다 — `연락야`·`애정 표현야`가 실측에서 실제로 나왔다.
   */
  if (!frame) {
    return `이번 연결에서 본 건 ${withCopula(subject)} — 따로 답한 자료 ${groupCount}종이 ${direction}.`;
  }
  return frame(subject, direction, groupCount);
}

/**
 * §12.2 본문 — **AI 없이도 존재하는 문단.** 규칙 문장을 그대로 잇는다.
 *
 * ⚠️ 두 Insight를 이으면 자연스럽게 두 문단이 된다(§12.2가 요구하는 형태). 분량을
 * 맞추려고 문장을 만들어 붙이지 않는다 — 근거가 하나면 한 문단으로 끝난다.
 */
function summaryFor(insights: readonly CrossSourceInsight[]): string {
  return insights.map((insight) => insight.ruleSummary).join('\n\n');
}

/* ─────────────────────────────────────────────────────────── 조립 */

interface ChapterDraft {
  kind: PremiumChapterKind;
  order: number;
  title: string;
  primary: CrossSourceInsight;
  members: CrossSourceInsight[];
}

/**
 * §8 — 이 Chapter가 **서로 독립적인 근거 2개 이상**을 이었는가.
 *
 * 기본은 source 그룹 2종이다. 예외가 하나 있고, 그건 완화가 아니라 **같은 규칙의
 * 정확한 적용**이다.
 *
 * ```
 * past_and_now  근거: history 기록 2건 (2026-06 · 2026-08)
 *               그룹: history 1종
 * ```
 *
 * 이 Chapter가 이은 것은 **서로 다른 시점에 저장된 두 관찰**이고, 그 둘은 실제로
 * 독립적이다 — 서로를 참조하지 않고 각각 그때의 답으로 만들어졌다. 그룹 표는 출처의
 * *종류*를 세는 도구라 같은 종류 안의 두 시점을 1로 접는데, 시점 비교 Chapter에서는
 * 바로 그 두 시점이 연결의 실체다. 그룹만 보고 자르면 **History가 2건 이상일 때만
 * 만들어지는 Chapter가 History 때문에 사라진다**(실측에서 실제로 그랬다).
 *
 * ⚠️ 완화 범위를 좁게 둔다 — `past_and_now`에서만, **서로 다른 기록 id가 2개 이상**일
 * 때만이다. 같은 기록을 두 번 인용한 것은 두 시점이 아니다.
 */
function hasIndependentEvidence(
  members: readonly CrossSourceInsight[],
  kind: PremiumChapterKind,
): boolean {
  if (groupsOf(members).length >= 2) return true;
  if (kind !== 'past_and_now') return false;

  const entryIds = new Set<string>();
  for (const member of members) {
    for (const ref of member.evidenceRefs) {
      if (ref.source === 'history') entryIds.add(ref.entryId);
    }
  }
  return entryIds.size >= 2;
}

/** 챕터 하나가 근거로 보여줄 목록 — 여러 Insight의 근거를 key로 dedupe한다 */
function evidenceOf(
  members: readonly CrossSourceInsight[],
  connectionById: Map<string, DeepConnection>,
): PremiumChapterEvidence[] {
  const seen = new Set<string>();
  const items: PremiumChapterEvidence[] = [];
  for (const member of members) {
    const connection = connectionById.get(member.id);
    if (!connection) continue;
    for (const item of connection.evidence) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      items.push({ key: item.key, sourceLabel: item.sourceLabel, text: item.text });
    }
  }
  return items;
}

/**
 * §11 — **AI 문장은 이 챕터의 Insight에서만 온다.**
 *
 * `buildConnections`가 이미 `narratives.find(n => n.insightId === insight.id)`로 묶어
 * 놓았으므로, 다른 챕터의 근거로 만든 문장이 여기 들어올 방법이 구조적으로 없다
 * (PREM-V2-09가 이것을 고정한다). 두 문단까지만 쓴다 — 셋을 넘기면 §12.2의
 * '짧은 두 문단'이 깨진다.
 */
function narrativeOf(
  members: readonly CrossSourceInsight[],
  connectionById: Map<string, DeepConnection>,
): string | null {
  const texts = members
    .map((member) => connectionById.get(member.id)?.narrativeText)
    .filter((text): text is string => Boolean(text))
    .slice(0, 2);
  return texts.length > 0 ? texts.join('\n\n') : null;
}

/**
 * 한 축이 여러 Chapter의 주인공이 되는 것을 막는다 (§10 '같은 axis만 4번 반복 금지').
 *
 * ⚠️ 실측에서 contact는 4개, conflict는 4개 유닛의 주제였다. 2로 제한하면 그 반복이
 * 사라지고, 잘린 Insight는 사라지는 게 아니라 이미 만들어진 그 축의 Chapter에
 * **근거로 합쳐진다.**
 */
/* ═══════════════════ Premium Eligibility (v1.45 PostReview §2-1-A) ═══════════

   > **Premium eligibility must NOT depend on Experience or Target availability.**

   ══ 무엇이 잘못돼 있었나 — 실측 ═══════════════════════════════════════════

   Paywall은 `deepReportAvailable: hasDeepConnection(insights)`로 열림/닫힘을 정했다.
   `hasDeepConnection`은 **서로 다른 source 2종**을 요구하는데, 그 조건은 관계 경험이나
   상대 정보가 없으면 통과할 방법이 없다. 4상태로 계측하면 이렇게 나왔다:

   ```
   C   Experience X + Target O  (declared 5축 · Target 4축 · MBTI 양쪽)  막혔다
   D2  Experience X + Target X  (declared 5축)                          막혔다
   ```

   두 사용자 모두 **쓸 수 있는 답을 충분히 냈다.** 막힌 이유는 데이터 부족이 아니라
   '관계 경험이 없다'였고, 그건 결과의 **내용 구성**을 바꿀 조건이지 **자격**을 막을
   조건이 아니다.

   ══ 그리고 자격 판정은 리포트 결과를 **맞게 예측해야 한다** ═══════════════

   같은 실측에서 반대 방향 결함도 나왔다:

   ```
   B  Experience O + Target X   hasDeepConnection=true  →  Paywall 열림
                                내용 Chapter 0개        →  팔린 리포트가 비어 있었다
   ```

   그 세션의 Insight 3개는 **전부 무료 Mirror와 같은 것**을 말해서 `isFreeDuplicate`가
   전부 걸러냈다. 걸러낸 것은 옳았고, 자격 판정이 그 사실을 몰랐다. 그래서 이 함수는
   **Chapter Engine과 같은 중복 필터를 통과한 Insight만** 센다 — 자격과 결과가 어긋나면
   사용자는 돈을 낸 뒤에 빈 리포트를 본다.

   ⚠️ 두 번째 항의 `mirror.insights.length === 0`은 Experience 유무 검사가 아니다 —
   **무료가 이미 그 축들을 보여줬는지**를 보는 중복 방지 조건이다(v1.26 기준). */

/**
 * Self-only 리포트를 만들 수 있는 최소 declared 축 수.
 *
 * ⚠️ 자격 판정(`hasPremiumEvidence`)과 Chapter 생성(`canBuildSelfOnly`)이 **같은 값**을
 * 봐야 한다. 두 곳에 따로 적으면 한쪽만 바뀌는 순간 '결제는 되는데 리포트는 비어 있는'
 * 상태가 다시 생긴다 — 이 버전에서 실제로 잡은 결함이 그것이다.
 */
export const PREMIUM_MIN_SELF_AXES = 3;

export function answeredDeclaredAxisCount(declared: DeclaredPreference): number {
  return [
    declared.contact,
    declared.conflict,
    declared.alone,
    declared.affection,
    declared.hobby,
  ].filter((value) => value !== null).length;
}

/**
 * Paywall·CTA가 쓰는 **유일한** Premium 자격 판정.
 *
 * ⚠️ `hasExperience`·`hasTarget` 같은 조건을 여기에 넣지 않는다. 넣는 순간 §2-1-A가
 * 깨지고, 그 위반은 화면 어디에서도 눈에 띄지 않는다 — 막힌 사용자는 애초에 리포트를
 * 못 보므로 QA에서 '내용이 이상하다'로도 잡히지 않는다.
 */
export function hasPremiumEvidence(input: {
  insights: readonly CrossSourceInsight[];
  declared: DeclaredPreference;
  mirror: MirrorReport;
}): boolean {
  const { insights, declared, mirror } = input;

  /** cross-source 경로 — Chapter Engine과 **같은 중복 필터**를 통과해야 센다 */
  const hasUsableConnection = insights.some(
    (insight) =>
      new Set(insight.sources).size >= 2 &&
      insight.evidenceRefs.length >= 2 &&
      !isFreeDuplicate(insight, mirror),
  );
  if (hasUsableConnection) return true;

  /** Self-only 경로 — cross-axis synthesis */
  return mirror.insights.length === 0 && answeredDeclaredAxisCount(declared) >= PREMIUM_MIN_SELF_AXES;
}

const MAX_CHAPTERS_PER_AXIS = 2;

export interface PremiumChapterInput {
  /** 이미 §6 우선순위로 정렬된 목록 */
  insights: readonly CrossSourceInsight[];
  /** `buildConnections` 결과 전부 — 근거 해석·경계 문장·AI 문장을 여기서 읽는다 */
  connections: readonly DeepConnection[];
  mirror: MirrorReport;
  compatibility: CompatibilityResult;
  historyReport: HistoryReport;
  actions: readonly DeepAction[];
  questions: readonly DeepConversationQuestion[];
  lovyObservation: DeepLovyObservation | null;
  tense: RelationshipTense;
  actionSectionTitle: string;
  /** `CONNECTION_QUESTION`으로 만든 축별 확인 질문. Job이 막으면 빈 객체다 */
  questionByAxis: Readonly<Partial<Record<MirrorAxisKey, string>>>;
  /**
   * v1.45 PostReview §2 — Self-only Chapter의 유일한 재료.
   *
   * ⚠️ 여기서 새 판정을 만들지 않는다. 사용자가 고른 답을 `declaredPhraseOf`로 문장화한
   * 것만 쓴다 — 그 함수는 무료 Mirror가 이미 쓰고 있는 것이고, 단계 경계도 그쪽에 있다.
   */
  declared: DeclaredPreference;
}

/* ══════════════════════════ Self-only Chapter (v1.45 PostReview §2) ══════════

   ⚠️ **왜 필요한가 — 실측이 먼저였다.**

   Premium eligibility를 4상태로 계측했더니 이렇게 나왔다:

   ```
   A  Experience O + Target O   gate=true   Chapter 6
   B  Experience O + Target X   gate=true   Chapter 2   ← 둘 다 파생. 내용 0
   C  Experience X + Target O   gate=false  Chapter 0   ← 데이터가 많은데 막혔다
   D  Experience X + Target X   gate=true   Chapter 3   (MBTI 있을 때만)
   D2 declared 5축만            gate=false  Chapter 0   ← 5축을 다 답했는데 막혔다
   ```

   C와 D2가 §2-1-A 위반이다. **Premium 자격이 Experience/Target 유무로 막혔다.**
   그 둘은 `hasDeepConnection`(= 서로 다른 source 2종)을 통과할 방법이 없는데, 그건
   '데이터가 부족하다'가 아니라 '관계 경험이 없다'는 뜻이었다.

   ══ 무엇을 파는가 ═══════════════════════════════════════════════════════════

   > Experience/Target이 있으면 **cross-source connection**
   > 없으면 **cross-axis self synthesis**

   둘 다 "흩어진 관찰을 연결해 한 단계 높은 구조를 보여준다"는 같은 약속이다(§2-4).

   ══ ⚠️ 절대 하지 않는 것 ════════════════════════════════════════════════════

   ⚠️ **경험한 것처럼 말하지 않는다**(§2-3). `너는 실제 관계에서 ~했다` ·
   `반복해서 ~했다` · `예전보다 ~해졌다`가 나올 방법이 없다 — 재료가 declared 답변과
   그 축 라벨뿐이고, 모든 문장이 `지금 답에서는` · `현재 기준만 보면`으로 시작한다.

   ⚠️ **무료가 이미 보여준 것을 다시 팔지 않는다.** 무료 Mirror가 그 축들을 이미
   행으로 보여준 세션(= `mirror.insights`가 비어 있지 않은 세션)에서는 이 Chapter를
   만들지 않는다. Self-only Chapter는 Mirror가 만들어지지 않은 세션의 자리다. */

/** Self-only Chapter를 만들 최소 축 수. 2개는 '조합'이라고 부르기 어렵다 */
const SELF_ONLY_MIN_AXES = PREMIUM_MIN_SELF_AXES;

/** 답이 있는 declared 축 — Self-only의 근거 목록이 된다 */
function answeredSelfAxes(declared: DeclaredPreference): {
  axis: MirrorAxisKey;
  label: string;
  phrase: string;
}[] {
  const rows: { axis: MirrorAxisKey; label: string; phrase: string }[] = [];
  for (const axis of MIRROR_AXES) {
    const phrase = declaredPhraseOf(axis.key, declared);
    if (!phrase) continue;
    rows.push({ axis: axis.key, label: axis.label, phrase });
  }
  return rows;
}

/**
 * 서로 당길 수 있는 기준 **조합** (§2-3 CH07).
 *
 * ⚠️ 이것은 진단이 아니다. 말하는 것은 하나뿐이다 — **두 답이 동시에 높다.**
 * 어느 쪽이 진짜인지, 왜 그런지, 무엇이 문제인지는 말하지 않는다. 그래서 규칙이
 * 전부 `declared` 값의 단순 비교이고, 여기서 나올 수 있는 문장은 조합 이름뿐이다.
 */
interface SelfTension {
  id: string;
  axes: MirrorAxisKey[];
  /** 두 답을 나란히 부르는 이름 */
  title: string;
}

/**
 * 축이 겹치지 않는 조합을 **우선순위 순서로** 최대 2개까지 찾는다.
 *
 * ⚠️ 호출부는 그중 **첫 번째만** Chapter로 만든다. 그럼 왜 2개를 찾는가 — 겹침 제거를
 * 여기서 하기 때문이다. 규칙 목록을 위에서부터 훑을 때 앞 조합과 축이 겹치는 것을
 * 걸러내야 '같은 축을 다시 말하지 않는' 조합이 첫 자리에 온다.
 */
function findSelfTensions(declared: DeclaredPreference): SelfTension[] {
  const { contact, alone, conflict, affection, hobby } = declared;
  const found: SelfTension[] = [];

  if (contact !== null && alone !== null && contact >= 4 && alone >= 4) {
    found.push({
      id: 'contact_alone',
      axes: ['contact', 'alone'],
      title: '자주 연결돼 있고 싶은 마음과 혼자 있는 시간',
    });
  }
  if (conflict === 'now' && alone !== null && alone >= 4) {
    found.push({
      id: 'conflict_alone',
      axes: ['conflict', 'alone'],
      title: '바로 이야기하고 싶은 방식과 혼자 정리하는 시간',
    });
  }
  if (contact !== null && contact >= 4 && conflict === 'space') {
    found.push({
      id: 'contact_conflict',
      axes: ['contact', 'conflict'],
      title: '자주 연락하고 싶은 마음과 갈등은 시간을 두고 싶은 방식',
    });
  }
  if (affection === 'a3' && contact !== null && contact <= 2) {
    found.push({
      id: 'affection_contact',
      axes: ['affection', 'contact'],
      title: '표현은 자주 하고 싶지만 연락 빈도는 덜 중요한 조합',
    });
  }
  if (alone !== null && alone >= 4 && hobby === 'h3') {
    found.push({
      id: 'alone_hobby',
      axes: ['alone', 'hobby'],
      title: '혼자 있는 시간과 거의 같이 하고 싶은 마음',
    });
  }
  if (affection === 'a1' && hobby === 'h3') {
    found.push({
      id: 'affection_hobby',
      axes: ['affection', 'hobby'],
      title: '담백한 표현과 거의 같이 하고 싶은 마음',
    });
  }

  /** 축이 겹치지 않는 것만 남긴다 — 같은 축을 두 Chapter에서 다시 말하지 않는다 */
  const used = new Set<MirrorAxisKey>();
  const disjoint: SelfTension[] = [];
  for (const tension of found) {
    if (tension.axes.some((axis) => used.has(axis))) continue;
    for (const axis of tension.axes) used.add(axis);
    disjoint.push(tension);
    /** 2개까지다 — 셋을 넘기면 '조합 목록'이 되고 각 Chapter의 무게가 사라진다 */
    if (disjoint.length === 2) break;
  }
  return disjoint;
}

/**
 * 파생 Chapter — **리포트가 팔 수 있는 '내용'으로 세지 않는다.**
 *
 * ⚠️ 이 구분이 v1.45 PostReview에서 잡힌 결함의 핵심이다. B 케이스(Experience O ·
 * Target X)는 `hasDeepConnection`을 통과해서 `available: true`가 됐는데, 실제로 만들어진
 * Chapter는 `uncertainty`와 `next_check` **둘뿐**이었다 — 즉 **팔린 리포트에 내용이
 * 하나도 없었다.** 그 셋은 앞 Chapter에서 파생되는 것이라 혼자서는 리포트가 되지 않는다.
 */
const DERIVED_KINDS: ReadonlySet<PremiumChapterKind> = new Set([
  'uncertainty',
  'next_check',
  'closing',
]);

export function isContentChapter(chapter: PremiumChapter): boolean {
  return !DERIVED_KINDS.has(chapter.kind);
}

export function buildPremiumChapters(input: PremiumChapterInput): PremiumChapter[] {
  const {
    insights,
    connections,
    mirror,
    compatibility,
    historyReport,
    actions,
    questions,
    lovyObservation,
    tense,
    actionSectionTitle,
    questionByAxis,
    declared,
  } = input;

  const context: BuildContext = {
    tense,
    compatibility,
    historyReport,
    mirror,
    actionSectionTitle,
  };

  const connectionById = new Map(connections.map((connection) => [connection.id, connection]));
  /** 한 Insight는 **한 Chapter의 주인공**까지다. 근거로는 여러 번 쓰일 수 있다 */
  const claimed = new Set<string>();
  const axisChapterCount = new Map<MirrorAxisKey, number>();
  const drafts: ChapterDraft[] = [];

  const canTakeAxis = (axis: MirrorAxisKey | undefined): boolean => {
    if (!axis) return true;
    return (axisChapterCount.get(axis) ?? 0) < MAX_CHAPTERS_PER_AXIS;
  };
  const takeAxis = (axis: MirrorAxisKey | undefined) => {
    if (!axis) return;
    axisChapterCount.set(axis, (axisChapterCount.get(axis) ?? 0) + 1);
  };

  /**
   * 이 Chapter의 **보조 근거**. 같은 축의 아직 주인공이 되지 않은 Insight 하나까지만
   * 끌어온다 — 그 이상은 본문이 길어지기만 하고 새 정보가 없다(§12.2).
   */
  const supportFor = (primary: CrossSourceInsight): CrossSourceInsight[] => {
    if (!primary.axis) return [];
    const support = insights.find(
      (item) =>
        item.id !== primary.id &&
        !claimed.has(item.id) &&
        item.axis === primary.axis &&
        item.type !== primary.type,
    );
    return support ? [support] : [];
  };

  for (const spec of CHAPTER_SPECS) {
    if (spec.kind === 'closeness_distance') {
      /**
       * 두 축 Chapter — contact와 alone을 **둘 다** 찾았을 때만 만든다.
       * 하나만 있으면 그건 단일 축 재설명이라 만들지 않는다(§7 CH03).
       */
      const contact = insights.find(
        (item) => !claimed.has(item.id) && item.axis === 'contact' && canTakeAxis('contact'),
      );
      const alone = insights.find(
        (item) => !claimed.has(item.id) && item.axis === 'alone' && canTakeAxis('alone'),
      );
      if (!contact || !alone) continue;
      if (isFreeDuplicate(contact, mirror) && isFreeDuplicate(alone, mirror)) continue;
      claimed.add(contact.id);
      claimed.add(alone.id);
      takeAxis('contact');
      takeAxis('alone');
      drafts.push({
        kind: spec.kind,
        order: spec.order,
        title: spec.title(context),
        primary: contact,
        members: [contact, alone],
      });
      continue;
    }

    const eligible = (item: CrossSourceInsight) =>
      !claimed.has(item.id) &&
      canTakeAxis(item.axis) &&
      spec.matches(item, context) &&
      !isFreeDuplicate(item, mirror);

    /**
     * **아직 쓰이지 않은 축을 먼저 고른다.**
     *
     * `MAX_CHAPTERS_PER_AXIS`는 상한이지 목표가 아니다. 상한만 두고 순위대로 집으면
     * 가장 강한 축이 앞 Chapter 두 개를 연달아 차지하고(실측: `연락 | 연락`) 리포트가
     * 한 축 이야기로 시작한다. 대안이 있으면 다른 축을 먼저 쓰고, 없을 때만 상한
     * 안에서 같은 축을 다시 쓴다 — **Chapter를 잃지 않으면서** 반복만 줄인다.
     *
     * ⚠️ 정렬을 새로 하지 않는다. 입력은 이미 `rankInsights` 순서이고 여기서는 그
     * 순서 안에서 한 번 훑을 뿐이라, 같은 조건이면 기존 우선순위가 그대로 남는다.
     */
    const primary =
      insights.find((item) => eligible(item) && !axisChapterCount.has(item.axis as MirrorAxisKey)) ??
      insights.find(eligible);
    if (!primary) continue;

    claimed.add(primary.id);
    takeAxis(primary.axis);
    const support = supportFor(primary);
    for (const item of support) claimed.add(item.id);

    const members = [primary, ...support];
    /**
     * §8 — Chapter는 **서로 독립적인 자료 2종 이상**을 이어야 한다. 주인공 하나로
     * 부족하면 보조 근거를 합쳐서라도 2종이 되어야 하고, 그래도 안 되면 만들지 않는다.
     */
    if (!hasIndependentEvidence(members, spec.kind)) {
      claimed.delete(primary.id);
      for (const item of support) claimed.delete(item.id);
      axisChapterCount.set(primary.axis!, (axisChapterCount.get(primary.axis!) ?? 1) - 1);
      continue;
    }

    drafts.push({
      kind: spec.kind,
      order: spec.order,
      title: spec.title(context),
      primary,
      members,
    });
  }

  /* ── CH07 UNCERTAINTY — 서비스가 모르는 것을 정직하게 (§7 CH07) ──────────
     ⚠️ 이 Chapter는 **연결이 아니라 부재**를 보여준다. §8이 요구하는 '독립 source 2개'를
     문자 그대로 적용하면 "근거가 없다는 것"을 근거 2개로 증명하라는 요구가 되어 성립하지
     않는다. 대신 같은 정신을 지킨다 — **서로 다른 종류의 불확실성이 2개 이상**일 때만
     만든다. 하나뿐이면 그건 리포트 하단 `limitations` 한 줄로 충분하다. */
  const uncertaintyFacts = buildUncertaintyFacts({ mirror, compatibility, historyReport, tense });

  /* ── 정렬 → index 부여 ─────────────────────────────────────────────── */
  const ordered = [...drafts].sort((a, b) => a.order - b.order);
  const chapters: PremiumChapter[] = [];
  const usedQuestionAxes = new Set<MirrorAxisKey>();

  const push = (chapter: Omit<PremiumChapter, 'index'>) => {
    chapters.push({ ...chapter, index: chapters.length + 1 });
  };

  const emitDraft = (draft: ChapterDraft) => {
    const connection = connectionById.get(draft.primary.id);
    const axes = [...new Set(draft.members.map((item) => item.axis).filter(Boolean))] as MirrorAxisKey[];
    const axesLabels = axes.map(axisLabel);
    const groups = groupsOf(draft.members);

    /** 축별 확인 질문은 **한 번만** 쓴다 — 같은 질문이 두 챕터에 나오면 목록이 된다 */
    const questionAxis = axes.find((axis) => questionByAxis[axis] && !usedQuestionAxes.has(axis));
    if (questionAxis) usedQuestionAxes.add(questionAxis);

    push({
      id: `ch_${draft.kind}`,
      kind: draft.kind,
      title: draft.title,
      eyebrow: axesLabels.length > 0 ? axesLabels.join(' · ') : '연결',
      insightIds: draft.members.map((item) => item.id),
      sourceGroups: groups,
      evidence: evidenceOf(draft.members, connectionById),
      deterministicSummary: summaryFor(draft.members),
      deterministicTakeaway: takeawayFor(draft.kind, draft.primary, axesLabels, groups.length),
      narrativeText: narrativeOf(draft.members, connectionById),
      question: questionAxis ? (questionByAxis[questionAxis] ?? null) : null,
      /** ⚠️ 경계 문장은 AI가 쓰지 않는다 — `buildConnections`가 만든 것을 그대로 쓴다 */
      limitation: connection?.limitation ?? '이건 네가 입력한 내용을 연결해 본 관찰이야. 진단이나 확정이 아니야.',
      audience: questionAxis ? 'outward' : 'self',
      noveltyKey: `${draft.kind}:${axes.sort().join(',')}:${[...groups].sort().join(',')}`,
    });
  };

  for (const draft of ordered) {
    // §10 순서: uncertainty(4) → next check(5) → history(6). draft.order 9가 history다.
    if (draft.order >= 9) continue;
    emitDraft(draft);
  }

  /* ══ Self-only Chapter (§2) — cross-source 내용이 없을 때만 ═══════════════

     ⚠️ **cross-source Chapter를 대체하지 않는다.** 위 루프가 내용 Chapter를 하나라도
     만들었으면 여기는 아무것도 하지 않는다 — 관계 근거가 있는 사용자에게 '지금 답만
     보면' 문장을 덧붙이면 더 약한 근거로 같은 축을 두 번 말하는 셈이다.

     ⚠️ **무료 Mirror가 이미 그 축들을 보여준 세션에서는 만들지 않는다.**
     `mirror.insights`가 비어 있지 않으면 무료 화면이 이미 `말한 나`를 축별로 보여줬고,
     여기서 declared를 다시 모으는 것은 무료 문장의 재판매다(v1.26이 두 섹션을 삭제한
     기준 그대로). 그래서 이 자리는 **Mirror가 만들어지지 않은 세션**의 자리다. */
  const selfAxes = answeredSelfAxes(declared);
  const canBuildSelfOnly =
    drafts.length === 0 && mirror.insights.length === 0 && selfAxes.length >= SELF_ONLY_MIN_AXES;

  if (canBuildSelfOnly) {
    /* CH — 내가 관계에서 중요하다고 말한 것 */
    push({
      id: 'ch_self_profile',
      kind: 'self_profile',
      title: '내가 관계에서 중요하다고 말한 것',
      eyebrow: selfAxes.map((row) => row.label).join(' · '),
      /** ⚠️ Insight에서 온 것이 아니다 — AI 문장이 붙을 자리가 없다 */
      insightIds: [],
      sourceGroups: ['declared_me'],
      evidence: selfAxes.map((row) => ({
        key: `declared:${row.axis}`,
        sourceLabel: '내가 답한 내용',
        text: row.phrase,
      })),
      deterministicSummary: `지금 답에서는 ${selfAxes
        .map((row) => row.label)
        .join(' · ')} ${selfAxes.length}가지를 기준으로 보고 있어. 따로 물어본 항목이라 하나씩 보면 취향처럼 보이는데, 같이 놓으면 네가 관계에서 무엇을 먼저 보는지가 드러나.\n\n아직 관계에서 확인된 기준은 아니야. 실제로 겪어보면 순서가 달라질 수도 있어서, 여기서는 가설로만 남겨둘게.`,
      deterministicTakeaway: `현재 기준만 보면 ${withObjectParticle(
        selfAxes[0]!.label,
      )} 가장 앞에 두고 있어 — 답한 기준 ${selfAxes.length}개를 한 자리에 모은 결과야.`,
      narrativeText: null,
      question: null,
      limitation:
        '이건 지금 답한 기준을 모은 것까지야. 실제 관계에서 어떻게 나타나는지는 아직 확인되지 않았어.',
      audience: 'self',
      noveltyKey: `self_profile:${selfAxes.map((row) => row.axis).sort().join(',')}`,
    });

    /* CH — 같이 놓으면 서로 당길 수 있는 기준 조합
       ⚠️ **한 개만 만든다.** 축이 겹치지 않는 조합을 최대 2개까지 찾아두지만(아래
       `findSelfTensions`), 화면에 올리는 것은 첫 번째뿐이다. 두 개를 만들어봤더니 두
       문제가 같이 생겼다: ① 제목이 `한 번 더 —`로 시작해서 **분량 채우기로 읽힌다**
       ② 같은 `kind`라 러비 포즈가 같고 두 Chapter가 **연달아** 놓여서 인접 중복이 된다.
       조합을 더 보여주는 것보다 **하나를 제대로 보여주는 것**이 이 리포트의 방식이다. */
    const [tension] = findSelfTensions(declared);
    if (tension) {
      const rows = selfAxes.filter((row) => tension.axes.includes(row.axis));
      push({
        id: 'ch_self_tension',
        kind: 'self_tension',
        title: '같이 놓으면 서로 당길 수 있는 기준',
        eyebrow: rows.map((row) => row.label).join(' · '),
        insightIds: [],
        sourceGroups: ['declared_me'],
        evidence: rows.map((row) => ({
          key: `declared:${row.axis}`,
          sourceLabel: '내가 답한 내용',
          text: row.phrase,
        })),
        deterministicSummary: `${tension.title} — 둘 다 중요하다고 답했어. 각각은 자연스러운 기준인데, 같은 상황에서 동시에 지키려고 하면 서로 당길 수 있는 조합이야.\n\n어느 쪽이 진짜인지는 정하지 않아. 여기서 말할 수 있는 건 두 답이 같이 높다는 것까지야.`,
        deterministicTakeaway: `현재 기준만 보면 ${tension.title}을 동시에 중요하게 보고 있어 — 그래서 둘이 부딪히는 상황이 먼저 눈에 띌 수 있어.`,
        narrativeText: null,
        question: null,
        limitation:
          '두 답이 같이 높다는 것까지야. 실제로 어느 쪽을 먼저 지키는지는 관계에서 겪어봐야 알 수 있어.',
        audience: 'self',
        noveltyKey: `self_tension:${tension.id}`,
      });
    }
  }

  /* CH07 — uncertainty */
  if (uncertaintyFacts.length >= 2) {
    push({
      id: 'ch_uncertainty',
      kind: 'uncertainty',
      title: '아직 확신하면 안 되는 지점',
      eyebrow: '확인되지 않은 것',
      insightIds: [],
      sourceGroups: [],
      evidence: uncertaintyFacts.map((fact) => ({
        key: fact.id,
        sourceLabel: fact.sourceLabel,
        text: fact.text,
      })),
      deterministicSummary:
        '이번 관찰에서 근거가 비어 있던 자리야. 여기에 대해서는 러비도 결론을 내리지 않을게 — 없는 걸 있다고 말하는 것보다 여기서 멈추는 쪽이 정확해.',
      deterministicTakeaway: `이건 아직 결론 내리면 안 돼 — 근거가 ${uncertaintyFacts.length}군데에서 비어 있어.`,
      narrativeText: null,
      question: null,
      limitation: '비어 있는 자리를 근거로 무언가를 추정하지 않아. 답이 더 쌓이면 그때 볼 수 있어.',
      audience: 'self',
      noveltyKey: `uncertainty:${uncertaintyFacts.map((fact) => fact.id).sort().join(',')}`,
    });
  }

  /* CH08 — next check. 앞 Chapter에서 파생되므로 raw source 2개를 직접 요구하지 않는다(§8) */

  /**
   * ⚠️ **이미 어떤 Chapter가 붙인 질문을 여기서 다시 보여주지 않는다.**
   *
   * §27 Copy Quality Audit 실측에서 잡혔다 — `연락이 줄었을 때, 너한테는 …`이 한 리포트에
   * **두 번** 나왔다. 한 번은 그 축 Chapter의 `확인해볼 것`이고, 한 번은 이 Chapter의
   * 목록이었다. 같은 역할의 문장을 두 번 보여주는 것은 v1.26이 두 섹션을 삭제하면서
   * 세운 기준을 그대로 어기는 것이다(§22).
   *
   * ⚠️ **버리는 것이 아니라 한 자리로 모은다.** 어느 Chapter에도 붙지 못한 질문
   * (그 축이 Chapter의 주제가 되지 않은 경우)은 여기 남는다 — 질문 자체가 사라지면
   * `buildConnectionQuestions`가 만든 것이 화면에 닿지 않는다.
   */
  const leftoverQuestions = questions.filter((item) => {
    const axis = item.question.id.startsWith('conn_')
      ? (item.question.id.slice('conn_'.length) as MirrorAxisKey)
      : null;
    return axis === null || !usedQuestionAxes.has(axis);
  });

  if (chapters.length > 0 && (actions.length > 0 || leftoverQuestions.length > 0)) {
    push({
      id: 'ch_next_check',
      kind: 'next_check',
      /** ⚠️ 제목을 새로 만들지 않는다 — 무료 화면과 같은 Job별 문구를 쓴다(v1.40.1) */
      title: actionSectionTitle,
      eyebrow: '앞의 연결에서 이어지는 것',
      insightIds: [],
      sourceGroups: [],
      evidence: [
        ...actions.map((action) => ({
          key: `action:${action.kind}`,
          sourceLabel: action.kind,
          text: action.text,
        })),
        ...leftoverQuestions.map((item) => ({
          key: `question:${item.question.id}`,
          sourceLabel: item.question.tag,
          text: item.question.text,
        })),
      ],
      /**
       * ⚠️ 행동·질문 원문을 여기 다시 쓰지 않는다 — 그 목록은 `evidence`가 들고 있고
       * 화면이 구조화해서 그린다. 본문에 또 붙이면 같은 문장이 한 챕터에 두 번 나온다.
       */
      deterministicSummary:
        '아래는 위에서 확인한 연결에서 그대로 이어지는 것들이야. 새로 해석한 건 없어.',
      deterministicTakeaway: `여기서 확인해볼 건 ${actions.length + leftoverQuestions.length}가지야 — 전부 위 연결에서 나온 것들이야.`,
      narrativeText: null,
      question: null,
      limitation:
        '이건 제안이지 처방이 아니야. 해봐야 하는 것이 아니라, 확인해보면 알 수 있는 것들이야.',
      /** ⚠️ 한 줄이라도 상대를 향하면 이 Chapter는 outward다 — 문장을 읽어서 세지 않는다 */
      audience:
        actions.some((action) => action.audience === 'outward') || leftoverQuestions.length > 0
          ? 'outward'
          : 'self',
      noveltyKey: 'next_check',
    });
  }

  /* CH09 — past and now (§10에서 next check 뒤) */
  for (const draft of ordered) {
    if (draft.order < 9) continue;
    emitDraft(draft);
  }

  /* CH10 — closing. 앞에서 이미 선택된 Chapter를 압축한다. 새 근거·새 해석 없음 */
  /**
   * ⚠️ **근거를 가진 Chapter만 센다.** `next_check`는 앞 Chapter에서 파생된 것이라
   * '이어붙인 이야기'로 다시 세면 같은 것을 두 번 세는 셈이다.
   */
  /**
   * ⚠️ v1.45 PostReview — `insightIds.length > 0`이 아니라 `isContentChapter`를 쓴다.
   * Self-only Chapter는 Insight에서 온 것이 아니라 `insightIds`가 비어 있는데, 그건
   * 파생 Chapter라는 뜻이 아니라 **재료가 declared 답변이라는 뜻**이다. 예전 판정을
   * 그대로 두면 Self-only 리포트에 마무리가 생기지 않는다.
   */
  const contentChapters = chapters.filter(isContentChapter);
  if (contentChapters.length >= 2 && lovyObservation) {
    const titles = contentChapters.map((chapter) => chapter.title);
    const widest = contentChapters.reduce((best, item) =>
      item.sourceGroups.length > best.sourceGroups.length ? item : best,
    );
    push({
      id: 'ch_closing',
      kind: 'closing',
      title: '러비가 이번 관찰에서 기억할 한 문장',
      eyebrow: '마무리',
      insightIds: [],
      sourceGroups: [],
      evidence: [],
      /**
       * §23 — **Closing은 이번 관찰을 기억하는 자리다.**
       *
       * ⚠️ 마지막 문단은 강조 문장(`deterministicTakeaway`)이 **어떤 성격의 문장인지**
       * 미리 못박아 둔다. 그 문장은 `lovyObservation.question`이라 읽는 사람이
       * '리포트의 결론'으로 받아들일 위험이 있는데, 실제로는 가장 여러 자료가 모인
       * 자리를 적어둔 것이다 — 그 차이를 화면이 말하지 않으면 리포트가 정답을 내놓은
       * 것처럼 읽힌다.
       *
       * ⚠️ 마지막 한 줄(`다음 관찰이 쌓이면 …`)은 **기록이 이미 있을 때만** 붙인다.
       * 이 앱이 관찰을 저장한다는 사실에 대한 문장이라 미래 예측이 아니지만, 저장된
       * 기록이 하나도 없는 사용자에게는 아직 겪지 않은 기능을 약속하는 문장이 된다.
       */
      deterministicSummary: [
        `이번 관찰에서 이어붙인 이야기는 ${titles.length}개야 — ${titles.join(' · ')}. 그중 가장 여러 자료가 모인 자리는 '${widest.title}'이었어.`,
        lovyObservation.observation,
        `아래 한 문장은 정답이 아니야. 이번 관찰에서 가장 강하게 연결된 신호를 그대로 적어둔 거야.${
          historyReport.entryCount > 0
            ? ' 다음 관찰이 쌓이면 이 문장이 그대로인지도 같이 볼게.'
            : ''
        }`,
      ].join('\n\n'),
      deterministicTakeaway: lovyObservation.question,
      narrativeText: null,
      question: null,
      limitation: '여기서 새로 판단한 건 없어. 위에서 이미 확인한 것들을 모아둔 것뿐이야.',
      audience: 'self',
      noveltyKey: 'closing',
    });
  }

  return chapters;
}

/* ───────────────────────────────────────────── Uncertainty 재료 (§7 CH07) */

interface UncertaintyFact {
  id: string;
  sourceLabel: string;
  text: string;
}

/**
 * **모른다는 사실도 결정론이다.** 여기서 문장을 지어내지 않고, 이미 계산된 값
 * (판정되지 않은 축 수 · 비교하지 못한 항목 · 기록 수)을 그대로 읽어 적는다.
 */
function buildUncertaintyFacts(input: {
  mirror: MirrorReport;
  compatibility: CompatibilityResult;
  historyReport: HistoryReport;
  tense: RelationshipTense;
}): UncertaintyFact[] {
  const { mirror, compatibility, historyReport, tense } = input;
  const facts: UncertaintyFact[] = [];

  const undecided = mirror.available ? mirror.totalAxisCount - mirror.insights.length : 0;
  if (undecided > 0) {
    facts.push({
      id: 'unknown_axes',
      sourceLabel: '판정하지 못한 축',
      text: `${undecided}개 축은 근거가 없어서 판정하지 않았어. 비워둔 거지 '해당 없음'이 아니야.`,
    });
  }

  if (compatibility.unknownLabels.length > 0) {
    facts.push({
      id: 'unknown_target',
      sourceLabel: '상대에 대해 모르는 것',
      text: `${compatibility.unknownLabels.join(' · ')}은 '모름'으로 남아서 비교하지 않았어.`,
    });
  }

  if (compatibility.score !== null && compatibility.confidence === 'low') {
    facts.push({
      id: 'low_confidence',
      sourceLabel: '근거의 양',
      text: '비교한 항목이 적어서 이 축들에 대한 해석의 폭이 좁아.',
    });
  }

  if (!historyReport.comparable) {
    facts.push({
      id: 'no_temporal',
      sourceLabel: '시점 비교',
      text: `저장된 관찰이 2개 미만이라 ${tense === 'former' ? '그때와 지금을' : '과거와 지금을'} 비교하는 건 이번엔 하지 않았어.`,
    });
  }

  /**
   * ⚠️ **한쪽만 아는 상대 정보**(§7 CH07 'one-sided target evidence'). 상대 축을
   * 절반 이상 모르면 이 리포트의 상대 관련 문장은 전부 그 절반 위에 서 있다.
   */
  if (compatibility.totalCount > 0 && compatibility.comparedCount * 2 < compatibility.totalCount) {
    facts.push({
      id: 'one_sided_target',
      sourceLabel: '상대 정보',
      text: `상대 축 ${compatibility.totalCount}개 중 ${compatibility.comparedCount}개만 비교했어. 상대가 실제로 어떻게 느끼는지는 여기 없어.`,
    });
  }

  return facts;
}

/* ───────────────────────────────────────── 이번에 만들지 않은 것 (§14.1) */

/**
 * ⚠️ **locked teaser가 아니다.** 돈을 더 내면 열리는 것이 아니라 **데이터가 쌓이면**
 * 열리는 것이고, 그래서 문장이 전부 '무엇이 더 있으면'으로 시작한다.
 * ⚠️ Chapter 수에 포함하지 않는다 — 헤더의 N은 실제 렌더된 Chapter 수다.
 */
export function buildOmissions(input: {
  chapters: readonly PremiumChapter[];
  mirror: MirrorReport;
  compatibility: CompatibilityResult;
  historyReport: HistoryReport;
  hasCurrentEvidence: boolean;
}): PremiumOmission[] {
  const { chapters, compatibility, historyReport, hasCurrentEvidence } = input;
  const kinds = new Set(chapters.map((chapter) => chapter.kind));
  const omissions: PremiumOmission[] = [];

  if (!kinds.has('past_and_now')) {
    omissions.push(
      historyReport.comparable
        ? {
            id: 'temporal_no_shift',
            text: '저장된 관찰끼리 비교했는데 방향이 달라진 축이 없었어. 기록이 한 번 더 쌓이면 다시 볼게.',
          }
        : {
            id: 'temporal',
            text: '관찰 기록이 한 번 더 쌓이면, 기준이 실제로 움직였는지 볼 수 있어.',
          },
    );
  }

  if (!hasCurrentEvidence) {
    omissions.push({
      id: 'current',
      text: '지금 관계에 대한 답이 쌓이면, 이전의 나와 지금의 나를 나란히 놓고 볼 수 있어.',
    });
  }

  if (!kinds.has('tune_with_target') && compatibility.score === null) {
    omissions.push({
      id: 'target',
      text: '상대에 대해 아는 것을 조금 더 채우면, 네 기준과 상대 쪽을 이어서 볼 수 있어.',
    });
  }

  return omissions;
}
