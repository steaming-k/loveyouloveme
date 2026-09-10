/**
 * 러비(Lovy) 캐릭터 에셋 레지스트리
 *
 * 최종 러비 에셋(public/lovy/*.png)만 사용한다. 새로운 캐릭터를 임의로 만들지 않는다.
 * 사용 규칙 — docs/design-guide.md §2
 *   Splash · Onboarding      96~200px
 *   Loading · Insight        46~180px
 *   Empty · Error            46~120px
 *   일반 입력 화면 Avatar     38~46px
 * 러비는 관찰자다. 상담가·점쟁이·전문가로 보이게 쓰지 않는다.
 */

export type LovyPose =
  | 'hero'
  | 'chart'
  | 'question'
  | 'mug'
  | 'record'
  | 'crystal'
  | 'book'
  | 'laptop'
  | 'observe'
  | 'heart'
  | 'cool'
  | 'wand'
  | 'calendar'
  | 'movie'
  /* ── v1.45 Premium 전용 (public/lovy/premium/*) ─────────────────────────
     ⚠️ 기존 14 포즈로 표현되지 않는 것만 추가했다. `docs/캐릭터`의 새 이미지 24장 중
     대부분은 이미 있는 포즈(돋보기 = observe · 물음표 = question · 책 = book)와 겹쳐서
     가져오지 않았다 — 같은 역할의 에셋을 두 벌 두면 화면마다 다른 러비가 나온다. */
  /** 흩어진 자료를 모아 정리하는 모습 — Premium이 파는 행동 자체 */
  | 'connect'
  /** 알아챈 모습 */
  | 'notice'
  /** 아직 결론을 내리지 않고 생각하는 모습 */
  | 'ponder'
  /** 표현을 기록으로 들고 있는 모습 */
  | 'together'
  /** 이번 관찰을 수첩에 적는 모습 */
  | 'note';

interface LovyAsset {
  src: string;
  width: number;
  height: number;
  /** 스크린리더용 설명 — 포즈마다 다르게 둔다 */
  alt: string;
}

/**
 * 캐릭터 에셋의 원본 픽셀 크기.
 *
 * ⚠️ 실제 파일 크기와 반드시 일치해야 한다. `Lovy`가 이 값으로 표시 높이를 계산하기 때문에
 * (`height = size * asset.height / asset.width`) 값이 어긋나면 이미지가 눌리거나 늘어난다.
 *
 * v1.7 에셋 교체 — 최종 캐릭터 이미지로 전부 갱신했다.
 * 이전 에셋은 포즈마다 타이트 크롭이라 종횡비가 다 달랐고(215×265 ~ 320×310),
 * 같은 `size`를 줘도 포즈에 따라 표시 높이가 46×57 / 46×42처럼 달라져 화면 간
 * 레이아웃이 흔들렸다. 새 에셋은 **`hero`를 제외하고 전부 291×298 균일 캔버스**여서
 * 같은 `size`면 항상 같은 박스가 나온다.
 */
const SQUARE = { width: 291, height: 298 } as const;

/**
 * v1.45 Premium 에셋의 원본 캔버스.
 *
 * ⚠️ **재인코딩하지 않고 원본을 그대로 복사했다**(`docs/캐릭터` → `public/lovy/premium/`,
 * SHA-256 동일). 그래서 1254×1254 그대로이고 기존 291×298 세트와 캔버스가 다르다 —
 * `next/image`가 화면에 필요한 크기로만 내려보내므로 전송량은 표시 크기를 따른다.
 */
const PREMIUM_SQUARE = { width: 1254, height: 1254 } as const;

/**
 * 시각 보정 배율 (v1.7 에셋 교체 후 추가).
 *
 * 새 에셋은 캐릭터 주위에 여백이 있는 균일 캔버스라, 기존 타이트 크롭 에셋과 같은
 * `size`를 줘도 캐릭터 몸통이 작게 보인다. 여백을 뺀 **캐릭터 몸통 높이**만 기존/신규
 * 파일에서 실측해 비율을 구했다(소품 bbox는 제외 — 달력·구슬·노트북이 있는 포즈는
 * 소품까지 잡히면 실제 캐릭터 크기와 다른 값이 나온다).
 *
 * `Lovy`가 `size`에 이 배율을 곱해 렌더 크기를 정하므로, 화면 코드에 있는 기존
 * `size={46}` 같은 숫자는 그대로 두면서 **캐릭터가 보이는 크기만** 교체 전과
 * 비슷하게 되돌린다.
 */
