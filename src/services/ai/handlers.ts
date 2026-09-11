import 'server-only';

import {
  buildDemoObservedResult,
  buildEmptyObservedResult,
  buildMeta,
  evidenceCoverageLevel,
} from './fallback';
import { AiProviderError, resolveProvider, type AiProvider, type ProviderImage } from './provider';
import {
  COMPATIBILITY_SYSTEM_PROMPT,
  DEEP_REPORT_SYSTEM_PROMPT,
  HISTORY_SYSTEM_PROMPT,
  PHOTO_OBSERVATION_SYSTEM_PROMPT,
  PREMIUM_CROSS_LENS_SYSTEM_PROMPT,
  PREMIUM_MBTI_LENS_SYSTEM_PROMPT,
  PREMIUM_SAJU_LENS_SYSTEM_PROMPT,
  PREMIUM_ZODIAC_LENS_SYSTEM_PROMPT,
  PROMPT_VERSIONS,
  RELATIONSHIP_SYSTEM_PROMPT,
} from './promptTemplates';
import {
  applyOutwardQuestionGate,
  echoesReferenceSentence,
  filterSafeItems,
  isRedundantNarrative,
  limitStockPhraseRepeats,
  scanCompatibilityNarrative,
  scanCrossLensNarrative,
  scanLensNarrative,
  scanDeepNarrativeWithTense,
  scanHistoryNarrative,
  scanPhotoObservation,
  scanRelationshipNarrative,
  wrapUserData,
} from './safety';
import {
  logAiFilter,
  rawNarrativeCount,
  rawNarrativeIdentifiers,
} from './observability';
/**
 * v1.43 §46 — 근거 귀속 검사. `evidenceRefsAreSubsetOf`(v1.27 · Task 전체 집합)를
 * **항목 단위**로 좁힌 것이고, deep-report도 이제 같은 술어를 쓴다.
 */
import { refsWithinAllowed, rejectedRefSources } from '@/lib/logic/allowedEvidence';
import { lensAiUnitIds } from '@/data/premiumLensAi';
import {
  attachRuleStates,
  parseCompatibilityResponse,
  parseCrossLensResponse,
  parseDeepReportResponse,
  parseHistoryResponse,
  parseLensNarrativeResponse,
  parsePhotoObservationResponse,
  parseRelationshipResponse,
} from './schemas';
import { readAiConfig } from './serverEnv';
import {
  aggregatePhotoObservations,
  describeSignal,
  evidenceLabelsInPhoto,
  repeatedSignals,
  strengthToConfidence,
} from '@/lib/logic/observedSignals';
import type { RelationshipTense } from '@/lib/logic/relationshipEvidence';
import type {
  AiFailureReason,
  AiMode,
  AiTask,
  AiObservedTrait,
  CompatibilityNarrative,
  CompatibilityNarrativeBundle,
  CrossLensNarrativeBundle,
  CrossSourceInsight,
  DeepNarrative,
  DeepNarrativeBundle,
  HistoryNarrative,
  HistoryNarrativeBundle,
  MirrorAxisKey,
  EvidenceRef,
  MirrorState,
  ObservedCategory,
  ObservedLabel,
  ObservedProfileResult,
  ObservedSignalCategory,
  PhotoObservation,
  PremiumLensKind,
  PremiumLensNarrativeBundle,
  RelationshipNarrativeBundle,
} from '@/types';

/**
 * 서버 측 AI Task 실행 (§4)
 *
 * 흐름: Route Handler → 이 파일 → Provider → Schema Parse → Business Validation → Safety Scan
 *
 * ⚠️ Provider 원문 에러를 클라이언트로 올리지 않는다. `AiFailureReason`으로만 분류해 전달한다.
 * ⚠️ 실패 시 조용히 AI인 척하지 않는다 — mode를 `fallback`으로 명시해 내려보낸다.
 */

export interface TaskFailure {
  ok: false;
  reason: AiFailureReason;
}

export type TaskResult<T> = { ok: true; data: T } | TaskFailure;

function failureFrom(error: unknown): TaskFailure {
  if (error instanceof AiProviderError) return { ok: false, reason: error.reason };
  return { ok: false, reason: 'SERVER_ERROR' };
}

/* ---------------------------------------------- Observed (사진 분석) */

export interface ObservedRequest {
  inputFingerprint: string;
  images: ProviderImage[];
}

/**
 * 동시에 여는 Provider 요청 수.
 * 사진 9장을 한꺼번에 던지면 Rate Limit에 걸리기 쉽고, 1장씩 순차로 돌면 너무 느리다.
 */
const PHOTO_CONCURRENCY = 3;

/** LEVEL 2 활동 범주 → 기존 화면이 쓰는 표시용 분류 */
const DISPLAY_CATEGORY: Record<ObservedSignalCategory, ObservedCategory> = {
  sports: 'activity',
  outdoor: 'activity',
  travel: 'activity',
  culture: 'interest',
  reading: 'interest',
  cafe: 'lifestyle',
  food: 'lifestyle',
  pet: 'lifestyle',
  social: 'social',
  other: 'lifestyle',
};

type PhotoOutcome =
  | { ok: true; observation: PhotoObservation; violations: string[] }
  | { ok: false; reason: AiFailureReason };

/**
 * 민감 추론이 섞인 라벨만 골라 버린다 (§9 · §10).
 *
 * ⚠️ 사진 전체를 버리지 않는다. '카페 테이블'과 '친구들'이 같은 사진에서 나왔다면
 * 앞의 것은 그대로 쓸 수 있는 관찰이다. 걸린 라벨을 **고쳐 쓰지도 않는다** —
 * 고치면 무엇이 AI 관찰이고 무엇이 우리가 만든 문장인지 구분할 수 없게 된다.
 */
export function sanitizePhotoObservation(observation: PhotoObservation): {
  observation: PhotoObservation;
  violations: string[];
} {
  const violations = new Set<string>();

  const clean = (labels: ObservedLabel[]): ObservedLabel[] =>
    labels.filter((entry) => {
      const scan = scanPhotoObservation(entry.label);
      if (!scan.safe) scan.violations.forEach((item) => violations.add(item));
      return scan.safe;
    });

  const summaryScan = scanPhotoObservation(observation.evidenceSummary);
  if (!summaryScan.safe) summaryScan.violations.forEach((item) => violations.add(item));

  return {
    observation: {
      ...observation,
      scenes: clean(observation.scenes),
      activities: clean(observation.activities),
      objects: clean(observation.objects),
      environment: observation.environment ? clean(observation.environment) : [],
      evidenceSummary: summaryScan.safe ? observation.evidenceSummary : '',
    },
    violations: [...violations],
  };
}

/**
 * 사진 **한 장**을 관찰한다 (§4 `analyzePhoto`).
 *
 * ⚠️ 사진을 한 장씩 보내는 게 핵심이다. 전부 한 번에 보내면 Provider가
 * '여러 장에서 반복해서 보인다'를 스스로 주장하게 되고, 그러면 §3·§5의 반복 기준이
 * 우리 코드가 아니라 Provider 손에 넘어간다.
 */
