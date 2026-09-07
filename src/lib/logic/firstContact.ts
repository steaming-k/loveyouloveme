import { MIRROR_AXES } from '@/data/axes';
import {
  FIRST_CONTACT_ACTIONS,
  FIRST_CONTACT_OBSERVATION,
  GETTING_TO_KNOW,
  HEADLINE_CLAUSE,
  SELF_APPROACH_TEXT,
  SELF_PAIR_RULES,
  SELF_VALUE_TEXT,
  type SelfLevel,
} from '@/data/firstContact';
import { TARGET_FIELDS } from '@/data/targetFields';
import type {
  DeclaredPreference,
  FirstContactAction,
  FirstContactReport,
  RelationshipExperience,
  SelfSignal,
  SelfSignalKey,
  SelfSignalPair,
  SoloMode,
  TargetProfile,
} from '@/types';

/**
 * First Contact Report — **상대 없이 나를 관찰한다** (v1.29 · P4)
 *
 * 이 서비스의 기존 리포트는 전부 '두 사람'을 전제로 한다. 동기화율은 나와 상대를 비교하고,
 * Mirror는 말한 나와 관계 속의 나를 비교한다. 그래서 상대가 없고 경험도 없는 사용자는
 * 비교할 것이 없어서 **아무것도 못 본다**(P4 Audit 실측).
 *
 * 그런데 비교할 것이 없다는 말은 관찰할 것이 없다는 말이 아니다. 사용자는 이미
 * '관계에서 무엇이 중요한가'에 답했다. 그 답들은 서로 관계를 맺고 있다 —
 * 어떤 두 답은 같은 방향을 가리키고, 어떤 두 답은 같은 자리에서 부딪힌다.
 *
 *   COUPLE   나와 상대 **사이의** 차이
 *   SOLO     나 안에서 **함께 나타나는** 기준
 *
 * ⚠️ **새 점수를 만들지 않는다.** '관계 준비도'도 '연애 성공 확률'도 없다(§29).
 * `emphasis`는 문장을 고르는 순서에만 쓰고 화면에 숫자로 나가지 않는다.
 *
 * ⚠️ 이 파일은 `CompatibilityResult`도 `MirrorReport`도 import하지 않는다.
 * 상대 정보나 관계 경험이 없어도 이 리포트는 온전해야 하기 때문이다 —
 * v1.25 `mbtiPattern.ts`가 `CompatibilityResult`를 import하지 않는 것과 같은 이유다.
 */

/** 문장을 고르는 축 순서. 기존 제품 결정(`MIRROR_AXES`)을 그대로 따른다 */
const AXIS_ORDER: readonly SelfSignalKey[] = MIRROR_AXES.map((axis) => axis.key);
const AXIS_LABEL = new Map(MIRROR_AXES.map((axis) => [axis.key, axis.label]));

/** 리포트를 만들 최소 재료. 이보다 적으면 만들지 않는다(억지로 채우지 않는다) */
const MIN_SIGNALS = 3;
/** 한 화면에서 읽을 수 있는 만큼만. 목록이 길어지면 일반 연애 팁처럼 읽힌다(§31) */
const MAX_ACTIONS = 3;
const MAX_PAIRS = 2;

/**
 * 5점 척도와 3지 선택을 같은 층위로 읽는다.
 *
 * ⚠️ 이 값은 **문장 선택 키**다. 3을 '보통'으로 두는 것은 척도 UI가 그렇게 생겼기
 * 때문이고, 중앙에서 멀다는 것이 '더 강하다'거나 '더 좋다'는 뜻은 아니다.
 */
function levelOf(axis: SelfSignalKey, declared: DeclaredPreference): SelfLevel | null {
  switch (axis) {
    case 'contact':
    case 'alone': {
      const value = declared[axis];
      if (value === null) return null;
      if (value <= 2) return 'low';
      return value >= 4 ? 'high' : 'mid';
    }
    case 'conflict': {
      const value = declared.conflict;
      if (value === null) return null;
      if (value === 'now') return 'high';
      return value === 'space' ? 'low' : 'mid';
    }
    case 'affection': {
      const value = declared.affection;
      if (value === null) return null;
      if (value === 'a3') return 'high';
      return value === 'a1' ? 'low' : 'mid';
    }
    case 'hobby': {
      const value = declared.hobby;
      if (value === null) return null;
      if (value === 'h3') return 'high';
      return value === 'h1' ? 'low' : 'mid';
    }
    default:
      return null;
  }
}

