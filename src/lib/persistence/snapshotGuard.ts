import type { RelationshipDeepReport, RelationshipHistoryEntry } from '@/types';

import { BINARY_KEY_PATTERN } from './cloudWriteBudget';
import { analysisRunIdOfHistoryEntry } from './ids';
import { fail, ok, type AnalysisRun, type GeneratedAnalysisRun, type Result } from './types';

/**
 * v1.47 — analysis_runs에 **들어가면 안 되는 것**을 코드로 막는다
 *
 * ```
 * 저장   accepted/rendered output (화면에 실제로 보인 결과) · candidate id · evidence ref · event id
 * 금지   raw Provider 응답 · 숨은 추론/사고 과정 · 프롬프트 · 원본 사건/상대/나 전체 복제 · 사진 · 생년월일 · debug
 * ```
 *
 * 키 이름으로 막는다 — 호출부가 실수로 통째 객체를 넘겨도 저장 전에 거절된다.
 */

export const FORBIDDEN_SNAPSHOT_KEYS: ReadonlySet<string> = new Set([
  'raw',
  'rawResponse',
  'raw_response',
  'providerResponse',
  'provider_response',
  'choices',
  'completion',
  'reasoning',
  'reasoningContent',
  'reasoning_content',
  'chainOfThought',
  'thinking',
  'prompt',
  'systemPrompt',
  'messages',
  'aiContext',
  'apiKey',
  'photos',
  'objectUrl',
  'dataUrl',
  'base64',
  'events',
  'description',
  'myReaction',
  'my_reaction',
  'birthProfile',
  'birth_date',
  'birth_time',
  'target_json',
  'profile_json',
]);

export const SNAPSHOT_MAX_BYTES = 512 * 1024;

export function forbiddenSnapshotPaths(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => forbiddenSnapshotPaths(item, `${path}[${index}]`));
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
    FORBIDDEN_SNAPSHOT_KEYS.has(key) || BINARY_KEY_PATTERN.test(key)
      ? [`${path}.${key}`]
      : forbiddenSnapshotPaths(item, `${path}.${key}`),
  );
}

/** 이 길이 미만의 원문은 우연히 겹칠 수 있어 복제로 보지 않는다 */
const DUPLICATE_TEXT_MIN_CHARS = 8;

export function validateSnapshot(
  value: unknown,
  options: {
    /**
     * Storage Capacity Guard §3 — 스냅샷 안에 **다시 들어가면 안 되는 원문**(사건 본문 · 반응).
     * 원문은 relationship_events 행에만 있고, 스냅샷은 event id로 참조한다.
     */
    forbiddenTexts?: readonly string[];
  } = {},
): Result<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail('invalid', 'snapshot_not_object');
  }
  const paths = forbiddenSnapshotPaths(value);
  if (paths.length > 0) return fail('invalid', `snapshot_forbidden_keys:${paths.slice(0, 5).join(',')}`);
  const serialized = JSON.stringify(value);
  const duplicated = (options.forbiddenTexts ?? [])
    .map((text) => text.trim())
    .filter((text) => text.length >= DUPLICATE_TEXT_MIN_CHARS)
    .filter((text) => serialized.includes(JSON.stringify(text).slice(1, -1)));
  if (duplicated.length > 0) return fail('invalid', `snapshot_duplicates_source_text:${duplicated.length}`);
  const bytes = new TextEncoder().encode(serialized).length;
  if (bytes > SNAPSHOT_MAX_BYTES) return fail('invalid', 'snapshot_too_large');
  return ok(value as Record<string, unknown>);
}

/**
 * History 스냅샷 → analysis_run 입력.
 *
 * History 항목은 설계상 이미 '그때 화면에 보인 요약'이고 자유서술 · 사진 원문 · 생년월일을
 * 담지 않는다(`types/index.ts` RelationshipHistoryEntry). 그대로 옮기되 guard를 한 번 더 통과시킨다.
 *
 * ⚠️ id는 **사용자 id가 섞인** 결정론 UUID다 — 같은 기기의 History를 두 계정이 각각 저장해도
 *    id가 겹치지 않는다(v1.47 Clean Base §12).
 */
