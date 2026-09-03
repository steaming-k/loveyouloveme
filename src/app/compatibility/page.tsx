'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import {
  AiNarrativeNotice,
  AiSourceLabel,
  useNarrativeViewEvent,
} from '@/components/ai/AiModeNotice';
import { CompatibilityAxisNarrative } from '@/components/ai/NarrativeViews';
import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { NoticeBox, SectionLabel } from '@/components/common/primitives';
import { ResultSectionNav } from '@/components/common/ResultSectionNav';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { ApproachHintCard } from '@/components/compatibility/ApproachHintCard';
import { MbtiLensPanel } from '@/components/compatibility/MbtiLensPanel';
import { SignalCard } from '@/components/compatibility/SignalCard';
import { ConversationCard } from '@/components/compatibility/ConversationCard';
import { SyncScore } from '@/components/compatibility/SyncScore';
import { PastObservationNote } from '@/components/history/PastObservationNote';
import { PremiumEntryRow } from '@/components/premium/PremiumEntryRow';
import { useToast } from '@/components/common/ToastProvider';
import { BRAND, COMPATIBILITY_COPY, LOVY_LINES, PRIVACY, STATE_COPY } from '@/data/copy';
import { PREMIUM_HOOK_COPY } from '@/data/premium';
import { useAnchorScroll } from '@/hooks/useAnchorScroll';
import { narrativeIsShowable } from '@/lib/aiEvidenceResolver';
import { compatibilityNarrativeFingerprint } from '@/lib/aiFingerprint';
import { trackEvent, trackOnce, trackOncePerAnalysis } from '@/lib/analytics';
import { lensAvailability } from '@/lib/logic/birth';
import { resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { isRevisit, revisitHref, revisitSource } from '@/lib/resultView';
import { RESULT_ANCHORS, ROUTES } from '@/lib/routes';
import { premiumFeatureState } from '@/services/premiumService';
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

  const [showAllGood, setShowAllGood] = useState(false);
  const [showAllFriction, setShowAllFriction] = useState(false);
  const [showMoreQuestions, setShowMoreQuestions] = useState(false);

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
  const mbtiQuestionCount = questions.filter((question) => question.fromMbti).length;

  const [variant] = useState(() => resolvePriceVariant());
  const crossSourceInsights = useCrossSourceInsights();
  const premiumFeature = premiumFeatureState('relationship_deep_report', resolvePrice(variant), {
    deepReportAvailable: crossSourceInsights.length > 0,
  });

  useAnchorScroll(result.score !== null);

  const funnelAnalysisId = answers.currentAnalysisMeta?.funnelAnalysisId ?? null;

  useEffect(() => {
    if (result.score === null) return;
    // Primary KPI 분모 — 세션당 한 번만. Revisit 여부와 무관하게 기존 정책 그대로(§12).
    // v1.11.1 §17~§20 — 실제 0점과 헷갈리지 않게 result_state:'scored'를 항상 함께 남긴다.
    trackOnce('compatibility_result_view', {
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
  }, [result.score, result.comparedCount, funnelAnalysisId]);

  useEffect(() => {
    if (!mbtiLens) return;
    trackOnce('both_mbti_available', { self: mbtiLens.mine, target: mbtiLens.theirs });
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
    revisitFiredRef.current = true;
    const analysisId = compatibilityNarrativeFingerprint(answers.declared, answers.target, result);
    trackEvent('compatibility_result_revisit', { analysis_id: analysisId, source });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisit, source, result.score]);

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
      bodyClassName="pt-1.5 pb-4"
    >
      <div id={RESULT_ANCHORS.compatibilitySummary} className="flex flex-col gap-[18px]">
        <SyncScore score={result.score} />

        <p className="px-1 text-center text-meta text-ink-muted">
          비교 가능한 {result.comparedCount}개 관계 신호 기준
        </p>

        {result.unknownLabels.length > 0 ? (
          <p className="px-1 text-meta text-ink-muted">
            모름으로 남긴 {result.unknownLabels.length}개 항목은 계산에서 빼뒀어 ·{' '}
            {result.unknownLabels.join(' · ')}
          </p>
        ) : null}

        <LovyMessage pose="chart" size={46}>
          {LOVY_LINES.compatibilityHero}
        </LovyMessage>

        <ResultSectionNav
          event="result_anchor_navigation"
          items={[
            { id: RESULT_ANCHORS.compatibilityWhy, label: '왜 이 점수야' },
            { id: RESULT_ANCHORS.compatibilityGood, label: '잘 맞는 점' },
            { id: RESULT_ANCHORS.compatibilityFriction, label: '확인할 점' },
            { id: RESULT_ANCHORS.compatibilityApproach, label: '다가갈 때' },
            { id: RESULT_ANCHORS.compatibilityQuestions, label: '질문' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-5 pt-6">
        <section id={RESULT_ANCHORS.compatibilityWhy} className="flex flex-col gap-2">
          <SectionLabel>왜 이렇게 나왔어</SectionLabel>
          <p className="px-1 text-caption keep-all leading-relaxed text-ink-sub">
            비교 가능한 {result.comparedCount}개 신호를 기준으로 계산했어. 항목별 근거는
            아래에서 볼 수 있어.
          </p>
        </section>

        {topGood ? (
          <section id={RESULT_ANCHORS.compatibilityGood} className="flex flex-col gap-2.5">
            <SectionLabel className="flex items-center gap-1.5">
              잘 맞는 신호
              <AiSourceLabel mode={narrative.mode} />
            </SectionLabel>
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
              {showAllGood
                ? restGood.map((dimension) => (
                    <SignalCard
                      key={dimension.key}
                      dimension={dimension}
                      variant="good"
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
          </section>
        ) : null}

        <section id={RESULT_ANCHORS.compatibilityFriction} className="flex flex-col gap-2.5">
          <SectionLabel>확인이 필요한 신호</SectionLabel>
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
              <LovyMessage pose="question" size={40}>
                {LOVY_LINES.friction}
              </LovyMessage>
            </>
          ) : (
            <p className="px-1 text-caption keep-all leading-relaxed text-ink-sub">
              지금 입력으로는 큰 차이를 못 찾았어. 차이가 없다는 결론은 아니야 — 아직 내가
              못 본 것일 수도 있어.
            </p>
          )}
        </section>

        {/*
          v1.15 §4 Hook A — Friction 신호를 본 직후, '이 차이가 실제로는 어떻게 나타날까'라는
          궁금증이 생기는 지점에만 둔다. Friction이 없으면 이 궁금증 자체가 없으므로 만들지
          않는다(기존처럼 화면 맨 아래에 일반 Entry를 두지 않는다 — §4 "모든 섹션마다
          Paywall을 만들지 않는다"). Score Hero 바로 아래가 아니라 Friction을 다 본 다음이다.
        */}
        {hasFriction && topFriction ? (
          <PremiumEntryRow
            feature={premiumFeature}
            source="compatibility"
            hook={{
              variant: 'friction_why',
              title: PREMIUM_HOOK_COPY.friction_why.title,
              description: `같은 ${topFriction.label}에서도 너와 상대가 서로 다르게 받아들일 수 있는 순간이 있어.`,
              cta: PREMIUM_HOOK_COPY.friction_why.cta,
            }}
          />
        ) : null}

        {pastObservation ? (
          <section className="flex flex-col gap-2.5">
            <SectionLabel>과거 관찰 · 참고</SectionLabel>
            <PastObservationNote text={pastObservation.text} />
          </section>
        ) : null}

        <section id={RESULT_ANCHORS.compatibilityLenses} className="flex flex-col gap-2.5">
          {mbtiLens ? (
            <>
              <SectionLabel>MBTI 렌즈 · 참고</SectionLabel>
              <MbtiLensPanel report={mbtiLens} variant="summary" />
              <button
                type="button"
                onClick={() => router.push(ROUTES.lensMbti)}
                className="flex min-h-11 items-center justify-between rounded-row border border-line bg-surface px-4 text-sub"
              >
                MBTI 관점으로 더 보기
                <span className="text-ink-faint" aria-hidden>
                  →
                </span>
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => router.push(ROUTES.compatibilityLenses)}
            className="flex min-h-11 items-center justify-between gap-3 rounded-row border border-dashed border-line-strong bg-canvas-warm px-4 py-3.5 text-left"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[12.5px] font-medium">
                사주 · 별자리 관점으로 우리 둘 보기
                {entertainmentReady ? '' : ' (정보 입력 필요)'}
              </span>
              <span className="text-[11px] keep-all text-ink-faint">
                동기화율에는 반영하지 않는 참고 렌즈야
              </span>
            </span>
            <span className="flex-none text-ink-muted" aria-hidden>
              →
            </span>
          </button>
        </section>

        {/* v1.13 — 다가가는 힌트(Approach Hints). 호감도 예측·공략법이 아니다(§2/§46) —
            네가 알려준 취향·관계 방식을 존중해서 다가가는 방법일 뿐이다. */}
        <section id={RESULT_ANCHORS.compatibilityApproach} className="flex flex-col gap-2.5">
          <SectionLabel>이 사람에게 다가갈 때</SectionLabel>
          <p className="px-1 text-caption keep-all leading-relaxed text-ink-sub">
            네가 알려준 이 사람의 취향과 관계 방식을 기준으로 생각해봤어.
          </p>

          {approachHints.length > 0 ? (
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
          ) : (
            <div className="flex flex-col gap-2 rounded-card border border-dashed border-line-strong bg-canvas-warm p-4">
              <p className="text-caption keep-all leading-relaxed text-ink-sub">
                아직 이 사람이 좋아하는 걸 많이 알진 못하네.
              </p>
              <a
                href={`#${RESULT_ANCHORS.compatibilityQuestions}`}
                onClick={() => trackEvent('approach_hint_question_click', {})}
                className="text-[12.5px] font-medium text-brand-pressed"
              >
                이야기해볼 질문 보러 가기 →
              </a>
            </div>
          )}

          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] keep-all text-ink-faint">
              이건 공략법은 아니야. 실제론 직접 물어보는 게 가장 정확해.
            </p>
            {/* v1.13 §36 — 상대 정보는 틀릴 수 있다. resetTargetContext()를 쓰지 않는다 —
                그건 새 상대용이고, 여기는 지금 값을 그대로 고치는 것이다. */}
            <button
              type="button"
              onClick={() => router.push(ROUTES.target)}
              className="flex-none text-[11px] font-medium text-brand-pressed"
            >
              상대 정보 수정
            </button>
          </div>
        </section>

        <section id={RESULT_ANCHORS.compatibilityQuestions} className="flex flex-col gap-2.5">
          <SectionLabel>이야기해볼 질문</SectionLabel>
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
                <AiSourceLabel mode={narrative.mode} />
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
        </section>

        <AiNarrativeNotice
          task="compatibility-narrative"
          status={narrative.status}
          reason={narrative.reason}
        />
        <NoticeBox>{PRIVACY.unknownExcluded}</NoticeBox>
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

  useEffect(() => {
    // v1.11.1 §17~§20 — E3(확신 낮음)는 '0점'이 아니라 '계산 자체가 불가능한 상태'다.
    // 0으로 기록하면 실제 0점(4축 모두 최대 차이)과 Analytics에서 구분할 수 없다.
    trackOnce('compatibility_result_view', {
      score: null,
      result_state: 'insufficient',
      compared: result.comparedCount,
    });
    // v1.12 §18~§23 — 기존 정책 그대로 E3도 Analysis Funnel 분모에 포함한다.
    trackOncePerAnalysis('compatibility_analysis_result_view', funnelAnalysisId, {
      score: null,
      result_state: 'insufficient',
    });
  }, [result.comparedCount, funnelAnalysisId]);

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
          <Button variant="text" onClick={() => router.push(ROUTES.mirrorTeaser)}>
            그래도 내 분석은 볼래
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

        {approachHints.length > 0 ? (
          <section id={RESULT_ANCHORS.compatibilityApproach} className="flex flex-col gap-2.5">
            <SectionLabel>이 사람에게 다가갈 때</SectionLabel>
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
