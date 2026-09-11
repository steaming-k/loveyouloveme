import { adaptiveOptionLabel } from '@/data/adaptive';
import { AXIS_DEFINITIONS, MIRROR_AXES } from '@/data/axes';
import { LENS_THEME_LABEL } from '@/data/premiumLens';
import { RELATIONSHIP_EVENT_LABEL } from '@/data/relationshipEvents';
import {
  AFFECTION_LABEL,
  CONFLICT_LABEL,
  HARDEST_LABEL,
  HOBBY_LABEL,
  PAST_FACTOR_LABEL,
} from '@/data/labels';
import { resolveEvidenceRef, type EvidenceResolverContext } from '@/lib/aiEvidenceResolver';
import { limitationFor } from '@/services/premiumConnections';
import type { RelationshipTense } from '@/lib/logic/relationshipEvidence';
import { sanitizeFreeText } from './safety';
import type {
  CompatibilityResult,
  CrossSourceInsight,
  DeclaredPreference,
  EvidenceRef,
  HistoryAxisChange,
  MirrorReport,
  PremiumLensKind,
  PremiumCrossLens,
  PremiumLensReport,
  PremiumLensSelfReason,
  RelationshipEvent,
  RelationshipEventType,
  RelationshipExperience,
  SessionAnswers,
  ValidatedObservation,
} from '@/types';

/**
 * Task별 Context Builder (§25 · §26)
 *
 * 원시 세션을 `JSON.stringify` 해서 LLM에 던지지 않는다. Task가 **실제로 필요한 최소 데이터**만
 * 만들어 보낸다.
 *
 * ⚠️ 전송하지 않는 것:
 *   - Birth Profile (사주·별자리는 별도 Lens · §27)
 *   - Premium 클릭 여부 / 가격 variant (결제 의향이 분석에 영향 금지 · §28)
 *   - 사진 원본 (Observed task 외 · §26)
 *   - 상대 이름 등 식별정보 — 애초에 저장하지 않는다 (§29)
 *   - MBTI / Zodiac (Core 분석과 분리)
 *
 * ⚠️ **v1.46 AI Lens — 위 목록은 Core Task(observed·relationship·compatibility·
 * history·deep-report) 다섯 개에 대한 것이다.** 이 파일 아래쪽의 렌즈 Context Builder는
 * 의도적으로 다르다: 렌즈 Task는 MBTI 4글자·일주 라벨·태양궁을 **받아야 하는 작업**이고,
 * 그것이 없으면 할 일이 없다.
 *
 * 그래도 경계는 그대로다 — 렌즈 Task에도 **생년월일 원본은 나가지 않는다.** 나가는 것은
 * 결정론 엔진이 이미 계산해 화면에 그리고 있는 `basis` 라벨(`갑자(甲子) · 일간 목`)뿐이고,
 * Core Task 다섯 개의 context는 v1.46 AI Lens에서 **한 글자도 바뀌지 않았다.**
 */

/* ------------------------------------------------ Observed (사진 분석) */

export interface ObservedContext {
  imageIds: string[];
  /** 사진 외 다른 개인 정보를 함께 보내지 않는다 */
  guidance: { maxTraits: number; minEvidencePerTrait: number };
}

export function buildObservedContext(imageIds: readonly string[]): ObservedContext {
  return {
    imageIds: [...imageIds],
    guidance: { maxTraits: 6, minEvidencePerTrait: 1 },
  };
}

/* ------------------------------------------------------ Relationship */

