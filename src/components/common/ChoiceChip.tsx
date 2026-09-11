'use client';

import { cn } from '@/lib/cn';

interface ChoiceChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** 다중 선택이면 checkbox, 단일 선택이면 radio 시맨틱 */
  multi?: boolean;
}

/** 선택 칩 (S13 애정·취미 / S15 중요했던 요소 / S19 관계) */
export function ChoiceChip({
  label,
  selected,
  onToggle,
  disabled = false,
  multi = false,
}: ChoiceChipProps) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        // v1.46 §26 Selection — 테두리·배경 transition + press scale
        'min-h-11 rounded-full border px-[15px] py-[11px] text-sub press-scale',
        selected
          ? 'border-brand bg-brand-tint font-semibold text-ink'
          : 'border-line bg-surface text-ink active:bg-sunken',
        disabled && 'opacity-40',
      )}
    >
      {label}
    </button>
  );
}