async function analyzePhoto(
  provider: AiProvider,
  image: ProviderImage,
): Promise<PhotoOutcome> {
  try {
    const raw = await provider.generateStructured({
      task: 'observed-photo-analysis',
      systemPrompt: PHOTO_OBSERVATION_SYSTEM_PROMPT,
      // 사진 외 개인 정보를 함께 보내지 않는다(§26). photoId는 세션 내부 id다(§29).
      userPayload: wrapUserData({ photoId: image.imageId }),
      images: [image],
      useVisionModel: true,
    });

    const parsed = parsePhotoObservationResponse(raw, image.imageId);
    if (!parsed) return { ok: false, reason: 'INVALID_OUTPUT' };

    return { ok: true, ...sanitizePhotoObservation(parsed) };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof AiProviderError ? error.reason : 'SERVER_ERROR',
    };
  }
}

/** 순서를 유지한 채 동시 실행 수만 제한한다 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]!);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * 사진 → 관찰 신호 (v1.10 재작성)
 *
 * 흐름: 사진 1장씩 Vision 관찰 → 민감 라벨 제거 → **규칙 집계**(반복 판정) → 신호
 *
 * ⚠️ 반복 여부·occurrenceCount를 Provider에게 묻지 않는다(§3). Provider는 사진을 한 장씩
 * 보므로 애초에 알 수 없고, 물어보면 지어낸다. 집계는 `aggregatePhotoObservations`가 한다.
 *
 * ⚠️ '분석 실패'와 '반복 없음'을 같은 결과로 만들지 않는다(§8). 전부 실패하면 실패로
 * 올리고, 성공했는데 반복이 없으면 단일 관찰을 그대로 돌려준다 — No Pattern ≠ No Information.
 */
export async function runObservedTask(
  request: ObservedRequest,
): Promise<TaskResult<ObservedProfileResult>> {
  const config = readAiConfig();
  const provider = resolveProvider(true);
  const photoCount = request.images.length;

  // Demo mode — Provider를 부르지 않는다. real인데 키가 없으면 CONFIG_ERROR로 알린다.
  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    return {
      ok: true,
      data: buildDemoObservedResult({
        photoCount,
        inputFingerprint: request.inputFingerprint,
        mode: 'demo',
      }),
    };
  }

  if (photoCount === 0) return { ok: false, reason: 'NO_USABLE_IMAGE' };

  // mock 모드에서는 real이라고 표시하지 않는다 — 결과 meta가 진실이어야 한다(§5).
  const resultMode: AiMode = config.mode === 'mock' ? 'mock' : 'real';

  const outcomes = await mapWithConcurrency(request.images, PHOTO_CONCURRENCY, (image) =>
    analyzePhoto(provider, image),
  );

  const observations: PhotoObservation[] = [];
  const failures: AiFailureReason[] = [];
  const violations = new Set<string>();

  for (const outcome of outcomes) {
    if (outcome.ok) {
      observations.push(outcome.observation);
      outcome.violations.forEach((item) => violations.add(item));
    } else {
      failures.push(outcome.reason);
    }
  }

  // 한 장도 못 읽었으면 이건 '반복이 없다'가 아니라 '분석을 못 했다'다(§8-B).
  if (observations.length === 0) return { ok: false, reason: failures[0] ?? 'NO_USABLE_IMAGE' };

  const usableImageCount = observations.filter((item) => item.usable).length;
  const signals = aggregatePhotoObservations(observations);
  const observationById = new Map(observations.map((item) => [item.photoId, item]));

  const traits: AiObservedTrait[] = signals.map((signal) => ({
    id: signal.id,
    category: DISPLAY_CATEGORY[signal.category],
    label: signal.label,
    // 문장은 집계 결과가 만든다 — '몇 장에서 보였는가'는 규칙이 센 값이다(§4).
    observation: describeSignal(signal),
    evidence: signal.photoIds.map((photoId) => {
      const observation = observationById.get(photoId);
      const labels = observation ? evidenceLabelsInPhoto(observation, signal.category) : [];
      return {
        imageId: photoId,
        description: labels.length > 0 ? labels.join(' · ') : (observation?.evidenceSummary ?? ''),
      };
    }),
    confidence: strengthToConfidence(signal.strength),
    signal,
  }));

  const limitations: string[] = [];

  if (config.mode === 'mock') {
    limitations.push('개발용 mock 응답이라 실제 사진 내용을 본 결과가 아니야.');
  }
  if (violations.size > 0) {
    // 무엇을 버렸는지 사용자에게 알린다 — 조용히 지우지 않는다(§9).
    limitations.push('사진에서 추론하지 않기로 한 항목이 있어서 일부 관찰은 제외했어.');
  }
  if (failures.length > 0) {
    limitations.push(`${failures.length}장은 분석을 완료하지 못했어.`);
  }
  const unreadable = observations.length - usableImageCount;
  if (unreadable > 0) {
    limitations.push(`${unreadable}장은 무엇인지 알아볼 수 없어서 관찰을 만들지 못했어.`);
  }
  /**
   * ⚠️ '반복이 없었다'는 여기(limitations)에 넣지 않는다. 그건 한계가 아니라 **결과**이고,
   * 화면이 `observedState === 'single_only'`를 보고 목록 맨 위에 크게 말한다(§7).
   * 양쪽에 다 넣었더니 같은 문장이 화면에 두 번 나왔다.
   */

  if (traits.length === 0) {
    return {
      ok: true,
      data: buildEmptyObservedResult({
        photoCount,
        usableImageCount,
        inputFingerprint: request.inputFingerprint,
        mode: resultMode,
        model: provider.model,
        // 사진이 적어서인지, 사진은 봤는데 잡을 게 없어서인지 구분한다(§8-D).
        observedState: usableImageCount < 3 ? 'insufficient_photos' : 'no_observation',
        limitations: limitations.length > 0 ? limitations : undefined,
      }),
    };
  }

  return {
    ok: true,
    data: {
      version: '1.0',
      traits,
      limitations,
      evidenceCoverage: {
        imageCount: photoCount,
        usableImageCount,
        // 커버리지는 코드가 판정한다 — AI 주장에 의존하지 않는다.
        level: evidenceCoverageLevel(usableImageCount, traits.length),
      },
      observedState: repeatedSignals(signals).length > 0 ? 'repeated_found' : 'single_only',
      meta: buildMeta({
        mode: resultMode,
        promptVersion: PROMPT_VERSIONS.observed,
        inputFingerprint: request.inputFingerprint,
        model: provider.model,
      }),
    },
  };
}

/* ------------------------------------------------------ Relationship */

