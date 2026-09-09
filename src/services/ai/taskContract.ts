import type { AiTask } from '@/types';

import { PROMPT_VERSIONS } from './promptVersions';

/**
 * AI Task Contract (v1.43 · §43)
 *
 * ══ 이 파일이 존재하는 이유 ═══════════════════════════════════════════════
 *
 * v1.42는 AI 경계 계약 5개를 세웠다 — 시제 계약(프롬프트+스캐너) · 질문 Job 게이트 ·
 * 식별자 계약 · 근거 귀속 · 캐시 identity. 그리고 **그 5개를 `relationship-insight`
 * 한 Task에만** 세웠다.
 *
 * 나머지 4개 Task에 같은 계약이 있는지 확인하는 장치는 없었고, 그 결과 v1.43 Audit에서
 * 실측으로 재현된 것이 이것이다:
 *
 * ```
 * status=ended · target 4축 → job=ended · allowsOutwardQuestions=false
 *
 * /mirror        AI 질문 0            ← relationship Task: 게이트 있음
 * /compatibility AI 질문 2            ← compatibility Task: 게이트 없음
 *                '서로의 개인 시간에 대한 생각은 어떤지 이야기해볼까?'
 *                '갈등 상황에서 어떻게 대처하는 것이 좋을지 이야기해볼까?'
 * ```
 *
 * 같은 세션 · 같은 Job · 같은 안전 정책인데 **경로에 따라 결과가 반대**였다. 이것은
 * compatibility Task의 버그가 아니라 **계약을 Task마다 손으로 세우는 방식**의 결함이다.
 * v1.40.1이 "게이트를 읽는 곳이 두 군데였고 한 곳이 빠졌다"고 진단한 실패가, 이번에는
 * 화면 단위가 아니라 Task 단위로 재현된 것이다.
 *
 * > **안전 규칙은 화면이나 Task별 예외가 아니라, 같은 종류의 출력을 만드는 모든**
 * > **경로에 동일한 계약으로 적용돼야 한다.**
 *
 * ══ 이 파일이 하지 않는 일 ════════════════════════════════════════════════
 *
 * ⚠️ **판정을 만들지 않는다. 새 business logic source가 아니다.**
 *
 * 여기 있는 것은 **"각 Task가 어떤 계약을 가져야 하는가"라는 선언**뿐이고, 그 계약을
 * 실제로 집행하는 값·술어는 전부 기존 것을 그대로 쓴다:
 *
 * ```
 * 시제        relationshipTenseOf(job)          logic/relationshipStage.ts
 * 질문 게이트  jobAllowsOutwardQuestions(job)    logic/relationshipStage.ts
 * 축 enum     MIRROR_AXES · AXIS_DEFINITIONS    data/axes.ts
 * 근거 source EVIDENCE_SOURCES · EvidenceRef    services/ai/schemas.ts · types
 * 허용 근거    mirrorEvidenceRefs.ts             logic/ (결정론 엔진에서 파생)
 * ```
 *
 * 이 표가 하는 일은 **누락을 구조 테스트가 잡게 하는 것**이다(TC0~TC6). 값을 정하는
 * 곳이 아니라 "이 Task에 이 차원이 적용되는가"를 적어두는 곳이다.
 *
 * ⚠️ **`'not-applicable'`도 명시한다.** 필드를 비워두면 "아직 안 했다"와 "여기엔 필요
 * 없다"가 구분되지 않고, 그 구분이 안 되는 상태가 v1.42가 남긴 상태다. 모든 Task가
 * 모든 차원에 대해 값을 갖는다 — 타입이 그것을 강제한다.
 */

/* ────────────────────────────────────────────────────── 차원 정의 */

/**
 * 이 Task의 출력에 **관계 시제**가 적용되는가.
 *
 * `'required'` — 요청에 `tense: RelationshipTense`가 필수이고, 프롬프트에 시제 계약이
 *   있고, 출력에 `scanRelationshipTense`가 붙는다. 세 개가 함께 있어야 한다 —
 *   프롬프트만 있으면 1차 방어뿐이고(모델이 어기면 통과), 스캐너만 있으면 모델에게
 *   규칙을 알려주지 않은 채 결과를 버린다(과필터).
 *
 * `'not-applicable'` — 그 Task의 출력에 관계를 부르는 문장이 없다.
 */
