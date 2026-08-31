'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BottomSheet } from '@/components/common/BottomSheet';
import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { EvidenceList } from '@/components/common/primitives';
import { useToast } from '@/components/common/ToastProvider';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { LOVY_LINES } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';
import { useMirror } from '@/hooks/useAnalysis';
import { useSession } from '@/state/SessionProvider';

/**
 * S28 Core Insight — MVP의 종착점
 * 러비는 단정하지 않는다. '~일지도 몰라'로 말하고, 사용자의 확인을 받는다.
 * 사용자가 고치면 관찰 기록(세션 state)에 반영된다.
 */
export default function CoreInsightPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { answers, setCoreVerdict, setCoreCorrection, markComplete } = useSession();
  const mirror = useMirror();

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(answers.coreCorrection);

  const headline = answers.coreCorrection.trim() || mirror.core.headline;
  const edited = answers.coreCorrection.trim().length > 0;

  return (
    <>
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.mirror} title="핵심 관찰" />}
        footer={
          <Button
            onClick={() => {
              markComplete('mirror');
              showToast('관찰 기록에 저장했어요');
              router.push(ROUTES.home);
            }}
          >
            내 관찰 기록에 저장
          </Button>
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

          <EvidenceList items={mirror.core.evidence} label="근거" />

          <LovyMessage pose="question" size={46} tone="lead">
            {LOVY_LINES.coreInsightAsk}
          </LovyMessage>

          <div className="flex gap-2">
            <VerdictButton
              label="맞는 것 같아"
              selected={answers.coreVerdict === 'ok'}
              onClick={() => {
                setCoreVerdict('ok');
                trackEvent('mirror_feedback_positive', { axis: mirror.teaser.axisKey });
                showToast('다음 관찰의 기준으로 삼을게요');
              }}
            />
            <VerdictButton
              label="조금 달라"
              muted
              selected={answers.coreVerdict === 'no'}
              onClick={() => {
                setCoreVerdict('no');
                trackEvent('mirror_feedback_edit', { axis: mirror.teaser.axisKey });
                setDraft(answers.coreCorrection);
                setEditOpen(true);
              }}
            />
          </div>

          <p className="px-2.5 text-center text-meta leading-relaxed keep-all text-ink-muted">
            {LOVY_LINES.coreInsightFooter}
          </p>
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
