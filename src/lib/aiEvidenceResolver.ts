import { adaptiveOptionLabel } from '@/data/adaptive';
import { AXIS_DEFINITIONS, MIRROR_AXES } from '@/data/axes';
import { DEEP_QUESTION_BANK, type DeepQuestionTemplate } from '@/data/deepQuestions';
import {
  AFFECTION_LABEL,
  CONFLICT_LABEL,
  HARDEST_LABEL,
  HOBBY_LABEL,
  PAST_FACTOR_LABEL,
  SELF_GAP_LABEL,
} from '@/data/labels';
import { formatEntryDate } from '@/lib/historyFormat';
import { withObjectParticle, withTopicParticle } from '@/lib/korean';
import type {
  CompatibilityResult,
  DeepAnalysisAnswer,
  EvidenceRef,
  MbtiLensReport,
  RelationshipHistoryEntry,
  SessionAnswers,
  TargetAxisKey,
  ValidatedObservation,
} from '@/types';

/**
 * EvidenceRef Resolver (v1.7 · §34 · §35 · §73 · §74 · §75)
 *
 * AI가 근거 문장을 **직접 써서 보여주게 하지 않는다.** AI는 '어디를 봤는지'(`EvidenceRef`)만
 * 지목하고, 화면에 보이는 근거 텍스트는 이 함수가 **실제 세션 데이터에서** 만든다.
 * 그래서 AI가 근거를 그럴듯하게 지어내도 UI에 도달할 수 없다.
 *
 * ⚠️ 신뢰 우선순위(§74) — 이 순서는 뒤집히지 않는다:
 *   USER DIRECT INPUT > USER CORRECTION > RELATIONSHIP EXPERIENCE
 *     > AI OBSERVATION > PAST AI OBSERVATION
 *
 * ⚠️ 현재 세션에 존재하지 않는 ref는 **렌더하지 않는다**(§35).
 *   유효한 근거가 하나도 남지 않으면 호출자가 Narrative 자체를 fallback으로 내린다.
 */

/** 사용자에게 보여주는 근거 출처 라벨 (§73) */
export type EvidenceSourceLabel =
  | '내가 답한 내용'
  | '관계 경험'
  | '추가 질문'
  | '사진에서 관찰'
  | '사용자 수정'
  | '과거 관찰'
  | '상대에 대해 입력한 내용'
  | '정밀 관찰 추가 답변'
  /** v1.26 — 이미 계산된 동기화율 축 판정 */
  | '동기화율 비교'
  /** v1.26 — MBTI 성향 렌즈 */
  | '성향 렌즈';

export interface ResolvedEvidence {
  key: string;
  sourceLabel: EvidenceSourceLabel;
  text: string;
}

export interface EvidenceResolverContext {
  answers: SessionAnswers;
  validated: readonly ValidatedObservation[];
  historyEntries?: readonly RelationshipHistoryEntry[];
  /** v1.9 — Premium Adaptive Deep Question 답변. 없으면 target/deep_followup ref는 해석되지 않는다 */
  deepAnswers?: readonly DeepAnalysisAnswer[];
  /** v1.26 — 이미 계산된 동기화율 결과. 없으면 compatibility ref는 해석되지 않는다 */
  compatibility?: CompatibilityResult;
  /** v1.26 — 이미 계산된 MBTI 렌즈. 없으면 mbti_lens ref는 해석되지 않는다 */
  mbtiLens?: MbtiLensReport | null;
}

const MIRROR_AXIS_LABEL = new Map(MIRROR_AXES.map((axis) => [axis.key as string, axis.label]));

/**
 * 선택지를 따옴표로 감싸고 목적격 조사를 붙인다.
 *
 * 라벨에 '적당히 주고받기'(받침 없음)와 '오늘 안에 이야기'(받침 없음), '담백한 편'(받침 있음)이
 * 섞여 있어서 '을'을 하드코딩하면 "'적당히 주고받기'을 골랐어"가 된다.
 * 조사는 따옴표가 아니라 **마지막 글자**를 기준으로 정해져야 하므로 라벨로 판정한다.
 */
function quoted(label: string): string {
  return `'${label}'${withObjectParticle(label).slice(label.length)}`;
}

/**
 * 서술격 조사 이야/야. `withObjectParticle` 계열과 달리 받침 유무로 '이야'와 '야'를 고른다.
 * ('뜸한 편' → '이야' · '자주' → '야')
 */
function copula(word: string): string {
  const last = word.trim().at(-1);
  if (!last) return '야';
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '야';
  return (code - 0xac00) % 28 !== 0 ? '이야' : '야';
}

/* --------------------------------------------------------- declared */

