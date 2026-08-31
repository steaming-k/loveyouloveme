'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { EmptyStateView, FillDataRow } from '@/components/common/StateScreens';
import { InlineError, NoticeBox, PageHeading, Tag } from '@/components/common/primitives';
import { useToast } from '@/components/common/ToastProvider';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { ObservationCard } from '@/components/profile/ObservationCard';
import { LOVY_LINES, PRIVACY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { observedEvidenceLabel } from '@/lib/logic/observed';
import { ROUTES } from '@/lib/routes';
import { isObservedReviewComplete } from '@/lib/validation';
import { aiSelectors } from '@/services/aiService';
import { useSession } from '@/state/SessionProvider';

/** S09 Observed Me 결과 — 러비의 관찰은 초안이고, 사용자가 고칠 수 있다. */
export default function ObservedResultPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    answers,
    setObservationVerdict,
    correctObservation,
    toggleObservationExcluded,
    markComplete,
  } = useSession();

  const traits = useMemo(() => aiSelectors.observedTraits(answers.photos), [answers.photos]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [excludeTargetId, setExcludeTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editingTrait = traits.find((trait) => trait.id === editingId) ?? null;

  const openEditor = (id: string) => {
    const current = answers.observations[id]?.correctedText ?? '';
    setDraft(current);
    setEditingId(id);
  };

  const saveCorrection = () => {
    if (!editingId) return;
    const text = draft.trim();
    if (text.length === 0) {
      showToast('어떻게 다른지 한 줄만 적어줘', 'warning');
      return;
    }
    correctObservation(editingId, text);
    trackEvent('observed_result_edit', { trait: editingId });
    setEditingId(null);
    showToast('관찰 기록을 고쳤어요');
  };

  const handleNext = () => {
    if (!isObservedReviewComplete(answers)) {
      setError('하나라도 맞는지 알려줘. 그게 다음 관찰의 기준이 돼.');
      return;
    }
    markComplete('observed');
    trackEvent('observed_profile_complete', {
      confirmed: Object.values(answers.observations).filter((f) => f.verdict === 'ok').length,
      corrected: Object.values(answers.observations).filter((f) => f.correctedText).length,
      excluded: Object.values(answers.observations).filter((f) => f.excluded).length,
    });
    router.push(ROUTES.declared(1));
  };

  if (traits.length === 0) {
    return (
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.photos} title="관찰 기록" />}
        footer={<Button onClick={() => router.push(ROUTES.photos)}>사진 고르러 가기</Button>}
      >
        <EmptyStateView
          actions={
            <FillDataRow
              label="사진 3장 이상 고르기"
              onClick={() => router.push(ROUTES.photos)}
            />
          }
        />
      </ScreenLayout>
    );
  }

  return (
    <>
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.photos} progress={30} counter="2/3" />}
        footer={
          <div className="flex flex-col gap-2">
            {error ? <InlineError message={error} /> : null}
            <Button onClick={handleNext}>다음</Button>
          </div>
        }
        bodyClassName="pt-1.5 pb-3"
      >
        <div className="flex flex-col gap-3.5">
          <PageHeading
            lines={['사진에서 이런 모습이 보였어.']}
            eyebrow={
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag tone="brand">OBSERVED ME</Tag>
                <Tag tone="mint">{observedEvidenceLabel(answers.photos)}</Tag>
              </div>
            }
          />

          <ul className="flex flex-col gap-2.5">
            {traits.map((trait) => (
              <ObservationCard
                key={trait.id}
                trait={trait}
                feedback={answers.observations[trait.id]}
                onVerdict={(verdict) => {
                  setObservationVerdict(trait.id, verdict);
                  setError(null);
                }}
                onRequestEdit={() => openEditor(trait.id)}
                onToggleExcluded={() => {
                  if (answers.observations[trait.id]?.excluded) {
                    toggleObservationExcluded(trait.id);
                    return;
                  }
                  setExcludeTargetId(trait.id);
                }}
              />
            ))}
          </ul>

          <LovyMessage pose="question" size={40}>
            {LOVY_LINES.observedResult}
          </LovyMessage>

          <NoticeBox>{PRIVACY.aiResult}</NoticeBox>
        </div>
      </ScreenLayout>

      <BottomSheet
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title="어떻게 다른지 알려줘"
        description={
          editingTrait
            ? `러비의 관찰: "${editingTrait.text}" — 네 말로 고쳐 적으면 이 문장을 대신 쓸게.`
            : undefined
        }
      >
        <div className="flex flex-col gap-3">
          <label className="sr-only" htmlFor="observation-correction">
            관찰 수정
          </label>
          <textarea
            id="observation-correction"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={80}
            rows={3}
            placeholder="예) 영화보다는 전시를 더 자주 봐"
            className="w-full resize-none rounded-row border border-line bg-surface p-3.5 text-sub leading-relaxed outline-none focus:border-brand"
          />
          <div className="flex items-center justify-between px-1">
            <span className="text-meta text-ink-muted">{draft.length}/80</span>
            <button
              type="button"
              onClick={() => {
                if (!editingId) return;
                correctObservation(editingId, '');
                setObservationVerdict(editingId, null);
                setEditingId(null);
                showToast('원래 관찰로 되돌렸어요');
              }}
              className="flex min-h-11 items-center text-meta text-ink-muted"
            >
              원래 관찰로 되돌리기
            </button>
          </div>
          <Button onClick={saveCorrection}>이렇게 고칠게</Button>
        </div>
      </BottomSheet>

      <ConfirmModal
        open={excludeTargetId !== null}
        title="이 관찰을 분석에서 제외할까?"
        description="제외하면 관찰 기록과 이후 분석에서 이 항목이 빠져요. 언제든 다시 포함할 수 있어요."
        confirmLabel="제외"
        onCancel={() => setExcludeTargetId(null)}
        onConfirm={() => {
          if (excludeTargetId) {
            toggleObservationExcluded(excludeTargetId);
            trackEvent('observation_excluded', { trait: excludeTargetId });
            showToast('분석에서 제외했어요');
          }
          setExcludeTargetId(null);
        }}
      />
    </>
  );
}
