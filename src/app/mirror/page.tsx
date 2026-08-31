'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { EmptyStateView, FillDataRow } from '@/components/common/StateScreens';
import { PageHeading, Tag } from '@/components/common/primitives';
import { MirrorComparisonRow, MirrorLegend } from '@/components/mirror/MirrorComparisonRow';
import { MirrorRadar } from '@/components/mirror/MirrorRadar';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { isLowData } from '@/lib/validation';
import { useMirror } from '@/hooks/useAnalysis';
import { useSession } from '@/state/SessionProvider';

/**
 * S27 Relationship Mirror — MVP의 가장 중요한 화면
 *
 * Compatibility 화면보다 완성도가 높아야 한다.
 * 레이더로 두 개의 '나'를 겹쳐 보여준 뒤, 항목별 대조로 근거를 읽게 한다.
 * 관측 기록이 얇으면(E1) 결론을 내리지 않는다.
 */
export default function MirrorPage() {
  return (
    <HydrationGate>
      <MirrorView />
    </HydrationGate>
  );
}

function MirrorView() {
  const router = useRouter();
  const { answers } = useSession();
  const mirror = useMirror();

  const lowData = isLowData(answers);

  useEffect(() => {
    if (lowData) return;
    trackEvent('relationship_mirror_complete', {
      gap_count: mirror.gapCount,
      focus_axis: mirror.teaser.axisKey,
    });
  }, [lowData, mirror.gapCount, mirror.teaser.axisKey]);

  if (lowData) {
    return (
      <ScreenLayout
        header={<ScreenHeader backHref={ROUTES.home} title="관계 속의 나" />}
        footer={<Button onClick={() => router.push(ROUTES.profileIntro)}>관측 기록 채우기</Button>}
      >
        <EmptyStateView
          actions={
            <div className="flex flex-col gap-2">
              <FillDataRow
                label="관계 경험 질문 3개"
                onClick={() => router.push(ROUTES.past(1))}
              />
              <FillDataRow label="사진 3장 더 고르기" onClick={() => router.push(ROUTES.photos)} />
              <FillDataRow
                label="관계 성향 질문 4개"
                onClick={() => router.push(ROUTES.declared(1))}
              />
            </div>
          }
        />
      </ScreenLayout>
    );
  }

  const gapInsights = mirror.insights.filter((insight) => insight.state !== 'MATCH');

  return (
    <ScreenLayout
      header={
        <ScreenHeader
          backHref={ROUTES.mirrorTeaser}
          centerLabel="RELATIONSHIP MIRROR"
          action={
            <button
              type="button"
              onClick={() => router.push(ROUTES.shareMirror)}
              className="flex h-11 items-center px-1 text-caption text-ink-sub"
            >
              공유
            </button>
          }
        />
      }
      footer={
        <Button onClick={() => router.push(ROUTES.coreInsight)}>가장 중요한 관찰 보기</Button>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-[18px]">
        <PageHeading
          lines={['네가 생각한 너', 'vs 관계에서 나타난 너']}
          size="hero"
          eyebrow={
            gapInsights.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag tone="brand">차이 {gapInsights.length}개</Tag>
                <Tag tone="mint">
                  일치 {mirror.insights.length - gapInsights.length}개
                </Tag>
              </div>
            ) : (
              <Tag tone="mint">모든 항목이 비슷했어</Tag>
            )
          }
        />

        <MirrorRadar insights={mirror.insights} />

        <section className="flex flex-col gap-2.5">
          <MirrorLegend />
          <ul className="flex flex-col gap-2.5">
            {mirror.insights.map((insight, index) => (
              <MirrorComparisonRow key={insight.key} insight={insight} index={index} />
            ))}
          </ul>
        </section>
      </div>
    </ScreenLayout>
  );
}
