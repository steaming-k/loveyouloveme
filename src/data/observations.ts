import type { ObservedTrait } from '@/types';

/**
 * Observed Me — 사진 관찰 mock observation (S09)
 *
 * Demo Mode 고정 데이터다. 실제 이미지 픽셀을 분석하지 않으며,
 * UI는 이 배열을 직접 import하지 않고 aiService.analyzeObservedProfile() 로만 받는다.
 */
export const OBSERVED_TRAITS: readonly ObservedTrait[] = [
  {
    id: 'ob1',
    text: '영화 보는 걸 좋아함',
    confidence: 'high',
    evidence: '영화관·상영 시간표가 담긴 사진이 반복적으로 관찰됐어.',
  },
  {
    id: 'ob2',
    text: '혼자 보내는 시간도 즐김',
    confidence: 'high',
    evidence: '카페·책상처럼 혼자 있는 장면이 여러 장에서 나왔어.',
  },
  {
    id: 'ob3',
    text: '소수의 사람과 깊게 만나는 편',
    confidence: 'low',
    evidence: '사진에 등장하는 인물 수가 적었어. 다만 사진만으로는 확신하기 어려워.',
  },
  {
    id: 'ob4',
    text: '주말 외부 활동이 많은 편',
    confidence: 'medium',
    evidence: '산책·등산처럼 밖에서 찍은 사진이 절반 이상이었어.',
  },
] as const;

/** Relationship Profile(S18) 의 Observed Me 칩에 쓰는 짧은 라벨 */
export const OBSERVED_SHORT_LABEL: Record<string, string> = {
  ob1: '영화 감상',
  ob2: '혼자 있는 시간',
  ob3: '소수와 깊게',
  ob4: '주말 외부 활동',
};
