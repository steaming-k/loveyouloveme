import { Heart } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * 1~5 척도 보조 시각화 (260914 UT 후속 P2-4)
 *
 * UT에서 '중요도 숫자만 있으면 건조하다 · 하트처럼 보이면 직관적'이라는 반응이 나왔다.
 *
 * ⚠️ **숫자가 주인이다.** 하트는 같은 값을 한 번 더 그린 보조 표시라 `aria-hidden`이고,
 * `3/5` 숫자는 항상 함께 남는다. 값을 반올림하거나 의미를 바꾸지 않는다 — 5점 = 하트 5개 중 5개.
 */
export function ScaleHearts({
  value,
  max = 5,
  className,
}: {
  value: number;
  max?: number;
  className?: string;
}) {
  const filled = Math.max(0, Math.min(max, value));

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="inline-flex items-center gap-[2px]" aria-hidden>
        {Array.from({ length: max }, (_, index) => (
          <Heart
            key={index}
            size={10}
            strokeWidth={2.2}
            data-filled={index < filled ? 'true' : 'false'}
            className={index < filled ? 'fill-brand text-brand' : 'text-line-strong'}
          />
        ))}
      </span>
      <span className="tnum">
        {value}/{max}
      </span>
    </span>
  );
}
