import {
  DECLARED_PHRASE_BY_LEVEL,
  MIRROR_AXES,
  MIRROR_NOTE,
} from '@/data/axes';
import { adaptiveOptionLabel } from '@/data/adaptive';
import { selfLevelOf } from './firstContact';
import { withObjectParticle } from '@/lib/korean';
import type {
  CoreInsight,
  CurrentRelationshipEvidence,
  DeclaredPreference,
  EvidenceItem,
  EvidenceStrength,
  MirrorAxisKey,
  MirrorInsight,
  MirrorReport,
  MirrorState,
  MirrorTeaser,
  RelationshipEvidenceScope,
  RelationshipExperience,
} from '@/types';
import {
  hasCurrentEvidence,
  NO_CURRENT_RELATIONSHIP,
  relationshipSignalTextOf,
  resolveAxisEvidence,
  summarizeScopes,
  type RelationshipTense,
} from './relationshipEvidence';
import { DECLARED_HAS_NATIVE_SCALE, toDeclaredMirrorValues } from './values';

export { HARDEST_TO_AXIS } from './mirrorAxisMap';

/**
 * Relationship Mirror — Declared Me vs Relationship Me
 *
 * ⚠️ Prototype Demo Logic
 * MATCH / GAP / CHANGE는 두 숫자를 빼서 나온 값이 아니다. Relationship Me는
 * 1~5 척도로 직접 수집된 적이 없으므로(과거 관계 질문은 선택형이다), 여기서 가짜 숫자를
 * 만들지 않는다. 대신 '이 축에 대한 관계 경험 근거가 있는가'를 기준으로 판정한다.
 *
 *   hardest 근거(가장 힘들었던 순간)로 뒷받침 + 말한 기준이 낮음  → GAP
 *   hardest 근거로 뒷받침 + 말한 기준이 높음                    → MATCH
 *   important 근거(중요했던 요소로 선택) + 말한 기준이 낮음       → GAP
 *   important 근거 + 말한 기준이 보통·높음                       → MATCH
 *   근거 없음 + 말한 기준이 높음                                 → CHANGE (선언은 높지만 근거가 안 보임)
 *   근거 없음 + 말한 기준이 보통·낮음                            → UNKNOWN (판정하지 않는다)
 *
 * UNKNOWN 축은 insights 배열에 아예 넣지 않는다 — 근거가 없는 축을 억지로 MATCH로
 * 채우지 않기 위해서다 (Missing data ≠ neutral).
 *
 * ══ v1.41 — 오른쪽 칸이 두 시점을 가질 수 있다 (§39) ══════════════════════════
 *
 * v1.40까지 `Relationship Me`는 **과거 관계 경험 하나**였다(S15~S17). 그래서
 * `dating` 사용자에게 `지금 이 관계에서 조율할 기준`이라고 말하면서 근거는 전부
 * 이전 관계에서 가져오고 있었다. v1.41은 `지금 관계 속의 나`(S30)를 **별도 source**로
 * 받고, 축마다 어느 시점의 근거를 썼는지 `evidenceScope`로 들고 다닌다.
 *
 * ⚠️ **판정 규칙(`stateFor`)은 한 줄도 바뀌지 않았다.** 바뀐 것은 `strength`를
 * 어디서 읽는지(`resolveAxisEvidence`)와 오른쪽 칸 **문장의 시제**뿐이다. 현재 근거가
 * 없는 세션에서는 `resolveAxisEvidence`가 v1.40의 `evidenceStrengthOf`와 완전히 같은
 * 값을 돌려주므로 MATCH/GAP/CHANGE·focus 축·gapCount·History 스냅샷이 **글자 하나
 * 다르지 않다**(fixture E0가 검사한다).
 *
 * ⚠️ **stage는 여기 들어오지 않는다.** 이 파일은 v1.40부터 `answers.status`를 읽지
 * 않았고 v1.41도 읽지 않는다. `tense`는 받지만 그건 근거를 **부르는 이름**일 뿐
 * 근거를 고르지 않는다(`relationshipEvidence.ts` 상단 참고).
 */

/** 1~5 값을 트랙 위 퍼센트 위치로 (양 끝이 잘리지 않도록 4%~96%) */
export function valueToPercent(value: number): string {
  return `${4 + ((value - 1) / 4) * 92}%`;
}

