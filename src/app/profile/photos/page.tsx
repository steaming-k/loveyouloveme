'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { InlineError, NoticeBox, PageHeading } from '@/components/common/primitives';
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
 * S07 사진 입력 — **실제 업로드 사진만.**
 *
 * ⚠️ v1.37 — 이 화면은 **더 이상 퍼널의 입장권이 아니다.** §0이 '사진은 입장권이 아니다.
 * Observed는 보강 근거이고, 없으면 그 섹션만 없다'고 쓰는데, 실제로는 사진 3장을 못 내면
 * 여기서 끝이었다. 뒤 단계는 이미 사진 0장을 지원하고 있었는데(S08 실패 화면의 '질문으로
 * 계속하기' · v1.36이 고친 declared/3 하드코딩 · past/none 상태 표시) 입구만 잠겨 있었다.
 * 사진 없이 질문부터 시작하는 길이 그때부터 항상 열려 있다.
 *
 * ⚠️ **v1.44 — 고를 수 있는 샘플 타일을 없앴다.**
 *
 * v1.37은 '샘플 타일은 분석에 못 쓴다'를 **설명으로** 해결했다: `샘플 타일 · 화면 확인용`
 * 배지 · 선택 수 줄의 `샘플 타일 N개는 분석 제외` · 샘플만 고른 사람 전용 에러 문구까지
 * 화면에 붙었다. 그 설명이 전부 필요했다는 것 자체가 신호였다 —
 *
 * > **고를 수 있는 것은 분석되는 것이어야 한다.**
 *
 * 선택 가능한 요소를 사용자가 실제 입력이라고 읽는 것은 자연스럽다. 그래서 설명을 늘리는
 * 대신 선택 기능을 뺐고, 그 기능을 설명하기 위해서만 존재하던 UI(배지 · sampleCount ·
 * `샘플 타일 채우기` · 전용 validation 분기)도 함께 사라졌다.
 *
 * ⚠️ **'샘플 답변으로 결과부터 볼게'(`loadSampleSession()`)는 이것과 다른 기능이고 그대로다.**
 * 그건 S06에서 결과 화면으로 바로 가는 데모 세션이지 S07의 사진 입력이 아니다.
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
  const { answers, clearPhotos } = useSession();
  const [error, setError] = useState<string | null>(null);

  /**
   * 이 화면이 세는 유일한 수 — Provider에 실제로 갈 수 있는 사진.
   *
   * `answers.photos.length`를 쓰지 않는다. 데모 세션이나 이 변경 이전에 저장된 세션에는
   * 비-upload 사진이 남아 있을 수 있는데, 그건 사용자가 여기서 고른 것이 아니고 분석에도
   * 들어가지 않는다 — 화면이 세는 수와 분석이 받는 수가 다르면 안 된다.
   */
  const uploadCount = usablePhotoCount(answers);
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
      // v1.44 — 샘플 타일 전용 분기가 사라졌다. 고를 수 있는 사진이 업로드뿐이므로
      // 안 되는 이유도 하나뿐이다.
      setError(
        `관찰하려면 앨범에서 올린 사진이 ${PHOTO_MIN_COUNT}장은 필요해. 사진 없이 질문부터 시작해도 괜찮아.`,
      );
      return;
    }
    // `count`와 `uploads`는 이제 같은 값이다 — S07이 세는 사진이 업로드뿐이기 때문이다.
    // 이벤트 스키마는 그대로 두고 의미만 실제와 맞춘다(§12 새 이벤트 추가 금지).
    trackEvent('photo_input_complete', { count: uploadCount, uploads: uploadCount, skipped: false });
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
          {/*
            v1.44 — 조건에 `!valid`가 붙었다. 예전에는 이 에러를 지우는 유일한 곳이
            `샘플 타일 채우기` 핸들러였는데 그 버튼이 사라졌다. 사진을 충분히 올려 분석이
            가능해진 뒤에도 '3장은 필요해'가 남아 있으면 화면이 거짓말을 한다.
          */}
          {error && !valid ? <InlineError message={error} /> : null}
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

        {/*
          v1.44 — 샘플 타일이 사라지면서 '어떤 사진을 말하는 건지'를 보여주던 유일한 단서도
          함께 사라졌다. 클릭할 수 없는 가짜 사진 예시를 다시 만드는 대신 기준만 한 줄로 적는다.
        */}
        <p className="px-1 text-meta leading-relaxed keep-all text-ink-muted">
          여행 · 취미 · 운동 · 음식 · 일상처럼 평소 모습이 드러나는 사진이면 좋아.
        </p>

        <div className="flex items-center justify-between px-1">
          <p className="text-meta text-ink-sub">
            <span className="font-semibold text-ink">{uploadCount}</span> / {PHOTO_MAX_COUNT}장 선택
          </p>
          {uploadCount > 0 ? (
            <button
              type="button"
              onClick={clearPhotos}
              className="flex min-h-11 items-center px-2 text-meta text-ink-muted"
            >
              전체 해제
            </button>
          ) : null}
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
