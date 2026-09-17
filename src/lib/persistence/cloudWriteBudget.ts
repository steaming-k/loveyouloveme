import type { PersistenceTable } from '@/lib/supabase/types';

import { fail, type CloudPayloadIssue, type CloudPayloadIssueReason, type Result } from './types';

/**
 * v1.47 Storage Capacity Guard — **모든 cloud write 직전의 크기 · 내용 검사** (한 파일의 상수)
 *
 * ══ 원칙 ═══════════════════════════════════════════════════════════════════
 *
 * ```
 * Supabase는 사진 저장소가 아니다     사진 · 이미지 · base64 · data URL · blob · 파일 · 오디오/비디오 → 거부
 * 텍스트 원문은 한 곳에만             사건 본문은 relationship_events 행에만. JSON 안의 사건 배열 · 본문 → 거부
 * 전체 앱 상태 dump 금지              행 · 문자열 · 배열 · 깊이 상한 → 거부
 * Provider 원문 금지                  raw · choices · prompt · reasoning … 키 → 거부
 * 몰래 자르지 않는다                  잘라서 저장하지 않는다. write를 실패시키고 어떤 칸이 문제인지만 돌려준다
 * ```
 *
 * ⚠️ 거부는 **로컬 데이터를 건드리지 않는다**(gateway 앞에서 멈춘다 — 기존 cloud 행도 그대로).
 * ⚠️ issue에는 **경로와 이유만** 담는다. 값(사건 본문 등)을 담지 않는다.
 * ⚠️ 상한은 SQL CHECK(`supabase/migrations/*`)와 **같거나 더 엄격**하다 — 앱이 먼저 멈춰서 이유를
 *    말할 수 있어야 한다(persistence fixture가 SQL 숫자와 비교한다).
 */
export const CLOUD_WRITE_BUDGET = {
  /** 직렬화한 행 전체 UTF-8 바이트 */
  maxRowBytes: {
    user_profiles: 32 * 1024,
    relationship_targets: 32 * 1024,
    relationship_events: 16 * 1024,
    analysis_runs: 128 * 1024,
  },
  /** 단일 문자열 UTF-8 바이트 — 한글 4000자 = 12KB */
  maxStringBytes: 12 * 1024,
  /** SQL char_length CHECK와 같은 값 */
  maxTextChars: { eventText: 4000, label: 40, promptVersion: 80, model: 80 },
  maxArrayLength: 200,
  maxDepth: 12,
  /** 이 길이 이상이고 base64 글자만으로 된 문자열은 바이너리로 본다 */
  base64MinLength: 256,
} as const satisfies {
  maxRowBytes: Record<PersistenceTable, number>;
  maxStringBytes: number;
  maxTextChars: { eventText: number; label: number; promptVersion: number; model: number };
  maxArrayLength: number;
  maxDepth: number;
  base64MinLength: number;
};

/** 사진 · 이미지 · 파일 · 미디어 필드 이름 */
export const BINARY_KEY_PATTERN =
  /^(photos?|photo_?(url|urls|base64|data|bytes|ids?)|images?|image_?(data|blob|bytes|url|urls|base64|ids?)|thumbnails?|screenshots?|object_?url|data_?url|base64|blob|files?|array_?buffer|audio|video)$/i;

/** Provider 원문 · 프롬프트 · 숨은 추론 · 디버그 · QA payload */
export const RAW_PROVIDER_KEYS: ReadonlySet<string> = new Set([
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
  'aiRequest',
  'apiKey',
  'debug',
  'trace',
  'qaPayload',
]);

/** JSON 칸 안에서 사건 원문이 다시 나오는 모양 — 사건은 relationship_events 행에만 산다 */
const EVENT_TEXT_KEYS: ReadonlySet<string> = new Set(['events', 'relationshipEvents', 'description', 'myReaction', 'my_reaction']);

const JSON_COLUMNS: ReadonlySet<string> = new Set(['profile_json', 'target_json', 'result_snapshot']);

