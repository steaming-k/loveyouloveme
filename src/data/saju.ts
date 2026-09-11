/**
 * 사주 관계 렌즈 — 천간·지지 원표 (v1.46 PremiumLens)
 *
 * ⚠️ **이 파일은 계산하지 않는다.** 계산은 `lib/logic/sajuPillars.ts` 하나뿐이고
 * 여기 있는 것은 전통 명리에서 고정된 대응표(천간 10 · 지지 12 · 오행 · 음양)와
 * 그 대응을 관계 맥락으로 옮긴 **문장**이다. 표를 고치면 명리 자체가 바뀌므로
 * 이 파일의 Record는 전부 exhaustive다 — 항목을 빠뜨리면 `tsc`가 막는다.
 *
 * ══ ⚠️ 이 렌즈가 절대 만들지 않는 것 (§12 · §47) ══════════════════════════
 *
 * ```
 * 운명 · 천생연분 · 상극이라 헤어진다 · 결혼운 · 배우자 운명
 * 올해 연애운 · 재회운 · 성공 확률 · 헤어질 가능성 · 바람기
 * ```
 *
 * 특히 **오행의 극(剋) 관계를 '상극'으로 쓰지 않는다.** 대중 사주에서 극은 곧
 * 나쁨으로 읽히지만, 이 렌즈가 파는 것은 좋고 나쁨이 아니라 **어느 방향으로 힘이
 * 흐르는 것으로 읽히는가**다. 그래서 아래 `ELEMENT_RELATION_NOTE`의 다섯 문장에는
 * 우열이 하나도 없고, 전부 '이 프레임에서는 ~로 읽혀'로 끝난다.
 */

export type SajuElement = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export type SajuPolarity = 'yang' | 'yin';

/** 천간 10 — index 0 = 甲 */
export const HEAVENLY_STEMS = [
  '갑',
  '을',
  '병',
  '정',
  '무',
  '기',
  '경',
  '신',
  '임',
  '계',
] as const;
export type HeavenlyStem = (typeof HEAVENLY_STEMS)[number];

/** 지지 12 — index 0 = 子 */
export const EARTHLY_BRANCHES = [
  '자',
  '축',
  '인',
  '묘',
  '진',
  '사',
  '오',
  '미',
  '신',
  '유',
  '술',
  '해',
] as const;
export type EarthlyBranch = (typeof EARTHLY_BRANCHES)[number];

/**
 * 화면에 한자를 함께 보여준다.
 *
 * ⚠️ 장식이 아니다 — 천간 `신(辛)`과 지지 `신(申)`은 한글이 같다. 한자가 없으면
 * `신신일`이 어느 조합인지 사용자가 구분할 수 없다.
 */
export const STEM_HANJA: Record<HeavenlyStem, string> = {
  갑: '甲',
  을: '乙',
  병: '丙',
  정: '丁',
  무: '戊',
  기: '己',
  경: '庚',
  신: '辛',
  임: '壬',
  계: '癸',
};

export const BRANCH_HANJA: Record<EarthlyBranch, string> = {
  자: '子',
  축: '丑',
  인: '寅',
  묘: '卯',
  진: '辰',
  사: '巳',
  오: '午',
  미: '未',
  신: '申',
  유: '酉',
  술: '戌',
  해: '亥',
};

export const STEM_ELEMENT: Record<HeavenlyStem, SajuElement> = {
  갑: 'wood',
  을: 'wood',
  병: 'fire',
  정: 'fire',
  무: 'earth',
  기: 'earth',
  경: 'metal',
  신: 'metal',
  임: 'water',
  계: 'water',
};

export const STEM_POLARITY: Record<HeavenlyStem, SajuPolarity> = {
  갑: 'yang',
  을: 'yin',
  병: 'yang',
  정: 'yin',
  무: 'yang',
  기: 'yin',
  경: 'yang',
  신: 'yin',
  임: 'yang',
  계: 'yin',
};

export const BRANCH_ELEMENT: Record<EarthlyBranch, SajuElement> = {
  자: 'water',
  축: 'earth',
  인: 'wood',
  묘: 'wood',
  진: 'earth',
  사: 'fire',
  오: 'fire',
  미: 'earth',
  신: 'metal',
  유: 'metal',
  술: 'earth',
  해: 'water',
};

/** 子寅辰午申戌 = 양 · 丑卯巳未酉亥 = 음 (전통 구분 그대로) */
export const BRANCH_POLARITY: Record<EarthlyBranch, SajuPolarity> = {
  자: 'yang',
  축: 'yin',
  인: 'yang',
  묘: 'yin',
  진: 'yang',
  사: 'yin',
  오: 'yang',
  미: 'yin',
  신: 'yang',
  유: 'yin',
  술: 'yang',
  해: 'yin',
};

