import { MIRROR_AXES } from '@/data/axes';
import { withObjectParticle } from '@/lib/korean';
import { PREMIUM_FEATURES } from '@/data/premium';
import { HISTORY_STATE_LABEL } from '@/data/copy';
import { PREMIUM_FAKE_DOOR, SAJU_ENGINE_READY } from '@/lib/env';
import { buildPremiumLensBundle } from '@/lib/logic/premiumLens';
import { soloModeOfTarget } from '@/lib/logic/soloMode';
import { buildReportedScenes } from '@/lib/logic/relationshipEvents';
import type { EvidenceResolverContext } from '@/lib/aiEvidenceResolver';
import type { RelationshipTense } from '@/lib/logic/relationshipEvidence';
import { buildApproachHints } from '@/lib/logic/approachHints';
/**
 * v1.40.1 — **type만 가져온다.** 이 파일은 Job을 도출하지 않는다(stage는 evidence가
 * 아니고, 도출은 화면·훅이 한다). 받은 문맥을 그대로 쓰기만 한다.
 */
import type { DeepReportJobContext } from '@/lib/logic/relationshipStage';
/**
 * v1.45 — Chapter Engine. **판정을 만들지 않는다** — 이미 만들어진 Insight를 고르고
 * 묶기만 한다(`logic/premiumChapters.ts` 상단 참고).
 */
