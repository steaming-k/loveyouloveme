import { MIRROR_AXES } from '@/data/axes';
import { PREMIUM_FEATURES } from '@/data/premium';
import { HISTORY_STATE_LABEL } from '@/data/copy';
import { PREMIUM_FAKE_DOOR, SAJU_ENGINE_READY } from '@/lib/env';
import type { EvidenceResolverContext } from '@/lib/aiEvidenceResolver';
import { buildApproachHints } from '@/lib/logic/approachHints';
import {
  buildActions,
  buildConnectionQuestions,
  buildConnections,
  hasDeepConnection,
  selectCorePattern,
  selectDeepObservation,
} from '@/services/premiumConnections';
import type {
  AstrologyCompatibilityResult,
  CompatibilityResult,
  ConversationQuestion,
  CrossSourceInsight,
  DeepApproachInsight,
  DeepCorePattern,
  DeepNarrative,
  HistoryReport,
  MbtiLensReport,
  MirrorReport,
  PremiumDetailReport,
  PremiumDetailSection,
  PremiumFeature,
  PremiumFeatureId,
  RelationshipDeepReport,
  RelationshipDeepReportOverview,
  RepeatedRelationshipSignal,
  TargetProfile,
} from '@/types';

/**
 * Premium Service
 *
 * 두 가지만 한다:
 *   ① 각 Premium Feature의 현재 상태(available / fake-door / unavailable) 판정
 *   ② 이미 계산된 결과를 상세(detail) 표현으로 **조합**
 *
 * ⚠️ **새 점수를 만들지 않는다.** 동기화율·Mirror 판정·History 판정은 그대로 쓴다.
 * ⚠️ **수집하지 않은 데이터를 새로 추론하지 않는다.** 상세는 해상도의 차이일 뿐,
 *    '더 정확한 분석'이 아니다.
 */

/* -------------------------------------------------------------- 상태 판정 */

/**
 * 상세 결과를 만들 근거가 없으면 `unavailable`이다 — 이때는 Paywall을 띄우지 않는다(§40).
 * 사주는 계산 엔진이 없으므로 돈을 내면 사주 상세가 나올 것처럼 보이면 안 된다(§21).
 */
export function premiumFeatureState(
  id: PremiumFeatureId,
  price: number,
  context: {
    mirrorAvailable?: boolean;
    historyComparable?: boolean;
    mbtiAvailable?: boolean;
    astrologyAvailable?: boolean;
    /** v1.9 — Cross-source Insight가 하나도 없으면 Deep Report도 Paywall을 띄우지 않는다 */
    deepReportAvailable?: boolean;
  } = {},
): PremiumFeature {
  const def = PREMIUM_FEATURES[id];

  const base: PremiumFeature = {
    id: def.id,
    source: def.source,
    title: def.title,
    description: def.description,
    additions: def.additions,
    price,
    status: PREMIUM_FAKE_DOOR ? 'fake-door' : 'unavailable',
  };

  const unavailable = (reason: string): PremiumFeature => ({
    ...base,
    status: 'unavailable',
    price: null,
    unavailableReason: reason,
  });

  if (id === 'saju_detail' && !SAJU_ENGINE_READY) {
    return unavailable('사주 명식 계산 엔진이 아직 연결되지 않았어. 상세도 함께 준비 중이야.');
  }
  if (id === 'mirror_detail' && context.mirrorAvailable === false) {
    return unavailable('관계 경험 기록이 있어야 Mirror 상세를 볼 수 있어.');
  }
  if (id === 'history_detail' && context.historyComparable === false) {
    return unavailable('비교할 관찰 기록이 2개 이상이어야 변화 상세를 볼 수 있어.');
  }
  if (id === 'mbti_detail' && context.mbtiAvailable === false) {
    return unavailable('두 사람 MBTI가 모두 있어야 상세를 볼 수 있어.');
  }
  if (id === 'astrology_detail' && context.astrologyAvailable === false) {
    return unavailable('두 사람 출생정보가 모두 있어야 상세를 볼 수 있어.');
  }
  if (id === 'relationship_deep_report' && context.deepReportAvailable === false) {
    return unavailable('아직 서로 연결해서 볼 수 있는 신호가 부족해. 관계 경험이나 상대 정보를 더 채우면 볼 수 있어.');
  }

  return base;
}

