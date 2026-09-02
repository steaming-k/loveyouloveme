'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { SelectableRow } from '@/components/common/SelectableRow';
import { PageHeading, Tag } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { ADAPTIVE_FOLLOWUP } from '@/data/adaptive';
import { LOVY_LINES } from '@/data/copy';
import { pickAdaptiveTriggerAxis } from '@/lib/logic/mirror';
import { withReturnTo } from '@/lib/returnTo';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/**
 * Adaptive Follow-up (S16과 S17 사이, 조건부)
 *
 * 모든 사용자에게 나오는 화면이 아니다. Declared Me와 방금 답한 과거 관계 경험 사이에
 * 모순 후보(GAP)가 발견됐을 때만 등장한다. 답은 선택이며, 건너뛰어도 다음으로 넘어간다.
 */
export default function AdaptiveFollowupPage() {
  // v1.11 — 아래 View가 Edit Return(§27)을 위해 useSearchParams()를 쓴다.
  return (
    <Suspense fallback={null}>
      <AdaptiveFollowupView />
    </Suspense>
  );
}

function AdaptiveFollowupView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { answers, setAdaptiveAnswer } = useSession();
  const { declared, experience } = answers;

  // 이미 답한 축이 있으면 그 축을 계속 보여준다. 없으면 지금 상태 기준으로 다시 판단한다 —
  // back으로 돌아와 hardest를 바꾼 경우 더는 모순 후보가 아닐 수 있다.
  const axis = experience.adaptive?.axis ?? pickAdaptiveTriggerAxis(declared, experience);

  useEffect(() => {
    // 더는 물어볼 이유가 없으면(모순 후보가 사라졌으면) 조용히 다음 단계로 넘어간다.
    if (!axis) router.replace(withReturnTo(ROUTES.past(3), searchParams));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axis, router]);

  if (!axis) return null;

  const config = ADAPTIVE_FOLLOWUP[axis];

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.past(2)} progress={75} />}
      footer={
        <Button onClick={() => router.push(withReturnTo(ROUTES.past(3), searchParams))}>
          다음
        </Button>
      }
      bodyClassName="pt-4 pb-3"
    >
      <div className="flex flex-col gap-6">
        <LovyMessage pose="question" size={44} tone="lead">
          {LOVY_LINES.adaptiveIntro}
        </LovyMessage>

        <PageHeading
          lines={[config.question]}
          size="question"
          eyebrow={
            <Tag tone="brand" className="self-start">
              RELATIONSHIP ME
            </Tag>
          }
        />

        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={config.question}>
          {config.options.map((option) => (
            <SelectableRow
              key={option.id}
              name="adaptive-answer"
              value={option.id}
              label={option.label}
              selected={experience.adaptive?.optionId === option.id}
              onSelect={() => setAdaptiveAnswer(axis, option.id)}
            />
          ))}
        </div>
      </div>
    </ScreenLayout>
  );
}