export interface RelationshipContext {
  /**
   * v1.42 §40.7 — **`status: RelationshipStatus | null`을 대체했다.**
   *
   * ══ 왜 raw status를 빼는가 ═══════════════════════════════════════════════
   *
   * v1.41까지 이 자리에 `answers.status`가 **enum 원문 그대로** 들어갔다 —
   * `"ended"` · `"married"` · `"solo_exp"`. 같은 객체의 `hardestMoment`·`selfGap`은
   * 전부 라벨로 바꿔 보내는데 `status`만 raw였고, **프롬프트는 이 필드를 한 번도
   * 언급하지 않았다.** 즉 모델은 관계 단계를 이름 없는 자유 변수로 받았다.
   *
   * 세 가지가 동시에 잘못돼 있었다.
   *
   *  ① **계약이 없다.** 프롬프트가 쓰는 법을 말하지 않으므로 모델이 무엇을 하든
   *    그건 우리가 정한 게 아니다. 판정을 못 바꾸는 것(`attachRuleStates`가 state를
   *    규칙 값으로 덮어쓴다)과 **문장을 어떻게 쓸지 모르는 것**은 다른 문제다.
   *  ② **§39.13이 세운 경계를 이 자리만 지키지 않았다.** v1.41은 `RelationshipJob`
   *    6종을 하위 문장 생성기에 흘리면 Job별 분기가 자란다는 이유로 `tense` 2종으로
   *    좁혔다. AI는 코드보다 분기를 더 자유롭게 만드는 생성기인데, **가장 좁혀서 줘야
   *    하는 자리에 가장 raw한 값**이 가고 있었다.
   *  ③ **stage가 evidence 쪽으로 새는 입구였다.** `relationshipEvidence.ts`는 stage를
   *    import조차 못 하게 테스트로 막혀 있는데(R1), AI context에는 그대로 있었다.
   *
   * 그래서 `status`를 지우고 `tense`만 남긴다. AI가 알아야 하는 것은 하나다 —
   * **이 문장을 진행 중인 관계로 써야 하는가, 끝난 관계로 써야 하는가.**
   *
   * ⚠️ **이 값은 evidence가 아니다.** 근거를 만들지도, 고르지도, 강도를 바꾸지도
   * 않는다. `ruleJudgements`가 실어 보내는 `relationshipSignal`이 이미
   * `buildMirrorReport(…, tense)`를 거쳐 시제가 맞는 문장이고, 이 필드는 모델이 **그
   * 문장들과 같은 시제로 쓰게** 하는 지시일 뿐이다(§40.9 factual input vs narrative
   * instruction).
   */
  tense: RelationshipTense;
  declared: Record<string, string | number | null>;
  relationship: {
    importantFactors: string[];
    hardestMoment: string | null;
    selfGap: string | null;
    /** 사용자 자유서술 — 데이터 영역으로 감싸서 보낸다 */
    note: string | null;
  };
  adaptive: { axis: string; reason: string } | null;
  /** 사용자가 확인·수정한 관찰만. 제외한 항목은 보내지 않는다(§14) */
  observedValidated: Array<{ traitId: string; text: string; source: 'user' | 'ai' }>;
  /** 규칙이 이미 판정한 결과 — AI는 이걸 설명만 한다 */
  ruleJudgements: Array<{
    axis: string;
    label: string;
    state: string;
    declaredPhrase: string;
    relationshipSignal: string;
    isFocus: boolean;
  }>;
  pastObservations: Array<{ axis: string; entryId: string; note: string }>;
}

const SELF_GAP_LABEL: Record<string, string> = {
  yes: '연애 전 생각한 나와 실제 연애 속 내가 달랐다',
  some: '조금 달랐다',
  no: '거의 같았다',
};

function declaredForContext(declared: DeclaredPreference): Record<string, string | number | null> {
  return {
    contactImportance: declared.contact,
    conflictStyle: declared.conflict ? CONFLICT_LABEL[declared.conflict] : null,
    aloneNeed: declared.alone,
    affectionStyle: declared.affection ? AFFECTION_LABEL[declared.affection] : null,
    hobbySharing: declared.hobby ? HOBBY_LABEL[declared.hobby] : null,
  };
}

/**
 * 사용자 검증 우선순위(§14): USER CORRECTION > CONFIRMED AI > UNVERIFIED AI, excluded는 제거.
 * AI에게도 '무엇이 사용자 말이고 무엇이 AI 추측인지' 구분해 알려준다.
 */
export function validatedObservationsForContext(
  observations: readonly ValidatedObservation[],
): RelationshipContext['observedValidated'] {
  const ranked = observations
    .filter((item) => item.status !== 'excluded')
    .sort((a, b) => rankStatus(b.status) - rankStatus(a.status));

  return ranked.map((item) => {
    const correction = sanitizeFreeText(item.userCorrection, 120);
    return correction
      ? { traitId: item.original.id, text: correction, source: 'user' as const }
      : { traitId: item.original.id, text: item.original.observation, source: 'ai' as const };
  });
}

function rankStatus(status: ValidatedObservation['status']): number {
  if (status === 'corrected') return 3;
  if (status === 'confirmed') return 2;
  return 1;
}

