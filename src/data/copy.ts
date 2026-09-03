import type { LovyPose } from '@/data/lovy';

/**
 * 러비 UX Writing & 화면 카피
 *
 * Tone: 약간 무심함 + 호기심 + 솔직함. 관찰자이지 상담가가 아니다.
 * 금지: '너는 회피형이야' / '헤어져야 해' / '천생연분' / '78% 확률로 성공합니다'
 */

export const BRAND = {
  name: '럽유럽미',
  nameEn: 'Love U Love Me',
  character: '러비',
  characterEn: 'LovY',
  splashLabel: 'LOVE RESEARCH : EARTH',
  splashCopy: '인간의 사랑을 관찰 중',
  tagline: '관계 속의 나를 관찰하는 서비스',
} as const;

/** 온보딩 (S02~S04) — 와이어프레임 순서 유지 */
export const ONBOARDING_SLIDES = [
  {
    id: 1,
    title: ['이 사람이랑 나,', '잘 맞을까?'],
    caption: ['연락 · 대화 · 갈등 해결 · 개인 시간처럼', '실제 관계에서 부딪히는 항목으로 비교해.'],
    visual: 'signal' as const,
  },
  {
    id: 2,
    title: ['근데 잠깐.', '너는 연애할 때', '어떤 사람이야?'],
    visual: 'gap' as const,
    gap: {
      declaredLabel: 'DECLARED ME · 네가 말한 너',
      declaredText: '"연락은 별로 중요하지 않아."',
      relationshipLabel: 'RELATIONSHIP ME · 관계 속의 너',
      relationshipText: '"연락이 줄어드는 게 가장 힘들었어."',
    },
  },
  {
    id: 3,
    title: ['상대를 보다 보면', '의외로 네가', '더 잘 보일지도 몰라.'],
    caption: ['궁합은 시작점이야. 러비는 네가 말한 너와', '관계에서 나타난 너를 같이 관찰해.'],
    visual: 'lovy' as const,
  },
] as const;

export const ONBOARDING_CTA = ['다음', '다음', '나부터 관찰하기'] as const;

/** 로딩 시퀀스 — 일반 스피너 하나로 끝내지 않는다 */
export interface LoadingLine {
  text: string;
  /** 'whisper' 관측 로그 / 'main' 핵심 발견 / 'doubt' 불확실성 고백 */
  tone: 'whisper' | 'main' | 'doubt';
}

/**
 * ⚠️ v1.10 — 문구를 바꿨다. 예전 줄은 '영화 기록 발견' · '밖에서 보내는 시간이 꽤 많네'처럼
 * **분석이 끝나기도 전에 결과를 말하고 있었다.** 실제 Vision을 붙이면 그 문장들은 사진과
 * 무관한 거짓말이 된다. 이제는 '무엇을 하고 있는지'만 말한다.
 * '생활 패턴'이라는 말도 뺐다(§6) — 사진 몇 장으로 판정할 수 있는 것이 아니다.
 */
export const OBSERVED_LOADING: readonly LoadingLine[] = [
  { text: '사진을 한 장씩 살펴보는 중...', tone: 'whisper' },
  { text: '어떤 장면과 활동이 보이는지 적는 중.', tone: 'whisper' },
  { text: '여러 장에서 겹치는 게 있는지 맞춰보는 중.', tone: 'main' },
  { text: '없는 건 없다고 할게.', tone: 'doubt' },
];

export const COMPATIBILITY_LOADING: readonly LoadingLine[] = [
  { text: '두 지구인의 신호 비교 중...', tone: 'whisper' },
  { text: '공통점 발견.', tone: 'whisper' },
  { text: '음... 여기서는 조금 다르네.', tone: 'main' },
  { text: '관측 완료.', tone: 'doubt' },
];

/** 각 줄이 머무는 시간(ms). 합계 약 4.4초. */
export const LOADING_LINE_MS = 1100;