/* ------------------------------------------------ Compatibility Detail */

/**
 * 무료 S22는 대표 신호 1개씩만 보여준다. 상세는 **4개 축 전부**를 근거·상황까지 펼친다.
 * 점수는 손대지 않는다 — `result`를 그대로 읽는다.
 */
export function buildCompatibilityDetail(input: {
  result: CompatibilityResult;
  questions: readonly ConversationQuestion[];
  pastObservations: readonly { label: string; text: string }[];
}): PremiumDetailReport {
  const { result, questions, pastObservations } = input;
  const def = PREMIUM_FEATURES.compatibility_detail;

  const sections: PremiumDetailSection[] = result.dimensions.map((dimension) => ({
    label: dimension.label,
    mine: dimension.minePhrase,
    theirs: dimension.theirsPhrase,
    evidence: dimension.evidence,
    scene: dimension.scene,
    badge:
      dimension.alignment === null
        ? '비교 불가'
        : dimension.tone === 'good'
          ? '잘 맞는 신호'
          : dimension.tone === 'watch'
            ? '관찰 필요'
            : '보통',
  }));

  for (const observation of pastObservations) {
    sections.push({ label: `과거 관찰 · ${observation.label}`, evidence: observation.text });
  }

  const limitations = [
    `${result.unknownLabels.length > 0 ? `'모름'으로 남긴 ${result.unknownLabels.join(' · ')}은 비교하지 않았어. ` : ''}동기화율은 무료 결과와 같은 값이야 — 상세에서 점수를 다시 계산하지 않아.`,
  ];
  if (result.confidence === 'low') {
    limitations.push('비교한 항목이 적어서 해석의 폭이 좁아.');
  }

  return {
    feature: def.id,
    available: true,
    freeRecap: def.freeRecap,
    sections,
    prompts: questions.map((question) => question.text),
    closing:
      result.frictionSignals.length > 0
        ? `차이가 보이는 ${result.frictionSignals.map((signal) => signal.label).join(' · ')}은 미리 알고 이야기하면 훨씬 수월할 수 있어.`
        : '지금 입력된 정보에서는 크게 부딪힐 지점이 보이지 않았어.',
    limitations,
  };
}

/* -------------------------------------------------------- Mirror Detail */

export function buildMirrorDetail(input: {
  mirror: MirrorReport;
  adaptiveNote: string | null;
  pastObservations: readonly { label: string; text: string }[];
}): PremiumDetailReport {
  const { mirror, adaptiveNote, pastObservations } = input;
  const def = PREMIUM_FEATURES.mirror_detail;

  if (!mirror.available || mirror.insights.length === 0) {
    return {
      feature: def.id,
      available: false,
      freeRecap: def.freeRecap,
      sections: [],
      prompts: [],
      closing: null,
      limitations: ['관계 경험 기록이 있어야 Mirror 상세를 만들 수 있어.'],
    };
  }

  const sections: PremiumDetailSection[] = mirror.insights.map((insight) => ({
    label: insight.label,
    mine: insight.declaredHasScale
      ? `${insight.declaredPhrase} (${insight.declared}/5)`
      : insight.declaredPhrase,
    theirs: insight.relationshipSignal,
    evidence: insight.note,
    badge: insight.state,
  }));

  if (adaptiveNote) {
    sections.push({ label: '추가로 답한 이유', evidence: adaptiveNote });
  }
  for (const observation of pastObservations) {
    sections.push({ label: `과거 관찰 · ${observation.label}`, evidence: observation.text });
  }

  return {
    feature: def.id,
    available: true,
    freeRecap: def.freeRecap,
    sections,
    prompts: mirror.insights
      .filter((insight) => insight.state === 'GAP')
      .map((insight) => `${insight.label}에 대해 지금은 어떻게 생각해?`),
    closing: mirror.core?.summary ?? null,
    limitations: [
      '관계 경험 답변은 선택형이라 숫자로 측정된 값이 아니야. 방향만 본 판정이야.',
      `판정하지 못한 축(${mirror.totalAxisCount - mirror.insights.length}개)은 근거가 없어서 비워뒀어.`,
    ],
  };
}