export interface RelationshipRequest {
  inputFingerprint: string;
  context: unknown;
  /** 규칙이 판정한 축·상태. AI는 이걸 바꿀 수 없다 */
  judgements: Array<{ axis: MirrorAxisKey; state: MirrorState }>;
  focusAxis: MirrorAxisKey | null;
  /**
   * v1.42 §41.8 — **Ended Job Safety. 프롬프트에 들어가지 않는다.**
   *
   * ══ 왜 시제 검사로는 부족한가 ═════════════════════════════════════════════
   *
   * `MirrorAxisNarrative`가 `narrative.question`을 **실제로 렌더**한다. 그런데 결정론
   * 질문(`buildConversationQuestions`)은 `jobAllowsOutwardQuestions(job)`로 `ended`·
   * `none`에서 차단되는데 **AI가 만든 질문에는 그 게이트가 없었다.**
   *
   * `scanRelationshipTense`는 시제만 본다. 그래서 이런 질문은 통과한다.
   *
   * ```
   * 연락이 줄었을 때 서로 어떤 기준이 있었는지 이야기해볼 수 있을까?
   * ```
   *
   * 현재형 호칭이 하나도 없다 — 그런데 **관계가 끝난 사용자에게 상대와 이야기해보라고
   * 제안하는 문장**이다. 시제는 맞고 대상이 틀렸다.
   *
   * > **TENSE SAFETY ≠ JOB SAFETY.**
   * > `현재형이 아니다`와 `Ended 사용자에게 해도 되는 질문이다`는 다른 명제다.
   *
   * ⚠️ **AI에게 Job을 알려주지 않는다.** 이 값은 프롬프트/컨텍스트에 들어가지 않고,
   * 응답을 받은 뒤 **post-processing 안전 문맥**으로만 쓴다. v1.42가 raw status를
   * 뺀 이유가 그대로 여기에도 적용된다 — 단계를 알려주면 모델이 단계에 맞는 내용을
   * 지어낸다.
   *
   * ⚠️ **필수다. optional + 기본값 `true`는 금지다**(v1.40.1 §38.2). 기본값이 허용이면
   * 값을 빼먹은 호출부가 조용히 `ended`에게 질문을 보낸다.
   */
  allowsOutwardQuestions: boolean;
  /**
   * v1.42 §40.13 — 시제 검사 기준. **`context` 안에도 같은 값이 있지만 여기서 따로
   * 받는다.**
   *
   * `context`는 `unknown`이다 — 이 핸들러의 책임은 그것을 프롬프트에 그대로 실어
   * 보내는 것뿐이고, 안을 들여다보지 않는 것이 그 타입의 뜻이다. 검사에 쓸 값을
   * `context`에서 캐스팅해 꺼내면 그 계약이 깨지고, `context` 모양이 바뀔 때마다
   * 검사가 조용히 망가진다.
   */
  tense: RelationshipTense;
  /**
   * v1.43 §46.2 — **axis별 허용 근거.** `allowedRelationshipRefsByAxis()`가 만든다.
   *
   * ══ 왜 v1.42까지 이 자리가 비어 있었나 ═════════════════════════════════
   *
   * v1.27이 deep-report에 세운 `AI_OUTPUT ⊆ DETERMINISTIC_EVIDENCE`는 이 Task에
   * 없었다. `parseEvidenceRef`가 **모양만** 보고 통과시켰으므로 모델이
   * `{source:'relationship', field:'hardest'}`를 아무 축에나 붙일 수 있었다.
   *
   * ```
   * hardest = value_gap  →  HARDEST_TO_AXIS에 없다  →  결정론 엔진은 ref를 만들지 않는다
   *                      →  그런데 resolveRelationship('hardest')는 정상 문장을 돌려준다
   *                      →  '기준 차이가 가장 힘들었음'이 연락 축 근거로 화면에 붙는다
   * ```
   *
   * v1.40.1·v1.41이 두 번 "매핑하지 않는다"고 확정한 판단이 AI 경로에서만 무효였다.
   */
  allowedRefsByAxis: Record<string, EvidenceRef[]>;
}

