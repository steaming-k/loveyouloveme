import 'server-only';

import { readAiConfig } from '@/services/ai/serverEnv';
import type { AiFailureReason, AiTask } from '@/types';

/**
 * AI Route 공통 처리 (§34 · §68 · §70 · §71)
 *
 * - 요청 본문 크기 제한 (Vision 이미지가 커질 수 있다)
 * - Task allowlist
 * - 세션 단위 최소 Rate Limit
 * - requestId 발급 (§54) — 사용자에게 노출하지 않고 로그 상관관계용
 * - **민감 원문을 로그에 남기지 않는다** (§71): 이미지·자유서술·birth data 금지
 */

const ALLOWED_TASKS: readonly AiTask[] = [
  'observed-profile',
  'relationship-insight',
  'compatibility-narrative',
  'history-insight',
  'deep-report-narrative',
];

export function isAllowedTask(task: string): task is AiTask {
  return (ALLOWED_TASKS as readonly string[]).includes(task);
}

export function createRequestId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // 폴백 사용
  }
  return `r_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/* --------------------------------------------------------- Rate Limit */

/**
 * ⚠️ **경계 명시.** 계정 시스템이 없어 완전한 보호는 불가능하다. 이 구현은
 * 인스턴스 메모리 기반이라 서버리스 다중 인스턴스에서는 정확하지 않다.
 * 실서비스 전환 시 외부 저장소(Redis 등) 기반으로 교체해야 한다.
 *
 * TODO(v1.7): 공유 저장소 기반 rate limit + 인증 도입
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const buckets = new Map<string, number[]>();

export function rateLimit(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((time) => now - time < WINDOW_MS);

  if (hits.length >= MAX_PER_WINDOW) {
    const oldest = hits[0] ?? now;
    return { allowed: false, retryAfterSec: Math.ceil((WINDOW_MS - (now - oldest)) / 1000) };
  }

  hits.push(now);
  buckets.set(key, hits);

  // 메모리 누수 방지 — 오래된 버킷 정리
  if (buckets.size > 500) {
    for (const [bucketKey, times] of buckets) {
      if (times.every((time) => now - time >= WINDOW_MS)) buckets.delete(bucketKey);
    }
  }

  return { allowed: true, retryAfterSec: 0 };
}

/** 세션 헤더가 없으면 IP로 — 둘 다 없으면 공용 버킷 */
export function rateLimitKey(request: Request): string {
  const session = request.headers.get('x-lym-session');
  if (session) return `s:${session.slice(0, 64)}`;
  const forwarded = request.headers.get('x-forwarded-for');
  return `ip:${(forwarded ?? 'unknown').split(',')[0]!.trim()}`;
}

/* ------------------------------------------------------------- 응답 */

export function failureResponse(
  reason: AiFailureReason,
  requestId: string,
  status = 200,
): Response {
  // 실패도 200으로 내려 클라이언트가 reason으로 분기하게 한다 — 네트워크 오류와 구분된다.
  return Response.json({ ok: false, reason, requestId }, { status });
}

export function successResponse<T>(data: T, requestId: string): Response {
  return Response.json({ ok: true, data, requestId });
}

/** 본문을 읽으면서 크기를 검사한다. 초과하면 null */
export async function readJsonBody(request: Request): Promise<unknown | null> {
  const config = readAiConfig();
  const declared = Number(request.headers.get('content-length'));

  if (Number.isFinite(declared) && declared > config.maxRequestBytes) return null;

  const text = await request.text();
  if (text.length > config.maxRequestBytes) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * 안전한 서버 로그. 원문은 절대 남기지 않고 분류·소요시간만 남긴다(§71).
 * production에서는 실패만 기록한다.
 */
export function logAi(entry: {
  requestId: string;
  task: AiTask;
  status: 'ok' | 'fail';
  durationMs: number;
  reason?: AiFailureReason;
}): void {
  if (entry.status === 'ok' && process.env.NODE_ENV === 'production') return;
  const line = `[ai] ${entry.task} ${entry.status} ${entry.durationMs}ms req=${entry.requestId}${
    entry.reason ? ` reason=${entry.reason}` : ''
  }`;
  if (entry.status === 'fail') console.warn(line);
  else console.info(line);
}

/* ------------------------------------------------------- 이미지 검증 */

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
/** 개당 상한 — client resize를 거친 뒤 값이다(§57) */
const MAX_IMAGE_BYTES = 1_200_000;
const MAX_IMAGES = 9;

export interface ParsedImage {
  imageId: string;
  dataUrl: string;
}

/** data URL 형식·MIME·크기 검사. 잘못된 항목은 조용히 버린다(§58) */
export function parseImages(raw: unknown): ParsedImage[] {
  if (!Array.isArray(raw)) return [];

  const images: ParsedImage[] = [];

  for (const item of raw.slice(0, MAX_IMAGES)) {
    if (typeof item !== 'object' || item === null) continue;
    const { imageId, dataUrl } = item as { imageId?: unknown; dataUrl?: unknown };

    if (typeof imageId !== 'string' || imageId.length === 0 || imageId.length > 80) continue;
    if (typeof dataUrl !== 'string') continue;

    const match = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) continue;
    if (!ALLOWED_MIME.includes(match[1]!)) continue;

    // base64 → 대략 바이트 수
    const bytes = Math.floor((match[2]!.length * 3) / 4);
    if (bytes === 0 || bytes > MAX_IMAGE_BYTES) continue;

    images.push({ imageId, dataUrl });
  }

  return images;
}
