import {
  createRequestId,
  failureResponse,
  logAi,
  rateLimit,
  rateLimitKey,
  readJsonBody,
  successResponse,
} from '../_shared';
import { runHistoryTask } from '@/services/ai/handlers';

/**
 * POST /api/ai/history-insight
 *
 * STABLE/SHIFT/NEW 판정은 규칙이 한다. AI는 변화를 사용자 언어로 설명만 한다.
 * 성장·극복 서사를 만들지 않는다.
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

  const { inputFingerprint, context, allowed, allowedEvidenceRefs } = body as Record<
    string,
    unknown
  >;

  if (typeof inputFingerprint !== 'string' || !Array.isArray(allowed)) {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  /**
   * v1.43 §46.4 — 근거 허용집합. **없으면 400이다.**
   *
   * `?? {}`로 떨어뜨리면 모든 축의 허용집합이 비고 모델이 정확히 인용한 근거까지
   * 거부된다. `?? 검사 통과`로 두면 검사가 무의미해진다. 둘 다 조용한 실패다.
   */
  if (allowedEvidenceRefs === null || typeof allowedEvidenceRefs !== 'object') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  const result = await runHistoryTask({
    inputFingerprint,
    context,
    allowedRefsByAxis: allowedEvidenceRefs as never,
    allowed: allowed as never,
  });

  const durationMs = Date.now() - startedAt;

  if (!result.ok) {
    logAi({ requestId, task: 'history-insight', status: 'fail', durationMs, reason: result.reason });
    return failureResponse(result.reason, requestId);
  }

  logAi({ requestId, task: 'history-insight', status: 'ok', durationMs });
  return successResponse(result.data, requestId);
}
