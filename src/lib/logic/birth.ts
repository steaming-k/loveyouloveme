import type { BirthProfile, LensAvailability } from '@/types';

/**
 * Birth Profile 공용 로직 — 검증 · 표시 · Lens 가용성 판정
 *
 * 원칙: **없는 정보를 채워 넣지 않는다.** 출생시간이 없으면 시간이 필요한 결과를 만들지 않고,
 * 생년월일이 없으면 어떤 Lens도 계산하지 않는다. 기본값으로 그럴듯한 결과를 만들지 않는다.
 */

export function createEmptyBirthProfile(): BirthProfile {
  return { date: null, time: null, timeUnknown: false, calendarType: 'solar', location: null };
}

/** 입력이 하나라도 있는지 (저장 여부 판단용) */
export function hasAnyBirthInput(profile: BirthProfile): boolean {
  return Boolean(profile.date || profile.time || profile.timeUnknown || profile.location);
}

/* ------------------------------------------------------------------ 검증 */

export type BirthDateError = 'empty' | 'format' | 'invalid' | 'future' | 'tooOld' | null;

/** 실제로 존재하는 날짜인지 + 미래가 아닌지. `YYYY-MM-DD`만 받는다. */
export function validateBirthDate(raw: string | null, today: Date): BirthDateError {
  if (!raw) return 'empty';

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return 'format';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);
  // 2월 30일처럼 존재하지 않는 날짜는 Date가 조용히 굴러가므로 되돌려 비교한다.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return 'invalid';
  }

  if (date.getTime() > today.getTime()) return 'future';
  if (year < 1900) return 'tooOld';

  return null;
}

export type BirthTimeError = 'format' | 'invalid' | null;

export function validateBirthTime(raw: string | null): BirthTimeError {
  if (!raw) return null; // 시간은 Optional — 없는 게 오류는 아니다

  const match = /^(\d{2}):(\d{2})$/.exec(raw);
  if (!match) return 'format';

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return 'invalid';

  return null;
}

/**
 * 사용자가 적은 시간을 `HH:MM`으로 맞춘다 (UT-1 P2 §3).
 *
 * ```
 * 1030 · 10:30 · 10.30 → 10:30
 * 930  · 9:30          → 09:30     ← v1.46.3까지는 둘 다 형식 오류였다
 * ```
 *
 * ⚠️ **세 자리를 `HMM`으로 읽는다.** `930`은 9시 30분이지 93시 0분이 아니다.
 * 그래서 `999`는 `09:99`가 되고 아래 `validateBirthTime`이 **분 99로 걸러낸다** —
 * 형식 오류가 아니라 '없는 시간'으로 분류될 뿐, 통과하지는 않는다.
 *
 * ⚠️ **여기서 유효성을 판정하지 않는다.** 이 함수는 모양만 맞추고, 시·분 범위 검사는
 * `validateBirthTime` 하나가 한다 — 검사가 두 벌이 되면 갈린다. 모양조차 못 맞추면
 * `null`을 돌려주고, 호출부는 사용자가 적은 값을 그대로 둬서 화면에 오류가 보이게
 * 한다(조용히 지우지 않는다).
 *
 * ⚠️ 출생시간은 **여전히 Optional이다.** 이 함수가 생겼다고 필수가 되지 않는다 —
 * 시간이 필요한 계산은 전부 `hasUsableBirthTime`이 막고 있다(§7 Progressive Input).
 */
export function normalizeBirthTime(input: string): string | null {
  const digits = input.replace(/[^\d]/g, '');
  if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  if (digits.length === 3) return `0${digits.slice(0, 1)}:${digits.slice(1, 3)}`;
  return null;
}

/** 이 프로필로 날짜 기반 계산이 가능한지 */
export function isBirthDateUsable(profile: BirthProfile, today: Date): boolean {
  return validateBirthDate(profile.date, today) === null;
}

/** 시간이 필요한 계산(시주·Natal)이 가능한지 */
export function hasUsableBirthTime(profile: BirthProfile): boolean {
  return Boolean(profile.time) && validateBirthTime(profile.time) === null;
}

/* -------------------------------------------------------------- 가용성 */

/**
 * Self Lens / Couple Lens 가능 여부.
 * 한쪽만 있으면 Couple 결과를 만들지 않는다 — 과거 MBTI Lens와 같은 원칙이다.
 */
export function lensAvailability(
  mine: BirthProfile,
  theirs: BirthProfile,
  today: Date,
): LensAvailability {
  const selfOk = isBirthDateUsable(mine, today);
  const targetOk = isBirthDateUsable(theirs, today);

  const missing: LensAvailability['missing'] =
    selfOk && targetOk ? 'none' : !selfOk && !targetOk ? 'both' : !selfOk ? 'self' : 'target';

  return { self: selfOk, couple: selfOk && targetOk, missing };
}

/* ------------------------------------------------------------------ 표시 */

const CALENDAR_LABEL: Record<BirthProfile['calendarType'], string> = {
  solar: '양력',
  lunar: '음력',
};

/** `1995.08.12 · 양력 · 14:30` — 없는 항목은 아예 쓰지 않는다 */
export function formatBirthSummary(profile: BirthProfile): string {
  if (!profile.date) return '입력 없음';

  const parts = [profile.date.replace(/-/g, '.'), CALENDAR_LABEL[profile.calendarType]];

  /**
   * ⚠️ UT-1 P2 §3 — **유효한 시간만 보여준다.**
   *
   * 형식이 틀린 입력은 사용자가 고칠 수 있도록 세션에 **적은 그대로** 남는다
   * (`BirthProfileForm`의 `stored ?? raw`). 그래서 예전에는 `profile.time`만 보고
   * `1995.08.12 · 양력 · 999`처럼 요약 줄에 그 값이 그대로 나갈 수 있었다.
   * 계산은 `hasUsableBirthTime`이 이미 막고 있었으므로 결과가 틀린 적은 없지만,
   * 요약 줄은 그 게이트를 지나지 않았다.
   */
  if (hasUsableBirthTime(profile)) parts.push(profile.time!);
  else if (profile.timeUnknown) parts.push('시간 모름');

  if (profile.location?.city) parts.push(profile.location.city);

  return parts.join(' · ');
}
