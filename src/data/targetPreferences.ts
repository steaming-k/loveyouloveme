import type { TargetInterestCategory } from '@/types';

/**
 * 상대가 좋아하는 것 (v1.13 §5). `TARGET_INTEREST_MAX`개까지 고를 수 있고, '기타'를 고르면 직접 입력
 * 필드가 열린다(§6). 이 목록 자체가 취향을 단정하지 않는다 — 사용자가 '안다'고 고른
 * 것만 저장한다.
 */
export const TARGET_INTEREST_CATEGORIES: readonly {
  value: Exclude<TargetInterestCategory, 'custom'>;
  label: string;
}[] = [
  { value: 'food', label: '맛집 · 음식' },
  { value: 'cafe', label: '카페' },
  { value: 'exhibition', label: '전시 · 미술' },
  { value: 'movie_show', label: '영화 · 공연' },
  { value: 'music', label: '음악' },
  { value: 'exercise', label: '운동' },
  { value: 'walk', label: '산책 · 자연' },
  { value: 'travel', label: '여행' },
  { value: 'game', label: '게임' },
  { value: 'reading', label: '독서' },
  { value: 'pet', label: '반려동물' },
  { value: 'photo', label: '사진' },
  { value: 'shopping', label: '쇼핑' },
  { value: 'drink', label: '술자리' },
  { value: 'home', label: '집에서 쉬기' },
];

/**
 * '상대가 좋아하는 것' 최대 개수.
 *
 * ⚠️ UT-1 P2 §2 — **5 → 10.** 5개가 좁다는 응답이 나왔다.
 *
 * ⚠️ **hard cap이다 — soft cap이 아니다.** 10개가 차면 11번째 선택은 실제로
 * 거부된다(`SessionProvider`의 `toggleTargetInterest`·`addCustomTargetInterest`가
 * `false`를 돌려주고, 화면은 `최대 10개까지 골랐어`로 바꿔 말한다). '저장만
 * bounded이고 선택은 열려 있다'는 뜻이 아니다.
 *
 * ══ 왜 상한을 아예 없애지 않았나 ═══════════════════════════════════════════
 *
 * 감사해보니 이 값이 흘러가는 곳은 생각보다 좁다:
 *
 * ```
 * 판정        어디에도 안 들어간다 — 동기화율·Mirror·History·comparedCount 전부(§11)
 * 문장 생성   `interests[0]` 하나만 읽는다 (`logic/approachHints` · `premiumService`)
 * AI Provider 아예 나가지 않는다 (`contextBuilders`에 없다)
 * ```
 *
 * 즉 개수를 늘려도 **AI context도 계산도 커지지 않는다.** 커지는 것은 저장되는
 * 배열과 화면의 칩 목록뿐이다. 그래서 상한을 없애도 계산은 안전하지만, `custom`
 * 자유 입력(40자)이 무한히 쌓이는 문을 열어두게 된다 — `RELATIONSHIP_EVENT_MAX`가
 * 3인 이유와 같은 종류의 판단이다(분량이 아니라 성격).
 *
 * 미리 정의된 카테고리가 15개이므로 10이면 '좁다'는 느낌은 사라지고, 자유 입력의
 * 증가는 여전히 bounded다. 상한을 더 올리는 변경은 이 두 문장을 먼저 뒤집어야 한다.
 */
export const TARGET_INTEREST_MAX = 10;
export const TARGET_CUSTOM_INTEREST_MAX_LENGTH = 40;