/** 프라이버시 안내 — 민감정보를 입력하는 순간에만 필요한 만큼 보여준다 */
export const PRIVACY = {
  profileIntro: '입력한 정보는 언제든 수정·삭제할 수 있어. 분석에서 제외도 가능해.',
  photo: '선택한 사진만 분석해. 성적 지향·정치·종교·건강·경제 상태는 추론하지 않아.',
  /** v1.6 — 실제 AI 전송이 생겼으므로 사진 처리 방식을 별도로 고지한다 */
  photoTransfer:
    '선택한 사진은 AI 분석을 위해 전송되고, 분석 후 앱의 기록에는 저장하지 않아. 외모·나이·체형은 평가하지 않아.',
  /**
   * ⚠️ v1.6에서 수정한 문구다. 이전에는 '사진은 브라우저 안에서만 쓰이고 서버로 보내지 않아요'
   * 였는데, 실제 AI Vision을 연결하면서 **거짓이 됐다.**
   *
   * Provider가 요청 데이터를 어떻게 보관·학습에 쓰는지 우리가 검증하지 않았으므로
   * '즉시 완전 삭제' 같은 보장은 하지 않는다(§33). 우리 서비스가 하는 일만 정확히 말한다.
   */
  photoFooter: '선택한 사진은 AI 분석을 위해 전송돼. 앱의 기록에는 사진을 저장하지 않아',
  /** Demo 모드 footer — 전송 자체가 없으므로 전송된다고 말하지 않는다 */
  photoFooterDemo: '지금은 데모 모드라 사진을 전송하지 않아',
  /**
   * v1.10 §14 — 실제 Vision이 붙었으므로 '무엇을 위해' 사진을 쓰는지 동작 그대로 적는다.
   * 성격을 맞히는 게 아니라 장면·활동을 관찰해 초안을 만드는 것이다(§1).
   */
  photoPurpose: '선택한 사진에서 활동과 장면을 관찰해 프로필 초안을 만들어.',
  /**
   * 실제 분석 모드에서 사진 화면에 보여주는 상세 안내.
   *
   * ⚠️ '즉시 삭제됩니다' 같은 표현을 쓰지 않는다(§14). Provider의 보관 정책을 우리가
   * 확인하지 않았으므로, 우리가 하는 일(앱에 사진을 저장하지 않는다)만 말한다.
   */
  photoAiNotice:
    '선택한 사진은 AI 분석을 위해 서버로 전송될 수 있어. 분석이 끝나면 앱에는 관찰 결과와 근거만 남고 사진 자체는 저장하지 않아. AI 제공사의 데이터 보관 정책은 우리가 통제하지 않아.',
  /** Demo 모드에서는 전송 자체가 없다 — 그 사실을 그대로 말한다 */
  photoDemoNotice: '지금은 데모 모드라 사진을 전송하지 않아. 사진 내용도 분석하지 않아.',
  past: '관계 경험은 분석에만 사용해. 언제든 삭제할 수 있어.',
  target: '네가 알고 있는 상대의 정보를 기준으로 비교해. 상대의 실제 마음이나 성격을 판정하지 않아.',
  aiResult: 'AI 분석은 지금 입력된 정보를 기준으로 한 해석이야. 항목별로 수정·삭제할 수 있어.',
  mirror: '이건 판정이 아니야. 네 답변 2개를 비교한 관찰 기록이야.',
  unknownExcluded: "'모름'으로 남긴 항목은 점수에 반영하지 않았어.",
  share: '개인정보는 카드에 포함되지 않아.',
  shareMirror: '상대 정보와 개인 답변은 카드에 포함되지 않아.',
  demoAi: 'AI 분석은 데모용 규칙 기반 응답이야. 실제 사진 내용을 분석하지 않아.',
} as const;

/** Loading / Empty / Error / Low confidence — 모두 러비 화법으로 */
export const STATE_COPY = {
  empty: {
    pose: 'question' as LovyPose,
    title: '아직 관측 기록이 부족해.',
    body: ['이 상태에서 결론 내리면', '내가 인간을 또 오해할 것 같아.'],
  },
  error: {
    pose: 'laptop' as LovyPose,
    title: '관측 장비에 문제가 생겼어.',
    body: ['잠깐 다시 확인해볼게.', '입력한 내용은 그대로 있어.'],
    code: 'ERR_OBSERVE_TIMEOUT',
  },
  lowConfidence: {
    pose: 'crystal' as LovyPose,
    message:
      '이 지구인에 대해서는 아직 아는 게 별로 없네. 이건 나도 확신이 없어. 가능성 정도로만 봐줘.',
  },
  noExperience: {
    pose: 'mug' as LovyPose,
    title: ['아직 관계 기록은 없네.', '지금의 너부터 관찰해둘게.'],
    body: '과거 관계 질문은 건너뛸게. 대신 지금 생각하는 기준을 기록해두고, 나중에 실제 경험과 비교해보자.',
  },
  /** S26 Mirror Teaser에서 experience.skipped인 사용자에게 보여주는 문구. Mirror CTA를 억지로 주지 않는다. */
  mirrorUnavailable: {
    pose: 'mug' as LovyPose,
    body: [
      '아직 관계 경험 데이터는 없어서',
      '생각한 나와 실제 관계 속 나를 비교하긴 어려워.',
    ],
    footer: '지금의 기준은 기록해둘게. 나중에 관계 경험이 생기면 다시 비교할 수 있어.',
  },
} as const;

