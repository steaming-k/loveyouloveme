'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading } from '@/components/common/primitives';
import { SignalCard } from '@/components/compatibility/SignalCard';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { LOVY_LINES } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { useCompatibility } from '@/hooks/useAnalysis';

/**
 * S24 관찰이 필요한 신호
 * 'RED FLAG' / 'WARNING' 같은 표현을 쓰지 않는다.
 * 안 맞는다는 판정이 아니라, 미리 알고 있으면 이야기하기 쉬운 지점으로 다룬다.
 */
export default function FrictionSignalPage() {
  const router = useRouter();
  const result = useCompatibility();

  useEffect(() => {
    trackEvent('friction_signal_view', { count: result.frictionSignals.length });
  }, [result.frictionSignals.length]);

  const hasFriction = result.frictionSignals.length > 0;

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.goodSignal} title="관찰이 필요한 신호" />}
      footer={<Button onClick={() => router.push(ROUTES.questions)}>이야기해볼 질문 보기</Button>}
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-4">
        <PageHeading
          lines={
            hasFriction
              ? ['여긴 조금 관찰해볼 필요가 있어.']
              : ['지금 입력으로는 큰 차이가 안 보여.']
          }
          caption={
            hasFriction
              ? '안 맞는다는 뜻이 아니야. 차이가 보이는 지점이야.'
              : '차이가 없다는 결론은 아니야. 아직 내가 못 본 것일 수도 있어.'
          }
          size="question"
        />

        {hasFriction ? (
          <ul className="flex flex-col gap-2.5">
            {result.frictionSignals.map((dimension) => (
              <SignalCard key={dimension.key} dimension={dimension} variant="friction" />
            ))}
          </ul>
        ) : null}

        <LovyMessage pose="question" size={46}>
          {hasFriction
            ? LOVY_LINES.friction
            : '차이가 안 보이는 건 정보가 적어서일 수도 있어. 이건 나도 확신이 없어.'}
        </LovyMessage>
      </div>
    </ScreenLayout>
  );
}
