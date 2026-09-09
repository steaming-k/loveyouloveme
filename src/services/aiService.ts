import { buildCompatibility, buildConversationQuestions } from '@/lib/logic/compatibility';
import { buildMbtiBridge } from '@/lib/logic/mbtiBridge';
import { buildMbtiLens, buildMbtiSelfLens, buildMbtiQuestions } from '@/lib/logic/mbtiLens';
import { buildFirstContactReport } from '@/lib/logic/firstContact';
import { buildMbtiPattern } from '@/lib/logic/mbtiPattern';
import { buildMirrorReport } from '@/lib/logic/mirror';
/**
 * v1.43 §46 — 축/dimension별 허용 근거. **결정론 엔진에서 파생된 표**이고 여기서 새
 * 판정을 만들지 않는다.
 */
import {
  allowedCompatibilityRefsByDimension,
  allowedHistoryRefsByAxis,
  allowedRelationshipRefsByAxis,
} from '@/lib/logic/allowedEvidence';
import type { RelationshipTense } from '@/lib/logic/relationshipEvidence';
import { buildHomeHighlights, buildRelationshipProfile } from '@/lib/logic/profile';
import { callAiTask } from '@/services/ai/aiClient';
import {
  buildCompatibilityContext,
  buildDeepReportContext,
  buildHistoryContext,
  buildRelationshipContext,
  compatibilityAllowList,
} from '@/services/ai/contextBuilders';
import { buildDemoObservedResult, buildMeta } from '@/services/ai/fallback';
import { photoFingerprint, prepareImagesForAnalysis } from '@/services/ai/imagePrep';
import { PROMPT_VERSIONS } from '@/services/ai/promptVersions';
import type { EvidenceResolverContext } from '@/lib/aiEvidenceResolver';
import type {
  CurrentRelationshipEvidence,
  AiFailureReason,
  AiObservedTrait,
  AiTask,
  CompatibilityNarrativeBundle,
  CompatibilityResult,
  ConversationQuestion,
  CrossSourceInsight,
  DeclaredPreference,
  DeepNarrativeBundle,
  HistoryAxisChange,
  HistoryNarrativeBundle,
  MbtiLensReport,
  MbtiType,
  MirrorReport,
  ObservationFeedback,
  ObservedProfileResult,
  PhotoAsset,
  RelationshipExperience,
  RelationshipNarrativeBundle,
  RelationshipProfile,
  SessionAnswers,
  TargetProfile,
  ValidatedObservation,
} from '@/types';

/**
 * Mock AI Layer
 *
 * UI는 mock 데이터를 직접 import하지 않고 이 서비스만 호출한다.
 * 실제 AI 백엔드가 준비되면 이 파일의 구현만 fetch 호출로 바꾸면 되고,
 * 화면 코드는 손대지 않아도 된다.
 *
 * 현재는 deterministic — 같은 입력이면 항상 같은 결과가 나온다.
 * (랜덤한 AI 결과는 신뢰를 깨뜨리므로 쓰지 않는다.)
 */

/** 실제 API 호출처럼 보이게 하는 최소 지연. 로딩 화면의 러비 시퀀스와 함께 쓰인다. */
const LATENCY_MS = 240;

function withLatency<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

/**
 * 사진 기반 관찰 (v1.6 — 실제 AI Vision)
 *
 * 흐름: 사진 축소 → 내부 API → Provider → 검증 → 결과
 *
 * ⚠️ 실패했을 때 규칙 결과를 **실제 AI인 척** 돌려주지 않는다.
 * 사용자가 계속 진행할 수 있도록 fallback을 제공하되, `meta.mode = 'fallback'`을 남겨
 * 화면이 그 사실을 표시하게 한다(§39).
 *
 * Demo Mode(서버 `AI_MODE`가 real이 아님)에서는 Provider를 부르지 않고
 * `meta.mode = 'demo'` 결과가 내려온다.
 */
export async function analyzeObservedProfile(photos: PhotoAsset[]): Promise<
  | { ok: true; data: ObservedProfileResult; fallbackReason?: AiFailureReason }
  | { ok: false; reason: AiFailureReason }
