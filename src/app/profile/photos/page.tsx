'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { InlineError, NoticeBox, PageHeading, Tag } from '@/components/common/primitives';
import { PhotoGrid } from '@/components/profile/PhotoGrid';
import { PRIVACY } from '@/data/copy';
import { PHOTO_MAX_COUNT, PHOTO_MIN_COUNT } from '@/data/samplePhotos';
import { trackEvent } from '@/lib/analytics';
import { AI_MODE_HINT } from '@/lib/env';
import { isProfileRevisitReturn, resolveReturnDestination, withReturnTo } from '@/lib/returnTo';
import { ROUTES } from '@/lib/routes';
import { isPhotoSelectionValid, usablePhotoCount } from '@/lib/validation';
import { useSession } from '@/state/SessionProvider';

/**
 * S07 사진 입력 — 실제 file input + 샘플 타일.
 *
 * ⚠️ v1.37 — 이 화면은 **더 이상 퍼널의 입장권이 아니다.** §0이 '사진은 입장권이 아니다.
 * Observed는 보강 근거이고, 없으면 그 섹션만 없다'고 쓰는데, 실제로는 사진 3장을 못 내면
 * 여기서 끝이었다. 뒤 단계는 이미 사진 0장을 지원하고 있었는데(S08 실패 화면의 '질문으로
 * 계속하기' · v1.36이 고친 declared/3 하드코딩 · past/none 상태 표시) 입구만 잠겨 있었다.
 *
 * 두 가지가 바뀌었다:
 *   ① 사진 없이 질문부터 시작하는 길이 항상 열려 있다.
 *   ② 샘플 타일은 색 타일이라 분석에 쓸 수 없다는 걸 **여기서** 말한다. 예전에는
 *      '샘플 사진으로 체험해도 괜찮아'라고 해놓고 6.1초 뒤 `NO_USABLE_IMAGE` 실패
 *      화면으로 보냈다(real 모드). 못 하는 일을 약속하지 않는다(§1.5-4).
 */
export default function PhotoInputPage() {
  // v1.16 — Profile Revisit(§27)에서 들어왔을 때 `from`을 잃지 않도록 PhotoInputView가
  // useSearchParams()를 쓴다.
  return (
    <Suspense fallback={null}>
      <PhotoInputView />
    </Suspense>
  );
}

function PhotoInputView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { answers, applyDemoPhotos, clearPhotos } = useSession();
  const [error, setError] = useState<string | null>(null);

  const count = answers.photos.length;
  /** Provider에 실제로 갈 수 있는 사진 수 — 샘플 타일은 여기 안 들어간다 */
  const uploadCount = usablePhotoCount(answers);
  const sampleCount = count - uploadCount;
  const valid = isPhotoSelectionValid(answers);
  /** v1.16 — Profile Result(Revisit)의 '사진 추가·수정'/Observed 뒤로가기로 들어온 경우 */
  const editingExisting = isProfileRevisitReturn(searchParams);
  /**
   * ⚠️ 이건 **표시용 힌트**다. 실제 동작 모드는 서버(`AI_MODE`)가 정하고, 결과의 진짜 모드는
   * 응답 `meta.mode`가 말한다(S09에서 그 값으로 배지를 그린다). 여기서 이 힌트를 쓰는 이유는
   * 사진을 고르는 시점에는 아직 응답이 없기 때문이다 — real 배포에서는
   * `NEXT_PUBLIC_AI_MODE=real`을 함께 맞춘다.
   */
  const realAi = AI_MODE_HINT === 'real';

  const handleNext = () => {
    if (!valid) {
      setError(
        // 샘플 타일만 고른 사람에게 '3장은 필요해'라고 하면 이미 3장을 골랐는데 왜 안 되는지
        // 알 수 없다. 안 되는 이유를 그대로 말한다.
        uploadCount === 0 && sampleCount > 0
          ? '샘플 타일은 색 타일이라 러비가 볼 수 있는 게 없어. 앨범에서 사진을 올리거나, 사진 없이 질문부터 시작해줘.'
          : `관찰하려면 앨범에서 올린 사진이 ${PHOTO_MIN_COUNT}장은 필요해. 사진 없이 질문부터 시작해도 괜찮아.`,
      );
      return;
    }
    trackEvent('photo_input_complete', { count, uploads: uploadCount, skipped: false });
    router.push(withReturnTo(ROUTES.photoAnalyzing, searchParams));
  };

  /**
   * §0 — 사진은 입장권이 아니다. 고른 타일이 있으면 지운다: '사진 없이'라고 말해놓고
   * 세션에 사진을 남기면 뒤 화면이 있지도 않은 근거를 세게 된다.
   */
  const handleSkip = () => {
    trackEvent('photo_input_complete', { count: 0, uploads: 0, skipped: true });
    clearPhotos();
    router.push(resolveReturnDestination(searchParams, ROUTES.declared(1)));
  };

  return (
    <ScreenLayout
      header={
        <ScreenHeader
          backHref={
            editingExisting
              ? resolveReturnDestination(searchParams, ROUTES.profileIntro)
              : ROUTES.profileIntro
          }
          progress={editingExisting ? undefined : 22}
          counter={editingExisting ? undefined : '1/3'}
          title={editingExisting ? '사진 추가·수정' : undefined}
        />
      }
      footer={
        <div className="flex flex-col gap-1.5">
          {error ? <InlineError message={error} /> : null}
          <Button onClick={handleNext}>
            {editingExisting
              ? `이 사진으로 다시 분석 · ${uploadCount}장`
              : `러비에게 보여주기 · ${uploadCount}장`}
          </Button>
          {/*
            분석을 돌릴 수 없는 상태에서만 보인다 — 사진 3장을 이미 올린 사람에게
            '사진 없이'를 권하지 않는다. 없는 선택지를 만들지도, 있는 길을 숨기지도 않는다.
          */}
          {valid ? null : (
            <Button variant="text" onClick={handleSkip}>
              {editingExisting ? '사진 없이 계속' : '사진 없이 질문부터 시작'}
            </Button>
          )}
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
            sampleCount > 0 ? (
              // '체험 중'이 아니다 — 샘플 타일로는 아무 관찰도 나오지 않는다.
              <Tag tone="neutral" className="self-start">
                샘플 타일 · 화면 확인용
              </Tag>
            ) : undefined
          }
        />

        {editingExisting ? (
          <NoticeBox>
            사진을 바꾸면 Observed Me만 다시 분석돼. 관계 성향·이전 경험·상대 정보는 그대로 남아.
          </NoticeBox>
        ) : null}

        {/*
          §0 — 사진은 입장권이 아니다. 여기서 못 넘어간다고 느끼지 않게, 없어도 되는 것과
          없으면 없는 것을 먼저 말한다.
        */}
        <p className="px-1 text-meta leading-relaxed keep-all text-ink-muted">
          사진이 없어도 괜찮아. 질문만으로도 관찰 기록은 만들어져 — 사진에서 나오는 관찰
          한 가지만 빠져. 나중에 언제든 추가할 수 있어.
        </p>

        <div className="flex items-center justify-between px-1">
          <p className="text-meta text-ink-sub">
            <span className="font-semibold text-ink">{uploadCount}</span> / {PHOTO_MAX_COUNT}장 선택
            {sampleCount > 0 ? (
              // 고른 타일 수를 숨기지 않되, 분석에 안 들어간다는 걸 같은 줄에서 말한다.
              <span className="text-ink-muted"> · 샘플 타일 {sampleCount}개는 분석 제외</span>
            ) : null}
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
              샘플 타일 채우기
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
