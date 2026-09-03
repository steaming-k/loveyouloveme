'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { InlineError, NoticeBox, PageHeading, Tag } from '@/components/common/primitives';
import { PhotoGrid } from '@/components/profile/PhotoGrid';
import { PRIVACY } from '@/data/copy';
import { PHOTO_MAX_COUNT, PHOTO_MIN_COUNT } from '@/data/samplePhotos';
import { trackEvent } from '@/lib/analytics';
import { AI_MODE_HINT } from '@/lib/env';
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
  /**
   * ⚠️ 이건 **표시용 힌트**다. 실제 동작 모드는 서버(`AI_MODE`)가 정하고, 결과의 진짜 모드는
   * 응답 `meta.mode`가 말한다(S09에서 그 값으로 배지를 그린다). 여기서 이 힌트를 쓰는 이유는
   * 사진을 고르는 시점에는 아직 응답이 없기 때문이다 — real 배포에서는
   * `NEXT_PUBLIC_AI_MODE=real`을 함께 맞춘다.
   */
  const realAi = AI_MODE_HINT === 'real';

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
          {/*
            §14 — Demo 모드에서는 사진이 나가지 않는다. 그런데도 '전송돼요'라고 말하면
            우리가 하지도 않는 일을 고지하는 것이라 안내가 거짓이 된다.
          */}
          <p className="text-center text-meta text-ink-muted">
            {realAi ? PRIVACY.photoFooter : PRIVACY.photoFooterDemo}
          </p>
        </div>
      }
      bodyClassName="pt-1.5 pb-3"
    >
      <div className="flex flex-col gap-4">
        <PageHeading
          lines={['평소의 네가 잘 보이는 사진을 골라줘.']}
          caption={PRIVACY.photoPurpose}
          eyebrow={
            answers.photos.some((photo) => photo.source === 'sample') ? (
              <Tag tone="neutral" className="self-start">
                샘플 데이터로 체험 중
              </Tag>
            ) : undefined
          }
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
        <NoticeBox>{realAi ? PRIVACY.photoAiNotice : PRIVACY.photoDemoNotice}</NoticeBox>
        <button
          type="button"
          onClick={() => router.push(ROUTES.privacy)}
          className="flex min-h-11 items-center justify-center text-meta text-ink-faint"
        >
          자세히 보기
        </button>
      </div>
    </ScreenLayout>
  );
}
