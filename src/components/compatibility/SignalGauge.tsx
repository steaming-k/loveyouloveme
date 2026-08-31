import { cn } from '@/lib/cn';
import type { SignalTone } from '@/types';

const SEGMENT_CLASS: Record<SignalTone, string> = {
  good: 'bg-brand',
  neutral: 'bg-brand-soft',
  watch: 'bg-friction',
  unknown: 'bg-track',
};

const TONE_TEXT: Record<SignalTone, string> = {
  good: '잘 맞는 신호',
  neutral: '보통',
  watch: '관찰 필요',
  unknown: '비교 못 함',
};

/**
 * Compatibility Gauge — 5칸 세그먼트
 * 색만으로 상태를 구분하지 않도록 스크린리더용 텍스트를 함께 제공한다.
 */
export function SignalGauge({
  alignment,
  tone,
  label,
}: {
  alignment: number | null;
  tone: SignalTone;
  label: string;
}) {
  return (
    <div className="flex flex-none items-center gap-2">
      <div className="flex gap-[3px]" aria-hidden>
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            key={step}
            className={cn(
              'h-[9px] w-[15px] rounded-sm',
              alignment !== null && step <= alignment ? SEGMENT_CLASS[tone] : 'bg-track',
            )}
          />
        ))}
      </div>
      <span className="sr-only">
        {label} · {TONE_TEXT[tone]}
        {alignment === null ? '' : ` · 5칸 중 ${alignment}칸`}
      </span>
    </div>
  );
}

export function ToneBadge({ tone }: { tone: SignalTone }) {
  const style: Record<SignalTone, string> = {
    good: 'bg-brand-tint text-brand-pressed',
    neutral: 'bg-chip text-ink-muted',
    watch: 'bg-friction-tint text-friction-text',
    unknown: 'bg-chip text-ink-muted',
  };

  return (
    <span className={cn('flex-none rounded-[6px] px-2 py-1 text-label', style[tone])}>
      {TONE_TEXT[tone]}
    </span>
  );
}