/** 중앙에서 얼마나 떨어졌는가 — 정렬 전용 */
function emphasisOf(axis: SelfSignalKey, declared: DeclaredPreference, level: SelfLevel): 0 | 1 | 2 {
  if (axis === 'contact' || axis === 'alone') {
    const value = declared[axis];
    if (value === null) return 0;
    return Math.abs(value - 3) as 0 | 1 | 2;
  }
  return level === 'mid' ? 0 : 2;
}

/**
 * 한 축의 단계를 실제 답에서 고른다 (v1.36).
 *
 * ⚠️ **단계 경계는 이 파일에만 있다.** Mirror의 `declaredPhraseOf`가 이 함수를 부르므로,
 * First Contact와 Mirror가 같은 답을 언제나 같은 단계로 부른다 — 경계가 두 벌이 되면
 * 같은 사용자가 화면마다 다르게 설명된다.
 */
export function selfLevelOf(axis: SelfSignalKey, declared: DeclaredPreference): SelfLevel | null {
  return levelOf(axis, declared);
}

export function buildSelfLevels(declared: DeclaredPreference): Map<SelfSignalKey, SelfLevel> {
  const levels = new Map<SelfSignalKey, SelfLevel>();
  for (const axis of AXIS_ORDER) {
    const level = levelOf(axis, declared);
    if (level) levels.set(axis, level);
  }
  return levels;
}

/**
 * 내가 답한 기준들.
 *
 * 정렬은 `emphasis` 내림차순 → `AXIS_ORDER`다. **랜덤이 없다** — 같은 답에는 항상 같은
 * 순서가 나온다(v1.20 이후 결정론 원칙).
 */
function buildSignals(
  declared: DeclaredPreference,
  levels: Map<SelfSignalKey, SelfLevel>,
): SelfSignal[] {
  const signals: SelfSignal[] = [];

  for (const axis of AXIS_ORDER) {
    const level = levels.get(axis);
    if (!level) continue;
    signals.push({
      key: axis,
      label: AXIS_LABEL.get(axis) ?? axis,
      valueText: SELF_VALUE_TEXT[axis][level],
      approachText: SELF_APPROACH_TEXT[axis][level],
      emphasis: emphasisOf(axis, declared, level),
    });
  }

  return signals.sort((a, b) => {
    if (b.emphasis !== a.emphasis) return b.emphasis - a.emphasis;
    return AXIS_ORDER.indexOf(a.key) - AXIS_ORDER.indexOf(b.key);
  });
}

/**
 * 첫 5초에 읽는 한 문장 (§24).
 *
 * 가장 두드러진 두 답을 이어 붙인다. 연결어미는 **두 답의 단계가 다르면 `지만`,
 * 같으면 `고`** — 이것도 규칙이라 같은 입력에 같은 문장이 나온다.
 *
 * ⚠️ 여기서 새로운 해석을 하지 않는다. 사용자가 고른 값을 다시 말해주는 것이 전부다.
 */
function buildHeadline(
  signals: readonly SelfSignal[],
  levels: Map<SelfSignalKey, SelfLevel>,
): string {
  const [first, second] = signals;
  if (!first) return '';

  const firstLevel = levels.get(first.key);
  if (!firstLevel) return '';
  const head = HEADLINE_CLAUSE[first.key][firstLevel];

  if (!second) return `${head}야.`;

  const secondLevel = levels.get(second.key);
  if (!secondLevel) return `${head}야.`;
  const tail = HEADLINE_CLAUSE[second.key][secondLevel];

  const connective = firstLevel === secondLevel ? '고' : '지만';
  return `${head}${connective}, ${tail}야.`;
}

/**
 * **내 답변 안에서 함께 나타난 두 신호** (§23-03)
 *
 * 모든 조합을 만들지 않는다. `SELF_PAIR_RULES`에 등록된 조합만, 등록된 순서대로 낸다 —
 * 함께 나타났다는 사실이 실제로 눈에 띄는 조합만 사람이 골라 넣은 목록이다.
 * 하나도 안 맞으면 이 섹션은 비고, **그게 실패가 아니다**(No Pattern ≠ No Information).
 */