export type TensePolicy = 'required' | 'not-applicable';

/**
 * 이 Task가 만든 **상대를 향한 질문**을 어떻게 다루는가.
 *
 * `'gated'` — 응답에 질문 필드가 있고, `applyOutwardQuestionGate`가 서버 후처리에서
 *   `allowsOutwardQuestions === false`인 Job의 질문을 지운다.
 *   ⚠️ 게이트는 **안전 검사 앞**에 둔다(v1.42 §41.9 — 순서가 정책이다).
 *   ⚠️ 게이트 입력은 프롬프트에 들어가지 않는다. AI에게 Job을 알려주지 않는다.
 *
 * `'deterministic-only'` — AI 출력에 화면에 그려지는 질문 필드가 **없다.** 그 리포트의
 *   질문은 결정론 생성기가 만들고 그쪽에 이미 게이트가 있다.
 *   (deep-report: `buildConnectionQuestions(_, { allowsOutwardQuestions })`)
 *
 * `'none'` — 질문을 만들지 않는 Task.
 */
export type OutwardQuestionPolicy = 'gated' | 'deterministic-only' | 'none';

/**
 * 모델이 항목을 지목할 때 쓰는 **식별자의 어휘**.
 *
 * v1.42 §41.14에서 배운 것: 모델이 `axis`에 한국어 label(`연락`)을 넣으면 `oneOf`가
 * 걸러 narrative가 전멸하는데, 프롬프트가 canonical key를 명시하지 않으면 그 오답이
 * 자연스러운 선택이 된다(같은 객체에 `label`이 함께 있으므로).
 *
 * 그래서 각 Task는 **허용값을 프롬프트에 명시**해야 하고, 그 목록은 파서가 쓰는
 * 배열과 **같은 상수**에서 나와야 한다(TC4).
 */
export type IdentifierPolicy =
  /** `MIRROR_AXES`의 key 5종 (alone·contact·hobby·conflict·affection) */
  | 'mirror-axis'
  /** `AXIS_DEFINITIONS`의 key 4종 (alone·affection·conflict·contact) */
  | 'compatibility-axis'
  /** 결정론 엔진이 만든 Insight id — label과 혼동될 수 없다 */
  | 'insight-id'
  /** 세션 내부 임의 이미지 id */
  | 'image-id';

/**
 * `AI_OUTPUT ⊆ DETERMINISTIC_EVIDENCE`를 **어느 범위로** 강제하는가.
 *
 * ══ 왜 Task 전체 허용집합으로는 불충분한가 ════════════════════════════════
 *
 * ```
 * contact narrative가 conflict의 ref를 인용한다
 *   → Task 전체 집합에는 둘 다 있으므로 통과
 *   → 화면에는 '연락' 설명 아래 '갈등 해결' 근거가 붙는다
 * ```
 *
 * 근거 귀속의 단위는 Task가 아니라 **항목**이다. 그래서 검사도 항목 단위여야 한다.
 *
 * `'axis-subset'`      — narrative.axis별 허용집합으로 제한 (relationship · history)
 * `'dimension-subset'` — narrative.dimensionKey별 허용집합으로 제한 (compatibility)
 * `'insight-subset'`   — narrative.insightId별 허용집합으로 제한 (deep-report · v1.27부터)
 * `'no-evidence-refs'` — 이 Task의 출력에 `EvidenceRef`가 없다 (observed)
 */
export type EvidencePolicy =
  | 'axis-subset'
  | 'dimension-subset'
  | 'insight-subset'
  | 'no-evidence-refs';

