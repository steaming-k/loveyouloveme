import { evidenceRefKey } from '@/lib/aiEvidenceResolver';
import type {
  EvidenceRef,
  MirrorAxisKey,
  MirrorInsight,
  RelationshipExperience,
  TargetAxisKey,
  ValidatedObservation,
} from '@/types';

/**
 * Axis-scoped Evidence Contract — **AI가 인용할 수 있는 근거의 결정론적 상한** (v1.43 · §46)
 *
 * ══ 왜 Task 전체 허용집합으로는 불충분한가 ════════════════════════════════
 *
 * v1.27이 deep-report에 세운 `AI_OUTPUT ⊆ DETERMINISTIC_EVIDENCE`는 **Insight별**로
 * 검사한다(`evidenceRefsAreSubsetOf(item.evidenceRefs, evidenceByInsight.get(id))`).
 * 그게 정확한 단위다 — 근거 귀속의 단위는 Task가 아니라 항목이다.
 *
 * relationship·compatibility에는 그 검사가 아예 없었고, 만약 Task 전체 집합으로만
 * 검사했다면 이런 것이 통과한다:
 *
 * ```
 * narratives[0] = { axis: 'contact', evidenceRefs: [{source:'relationship', field:'hardest'}] }
 *
 * 사용자의 hardest = value_gap (기준 차이)
 * HARDEST_TO_AXIS[value_gap] = undefined   → 결정론 엔진은 이 ref를 만들지 않는다
 * resolveRelationship('hardest')            → '기준 차이가 가장 힘들었음'  (정상 문장!)
 *
 * 화면: 연락 축 설명 아래에 '기준 차이가 가장 힘들었음'이 근거로 붙는다
 * ```
 *
 * **판정층이 의도적으로 거부한 귀속을 AI가 우회한 것**이다. v1.40.1·v1.41이 두 번
 * `value_gap`을 매핑하지 않기로 확정한 이유(돈·미래를 갈등 해결 근거로 바꿔 쓰지 않는다)가
 * AI 경로에서만 무효였다.
 *
 * ══ 이 파일의 규칙 ═══════════════════════════════════════════════════════
 *
 * ```
 * 여기서 새 ref를 만들지 않는다.
 * 이미 결정론 엔진이 만들 수 있는 ref만 모아서 축별로 묶는다.
 * ```
 *
 * ⚠️ 그래서 `relationshipRefFor`가 **이 파일로 옮겨왔다.** `crossSourceInsights.ts`에
 * private으로 있으면 같은 판정이 두 벌이 되고, 두 벌이 갈리는 순간 Premium 연결이 만드는
 * ref와 AI에게 허용하는 ref가 서로 다른 집합이 된다. `crossSourceInsights.ts`는 이제 이
 * 함수를 import한다 — 판정 source는 하나다(v1.42 §40.10과 같은 규칙).
 *
 * ⚠️ **관대한 기본값을 두지 않는다.** 어떤 축에 근거가 하나도 없으면 빈 집합이고, 그
 * 축의 AI 근거는 전부 거부된다. 그 축의 narrative는 `uncertainty`가 있으면 살아남고
 * 없으면 버려진다 — 결정론 Mirror 행은 그대로 남는다(§46.5 overfilter fallback).
 */

/* ─────────────────────────────────────────── relationship (Mirror axis) */

/**
 * 이 axis의 `relationshipSignal`이 실제로 **어디서** 나왔는지.
 *
 * ⚠️ 'hardest'를 모든 축에 고정으로 붙이면 안 된다 — 예를 들어 갈등 해결 축의 MATCH가
 * '연락 감소가 가장 힘들었음'을 근거로 보여주는 것처럼 틀린 근거가 붙는다. 'absent'(=CHANGE)는
 * 애초에 관계 경험 근거가 없다는 뜻이라 evidenceRef를 만들지 않는다 — 근거를 지어내지 않는다.
 *
 * ══ v1.41 §39.8 — **scope를 먼저 본다** ═══════════════════════════════════
 *
 * v1.40까지 이 함수는 강도만 보고 `{source:'relationship'}`(과거 경험)을 만들었다.
 * 근거가 현재 관계에서 온 축에 그 ref를 붙이면 resolver가 `이전 관계에서 …` 문장을
 * 돌려준다 — **근거를 지목하는 자리에서 시점을 거짓으로 만드는 것**이다. 시제 문제가
 * 카피가 아니라 데이터 문제인 지점이 정확히 여기다.
 *
 * ⚠️ `absent + current`는 **ref를 만든다.** `지금 관계에서는 거의 드러나지 않아`는
 * 사용자가 실제로 고른 답이고, 그건 근거의 부재가 아니라 **부재의 근거**다.
 * `absent + none`(아무 답도 없음)만 null이다.
 *
 * ⚠️ v1.43 — `crossSourceInsights.ts`에서 **이 파일로 옮겼다.** 한 글자도 바꾸지 않았고,
 * 그 파일이 이제 여기서 import한다. 옮긴 이유는 파일 상단 참고(판정 source 단일화).
 */
