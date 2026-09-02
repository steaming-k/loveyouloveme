import type {
  CompatibilityResult,
  CrossSourceInsight,
  DeclaredPreference,
  DeepAnalysisAnswer,
  HistoryAxisChange,
  MirrorAxisKey,
  RelationshipExperience,
  RelationshipHistoryEntry,
  RelationshipStatus,
  TargetProfile,
  ValidatedObservation,
} from '@/types';

/**
 * AI Narrative 입력 지문 (v1.7 · §8 · §42)
 *
 * 각 Narrative는 **자기 입력이 바뀔 때만** 다시 생성된다. 지문이 같으면 캐시를 쓰고,
 * 지문이 달라지면 이전 응답은 stale로 버린다(§41).
 *
 * ⚠️ 여기에 절대 넣지 않는 것 — 넣으면 위계가 무너진다:
 *   - MBTI          (Supporting Lens · Core 설명을 무효화시키지 않는다)
 *   - Birth Profile (Entertainment Lens)
 *   - Premium Intent / 가격 variant (결제 의향이 분석을 흔들지 않는다)
 *   - 사진 원본 (Observed Task의 지문은 `imagePrep.photoFingerprint`가 따로 만든다)
 *
 * 즉 MBTI를 입력하거나 Premium을 눌러도 Core AI 설명은 재호출되지 않는다.
 */

/** 값 목록을 안정적인 짧은 문자열로 만든다. 원문을 그대로 남기지 않는다 */
function digest(parts: readonly (string | number | null | undefined)[]): string {
  const joined = parts.map((part) => (part === null || part === undefined ? '-' : part)).join('|');

  // 문자열 해시(FNV-1a 변형). 암호학적 용도가 아니라 '같은 입력인가'만 판단한다.
  let hash = 0x811c9dc5;
  for (let i = 0; i < joined.length; i += 1) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function declaredParts(declared: DeclaredPreference): (string | number | null)[] {
  return [declared.contact, declared.conflict, declared.alone, declared.affection, declared.hobby];
}

/**
 * Compatibility Narrative — Declared + Target + **계산된 dimensions**가 기준이다.
 * 계산 결과를 넣는 이유: 같은 입력이라도 규칙이 바뀌면 설명도 다시 만들어야 한다.
 */
export function compatibilityNarrativeFingerprint(
  declared: DeclaredPreference,
  target: TargetProfile,
  result: CompatibilityResult,
): string {
  return `cmp_${digest([
    ...declaredParts(declared),
    target.relation,
    target.contact,
    target.conflict,
    target.alone,
    target.affection,
    result.score,
    result.comparedCount,
    ...result.dimensions.map((dimension) => `${dimension.key}:${dimension.alignment ?? '-'}`),
  ])}`;
}

/**
 * Relationship Narrative — Declared + Experience + Adaptive + focusAxis +
 * **사용자가 검증한 관찰**이 기준이다.
 *
 * S09에서 관찰을 고치거나 제외하면 지문이 바뀌어 설명이 다시 만들어진다(§42).
 */
export function relationshipNarrativeFingerprint(input: {
  status: RelationshipStatus | null;
  declared: DeclaredPreference;
  experience: RelationshipExperience;
  focusAxis: MirrorAxisKey | null;
  validated: readonly ValidatedObservation[];
}): string {
  const { status, declared, experience, focusAxis, validated } = input;

  return `rel_${digest([
    status,
    ...declaredParts(declared),
    ...experience.important,
    experience.hardest,
    experience.selfGap,
    // 자유서술은 원문이 아니라 길이만 — 지문에 사용자 문장을 남기지 않는다.
    experience.note.trim().length,
    experience.skipped ? 'skip' : 'kept',
    experience.adaptive ? `${experience.adaptive.axis}:${experience.adaptive.optionId}` : null,
    focusAxis,
    // 관찰은 id + 상태 + 수정 여부까지. 수정 원문은 넣지 않는다.
    ...validated.map(
      (item) => `${item.original.id}:${item.status}:${item.userCorrection ? 'c' : '-'}`,
    ),
  ])}`;
}

/**
 * History Narrative — 비교 대상 Entry id + **규칙이 판정한 변화 상태**가 기준이다.
 *
 * MBTI snapshot만 바뀐 경우에는 changes가 그대로이므로 지문도 바뀌지 않는다(§79 CASE Q).
 */
export function historyNarrativeFingerprint(
  entries: readonly RelationshipHistoryEntry[],
  changes: readonly HistoryAxisChange[],
): string {
  return `his_${digest([
    entries.length,
    ...entries.slice(-2).map((entry) => entry.id),
    ...changes.map((change) => `${change.axis}:${change.state}`),
  ])}`;
}

/**
 * Deep Report Narrative — Cross-source Insight 목록 자체(id·type·strength)와,
 * 그 근거의 **실제 내용**이 바뀌는 지점(관찰 수정, 상대 정보, Deep Followup 답변)이 기준이다.
 *
 * ⚠️ evidenceRefs는 '어디를 봤는지'일 뿐 텍스트를 담지 않는다. 그래서 예를 들어 사용자가
 * observed trait을 수정해도 ref 자체는 안 바뀐다 — validated의 correction 여부를 별도로
 * 넣어야 "같은 근거인데 내용이 달라졌다"를 지문이 알 수 있다(§40 Evidence Revision).
 */
export function deepReportFingerprint(input: {
  insights: readonly CrossSourceInsight[];
  declared: DeclaredPreference;
  target: TargetProfile;
  validated: readonly ValidatedObservation[];
  deepAnswers: readonly DeepAnalysisAnswer[];
}): string {
  const { insights, declared, target, validated, deepAnswers } = input;

  return `dr_${digest([
    ...insights.map((insight) => `${insight.id}:${insight.type}:${insight.strength}`),
    ...declaredParts(declared),
    target.contact,
    target.conflict,
    target.alone,
    target.affection,
    ...validated.map(
      (item) => `${item.original.id}:${item.status}:${item.userCorrection ? 'c' : '-'}`,
    ),
    ...deepAnswers.map(
      (answer) => `${answer.questionId}:${Array.isArray(answer.value) ? answer.value.join(',') : answer.value}`,
    ),
  ])}`;
}