/**
 * 이 Task의 **최종 응답을 바꾸는 policy input**. 캐시 identity(지문)에 반드시 들어간다.
 *
 * v1.42 §8.13이 세운 규칙이다 — 클라이언트 캐시가 저장하는 것은 provider raw가 아니라
 * **후처리까지 끝난 최종 응답**이므로, 그 후처리의 입력이 다르면 재사용해도 되는
 * 응답이 아니다. 캐시 히트에는 응답이 없고, 히트의 정의가 '서버에 가지 않는 것'이다.
 *
 * ⚠️ 여기 적는 것은 **evidence가 아니라 policy**다. declared·experience·current 같은
 * 사실 입력은 각 지문 함수가 이미 담고 있고 이 목록의 대상이 아니다.
 *
 * ⚠️ 이 배열이 지문 함수의 입력 키와 일치하는지는 TC6이 검사한다.
 */
export type CachePolicyInput = 'tense' | 'allowsOutwardQuestions';

/**
 * dev 로그로 **raw / parsed / safe를 관측할 수 있는가.**
 *
 * v1.42 §41.14가 이 차원의 존재 이유다. `parsed=0`만 보고는 원인을 셋 중에서 고를 수
 * 없었다 — 모델이 안 만들었나 / 식별자가 안 맞았나 / 근거가 0개인가. raw 단계를 더한
 * 뒤에야 `raw=1[연락] allowed=[contact]`가 원인을 보여줬다.
 *
 * v1.43은 enforcement를 켜기 **전에** 이 로그를 모든 Task에 넣는다 — subset 검사를
 * 먼저 조이면 정상 근거가 떨어져도 그 사실을 알 방법이 없다(§19 rollout).
 */
export type ObservabilityPolicy = 'raw+parsed+safe' | 'per-photo';

export interface AiTaskContract {
  /** 이 Task의 프롬프트 버전. 계약이 바뀌면 반드시 올라간다(캐시 키에 들어간다) */
  promptVersion: string;
  tense: TensePolicy;
  outwardQuestions: OutwardQuestionPolicy;
  identifier: IdentifierPolicy;
  evidence: EvidencePolicy;
  /** 빈 배열 = 후처리 policy input이 없는 Task */
  cacheIdentity: readonly CachePolicyInput[];
  observability: ObservabilityPolicy;
}

/* ──────────────────────────────────────────────────────────── 선언 */

/**
 * ⚠️ `Record<AiTask, …>`다 — **새 Task가 생기면 `tsc`가 여기를 채우라고 막는다.**
 * 사람의 기억이 아니라 타입이 지킨다(v1.40.1이 세운 방식 그대로).
 */
