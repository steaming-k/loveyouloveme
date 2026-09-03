'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { AiNarrativeNotice, useNarrativeViewEvent } from '@/components/ai/AiModeNotice';
import { CoreInsightNarrativeView, MirrorAxisNarrative } from '@/components/ai/NarrativeViews';
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
import { analysisFingerprint, buildHistoryEntry } from '@/lib/logic/history';
import { resolvePrice, resolvePriceVariant } from '@/lib/premiumVariant';
import { isRevisit, revisitSource } from '@/lib/resultView';
import { RESULT_ANCHORS, ROUTES } from '@/lib/routes';
import { isLowData } from '@/lib/validation';
import { premiumFeatureState } from '@/services/premiumService';
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

  const aiHeadline = useMemo(() => {
    const core = narrative.data?.core;
    if (!core) return null;
    if (resolveEvidenceRefs(core.evidenceRefs, evidenceContext).length === 0) return null;
    return core.headline;
  }, [narrative.data, evidenceContext]);

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
    revisitFiredRef.current = true;
    const analysisId = analysisFingerprint(answers.status, answers.declared, answers.experience);
    trackEvent('mirror_result_revisit', { analysis_id: analysisId, source });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisit, source, mirror.available, lowData]);

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
        header={<ScreenHeader backHref={ROUTES.home} title="관계 속의 나" />}
        footer={<Button onClick={() => router.push(ROUTES.profileIntro)}>관측 기록 채우기</Button>}
      >
        <EmptyStateView
          actions={
            <div className="flex flex-col gap-2">
              <FillDataRow
                label="관계 경험 질문 3개"
                onClick={() => router.push(ROUTES.past(1))}
              />
              <FillDataRow label="사진 3장 더 고르기" onClick={() => router.push(ROUTES.photos)} />
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
        bodyClassName="pt-1.5 pb-4"
      >
        <div className="flex flex-col gap-[18px]">
          <PageHeading
            lines={['네가 생각한 너', 'vs 관계에서 나타난 너']}
            size="hero"
            caption={`비교 가능한 ${mirror.insights.length}개 기준에서`}
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

          <section className="flex flex-col gap-2.5">
            <MirrorLegend />
            <ul className="flex flex-col gap-2.5">
              {mirror.insights.map((insight, index) => (
                <MirrorComparisonRow
                  key={insight.key}
                  insight={insight}
                  index={index}
                  footer={
                    <MirrorAxisNarrative
                      axis={insight.key}
                      narratives={narrative.data?.narratives}
                      status={narrative.status}
                    />
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
            {edited ? (
              <p className="text-[11.5px] text-brand-pressed">
                네가 고친 문장이야. 러비의 원래 관찰은 아래 근거와 함께 남겨뒀어.
              </p>
            ) : null}
          </section>

          <CoreInsightNarrativeView core={narrative.data?.core} status={narrative.status} />

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
                deepReportAvailable: crossSourceInsights.length > 0,
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