export const BRANCH_ANIMAL: Record<EarthlyBranch, string> = {
  자: '쥐',
  축: '소',
  인: '호랑이',
  묘: '토끼',
  진: '용',
  사: '뱀',
  오: '말',
  미: '양',
  신: '원숭이',
  유: '닭',
  술: '개',
  해: '돼지',
};

export const ELEMENT_LABEL_KO: Record<SajuElement, string> = {
  wood: '목',
  fire: '화',
  earth: '토',
  metal: '금',
  water: '수',
};

export const POLARITY_LABEL_KO: Record<SajuPolarity, string> = {
  yang: '양',
  yin: '음',
};

/** 오행 상생 — 목생화 · 화생토 · 토생금 · 금생수 · 수생목 */
export const ELEMENT_GENERATES: Record<SajuElement, SajuElement> = {
  wood: 'fire',
  fire: 'earth',
  earth: 'metal',
  metal: 'water',
  water: 'wood',
};

/** 오행 상극 — 목극토 · 토극수 · 수극화 · 화극금 · 금극목 */
export const ELEMENT_CONTROLS: Record<SajuElement, SajuElement> = {
  wood: 'earth',
  earth: 'water',
  water: 'fire',
  fire: 'metal',
  metal: 'wood',
};

/**
 * 일간끼리의 오행 관계 5종.
 *
 * ⚠️ 십성(비겁·식상·인성·재성·관성)의 **분류 기준 그대로**다 — 내가 새로 만든
 * 구분이 아니라, 일간을 기준으로 다른 오행이 어느 자리에 놓이는가라는 명리의
 * 표준 5분류다. 다만 화면에서 십성 용어를 제목으로 쓰지 않는다(§12 — 원시 명리
 * 용어만 나열하지 않는다). 용어는 '왜 이렇게 봤어?'를 펼쳤을 때만 나온다.
 */
export type ElementRelation =
  /** 같은 오행 — 비겁 */
  | 'same'
  /** 내가 상대를 생함 — 식상 */
  | 'i_generate'
  /** 상대가 나를 생함 — 인성 */
  | 'they_generate'
  /** 내가 상대를 극함 — 재성 */
  | 'i_control'
  /** 상대가 나를 극함 — 관성 */
  | 'they_control';

export interface ElementRelationNote {
  /** 십성 이름. 궁금해하는 사용자를 위해 적되 제목으로 쓰지 않는다 */
  classicTerm: string;
  /** 두 사람을 같이 놓았을 때 이 프레임에서 읽히는 것 */
  reading: string;
  /** 이 흐름에서 어긋나기 쉽다고 이야기되는 지점 — 우열이 아니다 */
  watchFor: string;
  /** 실제 관계에서 확인할 질문 하나 */
  question: string;
}

/**
 * ⚠️ 다섯 문장 어디에도 좋고 나쁨이 없다. `i_control`/`they_control`이 특히
 * 중요한데, 대중 사주라면 여기에 '상극'을 쓴다. 이 렌즈는 **방향**만 말한다 —
 * 누가 먼저 방향을 잡는 쪽으로 읽히는가. 그래서 두 문장은 극이 나쁨이 아니라는
 * 것을 문장 안에서 직접 말한다.
 */