export async function runRelationshipTask(
  request: RelationshipRequest,
): Promise<TaskResult<RelationshipNarrativeBundle>> {
  const config = readAiConfig();
  const provider = resolveProvider(false);

  const metaFor = (mode: AiMode, model?: string) =>
    buildMeta({
      mode,
      promptVersion: PROMPT_VERSIONS.relationship,
      inputFingerprint: request.inputFingerprint,
      model,
    });

  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    // Demo에서는 AI Narrative를 만들지 않는다 — 화면이 기존 템플릿을 쓴다.
    return { ok: true, data: { narratives: [], core: null, meta: metaFor('demo') } };
  }

  const allowedAxes = request.judgements.map((item) => item.axis);
  const stateByAxis = new Map(request.judgements.map((item) => [item.axis, item.state]));

  try {
    const raw = await provider.generateStructured({
      task: 'relationship-insight',
      systemPrompt: RELATIONSHIP_SYSTEM_PROMPT,
      userPayload: wrapUserData({
        context: request.context,
        judgements: request.judgements,
        focusAxis: request.focusAxis,
        /**
         * v1.43 §46.2 — **모델이 인용할 수 있는 근거를 그대로 보여준다.**
         *
         * v1.30이 compatibility에서 배운 방식이다: 파서에 별칭을 늘리지 않고 **모델이
         * 받는 어휘를 canonical ref로 맞춘다.** 목록을 주지 않고 검사만 조이면
         * v1.42 v5에서 실제로 일어난 `parsed=0`(모델이 판단 못 하고 refs를 비움)이
         * 재현된다 — 규칙에 빈 칸을 두면 모델이 그 칸을 침묵으로 채운다.
         */
        allowedEvidenceRefs: request.allowedRefsByAxis,
      }),
    });

    /**
     * v1.42 §41.14 — **모델이 안 만든 것과 파서가 버린 것을 구분한다.**
     *
     * v1.27이 안전 검사 앞에 세운 원칙(`parsed` vs `safe`)을 한 층 더 아래로 내린다.
     * v1.42 작업 중 실제로 필요해졌다: `parsed=0 safe=0 core=1`을 보고도 **모델이
     * narratives를 비웠는지, 파서가 전부 떨궜는지 알 수 없었다.**
     *
     * ⚠️ 세는 것은 **개수와 축 키**뿐이다. 축 키는 우리 enum이고 사용자 데이터가
     * 아니다 — 문장·필드값은 넣지 않는다(§34 Privacy).
     *
     * ⚠️ v1.43 — 인라인 `console.info`를 `logAiFilter`로 옮겼다. 출력 형태는 그대로이고
     * (`raw=N[axis|axis] allowed=[…] parsed=N safe=N …`) 나머지 3개 Task가 **같은
     * 헬퍼**를 쓴다 — Task마다 다른 모양의 로그를 손으로 쓰던 것이 compatibility·
     * history에 로그가 아예 없던 이유였다(§44).
     */
    const parsed = parseRelationshipResponse(raw, allowedAxes);
    if (!parsed) return { ok: false, reason: 'INVALID_OUTPUT' };

    // state는 규칙 값으로 덮어쓴다 — AI가 판정을 바꿀 수 없다(§18).
    const withStates = attachRuleStates(parsed.narratives, stateByAxis);

    /**
     * v1.43 §46.2 — **axis별 근거 귀속 검사.** deep-report가 v1.27부터 갖고 있던 검사를
     * 이 Task에도 세운다. 단위는 Task가 아니라 **항목(축)**이다 — Task 전체 집합으로
     * 검사하면 `contact` 설명이 `conflict`의 근거를 인용해도 통과한다.
     *
     * ⚠️ 게이트보다 **앞**에 둔다. 이 검사는 항목을 버리므로, 버릴 항목의 질문을 먼저
     * 지우는 것은 낭비다. 그리고 `questionsStripped` 카운터가 '살아남은 항목 중 질문이
     * 지워진 수'를 세게 된다 — 그게 관측하고 싶은 숫자다.
     */
    const rejectedRefs: string[] = [];
    const refChecked = withStates.filter((item) => {
      const allowed = request.allowedRefsByAxis[item.axis] ?? [];
      if (refsWithinAllowed(item.evidenceRefs, allowed)) return true;
      rejectedRefs.push(...rejectedRefSources(item.evidenceRefs, allowed));
      return false;
    });

    /**
     * 금지 추론 + Lens 누출(MBTI·사주·별자리) + **관계 시제**(v1.42 §40.13).
     *
     * ⚠️ `question`이 스캔 문자열에 들어가 있는 것이 v1.42에서 중요해졌다.
     * `MirrorAxisNarrative`가 `narrative.question`을 **실제로 렌더**하므로, 끝난 관계에
     * `지금 상대와 …?`를 묻는 질문이 오면 여기서 항목째로 떨어져야 한다.
     */
    const scanNarrative = (text: string) => scanRelationshipNarrative(text, request.tense);

    /**
     * v1.42 §41.9 — **Job 게이트를 안전 검사 *앞*에 둔다.** 순서가 정책이다.
     *
     * ```
     * 게이트 먼저   질문을 지운다 → 지워진 질문은 스캔되지 않는다 → 설명은 자기 내용으로만 판정
     * 스캔 먼저     질문이 위반이면 항목째로 버려진다 → 설명까지 사라진다  ← 과필터
     * ```
     *
     * `ended`에서 질문은 **어차피 화면에 가지 않는다.** 그 문장 때문에 남아 있어야 할
     * 설명까지 잃는 것은 §27(AI는 augmentation)과 정면으로 어긋난다 — 질문 하나 때문에
     * 결정론 행 아래가 통째로 비면 사용자는 검사가 있었다는 사실조차 알 수 없다.
     *
     * ⚠️ 허용 Job에서는 **아무것도 바뀌지 않는다** — `question`이 그대로 남아 스캔에
     * 들어가고, 시제 위반이면 v1.42 초기 동작대로 항목이 떨어진다.
     */
    const gated = applyOutwardQuestionGate(refChecked, request.allowsOutwardQuestions, 'question');

    const scan = filterSafeItems(
      gated,
      (item) => `${item.headline} ${item.explanation} ${item.question ?? ''}`,
      scanNarrative,
    );

    let core = parsed.core;
    if (core) {
      const coreScan = filterSafeItems(
        [core],
        // v1.42 — `limitations`도 함께 본다. Core는 `limitations[0]`을 화면에 그린다.
        (item) => `${item.headline} ${item.summary} ${item.limitations.join(' ')}`,
        scanNarrative,
      );
      // Core Insight가 안전 검사에 걸리면 버린다 — 화면은 규칙 템플릿으로 되돌아간다.
      core = coreScan.items[0] ?? null;
    }

    /**
     * v1.42 §40.15 — **필터 결과를 관측할 수 있게 한다.** v1.27이 deep-report에서 한 것과
     * 같은 이유다: 문장이 화면에 없을 때 '모델이 안 만든 것'인지 '검사가 버린 것'인지
     * 구분할 수 없으면, 새로 넣은 시제 검사의 **과잉 거부를 발견할 방법이 없다**.
     *
     * ⚠️ Production에서는 남기지 않고, **문장 원문은 절대 로그에 넣지 않는다** —
     * 개수와 위반 라벨만이다(§34 Privacy).
     */
    logAiFilter({
      task: 'relationship-insight',
      policy: { tense: request.tense, outwardQ: request.allowsOutwardQuestions ? 'on' : 'off' },
      raw: rawNarrativeCount(raw),
      rawIdentifiers: rawNarrativeIdentifiers(raw, 'axis'),
      allowedIdentifiers: allowedAxes,
      parsed: parsed.narratives.length,
      refChecked: refChecked.length,
      rejectedRefSources: rejectedRefs,
      safe: scan.items.length,
      violations: scan.violations,
      extra: {
        core: core ? 1 : 0,
        ...(request.allowsOutwardQuestions
          ? {}
          : { questionsStripped: refChecked.filter((item) => item.question !== undefined).length }),
      },
    });

    return {
      ok: true,
      data: {
        narratives: scan.items,
        // focusAxis는 규칙이 고른 값을 붙인다 — AI가 고르지 않는다(§19).
        core: core && request.focusAxis ? { ...core, axis: request.focusAxis } : null,
        meta: metaFor(config.mode === 'mock' ? 'mock' : 'real', provider.model),
      },
    };
  } catch (error) {
    return failureFrom(error);
  }
}

/* ----------------------------------------------------- Compatibility */

export interface CompatibilityRequest {
  inputFingerprint: string;
  context: unknown;
  allowed: Array<{ key: CompatibilityNarrative['dimensionKey']; kind: 'good' | 'friction' }>;
  /**
   * v1.43 §47.1 — **필수.** `relationshipTenseOf(job)`이 만든 값. 기본값을 두지 않는다.
   * 라우트가 `'current'|'former'`가 아니면 **400**이다 — v1.42 §40.8과 같은 규칙이다.
   */
  tense: RelationshipTense;
  /**
   * v1.43 §47.2 — **필수.** `jobAllowsOutwardQuestions(job)`에서 온 값.
   *
   * ⚠️ 프롬프트·context에 들어가지 않는다. AI에게 Job을 알려주지 않는다는 v1.42의
   * 결정 그대로이고, 이건 응답 후처리 안전 문맥이다.
   */
  allowsOutwardQuestions: boolean;
  /**
   * v1.43 §46.3 — dimension별 허용 근거. `allowedCompatibilityRefsByDimension()`이
   * 만든 표를 그대로 받는다. 여기 없는 ref를 인용한 항목은 버려진다.
   */
  allowedRefsByDimension: Record<string, EvidenceRef[]>;
}

