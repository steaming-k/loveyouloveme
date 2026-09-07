import { REFLECTION_QUESTIONS, STAGE_JOB_COPY, STATUS_DESCRIPTION } from '@/data/stageCopy';
import { STATUS_LABEL, STATUS_SUPPORTED } from '@/data/labels';
import { buildCompatibility } from '@/lib/logic/compatibility';
import { buildCrossSourceInsights } from '@/lib/logic/crossSourceInsights';
import { buildMirrorReport } from '@/lib/logic/mirror';
import {
  JOB_ACTION_KINDS,
  jobAllowsOutwardAction,
  jobAllowsOutwardQuestions,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
import { buildApproachHints } from '@/lib/logic/approachHints';
import { buildConversationQuestions } from '@/lib/logic/compatibility';
import { resolvePrice } from '@/lib/premiumVariant';
import { hasDeepConnection } from '@/services/premiumConnections';
import { premiumFeatureState } from '@/services/premiumService';
import { createEmptyAnswers, createEmptyTargetProfile } from '@/state/defaultAnswers';
import type {
  DeclaredPreference,
  RelationshipExperience,
  RelationshipHistoryEntry,
  RelationshipStatus,
  SessionAnswers,
  TargetProfile,
} from '@/types';

/**
 * POST /api/dev/lifecycle-test — **개발 전용** Relationship Lifecycle Fixture 실행기
 * (v1.40 · §37.19)
 *
 * `tests/run-lifecycle-fixtures.mjs`가 부른다. 목적은 `history-test`와 같다:
 * **판정 로직을 테스트용으로 복제하지 않는 것.** 화면이 쓰는 것과 완전히 같은 함수
 * (`resolveRelationshipContext` · `buildCompatibility` · `buildMirrorReport` ·
 * `buildApproachHints` · `buildConversationQuestions` · `hasDeepConnection`)를 그대로
 * 호출하고 결과만 돌려준다.
 *
 * 이 라우트가 답해야 하는 질문은 두 개다.
 *  ① **불변인가** — `status`만 바꿔도 score·comparedCount·Mirror 판정·Premium 게이트가
 *    같은 값인가.
 *  ② **문맥이 달라지는가** — Job·허용 action kind·문구가 단계에 맞게 달라지는가.
 *
 * ⚠️ 새 테스트 프레임워크를 도입하지 않는다. 기존 `api/dev/history-test` +
 * `tests/*.mjs` 방식을 그대로 따른다.
 * ⚠️ Production에서는 404다.
 */
export const runtime = 'nodejs';

interface LifecycleTestRequest {
  /** S05에서 고른 관계 상태. `null`이면 아직 고르지 않은 상태 */
  status?: RelationshipStatus | null;
  declared?: Partial<DeclaredPreference>;
  experience?: Partial<RelationshipExperience>;
  target?: Partial<TargetProfile>;
  entries?: RelationshipHistoryEntry[];
  /** legacy 세션 재현용 — 알 수 없는 값이 들어와도 죽지 않는지 본다 */
  rawStatus?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, reason: 'NOT_FOUND' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as LifecycleTestRequest | null;
  if (!body) return Response.json({ ok: false, reason: 'INVALID_INPUT' }, { status: 400 });

  const base = createEmptyAnswers();
  const declared: DeclaredPreference = { ...base.declared, ...body.declared };
  const experience: RelationshipExperience = { ...base.experience, ...body.experience };
  const target: TargetProfile = { ...createEmptyTargetProfile(), ...body.target };
  const entries = Array.isArray(body.entries) ? body.entries : [];

  // legacy/unknown 값도 그대로 넣어본다 — 도출 함수가 던지지 않아야 한다.
  const status = (
    'rawStatus' in body ? body.rawStatus : (body.status ?? null)
  ) as RelationshipStatus | null;

  const answers: SessionAnswers = { ...base, status, declared, experience, target };

  const { stage, sufficiency, job } = resolveRelationshipContext(answers);

  /* ── ① 불변이어야 하는 것 ─────────────────────────────────────────────── */
  const compatibility = buildCompatibility(declared, target);
  const mirror = buildMirrorReport(declared, experience);
  const insights = buildCrossSourceInsights({
    declared,
    experience,
    target,
    mirror,
    compatibility,
    validated: [],
    historyChanges: [],
    repeatedSignals: [],
    latestHistoryEntry: entries.length > 0 ? (entries[entries.length - 1] ?? null) : null,
  });

  /* ── ② 문맥에 따라 달라지는 것 ────────────────────────────────────────── */
  const copy = STAGE_JOB_COPY[job];
  const approachHints = buildApproachHints(target, compatibility);
  const questions = buildConversationQuestions(compatibility);

  return Response.json({
    ok: true,
    resolution: {
      status,
      stage,
      sufficiency,
      job,
      statusSupported: status ? (STATUS_SUPPORTED[status] ?? null) : null,
      statusLabel: status ? (STATUS_LABEL[status] ?? null) : null,
      statusDescription: status ? (STATUS_DESCRIPTION[status] ?? null) : null,
    },
    invariant: {
      score: compatibility.score,
      comparedCount: compatibility.comparedCount,
      goodCount: compatibility.goodSignals.length,
      frictionCount: compatibility.frictionSignals.length,
      confidence: compatibility.confidence,
      mirrorStates: mirror.insights.map((insight) => ({
        axis: insight.key,
        state: insight.state,
      })),
      mirrorFocusAxis: mirror.teaser?.axisKey ?? null,
      premiumDeepConnection: hasDeepConnection(insights),
      crossSourceCount: insights.length,
    },
    context: {
      actionKinds: JOB_ACTION_KINDS[job],
      allowsOutwardAction: jobAllowsOutwardAction(job),
      allowsOutwardQuestions: jobAllowsOutwardQuestions(job),
      copy,
      /** 화면이 실제로 그리는 문자열 묶음 — 안전 검사(금지 어휘)는 이 배열을 훑는다 */
      renderedStrings: [
        copy.scoreUse,
        copy.nowWhatTitle,
        copy.nowWhatCaption,
        copy.actionLabel,
        copy.questionLabel,
        copy.mirrorUse,
        ...(jobAllowsOutwardQuestions(job)
          ? questions.map((question) => question.text)
          : (REFLECTION_QUESTIONS[job === 'ended' ? 'ended' : 'none'] as readonly string[])),
        ...(jobAllowsOutwardAction(job)
          ? approachHints.flatMap((hint) => [hint.title, hint.rationale])
          : []),
      ],
      outwardHintCount: jobAllowsOutwardAction(job) ? approachHints.length : 0,
      questionCount: questions.length,
      /**
       * v1.40 §37.9 — **Premium까지 같은 안전 규칙을 받는다.**
       *
       * Ended Safety를 무료 화면에서만 지키면, 관계가 끝났다고 답한 사용자가 돈을 내고
       * `먼저 연락해봐`를 받는다. Release Gate 실측에서 실제로 이 결함이 나왔다 —
       * `/premium`의 `additions`에 `…다가가는 힌트`가 그대로 있었다. 그래서 유료 목록도
       * fixture가 함께 훑는다.
       */
      premiumAdditions: premiumFeatureState('relationship_deep_report', resolvePrice('A'), {
        deepReportAvailable: hasDeepConnection(insights),
        allowsOutwardAction: jobAllowsOutwardAction(job),
      }).additions,
    },
  });
}
