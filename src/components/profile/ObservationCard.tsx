'use client';

import { ChevronDown, EyeOff, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { ConfidenceLabel } from '@/components/common/primitives';
import { cn } from '@/lib/cn';
import type { ObservationFeedback, ObservedTrait } from '@/types';

interface ObservationCardProps {
  trait: ObservedTrait;
  feedback: ObservationFeedback | undefined;
  onVerdict: (verdict: 'ok' | 'no') => void;
  /** '조금 달라요'를 눌렀을 때 수정 시트를 연다 */
  onRequestEdit: () => void;
  onToggleExcluded: () => void;
}

/**
 * Editable AI Result (S09)
 * 러비의 관찰은 결론이 아니라 초안이다. 사용자가 확인·수정·제외할 수 있어야 한다.
 */
export function ObservationCard({
  trait,
  feedback,
  onVerdict,
  onRequestEdit,
  onToggleExcluded,
}: ObservationCardProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const excluded = Boolean(feedback?.excluded);
  const corrected = feedback?.correctedText?.trim();
  const verdict = feedback?.verdict ?? null;

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-row border bg-surface p-4 transition-opacity',
        excluded ? 'border-line-strong opacity-55' : 'border-line',
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className={cn('text-body keep-all', corrected && 'text-ink')}>
            {corrected || trait.text}
          </p>
          {corrected ? (
            <p className="mt-1.5 text-[11.5px] text-ink-muted">
              러비의 원래 관찰: {trait.text}
            </p>
          ) : null}
        </div>
        {trait.confidence === 'low' && !corrected ? (
          <ConfidenceLabel confidence="low" />
        ) : null}
      </div>

      {excluded ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-meta text-ink-sub">분석에서 제외했어요</span>
          <button
            type="button"
            onClick={onToggleExcluded}
            className="flex min-h-11 items-center gap-1.5 text-meta font-semibold text-brand"
          >
            <RotateCcw size={13} aria-hidden />
            다시 포함
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-[7px]">
            <VerdictButton
              label="맞아요"
              selected={verdict === 'ok'}
              onClick={() => onVerdict('ok')}
            />
            <VerdictButton
              label="조금 달라요"
              muted
              selected={verdict === 'no'}
              onClick={() => {
                onVerdict('no');
                onRequestEdit();
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-line-soft pt-2.5">
            <button
              type="button"
              onClick={() => setEvidenceOpen((prev) => !prev)}
              aria-expanded={evidenceOpen}
              className="flex min-h-11 items-center gap-1 text-[11.5px] font-semibold text-brand-pressed"
            >
              근거 보기
              <ChevronDown
                size={13}
                className={cn('transition-transform duration-200', evidenceOpen && 'rotate-180')}
                aria-hidden
              />
            </button>

            <button
              type="button"
              onClick={onToggleExcluded}
              className="flex min-h-11 items-center gap-1.5 text-[11.5px] text-ink-muted"
            >
              <EyeOff size={13} aria-hidden />
              분석 제외
            </button>
          </div>

          {evidenceOpen ? (
            <p className="rounded-[10px] bg-sunken px-3 py-2.5 text-[12.5px] keep-all leading-relaxed text-[#555]">
              {trait.evidence}
            </p>
          ) : null}
        </>
      )}
    </li>
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
        'min-h-11 flex-1 rounded-[9px] border py-2.5 text-caption transition-colors duration-200',
        selected
          ? 'border-brand bg-brand-tint font-semibold text-ink'
          : cn('border-line bg-surface active:bg-sunken', muted ? 'text-ink-sub' : 'text-ink'),
      )}
    >
      {label}
    </button>
  );
}