export async function runCompatibilityTask(
  request: CompatibilityRequest,
): Promise<TaskResult<CompatibilityNarrativeBundle>> {
  const config = readAiConfig();
  const provider = resolveProvider(false);

  const metaFor = (mode: AiMode, model?: string) =>
    buildMeta({
      mode,
      promptVersion: PROMPT_VERSIONS.compatibility,
      inputFingerprint: request.inputFingerprint,
      model,
    });

  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    return { ok: true, data: { narratives: [], meta: metaFor('demo') } };
  }

  try {
    const raw = await provider.generateStructured({
      task: 'compatibility-narrative',
      systemPrompt: COMPATIBILITY_SYSTEM_PROMPT,
      userPayload: wrapUserData({
        context: request.context,
        allowed: request.allowed,
        allowedEvidenceRefs: request.allowedRefsByDimension,
      }),
    });

    const parsed = parseCompatibilityResponse(raw, request.allowed);

    /**
     * v1.43 §46.3 — **dimension별 근거 귀속 검사.**
     *
     * Task 전체 집합으로 검사하면 `contact` 설명이 `conflict`의 ref를 인용해도 통과한다
     * (둘 다 Task 안에 있으므로). 근거 귀속의 단위는 항목이므로 검사도 항목 단위다.
     */
    const rejectedRefs: string[] = [];
    const refChecked = parsed.filter((item) => {
      const allowed = request.allowedRefsByDimension[item.dimensionKey] ?? [];
      if (refsWithinAllowed(item.evidenceRefs, allowed)) return true;
      rejectedRefs.push(...rejectedRefSources(item.evidenceRefs, allowed));
      return false;
    });

    /**
     * v1.43 §47.2 — **게이트를 안전 검사 앞에 둔다.** v1.42 §41.9가 relationship에서
     * 정한 순서 그대로이고, 이유도 같다: 지워진 질문이 스캔 문자열에 들어가면 화면에
     * 가지도 않는 문장 때문에 설명이 떨어질 수 있다(과필터).
     *
     * ⚠️ UI에 `if (ended) hide`를 만들지 않는다. `CompatibilityAxisNarrative`는
     * v1.42와 글자 하나 다르지 않게 `narrative.conversationQuestion`을 그리고, 그 값이
     * `undefined`가 되는 것은 **서버 경계 한 곳**에서만 일어난다.
     */
    const gated = applyOutwardQuestionGate(refChecked, request.allowsOutwardQuestions, 'conversationQuestion');

    const scan = filterSafeItems(
      gated,
      (item) => `${item.explanation} ${item.scenario} ${item.conversationQuestion ?? ''}`,
      (text) => scanCompatibilityNarrative(text, request.tense),
    );

    logAiFilter({
      task: 'compatibility-narrative',
      policy: { tense: request.tense, outwardQ: request.allowsOutwardQuestions ? 'on' : 'off' },
      raw: rawNarrativeCount(raw),
      rawIdentifiers: rawNarrativeIdentifiers(raw, 'dimensionKey'),
      allowedIdentifiers: request.allowed.map((item) => item.key),
      parsed: parsed.length,
      refChecked: refChecked.length,
      rejectedRefSources: rejectedRefs,
      safe: scan.items.length,
      violations: scan.violations,
      extra: request.allowsOutwardQuestions
        ? {}
        : { questionsStripped: refChecked.filter((item) => item.conversationQuestion).length },
    });

    return { ok: true, data: { narratives: scan.items, meta: metaFor(config.mode === 'mock' ? 'mock' : 'real', provider.model) } };
  } catch (error) {
    return failureFrom(error);
  }
}

/* ---------------------------------------------------------- History */

export interface HistoryRequest {
  inputFingerprint: string;
  context: unknown;
  allowed: Array<{ axis: MirrorAxisKey; state: HistoryNarrative['state'] }>;
  /**
   * v1.43 §46.4 — **axis별 허용 근거.** `allowedHistoryRefsByAxis()`가 만든다.
   *
   * 이 Task의 허용 근거는 **비교한 두 기록**(`history:<entryId>:<axis>`)과 **그 축의
   * declared 답변** 두 종류뿐이다. `relationship`(S15~S17)은 두 기록 사이에서 달라지지
   * 않는 값이라 변화의 근거가 될 수 없으므로 목록과 프롬프트 enum에서 빠졌다.
   *
   * ⚠️ 기록이 1개 이하면 빈 표다 — 그때 이 Task는 애초에 호출되지 않는다
   * (`allowed.length === 0` → 빈 결과).
   */
  allowedRefsByAxis: Record<string, EvidenceRef[]>;
}

export async function runHistoryTask(
  request: HistoryRequest,
): Promise<TaskResult<HistoryNarrativeBundle>> {
  const config = readAiConfig();
  const provider = resolveProvider(false);

  const metaFor = (mode: AiMode, model?: string) =>
    buildMeta({
      mode,
      promptVersion: PROMPT_VERSIONS.history,
      inputFingerprint: request.inputFingerprint,
      model,
    });

  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    return { ok: true, data: { narratives: [], meta: metaFor('demo') } };
  }

  // 기록이 1개면 변화 해석 자체를 만들지 않는다(§79 CASE O) — 비교 대상이 없다.
  if (request.allowed.length === 0) {
    return { ok: true, data: { narratives: [], meta: metaFor(config.mode === 'mock' ? 'mock' : 'real', provider.model) } };
  }

  try {
    const raw = await provider.generateStructured({
      task: 'history-insight',
      systemPrompt: HISTORY_SYSTEM_PROMPT,
      userPayload: wrapUserData({
        context: request.context,
        allowed: request.allowed,
        allowedEvidenceRefs: request.allowedRefsByAxis,
      }),
    });

    const parsed = parseHistoryResponse(raw, request.allowed);

    /** v1.43 §46.4 — axis별 근거 귀속 검사. 나머지 Task와 **같은 술어**를 쓴다 */
    const rejectedRefs: string[] = [];
    const refChecked = parsed.filter((item) => {
      const allowed = request.allowedRefsByAxis[item.axis] ?? [];
      if (refsWithinAllowed(item.evidenceRefs, allowed)) return true;
      rejectedRefs.push(...rejectedRefSources(item.evidenceRefs, allowed));
      return false;
    });

    // History는 성장 서사·가치 판정까지 추가로 막는다(§27).
    const scan = filterSafeItems(
      refChecked,
      (item) => `${item.explanation} ${item.uncertainty ?? ''}`,
      scanHistoryNarrative,
    );

    /**
     * v1.43 §44 — **이 Task에 처음 붙는 로그다.** BEFORE 실측에서 `history-insight ok
     * 2185ms`(라우트 로그)뿐이었고, 그래서 AI narrative의 근거가 0개라는 사실을
     * 브라우저 DOM을 열어서야 알 수 있었다.
     */
    logAiFilter({
      task: 'history-insight',
      raw: rawNarrativeCount(raw),
      rawIdentifiers: rawNarrativeIdentifiers(raw, 'axis'),
      allowedIdentifiers: request.allowed.map((item) => item.axis),
      parsed: parsed.length,
      refChecked: refChecked.length,
      rejectedRefSources: rejectedRefs,
      safe: scan.items.length,
      violations: scan.violations,
      extra: { withEvidence: scan.items.filter((item) => item.evidenceRefs.length > 0).length },
    });

    return { ok: true, data: { narratives: scan.items, meta: metaFor(config.mode === 'mock' ? 'mock' : 'real', provider.model) } };
  } catch (error) {
    return failureFrom(error);
  }
}

/* -------------------------------------------------------- Deep Report */

export interface DeepReportRequest {
  inputFingerprint: string;
  context: unknown;
  /**
   * Quality Gate (A)를 통과해 실제로 AI에게 보낸 Insight만 — id 허용목록 + evidenceRef 대조용.
   *
   * v1.27 — ruleSummary가 추가됐다. Quality Gate (F)가 AI 문장이 이 규칙 문장을 그냥
   * 다시 쓴 것인지 판정하는 기준이다. context에도 같은 문자열이 allowedConnection으로
   * 들어가지만, **게이트의 입력은 프롬프트용 free-form context가 아니라 (E)와 같은
   * 이 타입 있는 허용목록에서 읽는다** — 두 게이트가 서로 다른 곳을 보면 어긋난다.
   */
  insights: readonly Pick<CrossSourceInsight, 'id' | 'evidenceRefs' | 'ruleSummary'>[];
  /**
   * v1.43 §47.5 — **필수.** 이 Task의 시제 검사 기준.
   *
   * v1.41부터 `tense`는 `buildDeepReportContext`의 인자였지만 `limitationFor`를 부르는
   * 데만 쓰였다 — 즉 **경계 문장의 시제는 맞았고 그 위 AI 본문에는 검사가 없었다.**
   * `DeepNarrative.headline`/`interpretation`은 실제로 화면에 그려진다.
   *
   * ⚠️ `context` 안에도 같은 값이 들어가지만(프롬프트 `[시제]` 블록이 읽는다) 검사용
   * 값은 요청 최상위에서 따로 받는다 — `context: unknown`의 계약 그대로다(v1.42 §40.13).
   */
  tense: RelationshipTense;
}