export function buildRelationshipContext(input: {
  answers: SessionAnswers;
  mirror: MirrorReport;
  validated: readonly ValidatedObservation[];
  /**
   * v1.42 §40.8 — **필수다. optional + 기본값을 두지 않았다.**
   *
   * v1.40.1 §38.2가 정확히 이 실수를 닫았다: `DeepReportJobContext`를 optional로 두고
   * 기본값을 '허용'으로 잡았더니, 호출부가 두 곳인데 한 곳이 값을 빼먹었고 **하필 그
   * 쪽이 화면을 실제로 여는 경로**였다. 게이트는 코드에 있었지만 화면에는 없었다.
   *
   * 같은 형태를 반복하지 않는다. 기본값이 `'current'`면 새 호출부가 조용히
   * 진행형으로 떨어지고, 그건 `ended` 사용자에게 가장 위험한 기본값이다.
   * 빼먹으면 `tsc`가 막는다 — 사람의 기억이 아니라 타입이 지킨다.
   *
   * ⚠️ 반드시 `relationshipTenseOf(job)`에서 온 값을 넘긴다. 여기서도, 호출부에서도
   * `if (status === 'ended')`를 새로 쓰지 않는다 — 판정 source는 하나다(§40.10).
   */
  tense: RelationshipTense;
  pastObservations?: readonly { axis: string; entryId: string; note: string }[];
}): RelationshipContext {
  const { answers, mirror, validated, tense, pastObservations = [] } = input;
  const experience: RelationshipExperience = answers.experience;
  const focusAxis = mirror.teaser?.axisKey ?? null;

  return {
    tense,
    declared: declaredForContext(answers.declared),
    relationship: {
      importantFactors: experience.important.map((factor) => PAST_FACTOR_LABEL[factor]),
      hardestMoment: experience.hardest ? HARDEST_LABEL[experience.hardest] : null,
      selfGap: experience.selfGap ? (SELF_GAP_LABEL[experience.selfGap] ?? null) : null,
      note: sanitizeFreeText(experience.note, 300),
    },
    adaptive: experience.adaptive
      ? {
          axis: experience.adaptive.axis,
          reason: adaptiveOptionLabel(experience.adaptive.axis, experience.adaptive.optionId),
        }
      : null,
    observedValidated: validatedObservationsForContext(validated),
    ruleJudgements: mirror.insights.map((insight) => ({
      axis: insight.key,
      label: insight.label,
      state: insight.state,
      declaredPhrase: insight.declaredPhrase,
      relationshipSignal: insight.relationshipSignal,
      isFocus: insight.key === focusAxis,
    })),
    pastObservations: [...pastObservations],
  };
}

/* ----------------------------------------------------- Compatibility */

export interface CompatibilityContext {
  /**
   * v1.43 §47.1 — **`relationship-insight`와 같은 계약**. 모델이 알아야 하는 것은
   * 하나다: 이 설명을 진행 중인 관계로 써야 하는가, 끝난 관계로 써야 하는가.
   *
   * ⚠️ raw `status`/`job`/`stage`를 넣지 않는다. v1.42 §40.7이 relationship Task에서
   * 지운 것을 여기에 새로 만들지 않는다 — AI에게 Job을 알려주는 것은 단계에 맞는
   * 내용을 지어내라고 초대하는 것이다.
   *
   * ⚠️ **evidence가 아니다.** 근거를 만들지도, 고르지도, 강도를 바꾸지도 않는다.
   * `dimensions[]`가 실어 보내는 값은 이 필드와 무관하게 그대로다.
   */
  tense: RelationshipTense;
  /** 점수는 참고로만 보낸다 — AI가 새 점수를 만들지 못하게 프롬프트에서 막는다 */
  computedScore: number | null;
  comparedCount: number;
  dimensions: Array<{
    key: string;
    label: string;
    kind: 'good' | 'friction' | 'neutral' | 'unknown';
    minePhrase: string;
    theirsPhrase: string;
    /**
     * v1.30 — **모델이 그대로 복사해 돌려줄 근거 식별자.**
     *
     * 이게 없던 것이 무료 Compatibility AI 설명이 화면에 하나도 닿지 않던 원인이다.
     * 프롬프트는 `"field": "필드명"`이라고만 했고 "입력에 있는 필드만 참조하라"고 했다.
     * 모델은 지시를 충실히 따랐다 — 입력 JSON에 보이는 이름을 썼다. 실측에서 나온 값:
     *
     *   minePhrase · theirsPhrase          (dimension 객체의 키를 그대로)
     *   "personal time" · "contact importance" · "affection expression"  (자연어로 지어냄)
     *
     * 그런데 `resolveDeclared`가 아는 field는 `contact|alone|conflict|affection|hobby`
     * (+ 별칭)뿐이라 **전부 null로 떨어졌고**, 근거 0개가 된 narrative는
     * `narrativeIsShowable`에서 걸러져 화면에 한 문장도 남지 않았다. API는 200이라
     * 실패 안내조차 뜨지 않았다 — 조용히 사라졌다.
     *
     * Deep Report는 이미 이 문제를 `{ ref, text }`를 주고 "그대로 복사해 돌려줘라"로
     * 풀고 있었다. 여기서도 **같은 방식**을 쓴다. 그리고 새 어휘를 만들지 않는다 —
     * `compatibility` source는 v1.26에 이미 있고 `resolveEvidenceRef`가 풀 수 있으며
     * `useEvidenceContext`가 이미 `compatibility`를 넘기고 있다. 화면용 임시 alias를
     * resolver에 늘리는 대신, **모델이 받는 어휘를 이미 있는 canonical key로 맞춘다.**
     */
    ref: EvidenceRef;
  }>;
  /**
   * v1.43 §47.6 — **`targetRelation: string | null`을 제거했다.**
   *
   * v1.13부터 이 필드가 있었고 `buildCompatibilityContext`는 **항상 `null`을 넣었다**
   * (`// 상대는 '관계 맥락'만. 이름·출생정보 등은 보내지 않는다`). 즉 모델은 이 키를
   * 언제나 `null`로 받았고 프롬프트는 이 필드를 한 번도 언급하지 않았다.
   *
   * 그런데 `compatibilityNarrativeFingerprint`에는 `target.relation`이 **들어가 있었다.**
   * 모델이 받지 않는 값이 그 Task의 캐시 키에 있는 상태이고, v1.42 §40.5가
   * `status`를 지문에서 뺀 근거(`AI가 받지 않는 값은 캐시 키도 아니다`)의 반대 사례다.
   *
   * 실패 방향이 무해했다는 점만 다르다 — 과도 무효화(요청 한 번 더)일 뿐 틀린 응답이
   * 나오지는 않았다. 그래도 남겨두면 "이 값이 AI에 영향을 준다"는 잘못된 신호가 되고,
   * v1.43이 캐시 identity를 계약으로 만드는 버전이므로 여기서 정리한다.
   *
   * ⚠️ `target.relation` 자체는 그대로 쓰인다 — `soloModeOfTarget`의 SUFFICIENCY 판정
   * (→ JOB → 안전 게이트)과 History 스냅샷에 들어간다. 지운 것은 **AI context의 죽은
   * 필드**와 **그 Task의 지문 항목**뿐이다.
   */
}

