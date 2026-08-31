'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { AiNarrativeNotice, useNarrativeViewEvent } from '@/components/ai/AiModeNotice';
import { CoreInsightNarrativeView } from '@/components/ai/NarrativeViews';
import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { EvidenceList } from '@/components/common/primitives';
import { useToast } from '@/components/common/ToastProvider';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { UtRatingCard } from '@/components/ut/UtRatingCard';
import { LOVY_LINES } from '@/data/copy';
import { resolveEvidenceRefs } from '@/lib/aiEvidenceResolver';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { createEntryId } from '@/lib/historyRepository';
import { buildHistoryEntry } from '@/lib/logic/history';
import { ROUTES } from '@/lib/routes';
import { useEvidenceContext, useRelationshipNarrative } from '@/hooks/useAiNarrative';
import { useMirror, usePastObservation, useRelationshipProfile } from '@/hooks/useAnalysis';
import { useHistory } from '@/state/HistoryProvider';
import { useSession } from '@/state/SessionProvider';

/**
 * S28 Core Insight — MVP의 종착점
 * 러비는 단정하지 않는다. '~일지도 몰라'로 말하고, 사용자의 확인을 받는다.
 * 사용자가 고치면 관찰 기록(세션 state)에 반영된다.
 */
export default function CoreInsightPage() {
  // localStorage 복원 전에는 Mirror가 '입력 없음'으로 계산돼 홈으로 잘못 리다이렉트된다.
  return (
    <HydrationGate>
      <CoreInsightView />
    </HydrationGate>
  );
}