function buildPairs(levels: Map<SelfSignalKey, SelfLevel>): SelfSignalPair[] {
  const pairs: SelfSignalPair[] = [];

  for (const rule of SELF_PAIR_RULES) {
    if (pairs.length >= MAX_PAIRS) break;
    const [axisA, axisB] = rule.axes;
    const levelA = levels.get(axisA);
    const levelB = levels.get(axisB);
    if (levelA !== rule.when[0] || levelB !== rule.when[1]) continue;

    pairs.push({
      id: rule.id,
      axes: rule.axes,
      labels: [AXIS_LABEL.get(axisA) ?? axisA, AXIS_LABEL.get(axisB) ?? axisB],
      observation: rule.observation,
      limitation: rule.limitation,
      // 근거는 사용자가 고른 값 그대로다 — 새 문장을 만들지 않는다
      evidence: [SELF_VALUE_TEXT[axisA][levelA], SELF_VALUE_TEXT[axisB][levelB]],
    });
  }

  return pairs;
}

/**
 * 해볼 수 있는 것 (§30 · §31).
 *
 * ⚠️ 일반 연애 팁 목록이 아니다. 각 항목은 사용자가 답한 축·단계에서만 나오고
 * `signal → why → action` 세 칸을 갖는다. 조건이 안 맞으면 그 항목은 아예 없다.
 * 그래서 목록 길이가 사람마다 다르다 — **분량을 맞추려고 채우지 않는다.**
 */
function buildActions(levels: Map<SelfSignalKey, SelfLevel>): FirstContactAction[] {
  const actions: FirstContactAction[] = [];

  for (const rule of FIRST_CONTACT_ACTIONS) {
    if (actions.length >= MAX_ACTIONS) break;
    const level = levels.get(rule.axis);
    if (level !== rule.when) continue;

    actions.push({
      kind: rule.kind,
      signal: SELF_VALUE_TEXT[rule.axis][level],
      why: rule.why,
      action: rule.action,
    });
  }

  return actions;
}

/**
 * 특정 상대는 있지만 아는 게 적을 때 (§32).
 *
 * ⚠️ **상대를 추론하지 않는다.** 아직 `모름`으로 남긴 축에 대해서만
 * '물어볼 것'을 준다 — 우리가 모르는 것을 우리가 채우지 않는다.
 */
function buildGettingToKnow(target: TargetProfile, mode: SoloMode): string[] {
  if (mode !== 'unknown_target') return [];

  return TARGET_FIELDS.filter((field) => target[field.key] === 'x')
    .map((field) => GETTING_TO_KNOW[field.key as SelfSignalKey])
    .filter((text): text is string => Boolean(text));
}

export function buildFirstContactReport(input: {
  declared: DeclaredPreference;
  experience: RelationshipExperience;
  target: TargetProfile;
  mode: SoloMode;
}): FirstContactReport {
  const { declared, experience, target, mode } = input;

  const levels = buildSelfLevels(declared);
  const signals = buildSignals(declared, levels);
  const noExperience = experience.skipped;

  /**
   * 재료가 모자라면 **만들지 않는다.** 빈 섹션을 늘어놓는 것보다
   * "아직 이걸 만들 수 없다"고 말하는 게 정직하다(E1과 같은 원칙).
   */
  if (signals.length < MIN_SIGNALS) {
    return {
      available: false,
      mode,
      noExperience,
      headline: '',
      signals,
      pairs: [],
      observation: null,
      gettingToKnow: [],
      actions: [],
    };
  }

  return {
    available: true,
    mode,
    noExperience,
    headline: buildHeadline(signals, levels),
    signals,
    pairs: buildPairs(levels),
    /**
     * 경험 유무로 갈린다(§28). 경험이 없는 사용자에게 '데이터가 부족해'만 반복하지 않고,
     * **경험이 없는데도 기준이 있다는 사실 자체**를 관찰 대상으로 삼는다.
     */
    observation: noExperience
      ? FIRST_CONTACT_OBSERVATION.noExperience
      : FIRST_CONTACT_OBSERVATION.withExperience,
    gettingToKnow: buildGettingToKnow(target, mode),
    actions: buildActions(levels),
  };
}
