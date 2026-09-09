'use client';

import { ImageIcon, Plus, X } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';

import { useToast } from '@/components/common/ToastProvider';
import {
  PHOTO_ACCEPTED_TYPES,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_COUNT,
} from '@/data/samplePhotos';
import { useSession } from '@/state/SessionProvider';
import type { PhotoAsset } from '@/types';

/**
 * 사진 입력 (S07) — **실제 업로드 사진만 다룬다.**
 *
 * ⚠️ v1.6부터 실제 AI Vision이 붙었다 — 업로드한 사진은 **분석을 위해 전송된다.**
 * 다만 분석 후 앱에는 관찰 결과와 근거만 남고 사진 원본은 저장하지 않는다(§31).
 *
 * ⚠️ **v1.44 — 고를 수 있는 샘플 타일을 없앴다.** 예전에는 색 타일 8개를 격자에 함께 그려
 * 선택하게 했는데, 그 타일은 실제 이미지가 아니라 `prepareImagesForAnalysis()`가 전부
 * 걸러냈다. 즉 **고를 수 있지만 분석에는 들어가지 않는 입력**이었고, v1.37은 그 모순을
 * 없애는 대신 설명(배지 · `N개는 분석 제외` · 전용 에러 문구)으로 덮었다. 고를 수 있는
 * 것은 분석되는 것이어야 한다 — 설명을 늘리는 대신 선택 기능 자체를 뺐다.
 *
 * `SAMPLE_PHOTOS` 자체는 남아 있다. 데모 세션(`loadSampleSession()`)과 dev fixture가
 * 쓰는 데이터이고, 그 둘은 S07의 사용자 입력 경로가 아니다.
 */
export function PhotoGrid() {
  const { answers, addUploadedPhotos, removePhoto } = useSession();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploads = answers.photos.filter((photo) => photo.source === 'upload');
  /**
   * 상한은 **업로드 사진 기준**이다. 세션에 비-upload 사진이 남아 있을 수 있는데
   * (데모 세션 · 이 변경 이전에 저장된 localStorage), 전체 길이로 세면 화면에 보이지도
   * 않는 사진이 업로드 칸을 잡아먹는다.
   */
  const remaining = PHOTO_MAX_COUNT - uploads.length;

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const rejected: string[] = [];
    const accepted: PhotoAsset[] = [];

    for (const file of files) {
      if (!PHOTO_ACCEPTED_TYPES.includes(file.type)) {
        // §13 — HEIC는 아직 지원하지 않는다. '이미지가 아니다'라고 하면 틀린 말이라
        // 무엇이 안 되는지 그대로 알린다.
        rejected.push(
          /heic|heif/i.test(`${file.type} ${file.name}`)
            ? `${file.name} · HEIC는 아직 못 읽어. JPG나 PNG로 저장해서 올려줘`
            : `${file.name} · JPG · PNG · WEBP만 올릴 수 있어`,
        );
        continue;
      }
      if (file.size > PHOTO_MAX_BYTES) {
        rejected.push(`${file.name} · 10MB를 넘었어`);
        continue;
      }
      if (accepted.length >= remaining) {
        rejected.push(`${file.name} · 최대 ${PHOTO_MAX_COUNT}장까지 골라줘`);
        continue;
      }

      accepted.push({
        id: `up-${Date.now()}-${accepted.length}`,
        label: file.name,
        source: 'upload',
        objectUrl: URL.createObjectURL(file),
      });
    }

    if (accepted.length > 0) {
      addUploadedPhotos(accepted);
      showToast(`사진 ${accepted.length}장을 추가했어`);
    }
    if (rejected.length > 0) {
      showToast(rejected[0] ?? '일부 사진을 추가하지 못했어', 'warning');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="sr-only"
        aria-label="앨범에서 사진 선택"
      />

      <div className="grid grid-cols-3 gap-[7px]">
        {uploads.map((photo) => (
          <div key={photo.id} className="relative">
            <div className="aspect-square overflow-hidden rounded-[10px] border-2 border-brand bg-sunken">
              {photo.objectUrl ? (
                // 로컬 blob URL이므로 next/image 최적화를 쓰지 않는다.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.objectUrl}
                  alt={`업로드한 사진: ${photo.label}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center">
                  <ImageIcon size={16} className="text-ink-faint" aria-hidden />
                  <span className="line-clamp-2 text-[9px] leading-tight text-ink-muted">
                    {photo.label}
                  </span>
                </div>
              )}
            </div>
            {/*
              v1.44 NEW-001 — **보이는 원(28px)은 그대로, 탭 영역만 44×44로 넓혔다.**

              QA 기준은 터치 타깃 ≥44px인데 이 버튼만 `h-7`(28px)이었다. 아이콘을 키우면
              썸네일을 가리므로 hit area만 키운다.

              ⚠️ 바깥으로 넓히지 않는다. 격자 `gap`이 7px이라 44px 상자를 원 중심에 맞춰
              키우면 옆 칸 썸네일 위로 14px 넘어간다 — 옆 사진 모서리를 누르면 이 사진이
              지워진다. 그래서 상자를 `-top-1 -right-1`(-4px)에 걸고 **안쪽으로** 넓혀
              gutter(7px) 안에 머무르게 했다. 원은 4px만 걸쳐 나오고 위치는 2px 이동한다.
            */}
            <button
              type="button"
              onClick={() => removePhoto(photo.id)}
              aria-label={`${photo.label} 사진 제거`}
              className="absolute -top-1 -right-1 flex h-11 w-11 items-start justify-end"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white shadow-md">
                <X size={13} aria-hidden />
              </span>
            </button>
          </div>
        ))}

        {remaining > 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-line-strong text-[11px] text-ink-muted active:bg-sunken"
          >
            <Plus size={17} aria-hidden />
            앨범
          </button>
        ) : null}
      </div>
    </div>
  );
}
