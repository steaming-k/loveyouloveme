import {
  createRequestId,
  failureResponse,
  logAi,
  rateLimit,
  rateLimitKey,
  readJsonBody,
  successResponse,
} from '../_shared';
import { runCompatibilityTask } from '@/services/ai/handlers';

/**
 * POST /api/ai/compatibility-narrative
 *
 * 동기화율·축별 similarity는 클라이언트의 deterministic 계산 결과다.
 * AI는 **새 점수를 만들지 않고** 그 차이를 설명만 한다. Non-blocking(lazy) 호출용.
 */
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const startedAt = Date.now();

  const limit = rateLimit(rateLimitKey(request));
  if (!limit.allowed) return failureResponse('RATE_LIMIT', requestId);

  const body = await readJsonBody(request);
  if (body === null || typeof body !== 'object') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  const { inputFingerprint, context, allowed } = body as Record<string, unknown>;

  if (typeof inputFingerprint !== 'string' || !Array.isArray(allowed)) {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  const result = await runCompatibilityTask({
    inputFingerprint,
    context,
    allowed: allowed as never,
  });

  const durationMs = Date.now() - startedAt;

  if (!result.ok) {
    logAi({ requestId, task: 'compatibility-narrative', status: 'fail', durationMs, reason: result.reason });
    return failureResponse(result.reason, requestId);
  }

  logAi({ requestId, task: 'compatibility-narrative', status: 'ok', durationMs });
  return successResponse(result.data, requestId);
}