function resolveDeclared(field: string, answers: SessionAnswers): string | null {
  const { declared } = answers;

  switch (field) {
    case 'contact':
    case 'contactImportance':
      return declared.contact === null ? null : `연락 중요도를 5점 중 ${declared.contact}로 답했어`;
    case 'alone':
    case 'aloneNeed':
      return declared.alone === null
        ? null
        : `혼자 있는 시간의 필요를 5점 중 ${declared.alone}로 답했어`;
    case 'conflict':
    case 'conflictStyle':
      return declared.conflict ? `갈등이 생기면 ${quoted(CONFLICT_LABEL[declared.conflict])} 골랐어` : null;
    case 'affection':
    case 'affectionStyle':
      return declared.affection
        ? `애정 표현은 ${quoted(AFFECTION_LABEL[declared.affection])} 골랐어`
        : null;
    case 'hobby':
    case 'hobbySharing':
      return declared.hobby ? `취미는 ${quoted(HOBBY_LABEL[declared.hobby])} 골랐어` : null;
    default:
      return null;
  }
}

/* ----------------------------------------------------- relationship */

function resolveRelationship(field: string, answers: SessionAnswers): string | null {
  const { experience } = answers;

  switch (field) {
    case 'important':
    case 'importantFactors': {
      if (experience.important.length === 0) return null;
      const labels = experience.important.map((factor) => PAST_FACTOR_LABEL[factor]).join(' · ');
      return `실제 관계에서 중요했던 것으로 ${withObjectParticle(labels)} 골랐어`;
    }
    case 'hardest':
    case 'hardestMoment':
      return experience.hardest ? HARDEST_LABEL[experience.hardest] : null;
    case 'selfGap':
      return experience.selfGap
        ? `연애 전 생각한 나와 실제 연애 속 나에 대해 ${quoted(SELF_GAP_LABEL[experience.selfGap])} 골랐어`
        : null;
    case 'note':
      // 자유서술 원문은 근거 목록에 그대로 펼치지 않는다 — 사용자가 적었다는 사실만 말한다.
      return experience.note.trim().length > 0 ? '직접 적어준 관계 경험 메모가 있어' : null;
    default:
      return null;
  }
}

/* ---------------------------------------------------------- adaptive */

function resolveAdaptive(answers: SessionAnswers): string | null {
  const { adaptive } = answers.experience;
  if (!adaptive) return null;
  const axisLabel = MIRROR_AXIS_LABEL.get(adaptive.axis) ?? adaptive.axis;
  return `${axisLabel} 추가 질문에서 ${quoted(adaptiveOptionLabel(adaptive.axis, adaptive.optionId))} 골랐어`;
}

/* ---------------------------------------------------------- observed */

/**
 * §75 — 사용자 수정이 AI 원본을 **이긴다.**
 * 사용자가 '평소에는 집에 있는 걸 좋아한다'고 고쳤으면, 근거로 보여주는 문장도 그 문장이다.
 */
function resolveObserved(
  traitId: string,
  validated: readonly ValidatedObservation[],
): ResolvedEvidence | null {
  const found = validated.find((item) => item.original.id === traitId);
  if (!found) return null;
  // 사용자가 분석에서 제외한 관찰은 근거로 쓰지 않는다(§14).
  if (found.status === 'excluded') return null;

  const correction = found.userCorrection?.trim();
  if (correction) {
    return { key: `observed:${traitId}`, sourceLabel: '사용자 수정', text: correction };
  }
  return {
    key: `observed:${traitId}`,
    sourceLabel: '사진에서 관찰',
    text: found.original.observation,
  };
}

/* ----------------------------------------------------------- history */

function resolveHistory(
  entryId: string,
  axis: string,
  entries: readonly RelationshipHistoryEntry[],
): ResolvedEvidence | null {
  const entry = entries.find((item) => item.id === entryId);
  if (!entry) return null;

  const snapshot = entry.mirrorSnapshot.insights.find((insight) => insight.axis === axis);
  if (!snapshot) return null;

  const axisLabel = MIRROR_AXIS_LABEL.get(axis) ?? axis;
  /**
   * v1.26 History 실측에서 고쳤다 — 문장에 **어느 기록인지가 없었다.**
   *
   * 반복 신호 연결은 "이전 관찰에서도 반복해서 나온 축"이라고 말하면서 근거로 기록 2건을
   * 건다. 그런데 두 줄의 텍스트가 완전히 같아서(둘 다 "이전 기록에서도 …") 사용자에게는
   * 중복 버그처럼 보이고, **'2번'을 확인할 방법이 없었다.** 기록 날짜를 붙여 각 근거가
   * 서로 다른 관찰이라는 사실이 화면에서 확인되게 한다.
   */
  return {
    key: `history:${entryId}:${axis}`,
    sourceLabel: '과거 관찰',
    text: `${formatEntryDate(entry.createdAt)} 기록에서도 ${axisLabel} 축에 ${snapshot.relationshipSignal}`,
  };
}

