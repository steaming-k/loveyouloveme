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

  const { inputFingerprint, context, judgements, focusAxis, tense, allowsOutwardQuestions } =
    body as Record<string, unknown>;

  if (typeof inputFingerprint !== 'string' || !Array.isArray(judgements)) {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  /**
   * v1.42 §40.8 — **`tense`는 필수이고 기본값이 없다.**
   *
   * `?? 'current'`로 떨어뜨리고 싶어지는데, 그게 정확히 v1.40.1이 닫은 실패 형태다:
   * 안전 게이트에 관용적인 기본값을 주면 값을 빼먹은 호출부가 조용히 가장 위험한
   * 쪽으로 간다. 여기서 `'current'`가 기본값이면 관계가 끝난 사용자의 요청이 시제
   * 검사를 통과해버린다 — 검사가 가장 필요한 경우다.
   *
   * 그래서 없으면 400이다. 클라이언트는 `tsc`가 강제하므로 항상 보낸다.
   */
  if (tense !== 'current' && tense !== 'former') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  /**
   * v1.42 §41.8 — **Job 안전 게이트도 같은 규칙이다.** `?? true`로 떨어뜨리지 않는다 —
   * 기본값이 허용이면 값을 빼먹은 호출부가 조용히 `ended` 사용자에게 상대를 향한 질문을
   * 보낸다. 검사가 가장 필요한 경우다.
   */
  if (typeof allowsOutwardQuestions !== 'boolean') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  const result = await runRelationshipTask({
    inputFingerprint,
    context,
    judgements: judgements as never,
    focusAxis: (typeof focusAxis === 'string' ? focusAxis : null) as never,
    tense,
    allowsOutwardQuestions,
  });

  const durationMs = Date.now() - startedAt;

  if (!result.ok) {
    logAi({ requestId, task: 'relationship-insight', status: 'fail', durationMs, reason: result.reason });
    return failureResponse(result.reason, requestId);
  }

  logAi({ requestId, task: 'relationship-insight', status: 'ok', durationMs });
  return successResponse(result.data, requestId);
}
