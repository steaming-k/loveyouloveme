'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { InlineError, NoticeBox, PageHeading } from '@/components/common/primitives';
import { PhotoGrid } from '@/components/profile/PhotoGrid';
import { PRIVACY } from '@/data/copy';
import { PHOTO_MAX_COUNT, PHOTO_MIN_COUNT } from '@/data/samplePhotos';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { isPhotoSelectionValid } from '@/lib/validation';
import { useSession } from '@/state/SessionProvider';

/** S07 사진 입력 — 실제 file input + 샘플 타일. 업로드 없이도 흐름이 막히지 않는다. */
export default function PhotoInputPage() {
  const router = useRouter();
  const { answers, applyDemoPhotos, clearPhotos } = useSession();
  const [error, setError] = useState<string | null>(null);

  const count = answers.photos.length;
  const valid = isPhotoSelectionValid(answers);

  const handleNext = () => {
    if (!valid) {
      setError(`관찰하려면 사진이 ${PHOTO_MIN_COUNT}장은 필요해. 샘플 사진으로 체험해도 괜찮아.`);
      return;
    }
    trackEvent('photo_input_complete', {
      count,
      uploads: answers.photos.filter((photo) => photo.source === 'upload').length,
    });
    router.push(ROUTES.photoAnalyzing);
  };

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.profileIntro} progress={22} counter="1/3" />}
      footer={
        <div className="flex flex-col gap-1.5">
          {error ? <InlineError message={error} /> : null}
          <Button onClick={handleNext}>러비에게 보여주기 · {count}장</Button>
          <p className="text-center text-meta text-ink-muted">{PRIVACY.photoFooter}</p>
        </div>
      }
      bodyClassName="pt-1.5 pb-3"
    >
      <div className="flex flex-col gap-4">
        <PageHeading
          lines={['평소의 네가 잘 보이는 사진을 골라줘.']}
          caption="취미, 관심사, 평소 시간을 보내는 방식을 관찰할게."
        />

        <div className="flex items-center justify-between px-1">
          <p className="text-meta text-ink-sub">
            <span className="font-semibold text-ink">{count}</span> / {PHOTO_MAX_COUNT}장 선택
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                applyDemoPhotos();
                setError(null);
              }}
              className="flex min-h-11 items-center px-2 text-meta font-semibold text-brand"
            >
              샘플 사진으로 체험
            </button>
            {count > 0 ? (
              <button
                type="button"
                onClick={clearPhotos}
                className="flex min-h-11 items-center px-2 text-meta text-ink-muted"
              >
                전체 해제
              </button>
            ) : null}
          </div>
        </div>

        <PhotoGrid />

        <NoticeBox>{PRIVACY.photo}</NoticeBox>
      </div>
    </ScreenLayout>
  );
}