export function buildCompatibilityContext(input: {
  result: CompatibilityResult;
  /**
   * v1.43 §47.1 — **필수다. optional + 기본값을 두지 않았다.**
   *
   * v1.40.1 §38.2와 v1.42 §40.8이 같은 이유로 같은 결정을 했다: 안전 게이트에
   * 관용적인 기본값을 주면 값을 빼먹은 호출부가 조용히 가장 위험한 쪽으로 간다.
   * `'current'`가 기본값이면 관계가 끝난 사용자의 요청이 시제 검사를 통과한다.
   *
   * ⚠️ 반드시 `relationshipTenseOf(job)`에서 온 값을 넘긴다 — 판정 source는 하나다.
   */
  tense: RelationshipTense;
}): CompatibilityContext {
  const { result, tense } = input;
  const goodKeys = new Set(result.goodSignals.map((signal) => signal.key));
  const frictionKeys = new Set(result.frictionSignals.map((signal) => signal.key));

  return {
    tense,
    computedScore: result.score,
    comparedCount: result.comparedCount,
    dimensions: result.dimensions
      .filter((dimension) => dimension.alignment !== null)
      .map((dimension) => ({
        key: dimension.key,
        label: dimension.label,
        kind: goodKeys.has(dimension.key)
          ? ('good' as const)
          : frictionKeys.has(dimension.key)
            ? ('friction' as const)
            : ('neutral' as const),
        minePhrase: dimension.minePhrase,
        theirsPhrase: dimension.theirsPhrase,
        // ⚠️ 여기서 새 값을 만들지 않는다 — 이미 계산된 dimension.key를 가리킬 뿐이다.
        ref: { source: 'compatibility', field: dimension.key },
      })),
  };
}

/** AI가 설명해도 되는 축 목록 — 규칙이 정한 kind를 함께 넘긴다 */
export function compatibilityAllowList(
  result: CompatibilityResult,
): { key: (typeof AXIS_DEFINITIONS)[number]['key']; kind: 'good' | 'friction' }[] {
  return [
    ...result.goodSignals.map((signal) => ({ key: signal.key, kind: 'good' as const })),
    ...result.frictionSignals.map((signal) => ({ key: signal.key, kind: 'friction' as const })),
  ];
}

/* ---------------------------------------------------------- History */

