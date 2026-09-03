/** 와이어프레임 화면 ID ↔ Route 매핑. 화면만 있고 Route가 없는 상태를 만들지 않는다. */

export const ROUTES = {
  splash: '/',
  onboarding: '/onboarding',
  status: '/status',
  profileIntro: '/profile/intro',
  photos: '/profile/photos',
  photoAnalyzing: '/profile/analyzing',
  observed: '/profile/observed',
  declared: (step: number) => `/profile/declared/${step}`,
  pastIntro: '/profile/past/intro',
  past: (step: number) => `/profile/past/${step}`,
  pastAdaptive: '/profile/past/adaptive',
  pastNone: '/profile/past/none',
  profileResult: '/profile/result',
  target: '/target',
  compatibilityAnalyzing: '/compatibility/analyzing',
  /** v1.11 — S21~S25(Hero+Detail+Good+Friction+Questions)를 합친 Canonical Route */
  compatibility: '/compatibility',
  /**
   * @deprecated v1.11 — `/compatibility`로 합쳐졌다. 이 상수는 Legacy Redirect 페이지가
   * `redirect()` 대상을 만들 때만 쓴다. 새 코드에서 링크로 쓰지 않는다.
   */
  compatibilityWhy: '/compatibility/why',
  /** @deprecated v1.11 — `/compatibility#good`으로 합쳐졌다. Legacy Redirect 전용 */
  goodSignal: '/compatibility/good',
  /** @deprecated v1.11 — `/compatibility#friction`으로 합쳐졌다. Legacy Redirect 전용 */
  frictionSignal: '/compatibility/friction',
  /** @deprecated v1.11 — `/compatibility#questions`로 합쳐졌다. Legacy Redirect 전용 */
  questions: '/compatibility/questions',
  mirrorTeaser: '/mirror/teaser',
  /** v1.11 — S27~S28(Map+Core Insight)을 합친 Canonical Route */
  mirror: '/mirror',
  /** @deprecated v1.11 — `/mirror#core-insight`로 합쳐졌다. Legacy Redirect 전용 */
  coreInsight: '/mirror/insight',
  home: '/home',
  shareCompatibility: '/share/compatibility',
  shareMirror: '/share/mirror',
  history: '/history',
  historyReport: '/history/report',
  /** Core Insight 저장 직후 Change Moment (§8/§9) */
  historySaved: '/history/saved',
  historyEntry: (id: string) => `/history/${id}`,
  lens: '/lens',
  lensMbti: '/lens/mbti',
  /** Entertainment Lens 공용 출생정보 입력 (v1.4) */
  lensBirth: '/lens/birth',
  lensSaju: '/lens/saju',
  lensAstrology: '/lens/astrology',
  /** v1.3 Route. 기존 링크가 깨지지 않도록 유지하고 /lens/astrology로 보낸다 */
  lensZodiac: '/lens/zodiac',
  /** 궁합 결과에서 '우리 둘을 보는 다른 렌즈'를 한 곳에 모은 허브 (v1.4) */
  compatibilityLenses: '/compatibility/lenses',
  /**
   * Premium Paywall (v1.5 Fake Door).
   * Route를 기능별로 늘리지 않고 `?source=`로 진입 지점을 구분한다 —
   * 어디서 들어왔는지가 '무엇에 돈을 내고 싶어하는지'를 판단하는 핵심 데이터다.
   */
  premium: (source: string) => `/premium?source=${source}`,
  premiumBase: '/premium',
  /** 개발·UT용 상세 미리보기. NEXT_PUBLIC_PREMIUM_PREVIEW=true일 때만 열린다 */
  premiumPreview: (feature: string) => `/premium-preview/${feature}`,
  /**
   * v1.9 — Premium Adaptive Deep Question. 실제 결제·리포트 연결이 없는 지금은
   * 개발·UT 통로로만 연다(§8) — 아무 보상 없이 프로덕션에서 심층 답변을 모으지 않는다.
   */
  deepQuestions: '/premium-preview/deep-questions',
  /** v1.12 §28 — 실제 데이터 동작 그대로 설명하는 Privacy 화면. 새 Settings 페이지는 만들지 않는다 */
  privacy: '/privacy',
} as const;

