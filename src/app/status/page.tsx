'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { SelectableRow } from '@/components/common/SelectableRow';
import { InlineError, PageHeading } from '@/components/common/primitives';
import { useToast } from '@/components/common/ToastProvider';
import { STATUS_LABEL, STATUS_SUPPORTED } from '@/data/labels';
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
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (!answers.status) {
      setError('지금 상태를 하나 골라줘.');
      return;
    }
    trackEvent('relationship_status_select', {
      status: answers.status,
      supported: STATUS_SUPPORTED[answers.status],
    });
    if (!STATUS_SUPPORTED[answers.status]) {
      showToast('이 상태에 맞는 분석은 아직 준비 중이야. 우선 지금 흐름으로 안내할게.');
    }
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
          caption="지금은 '연애 경험 있음'과 '관심 가는 사람 있음' 상태에 맞춰져 있어. 다른 상태는 준비 중이야."
        />

        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="관계 상태">
          {STATUS_ORDER.map((status) => (
            <SelectableRow
              key={status}
              name="relationship-status"
              value={status}
              label={STATUS_LABEL[status]}
              description={STATUS_SUPPORTED[status] ? undefined : '준비 중'}
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