export function relationshipRefFor(insight: MirrorInsight): EvidenceRef | null {
  if (insight.evidenceScope === 'current') {
    return { source: 'current_relationship', field: insight.key };
  }
  if (insight.evidenceScope === 'none') return null;
  if (insight.evidenceStrength === 'hardest') return { source: 'relationship', field: 'hardest' };
  if (insight.evidenceStrength === 'important') return { source: 'relationship', field: 'important' };
  return null;
}

/**
 * Mirror 축 하나에 대해 **AI가 인용할 수 있는 근거 전부.**
 *
 * | ref | 왜 이 축에서 허용되나 |
 * |---|---|
 * | `declared:<axis>` | `ruleJudgements[].declaredPhrase`가 그 축의 답을 실어 보낸다 |
 * | `relationshipRefFor(insight)` | 그 축의 `relationshipSignal`을 만든 근거 자체 |
 * | `adaptive:<axis>` | 추가 질문은 **한 축에만** 붙는다(`experience.adaptive.axis`) |
 * | `observed:<traitId>` | 사진 관찰은 축에 묶이지 않는 **보조 맥락**이다 — 아래 참고 |
 * | `history:<entryId>:<axis>` | 요청에 실제로 실어 보낸 과거 관찰만 |
 *
 * ⚠️ **observed는 축으로 제한하지 않는다.** 사진 관찰에는 축 정보가 없다 — `ObservedTrait`은
 * `{id, text, confidence, evidence}`뿐이고 Mirror 축과 매핑되는 필드가 없다. 축을 억지로
 * 부여하면 우리가 갖고 있지 않은 정보를 만들어내는 것이고, 그건 이 제품이 v1.0부터
 * 거부해 온 방식이다(`talk`/`rhythm` 축을 제거한 이유와 같다). 대신 프롬프트가 이미
 * '관련 없는 관찰을 억지로 끌어오지 않는다'는 **의미 규칙**으로 다루고, 그건 축 계약이
 * 아니라 문장 품질의 문제다.
 *
 * ⚠️ `excluded` 관찰은 애초에 요청에 들어가지 않는다(`analysisReadyObservations`).
 * 여기서도 제외한다 — 두 곳이 갈리면 AI가 못 본 관찰을 인용해도 통과한다.
 */
export function allowedRelationshipRefs(input: {
  insight: MirrorInsight;
  experience: RelationshipExperience;
  validated: readonly ValidatedObservation[];
  pastObservations: readonly { axis: string; entryId: string }[];
}): EvidenceRef[] {
  const { insight, experience, validated, pastObservations } = input;
  const refs: EvidenceRef[] = [{ source: 'declared', field: insight.key }];

  const relationshipRef = relationshipRefFor(insight);
  if (relationshipRef) refs.push(relationshipRef);

  if (experience.adaptive?.axis === insight.key) {
    refs.push({ source: 'adaptive', field: insight.key });
  }

  for (const item of validated) {
    if (item.status === 'excluded') continue;
    refs.push({ source: 'observed', traitId: item.original.id });
  }

  for (const past of pastObservations) {
    if (past.axis !== insight.key) continue;
    refs.push({ source: 'history', entryId: past.entryId, axis: past.axis });
  }

  return refs;
}

/** 축 → 허용 ref 목록. 요청에 그대로 실어 보내고 서버가 이 표로 검사한다 */
export function allowedRelationshipRefsByAxis(input: {
  insights: readonly MirrorInsight[];
  experience: RelationshipExperience;
  validated: readonly ValidatedObservation[];
  pastObservations?: readonly { axis: string; entryId: string }[];
}): Record<string, EvidenceRef[]> {
  const { insights, experience, validated, pastObservations = [] } = input;
  const table: Record<string, EvidenceRef[]> = {};

  for (const insight of insights) {
    table[insight.key] = allowedRelationshipRefs({
      insight,
      experience,
      validated,
      pastObservations,
    });
  }

  return table;
}

/* ─────────────────────────────────── compatibility (dimension) */

/**
 * Compatibility dimension 하나에 대해 AI가 인용할 수 있는 근거.
 *
 * | ref | 왜 |
 * |---|---|
 * | `compatibility:<key>` | v1.30이 context에 실어 보내는 canonical ref. 모델이 복사한다 |
 * | `declared:<key>` | 그 dimension의 `minePhrase`가 이 답에서 나온다 |
 * | `target:<key>` | 그 dimension의 `theirsPhrase`가 이 입력에서 나온다 |
 *
 * ⚠️ **세 개가 전부 같은 축이다.** 이 집합이 막는 것은 '연락 dimension 설명이 갈등 해결
 * 근거를 인용하는 것'이고, 같은 축의 세 출처를 좁힐 이유는 없다 — 화면의 `SignalCard`가
 * 이미 `나: … · 상대: …`로 그 세 값을 나란히 보여주고 있다.
 *
 * ⚠️ **`mbti_lens`는 넣지 않는다.** MBTI는 동기화율과 완전히 분리된 Supporting Lens이고
 * (v1.2에서 5번째 축으로 넣었다가 철회했다) 이 Task의 입력에도 없다 — 프롬프트가
 * `MBTI·별자리·사주는 이 작업의 입력에 없다`고 명시한다.
 */