/**
 * v1.11 — 통합된 Result 화면 안의 section anchor id. Legacy Redirect와 Home 카드
 * '다시 보기' 링크가 여기 정의된 id로만 이동한다 — 문자열을 여기저기 흩뿌리지 않는다.
 */
export const RESULT_ANCHORS = {
  compatibilitySummary: 'summary',
  compatibilityWhy: 'why',
  compatibilityGood: 'good',
  compatibilityFriction: 'friction',
  /** v1.13 — '다가가는 힌트'(Approach Hints) */
  compatibilityApproach: 'approach',
  compatibilityLenses: 'lenses',
  compatibilityQuestions: 'questions',
  mirrorCoreInsight: 'core-insight',
} as const;

/** 데스크톱 프로토타입 패널의 화면 점프 목록 (와이어프레임 1b 보드와 동일 순서) */
export interface ScreenBoardEntry {
  id: string;
  short: string;
  name: string;
  group: 'Core' | 'Key' | 'Edge' | 'Future' | 'Share' | 'Add-on' | 'Legacy';
  href: string;
}

export const SCREEN_BOARD: readonly ScreenBoardEntry[] = [
  { id: 's01', short: 'S01', name: '스플래시', group: 'Core', href: ROUTES.splash },
  { id: 's02', short: 'S02', name: '온보딩', group: 'Core', href: ROUTES.onboarding },
  { id: 's05', short: 'S05', name: '관계 상태', group: 'Core', href: ROUTES.status },
  { id: 's06', short: 'S06', name: '프로필 빌딩 인트로', group: 'Core', href: ROUTES.profileIntro },
  { id: 's07', short: 'S07', name: '사진 입력', group: 'Core', href: ROUTES.photos },
  { id: 's08', short: 'S08', name: '사진 분석 로딩', group: 'Core', href: ROUTES.photoAnalyzing },
  { id: 's09', short: 'S09', name: 'Observed Me', group: 'Key', href: ROUTES.observed },
  { id: 's10', short: 'S10', name: 'Declared · 연락', group: 'Core', href: ROUTES.declared(1) },
  { id: 's11', short: 'S11', name: 'Declared · 갈등', group: 'Core', href: ROUTES.declared(2) },
  { id: 's12', short: 'S12', name: 'Declared · 개인 시간', group: 'Core', href: ROUTES.declared(3) },
  { id: 's13', short: 'S13', name: 'Declared · 애정·취미', group: 'Core', href: ROUTES.declared(4) },
  { id: 's14', short: 'S14', name: '과거 관계 인트로', group: 'Core', href: ROUTES.pastIntro },
  { id: 's15', short: 'S15', name: '과거 관계 Q1', group: 'Core', href: ROUTES.past(1) },
  { id: 's16', short: 'S16', name: '과거 관계 Q2', group: 'Core', href: ROUTES.past(2) },
  {
    id: 's16a',
    short: 'S16a',
    name: 'Adaptive Follow-up',
    group: 'Edge',
    href: ROUTES.pastAdaptive,
  },
  { id: 's17', short: 'S17', name: '과거 관계 Q3', group: 'Core', href: ROUTES.past(3) },
  { id: 's18', short: 'S18', name: 'Relationship Profile', group: 'Key', href: ROUTES.profileResult },
  { id: 's19', short: 'S19', name: '상대 정보 입력', group: 'Core', href: ROUTES.target },
  { id: 's20', short: 'S20', name: '궁합 로딩', group: 'Core', href: ROUTES.compatibilityAnalyzing },
  {
    id: 's21r',
    short: 'S21R',
    name: 'Compatibility Result (구 S21~S25)',
    group: 'Key',
    href: ROUTES.compatibility,
  },
  // v1.11 — 아래 4개는 /compatibility 안의 section으로 합쳐졌다. Route는 redirect로
  // 남아있으므로 점프 목록에서도 Legacy로 옮겨 접근은 유지하되 위계는 낮춘다(§52).
  {
    id: 's22',
    short: 'S22',
    name: 'Compatibility Detail (Legacy)',
    group: 'Legacy',
    href: ROUTES.compatibilityWhy,
  },
  { id: 's23', short: 'S23', name: 'Good Signal (Legacy)', group: 'Legacy', href: ROUTES.goodSignal },
  {
    id: 's24',
    short: 'S24',
    name: 'Friction Signal (Legacy)',
    group: 'Legacy',
    href: ROUTES.frictionSignal,
  },
  { id: 's25', short: 'S25', name: '대화 질문 (Legacy)', group: 'Legacy', href: ROUTES.questions },
  { id: 's26', short: 'S26', name: 'Mirror Teaser', group: 'Key', href: ROUTES.mirrorTeaser },
  {
    id: 's27r',
    short: 'S27R',
    name: 'Mirror Result (구 S27~S28)',
    group: 'Key',
    href: ROUTES.mirror,
  },
  {
    id: 's28',
    short: 'S28',
    name: 'Core Insight (Legacy)',
    group: 'Legacy',
    href: ROUTES.coreInsight,
  },
  { id: 's29', short: 'S29', name: '분석 후 홈', group: 'Core', href: ROUTES.home },
  // Edge 상태는 별도 화면이 아니라 실제 화면 안의 상태로 구현되어 있다.
  { id: 'e1', short: 'E1', name: '데이터 부족 (Mirror)', group: 'Edge', href: ROUTES.mirror },
  {
    id: 'e2',
    short: 'E2',
    name: 'AI 오류',
    group: 'Edge',
    href: `${ROUTES.photoAnalyzing}?error=1`,
  },
  { id: 'e3', short: 'E3', name: '확신 낮음 (궁합)', group: 'Edge', href: ROUTES.compatibility },
  { id: 'e4', short: 'E4', name: '연애 경험 없음', group: 'Edge', href: ROUTES.pastNone },
  // F1/F2는 v1.3에서 실제 기능이 됐다 — 정적 mock이 아니라 저장된 History를 읽는다.
  { id: 'f1', short: 'F1', name: 'Relationship History', group: 'Key', href: ROUTES.history },
  { id: 'f2', short: 'F2', name: '변화 리포트', group: 'Key', href: ROUTES.historyReport },
  { id: 'f3', short: 'F3', name: '저장 직후 Change Moment', group: 'Key', href: ROUTES.historySaved },
  { id: 'sh1', short: 'SH1', name: '궁합 공유 카드', group: 'Share', href: ROUTES.shareCompatibility },
  { id: 'sh2', short: 'SH2', name: 'Mirror 공유 카드', group: 'Share', href: ROUTES.shareMirror },
  { id: 'x1', short: 'X1', name: '러비의 다른 렌즈', group: 'Add-on', href: ROUTES.lens },
  { id: 'x1a', short: 'X1a', name: 'MBTI 렌즈', group: 'Add-on', href: ROUTES.lensMbti },
  { id: 'x1b', short: 'X1b', name: 'Astrology 렌즈', group: 'Add-on', href: ROUTES.lensAstrology },
  { id: 'x1c', short: 'X1c', name: '사주 렌즈', group: 'Add-on', href: ROUTES.lensSaju },
  { id: 'x2', short: 'X2', name: '출생정보 입력', group: 'Add-on', href: ROUTES.lensBirth },
  {
    id: 's22a',
    short: 'S22a',
    name: '다른 렌즈 허브',
    group: 'Add-on',
    href: ROUTES.compatibilityLenses,
  },
  {
    id: 'p1',
    short: 'P1',
    name: 'Premium Paywall',
    group: 'Add-on',
    href: ROUTES.premium('compatibility'),
  },
  {
    id: 'p2',
    short: 'P2',
    name: '정밀 관찰 리포트 (개발용)',
    group: 'Add-on',
    href: ROUTES.premiumPreview('relationship_deep_report'),
  },
  {
    id: 'p3',
    short: 'P3',
    name: 'Deep Question (개발용)',
    group: 'Add-on',
    href: ROUTES.deepQuestions,
  },
];
