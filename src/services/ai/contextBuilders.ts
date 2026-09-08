import { adaptiveOptionLabel } from '@/data/adaptive';
import { AXIS_DEFINITIONS, MIRROR_AXES } from '@/data/axes';
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
  targetRelation: string | null;
}

export function buildCompatibilityContext(result: CompatibilityResult): CompatibilityContext {
  const goodKeys = new Set(result.goodSignals.map((signal) => signal.key));
  const frictionKeys = new Set(result.frictionSignals.map((signal) => signal.key));

  return {
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
    // 상대는 '관계 맥락'만. 이름·출생정보 등은 보내지 않는다.
    targetRelation: null,
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
  changes: Array<{
    axis: string;
    label: string;
    state: string;
    previousText: string | null;
    currentText: string | null;
    declaredDelta: { past: number; now: number } | null;
  }>;
}

export function buildHistoryContext(changes: readonly HistoryAxisChange[]): HistoryContext {
  return {
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

  return { insights: built };
}

/** Mirror 축 라벨 — 화면·프롬프트에서 공통으로 쓴다 */
export const MIRROR_AXIS_LABELS = MIRROR_AXES;