/** 화면별 러비 한 줄 */
export const LOVY_LINES = {
  profileIntro: ['상대를 보기 전에', '일단 너부터 조금 알아야겠어.'],
  observedResult: '내가 잘못 봤으면 알려줘. 관찰 기록은 고칠 수 있어.',
  pastIntro: ['이번엔 네 기억을', '조금 빌릴게.'],
  pastNote: '안 적어도 괜찮아. 대신 내 관찰의 확신은 조금 낮아져.',
  compatibilityHero: '숫자는 그냥 요약이야. 중요한 건 왜 이렇게 나왔는지야.',
  friction: '이게 안 맞는다는 뜻은 아니야. 미리 알고 있으면 이야기하기 쉬울 수 있어.',
  teaserOne: '근데 잠깐.',
  teaserTwo: ['지금까지는 너와 그 사람을 비교했잖아.', '이번엔 너 안에서 조금 다른 신호가 보여.'],
  teaserThree: '이 둘이 왜 다른지 조금 더 볼까?',
  adaptiveIntro: '여기서 하나만 더 물어볼게.',
  coreInsightAsk: '내 관찰이 맞아?',
  coreInsightFooter: '네 확인이 다음 관찰의 기준이 돼. 러비는 계속 배우는 중이야.',
  lens: '이 렌즈들은 내 관찰 기록을 대신하지 않아. 그냥 다른 각도로 보는 거야.',
  historyReport: '인간의 사랑은 아직도 잘 모르겠어. 근데 너에 대해서는 전보다 조금 알 것 같아.',
} as const;

/** 3 Data Layer 소개 (S06) */
export const DATA_LAYERS = [
  { n: 1, title: 'Observed Me', caption: '사진에서 관찰되는 취향과 생활 방식' },
  { n: 2, title: 'Declared Me', caption: '네가 직접 답한 관계 성향과 기준' },
  { n: 3, title: 'Relationship Me', caption: '이전 관계에서 실제로 나타난 너' },
] as const;

/** 동기화율 화면 문구 */
export const COMPATIBILITY_COPY = {
  scoreLabel: 'SYNC RATE · 동기화율',
  supporting: ['현재 입력된 두 사람의 정보를 기준으로', '공통점과 차이를 비교한 결과야.'],
  notice: '연애 성공확률이 아니야',
  goodCountLabel: '잘 맞는 신호',
  watchCountLabel: '관찰 필요한 신호',
} as const;

/** 홈 (S29) */
export const HOME_COPY = {
  heroLabel: '현재 러비가 알고 있는 나',
  fallbackProfile: '독립적인 시간을 중요하게 여기지만 관계의 연결 신호에는 민감한 편',
  recentLabel: '최근 관찰',
  futureTeaser: ['관계 기록이 쌓이면', '러비가 변화도 알려줄 수 있어.'],
} as const;

/** Future — Relationship History (F1/F2). 연애 일기처럼 만들지 않는다. */
/**
 * F1/F2 Relationship History — v1.3에서 정적 mock을 제거하고 실제 저장 데이터로 바꿨다.
 * 연애 일기가 아니라 '내 기준이 어떻게 움직였는지'의 기록이다.
 */
export const HISTORY_COPY = {
  badge: 'RELATIONSHIP HISTORY',
  title: ['러비가', '기억하고 있는 나'],
  caption: '누구와 몇 번 만났는지는 기록하지 않아. 네 기준이 어떻게 움직였는지만 남겨.',

  empty: {
    title: ['아직 너를', '오래 관찰하진 못했어.'],
    body: '첫 Relationship Mirror를 저장하면 여기에 변화가 쌓이기 시작해.',
    cta: '나 관찰 시작하기',
  },

  /** 저장 직후 Change Moment (§8/§9) */
  saved: {
    firstTitle: ['첫 관찰 기록을', '저장했어.'],
    firstBody: ['아직 비교할 과거의 너는 없네.', '다음에 다시 관찰하면 그때 달라진 것도 알려줄게.'],
    firstCta: '내 기록 보기',
    againTitle: ['지난 관찰과', '비교할 수 있게 됐어.'],
    againBody: '어느 쪽이 맞다고 판정하진 않을게. 달라진 지점만 보여줄게.',
    againCta: '뭐가 달라졌는지 보기',
    duplicateTitle: ['이미 저장된', '관찰이야.'],
    duplicateBody: '같은 분석은 기록에 한 번만 남겨. 새 관찰을 쌓으려면 답변을 바꿔서 다시 관측해봐.',
  },

  reportTitle: ['예전의 너와', '지금의 너'],
  reportSingle: '아직 비교할 과거 기록이 하나뿐이야. 다음 관찰이 쌓이면 변화를 알려줄게.',

  /** §21 반복 신호 — '너는 항상 이래' 같은 표현은 쓰지 않는다 */
  repeatedTitle: '이 신호… 처음 보는 게 아닌데.',
  repeatedCaption: '이 기준은 이전 관찰에서도 비슷한 신호가 있었어.',

  pastLabel: 'PAST',
  nowLabel: 'NOW',

  deleteEntryTitle: '이 관찰 기록을 삭제할까?',
  deleteEntryBody: '삭제하면 이전 변화 비교에서도 빠져. 되돌릴 수 없어.',
} as const;