/* ------------------------------------------------------------- target */

/** 상대 정보는 '사용자가 알고 있다고 입력한 값'이다 — 그렇게 고지한다(§28) */
function resolveTarget(field: string, answers: SessionAnswers): string | null {
  const def = AXIS_DEFINITIONS.find((item) => item.key === field);
  if (!def) return null;
  const level = answers.target[field as TargetAxisKey];
  if (level === 'x') return null;
  /**
   * v1.26 Audit — 예전에는 `quoted()`(목적격 을/를)를 쓰고 뒤에 `이야`를 붙여서
   * **"연락 방식 '뜸한 편'을이야"** 가 화면에 나왔다(Deep Report 근거 목록에서 실측).
   * 목적격이 아니라 서술이므로 축 라벨에 주제격(은/는)을, 값에는 서술격(이야/야)을 붙인다.
   */
  const phrase = def.theirsPhrase[level];
  return `네가 입력한 상대 정보로는 ${withTopicParticle(def.label)} '${phrase}'${copula(phrase)}`;
}

/* ------------------------------------------------------- deep_followup */

function findDeepQuestionTemplate(questionId: string): DeepQuestionTemplate | null {
  for (const bank of Object.values(DEEP_QUESTION_BANK)) {
    const found = bank.find((item) => item.id === questionId);
    if (found) return found;
  }
  return null;
}

/**
 * 정밀 관찰 답변을 근거 문장으로 옮긴다.
 *
 * ⚠️ **Privacy — 이 함수만 자유서술 원문을 통과시킨다(120자 상한).**
 *
 * 다른 자유서술은 전부 막혀 있다. `experience.note`는 내용 대신 "직접 적어준 메모가
 * 있어"라는 사실만 내보내고, declared/target/relationship은 저장된 라벨·점수만
 * 문장으로 만든다. 여기만 예외인 이유는 **그 답 자체가 근거**라서다 — `custom`
 * 선택지는 라벨이 없고 사용자가 쓴 문장이 곧 답이다. 지우면 AI가 설명할 대상이
 * 사라지고 근거 없는 문장만 남는다.
 *
 * 그래서 경계는 "보내지 않는다"가 아니라 **어디까지 보내는가**로 잡는다:
 *   - 목적지는 AI Provider **뿐**이다. 외부 Analytics로는 나가지 않는다
 *     (`sanitizeForExternal` + `EXTERNAL_FORBIDDEN_KEYS`).
 *   - 120자에서 자른다. 근거로 인용하기엔 충분하고, 긴 서술을 통째로 넘기지 않는다.
 *
 * 이 사실은 기능명세서 §24.11(Privacy — AI Provider로 가는 것)에 그대로 적혀 있다.
 * **코드와 문서 중 한쪽만 바뀌면 안 된다.**
 */
function deepAnswerValueText(answer: DeepAnalysisAnswer, template: DeepQuestionTemplate | null): string | null {
  const { value } = answer;
  const optionLabel = (id: string): string | null => {
    const option = template?.options?.find((item) => item.id === id);
    return option && option.id !== 'custom' ? option.label : null;
  };

  if (Array.isArray(value)) {
    const labels = value.map((id) => optionLabel(id) ?? id).filter((text) => text.trim().length > 0);
    return labels.length > 0 ? labels.join(' · ') : null;
  }
  if (typeof value === 'number') return `${value}`;

  const trimmed = value.trim();
  if (!trimmed) return null;
  return optionLabel(trimmed) ?? trimmed.slice(0, 120);
}

function resolveDeepFollowup(
  questionId: string,
  deepAnswers: readonly DeepAnalysisAnswer[],
): ResolvedEvidence | null {
  const answer = deepAnswers.find((item) => item.questionId === questionId);
  if (!answer) return null;
  const template = findDeepQuestionTemplate(questionId);
  const valueText = deepAnswerValueText(answer, template);
  if (!valueText) return null;

  const prompt = template?.prompt;
  const text = prompt ? `'${prompt}'에 ${quoted(valueText)} 답했어` : `추가 질문에 ${quoted(valueText)} 답했어`;
  return { key: `deep_followup:${questionId}`, sourceLabel: '정밀 관찰 추가 답변', text };
}

/* --------------------------------------------------------- resolver */