export async function runDeepReportTask(
  request: DeepReportRequest,
): Promise<TaskResult<DeepNarrativeBundle>> {
  const config = readAiConfig();
  const provider = resolveProvider(false);

  const metaFor = (mode: AiMode, model?: string) =>
    buildMeta({
      mode,
      promptVersion: PROMPT_VERSIONS.deepReport,
      inputFingerprint: request.inputFingerprint,
      model,
    });

  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    // Demo에서는 AI Narrative를 만들지 않는다 — 화면이 각 Insight의 ruleSummary를 쓴다.
    return { ok: true, data: { narratives: [], meta: metaFor('demo') } };
  }

  // 보낼 게 없으면(모든 Insight가 Quality Gate 이전에 이미 걸러짐) AI를 부르지 않는다(§40).
  if (request.insights.length === 0) {
    return {
      ok: true,
      data: { narratives: [], meta: metaFor(config.mode === 'mock' ? 'mock' : 'real', provider.model) },
    };
  }

  const allowedIds = request.insights.map((item) => item.id);
  const evidenceByInsight = new Map(request.insights.map((item) => [item.id, item.evidenceRefs]));

  try {
    const raw = await provider.generateStructured({
      task: 'deep-report-narrative',
      systemPrompt: DEEP_REPORT_SYSTEM_PROMPT,
      userPayload: wrapUserData({ context: request.context }),
    });

    const parsed = parseDeepReportResponse(raw, allowedIds);

    /**
     * Quality Gate (E) — 원래 Insight에 없던 evidenceRef를 들고 오면 그 항목 전체를 버린다.
     *
     * ⚠️ v1.43 — `evidenceRefsAreSubsetOf`(`JSON.stringify` 비교)를 `refsWithinAllowed`로
     * 바꿨다. **판정은 같고** 두 가지가 좋아진다: (a) 키 순서에 민감하지 않고
     * (b) declared/relationship field 별칭을 canonical로 맞춘 뒤 비교한다 — 모델이
     * `contactImportance`(context가 실제로 보내는 이름)를 정확히 인용했는데 허용집합에는
     * `contact`가 있어서 떨어지는 과필터를 막는다. 그리고 네 Task가 **같은 술어**를 쓴다.
     */
    const rejectedRefs: string[] = [];
    const refChecked = parsed.filter((item) => {
      const allowed = evidenceByInsight.get(item.insightId) ?? [];
      if (refsWithinAllowed(item.evidenceRefs, allowed)) return true;
      rejectedRefs.push(...rejectedRefSources(item.evidenceRefs, allowed));
      return false;
    });

    /**
     * Quality Gate (B)(C) — 일반론·근거 없는 확정 표현은 scanDeepNarrative가 걸러낸다.
     * v1.43 — **시제 검사를 합성했다**(§47.5). `tense === 'current'`에서는 결과가
     * v1.42와 완전히 같다.
     */
    const scan = filterSafeItems(
      refChecked,
      (item) =>
        `${item.headline} ${item.interpretation} ${item.situation ?? ''} ${item.conversationQuestion ?? ''}`,
      (text) => scanDeepNarrativeWithTense(text, request.tense),
    );

    /**
     * Quality Gate (F) — **규칙 문장을 되풀이한 narrative는 버린다** (v1.27 · §24).
     *
     * (E)와 안전 검사를 다 통과해도 남는 실패가 하나 있다. v1.26 실측에서 어떤 연결의
     * AI 문장이 규칙 문장의 마지막 문장을 글자 그대로 반복했다. 위험한 주장이 아니므로
     * 안전 검사는 통과한다 — 그런데 사용자에게는 같은 말이 두 번 보인다.
     *
     * v1.27의 목표는 AI를 더 똑똑하게 만드는 게 아니라 **규칙이 확인한 범위 안에
     * 머물게 하는 것**이다. 그 범위 안에 머물면서 아무것도 더하지 않는 문장은 지면만
     * 차지한다. 그래서 여기서 떨어뜨리고, 화면은 규칙 문장으로 완결시킨다.
     */
    const ruleSummaryById = new Map(request.insights.map((item) => [item.id, item.ruleSummary]));
    const novel = scan.items.filter(
      (item) => !isRedundantNarrative(item.interpretation, ruleSummaryById.get(item.insightId) ?? ''),
    );

    /**
     * v1.27 — **필터링 결과를 관측할 수 있게 한다.**
     *
     * v1.26까지 이 핸들러는 `scan.violations`를 계산해놓고 아무 데도 남기지 않았다.
     * 그래서 "AI 문장이 화면에 없다"를 봤을 때 **모델이 안 만든 것인지, 안전 검사가
     * 버린 것인지 구분할 방법이 없었다.** v1.27에서 인과·예측 검사를 새로 넣으면서
     * 이 구분이 반드시 필요해졌다 — 과도한 거부를 발견하지 못하면 §22 실패
     * (모든 문장이 사라진 리포트)를 알아채지 못한다.
     *
     * ⚠️ Production에서는 남기지 않는다. 그리고 **문장 원문은 절대 로그에 넣지 않는다** —
     * 개수와 위반 라벨만이다(§34 Privacy).
     */
    logAiFilter({
      task: 'deep-report-narrative',
      /** v1.43 — `tense`가 로그에 들어온다. 그 전에는 이 Task의 시제를 관측할 수 없었다 */
      policy: { tense: request.tense },
      /**
       * ⚠️ `rawIdentifiers`를 넣지 않는다. 이 Task의 식별자는 `insightId`이고, 그건
       * 우리 enum이 아니라 세션 데이터에서 파생된 id다(§44 Privacy). 개수만 센다.
       */
      raw: rawNarrativeCount(raw),
      parsed: parsed.length,
      refChecked: refChecked.length,
      rejectedRefSources: rejectedRefs,
      safe: scan.items.length,
      violations: scan.violations,
      extra: { novel: novel.length },
    });

    const narratives: DeepNarrative[] = novel.map((item) => ({
      insightId: item.insightId,
      headline: item.headline,
      interpretation: item.interpretation,
      situation: item.situation,
      uncertainty: item.uncertainty,
      conversationQuestion: item.conversationQuestion,
      evidenceRefs: item.evidenceRefs,
    }));

    return {
      ok: true,
      data: { narratives, meta: metaFor(config.mode === 'mock' ? 'mock' : 'real', provider.model) },
    };
  } catch (error) {
    return failureFrom(error);
  }
}

/* ============== Premium Lens AI (v1.46 AI Lens · §7 · §27 · §31 · §32) ==== */