/**
 * ══ v1.41 — `absent`가 두 가지 서로 다른 것을 뜻하게 됐다 (§39.11) ═══════════
 *
 * v1.40까지 `absent`는 하나였다: **사용자가 아무 말도 하지 않은 축.** S15는 12개 중
 * 최대 4개를 고르는 다중 선택이므로, 고르지 않은 축은 '중요하지 않다'가 아니라
 * **'말하지 않았다'**다. 그래서 declared가 높지 않으면 `UNKNOWN`(판정하지 않는다)이
 * 맞았다 — 없는 근거로 MATCH를 만들지 않는다는 규칙 그대로다.
 *
 * v1.41에서 S30의 `rarely`(지금 관계에서는 거의 드러나지 않아)도 `absent`가 된다.
 * 강도는 같지만 **성질이 정반대다.**
 *
 * ```
 * absent + scope 'none'     사용자가 아무 말도 하지 않았다      → 판정하지 않는다
 * absent + scope 'current'  사용자가 "거의 안 드러난다"고 답했다 → 답이 있다
 * ```
 *
 * ⚠️ 후자를 `UNKNOWN`으로 두면 **사용자가 답한 축이 Mirror에서 사라진다.** 실측에서
 * 그렇게 나왔다(fixture E5) — 갈등 해결에 `rarely`를 고르고 declared가 보통이면 그
 * 축이 목록에서 없어졌다. 그건 '판정하지 않는다'가 아니라 **"근거가 없다"고 말하는
 * 것**이고, 사용자는 방금 답을 줬다.
 *
 * ⚠️ **그래서 `scope`를 받는다. 과거 근거의 판정 규칙은 한 줄도 바뀌지 않았다** —
 * `scope !== 'current'`인 경로는 v1.40.1과 문자 그대로 동일하다(E0·E11이 검사한다).
 * v1.41이 판정 규칙에 **더한** 것은 아래 한 줄뿐이고, 그 줄은 v1.40에는 존재할 수
 * 없었던 입력(직접 답한 부재)에만 적용된다.
 *
 * `declared`가 높지 않은데 지금도 드러나지 않는다면 두 답은 **같은 방향**이다.
 * 그래서 MATCH다 — 새 판정 이름을 만들지 않았고, `GAP`(말한 기준보다 크게 반응)이나
 * `CHANGE`(말했는데 안 드러남)를 빌려 쓰지도 않았다. 둘 다 사실이 아니기 때문이다.
 */
function stateFor(
  declaredValue: number,
  strength: EvidenceStrength,
  scope: RelationshipEvidenceScope,
): MirrorState {
  const declaredHigh = declaredValue >= 4;
  const declaredLow = declaredValue <= 2;

  if (strength === 'hardest') {
    if (declaredHigh) return 'MATCH';
    return 'GAP';
  }
  if (strength === 'important') {
    if (declaredLow) return 'GAP';
    return 'MATCH';
  }
  // strength === 'absent'
  if (declaredHigh) return 'CHANGE';
  // v1.41 — 직접 답한 부재는 판정할 수 있다. 말하지 않은 것은 여전히 UNKNOWN이다.
  return scope === 'current' ? 'MATCH' : 'UNKNOWN';
}

/**
 * v1.41 — CHANGE 문구는 **근거의 시점에 따라 달라져야 한다.**
 *
 * `MIRROR_NOTE[key].CHANGE`는 v1.0부터 `경험 후 우선순위가 옮겨간` 계열의 문장이다.
 * 그건 근거가 **과거 경험**일 때(= 과거에 중요하다고 꼽지 않았다) 성립하는 해석이다.
 *
 * 그런데 v1.41에서 `rarely`(지금 관계에서는 거의 드러나지 않아)를 고른 사용자도
 * CHANGE가 된다. 그 사용자에게 `경험 후 우선순위가 옮겨갔다`고 말하면 **일어났다고
 * 우리가 확인하지 못한 시간적 변화를 주장하는 것**이다 — 실제로 확인된 것은
 * '말한 기준은 높은데 지금은 잘 드러나지 않는다'는 **동시점의 불일치**뿐이다.
 *
 * ⚠️ 그래서 **판정 이름(CHANGE)과 계산은 그대로 두고 문장만** 갈랐다(§39.11 Audit).
 * 이름을 바꾸면 History Snapshot의 `SavedState`·`STATE_PHRASE`·비교 판정까지 전부
 * 움직이고, 저장된 과거 기록의 의미가 소급해서 달라진다.
 */
