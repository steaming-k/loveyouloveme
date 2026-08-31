'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'text' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

/** 최소 터치 타깃 44px을 모든 변형에서 지킨다. */
const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'h-[54px] rounded-btn bg-brand text-white text-[16px] font-semibold tracking-[-0.3px] ' +
    'active:bg-brand-pressed disabled:opacity-40',
  secondary:
    'h-[50px] rounded-btn bg-surface border border-line text-[15px] font-medium text-ink ' +
    'active:bg-sunken active:border-line-strong disabled:opacity-40',
  text: 'h-11 text-sub text-ink-sub active:text-ink disabled:opacity-40',
  ghost:
    'h-[46px] rounded-row border border-line bg-surface text-caption text-ink ' +
    'active:bg-sunken disabled:opacity-40',
};

export function Button({
  variant = 'primary',
  loading = false,
  fullWidth = true,
  className,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center gap-1.5 transition-colors duration-200',
        fullWidth && 'w-full',
        VARIANT_CLASS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <LoadingDots /> : children}
    </button>
  );
}

function LoadingDots() {
  return (
    <span className="flex items-center gap-1.5" aria-label="처리 중">
      <span className="h-[7px] w-[7px] rounded-full bg-current opacity-90" />
      <span className="h-[7px] w-[7px] rounded-full bg-current opacity-55" />
      <span className="h-[7px] w-[7px] rounded-full bg-current opacity-30" />
    </span>
  );
}