export interface HistoryContext {
  /**
   * v1.43 §45.3 — **이 리포트가 비교한 두 기록의 id.**
   *
   * ══ 왜 없으면 계약이 성립하지 않는가 ═══════════════════════════════════
   *
   * v1.42까지 history 프롬프트는 근거 source로 `declared|relationship|history`를
   * 허용했다. 그런데 `history` ref는 `{ source, entryId, axis }` 세 개를 요구하고
   * (`parseEvidenceRef`), 이 context는 **`entryId`를 보내지 않았다** —
   * `{axis,label,state,previousText,currentText,declaredDelta}`뿐이었다.
   *
   * 그래서 모델이 `history`를 고르면 그 ref는 항상 `null`로 떨어졌고, 근거 0개가 된
   * 항목은 `uncertainty`가 있으면 살아남고 없으면 버려졌다. v1.43 §44 BEFORE 실측:
   * `/history/report`의 AI narrative 2개 모두 **근거 0개 · uncertainty로만 생존**.
   *
   * 즉 이 Task는 "두 기록 사이의 변화"를 설명하면서 **그 두 기록 중 어느 쪽도 가리킬
   * 수 없었다.** 결정을 두 개 중에서 골라야 했다.
   *
   * | | 무엇을 하나 | 판단 |
   * |---|---|---|
   * | A | entryId를 context에 실어 보내 계약을 성립시킨다 | **채택** |
   * | B | 프롬프트 enum에서 `history`를 지운다 | 아래 |
   *
   * **A를 고른 이유는 이 Task의 주제 자체다.** `resolveHistory`는 이미
   * `2026.08.01 기록에서도 연락 축에 …`라는 근거 문장을 만들 수 있고,
   * `HistoryAxisNarrative`는 이미 그 근거를 화면에 그린다. 즉 렌더링 쪽은 v1.26부터
   * 준비돼 있었고 **입력만 빠져 있었다.** B를 고르면 변화 리포트의 AI 설명이
   * `declared`만 가리킬 수 있게 되는데, 그러면 '변화'의 근거로 지목할 수 있는 것이
   * 두 기록 중 하나도 없다.
   *
   * ⚠️ **새 id를 만들지 않는다.** `RelationshipHistoryEntry.id`를 그대로 보낸다.
   *
   * ⚠️ Privacy — id는 세션 로컬 값이고 상대 개인정보를 담지 않는다(§29). 다만 우리
   * enum이 아니므로 **dev 로그에는 넣지 않는다**(§44).
   */
  comparedEntries: { previousEntryId: string; currentEntryId: string } | null;
  changes: Array<{
    axis: string;
    label: string;
    state: string;
    previousText: string | null;
    currentText: string | null;
    declaredDelta: { past: number; now: number } | null;
  }>;
}

export function buildHistoryContext(
  changes: readonly HistoryAxisChange[],
  /**
   * v1.43 — 비교한 두 기록. 하나뿐이거나 없으면 `null`이고, 그때 이 Task는 애초에
   * 호출되지 않는다(`allowed.length === 0` → 빈 결과 · §79 CASE O).
   */
  comparedEntries: { previousEntryId: string; currentEntryId: string } | null = null,
): HistoryContext {
  return {
    comparedEntries,
    changes: changes
      .filter((change) => change.state !== 'INSUFFICIENT')
      .map((change) => ({
        axis: change.axis,
        label: change.label,
        state: change.state,
        previousText: change.previousText,
        currentText: change.currentText,
        declaredDelta: change.declaredDelta,
      })),
  };
}

/* ------------------------------------------------------- Deep Report */

export interface DeepReportContext {
  /**
   * v1.43 §47.5 — **`[시제]` 블록이 읽는 값.**
   *
   * v1.41부터 `tense`는 이미 이 builder의 인자였지만 `limitationFor(sources, tense)`를
   * 부르는 데만 쓰였다 — 즉 모델은 시제를 **경계 문장에서 눈치채야** 했고, 프롬프트는
   * 시제를 한 번도 언급하지 않았다. v1.42가 relationship Task에서 지적한 것과 같은
   * 형태다: 계약 없이 값만 흘려보내면 모델이 무엇을 하든 그건 우리가 정한 게 아니다.
   */
  tense: RelationshipTense;
  insights: Array<{
    id: string;
    type: string;
    axis: string | null;
    sources: string[];
    /**
     * AI가 문장을 지어내는 대신 **여기 있는 것만 그대로 인용**한다. ref는 서버가 이미
     * 갖고 있는 EvidenceRef를 그대로 보여주는 것이고, text는 Resolver가 실제 세션 데이터로
     * 만든 문장이다 — AI는 이 text를 evidence로 다시 쓰지 않고 그대로 참조만 한다.
     */
    evidence: Array<{ ref: EvidenceRef; text: string }>;
    strength: string;
    /**
     * v1.27 — **ALLOWED CONNECTION.** 규칙 엔진이 확인한 주장 그대로다(`ruleSummary`).
     * 모델은 이 범위 안에서만 말할 수 있다 — 여기 없는 관계(인과·예측)를 새로 만들면
     * `scanClaimBoundary`가 그 항목을 버린다.
     */
    allowedConnection: string;
    /**
     * v1.27 — **LIMITATION.** 이 연결이 말할 수 없는 것.
     * 화면에 이미 보이는 것과 **같은 문자열**이다 — 사용자가 보는 경계와 모델이 받는
     * 경계가 다르면 경계가 아니다.
     */
    limitation: string;
  }>;
}

/**
 * Quality Gate (A) — 근거가 2개 이상 실제로 해석되는 Insight만 AI에게 보낸다(§26).
 * 1개짜리는 '연결'이 아니라 '되풀이'라서 여기서 걸러진다 — AI가 근거 없이
 * 뭔가를 지어낼 여지도 원천적으로 없어진다.
 */