export const ELEMENT_RELATION_NOTE: Record<ElementRelation, ElementRelationNote> = {
  same: {
    classicTerm: '비겁',
    reading:
      '두 일간이 같은 오행이야. 이 프레임에서는 관계에 힘을 쓰는 방식이 서로 닮은 것으로 읽혀.',
    watchFor:
      '같은 방식이라 설명을 생략하게 되는 지점. 비슷할수록 같은 자리에서 함께 멈추기도 한다고 이야기돼.',
    question: '둘 다 비슷하게 반응할 때, 누가 먼저 방향을 정하는 편이야?',
  },
  i_generate: {
    classicTerm: '식상',
    reading:
      '네 일간이 상대 일간을 생(生)하는 자리야. 이 프레임에서는 네가 먼저 꺼내고 내어주는 흐름으로 읽혀.',
    watchFor:
      '먼저 주는 쪽이 답을 기다리게 되는 지점. 준 만큼 돌아오는지를 세기 시작하면 피로가 쌓인다고 이야기돼.',
    question: '먼저 표현하고 나서 답이 늦게 올 때, 너는 어떤 반응이 있으면 괜찮아져?',
  },
  they_generate: {
    classicTerm: '인성',
    reading:
      '상대 일간이 네 일간을 생(生)하는 자리야. 이 프레임에서는 상대 쪽에서 채워주는 흐름으로 읽혀.',
    watchFor:
      '받는 게 익숙해지면 먼저 움직이는 일이 줄어드는 지점. 편한 것과 기대는 것의 경계가 흐려진다고 이야기돼.',
    question: '상대가 먼저 챙겨줄 때, 너는 무엇으로 답하는 편이야?',
  },
  i_control: {
    classicTerm: '재성',
    reading:
      '네 일간이 상대 일간을 극(剋)하는 자리야. 이 프레임에서 극은 나쁨이 아니라 방향을 잡는 쪽이라는 뜻으로 읽혀 — 네가 관계의 속도나 형태를 먼저 정하는 흐름이야.',
    watchFor: '정리하려는 마음이 상대에게는 이미 정해놓은 것으로 느껴질 수 있는 지점.',
    question: '무언가를 정할 때, 상대에게 언제 물어보고 언제 그냥 정하는 편이야?',
  },
  they_control: {
    classicTerm: '관성',
    reading:
      '상대 일간이 네 일간을 극(剋)하는 자리야. 여기서도 극은 나쁨이 아니라 기준이 상대 쪽에 놓인 것으로 읽힌다는 뜻이야 — 네가 상대의 기준에 맞춰보게 되는 흐름이야.',
    watchFor: '맞추는 게 익숙해지면 네 기준을 말하지 않게 되는 지점.',
    question: '상대 방식에 맞춰본 뒤에, 네가 원래 원했던 걸 말한 적이 있어?',
  },
};

/** 일간 오행으로 읽는 '관계에서 드러나는 방식' — Self Lens의 핵심 한 줄 */
export const DAY_STEM_ELEMENT_SELF: Record<SajuElement, string> = {
  wood: '뻗어나가는 기운으로 이야기돼. 관계에서도 먼저 방향을 그리고 움직여보는 쪽으로 읽혀.',
  fire: '드러나는 기운으로 이야기돼. 관계에서도 마음이 겉으로 먼저 나타나는 쪽으로 읽혀.',
  earth: '받치는 기운으로 이야기돼. 관계에서도 자리를 지키고 안정을 먼저 챙기는 쪽으로 읽혀.',
  metal: '정리하는 기운으로 이야기돼. 관계에서도 기준을 분명히 두려는 쪽으로 읽혀.',
  water: '흐르는 기운으로 이야기돼. 관계에서도 상황에 맞춰 모양을 바꾸는 쪽으로 읽혀.',
};

/**
 * 일지 오행으로 읽는 '일상의 리듬'.
 *
 * ⚠️ 일간 문장과 **층위를 다르게** 둔다(§28). 일간은 관계에서 드러나는 방식,
 * 일지는 하루의 리듬이다. 둘이 같은 말을 하면 항목만 둘이고 내용은 하나가 된다.
 *
 * ⚠️ 일지를 '배우자궁'으로 부르지 않는다 — 그 순간 이 렌즈가 배우자 운을
 * 말하는 것이 되고, 그건 §47이 금지한 결과다.
 */
export const DAY_BRANCH_ELEMENT_SELF: Record<SajuElement, string> = {
  wood: '하루의 리듬은 새로 시작하는 쪽이 편하다고 이야기돼.',
  fire: '하루의 리듬은 사람과 부딪히는 쪽이 편하다고 이야기돼.',
  earth: '하루의 리듬은 반복되는 쪽이 편하다고 이야기돼.',
  metal: '하루의 리듬은 정돈된 쪽이 편하다고 이야기돼.',
  water: '하루의 리듬은 상황에 맡기는 쪽이 편하다고 이야기돼.',
};

/** 음양으로 읽는 '표현이 나가는 방향' */
export const POLARITY_SELF: Record<SajuPolarity, string> = {
  yang: '표현이 밖으로 먼저 나가는 쪽으로 분류돼.',
  yin: '표현이 안에서 한 번 정리된 뒤에 나가는 쪽으로 분류돼.',
};

/**
 * 이 렌즈가 계산하지 않는 것 — **화면에 그대로 보여준다.**
 * 없는 것을 아는 척하지 않는 것이 이 렌즈의 신뢰 전부다(§11).
 */
export const SAJU_SCOPE_NOTE =
  '사주 네 기둥 중 일주(日柱) 하나만 계산했어. 연주는 입춘 시각, 월주는 절기, 시주는 진태양시가 필요해서 이 렌즈에서는 세우지 않아.';

export const SAJU_DISCLAIMER = '사주는 관계를 돌아보는 전통적 해석 렌즈로 봐줘.';
