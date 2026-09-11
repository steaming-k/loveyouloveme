import {
  createRequestId,
  failureResponse,
  logAi,
  rateLimit,
  rateLimitKey,
  readJsonBody,
  successResponse,
} from '../_shared';
import { runPremiumLensTask } from '@/services/ai/handlers';

/**
 * POST /api/ai/premium-mbti-lens  (v1.46 AI Lens · PHASE A)
 *
 * **이미 결정론 엔진이 계산한** MBTI 관계 렌즈 결과에 해석 문단만 붙인다.
 * mode(pair/self) · basis · themes는 클라이언트가 이미 계산해 보내고, AI는 그 값을
 * 바꾸지 못한다 — 서버가 금지 주장·계산하지 않은 값·시제를 한 번 더 검사한다.
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

  const { inputFingerprint, context, mode, tense, allowsOutwardQuestions, deterministicText } =
    body as Record<string, unknown>;

  if (typeof inputFingerprint !== 'string') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }
  /** §6 — mode는 렌즈마다 독립이다. 기본값을 두면 self 사용자가 pair 목차를 받는다 */
  if (mode !== 'pair' && mode !== 'self') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }
  /** v1.43 §47.5와 같은 계약 — **기본값 없음.** `?? 'current'`는 ended에서 위험하다 */
  if (tense !== 'current' && tense !== 'former') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }
  if (typeof allowsOutwardQuestions !== 'boolean') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  const result = await runPremiumLensTask({
    inputFingerprint,
    kind: 'mbti',
    mode,
    context,
    tense,
    allowsOutwardQuestions,
    deterministicText: typeof deterministicText === 'string' ? deterministicText : '',
  });

  const durationMs = Date.now() - startedAt;

  if (!result.ok) {
    logAi({ requestId, task: 'premium-mbti-lens', status: 'fail', durationMs, reason: result.reason });
    return failureResponse(result.reason, requestId);
  }

  logAi({ requestId, task: 'premium-mbti-lens', status: 'ok', durationMs });
  return successResponse(result.data, requestId);
}
