'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/common/Button';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ScreenLayout } from '@/components/common/ScreenLayout';
import { PageHeading, Tag } from '@/components/common/primitives';
import { LovyMessage } from '@/components/lovy/LovyMessage';
import { LENS_COPY, LOVY_LINES } from '@/data/copy';
import { ZODIAC_NOTES } from '@/data/zodiac';
import { ROUTES } from '@/lib/routes';
import { useSession } from '@/state/SessionProvider';

/**
 * X1 러비의 다른 관측 렌즈 — Add-on Concept
 * 사주는 MVP Main Flow에 넣지 않고 '준비 중'으로 남긴다. MBTI·Astrology Lens는 실제 구현됐다.
 */
export default function LensPage() {
  const router = useRouter();
  const { answers } = useSession();

  /** 각 렌즈의 현재 선택값을 뱃지로 보여준다. 렌즈가 늘어나면 이 매핑만 추가하면 된다. */
  const valueByHref: Record<string, string | null> = {
    [ROUTES.lensMbti]: answers.mbti,
    [ROUTES.lensZodiac]: answers.zodiac ? ZODIAC_NOTES[answers.zodiac].label : null,
  };

  return (
    <ScreenLayout
      header={
        <ScreenHeader backHref={ROUTES.target} action={<Tag tone="neutral">{LENS_COPY.badge}</Tag>} />
      }
      footer={<Button variant="secondary" onClick={() => router.back()}>돌아가기</Button>}
      bodyClassName="pt-1.5 pb-4"
    >
      <div className="flex flex-col gap-4">
        <PageHeading lines={[LENS_COPY.title]} caption={LENS_COPY.caption} />

        <ul className="flex flex-col gap-2.5">
          {LENS_COPY.items.map((item) =>
            item.ready && item.href ? (
              <li key={item.title}>
                <button
                  type="button"
                  onClick={() => router.push(item.href)}
                  className="flex w-full items-center justify-between gap-3 rounded-row border border-line bg-surface p-4 text-left active:bg-sunken"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="text-[14.5px] font-medium">{item.title}</h3>
                    <p className="text-[12.5px] keep-all text-ink-sub">{item.caption}</p>
                  </div>
                  <Tag tone={valueByHref[item.href] ? 'brand' : 'neutral'}>
                    {valueByHref[item.href] ?? '보기 →'}
                  </Tag>
                </button>
              </li>
            ) : (
              <li
                key={item.title}
                className="flex items-center justify-between gap-3 rounded-row border border-line bg-surface p-4"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-[14.5px] font-medium">{item.title}</h3>
                  <p className="text-[12.5px] keep-all text-ink-sub">{item.caption}</p>
                </div>
                <Tag tone="neutral">준비 중</Tag>
              </li>
            ),
          )}
        </ul>

        <LovyMessage pose="movie" size={60}>
          {LOVY_LINES.lens}
        </LovyMessage>
      </div>
    </ScreenLayout>
  );
}
