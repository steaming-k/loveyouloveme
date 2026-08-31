'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { NoticeBox } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { TeaserComparison } from '@/components/mirror/TeaserComparison';
import { LOVY_LINES, PRIVACY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { useCompatibility, useMirror } from '@/hooks/useAnalysis';

/**
 * S26 Relationship Mirror Teaser — 가장 중요한 Funnel Transition
 *
 * Primary KPI: relationship_mirror_entry_click / compatibility_complete
 * '내 분석 보기' 버튼 하나로 넘기지 않고, 어긋난 신호를 먼저 보여준 뒤 넘긴다.
 */
export default function MirrorTeaserPage() {
  const router = useRouter();
  const mirror = useMirror();
  const compatibility = useCompatibility();

  useEffect(() => {
    trackEvent('relationship_mirror_teaser_view', {
      axis: mirror.teaser.axisKey,
      gap_count: mirror.gapCount,
      score: compatibility.score ?? 0,
    });
  }, [mirror.teaser.axisKey, mirror.gapCount, compatibility.score]);

  return (
    <ScreenLayout
      footer={
        <div className="flex flex-col gap-0.5">
          <Button
            className="h-[56px] text-[16.5px]"
            onClick={() => {
              trackEvent('relationship_mirror_entry_click', {
                axis: mirror.teaser.axisKey,
                score: compatibility.score ?? 0,
              });
              router.push(ROUTES.mirror);
            }}
          >
            관계 속의 나 확인하기
          </Button>
          <Button
            variant="text"
            onClick={() => {
              trackEvent('relationship_mirror_postpone');
              router.push(ROUTES.home);
            }}
          >
            나중에 볼게
          </Button>
        </div>
      }
      bodyClassName="pt-4 pb-4"
    >
      <div className="flex flex-col gap-5">
        <LovyMessage pose="observe" size={56} emphasis={LOVY_LINES.teaserOne} tone="lead">
          {LOVY_LINES.teaserTwo.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </LovyMessage>

        <TeaserComparison teaser={mirror.teaser} />

        <p className="px-1 text-[22px] font-semibold leading-relaxed tracking-[-0.6px] keep-all">
          <span className="block">네가 생각하는 너와</span>
          <span className="block">관계 속의 너가</span>
          <span className="block">조금 다른 것 같아.</span>
        </p>

        <NoticeBox>{PRIVACY.mirror}</NoticeBox>
      </div>
    </ScreenLayout>
  );
}