/* ------------------------------------------------------- History Detail */

export function buildHistoryDetail(input: {
  report: HistoryReport;
  repeated: readonly RepeatedRelationshipSignal[];
}): PremiumDetailReport {
  const { report, repeated } = input;
  const def = PREMIUM_FEATURES.history_detail;

  if (!report.comparable) {
    return {
      feature: def.id,
      available: false,
      freeRecap: def.freeRecap,
      sections: [],
      prompts: [],
      closing: null,
      limitations: ['비교할 관찰 기록이 2개 이상이어야 변화 상세를 만들 수 있어.'],
    };
  }

  const sections: PremiumDetailSection[] = report.changes
    .filter((change) => change.state !== 'INSUFFICIENT')
    .map((change) => ({
      label: change.label,
      // v1.26 — 이 두 칸은 '나/상대'가 아니라 **과거/현재**다(실측에서 잘못된 라벨 확인).
      mine: change.previousText ?? undefined,
      mineLabel: '이전 기록',
      theirs: change.currentText ?? undefined,
      theirsLabel: '최근 기록',
      evidence: change.note,
      badge: HISTORY_STATE_LABEL[change.state],
    }));

  for (const signal of repeated) {
    sections.push({
      label: `반복 신호 · ${signal.label}`,
      evidence: `기록 ${signal.occurrences}번에서 같은 방향의 신호가 나타났어. 같은 원인이라고 단정하지는 않을게.`,
    });
  }

  return {
    feature: def.id,
    available: true,
    freeRecap: def.freeRecap,
    sections,
    prompts: repeated.map(
      (signal) => `다음 관계에서 ${signal.label}은 어떻게 다르게 해보고 싶어?`,
    ),
    closing: report.summary,
    limitations: [
      '기록이 쌓일수록 해석의 폭이 넓어져. 지금은 저장된 기록 안에서만 비교했어.',
      '변화가 좋아졌다/나빠졌다로 판정하지 않아.',
    ],
  };
}

/* ---------------------------------------------------------- MBTI Detail */

export function buildMbtiDetail(report: MbtiLensReport | null): PremiumDetailReport {
  const def = PREMIUM_FEATURES.mbti_detail;

  if (!report) {
    return {
      feature: def.id,
      available: false,
      freeRecap: def.freeRecap,
      sections: [],
      prompts: [],
      closing: null,
      limitations: ['두 사람 MBTI가 모두 있어야 상세를 만들 수 있어.'],
    };
  }

  return {
    feature: def.id,
    available: true,
    freeRecap: def.freeRecap,
    sections: report.axes.map((axis) => ({
      label: `${axis.eyebrow} · ${axis.label}`,
      mine: axis.mineLetter,
      theirs: axis.theirsLetter,
      evidence: axis.note,
      badge: axis.same ? '비슷한 성향' : '다르게 나타날 수 있음',
    })),
    prompts: report.axes
      .filter((axis) => !axis.same)
      .map((axis) => `${axis.label}에서 실제로는 어떤 쪽이 편해?`),
    closing:
      '유형보다 실제 너희 답변을 더 중요하게 볼 거야. 이건 대화 출발점이야.',
    limitations: [
      'MBTI는 동기화율에 반영하지 않아. 성향 궁합 이론도 쓰지 않았어.',
      '같은 글자가 많다고 더 좋은 관계라는 뜻이 아니야.',
    ],
  };
}