import { buildOmissions, buildPremiumChapters, isContentChapter } from '@/lib/logic/premiumChapters';
import {
  buildActions,
  buildConnectionQuestions,
  buildConnections,
  premiumSourceGroupLabel,
  selectCorePattern,
  selectDeepObservation,
} from '@/services/premiumConnections';
import type {
  AstrologyCompatibilityResult,
  CompatibilityResult,
  ConversationQuestion,
  CrossSourceInsight,
  DeepApproachInsight,
  DeepNarrative,
  HistoryReport,
  MbtiLensReport,
  MirrorAxisKey,
  MirrorReport,
  PremiumChapter,
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
/**
 * `additions` 중 **상대를 향한 행동**을 약속하는 항목 (v1.40 §37.9).
 *
 * `ended`처럼 그 행동을 제안하지 않는 Job에서는 이 항목을 목록에서 뺀다. 리포트가 실제로
 * 만들지 않는 것을 팔지 않기 위해서다(v1.26 원칙). 문자열을 그대로 키로 쓰는 이유:
 * `premium.ts`의 목록을 고칠 때 여기도 함께 눈에 들어오게 하려는 것이다 — 별도 id를
 * 붙이면 두 곳이 조용히 어긋난다.
 */
const OUTWARD_ADDITION_ITEMS = new Set<string>([
  '상대 취향과 내 관계 방식을 연결한 다가가는 힌트',
  '연결을 상대에게 확인해볼 질문',
]);

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
    /**
     * v1.29 P4 — 지금 특정 상대가 없는 사용자인가.
     *
     * unavailable **판정**은 바꾸지 않는다(§41: source 1종이면 열지 않는다).
     * 바꾸는 것은 **안내 문구**다. 기존 문구는 "관계 경험이나 상대 정보를 더 채우면"인데,
     * 상대가 없는 사용자에게 그건 갈 수 없는 길을 알려주는 것이다 — 실측에서 확인했다.
     * Solo가 이 리포트를 열 수 있는 경로는 MBTI(⑦)와 사진 관찰(⑥)이다 — v1.32에서
     * ⑦이 생기면서 **사진이 필수 입장권이 아니게 됐다.**
     *
     * ⚠️ **UT-1 P0-A에서 필수로 바꿨다.** optional + 기본값 허용이라 호출부 4곳이
     * 값을 빠뜨리고 있었고, 이번에는 `allowsOutwardAction`(v1.40.1 §38.3)과 달리
     * **사용자에게 그대로 노출됐다** — 상대가 하나도 없는 `solo_exp` 사용자가
     * `/mirror`에서 "관계 경험이나 상대 정보를 더 채우면 볼 수 있어"를 봤다(브라우저
     * 실측). 그 사용자에게 '상대 정보'는 갈 수 없는 길이다.
     *
     * ⚠️ `true`를 하드코딩하지 않는다. `/first-contact`가 그렇게 하고 있었는데,
     * 그 Route는 `no_target`뿐 아니라 `unknown_target`(사람은 있는데 아는 게 적다)도
     * 받는다 — 그 사용자에게 가장 가까운 길은 상대 4축을 하나 더 채우는 것인데
     * 화면은 MBTI·사진을 권했다. 판정 source는 언제나
     * `soloModeOf(answers) === 'no_target'` 하나다.
     */
    solo: boolean;
    /**
     * v1.40 §37.9 · **v1.40.1 §38.3에서 필수로 바꿨다** — 이 Job에서 상대를 향한 행동을
     * 제안해도 되는가(`jobAllowsOutwardAction(job)`).
     *
     * **eligibility·가격·status 판정에는 들어가지 않는다.** 바꾸는 것은
     * `additions` 목록에서 **지키지 못할 약속 한 줄을 빼는 것**뿐이다 —
     * `ended`에서는 리포트가 그 섹션을 만들지 않으므로(`allowsOutwardAction: false`),
     * 그대로 두면 v1.26이 세운 원칙("없는 것을 팔지 않는다")을 어긴다.
     *
     * ⚠️ **v1.40에서는 optional이었고 기본값이 허용이었다. 그래서 호출부 2곳이 값을
     * 넘기지 않았다** — `/first-contact`와 `/history/report`(v1.40.1 Audit에서 발견).
     *
     * **사용자에게 노출된 결함은 아니었다.** `additions`를 실제로 렌더하는 화면은
     * `/premium` 한 곳뿐이고(`PremiumEntryRow`는 `price`·`status`·`title`·
     * `description`·`unavailableReason`만 읽는다) 그 호출부는 v1.40부터 게이트를
     * 넘겼다. 즉 계산된 값이 쓰이지 않았을 뿐, `ended` 사용자가 그 두 화면에서 outward
     * 약속을 본 적은 없다.
     *
     * **그래도 필수로 바꿨다.** 실패 방식이 `buildRelationshipDeepReport`와 같기
     * 때문이다: 게이트는 있고, 호출부가 빠지고, 기본값이 그것을 덮는다. 지금은
     * 우연히 무해하지만 `PremiumEntryRow`가 언젠가 `additions`를 요약해 보여주기로
     * 하면 그 순간 새어 나간다. 이제 새 진입점이 빼먹으면 `tsc`가 막는다.
     *
     * 이 값이 결과를 바꾸지 않는 feature(`mbti_detail`·`astrology_detail` —
     * `additions`에 outward 항목이 없다)도 넘겨야 하지만, **그 판단을 호출부가
     * 조용히 생략할 수 있게 두지 않는다.**
     */
    allowsOutwardAction: boolean;
  },
): PremiumFeature {
  const def = PREMIUM_FEATURES[id];

  const additions =
    context.allowsOutwardAction === false
      ? def.additions.filter((item) => !OUTWARD_ADDITION_ITEMS.has(item))
      : def.additions;

  const base: PremiumFeature = {
    id: def.id,
    source: def.source,
    title: def.title,
    description: def.description,
    additions,
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
    // ⚠️ 갈 수 없는 길을 알려주지 않는다 — 상대가 없는 사용자에게 '상대 정보'를 요구하지 않는다.
    return unavailable(
      context.solo
        ? '아직 서로 연결해서 볼 수 있는 신호가 부족해. MBTI를 입력하거나 사진 관찰을 확인해두면 네가 답한 기준과 이어서 볼 수 있어.'
        : '아직 서로 연결해서 볼 수 있는 신호가 부족해. 관계 경험이나 상대 정보를 더 채우면 볼 수 있어.',
    );
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
    /**
     * ⚠️ v1.36 — **Mirror는 나 vs 상대가 아니다.** 기본 라벨(`나`/`상대`)을 그대로 쓰면
     * `말한 나 vs 관계 속의 나` 비교가 상대와의 비교로 읽힌다 — Mirror의 정의를
     * 정면으로 오표기하는 것이다(실측: `연락 · MATCH · 나 … · 상대 …`).
     */
    mineLabel: '말한 나',
    theirsLabel: '관계 속의 나',
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
  /**
   * v1.40.1 §38.2 → **v1.41 §39.17에서 필수로 바꿨다** — 지금 진행 중인 관계가
   * 있는 사용자인가(`jobAllowsOutwardAction(job)`와 같은 값).
   *
   * ⚠️ 이 값이 없던 v1.40에서 `prompts`는 항상 `다음 관계에서 …`였다. 그래서
   * `dating`·`married` 사용자가 유료 리포트에서 **지금 관계가 끝난 뒤를 전제한
   * 질문**을 받았다 — `DATING_FORBIDDEN`이 `다음 관계`를 금지 어휘로 올려둔
   * 바로 그 표현이다. Ended Safety와 **같은 종류의 결함이고 방향만 반대다.**
   *
   * ══ v1.41에서 optional을 없앤 이유 ═══════════════════════════════════════
   *
   * v1.40.1은 기본값 `false`를 남기고 "standalone 화면은 아직 Job을 읽지 않는다"고
   * 적었다. **그 진술은 그때 이미 사실이 아니었다** — standalone 경로는
   * `app/premium-preview/[feature]/page.tsx` 하나뿐이고 그 화면은 v1.40.1부터
   * `lifecycle.allowsOutwardAction`을 넘기고 있었다(v1.41 Audit에서 확인).
   *
   * 즉 남아 있던 것은 **노출된 결함이 아니라 permissive default 자체**였고, 그건
   * v1.40.1이 `buildRelationshipDeepReport`에서 버리기로 정한 패턴이다. 같은 파일
   * 안에 같은 패턴을 하나 남겨 두면 다음 호출부가 그것을 따라간다. Production에서
   * 안 읽는 경로라고 영원히 방치하지 않는다(§39.17).
   */
  hasCurrentRelationship: boolean;
}): PremiumDetailReport {
  const { report, repeated, hasCurrentRelationship } = input;
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
    /**
     * v1.40.1 — 관계가 진행 중이면 **지금 관계**를 주어로 쓴다. 같은 반복 신호를
     * 두고 시점만 바꾸는 것이고, 신호 판정·개수는 그대로다.
     */
    prompts: repeated.map((signal) =>
      hasCurrentRelationship
        ? `지금 관계에서 ${signal.label}은 어떻게 다르게 해보고 싶어?`
        : `다음 관계에서 ${signal.label}은 어떻게 다르게 해보고 싶어?`,
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
/**
 * ══ v1.45 §6.1 — **숫자가 Chapter 수여야 한다** ═══════════════════════════
 *
 * v1.44의 headline은 `정보 8종을 이어서 8개 연결을 찾았어`였다. 그 `8개 연결`은
 * `corePattern.connectionCount`(= source 2종 이상인 Insight 수)였고, 화면에 실제로
 * 그려진 유닛은 12개였다 — **헤더의 숫자와 화면의 개수가 서로 달랐다.**
 *
 * v1.45는 화면 단위가 Chapter이므로 헤더도 Chapter 수를 말한다. `omissions`(이번에
 * 만들지 않은 것)는 이 수에 **포함하지 않는다** — 만들지 않은 것을 세면 그건 규모가
 * 아니라 광고다(§14.1).
 *
 * ⚠️ subcopy의 출처 목록도 하드코딩하지 않는다. 실제 Chapter가 쓴 그룹만 적고,
 * 라벨은 `premiumSourceGroupLabel`(= 화면 칩과 같은 어휘 · 시제 반영)에서 가져온다.
 */
function overviewFor(input: {
  insights: readonly CrossSourceInsight[];
  narratives: readonly DeepNarrative[];
  chapters: readonly PremiumChapter[];
  tense: RelationshipTense;
}): RelationshipDeepReportOverview {
  const { insights, narratives, chapters, tense } = input;
  const top = insights.slice(0, 3);

  const groups = [...new Set(chapters.flatMap((chapter) => chapter.sourceGroups))];
  const groupLabels = groups.map((group) => premiumSourceGroupLabel(group, tense));

  return {
    headline:
      chapters.length > 0
        ? `러비가 이번 관찰에서 연결한 이야기 ${chapters.length}개`
        : '아직 연결해서 볼 수 있는 신호가 부족해',
    subcopy:
      chapters.length > 0
        ? groupLabels.length > 0
          ? `${groupLabels.join(' · ')} 사이에서 서로 연결되는 지점을 모았어. 무료에서 본 결과를 더 길게 쓴 게 아니라, 서로 이어서 본 거야.`
          : '하나씩 볼 때는 안 보이던 지점이야. 무료에서 본 결과를 더 길게 쓴 게 아니라, 서로 이어서 본 거야.'
        : '관계 경험이나 상대 정보가 더 쌓이면 연결해서 볼 수 있는 게 늘어나.',
    /**
     * ⚠️ v1.45 — 이 필드는 **화면에 그려지지 않는다.** v1.26부터 그랬고(실측에서
     * 확인한 죽은 필드), v1.45의 Report Summary는 `chapters` 앞쪽 3개를 직접 쓴다.
     * 그런데 지우지 않았다 — `test:lifecycle`·`test:relationship-evidence`가 이
     * 문자열을 금지 어휘 스캔 대상(`renderedStrings`)으로 훑고 있고, AI headline이
     * 실제로 여기 들어온다. 스캔 표면을 줄이는 변경은 이 버전에서 하지 않는다.
     */
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
      text: `상대는 ${withObjectParticle(primary.label)} 좋아하면서 개인 시간도 중요하게 보는 쪽인데, 너는 개인 시간을 ${aloneDimension.minePhrase}로 답했어. 무료 힌트에서 본 '하나를 구체적으로 제안하기'가 이 조합에서 특히 의미가 있는 이유가 여기 있어 — 일정을 확정해서 통보하면 상대는 자기 시간을 뺏겼다고 느낄 수 있고, 아무 제안도 안 하면 너는 관계가 진전되지 않는다고 느끼기 쉬워. 선택지를 열어둔 제안이 둘 다를 피하는 지점이야.`,
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
  /**
   * v1.45 — Chapter Engine의 입력. **다시 계산하지 않는다** — 화면·엔진이 이미 만든
   * `MirrorReport`를 그대로 받는다.
   *
   * ⚠️ 왜 필요한가: ① `isFreeDuplicate`가 "무료 Mirror 행이 이미 보여준 것"을 판정하려면
   * 무료가 실제로 무엇을 보여주는지 알아야 한다. ② CH07(아직 확신하면 안 되는 지점)의
   * 재료 중 하나가 **판정하지 못한 축 수**(`totalAxisCount - insights.length`)다.
   *
   * ⚠️ **필수다.** optional로 두면 새 호출부가 빼먹고, 그러면 FREE 중복 게이트가
   * 조용히 꺼진 채 유료가 무료 문장을 다시 판다 — v1.40.1 §38.2가 닫은 실패 형태다.
   */
  mirror: MirrorReport;
  /**
   * v1.40 §37.9 · **v1.40.1 §38.2에서 필수로 바꿨다** — 이 Job에서 무엇을 만들어도
   * 되는가. `deepReportJobContext(job)`(`logic/relationshipStage.ts`)가 만든다.
   *
   * ⚠️ 유료 리포트에도 같은 안전 규칙을 적용한다. 관계가 끝났다고 답한 사용자가 돈을 내고
   * `먼저 연락해봐` · `제안해봐`를 받는 것은 무료 화면에서 그 문구를 막은 이유와 정확히
   * 같은 이유로 막아야 한다 — Ended Safety는 무료/유료 경계와 무관하다.
   *
   * ⚠️ **v1.40에서는 이 값이 optional이었고 기본값이 허용이었다.** 그 결정이
   * v1.40.1이 닫는 결함을 만들었다: 호출부가 두 곳인데
   * `hooks/useDeepReport.ts`만 값을 넘겼고, 값을 안 넘긴
   * `app/premium-preview/[feature]/page.tsx`가 **Deep Report 본문을 실제로 여는
   * 유일한 경로**였다. 그래서 게이트는 코드에 있었지만 화면에는 적용되지 않았다.
   * 이제 필수다 — 새 호출부가 빼먹으면 `tsc`가 막는다. 기본값으로 안전을 보장할 수
   * 있다는 가정을 버렸다.
   *
   * ⚠️ eligibility·가격·rank·연결 생성에는 **들어가지 않는다.** 이 값이 가르는 것은
   * (a) outward 행동·질문을 만들지 (b) 섹션 제목을 무엇으로 쓸지 두 가지뿐이다
   * (§37 stage는 evidence가 아니다).
   */
  lifecycle: DeepReportJobContext;
  /**
   * v1.46 PremiumLens §6 — 관계 렌즈의 가용성 판정(생년월일이 미래인가)에만 쓴다.
   *
   * ⚠️ **필수다.** 기본값으로 `new Date()`를 두면 fixture가 날짜를 고정할 수 없고,
   * 그러면 생일이 오늘인 사용자에서만 거지는 테스트가 된다. 호출부가 명시한다.
   */
  today: Date;
}): RelationshipDeepReport {
  const {
    insights,
    narratives,
    resolverContext,
    compatibility,
    historyReport,
    repeatedSignals,
    target,
    mirror,
    lifecycle,
    today,
  } = input;
  const { allowsOutwardAction, allowsOutwardQuestions, actionSectionTitle } = lifecycle;

  /**
   * v1.26 P3-3 — **연결(Connection)이 이 리포트의 1급 시민이다.**
   *
   * 예전 구조는 Insight를 'relationshipSelf'와 'crossSourceInsights'로 **source 조합**
   * 기준으로 갈랐는데, 그건 사용자에게 의미 있는 구분이 아니었다. 이제는
   * **연결 여부**로 가른다 — source 2개 이상이면 연결, 1개면 단일 관찰이다(§17).
   */
  const allConnections = buildConnections({
    insights,
    narratives,
    resolverContext,
    tense: lifecycle.tense,
  });
  const corePattern = selectCorePattern(allConnections);
  const connections = allConnections.filter(
    (connection) =>
      connection.sourceCount >= 2 && connection.id !== corePattern?.connection.id,
  );
  const singleSourceNotes = allConnections.filter((connection) => connection.sourceCount < 2);

  const historyDeep = historyReport.comparable
    ? buildHistoryDetail({
        report: historyReport,
        repeated: repeatedSignals,
        // v1.40.1 — `다음 관계에서 …`를 진행 중인 관계에 쓰지 않는다.
        hasCurrentRelationship: allowsOutwardAction,
      })
    : null;

  // v1.40.1 §38.2 — 세 자리 전부 같은 Job 문맥을 받는다. 한 곳만 받으면 그게 v1.40이다.
  const actions = buildActions(corePattern, { allowsOutwardAction });
  const connectionQuestions = buildConnectionQuestions(allConnections, { allowsOutwardQuestions });
  // v1.41 §39.13 — 러비의 깊은 관찰·철학 질문도 같은 시제 게이트를 받는다.
  const lovyObservation = selectDeepObservation(corePattern, insights, lifecycle.tense);

  /**
   * v1.45 — Chapter가 붙일 축별 확인 질문.
   *
   * ⚠️ **여기서 질문을 새로 만들지 않는다.** 위 `connectionQuestions`(이미 Job 게이트를
   * 통과한 목록)를 축으로 되풀어 쓸 뿐이다. 게이트를 두 번 구현하면 한쪽이 빠지고,
   * 그러면 `ended` 사용자가 Chapter 안에서만 outward 질문을 받는다 — v1.43이 Task
   * 단위로 재현한 실패 형태와 같다.
   */
  const questionByAxis: Partial<Record<MirrorAxisKey, string>> = {};
  for (const item of connectionQuestions) {
    const axis = item.question.id.startsWith('conn_')
      ? (item.question.id.slice('conn_'.length) as MirrorAxisKey)
      : null;
    if (axis) questionByAxis[axis] = item.question.text;
  }

  /**
   * v1.26 Availability Audit — 연결이 하나도 없으면 이 리포트를 팔지 않는다.
   *
   * ⚠️ v1.45 — **그때는 Chapter도 만들지 않는다.** 처음에는 게이트와 무관하게 만들었는데,
   * Sparse 세션 실측에서 화면은 '부족해' 안내만 보여주면서 헤더가
   * '연결한 이야기 1개'라고 말했다(CH07 하나가 배열에 남아 있었다) — v1.45가
   * 고치기로 한 **헤더 숫자와 화면 개수의 불일치**를 새 구조에서 다시 만든 것이다.
   *
   * CH07(아직 확신하면 안 되는 지점) 하나만으로는 ₩1,900의 리포트가 아니고, 그 세션에
   * 정말 필요한 것은 '무엇이 더 쌓이면 열리는지'다 — 그건 아래 `omissions`가 담당한다.
   */
  /**
   * ══ `available`은 **실제로 만들어진 내용 Chapter**로 정한다 (v1.45 PostReview) ══
   *
   * 예전에는 `hasDeepConnection(insights)`였다. 그 판정은 '연결할 수 있는 Insight가
   * 있다'까지만 보고, 그 Insight가 **Chapter까지 살아남았는지는 보지 않았다.** 실측에서
   * 정확히 그 틈이 드러났다:
   *
   * ```
   * B  Experience O · Target X   gate=true  available=true
   *    Chapter: uncertainty · next_check     ← 둘 다 파생. 내용 Chapter 0개
   * ```
   *
   * 즉 **내용이 하나도 없는 리포트가 팔렸다.** 원인은 정상 동작이었다 — 그 세션의
   * cross-source Insight 3개가 전부 무료 Mirror와 같은 것을 말해서 `isFreeDuplicate`가
   * 걸러냈다. 걸러낸 것은 옳았고, 그 뒤에 남은 것이 없다는 사실을 `available`이 몰랐다.
   *
   * 이제 Chapter를 **먼저 만들고** 내용 Chapter가 하나라도 있는지로 판단한다. 그래서
   * '헤더 숫자와 화면 개수가 다르다' 계열의 결함이 구조적으로 다시 생길 수 없다.
   *
   * ⚠️ Chapter를 항상 만드는 것으로 바뀌었으므로, 내용이 없으면 **배열을 비운다.**
   * 파생 Chapter만 남은 배열을 그대로 넘기면 `!available` 화면이 그것을 세게 된다.
   */
  const builtChapters = buildPremiumChapters({
    insights,
    connections: allConnections,
    mirror,
    compatibility,
    historyReport,
    actions,
    questions: connectionQuestions,
    lovyObservation,
    tense: lifecycle.tense,
    actionSectionTitle,
    questionByAxis,
    declared: resolverContext.answers.declared,
  });
  const available = builtChapters.some(isContentChapter);
  const chapters = available ? builtChapters : [];

  return {
    available,
    overview: overviewFor({
      insights,
      narratives,
      chapters,
      tense: lifecycle.tense,
    }),
    corePattern,
    connections,
    singleSourceNotes,
    actions,
    connectionQuestions,
    actionSectionTitle,
    lovyObservation,
    historyDeep,
    approachInsight: allowsOutwardAction ? approachInsightFor(target, compatibility) : null,
    /**
     * v1.46 §12 — 사용자가 알려준 관계 사건의 **관계 맥락 블록.**
     *
     * ⚠️ `allowsOutwardAction`으로 가리지 않는다 — `approachInsight`(다가가는 힌트)와
     * 달리 이 블록은 상대에게 다가가는 방법이 아니라 **사용자가 스스로 알려준 기억**을
     * 되짚는 것이다. 관계가 끝났다고 답한 사용자에게도 그 기억은 여전히 자기 것이고,
     * 시제만 `tense`를 따른다(v1.42 §41.4와 같은 규칙).
     *
     * ⚠️ `available`·`chapters`·`omissions`에 넣지 않는다. 사건은 연결이 아니므로
     * 사건만으로 리포트가 열리지 않는다.
     */
    reportedScenes: buildReportedScenes(target.events, lifecycle.tense),
    /**
     * v1.46 PremiumLens §2 — **같은 결제로 함께 열리는 관계 렌즈 3종.**
     *
     * ⚠️ `allowsOutwardAction`으로 가리지 않는다. 렌즈는 상대에게 다가가는 방법이
     * 아니라 **같은 관계를 다른 프레임으로 다시 보는 것**이고, 관계가 끝난 사용자에게도
     * 자기 생년월일·MBTI는 그대로 자기 것이다(`reportedScenes`와 같은 판단).
     *
     * ⚠️ `available`·`chapters`·`omissions`에 영향을 주지 않는다. MBTI만 있고 연결이
     * 하나도 없는 세션이 렌즈 때문에 열리면, 사용자는 정밀 관찰 리포트를 사고 렌즈만 받는다.
     */
    lensBundle: buildPremiumLensBundle({
      selfMbti: resolverContext.answers.mbti,
      targetMbti: target.mbti,
      selfBirth: resolverContext.answers.birthProfile,
      targetBirth: target.birthProfile,
      /**
       * ⚠️ §6 — '상대가 있다'는 pair의 필요조건일 뿐이다. 여기서는 대상 자체가
       * 있는지만 알려주고, 렌즈별 데이터 유무는 엔진이 각자 판정한다.
       *
       * ⚠️ 술어를 새로 만들지 않는다 — `soloModeOfTarget`이 이미 '사람은 있는가'를
       * 판정한다(`unknown_target`도 사람은 있다는 뜻이다). 두 벌을 만들면 화면과
       * 렌즈가 서로 다른 사용자로 취급하게 된다.
       */
      hasTarget: soloModeOfTarget(target) !== 'no_target',
      declared: resolverContext.answers.declared,
      events: target.events,
      today,
    }),
    limitations: deepReportLimitations({ historyReport, compatibility }),
    chapters,
    omissions: buildOmissions({
      chapters,
      mirror,
      compatibility,
      historyReport,
      /**
       * ⚠️ `signals`에 키가 하나라도 있으면 답한 것이다. `askedAt`은 화면을 열어본
       * 시점일 뿐 판정에 쓰지 않는다(`CurrentRelationshipEvidence` 주석).
       */
      hasCurrentEvidence:
        Object.keys(resolverContext.answers.currentRelationship.signals).length > 0,
    }),
    /**
     * v1.45 — 화면이 시제를 **다시 판정하지 않게** 그대로 실어 보낸다. 표현 문구를
     * `ended` 안전 카피로 바꾸는 자리(`lib/premiumLovy.ts`)가 이 값만 읽는다.
     */
    tense: lifecycle.tense,
    /**
     * v1.45 PostReview — 러비의 체크포인트가 '상대와 맞춰봐' 문장을 붙일 수 있는지
     * 판단하는 데만 쓴다. 판정·근거·연결에는 영향이 없다.
     */
    allowsOutwardAction,
  };
}