> {
  const fingerprint = photoFingerprint(photos);
  const { images, skipped } = await prepareImagesForAnalysis(photos);

  const result = await callAiTask<ObservedProfileResult>('observed-profile', fingerprint, {
    images,
  });

  if (result.ok) {
    /**
     * 전송하지 못한 사진이 있으면 한계로 덧붙인다 — '사진 N장 = 근거 N개'가 아니다.
     *
     * ⚠️ v1.10 — 관찰이 0개일 때도 붙인다. 예전에는 `traits.length > 0`일 때만 붙였는데,
     * **그때가 오히려 이 정보가 가장 필요한 순간이다** — 관찰이 하나도 안 나온 이유가
     * '사진에서 볼 게 없어서'가 아니라 '절반을 아예 못 보내서'일 수 있기 때문이다.
     */
    if (skipped > 0) {
      return {
        ok: true,
        data: {
          ...result.data,
          limitations: [
            ...result.data.limitations,
            `${skipped}장은 분석에 쓰지 못했어(샘플 타일이거나 읽을 수 없는 파일).`,
          ],
        },
      };
    }
    return { ok: true, data: result.data };
  }

  // 설정 문제는 사용자가 해결할 수 없다 — 규칙 결과로 계속 진행하게 해준다.
  if (result.reason === 'CONFIG_ERROR' || result.reason === 'SERVER_ERROR') {
    return {
      ok: true,
      fallbackReason: result.reason,
      data: buildDemoObservedResult({
        photoCount: photos.length,
        inputFingerprint: fingerprint,
        mode: 'fallback',
      }),
    };
  }

  // 그 외(네트워크·타임아웃·정책·레이트리밋)는 사용자가 재시도할 수 있으므로 실패로 알린다.
  return { ok: false, reason: result.reason };
}

/**
 * 저장된 분석 결과에서 화면용 관찰 목록을 만든다.
 *
 * 사용자 검증 우선순위(§14): USER CORRECTION > CONFIRMED > UNVERIFIED, excluded는 제외.
 * **AI Original을 덮어쓰지 않는다** — 원본은 `original`에 그대로 남는다(§13).
 */
export function toValidatedObservations(
  analysis: ObservedProfileResult | null,
  feedback: Record<string, ObservationFeedback>,
): ValidatedObservation[] {
  if (!analysis) return [];

  return analysis.traits.map((trait) => {
    const entry = feedback[trait.id];
    const correction = entry?.correctedText?.trim();

    const status: ValidatedObservation['status'] = entry?.excluded
      ? 'excluded'
      : correction
        ? 'corrected'
        : entry?.verdict === 'ok'
          ? 'confirmed'
          : 'unverified';

    return { original: trait, status, userCorrection: correction || undefined };
  });
}

/** 후속 분석(S18·Mirror)에 넘길 관찰만 — excluded 제거 */
export function analysisReadyObservations(
  validated: readonly ValidatedObservation[],
): ValidatedObservation[] {
  return validated.filter((item) => item.status !== 'excluded');
}

/* ==================== AI Narrative (v1.7) ==================== */

/**
 * Narrative Task 공통 호출부.
 *
 * ⚠️ Narrative는 **enhancement다.** 실패하면 `null`을 돌려주고, 화면은 기존 deterministic
 * 결과를 그대로 렌더한다(§15). Core Result를 막지 않는다.
 */
async function requestNarrative<T>(
  task: AiTask,
  fingerprint: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; reason: AiFailureReason }> {
  const result = await callAiTask<T>(task, fingerprint, payload);
  if (result.ok) return { ok: true, data: result.data };
  return { ok: false, reason: result.reason };
}

/**
 * S22/S23/S24/S25 — 이미 계산된 궁합 결과의 축별 차이를 설명한다.
 * 점수·good/friction 판정은 이 호출 **이전에** 이미 확정돼 있다.
 */
export function requestCompatibilityNarrative(input: {
  result: CompatibilityResult;
  /**
   * v1.43 §47.1 — 필수. `relationshipTenseOf(job)`이 만든 값을 그대로 넘긴다.
   *
   * ⚠️ 여기서 `answers.status`로 다시 도출하지 않는다 — 판정 source는
   * `relationshipStage.ts` 하나다(v1.42 §40.10).
   */
  tense: RelationshipTense;
  /**
   * v1.43 §47.2 — 필수. `jobAllowsOutwardQuestions(job)`에서 온 값.
   *
   * ⚠️ **프롬프트 입력이 아니다.** 응답을 받은 뒤 `conversationQuestion`을 남길지
   * 정하는 post-processing 안전 문맥이고, 그래서 `buildCompatibilityContext`에
   * 넘기지 않고 요청 최상위로만 보낸다.
   */
  allowsOutwardQuestions: boolean;
  fingerprint: string;
}): Promise<
  { ok: true; data: CompatibilityNarrativeBundle } | { ok: false; reason: AiFailureReason }
