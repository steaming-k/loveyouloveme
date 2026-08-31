'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { AiNarrativeNotice } from '@/components/ai/AiModeNotice';
import { CompatibilityAxisNarrative } from '@/components/ai/NarrativeViews';
import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading } from '@/components/common/primitives';
import { SignalCard } from '@/components/compatibility/SignalCard';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { useCompatibilityNarrative } from '@/hooks/useAiNarrative';
import { useCompatibility } from '@/hooks/useAnalysis';

/** S23 잘 맞는 신호 — Signal → Evidence → Real-life Example */
export default function GoodSignalPage() {
  const router = useRouter();
  const result = useCompatibility();
  // S22에서 이미 호출됐다면 캐시를 즉시 읽는다 — 같은 지문이면 재호출하지 않는다(§40)
  const narrative = useCompatibilityNarrative();

  useEffect(() => {
    trackEvent('good_signal_view', { count: result.goodSignals.length });
  }, [result.goodSignals.length]);

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.compatibilityWhy} title="잘 맞는 신호" />}
      footer={
        <Button onClick={() => router.push(ROUTES.frictionSignal)}>
          관찰이 필요한 신호 보기
        </Button>
      }
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-4">
        <PageHeading
          lines={
            result.goodSignals.length > 0
              ? ['이건 꽤 잘 맞는데?']
              : ['잘 맞는 신호는 아직 안 보여.']
          }
          caption={
            result.goodSignals.length > 0
              ? undefined
              : '아직 아는 정보가 적어서일 수도 있어. 상대에 대해 더 알려주면 다시 볼게.'
          }
          size="question"
        />

        {result.goodSignals.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {result.goodSignals.map((dimension) => (
              <SignalCard
                key={dimension.key}
                dimension={dimension}
                variant="good"
                // 신호·근거 뒤에 AI 설명. 실패하면 카드만 남는다(§15)
                footer={
                  <CompatibilityAxisNarrative
                    axis={dimension.key}
                    narratives={narrative.data?.narratives}
                    status={narrative.status}
                  />
                }
              />
            ))}
          </ul>
        ) : (
          <LovyMessage pose="question" size={46}>
            비슷한 구간이 아직 안 잡혀. 상대에 대해 아는 항목을 더 알려주면 다시 볼게.
          </LovyMessage>
        )}

        <AiNarrativeNotice
          task="compatibility-narrative"
          status={narrative.status}
          reason={narrative.reason}
        />
      </div>
    </ScreenLayout>
  );
}
