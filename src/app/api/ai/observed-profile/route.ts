import {
  createRequestId,
  failureResponse,
  logAi,
  parseImages,
  rateLimit,
  rateLimitKey,
  readJsonBody,
  successResponse,
} from '../_shared';
import { runObservedTask } from '@/services/ai/handlers';

/**
 * POST /api/ai/observed-profile
 *
 * 사진 → 생활 신호 관찰. **API Key는 서버에만 있다** — 클라이언트는 이 엔드포인트만 부른다.
 * 사진 원본은 분석에만 쓰고 **저장하지 않는다**(§31): 요청 처리가 끝나면 메모리에서 사라진다.
 */
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const requestId = createRequestId();
  const startedAt = Date.now();

  const limit = rateLimit(rateLimitKey(request));
  if (!limit.allowed) {
    logAi({ requestId, task: 'observed-profile', status: 'fail', durationMs: 0, reason: 'RATE_LIMIT' });
    return failureResponse('RATE_LIMIT', requestId);
  }

  const body = await readJsonBody(request);
  if (body === null || typeof body !== 'object') {
    logAi({ requestId, task: 'observed-profile', status: 'fail', durationMs: 0, reason: 'INVALID_OUTPUT' });
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  const { inputFingerprint, images } = body as {
    inputFingerprint?: unknown;
    images?: unknown;
  };

  if (typeof inputFingerprint !== 'string' || inputFingerprint.length === 0) {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  const result = await runObservedTask({
    inputFingerprint,
    images: parseImages(images),
  });

  const durationMs = Date.now() - startedAt;

  if (!result.ok) {
    logAi({ requestId, task: 'observed-profile', status: 'fail', durationMs, reason: result.reason });
    return failureResponse(result.reason, requestId);
  }

  logAi({ requestId, task: 'observed-profile', status: 'ok', durationMs });
  return successResponse(result.data, requestId);
}