/* ----------------------------------------------------- Astrology Detail */

export function buildAstrologyDetail(
  couple: AstrologyCompatibilityResult,
): PremiumDetailReport {
  const def = PREMIUM_FEATURES.astrology_detail;

  if (!couple.available || !couple.mine || !couple.theirs) {
    return {
      feature: def.id,
      available: false,
      freeRecap: def.freeRecap,
      sections: [],
      prompts: [],
      closing: null,
      limitations: ['두 사람 출생정보가 모두 있어야 상세를 만들 수 있어.'],
    };
  }

  const sections: PremiumDetailSection[] = [
    { label: '태양궁', mine: couple.mine.label, theirs: couple.theirs.label },
    ...couple.similar.map((text) => ({ label: '비슷하게 읽힐 수 있는 부분', evidence: text })),
    ...couple.different.map((text) => ({
      label: '다르게 나타날 수 있는 부분',
      evidence: text,
    })),
  ];

  return {
    feature: def.id,
    available: true,
    freeRecap: def.freeRecap,
    sections,
    prompts: couple.prompts.map((prompt) => prompt.text),
    closing: '점성술에서는 이렇게 이야기되기도 해. 실제 너희가 그런지는 둘이 이야기해봐.',
    // Natal Chart를 만들지 않았다는 사실을 상세에서도 그대로 유지한다(§20)
    limitations: [...couple.limitations],
  };
}

/** 축 라벨 조회 — 화면에서 반복 계산하지 않도록 */
export function axisLabel(key: string): string {
  return MIRROR_AXES.find((axis) => axis.key === key)?.label ?? key;
}

/* ------------------------------------------- Relationship Deep Report (v1.9) */

/*
 * v1.26 P3-3에서 제거한 헬퍼 4개 (dead code로 남기지 않는다)
 *
 *   isRelationshipSelfInsight / cardFor
 *     Insight를 **source 조합**으로 갈라 두 섹션에 나눠 담던 기준. 사용자에게
 *     의미 있는 구분이 아니었다 — 이제 **연결 여부**(source 2개 이상)로 가른다.
 *
 *   situationFor
 *     v1.23부터 남아 있던 Remaining Risk의 실체. 무료 `SignalCard`가 이미 보여주는
 *     `AXIS_DEFINITIONS.scene.watch` / `evidence.watch`를 **글자 그대로** 다시
 *     출력하고 있었다. 유료에서 같은 문장을 다시 파는 것이라 섹션째로 없앴다.
 *     "언제 드러나는가"는 연결의 AI 맥락 문장과 NOTICE 액션이 대신한다.
 *
 *   conversationQuestionsFor
 *     무료 질문 텍스트를 그대로 옮겼다. Premium 질문은 이제
 *     `buildConnectionQuestions`가 **연결 자체를 검증하는 질문**으로 새로 만든다.
 */
/**
 * v1.26 P3-3 §16 — 첫 viewport에서 ₩1,900의 값이 즉시 보여야 한다.
 * 예전 headline은 '연결을 몇 가지 찾았어'로 **개수를 말하지 않았다** — 그래서 무료 결과
 * 요약과 구분되지 않았다. 이제 실제로 이은 정보 종류 수와 연결 수를 그대로 말한다.
 * 값은 전부 이미 만들어진 연결에서 파생된다 — 새 계산 없음.
 */
function overviewFor(
  insights: readonly CrossSourceInsight[],
  narratives: readonly DeepNarrative[],
  core: DeepCorePattern | null,
): RelationshipDeepReportOverview {
  const top = insights.slice(0, 3);

  return {
    headline: core
      ? `따로 답한 정보 ${core.connectedSourceCount}종을 이어서 ${core.connectionCount}개 연결을 찾았어`
      : '아직 연결해서 볼 수 있는 신호가 부족해',
    subcopy: core
      ? '하나씩 볼 때는 안 보이던 지점이야. 무료에서 본 결과를 더 길게 쓴 게 아니라, 서로 이어서 본 거야.'
      : '관계 경험이나 상대 정보가 더 쌓이면 연결해서 볼 수 있는 게 늘어나.',
    topSummaries: top.map(
      (insight) => narratives.find((item) => item.insightId === insight.id)?.headline ?? insight.ruleSummary,
    ),
  };
}

