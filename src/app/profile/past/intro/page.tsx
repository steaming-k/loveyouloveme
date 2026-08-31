'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { LOVY_LINES } from '@/data/copy';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

const INTRO_POINTS = [
  { badge: '3', text: '짧은 질문 3개' },
  { badge: '·', text: '누구와 만났는지는 묻지 않아요' },
  { badge: '·', text: '긴 서술은 선택이에요' },
] as const;

/** S14 과거 관계 인트로 — 긴 에세이가 아니라 짧은 구조화 질문임을 먼저 알린다 */
export default function PastIntroPage() {
  const router = useRouter();
  const { skipExperience, resumeExperience } = useSession();

  return (
    <ScreenLayout
      header={<ScreenHeader backHref={ROUTES.declared(4)} progress={60} />}
      footer={
        <div className="flex flex-col gap-0.5">
          <Button
            onClick={() => {
              resumeExperience();
              router.push(ROUTES.past(1));
            }}
          >
            이전 관계 돌아보기
          </Button>
          <Button
            variant="text"
            onClick={() => {
              skipExperience();
              router.push(ROUTES.pastNone);
            }}
          >
            연애 경험이 없어
          </Button>
        </div>
      }
      bodyClassName="pt-2.5 pb-3"
    >
      <div className="flex flex-col gap-[22px]">
        <LovyMessage pose="book" size={54} tone="lead">
          {LOVY_LINES.pastIntro.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </LovyMessage>

        <PageHeading
          lines={['사진이나 성격만으로는 관계 속의 너를 알 수 없더라.']}
          caption="이전 관계에서 실제로 무엇이 중요했는지, 어떤 순간이 힘들었는지 물어볼게."
        />

        <ul className="flex flex-col gap-3 rounded-[16px] border border-line bg-surface p-4">
          {INTRO_POINTS.map((point) => (
            <li key={point.text} className="flex items-center gap-2.5">
              <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[6px] bg-brand-tint text-[11px] font-semibold text-brand-pressed">
                {point.badge}
              </span>
              <span className="text-sub keep-all">{point.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </ScreenLayout>
  );
}