const DATA_URL = /data:image\/|;base64,/i;
const BLOB_URL = /^\s*blob:/i;
const BASE64_BODY = /^[A-Za-z0-9+/_-]+={0,2}$/;

export function estimateUtf8Bytes(value: unknown): number {
  const encoder = new TextEncoder();
  if (typeof value === 'string') return encoder.encode(value).length;
  try {
    return encoder.encode(JSON.stringify(value) ?? '').length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isBinaryValue(value: unknown): boolean {
  return (
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    (typeof Blob !== 'undefined' && value instanceof Blob) ||
    typeof value === 'function'
  );
}

export function inspectCloudPayload(table: PersistenceTable, row: unknown): CloudPayloadIssue[] {
  const issues: CloudPayloadIssue[] = [];
  const push = (path: string, reason: CloudPayloadIssueReason) => {
    if (issues.length < 20) issues.push({ path: path || '$', reason });
  };

  const walk = (value: unknown, path: string, depth: number, inJson: boolean): void => {
    if (depth > CLOUD_WRITE_BUDGET.maxDepth) {
      push(path, 'too_deep');
      return;
    }
    if (isBinaryValue(value)) {
      push(path, 'binary_value');
      return;
    }
    if (typeof value === 'string') {
      if (DATA_URL.test(value)) push(path, 'data_url');
      else if (BLOB_URL.test(value)) push(path, 'blob_url');
      else if (value.length >= CLOUD_WRITE_BUDGET.base64MinLength && BASE64_BODY.test(value.replace(/\s+/g, ''))) {
        push(path, 'base64_like');
      }
      if (estimateUtf8Bytes(value) > CLOUD_WRITE_BUDGET.maxStringBytes) push(path, 'string_too_large');
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > CLOUD_WRITE_BUDGET.maxArrayLength) push(path, 'array_too_large');
      value.forEach((item, index) => walk(item, `${path}[${index}]`, depth + 1, inJson));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        const child = path ? `${path}.${key}` : key;
        if (BINARY_KEY_PATTERN.test(key)) {
          push(child, 'binary_field');
          continue;
        }
        if (RAW_PROVIDER_KEYS.has(key)) {
          push(child, 'forbidden_key');
          continue;
        }
        if (inJson && EVENT_TEXT_KEYS.has(key)) {
          push(child, 'nested_events');
          continue;
        }
        walk(item, child, depth + 1, inJson || JSON_COLUMNS.has(key));
      }
    }
  };
  walk(row, '', 0, false);

  const columns = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
  if (table === 'relationship_events') {
    for (const column of ['description', 'my_reaction']) {
      const text = columns[column];
      if (typeof text === 'string' && [...text].length > CLOUD_WRITE_BUDGET.maxTextChars.eventText) {
        push(column, 'text_too_long');
      }
    }
  }
  if (table === 'relationship_targets' && typeof columns.label === 'string') {
    if ([...columns.label].length > CLOUD_WRITE_BUDGET.maxTextChars.label) push('label', 'text_too_long');
  }
  if (table === 'analysis_runs') {
    for (const [column, limit] of [
      ['prompt_version', CLOUD_WRITE_BUDGET.maxTextChars.promptVersion],
      ['model', CLOUD_WRITE_BUDGET.maxTextChars.model],
    ] as const) {
      const text = columns[column];
      if (typeof text === 'string' && [...text].length > limit) push(column, 'text_too_long');
    }
  }
  if (estimateUtf8Bytes(row) > CLOUD_WRITE_BUDGET.maxRowBytes[table]) push('$', 'row_too_large');
  return issues;
}

/** 문제가 있으면 write를 보내지 않을 결과, 없으면 null */
export function rejectCloudPayload(table: PersistenceTable, row: unknown): Result<never> | null {
  const issues = inspectCloudPayload(table, row);
  if (issues.length === 0) return null;
  const summary = issues
    .slice(0, 5)
    .map((issue) => `${issue.reason}@${issue.path}`)
    .join(',');
  return fail('payload_rejected', `cloud_write_rejected:${summary}`, issues);
}