/**
 * 러비의 해석 한 줄.
 *
 * ══ v1.41 — `MIRROR_NOTE`는 **전부 과거 경험 문법이다** (§39.11) ═════════════
 *
 * v1.0부터 이 표의 문장은 근거가 S15~S17이라는 전제 위에 쓰여 있다. 실측하면
 * 열다섯 문장 중 상당수가 시제를 직접 말한다.
 *
 * ```
 * 연락에 대한 기준은 경험 전후가 비슷했어.          MATCH
 * 혼자 있는 시간은 실제 관계에서도 꾸준히 중요했어.   MATCH
 * 연애 전에는 중요했지만 실제 경험 후 …             CHANGE
 * ```
 *
 * 근거가 **지금 관계**에서 온 축에 이 문장을 그대로 붙이면, 사용자가 방금 지금
 * 관계에 대해 답한 것을 `경험 전후`로 부르게 된다 — 브라우저 실측(J5)에서 실제로
 * 그렇게 나왔다. 시제만 어긋난 것이 아니라 **근거의 출처를 잘못 말하는 것**이다.
 *
 * ⚠️ **표를 두 벌로 복제하지 않았다.** 축별 뉘앙스를 살리려면 5축 × 3상태 = 15개
 * 문장을 새로 쓰고 전부 검토해야 하고, 늘어난 문장 중 한 곳이 반드시 틀린다. 대신
 * **상태별 패턴 세 개**로 만든다 — 축 라벨을 넣어 문장은 축마다 달라지고, 검토할
 * 문형은 셋뿐이다.
 *
 * ⚠️ `scope !== 'current'`인 축은 `MIRROR_NOTE`를 **그대로** 쓴다. 과거 근거 사용자의
 * 화면은 v1.40.1과 글자 하나 다르지 않다(fixture E0).
 */
function noteFor(input: {
  axis: MirrorAxisKey;
  state: Exclude<MirrorState, 'UNKNOWN'>;
  scope: RelationshipEvidenceScope;
  strength: EvidenceStrength;
  label: string;
  tense: RelationshipTense;
}): string {
  const { axis, state, scope, strength, label, tense } = input;

  if (scope === 'current') {
    const when = tense === 'former' ? '그때 이 관계에서' : '지금 관계에서';

    if (state === 'CHANGE') {
      return `${withObjectParticle(label)} 중요하게 여긴다고 답했는데, ${when}는 그 장면이 크게 드러나지 않는다고 답했어. 어느 쪽이 진짜라고 정하지는 않을게.`;
    }
    if (state === 'GAP') {
      return `말한 기준보다 ${when} 더 크게 반응한다고 답했어.`;
    }
    /**
     * MATCH가 두 갈래다. `absent`면 **양쪽 모두 크지 않다는 일치**이고, 그 경우에
     * `꾸준히 중요했어` 계열을 붙이면 사용자가 답한 것과 정반대로 읽힌다.
     */
    return strength === 'absent'
      ? `${withObjectParticle(label)} 크게 중요하다고 답하지 않았고, ${when}도 크게 드러나지 않는다고 답했어. 두 답이 같은 방향이야.`
      : `${label}에 대해 말한 기준과 ${when} 답한 내용이 같은 방향이야.`;
  }

  return MIRROR_NOTE[axis][state];
}

function buildInsights(
  declared: DeclaredPreference,
  experience: RelationshipExperience,
  current: CurrentRelationshipEvidence,
  tense: RelationshipTense,
): MirrorInsight[] {
  const declaredValues = toDeclaredMirrorValues(declared);
  const insights: MirrorInsight[] = [];

  for (const { key, label } of MIRROR_AXES) {
    const declaredValue = declaredValues[key];
    // Declared Me는 S13까지 전부 필수라 실제로는 항상 값이 있지만, 방어적으로 없으면 건너뛴다.
    if (declaredValue === null) continue;

    const resolution = resolveAxisEvidence({ axis: key, experience, current });
    const strength = resolution.strength;
    const state = stateFor(declaredValue, strength, resolution.scope);
    if (state === 'UNKNOWN') continue;

    insights.push({
      key,
      label,
      declared: declaredValue,
      declaredHasScale: DECLARED_HAS_NATIVE_SCALE[key],
      // v1.36 — 실제 답에서 만든다. `declaredValue !== null`이 위에서 보장돼 있다.
      declaredPhrase: declaredPhraseOf(key, declared) ?? label,
      relationshipSignal: relationshipSignalTextOf({
        axis: key,
        label,
        resolution,
        experience,
        tense,
      }),
      evidenceStrength: strength,
      evidenceScope: resolution.scope,
      state,
      note: noteFor({ axis: key, state, scope: resolution.scope, strength, label, tense }),
    });
  }

  return insights;
}

