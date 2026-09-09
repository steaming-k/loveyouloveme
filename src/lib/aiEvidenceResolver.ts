import { adaptiveOptionLabel } from '@/data/adaptive';
import { currentSignalLabel } from '@/data/currentRelationship';
import {
  currentEvidenceLabel,
  currentEvidencePrefix,
  type RelationshipTense,
} from '@/lib/logic/relationshipEvidence';
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
import { soloSnapshotSignalText } from '@/lib/logic/soloHistory';
import { withObjectParticle, withTopicParticle } from '@/lib/korean';
import type {
  CompatibilityResult,
  DeepAnalysisAnswer,
  EvidenceRef,
  MbtiLensReport,
  MbtiSelfLens,
  MirrorAxisKey,
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
  /**
   * v1.41 §39.9 — `관계 경험`(S15~S17 · 과거)과 **다른 라벨**이다. 같은 이름을 쓰면
   * 근거 목록에서 두 시점이 한 출처로 보이고, 그러면 `정보 N종`이 거짓이 된다.
   */
  | '지금 관계'
  /**
   * v1.42 §41.4 — 같은 근거를 `ended`에서 부르는 이름. **source는 그대로
   * `current_relationship`이고 `key`도 그대로다** — 바뀌는 것은 칩에 보이는 글자뿐이다
   * (SOURCE PROVENANCE ≠ NARRATIVE TENSE).
   */
  | '그때 이 관계'
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
  /**
   * **같은 문장인데 서로 다른 관찰**을 구분하는 값 (v1.35 · §13).
   *
   * 화면에 직접 나가지 않는다. `aggregateSameText`가 중복을 묶을 때, 문장이 같아도
   * 이 값이 다르면 **다른 관찰로 보고 묶지 않는다.** 그때는 `label`을 문장 뒤에 붙여
   * 두 줄이 왜 다른지 사용자가 확인할 수 있게 한다.
   *
   * ⚠️ 필요할 때만 붙는다. 값이 하나뿐인 그룹에는 label을 붙이지 않으므로,
   * 기존 근거 문장(대부분의 경우)은 **글자 하나도 달라지지 않는다.**
   */
  variant?: { key: string; label: string };
}

