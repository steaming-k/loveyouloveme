import {
  createRequestId,
  failureResponse,
  logAi,
  rateLimit,
  rateLimitKey,
  readJsonBody,
  successResponse,
} from '../_shared';
import { runCrossLensTask } from '@/services/ai/handlers';

/**
 * POST /api/ai/premium-cross-lens  (v1.46 AI Lens · PHASE E)
 *
 * 세 렌즈 AI가 **끝난 뒤에만** 불린다(§21 · §4). 입력은 각 렌즈의 짧은 테마 한 줄과
 * 결정론 테마 코드뿐이고, 렌즈 AI의 긴 본문은 다시 넣지 않는다(§21 토큰 절약).
 *
 * ⚠️ 이 라우트는 '요약'을 만들지 않는다. 찾는 것은 반복된 테마 · 다르게 읽히는 지점 ·
 * 확인할 질문 세 가지이고, '근거 3개가 일치했다'는 표현은 서버가 걸러낸다(§23).
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

  const { inputFingerprint, context, tense, allowsOutwardQuestions } = body as Record<
    string,
    unknown
  >;

  if (typeof inputFingerprint !== 'string') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }
  if (tense !== 'current' && tense !== 'former') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }
  if (typeof allowsOutwardQuestions !== 'boolean') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  const result = await runCrossLensTask({
    inputFingerprint,
    context,
    tense,
    allowsOutwardQuestions,
  });

  const durationMs = Date.now() - startedAt;

  if (!result.ok) {
    logAi({ requestId, task: 'premium-cross-lens', status: 'fail', durationMs, reason: result.reason });
    return failureResponse(result.reason, requestId);
  }

  logAi({ requestId, task: 'premium-cross-lens', status: 'ok', durationMs });
  return successResponse(result.data, requestId);
}
