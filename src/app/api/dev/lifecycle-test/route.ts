import { REFLECTION_QUESTIONS, STAGE_JOB_COPY, STATUS_DESCRIPTION } from '@/data/stageCopy';
import { PAST_FACTOR_ORDER, STATUS_LABEL, STATUS_SUPPORTED } from '@/data/labels';
import { HARDEST_OPTIONS, SELF_GAP_OPTIONS } from '@/data/pastQuestions';
import { buildCompatibility } from '@/lib/logic/compatibility';
import { buildCrossSourceInsights } from '@/lib/logic/crossSourceInsights';
import { buildHistoryReport, findRepeatedRelationshipSignals } from '@/lib/logic/history';
import { buildHistoryEntry } from '@/lib/logic/history';
import { buildMirrorReport } from '@/lib/logic/mirror';
import { selectDeepQuestions } from '@/data/deepQuestions';
import { NO_CURRENT_RELATIONSHIP, scopeCaptionOf } from '@/lib/logic/relationshipEvidence';
import { CURRENT_SIGNAL_VALUES } from '@/data/currentRelationship';
import { MIRROR_AXES } from '@/data/axes';
import {
  deepReportJobContext,
  JOB_ACTION_KINDS,
  jobAllowsOutwardAction,
  jobAllowsOutwardQuestions,
  jobInvitesCurrentEvidence,
  relationshipTenseOf,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
import { buildApproachHints } from '@/lib/logic/approachHints';
import { buildConversationQuestions } from '@/lib/logic/compatibility';
import { resolvePrice } from '@/lib/premiumVariant';
import { hasDeepConnection } from '@/services/premiumConnections';
import { buildRelationshipDeepReport, premiumFeatureState } from '@/services/premiumService';
import { createEmptyAnswers, createEmptyTargetProfile } from '@/state/defaultAnswers';
import type {
  CurrentRelationshipEvidence,
  MirrorAxisKey,
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

/* ─────────────────────────────────────── Fixture Enum Guard (v1.40.1) */

/**
 * Fixture가 보낸 값이 **실제 enum인지** 확인한다. (v1.40.1 · §38.5)
 *
 * ══ 왜 필요한가 ═══════════════════════════════════════════════════════════
 *
 * `tests/*.mjs`는 TypeScript가 아니라 `tsc --noEmit`을 받지 않는다. 그래서 v1.40
 * fixture에 `selfGap: 'more_expressive'`가 들어 있었는데 — `SelfGapAnswer`는
 * `'yes'|'some'|'no'`다 — **아무도 실패하지 않았다.** 이 라우트가
 * `{ ...base.experience, ...body.experience }`로 그냥 펴 넣었고, `selfGap`은 Mirror
 * 판정에 쓰이지 않으므로 결과가 달라지지 않았기 때문이다. 결과적으로 L0~L12 **전부가
 * `selfGap`을 한 번도 유효값으로 실행하지 않았다.**
 *
 * 조용히 통과하는 것이 문제이므로, 여기서 **400으로 시끄럽게 실패시킨다.**
 * fixture의 `run()`은 non-ok에서 throw하므로 잘못된 enum은 즉시 드러난다.
 *
 * ⚠️ **새 source of truth를 만들지 않았다.** 허용값 목록은 전부 화면이 실제로 쓰는
 * 데이터 모듈에서 읽는다(`SELF_GAP_OPTIONS`·`HARDEST_OPTIONS`·`PAST_FACTOR_ORDER`·
 * `STATUS_LABEL`). 옵션이 늘면 이 검사도 같이 늘어난다 — 두 벌이 되지 않는다.
 * ⚠️ Production 404 뒤에 있고, dev 전용이다. 사용자 입력 검증이 아니다.
 */
const ENUM_VALUES = {
  selfGap: SELF_GAP_OPTIONS.map((option) => option.value as string),
  hardest: HARDEST_OPTIONS.map((option) => option.value as string),
  important: PAST_FACTOR_ORDER.map((factor) => factor as string),
  status: Object.keys(STATUS_LABEL),
  // v1.41 — 현재 근거도 같은 게이트를 받는다. 허용값은 화면이 쓰는 모듈에서 읽는다.
  currentSignal: CURRENT_SIGNAL_VALUES.map((value) => value as string),
  currentAxis: MIRROR_AXES.map((axis) => axis.key as string),
} as const;

/** @returns 문제가 있으면 설명, 없으면 null */
function findEnumViolation(body: LifecycleTestRequest): string | null {
  const experience = body.experience;

  if (experience) {
    const { selfGap, hardest, important } = experience;
    if (selfGap != null && !ENUM_VALUES.selfGap.includes(selfGap)) {
      return `experience.selfGap='${String(selfGap)}' — 허용: ${ENUM_VALUES.selfGap.join('|')}`;
    }
    if (hardest != null && !ENUM_VALUES.hardest.includes(hardest)) {
      return `experience.hardest='${String(hardest)}' — 허용: ${ENUM_VALUES.hardest.join('|')}`;
    }
    if (important != null) {
      if (!Array.isArray(important)) return 'experience.important은 배열이어야 한다';
      for (const factor of important) {
        if (!ENUM_VALUES.important.includes(factor)) {
          return `experience.important에 '${String(factor)}' — 허용: ${ENUM_VALUES.important.join('|')}`;
        }
      }
    }
  }

  /**
   * `status`는 검사하되 `rawStatus`는 **검사하지 않는다.** L0이 알 수 없는 legacy 값을
   * 일부러 넣어 '죽지 않는지' 보는 자리이므로, 그 입구를 막으면 그 테스트가 사라진다.
   * 두 필드를 나눠 둔 것이 그 구분이다.
   */
  if (!('rawStatus' in body) && body.status != null && !ENUM_VALUES.status.includes(body.status)) {
    return `status='${String(body.status)}' — 허용: ${ENUM_VALUES.status.join('|')}`;
  }

  /**
   * v1.41 — 현재 근거의 **축 키와 값 둘 다** 검사한다.
   *
   * 축 키를 검사하는 이유: `signals`는 `Partial<Record<MirrorAxisKey, …>>`라 오타 키가
   * 들어와도 Mirror가 `MIRROR_AXES`만 조회하므로 **조용히 무시된다.** v1.40의
   * `selfGap: 'more_expressive'`와 완전히 같은 실패 형태다 — fixture는 근거를 넣었다고
   * 믿고, 판정은 근거 없이 계산되고, 아무도 실패하지 않는다.
   */
  const signals = body.currentRelationship?.signals;
  if (signals != null) {
    if (typeof signals !== 'object' || Array.isArray(signals)) {
      return 'currentRelationship.signals는 객체여야 한다';
    }
    for (const [axis, value] of Object.entries(signals)) {
      if (!ENUM_VALUES.currentAxis.includes(axis)) {
        return `currentRelationship.signals에 축 '${axis}' — 허용: ${ENUM_VALUES.currentAxis.join('|')}`;
      }
      if (value != null && !ENUM_VALUES.currentSignal.includes(value as string)) {
        return `currentRelationship.signals.${axis}='${String(value)}' — 허용: ${ENUM_VALUES.currentSignal.join('|')}`;
      }
    }
  }

  return null;
}

interface LifecycleTestRequest {
  /** S05에서 고른 관계 상태. `null`이면 아직 고르지 않은 상태 */
  status?: RelationshipStatus | null;
  declared?: Partial<DeclaredPreference>;
  experience?: Partial<RelationshipExperience>;
  target?: Partial<TargetProfile>;
  entries?: RelationshipHistoryEntry[];
  /** legacy 세션 재현용 — 알 수 없는 값이 들어와도 죽지 않는지 본다 */
  rawStatus?: unknown;
  /** v1.41 §39.4 — 지금 관계 근거. 넣지 않으면 v1.40.1과 동일 동작이어야 한다 */
  currentRelationship?: Partial<CurrentRelationshipEvidence>;
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false, reason: 'NOT_FOUND' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as LifecycleTestRequest | null;
  if (!body) return Response.json({ ok: false, reason: 'INVALID_INPUT' }, { status: 400 });

  // v1.40.1 §38.5 — 잘못된 enum이 조용히 기본값으로 떨어지게 두지 않는다.
  const enumViolation = findEnumViolation(body);
  if (enumViolation !== null) {
    return Response.json(
      { ok: false, reason: 'INVALID_ENUM', detail: enumViolation },
      { status: 400 },
    );
  }

  const base = createEmptyAnswers();
  const declared: DeclaredPreference = { ...base.declared, ...body.declared };
  const experience: RelationshipExperience = { ...base.experience, ...body.experience };
  const target: TargetProfile = { ...createEmptyTargetProfile(), ...body.target };
  const entries = Array.isArray(body.entries) ? body.entries : [];
  const currentRelationship: CurrentRelationshipEvidence = {
    ...NO_CURRENT_RELATIONSHIP,
    ...body.currentRelationship,
    signals: { ...(body.currentRelationship?.signals ?? {}) },
  };

  // legacy/unknown 값도 그대로 넣어본다 — 도출 함수가 던지지 않아야 한다.
  const status = (
    'rawStatus' in body ? body.rawStatus : (body.status ?? null)
  ) as RelationshipStatus | null;

  const answers: SessionAnswers = {
    ...base,
    status,
    declared,
    experience,
    target,
    currentRelationship,
  };

  const { stage, sufficiency, job } = resolveRelationshipContext(answers);

  /* ── ① 불변이어야 하는 것 ─────────────────────────────────────────────── */
  const compatibility = buildCompatibility(declared, target);
  const tense = relationshipTenseOf(job);
  const mirror = buildMirrorReport(declared, experience, currentRelationship, tense);
  const insights = buildCrossSourceInsights({
    declared,
    experience,
    current: currentRelationship,
    tense,
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

  /* ── ③ Premium Deep Report 본문 (v1.40.1 · §38.2) ───────────────────────
     v1.40 fixture는 무료 화면 문구 + Paywall `additions`만 훑었다. 그래서 유료
     **본문**의 outward 생성을 한 번도 보지 않았고, Release Gate가 통과했다.
     이제 화면이 부르는 것과 **같은 조립 함수**를 여기서 부른다 — 리포트 생성 규칙을
     테스트용으로 복제하지 않는다.

     ⚠️ `narratives: []`다. AI를 부르지 않는다(Provider Key 없이 돌아야 하고, 지금
     닫는 결함은 규칙 생성 쪽이다). AI 문장의 노출 여부는 §38.2 잔여 리스크로 따로 적었다. */
  const historyReport = buildHistoryReport(entries);
  const repeatedSignals = findRepeatedRelationshipSignals(entries);
  const lifecycle = deepReportJobContext(job);
  const deepReport = buildRelationshipDeepReport({
    insights,
    narratives: [],
    resolverContext: {
      answers,
      validated: [],
      historyEntries: entries,
      deepAnswers: [],
      compatibility,
    },
    compatibility,
    historyReport,
    repeatedSignals,
    target,
    lifecycle,
  });

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

    /* ── ④ Relationship Evidence (v1.41 · §39) ─────────────────────────────
       ⚠️ 여기서도 판정을 만들지 않는다. 화면·리포트가 이미 계산한 값을 **셀 수 있는
       형태로** 낸다 — fixture가 문장을 파싱해 시점을 추측하면 문구가 바뀔 때마다
       테스트가 거짓 통과하거나 거짓 실패한다. */
    evidence: {
      /** 축별 근거 시점 — `resolveAxisEvidence`의 결과 그대로 */
      axes: mirror.insights.map((insight) => ({
        axis: insight.key,
        scope: insight.evidenceScope,
        strength: insight.evidenceStrength,
        state: insight.state,
        signal: insight.relationshipSignal,
      })),
      scopeSummary: mirror.scopeSummary,
      mirrorAvailable: mirror.available,
      /**
       * v1.41 — **화면이 실제로 그리는 Mirror 헤더 캡션.** 페이지 인라인 문자열이던
       * 것을 `scopeCaptionOf()`로 옮겨 여기서 내보낸다 — 인라인으로 두면 브라우저를
       * 열어야만 보이고, `ended`에서 `지금 N · 이전 M`이 실제로 그렇게 새어 나갔다.
       */
      scopeCaption: scopeCaptionOf({
        summary: mirror.scopeSummary,
        tense,
        fallback: copy.mirrorUse,
      }),
      /** 연결별 source 목록 — ⑨(Current × Past)이 실제로 생겼는지 확인용 */
      connections: insights.map((insight) => ({
        id: insight.id,
        type: insight.type,
        axis: insight.axis,
        sources: insight.sources,
        refSources: insight.evidenceRefs.map((ref) => ref.source),
        ruleSummary: insight.ruleSummary,
      })),
      /**
       * History Snapshot에 시점이 함께 얼려지는가 (§39.14 · E13).
       * Mirror를 만들 수 없으면 `buildHistoryEntry`가 null이다 — 그것도 사실이므로
       * 억지로 만들지 않고 null을 낸다.
       */
      snapshot: (() => {
        const entry = buildHistoryEntry({
          answers,
          mirror,
          coverage: compatibility.confidence,
          id: 'fixture-entry',
          createdAt: '2026-09-08T00:00:00.000Z',
        });
        return entry
          ? entry.mirrorSnapshot.insights.map((insight) => ({
              axis: insight.axis,
              state: insight.state,
              scope: insight.evidenceScope ?? null,
            }))
          : null;
      })(),
      /** Deep Question 문장 (§38.11 항목 ④ · 시제 확인용) */
      deepQuestionPrompts: selectDeepQuestions(
        insights
          .map((insight) => insight.axis)
          .filter((axis): axis is MirrorAxisKey => Boolean(axis))
          .slice(0, 2),
        tense,
      ).map((template) => template.prompt),
      tense,
    },
    context: {
      actionKinds: JOB_ACTION_KINDS[job],
      allowsOutwardAction: jobAllowsOutwardAction(job),
      allowsOutwardQuestions: jobAllowsOutwardQuestions(job),
      /**
       * v1.41 §39.7 — **stage와 evidence가 독립임을 fixture가 직접 볼 수 있게** 낸다.
       * `job`이 `dating`인데 `scopeSummary.currentCount === 0`인 상태가 정상이라는 것,
       * 그리고 `job`이 `talking`이어도 근거를 넣으면 current가 쓰인다는 것 — 두 방향
       * 모두 이 값으로 검사한다.
       */
      evidenceScopes: mirror.insights.map((insight) => ({
        axis: insight.key,
        scope: insight.evidenceScope,
        state: insight.state,
        signal: insight.relationshipSignal,
      })),
      scopeSummary: mirror.scopeSummary,
      invitesCurrentEvidence: jobInvitesCurrentEvidence(job),
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

    /* ── ③ Premium Deep Report 본문의 **구조적 상태** (v1.40.1 · §38.2) ─────
       ⚠️ 여기서 문장을 판정하지 않는다. 테스트가 셀 수 있는 값만 내보낸다:
       `audience`가 몇 개 outward인지, action kind가 무엇인지, 섹션 제목이 무엇인지.
       금지 어휘 스캔은 `deepReport.renderedStrings`를 쓰는 **2차 guard**다 —
       v1.40이 1차 guard로 blacklist를 쓴 것이 이 결함을 놓친 이유다. */
    deepReport: {
      available: deepReport.available,
      lifecycle,
      actionSectionTitle: deepReport.actionSectionTitle,
      actions: deepReport.actions.map((action) => ({
        kind: action.kind,
        audience: action.audience,
      })),
      /** 상대를 향한 행동 수 — `ended`·`none`에서 0이어야 한다 */
      outwardActionCount: deepReport.actions.filter((action) => action.audience === 'outward')
        .length,
      questions: deepReport.connectionQuestions.map((item) => ({
        id: item.question.id,
        audience: item.audience,
      })),
      /** 상대에게 던지는 질문 수 — `ended`·`none`에서 0이어야 한다 */
      outwardQuestionCount: deepReport.connectionQuestions.filter(
        (item) => item.audience === 'outward',
      ).length,
      /** v1.40에서 유일하게 게이트가 걸려 있던 자리. 대칭 확인용으로 함께 낸다 */
      hasApproachInsight: deepReport.approachInsight !== null,
      historyDeepAvailable: deepReport.historyDeep?.available ?? false,
      /**
       * 화면에 **실제로 그려지는** 유료 본문 문자열 전부. `RelationshipDeepReportView`가
       * 렌더하는 자리와 1:1로 맞춘다 — 여기 빠진 자리는 검사되지 않는 자리다.
       */
      renderedStrings: [
        deepReport.actionSectionTitle,
        deepReport.overview.headline,
        deepReport.overview.subcopy,
        ...deepReport.overview.topSummaries,
        ...deepReport.actions.map((action) => action.text),
        ...deepReport.connectionQuestions.flatMap((item) => [
          item.question.tag,
          item.question.text,
          item.why,
        ]),
        ...(deepReport.approachInsight
          ? [deepReport.approachInsight.title, deepReport.approachInsight.text]
          : []),
        /**
         * ⚠️ v1.41 — **`limitation`과 `sourceLabels`를 여기 더했다.**
         *
         * v1.40.1은 `ruleSummary`만 훑었다. 그래서 브라우저 실측(J7)에서 `ended`
         * 리포트의 연결 카드가 `지금 관계` 칩과 `과거 경험이 지금 이 관계를 그렇게
         * 만들었다는 뜻은 아니야`를 그대로 띄우고 있는데도 fixture는 통과했다 —
         * 이 배열에 없는 자리는 검사되지 않는 자리라는 것이 그대로 증명됐다.
         *
         * 두 값 모두 **화면에 실제로 그려진다**(`DeepConnectionCard`의 칩과 경계
         * 문장). 렌더되는 문자열은 예외 없이 이 배열에 들어와야 한다.
         */
        ...(deepReport.corePattern
          ? [
              deepReport.corePattern.connection.ruleSummary,
              deepReport.corePattern.connection.limitation,
              ...deepReport.corePattern.connection.sourceLabels,
            ]
          : []),
        ...deepReport.connections.flatMap((connection) => [
          connection.ruleSummary,
          connection.limitation,
          ...connection.sourceLabels,
        ]),
        ...deepReport.singleSourceNotes.flatMap((note) => [
          note.ruleSummary,
          note.limitation,
          ...note.sourceLabels,
        ]),
        ...(deepReport.lovyObservation
          ? [deepReport.lovyObservation.observation, deepReport.lovyObservation.question]
          : []),
        // v1.40.1 — `다음 관계에서 …`가 진행 중인 관계에 새던 자리
        ...(deepReport.historyDeep?.prompts ?? []),
        ...(deepReport.historyDeep?.limitations ?? []),
        ...deepReport.limitations,
      ],
    },
  });
}
