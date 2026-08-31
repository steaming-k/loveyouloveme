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

export const LOVY_ASSETS: Record<LovyPose, LovyAsset> = {
  hero: { src: '/lovy/hero.png', width: 440, height: 525, alt: '러비가 두 팔을 벌리고 인사하는 모습' },
  chart: { src: '/lovy/chart.png', width: 285, height: 265, alt: '러비가 관찰 기록 차트를 들고 있는 모습' },
  question: { src: '/lovy/question.png', width: 255, height: 265, alt: '러비가 물음표를 띄우고 갸웃하는 모습' },
  mug: { src: '/lovy/mug.png', width: 215, height: 265, alt: '러비가 컵을 들고 있는 모습' },
  record: { src: '/lovy/record.png', width: 255, height: 280, alt: '러비가 기록판에 메모하는 모습' },
  crystal: { src: '/lovy/crystal.png', width: 280, height: 220, alt: '러비가 관측 구슬을 들여다보는 모습' },
  book: { src: '/lovy/book.png', width: 230, height: 255, alt: '러비가 기록 노트를 펼쳐 든 모습' },
  laptop: { src: '/lovy/laptop.png', width: 320, height: 310, alt: '러비가 관측 장비를 다루는 모습' },
  observe: { src: '/lovy/observe.png', width: 310, height: 280, alt: '러비가 망원경으로 관찰하는 모습' },
  heart: { src: '/lovy/heart.png', width: 240, height: 265, alt: '러비가 하트를 들고 있는 모습' },
  cool: { src: '/lovy/cool.png', width: 255, height: 265, alt: '러비가 시크하게 서 있는 모습' },
  wand: { src: '/lovy/wand.png', width: 240, height: 230, alt: '러비가 관측봉을 든 모습' },
  calendar: { src: '/lovy/calendar.png', width: 285, height: 285, alt: '러비가 달력을 들고 있는 모습' },
  movie: { src: '/lovy/movie.png', width: 230, height: 275, alt: '러비가 영사기를 들고 있는 모습' },
};
