'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { AiNarrativeNotice, useNarrativeViewEvent } from '@/components/ai/AiModeNotice';
import { CoreInsightNarrativeView, MirrorAxisNarrative } from '@/components/ai/NarrativeViews';
import { BottomNavigation } from '@/components/common/BottomNavigation';
import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { EmptyStateView, FillDataRow } from '@/components/common/StateScreens';
import { EvidenceList, PageHeading, Tag } from '@/components/common/primitives';
import { ResultSectionNav } from '@/components/common/ResultSectionNav';
import { useToast } from '@/components/common/ToastProvider';
import { RepeatedSignalNotice } from '@/components/history/PastObservationNote';
import { MirrorComparisonRow, MirrorLegend } from '@/components/mirror/MirrorComparisonRow';
import { PremiumEntryRow } from '@/components/premium/PremiumEntryRow';
import { UtRatingCard } from '@/components/ut/UtRatingCard';
import { LOVY_LINES } from '@/data/copy';
import { PREMIUM_HOOK_COPY } from '@/data/premium';
import { useAnchorScroll } from '@/hooks/useAnchorScroll';
import { resolveEvidenceRefs } from '@/lib/aiEvidenceResolver';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { createEntryId } from '@/lib/historyRepository';
import { buildHistoryEntry } from '@/lib/logic/history';
import { scopeCaptionOf } from '@/lib/logic/relationshipEvidence';
import {
  jobAllowsOutwardAction,
  jobInvitesCurrentEvidence,
  relationshipTenseOf,
  resolveRelationshipContext,
} from '@/lib/logic/relationshipStage';
import { STAGE_JOB_COPY } from '@/data/stageCopy';
import { resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { isRevisit, revisitSource } from '@/lib/resultView';
import { RESULT_ANCHORS, ROUTES } from '@/lib/routes';
import { canUseAiAxisNarrative, canUseAiHeadline } from '@/lib/logic/mirror';
import { isLowData } from '@/lib/validation';
import { premiumFeatureState } from '@/services/premiumService';
import { hasPremiumEvidence } from '@/lib/logic/premiumChapters';
import { useCrossSourceInsights, useEvidenceContext, useRelationshipNarrative } from '@/hooks/useAiNarrative';
import { useMirror, usePastObservation, useRelationshipProfile, useRepeatedSignals } from '@/hooks/useAnalysis';
import { useHistory } from '@/state/HistoryProvider';
import { useSession } from '@/state/SessionProvider';

/**
 * Mirror Result (v1.11 · S27R — 구 S27 Map + S28 Core Insight)
 *
 * '나는 관계에서 어떤 사람인가?'라는 하나의 질문. Map(전체 지도)과 Core Insight(가장 중요한
 * 관찰)를 별도 Route로 오가게 하지 않고, Core Insight를 Map 바로 아래로 옮겨 같은 스크롤
 * 안에서 '전체 → 그래서 뭐가 제일 중요한데'를 해결한다.
 *
 * ⚠️ `relationship_mirror_complete`는 여전히 저장 버튼을 눌렀을 때만 발생한다 — 화면을
 * 합쳤다고 mount에서 완료로 치지 않는다(§18).
 */
export default function MirrorPage() {
  // v1.11 — MirrorView가 Revisit 판정(§19)을 위해 useSearchParams()를 쓴다.
  return (
    <Suspense fallback={null}>
      <HydrationGate>
        <MirrorView />
      </HydrationGate>
    </Suspense>
  );
}

function MirrorView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { answers, setCoreVerdict, setCoreCorrection, markComplete, markResultViewed } =
    useSession();
  /** Release Gate §1 — 외부 Analytics용 opaque 식별자(답변 파생 지문을 대체한다) */
  const funnelAnalysisId = answers.currentAnalysisMeta?.funnelAnalysisId ?? null;
  const mirror = useMirror();
  const repeated = useRepeatedSignals();
  const crossSourceInsights = useCrossSourceInsights();
  const profile = useRelationshipProfile();
  const { saveEntry, entries } = useHistory();
  const [variant] = useState(() => resolvePriceVariant());

  const revisit = isRevisit(searchParams);
  const source = revisitSource(searchParams);

  const focusAxis = mirror.teaser?.axisKey ?? null;
  const pastObservation = usePastObservation(focusAxis);

  /*
    v1.40 §37.11 — Mirror의 **판정은 단계와 무관하게 같다**(MATCH/GAP/CHANGE).
    바뀌는 것은 이 관찰을 어디에 쓰라고 말하는 한 줄이다. `buildMirrorReport()`는
    이 값을 보지 않는다.

    ⚠️ 근거 문장의 시제는 건드리지 않는다. `이전 관계에서 …으로 선택`은 그 근거의
    **출처가 과거 경험**이라는 사실이고, 사용자가 지금 연애 중이어도 그 문장은
    여전히 참이다. 관계 단계와 근거 시점을 혼동하지 않는다(§37.10).
  */
  const { job } = resolveRelationshipContext(answers);
  const jobCopy = STAGE_JOB_COPY[job];
  const showOutwardAction = jobAllowsOutwardAction(job);
  /** v1.41 §39.13 — 근거를 부르는 이름. 판정에는 들어가지 않는다 */
  const tense = relationshipTenseOf(job);
  /** v1.41 §39.6 — S30 권유 대상인가 (화면 분기 전용) */
  const invitesCurrent = jobInvitesCurrentEvidence(job);
  const scope = mirror.scopeSummary;
  /**
    v1.41 — 캡션 생성은 `logic/relationshipEvidence.ts`가 한다. 여기 인라인으로 두면
    fixture가 검사할 수 없고, 실제로 `ended`에서 `지금 N · 이전 M`이 새어 나갔다(J7).
  */
  const scopeCaption = scopeCaptionOf({ summary: scope, tense, fallback: jobCopy.mirrorUse });

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(answers.coreCorrection);

  // 한 번만 호출한다 — 구 S27/S28 두 곳에서 각각 부르던 것을 합쳤다(§32 AI 재호출 최소화).
  const narrative = useRelationshipNarrative();
  const evidenceContext = useEvidenceContext();

  useNarrativeViewEvent({
    task: 'relationship-insight',
    source: 'mirror_result',
    status: narrative.status,
    mode: narrative.mode,
    itemCount: narrative.data?.narratives.length ?? 0,
  });

  /**
   * Core headline로 쓸 AI 문장 — **소비 게이트** (v1.44 · R-11)
   *
   * ══ 왜 여기인가 ═══════════════════════════════════════════════════════════
   *
   * NEW-003은 결정론 headline(`buildHeadline`)의 시제 주장을 닫았다. 그런데 이 화면의
   * 우선순위는 `coreCorrection || aiHeadline || mirror.core.headline`이라
   * **AI가 성공하면 그 수정이 가려진다.** 실측(`mode: 'real'`):
   *
   * ```
   * focus 축   contact · state CHANGE · scope 'none'
   * AI headline  연락의 중요성이 가장 두드러진 변화로 보여      ← 비교 근거 0
   * ```
   *
   * 그리고 이 문장은 `handleSave()`에서 `coreInsightOriginal`로 **History에 저장되고**,
   * `/home`의 RELATIONSHIP HISTORY 카드에 미리보기로 다시 나온다. 한 번 새면 기록에
   * 남는다.
   *
   * ══ 규칙 ═════════════════════════════════════════════════════════════════
   *
   * > **AI_OUTPUT은 deterministic evidence boundary를 넘을 수 없다.**
   *
   * 이미 이 memo가 그 규칙의 절반을 지키고 있었다 — `evidenceRefs`가 하나도 resolve되지
   * 않으면 문장을 버린다(v1.27 `AI_OUTPUT ⊆ DETERMINISTIC_EVIDENCE`). R-11이 드러낸
   * 것은 **경계에 시제 축이 빠져 있었다**는 것이다: 근거를 정확히 지목해도, 그 근거로
   * 시간적 변화를 주장할 수 없으면 그 문장은 경계 밖이다.
   *
   * 그래서 `CHANGE` focus에 시간 비교 근거가 없으면 **소비하지 않고** NEW-003에서
   * 안전해진 결정론 headline으로 폴백한다.
   *
   * ══ 무엇을 바꾸지 않는가 ══════════════════════════════════════════════════
   *
   * ```
   * AI 요청 · 프롬프트 · promptVersion · 스캐너 · 캐시   변경 0
   * 내부 CHANGE state · SavedState                       변경 0
   * ```
   *
   * **모델은 계속 같은 요청을 받고 같은 답을 만든다.** 바뀌는 것은 **소비자가 그 답을
   * 쓸지**뿐이다 — v1.44 BUG-003이 `meta` 계약 위반에 대해 내린 것과 같은 종류의 판단이다.
   *
   * ⚠️ `MATCH`·`GAP` focus는 **손대지 않는다.** 그 판정의 문장은 시제를 주장하지 않으므로
   * 시간 비교 근거를 요구할 이유가 없다(TEMP-AI-03).
   *
   * ⚠️ `'current'`도 함께 막힌다. `hasTemporalComparison`이 참인 scope는 `'past'`뿐이고,
   * 프롬프트는 CHANGE를 `경험에서는 우선순위가 옮겨감`으로 정의해 **모델을 시제 해석으로
   * 유도**한다 — v1.41 §39.11이 `'current'`에 대해 결정론 문장을 가른 것과 같은 이유다.
   */
  const aiHeadline = useMemo(() => {
    const core = narrative.data?.core;
    if (!core) return null;
    if (resolveEvidenceRefs(core.evidenceRefs, evidenceContext).length === 0) return null;

    const focus = mirror.insights.find((insight) => insight.key === mirror.teaser?.axisKey);
    if (!canUseAiHeadline(focus)) return null;

    return core.headline;
  }, [narrative.data, evidenceContext, mirror.insights, mirror.teaser]);

  /**
   * ⚠️ v1.44 R-12 — Core AI **서술 본문**도 같은 경계를 따른다.
   *
   * R-11은 `aiHeadline`(= `core.headline`)을 닫았지만, 그 아래 `CoreInsightNarrativeView`가
   * 렌더하는 것은 **같은 객체의 다른 필드**(`core.summary`)이고 게이트를 받지 않았다.
   * 실측에서 축 서술을 막은 뒤에도 Core 카드에
   * `연락에 대한 중요성이 이전 관계와 비교해 변화한 것으로 나타나.`가 남았다 —
   * focus 축은 `CHANGE`·`scope 'none'`이었다.
   *
   * 술어는 축 서술과 **같다.** Core 서술은 focus 축을 설명하는 문장이므로 그 축의
   * 근거 경계를 그대로 따른다.
   */
  const focusInsight = useMemo(
    () => mirror.insights.find((insight) => insight.key === mirror.teaser?.axisKey),
    [mirror.insights, mirror.teaser],
  );

  const lowData = isLowData(answers);

  useAnchorScroll(mirror.available && !lowData);

  useEffect(() => {
    if (!mirror.available) router.replace(ROUTES.home);
  }, [mirror.available, router]);

  useEffect(() => {
    if (!mirror.available || lowData) return;
    // 화면 진입은 아직 완료가 아니다 — 완료는 저장을 눌렀을 때다.
    trackEvent('relationship_mirror_view', {
      gap_count: mirror.gapCount,
      compared_axes: mirror.insights.length,
    });
    markResultViewed('mirror');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mirror.available, lowData]);

  const revisitFiredRef = useRef(false);
  useEffect(() => {
    // StrictMode 이중 마운트로 중복 발생하지 않게 mount 기준 1회만(§86 패턴과 동일)
    if (!revisit || !mirror.available || lowData || revisitFiredRef.current) return;
    // ⚠️ `funnelAnalysisId`가 생긴 뒤에 보낸다. React는 자식 effect를 부모보다 먼저
    // 실행하므로, hydration 직후 커밋에서는 `SessionProvider`의 id 발급보다 이 effect가
    // 앞설 수 있다. 아래 ref 가드 때문에 한 번 놓치면 영영 안 붙는다(실측 확인).
    if (!funnelAnalysisId) return;
    revisitFiredRef.current = true;
    // Release Gate §1 — 예전에는 `analysisFingerprint(...)`(= 답변을 그대로 이어붙인
    // 문자열)를 `analysis_id`로 보냈다. 외부 Analytics에서 응답 프로필이 복원되므로
    // opaque한 `funnel_analysis_id`로 바꾼다. 지문 자체는 History/캐시가 계속 쓴다.
    trackEvent('mirror_result_revisit', { source, funnel_analysis_id: funnelAnalysisId });
  }, [revisit, source, mirror.available, lowData, funnelAnalysisId]);

  useEffect(() => {
    if (!pastObservation || !focusAxis) return;
    trackEvent('history_based_insight_view', {
      axis: focusAxis,
      previous_occurrences: pastObservation.occurrences,
    });
  }, [pastObservation, focusAxis]);

  if (!mirror.available) return null;

  if (lowData) {
    return (
      <ScreenLayout
        /*
          ⚠️ v1.36 A11y — **`title`을 넘기지 않는다.** `ScreenHeader`의 title은 `h2`로
          그려져서, 아래 `EmptyStateView`의 `h1`보다 먼저 나오면 heading 순서가
          H2 → H1로 역전된다. 결과 화면 본문이 같은 이유로 title을 넘기지 않는다.
        */
        header={<ScreenHeader backHref={ROUTES.home} />}
        footer={<Button onClick={() => router.push(ROUTES.profileIntro)}>관측 기록 채우기</Button>}
      >
        <EmptyStateView
          actions={
            <div className="flex flex-col gap-2">
              <FillDataRow
                label="관계 경험 질문 3개"
                onClick={() => router.push(ROUTES.past(1))}
              />
              {/*
                v1.37 — '사진 3장 더 고르기'를 뺐다. Mirror 판정은 `(declared, experience)`만
                쓴다 — 사진을 더 고른다고 이 화면이 열리지 않는다. 되지 않는 방법을
                해결책으로 제시하지 않는다(§1.5-3).
              */}
              <FillDataRow
                label="관계 성향 질문 4개"
                onClick={() => router.push(ROUTES.declared(1))}
              />
            </div>
          }
        />
      </ScreenLayout>
    );
  }

  // 방어적 가드 — insights가 있으면 core도 함께 계산되지만(§ mirror.ts pickFocus), 혹시라도
  // 없으면 화면을 깨뜨리는 대신 조용히 아무것도 렌더하지 않는다.
  if (!mirror.core) return null;

  const gapInsights = mirror.insights.filter((insight) => insight.state !== 'MATCH');
  const headline = answers.coreCorrection.trim() || aiHeadline || mirror.core.headline;
  const edited = answers.coreCorrection.trim().length > 0;

  const evidence = pastObservation
    ? [
        ...mirror.core.evidence,
        {
          n: String(mirror.core.evidence.length + 1).padStart(2, '0'),
          text: pastObservation.text,
        },
      ]
    : mirror.core.evidence;

  const handleSave = () => {
    markComplete('mirror');

    const aiMeta = narrative.data?.meta;

    const entry = buildHistoryEntry({
      answers,
      mirror,
      coverage: profile.confidence,
      id: createEntryId(),
      createdAt: new Date().toISOString(),
      coreInsightOriginal: aiHeadline ?? mirror.core?.headline,
      coreInsightAiMeta:
        aiHeadline && aiMeta
          ? { mode: aiMeta.mode, promptVersion: aiMeta.promptVersion, generatedAt: aiMeta.generatedAt }
          : undefined,
    });

    if (!entry) {
      // v1.11.1 §21~§23 — mirror.core가 있는 시점에만 이 버튼이 렌더되므로(위 가드 참고)
      // 정상 화면에서는 도달하지 않는 defensive edge다. 그래도 실제로 History에 저장되지
      // 않았으므로 '저장했어'라고 말하지 않는다 — Mirror 소비 자체는 완료했으니 complete는
      // 유지하되(relationship_history_entry_created는 발생시키지 않는다), copy는 사실대로.
      trackEvent('relationship_mirror_complete', { axis: focusAxis ?? '' });
      showToast('이번 결과는 기록으로 남길 수 있는 근거가 부족했어');
      router.push(ROUTES.home);
      return;
    }

    const { entry: saved, created } = saveEntry(entry);

    if (created) {
      trackEvent('relationship_history_entry_created', {
        entry_id: saved.id,
        focus_axis: saved.mirrorSnapshot.focusAxis ?? '',
        gap_count: mirror.gapCount,
        history_count: entries.length + 1,
      });
    }
    trackEvent('relationship_mirror_complete', { axis: focusAxis ?? '' });

    showToast(created ? '관찰 기록에 저장했어' : '이미 저장된 관찰이야');
    router.push(ROUTES.historySaved);
  };

  return (
    <>
      <ScreenLayout
        header={
          <ScreenHeader
            backHref={revisit ? ROUTES.home : ROUTES.mirrorTeaser}
            centerLabel={revisit ? '최근 RELATIONSHIP MIRROR' : 'RELATIONSHIP MIRROR'}
            action={
              <button
                type="button"
                onClick={() => router.push(ROUTES.shareMirror)}
                className="flex h-11 items-center px-1 text-caption text-ink-sub"
              >
                공유
              </button>
            }
          />
        }
        footer={<Button onClick={handleSave}>내 관찰 기록에 저장</Button>}
        nav={revisit ? <BottomNavigation /> : undefined}
        bodyClassName="pt-1.5 pb-4"
      >
        <div className="flex flex-col gap-[18px]">
          <PageHeading
            lines={['네가 생각한 너', 'vs 관계에서 나타난 너']}
            size="hero"
            /**
             * v1.41 §39.9 — **섞인 근거를 한 시점의 이름으로 부르지 않는다.**
             *
             * `jobCopy.mirrorUse`는 v1.40이 만든 Job별 한 줄인데(`dating`이면
             * `지금 이 관계에서 조율할 기준`), 축별 근거가 지금/이전으로 섞여 있으면
             * 그 한 줄이 절반의 축에 대해 거짓이 된다. 그래서 섞였을 때는 **그 사실을
             * 먼저 말한다** — 카드를 더하지 않고 캡션 한 조각으로만.
             */
            caption={`비교 가능한 ${mirror.insights.length}개 기준에서 · ${scopeCaption}`}
            eyebrow={
              gapInsights.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag tone="brand">차이 {gapInsights.length}개</Tag>
                  <Tag tone="mint">일치 {mirror.insights.length - gapInsights.length}개</Tag>
                </div>
              ) : (
                <Tag tone="mint">비교한 항목이 모두 비슷했어</Tag>
              )
            }
          />

          <ResultSectionNav
            event="result_anchor_navigation"
            items={[{ id: RESULT_ANCHORS.mirrorCoreInsight, label: '가장 중요한 관찰' }]}
          />

          {/*
            v1.41 §39.6 — **근거가 아직 과거뿐인 `dating`·`long_term`에게만** 보인다.
            이미 지금 관계 근거가 있으면 이 줄은 사라진다 — 답한 것을 반영해 놓고
            같은 권유를 반복하면 반영되지 않은 것처럼 읽힌다.

            ⚠️ 카드가 아니라 한 줄이다(§39.10). 그리고 `from=mirror`를 붙여 돌아올
            곳을 이 화면으로 고정한다.
          */}
          {invitesCurrent && scope.currentCount === 0 ? (
            <div className="flex flex-col gap-2 rounded-card border border-dashed border-line-strong bg-canvas-warm p-4">
              <p className="text-caption keep-all leading-relaxed text-ink-sub">
                지금 이 비교의 오른쪽 칸은 전부 이전 관계에서 답한 내용이야. 지금 관계에서는
                어떤지 알려주면 그 항목부터 지금 기준으로 다시 볼게.
              </p>
              <Link
                href={ROUTES.currentRelationship('mirror')}
                className="inline-flex min-h-11 items-center self-start text-[12.5px] font-medium text-brand-pressed"
              >
                지금 관계에서의 나 알려주기 →
              </Link>
            </div>
          ) : null}

          <section className="flex flex-col gap-2.5">
            <MirrorLegend />
            <ul className="flex flex-col gap-2.5">
              {mirror.insights.map((insight, index) => (
                <MirrorComparisonRow
                  key={insight.key}
                  insight={insight}
                  index={index}
                  tense={tense}
                  /**
                   * ⚠️ v1.44 R-12 — 축별 AI 서술도 **결정론 근거 경계를 따른다.**
                   *
                   * 비교 근거가 없는 `CHANGE` 축에서는 AI 문장을 소비하지 않는다. 지우는
                   * 것은 이 블록 하나이고, 위의 결정론 노트(`insight.note`)는 그대로
                   * 남는다 — 그 행이 무엇을 답했고 왜 비교할 수 없는지는 계속 말해야 한다.
                   *
                   * 규칙은 R-11의 Core headline과 **같은 술어**를 쓴다(`aiMayClaimChange`).
                   */
                  footer={
                    canUseAiAxisNarrative(insight) ? (
                      <MirrorAxisNarrative
                        axis={insight.key}
                        narratives={narrative.data?.narratives}
                        status={narrative.status}
                      />
                    ) : null
                  }
                />
              ))}
            </ul>
          </section>

          {repeated.length > 0 ? <RepeatedSignalNotice signals={repeated} /> : null}

          <section
            id={RESULT_ANCHORS.mirrorCoreInsight}
            className="flex flex-col gap-3 rounded-card bg-brand-tint px-[18px] py-5"
          >
            <p className="text-[10.5px] font-semibold tracking-[0.1em] text-brand-pressed">
              러비가 가장 눈여겨본 부분
            </p>
            <h2 className="text-[21px] font-semibold leading-[1.5] tracking-[-0.5px] keep-all text-brand-ink">
              {headline}
            </h2>
            {/*
              v1.43 §48.6 — **카피를 화면 사실에 맞췄다.**

              이전 문구는 `러비의 원래 관찰은 아래 근거와 함께 남겨뒀어`였다. §48의
              게이트가 Core AI 서술을 렌더에서 빼면 **아래에 남는 것은 결정론 근거
              목록뿐**이고, 러비의 원래 관찰 문장은 화면에 없다. 원래 관찰이 실제로
              남는 곳은 **저장을 눌렀을 때의 관찰 기록**이다
              (`coreInsight.original` — `buildHistoryEntry`).

              ⚠️ 문구를 그대로 두는 것이 더 작은 변경이지만, 그러면 화면이 없는 것을
              있다고 말한다. v1.43이 닫는 것이 정확히 그 종류의 거짓이다.
            */}
            {edited ? (
              <p className="text-[11.5px] text-brand-pressed">
                네가 고친 문장이야. 러비의 원래 관찰도 기록에 함께 저장할게 — 아래 근거는
                그대로야.
              </p>
            ) : null}
          </section>

          <CoreInsightNarrativeView
            core={canUseAiAxisNarrative(focusInsight) ? narrative.data?.core : undefined}
            status={narrative.status}
          />

          <EvidenceList items={evidence} label="이렇게 생각한 이유" />

          {/*
            v1.15 §4 Hook B — Core Insight를 다 읽은 직후. '왜 나는 생각했던 나와 다르게
            행동했을까'라는, 럽유럽미 Product Identity에 가장 가까운 궁금증이 생기는 지점이다.
            차이(GAP)가 하나도 없으면 이 질문 자체가 성립하지 않으므로 만들지 않는다.
            무료 Mirror 본문(근거·검증 버튼·저장)은 이 아래로 그대로 이어진다 — 끝까지 읽을 수 있다.
          */}
          {gapInsights.length > 0 ? (
            <PremiumEntryRow
              feature={premiumFeatureState('relationship_deep_report', resolvePrice(variant), {
                mirrorAvailable: mirror.available,
                /**
                 * §2-1-A — **Experience/Target 유무로 Premium 자격을 막지 않는다.**
                 * `hasDeepConnection`만 보면 관계 경험이 없는 사용자는 통과할 방법이
                 * 없었다(실측: declared 5축 + Target 4축 + MBTI 양쪽인데도 막혔다).
                 */
                deepReportAvailable: hasPremiumEvidence({
                  insights: crossSourceInsights,
                  declared: answers.declared,
                  mirror,
                }),
                // v1.40 §37.9 — 지키지 못할 약속을 목록에서 뺀다.
                allowsOutwardAction: showOutwardAction,
              })}
              source="mirror"
              hook={{
                variant: 'mirror_why',
                title: PREMIUM_HOOK_COPY.mirror_why.title,
                description:
                  '네가 중요하다고 말한 기준, 실제 연애에서의 경험, 이번 상대와의 차이를 함께 연결해봤어.',
                cta: PREMIUM_HOOK_COPY.mirror_why.cta,
              }}
            />
          ) : null}

          <div className="flex gap-2">
            <VerdictButton
              label="맞는 것 같아"
              selected={answers.coreVerdict === 'ok'}
              onClick={() => {
                setCoreVerdict('ok');
                trackEvent('mirror_feedback_positive', { axis: focusAxis ?? '' });
                showToast('다음 관찰의 기준으로 삼을게');
              }}
            />
            <VerdictButton
              label="조금 달라"
              muted
              selected={answers.coreVerdict === 'no'}
              onClick={() => {
                setCoreVerdict('no');
                trackEvent('mirror_feedback_edit', { axis: focusAxis ?? '' });
                setDraft(answers.coreCorrection);
                setEditOpen(true);
              }}
            />
          </div>

          <p className="px-2.5 text-center text-meta leading-relaxed keep-all text-ink-muted">
            {LOVY_LINES.coreInsightFooter}
          </p>

          <AiNarrativeNotice
            task="relationship-insight"
            status={narrative.status}
            reason={narrative.reason}
          />

          {/* §45 — UT Mode에서만. 근거 이해도는 이 화면에서 묻는 게 맞다 */}
          <UtRatingCard
            question="왜 이런 결과가 나왔는지 근거가 이해됐어?"
            event="ut_evidence_clarity_rate"
            properties={{ task: 'relationship', mode: narrative.mode ?? 'none' }}
            lowLabel="전혀 모르겠어"
            highLabel="충분히 이해됐어"
          />
        </div>
      </ScreenLayout>

      <BottomSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="어떻게 다른지 알려줘"
        description="네가 적은 문장을 관찰 기록의 핵심 문장으로 쓸게."
      >
        <div className="flex flex-col gap-3">
          <label className="sr-only" htmlFor="core-correction">
            핵심 관찰 수정
          </label>
          <textarea
            id="core-correction"
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 120))}
            rows={3}
            placeholder="예) 연락보다는 대화의 밀도가 중요한 것 같아."
            className="w-full resize-none rounded-row border border-line bg-surface p-3.5 text-sub leading-relaxed outline-none placeholder:text-ink-faint focus:border-brand"
          />
          <div className="flex items-center justify-between px-1">
            <span className="text-meta text-ink-muted">{draft.length}/120</span>
            {edited ? (
              <button
                type="button"
                onClick={() => {
                  setCoreCorrection('');
                  setCoreVerdict(null);
                  setEditOpen(false);
                  showToast('러비의 원래 관찰로 되돌렸어');
                }}
                className="flex min-h-11 items-center text-meta text-ink-muted"
              >
                원래 관찰로 되돌리기
              </button>
            ) : null}
          </div>
          <Button
            onClick={() => {
              if (draft.trim().length === 0) {
                showToast('한 줄만 적어줘', 'warning');
                return;
              }
              setCoreCorrection(draft.trim());
              setEditOpen(false);
              showToast('관찰 기록을 고쳤어');
            }}
          >
            이렇게 고칠게
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

function VerdictButton({
  label,
  selected,
  muted = false,
  onClick,
}: {
  label: string;
  selected: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'min-h-11 flex-1 rounded-[13px] border py-4 text-[14.5px] transition-colors duration-200',
        selected
          ? 'border-brand bg-brand-tint font-semibold text-ink'
          : cn('border-line bg-surface active:bg-sunken', muted ? 'text-ink-sub' : 'text-ink'),
      )}
    >
      {label}
    </button>
  );
}
