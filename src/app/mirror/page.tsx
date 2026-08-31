'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/common/Button';
import { HydrationGate } from '@/components/common/HydrationGate';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { EmptyStateView, FillDataRow } from '@/components/common/StateScreens';
import { PageHeading, Tag } from '@/components/common/primitives';
import { RepeatedSignalNotice } from '@/components/history/PastObservationNote';
import { MirrorComparisonRow, MirrorLegend } from '@/components/mirror/MirrorComparisonRow';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { isLowData } from '@/lib/validation';
import { useMirror, useRepeatedSignals } from '@/hooks/useAnalysis';
import { useSession } from '@/state/SessionProvider';

/**
 * S27 Relationship Mirror — MVP의 가장 중요한 화면
 *
 * '항목별 대조(Mirror Gap Map)'가 메인 비주얼이다. 5개 축을 같은 방식으로 정량 측정된
 * 것처럼 보이게 하는 레이더 차트는 쓰지 않는다 — Relationship Me는 1~5 척도로 직접
 * 수집된 값이 아니므로, 두 숫자를 겹쳐 그리면 실제보다 정밀해 보이는 착시가 생긴다.
 *
 * 관계 경험이 없는 사용자(experience.skipped)는 이 화면에 올 이유가 없다 — S26에서 이미
 * 걸러졌어야 하지만, 직접 URL로 들어온 경우를 방어적으로 처리한다.
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
  const repeated = useRepeatedSignals();

  const lowData = isLowData(answers);

  useEffect(() => {
    if (!mirror.available) router.replace(ROUTES.home);
  }, [mirror.available, router]);

  useEffect(() => {
    if (!mirror.available || lowData) return;
    // 화면 진입은 아직 완료가 아니다 — 완료는 S28에서 저장을 눌렀을 때다.
    trackEvent('relationship_mirror_view', {
      gap_count: mirror.gapCount,
      compared_axes: mirror.insights.length,
    });
  }, [mirror.available, lowData, mirror.gapCount, mirror.insights.length]);

  if (!mirror.available) return null;

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
          caption={`비교 가능한 ${mirror.insights.length}개 기준에서`}
          eyebrow={
            gapInsights.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag tone="brand">차이 {gapInsights.length}개</Tag>
                <Tag tone="mint">
                  일치 {mirror.insights.length - gapInsights.length}개
                </Tag>
              </div>
            ) : (
              <Tag tone="mint">비교한 항목이 모두 비슷했어</Tag>
            )
          }
        />

        <section className="flex flex-col gap-2.5">
          <MirrorLegend />
          <ul className="flex flex-col gap-2.5">
            {mirror.insights.map((insight, index) => (
              <MirrorComparisonRow key={insight.key} insight={insight} index={index} />
            ))}
          </ul>
        </section>

        {/*
          §22 Past Observation — 현재 Mirror 판정 **아래**에 온다.
          현재 판정은 위에서 현재 데이터만으로 이미 끝났고, 이건 Supporting Evidence다.
          과거 기록만으로 없는 Gap을 만들지 않는다.
        */}
        {repeated.length > 0 ? <RepeatedSignalNotice signals={repeated} /> : null}
      </div>
    </ScreenLayout>
  );
}
