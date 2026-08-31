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
    caption: ['연락 · 대화 · 갈등 해결 · 개인 시간처럼', '실제 관계에서 부딪히는 항목으로 비교해요.'],
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

export const OBSERVED_LOADING: readonly LoadingLine[] = [
  { text: '지구인 생활패턴 관찰 중...', tone: 'whisper' },
  { text: '영화 기록 발견.', tone: 'whisper' },
  { text: '밖에서 보내는 시간이 꽤 많네.', tone: 'main' },
  { text: '음... 이건 확신이 없어.', tone: 'doubt' },
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
  profileIntro: '입력한 정보는 언제든 수정·삭제할 수 있어요. 분석에서 제외도 가능해요.',
  photo: '선택한 사진만 분석해요. 성적 지향·정치·종교·건강·경제 상태는 추론하지 않아요.',
  photoFooter: '사진은 브라우저 안에서만 쓰이고 서버로 보내지 않아요',
  past: '관계 경험은 분석에만 사용해요. 언제든 삭제할 수 있어요.',
  target: '네가 알고 있는 상대의 정보를 기준으로 비교해요. 상대의 실제 마음이나 성격을 판정하지 않아요.',
  aiResult: 'AI 분석은 지금 입력된 정보를 기준으로 한 해석이에요. 항목별로 수정·삭제할 수 있어요.',
  mirror: '이건 판정이 아니야. 네 답변 2개를 비교한 관찰 기록이야.',
  unknownExcluded: "'모름'으로 남긴 항목은 점수에 반영하지 않았어요.",
  share: '개인정보는 카드에 포함되지 않아요.',
  shareMirror: '상대 정보와 개인 답변은 카드에 포함되지 않아요.',
  demoAi: 'AI 분석은 데모용 규칙 기반 응답이에요. 실제 사진 내용을 분석하지 않아요.',
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
  supporting: ['현재 입력된 두 사람의 정보를 기준으로', '공통점과 차이를 비교한 결과예요.'],
  notice: '연애 성공확률이 아니에요',
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
export const HISTORY_COPY = {
  badge: 'FUTURE CONCEPT',
  title: ['관계를 거치며', '네 기준은 이렇게 움직였어.'],
  caption: '누구와 몇 번 만났는지는 기록하지 않아요.',
  timeline: [
    { date: '2026.03', text: '"연락은 별로 중요하지 않아."', kind: 'declared' as const },
    { date: '2026.06', text: '관계 경험 · 갈등 후 연결이 끊기는 상황', kind: 'experience' as const },
    { date: '2026.09 · 기준 변화', text: '"연락보다 안정적인 연결감이 중요함"', kind: 'shift' as const },
    { date: '2027.02', text: '새로운 관계 · 과거의 너까지 반영한 분석', kind: 'future' as const },
  ],
  changes: [
    { label: '연결감', tag: '상승', tone: 'up' as const, body: '세 관계 모두에서 연결이 끊기는 순간을 어려움으로 선택했어.' },
    { label: '취미 공유', tag: '하락', tone: 'down' as const, body: '첫 관계에서는 중요했지만 이후에는 기준에서 빠졌어.' },
    { label: '개인 시간', tag: '유지', tone: 'keep' as const, body: '모든 관계에서 꾸준히 중요하게 유지됐어.' },
  ],
} as const;

/**
 * Add-on — 다른 관측 렌즈 (X1). MBTI·사주·점성술은 메인 기능(궁합·Mirror 계산)에 올리지 않는다.
 * MBTI·Astrology Lens는 v1.1에서 실제로 구현했다 — 자기탐색·대화 소재용이며 관계 성공 예측이 아니다.
 * 사주 Lens는 정확한 변환에 음력 환산이 필요해 아직 '준비 중'으로 남긴다.
 */
export const LENS_COPY = {
  badge: 'ADD-ON',
  title: '러비의 다른 관측 렌즈',
  caption: '재미로 보는 보조 렌즈예요. 관계 성공 예측이 아니에요.',
  items: [
    { title: 'MBTI Lens', caption: '대화 소재용 성향 비교', ready: true, href: '/lens/mbti' },
    { title: '사주 Lens', caption: '전통 해석으로 보는 관점', ready: false, href: null },
    { title: 'Astrology Lens', caption: '별자리 기반 해석', ready: true, href: '/lens/zodiac' },
  ],
} as const;

/** X1-a MBTI Lens 화면 */
export const MBTI_LENS_COPY = {
  title: ['너의 MBTI, 뭐야?'],
  caption: '대화 소재로 보는 참고용 렌즈야. 궁합 점수에는 반영하지 않아.',
  pickLabel: '유형 선택',
  changeLabel: '다시 고르기',
  emptyNotice: '아직 고르지 않았어. 위에서 하나 골라줘.',
} as const;

/** X1-b Astrology Lens 화면 */
export const ZODIAC_LENS_COPY = {
  title: ['너의 별자리, 뭐야?'],
  caption: '대화 소재로 보는 참고용 렌즈야. 궁합 점수에는 반영하지 않아.',
  pickLabel: '별자리 선택',
  emptyNotice: '아직 고르지 않았어. 위에서 하나 골라줘.',
} as const;
