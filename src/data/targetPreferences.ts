import type { TargetInterestCategory } from '@/types';

/**
 * 상대가 좋아하는 것 (v1.13 §5). 최대 5개까지 고를 수 있고, '기타'를 고르면 직접 입력
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

export const TARGET_INTEREST_MAX = 5;
export const TARGET_CUSTOM_INTEREST_MAX_LENGTH = 40;
