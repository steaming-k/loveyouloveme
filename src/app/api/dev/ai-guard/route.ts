import { realProviderCallCount } from '@/services/ai/realCallCounter';
import { aiRequestPolicyFromHeaders, readAiConfig, runWithAiRequestPolicy } from '@/services/ai/serverEnv';

/**
 * /api/dev/ai-guard — **개발 전용** P0 Real AI Guard 계측
 *
 * ```
 * GET   이 서버 프로세스가 지금까지 보낸 실제 Provider 요청 수 + env 모드
 * POST  이 요청의 헤더로 정책을 계산하고, 그 정책 안에서 모드가 무엇으로 풀리는지만 돌려준다
 *       (Provider를 부르지 않는다 — opt-in 헤더 경로도 비용 없이 확인할 수 있다)
 * ```
 *
 * ⚠️ Production에서는 404. Key · 모델 · 사용자 데이터를 내지 않는다.
 */
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, reason: 'NOT_FOUND' }, { status: 404 });
  }
  return Response.json({ ok: true, realProviderCalls: realProviderCallCount(), envMode: readAiConfig().mode });
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, reason: 'NOT_FOUND' }, { status: 404 });
  }
  const policy = aiRequestPolicyFromHeaders(request.headers);
  const resolvedMode = runWithAiRequestPolicy(policy, () => readAiConfig().mode);
  return Response.json({
    ok: true,
    policy,
    resolvedMode,
    envMode: readAiConfig().mode,
    realProviderCalls: realProviderCallCount(),
  });
}
