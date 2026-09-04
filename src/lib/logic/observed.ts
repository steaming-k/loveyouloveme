import type { PhotoAsset } from '@/types';

/**
 * 사진 관찰 관련 표시 유틸.
 *
 * ⚠️ v1.22 — 예전에는 여기 `buildObservedTraits(photos)`가 있었다. 사진 **개수만** 보고
 * 고정 관찰 목록(ob1~ob4)을 돌려주는 함수였고, `aiSelectors.observedTraits`로 export만
 * 돼 있어서 실제로 호출하는 화면은 없었다. 사진 내용과 무관한 관찰을 만들어내는 코드는
 * 남겨두면 언젠가 다시 붙는다(§2) — 그래서 삭제했다.
 *
 * 실제 관찰은 `answers.observedAnalysis.traits`(Vision 결과)만 근거로 삼는다.
 */

/** '근거: 사진 N장' 배지 문구 */
export function observedEvidenceLabel(photos: PhotoAsset[]): string {
  return `근거: 사진 ${photos.length}장`;
}