/** History Change State 화면 라벨. 좋음·나쁨이 아니라 변화의 종류만 말한다. */
export const HISTORY_STATE_LABEL = {
  STABLE: '유지',
  SHIFT: '변화',
  NEW: '처음',
  INSUFFICIENT: '정보 부족',
} as const;

/**
 * 렌즈 위계 (X1)
 *   CORE              실제 관계 신호 (동기화율)
 *   SUPPORTING LENS   MBTI — 사용자가 스스로 아는 Personality Preference를 대화 출발점으로 쓴다
 *   ENTERTAINMENT     사주 · Astrology
 *
 * MBTI도 과학적인 궁합 예측이 아니므로 동기화율 계산에는 들어가지 않는다. 다만 관계 분석에
 * 가까운 Supporting Lens라서 사주·점성술과는 위계를 구분해 둔다.
 */
export const LENS_COPY = {
  badge: 'LENS',
  title: '러비의 관측 렌즈',
  caption: '전부 참고용이야. 궁합 점수는 실제 관계 신호로만 계산해.',
  items: [
    {
      title: 'MBTI Lens',
      caption: '두 유형을 성향 차이로 비교하는 참고 렌즈',
      group: 'SUPPORTING' as const,
      ready: true,
      href: '/lens/mbti',
    },
    {
      title: '사주 Lens',
      caption: '전통 해석으로 보는 관점 · 재미로만 봐',
      group: 'ENTERTAINMENT' as const,
      ready: true,
      href: '/lens/saju',
    },
    {
      title: 'Astrology Lens',
      caption: '별자리 관점으로 보는 해석 · 재미로만 봐',
      group: 'ENTERTAINMENT' as const,
      ready: true,
      href: '/lens/astrology',
    },
  ],
} as const;

/**
 * X2 Birth Profile 입력 — 사주·Astrology **공용**.
 * 같은 정보를 렌즈마다 다시 묻지 않기 위해 한 곳에서만 받는다.
 */
export const BIRTH_COPY = {
  badge: 'ENTERTAINMENT',
  title: ['태어난 순간의 정보'],
  caption: '이 렌즈들은 태어난 순간의 정보를 사용해. 사주와 별자리가 같이 써.',
  lovyIntro: '지구인들은 태어난 순간으로도 관계를 해석하더라. 재밌네, 이 렌즈로도 한번 볼까?',
  selfLabel: '나',
  targetLabel: '상대',
  targetHint: '네가 알고 있는 상대 정보를 입력해줘. 모르면 비워둬도 돼.',
  dateLabel: '생년월일',
  timeLabel: '출생 시간',
  timeUnknownLabel: '태어난 시간을 몰라',
  calendarLabel: '달력',
  locationLabel: '출생 지역 (선택)',
  locationHint: '별자리 상세 계산이나 사주 지역 보정에 쓰여. 없어도 기본 결과는 볼 수 있어.',
  privacy:
    '출생정보는 이 렌즈 분석에만 사용해. 현재 이 기기에만 저장되고, 언제든 삭제할 수 있어.',
  clearSelf: '내 출생정보 삭제',
  clearTarget: '상대 출생정보 삭제',
  errors: {
    format: '`YYYY.MM.DD` 형식으로 알려줘.',
    invalid: '없는 날짜인 것 같아. 다시 확인해줄래?',
    future: '아직 오지 않은 날짜야.',
    tooOld: '1900년 이후로 알려줘.',
    timeFormat: '시간은 `HH:MM` 형식으로 알려줘.',
    timeInvalid: '없는 시간인 것 같아.',
  },
} as const;