> {
  const { result, tense, allowsOutwardQuestions, fingerprint } = input;

  return requestNarrative<CompatibilityNarrativeBundle>(
    'compatibility-narrative',
    fingerprint,
    {
      context: buildCompatibilityContext({ result, tense }),
      allowed: compatibilityAllowList(result),
      /**
       * v1.43 §46.3 — **설명 대상 dimension만** 허용집합을 만든다.
       * `compatibilityAllowList`가 good/friction으로 이미 좁힌 목록과 같은 축이다 —
       * 두 목록이 갈리면 모델이 설명해도 되는 축인데 근거가 없는 상태가 생긴다.
       */
      allowedEvidenceRefs: allowedCompatibilityRefsByDimension(
        compatibilityAllowList(result).map((item) => item.key),
      ),
      tense,
      allowsOutwardQuestions,
    },
  );
}

/**
 * S27/S28 — 규칙이 판정한 Mirror를 설명한다.
 * `judgements`/`focusAxis`를 함께 보내고, 서버가 AI 응답의 state를 이 값으로 덮어쓴다.
 */
export function requestRelationshipNarrative(input: {
  answers: SessionAnswers;
  mirror: MirrorReport;
  validated: readonly ValidatedObservation[];
  /**
   * v1.42 §40.8 — 필수. `relationshipTenseOf(job)`이 만든 값을 그대로 넘긴다.
   *
   * ⚠️ `answers.status`에서 여기서 다시 도출하지 않는다. 그러면 `relationshipStage.ts`
   * 밖에 두 번째 판정이 생기고, 두 판정이 갈리는 순간 화면과 AI가 서로 다른 시제를
   * 쓴다 — v1.41이 `relationshipTenseOf()`를 단일 source로 둔 이유 그대로다(§40.10).
   */
  tense: RelationshipTense;
  /**
   * v1.42 §41.8 — **`jobAllowsOutwardQuestions(job)`에서 온 값.** 필수다.
   *
   * ⚠️ 이 값은 **프롬프트 입력이 아니다.** AI에게 Job을 알려주지 않는다는 v1.42의
   * 결정은 그대로이고, 이건 응답을 받은 뒤 `question`을 남길지 정하는 **post-processing
   * 안전 문맥**이다. 그래서 `buildRelationshipContext`에 넘기지 않고 요청 최상위로만
   * 보낸다.
   *
   * ⚠️ 호출부에서 `if (status === 'ended')`를 새로 만들지 않는다 — 결정론 질문을
   * 막는 것과 **같은 술어**를 쓴다(§41.10 단일 source).
   */
  allowsOutwardQuestions: boolean;
  pastObservations?: readonly { axis: string; entryId: string; note: string }[];
  fingerprint: string;
}): Promise<
  { ok: true; data: RelationshipNarrativeBundle } | { ok: false; reason: AiFailureReason }
> {
  const {
    answers,
    mirror,
    validated,
    tense,
    allowsOutwardQuestions,
    pastObservations,
    fingerprint,
  } = input;

  return requestNarrative<RelationshipNarrativeBundle>('relationship-insight', fingerprint, {
    context: buildRelationshipContext({
      answers,
      mirror,
      validated: analysisReadyObservations(validated),
      tense,
      pastObservations,
    }),
    judgements: mirror.insights.map((insight) => ({ axis: insight.key, state: insight.state })),
    focusAxis: mirror.teaser?.axisKey ?? null,
    /**
     * v1.43 §46.2 — **축별 허용 근거.** 결정론 엔진이 그 축에 실제로 만들 수 있는 ref만
     * 모은 표다(`relationshipRefFor`를 포함해 전부 기존 판정에서 파생된다).
     *
     * ⚠️ `analysisReadyObservations`를 쓴다 — context에 실어 보내는 관찰과 **같은
     * 집합**이어야 한다. 두 곳이 갈리면 AI가 못 본 관찰을 인용해도 검사를 통과한다.
     */
    allowedEvidenceRefs: allowedRelationshipRefsByAxis({
      insights: mirror.insights,
      experience: answers.experience,
      validated: analysisReadyObservations(validated),
      pastObservations,
    }),
    /** v1.42 §41.8 — 서버가 응답 후처리에서만 읽는다. 프롬프트에 들어가지 않는다 */
    allowsOutwardQuestions,
    /**
     * v1.42 §40.13 — **서버의 tense scanner가 읽는다.** context 안에도 같은 값이
     * 있지만 핸들러는 `context`를 `unknown`으로 받으므로(프롬프트에 그대로 실어
     * 보내는 것이 유일한 책임), 검사에 쓸 값은 요청 최상위에서 따로 받는다.
     */
    tense,
  });
}