/*
 * v1.26 P3-3에서 제거: `finalObservationFor`
 *   `insights[0].ruleSummary`를 그대로 리포트 맨 아래에 다시 적었다. 그 문장은 이미
 *   맨 위 CORE PATTERN이 보여주고 있었고, 근거 목록까지 중복이었다(실측 확인).
 *   마무리는 `selectDeepObservation`(러비의 깊은 관찰 + 철학 질문)이 맡는다.
 */

/**
 * v1.15 §5 — Approach Hints × Premium. 무료 힌트(`buildApproachHints`)는 다시 계산하거나
 * 숨기지 않는다 — 그 함수가 이미 만든 'activity' 힌트(Target Preference × Target Axis)를
 * 그대로 재사용하고, 여기서는 사용자 자신의 관계 축(이미 계산된 `compatibility.dimensions`
 * — 재계산 없음)까지 한 겹 더 연결했을 때만 보이는 문장을 추가로 만든다. 셋 중 하나라도
 * 없으면(관심사가 없거나, 그 축에서 내 값을 모르면) null이다 — 없는 연결을 억지로
 * 만들지 않는다(§29 원칙 재사용).
 *
 * ⚠️ v1.19 §18 — 무료 힌트 문장(`activity.rationale`)을 **그대로 옮겨 적지 않는다.**
 * 예전에는 이 문장을 통째로 앞에 붙이고 뒤에 내 축을 덧댔는데, 그러면 유료 카드의 절반이
 * 사용자가 궁합 결과에서 이미 무료로 읽은 문장과 완전히 같아진다. `activity` 힌트의
 * **존재 여부**는 그대로 게이트로 쓰되(= 이 관심사로 제안할 근거가 있다는 판정 재사용),
 * 문장은 '무료 힌트가 왜 지금 이 관계 맥락에서 의미가 있는지'만 말한다.
 *   FREE:    "무엇을 해보면 좋은지"       (상대 취향 → 행동 제안)
 *   PREMIUM: "왜 그 제안이 지금 맞는지"   (상대 취향 × 상대 축 × **내 축**)
 */
function approachInsightFor(
  target: TargetProfile,
  compatibility: CompatibilityResult,
): DeepApproachInsight | null {
  const primary = target.preferences.interests[0];
  if (!primary) return null;

  const activity = buildApproachHints(target, compatibility).find((hint) => hint.kind === 'activity');
  if (!activity) return null;

  const aloneDimension = compatibility.dimensions.find((dimension) => dimension.key === 'alone');
  if (target.alone === 'h' && aloneDimension?.minePhrase) {
    return {
      title: `${primary.label}, 선택지를 열어두고 제안해봐`,
      text: `상대는 ${primary.label}을(를) 좋아하면서 개인 시간도 중요하게 보는 쪽인데, 너는 개인 시간을 ${aloneDimension.minePhrase}로 답했어. 무료 힌트에서 본 '하나를 구체적으로 제안하기'가 이 조합에서 특히 의미가 있는 이유가 여기 있어 — 일정을 확정해서 통보하면 상대는 자기 시간을 뺏겼다고 느낄 수 있고, 아무 제안도 안 하면 너는 관계가 진전되지 않는다고 느끼기 쉬워. 선택지를 열어둔 제안이 둘 다를 피하는 지점이야.`,
    };
  }

  const contactDimension = compatibility.dimensions.find((dimension) => dimension.key === 'contact');
  if (target.contact === 'h' && contactDimension?.minePhrase) {
    return {
      title: `${primary.label} 이야기로 먼저 연락해봐`,
      text: `상대는 연락을 자주 주고받는 걸 편하게 느끼는 쪽이고, 너는 연락 방식을 ${contactDimension.minePhrase}로 답했어. 이 리듬 차이를 모르면 '무슨 말을 걸어야 할지 모르겠다'가 연락 자체를 미루는 이유가 되기 쉬워. ${primary.label}처럼 이미 알고 있는 공통 소재가 있으면, 용건을 만들지 않아도 말을 시작할 수 있어서 리듬 차이가 덜 부담스러워져.`,
    };
  }

  return null;
}

