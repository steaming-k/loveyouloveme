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

/**
 * 포즈 하나의 실제 렌더 크기. `Lovy`와 `LovySequence`가 **같은 함수**를 쓴다.
 *
 * ⚠️ 두 곳이 각자 계산하면 시퀀스 박스와 이미지 크기가 어긋나고, 그 어긋남은
 * 프레임이 바뀔 때 **레이아웃이 튀는 것**으로 나타난다(§30 CLS 금지).
 */
export function lovyRenderSize(pose: LovyPose, size: number): { width: number; height: number } {
  const asset = LOVY_ASSETS[pose];
  const width = Math.round(size * (LOVY_VISUAL_SCALE[pose] ?? 1));
  return { width, height: Math.round((width * asset.height) / asset.width) };
}

/* ────────────────────────────── Home 관찰 시퀀스 (v1.46 · §15~§19) */

/**
 * 첫 화면에서 러비가 반복하는 **관찰 루프.**
 *
 * ```
 * 기본 관찰 → 무언가 발견 → 돋보기 관찰 → 수첩에 기록 → (다시 기본 관찰)
 * ```
 *
 * 이건 장식이 아니라 **세계관의 요약**이다 — 러비는 사랑을 다 아는 전문가가 아니라
 * 관찰하고 기록하는 외계인이고, 그 다섯 글자(관찰·수집·연결·보고·기억)가 첫 화면에서
 * 4장으로 재생된다.
 *
 * ⚠️ **새 이미지를 만들지 않았다.** 네 장 전부 이미 runtime에 있던 에셋이다
 * (`chart`·`notice`·`observe`·`record`). `docs/캐릭터`의 나머지 이미지는 (a) 이미 있는
 * 포즈와 겹치거나 (b) 이 시퀀스의 서사에 들어갈 자리가 없어서 가져오지 않았다 —
 * 같은 역할의 에셋을 두 벌 두면 화면마다 다른 러비가 나온다(v1.45 주석과 같은 규칙).
 *
 * ══ v1.46 PremiumLens §42~§44 — 첫 프레임을 `hero` → `chart`로 바꿨다 ══════
 *
 * `hero`(= `docs/캐릭터/1.png`, SHA-256 동일)는 소품 없이 그냥 서 있는 기본 포즈라,
 * 뒤에 오는 세 장(전구 · 돋보기 · 기록판)과 이어지지 않고 관찰 루프가
 * '서 있다 → 갑자기 일한다'로 끊겨 읽혔다. `chart`는 관찰 기록 차트를 보며 턱을 괸
 * 모습이라 **이미 관찰 중인 idle**이고, 거기서 무언가를 알아채는 다음 장으로 자연스럽게
 * 이어진다. 감정이 강하지 않고(하트·축하·울음·잠 아님) 소품도 나머지 셋과 겹치지 않는다.
 *
 * ⚠️ **`hero.png` 파일 자체는 지우지 않았다**(§42) — Splash와 Onboarding이 쓴다.
 *
 * ⚠️ 이제 네 장이 전부 정방형 캔버스지만(291×298 · 1254×1254) `LovySequence`가
 * 네 장의 렌더 크기를 전부 구해 **가장 큰 박스**를 고정으로 잡는 로직은 그대로 둔다 —
 * `LOVY_VISUAL_SCALE`이 포즈마다 달라서 렌더 크기는 여전히 같지 않고, 프레임마다
 * 박스가 달라지면 crossfade 도중에 주변 텍스트가 밀린다.
 */
export interface LovySequenceFrame {
  pose: LovyPose;
  /** 이 프레임에서 러비가 무엇을 하는 중인지 — 스크린리더가 읽는 한 줄 */
  caption: string;
  /** §18 — 옆에 작대기 3개가 한 번 깜빡이는 프레임 (발견) */
  discovery?: true;
}

export const LOVY_HOME_SEQUENCE: readonly LovySequenceFrame[] = [
  { pose: 'chart', caption: '러비가 관찰 기록을 보고 있는 중' },
  { pose: 'notice', caption: '러비가 무언가를 알아챈 순간', discovery: true },
  { pose: 'observe', caption: '러비가 돋보기로 자세히 보는 중' },
  { pose: 'record', caption: '러비가 관찰한 것을 적는 중' },
];