export const LOVY_VISUAL_SCALE: Record<LovyPose, number> = {
  hero: 1.06,
  observe: 1.06,
  record: 1.06,
  laptop: 1.0, // 신규가 기존과 같거나 더 커서 보정이 필요 없다
  question: 1.13,
  heart: 1.13,
  chart: 1.13,
  movie: 1.27,
  mug: 1.13,
  cool: 1.13,
  calendar: 1.05,
  book: 1.17,
  crystal: 1.35,
  wand: 1.3,
  /*
    v1.45 — 새 에셋의 알파 bbox를 실측해서 **몸통 높이 비율을 기존 세트에 맞췄다.**
    기준값: observe 0.752×1.06 = 0.797 · book 0.685×1.17 = 0.801 → 목표 ≈ 0.80.

      connect   fillH 0.834 → 0.96   (자료 뭉치까지 bbox에 들어와 가장 큰 값)
      note      fillH 0.797 → 1.00
      notice    fillH 0.778 → 1.03
      together  fillH 0.789 → 1.01
      ponder    fillH 0.687 → 1.16   (생각풍선 여백이 커서 보정이 가장 크다)
  */
  connect: 0.96,
  notice: 1.03,
  ponder: 1.16,
  together: 1.01,
  note: 1.0,
};

export const LOVY_ASSETS: Record<LovyPose, LovyAsset> = {
  // hero만 별도 대형 렌더 (Splash·Onboarding용)
  hero: { src: '/lovy/hero.png', width: 509, height: 558, alt: '러비가 가만히 서 있는 모습' },
  chart: { src: '/lovy/chart.png', ...SQUARE, alt: '러비가 관찰 기록 차트를 보고 있는 모습' },
  question: { src: '/lovy/question.png', ...SQUARE, alt: '러비가 물음표를 띄우고 갸웃하는 모습' },
  mug: { src: '/lovy/mug.png', ...SQUARE, alt: '러비가 컵을 들고 있는 모습' },
  record: { src: '/lovy/record.png', ...SQUARE, alt: '러비가 기록판에 메모하는 모습' },
  crystal: { src: '/lovy/crystal.png', ...SQUARE, alt: '러비가 관측 구슬을 들여다보는 모습' },
  book: { src: '/lovy/book.png', ...SQUARE, alt: '러비가 기록 노트를 펼쳐 든 모습' },
  laptop: { src: '/lovy/laptop.png', ...SQUARE, alt: '러비가 관측 장비를 다루는 모습' },
  observe: { src: '/lovy/observe.png', ...SQUARE, alt: '러비가 돋보기로 관찰하는 모습' },
  heart: { src: '/lovy/heart.png', ...SQUARE, alt: '러비가 하트를 들고 있는 모습' },
  cool: { src: '/lovy/cool.png', ...SQUARE, alt: '러비가 선글라스를 쓰고 있는 모습' },
  wand: { src: '/lovy/wand.png', ...SQUARE, alt: '러비가 별 지팡이를 든 모습' },
  calendar: { src: '/lovy/calendar.png', ...SQUARE, alt: '러비가 달력 옆에 서 있는 모습' },
  movie: { src: '/lovy/movie.png', ...SQUARE, alt: '러비가 3D 안경을 쓰고 팝콘을 든 모습' },

  /* v1.45 Premium — 원본은 `docs/캐릭터`에 그대로 두고 여기로 exact copy했다 */
  connect: {
    src: '/lovy/premium/lovy-connect.png',
    ...PREMIUM_SQUARE,
    alt: '러비가 흩어져 있던 관찰 자료를 모아 정리하는 모습',
  },
  notice: {
    src: '/lovy/premium/lovy-notice.png',
    ...PREMIUM_SQUARE,
    alt: '러비가 무언가를 알아챈 모습',
  },
  ponder: {
    src: '/lovy/premium/lovy-ponder.png',
    ...PREMIUM_SQUARE,
    alt: '러비가 컵을 들고 생각하는 모습',
  },
  together: {
    src: '/lovy/premium/lovy-together.png',
    ...PREMIUM_SQUARE,
    alt: '러비가 마음이 적힌 기록을 들고 있는 모습',
  },
  note: {
    src: '/lovy/premium/lovy-note.png',
    ...PREMIUM_SQUARE,
    alt: '러비가 수첩에 이번 관찰을 적는 모습',
  },
};