export async function historyEntryRunInput(
  entry: RelationshipHistoryEntry,
  userId: string,
): Promise<Omit<AnalysisRun, 'appVersion'>> {
  const { aiMeta } = entry.coreInsight;
  return {
    id: await analysisRunIdOfHistoryEntry(userId, entry.id),
    targetId: null,
    type: 'mirror_history',
    snapshot: { ...entry } as unknown as Record<string, unknown>,
    sourceFingerprint: entry.analysisId,
    promptVersion: aiMeta?.promptVersion ?? null,
    model: null,
    idempotencyKey: null,
    createdAt: entry.createdAt,
  };
}

/** §7 — Deep Report 스냅샷의 최상위 칸. 이 네 개 말고는 없다 */
export const DEEP_REPORT_SNAPSHOT_KEYS = ['renderedResult', 'candidateIds', 'usedEvidenceRefs', 'usedEventIds'] as const;

/**
 * Deep Report **렌더된 결과**를 '당시 결과'로 남길 최소 모양 (Storage Capacity Guard §4 · Clean Base §7).
 *
 * ```
 * renderedResult     화면 문장(카드 · actionPlan) + 판정 · candidate id · evidence ref · event id
 * candidateIds       Top 카드 id
 * usedEvidenceRefs   카드 · actionPlan이 쓴 근거 ref (중복 제거)
 * usedEventIds       참조한 사건 id — 사건 본문은 relationship_events 행에만 있다
 * 칸(column)         sourceFingerprint · promptVersion · model
 * 안 담는다          reportedScenes(사건 원문) · 렌즈 전체 · 챕터 전체 · Provider 원문 · 프롬프트 · mode
 * ```
 *
 * ⚠️ 사건 수가 늘어도 이 스냅샷은 커지지 않는다 — 사건은 id로만 참조한다(fixture 10/100/500).
 * ⚠️ 저장할 때는 `forbiddenTexts`에 사건 본문을 넘겨 한 번 더 확인한다(analysisRunRepository.recordGenerated).
 */
export function deepReportRunInput(source: {
  targetId: string | null;
  report: RelationshipDeepReport;
  promptVersion: string | null;
  model: string | null;
  sourceFingerprint: string | null;
  generationRequestId: string;
  /** 로컬 사건 id → cloud 사건 id. 저장하는 스냅샷은 cloud 사건 행을 가리켜야 한다 */
  eventIdOf?: (localEventId: string) => string;
}): GeneratedAnalysisRun {
  const mapEventId = source.eventIdOf ?? ((id: string) => id);
  const candidates = source.report.candidates.map((candidate) => ({
    id: candidate.id,
    verdict: candidate.verdict,
    primaryAxis: candidate.primaryAxis,
    headline: candidate.headline,
    soWhat: candidate.soWhat,
    whyItMatters: candidate.whyItMatters,
    limitation: candidate.limitation,
    soWhatSource: candidate.soWhatSource,
    operator: candidate.insightOperator,
    evidenceRefs: candidate.evidenceRefs,
    eventIds: [...new Set([...candidate.relevantEventIds, ...candidate.semanticEventIds].map(mapEventId))],
  }));
  const plan = source.report.actionPlan;
  const actionPlan = plan
    ? {
        sourceCandidateId: plan.sourceCandidateId,
        title: plan.title,
        topic: plan.topic,
        mode: plan.mode,
        source: plan.source,
        lifecycle: plan.lifecycle,
        sourceRank: plan.sourceRank,
        nextMove: plan.nextMove,
        verificationQuestion: plan.verificationQuestion,
        verificationFrom: plan.verificationFrom,
        observeSignal: plan.observeSignal,
        decisionSignals: plan.decisionSignals,
        unresolved: plan.unresolved,
        usedEvidenceRefs: plan.usedEvidenceRefs,
        usedEventIds: plan.usedEventIds.map(mapEventId),
      }
    : null;
  const refs: unknown[] = [...candidates.flatMap((candidate) => candidate.evidenceRefs), ...(plan?.usedEvidenceRefs ?? [])];
  const usedEvidenceRefs = [...new Map(refs.map((ref) => [JSON.stringify(ref), ref])).values()];
  return {
    targetId: source.targetId,
    type: 'deep_report',
    snapshot: {
      renderedResult: { candidates, actionPlan },
      candidateIds: candidates.map((candidate) => candidate.id),
      usedEvidenceRefs,
      usedEventIds: [...new Set([...candidates.flatMap((candidate) => candidate.eventIds), ...(plan?.usedEventIds ?? []).map(mapEventId)])],
    },
    sourceFingerprint: source.sourceFingerprint,
    promptVersion: source.promptVersion,
    model: source.model,
    generationRequestId: source.generationRequestId,
  };
}
