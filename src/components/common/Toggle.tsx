'use client';

import { cn } from '@/lib/cn';

/** 공유 카드 옵션용 스위치 */
export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-chip border border-line bg-surface p-3.5">
      <span className="min-w-0">
        <span className="block text-[13.5px] keep-all">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[11.5px] keep-all text-ink-muted">{description}</span>
        ) : null}
      </span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'flex h-[22px] w-[38px] flex-none items-center rounded-full p-0.5 transition-colors duration-200',
          checked ? 'justify-end bg-brand' : 'justify-start bg-track',
        )}
      >
        <span className="h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
      </span>
    </label>
  );
}
