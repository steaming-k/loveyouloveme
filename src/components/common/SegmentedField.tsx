'use client';

import { cn } from '@/lib/cn';
import type { TargetLevel } from '@/types';

interface SegmentedFieldProps {
  label: string;
  value: TargetLevel;
  options: readonly { value: 'l' | 'm' | 'h'; label: string }[];
  onChange: (value: TargetLevel) => void;
  name: string;
}

/**
 * 상대 정보 3단 선택 + '모름' (S19)
 * 모르는 항목은 비워둘 수 있어야 하고, 그 항목은 동기화율 계산에서 제외된다.
 */
export function SegmentedField({ label, value, options, onChange, name }: SegmentedFieldProps) {
  return (
    <fieldset className="flex flex-col">
      {/* <legend>은 fieldset이 flex여도 gap에 반응하지 않는 브라우저 동작이 있어
          margin-bottom으로 직접 간격을 준다 */}
      <legend className="mb-2 text-[13.5px] font-semibold">{label}</legend>

      <div className="flex gap-1.5">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                'flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[10px] border px-1 py-2.5 text-center text-[12.5px] transition-colors duration-200',
                selected
                  ? 'border-brand bg-brand-tint font-semibold'
                  : 'border-line bg-surface active:bg-sunken',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="keep-all">{option.label}</span>
            </label>
          );
        })}

        <label
          className={cn(
            'flex min-h-11 w-[52px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-dashed px-1 py-2.5 text-center text-[12.5px] transition-colors duration-200',
            value === 'x'
              ? 'border-brand bg-brand-tint font-semibold text-brand-pressed'
              : 'border-line-strong bg-surface text-ink-muted active:bg-sunken',
          )}
        >
          <input
            type="radio"
            name={name}
            value="x"
            checked={value === 'x'}
            onChange={() => onChange('x')}
            className="sr-only"
          />
          모름
        </label>
      </div>
    </fieldset>
  );
}