/**
 * F2 — 규칙이 판정한 변화를 설명한다.
 * INSUFFICIENT 축은 Context Builder가 이미 제외한다 — 판정하지 않은 것을 설명하지 않는다.
 */
export function requestHistoryNarrative(input: {
  changes: readonly HistoryAxisChange[];
  /**
   * v1.43 §45.3 — 비교한 두 기록의 id. **`history` evidenceRef를 성립시키는 값**이다.
   *
   * v1.42까지 이 자리가 없어서 모델은 `history` source를 프롬프트에서 허용받고도
   * `entryId`를 알 수 없었고, 그 결과 history AI narrative의 근거는 실측에서 **0개**였다.
   *
   * ⚠️ `null`이면 근거 허용집합이 비어 이 Task가 호출되지 않는다(기록 1개 이하).
   */
  comparedEntries: { previousEntryId: string; currentEntryId: string } | null;
  fingerprint: string;
}): Promise<{ ok: true; data: HistoryNarrativeBundle } | { ok: false; reason: AiFailureReason }> {
  const { changes, comparedEntries, fingerprint } = input;
  const judged = changes.filter((change) => change.state !== 'INSUFFICIENT');

  return requestNarrative<HistoryNarrativeBundle>('history-insight', fingerprint, {
    context: buildHistoryContext(changes, comparedEntries),
    allowed: judged.map((change) => ({ axis: change.axis, state: change.state })),
    /**
     * v1.43 §46.4 — 축별 허용 근거. 비교한 두 기록과 그 축의 declared 답변뿐이다.
     * `comparedEntries`가 없으면 **빈 표**이고, 그러면 모든 근거가 거부된다 —
     * 근거를 만들 수 없는 상태에서 근거를 허용하는 것보다 정직하다.
     */
    allowedEvidenceRefs: comparedEntries
      ? allowedHistoryRefsByAxis({
          axes: judged.map((change) => change.axis),
          previousEntryId: comparedEntries.previousEntryId,
          currentEntryId: comparedEntries.currentEntryId,
        })
      : {},
  });
}

/**
 * v1.9 — 이미 계산된 Cross-source Insight 목록에 headline/interpretation 문장을 붙인다.
 * Quality Gate (A)로 걸러진 뒤 남은 Insight가 없으면 서버를 부르지 않고 빈 결과를 돌려준다
 * (§40 — 필요 없는 AI 호출을 만들지 않는다).
 */
export function requestDeepReportNarrative(
  insights: readonly CrossSourceInsight[],
  resolverContext: EvidenceResolverContext,
  fingerprint: string,
  /** v1.41 §39.13 — 모델이 받는 경계 문장의 시점. 화면과 같은 문자열을 준다 */
  tense: RelationshipTense,
): Promise<{ ok: true; data: DeepNarrativeBundle } | { ok: false; reason: AiFailureReason }> {
  const context = buildDeepReportContext(insights, resolverContext, tense);

  if (context.insights.length === 0) {
    return Promise.resolve({
      ok: true,
      data: {
        narratives: [],
        // ⚠️ 버전을 여기 적어두지 않는다 — 프롬프트를 고칠 때마다 조용히 어긋난다(v1.27).
        meta: buildMeta({
          mode: 'demo',
          promptVersion: PROMPT_VERSIONS.deepReport,
          inputFingerprint: fingerprint,
        }),
      },
    });
  }

  return requestNarrative<DeepNarrativeBundle>('deep-report-narrative', fingerprint, {
    context,
    insights: context.insights.map((item) => ({
      id: item.id,
      evidenceRefs: item.evidence.map((entry) => entry.ref),
      // v1.27 — Quality Gate (F)가 'AI가 이 문장을 다시 쓴 것인지' 볼 기준.
      // allowedConnection은 ruleSummary를 그대로 담은 것이다(contextBuilders).
      ruleSummary: item.allowedConnection,
    })),
    /** v1.43 §47.5 — 서버의 시제 스캐너가 읽는다. context 안에도 같은 값이 있다 */
    tense,
  });
}

