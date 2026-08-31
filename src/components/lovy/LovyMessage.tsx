import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import type { LovyPose } from '@/data/lovy';
import { Lovy } from './Lovy';

interface LovyMessageProps {
  /** 아바타 포즈. 일반 입력 화면에서는 38~46px로 작게 쓴다. */
  pose?: LovyPose;
  size?: number;
  children: ReactNode;
  /** 첫 줄을 강조하는 2단 말풍선 (Mirror Teaser) */
  emphasis?: string;
  className?: string;
  /** 아바타 없이 말풍선만 */
  bubbleOnly?: boolean;
  tone?: 'body' | 'lead';
}

/**
 * 러비 말풍선.
 * Mint는 러비·관찰의 색이다. 분석 결과(Purple)와 섞지 않는다.
 */
export function LovyMessage({
  pose = 'question',
  size = 40,
  children,
  emphasis,
  className,
  bubbleOnly = false,
  tone = 'body',
}: LovyMessageProps) {
  return (
    <div className={cn('flex items-start gap-2.5 px-0.5', className)}>
      {bubbleOnly ? null : <Lovy pose={pose} size={size} decorative className="mt-0.5" />}

      <div className="flex min-w-0 flex-col gap-1.5">
        {emphasis ? (
          <p className="self-start rounded-[4px_16px_16px_16px] bg-mint-tint px-3.5 py-3 text-body font-semibold">
            {emphasis}
          </p>
        ) : null}
        <div
          className={cn(
            'keep-all bg-mint-tint px-3.5 py-3 text-ink',
            emphasis ? 'rounded-[16px]' : 'rounded-[4px_14px_14px_14px]',
            tone === 'lead' ? 'text-body' : 'text-[13.5px] leading-relaxed',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
