import type { ReactNode } from 'react';

import { ComparePair } from '@/components/common/primitives';
import { cn } from '@/lib/cn';
import type { CompatibilityDimension } from '@/types';

/**
 * Good Signal (S23) / Friction Signal (S24)
 * 구조: Signal → Evidence → Real-life Example
 *
 * Friction은 'RED FLAG' / 'WARNING' 같은 표현을 쓰지 않는다.
 * 안 맞는다는 판정이 아니라 '차이가 보이는 지점'으로만 다룬다.
 *
 * v1.23 §9 — `density` 두 단계.
 *   `primary` : 가장 중요한 신호 1개. 카드 + 상황 + 근거까지 전부
 *   `compact` : '더 보기'로 펼쳐지는 나머지. 카드 테두리를 없애고 divider 행으로,
 *                typography도 한 단계 낮춘다 — 같은 규격 카드를 4개 쌓으면 무엇이 중요한지
 *                사라진다. **정보를 빼는 것이 아니라 위계를 만드는 것이다**(상황·근거는 그대로).
 */
export function SignalCard({
  dimension,
  variant,
  footer,
  density = 'primary',
}: {
  dimension: CompatibilityDimension;
  variant: 'good' | 'friction';
  density?: 'primary' | 'compact';
  /**
   * v1.7 — AI 설명 블록을 카드 안 마지막에 붙이기 위한 슬롯.
   * `<li>`를 이 컴포넌트가 만들기 때문에 바깥에서 형제로 끼우면 마크업이 깨진다.
   * AI 설명은 신호·근거 **뒤**에 오므로 위치도 여기가 맞다(§12).
   */
  footer?: ReactNode;
}) {
  const gap =
    dimension.mineValue !== null && dimension.theirsValue !== null
      ? Math.abs(dimension.mineValue - dimension.theirsValue)
      : null;

  const compact = density === 'compact';

  return (
    <li
      className={cn(
        'flex flex-col',
        compact
          ? 'gap-2.5 border-t border-line-soft px-1 pt-3.5'
          : 'gap-3 rounded-card border border-line bg-surface p-4',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'flex-none rounded-full',
              compact ? 'h-[5px] w-[5px]' : 'h-[7px] w-[7px]',
              variant === 'good' ? 'bg-brand' : 'bg-friction',
            )}
            aria-hidden
          />
          <h3
            className={cn(
              'font-semibold tracking-[-0.2px]',
              compact ? 'text-caption text-ink-sub' : 'text-body',
            )}
          >
            {dimension.label}
          </h3>
        </div>

        {variant === 'friction' && gap !== null ? (
          <span className="flex-none rounded-[6px] bg-friction-tint px-2 py-1 text-[10.5px] font-semibold text-friction-text">
            차이 {gap}
          </span>
        ) : null}
      </div>

      <ComparePair mine={dimension.minePhrase} theirs={dimension.theirsPhrase} />

      <div className="flex flex-col gap-1.5">
        <p className="text-[10.5px] font-semibold tracking-[0.04em] text-ink-muted">
          {variant === 'good' ? '이런 점이 편할 수 있어' : '일어날 수 있는 상황'}
        </p>
        <p
          className={cn(
            'keep-all leading-relaxed',
            compact
              ? 'text-caption text-ink-sub'
              : variant === 'good'
                ? 'rounded-[10px] bg-mint-tint px-3 py-2.5 text-caption text-mint-ink'
                : 'text-[13.5px] text-ink',
          )}
        >
          {dimension.scene}
        </p>
      </div>

      <details className={cn(compact ? 'pt-0.5' : 'border-t border-line-soft pt-2.5')}>
        <summary className="cursor-pointer list-none text-[11.5px] font-semibold text-brand-pressed">
          이 신호를 본 근거
        </summary>
        <p className="mt-2 text-[12.5px] keep-all leading-relaxed text-[#555]">
          {dimension.evidence}
        </p>
      </details>

      {footer}
    </li>
  );
}
