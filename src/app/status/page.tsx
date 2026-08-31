'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { SelectableRow } from '@/components/common/SelectableRow';
import { InlineError, PageHeading } from '@/components/common/primitives';
import { STATUS_LABEL } from '@/data/labels';
import { trackEvent } from '@/lib/analytics';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';
import type { RelationshipStatus } from '@/types';

const STATUS_ORDER: RelationshipStatus[] = [
  'solo_none',
  'solo_exp',
  'crush',
  'dating',
  'married',
  'ended',
];

/** S05 관계 상태 — 상태에 따라 이후 질문 경로가 달라진다 */
export default function StatusPage() {
  const router = useRouter();
  const { answers, setStatus } = useSession();
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (!answers.status) {
      setError('지금 상태를 하나 골라줘. 물어볼 내용이 달라져.');
      return;
    }
    trackEvent('relationship_status_select', { status: answers.status });
    router.push(ROUTES.profileIntro);
  };

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.onboarding} progress={8} />}
      footer={
        <div className="flex flex-col gap-2">
          {error ? <InlineError message={error} /> : null}
          <Button onClick={handleNext}>다음</Button>
        </div>
      }
      bodyClassName="pt-2.5 pb-3"
    >
      <div className="flex flex-col gap-[18px]">
        <PageHeading
          lines={['지금 너의 관계 상태는 어때?']}
          caption="상태에 따라 물어볼 내용이 달라져."
        />

        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="관계 상태">
          {STATUS_ORDER.map((status) => (
            <SelectableRow
              key={status}
              name="relationship-status"
              value={status}
              label={STATUS_LABEL[status]}
              selected={answers.status === status}
              onSelect={() => {
                setStatus(status);
                setError(null);
              }}
            />
          ))}
        </div>
      </div>
    </ScreenLayout>
  );
}
