'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeaderAction } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading } from '@/components/common/primitives';
import {
  GapPreview,
  LovyPreview,
  SignalPreview,
} from '@/components/onboarding/OnboardingVisual';
import { ONBOARDING_CTA, ONBOARDING_SLIDES } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/** S02~S04 온보딩 — 와이어프레임 순서 유지, 건너뛰기와 progress indicator 포함 */
export default function OnboardingPage() {
  const router = useRouter();
  const { markComplete } = useSession();
  const [index, setIndex] = useState(0);

  const slide = ONBOARDING_SLIDES[index]!;
  const isLast = index === ONBOARDING_SLIDES.length - 1;

  const finish = (skipped: boolean) => {
    markComplete('onboarding');
    trackEvent('onboarding_complete', { skipped, last_step: index + 1 });
    router.push(ROUTES.status);
  };

  const goNext = () => {
    if (isLast) return finish(false);
    setIndex((prev) => prev + 1);
  };

  return (
    <ScreenLayout
      header={
        isLast ? (
          <div className="h-9" />
        ) : (
          <ScreenHeaderAction label="건너뛰기" onClick={() => finish(true)} />
        )
      }
      footer={
        <div className="flex flex-col gap-4">
          <div className="flex justify-center gap-1.5" role="tablist" aria-label="온보딩 진행">
            {ONBOARDING_SLIDES.map((item, dotIndex) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={dotIndex === index}
                aria-label={`${dotIndex + 1}번째 화면`}
                onClick={() => setIndex(dotIndex)}
                className="flex h-6 items-center"
              >
                <span
                  className={cn(
                    'h-[5px] rounded-sm transition-all duration-300',
                    dotIndex === index ? 'w-[18px] bg-brand' : 'w-[5px] bg-line-strong',
                  )}
                />
              </button>
            ))}
          </div>

          <Button onClick={goNext}>{ONBOARDING_CTA[index]}</Button>
        </div>
      }
      bodyClassName="pt-4 pb-2"
    >
      {/* key가 바뀌면 요소가 교체되어 CSS 등장 애니메이션이 다시 실행된다 */}
      <div key={slide.id} className="slide-in flex flex-col gap-[26px] px-1">
          <PageHeading lines={slide.title} size="display" className="px-0" />

          {slide.visual === 'signal' ? <SignalPreview caption={slide.caption} /> : null}
          {slide.visual === 'gap' ? <GapPreview /> : null}
          {slide.visual === 'lovy' ? (
            <div className="flex flex-col gap-[22px]">
              <p className="text-sub leading-relaxed keep-all text-ink-sub">
                {slide.caption.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
              <LovyPreview />
            </div>
          ) : null}
      </div>
    </ScreenLayout>
  );
}