export function buildDeepReportContext(
  insights: readonly CrossSourceInsight[],
  resolverContext: EvidenceResolverContext,
  /**
   * v1.41 §39.13 — **화면과 같은 경계 문장을 모델에게 준다.**
   *
   * v1.27이 세운 규칙 그대로다: `limitation`은 화면에 이미 보이는 것과 **같은
   * 문자열**이어야 하고, 사용자가 보는 경계와 모델이 받는 경계가 다르면 그건
   * 경계가 아니다. `limitationFor`가 시점을 말하게 됐으므로 이 자리도 같은
   * 시점을 받아야 한다 — 안 받으면 `ended` 사용자의 프롬프트에만
   * `지금 이 관계`가 남는다.
   *
   * ⚠️ **context의 모양(필드 목록)은 바뀌지 않는다.** 프롬프트 템플릿·스키마·
   * `promptVersion` 전부 그대로이고, 기존 필드의 **값**이 정확해질 뿐이다
   * (v1.36이 `declaredPhrase` 값을 고친 것과 같은 종류의 변경).
   */
  tense: RelationshipTense,
): DeepReportContext {
  const built: DeepReportContext['insights'] = [];

  for (const insight of insights) {
    if (!insight.eligibleForNarrative) continue;

    const seen = new Set<string>();
    const evidence: Array<{ ref: EvidenceRef; text: string }> = [];
    for (const ref of insight.evidenceRefs) {
      const resolved = resolveEvidenceRef(ref, resolverContext);
      if (!resolved || seen.has(resolved.key)) continue;
      seen.add(resolved.key);
      evidence.push({ ref, text: resolved.text });
    }
    if (evidence.length < 2) continue;

    built.push({
      id: insight.id,
      type: insight.type,
      axis: insight.axis ?? null,
      sources: insight.sources,
      /**
       * v1.27 — 모델에게 **규칙이 확인한 주장**과 **말할 수 없는 것**을 함께 준다.
       *
       * v1.26까지는 evidence와 type 라벨만 보냈다. 그래서 모델은 "이 연결이 왜 눈에
       * 띄는지 설명하라"는 요청만 받았고, 규칙이 어디까지 확인했는지 몰랐다 —
       * 실측에서 두 관찰이 같은 축을 가리킨다는 것만 확인된 상황에 모델이
       * '영향을 미칠 수 있을'이라는 **인과 방향**을 새로 붙였다.
       *
       * 두 문장은 화면에 이미 보이는 것과 **같은 문자열**이다 — 사용자가 보는 경계와
       * 모델이 받는 경계가 다르면 안 된다.
       */
      allowedConnection: insight.ruleSummary,
      limitation: limitationFor(insight.sources, tense),
      evidence,
      strength: insight.strength,
    });
  }

  return { tense, insights: built };
}

/** Mirror 축 라벨 — 화면·프롬프트에서 공통으로 쓴다 */
export const MIRROR_AXIS_LABELS = MIRROR_AXES;

/* -------------------- Premium Lens AI (v1.46 AI Lens · §8 · §19 · §26) --- */

/**
 * 렌즈 AI가 받는 것 (§26 토큰 절약)
 *
 * ⚠️ **보내지 않는 것**을 먼저 적는다 — §26이 금지한 목록이 이 타입의 설계 근거다:
 *
 * ```
 * ❌ 전체 세션 JSON · 전체 History · Deep Report 본문 · 사진 분석 narrative
 * ❌ 결정론 렌즈 본문 전체 (소제목만 보낸다 — 같은 말을 하지 않게 하는 데는 그걸로 족하다)
 * ❌ 다른 렌즈의 데이터 (MBTI 호출에 생년월일을 넣지 않는다)
 * ```
 *
 * 보내는 것은 **그 렌즈가 실제로 계산한 값**(`basis`)과, 해석을 관계 맥락에 묶는 데
 * 필요한 최소한(`declared` · 관련 사건)뿐이다.
 */