export function resolveEvidenceRef(
  ref: EvidenceRef,
  context: EvidenceResolverContext,
): ResolvedEvidence | null {
  switch (ref.source) {
    case 'declared': {
      const text = resolveDeclared(ref.field, context.answers);
      return text ? { key: `declared:${ref.field}`, sourceLabel: '내가 답한 내용', text } : null;
    }
    case 'relationship': {
      const text = resolveRelationship(ref.field, context.answers);
      return text ? { key: `relationship:${ref.field}`, sourceLabel: '관계 경험', text } : null;
    }
    case 'adaptive': {
      const text = resolveAdaptive(context.answers);
      return text ? { key: `adaptive:${ref.field}`, sourceLabel: '추가 질문', text } : null;
    }
    case 'observed':
      return resolveObserved(ref.traitId, context.validated);
    case 'history':
      return resolveHistory(ref.entryId, ref.axis, context.historyEntries ?? []);
    case 'target': {
      const text = resolveTarget(ref.field, context.answers);
      return text ? { key: `target:${ref.field}`, sourceLabel: '상대에 대해 입력한 내용', text } : null;
    }
    case 'deep_followup':
      return resolveDeepFollowup(ref.questionId, context.deepAnswers ?? []);
    /**
     * v1.26 — 동기화율/성향 렌즈 근거.
     *
     * ⚠️ 여기서 **다시 계산하지 않는다.** context에 담겨 온 이미 계산된 결과의
     * 저장 label만 문장으로 옮긴다. 값이 없으면 null이라 근거 목록에서 조용히 빠진다.
     */
    case 'compatibility': {
      const dimension = context.compatibility?.dimensions.find(
        (item) => item.key === ref.field,
      );
      if (!dimension || dimension.alignment === null) return null;
      return {
        key: `compatibility:${ref.field}`,
        sourceLabel: '동기화율 비교',
        text: `${dimension.label} — 나: ${dimension.minePhrase} · 상대: ${dimension.theirsPhrase}`,
      };
    }
    case 'mbti_lens': {
      const axis = context.mbtiLens?.axes.find((item) => item.key === ref.field);
      if (!axis) return null;
      return {
        key: `mbti_lens:${ref.field}`,
        sourceLabel: '성향 렌즈',
        text: axis.same
          ? `${axis.label} — 둘 다 ${axis.mineLetter}`
          : `${axis.label} — ${axis.mineLetter} × ${axis.theirsLetter}`,
      };
    }
    default:
      return null;
  }
}

/**
 * 여러 ref를 화면용 근거 목록으로 바꾼다.
 * 해석 불가한 ref는 조용히 빠지고, 같은 근거가 중복되면 하나만 남긴다.
 */
export function resolveEvidenceRefs(
  refs: readonly EvidenceRef[],
  context: EvidenceResolverContext,
): ResolvedEvidence[] {
  const seen = new Set<string>();
  const result: ResolvedEvidence[] = [];

  for (const ref of refs) {
    const resolved = resolveEvidenceRef(ref, context);
    if (!resolved || seen.has(resolved.key)) continue;
    seen.add(resolved.key);
    result.push(resolved);
  }

  return result;
}

/**
 * §35 — 유효한 근거가 하나도 없고 한계 문장도 없으면 그 Narrative를 보여주지 않는다.
 * '근거 없이 말하지 않는다'는 원칙을 화면 직전에 한 번 더 확인하는 지점이다.
 */
export function narrativeIsShowable(
  narrative: { evidenceRefs: readonly EvidenceRef[]; uncertainty?: string },
  context: EvidenceResolverContext,
): boolean {
  if (resolveEvidenceRefs(narrative.evidenceRefs, context).length > 0) return true;
  return Boolean(narrative.uncertainty?.trim());
}

/**
 * 화면에 **실제로 그려질** Narrative가 하나라도 있는지 (v1.28)
 *
 * `narrativeIsShowable`은 문장 1개를 보는데, 화면은 "이 섹션에 AI 설명이 있는가"를
 * 알아야 할 때가 있다 — `AI 설명` 배지가 그렇다. 배지가 `mode === real`만 보고 붙으면
 * **Provider는 성공했지만 그릴 문장이 하나도 없는 상태**에서 배지만 남는다.
 * 없는 것을 있다고 표시하는 것이라 이 제품에서 가장 하면 안 되는 종류의 거짓이다.
 *
 * ⚠️ 판정을 화면마다 다시 쓰지 않기 위해 여기 둔다. **렌더러와 같은 술어**
 * (`narrativeIsShowable`)를 쓰는 것이 핵심이다 — 배지와 본문이 다른 기준을 보면
 * 언젠가 반드시 어긋난다.
 *
 * @param match 그 섹션이 실제로 그리는 항목만 고르는 조건(축 등). 없으면 전체.
 */
export function hasShowableNarrative<
  T extends { evidenceRefs: readonly EvidenceRef[]; uncertainty?: string },
>(
  narratives: readonly T[] | undefined,
  context: EvidenceResolverContext,
  match?: (item: T) => boolean,
): boolean {
  if (!narratives || narratives.length === 0) return false;
  return narratives.some(
    (item) => (match ? match(item) : true) && narrativeIsShowable(item, context),
  );
}