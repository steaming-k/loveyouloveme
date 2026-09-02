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
  | 'movie';

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
};