function CoreInsightView() {
  const router = useRouter();
  const { showToast } = useToast();
  const { answers, setCoreVerdict, setCoreCorrection, markComplete } = useSession();
  const mirror = useMirror();
  const profile = useRelationshipProfile();
  const { saveEntry, entries } = useHistory();
  const focusAxis = mirror.teaser?.axisKey ?? null;
  const pastObservation = usePastObservation(focusAxis);

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(answers.coreCorrection);

  // S26에서 prefetch됐으면 캐시를 읽는다(§61). 실패하면 아래에서 규칙 템플릿으로 되돌아간다.
  const narrative = useRelationshipNarrative();
  const evidenceContext = useEvidenceContext();

  useNarrativeViewEvent({
    task: 'relationship-insight',
    source: 'core_insight',
    status: narrative.status,
    mode: narrative.mode,
    itemCount: narrative.data?.core ? 1 : 0,
  });

  /**
   * AI headline은 **근거가 실제로 해석되는 경우에만** 쓴다(§35).
   * 근거를 하나도 못 붙인 해석으로 제품의 종착점 문장을 바꾸지 않는다.
   */
  const aiHeadline = useMemo(() => {
    const core = narrative.data?.core;
    if (!core) return null;
    if (resolveEvidenceRefs(core.evidenceRefs, evidenceContext).length === 0) return null;
    return core.headline;
  }, [narrative.data, evidenceContext]);

  useEffect(() => {
    // 관계 경험이 없거나(스킵) 직접 URL로 들어온 경우 — 볼 게 없으니 홈으로 보낸다.
    if (!mirror.available || !mirror.core) router.replace(ROUTES.home);
  }, [mirror.available, mirror.core, router]);

  useEffect(() => {
    if (!pastObservation || !focusAxis) return;
    trackEvent('history_based_insight_view', {
      axis: focusAxis,
      previous_occurrences: pastObservation.occurrences,
    });
  }, [pastObservation, focusAxis]);

  if (!mirror.core) return null;

  /**
   * v1.7 §22 — headline 우선순위:
   *   ① 사용자 수정  ② AI headline  ③ 규칙 템플릿 headline
   *
   * 사용자 수정이 AI를 이긴다(§71/§75). 그리고 AI가 실패하면 ③으로 조용히 되돌아간다 —
   * 화면이 비지 않는다(§23).
   */
  const headline = answers.coreCorrection.trim() || aiHeadline || mirror.core.headline;
  const edited = answers.coreCorrection.trim().length > 0;

  /**
   * §23 — 과거 관찰을 근거 목록에 04번으로 덧붙인다.
   * Past Observation 때문에 현재 Core Insight를 바꾸지는 않는다. 현재 Evidence가 우선이다.
   */
  const evidence = pastObservation
    ? [
        ...mirror.core.evidence,
        {
          n: String(mirror.core.evidence.length + 1).padStart(2, '0'),
          text: pastObservation.text,
        },
      ]
    : mirror.core.evidence;

  /** §6 저장 순서: 세션 읽기 → Snapshot 생성 → Entry 생성 → 저장 → 이벤트 → 이동 */
  const handleSave = () => {
    markComplete('mirror');

    const aiMeta = narrative.data?.meta;

    const entry = buildHistoryEntry({
      answers,
      mirror,
      coverage: profile.confidence,
      id: createEntryId(),
      createdAt: new Date().toISOString(),
      // §25 — 화면에 실제로 보인 문장을 그 당시 original로 저장한다.
      coreInsightOriginal: aiHeadline ?? mirror.core?.headline,
      coreInsightAiMeta:
        aiHeadline && aiMeta
          ? {
              mode: aiMeta.mode,
              promptVersion: aiMeta.promptVersion,
              generatedAt: aiMeta.generatedAt,
            }
          : undefined,
    });

    // Mirror를 만들 수 없으면 History에 쌓지 않는다 (Edge A/B) — 여기 도달하면 보통 통과한다.
    if (!entry) {
      trackEvent('relationship_mirror_complete', { axis: focusAxis ?? '' });
      showToast('관찰 기록에 저장했어요');
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

    showToast(created ? '관찰 기록에 저장했어요' : '이미 저장된 관찰이에요');
    // 저장 직후 Change Moment로 보낸다 (§8 첫 기록 / §9 두 번째부터)
    router.push(ROUTES.historySaved);
  };

  return (
    <>
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.mirror} title="핵심 관찰" />}
        footer={
          // Mirror는 '진입(view)'과 '완료(complete)'를 구분한다 — 완료는 여기, 저장을 눌렀을 때다.
          <Button onClick={handleSave}>내 관찰 기록에 저장</Button>
        }
        bodyClassName="pt-1.5 pb-4"
      >
        <div className="flex flex-col gap-[18px]">
          <section className="flex flex-col gap-3 rounded-card bg-brand-tint px-[18px] py-5">
            <p className="text-[10.5px] font-semibold tracking-[0.1em] text-brand-pressed">
              CORE INSIGHT
            </p>
            <h1 className="text-[21px] font-semibold leading-[1.5] tracking-[-0.5px] keep-all text-brand-ink">
              {headline}
            </h1>
            {edited ? (
              <p className="text-[11.5px] text-brand-pressed">
                네가 고친 문장이야. 러비의 원래 관찰은 아래 근거와 함께 남겨뒀어.
              </p>
            ) : null}
          </section>

          {/*
            §22 — AI는 이 Evidence를 '읽기 쉬운 문장으로 연결'만 한다.
            Evidence List 자체는 AI가 만들지 않는다 — 바로 아래 deterministic 목록 그대로다.
          */}
          <CoreInsightNarrativeView core={narrative.data?.core} status={narrative.status} />

          <EvidenceList items={evidence} label="이렇게 생각한 이유" />

          <LovyMessage pose="question" size={46} tone="lead">
            {LOVY_LINES.coreInsightAsk}
          </LovyMessage>

          <div className="flex gap-2">
            <VerdictButton
              label="맞는 것 같아"
              selected={answers.coreVerdict === 'ok'}
              onClick={() => {
                setCoreVerdict('ok');
                trackEvent('mirror_feedback_positive', { axis: mirror.teaser?.axisKey ?? '' });
                showToast('다음 관찰의 기준으로 삼을게요');
              }}
            />
            <VerdictButton
              label="조금 달라"
              muted
              selected={answers.coreVerdict === 'no'}
              onClick={() => {
                setCoreVerdict('no');
                trackEvent('mirror_feedback_edit', { axis: mirror.teaser?.axisKey ?? '' });
                setDraft(answers.coreCorrection);
                setEditOpen(true);
              }}
            />
          </div>

          <p className="px-2.5 text-center text-meta leading-relaxed keep-all text-ink-muted">
            {LOVY_LINES.coreInsightFooter}
          </p>

          {/* §23 — AI 설명이 없으면 '확인된 신호만 보여주고 있다'고 알린다 */}
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
                  showToast('러비의 원래 관찰로 되돌렸어요');
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
              showToast('관찰 기록을 고쳤어요');
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
