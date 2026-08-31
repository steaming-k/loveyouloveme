import { OBSERVED_TRAITS } from '@/data/observations';
import { PHOTO_MIN_COUNT } from '@/data/samplePhotos';
import type { ObservedTrait, PhotoAsset } from '@/types';

/**
 * 사진 관찰 초안 만들기 — Prototype Demo Logic
 *
 * 이미지 픽셀을 분석하지 않는다. 선택한 사진 수만 근거로 삼아
 * 관찰 개수를 조절할 뿐이다. 사진이 적으면 확신 낮은 관찰은 내놓지 않는다.
 */
export function buildObservedTraits(photos: PhotoAsset[]): ObservedTrait[] {
  if (photos.length < PHOTO_MIN_COUNT) return [];
  if (photos.length >= 5) return [...OBSERVED_TRAITS];
  return OBSERVED_TRAITS.filter((trait) => trait.confidence !== 'low');
}

/** '근거: 사진 N장' 배지 문구 */
export function observedEvidenceLabel(photos: PhotoAsset[]): string {
  return `근거: 사진 ${photos.length}장`;
}
