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
import { buildDeepReportContext } from '@/services/ai/contextBuilders';
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
import { resolvePrice } from '@/lib/premiumVariant';
import { jobAllowsOutwardAction } from '@/lib/logic/relationshipStage';
import { toValidatedObservations } from '@/services/aiService';
import { createEmptyAnswers } from '@/state/defaultAnswers';
import type {
  CurrentRelationshipEvidence,
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

  /** Quality Gate (A) 통과분 — **Provider에 보내는 payload**다. 호출 수가 아니다 */
  const aiContext = buildDeepReportContext(insights, resolverContext, tense);

  const report = buildRelationshipDeepReport({
    insights,
    narratives: body.narratives ?? [],
    resolverContext,
    compatibility,
    historyReport,
    repeatedSignals,
    target: answers.target,
    mirror,
    lifecycle,
    // v1.46 PremiumLens — 렌즈 생년월일 유효성 판정용. 일주·태양궁은 날짜 문자열로만 정해진다
    today: new Date(),
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

  return Response.json({
    ok: true,
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
      };
    })(),
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
    /** AI에게 보내는 항목 수. **호출 수는 언제나 1이다**(`runDeepReportTask` 한 번) */
    ai: {
      providerCalls: aiContext.insights.length > 0 ? 1 : 0,
      itemsSent: aiContext.insights.length,
    },
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
      lensBundle: report.lensBundle,
      lovyObservation: report.lovyObservation,
      limitations: report.limitations,
    },
    free: { mirrorUnits: freeUnits, axisTotal: MIRROR_AXES.length },
  });
}