export interface PremiumLensContext {
  lens: PremiumLensKind;
  mode: 'pair' | 'self';
  /**
   * v1.46.1 — **상대가 있는지.** `mode: 'self'` 하나로는 두 상태가 구분되지 않는다:
   * 대상이 아직 없는 사용자와, 대상은 있는데 이 렌즈의 값(상대 MBTI·생년월일)을
   * 모르는 사용자다. 구분해서 주지 않으면 모델이 후자에게 `상대가 아직 없으니`라고
   * 쓰고, 그건 사용자가 방금 입력한 사실을 부정하는 문장이 된다.
   */
  targetExists: boolean;
  /** `self`일 때만. 화면 카피와 같은 값을 본다 */
  selfReason?: PremiumLensSelfReason;
  tense: RelationshipTense;
  /**
   * 결정론 엔진이 계산한 값 그대로. **`AI_OUTPUT ⊆ DETERMINISTIC_LENS_EVIDENCE`의
   * 실체가 이 배열이다** — 모델이 말할 수 있는 범위가 여기까지라고 프롬프트가 못박는다.
   */
  basis: { label: string; value: string }[];
  /**
   * 결정론 엔진이 붙인 테마 — **사람이 읽는 라벨로 보낸다.**
   *
   * ⚠️ enum 코드(`planning`)를 그대로 보내지 않는다. 브라우저 실측에서 Cross-Lens
   * 모델이 그 코드를 **결과 문장에 그대로 복사**했고, 유료 화면에 `planning ·
   * expression · pace` 세 단어가 영어로 나갔다. 모델은 받은 어휘로 쓴다 — 내부
   * 식별자를 보내면 내부 식별자가 화면에 나온다.
   */
  themes: string[];
  /**
   * 결정론 설명의 **소제목만**(§31 중복 방지).
   *
   * ⚠️ 본문을 넣지 않는다. 본문을 넣으면 (a) 입력 토큰이 렌즈마다 3배가 되고
   * (b) 모델이 그 문장을 다듬어 되풀이할 재료를 손에 쥔다. 되풀이 여부는 서버가
   * `echoesReferenceSentence`로 직접 검사하므로 모델에게 원문을 줄 이유가 없다.
   */
  alreadySaid: string[];
  /** 사용자가 직접 답한 내용. 렌즈 결과와 어긋나면 이쪽이 사실이다(§10 · §13 · §17) */
  declared: Record<string, string | number | null>;
  /**
   * §19 — **이 렌즈와 관련 있는 사건만.** 모든 사건을 세 렌즈에 반복 전송하지 않는다.
   *
   * ⚠️ v1.46 PremiumLens까지 사건 자유 입력은 AI Provider로 나가지 않았다
   * (`lib/logic/relationshipEvents.ts` 상단 Privacy 블록). v1.46 AI Lens §19·§20이
   * 그 경계를 **의도적으로 옮긴다** — 그래서 그 블록도 함께 고쳤다. 문서와 코드가
   * 다른 상태로 두지 않는다.
   */
  reportedEvents: { type: string; description: string; myReaction: string | null }[];
}

/**
 * §19 — 렌즈별 관련 사건 종류.
 *
 * ⚠️ 새 판정이 아니다. `RelationshipEventType`은 이미 있는 enum이고 여기서 하는 일은
 * "이 렌즈가 말하는 주제와 겹치는 종류는 어느 것인가"를 한 번 적어두는 것뿐이다.
 * 어떤 사건도 점수·상태·Chapter에 들어가지 않는다는 성질은 그대로다(v1.46 §11).
 *
 * ⚠️ `other`는 어느 렌즈에도 넣지 않는다. 종류를 모르는 사건을 특정 렌즈의 근거처럼
 * 쓰면 그 순간 사용자 보고가 렌즈 판정으로 읽힌다.
 */
const LENS_EVENT_TYPES: Record<PremiumLensKind, readonly RelationshipEventType[]> = {
  /** 대화·연락·갈등 — 정보 처리와 결정 방식이 실제로 부딪히는 자리 */
  mbti: ['contact_change', 'conflict', 'meeting'],
  /** 거리감·가까워짐 — 관계 리듬 */
  saju: ['distance', 'closer', 'meeting'],
  /** 호감·애정 표현·거리감 — 표현 방식 */
  zodiac: ['affection_felt', 'care_received', 'distance'],
};

/** 렌즈 하나에 넘기는 사건 상한. 사건은 최대 3개지만(§8) 프롬프트에는 2개까지만 */
const LENS_EVENT_LIMIT = 2;

function eventsForLens(
  kind: PremiumLensKind,
  events: readonly RelationshipEvent[],
): PremiumLensContext['reportedEvents'] {
  const allowed = LENS_EVENT_TYPES[kind];
  return events
    .filter((event) => allowed.includes(event.type))
    .slice(0, LENS_EVENT_LIMIT)
    .map((event) => ({
      type: RELATIONSHIP_EVENT_LABEL[event.type],
      // 자유 입력은 반드시 한 번 더 자르고 정규화해서 내보낸다(§34 · sanitizeFreeText)
      description: sanitizeFreeText(event.description, 120) ?? '',
      myReaction: sanitizeFreeText(event.myReaction, 80),
    }))
    .filter((event) => event.description.length > 0);
}

