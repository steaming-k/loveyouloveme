import { MIRROR_AXES } from '@/data/axes';
import { resolveEvidenceRefs, type EvidenceResolverContext } from '@/lib/aiEvidenceResolver';
import { normalizeBirthTime, validateBirthTime } from '@/lib/logic/birth';
import { buildCompatibility } from '@/lib/logic/compatibility';
import { buildCrossSourceInsights } from '@/lib/logic/crossSourceInsights';
import { buildFirstContactReport } from '@/lib/logic/firstContact';
import { buildHistoryReport, findRepeatedRelationshipSignals } from '@/lib/logic/history';
import { buildMbtiBridge } from '@/lib/logic/mbtiBridge';
import { buildMbtiLens, buildMbtiSelfLens } from '@/lib/logic/mbtiLens';
import { buildMirrorReport } from '@/lib/logic/mirror';
import {
  deepReportJobContext,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
import { buildSoloHistoryReport } from '@/lib/logic/soloHistory';
import { soloModeOfTarget } from '@/lib/logic/soloMode';
import {
  buildDeepReportContext,
  deepReportActionAllowanceOf,
  deepReportAllowancesOf,
} from '@/services/ai/contextBuilders';
import { actionPrioritiesOf, actionSelectionOf } from '@/lib/logic/actionPriority';
import { hasDeepConnection } from '@/services/premiumConnections';
import {
  answeredDeclaredAxisCount,
  hasPremiumEvidence,
} from '@/lib/logic/premiumChapters';
import {
  LOVY_CLOSING_BODY_POSE,
  LOVY_MID_NOTE,
  LOVY_MID_NOTE_POSE,
  LOVY_REPORT_POSE,
  lovyCheckpointOf,
  lovyConnectionReasonOf,
  lovyMidNoteAfter,
  resolveLovyPoses,
} from '@/lib/premiumLovy';
import { buildRelationshipDeepReport, premiumFeatureState } from '@/services/premiumService';
import { chapterSoWhatOf } from '@/lib/premiumSoWhat';
import { chapterSourceLine, reportLookedAtLine } from '@/lib/premiumMetaCopy';
import { orderMirrorInsightsForDisplay } from '@/lib/resultPriority';
import {
  buildFreeCandidates,
  eventIdsForAi,
  eventTypeHistogram,
  openQuestionFor,
  semanticTopCandidates,
} from '@/lib/logic/insightCandidates';
import { sanitizeRelationshipEvents } from '@/lib/logic/relationshipEvents';
import { buildSelfLevels } from '@/lib/logic/firstContact';
import { buildCrossLensContext, buildPremiumLensContext } from '@/services/ai/contextBuilders';
import { buildConversationQuestions } from '@/lib/logic/conversationQuestions';
import { selectFirstSurprise } from '@/data/lovyNotes';
import { resolvePrice } from '@/lib/premiumVariant';
import { jobAllowsOutwardAction } from '@/lib/logic/relationshipStage';
import { toValidatedObservations } from '@/services/aiService';
import { createEmptyAnswers } from '@/state/defaultAnswers';
import type {
  ActionPlanNarrative,
  CandidateSemanticNarrative,
  CurrentRelationshipEvidence,
  PremiumFeatureId,
  DeclaredPreference,
  DeepAnalysisAnswer,
  DeepNarrative,
  BirthProfile,
  MbtiType,
  ObservationFeedback,
  ObservedProfileResult,
  RelationshipExperience,
  RelationshipHistoryEntry,
  RelationshipStatus,
  SessionAnswers,
  TargetProfile,
} from '@/types';

/**
 * POST /api/dev/premium-test — **개발 전용** Premium Deep Report Fixture 실행기 (v1.45 · §24)
 *
 * `tests/run-premium-fixtures.mjs`가 부른다. 목적은 두 가지다.
 *
 *   ① **Audit 계측** — "현재 Premium이 얇다"를 추측이 아니라 실측으로 말하기 위해서다
 *      (§4). 고데이터 fixture 하나를 현재 코드로 돌려 연결 수 · source 수 · FREE 중복 ·
 *      AI 호출 수를 센다.
 *   ② **회귀 고정** — Chapter 구조가 데이터가 없을 때 filler를 만들지 않는지,
 *      `ended`에서 outward가 0인지를 기존 fixture 방식으로 고정한다.
 *
 * ⚠️ **판정 로직을 여기서 복제하지 않는다.** 화면·훅이 쓰는 것과 같은 함수를 그대로
 * 부르고 결과만 돌려준다(`run-history-fixtures`·`run-trust-fixtures`와 같은 방식).
 * 훅(`useCrossSourceInsights`/`useDeepReport`)의 **배선**만 서버에서 재현한다 —
 * 훅 자체는 `'use client'`라 라우트에서 부를 수 없다.
 *
 * ⚠️ Production에서는 404다. Provider를 호출하지 않고 Key도 읽지 않는다.
 * AI 성공 상태는 `narratives`를 fixture가 직접 넘겨 시뮬레이션한다 — 그래서 AI 실패
 * (narratives 없음)와 성공을 **같은 라우트에서** 비교할 수 있다.
 */
export const runtime = 'nodejs';

interface PremiumTestRequest {
  /** v1.47 Premium UT Visibility — 화면의 `useUtMode()` 값. 생략하면 일반 사용자 */
  utMode?: boolean;
  status?: RelationshipStatus | null;
  declared?: Partial<DeclaredPreference>;
  experience?: Partial<RelationshipExperience>;
  currentRelationship?: Partial<CurrentRelationshipEvidence>;
  target?: Partial<TargetProfile>;
  mbti?: MbtiType | null;
  /** v1.46 PremiumLens — 관계 렌즈(사주·별자리)의 재료. 생략하면 두 렌즈가 unavailable이다 */
  birthProfile?: Partial<BirthProfile>;
  /**
   * UT-1 P2 §3 — 출생시간 **입력 정규화 probe.**
   *
   * 사용자가 적은 문자열을 넣으면 화면과 **같은 두 함수**(`normalizeBirthTime` →
   * `validateBirthTime`)를 통과시킨 결과를 돌려준다. 브라우저를 열지 않고
   * `1030`/`10:30`/`2560`/`999`/문자를 값으로 고정하기 위한 것이고,
   * 리포트 계산에는 관여하지 않는다.
   */
  birthTimeInputs?: string[];
  /** 저장돼 있다고 가정할 기록 (오래된 것 → 최신) */
  entries?: RelationshipHistoryEntry[];
  observedAnalysis?: ObservedProfileResult | null;
  observations?: Record<string, ObservationFeedback>;
  deepAnswers?: DeepAnalysisAnswer[];
  /**
   * AI가 성공했을 때 돌아왔다고 가정할 narrative. 생략하면 **AI 실패/부재** 상태이고,
   * 그 상태에서도 리포트가 완결되는지가 요구되는 검사다.
   */
  narratives?: DeepNarrative[];
  /**
   * SEMANTIC DECOMPOSITION A5 — AI가 성공했을 때 돌아왔다고 가정할 **카드별 문장.**
   * 생략하면 결정론 조립문만 쓴다.
   */
  candidateSemantics?: CandidateSemanticNarrative[];
  /** v1.46.4 Action Layer — AI가 성공했을 때 돌아왔다고 가정할 actionPlan(게이트 통과분) */
  actionPlan?: ActionPlanNarrative | null;
}

function buildAnswers(body: PremiumTestRequest): SessionAnswers {
  const base = createEmptyAnswers();
  return {
    ...base,
    status: body.status ?? null,
    declared: { ...base.declared, ...body.declared },
    experience: { ...base.experience, ...body.experience },
    currentRelationship: { ...base.currentRelationship, ...body.currentRelationship },
    target: { ...base.target, ...body.target },
    mbti: body.mbti ?? null,
    birthProfile: { ...base.birthProfile, ...body.birthProfile },
    observedAnalysis: body.observedAnalysis ?? null,
    observations: body.observations ?? {},
    deepAnswers: body.deepAnswers ?? [],
    /**
     * ⚠️ 사진 자체는 fixture가 넘기지 않지만 `useValidatedObservations`가
     * `photos.length > 0`을 게이트로 쓴다(v1.16 Photo Revisit). fixture가
     * `observedAnalysis`를 넘겼다는 것은 '그 사진이 세션에 있다'는 뜻이므로 최소 한 장을
     * 채워 화면과 같은 상태를 만든다.
     */
    photos: body.observedAnalysis
      ? [{ id: 'fixture-photo', label: 'fixture', source: 'sample' }]
      : [],
  };
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, reason: 'NOT_FOUND' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as PremiumTestRequest | null;
  if (!body) return Response.json({ ok: false, reason: 'INVALID_INPUT' }, { status: 400 });

  /**
   * v1.46.4 §31 — **실제 Provider QA가 제품과 같은 payload를 쓰게 한다.**
   *
   * ⚠️ 기본값은 **꺼져 있다.** 이 라우트의 응답은 fixture 로그로 남고, `aiContext`에는
   * 사건 자유서술이 그대로 들어 있다(그게 Provider에 보내는 것이니까) — 기본으로 켜면
   * 모든 fixture 로그에 본문이 쌓인다(§29). 그래서 `?withAiContext=1`로 **명시적으로**
   * 요청할 때만 낸다.
   *
   * ⚠️ 이 값을 켜고 부르는 곳은 `run-semantic-provider-qa.mjs` 하나다. 그쪽은 본문을
   * 출력하지 않고 Provider에 그대로 전달하기만 한다.
   */
  const withAiContext = new URL(request.url).searchParams.get('withAiContext') === '1';

  const answers = buildAnswers(body);
  const entries = Array.isArray(body.entries) ? body.entries : [];

  const { job } = resolveRelationshipContext(answers);
  const lifecycle = deepReportJobContext(job);
  const { tense } = lifecycle;

  /* ── 화면·훅이 쓰는 것과 같은 selector들 (재계산 아님) ───────────────── */
  const mirror = buildMirrorReport(
    answers.declared,
    answers.experience,
    answers.currentRelationship,
    tense,
  );
  const compatibility = buildCompatibility(answers.declared, answers.target);
  const historyReport = buildHistoryReport(entries);
  const repeatedSignals = findRepeatedRelationshipSignals(entries);
  const mbtiLens = buildMbtiLens(answers.mbti, answers.target.mbti);
  const mbtiBridge = buildMbtiBridge(mbtiLens, compatibility);
  const mbtiSelfLens = buildMbtiSelfLens(answers.mbti);
  const validated = toValidatedObservations(answers.observedAnalysis, answers.observations);
  const soloHistory = buildSoloHistoryReport({
    entries,
    current: buildFirstContactReport({
      declared: answers.declared,
      experience: answers.experience,
      target: answers.target,
      mode: soloModeOfTarget(answers.target),
    }),
  });

  const latest = historyReport.compared.latestId
    ? (entries.find((entry) => entry.id === historyReport.compared.latestId) ?? null)
    : null;
  const previous = historyReport.compared.previousId
    ? (entries.find((entry) => entry.id === historyReport.compared.previousId) ?? null)
    : null;

  const insights = buildCrossSourceInsights({
    declared: answers.declared,
    experience: answers.experience,
    current: answers.currentRelationship,
    tense,
    target: answers.target,
    mirror,
    validated,
    historyChanges: historyReport.changes,
    repeatedSignals,
    latestHistoryEntry: latest,
    previousHistoryEntry: previous,
    deepAnswers: answers.deepAnswers,
    compatibility,
    mbtiBridge,
    mbtiSelfLens,
    soloHistory,
  });

  const resolverContext: EvidenceResolverContext = {
    answers,
    validated,
    historyEntries: entries,
    deepAnswers: answers.deepAnswers,
    compatibility,
    mbtiLens,
    mbtiSelfLens,
    tense,
  };

  const reportInput = {
    insights,
    resolverContext,
    compatibility,
    historyReport,
    repeatedSignals,
    target: answers.target,
    mirror,
    lifecycle,
    // v1.46 PremiumLens — 렌즈 생년월일 유효성 판정용. 일주·태양궁은 날짜 문자열로만 정해진다
    today: new Date(),
  };

  /**
   * SEMANTIC DECOMPOSITION A1 — **훅과 같은 순서로** Top 3를 AI 호출 전에 확정한다.
   * 결정론 리포트(`narratives: []` · `candidateSemantics: []`)의 첫 화면 카드 셋이다.
   */
  const baseReport = buildRelationshipDeepReport({
    ...reportInput,
    narratives: [],
    candidateSemantics: [],
    actionPlan: null,
  });
  const topCandidates = semanticTopCandidates(baseReport.candidates);

  /** Quality Gate (A) 통과분 — **Provider에 보내는 payload**다. 호출 수가 아니다 */
  /**
   * v1.46.4 §4 — **사건을 함께 넘긴다.** fixture가 보는 payload와 제품이 보내는
   * payload가 같아야 §42 예산 보고가 의미를 갖는다.
   */
  /* v1.46.4 Action Layer — 훅과 같은 함수 · 같은 게이트 술어로 Action 카드를 고른다 */
  const actionSelection = actionSelectionOf(topCandidates, {
    tense,
    allowsOutwardQuestions: lifecycle.allowsOutwardQuestions,
    events: answers.target.events ?? [],
    target: answers.target,
  });
  const aiContext = buildDeepReportContext(
    insights,
    resolverContext,
    tense,
    answers.target.events,
    topCandidates,
    actionSelection,
  );

  const report = buildRelationshipDeepReport({
    ...reportInput,
    narratives: body.narratives ?? [],
    candidateSemantics: body.candidateSemantics ?? [],
    actionPlan: body.actionPlan ?? null,
  });

  /**
   * FREE 화면이 이미 보여주는 것 — 중복 계측용. Mirror insight 한 행이 무료의 한 단위다
   * (`/mirror`의 비교 행). Premium 연결이 같은 축·같은 판정만 갖고 있으면 그건 무료에서
   * 이미 본 것이다.
   */
  const freeUnits = mirror.insights.map((insight) => ({
    axis: insight.key,
    state: insight.state,
    scope: insight.evidenceScope,
    /** v1.45 Release — 무료 행이 **어떤 강도의 근거**를 소비했는지. 중복 판정 감사용 */
    strength: insight.evidenceStrength,
    relationshipSignal: insight.relationshipSignal,
  }));

  const connectionRows = [
    ...(report.corePattern
      ? [{ role: 'core' as const, connection: report.corePattern.connection }]
      : []),
    ...report.connections.map((connection) => ({ role: 'connection' as const, connection })),
    ...report.singleSourceNotes.map((connection) => ({ role: 'single' as const, connection })),
  ];

  const byId = new Map(insights.map((insight) => [insight.id, insight]));

  const resolvedPoses = resolveLovyPoses(report.chapters);

  /**
   * v1.46.4 §19 — 무료 Insight. **화면과 같은 함수**를 같은 순서(표시 순서)로 부른다.
   *
   * ⚠️ `usedFingerprints`는 비어 있다 — 무료가 **먼저** 질문을 만들고, 유료가 그
   * fingerprint를 피한다(`premiumService`가 무료 축 질문의 지문을 미리 넣는다).
   * 순서가 반대면 유료가 먼저 좋은 질문을 가져가고 무료가 남은 것을 받는다.
   */
  const freeCandidates = buildFreeCandidates({
    mirrorInsights: orderMirrorInsightsForDisplay(mirror.insights),
    target: answers.target,
    declaredLevels: buildSelfLevels(answers.declared),
    tense,
    allowsOutwardQuestions: lifecycle.allowsOutwardQuestions,
    usedFingerprints: new Set<string>(),
  });

  return Response.json({
    ok: true,
    /**
     * v1.46.4 Meta Copy — 리포트 헤더 한 문장. **화면과 같은 함수**를 같은 입력으로 부른다
     * (META-01 · 05가 이 값을 본다).
     */
    headerLine: reportLookedAtLine({
      groups: report.chapters.flatMap((chapter) => chapter.sourceGroups),
      hasScenes: (report.reportedScenes?.scenes.length ?? 0) > 0,
      tense: report.tense,
    }),
    /**
     * §31 — `?withAiContext=1`일 때만. 제품이 Provider에 보내는 payload 그대로다
     * (본문 포함) — 그래서 기본으로는 내지 않는다.
     */
    ...(withAiContext
      ? {
          aiContext,
          /**
           * SEMANTIC DECOMPOSITION — **제품 요청 본문과 같은 모양.** Real Provider QA가
           * 이 값을 그대로 `/api/ai/deep-report-narrative`에 보낸다(`requestDeepReportNarrative`
           * 와 같은 필드 · 같은 함수로 만든 허용집합).
           */
          aiRequest: {
            context: aiContext,
            insights: aiContext.insights.map((item) => ({
              id: item.id,
              evidenceRefs: item.evidence.map((entry) => entry.ref),
              ruleSummary: item.allowedConnection,
            })),
            tense,
            candidates: deepReportAllowancesOf(aiContext),
            actionAllowance: deepReportActionAllowanceOf(
              aiContext,
              tense === 'current' && lifecycle.allowsOutwardQuestions,
            ),
          },
        }
      : {}),
    /** A1 — AI 호출 전에 확정한 Top 3. 최종 리포트의 앞 3장과 같아야 한다(SEM-DEC-02) */
    semanticTopCandidateIds: topCandidates.map((candidate) => candidate.id),
    /**
     * v1.46.4 Action Layer §5 — AI 요청에 실린 Action 카드와, 그 선택을 만든 우선순위(내부 점수 포함 ·
     * dev 전용). 최종 `report.actionPlan.sourceCandidateId`와 같아야 한다(ACT-SEL).
     */
    actionTargetId: aiContext.actionTarget?.candidateId ?? null,
    actionPriorities: actionPrioritiesOf(topCandidates, {
      tense,
      allowsOutwardQuestions: lifecycle.allowsOutwardQuestions,
      events: answers.target.events ?? [],
      target: answers.target,
    }),
    job,
    tense,
    lifecycle: {
      allowsOutwardAction: lifecycle.allowsOutwardAction,
      allowsOutwardQuestions: lifecycle.allowsOutwardQuestions,
      actionSectionTitle: lifecycle.actionSectionTitle,
    },
    /**
     * v1.45 PostReview §2-1-A — `eligible`과 `reportAvailable`이 **항상 같아야 한다.**
     * 어긋나면 사용자는 돈을 낸 뒤에 빈 리포트를 본다(실측에서 B 케이스가 그랬다).
     */
    gate: {
      hasDeepConnection: hasDeepConnection(insights),
      eligible: hasPremiumEvidence({ insights, declared: answers.declared, mirror }),
      reportAvailable: report.available,
      answeredDeclaredAxes: answeredDeclaredAxisCount(answers.declared),
      mirrorInsightCount: mirror.insights.length,
    },
    /**
     * UT-1 P0-A — **화면이 실제로 보여주는 Premium 진입 상태.**
     *
     * `gate`는 자격만 말한다. 사용자가 막혔을 때 화면이 **어느 길을 알려주는가**는
     * `premiumFeatureState()`가 정하고, 그 분기는 `solo` 하나로 갈린다. 그 값을
     * 호출부가 빠뜨려도 `gate`는 멀쩡하므로(v1.40.1 §38.3과 같은 실패 형태) 여기서
     * 따로 낸다 — fixture가 안내 문구를 **값으로** 고정할 수 있어야 한다.
     *
     * ⚠️ 판정을 복제하지 않는다. 화면과 같은 함수를 같은 술어로 부른다.
     */
    /**
     * UT-1 P2 §3 — 입력 정규화 결과. 화면과 같은 함수를 같은 순서로 부른다.
     * `stored`는 화면이 세션에 넣는 값과 같다(`normalize` 실패 시 원문 그대로).
     */
    birthTimeChecks: (body.birthTimeInputs ?? []).map((raw) => {
      const normalized = normalizeBirthTime(raw);
      const stored = normalized ?? raw;
      return { raw, normalized, stored, error: validateBirthTime(stored) };
    }),
    premiumEntry: (() => {
      const soloMode = soloModeOfTarget(answers.target);
      const feature = premiumFeatureState('relationship_deep_report', resolvePrice('A'), {
        utMode: body.utMode === true,
        deepReportAvailable: hasPremiumEvidence({ insights, declared: answers.declared, mirror }),
        solo: soloMode === 'no_target',
        allowsOutwardAction: jobAllowsOutwardAction(job),
      });
      return {
        soloMode,
        status: feature.status,
        unavailableReason: feature.unavailableReason ?? null,
        /** 상대가 없는 사용자에게 '상대 정보'를 요구하지 않는다 — 값으로 검사한다 */
        mentionsTargetInfo: (feature.unavailableReason ?? '').includes('상대 정보'),
        /**
         * v1.46.4 HARDENING PHASE 3 — **막혔을 때 갈 곳.** null이면 CTA가 없다는 뜻이고,
         * 그건 '지금 풀 수 없는 상태'여야 한다(PREMIUM-FIX-03).
         */
        fix: feature.fix ?? null,
      };
    })(),
    /**
     * v1.46.4 HARDENING PHASE 3 — **모든 Premium feature의 unavailable 상태표.**
     *
     * fixture가 "dead-end가 0인가"를 한 세션에서 전수로 볼 수 있어야 한다. 화면과
     * 같은 함수(`premiumFeatureState`)를 같은 문맥으로 부른다.
     */
    premiumStates: (
      [
        'relationship_deep_report',
        'compatibility_detail',
        'mirror_detail',
        'history_detail',
        'mbti_detail',
        'astrology_detail',
        'saju_detail',
      ] as PremiumFeatureId[]
    ).map((id) => {
      const feature = premiumFeatureState(id, resolvePrice('A'), {
        utMode: body.utMode === true,
        mirrorAvailable: mirror.available,
        historyComparable: historyReport.comparable,
        mbtiAvailable: mbtiLens !== null,
        astrologyAvailable: Boolean(
          answers.birthProfile.date && answers.target.birthProfile?.date,
        ),
        deepReportAvailable: hasPremiumEvidence({ insights, declared: answers.declared, mirror }),
        solo: soloModeOfTarget(answers.target) === 'no_target',
        allowsOutwardAction: jobAllowsOutwardAction(job),
      });
      return {
        id,
        status: feature.status,
        unavailableReason: feature.unavailableReason ?? null,
        fix: feature.fix ?? null,
      };
    }),
    /**
     * v1.46 §11 — **사건이 점수를 바꾸지 않는다**를 fixture가 값으로 확인할 수 있게
     * 이미 계산된 동기화율을 그대로 낸다. 여기서 다시 계산하지 않는다.
     */
    compatibility: {
      score: compatibility.score,
      comparedCount: compatibility.comparedCount,
      confidence: compatibility.confidence,
      alignments: compatibility.dimensions.map((item) => [item.key, item.alignment]),
    },
    /** v1.46 §12 — Mirror 판정도 사건과 무관해야 한다 */
    mirrorStates: mirror.insights.map((item) => [item.key, item.state]),
    insights: insights.map((insight) => ({
      id: insight.id,
      type: insight.type,
      axis: insight.axis ?? null,
      sources: insight.sources,
      uniqueSourceCount: new Set(insight.sources).size,
      evidenceRefCount: insight.evidenceRefs.length,
      /** v1.45 Release — 실제 ref 목록. FREE 중복 판정을 근거 단위로 감사하려면 필요하다 */
      evidenceRefs: insight.evidenceRefs.map((ref) =>
        'field' in ref
          ? `${ref.source}:${ref.field}`
          : 'traitId' in ref
            ? `${ref.source}:${ref.traitId}`
            : 'entryId' in ref
              ? `${ref.source}:${ref.entryId}:${ref.axis}`
              : 'eventId' in ref
                ? `${ref.source}:${ref.eventId}`
                : `${ref.source}:${ref.questionId}`,
      ),
      resolvedEvidenceCount: resolveEvidenceRefs(insight.evidenceRefs, resolverContext).length,
      strength: insight.strength,
      eligibleForNarrative: insight.eligibleForNarrative,
      ruleSummary: insight.ruleSummary,
    })),
    /**
     * ══ v1.46.4 HARDENING PHASE 5 — **FULL PREMIUM FLOW 기준으로 센다** ══════
     *
     * ⚠️ Candidate 보고의 `providerCalls: 1`은 **Deep Report Task 하나**만 센 값이었다.
     * 필드 이름이 `ai.providerCalls`라 전체 호출 수처럼 읽혔지만, 실제 Premium 번들은
     * 렌즈 3종과 Cross-Lens를 따로 부른다 — 최대 5회다. 숫자가 아니라 **이름이**
     * 틀렸던 것이고, 그래서 Task별로 나눠 낸다.
     *
     * ⚠️ 여기서 실제 Provider를 부르지 않는다. 세는 것은 **이 세션이 만들 호출의 수**이고,
     * 각 Task의 게이트(재료가 없으면 호출하지 않는다)를 화면과 같은 규칙으로 적용한다.
     */
    ai: (() => {
      /** Deep Report — 보낼 Insight가 하나도 없으면 부르지 않는다 */
      const deepReportCalls = aiContext.insights.length > 0 ? 1 : 0;

      /** 렌즈 — `unavailable`이 아닌 렌즈마다 1회 */
      const lensReports = report.lensBundle.lenses.filter((lens) => lens.mode !== 'unavailable');
      const lensContexts = lensReports.map((lens) =>
        buildPremiumLensContext({
          report: lens,
          declared: answers.declared,
          events: answers.target.events,
          tense,
          targetExists: soloModeOfTarget(answers.target) !== 'no_target',
        }),
      );

      /** Cross-Lens — 렌즈가 2개 이상일 때만(§18) */
      const crossLensCalls = lensReports.length >= 2 ? 1 : 0;
      const crossContext =
        crossLensCalls > 0
          ? buildCrossLensContext({
              reports: lensReports,
              aiThemes: {},
              declared: answers.declared,
              events: answers.target.events,
              tense,
              deterministic: report.lensBundle.crossLens,
              targetExists: soloModeOfTarget(answers.target) !== 'no_target',
            })
          : null;

      /**
       * 한 호출의 입력 크기. **payload 문자열 길이**로 잰다.
       *
       * ⚠️ 토큰 추정은 한국어 기준 대략 `chars / 1.6`이다(BPE에서 한글 한 글자가
       * 평균 1.5~1.7 토큰에 대응). 정확한 값이 아니라 **자릿수**를 보기 위한 것이고,
       * 이 값으로 비용을 확정하지 않는다.
       */
      const sizeOf = (payload: unknown) => {
        const chars = JSON.stringify(payload ?? {}).length;
        return { inputChars: chars, estTokens: Math.round(chars / 1.6) };
      };

      const eventCharsOf = (events: { description: string; myReaction: string | null }[]) =>
        events.reduce(
          (total, event) => total + event.description.length + (event.myReaction?.length ?? 0),
          0,
        );

      /**
       * §42 — Deep Report payload에 실제로 실린 장면. **payload에서 직접 읽는다** —
       * 선별을 다시 돌려 만들면 '보낸 것'이라는 보장이 없다(`allowedSceneIdsOf`와
       * 같은 규칙).
       */
      const deepReportScenes =
        deepReportCalls > 0
          ? (aiContext.candidates ?? []).flatMap((bundle) =>
              bundle.selectedEvents.map((scene) => ({
                id: scene.eventId,
                type: scene.type,
                fact: scene.situation,
                myReaction: scene.myReaction,
              })),
            )
          : [];

      /**
       * §SEM-01 — payload에 실린 장면 **본문의 지문.**
       *
       * ⚠️ 왜 필요한가: "같은 판정 + 다른 사건 본문 → 다른 Provider context"를 값으로
       * 판정하려면 본문이 달라졌다는 사실을 봐야 한다. `inputChars`로는 부족하다 —
       * 길이가 같고 뜻이 반대인 수정이 가장 위험한 경우다(§43의 실패 예).
       *
       * ⚠️ **원문을 내보내지 않는다.** 나가는 것은 FNV-1a 해시 한 개뿐이다
       * (§29 · §44 Privacy — fixture 로그에 자유 입력이 남지 않는다).
       */
      const digestOf = (value: string) => {
        let hash = 0x811c9dc5;
        for (let i = 0; i < value.length; i += 1) {
          hash ^= value.charCodeAt(i);
          hash = Math.imul(hash, 0x01000193);
        }
        return (hash >>> 0).toString(36);
      };

      /**
       * §5-1 — Provider payload에 실린 장면을 **원래 id로 되짚는다.**
       *
       * ⚠️ 왜 필요한가: '가장 오래된 2개가 고정으로 간다'는 결함은 **어느 장면이
       * 갔는지**를 봐야만 보인다. 종류만으로는 ev-s1과 ev-s9를 구분할 수 없다.
       *
       * ⚠️ **본문은 나가지 않는다.** payload의 description은 AI 경계에서 120자로
       * 잘려 있으므로 접두어로 원본을 찾고, 내보내는 것은 **id뿐**이다.
       */
      const idsOf = (payload: { description: string }[]) =>
        payload
          .map(
            (item) =>
              answers.target.events.find((event) =>
                event.description.startsWith(item.description.slice(0, 20)),
              )?.id ?? null,
          )
          .filter((id): id is string => id !== null);

      return {
        /** @deprecated 이름이 오해를 샀다 — `totalCalls`를 써라. 회귀 비교용으로만 남긴다 */
        providerCalls: deepReportCalls,
        itemsSent: aiContext.insights.length,
        totalCalls: deepReportCalls + lensContexts.length + crossLensCalls,
        calls: [
          /**
           * ══ v1.46.4 §42 — **Deep Report도 장면을 싣는다** ══════════════════
           *
           * v1.46.4 HARDENING까지 이 행의 event 값은 전부 0이었고, 주석은
           * "Core Task는 여전히 사건을 받지 않는다"였다. SEMANTIC이 그 경계를
           * 옮겼으므로 값도 실측으로 바뀐다 — 0을 하드코딩해두면 예산이 늘어난
           * 것을 fixture가 볼 수 없다.
           */
          {
            task: 'deep-report',
            count: deepReportCalls,
            ...sizeOf(deepReportCalls > 0 ? aiContext : null),
            eventCount: deepReportScenes.length,
            eventChars: eventCharsOf(
              deepReportScenes.map((scene) => ({
                description: scene.fact,
                myReaction: scene.myReaction,
              })),
            ),
            eventTypes: deepReportScenes.map((scene) => scene.type),
            eventIds: deepReportScenes.map((scene) => scene.id),
            /** §SEM-01 — 실린 본문의 해시. 본문이 아니라 해시다 */
            eventDigest: digestOf(
              deepReportScenes
                .map((scene) => `${scene.id}|${scene.fact}|${scene.myReaction ?? '-'}`)
                .join('||'),
            ),
          },
          ...lensContexts.map((context, index) => ({
            task: `lens:${lensReports[index]!.kind}`,
            count: 1,
            ...sizeOf(context),
            eventCount: context.reportedEvents.length,
            eventChars: eventCharsOf(context.reportedEvents),
            /**
             * §5-1 — **어느 장면이 실제로 갔는가.** 본문이 아니라 id·종류만 낸다.
             * '가장 오래된 2개가 고정으로 가는가'를 값으로 볼 수 있어야 한다.
             */
            eventTypes: context.reportedEvents.map((event) => event.type),
            eventIds: idsOf(context.reportedEvents),
          })),
          ...(crossContext
            ? [
                {
                  task: 'cross-lens',
                  count: 1,
                  ...sizeOf(crossContext),
                  eventCount: crossContext.reportedEvents.length,
                  eventChars: eventCharsOf(crossContext.reportedEvents),
                  eventTypes: crossContext.reportedEvents.map((event) => event.type),
                  eventIds: idsOf(crossContext.reportedEvents),
                },
              ]
            : []),
        ],
      };
    })(),
    /** v1.45 PostReview §3 — 화면과 **같은 함수**로 리포트 단위 포즈를 계산한다 */
    /** v1.45 — Chapter가 이 리포트의 렌더 단위다. fixture의 1차 판정 대상 */
    chapters: report.chapters.map((chapter) => ({
      id: chapter.id,
      kind: chapter.kind,
      index: chapter.index,
      title: chapter.title,
      eyebrow: chapter.eyebrow,
      insightIds: chapter.insightIds,
      sourceGroups: chapter.sourceGroups,
      sourceGroupCount: chapter.sourceGroups.length,
      /** v1.46.4 Meta Copy — 접힌 Chapter 헤더에 그려지는 source 라벨(화면과 같은 함수) */
      sourceLine: chapterSourceLine(chapter.sourceGroups, report.tense),
      evidenceCount: chapter.evidence.length,
      evidence: chapter.evidence.map((item) => ({
        sourceLabel: item.sourceLabel,
        text: item.text,
      })),
      deterministicSummary: chapter.deterministicSummary,
      deterministicTakeaway: chapter.deterministicTakeaway,
      hasNarrative: Boolean(chapter.narrativeText),
      narrativeText: chapter.narrativeText,
      question: chapter.question,
      limitation: chapter.limitation,
      audience: chapter.audience,
      noveltyKey: chapter.noveltyKey,
      /*
        v1.45 캐릭터 통합 — **표현 계층**(`lib/premiumLovy.ts`)이 이 Chapter에 무엇을
        붙이는지. 화면과 **같은 함수**를 호출한다.

        ⚠️ fixture가 정적 소스 스캔으로 끝내지 않기 위해 필요한 자리다. LOVY-04(금지
        어휘 0)·LOVY-09(ended outward 0)는 **실제로 렌더될 문장**을 봐야 판정할 수
        있는데, 그 문장은 `PremiumChapter`에 없고 이 함수들이 만든다.
      */
      /** 파생(uncertainty · next_check · closing)이 아닌 '내용' Chapter인가 */
      isContent: !['uncertainty', 'next_check', 'closing'].includes(chapter.kind),
      lovyPose: resolvedPoses[chapter.index - 1] ?? null,
      lovyCheckpoint: lovyCheckpointOf(chapter, {
        tense,
        allowsOutwardAction: lifecycle.allowsOutwardAction,
      }),
      /**
       * v1.46.4 §7 — 화면이 ①②에 그리는 문장. **화면과 같은 함수**를 부른다.
       * 파생 Chapter에서는 null이고, 그때 화면은 기존 규칙 문장을 본문으로 쓴다.
       */
      soWhat: chapterSoWhatOf(chapter, { tense }),
      lovyConnectionReason: lovyConnectionReasonOf(chapter),
    })),
    /**
     * v1.45 — 리포트 단위 캐릭터 배치. `midNoteAfter`가 null이면 중간 메모가 없다
     * (Chapter 6개 미만 = Sparse). **Chapter 수에는 절대 포함되지 않는다**(LOVY-06).
     */
    lovy: {
      reportPose: LOVY_REPORT_POSE,
      closingBodyPose: LOVY_CLOSING_BODY_POSE,
      midNotePose: LOVY_MID_NOTE_POSE,
      midNoteAfter: lovyMidNoteAfter(report.chapters.length),
      midNoteLabel: LOVY_MID_NOTE.label,
      midNoteBody: LOVY_MID_NOTE.body,
    },
    omissions: report.omissions,
    report: {
      available: report.available,
      overviewHeadline: report.overview.headline,
      overviewSubcopy: report.overview.subcopy,
      topSummaries: report.overview.topSummaries,
      corePatternId: report.corePattern?.connection.id ?? null,
      connectedSourceCount: report.corePattern?.connectedSourceCount ?? 0,
      connectionCount: report.corePattern?.connectionCount ?? 0,
      renderedUnits: connectionRows.map((row) => ({
        role: row.role,
        id: row.connection.id,
        axis: row.connection.axis,
        type: byId.get(row.connection.id)?.type ?? null,
        sourceCount: row.connection.sourceCount,
        sourceLabels: row.connection.sourceLabels,
        evidenceCount: row.connection.evidence.length,
        hasNarrative: Boolean(row.connection.narrativeText),
        ruleSummary: row.connection.ruleSummary,
        limitation: row.connection.limitation,
      })),
      actions: report.actions.map((action) => ({
        kind: action.kind,
        audience: action.audience,
        text: action.text,
      })),
      connectionQuestions: report.connectionQuestions.map((item) => ({
        id: item.question.id,
        audience: item.audience,
        text: item.question.text,
      })),
      historyDeepAvailable: report.historyDeep?.available ?? false,
      approachInsight: report.approachInsight?.title ?? null,
      /**
       * v1.46 §12 — 사용자가 알려준 관계 맥락 블록. **Chapter 수와 별개다** —
       * fixture가 `chapters.length`와 이 값이 서로 영향을 주지 않는지 본다(EVT-*).
       */
      reportedScenes: report.reportedScenes,
      /**
       * v1.46 PremiumLens — 관계 렌즈 3종 + Cross-Lens. `tests/run-lens-fixtures.mjs`가
       * 이 값을 읽는다.
       *
       * ⚠️ **가공하지 않고 그대로 낸다.** 라우트가 요약하면 fixture가 보는 것과
       * 화면이 그리는 것이 갈라진다 — v1.41 §39.9가 정확히 그 자리에서 시제를 놓쳤다.
       */
      /**
       * v1.46.4 §6 · VALUE-01/02 — 첫 viewport 3줄. 라우트가 다시 만들지 않고
       * 리포트가 이미 들고 있는 값을 그대로 낸다.
       */
      executive: report.executive,
      /** v1.46.4 Action Layer — 화면이 그리는 단일 Action 블록(가공 없음) */
      actionPlan: report.actionPlan,
      /**
       * v1.46.4 §12 ~ §16 — **이번 개편의 1차 판정 대상.** 라우트가 가공하지 않고
       * 리포트가 들고 있는 값을 그대로 낸다(화면과 fixture가 같은 것을 본다).
       */
      candidates: report.candidates.map((candidate) => ({
        id: candidate.id,
        chapterId: candidate.chapterId,
        axis: candidate.primaryAxis,
        verdict: candidate.verdict,
        evidenceSourceCount: candidate.evidenceSourceCount,
        evidenceSources: [...new Set(candidate.evidenceRefs.map((ref) => ref.source))],
        hasOutsideFreeEvidence: candidate.hasOutsideFreeEvidence,
        hasCrossSourceConnection: candidate.hasCrossSourceConnection,
        hasContradiction: candidate.hasContradiction,
        hasUnresolvedPoint: candidate.hasUnresolvedPoint,
        hasUserReportedEvent: candidate.hasUserReportedEvent,
        relevantEventIds: candidate.relevantEventIds,
        /** §9 · §19 — AI가 실제로 의미를 이은 장면. semantic이 없으면 빈 배열 */
        semanticEventIds: candidate.semanticEventIds,
        /** §19 — fallback 사용률 계측의 값. high-data 정상 경로에서 static 0 */
        soWhatSource: candidate.soWhatSource,
        /** Operator Pass §8 — semantic_ai일 때 모델이 고른 해석 틀 */
        insightOperator: candidate.insightOperator,
        /** Operator Pass §21 — QA의 NEW(좁혀진 조건). 화면에는 그리지 않는다 */
        narrowedCondition: candidate.narrowedCondition,
        /** §12 — 근거 조합 문장. **첫 화면이 아니라 토글 안** */
        evidenceNote: candidate.evidenceNote,
        /** §13 — VERIFY 한 줄. AI가 못 만들면 null */
        verification: candidate.verification,
        noveltyScore: Number(candidate.noveltyScore.toFixed(3)),
        actionabilityScore: Number(candidate.actionabilityScore.toFixed(3)),
        confidenceLevel: candidate.confidenceLevel,
        headline: candidate.headline,
        soWhat: candidate.soWhat,
        whyItMatters: candidate.whyItMatters,
        questions: candidate.questions.map((question) => ({
          id: question.id,
          register: question.register,
          text: question.text,
          fingerprint: question.fingerprint,
          basis: question.basis,
        })),
        limitation: candidate.limitation,
        composed: candidate.composed,
      })),
      /** §21 — 재료가 없으면 null이다. VALUE-15가 이 값과 근거 유무를 함께 본다 */
      paywallTease: report.paywallTease,
      lensBundle: report.lensBundle,
      lovyObservation: report.lovyObservation,
      limitations: report.limitations,
    },
    free: {
      mirrorUnits: freeUnits,
      axisTotal: MIRROR_AXES.length,
      /**
       * v1.46.4 VALUE-01/09 — 무료 화면이 실제로 그리는 값들.
       *
       * `phrases`는 **사용자 입력값**이다(재진술 검사의 기준표). `scenes`는 그 값에서
       * 규칙이 만든 SO WHAT 문장이다. 둘을 나눠 내야 "첫 화면에 입력값이 있는가"를
       * 문자열 대조로 판정할 수 있다.
       */
      phrases: compatibility.dimensions.flatMap((dimension) => [
        dimension.minePhrase,
        dimension.theirsPhrase,
      ]),
      scenes: compatibility.dimensions.map((dimension) => ({
        axis: dimension.key,
        tone: dimension.tone,
        scene: dimension.scene,
      })),
      /** 무료 화면의 확인 질문 (VALUE-10) */
      questions: buildConversationQuestions(compatibility, {
        job,
        declared: answers.declared,
        target: answers.target,
        currentSignals: answers.currentRelationship,
      }).map((question) => question.text),
      /** YOUR SIGNAL 한 줄 — 여기에 입력값이 다시 들어가면 안 된다 */
      surpriseSignal: selectFirstSurprise(compatibility)?.signal ?? null,
      /**
       * v1.46.4 §18 ~ §21 — **무료가 만드는 Insight.** Premium Chapter 엔진을 부르지
       * 않고 Mirror 행에서 같은 조립기로 만든다(`buildFreeCandidates` 상단 참고).
       */
      candidates: freeCandidates.map((candidate) => ({
        id: candidate.id,
        axis: candidate.primaryAxis,
        verdict: candidate.verdict,
        soWhat: candidate.soWhat,
        whyItMatters: candidate.whyItMatters,
        /** §19 — 무료에는 AI 계층이 없다. `semantic_ai`가 나오면 그건 결함이다 */
        soWhatSource: candidate.soWhatSource,
        evidenceNote: candidate.evidenceNote,
        hasUserReportedEvent: candidate.hasUserReportedEvent,
        hasOutsideFreeEvidence: candidate.hasOutsideFreeEvidence,
        composed: candidate.composed,
        questions: candidate.questions.map((question) => ({
          register: question.register,
          text: question.text,
          fingerprint: question.fingerprint,
        })),
      })),
      /** §19 — 마지막 한 줄. 주어가 '나'라서 `ended`에서도 안전하다 */
      openQuestion: openQuestionFor(freeCandidates[0]),
    },
    /**
     * v1.46.4 §41 · §52 — **사건 감사.** 저장은 전부, AI로 나가는 것은 일부라는
     * 구조를 값으로 볼 수 있어야 한다(EVENT-LIMIT-10 · EVENT-LIMIT-11).
     *
     * ⚠️ **본문(`description`·`myReaction`)은 여기서 절대 내보내지 않는다.** 이
     * 라우트의 응답은 fixture 로그로 남고, 자유 입력이 로그에 남는 순간
     * `lib/logic/relationshipEvents.ts`가 세운 경계가 깨진다. 나가는 것은 개수와
     * 종류(categorical)와 **길이 합계**뿐이다.
     */
    events: (() => {
      const events = answers.target.events;
      /**
       * §42 — Deep Report payload에 실린 장면 수. **payload에서 직접 센다** —
       * `aiContext`는 위에서 제품과 같은 함수로 만든 값이다.
       */
      const deepReportSceneCount = (aiContext.candidates ?? []).reduce(
        (total, bundle) => total + bundle.selectedEvents.length,
        0,
      );
      const lensContexts = report.lensBundle.lenses
        .filter((entry) => entry.mode !== 'unavailable')
        .map((entry) =>
          buildPremiumLensContext({
            report: entry,
            declared: answers.declared,
            events,
            tense,
            targetExists: soloModeOfTarget(answers.target) !== 'no_target',
          }),
        );
      const crossLens =
        lensContexts.length >= 2
          ? buildCrossLensContext({
              reports: report.lensBundle.lenses.filter((entry) => entry.mode !== 'unavailable'),
              aiThemes: {},
              declared: answers.declared,
              events,
              tense,
              deterministic: report.lensBundle.crossLens,
              targetExists: soloModeOfTarget(answers.target) !== 'no_target',
            })
          : null;

      /** 실제로 Provider payload에 실리는 사건 건수 — 호출별 합계 */
      const sentToLenses = lensContexts.reduce(
        (total, context) => total + context.reportedEvents.length,
        0,
      );

      /*
        v1.46.4 HARDENING PHASE 1-4 — **저장 스트레스 probe.**

        화면과 같은 경로(`serialize` 상당 + `sanitizeRelationshipEvents`)를 통과시켜
        "몇 바이트가 되는가 / 복원하면 몇 개가 남는가 / 글자가 사라지는가"를 값으로
        낸다. 브라우저 quota 자체는 서버에서 잴 수 없으므로 **바이트와 복원 충실도**만
        본다 — 실제 quota 경계는 브라우저 실측이 담당한다.

        ⚠️ 본문은 나가지 않는다. 나가는 것은 길이와 개수뿐이다.
      */
      const serialized = JSON.stringify(answers);
      const restored = sanitizeRelationshipEvents(
        JSON.parse(JSON.stringify(events)) as unknown,
      );
      const charLoss = events.reduce((total, event, index) => {
        const back = restored.events[index];
        if (!back) return total + event.description.length + (event.myReaction?.length ?? 0);
        return (
          total +
          (event.description.length - back.description.length) +
          ((event.myReaction?.length ?? 0) - (back.myReaction?.length ?? 0))
        );
      }, 0);

      return {
        stored: events.length,
        histogram: eventTypeHistogram(events),
        /** 세션 전체 직렬화 바이트 (UTF-8) — 화면의 storageStatus가 보는 값과 같은 기준 */
        sessionBytes: Buffer.byteLength(serialized, 'utf8'),
        /** 복원 후 남은 개수. `stored`와 다르면 어딘가에서 버려졌다는 뜻이다 */
        restoredCount: restored.events.length,
        /** 복원 과정에서 버려진 항목 수. 정상 입력에서는 0이어야 한다 */
        restoreDropped: restored.dropped,
        /** 복원 전후 문자 손실 합계. **0이 아니면 silent truncation이다** */
        charLoss,
        /** 저장된 자유 입력의 총 길이. **본문이 아니라 길이다** */
        rawChars: events.reduce(
          (total, event) => total + event.description.length + (event.myReaction?.length ?? 0),
          0,
        ),
        /** §10 — Candidate가 고른 shortlist(중복 제거) */
        shortlisted: eventIdsForAi(report.candidates).length,
        /** 실제로 AI에 나가는 건수 */
        sentToLenses,
        sentToCrossLens: crossLens?.reportedEvents.length ?? 0,
        /**
         * ══ v1.46.4 SEMANTIC — **경계가 옮겨졌다** ══════════════════════════
         *
         * 이 값은 v1.46.4 HARDENING까지 상수 0이었고, 주석은 Core Task가 자유서술을
         * 받지 않는 이유를 가리켰다(`logic/relationshipEvents.ts`의 (A)/(B) 분석).
         * §7이 그 결론을 뒤집었다 — (B)의 위험(근거 귀속이 Task 단위로 되돌아간다)은
         * `usedEventIds` 부분집합 검증 + semantic 전용 스캐너로 닫았다(§9 · §10).
         *
         * ⚠️ 상한이 있다. 사건 20개 세션에서도 이 값은 4를 넘지 않는다(§5 · §42).
         */
        sentToDeepReport: deepReportSceneCount,
        /** §52 — 렌즈 호출 하나가 싣는 사건 문자열 길이(대략적 토큰 추정의 근거) */
        lensEventChars: lensContexts.reduce(
          (total, context) =>
            total +
            context.reportedEvents.reduce(
              (sum, event) => sum + event.description.length + (event.myReaction?.length ?? 0),
              0,
            ),
          0,
        ),
      };
    })(),
    /**
     * v1.46.4 §14 · VALUE-07/08 — Mirror 행의 **표시 순서**. 판정이 아니라 순서다.
     * 화면(`/mirror`)과 같은 함수를 부른다.
     */
    mirrorDisplayOrder: orderMirrorInsightsForDisplay(mirror.insights).map((insight) => [
      insight.key,
      insight.state,
    ]),
  });
}
