'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeaderAction } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading } from '@/components/common/primitives';
import {
  EvidencePreview,
  GapPreview,
  HistoryPreview,
  SignalPreview,
  SlideLovy,
} from '@/components/onboarding/OnboardingVisual';
import { ONBOARDING_CTA, ONBOARDING_SLIDES } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/**
 * S02~S05 온보딩 (v1.46 §20~§23 리뉴얼)
 *
 * 4장 구성과 각 장의 이유는 `data/copy.ts`의 `ONBOARDING_SLIDES` 주석에 있다.
 * 이 파일은 **배치와 전환만** 한다 — 카피·캐릭터 매핑을 여기서 정하지 않는다.
 *
 * ══ §23 Motion ════════════════════════════════════════════════════════════
 *
 * ```
 * 본문      opacity + 12px 가로 slide   (`slide-in`)
 * 캐릭터    살짝 늦게 fade/up            (`SlideLovy`의 120ms delay)
 * dot      width transition             (기존 그대로)
 * ```
 *
 * ⚠️ **swipe gesture와 충돌할 일이 없다** — 이 화면에는 swipe가 없고, 이번에도
 * 추가하지 않았다. 넘기는 방법은 CTA와 dot 두 개뿐이고 둘 다 명시적이다.
 *
 * ⚠️ **`key={slide.id}`로 요소를 교체해서** CSS 등장 애니메이션을 다시 재생시킨다.
 * JS 타이머로 재생을 관리하지 않으므로 빠르게 여러 번 눌러도 애니메이션이 쌓이지
 * 않는다 — 마지막 mount 하나만 남는다(§30 double click).
 */
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
                    'h-[5px] rounded-sm transition-all t-enter',
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
      <div key={slide.id} className="slide-in flex flex-col gap-[22px] px-1">
        {/*
          제목 + 캐릭터. **제목이 먼저 읽히고 캐릭터는 그 옆이다**(§22 · v1.45 §26).
          캐릭터는 96px `flex-none`이라 제목이 쓸 폭을 먼저 가져가지 못한다.
        */}
        <div className="flex items-start justify-between gap-3">
          <PageHeading lines={slide.title} size="display" className="min-w-0 px-0" />
          {/* §38 — 1장 캐릭터가 이 화면의 LCP다. 그 한 장만 preload한다 */}
          <SlideLovy pose={slide.pose} priority={index === 0} />
        </div>

        <p className="text-sub leading-relaxed keep-all text-ink-sub">
          {slide.caption.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>

        {slide.visual === 'signal' ? <SignalPreview /> : null}
        {slide.visual === 'evidence' ? <EvidencePreview /> : null}
        {slide.visual === 'gap' ? <GapPreview gap={slide.gap} /> : null}
        {slide.visual === 'history' ? <HistoryPreview /> : null}
      </div>
    </ScreenLayout>
  );
}
