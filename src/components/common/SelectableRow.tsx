'use client';

import { cn } from '@/lib/cn';

interface SelectableRowProps {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  /** radio 그룹 이름 — 키보드 탐색과 스크린리더용 */
  name: string;
  value: string;
}

/**
 * 단일 선택 행 (S05 관계 상태 / S11 갈등 / S16 힘들었던 순간 / S17 자기 차이)
 * 실제 radio input을 쓰고, 선택 상태는 배경·테두리·굵기·인디케이터 4가지로 드러낸다.
 */
export function SelectableRow({
  label,
  description,
  selected,
  onSelect,
  name,
  value,
}: SelectableRowProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3 rounded-row border p-4 transition-colors duration-200',
        selected ? 'border-brand bg-brand-tint' : 'border-line bg-surface active:bg-sunken',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        className="peer sr-only"
      />

      <span className="min-w-0">
        <span
          className={cn(
            'block text-body keep-all',
            selected ? 'font-semibold' : 'font-normal',
          )}
        >
          {label}
        </span>
        {description ? (
          <span className="mt-1 block text-[12.5px] keep-all text-ink-sub">{description}</span>
        ) : null}
      </span>

      <span
        aria-hidden
        className={cn(
          'flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border transition-colors',
          selected ? 'border-brand bg-brand' : 'border-line-strong bg-transparent',
        )}
      >
        {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
      </span>
    </label>
  );
}
