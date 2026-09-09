import {
  AFFECTION_LABEL,
  CONFLICT_LABEL,
  HOBBY_LABEL,
  HARDEST_LABEL,
  PAST_FACTOR_LABEL,
  SELF_GAP_LABEL,
  STATUS_LABEL,
  TARGET_RELATION_LABEL,
} from '@/data/labels';
import { CURRENT_SIGNAL_VALUES } from '@/data/currentRelationship';
import { TARGET_FIELDS } from '@/data/targetFields';
import { MIRROR_AXES } from '@/data/axes';
import type {
  AffectionStyle,
  ConflictStyle,
  CurrentSignalAnswer,
  HardestMoment,
  HobbyStyle,
  MirrorAxisKey,
  PastFactor,
  RelationshipStatus,
  ScaleValue,
  SelfGapAnswer,
  TargetLevel,
  TargetRelation,
} from '@/types';

/**
 * 저장된 세션 값의 **유효성 강등** (v1.44 · BUG-002)
 *
 * ══ 왜 필요한가 ═══════════════════════════════════════════════════════════
 *
 * `deserialize()`는 모양(배열인가 · 객체인가)은 봤지만 **값**은 보지 않고
 * `...parsed`로 그대로 펼쳤다. 그래서 손상되거나 구버전 enum이 남은 세션에서
 * 이런 일이 실제로 일어났다(v1.43 QA · ERR-002):
 *
 * ```
 * declared.conflict     99              → 화면: '갈등 잠깐 뒤 대화 선호'
 * experience.important  'notanarray'    → 화면: '관계 경험 11'  (문자열 .length)
 * status                'NOT_A_STATUS'  → 판정 경로로 그대로 유입
 * ```
 *
 * 크래시는 없었지만 **근거 없이 확정형 문장을 만들었다.** 이 제품이 하지 않기로 한
 * 바로 그 일이다.
 *
 * ══ 규칙 ═════════════════════════════════════════════════════════════════
 *
 * > **추정하지 않는다. 가장 가까운 값으로 고치지도 않는다. '미입력'으로 강등한다.**
 *
 * `99`를 보고 `'soon'`으로 짐작하면 사용자가 답하지 않은 것을 답한 것처럼 만든다.
 * 유효하지 않은 값이 뜻하는 것은 '무엇을 골랐는지 알 수 없다'뿐이고, 그 상태를 그대로
 * 표현하는 값은 이미 있다 — `null`(스칼라) · `[]`(목록) · 키 없음(맵).
 *
 * ══ enum 목록을 여기서 다시 쓰지 않는다 ══════════════════════════════════
 *
 * 검사에 쓰는 것은 전부 **이미 존재하는 exhaustive `Record<T, string>` 라벨 맵**이다
 * (`STATUS_LABEL`·`CONFLICT_LABEL`·…). 타입에 멤버가 추가되면 TS가 라벨을 강제하므로
 * **검사 범위가 타입을 자동으로 따라간다.** enum 배열을 복사해두면 그 순간부터
 * 조용히 낡는다 — v1.30이 파서 별칭에 대해 내린 것과 같은 판단이다.
 *
 * ⚠️ **`photos`는 이 파일이 다루지 않는다**(§5.3). 구버전 세션에 남은 `source:'sample'`
 * 사진은 `loadSampleSession()` 데모 세션과 **같은 구조**라, 여기서 지우면 데모 세션의
 * 새로고침 동작이 함께 바뀐다. S07의 개수·상한·분석 대상은 이미 `source === 'upload'`
 * 만 보므로 판정에는 영향이 없다. 남은 표시 문제(`/home`의 사진 장수)는 Remaining Risk로
 * 따로 남긴다.
 */

/** exhaustive 라벨 맵의 키인지 — 타입이 넓어지면 검사도 함께 넓어진다 */
function keyOf<T extends string>(record: Record<T, unknown>, value: unknown): T | null {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(record, value)
    ? (value as T)
    : null;
}

export function sanitizeStatus(value: unknown): RelationshipStatus | null {
  return keyOf(STATUS_LABEL, value);
}

/** 1~5 정수만. `'abc'`·`0`·`7`·`2.5`는 전부 미입력이다 */
export function sanitizeScale(value: unknown): ScaleValue | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
    ? (value as ScaleValue)
    : null;
}

export function sanitizeConflict(value: unknown): ConflictStyle | null {
  return keyOf(CONFLICT_LABEL, value);
}

export function sanitizeAffection(value: unknown): AffectionStyle | null {
  return keyOf(AFFECTION_LABEL, value);
}

export function sanitizeHobby(value: unknown): HobbyStyle | null {
  return keyOf(HOBBY_LABEL, value);
}

export function sanitizeHardest(value: unknown): HardestMoment | null {
  return keyOf(HARDEST_LABEL, value);
}

export function sanitizeSelfGap(value: unknown): SelfGapAnswer | null {
  return keyOf(SELF_GAP_LABEL, value);
}

export function sanitizeTargetRelation(value: unknown): TargetRelation | null {
  return keyOf(TARGET_RELATION_LABEL, value);
}

/**
 * 상대 4축. **기본값이 `null`이 아니라 `'x'`(모름)** 이다 — 이 필드는 원래 optional이
 * 아니라 '모름'이라는 명시적 값을 갖는다(`createEmptyTargetProfile`). 모르는 것을
 * 모른다고 두는 것이 강등의 결과다.
 */
export function sanitizeTargetLevel(value: unknown): TargetLevel {
  return value === 'l' || value === 'm' || value === 'h' || value === 'x' ? value : 'x';
}

/** 배열이 아니면 통째로 버린다. 배열이면 유효한 factor만 남기고 중복도 제거한다 */
export function sanitizePastFactors(value: unknown): PastFactor[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<PastFactor>();
  for (const item of value) {
    const factor = keyOf(PAST_FACTOR_LABEL, item);
    if (factor) seen.add(factor);
  }
  return [...seen];
}

/**
 * S30 축→답 맵. 알 수 없는 **축**과 알 수 없는 **답**을 모두 버린다.
 *
 * v1.41 주석은 "알 수 없는 키가 들어와도 `MIRROR_AXES`만 조회하므로 조용히 무시된다"고
 * 적었는데, 그건 축에만 해당하는 말이었다 — 값이 `'BOGUS'`면 그 축은 조회되고 답만
 * 이상한 상태가 된다.
 */
export function sanitizeCurrentSignals(
  value: unknown,
): Partial<Record<MirrorAxisKey, CurrentSignalAnswer>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const axes = new Set<string>(MIRROR_AXES.map((axis) => axis.key));
  const answers = new Set<string>(CURRENT_SIGNAL_VALUES);
  const out: Partial<Record<MirrorAxisKey, CurrentSignalAnswer>> = {};
  for (const [axis, answer] of Object.entries(value as Record<string, unknown>)) {
    if (!axes.has(axis)) continue;
    if (typeof answer !== 'string' || !answers.has(answer)) continue;
    out[axis as MirrorAxisKey] = answer as CurrentSignalAnswer;
  }
  return out;
}

/** 상대 4축 전체를 한 번에 — 축 목록도 `TARGET_FIELDS`에서 가져온다 */
export function sanitizeTargetLevels(
  target: Record<string, unknown> | null | undefined,
): Record<string, TargetLevel> {
  const out: Record<string, TargetLevel> = {};
  for (const field of TARGET_FIELDS) {
    out[field.key] = sanitizeTargetLevel(target?.[field.key]);
  }
  return out;
}