export function allowedCompatibilityRefs(key: TargetAxisKey): EvidenceRef[] {
  return [
    { source: 'compatibility', field: key },
    { source: 'declared', field: key },
    { source: 'target', field: key },
  ];
}

export function allowedCompatibilityRefsByDimension(
  keys: readonly TargetAxisKey[],
): Record<string, EvidenceRef[]> {
  const table: Record<string, EvidenceRef[]> = {};
  for (const key of keys) table[key] = allowedCompatibilityRefs(key);
  return table;
}

/* ─────────────────────────────────────────────── history (axis) */

/**
 * History 변화 축 하나에 대해 AI가 인용할 수 있는 근거. (v1.43 · §46.4)
 *
 * ══ 왜 `relationship`(과거 경험)이 없는가 ═════════════════════════════════
 *
 * v1.42까지 history 프롬프트의 enum은 `declared|relationship|history`였다. 그런데 이
 * Task가 설명하는 것은 **두 기록 사이의 변화**다. S15~S17의 답(`important`·`hardest`·
 * `selfGap`)은 두 기록 사이에서 달라지지 않은 값이므로 **변화의 근거가 될 수 없다** —
 * 그 자리에 그 ref를 붙이면 '변하지 않은 것으로 변화를 설명'하는 문장이 된다.
 *
 * 그래서 남는 것은 두 개다.
 *
 * | ref | 왜 |
 * |---|---|
 * | `history:<entryId>:<axis>` | 비교한 **그 기록**. 변화의 양쪽 끝이다 |
 * | `declared:<axis>` | `declaredDelta`(4/5 → 2/5)가 이 답에서 나온다 |
 *
 * ⚠️ **v1.42까지 `history` ref는 모델이 구성조차 할 수 없었다.** `parseEvidenceRef`가
 * `{entryId, axis}`를 요구하는데 `buildHistoryContext`는 `entryId`를 보내지 않았다 —
 * `{axis,label,state,previousText,currentText,declaredDelta}`뿐이었다. 그래서 모델이
 * `history`를 고르면 그 ref는 항상 null로 떨어지고, 실측에서 history AI narrative의
 * 근거는 **0개**였다(v1.43 §44 BEFORE). §45.3에서 context에 두 entryId를 실어 보내
 * 이 계약을 성립시켰다.
 */
export function allowedHistoryRefs(input: {
  axis: MirrorAxisKey;
  previousEntryId: string;
  currentEntryId: string;
}): EvidenceRef[] {
  const { axis, previousEntryId, currentEntryId } = input;
  return [
    { source: 'history', entryId: previousEntryId, axis },
    { source: 'history', entryId: currentEntryId, axis },
    { source: 'declared', field: axis },
  ];
}

export function allowedHistoryRefsByAxis(input: {
  axes: readonly MirrorAxisKey[];
  previousEntryId: string;
  currentEntryId: string;
}): Record<string, EvidenceRef[]> {
  const { axes, previousEntryId, currentEntryId } = input;
  const table: Record<string, EvidenceRef[]> = {};
  for (const axis of axes) {
    table[axis] = allowedHistoryRefs({ axis, previousEntryId, currentEntryId });
  }
  return table;
}

/* ──────────────────────────────────────────────────── 대조 (공용) */

/**
 * 항목의 근거가 그 항목의 허용집합 안에 있는가.
 *
 * ⚠️ **하나라도 밖이면 항목 전체를 거부한다.** 부분 통과시키지 않는 이유는 v1.27이
 * deep-report에서 정한 것과 같다 — 나쁜 ref만 지우면 **그 ref를 근거로 쓴 설명 문장이
 * 남는다.** 사용자에게는 근거 없이 money/future를 말하는 문장이 되고, 그게 근거를 지운
 * 것보다 나쁘다.
 *
 * ⚠️ **근거가 0개인 것은 이 함수가 판정하지 않는다.** 파서가 이미
 * `evidenceRefs.length === 0 && !uncertainty`를 거른다(§91). 여기서 빈 배열은
 * `every`가 true라 통과하고, 그게 맞다 — 인용하지 않은 것을 오귀속이라고 부를 수 없다.
 */
export function refsWithinAllowed(
  refs: readonly EvidenceRef[],
  allowed: readonly EvidenceRef[],
): boolean {
  const set = new Set(allowed.map(evidenceRefKey));
  return refs.every((ref) => set.has(evidenceRefKey(ref)));
}

/** 허용집합 밖으로 떨어진 ref의 **source 이름만** — dev 로그용(§44 Privacy) */
export function rejectedRefSources(
  refs: readonly EvidenceRef[],
  allowed: readonly EvidenceRef[],
): string[] {
  const set = new Set(allowed.map(evidenceRefKey));
  return refs.filter((ref) => !set.has(evidenceRefKey(ref))).map((ref) => ref.source);
}