/**
 * 세 렌즈 Task가 **하나의 핸들러**를 쓴다. 다른 것은 셋뿐이다:
 * 프롬프트 상수 · promptVersion · 금지 목록(`scanLensNarrative`의 kind).
 *
 * ⚠️ `AiTask`를 인자로 받지 않고 `kind`를 받는다. Task 문자열에서 kind를 다시
 * 도출하면(`task.replace('premium-','')`) 판정이 두 벌이 된다 — 라우트가 이미
 * 자기가 어느 렌즈인지 알고 있으므로 그 값을 그대로 내려보낸다.
 */
export interface PremiumLensRequest {
  inputFingerprint: string;
  kind: PremiumLensKind;
  mode: 'pair' | 'self';
  context: unknown;
  /** v1.43 §47.5와 같은 계약 — 요청 최상위에서 따로 받는다(`context: unknown`이므로) */
  tense: RelationshipTense;
  /**
   * §9-5 — `false`면 `*_verify` unit을 지운다.
   *
   * ⚠️ 프롬프트에 들어가지 않는다. 모델에게 Job을 알려주지 않는다(v1.42 §40.7).
   */
  allowsOutwardQuestions: boolean;
  /**
   * v1.46.1 §4 — 상대가 있는지. mode가 `self`여도 상대는 있을 수 있다.
   * 있으면 '상대가 없어서' 류 문장을 서버가 버린다.
   */
  targetExists: boolean;
  /**
   * §31 — 결정론 본문. **프롬프트에는 들어가지 않는다.**
   *
   * 모델에게는 소제목만 보내고(`context.alreadySaid`), 실제 되풀이 여부는 여기서
   * 서버가 직접 검사한다. 원문을 모델에게 주면 그건 되풀이할 재료를 손에 쥐여주는
   * 것이고, 입력 토큰도 렌즈마다 3배가 된다(§26).
   */
  deterministicText: string;
}

const LENS_PROMPT: Record<PremiumLensKind, string> = {
  mbti: PREMIUM_MBTI_LENS_SYSTEM_PROMPT,
  saju: PREMIUM_SAJU_LENS_SYSTEM_PROMPT,
  zodiac: PREMIUM_ZODIAC_LENS_SYSTEM_PROMPT,
};

const LENS_PROMPT_VERSION: Record<PremiumLensKind, string> = {
  mbti: PROMPT_VERSIONS.premiumMbtiLens,
  saju: PROMPT_VERSIONS.premiumSajuLens,
  zodiac: PROMPT_VERSIONS.premiumZodiacLens,
};

const LENS_TASK: Record<PremiumLensKind, AiTask> = {
  mbti: 'premium-mbti-lens',
  saju: 'premium-saju-lens',
  zodiac: 'premium-zodiac-lens',
};

/** `*_verify` — §9-5 · §12-6 · §16-6의 '실제로 확인해볼 것' unit */
const VERIFY_UNIT_SUFFIX = '_verify';

export async function runPremiumLensTask(
  request: PremiumLensRequest,
): Promise<TaskResult<PremiumLensNarrativeBundle>> {
  const config = readAiConfig();
  const provider = resolveProvider(false);
  const { kind, mode } = request;

  const metaFor = (aiMode: AiMode, model?: string) =>
    buildMeta({
      mode: aiMode,
      promptVersion: LENS_PROMPT_VERSION[kind],
      inputFingerprint: request.inputFingerprint,
      model,
    });

  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    /**
     * Demo에서는 렌즈 narrative를 만들지 않는다. 화면은 결정론 렌즈를 그대로 그리고
     * AI 블록만 없다 — deep-report가 demo에서 하는 것과 같다(§32와도 같은 모양).
     */
    return { ok: true, data: { narrative: null, meta: metaFor('demo') } };
  }

  try {
    const raw = await provider.generateStructured({
      task: LENS_TASK[kind],
      systemPrompt: LENS_PROMPT[kind],
      userPayload: wrapUserData({ context: request.context }),
    });

    const parsed = parseLensNarrativeResponse(raw, kind, mode);

    if (!parsed) {
      logAiFilter({
        task: LENS_TASK[kind],
        policy: { mode, tense: request.tense, outwardQ: request.allowsOutwardQuestions },
        raw: rawUnitCount(raw),
        parsed: 0,
        safe: 0,
        violations: [],
      });
      return { ok: true, data: { narrative: null, meta: metaFor(aiModeFor(config), provider.model) } };
    }

    /**
     * Quality Gate ① — **질문 게이트가 안전 검사보다 앞에 온다** (v1.42 §41.9).
     *
     * 순서가 정책이다. 스캔을 먼저 돌리면 `ended` 사용자에게는 어차피 지울 unit
     * 하나의 위반 라벨이 로그에 남고, 반대로 게이트가 지운 뒤라면 그 unit은 애초에
     * 검사 대상이 아니다.
     */
    const gated = request.allowsOutwardQuestions
      ? parsed.units
      : parsed.units.filter((unit) => !unit.id.endsWith(VERIFY_UNIT_SUFFIX));

    /** Quality Gate ② — 금지 주장 · 계산하지 않은 값 · 시제 */
    const scan = filterSafeItems(
      gated,
      (unit) => unit.body,
      (text) => scanLensNarrative(text, kind, request.tense, request.targetExists),
    );

    /**
     * Quality Gate ③ — **결정론 문장을 그대로 옮겨 썼는지** (§31).
     *
     * ⚠️ `isRedundantNarrative`가 아니라 `echoesReferenceSentence`만 쓴다.
     * `noveltyRatio`의 기준값(0.35)은 v1.26에서 **한 Insight의 규칙 문장 한 줄**을
     * reference로 잡고 캘리브레이션한 값이다. 여기 reference는 렌즈 본문 전체
     * (1,000자 이상)라 bigram 집합이 훨씬 크고, 한국어 흔한 2글자가 대부분 매치되어
     * 정상 문장도 낮은 점수를 받는다 — 검증되지 않은 기준값을 다른 분포에 그대로
     * 옮기면 과필터가 된다(그 상수 주석이 `NOT VALIDATED`라고 적어둔 이유다).
     *
     * 문장 단위 복사(10자 이상 그대로 포함)는 분포와 무관하게 명백한 되풀이다.
     */
    const novel = scan.items.filter(
      (unit) => !echoesReferenceSentence(unit.body, request.deterministicText),
    );

    /**
     * Quality Gate ④ — **같은 틀의 반복** (v1.46.1 §8).
     *
     * ⚠️ 항목 스캐너가 아니라 여기 있는 이유는, 반복은 항목 하나만 봐서는 알 수 없기
     * 때문이다. 앞의 두 개는 그대로 두고 세 번째부터 버린다 — 표현 하나를 금지하는
     * 것이 아니라 여섯 칸이 한 문단처럼 읽히는 것을 막는 것이다.
     */
    const varied = limitStockPhraseRepeats(novel, (unit) => unit.body);

    const summarySafe =
      parsed.summary.length > 0 &&
      scanLensNarrative(parsed.summary, kind, request.tense, request.targetExists).safe &&
      !echoesReferenceSentence(parsed.summary, request.deterministicText);

    /**
     * §9-6 — 체크포인트는 사용자가 **직접 해보는 것**이라 outward 질문 게이트의
     * 대상이 아니다. 다만 안전 검사는 똑같이 받는다.
     */
    const checkpointSafe =
      parsed.checkpoint &&
      scanLensNarrative(parsed.checkpoint, kind, request.tense, request.targetExists).safe
        ? parsed.checkpoint
        : undefined;

    logAiFilter({
      task: LENS_TASK[kind],
      policy: { mode, tense: request.tense, outwardQ: request.allowsOutwardQuestions },
      /**
       * ⚠️ `rawIdentifiers`를 넣는다. 이 Task의 식별자는 **우리 enum**(`mbti_pair_rhythm`)
       * 이라 세션 데이터가 아니고, v1.42 §41.14가 증명했듯 `parsed=0`의 원인을 고를 수
       * 있게 해주는 유일한 정보다.
       */
      raw: rawUnitCount(raw),
      rawIdentifiers: rawUnitIds(raw),
      allowedIdentifiers: lensAiUnitIds(kind, mode),
      parsed: parsed.units.length,
      safe: scan.items.length,
      violations: scan.violations,
      extra: {
        gated: gated.length,
        novel: novel.length,
        repeat: varied.dropped,
        summary: summarySafe ? 1 : 0,
      },
    });

    /** 남은 것이 하나도 없으면 narrative를 만들지 않는다 — 빈 블록을 그리지 않는다 */
    if (!summarySafe && varied.items.length === 0) {
      return { ok: true, data: { narrative: null, meta: metaFor(aiModeFor(config), provider.model) } };
    }

    return {
      ok: true,
      data: {
        narrative: {
          kind,
          mode,
          summary: summarySafe ? parsed.summary : '',
          units: varied.items,
          ...(checkpointSafe ? { checkpoint: checkpointSafe } : {}),
          ...(parsed.crossTheme ? { crossTheme: parsed.crossTheme } : {}),
        },
        meta: metaFor(aiModeFor(config), provider.model),
      },
    };
  } catch (error) {
    return failureFrom(error);
  }
}

