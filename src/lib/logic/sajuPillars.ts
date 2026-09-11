import {
  BRANCH_ANIMAL,
  BRANCH_ELEMENT,
  BRANCH_HANJA,
  BRANCH_POLARITY,
  EARTHLY_BRANCHES,
  ELEMENT_CONTROLS,
  ELEMENT_GENERATES,
  HEAVENLY_STEMS,
  STEM_ELEMENT,
  STEM_HANJA,
  STEM_POLARITY,
  type EarthlyBranch,
  type ElementRelation,
  type HeavenlyStem,
  type SajuElement,
  type SajuPolarity,
} from '@/data/saju';
import { hasUsableBirthTime, isBirthDateUsable } from '@/lib/logic/birth';
import type { BirthProfile } from '@/types';

/**
 * 사주 일주(日柱) 계산 — v1.46 PremiumLens
 *
 * ══ 왜 일주만인가 ═════════════════════════════════════════════════════════
 *
 * `services/sajuService.ts`가 사주 엔진을 거부한 이유는 지금도 전부 유효하다:
 * 절입(節入) 시각 · 진태양시 · 출생지 경도 보정 · 연월주 세우기 규칙이 없으면
 * **명식을 세울 수 없다.** 그 판단을 뒤집지 않는다.
 *
 * 뒤집지 않고도 정확히 계산할 수 있는 기둥이 하나 있다 — **일주**다.
 *
 * ```
 * 연주  입춘 시각 필요        → 세우지 않음
 * 월주  12절기 경계 필요      → 세우지 않음
 * 일주  60일 주기의 순수 순환 → 계산 가능      ← 이 파일이 하는 일
 * 시주  진태양시 + 출생시각   → 세우지 않음
 * ```
 *
 * 일주는 그레고리력 날짜에서 **율리우스 적일(JDN)을 구해 60으로 나눈 나머지**다.
 * 절기도 경도 보정도 개입하지 않는 산술 순환이라, 근사가 아니라 정확하다.
 *
 * ══ 기준점 검증 (⚠️ 이 값을 고치기 전에 반드시 읽을 것) ═══════════════════
 *
 * ```
 * index = (JDN + 49) mod 60     index 0 = 갑자(甲子)
 * ```
 *
 * 이 상수는 기억이 아니라 **실제 만세력 2건으로 교차 검증**했다:
 *
 * ```
 * 2024-01-01  →  갑자(甲子)     만세력 확인 · 이 공식의 계산값과 일치
 * 1990-05-15  →  경진(庚辰)     만세력 확인 · 이 공식의 계산값과 일치
 * ```
 *
 * 34년 떨어진 두 날짜가 모두 맞으므로 60주기 offset이 어긋나지 않았다.
 * `tests/run-lens-fixtures.mjs`의 SAJU-CALC 블록이 이 두 날짜를 고정한다 —
 * 누가 offset을 건드리면 테스트가 먼저 빨개진다.
 *
 * ══ ⚠️ 이 파일이 하지 않는 일 ══════════════════════════════════════════════
 *
 * ⚠️ **음력을 환산하지 않는다.** 환산에는 검증된 음양력 대조표가 필요하고 그건
 * 없다. `calendarType === 'lunar'`이면 계산하지 않고 `null`을 돌려준다 —
 * 양력으로 취급해서 조용히 틀린 일주를 주지 않는다.
 *
 * ⚠️ **야자시(夜子時) 규칙을 적용하지 않는다.** 23시 이후 출생을 다음 날 일주로
 * 넘기는 관례가 있지만 유파에 따라 다르다. 한쪽 관례를 말없이 적용하면 그 시각에
 * 태어난 사용자에게 조용히 다른 결과를 주게 되므로, 규칙을 고르는 대신
 * **경계에 있다는 사실을 한계로 알린다**(`nearDayBoundary`).
 *
 * ⚠️ **점수를 만들지 않는다.** 동기화율·Mirror·History 어디에도 이 파일의
 * 결과가 들어가지 않는다(§45). 이 파일을 import하는 곳은 `logic/premiumLens.ts`
 * 하나뿐이고, 그 사실을 LENS-11/LENS-12가 정적으로 검사한다.
 */

/* ────────────────────────────────────────────────── 율리우스 적일 */

/**
 * 그레고리력 → JDN. 표준 Fliegel–Van Flandern 공식이다.
 *
 * ⚠️ `Date`를 쓰지 않는다. 시간대·서머타임·로컬 오프셋이 끼면 날짜가 하루
 * 밀릴 수 있고, 그 하루가 곧 다른 일주다. 정수 산술만 쓴다.
 */