export function buildPremiumLensContext(input: {
  report: PremiumLensReport;
  declared: DeclaredPreference;
  events: readonly RelationshipEvent[];
  tense: RelationshipTense;
  /** 상대라는 대상이 있는지. 이 렌즈의 상대 **데이터**가 있는지와 다른 값이다 */
  targetExists: boolean;
}): PremiumLensContext {
  const { report, declared, events, tense, targetExists } = input;

  return {
    lens: report.kind,
    mode: report.mode,
    targetExists,
    ...(report.selfReason ? { selfReason: report.selfReason } : {}),
    tense,
    basis: report.basis.map((row) => ({ label: row.label, value: row.value })),
    themes: report.themes.map((theme) => LENS_THEME_LABEL[theme]),
    alreadySaid: report.sections.map((section) => section.title),
    declared: declaredForContext(declared),
    reportedEvents: eventsForLens(report.kind, events),
  };
}

/* ------------------------------------------------------- Cross-Lens */

/**
 * §21 — **각 Lens AI의 긴 body를 다시 넣지 않는다.** 넣는 것은 렌즈마다 한 줄
 * (`crossTheme`)과 결정론 테마 코드뿐이다.
 *
 * ⚠️ AI가 실패한 렌즈는 `aiTheme`가 없다. 그래도 `themes`는 있으므로 결정론 정보만으로
 * 자리를 지킨다 — §5 부분 실패에서 Cross-Lens가 "성공한 렌즈 + deterministic context"로
 * 제한된다는 규칙이 이 필드 두 개의 조합으로 표현된다.
 */
export interface CrossLensContext {
  tense: RelationshipTense;
  /** v1.46.1 — 렌즈 Task와 같은 이유(§6). `self`뿐인 결과에서도 상대는 있을 수 있다 */
  targetExists: boolean;
  lenses: Array<{
    lens: PremiumLensKind;
    label: string;
    mode: 'pair' | 'self';
    selfReason?: PremiumLensSelfReason;
    themes: string[];
    /** 해당 렌즈 AI가 만든 한 줄. 실패했으면 null */
    aiTheme: string | null;
    /** 그 렌즈가 계산한 핵심 값 한 줄 — basis 첫 두 행을 합친 것 */
    computed: string;
  }>;
  declared: Record<string, string | number | null>;
  reportedEvents: PremiumLensContext['reportedEvents'];
  /**
   * 결정론 Cross-Lens 카드가 **화면에서 바로 위에** 이미 그린 문장들.
   *
   * ⚠️ 브라우저 실측에서 AI 블록이 그 카드의 테마 목록을 거의 그대로 다시 냈다
   * (`계획과 즉흥 사이 (MBTI, 사주, 별자리)`). 두 블록이 붙어 있어서 사용자는 같은
   * 내용을 두 번 읽는다 — 렌즈 Task가 `alreadySaid`로 막는 것과 같은 문제이고
   * (§31), Cross-Lens에만 그 필드가 없었다.
   */
  alreadySaid: string[];
}

export function buildCrossLensContext(input: {
  reports: readonly PremiumLensReport[];
  aiThemes: Partial<Record<PremiumLensKind, string | null>>;
  declared: DeclaredPreference;
  events: readonly RelationshipEvent[];
  tense: RelationshipTense;
  /** 결정론 Cross-Lens. 없으면 화면에 그 카드도 없다 */
  deterministic: PremiumCrossLens | null;
  targetExists: boolean;
}): CrossLensContext {
  const { reports, aiThemes, declared, events, tense, deterministic, targetExists } = input;

  /**
   * 사건은 **렌즈별 목록의 합집합**에서 앞 2개만. 여기서 다시 전체 목록을 보내면
   * §19가 막으려던 '모든 사건을 매 호출마다 반복 전송'이 Cross-Lens 한 곳에서
   * 되살아난다.
   */
  const seen = new Set<string>();
  const reportedEvents: PremiumLensContext['reportedEvents'] = [];
  for (const report of reports) {
    for (const event of eventsForLens(report.kind, events)) {
      if (seen.has(event.description)) continue;
      seen.add(event.description);
      reportedEvents.push(event);
      if (reportedEvents.length >= LENS_EVENT_LIMIT) break;
    }
    if (reportedEvents.length >= LENS_EVENT_LIMIT) break;
  }

  return {
    tense,
    targetExists,
    lenses: reports.map((report) => ({
      lens: report.kind,
      label: report.label,
      mode: report.mode,
      ...(report.selfReason ? { selfReason: report.selfReason } : {}),
      themes: report.themes.map((theme) => LENS_THEME_LABEL[theme]),
      aiTheme: aiThemes[report.kind] ?? null,
      computed: report.basis
        .slice(0, 2)
        .map((row) => `${row.label}: ${row.value}`)
        .join(' / '),
    })),
    declared: declaredForContext(declared),
    reportedEvents,
    /** 질문 3개는 넣지 않는다 — 같은 자리에 이미 있는 것은 테마 문장이다(토큰 §21) */
    alreadySaid: deterministic
      ? [...deterministic.repeatedThemes, ...deterministic.differences]
      : [],
  };
}
