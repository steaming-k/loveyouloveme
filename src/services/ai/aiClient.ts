'use client';

import { trackEvent } from '@/lib/analytics';
import type { AiFailureReason, AiTask } from '@/types';

/**
 * AI Client — 화면과 내부 API 사이의 유일한 통로
 *
 * ⚠️ 화면은 Provider SDK를 직접 부르지 않는다. 여기서 내부 API만 호출한다.
 *
 * 이 파일이 책임지는 것:
 *   - in-flight 중복 제거 (§78: StrictMode 이중 호출·리렌더·back navigation)
 *   - 세션 범위 결과 캐시 (§56: 같은 입력으로 되돌아올 때 재호출 금지)
 *   - stale 응답 폐기 (§55: 입력이 바뀐 뒤 늦게 온 응답이 새 결과를 덮지 않게)
 *   - Analytics (§46) — 원문은 절대 보내지 않는다(§79)
 */

export type AiCallResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; reason: AiFailureReason; requestId: string | null };

const ENDPOINT: Record<AiTask, string> = {
  'observed-profile': '/api/ai/observed-profile',
  'relationship-insight': '/api/ai/relationship-insight',
  'compatibility-narrative': '/api/ai/compatibility-narrative',
  'history-insight': '/api/ai/history-insight',
  'deep-report-narrative': '/api/ai/deep-report-narrative',
};

/** 같은 (task, fingerprint)에 대한 진행 중 요청 */
const inFlight = new Map<string, Promise<AiCallResult<unknown>>>();
/** 세션 범위 캐시 — 사진 raw binary는 절대 넣지 않는다 */
const cache = new Map<string, unknown>();

function cacheKey(task: AiTask, fingerprint: string): string {
  return `${task}::${fingerprint}`;
}

/** 클라이언트 타임아웃 — 서버보다 약간 길게 둬서 서버 분류를 우선한다 */
const CLIENT_TIMEOUT_MS = 60_000;

export function getCachedAiResult<T>(task: AiTask, fingerprint: string): T | null {
  return (cache.get(cacheKey(task, fingerprint)) as T | undefined) ?? null;
}

export function clearAiCache(): void {
  cache.clear();
  inFlight.clear();
}

/**
 * AI Task 호출.
 *
 * @param fingerprint 입력 지문. 같은 지문이면 캐시/진행 중 요청을 재사용한다.
 */
export async function callAiTask<T>(
  task: AiTask,
  fingerprint: string,
  payload: Record<string, unknown>,
): Promise<AiCallResult<T>> {
  const key = cacheKey(task, fingerprint);

  const cached = cache.get(key);
  if (cached !== undefined) {
    return { ok: true, data: cached as T, requestId: 'cache' };
  }

  const existing = inFlight.get(key);
  if (existing) return existing as Promise<AiCallResult<T>>;

  const startedAt = Date.now();
  trackEvent('ai_analysis_request', { task });

  const promise = (async (): Promise<AiCallResult<unknown>> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const response = await fetch(ENDPOINT[task], {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          // 세션 단위 rate limit 키. 개인 식별 정보가 아니다.
          'x-lym-session': sessionToken(),
        },
        body: JSON.stringify({ inputFingerprint: fingerprint, ...payload }),
      });

      const json: unknown = await response.json().catch(() => null);
      const durationMs = Date.now() - startedAt;

      if (
        json === null ||
        typeof json !== 'object' ||
        (json as { ok?: unknown }).ok !== true
      ) {
        const reason = readReason(json);
        trackEvent('ai_analysis_failure', { task, reason, duration_ms: durationMs });
        return { ok: false, reason, requestId: readRequestId(json) };
      }

      const data = (json as { data: unknown }).data;
      const requestId = readRequestId(json) ?? 'unknown';

      cache.set(key, data);
      trackEvent('ai_analysis_success', {
        task,
        duration_ms: durationMs,
        result_items: countItems(data),
        // §54 — 품질 분석용. prompt_version과 mode는 보내고 **model 이름은 보내지 않는다**
        // (운영 정보이고, analytics를 최소로 유지한다는 기존 방침을 지킨다).
        ...readMetaProps(data),
      });

      return { ok: true, data, requestId };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const reason: AiFailureReason =
        error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';
      trackEvent('ai_analysis_failure', { task, reason, duration_ms: durationMs });
      return { ok: false, reason, requestId: null };
    } finally {
      clearTimeout(timer);
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise as Promise<AiCallResult<T>>;
}

function readReason(json: unknown): AiFailureReason {
  if (typeof json === 'object' && json !== null) {
    const reason = (json as { reason?: unknown }).reason;
    if (typeof reason === 'string') return reason as AiFailureReason;
  }
  return 'SERVER_ERROR';
}

function readRequestId(json: unknown): string | null {
  if (typeof json === 'object' && json !== null) {
    const id = (json as { requestId?: unknown }).requestId;
    if (typeof id === 'string') return id;
  }
  return null;
}

/** 결과 meta에서 분석용 property만 뽑는다. 자유서술·AI 문장은 절대 포함하지 않는다 */
function readMetaProps(data: unknown): { mode?: string; prompt_version?: string } {
  if (typeof data !== 'object' || data === null) return {};
  const meta = (data as { meta?: unknown }).meta;
  if (typeof meta !== 'object' || meta === null) return {};

  const { mode, promptVersion } = meta as { mode?: unknown; promptVersion?: unknown };
  return {
    ...(typeof mode === 'string' ? { mode } : {}),
    ...(typeof promptVersion === 'string' ? { prompt_version: promptVersion } : {}),
  };
}

/** Analytics에는 개수만 — AI 문장·사진 설명을 property로 보내지 않는다(§79) */
function countItems(data: unknown): number {
  if (typeof data !== 'object' || data === null) return 0;
  const record = data as Record<string, unknown>;
  for (const field of ['traits', 'narratives']) {
    const value = record[field];
    if (Array.isArray(value)) return value.length;
  }
  return 0;
}

/** rate limit 버킷용 임시 토큰. 개인 식별 목적이 아니고 세션이 끝나면 사라진다 */
function sessionToken(): string {
  const KEY = 'lym.ai.session';
  try {
    const existing = window.sessionStorage.getItem(KEY);
    if (existing) return existing;
    const token = `t_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    window.sessionStorage.setItem(KEY, token);
    return token;
  } catch {
    return 'anonymous';
  }
}