/** X1-c 사주 Lens */
export const SAJU_COPY = {
  badge: 'ENTERTAINMENT',
  title: ['사주 렌즈'],
  caption: '전통 해석 체계로 우리 둘을 한번 겹쳐보는 참고 렌즈야.',
  notPrediction:
    '사주는 전통적인 해석 체계야. 실제 관계가 잘될 확률을 예측하는 결과로는 사용하지 않을게.',
  selfCta: '내 사주 보기',
  coupleCta: '우리 사주 궁합 보기',
  engineOffTitle: '아직 계산 엔진이 연결되지 않았어',
  /** SELF만 준비됐을 때(§13) */
  engineOffBodySelf:
    '네 정보는 준비됐어. 사주 계산 엔진이 연결되면 먼저 네 사주 렌즈부터 볼 수 있어.',
  /** SELF + TARGET 모두 준비됐을 때(§13) */
  engineOffBodyCouple:
    '두 사람의 정보는 준비됐어. 엔진이 연결되면 각각의 결과와 둘의 비교까지 볼 수 있어.',
} as const;

/** X1-b Astrology Lens */
export const ASTROLOGY_COPY = {
  badge: 'ENTERTAINMENT',
  title: ['별자리 렌즈'],
  caption: '생년월일로 태양궁을 보고, 관계에서 이야기해볼 주제를 찾아볼게.',
  selfLabel: '나의 태양궁',
  targetLabel: '상대의 태양궁',
  coupleCta: '우리 별자리 함께 보기',
  similarLabel: '비슷하게 읽힐 수 있는 부분',
  differentLabel: '다르게 나타날 수 있는 부분',
  promptLabel: '이야기해볼 주제',
  disclaimer: '점성술에서는 이렇게 이야기되기도 해. 실제 너희가 그런지는 둘이 이야기해봐.',
} as const;

/** 두 Entertainment Lens 공통 — 출생정보가 부족할 때 (§26) */
export const LENS_MISSING_COPY = {
  self: '이번엔 네 정보가 필요해.',
  target: '상대 출생정보가 조금 더 필요해.',
  both: '두 지구인의 출생정보부터 알려줘.',
  cta: '출생정보 입력하기',
} as const;

/** S22a 다른 렌즈 허브 */
export const LENS_HUB_COPY = {
  title: ['우리 둘을 보는', '다른 렌즈'],
  caption: '동기화율은 실제 관계 신호로만 계산해. 아래 렌즈들은 참고로 겹쳐보는 관점이야.',
  coreLabel: 'CORE · 실제 관계 신호',
  coreCaption: '연락 · 갈등 해결 · 개인 시간 · 애정 표현',
  supportingLabel: 'SUPPORTING',
  entertainmentLabel: 'ENTERTAINMENT · 재미로 보기',
} as const;

/** X1-a MBTI Lens — Compatibility Lens Detail 화면 */
export const MBTI_LENS_COPY = {
  badge: 'SUPPORTING LENS',
  title: ['MBTI 렌즈'],
  caption: '두 유형을 관계를 바라보는 하나의 참고 렌즈로 비교해볼게.',
  lovyNote: '이건 MBTI로 너희 관계를 판정한 건 아니야. 서로 이야기해볼 만한 차이를 하나 더 본 거야.',
  scoreNotice:
    '동기화율에는 MBTI를 넣지 않아. 점수는 연락·갈등·개인 시간·애정 표현 같은 실제 관계 신호로만 계산해.',
  selfSectionLabel: '나',
  targetSectionLabel: '상대',
  togetherSectionLabel: '함께 보면',
  /** State A — 내 MBTI가 없을 때 */
  noSelfTitle: '아직 네 MBTI가 없어.',
  noSelfBody: '입력하면 바로 네 성향부터 볼 수 있어.',
  noSelfCta: '내 MBTI 입력하기',
  /** State B — 내 MBTI만 있을 때, 상대 입력은 Optional CTA */
  noTargetTitle: '상대 MBTI도 알고 있어?',
  noTargetBody: '입력하면 상대의 결과와 둘의 비교도 볼 수 있어.',
  noTargetCta: '상대 MBTI 입력하기',
  /** Edge — 상대만 있고 내 MBTI가 없을 때(§22) */
  targetOnlyBody: '상대 정보는 남아 있어. 먼저 네 정보를 입력하면 각자의 결과와 둘의 비교를 볼 수 있어.',
  targetOnlyCta: '내 정보 입력',
} as const;

/** X1-b Astrology Lens 화면 */
export const ZODIAC_LENS_COPY = {
  title: ['너의 별자리, 뭐야?'],
  caption: '대화 소재로 보는 참고용 렌즈야. 궁합 점수에는 반영하지 않아.',
  pickLabel: '별자리 선택',
  emptyNotice: '아직 고르지 않았어. 위에서 하나 골라줘.',
} as const;
