'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import {
  AiNarrativeNotice,
  AiSourceLabel,
  useNarrativeViewEvent,
} from '@/components/ai/AiModeNotice';
import { CompatibilityAxisNarrative } from '@/components/ai/NarrativeViews';
import { BottomNavigation } from '@/components/common/BottomNavigation';
import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { NoticeBox, SectionLabel } from '@/components/common/primitives';
import { ResultSectionNav } from '@/components/common/ResultSectionNav';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { LovyNote } from '@/components/lovy/LovyNote';
import {
  ReportEvidenceBlock,
  ReportHeader,
  ReportSection,
  ReportSectionEyebrow,
} from '@/components/report/ReportShell';
import { FirstSurprise } from '@/components/compatibility/FirstSurprise';
import { ApproachHintCard } from '@/components/compatibility/ApproachHintCard';
import { SignalCard } from '@/components/compatibility/SignalCard';
import { ConversationCard } from '@/components/compatibility/ConversationCard';
import { SyncScore } from '@/components/compatibility/SyncScore';
import { PastObservationNote } from '@/components/history/PastObservationNote';
import { PremiumEntryRow } from '@/components/premium/PremiumEntryRow';
import { useToast } from '@/components/common/ToastProvider';
import {
  BRAND,
  COMPATIBILITY_COPY,
  LENS_HUB_COPY,
  LOVY_LINES,
  PRIVACY,
  REPORT_COPY,
  STATE_COPY,
} from '@/data/copy';
import {
  selectCompatibilityNote,
  selectFirstSurprise,
  selectResultHeadline,
} from '@/data/lovyNotes';
import { PREMIUM_HOOK_COPY } from '@/data/premium';
import { useAnchorScroll } from '@/hooks/useAnchorScroll';
import { useRevealOnceInScreen } from '@/hooks/useRevealOnce';
import { useScrollRestore } from '@/hooks/useScrollRestore';
import { hasShowableNarrative, narrativeIsShowable } from '@/lib/aiEvidenceResolver';
import { trackEvent, trackOnce, trackOncePerAnalysis } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { formatEntryDate } from '@/lib/historyFormat';
import { lensAvailability } from '@/lib/logic/birth';
import { resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { isRevisit, revisitHref, revisitSource } from '@/lib/resultView';
import { RESULT_ANCHORS, ROUTES } from '@/lib/routes';
import { REFLECTION_QUESTIONS, STAGE_JOB_COPY } from '@/data/stageCopy';
import {
  jobAllowsOutwardQuestions,
  jobAllowsOutwardAction,
  jobInvitesCurrentEvidence,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
import { answeredAxisCount } from '@/lib/logic/relationshipEvidence';
import { premiumFeatureState } from '@/services/premiumService';
import { hasPremiumEvidence } from '@/lib/logic/premiumChapters';
import { soloModeOf } from '@/lib/logic/soloMode';
import {
  useCompatibilityNarrative,
  useCrossSourceInsights,
  useEvidenceContext,
} from '@/hooks/useAiNarrative';
import {
  useApproachHints,
  useCompatibility,
  useConversationQuestions,
  useMbtiLens,
  useMirror,
  usePastObservation,
} from '@/hooks/useAnalysis';
import { useShare } from '@/hooks/useShare';
import { useSession } from '@/state/SessionProvider';

/**
 * Compatibility Result (v1.11 · S21R — 구 S21 Hero + S22 Detail + S23/S24/S25)
 *
 * '우리 둘은 어떻게 맞는가?'라는 하나의 질문에 대한 답을 한 화면 안에서 다 읽을 수 있게
 * 한다. 화면을 줄이는 게 목표가 아니라, 같은 Mental Model에 속하는 결과를 한 맥락에 두는
 * 것이다 — Mirror(다른 Mental Model, '나는 관계에서 어떤 사람인가')는 별도 화면(S27R)으로
 * 남는다.
 *
 * 구 `/compatibility/why`·`/good`·`/friction`·`/questions`는 이 화면의 section으로
 * 흡수됐고, 해당 Route는 `redirect()`로 여기 anchor(`#why`/`#good`/...)로 보낸다.
 *
 * v1.20 — 같은 섹션·같은 anchor·같은 계산을 유지한 채 **상위 framing만** 바꿨다.
 * '분석 결과 카드 모음'이 아니라 러비가 쓴 **하나의 관찰 보고서**로 읽히게 한다:
 * Report Header → 01 SUMMARY → FIRST SURPRISE → 02 METHOD → 03/04 신호 → ....
 * Compatibility Score·4축·tone 판정·Premium·Analytics 정의는 한 줄도 건드리지 않았다.
 */
export default function CompatibilityPage() {
  // v1.11 — CompatibilityView가 Revisit 판정(§11)을 위해 useSearchParams()를 쓴다.
  return (
    <Suspense fallback={null}>
      <HydrationGate>
        <CompatibilityView />
      </HydrationGate>
    </Suspense>
  );
}

function CompatibilityView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { answers, markResultViewed, toggleSavedQuestion } = useSession();
  const { share } = useShare('compatibility');
  const { showToast } = useToast();

  const result = useCompatibility();
  const mbtiLens = useMbtiLens();
  const questions = useConversationQuestions();
  const [today] = useState(() => new Date());

  const revisit = isRevisit(searchParams);
  const source = revisitSource(searchParams);

  const entertainmentReady = lensAvailability(
    answers.birthProfile,
    answers.target.birthProfile,
    today,
  ).couple;

  const narrative = useCompatibilityNarrative();
  useNarrativeViewEvent({
    task: 'compatibility-narrative',
    source: 'compatibility_result',
    status: narrative.status,
    mode: narrative.mode,
    itemCount: narrative.data?.narratives.length ?? 0,
  });

  const topGood = result.goodSignals[0];
  const topFriction = result.frictionSignals[0];
  const restGood = result.goodSignals.slice(1);
  const restFriction = result.frictionSignals.slice(1);
  const pastObservation = usePastObservation(topFriction?.key ?? null);
  const approachHints = useApproachHints();

  /*
    v1.40 §37 — 관계 단계에 따라 **같은 사실을 무엇에 쓰는지**가 달라진다.
    ⚠️ `result`(동기화율·신호·comparedCount)는 이 값을 보지 않는다 — 여기서 하는 일은
    이미 계산된 결과를 감싸는 문구와, 어떤 행동 블록을 그릴지 고르는 것뿐이다.
  */
  const { job } = resolveRelationshipContext(answers);
  /** v1.41 — 근거 시점 요약. Mirror가 계산한 값을 **읽기만** 한다 */
  const mirrorForPremium = useMirror();
  const mirrorScope = mirrorForPremium.scopeSummary;
  /**
   * §2-1-A — Premium 자격 판정이 쓰는 값. **무료 Mirror가 이미 그 축들을 보여줬는지**만
   * 본다(Experience 유무 검사가 아니다) — 보여줬다면 Self-only Chapter가 무료 문장을
   * 다시 파는 셈이므로 그 경로를 열지 않는다.
   */
  const jobCopy = STAGE_JOB_COPY[job];
  const showOutwardAction = jobAllowsOutwardAction(job);
  const showOutwardQuestions = jobAllowsOutwardQuestions(job);
  /** v1.41 §39.6 — S30 권유 대상인가. **판정에는 들어가지 않는다**(화면 분기 전용) */
  const invitesCurrent = jobInvitesCurrentEvidence(job);
  const currentAnsweredCount = answeredAxisCount(answers.currentRelationship);
  /**
   * v1.41 §39.21 — Analytics로 나가는 저카디널리티 시점 값.
   *
   * ⚠️ **Mirror의 `scopeSummary`를 쓴다** — 이 화면이 따로 판정하지 않는다. Mirror가
   * 이미 축별 scope를 계산했고, 두 벌이 되면 화면과 지표가 다른 말을 한다.
   */
  const evidenceScopeParam: 'current' | 'past' | 'mixed' | 'none' = mirrorScope.mixed
    ? 'mixed'
    : (mirrorScope.dominant ?? 'none');
  const reflectionQuestions =
    job === 'ended' ? REFLECTION_QUESTIONS.ended : REFLECTION_QUESTIONS.none;

  const [showAllGood, setShowAllGood] = useState(false);
  const [showAllFriction, setShowAllFriction] = useState(false);
  const [showMoreQuestions, setShowMoreQuestions] = useState(false);
  const [questionTab, setQuestionTab] = useState<'recommended' | 'saved'>('recommended');

  const evidenceContext = useEvidenceContext();
  /** dimensionKey → 화면에 이미 쓰고 있는 축 라벨('개인 시간' 등). 같은 문장이 mock에서
   * 반복돼도 사용자가 '무슨 이야기인지' 구분할 수 있게 각 질문 위에 붙인다. */
  const dimensionLabel = new Map(result.dimensions.map((dimension) => [dimension.key, dimension.label]));
  const aiQuestions = questions.length
    ? (narrative.data?.narratives ?? [])
        .filter((item) => item.conversationQuestion && narrativeIsShowable(item, evidenceContext))
        .map((item) => ({
          key: item.dimensionKey,
          label: dimensionLabel.get(item.dimensionKey) ?? item.dimensionKey,
          text: item.conversationQuestion as string,
        }))
    : [];
  /**
   * GOOD 섹션의 `AI 설명` 배지가 참인지 (v1.28)
   *
   * 배지는 `narrative.mode`만 보고 붙고 있었다. 그런데 이 섹션의 AI 문장은
   * `CompatibilityAxisNarrative`가 **축마다** 판정해서 그린다 — 그 축의 narrative가
   * 없거나 근거를 되살릴 수 없으면(`narrativeIsShowable`) 아무것도 안 그린다.
   * 그래서 Provider가 성공해도 **배지만 남고 본문에는 AI 문장이 없는** 상태가 된다.
   *
   * 판정을 여기서 새로 쓰지 않고 렌더러와 **같은 술어**를 쓴다
   * (`hasShowableNarrative` → `narrativeIsShowable`). 기준이 두 벌이 되면 어긋난다.
   *
   * 접혀 있는 행(`restGood`)은 세지 않는다 — 배지의 뜻이
   * "지금 화면에 AI 설명이 있다"이므로, 펼치기 전에는 아직 없는 게 맞다.
   */
  const shownGoodAxes = new Set(
    [topGood, ...(showAllGood ? restGood : [])].map((dimension) => dimension?.key),
  );
  const goodSectionHasAi = hasShowableNarrative(
    narrative.data?.narratives,
    evidenceContext,
    (item) => shownGoodAxes.has(item.dimensionKey),
  );

  const mbtiQuestionCount = questions.filter((question) => question.fromMbti).length;
  const savedQuestionsList = questions.filter((question) =>
    answers.savedQuestions.includes(question.id),
  );

  const [variant] = useState(() => resolvePriceVariant());
  const crossSourceInsights = useCrossSourceInsights();
  const premiumFeature = premiumFeatureState('relationship_deep_report', resolvePrice(variant), {
    /**
     * §2-1-A — **Experience/Target 유무로 Premium 자격을 막지 않는다.**
     * `hasDeepConnection`만 보면 관계 경험이 없는 사용자는 통과할 방법이
     * 없었다(실측: declared 5축 + Target 4축 + MBTI 양쪽인데도 막혔다).
     */
    deepReportAvailable: hasPremiumEvidence({
      insights: crossSourceInsights,
      declared: answers.declared,
      mirror: mirrorForPremium,
    }),
    /**
     * UT-1 P0-A — 판정 source는 언제나 `soloModeOf` 하나다(§41). 이 화면의 본문은
     * `couple`에서만 열리므로 지금은 항상 false지만, 값을 넘기지 않는 호출부를
     * 남겨두지 않는다 — 그게 v1.40.1 §38.3이 닫은 실패 형태다.
     */
    solo: soloModeOf(answers) === 'no_target',
    // v1.40 §37.9 — 지키지 못할 약속을 목록에서 뺀다(`ended`는 그 섹션을 만들지 않는다).
    allowsOutwardAction: showOutwardAction,
  });

  useAnchorScroll(result.score !== null);

  /*
    v1.46 §26 · §27 — 번호가 붙은 보고서 섹션이 스크롤에 맞춰 **한 번씩** 등장한다.
    대상은 `ReportSection`의 `.reveal-once` 하나뿐이고, 재생은 요소당 1회다.
  */
  useRevealOnceInScreen();

  const funnelAnalysisId = answers.currentAnalysisMeta?.funnelAnalysisId ?? null;

  /**
   * v1.22 §12 — Lens 상세·MBTI 상세를 보고 Back으로 돌아왔을 때 읽던 위치로 되돌린다.
   *
   * 키가 `funnelAnalysisId`라서 **새 상대는 새 키**다. 그리고 궁합 관찰 화면
   * (`/compatibility/analyzing`)이 진입할 때마다 이 키의 저장값을 지우므로, 같은 상대를
   * 다시 분석해도 이전 스크롤 위치를 물려받지 않는다.
   *
   * hash로 들어온 경우(Legacy Redirect `/compatibility/good` → `#good`, Lenses 화면의
   * `backHref`)에는 복원하지 않고 기존 `useAnchorScroll`의 앵커 이동을 그대로 살린다.
   */
  useScrollRestore(
    funnelAnalysisId ? `compat:${funnelAnalysisId}` : null,
    result.score !== null,
  );

  useEffect(() => {
    if (result.score === null) return;
    // Primary KPI 분모 — 세션당 한 번만. Revisit 여부와 무관하게 기존 정책 그대로(§12).
    // v1.11.1 §17~§20 — 실제 0점과 헷갈리지 않게 result_state:'scored'를 항상 함께 남긴다.
    trackOnce('compatibility_result_view', {
      // v1.40 §37.17 — 새 이벤트를 만들지 않고 기존 이벤트에 저카디널리티
      // enum 하나만 더한다. 단계별 결과 열람/전환을 나눠 볼 수 있으면 충분하고,
      // 상대 이름·관계 기간·자유서술은 보내지 않는다.
      relationship_stage: job,
      /**
       * v1.41 §39.21 — **새 이벤트를 만들지 않는다.** 기존 이벤트에 저카디널리티
       * 값 하나만 더한다(v1.40의 `relationship_stage`와 같은 방식).
       *
       * 보내는 것은 `current` / `past` / `mixed` / `none` 네 값뿐이다. 축별 답변,
       * 답한 개수, 어떤 보기를 골랐는지는 **하나도 보내지 않는다** — 그건 관계에
       * 대한 서술이고, 개수는 준식별자에 가까워진다(§26 historyCountBucket과 같은
       * 판단). 우리가 알고 싶은 것은 애초에 '지금 관계 근거가 있는 사용자와 없는
       * 사용자가 결과를 다르게 쓰는가'이고, 그건 이 네 구간으로 충분하다.
       */
      evidence_scope: evidenceScopeParam,
      score: result.score,
      result_state: 'scored',
      compared: result.comparedCount,
    });
    // v1.12 §18~§23 — Analysis Funnel Conversion 분모. Revisit이어도 같은
    // funnelAnalysisId라 재발생하지 않고, 새 상대(새 funnelAnalysisId)마다 다시 발생한다.
    trackOncePerAnalysis('compatibility_analysis_result_view', funnelAnalysisId, {
      score: result.score,
      result_state: 'scored',
    });
  }, [result.score, result.comparedCount, funnelAnalysisId, job, evidenceScopeParam]);

  useEffect(() => {
    if (!mbtiLens) return;
    // v1.24 P3-1 Audit — 예전에는 `{ self: 'INFP', target: 'ESTJ' }`로 **두 사람의 유형
    // 쌍**을 그대로 실어 보냈다. 이 이벤트가 세는 것은 '두 MBTI가 모두 있는가'이므로
    // 유형 값은 지표에 필요 없다. 개수만 남긴다(§35 Analytics Privacy).
    trackOnce('both_mbti_available', {
      same_axes: mbtiLens.sameCount,
      different_axes: mbtiLens.differentCount,
    });
  }, [mbtiLens]);

  useEffect(() => {
    if (result.score === null) return;
    markResultViewed('compatibility');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.score !== null]);

  const revisitFiredRef = useRef(false);
  useEffect(() => {
    // StrictMode 이중 마운트로 중복 발생하지 않게 mount 기준 1회만(§86 패턴과 동일)
    if (!revisit || result.score === null || revisitFiredRef.current) return;
    // ⚠️ `funnelAnalysisId`가 생긴 뒤에 보낸다. React는 자식 effect를 부모보다 먼저
    // 실행하므로, hydration 직후 커밋에서는 `SessionProvider`의 id 발급보다 이 effect가
    // 앞설 수 있다. 아래 ref 가드 때문에 한 번 놓치면 영영 안 붙는다(실측 확인).
    if (!funnelAnalysisId) return;
    revisitFiredRef.current = true;
    // Release Gate §1 — 예전에는 `compatibilityNarrativeFingerprint(...)`를 보냈다.
    // FNV-1a 해시라 평문은 아니지만, 입력 공간(5축 × 소수 값 + score)이 작아서 전수 대조로
    // 되돌릴 수 있는 **답변 파생 지문**이다. 외부 Analytics에는 opaque한 값만 남긴다.
    trackEvent('compatibility_result_revisit', { source, funnel_analysis_id: funnelAnalysisId });
  }, [revisit, source, result.score, funnelAnalysisId]);

  useEffect(() => {
    if (mbtiQuestionCount === 0) return;
    trackEvent('mbti_conversation_question_view', { count: mbtiQuestionCount });
  }, [mbtiQuestionCount]);

  // v1.13 §43 — Secondary 지표(Approach Hint View Rate)용. Primary KPI가 아니므로
  // 다른 세션-단위 지표처럼 엄격히 dedup하지 않는다(§22 mbti_conversation_question_view와
  // 같은 수준). raw interest 텍스트·힌트 문장 원문은 절대 보내지 않는다(§40).
  useEffect(() => {
    trackEvent('approach_hint_view', { hint_count: approachHints.length });
  }, [approachHints.length]);

  if (result.score === null) {
    return <LowConfidenceView />;
  }

  const hasFriction = result.frictionSignals.length > 0;
  const mirrorDone = answers.completed.mirror;

  /*
    v1.20 Report framing — 전부 이미 계산된 `result`에서 **결정론적으로** 파생된다.
    새 계산도, 새 AI 호출도, 랜덤도 없다. 같은 결과면 언제나 같은 문장·같은 번호다.
  */
  const firstSurprise = selectFirstSurprise(result);
  const observationNote = selectCompatibilityNote(result);
  /**
   * v1.23 §3 · §4 — LEVEL 1의 **결과 요약 한 문장.** 점수 바로 아래에 온다.
   * `selectResultHeadline`은 이미 계산된 tone 판정의 라벨만 읽는다(새 계산 0).
   */
  const resultHeadline = selectResultHeadline(result);
  /**
   * v1.22 §20 → v1.23 §6 — 무료에서 보장하는 **심리·철학 Observation** 한 개.
   * friction 섹션의 두 갈래(차이가 있을 때 / 없을 때) 모두에서 신호 목록 직후에 놓고,
   * 라벨을 `LOVY OBSERVATION`으로 바꿔 섹션 끝에 남은 각주가 아니라 **의도된 제품
   * 요소**로 읽히게 한다. 문장은 `data/lovyNotes.ts`에 axis × trigger로 등록된 것을
   * 결정론적으로 고른 값이고, 근거가 없으면(`score === null`) 아예 만들지 않는다.
   */
  const lovyObservationBlock = observationNote ? (
    <LovyNote className="mt-3" label="LOVY OBSERVATION">
      {observationNote.text}
    </LovyNote>
  ) : null;

  /** FIRST SURPRISE CTA가 향하는 곳 — 실제로 화면에 존재하는 첫 신호 섹션 */
  const signalAnchor = topGood
    ? RESULT_ANCHORS.compatibilityGood
    : RESULT_ANCHORS.compatibilityFriction;
  /** ⚠️ 사용자에게 의미 없는 내부 식별자(analysisId·fingerprint)는 넣지 않는다 */
  const reportMeta = [
    `관찰한 신호 ${result.totalCount}개`,
    `비교한 신호 ${result.comparedCount}개`,
    `${formatEntryDate(today.toISOString())} 작성`,
  ];
/**
   * 조건부로 빠지는 섹션이 있어도 번호가 건너뛰지 않도록 렌더되는 것만 센다.
   *
   * v1.23 §2 — 4단계 읽기 구조로 재편했다.
   *   LEVEL 1  01 SUMMARY   (구 `why` 섹션을 여기 근거 줄로 흡수 — §8)
   *   LEVEL 2  02 GOOD · 03 FRICTION
   *   LEVEL 3  04 NOW WHAT  (구 `approach` + `questions` 병합 — §10)
   *   LENSES   05 OTHER LENSES  (Core·Action 뒤로 이동 — §12)
   *
   * ⚠️ **anchor id는 7개 전부 그대로 유지한다**(`#summary` `#why` `#good` `#friction`
   * `#lenses` `#approach` `#questions`) — Legacy Redirect(`/compatibility/why` 등)와
   * `ResultSectionNav`·Home 카드가 이 id로만 이동하고, `result_anchor_navigation`
   * 이벤트도 이 값을 그대로 쓴다. 섹션 **번호**만 줄었다.
   */
  const sectionNo = (() => {
    let n = 0;
    const take = () => String((n += 1)).padStart(2, '0');
    return {
      summary: take(),
      good: topGood ? take() : null,
      friction: take(),
      nowWhat: take(),
      lenses: take(),
    };
  })();

  return (
    <ScreenLayout
      header={
        <ScreenHeader
          backHref={revisit ? ROUTES.home : ROUTES.target}
          title={revisit ? '최근 궁합 결과' : undefined}
          action={
            <button
              type="button"
              onClick={() => router.push(ROUTES.shareCompatibility)}
              className="flex h-11 items-center px-1 text-caption text-ink-sub"
            >
              공유
            </button>
          }
        />
      }
      footer={
        <div className="flex flex-col gap-2">
          {revisit && mirrorDone ? (
            <Button onClick={() => router.push(revisitHref(ROUTES.mirror, 'direct'))}>
              Relationship Mirror 다시 보기
            </Button>
          ) : (
            <Button
              onClick={() => {
                trackEvent('relationship_mirror_postpone', { from: 'compatibility_result_skip' });
                router.push(ROUTES.mirrorTeaser);
              }}
            >
              다음 관찰 보기
            </Button>
          )}
        </div>
      }
      nav={revisit ? <BottomNavigation /> : undefined}
      bodyClassName="pt-1.5 pb-4"
    >
      <ReportHeader title={REPORT_COPY.compatibilityTitle} meta={reportMeta} />

      {/*
        ══ LEVEL 1 · 첫 5초 (v1.23 §3) ══════════════════════════════════════════
        '그래서 우리 관계는 어떤데?'의 답이 첫 viewport 안에서 끝나야 한다.
        예전에는 이 자리에 점수 + **면책 문장 3개**만 있었고("연애 성공확률이 아니야" ·
        "비교 가능한 N개 신호 기준" · "숫자는 그냥 요약이야"), 결과를 요약하는 문장이
        아예 없어서 답에 도달하려면 1.5화면을 스크롤해야 했다(실측 903px).

        지금 순서: 점수 → **결과 한 문장** → 면책 → 근거(구 METHOD 흡수) → 러비의 의문 + YOUR SIGNAL
      */}
      <div id={RESULT_ANCHORS.compatibilitySummary} className="mt-5 flex flex-col gap-3.5">
        <ReportSectionEyebrow
          index={sectionNo.summary}
          code={REPORT_COPY.sections.summary.code}
        />

        <SyncScore score={result.score} />

        {/* §4 — 결과 요약 한 문장. 이미 계산된 tone 판정에서 결정론적으로 파생된다 */}
        {resultHeadline ? (
          <p className="px-1 text-[17px] font-semibold leading-[1.5] tracking-[-0.3px] keep-all">
            {resultHeadline}
          </p>
        ) : null}

        {/*
          §8 — 구 `02 METHOD` 섹션을 여기로 흡수했다. 그 섹션은 145px을 쓰면서
          "비교 가능한 N개 신호를 기준으로 계산했어"만 말했고, 바로 위 SUMMARY의
          "비교 가능한 N개 관계 신호 기준"과 **같은 문장**이었다. 같은 사실을 두 섹션에
          나눠 적을 이유가 없다.
          ⚠️ `#why` anchor는 여기 유지한다 — Legacy Redirect(`/compatibility/why`)와
          `ResultSectionNav` 칩이 이 id로 이동한다.
        */}
        <div id={RESULT_ANCHORS.compatibilityWhy} className="scroll-mt-3">
          <ReportEvidenceBlock>
            비교 가능한 {result.comparedCount}개 관계 신호로 계산했어.
            {result.unknownLabels.length > 0
              ? ` 모름으로 남긴 ${result.unknownLabels.length}개(${result.unknownLabels.join(' · ')})는 계산에서 빼뒀어.`
              : ''}{' '}
            항목별 근거는 아래 신호에서 볼 수 있어.
          </ReportEvidenceBlock>
        </div>

        {/*
          v1.40 §37.8 — 점수를 **무엇에 쓰라는** 한 줄. 점수 자체는 단계와 무관하게 같고,
          이 문장만 단계에 따라 달라진다. Hook(숫자)을 약화하지 않기 위해 점수와 결과
          한 문장 **뒤**에 둔다 — 기대한 것을 먼저 주고 그 다음에 다르게 해석한다.
        */}
        <p className="px-1 text-caption keep-all leading-relaxed text-ink-sub">
          {jobCopy.scoreUse}
        </p>
      </div>

      <div className="flex flex-col pt-1">
        {/*
          FIRST SURPRISE (§5) — 점수를 이해한 **직후**, 근거를 읽기 전.
          구조는 `점수 → 러비의 의문 → 실제 사용자 Signal`이고, 이 순서를 유지한다.
          Premium 광고가 아니다. CTA는 무료 본문(첫 신호 섹션)으로만 내려간다.
          score===null(E3)은 위에서 LowConfidenceView로 빠지므로 여기 오지 않는다.
        */}
        {firstSurprise ? (
          <div className="pt-4">
            <FirstSurprise
              surprise={firstSurprise}
              ctaHref={`#${signalAnchor}`}
              ctaSection={signalAnchor}
              funnelAnalysisId={funnelAnalysisId}
            />
          </div>
        ) : null}

        {/*
          §18 — Section Navigator를 FIRST SURPRISE **뒤로** 내렸다. 점수 바로 아래에 두면
          72px(2줄)을 차지해 LEVEL 1의 결과 묶음을 첫 viewport 밖으로 밀어낸다.
          라벨은 4단계 Mental Model에 맞춰 다시 썼고, anchor id와 이벤트는 그대로다.
        */}
        <div className="pt-5">
          <ResultSectionNav
            event="result_anchor_navigation"
            items={[
              { id: RESULT_ANCHORS.compatibilityGood, label: '잘 맞는 신호' },
              { id: RESULT_ANCHORS.compatibilityFriction, label: '확인할 신호' },
              { id: RESULT_ANCHORS.compatibilityApproach, label: '뭘 해볼까' },
              { id: RESULT_ANCHORS.compatibilityQuestions, label: '질문' },
              { id: RESULT_ANCHORS.compatibilityLenses, label: '다른 렌즈' },
            ]}
          />
        </div>

        {topGood ? (
          <ReportSection
            id={RESULT_ANCHORS.compatibilityGood}
            index={sectionNo.good ?? sectionNo.friction}
            code={REPORT_COPY.sections.good.code}
            title={REPORT_COPY.sections.good.title}
            action={<AiSourceLabel mode={narrative.mode} hasNarrative={goodSectionHasAi} />}
          >
            <ul className="flex flex-col gap-2.5">
              <SignalCard
                dimension={topGood}
                variant="good"
                footer={
                  <CompatibilityAxisNarrative
                    axis={topGood.key}
                    narratives={narrative.data?.narratives}
                    status={narrative.status}
                  />
                }
              />
              {/*
                §9 — 같은 규격 카드를 여러 개 쌓지 않는다. 대표 신호 1개만 카드로 두고
                나머지는 `density="compact"`(테두리 없는 divider 행 + 한 단계 낮은
                typography)로 펼친다. **정보를 빼는 게 아니라 위계를 만드는 것이다** —
                상황·근거·AI 설명은 그대로 붙어 있다.
              */}
              {showAllGood
                ? restGood.map((dimension) => (
                    <SignalCard
                      key={dimension.key}
                      dimension={dimension}
                      variant="good"
                      density="compact"
                      footer={
                        <CompatibilityAxisNarrative
                          axis={dimension.key}
                          narratives={narrative.data?.narratives}
                          status={narrative.status}
                        />
                      }
                    />
                  ))
                : null}
            </ul>
            {restGood.length > 0 ? (
              <button
                type="button"
                aria-expanded={showAllGood}
                onClick={() => {
                  const next = !showAllGood;
                  setShowAllGood(next);
                  if (next) trackEvent('result_section_expand', { section: 'good' });
                }}
                className="flex min-h-11 items-center justify-center text-meta font-medium text-brand-pressed"
              >
                {showAllGood ? '접기' : `${restGood.length}개 더 보기`}
              </button>
            ) : null}
          </ReportSection>
        ) : null}

        <ReportSection
          id={RESULT_ANCHORS.compatibilityFriction}
          index={sectionNo.friction}
          code={REPORT_COPY.sections.friction.code}
          title={REPORT_COPY.sections.friction.title}
          caption={LOVY_LINES.friction}
        >
          {hasFriction && topFriction ? (
            <>
              <ul className="flex flex-col gap-2.5">
                <SignalCard
                  dimension={topFriction}
                  variant="friction"
                  footer={
                    <CompatibilityAxisNarrative
                      axis={topFriction.key}
                      narratives={narrative.data?.narratives}
                      status={narrative.status}
                    />
                  }
                />
                {showAllFriction
                  ? restFriction.map((dimension) => (
                      <SignalCard
                        key={dimension.key}
                        dimension={dimension}
                        variant="friction"
                        density="compact"
                        footer={
                          <CompatibilityAxisNarrative
                            axis={dimension.key}
                            narratives={narrative.data?.narratives}
                            status={narrative.status}
                          />
                        }
                      />
                    ))
                  : null}
              </ul>

              {lovyObservationBlock}

              {restFriction.length > 0 ? (
                <button
                  type="button"
                  aria-expanded={showAllFriction}
                  onClick={() => {
                    const next = !showAllFriction;
                    setShowAllFriction(next);
                    if (next) trackEvent('result_section_expand', { section: 'friction' });
                  }}
                  className="flex min-h-11 items-center justify-center text-meta font-medium text-brand-pressed"
                >
                  {showAllFriction ? '접기' : `${restFriction.length}개 더 보기`}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <p className="px-1 text-caption keep-all leading-relaxed text-ink-sub">
                지금 입력으로는 큰 차이를 못 찾았어. 차이가 없다는 결론은 아니야 — 아직 내가
                못 본 것일 수도 있어.
              </p>
              {lovyObservationBlock}
            </>
          )}

        </ReportSection>

        {/*
          v1.15 §4 Hook A — Friction 신호를 본 직후, '이 차이가 실제로는 어떻게 나타날까'라는
          궁금증이 생기는 지점에만 둔다. Friction이 없으면 이 궁금증 자체가 없으므로 만들지
          않는다(기존처럼 화면 맨 아래에 일반 Entry를 두지 않는다 — §4 "모든 섹션마다
          Paywall을 만들지 않는다"). Score Hero 바로 아래가 아니라 Friction을 다 본 다음이다.
        */}
        {hasFriction && topFriction ? (
          <div className="mt-6">
          <PremiumEntryRow
            feature={premiumFeature}
            source="compatibility"
            hook={{
              variant: 'friction_why',
              title: PREMIUM_HOOK_COPY.friction_why.title,
              // v1.26 — 이 축이 다른 관찰과 이어지는지를 약속한다(제거된 상황 섹션 대신).
              description: `${topFriction.label}에서 보이는 이 차이가, 네가 따로 답했던 관계 경험·과거 관찰과 같은 축을 가리키는지 이어서 볼 수 있어.`,
              cta: PREMIUM_HOOK_COPY.friction_why.cta,
            }}
          />
          </div>
        ) : null}

        {/* 번호를 붙이지 않는 보조 블록 — 모든 것을 같은 크기의 섹션으로 만들지 않는다 */}
        {pastObservation ? (
          <section className="mt-6 flex flex-col gap-2.5">
            <SectionLabel>{REPORT_COPY.pastLabel}</SectionLabel>
            <PastObservationNote text={pastObservation.text} />
          </section>
        ) : null}

        {/*
          ══ LEVEL 3 · '그래서 뭘 해볼까' (v1.23 §10) ═════════════════════════════
          구 `06 APPROACH`와 `07 NEXT QUESTION`을 하나의 섹션으로 묶었다. 둘은 같은
          Mental Model인데 별개 기능처럼 보였고, 375px 실측에서 합쳐 1,492px —
          전체 4,307px의 35%를 균일 카드 나열로 쓰고 있었다.

          ⚠️ **계산·저장 로직은 하나도 건드리지 않았다.** `useApproachHints()`·
          `useConversationQuestions()`·`toggleSavedQuestion`·`savedQuestions` 전부 그대로다.
          ⚠️ `#approach`·`#questions` anchor를 각 서브블록에 유지한다 — Legacy Redirect
          (`/compatibility/questions`)와 nav 칩·`approach_hint_question_click`의
          내부 링크가 이 id로 이동한다.
        */}
        <ReportSection
          index={sectionNo.nowWhat}
          code={REPORT_COPY.sections.nowWhat.code}
          /* v1.40 — 제목·캡션이 단계별 Job을 따른다(확인 / 조율 / 회고). 섹션 코드와
             anchor id는 그대로다 — Legacy Redirect와 nav 칩이 이 id로 이동한다. */
          title={jobCopy.nowWhatTitle}
          caption={jobCopy.nowWhatCaption}
        >
          {/* 04-a — 행동 */}
          <div
            id={RESULT_ANCHORS.compatibilityApproach}
            className="flex flex-col gap-2.5 scroll-mt-3"
          >
            <SectionLabel as="h3">{jobCopy.actionLabel}</SectionLabel>
            {!showOutwardAction ? (
              /*
                v1.40 §37.9 — 관계가 끝난 사용자에게 **상대를 향한 행동을 제안하지 않는다.**
                '다가갈 때'·'같이 해볼 것'·'먼저 물어볼 것'은 전부 진전을 전제하는 행동이고,
                여기서는 그 전제가 사실이 아니다. 그래서 카드마다 조건을 붙이지 않고
                `jobAllowsOutwardAction()` 한 곳에서 블록 자체를 바꾼다.
                ⚠️ '더 분석해보기' 같은 연쇄 CTA를 두지 않는다 — 회고는 한 번 정리하고 닫는다.
              */
              <div className="flex flex-col gap-2 rounded-card border border-dashed border-line-strong bg-canvas-warm p-4">
                <p className="text-caption keep-all leading-relaxed text-ink-sub">
                  {job === 'ended'
                    ? '이 관계에서 뭘 해볼지는 이제 내가 말할 자리가 아닌 것 같아. 대신 네 기준에 뭐가 남았는지 아래에서 같이 보자.'
                    : '아직 특정한 상대가 없으니 상대에 맞춘 행동은 만들지 않았어. 대신 네 기준을 아래에서 같이 보자.'}
                </p>
                <a
                  href={`#${RESULT_ANCHORS.compatibilityQuestions}`}
                  className="inline-flex min-h-11 items-center self-start text-[12.5px] font-medium text-brand-pressed"
                >
                  {jobCopy.questionLabel} 보러 가기 →
                </a>
              </div>
            ) : approachHints.length > 0 ? (
              <ul className="flex flex-col gap-2.5">
                {approachHints.map((hint, index) => (
                  <ApproachHintCard
                    key={hint.id}
                    hint={hint}
                    target={answers.target}
                    /* §9 — 첫 힌트만 카드. 나머지는 divider 행으로 위계를 낮춘다 */
                    density={index === 0 ? 'primary' : 'compact'}
                    onExpand={() => trackEvent('approach_hint_expand', { kind: hint.kind })}
                  />
                ))}
              </ul>
            ) : (
              <div className="flex flex-col gap-2 rounded-card border border-dashed border-line-strong bg-canvas-warm p-4">
                <p className="text-caption keep-all leading-relaxed text-ink-sub">
                  아직 이 사람이 좋아하는 걸 많이 알진 못하네.
                </p>
                <a
                  href={`#${RESULT_ANCHORS.compatibilityQuestions}`}
                  onClick={() => trackEvent('approach_hint_question_click', {})}
                  className="inline-flex min-h-11 items-center self-start text-[12.5px] font-medium text-brand-pressed"
                >
                  이야기해볼 질문 보러 가기 →
                </a>
              </div>
            )}

            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] keep-all text-ink-faint">
                {showOutwardAction
                  ? '이건 공략법은 아니야. 실제론 직접 물어보는 게 가장 정확해.'
                  : /* v1.40 — '되돌리는 방법이 아니야'였다. 부정문이라도 되돌린다는 어휘를
                       화면에 올리면 그 선택지를 떠올리게 한다. Ended Safety 검사도 그
                       어휘를 통째로 금지한다. */
                    '여기서 관계를 어떻게 할지는 말하지 않아. 네 기준을 정리하는 데만 써.'}
              </p>
              {/* v1.13 §36 — 상대 정보는 틀릴 수 있다. resetTargetContext()를 쓰지 않는다 —
                  그건 새 상대용이고, 여기는 지금 값을 그대로 고치는 것이다. */}
              <button
                type="button"
                onClick={() => router.push(ROUTES.target)}
                /* v1.36 A11y — 히트 영역만 44px. 글자 크기는 그대로 둔다(§12.1) */
                className="flex min-h-11 flex-none items-center text-[11px] font-medium text-brand-pressed"
              >
                상대 정보 수정
              </button>
            </div>
          </div>

          {/* 04-b — 대화 */}
          <div
            id={RESULT_ANCHORS.compatibilityQuestions}
            className="mt-7 flex flex-col gap-2.5 scroll-mt-3"
          >
            <SectionLabel as="h3">{jobCopy.questionLabel}</SectionLabel>
            <div className="flex gap-1.5 rounded-chip bg-sunken p-1" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={questionTab === 'recommended'}
                onClick={() => setQuestionTab('recommended')}
                className={cn(
                  'min-h-11 flex-1 rounded-[9px] text-caption font-medium transition-colors duration-200',
                  questionTab === 'recommended'
                    ? 'bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-ink-muted',
                )}
              >
                추천 질문
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={questionTab === 'saved'}
                onClick={() => {
                  setQuestionTab('saved');
                  trackEvent('saved_question_view', { count: savedQuestionsList.length });
                }}
                className={cn(
                  'min-h-11 flex-1 rounded-[9px] text-caption font-medium transition-colors duration-200',
                  questionTab === 'saved'
                    ? 'bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-ink-muted',
                )}
              >
                저장한 질문{savedQuestionsList.length > 0 ? ` ${savedQuestionsList.length}` : ''}
              </button>
            </div>

            {questionTab === 'recommended' && !showOutwardQuestions ? (
              /*
                v1.40 §37.12 — `ended`/`none`에서는 **주어가 나인 회고 질문**을 준다.
                상대에게 연락하게 만드는 질문을 추천하지 않는다(`jobAllowsOutwardQuestions`).
                ⚠️ 원인을 캐거나 후회를 유도하지 않는다. 3개로 닫고, '더 분석하기'를 붙이지
                않는다 — 회고는 한 번 정리하는 것이고 반추 루프를 만들지 않는다(§37.13).
                ⚠️ 저장 기능을 붙이지 않았다. 이 질문들은 세션 데이터에서 생성된 항목이 아니라
                고정 문구이고, `savedQuestions`(id 기반)에 섞으면 저장 목록의 의미가 깨진다.
              */
              <div className="flex flex-col gap-2.5">
                <ul className="flex flex-col gap-2">
                  {reflectionQuestions.map((question) => (
                    <li
                      key={question}
                      className="border-t border-line pt-2.5 text-[14px] keep-all leading-relaxed text-ink first:border-t-0 first:pt-0"
                    >
                      {question}
                    </li>
                  ))}
                </ul>
                <p className="px-1 text-[11px] keep-all leading-relaxed text-ink-faint">
                  답을 지금 정리하지 않아도 괜찮아. 떠오른 게 있으면 관찰 기록에 남겨두면 돼.
                </p>
              </div>
            ) : questionTab === 'recommended' ? (
              <>
                <ul className="flex flex-col gap-2.5">
                  {(showMoreQuestions ? questions : questions.slice(0, 3)).map((question) => (
                    <ConversationCard
                      key={question.id}
                      question={question}
                      saved={answers.savedQuestions.includes(question.id)}
                      onToggleSave={() => {
                        const saved = toggleSavedQuestion(question.id);
                        if (saved) trackEvent('conversation_question_save', { question: question.id });
                        showToast(saved ? '질문을 저장했어' : '저장을 해제했어');
                      }}
                      onShare={async () => {
                        trackEvent('conversation_question_share', { question: question.id });
                        const outcome = await share({
                          title: `${BRAND.name} · 이야기해볼 질문`,
                          text: question.text,
                        });
                        showToast(
                          outcome === 'copied'
                            ? '질문을 클립보드에 복사했어'
                            : outcome === 'shared'
                              ? '공유했어'
                              : outcome === 'cancelled'
                                ? '공유를 취소했어'
                                : '이 브라우저에서는 공유를 지원하지 않아',
                          outcome === 'unsupported' ? 'warning' : 'default',
                        );
                      }}
                    />
                  ))}
                </ul>

                {questions.length > 3 && !showMoreQuestions ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreQuestions(true);
                      trackEvent('result_section_expand', { section: 'questions' });
                    }}
                    className="flex min-h-11 items-center justify-center text-meta font-medium text-brand-pressed"
                  >
                    질문 더 보기
                  </button>
                ) : null}

                {aiQuestions.length > 0 ? (
                  <section className="flex flex-col gap-2.5">
                    <SectionLabel className="flex items-center gap-1.5">
                      러비가 덧붙인 질문
                      {/* 이 블록 자체가 aiQuestions.length > 0일 때만 렌더된다 */}
                      <AiSourceLabel mode={narrative.mode} hasNarrative />
                    </SectionLabel>
                    <ul className="flex flex-col gap-2">
                      {aiQuestions.map((item) => (
                        <li
                          key={item.key}
                          className="flex flex-col gap-1 rounded-row border border-line bg-surface px-4 py-3.5"
                        >
                          <span className="text-[10.5px] font-semibold tracking-[0.04em] text-brand-pressed">
                            {item.label}
                          </span>
                          <span className="text-caption keep-all leading-relaxed">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            ) : savedQuestionsList.length > 0 ? (
              <ul className="flex flex-col gap-2.5">
                {savedQuestionsList.map((question) => (
                  <ConversationCard
                    key={question.id}
                    question={question}
                    saved
                    onToggleSave={() => {
                      toggleSavedQuestion(question.id);
                      showToast('저장을 해제했어');
                    }}
                    onShare={async () => {
                      trackEvent('conversation_question_share', { question: question.id });
                      const outcome = await share({
                        title: `${BRAND.name} · 이야기해볼 질문`,
                        text: question.text,
                      });
                      showToast(
                        outcome === 'copied'
                          ? '질문을 클립보드에 복사했어'
                          : outcome === 'shared'
                            ? '공유했어'
                            : outcome === 'cancelled'
                              ? '공유를 취소했어'
                              : '이 브라우저에서는 공유를 지원하지 않아',
                        outcome === 'unsupported' ? 'warning' : 'default',
                      );
                    }}
                  />
                ))}
              </ul>
            ) : (
              <div className="flex flex-col gap-2.5 rounded-card border border-dashed border-line-strong bg-canvas-warm p-4 text-center">
                <p className="text-caption keep-all leading-relaxed text-ink-sub">
                  아직 저장한 질문이 없어. 궁합 결과에서 이야기해볼 질문을 저장해두면 여기에서
                  다시 볼 수 있어.
                </p>
                <button
                  type="button"
                  onClick={() => setQuestionTab('recommended')}
                  className="flex min-h-11 items-center justify-center text-meta font-medium text-brand-pressed"
                >
                  질문 보러 가기
                </button>
              </div>
            )}
          </div>

          {/*
            04-c — 지금 관계 근거 보강 (v1.41 §39.6)

            ⚠️ **이 화면의 유일한 진입점이고, 카드가 아니라 한 줄이다.**
            §39.10이 정한 규칙 그대로다 — 새 카드를 만들지 않고 annotation·링크로만
            얹는다. 결과 화면의 주인공은 여전히 판정이고, 이건 그 판정을 더 정확하게
            만들 수 있다는 안내다.

            ⚠️ `dating`·`long_term`에만 보인다(`jobInvitesCurrentEvidence`). `talking`
            에게 '지금 관계'라고 부르는 것은 관계를 확정하는 셈이고, `ended`에게는
            끝난 관계를 다시 관찰하게 만드는 것이다.

            ⚠️ 이미 다 답한 사용자에게는 **권유가 아니라 수정 링크**로 바뀐다. 같은
            줄이 계속 '알려줄래?'라고 물으면 답한 것이 반영되지 않은 것처럼 읽힌다.
          */}
          {invitesCurrent ? (
            <div className="mt-7 flex flex-col gap-2 rounded-card border border-dashed border-line-strong bg-canvas-warm p-4">
              <p className="text-caption keep-all leading-relaxed text-ink-sub">
                {currentAnsweredCount === 0
                  ? '위 해석은 네가 이전 관계에서 답한 내용을 근거로 했어. 지금 관계에서는 어떤지 알려주면 그 항목은 지금 기준으로 다시 볼게.'
                  : `지금 관계 기준으로 답한 항목이 ${currentAnsweredCount}개 있어. 언제든 고치거나 더 답할 수 있어.`}
              </p>
              <Link
                href={ROUTES.currentRelationship()}
                className="inline-flex min-h-11 items-center self-start text-[12.5px] font-medium text-brand-pressed"
              >
                {currentAnsweredCount === 0
                  ? '지금 관계에서의 나 알려주기 →'
                  : '지금 관계 답변 고치기 →'}
              </Link>
            </div>
          ) : null}
        </ReportSection>

        <ReportSection
          id={RESULT_ANCHORS.compatibilityLenses}
          index={sectionNo.lenses}
          code={REPORT_COPY.sections.lenses.code}
          title={REPORT_COPY.sections.lenses.title}
          caption={LENS_HUB_COPY.caption}
        >
          {/*
            v1.23 §12 · §13 — **editorial index로 바꿨다.**
            예전에는 이 섹션이 `MbtiLensPanel`(나/상대 2단 카드 + mint 안내박스 + 통계 줄) +
            큰 행 버튼 2개로 구성돼 **510px**을 썼다. 같은 화면의 Core 신호 섹션(잘 맞는 신호
            427px)보다 커서, 참고 렌즈가 실제 관계 신호보다 신뢰도 높아 보였다(§12 위반).

            지금은 1px divider 목록이다 — 각 행이 렌즈 이름 · 현재 상태 · 한 줄 요약만 갖고,
            상세는 원래 상세 화면(`/lens/mbti`, `/compatibility/lenses`)에서 본다.
            **콘텐츠를 깎아내리는 문구는 쓰지 않는다**(§12) — '재미일 뿐' 같은 표현 없이
            위계만 낮춘다.
            ⚠️ `useMbtiLens()` 호출과 `both_mbti_available` 이벤트는 그대로다.
          */}
          <ul className="flex flex-col">
            {mbtiLens ? (
              <li>
                <button
                  type="button"
                  onClick={() => router.push(ROUTES.lensMbti)}
                  className="flex w-full min-h-11 items-center gap-3 border-t border-line-soft py-3.5 text-left active:bg-sunken"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sub font-semibold">MBTI</span>
                      <span className="text-[11px] font-medium tracking-[0.02em] text-brand-pressed">
                        {mbtiLens.mine} × {mbtiLens.theirs}
                      </span>
                    </span>
                    {/* v1.24 P3-1 — 이 렌즈는 이제 네 축 비교에서 끝나지 않고 실제 관계
                        답변과 나란히 놓는 데까지 간다. 행이 약속하는 내용을 맞춘다(§32). */}
                    <span className="mt-0.5 block text-[11.5px] keep-all text-ink-muted">
                      4개 축 중 {mbtiLens.sameCount}개 비슷 · {mbtiLens.differentCount}개 다름 ·
                      네가 답한 관계 신호와 비교해보기
                    </span>
                  </span>
                  <span className="flex-none text-ink-faint" aria-hidden>
                    →
                  </span>
                </button>
              </li>
            ) : null}

            <li>
              <button
                type="button"
                onClick={() => router.push(ROUTES.compatibilityLenses)}
                className="flex w-full min-h-11 items-center gap-3 border-t border-line-soft py-3.5 text-left active:bg-sunken"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-sub font-semibold">사주 · 별자리</span>
                  <span className="mt-0.5 block text-[11.5px] keep-all text-ink-muted">
                    {entertainmentReady
                      ? '두 사람의 출생정보로 겹쳐볼 수 있어'
                      : '출생정보를 넣으면 겹쳐볼 수 있어'}
                  </span>
                </span>
                <span className="flex-none text-ink-faint" aria-hidden>
                  →
                </span>
              </button>
            </li>
          </ul>
        </ReportSection>

        <div className="mt-6 flex flex-col gap-2.5">
          <AiNarrativeNotice
            task="compatibility-narrative"
            status={narrative.status}
            reason={narrative.reason}
          />
          <NoticeBox>{PRIVACY.unknownExcluded}</NoticeBox>
        </div>
      </div>
    </ScreenLayout>
  );
}

/** E3 상대 정보 부족 · 관측 정보 부족 */
function LowConfidenceView() {
  const router = useRouter();
  const result = useCompatibility();
  const { answers } = useSession();
  const funnelAnalysisId = answers.currentAnalysisMeta?.funnelAnalysisId ?? null;
  // v1.13 — interests는 comparedCount에 들어가지 않아서(§11), E3(확신 낮음)이어도
  // '좋아하는 것'만 알고 있으면 활동 힌트는 만들 수 있다. friction 힌트(§24)는
  // score===null이라 frictionSignals가 비어 있으므로 자연히 만들어지지 않는다.
  const approachHints = useApproachHints();
  /*
    v1.40 §37.9 — E3에서도 같은 안전 규칙을 적용한다. 상대 정보가 부족한 상태(E3)와
    관계가 끝난 상태는 겹칠 수 있고, 그때 '이 사람에게 다가갈 때'가 그대로 뜨면
    본문과 같은 결함이 E3 화면에만 남는다.
  */
  const { job: lowDataJob } = resolveRelationshipContext(answers);
  const showLowDataAction = jobAllowsOutwardAction(lowDataJob);

  useEffect(() => {
    // v1.11.1 §17~§20 — E3(확신 낮음)는 '0점'이 아니라 '계산 자체가 불가능한 상태'다.
    // 0으로 기록하면 실제 0점(4축 모두 최대 차이)과 Analytics에서 구분할 수 없다.
    trackOnce('compatibility_result_view', {
      relationship_stage: lowDataJob,
      score: null,
      result_state: 'insufficient',
      compared: result.comparedCount,
    });
    // v1.12 §18~§23 — 기존 정책 그대로 E3도 Analysis Funnel 분모에 포함한다.
    trackOncePerAnalysis('compatibility_analysis_result_view', funnelAnalysisId, {
      score: null,
      result_state: 'insufficient',
    });
  }, [result.comparedCount, funnelAnalysisId, lowDataJob]);

  useEffect(() => {
    if (approachHints.length === 0) return;
    trackEvent('approach_hint_view', { hint_count: approachHints.length });
  }, [approachHints.length]);

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.target} title="궁합 결과" />}
      footer={
        <div className="flex flex-col gap-0.5">
          <Button onClick={() => router.push(ROUTES.target)}>아는 것만 더 알려주기</Button>
          {/*
            v1.29 P4 — 예전에는 `/mirror/teaser`로 보냈다. 그런데 연애 경험이 없는
            사용자는 Mirror가 통째로 비어서(`experience.skipped` → `available: false`)
            "비교하긴 어려워"만 보고 홈으로 밀려났다 — **탈출구가 막힌 길이었다.**
            First Contact Report는 내 기준만으로 만들어지므로 이 사용자에게도 남는다.
          */}
          <Button variant="text" onClick={() => router.push(ROUTES.firstContact)}>
            내 기준부터 관찰하기
          </Button>
        </div>
      }
      bodyClassName="pt-2 pb-4"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-1.5 pt-3.5 pb-1">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted">
            {COMPATIBILITY_COPY.scoreLabel}
          </p>
          <p className="text-[74px] font-semibold leading-none tracking-[-3px] text-ink-faint">?</p>
          <p className="mt-1.5 rounded-[7px] bg-friction-tint px-2.5 py-1.5 text-[11px] font-semibold text-friction-text">
            관측 정보 부족 · 입력 {result.comparedCount}/{result.totalCount}
          </p>
        </div>

        <LovyMessage pose={STATE_COPY.lowConfidence.pose} size={70} tone="lead">
          {STATE_COPY.lowConfidence.message}
        </LovyMessage>

        <div className="flex flex-col gap-3 rounded-[16px] border border-line bg-surface p-4">
          <h2 className="text-caption font-semibold">비교하지 못한 항목</h2>
          <ul className="flex flex-wrap gap-1.5">
            {result.unknownLabels.map((label) => (
              <li
                key={label}
                className="rounded-tag border border-dashed border-line-strong bg-sunken px-2.5 py-1.5 text-[12.5px] text-ink-muted"
              >
                {label}
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] leading-relaxed keep-all text-ink-sub">
            {Math.max(1, 3 - result.comparedCount)}개 이상 더 알려주면 동기화율을 계산할 수 있어.
          </p>
        </div>

        {showLowDataAction && approachHints.length > 0 ? (
          <section id={RESULT_ANCHORS.compatibilityApproach} className="flex flex-col gap-2.5">
            <SectionLabel>{STAGE_JOB_COPY[lowDataJob].actionLabel}</SectionLabel>
            <p className="px-1 text-caption keep-all leading-relaxed text-ink-sub">
              동기화율은 아직 못 냈지만, 네가 알려준 것만으로도 생각해볼 게 있어.
            </p>
            <ul className="flex flex-col gap-2.5">
              {approachHints.map((hint) => (
                <ApproachHintCard
                  key={hint.id}
                  hint={hint}
                  target={answers.target}
                  onExpand={() => trackEvent('approach_hint_expand', { kind: hint.kind })}
                />
              ))}
            </ul>
            <p className="px-1 text-[11px] keep-all text-ink-faint">
              이건 공략법은 아니야. 실제론 직접 물어보는 게 가장 정확해.
            </p>
          </section>
        ) : null}
      </div>
    </ScreenLayout>
  );
}
