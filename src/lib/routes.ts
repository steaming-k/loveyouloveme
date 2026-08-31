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
  compatibility: '/compatibility',
  compatibilityWhy: '/compatibility/why',
  goodSignal: '/compatibility/good',
  frictionSignal: '/compatibility/friction',
  questions: '/compatibility/questions',
  mirrorTeaser: '/mirror/teaser',
  mirror: '/mirror',
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
  lensZodiac: '/lens/zodiac',
} as const;

/** 데스크톱 프로토타입 패널의 화면 점프 목록 (와이어프레임 1b 보드와 동일 순서) */
export interface ScreenBoardEntry {
  id: string;
  short: string;
  name: string;
  group: 'Core' | 'Key' | 'Edge' | 'Future' | 'Share' | 'Add-on';
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
  { id: 's21', short: 'S21', name: 'Compatibility Hero', group: 'Key', href: ROUTES.compatibility },
  { id: 's22', short: 'S22', name: 'Compatibility Detail', group: 'Key', href: ROUTES.compatibilityWhy },
  { id: 's23', short: 'S23', name: 'Good Signal', group: 'Core', href: ROUTES.goodSignal },
  { id: 's24', short: 'S24', name: 'Friction Signal', group: 'Key', href: ROUTES.frictionSignal },
  { id: 's25', short: 'S25', name: '대화 질문', group: 'Core', href: ROUTES.questions },
  { id: 's26', short: 'S26', name: 'Mirror Teaser', group: 'Key', href: ROUTES.mirrorTeaser },
  { id: 's27', short: 'S27', name: 'Relationship Mirror', group: 'Key', href: ROUTES.mirror },
  { id: 's28', short: 'S28', name: 'Core Insight', group: 'Key', href: ROUTES.coreInsight },
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
  { id: 'x1b', short: 'X1b', name: 'Astrology 렌즈', group: 'Add-on', href: ROUTES.lensZodiac },
];
