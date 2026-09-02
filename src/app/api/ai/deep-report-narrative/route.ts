import {
  createRequestId,
  failureResponse,
  logAi,
  rateLimit,
  rateLimitKey,
  readJsonBody,
  successResponse,
} from '../_shared';
import { runDeepReportTask } from '@/services/ai/handlers';

/**
 * POST /api/ai/deep-report-narrative
 *
 * **이미 규칙으로 만들어진** Cross-source Insight 목록에 headline/interpretation/situation/
 * question 문장만 붙인다. Insight의 type·evidenceRefs는 클라이언트가 이미 계산해 보내고,
 * AI는 그 값을 바꾸지 못한다(서버가 evidenceRef 대조·안전 검사를 한 번 더 한다).
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

  const { inputFingerprint, context, insights } = body as Record<string, unknown>;

  if (typeof inputFingerprint !== 'string' || !Array.isArray(insights)) {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  const result = await runDeepReportTask({
    inputFingerprint,
    context,
    insights: insights as never,
  });

  const durationMs = Date.now() - startedAt;

  if (!result.ok) {
    logAi({ requestId, task: 'deep-report-narrative', status: 'fail', durationMs, reason: result.reason });
    return failureResponse(result.reason, requestId);
  }

  logAi({ requestId, task: 'deep-report-narrative', status: 'ok', durationMs });
  return successResponse(result.data, requestId);
}
