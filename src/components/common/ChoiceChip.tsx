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
        /*
          v1.48 §10 — 선택 전은 가볍게(테두리 없음), 선택되면 테두리 · 배경 ·
          굵기가 함께 들어온다. `SelectableRow`와 **같은 규칙**을 쓴다 —
          같은 성격의 선택이 컴포넌트마다 다른 규칙을 가지면 그건 시스템이 아니다.
          ⚠️ 테두리 두께는 유지하고 색만 transparent로 둔다(CLS 0).
        */
        selected
          ? 'border-brand bg-brand-tint font-semibold text-ink'
          : 'border-transparent bg-canvas-warm text-ink active:bg-sunken',
        disabled && 'opacity-40',
      )}
    >
      {label}
    </button>
  );
}
