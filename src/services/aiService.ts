import { buildCompatibility, buildConversationQuestions } from '@/lib/logic/compatibility';
import { buildMbtiLens, buildMbtiQuestions } from '@/lib/logic/mbtiLens';
import { buildMirrorReport } from '@/lib/logic/mirror';
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
import type { EvidenceResolverContext } from '@/lib/aiEvidenceResolver';
import type {
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
export function requestCompatibilityNarrative(
  result: CompatibilityResult,
  fingerprint: string,
): Promise<
  { ok: true; data: CompatibilityNarrativeBundle } | { ok: false; reason: AiFailureReason }
> {
  return requestNarrative<CompatibilityNarrativeBundle>(
    'compatibility-narrative',
    fingerprint,
    {
      context: buildCompatibilityContext(result),
      allowed: compatibilityAllowList(result),
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
  pastObservations?: readonly { axis: string; entryId: string; note: string }[];
  fingerprint: string;
}): Promise<
  { ok: true; data: RelationshipNarrativeBundle } | { ok: false; reason: AiFailureReason }
> {
  const { answers, mirror, validated, pastObservations, fingerprint } = input;

  return requestNarrative<RelationshipNarrativeBundle>('relationship-insight', fingerprint, {
    context: buildRelationshipContext({
      answers,
      mirror,
      validated: analysisReadyObservations(validated),
      pastObservations,
    }),
    judgements: mirror.insights.map((insight) => ({ axis: insight.key, state: insight.state })),
    focusAxis: mirror.teaser?.axisKey ?? null,
  });
}

/**
 * F2 — 규칙이 판정한 변화를 설명한다.
 * INSUFFICIENT 축은 Context Builder가 이미 제외한다 — 판정하지 않은 것을 설명하지 않는다.
 */
export function requestHistoryNarrative(
  changes: readonly HistoryAxisChange[],
  fingerprint: string,
): Promise<{ ok: true; data: HistoryNarrativeBundle } | { ok: false; reason: AiFailureReason }> {
  const judged = changes.filter((change) => change.state !== 'INSUFFICIENT');

  return requestNarrative<HistoryNarrativeBundle>('history-insight', fingerprint, {
    context: buildHistoryContext(changes),
    allowed: judged.map((change) => ({ axis: change.axis, state: change.state })),
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
): Promise<{ ok: true; data: DeepNarrativeBundle } | { ok: false; reason: AiFailureReason }> {
  const context = buildDeepReportContext(insights, resolverContext);

  if (context.insights.length === 0) {
    return Promise.resolve({
      ok: true,
      data: {
        narratives: [],
        meta: buildMeta({ mode: 'demo', promptVersion: 'deep-report-v1', inputFingerprint: fingerprint }),
      },
    });
  }

  return requestNarrative<DeepNarrativeBundle>('deep-report-narrative', fingerprint, {
    context,
    insights: context.insights.map((item) => ({
      id: item.id,
      evidenceRefs: item.evidence.map((entry) => entry.ref),
    })),
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
}): Promise<MirrorReport> {
  return withLatency(buildMirrorReport(input.declared, input.experience));
}

export async function generateHomeHighlights(input: {
  declared: DeclaredPreference;
  experience: RelationshipExperience;
}): Promise<{ key: string; value: string }[]> {
  return withLatency(buildHomeHighlights(input.declared, input.experience));
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
  mbtiQuestions: buildMbtiQuestions,
  mirror: buildMirrorReport,
  profile: buildRelationshipProfile,
  homeHighlights: buildHomeHighlights,
};
