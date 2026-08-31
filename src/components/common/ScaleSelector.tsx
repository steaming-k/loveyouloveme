'use client';

import { cn } from '@/lib/cn';
import type { ScaleValue } from '@/types';

const VALUES: ScaleValue[] = [1, 2, 3, 4, 5];

interface ScaleSelectorProps {
  value: ScaleValue | null;
  onChange: (value: ScaleValue) => void;
  minLabel: string;
  maxLabel: string;
  /** 접근성용 질문 텍스트 */
  legend: string;
  describedBy?: string;
}

/** 1~5 스케일 (S10 연락 / S12 개인 시간) */
export function ScaleSelector({
  value,
  onChange,
  minLabel,
  maxLabel,
  legend,
  describedBy,
}: ScaleSelectorProps) {
  return (
    <fieldset className="flex flex-col gap-2.5" aria-describedby={describedBy}>
      <legend className="sr-only">{legend}</legend>

      <div className="flex gap-1.5">
        {VALUES.map((option) => {
          const selected = value === option;
          return (
            <label
              key={option}
              className={cn(
                'flex h-[60px] flex-1 cursor-pointer items-center justify-center rounded-chip border text-[17px] transition-colors duration-200',
                selected
                  ? 'border-brand bg-brand-tint font-semibold'
                  : 'border-line bg-surface active:bg-sunken',
              )}
            >
              <input
                type="radio"
                name={legend}
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              {option}
            </label>
          );
        })}
      </div>

      <div className="flex justify-between px-1 text-meta text-ink-muted">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </fieldset>
  );
}
