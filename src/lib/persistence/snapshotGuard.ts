import type { RelationshipHistoryEntry } from '@/types';

import { analysisRunIdOfHistoryEntry } from './ids';
import { fail, ok, type AnalysisRun, type Result } from './types';

/**
 * v1.47 — analysis_runs에 **들어가면 안 되는 것**을 코드로 막는다
 *
 * ```
 * 저장   accepted/rendered output (화면에 실제로 보인 결과)
 * 금지   raw Provider 응답 · 숨은 추론/사고 과정 · 프롬프트 · 원본 사건/상대 전체 복제 · 사진 · 생년월일
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
    FORBIDDEN_SNAPSHOT_KEYS.has(key)
      ? [`${path}.${key}`]
      : forbiddenSnapshotPaths(item, `${path}.${key}`),
  );
}

export function validateSnapshot(value: unknown): Result<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail('invalid', 'snapshot_not_object');
  }
  const paths = forbiddenSnapshotPaths(value);
  if (paths.length > 0) return fail('invalid', `snapshot_forbidden_keys:${paths.slice(0, 5).join(',')}`);
  const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
  if (bytes > SNAPSHOT_MAX_BYTES) return fail('invalid', 'snapshot_too_large');
  return ok(value as Record<string, unknown>);
}

/**
 * History 스냅샷 → analysis_run 입력.
 *
 * History 항목은 설계상 이미 '그때 화면에 보인 요약'이고 자유서술 · 사진 원문 · 생년월일을
 * 담지 않는다(`types/index.ts` RelationshipHistoryEntry). 그대로 옮기되 guard를 한 번 더 통과시킨다.
 */
export async function historyEntryRunInput(
  entry: RelationshipHistoryEntry,
): Promise<Omit<AnalysisRun, 'appVersion'>> {
  const { aiMeta } = entry.coreInsight;
  return {
    id: await analysisRunIdOfHistoryEntry(entry.id),
    targetId: null,
    type: 'mirror_history',
    snapshot: { ...entry } as unknown as Record<string, unknown>,
    sourceFingerprint: entry.analysisId,
    modelMeta: aiMeta ? { mode: aiMeta.mode, promptVersion: aiMeta.promptVersion, generatedAt: aiMeta.generatedAt } : null,
    createdAt: entry.createdAt,
  };
}