export function julianDayNumber(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;

  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/** 60갑자 index (0 = 갑자). 검증 근거는 파일 상단 참고. */
const SEXAGENARY_OFFSET = 49;

export interface DayPillar {
  /** 0~59. 0 = 갑자 */
  index: number;
  stem: HeavenlyStem;
  branch: EarthlyBranch;
  /** `갑자` — 한글 두 글자 */
  label: string;
  /** `甲子` */
  hanja: string;
  stemElement: SajuElement;
  branchElement: SajuElement;
  stemPolarity: SajuPolarity;
  branchPolarity: SajuPolarity;
  /** 일지의 띠 동물. 연지가 아니므로 '무슨 띠'라고 부르지 않는다 */
  branchAnimal: string;
}

/**
 * `YYYY-MM-DD`(양력) → 일주. 형식이 어긋나거나 존재하지 않는 날짜면 `null`.
 *
 * ⚠️ 존재하지 않는 날짜(2월 30일 등)에 임의의 일주를 돌려주지 않는다 —
 * `logic/birth.ts`의 `validateBirthDate`와 같은 원칙이다.
 */
export function dayPillarOf(dateIso: string | null | undefined): DayPillar | null {
  if (!dateIso) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // 되돌려 비교해 존재하지 않는 날짜를 걸러낸다.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  const index = (((julianDayNumber(year, month, day) + SEXAGENARY_OFFSET) % 60) + 60) % 60;
  const stem = HEAVENLY_STEMS[index % 10]!;
  const branch = EARTHLY_BRANCHES[index % 12]!;

  return {
    index,
    stem,
    branch,
    label: `${stem}${branch}`,
    hanja: `${STEM_HANJA[stem]}${BRANCH_HANJA[branch]}`,
    stemElement: STEM_ELEMENT[stem],
    branchElement: BRANCH_ELEMENT[branch],
    stemPolarity: STEM_POLARITY[stem],
    branchPolarity: BRANCH_POLARITY[branch],
    branchAnimal: BRANCH_ANIMAL[branch],
  };
}

/* ────────────────────────────────────────────── BirthProfile 진입점 */

export interface SajuDayReading {
  pillar: DayPillar;
  /** 이 결과에 붙는 한계. 항상 최소 1개(계산 범위 고지)다 */
  limitations: string[];
}

/** 자시 경계(23:00~23:59)에 걸리는지 — 유파에 따라 일주가 갈리는 구간 */
function nearDayBoundary(profile: BirthProfile): boolean {
  if (!hasUsableBirthTime(profile)) return false;
  return profile.time!.startsWith('23:');
}

/**
 * BirthProfile → 일주 읽기. **계산할 수 없으면 `null`이다.**
 *
 * `null`을 돌려주는 경우는 셋뿐이고 전부 '데이터가 없거나 환산이 불가능한' 경우다:
 * 생년월일 없음 · 유효하지 않은 날짜 · 음력 입력.
 */
export function readSajuDay(profile: BirthProfile, today: Date): SajuDayReading | null {
  if (!isBirthDateUsable(profile, today)) return null;
  // ⚠️ 음력을 양력처럼 계산하지 않는다. 환산표가 없으면 결과도 없다.
  if (profile.calendarType === 'lunar') return null;

  const pillar = dayPillarOf(profile.date);
  if (!pillar) return null;

  const limitations: string[] = [];
  if (nearDayBoundary(profile)) {
    limitations.push(
      '밤 11시대에 태어났다고 입력했어. 이 시간대는 일주를 어느 날로 볼지 해석이 갈려서, 결과가 다르게 나올 수 있어.',
    );
  }
  if (!hasUsableBirthTime(profile) && !profile.timeUnknown) {
    // 시주를 세우지 않으므로 시간이 없어도 일주는 정확하다 — 그 사실을 알려준다.
    limitations.push('출생 시간은 없어도 일주 계산에는 영향이 없어. 시주를 세우지 않기 때문이야.');
  }

  return { pillar, limitations };
}

/** 음력 입력이라 계산하지 못한 경우인지 — 화면이 이유를 정확히 말하기 위해 */
export function isLunarBlocked(profile: BirthProfile, today: Date): boolean {
  return isBirthDateUsable(profile, today) && profile.calendarType === 'lunar';
}

/* ──────────────────────────────────────────────────── 오행 관계 */

/**
 * 두 일간 오행의 관계. **`mine` 기준**이다 — 방향이 있으므로 인자 순서가 결과를
 * 바꾼다(`i_generate`와 `they_generate`는 서로 다른 문장이다).
 */
export function elementRelation(mine: SajuElement, theirs: SajuElement): ElementRelation {
  if (mine === theirs) return 'same';
  if (ELEMENT_GENERATES[mine] === theirs) return 'i_generate';
  if (ELEMENT_GENERATES[theirs] === mine) return 'they_generate';
  if (ELEMENT_CONTROLS[mine] === theirs) return 'i_control';
  /**
   * 오행 5개에서 같음·생2·극2는 서로 배타적이고 합쳐서 전부를 덮는다.
   * 그래서 여기 도달하면 반드시 `they_control`이다 — 기본값이 아니라 나머지 하나다.
   */
  return 'they_control';
}
