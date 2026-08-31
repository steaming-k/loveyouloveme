import {
  ELEMENT_LABEL,
  ELEMENT_NOTE,
  ELEMENT_PAIR_TOPIC,
  SUN_SIGN_RANGES,
  ZODIAC_ELEMENT,
  ZODIAC_NOTES,
} from '@/data/zodiac';
import { hasUsableBirthTime, isBirthDateUsable } from '@/lib/logic/birth';
import type {
  AstrologyCompatibilityResult,
  AstrologyProfileResult,
  BirthProfile,
  ConversationPrompt,
  ZodiacSign,
} from '@/types';

/**
 * Astrology Service — Entertainment Lens
 *
 * ⚠️ 범위: **Simple Sun Sign** (생년월일 → 태양궁). v1.4에서 Full Natal Chart
 * (Moon/Rising/Aspect/House/Synastry)는 만들지 않는다 — 출생시각·지역·연도에 따른 행성 위치
 * 계산이 필요하고, 그것 없이 만들면 가짜가 되기 때문이다.
 *
 * 이 서비스의 어떤 결과도 동기화율·Relationship Mirror·History 계산에 들어가지 않는다.
 * 점수를 만들지 않는다 — 축별 '이야기해볼 주제'만 만든다.
 */

const NATAL_LIMITATION =
  '지금은 생년월일 기준 태양궁만 봐. 달·상승궁 같은 건 출생 시각과 지역까지 필요해서 아직 계산하지 않아.';
const CUSP_LIMITATION =
  '별자리가 바뀌는 경계 날짜에 태어났다면 실제와 다를 수 있어. 연도별 태양 진입 시각은 반영하지 않았어.';

/**
 * 생년월일 → 태양궁. `YYYY-MM-DD`만 받는다.
 * 유효하지 않은 날짜에는 임의의 별자리를 돌려주지 않고 `null`을 돌려준다.
 */
export function getSunSign(date: string | null): ZodiacSign | null {
  if (!date) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;

  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // 시작일 내림차순으로 훑어 처음 만족하는 구간을 고른다. 1/1~1/19는 어디에도 안 걸리므로
  // 마지막에 capricorn으로 떨어진다(12/22 시작 구간이 연말을 넘어 이어지기 때문).
  const hit = SUN_SIGN_RANGES.find(
    ({ from }) => month > from[0] || (month === from[0] && day >= from[1]),
  );

  return hit?.sign ?? 'capricorn';
}

/** 경계일(별자리 전환 ±1일)에 태어났는지 — 화면에서 한계를 더 명확히 알리기 위해 */
function isNearCusp(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;

  const month = Number(match[2]);
  const day = Number(match[3]);

  return SUN_SIGN_RANGES.some(({ from }) => from[0] === month && Math.abs(from[1] - day) <= 1);
}

function promptsFor(sign: ZodiacSign): ConversationPrompt[] {
  return [{ id: `astro_${sign}`, text: ZODIAC_NOTES[sign].question }];
}

/* --------------------------------------------------------------- Self Lens */

export function buildAstrologySelfLens(
  profile: BirthProfile,
  today: Date,
): AstrologyProfileResult {
  if (!isBirthDateUsable(profile, today)) {
    return {
      available: false,
      sunSign: null,
      sunSignLabel: null,
      trait: null,
      prompts: [],
      limitations: ['생년월일이 있어야 태양궁을 볼 수 있어.'],
    };
  }

  const sign = getSunSign(profile.date);
  if (!sign) {
    return {
      available: false,
      sunSign: null,
      sunSignLabel: null,
      trait: null,
      prompts: [],
      limitations: ['이 날짜로는 태양궁을 계산하지 못했어.'],
    };
  }

  const limitations = [NATAL_LIMITATION];
  if (profile.date && isNearCusp(profile.date)) limitations.push(CUSP_LIMITATION);
  // 시간을 몰라도 태양궁은 나오지만, 그 이상은 안 된다는 걸 분명히 한다.
  if (!hasUsableBirthTime(profile)) {
    limitations.push('출생 시간이 없어서 시간이 필요한 해석은 만들지 않았어.');
  }

  return {
    available: true,
    sunSign: sign,
    sunSignLabel: ZODIAC_NOTES[sign].label,
    trait: ZODIAC_NOTES[sign].trait,
    prompts: promptsFor(sign),
    limitations,
  };
}

