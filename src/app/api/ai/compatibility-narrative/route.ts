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

  const { inputFingerprint, context, allowed, tense, allowsOutwardQuestions, allowedEvidenceRefs } =
    body as Record<string, unknown>;

  if (typeof inputFingerprint !== 'string' || !Array.isArray(allowed)) {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  /**
   * v1.43 §47.1 — **`tense`는 필수이고 기본값이 없다.** v1.42 §40.8이
   * `relationship-insight`에서 정한 것과 같은 규칙이다.
   *
   * `?? 'current'`로 떨어뜨리면 관계가 끝난 사용자의 요청이 시제 검사를 그냥 통과한다 —
   * 검사가 가장 필요한 경우다. 클라이언트는 `tsc`가 강제하므로 항상 보낸다.
   */
  if (tense !== 'current' && tense !== 'former') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  /**
   * v1.43 §47.2 — **Job 안전 게이트도 같은 규칙.** `?? true`로 떨어뜨리지 않는다.
   * 기본값이 허용이면 값을 빼먹은 호출부가 조용히 `ended` 사용자에게 상대를 향한
   * 질문을 보낸다 — v1.43이 실측으로 재현한 결함이 정확히 그 상태였다.
   */
  if (typeof allowsOutwardQuestions !== 'boolean') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  /**
   * v1.43 §46.3 — 근거 허용집합. **없으면 400이다.**
   *
   * `?? {}`로 떨어뜨리면 모든 dimension의 허용집합이 빈 배열이 되고, 그러면 모델이
   * 정확히 인용한 근거까지 전부 거부돼 **narrative가 전멸한다**(과필터). 반대로
   * '없으면 검사 통과'로 두면 검사 자체가 무의미해진다. 둘 다 조용한 실패라 막는다.
   */
  if (allowedEvidenceRefs === null || typeof allowedEvidenceRefs !== 'object') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  const result = await runCompatibilityTask({
    inputFingerprint,
    context,
    tense,
    allowsOutwardQuestions,
    allowedRefsByDimension: allowedEvidenceRefs as never,
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
