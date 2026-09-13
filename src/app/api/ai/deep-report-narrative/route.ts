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

  const { inputFingerprint, context, insights, tense, allowedSceneIds, sceneTextsByInsight } =
    body as Record<string, unknown>;

  if (typeof inputFingerprint !== 'string' || !Array.isArray(insights)) {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  /**
   * v1.43 §47.5 — **`tense`는 필수이고 기본값이 없다.**
   *
   * 이 Task의 `headline`/`interpretation`은 실제로 화면에 그려지고, 그 카드의
   * `limitation`은 v1.41부터 시제가 맞춰져 있다. `?? 'current'`로 떨어뜨리면 끝난
   * 관계 사용자의 유료 리포트에서 **경계 문장만 과거형이고 본문은 검사받지 않는**
   * v1.42 상태로 조용히 되돌아간다.
   */
  if (tense !== 'current' && tense !== 'former') {
    return failureResponse('INVALID_OUTPUT', requestId, 400);
  }

  /**
   * v1.46.4 §9 · §36 — **semantic 게이트의 두 입력.**
   *
   * ⚠️ 이 두 줄이 없으면 게이트가 `{}`을 받고 **모든 장면 인용을 거부한다.** 구현
   * 직후 실측에서 그 상태였다 — 핸들러·파서·프롬프트는 다 됐는데 라우트가 값을
   * 흘려보내지 않아서, 실제 Provider 경로에서는 semantic이 한 건도 남지 않았다.
   * `contract-test`는 통과했으므로 fixture만으로는 보이지 않는 종류의 결함이고,
   * §31이 실제 Provider QA를 필수로 요구한 이유가 이것이다.
   *
   * ⚠️ **구조 검증만 하고 내용은 믿지 않는다.** 이 값은 클라이언트가 보낸 것이지만
   * 여기서 하는 일은 '모델이 인용할 수 있는 범위'를 **좁히는** 것뿐이다 — 넓히는
   * 방향으로는 쓰이지 않으므로(허용집합 밖은 무조건 거부) 신뢰 경계를 넘지 않는다.
   */
  const sceneIdsOf = (value: unknown): Record<string, string[]> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: Record<string, string[]> = {};
    for (const [key, list] of Object.entries(value as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      out[key] = list.filter((item): item is string => typeof item === 'string');
    }
    return out;
  };

  const result = await runDeepReportTask({
    inputFingerprint,
    context,
    tense,
    insights: insights as never,
    allowedSceneIds: sceneIdsOf(allowedSceneIds),
    sceneTextsByInsight: sceneIdsOf(sceneTextsByInsight),
  });

  const durationMs = Date.now() - startedAt;

  if (!result.ok) {
    logAi({ requestId, task: 'deep-report-narrative', status: 'fail', durationMs, reason: result.reason });
    return failureResponse(result.reason, requestId);
  }

  logAi({ requestId, task: 'deep-report-narrative', status: 'ok', durationMs });
  return successResponse(result.data, requestId);
}