/* ----------------------------------------------------------- Couple Lens */

function elementPairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/**
 * 두 사람 Astrology Lens.
 * 한쪽 생년월일이라도 없으면 결과를 만들지 않는다(§QA CASE L).
 * 점수·확률·'천생연분/상극' 판정을 만들지 않는다 — 비슷/다름과 대화 주제만 만든다.
 */
export function buildAstrologyCompatibility(
  mine: BirthProfile,
  theirs: BirthProfile,
  today: Date,
): AstrologyCompatibilityResult {
  const mineSign = isBirthDateUsable(mine, today) ? getSunSign(mine.date) : null;
  const theirsSign = isBirthDateUsable(theirs, today) ? getSunSign(theirs.date) : null;

  if (!mineSign || !theirsSign) {
    return {
      available: false,
      mine: null,
      theirs: null,
      similar: [],
      different: [],
      prompts: [],
      limitations: ['두 사람의 생년월일이 모두 있어야 함께 볼 수 있어.'],
    };
  }

  const mineElement = ZODIAC_ELEMENT[mineSign];
  const theirsElement = ZODIAC_ELEMENT[theirsSign];
  const sameElement = mineElement === theirsElement;

  const similar: string[] = [];
  const different: string[] = [];

  if (sameElement) {
    similar.push(
      `둘 다 ${ELEMENT_LABEL[mineElement]} 원소로 분류돼. ${ELEMENT_NOTE[mineElement]}`,
    );
  } else {
    different.push(
      `${ELEMENT_LABEL[mineElement]}과 ${ELEMENT_LABEL[theirsElement]} 원소로 다르게 분류돼. ` +
        (ELEMENT_PAIR_TOPIC[elementPairKey(mineElement, theirsElement)] ?? ''),
    );
  }

  if (mineSign === theirsSign) {
    similar.push('같은 별자리라서 점성술에서는 비슷한 태도로 이야기되기도 해.');
  } else {
    different.push(
      `${ZODIAC_NOTES[mineSign].label}는 "${ZODIAC_NOTES[mineSign].trait}" ` +
        `${ZODIAC_NOTES[theirsSign].label}는 "${ZODIAC_NOTES[theirsSign].trait}"`,
    );
  }

  const prompts: ConversationPrompt[] = [
    { id: `astro_pair_${mineSign}`, text: ZODIAC_NOTES[mineSign].question },
    { id: `astro_pair_${theirsSign}`, text: ZODIAC_NOTES[theirsSign].question },
  ].filter((prompt, index, all) => all.findIndex((p) => p.id === prompt.id) === index);

  return {
    available: true,
    mine: { sign: mineSign, label: ZODIAC_NOTES[mineSign].label },
    theirs: { sign: theirsSign, label: ZODIAC_NOTES[theirsSign].label },
    similar,
    different,
    prompts,
    limitations: [NATAL_LIMITATION, '네가 입력한 상대 출생정보를 기준으로 본 결과야.'],
  };
}

/* ------------------------------------------------------------------ Future */

/**
 * Full Natal Chart — **v1.4 미구현.**
 * 출생시각·지역·연도 기반 행성 위치 계산이 필요하다. 검증된 ephemeris 없이 만들면 가짜가 되므로
 * 지금은 계약(Data Contract)만 남겨둔다. 호출하면 항상 미지원을 알린다.
 */
export function calculateNatalChart(): {
  available: false;
  limitations: string[];
} {
  return {
    available: false,
    limitations: [
      '달·상승궁·행성 배치 계산은 아직 연결되지 않았어. 출생 시각과 지역 기반 천문 계산이 필요해.',
    ],
  };
}
