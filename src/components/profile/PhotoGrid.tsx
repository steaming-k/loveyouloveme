'use client';

import { ImageIcon, Plus, X } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';

import { useToast } from '@/components/common/ToastProvider';
import {
  PHOTO_ACCEPTED_TYPES,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_COUNT,
  SAMPLE_PHOTOS,
} from '@/data/samplePhotos';
import { cn } from '@/lib/cn';
import { useSession } from '@/state/SessionProvider';
import type { PhotoAsset } from '@/types';

/**
 * 사진 입력 (S07)
 * 실제 브라우저 file input으로 업로드하고, 업로드 없이도 흐름을 진행할 수 있게
 * 샘플 타일을 함께 제공한다. 사진은 서버로 보내지 않는다.
 */
export function PhotoGrid() {
  const { answers, toggleSamplePhoto, addUploadedPhotos, removePhoto } = useSession();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedIds = new Set(answers.photos.map((photo) => photo.id));
  const uploads = answers.photos.filter((photo) => photo.source === 'upload');
  const remaining = PHOTO_MAX_COUNT - answers.photos.length;

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const rejected: string[] = [];
    const accepted: PhotoAsset[] = [];

    for (const file of files) {
      if (!PHOTO_ACCEPTED_TYPES.includes(file.type)) {
        rejected.push(`${file.name} · 이미지 파일이 아니에요`);
        continue;
      }
      if (file.size > PHOTO_MAX_BYTES) {
        rejected.push(`${file.name} · 10MB를 넘었어요`);
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
      showToast(`사진 ${accepted.length}장을 추가했어요`);
    }
    if (rejected.length > 0) {
      showToast(rejected[0] ?? '일부 사진을 추가하지 못했어요', 'warning');
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
            <button
              type="button"
              onClick={() => removePhoto(photo.id)}
              aria-label={`${photo.label} 사진 제거`}
              className="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white shadow-md"
            >
              <X size={13} aria-hidden />
            </button>
          </div>
        ))}

        {SAMPLE_PHOTOS.map((photo) => {
          const selected = selectedIds.has(photo.id);
          return (
            <button
              key={photo.id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              onClick={() => {
                if (!selected && remaining <= 0) {
                  showToast(`사진은 최대 ${PHOTO_MAX_COUNT}장까지 고를 수 있어`, 'warning');
                  return;
                }
                toggleSamplePhoto(photo.id);
              }}
              style={{ backgroundColor: photo.tone }}
              className={cn(
                'relative flex aspect-square items-end rounded-[10px] border-2 p-[7px] text-left text-[10px] text-[#8C877D] transition-colors',
                selected ? 'border-brand' : 'border-transparent',
              )}
            >
              {photo.label}
              {selected ? (
                <span
                  className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-white"
                  aria-hidden
                >
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-line-strong text-[11px] text-ink-muted active:bg-sunken"
        >
          <Plus size={17} aria-hidden />
          앨범
        </button>
      </div>
    </div>
  );
}
