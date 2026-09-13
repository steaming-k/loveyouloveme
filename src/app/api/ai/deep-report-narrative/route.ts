import {
  createRequestId,
  failureResponse,
  logAi,
  rateLimit,
  rateLimitKey,
  readJsonBody,
  successResponse,
} from '../_shared';
import { runDeepReportTask, type DeepReportDiagnostics } from '@/services/ai/handlers';
import { INSIGHT_OPERATORS } from '@/lib/logic/insightOperators';
import type {
  ActionPlanAllowance,
  CandidateSemanticAllowance,
  EvidenceRef,
  InsightOperator,
} from '@/types';

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

  const {
    inputFingerprint,
    context,
    insights,
    tense,
    candidates,
    actionAllowance,
    devModelOverride,
    devCapture,
  } = body as Record<string, unknown>;

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
   * SEMANTIC DECOMPOSITION A5 — **카드 semantic 게이트의 입력.**
   *
   * ⚠️ 이 값이 흘러오지 않으면 게이트가 빈 허용집합을 받고 **모든 카드 문장을 거부한다.**
   * v1.46.4 SEMANTIC 구현 직후 실측에서 라우트가 값을 흘려보내지 않아 같은 일이 있었다
   * (contract-test는 통과했다) — 그래서 이 전달은 실제 Provider QA로 확인한다.
   *
   * ⚠️ **구조 검증만 하고 내용은 믿지 않는다.** 이 값이 하는 일은 모델이 인용할 수 있는
   * 범위를 **좁히는** 것뿐이다 — 허용집합 밖은 무조건 거부되므로 신뢰 경계를 넘지 않는다.
   * ⚠️ 카드는 최대 3장이다(A5). 더 오면 앞의 3장만 쓴다.
   */
  const allowancesOf = (value: unknown): CandidateSemanticAllowance[] => {
    if (!Array.isArray(value)) return [];
    const strings = (list: unknown): string[] =>
      Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : [];
    return value
      .flatMap((entry): CandidateSemanticAllowance[] => {
        if (!entry || typeof entry !== 'object') return [];
        const item = entry as Record<string, unknown>;
        if (typeof item.candidateId !== 'string') return [];
        return [
          {
            candidateId: item.candidateId,
            evidenceRefs: Array.isArray(item.evidenceRefs) ? (item.evidenceRefs as EvidenceRef[]) : [],
            eventIds: strings(item.eventIds),
            sceneTexts: strings(item.sceneTexts),
            /*
              Operator Pass §10 — 허용 틀. 알려진 틀 이름만 남기고, 없으면 빈 목록이라 모든
              카드 문장이 거부된다(안전한 기본값). 틀 목록을 넓혀 보내도 게이트가 **실제 인용
              근거**로 틀을 다시 확인하므로(`operatorSatisfied`) 근거 없는 틀은 통과하지 못한다.
            */
            eligibleOperators: strings(item.eligibleOperators).filter((name): name is InsightOperator =>
              (INSIGHT_OPERATORS as readonly string[]).includes(name),
            ),
            knownSelfStatement:
              typeof item.knownSelfStatement === 'string' ? item.knownSelfStatement : null,
            /* Core Value Closure — context 근거 확인용. 수용 범위를 좁히는 데만 쓰인다 */
            evidenceTexts: strings(item.evidenceTexts).slice(0, 20),
            unresolvedPoints: strings(item.unresolvedPoints).slice(0, 5),
          },
        ];
      })
      .slice(0, 3);
  };

  /**
   * v1.46.4 Model A/B §9 — **개발 환경에서만** 읽는 두 필드.
   *
   * ⚠️ Production에서는 요청 본문에 무엇이 와도 무시한다. 사용자가 모델을 고르거나
   * 원 응답을 받아가는 경로를 만들지 않는다(§9 마지막 줄).
   */
  const cardAllowances = allowancesOf(candidates);

  /**
   * v1.46.4 Action Layer §15 — Action 카드 허용집합.
   *
   * ⚠️ **카드 허용집합 안의 id일 때만** 받는다. 근거·장면도 그 카드에서 다시 읽는다 — 요청이 더 넓은
   * 근거를 보내도 카드에 실린 범위를 넘지 못한다(신뢰 경계를 넓히지 않는다).
   */
  const actionAllowanceOf = (value: unknown): ActionPlanAllowance | null => {
    if (!value || typeof value !== 'object') return null;
    const item = value as Record<string, unknown>;
    const card = cardAllowances.find((entry) => entry.candidateId === item.candidateId);
    if (!card) return null;
    return {
      candidateId: card.candidateId,
      evidenceRefs: card.evidenceRefs,
      eventIds: card.eventIds,
      sceneTexts: card.sceneTexts,
      canAskPartner: item.canAskPartner === true && tense === 'current',
      /* Action Alignment 기준 문장 — 수용 범위를 좁히는 데만 쓰인다(신뢰 경계를 넓히지 않는다) */
      unresolvedPoints: Array.isArray(item.unresolvedPoints)
        ? item.unresolvedPoints.filter((entry): entry is string => typeof entry === 'string').slice(0, 5)
        : [],
    };
  };

  const isDev = process.env.NODE_ENV !== 'production';
  let diagnostics: DeepReportDiagnostics | null = null;

  const result = await runDeepReportTask({
    inputFingerprint,
    context,
    tense,
    insights: insights as never,
    candidates: cardAllowances,
    actionAllowance: actionAllowanceOf(actionAllowance),
    ...(isDev && typeof devModelOverride === 'string' ? { devModelOverride } : {}),
    ...(isDev && devCapture === true
      ? {
          onDiagnostics: (value: DeepReportDiagnostics) => {
            diagnostics = value;
          },
        }
      : {}),
  });

  const durationMs = Date.now() - startedAt;

  if (!result.ok) {
    logAi({ requestId, task: 'deep-report-narrative', status: 'fail', durationMs, reason: result.reason });
    return failureResponse(result.reason, requestId);
  }

  logAi({ requestId, task: 'deep-report-narrative', status: 'ok', durationMs });
  if (diagnostics) {
    return Response.json({ ok: true, data: result.data, requestId, dev: { ...(diagnostics as DeepReportDiagnostics), durationMs } });
  }
  return successResponse(result.data, requestId);
}
