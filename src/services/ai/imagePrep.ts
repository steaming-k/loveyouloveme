'use client';

import type { PhotoAsset } from '@/types';

/**
 * Vision 전송용 이미지 준비 (§57 Cost Guardrail · §58 Validation)
 *
 * 사진 9장을 원본 고해상도로 그대로 보내지 않는다 — 비용과 지연이 커진다. 다만 활동·장소를
 * 판단할 수 없을 정도로 낮추지도 않는다. 장변 1024px · JPEG 0.8 정도면 '어디서 무엇을 하는지'는
 * 충분히 읽히면서 요청 크기가 크게 줄어든다.
 *
 * ⚠️ 샘플 사진(source: 'sample')은 실제 이미지 파일이 아니라 색 타일이므로 전송 대상이 아니다 —
 * 실제 분석은 사용자가 업로드한 사진만 대상으로 한다.
 */

const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.8;
/** 개당 상한 (서버 검증과 맞춘다) */
const MAX_BYTES = 1_200_000;

/**
 * MIME 검사는 **업로드 시점에** 이미 끝난다(`PHOTO_ACCEPTED_TYPES` = jpeg/png/webp).
 * HEIC/HEIF는 그 목록에 없어서 애초에 세션에 들어오지 못한다 —
 * 브라우저 대부분이 `<img>`로 디코드하지 못해 캔버스 변환이 실패하기 때문이다(§13).
 * 여기서 다시 검사하지 않고, 그래도 디코드에 실패하면 `skipped`로 센다.
 *
 * ⚠️ EXIF는 **자동으로 제거된다.** 캔버스에 다시 그려 JPEG로 재인코딩하므로 원본의
 * GPS 좌표·촬영 시각·기기 정보가 결과 data URL에 남지 않는다. 이건 부수효과가 아니라
 * 이 방식을 택한 이유 중 하나다 — 사진 위치를 Provider에 보내지 않는다.
 */

export interface PreparedImage {
  imageId: string;
  dataUrl: string;
}

export interface ImagePrepResult {
  images: PreparedImage[];
  /** 전송하지 못한 사진 수 — '사진 N장 = 근거 N개'가 아니라는 걸 화면에 알리기 위해 */
  skipped: number;
}

/**
 * 업로드 사진만 Vision 전송용으로 변환한다.
 * 실패한 항목은 조용히 건너뛴다(손상 파일·0바이트·디코드 실패 등 §58).
 */
export async function prepareImagesForAnalysis(
  photos: readonly PhotoAsset[],
): Promise<ImagePrepResult> {
  const uploads = photos.filter((photo) => photo.source === 'upload' && photo.objectUrl);
  const images: PreparedImage[] = [];
  let skipped = photos.length - uploads.length;

  for (const photo of uploads) {
    try {
      const dataUrl = await downscaleToDataUrl(photo.objectUrl!);
      if (!dataUrl) {
        skipped += 1;
        continue;
      }
      // base64 길이로 대략 바이트 계산
      const base64 = dataUrl.split(',')[1] ?? '';
      if (Math.floor((base64.length * 3) / 4) > MAX_BYTES) {
        skipped += 1;
        continue;
      }
      // 사용자 원본 파일명을 보내지 않는다 — 세션 내부 id만 사용(§29)
      images.push({ imageId: photo.id, dataUrl });
    } catch {
      skipped += 1;
    }
  }

  return { images, skipped };
}

function downscaleToDataUrl(objectUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = image;
      if (width === 0 || height === 0) return resolve(null);

      const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);

      const context = canvas.getContext('2d');
      if (!context) return resolve(null);

      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      try {
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      } catch {
        // tainted canvas 등
        resolve(null);
      }
    };

    image.onerror = () => resolve(null);
    image.src = objectUrl;
  });
}

/**
 * 입력 지문 — 캐시 키이자 stale 응답 판별 기준(§55/§56).
 * 사진 선택이 바뀌면 값이 바뀌어야 하므로 id와 순서를 모두 반영한다.
 */
export function photoFingerprint(photos: readonly PhotoAsset[]): string {
  return photos.map((photo) => `${photo.source}:${photo.id}`).join('|') || 'empty';
}
