'use client';

import { ChoiceChip } from '@/components/common/ChoiceChip';
import { InlineError, SectionLabel } from '@/components/common/primitives';
import { BIRTH_COPY } from '@/data/copy';
import { validateBirthDate, validateBirthTime } from '@/lib/logic/birth';
import type { BirthProfile, CalendarType } from '@/types';

/**
 * Birth Profile 입력 폼 — 나 / 상대 공용
 *
 * Progressive Input(§7): 생년월일(LEVEL 1)만 있으면 태양궁까지 볼 수 있고,
 * 출생시간(LEVEL 2)·지역(LEVEL 3)은 그걸 필요로 하는 결과에만 쓰인다.
 * 없는 정보를 기본값으로 채우지 않는다 — 비어 있으면 비어 있는 대로 둔다.
 */

const CALENDAR_OPTIONS: readonly { value: CalendarType; label: string }[] = [
  { value: 'solar', label: '양력' },
  { value: 'lunar', label: '음력' },
];

/** `YYYY-MM-DD` ↔ 화면 표기 `YYYY.MM.DD` */
function toDisplayDate(value: string | null): string {
  return value ? value.replace(/-/g, '.') : '';
}

/** 사용자가 `.` `/` `-` 어떤 걸 써도 받아준다 */
function toStoredDate(input: string): string | null {
  const digits = input.replace(/[^\d]/g, '');
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function toStoredTime(input: string): string | null {
  const digits = input.replace(/[^\d]/g, '');
  if (digits.length !== 4) return null;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

export function BirthProfileForm({
  profile,
  onChange,
  today,
  idPrefix,
  hint,
}: {
  profile: BirthProfile;
  onChange: (patch: Partial<BirthProfile>) => void;
  today: Date;
  idPrefix: string;
  hint?: string;
}) {
  const dateError = profile.date ? validateBirthDate(profile.date, today) : null;
  const timeError = validateBirthTime(profile.time);

  const dateMessage =
    dateError === 'format'
      ? BIRTH_COPY.errors.format
      : dateError === 'invalid'
        ? BIRTH_COPY.errors.invalid
        : dateError === 'future'
          ? BIRTH_COPY.errors.future
          : dateError === 'tooOld'
            ? BIRTH_COPY.errors.tooOld
            : null;

  const timeMessage =
    timeError === 'format'
      ? BIRTH_COPY.errors.timeFormat
      : timeError === 'invalid'
        ? BIRTH_COPY.errors.timeInvalid
        : null;

  return (
    <div className="flex flex-col gap-4 rounded-[16px] border border-line bg-surface p-4">
      {hint ? <p className="text-[11.5px] keep-all text-ink-faint">{hint}</p> : null}

      {/* LEVEL 1 — 생년월일 */}
      <div className="flex flex-col gap-2">
        <label className="text-caption font-semibold text-[#555]" htmlFor={`${idPrefix}-date`}>
          {BIRTH_COPY.dateLabel}
        </label>
        <input
          id={`${idPrefix}-date`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1995.08.12"
          defaultValue={toDisplayDate(profile.date)}
          onBlur={(event) => {
            const raw = event.target.value.trim();
            if (raw === '') return onChange({ date: null });
            // 8자리가 안 되면 저장하지 않고 입력값만 남겨 사용자가 고칠 수 있게 한다.
            const stored = toStoredDate(raw);
            onChange({ date: stored ?? raw });
          }}
          aria-invalid={dateMessage ? true : undefined}
          className="h-[50px] rounded-row border border-line bg-canvas px-3.5 text-sub tnum outline-none placeholder:text-ink-faint focus:border-brand"
        />
        {dateMessage ? <InlineError message={dateMessage} /> : null}
      </div>

      {/* 달력 */}
      <div className="flex flex-col gap-2">
        <SectionLabel className="px-0">{BIRTH_COPY.calendarLabel}</SectionLabel>
        <div className="flex flex-wrap gap-[7px]" role="radiogroup" aria-label={BIRTH_COPY.calendarLabel}>
          {CALENDAR_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.value}
              label={option.label}
              selected={profile.calendarType === option.value}
              onToggle={() => onChange({ calendarType: option.value })}
            />
          ))}
        </div>
      </div>

      {/* LEVEL 2 — 출생 시간 (Optional) */}
      <div className="flex flex-col gap-2">
        <label className="text-caption font-semibold text-[#555]" htmlFor={`${idPrefix}-time`}>
          {BIRTH_COPY.timeLabel}
        </label>
        <input
          id={`${idPrefix}-time`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="14:30"
          disabled={profile.timeUnknown}
          defaultValue={profile.time ?? ''}
          onBlur={(event) => {
            const raw = event.target.value.trim();
            if (raw === '') return onChange({ time: null });
            const stored = toStoredTime(raw);
            onChange({ time: stored ?? raw });
          }}
          aria-invalid={timeMessage ? true : undefined}
          className="h-[50px] rounded-row border border-line bg-canvas px-3.5 text-sub tnum outline-none placeholder:text-ink-faint focus:border-brand disabled:opacity-40"
        />
        {timeMessage ? <InlineError message={timeMessage} /> : null}

        <ChoiceChip
          label={BIRTH_COPY.timeUnknownLabel}
          selected={profile.timeUnknown}
          // '모름'을 켜면 이전에 입력한 시간은 비운다 — 두 상태가 동시에 참일 수 없다.
          onToggle={() =>
            onChange(
              profile.timeUnknown
                ? { timeUnknown: false }
                : { timeUnknown: true, time: null },
            )
          }
        />
      </div>

      {/* LEVEL 3 — 출생 지역 (Optional) */}
      <div className="flex flex-col gap-2">
        <label className="text-caption font-semibold text-[#555]" htmlFor={`${idPrefix}-city`}>
          {BIRTH_COPY.locationLabel}
        </label>
        <input
          id={`${idPrefix}-city`}
          type="text"
          autoComplete="off"
          placeholder="서울"
          defaultValue={profile.location?.city ?? ''}
          onBlur={(event) => {
            const city = event.target.value.trim();
            onChange({ location: city ? { ...profile.location, city } : null });
          }}
          className="h-[50px] rounded-row border border-line bg-canvas px-3.5 text-sub outline-none placeholder:text-ink-faint focus:border-brand"
        />
        <p className="text-[11px] keep-all text-ink-faint">{BIRTH_COPY.locationHint}</p>
      </div>
    </div>
  );
}
