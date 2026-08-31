import type { PhotoAsset } from '@/types';

/**
 * 샘플 사진 (Demo Mode)
 * 실제 AI 비전 API가 없으므로 이미지 내용을 분석하는 척하지 않는다.
 * 각 타일은 와이어프레임 S07의 라벨과 배경 톤을 그대로 사용하며,
 * 관찰 결과는 src/data/observations.ts 의 고정 mock observation에서 나온다.
 */
export const SAMPLE_PHOTOS: readonly PhotoAsset[] = [
  { id: 'p1', label: '주말 산책', source: 'sample', tone: '#EFEDE7' },
  { id: 'p2', label: '영화관 좌석', source: 'sample', tone: '#E6EDE9' },
  { id: 'p3', label: '집 책상', source: 'sample', tone: '#EDEAE4' },
  { id: 'p4', label: '친구 2명', source: 'sample', tone: '#E9EAEE' },
  { id: 'p5', label: '카페 혼자', source: 'sample', tone: '#F0EBE4' },
  { id: 'p6', label: '등산', source: 'sample', tone: '#E8ECEA' },
  { id: 'p7', label: '전시', source: 'sample', tone: '#EEECE6' },
  { id: 'p8', label: '반려동물', source: 'sample', tone: '#EAEAE4' },
] as const;

/** '샘플 사진으로 체험'을 눌렀을 때 선택되는 6장 */
export const DEMO_PHOTO_IDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;

export const PHOTO_MIN_COUNT = 3;
export const PHOTO_MAX_COUNT = 9;
export const PHOTO_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
