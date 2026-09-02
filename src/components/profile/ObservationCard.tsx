'use client';

import { ChevronDown, EyeOff, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { ConfidenceLabel } from '@/components/common/primitives';
import { cn } from '@/lib/cn';
import type { AiObservedTrait, ObservationFeedback } from '@/types';

interface ObservationCardProps {
  trait: AiObservedTrait;
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
          {/*
            v1.10 — 실제 사진 분석 결과는 '활동 이름'과 '몇 장에서 보였는지'를 분리해 보여준다(§15).
            반복 횟수는 규칙이 센 값이라 활동 이름과 같은 줄에 섞으면 단정처럼 읽힌다.
          */}
          {trait.signal && !corrected ? (
            <p className="text-body font-semibold keep-all">{trait.label}</p>
          ) : null}
          <p
            className={cn(
              'keep-all',
              trait.signal && !corrected
                ? 'mt-1 text-sub leading-relaxed text-ink-sub'
                : 'text-body',
              corrected && 'text-ink',
            )}
          >
            {corrected || trait.observation}
          </p>
          {/* AI Original을 덮어쓰지 않는다 — 사용자가 고쳐도 원본을 함께 남긴다(§13) */}
          {corrected ? (
            <p className="mt-1.5 text-[11.5px] keep-all text-ink-muted">
              러비의 원래 관찰: {trait.signal ? `${trait.label} — ` : ''}
              {trait.observation}
            </p>
          ) : null}
        </div>
        {trait.confidence === 'low' && !corrected ? (
          <ConfidenceLabel confidence="low" />
        ) : null}
      </div>

      {excluded ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-meta text-ink-sub">분석에서 제외했어</span>
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
              label="맞아"
              selected={verdict === 'ok'}
              onClick={() => onVerdict('ok')}
            />
            <VerdictButton
              label="조금 달라"
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
            <div className="rounded-[10px] bg-sunken px-3 py-2.5">
              {trait.evidence.length > 0 ? (
                // 실제 분석: 어느 사진에서 무엇을 봤는지 이미지 단위로 보여준다(§10)
                <ul className="flex flex-col gap-2">
                  {trait.evidence.map((item, index) => (
                    <li key={`${item.imageId}-${index}`} className="flex gap-2.5">
                      <span className="flex-none text-[10px] font-semibold tracking-[0.05em] text-brand-pressed tnum">
                        사진 {index + 1}
                      </span>
                      <span className="min-w-0 text-[12.5px] keep-all leading-relaxed text-[#555]">
                        {item.description}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                // 데모·이전 버전 결과: 이미지 단위 근거가 애초에 없다
                <p className="text-[12.5px] keep-all leading-relaxed text-[#555]">
                  {trait.evidenceText ?? '이 관찰의 근거를 표시할 수 없어.'}
                </p>
              )}
            </div>
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
