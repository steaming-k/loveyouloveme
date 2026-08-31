'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { Lovy } from '@/components/lovy/Lovy';
import { STATE_COPY } from '@/data/copy';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

const LAYER_STATUS = [
  { label: 'Observed Me · 완료', tone: 'mint' as const },
  { label: 'Declared Me · 완료', tone: 'purple' as const },
  { label: 'Relationship Me · 경험이 생기면', tone: 'pending' as const },
];

/**
 * E4 연애 경험 없음
 * 흐름을 막지 않는다. 지금의 기준을 기록해두고 나중에 실제 경험과 비교하도록 안내한다.
 */
export default function NoExperiencePage() {
  const router = useRouter();
  const { markComplete } = useSession();
  const copy = STATE_COPY.noExperience;

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.pastIntro} />}
      footer={
        <Button
          onClick={() => {
            markComplete('experience');
            markComplete('profile');
            trackEvent('profile_complete', { path: 'no_experience' });
            router.push(ROUTES.target);
          }}
        >
          상대 관찰하러 가기
        </Button>
      }
      centered
    >
      <div className="flex w-full flex-col gap-[18px] pb-10">
        <Lovy pose={copy.pose} size={110} decorative className="self-center" />

        <h1 className="text-center text-[21px] font-semibold leading-relaxed tracking-[-0.5px] keep-all">
          {copy.title.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>

        <p className="text-center text-[13.5px] leading-relaxed keep-all text-ink-sub">
          {copy.body}
        </p>

        <ul className="flex flex-col gap-2.5 rounded-[16px] border border-line bg-surface p-4">
          {LAYER_STATUS.map((layer) => (
            <li key={layer.label} className="flex items-center gap-2.5">
              <span
                className={cn(
                  'h-[18px] w-[18px] flex-none rounded-[5px]',
                  layer.tone === 'mint' && 'bg-mint-tint',
                  layer.tone === 'purple' && 'bg-brand-edge',
                  layer.tone === 'pending' && 'border border-dashed border-dash',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'text-[13.5px] keep-all',
                  layer.tone === 'pending' && 'text-ink-muted',
                )}
              >
                {layer.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ScreenLayout>
  );
}