/** Teaser·Core Insight에 쓸 축: hardest 근거의 GAP 우선 → 그 외 GAP → CHANGE → 첫 번째 */
function pickFocus(insights: MirrorInsight[]): MirrorInsight | null {
  if (insights.length === 0) return null;
  return (
    insights.find((i) => i.state === 'GAP' && i.evidenceStrength === 'hardest') ??
    insights.find((i) => i.state === 'GAP') ??
    insights.find((i) => i.state === 'CHANGE') ??
    insights[0]!
  );
}

function buildHeadline(focus: MirrorInsight): string {
  if (focus.key === 'contact' && focus.state === 'GAP') {
    return '너는 연락 자체보다 "관계가 계속 연결되어 있다는 느낌"을 중요하게 보는 사람일지도 몰라.';
  }
  if (focus.state === 'GAP') {
    return `너는 ${focus.label}에서 말한 기준보다 실제 관계에서 더 크게 반응하는 사람일지도 몰라.`;
  }
  if (focus.state === 'CHANGE') {
    /**
     * v1.41 §39.11 — `경험 후에는 우선순위가 옮겨간`은 **시간적 변화를 주장**한다.
     * 근거가 지금 관계 답변이면 확인된 것은 동시점의 불일치뿐이므로, 관찰하지 않은
     * 변화를 헤드라인으로 만들지 않는다. 과거 근거 사용자의 문장은 그대로다.
     */
    return focus.evidenceScope === 'current'
      ? `너는 ${withObjectParticle(focus.label)} 중요하게 여긴다고 말하지만, 지금 관계에서는 그 장면이 잘 드러나지 않는 사람일지도 몰라.`
      : `너는 ${withObjectParticle(focus.label)} 중요하게 여긴다고 말했지만, 경험 후에는 우선순위가 옮겨간 사람일지도 몰라.`;
  }
  return `너는 ${focus.label}에 대해 말한 기준과 관계에서의 반응이 꽤 겹치는 사람일지도 몰라.`;
}

function buildSummary(focus: MirrorInsight): string {
  if (focus.key === 'contact' && focus.state === 'GAP') {
    return '혼자 있는 시간을 좋아하지만, 관계에서 연결이 끊기는 신호에는 생각보다 민감한 편일 수 있어.';
  }
  if (focus.state === 'MATCH') {
    return `${focus.label}에 대해 말한 기준이 실제 관계에서도 비슷하게 나타났어.`;
  }
  return `${focus.label}에 대해 말한 기준과 실제 관계에서의 반응이 조금 달랐어.`;
}

export function buildCoreEvidence(
  focus: MirrorInsight,
  experience: RelationshipExperience,
): EvidenceItem[] {
  const items: EvidenceItem[] = [
    {
      n: '01',
      text: focus.declaredHasScale
        ? `${focus.label} 중요도를 ${focus.declared}/5로 답함`
        : `${focus.label}에 대해 "${focus.declaredPhrase}"라고 답함`,
    },
    { n: '02', text: focus.relationshipSignal },
  ];

  // Adaptive Follow-up — 모순 후보 축에 대해서만 물어본 추가 질문. 답했을 때만 근거로 쓴다.
  if (experience.adaptive && experience.adaptive.axis === focus.key) {
    items.push({
      n: '03',
      text: `추가로 "${adaptiveOptionLabel(focus.key, experience.adaptive.optionId)}"를 이유로 선택`,
    });
  }

  return items;
}

/**
 * '네가 말한 너' 한 줄 — **실제 답에서 만든다** (v1.36)
 *
 * ⚠️ v1.35까지는 축마다 고정 문장 하나였다. 그래서 연락을 5/5로 답한 사용자에게도
 * `연락은 별로 중요하지 않음`이 붙었고(실측), 그 문장이 Mirror Teaser · Premium Mirror
 * 상세 · History 스냅샷 · **AI 프롬프트**까지 그대로 흘러갔다. 사용자가 하지 않은 답을
 * 근거로 제시하는 것은 이 제품이 가장 하지 않기로 한 것이다.
 *
 * @returns 답이 없으면 `null` — 없는 답을 문장으로 만들지 않는다.
 */
export function declaredPhraseOf(
  axis: MirrorAxisKey,
  declared: DeclaredPreference,
): string | null {
  const level = selfLevelOf(axis, declared);
  return level ? DECLARED_PHRASE_BY_LEVEL[axis][level] : null;
}

