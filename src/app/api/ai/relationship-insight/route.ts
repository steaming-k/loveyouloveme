import {
  createRequestId,
  failureResponse,
  logAi,
  rateLimit,
  rateLimitKey,
  readJsonBody,
  successResponse,
} from '../_shared';
import { runRelationshipTask } from '@/services/ai/handlers';

/**
 * POST /api/ai/relationship-insight
 *
 * **이미 규칙으로 확정된** Mirror 판정을 설명한다. 판정 자체는 클라이언트에서 계산해 보내고,
 * AI는 그 값을 바꾸지 못한다(서버에서 규칙 state로 덮어쓴다).
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

  const { inputFingerprint, context, judgements, focusAxis } = body as Record<string, unknown>;

  if (typeof inputFingerprint !== 'string' || !Array.isArray(judgements)) {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  const result = await runRelationshipTask({
    inputFingerprint,
    context,
    judgements: judgements as never,
    focusAxis: (typeof focusAxis === 'string' ? focusAxis : null) as never,
  });

  const durationMs = Date.now() - startedAt;

  if (!result.ok) {
    logAi({ requestId, task: 'relationship-insight', status: 'fail', durationMs, reason: result.reason });
    return failureResponse(result.reason, requestId);
  }

  logAi({ requestId, task: 'relationship-insight', status: 'ok', durationMs });
  return successResponse(result.data, requestId);
}