export async function generateRelationshipProfile(input: {
  traits: readonly AiObservedTrait[];
  observations: Record<string, ObservationFeedback>;
  declared: DeclaredPreference;
  experience: RelationshipExperience;
}): Promise<RelationshipProfile> {
  return withLatency(
    buildRelationshipProfile(input.traits, input.observations, input.declared, input.experience),
  );
}

/** ⚠️ MBTI를 인자로 받지 않는다 — 동기화율은 관계 행동 신호만으로 계산한다. */
export async function calculateCompatibility(input: {
  declared: DeclaredPreference;
  target: TargetProfile;
}): Promise<CompatibilityResult> {
  return withLatency(buildCompatibility(input.declared, input.target));
}

export async function generateConversationQuestions(
  result: CompatibilityResult,
): Promise<ConversationQuestion[]> {
  return withLatency(buildConversationQuestions(result));
}

/** Supporting Lens — 두 MBTI가 모두 있을 때만 결과가 있다(없으면 null). */
export async function generateMbtiLens(input: {
  mbti: MbtiType | null;
  targetMbti: MbtiType | null;
}): Promise<MbtiLensReport | null> {
  return withLatency(buildMbtiLens(input.mbti, input.targetMbti));
}

export async function generateMirrorInsights(input: {
  declared: DeclaredPreference;
  experience: RelationshipExperience;
  /** v1.41 — 현재 근거가 없으면 호출부가 `NO_CURRENT_RELATIONSHIP`을 명시적으로 넘긴다 */
  current: CurrentRelationshipEvidence;
  tense: RelationshipTense;
}): Promise<MirrorReport> {
  return withLatency(
    buildMirrorReport(input.declared, input.experience, input.current, input.tense),
  );
}

export async function generateHomeHighlights(input: {
  declared: DeclaredPreference;
  experience: RelationshipExperience;
  current: CurrentRelationshipEvidence;
  tense: RelationshipTense;
}): Promise<{ key: string; value: string }[]> {
  return withLatency(
    buildHomeHighlights(input.declared, input.experience, input.current, input.tense),
  );
}

/* -------------------------------------------------------------------------- */
/* 동기 셀렉터                                                                 */
/* 이미 로컬에 답변이 있는 화면(결과 재방문 등)에서는 로딩을 다시 보여주지 않고    */
/* 같은 로직을 동기적으로 재사용한다. 계산식은 한 곳(lib/logic)에만 존재한다.     */
/* -------------------------------------------------------------------------- */

export const aiSelectors = {
  compatibility: buildCompatibility,
  conversationQuestions: buildConversationQuestions,
  mbtiLens: buildMbtiLens,
  /** v1.32 P4-D — 자기 MBTI만으로 만드는 Self Lens. 상대가 없어도 값이 있다 */
  mbtiSelfLens: buildMbtiSelfLens,
  mbtiQuestions: buildMbtiQuestions,
  /** v1.24 P3-1 — 이미 계산된 두 결과를 나란히 놓는 presentation 비교. 새 점수가 아니다 */
  mbtiBridge: buildMbtiBridge,
  /** v1.25 P3-2 — MBTI 데이터만으로 만드는 조합 패턴. 관계 답변을 읽지 않는다 */
  mbtiPattern: buildMbtiPattern,
  mirror: buildMirrorReport,
  /**
   * v1.29 P4 — 상대 없이 나를 관찰한다. `CompatibilityResult`도 `MirrorReport`도
   * 읽지 않아서, 상대 정보나 관계 경험이 없어도 이 리포트는 온전하다.
   */
  firstContact: buildFirstContactReport,
  profile: buildRelationshipProfile,
  homeHighlights: buildHomeHighlights,
};