/* --------------------------------------------------------- Cross-Lens */

export interface CrossLensRequest {
  inputFingerprint: string;
  context: unknown;
  tense: RelationshipTense;
  allowsOutwardQuestions: boolean;
  /** v1.46.1 §4 — 렌즈 Task와 같은 이유. 세 렌즈가 전부 self여도 상대는 있을 수 있다 */
  targetExists: boolean;
}

export async function runCrossLensTask(
  request: CrossLensRequest,
): Promise<TaskResult<CrossLensNarrativeBundle>> {
  const config = readAiConfig();
  const provider = resolveProvider(false);

  const metaFor = (aiMode: AiMode, model?: string) =>
    buildMeta({
      mode: aiMode,
      promptVersion: PROMPT_VERSIONS.premiumCrossLens,
      inputFingerprint: request.inputFingerprint,
      model,
    });

  if (!provider) {
    if (config.mode === 'real') return { ok: false, reason: 'CONFIG_ERROR' };
    return { ok: true, data: { narrative: null, meta: metaFor('demo') } };
  }

  try {
    const raw = await provider.generateStructured({
      task: 'premium-cross-lens',
      systemPrompt: PREMIUM_CROSS_LENS_SYSTEM_PROMPT,
      userPayload: wrapUserData({ context: request.context }),
    });

    const parsed = parseCrossLensResponse(raw);

    if (!parsed) {
      logAiFilter({
        task: 'premium-cross-lens',
        policy: { tense: request.tense, outwardQ: request.allowsOutwardQuestions },
        raw: 0,
        parsed: 0,
        safe: 0,
        violations: [],
      });
      return { ok: true, data: { narrative: null, meta: metaFor(aiModeFor(config), provider.model) } };
    }

    const keep = (text: string) =>
      scanCrossLensNarrative(text, request.tense, request.targetExists).safe;
    const violations = new Set<string>();
    const filter = (items: readonly string[]) =>
      items.filter((item) => {
        const result = scanCrossLensNarrative(item, request.tense, request.targetExists);
        if (!result.safe) result.violations.forEach((label) => violations.add(label));
        return result.safe;
      });

    const repeatedThemes = filter(parsed.repeatedThemes);
    const differences = filter(parsed.differences);
    /**
     * §22-3 — 상대에게 확인하는 질문이다. `ended`에서는 **블록째** 비운다.
     * 게이트가 스캔보다 앞이므로(v1.42 §41.9) 지워질 항목의 위반 라벨은 세지 않는다.
     */
    const verificationQuestions = request.allowsOutwardQuestions
      ? filter(parsed.verificationQuestions)
      : [];

    /**
     * §8 — 세 블록을 **함께** 센다. 블록마다 따로 세면 '반복되는 테마'가 여섯 번
     * 나와도 각 블록에서는 두 번씩이라 통과한다. 사용자는 한 카드로 읽는다.
     */
    const varied = limitStockPhraseRepeats(
      [
        ...repeatedThemes.map((text) => ({ block: 'repeated' as const, text })),
        ...differences.map((text) => ({ block: 'differences' as const, text })),
        ...verificationQuestions.map((text) => ({ block: 'questions' as const, text })),
      ],
      (item) => item.text,
    );
    const keptOf = (block: 'repeated' | 'differences' | 'questions') =>
      varied.items.filter((item) => item.block === block).map((item) => item.text);

    const closing = parsed.closing && keep(parsed.closing) ? parsed.closing : undefined;

    const rawTotal =
      parsed.repeatedThemes.length + parsed.differences.length + parsed.verificationQuestions.length;
    const safeTotal = varied.items.length;

    logAiFilter({
      task: 'premium-cross-lens',
      policy: { tense: request.tense, outwardQ: request.allowsOutwardQuestions },
      raw: rawTotal,
      parsed: rawTotal,
      safe: safeTotal,
      violations: [...violations],
      extra: {
        repeated: keptOf('repeated').length,
        differences: keptOf('differences').length,
        questions: keptOf('questions').length,
        repeat: varied.dropped,
      },
    });

    if (safeTotal === 0) {
      return { ok: true, data: { narrative: null, meta: metaFor(aiModeFor(config), provider.model) } };
    }

    return {
      ok: true,
      data: {
        narrative: {
          repeatedThemes: keptOf('repeated'),
          differences: keptOf('differences'),
          verificationQuestions: keptOf('questions'),
          ...(closing ? { closing } : {}),
        },
        meta: metaFor(aiModeFor(config), provider.model),
      },
    };
  } catch (error) {
    return failureFrom(error);
  }
}

/** mock/real 구분 — 네 핸들러가 같은 식으로 쓰던 표현을 한 곳으로 모았다 */
function aiModeFor(config: { mode: string }): AiMode {
  return config.mode === 'mock' ? 'mock' : 'real';
}

function rawUnitCount(raw: unknown): number {
  if (raw === null || typeof raw !== 'object') return 0;
  const units = (raw as { units?: unknown }).units;
  return Array.isArray(units) ? units.length : 0;
}

/** 모델이 실제로 쓴 unit id — 우리 enum이라 로그에 남겨도 된다(§44 Privacy) */
function rawUnitIds(raw: unknown): string[] {
  if (raw === null || typeof raw !== 'object') return [];
  const units = (raw as { units?: unknown }).units;
  if (!Array.isArray(units)) return [];
  return units
    .map((unit) =>
      typeof unit === 'object' && unit !== null && typeof (unit as { id?: unknown }).id === 'string'
        ? ((unit as { id: string }).id)
        : '?',
    )
    .slice(0, 8);
}