/**
 * v1.41 — 세 번째·네 번째 인자가 생겼다. **둘 다 필수다.**
 *
 * ⚠️ optional로 두고 기본값을 넣지 않은 이유는 v1.40.1 §38.2 그대로다: 게이트든
 * 입력이든 **호출부가 조용히 생략할 수 있게 두면 언젠가 한 곳이 빠진다.** 현재 근거를
 * 갖고 있지 않은 호출부(과거 fixture·`profile.ts`)는 `NO_CURRENT_RELATIONSHIP`을
 * **명시적으로** 넘긴다 — 코드에 "여기는 현재 근거가 없다"가 보이게 하려는 것이다.
 */
export function buildMirrorReport(
  declared: DeclaredPreference,
  experience: RelationshipExperience,
  current: CurrentRelationshipEvidence,
  tense: RelationshipTense,
): MirrorReport {
  /**
   * 관계 경험이 없는 사용자에게 가짜 Relationship Me를 만들지 않는다.
   *
   * ⚠️ v1.41 — `experience.skipped`여도 **지금 관계 근거가 있으면 Mirror가 열린다.**
   * v1.40까지는 무조건 닫혔는데, 그건 '관계 경험 = 과거 경험'이었을 때만 맞는
   * 판정이었다. E4(연애 경험 없음)를 고른 뒤 실제로 연애를 시작해 S30에 답한
   * 사용자에게 `근거가 없어서 못 만들어`라고 말하는 것은 이제 사실이 아니다.
   * 현재 근거가 하나도 없으면 v1.40과 똑같이 닫힌다.
   */
  if (experience.skipped && !hasCurrentEvidence(current)) {
    return {
      available: false,
      insights: [],
      totalAxisCount: MIRROR_AXES.length,
      teaser: null,
      core: null,
      gapCount: 0,
      scopeSummary: summarizeScopes([]),
    };
  }

  const insights = buildInsights(declared, experience, current, tense);
  const focus = pickFocus(insights);

  const teaser: MirrorTeaser | null = focus
    ? {
        axisKey: focus.key,
        axisLabel: focus.label,
        declaredPhrase: focus.declaredPhrase,
        /**
         * v1.36 — **판정과 같은 근거를 쓴다.**
         *
         * v1.35까지는 축마다 고정 문장(`RELATIONSHIP_PHRASE`)이었다. 그래서 Mirror
         * 본문이 `개인 시간 · CHANGE · 이전 관계에서 개인 시간을 특별히 중요한 요소로
         * 꼽지는 않았어`라고 판정한 사용자의 Teaser에 `개인 시간이 꾸준히 중요했음`이
         * 떴다(실측) — **같은 데이터에 대해 두 화면이 반대로 말했다.**
         * 이제 판정이 실제로 쓴 근거 문장을 그대로 보여준다.
         */
        relationshipPhrase: focus.relationshipSignal,
      }
    : null;

  const core: CoreInsight | null = focus
    ? {
        headline: buildHeadline(focus),
        evidence: buildCoreEvidence(focus, experience),
        summary: buildSummary(focus),
      }
    : null;

  return {
    available: true,
    insights,
    totalAxisCount: MIRROR_AXES.length,
    teaser,
    core,
    gapCount: insights.filter((insight) => insight.state === 'GAP').length,
    scopeSummary: summarizeScopes(insights.map((insight) => insight.evidenceScope)),
  };
}

/**
 * 이 축이 GAP이면 Adaptive Follow-up을 물어볼 대상이 된다 (S16→S17 사이)
 *
 * ⚠️ v1.41 — **현재 근거를 일부러 넣지 않는다.** 이 함수가 실행되는 시점(S16→S17)은
 * S30보다 **앞**이라 현재 근거가 존재할 수 없고, 존재하는 것처럼 계산하면 뒤로 돌아온
 * 사용자에게만 Adaptive 트리거가 달라지는 비대칭이 생긴다. 그래서 과거 근거만 본다 —
 * v1.40과 완전히 같은 동작이다.
 */
export function pickAdaptiveTriggerAxis(
  declared: DeclaredPreference,
  experience: RelationshipExperience,
): MirrorAxisKey | null {
  if (experience.skipped) return null;
  const insights = buildInsights(declared, experience, NO_CURRENT_RELATIONSHIP, 'current');
  const focus = pickFocus(insights);
  return focus && focus.state === 'GAP' ? focus.key : null;
}