export const TASK_CONTRACT: Record<AiTask, AiTaskContract> = {
  'relationship-insight': {
    promptVersion: PROMPT_VERSIONS.relationship,
    tense: 'required',
    outwardQuestions: 'gated',
    identifier: 'mirror-axis',
    /**
     * v1.43 — v1.42까지 이 Task에는 **어떤 근거 검사도 없었다.** `parseEvidenceRef`가
     * 모양만 보고 통과시켰으므로, 모델이 `{source:'relationship', field:'hardest'}`를
     * 아무 축에나 붙일 수 있었다. `hardest`가 `value_gap`이면 결정론 엔진은
     * (`HARDEST_TO_AXIS`에 없으므로) **그 ref를 절대 만들지 않는데** resolver는
     * 정상 문장을 돌려주므로 화면에 도달했다 — 판정층이 거부한 귀속을 AI가 우회했다.
     */
    evidence: 'axis-subset',
    cacheIdentity: ['tense', 'allowsOutwardQuestions'],
    observability: 'raw+parsed+safe',
  },

  'compatibility-narrative': {
    promptVersion: PROMPT_VERSIONS.compatibility,
    /**
     * v1.43 — `ended` 사용자의 `/compatibility`에도 AI 설명이 붙는다. 결정론 문구는
     * v1.40에서 시제를 맞췄는데(`이 숫자는 관계가 왜 끝났는지 설명하지 않아`) 그 아래
     * AI 문장에는 계약이 없었다.
     */
    tense: 'required',
    /**
     * v1.43 — 실측으로 재현된 결함(파일 상단 참고). `CompatibilityAxisNarrative`가
     * `narrative.conversationQuestion`을 GOOD/FRICTION 카드 footer에 그리고, 그 자리는
     * `showOutwardQuestions` UI 분기 **밖**이다.
     *
     * ⚠️ UI에 `if (ended) hide`를 새로 만들지 않는다 — 서버 경계에서 한 번만
     * (v1.42 §8.12.5 `UI 분기 금지`).
     */
    outwardQuestions: 'gated',
    identifier: 'compatibility-axis',
    evidence: 'dimension-subset',
    cacheIdentity: ['tense', 'allowsOutwardQuestions'],
    observability: 'raw+parsed+safe',
  },

  'history-insight': {
    promptVersion: PROMPT_VERSIONS.history,
    /**
     * 이 Task의 주제는 **두 기록 사이의 변화**이고 주어는 나다. 상대나 관계를 부르는
     * 문장이 아니므로 시제 계약의 대상이 아니다 — `scanHistoryNarrative`가 이미
     * 성장 서사·가치 판정을 막는다.
     *
     * ⚠️ 이것은 '아직 안 했다'가 아니라 판단이다. 여기에 `former` 스캐너를 붙이면
     * `이전에는 …였고 이번에는 …`처럼 **정상적인 변화 서술**이 위반으로 잡힌다.
     */
    tense: 'not-applicable',
    /** 응답 스키마에 질문 필드가 없다(`HistoryNarrative`) */
    outwardQuestions: 'none',
    identifier: 'mirror-axis',
    /**
     * v1.43 — `history` source는 `{entryId, axis}`를 요구하는데 `buildHistoryContext`가
     * `entryId`를 보내지 않아 **모델이 구성할 수 없는 계약**이었다(§45.3 결정 A로 해소).
     */
    evidence: 'axis-subset',
    cacheIdentity: [],
    observability: 'raw+parsed+safe',
  },

  'deep-report-narrative': {
    promptVersion: PROMPT_VERSIONS.deepReport,
    /**
     * v1.43 — `DeepNarrative.headline`/`interpretation`이 실제로 화면에 그려진다
     * (`overview.topSummaries` · `connection.narrativeText`). v1.41이 그 카드의
     * `limitation`·`sourceLabels` 시제를 힘들게 맞춘 자리인데, **그 위 AI 본문에는
     * 계약이 없었다** — 모델은 `limitation` 문자열에서 시제를 눈치채야 했다.
     */
    tense: 'required',
    /**
     * AI의 `conversationQuestion`은 **화면에 그려지지 않는다**(`buildConnections`가
     * 쓰는 것은 `interpretation`뿐이다). Premium 질문은 결정론
     * `buildConnectionQuestions`가 만들고 그쪽에 v1.40.1부터 게이트가 있다.
     *
     * ⚠️ 그래서 여기에 `applyOutwardQuestionGate`를 억지로 붙이지 않는다 — 최종
     * 응답을 바꾸지 않는 게이트는 캐시 identity만 늘리고 얻는 것이 없다.
     */
    outwardQuestions: 'deterministic-only',
    identifier: 'insight-id',
    /** v1.27부터 있었다 — 이 Task만 유일하게 근거 검사를 갖고 있었다 */
    evidence: 'insight-subset',
    cacheIdentity: ['tense'],
    observability: 'raw+parsed+safe',
  },

  'observed-profile': {
    promptVersion: PROMPT_VERSIONS.observed,
    /** 사진 관찰에는 관계를 부르는 문장이 없다 — 애초에 관계 데이터를 보내지 않는다 */
    tense: 'not-applicable',
    outwardQuestions: 'none',
    identifier: 'image-id',
    /** `ImageEvidence`를 쓴다 — `EvidenceRef` 계열이 아니다 */
    evidence: 'no-evidence-refs',
    cacheIdentity: [],
    /**
     * 사진 **한 장씩** Provider를 부르므로(§3) Task 단위 raw/parsed/safe가 성립하지
     * 않는다. 대신 장별 `usable`·violations를 이미 집계한다(`sanitizePhotoObservation`).
     */
    observability: 'per-photo',
  },
};

/** 구조 테스트·dev 라우트가 훑을 수 있게 배열로도 낸다 */
export const AI_TASK_IDS = Object.keys(TASK_CONTRACT) as AiTask[];

export function contractOf(task: AiTask): AiTaskContract {
  return TASK_CONTRACT[task];
}