function deepReportLimitations(input: {
  historyReport: HistoryReport;
  compatibility: CompatibilityResult;
}): string[] {
  const limitations = [
    '이 리포트는 네가 입력한 데이터를 서로 연결해 본 관찰이야. 진단이나 확정이 아니야.',
  ];
  if (!input.historyReport.comparable) {
    limitations.push('저장된 관찰 기록이 2개 미만이라 과거와 지금을 비교하는 부분은 만들지 않았어.');
  }
  if (input.compatibility.confidence === 'low') {
    limitations.push('상대 정보가 적어서 궁합 심화 비교의 폭이 좁아.');
  }
  return limitations;
}

/**
 * Premium 핵심 상품. **새 점수를 만들지 않는다** — Compatibility/Mirror/History는
 * 이미 계산된 결과를 그대로 조합하고(§17/§21은 기존 buildCompatibilityDetail/
 * buildHistoryDetail을 그대로 재사용한다), Cross-source Insight도 이미 만들어진 것을
 * AI Narrative와 짝짓기만 한다.
 */
export function buildRelationshipDeepReport(input: {
  /** 이미 §6 우선순위로 정렬된 목록(`rankInsights`/`buildCrossSourceInsights`의 반환값) */
  insights: readonly CrossSourceInsight[];
  narratives: readonly DeepNarrative[];
  resolverContext: EvidenceResolverContext;
  compatibility: CompatibilityResult;
  historyReport: HistoryReport;
  repeatedSignals: readonly RepeatedRelationshipSignal[];
  target: TargetProfile;
}): RelationshipDeepReport {
  const {
    insights,
    narratives,
    resolverContext,
    compatibility,
    historyReport,
    repeatedSignals,
    target,
  } = input;

  /**
   * v1.26 P3-3 — **연결(Connection)이 이 리포트의 1급 시민이다.**
   *
   * 예전 구조는 Insight를 'relationshipSelf'와 'crossSourceInsights'로 **source 조합**
   * 기준으로 갈랐는데, 그건 사용자에게 의미 있는 구분이 아니었다. 이제는
   * **연결 여부**로 가른다 — source 2개 이상이면 연결, 1개면 단일 관찰이다(§17).
   */
  const allConnections = buildConnections({ insights, narratives, resolverContext });
  const corePattern = selectCorePattern(allConnections);
  const connections = allConnections.filter(
    (connection) =>
      connection.sourceCount >= 2 && connection.id !== corePattern?.connection.id,
  );
  const singleSourceNotes = allConnections.filter((connection) => connection.sourceCount < 2);

  const historyDeep = historyReport.comparable
    ? buildHistoryDetail({ report: historyReport, repeated: repeatedSignals })
    : null;

  return {
    // v1.26 Availability Audit — 연결이 하나도 없으면 팔지 않는다(`hasDeepConnection`).
    available: hasDeepConnection(insights),
    overview: overviewFor(insights, narratives, corePattern),
    corePattern,
    connections,
    singleSourceNotes,
    actions: buildActions(corePattern),
    connectionQuestions: buildConnectionQuestions(allConnections),
    lovyObservation: selectDeepObservation(corePattern, insights),
    historyDeep,
    approachInsight: approachInsightFor(target, compatibility),
    limitations: deepReportLimitations({ historyReport, compatibility }),
  };
}