export interface EvidenceResolverContext {
  answers: SessionAnswers;
  validated: readonly ValidatedObservation[];
  /**
   * v1.42 §41.4 — 지금 관계 근거를 **부르는 시제**. `relationshipTenseOf(job)`이 만든다.
   *
   * ⚠️ **필수다.** v1.41까지 이 자리가 없어서 `resolveCurrentRelationship`이
   * `지금 관계에서`를 하드코딩했고, `ended` 사용자의 Premium 연결 근거 목록
   * (`connection.evidence[].text`)과 source 라벨 칩에 현재형이 남았다. 그 문자열은
   * fixture가 훑는 `renderedStrings`에 **없던 자리**라 검사되지 않았다 — §39.9와
   * 정확히 같은 실패 형태다.
   *
   * ⚠️ 기본값을 두지 않는다. `'current'`가 기본값이면 새 호출부가 조용히 현재형으로
   * 떨어지고, 그건 `ended` 사용자에게 가장 위험한 기본값이다(v1.40.1 §38.2).
   *
   * ⚠️ evidence를 **고르지 않는다.** 이미 정해진 근거를 부를 때 쓰는 호칭이다.
   */
  tense: RelationshipTense;
  historyEntries?: readonly RelationshipHistoryEntry[];
  /** v1.9 — Premium Adaptive Deep Question 답변. 없으면 target/deep_followup ref는 해석되지 않는다 */
  deepAnswers?: readonly DeepAnalysisAnswer[];
  /** v1.26 — 이미 계산된 동기화율 결과. 없으면 compatibility ref는 해석되지 않는다 */
  compatibility?: CompatibilityResult;
  /** v1.26 — 이미 계산된 MBTI 렌즈. 없으면 mbti_lens ref는 해석되지 않는다 */
  mbtiLens?: MbtiLensReport | null;
  /**
   * v1.32 P4-D — **상대 없이도 성향 렌즈 근거를 풀 수 있게 한다.**
   *
   * `mbtiLens`는 `buildMbtiLens(mine, theirs)`의 결과라 **양쪽 MBTI가 있어야** 만들어진다.
   * 그래서 Solo 사용자에게는 항상 null이었고, `mbti_lens` ref도 항상 해석되지 않았다.
   * 자기 MBTI만으로 만드는 `MbtiSelfLens`를 함께 받아 self-only 경로를 연다.
   *
   * ⚠️ 새 source를 만들지 않는다 — 같은 `mbti_lens` 어휘를 쓴다. 라벨('성향 렌즈')도,
   * `limitationFor`의 경계 문장('성향이 관계 행동을 결정한다는 뜻은 아니야')도 그대로다.
   */
  mbtiSelfLens?: MbtiSelfLens | null;
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

/* ------------------------------------------------- field alias (v1.43) */

/**
 * `declared` source의 field 별칭 → canonical key. (v1.43 · §46.2)
 *
 * ══ 왜 표로 빼는가 ═══════════════════════════════════════════════════════
 *
 * v1.42까지 이 별칭들은 `resolveDeclared`의 `switch` 안에 `case` 두 줄로만 있었다.
 * 별칭이 존재하는 이유는 `buildRelationshipContext`가 AI에게 `contactImportance` ·
 * `aloneNeed` 같은 이름으로 보내기 때문이고(`declaredForContext`), 모델은 자기가 본
 * 이름을 그대로 쓴다.
 *
 * v1.43이 근거 귀속 검사(`axis-subset`)를 켜면서 **같은 별칭 지식이 두 곳에 필요해졌다**:
 * resolve할 때와, 허용집합과 대조할 때. `switch`에만 있으면 대조 쪽이 별칭을 모르고,
 * 그러면 모델이 `contactImportance`를 정확히 인용했는데 검사가 떨어뜨린다 —
 * **정상 근거를 버리는 과필터**이고, v1.30이 "파서에 별칭을 늘리지 않고 모델이 받는
 * 어휘를 canonical key로 맞춘다"고 정한 방향과도 반대다.
 *
 * 그래서 표를 단일 source로 두고 `switch`가 이 표를 읽는다. 받는 값과 돌려주는 문장은
 * **v1.42와 글자 하나 다르지 않다** — 별칭 목록도 그대로다.
 */
const DECLARED_FIELD_ALIAS: Record<string, keyof SessionAnswers['declared']> = {
  contact: 'contact',
  contactImportance: 'contact',
  alone: 'alone',
  aloneNeed: 'alone',
  conflict: 'conflict',
  conflictStyle: 'conflict',
  affection: 'affection',
  affectionStyle: 'affection',
  hobby: 'hobby',
  hobbySharing: 'hobby',
};

/** `relationship` source의 field 별칭 → canonical key. `DECLARED_FIELD_ALIAS`와 같은 이유 */
const RELATIONSHIP_FIELD_ALIAS: Record<string, 'important' | 'hardest' | 'selfGap' | 'note'> = {
  important: 'important',
  importantFactors: 'important',
  hardest: 'hardest',
  hardestMoment: 'hardest',
  selfGap: 'selfGap',
  note: 'note',
};

/**
 * ref를 **비교 가능한 형태**로 정규화한다. (v1.43 · §46.2)
 *
 * ⚠️ **화면에 보이는 것을 바꾸지 않는다.** `resolveEvidenceRef`는 원본 ref를 그대로
 * 받고, 이 함수는 허용집합 대조(`evidenceRefKey`)에서만 쓰인다.
 *
 * ⚠️ 별칭을 모르는 source(`observed`·`history`·`compatibility` 등)는 **그대로 돌려준다** —
 * 모르는 값을 canonical로 만들어내지 않는다.
 */
export function canonicalEvidenceRef(ref: EvidenceRef): EvidenceRef {
  if (ref.source === 'declared') {
    const canonical = DECLARED_FIELD_ALIAS[ref.field];
    return canonical ? { source: 'declared', field: canonical } : ref;
  }
  if (ref.source === 'relationship') {
    const canonical = RELATIONSHIP_FIELD_ALIAS[ref.field];
    return canonical ? { source: 'relationship', field: canonical } : ref;
  }
  return ref;
}

/**
 * 허용집합 대조용 **키 순서에 무관한** 식별자. (v1.43 · §46.2)
 *
 * ⚠️ v1.42의 `evidenceRefsAreSubsetOf`는 `JSON.stringify(ref)`를 썼다. 그건 **키 순서에
 * 민감하다** — `{source,field}`와 `{field,source}`가 다른 키가 된다. 지금은 양쪽 다
 * `parseEvidenceRef`/우리 코드가 같은 순서로 만들어서 우연히 맞고 있었지만, 필드를 하나
 * 더 읽는 순간 조용히 깨지는 종류의 계약이다.
 */
export function evidenceRefKey(ref: EvidenceRef): string {
  const canonical = canonicalEvidenceRef(ref);
  switch (canonical.source) {
    case 'observed':
      return `observed:${canonical.traitId}`;
    case 'history':
      return `history:${canonical.entryId}:${canonical.axis}`;
    case 'deep_followup':
      return `deep_followup:${canonical.questionId}`;
    default:
      return `${canonical.source}:${canonical.field}`;
  }
}

/* --------------------------------------------------------- declared */

function resolveDeclared(field: string, answers: SessionAnswers): string | null {
  const { declared } = answers;

  switch (DECLARED_FIELD_ALIAS[field]) {
    case 'contact':
      return declared.contact === null ? null : `연락 중요도를 5점 중 ${declared.contact}로 답했어`;
    case 'alone':
      return declared.alone === null
        ? null
        : `혼자 있는 시간의 필요를 5점 중 ${declared.alone}로 답했어`;
    case 'conflict':
      return declared.conflict ? `갈등이 생기면 ${quoted(CONFLICT_LABEL[declared.conflict])} 골랐어` : null;
    case 'affection':
      return declared.affection
        ? `애정 표현은 ${quoted(AFFECTION_LABEL[declared.affection])} 골랐어`
        : null;
    case 'hobby':
      return declared.hobby ? `취미는 ${quoted(HOBBY_LABEL[declared.hobby])} 골랐어` : null;
    default:
      return null;
  }
}

/* --------------------------------------------- current relationship (v1.41) */

/**
 * 지금 관계 근거 하나를 문장으로 (v1.41 · §39.8)
 *
 * ⚠️ **우리가 요약하지 않는다.** 사용자가 S30 화면에서 실제로 읽고 고른 보기 문장을
 * 그대로 인용한다 — v1.36이 `DECLARED_PHRASE` 고정값에서 배운 것과 같은 규칙이다.
 * 답이 없으면 null이고, 그 ref는 근거 목록에서 조용히 빠진다(§35).
 *
 * ⚠️ `unsure`(아직 그런 상황이 없었어)도 **문장으로 만들지 않는다.** 답한 것은
 * 사실이지만 근거가 아니고, 근거 목록에 넣으면 개수를 채우는 셈이 된다.
 */
function resolveCurrentRelationship(
  field: string,
  answers: SessionAnswers,
  tense: RelationshipTense,
): string | null {
  const axis = MIRROR_AXES.find((item) => item.key === field);
  if (!axis) return null;

  const answer = answers.currentRelationship.signals[axis.key];
  if (answer === undefined || answer === 'unsure') return null;

  const label = currentSignalLabel(axis.key, answer);
  /**
   * v1.42 §41.4 — `지금 관계에서`를 하드코딩하지 않는다. 문구는
   * `currentEvidencePrefix(tense)` 하나에서만 나온다 — Mirror 행 문장과 **같은 함수**다.
   */
  /**
   * ⚠️ v1.42 — **`quoted()`를 쓰지 않는다.** 그 헬퍼는 목적격 조사(을/를)를 붙이므로
   * `~을 골랐어` 계열 문장에는 맞지만 여기서는 뒤에 `라고`가 온다. v1.41은 그대로
   * 써서 실제 화면에 `'바로 알아차리고 마음이 쓰여'를라고 답했어`가 나왔다 —
   * 이 문자열이 어떤 fixture의 검사 배열에도 없어서 아무도 보지 못했다(§41.4에서
   * `renderedStrings`를 넓히자 바로 드러났다).
   *
   * Mirror 행 문장(`relationshipSignalTextOf`)은 같은 자리에서 조사 없는 따옴표를
   * 쓴다 — 두 문장이 같은 답을 인용하므로 형태도 같아야 한다.
   */
  return label ? `${axis.label}에 대해 ${currentEvidencePrefix(tense)} '${label}'라고 답했어` : null;
}

/* ----------------------------------------------------- relationship */

function resolveRelationship(field: string, answers: SessionAnswers): string | null {
  const { experience } = answers;

  switch (RELATIONSHIP_FIELD_ALIAS[field]) {
    case 'important': {
      if (experience.important.length === 0) return null;
      const labels = experience.important.map((factor) => PAST_FACTOR_LABEL[factor]).join(' · ');
      return `실제 관계에서 중요했던 것으로 ${withObjectParticle(labels)} 골랐어`;
    }
    case 'hardest':
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

  const axisLabel = MIRROR_AXIS_LABEL.get(axis) ?? axis;

  /**
   * v1.35 P4-B §19 — **Solo 기록의 근거도 풀린다.**
   *
   * Solo 관찰에는 Mirror 판정이 없어서(`mirrorSnapshot.insights === []`) 이 함수는
   * 항상 null을 돌려줬다. 그래서 Solo History를 Premium의 독립 source로 쓰려 해도
   * 근거가 화면에 하나도 도달하지 못했다. 대신 그때 얼려둔 **단계 값**을 문장으로
   * 되돌린다 — 저장한 값 그대로이고, 새 해석을 만들지 않는다.
   */
  const soloLevel = entry.soloSnapshot?.signals.find((signal) => signal.axis === axis)?.level;
  if (soloLevel !== undefined && soloLevel !== 'unknown') {
    const text = soloSnapshotSignalText(axis as MirrorAxisKey, soloLevel);
    if (!text) return null;
    return {
      key: `history:${entryId}:${axis}`,
      sourceLabel: '과거 관찰',
      text: `${formatEntryDate(entry.createdAt)} 기록에서는 ${text}`,
    };
  }

  const snapshot = entry.mirrorSnapshot.insights.find((insight) => insight.axis === axis);
  if (!snapshot) return null;
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
    /**
     * §13 — 문장에 없는 정보가 판정이다. 판정이 다르면 다른 관찰이므로 묶지 않는다.
     * 라벨은 History 화면이 이미 쓰는 어휘와 같다.
     */
    variant: { key: snapshot.state, label: HISTORY_STATE_PHRASE[snapshot.state] },
  };
}

/**
 * 근거 문장에서 판정을 구분할 때 쓰는 라벨 (§13).
 *
 * ⚠️ `history.ts`의 `STATE_PHRASE`와 **같은 문장**이다. 같은 것을 두 어휘로 부르면
 * 사용자가 두 개의 다른 판정으로 읽는다.
 */
const HISTORY_STATE_PHRASE: Record<'MATCH' | 'GAP' | 'CHANGE', string> = {
  MATCH: '말한 기준과 비슷하게 나타남',
  GAP: '말한 기준보다 크게 반응함',
  CHANGE: '경험 후 우선순위가 옮겨짐',
};

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
    /**
     * v1.41 — `relationship`(과거)과 **나란히 놓인 별도 case**다. 하나로 합치면
     * `field`를 보고 시점을 추론하게 되고, 그 추론이 어긋나는 순간 근거 문장의
     * 시제가 거짓이 된다.
     */
    case 'current_relationship': {
      const text = resolveCurrentRelationship(ref.field, context.answers, context.tense);
      return text
        ? {
            key: `current_relationship:${ref.field}`,
            /**
             * v1.42 §41.4 — 칩 라벨도 시제를 따른다(`그때 이 관계`). `key`는 **그대로**다 —
             * React key이자 중복 제거 식별자이고, 시제 때문에 근거의 정체성이 달라지지
             * 않는다(§41.5 SOURCE PROVENANCE ≠ NARRATIVE TENSE).
             */
            sourceLabel: currentEvidenceLabel(context.tense),
            text,
          }
        : null;
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
      if (axis) {
        return {
          key: `mbti_lens:${ref.field}`,
          sourceLabel: '성향 렌즈',
          text: axis.same
            ? `${axis.label} — 둘 다 ${axis.mineLetter}`
            : `${axis.label} — ${axis.mineLetter} × ${axis.theirsLetter}`,
        };
      }
      /**
       * v1.32 P4-D — 상대 MBTI가 없으면 **내 글자만** 말한다.
       * 상대를 추측해 채우지 않는다 — 없는 쪽은 문장에도 없다.
       */
      const selfAxis = context.mbtiSelfLens?.axes.find((item) => item.key === ref.field);
      if (!selfAxis) return null;
      return {
        key: `mbti_lens:${ref.field}`,
        sourceLabel: '성향 렌즈',
        text: `${selfAxis.label} — 나는 ${selfAxis.letter}`,
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

  return aggregateSameText(result);
}

/**
 * **같은 문장이 여러 줄 나오지 않게 묶는다** (v1.34 · P4-C)
 *
 * v1.31에서 React duplicate key는 고쳤지만 **콘텐츠 중복은 남아 있었다.**
 * `fromRepeatedSignal`이 기록마다 history ref를 하나씩 만들고, 근거 문장은
 * `{날짜} 기록에서도 {축} 축에 {신호}`다 — **같은 날 저장된 기록끼리는 날짜도 같아**
 * 글자 하나까지 동일해진다. 사용자에게는 같은 줄이 세 번 보인다(실측).
 *
 * ⚠️ **중복을 지우면서 개수 정보를 잃지 않는다.** 3줄을 1줄로 줄이되 몇 번의 관찰에서
 * 나왔는지를 문장에 남긴다 — 그게 원래 이 근거가 말하려던 것이다.
 *
 * ⚠️ **날짜만으로 묶지 않는다.** 서로 다른 snapshot이 같은 날일 수 있고, 같은 날이어도
 * 값이 다르면 다른 관찰이다. 묶는 기준은 **문장 자체가 완전히 같은가**이고, 문장에는
 * 이미 source·축·값·날짜가 모두 들어 있다.
 *
 * ⚠️ 반복 어휘를 쓰지 않는다. 여기서 말하는 것은 "같은 근거가 N번 나왔다"는 사실뿐이고,
 * '꾸준히/계속' 같은 해석은 규칙 문장(`ruleSummary`)의 몫이다(§41 — UI가 반복이라
   말하는데 logic이 1회로 세는 불일치를 막는다).
 */
function aggregateSameText(items: readonly ResolvedEvidence[]): ResolvedEvidence[] {
  /** 문장 → (variant key → 그 variant의 첫 항목과 개수) */
  const byText = new Map<string, Map<string, { item: ResolvedEvidence; count: number }>>();

  for (const item of items) {
    const variants = byText.get(item.text) ?? new Map();
    const variantKey = item.variant?.key ?? '';
    const found = variants.get(variantKey);
    if (found) found.count += 1;
    else variants.set(variantKey, { item, count: 1 });
    byText.set(item.text, variants);
  }

  const result: ResolvedEvidence[] = [];

  for (const variants of byText.values()) {
    /**
     * ⚠️ v1.35 §13 실측으로 고쳤다 — **같은 날짜 · 같은 문장인데 판정이 다른 관찰이
     * 하나로 묶였다.**
     *
     * History 근거 문장은 `{날짜} 기록에서도 {축} 축에 {신호}`인데, 여기 **Mirror
     * 판정(GAP/MATCH/CHANGE)이 들어 있지 않다.** 그래서 같은 날 저장된 두 기록이
     * 같은 관계 경험 근거를 갖고 판정만 다를 때, 화면에는 서로 다른 두 관찰이
     * "(관찰 2회)" 한 줄로 합쳐졌다 — 실제로 반복된 적 없는 것을 반복으로 세는 것이다.
     *
     * 그래서 묶는 기준을 **문장 + variant**로 바꿨다. variant가 갈리는 그룹에서만
     * 라벨을 덧붙이므로, 판정이 하나뿐인 대부분의 근거 문장은 그대로다.
     */
    const needsLabel = variants.size > 1;

    for (const { item, count } of variants.values()) {
      const base = needsLabel && item.variant ? `${item.text} · ${item.variant.label}` : item.text;
      result.push({
        ...item,
        // 근거가 몇 개로 줄었는지는 화면이 알 필요 없다 — 문장이 사실을 말한다.
        text: count === 1 ? base : `${base} (관찰 ${count}회)`,
      });
    }
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

/* ────────────── USER CORRECTION TRUST BOUNDARY (v1.43 · §48) ────────────── */

/**
 * 사용자가 Core 판정을 직접 고쳤을 때, **AI의 Core 서술은 화면에 도달하지 않는다.**
 *
 * ══ 무엇이 문제였나 ═══════════════════════════════════════════════════════
 *
 * S28에서 사용자가 `조금 달라`를 누르고 자기 문장을 쓰면 `coreCorrection`이 저장되고,
 * `mirror/page.tsx`가 headline을 **그 문장으로 교체**한다.
 *
 * ```
 * headline = answers.coreCorrection.trim() || aiHeadline || mirror.core.headline
 * ```
 *
 * 그런데 바로 아래 `CoreInsightNarrativeView`는 `core.summary`를 **그대로** 그렸다.
 * 실측으로 재현된 화면(v1.43 §48.2):
 *
 * ```
 * headline (사용자)  "연락 자체가 아니라 혼자 있는 시간이 줄어드는 게 힘들었어."
 * 배지               "네가 고친 문장이야."
 * AI summary         "연락은 중요하지 않다고 느꼈지만, 실제로는 연락 감소가 힘들었던
 *                     경험이 있었어."
 * ```
 *
 * 사용자가 **연락 자체가 아니라고 명시적으로 부정한 판정**을, AI가 두 줄 아래에서 다시
 * 주장한다.
 *
 * ══ 왜 headline만 바꾸는 것으로 부족한가 ══════════════════════════════════
 *
 * `core.summary`는 독립된 관찰이 아니다 — **AI가 만든 `core.headline`을 설명하는
 * 문장**이다. headline이 사용자 문장으로 교체되면 그 summary는 **화면에 있는 headline을
 * 설명하지 않는다.** 다른 문장을 설명하는 문장이 근거 목록과 함께 남는 것이고, 그건
 * §35(근거 없이 말하지 않는다)가 금지하는 상태다.
 *
 * > **화면의 headline과 그 아래 AI 설명은 같은 출처여야 한다.**
 *
 * ══ 왜 AI에게 correction을 보내서 다시 쓰게 하지 않는가 ═══════════════════
 *
 * 두 가지 이유이고, 둘 다 편의가 아니다.
 *
 *  ① **Privacy.** `coreCorrection`은 자유서술이다(textarea · 120자). 현재 Provider로
 *    가는 자유서술은 셋뿐이고(`experience.note` 300자 · `observations[].correctedText`
 *    120자 · Deep Followup `custom` 120자) 전부 **그 답 자체가 근거**인 경우다. Core
 *    correction은 근거가 아니라 **판정에 대한 반론**이므로 같은 예외에 해당하지 않는다.
 *    보내지 않으면 privacy 표면이 하나도 늘지 않는다.
 *
 *  ② **더 중요한 이유 — 사용자 문장을 AI가 확장하게 만들지 않는다.** 한 문장을 주고
 *    "이걸 설명해라"고 하면 모델은 반드시 그 문장 **밖으로** 나간다. 사용자가 쓴
 *    범위만 authoritative인데, AI가 그것을 새 심리 판정으로 키우면 v1.43이 닫은
 *    `AI_OUTPUT ⊆ DETERMINISTIC_EVIDENCE`가 정확히 반대 방향으로 뚫린다 —
 *    **사용자 입력을 근거 삼아 없던 해석을 만드는 것**이다.
 *
 * ══ 왜 서버에서 지우지 않는가 ═════════════════════════════════════════════
 *
 * 응답에서 `core`를 지우면 `aiHeadline`이 `null`이 되고, 그러면 History가 기록하는
 * `coreInsightOriginal`이 **결정론 headline으로 떨어진다**(`aiHeadline ?? mirror.core.headline`).
 * 즉 **사용자가 실제로 거부한 문장이 기록에서 사라진다.** History는 `original`과
 * `userCorrection`을 나란히 남기는 자리이므로(§5.2) 그 충실성이 이 게이트보다 먼저다.
 *
 * 그래서 payload는 그대로 두고 **렌더 경로만** 막는다.
 *
 * ══ 게이트를 화면에 두지 않는다 ═══════════════════════════════════════════
 *
 * v1.43 §8.14가 세운 규칙 그대로다 — 페이지에 `if (correction) hide`를 만들면
 * **게이트를 통과하지 않는 렌더 지점**이 생기고, 그게 compatibility 질문 누출의 형태였다.
 * 이 함수가 **유일한 통로**이고, `core.summary`가 이 함수를 거치지 않고 화면에 닿는지는
 * 구조 검사 CC7이 확인한다.
 *
 * ⚠️ **축별 narrative는 건드리지 않는다.** 사용자가 부정한 것은 Core 판정 하나이고,
 * 축별 설명은 각자의 결정론 판정을 설명한다 — 함께 지우면 과필터다(§27 AI는 augmentation).
 *
 * ⚠️ **`coreVerdict === 'no'`만으로는 막지 않는다.** 사용자가 `조금 달라`를 누르고
 * 아무것도 쓰지 않으면 headline은 여전히 AI 문장이다. 그때 summary만 지우면 **설명 없는
 * headline**이 남는다 — headline과 설명이 같은 출처여야 한다는 규칙을 그 방향으로도
 * 어긴다. 기준은 **headline이 교체되었는가**, 즉 correction의 존재다.
 */
export function coreNarrativeForRender<T extends { summary: string }>(
  core: T | null | undefined,
  answers: SessionAnswers,
): T | null {
  if (!core) return null;
  return answers.coreCorrection.trim().length > 0 ? null : core;
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