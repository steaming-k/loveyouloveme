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
        /*
          v1.46 §26 — press scale 1 → 0.98 → 1 (90ms) + 색 전환(150ms).

          ⚠️ **클래스 하나다.** `transition-colors`를 따로 붙이지 않는다 —
          `transition`은 단축 속성이라 두 규칙이 겹치면 뒤엣것이 앞엣것의
          transition-property를 통째로 덮어쓰고, 실측에서 실제로 버튼 색 전환이
          0ms가 됐다(globals.css `.press-scale` 주석 참고).
          ⚠️ `disabled`에는 press 반응이 붙지 않아야 하지만, 눌리지 않는 버튼은
          `:active`가 발생하지 않으므로 별도 분기가 필요 없다.
        */
        'inline-flex select-none items-center justify-center gap-1.5 press-scale',
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
